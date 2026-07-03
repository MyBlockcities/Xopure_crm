import type { NextFunction, Request, Response } from 'express';
import { Logger } from '@nestjs/common';

jest.mock('@opentelemetry/api', () => ({
  trace: {
    getActiveSpan: jest.fn(() => ({
      spanContext: () => ({ traceId: 'trace-id' }),
    })),
  },
}));

jest.mock('twenty-shared/utils', () => ({
  assertUnreachable: jest.fn(),
  CustomError: class CustomError extends Error {},
  isDefined: (value: unknown) => value !== null && value !== undefined,
}));

jest.mock(
  'src/engine/core-modules/sentry/utils/apply-workspace-sentry-context.util',
  () => ({
    applyWorkspaceSentryContext: jest.fn(),
  }),
);

import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { workspaceAuthContextStorage } from 'src/engine/core-modules/auth/storage/workspace-auth-context.storage';

import { WorkspaceAuthContextMiddleware } from '../workspace-auth-context.middleware';

const mockWorkspace = {
  id: 'workspace-id',
  displayName: 'Test Workspace',
} as Request['workspace'];

const mockUser = {
  id: 'user-id',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
} as Request['user'];

const mockApplication = {
  id: 'application-id',
  name: 'Test App',
  defaultRoleId: 'app-role-id',
} as Request['application'];

const mockApiKey = {
  id: 'api-key-id',
  name: 'Test API Key',
} as Request['apiKey'];

const mockWorkspaceMember = {
  id: 'workspace-member-id',
  name: { firstName: 'Test', lastName: 'User' },
} as Request['workspaceMember'];

