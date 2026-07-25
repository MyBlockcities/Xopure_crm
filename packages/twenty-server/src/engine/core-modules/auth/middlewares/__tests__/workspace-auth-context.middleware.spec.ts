import { type NextFunction, type Request, type Response } from 'express';

import { Logger } from '@nestjs/common';

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

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'generated-request-id'),
}));

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

  describe('request correlation and access logging', () => {
    let finishHandler: () => void;
    let logSpy: jest.SpyInstance;

    const createMockResponse = (statusCode = 200) => {
      finishHandler = () => {};

      return {
        statusCode,
        setHeader: jest.fn(),
        on: jest.fn((_event: string, cb: () => void) => {
          finishHandler = cb;
        }),
      } as unknown as Response;
    };

    beforeEach(() => {
      middleware = new WorkspaceAuthContextMiddleware();
      logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    });

    afterEach(() => {
      logSpy.mockRestore();
    });

    // ── Contract 1: Accepts inbound x-request-id ──
    it('should accept an inbound x-request-id header, store it on the auth context, and echo it as a response header', () => {
      const mockResponse = createMockResponse();
      const mockNext = jest.fn();
      const req = {
        workspace: mockWorkspace,
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: mockWorkspaceMember,
        headers: { 'x-request-id': 'inbound-abc-123' },
      } as unknown as Request;

      let capturedContext: unknown;
      (mockNext as jest.Mock).mockImplementation(() => {
        capturedContext = workspaceAuthContextStorage.getStore();
      });

      middleware.use(req, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        'inbound-abc-123',
      );
      expect(capturedContext).toEqual(
        expect.objectContaining({ requestId: 'inbound-abc-123' }),
      );
    });

    // ── Contract 2: Generates request ID when absent ──
    it('should generate a request ID when no x-request-id header is present, storing and echoing it', () => {
      const mockResponse = createMockResponse();
      const mockNext = jest.fn();
      const req = {
        workspace: mockWorkspace,
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: mockWorkspaceMember,
        headers: {},
      } as unknown as Request;

      let capturedContext: unknown;
      (mockNext as jest.Mock).mockImplementation(() => {
        capturedContext = workspaceAuthContextStorage.getStore();
      });

      middleware.use(req, mockResponse, mockNext);

      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        'x-request-id',
        'generated-request-id',
      );
      expect(capturedContext).toEqual(
        expect.objectContaining({ requestId: 'generated-request-id' }),
      );
    });

    // ── Contract 3: Access log on finish ──
    it('should emit a structured access log on response finish containing requestId, workspaceId, statusCode, method, path, and durationMs', () => {
      const mockResponse = createMockResponse(200);
      const mockNext = jest.fn();
      const req = {
        workspace: mockWorkspace,
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: mockWorkspaceMember,
        headers: { 'x-request-id': 'log-test-1' },
        method: 'POST',
        path: '/graphql',
      } as unknown as Request;

      middleware.use(req, mockResponse, mockNext);
      jest.advanceTimersByTime(50);
      finishHandler();

      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall).toEqual(
        expect.objectContaining({
          requestId: 'log-test-1',
          workspaceId: 'workspace-id',
          statusCode: 200,
          method: 'POST',
          path: expect.any(String),
          durationMs: expect.any(Number),
        }),
      );
      expect(logCall.durationMs).toBeGreaterThanOrEqual(45);
    });

    // ── Contract 4: User context fields in log ──
    it('should include userWorkspaceId and workspaceMemberId in the access log when user auth context is present', () => {
      const mockResponse = createMockResponse(200);
      const mockNext = jest.fn();
      const req = {
        workspace: mockWorkspace,
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: mockWorkspaceMember,
        headers: {},
        method: 'POST',
        path: '/graphql',
      } as unknown as Request;

      middleware.use(req, mockResponse, mockNext);
      finishHandler();

      expect(logSpy).toHaveBeenCalled();
      const logCall = logSpy.mock.calls[0][0];
      expect(logCall).toEqual(
        expect.objectContaining({
          userWorkspaceId: 'user-workspace-id',
          workspaceMemberId: 'workspace-member-id',
        }),
      );
    });

    // ── Contract 5: Sensitive data exclusion ──
    it('should not include authorization header, cookie header, request body, or raw query string values in the access log', () => {
      const mockResponse = createMockResponse(200);
      const mockNext = jest.fn();
      const req = {
        workspace: mockWorkspace,
        user: mockUser,
        userWorkspaceId: 'user-workspace-id',
        workspaceMemberId: 'workspace-member-id',
        workspaceMember: mockWorkspaceMember,
        headers: {
          authorization: 'Bearer super-secret-token',
          cookie: 'session=abc123',
          'x-request-id': 'sensitive-test',
        },
        method: 'GET',
        path: '/graphql',
        originalUrl: '/graphql?token=secret&code=123',
        query: { token: 'secret', code: '123' },
        body: { query: 'mutation { login($p: String!) { login(password: $p) } }' },
      } as unknown as Request;

      middleware.use(req, mockResponse, mockNext);
      finishHandler();

      const logCall = logSpy.mock.calls[0][0];
      const loggedText = JSON.stringify(logCall);

      // Sanitized path must not contain query string
      expect(logCall.path).not.toMatch(/[?&]/);
      // No raw header values in the log
      expect(loggedText).not.toContain('super-secret-token');
      expect(loggedText).not.toContain('session=abc123');
      // No raw query values
      expect(loggedText).not.toContain('token=secret');
      expect(loggedText).not.toContain('code=123');
      // No body content
      expect(loggedText).not.toContain('mutation');
      expect(loggedText).not.toContain('password');
    });

    // ── Contract 6: No workspace fallthrough ──
    it('should call next and not emit any access log when request has no workspace', () => {
      const mockResponse = createMockResponse(200);
      const mockNext = jest.fn();
      const req = {
        headers: {},
        method: 'GET',
        path: '/open-endpoint',
      } as unknown as Request;

      middleware.use(req, mockResponse, mockNext);
      finishHandler();

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.on).not.toHaveBeenCalled();
      expect(mockResponse.setHeader).not.toHaveBeenCalled();
      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
