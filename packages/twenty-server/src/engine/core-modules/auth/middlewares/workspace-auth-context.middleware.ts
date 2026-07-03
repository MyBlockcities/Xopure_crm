import { randomUUID } from 'crypto';

import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

import { type NextFunction, type Request, type Response } from 'express';
import { isDefined } from 'twenty-shared/utils';

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { withWorkspaceAuthContext } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';
import { type WorkspaceAuthContext } from 'src/engine/core-modules/auth/types/workspace-auth-context.type';
import { buildApiKeyAuthContext } from 'src/engine/core-modules/auth/utils/build-api-key-auth-context.util';
import { buildApplicationAuthContext } from 'src/engine/core-modules/auth/utils/build-application-auth-context.util';
import { buildPendingActivationUserAuthContext } from 'src/engine/core-modules/auth/utils/build-pending-activation-user-auth-context.util';
import { buildUserAuthContext } from 'src/engine/core-modules/auth/utils/build-user-auth-context.util';
import { applyWorkspaceSentryContext } from 'src/engine/core-modules/sentry/utils/apply-workspace-sentry-context.util';

@Injectable()
export class WorkspaceAuthContextMiddleware implements NestMiddleware {
  private readonly accessLogger = new Logger('WorkspaceAccessLog');

  use(req: Request, res: Response, next: NextFunction) {
    if (!isDefined(req.workspace)) {
      next();

      return;
    }

    const authContext = this.buildAuthContext(req);
    const requestId = this.getOrCreateRequestId(req);
    const traceId = trace.getActiveSpan()?.spanContext().traceId;
    const startedAt = process.hrtime.bigint();

    authContext.requestId = requestId;
    authContext.traceId = traceId;

    res.setHeader?.('x-request-id', requestId);
    res.on?.('finish', () => {
      this.logAccess(req, res, authContext, startedAt);
    });

    applyWorkspaceSentryContext(authContext);

    void withWorkspaceAuthContext(authContext, () => {
      next();
    });
  }

  private buildAuthContext(req: Request): WorkspaceAuthContext {
    if (isDefined(req.apiKey)) {
      return buildApiKeyAuthContext({
        workspace: req.workspace!,
        apiKey: req.apiKey,
      });
    }

    if (
      isDefined(req.userWorkspaceId) &&
      isDefined(req.workspaceMemberId) &&
      isDefined(req.workspaceMember) &&
      isDefined(req.user)
    ) {
      return buildUserAuthContext({
        workspace: req.workspace!,
        userWorkspaceId: req.userWorkspaceId,
        user: req.user,
        workspaceMemberId: req.workspaceMemberId,
        workspaceMember: req.workspaceMember,
      });
    }

    if (isDefined(req.application)) {
      return buildApplicationAuthContext({
        workspace: req.workspace!,
        application: req.application,
      });
    }

    if (isDefined(req.userWorkspaceId) && isDefined(req.user)) {
      return buildPendingActivationUserAuthContext({
        workspace: req.workspace!,
        userWorkspaceId: req.userWorkspaceId,
        user: req.user,
      });
    }

    throw new AuthException(
      'No authentication context found',
      AuthExceptionCode.UNAUTHENTICATED,
    );
  }

  private getOrCreateRequestId(req: Request): string {
    return (
      this.getHeader(req, 'x-request-id') ??
      this.getHeader(req, 'x-correlation-id') ??
      randomUUID()
    );
  }

  private getHeader(req: Request, name: string): string | undefined {
    const value =
      req.header?.(name) ??
      req.get?.(name) ??
      req.headers?.[name.toLowerCase()];

    if (Array.isArray(value)) {
      return value[0];
    }

    return typeof value === 'string' && value.length > 0 ? value : undefined;
  }

  private logAccess(
    req: Request,
    res: Response,
    authContext: WorkspaceAuthContext,
    startedAt: bigint,
  ): void {
    this.accessLogger.log(
      JSON.stringify({
        type: 'workspace_access',
        requestId: authContext.requestId,
        traceId: authContext.traceId,
        authType: authContext.type,
        workspaceId: authContext.workspace.id,
        ...this.getActorFields(authContext),
        method: req.method,
        path: this.getSanitizedPath(req),
        graphqlOperationName: this.getGraphqlOperationName(req),
        statusCode: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - startedAt) / 1_000_000,
      }),
    );
  }

  private getActorFields(
    authContext: WorkspaceAuthContext,
  ): Record<string, string> {
    if (authContext.type === 'user') {
      return {
        userId: authContext.user.id,
        userWorkspaceId: authContext.userWorkspaceId,
        workspaceMemberId: authContext.workspaceMemberId,
      };
    }

    if (authContext.type === 'pendingActivationUser') {
      return {
        userId: authContext.user.id,
        userWorkspaceId: authContext.userWorkspaceId,
      };
    }

    if (authContext.type === 'apiKey') {
      return {
        apiKeyId: authContext.apiKey.id,
      };
    }

    if (authContext.type === 'application') {
      return {
        applicationId: authContext.application.id,
      };
    }

    return {};
  }

  private getSanitizedPath(req: Request): string | undefined {
    const path =
      req.baseUrl ||
      req.path ||
      (typeof req.originalUrl === 'string'
        ? req.originalUrl.split('?')[0]
        : undefined) ||
      (typeof req.url === 'string' ? req.url.split('?')[0] : undefined);

    return path || undefined;
  }

  private getGraphqlOperationName(req: Request): string | undefined {
    const body = req.body as { operationName?: unknown } | undefined;

    return typeof body?.operationName === 'string'
      ? body.operationName
      : undefined;
  }
}
