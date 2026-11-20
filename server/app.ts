import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import { DevAuthService, type DevAuthStoreOptions, type DevAuthUser } from './devAuth.ts';
import {
  UserAuthService,
  type UserAuthStoreOptions,
  type AuthenticatedErpUser,
  type StaffRole,
} from './userAuth.ts';

export const DEV_SESSION_COOKIE = 'hk_dev_session';
export const USER_SESSION_COOKIE = 'hk_user_session';

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    if (key) {
      try {
        result[key] = decodeURIComponent(val);
      } catch {
        result[key] = val;
      }
    }
  }
  return result;
}

function extractToken(req: Request, cookieName: string): string | null {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    const bearer = authHeader.slice(7).trim();
    if (bearer) return bearer;
  }
  const cookies = parseCookies(req.headers.cookie);
  return cookies[cookieName] || null;
}

function isHttpsRequest(req: Request): boolean {
  if (req.secure) return true;
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return false;
}

function setCookieWithOptions(
  req: Request,
  res: Response,
  cookieName: string,
  token: string,
  maxAgeMs: number
): void {
  const secure = isHttpsRequest(req);
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    maxAge: maxAgeMs,
  });
}

function clearCookieWithOptions(req: Request, res: Response, cookieName: string): void {
  const secure = isHttpsRequest(req);
  res.clearCookie(cookieName, {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
  });
}

export interface ApiAppOptions {
  devAuthOptions?: DevAuthStoreOptions;
  userAuthOptions?: UserAuthStoreOptions;
}

