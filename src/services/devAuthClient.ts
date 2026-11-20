import { getDesktopBridge } from '../platform/desktopBridge';
import type { User } from '../types';

const DEV_SESSION_TOKEN_KEY = 'hk_erp_dev_session_token';

function getStoredSessionToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(DEV_SESSION_TOKEN_KEY);
    }
  } catch {}
  return null;
}

function setStoredSessionToken(token: string | null): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) {
        sessionStorage.setItem(DEV_SESSION_TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(DEV_SESSION_TOKEN_KEY);
      }
    }
  } catch {}
}

function buildHeaders(includeJson: boolean = true): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = getStoredSessionToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export interface DevLoginResult {
  ok: boolean;
  user?: User;
  error?: string;
}

export interface DevChangePasswordResult {
  ok: boolean;
  sessionsInvalidated?: boolean;
  message?: string;
  error?: string;
  unauthorized?: boolean;
}

export const devAuthClient = {
  clearClientToken(): void {
    setStoredSessionToken(null);
  },

  async getStatus(): Promise<{ configured: boolean }> {
    const bridge = getDesktopBridge();
    if (bridge?.auth) {
      return bridge.auth.getStatus();
    }
    try {
      const res = await fetch('/api/dev-auth/status', {
        method: 'GET',
        credentials: 'include',
        headers: buildHeaders(false),
      });
      if (!res.ok) return { configured: false };
      return (await res.json()) as { configured: boolean };
    } catch {
      return { configured: false };
    }
  },

  async login(username: string, password: string): Promise<DevLoginResult> {
    const bridge = getDesktopBridge();
    if (bridge?.auth) {
      const res = await bridge.auth.login(username, password);
      if (!res.authenticated || !res.user) {
        setStoredSessionToken(null);
        return { ok: false, error: res.error || 'Invalid developer credentials.' };
      }
      if (res.sessionToken) setStoredSessionToken(res.sessionToken);
      return {
        ok: true,
        user: {
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          role: 'developer',
          pin: '',
        },
      };
    }

    try {
      const res = await fetch('/api/dev-auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(true),
        body: JSON.stringify({ username, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        sessionToken?: string;
        user?: { id: string; name: string; username: string; role: 'developer' };
        error?: string;
      };

      if (!res.ok || !data.authenticated || !data.user) {
        setStoredSessionToken(null);
        return { ok: false, error: data.error || 'Invalid developer credentials.' };
      }

      if (data.sessionToken) {
        setStoredSessionToken(data.sessionToken);
      }

      return {
        ok: true,
        user: {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
          role: 'developer',
          pin: '',
        },
      };
    } catch {
      return { ok: false, error: 'Unable to reach authentication server.' };
    }
  },

  async verifySession(): Promise<{ authenticated: boolean; user?: User }> {
    const bridge = getDesktopBridge();
    if (bridge?.auth) {
      const res = await bridge.auth.verifySession(getStoredSessionToken());
      if (!res.authenticated || !res.user) {
        setStoredSessionToken(null);
        return { authenticated: false };
      }
      return {
        authenticated: true,
        user: {
          id: res.user.id,
          name: res.user.name,
          username: res.user.username,
          role: 'developer',
          pin: '',
        },
      };
    }

    try {
      const res = await fetch('/api/dev-auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: buildHeaders(false),
      });
      if (!res.ok) {
        setStoredSessionToken(null);
        return { authenticated: false };
      }
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        user?: { id: string; name: string; username: string; role: 'developer' };
      };
      if (!data.authenticated || !data.user) {
        setStoredSessionToken(null);
        return { authenticated: false };
      }
      return {
        authenticated: true,
        user: {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
          role: 'developer',
          pin: '',
        },
      };
    } catch {
      return { authenticated: false };
    }
  },

  async logout(): Promise<void> {
    const token = getStoredSessionToken();
    setStoredSessionToken(null);
    const bridge = getDesktopBridge();
    if (bridge?.auth) {
      await bridge.auth.logout(token);
      return;
    }
    try {
      await fetch('/api/dev-auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // Token cleared client-side regardless
    }
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }): Promise<DevChangePasswordResult> {
    const bridge = getDesktopBridge();
    if (bridge?.auth) {
      const res = await bridge.auth.changePassword({
        sessionToken: getStoredSessionToken(),
        ...payload,
      });
      if (res.success) {
        setStoredSessionToken(null);
      }
      return {
        ok: res.success,
        sessionsInvalidated: res.sessionsInvalidated,
        message: res.message,
        error: res.error,
      };
    }

    try {
      const res = await fetch('/api/dev-auth/change-password', {
        method: 'POST',
        credentials: 'include',
        headers: buildHeaders(true),
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        sessionsInvalidated?: boolean;
        message?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        return {
          ok: false,
          error: data.error || 'Failed to update developer password.',
          unauthorized: res.status === 401 && data.error !== 'Current password is incorrect.',
        };
      }

      // Server invalidated all developer sessions; clear client token immediately
      setStoredSessionToken(null);

      return {
        ok: true,
        sessionsInvalidated: Boolean(data.sessionsInvalidated),
        message: data.message || 'Developer password updated successfully.',
      };
    } catch {
      return {
        ok: false,
        error: 'Unable to connect to the server to update password.',
      };
    }
  },
};