describe('WorkspaceAuthContextMiddleware', () => {
  let middleware: WorkspaceAuthContextMiddleware;
  let mockResponse: Response;
  let mockNext: NextFunction;

  beforeEach(() => {
    middleware = new WorkspaceAuthContextMiddleware();
    mockResponse = {} as Response;
    mockNext = jest.fn();
  });

  const buildRequest = (overrides: Partial<Request> = {}): Request =>
    ({
      workspace: mockWorkspace,
      ...overrides,
    }) as unknown as Request;

  it('should call next without auth context when workspace is not defined', () => {
    const req = buildRequest({ workspace: undefined });

    middleware.use(req, mockResponse, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(workspaceAuthContextStorage.getStore()).toBeUndefined();
  });

  it('should create an apiKey auth context when apiKey is present', () => {
    const req = buildRequest({ apiKey: mockApiKey });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({ type: 'apiKey', apiKey: mockApiKey }),
    );
  });

  it('should create a user auth context when both application and user are present', () => {
    const req = buildRequest({
      application: mockApplication,
      user: mockUser,
      userWorkspaceId: 'user-workspace-id',
      workspaceMemberId: 'workspace-member-id',
      workspaceMember: mockWorkspaceMember,
    });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({
        type: 'user',
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: mockWorkspaceMember,
      }),
    );
  });

  it('should create an application auth context when application is present without user', () => {
    const req = buildRequest({ application: mockApplication });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({
        type: 'application',
        application: mockApplication,
      }),
    );
  });

  it('should fall back to application auth context when application and user are present but workspaceMember is missing', () => {
    const req = buildRequest({
      application: mockApplication,
      user: mockUser,
      userWorkspaceId: 'user-workspace-id',
    });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({
        type: 'application',
        application: mockApplication,
      }),
    );
  });

  it('should create a user auth context when user is present without application', () => {
    const req = buildRequest({
      user: mockUser,
      userWorkspaceId: 'user-workspace-id',
      workspaceMemberId: 'workspace-member-id',
      workspaceMember: mockWorkspaceMember,
    });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({
        type: 'user',
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
      }),
    );
  });

  it('should create a pendingActivationUser auth context when user and userWorkspaceId are present without workspaceMember', () => {
    const req = buildRequest({
      user: mockUser,
      userWorkspaceId: 'user-workspace-id',
    });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({
        type: 'pendingActivationUser',
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
      }),
    );
  });

  it('should throw AuthException when workspace is present but no auth mechanism is found', () => {
    const req = buildRequest();

    expect(() => middleware.use(req, mockResponse, mockNext)).toThrow(
      new AuthException(
        'No authentication context found',
        AuthExceptionCode.UNAUTHENTICATED,
      ),
    );
  });

  it('should prioritize apiKey over application and user', () => {
    const req = buildRequest({
      apiKey: mockApiKey,
      application: mockApplication,
      user: mockUser,
      userWorkspaceId: 'user-workspace-id',
      workspaceMemberId: 'workspace-member-id',
      workspaceMember: mockWorkspaceMember,
    });
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, mockResponse, mockNext);

    expect(capturedContext).toEqual(
      expect.objectContaining({ type: 'apiKey' }),
    );
  });

  it('should store inbound x-request-id on auth context and echo it via setHeader', () => {
    const inboundRequestId = 'inbound-req-456';
    const req = buildRequest({
      application: mockApplication,
      headers: { 'x-request-id': inboundRequestId },
    });
    const setHeader = jest.fn();
    let finishCallback: (() => void) | undefined;
    const responseWithSpies = {
      setHeader,
      on: jest
        .fn()
        .mockImplementation(
          (_event: string, cb: () => void) => (finishCallback = cb),
        ),
      statusCode: 200,
    } as unknown as Response;
    let capturedContext: unknown;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, responseWithSpies, mockNext);

    expect(setHeader).toHaveBeenCalledWith('x-request-id', inboundRequestId);
    expect(capturedContext).toEqual(
      expect.objectContaining({ requestId: inboundRequestId }),
    );
  });

  it('should generate a request ID when no inbound x-request-id header is present', () => {
    const req = buildRequest({ application: mockApplication });
    const setHeader = jest.fn();
    let capturedContext: unknown;
    const responseWithSpies = {
      setHeader,
      on: jest.fn(),
      statusCode: 200,
    } as unknown as Response;

    (mockNext as jest.Mock).mockImplementation(() => {
      capturedContext = workspaceAuthContextStorage.getStore();
    });

    middleware.use(req, responseWithSpies, mockNext);

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(setHeader).toHaveBeenCalledWith(
      'x-request-id',
      expect.stringMatching(uuidRegex),
    );
    const calledWith = setHeader.mock.calls[0][1];
    expect(capturedContext).toEqual(
      expect.objectContaining({ requestId: calledWith }),
    );
  });

  it('should log JSON with requestId, workspaceId, method, sanitized path, statusCode, and durationMs on finish', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const inboundRequestId = 'log-test-req-id';
    const req = buildRequest({
      application: mockApplication,
      headers: { 'x-request-id': inboundRequestId },
      method: 'POST',
      originalUrl: '/graphql',
    });
    let finishCallback: (() => void) | undefined;
    const responseWithSpies = {
      setHeader: jest.fn(),
      on: jest
        .fn()
        .mockImplementation(
          (_event: string, cb: () => void) => (finishCallback = cb),
        ),
      statusCode: 200,
    } as unknown as Response;

    middleware.use(req, responseWithSpies, mockNext);

    expect(finishCallback).toBeDefined();
    finishCallback?.();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logArg = logSpy.mock.calls[0][0];
    const parsed = JSON.parse(logArg as string);

    expect(parsed).toMatchObject({
      type: 'workspace_access',
      requestId: inboundRequestId,
      workspaceId: 'workspace-id',
      method: 'POST',
      path: '/graphql',
      statusCode: 200,
    });
    expect(typeof parsed.durationMs).toBe('number');

    logSpy.mockRestore();
  });

  it('should include userWorkspaceId and workspaceMemberId in user auth log', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const req = buildRequest({
      user: mockUser,
      userWorkspaceId: 'user-workspace-id',
      workspaceMemberId: 'workspace-member-id',
      workspaceMember: mockWorkspaceMember,
    });
    let finishCallback: (() => void) | undefined;
    const responseWithSpies = {
      setHeader: jest.fn(),
      on: jest
        .fn()
        .mockImplementation(
          (_event: string, cb: () => void) => (finishCallback = cb),
        ),
      statusCode: 201,
    } as unknown as Response;

    middleware.use(req, responseWithSpies, mockNext);

    expect(finishCallback).toBeDefined();
    finishCallback?.();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);

    expect(parsed).toMatchObject({
      authType: 'user',
      userWorkspaceId: 'user-workspace-id',
      workspaceMemberId: 'workspace-member-id',
    });

    logSpy.mockRestore();
  });

  it('should exclude authorization, cookie, raw body fields, and raw query values from log', () => {
    const logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    const req = buildRequest({
      application: mockApplication,
      headers: {
        'x-request-id': 'test-req',
        authorization: 'Bearer secret-token-123',
        cookie: 'session=abc123',
      },
      method: 'POST',
      originalUrl: '/graphql?secretKey=leaked&password=12345',
      body: { password: 'should-not-appear', operationName: 'TestOp' },
    });
    let finishCallback: (() => void) | undefined;
    const responseWithSpies = {
      setHeader: jest.fn(),
      on: jest
        .fn()
        .mockImplementation(
          (_event: string, cb: () => void) => (finishCallback = cb),
        ),
      statusCode: 200,
    } as unknown as Response;

    middleware.use(req, responseWithSpies, mockNext);

    expect(finishCallback).toBeDefined();
    finishCallback?.();

    expect(logSpy).toHaveBeenCalledTimes(1);
    const logArg = logSpy.mock.calls[0][0] as string;
    const logKeys = Object.keys(JSON.parse(logArg));

    expect(logKeys).not.toContain('authorization');
    expect(logKeys).not.toContain('cookie');
    expect(logKeys).not.toContain('password');
    expect(logArg).not.toContain('leaked');
    expect(logArg).not.toContain('secretKey');
    expect(logArg).not.toContain('secret-token-123');
    expect(logArg).not.toContain('session=abc123');
    expect(JSON.parse(logArg).graphqlOperationName).toBe('TestOp');

    logSpy.mockRestore();
  });

  it('should not set header or register finish listener when workspace is not defined', () => {
    const req = buildRequest({ workspace: undefined });
    const setHeader = jest.fn();
    const on = jest.fn();
    const responseWithSpies = {
      setHeader,
      on,
    } as unknown as Response;

    middleware.use(req, responseWithSpies, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(setHeader).not.toHaveBeenCalled();
    expect(on).not.toHaveBeenCalled();
  });
});