export function createApiRouter(options: ApiAppOptions = {}) {
  const authService = new DevAuthService(options.devAuthOptions);
  const userAuthService = new UserAuthService(
    options.userAuthOptions ?? {
      dataDir: options.devAuthOptions?.dataDir,
    }
  );
  void authService.ensureInitialized();
  void userAuthService.ensureInitialized();

  const router = express.Router();
  router.use(express.json({ limit: '64kb' }));

  // Ensure API responses are never cached
  router.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  type AuthenticatedDevRequest = Request & { devUser?: DevAuthUser; devToken?: string };
  type AuthenticatedErpRequest = Request & { erpUser?: AuthenticatedErpUser; erpToken?: string };

  const requireUserAuth = async (
    req: AuthenticatedErpRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = extractToken(req, USER_SESSION_COOKIE);
    const user = await userAuthService.verifySession(token);
    if (!user) {
      clearCookieWithOptions(req, res, USER_SESSION_COOKIE);
      res.status(401).json({
        authenticated: false,
        error: 'Authentication required. Your session may have expired or been invalidated.',
      });
      return;
    }
    req.erpUser = user;
    req.erpToken = token || undefined;
    next();
  };

  const requireAdminAuth = async (
    req: AuthenticatedErpRequest,
    res: Response,
    next: NextFunction
  ) => {
    const token = extractToken(req, USER_SESSION_COOKIE);
    const user = await userAuthService.verifySession(token);
    if (!user) {
      clearCookieWithOptions(req, res, USER_SESSION_COOKIE);
      res.status(401).json({
        authenticated: false,
        error: 'Authentication required.',
      });
      return;
    }
    if (user.role !== 'admin') {
      res.status(403).json({
        authenticated: true,
        error: 'Access denied. Only Admin/Owner accounts can access User & Password Management.',
      });
      return;
    }
    req.erpUser = user;
    req.erpToken = token || undefined;
    next();
  };

  const requireDeveloperAuth = (req: AuthenticatedDevRequest, res: Response, next: NextFunction) => {
    const token = extractToken(req, DEV_SESSION_COOKIE);
    const user = authService.verifySession(token);
    if (!user || user.role !== 'developer') {
      res.status(401).json({
        authenticated: false,
        error: 'Developer authentication required.',
      });
      return;
    }
    req.devUser = user;
    req.devToken = token || undefined;
    next();
  };

  // ==========================================
  // Unified Staff & Admin Authentication Routes
  // ==========================================

  router.post('/auth/login', async (req: Request, res: Response) => {
    const { username, password } = (req.body || {}) as { username?: string; password?: string };
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await userAuthService.login(username || '', password || '', clientKey);

    if (!result.ok || !result.sessionToken || !result.user) {
      res.status(result.status).json({
        authenticated: false,
        error: result.error || 'Authentication failed.',
      });
      return;
    }

    setCookieWithOptions(req, res, USER_SESSION_COOKIE, result.sessionToken, 12 * 60 * 60 * 1000);
    res.json({
      authenticated: true,
      user: result.user,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
    });
  });

  router.get('/auth/session', async (req: Request, res: Response) => {
    const token = extractToken(req, USER_SESSION_COOKIE);
    const user = await userAuthService.verifySession(token);
    if (!user) {
      clearCookieWithOptions(req, res, USER_SESSION_COOKIE);
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user });
  });

  router.post('/auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, USER_SESSION_COOKIE);
    userAuthService.logout(token);
    clearCookieWithOptions(req, res, USER_SESSION_COOKIE);
    res.json({ success: true });
  });

  // Normal staff recovery check
  router.post('/auth/recovery/staff-check', async (req: Request, res: Response) => {
    const { username } = (req.body || {}) as { username?: string };
    const result = await userAuthService.checkStaffRecovery(username || '');
    res.json(result);
  });

  // Owner Master Recovery verification (never logs in as staff; rate-limited; uses private server env secrets)
  router.post('/auth/recovery/owner-verify', async (req: Request, res: Response) => {
    const { recoveryId, masterPassword } = (req.body || {}) as {
      recoveryId?: string;
      masterPassword?: string;
    };
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await userAuthService.verifyOwnerRecovery(
      recoveryId || '',
      masterPassword || '',
      clientKey
    );

    if (!result.ok || !result.recoveryToken) {
      res.status(result.status).json({
        ok: false,
        error: result.error || 'Owner Master Recovery verification failed.',
      });
      return;
    }

    res.json({
      ok: true,
      recoveryToken: result.recoveryToken,
      expiresAt: result.expiresAt,
      users: result.users || [],
    });
  });

  // Owner Master Recovery staff password reset (requires valid short-lived recoveryToken)
  router.post('/auth/recovery/owner-reset', async (req: Request, res: Response) => {
    const recoveryToken = extractToken(req, 'hk_unused_recovery_cookie');
    const { targetUserId, newPassword, confirmPassword } = (req.body || {}) as {
      targetUserId?: string;
      newPassword?: string;
      confirmPassword?: string;
    };

    const result = await userAuthService.resetPasswordWithOwnerRecovery(
      recoveryToken,
      targetUserId || '',
      newPassword || '',
      confirmPassword || ''
    );

    if (!result.ok) {
      res.status(result.status).json({
        ok: false,
        error: result.error || 'Failed to reset user password.',
      });
      return;
    }

    res.json({
      ok: true,
      targetUsername: result.targetUsername,
      message: result.message,
    });
  });

  // Any authenticated user can change their own password (requires current password verification)
  router.post('/auth/change-own-password', requireUserAuth, async (req: AuthenticatedErpRequest, res: Response) => {
    const { currentPassword, newPassword, confirmPassword } = (req.body || {}) as {
      currentPassword?: string;
      newPassword?: string;
      confirmPassword?: string;
    };
    if (!req.erpUser) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }

    const result = await userAuthService.changeOwnPassword(
      req.erpUser,
      currentPassword || '',
      newPassword || '',
      confirmPassword || ''
    );

    if (!result.ok) {
      res.status(result.status).json({
        ok: false,
        error: result.error || 'Failed to update password.',
      });
      return;
    }

    clearCookieWithOptions(req, res, USER_SESSION_COOKIE);
    res.json({
      ok: true,
      sessionsInvalidated: true,
      message: result.message,
    });
  });

  // Admin-only User & Password Management routes
  router.get('/auth/users', requireAdminAuth, async (req: AuthenticatedErpRequest, res: Response) => {
    if (!req.erpUser) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }
    const result = await userAuthService.listUsersAndAudit(req.erpUser);
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.json({
      ok: true,
      users: result.users || [],
      auditLogs: result.auditLogs || [],
    });
  });

  router.post('/auth/users', requireAdminAuth, async (req: AuthenticatedErpRequest, res: Response) => {
    if (!req.erpUser) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }
    const { name, username, role, password, confirmPassword } = (req.body || {}) as {
      name?: string;
      username?: string;
      role?: StaffRole;
      password?: string;
      confirmPassword?: string;
    };
    const result = await userAuthService.createStaffUser(req.erpUser, {
      name: name || '',
      username: username || '',
      role: role === 'admin' ? 'admin' : 'accountant',
      password: password || '',
      confirmPassword: confirmPassword || '',
    });
    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }
    res.status(201).json({
      ok: true,
      user: result.user,
    });
  });

  router.post(
    '/auth/users/reset-password',
    requireAdminAuth,
    async (req: AuthenticatedErpRequest, res: Response) => {
      if (!req.erpUser) {
        res.status(401).json({ ok: false, error: 'Authentication required.' });
        return;
      }
      const { targetUserId, newPassword, confirmPassword } = (req.body || {}) as {
        targetUserId?: string;
        newPassword?: string;
        confirmPassword?: string;
      };
      const result = await userAuthService.adminResetUserPassword(
        req.erpUser,
        targetUserId || '',
        newPassword || '',
        confirmPassword || ''
      );
      if (!result.ok) {
        res.status(result.status).json({ ok: false, error: result.error });
        return;
      }
      res.json({
        ok: true,
        targetUsername: result.targetUsername,
        message: result.message,
      });
    }
  );

  // ==========================================
  // Internal / Legacy DevAuth Backend Module
  // ==========================================

  router.get('/dev-auth/status', async (_req: Request, res: Response) => {
    const configured = await authService.isConfigured();
    res.json({ configured });
  });

  router.post('/dev-auth/login', async (req: Request, res: Response) => {
    const { username, password } = (req.body || {}) as { username?: string; password?: string };
    const clientKey = req.ip || req.socket.remoteAddress || 'unknown';
    const result = await authService.login(username || '', password || '', clientKey);

    if (!result.ok || !result.sessionToken || !result.user) {
      res.status(result.status).json({
        authenticated: false,
        error: result.error || 'Authentication failed.',
      });
      return;
    }

    setCookieWithOptions(req, res, DEV_SESSION_COOKIE, result.sessionToken, 12 * 60 * 60 * 1000);
    res.json({
      authenticated: true,
      user: result.user,
      sessionToken: result.sessionToken,
      expiresAt: result.expiresAt,
    });
  });

  router.get('/dev-auth/session', (req: AuthenticatedDevRequest, res: Response) => {
    const token = extractToken(req, DEV_SESSION_COOKIE);
    const user = authService.verifySession(token);
    if (!user) {
      clearCookieWithOptions(req, res, DEV_SESSION_COOKIE);
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user });
  });

  router.post('/dev-auth/logout', (req: Request, res: Response) => {
    const token = extractToken(req, DEV_SESSION_COOKIE);
    authService.logout(token);
    clearCookieWithOptions(req, res, DEV_SESSION_COOKIE);
    res.json({ success: true });
  });

  router.post('/dev-auth/change-password', requireDeveloperAuth, async (req: AuthenticatedDevRequest, res: Response) => {
    const { currentPassword, newPassword, confirmNewPassword } = (req.body || {}) as {
      currentPassword?: string;
      newPassword?: string;
      confirmNewPassword?: string;
    };

    const result = await authService.changePassword(
      req.devToken,
      currentPassword || '',
      newPassword || '',
      confirmNewPassword || ''
    );

    if (!result.ok) {
      res.status(result.status).json({
        success: false,
        error: result.error || 'Failed to update developer password.',
      });
      return;
    }

    clearCookieWithOptions(req, res, DEV_SESSION_COOKIE);
    res.json({
      success: true,
      sessionsInvalidated: true,
      message: result.message,
    });
  });

  // Health probe
  router.get('/health', (_req: Request, res: Response) => {
    res.json({ ok: true, mode: 'web-express' });
  });

  return { router, authService, userAuthService };
}

export function createBackendApp(options: ApiAppOptions = {}) {
  const app = express();
  app.set('trust proxy', 1);
  const { router, authService, userAuthService } = createApiRouter(options);
  app.use('/api', router);
  return { app, authService, userAuthService };
}
