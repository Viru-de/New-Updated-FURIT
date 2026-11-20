import type { PasswordAuditEntry, SafeUserSummary, User } from '../types';

const USER_SESSION_TOKEN_KEY = 'hk_erp_user_session_token';

function getStoredUserToken(): string | null {
  try {
    if (typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem(USER_SESSION_TOKEN_KEY);
    }
  } catch {}
  return null;
}

function setStoredUserToken(token: string | null): void {
  try {
    if (typeof sessionStorage !== 'undefined') {
      if (token) {
        sessionStorage.setItem(USER_SESSION_TOKEN_KEY, token);
      } else {
        sessionStorage.removeItem(USER_SESSION_TOKEN_KEY);
      }
    }
  } catch {}
}

function buildAuthHeaders(includeJson: boolean = true, overrideBearer?: string): Record<string, string> {
  const headers: Record<string, string> = {};
  if (includeJson) {
    headers['Content-Type'] = 'application/json';
  }
  const token = overrideBearer ?? getStoredUserToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export const userAuthClient = {
  clearClientToken(): void {
    setStoredUserToken(null);
  },

  hasClientToken(): boolean {
    return Boolean(getStoredUserToken());
  },

  async login(
    username: string,
    password: string
  ): Promise<{ ok: boolean; user?: User; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        sessionToken?: string;
        user?: { id: string; name: string; username: string; role: 'admin' | 'accountant' };
        error?: string;
      };

      if (!res.ok || !data.authenticated || !data.user) {
        setStoredUserToken(null);
        return { ok: false, error: data.error || 'Invalid username or password / PIN.' };
      }

      if (data.sessionToken) {
        setStoredUserToken(data.sessionToken);
      }

      return {
        ok: true,
        user: {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
          role: data.user.role,
          pin: '',
        },
      };
    } catch {
      return { ok: false, error: 'Unable to connect to authentication server.' };
    }
  },

  async verifySession(): Promise<{ authenticated: boolean; user?: User }> {
    try {
      const res = await fetch('/api/auth/session', {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });
      if (!res.ok) {
        setStoredUserToken(null);
        return { authenticated: false };
      }
      const data = (await res.json().catch(() => ({}))) as {
        authenticated?: boolean;
        user?: { id: string; name: string; username: string; role: 'admin' | 'accountant' };
      };
      if (!data.authenticated || !data.user) {
        setStoredUserToken(null);
        return { authenticated: false };
      }
      return {
        authenticated: true,
        user: {
          id: data.user.id,
          name: data.user.name,
          username: data.user.username,
          role: data.user.role,
          pin: '',
        },
      };
    } catch {
      return { authenticated: false };
    }
  },

  async logout(): Promise<void> {
    const token = getStoredUserToken();
    setStoredUserToken(null);
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
    } catch {
      // Token cleared client-side regardless
    }
  },

  async checkStaffRecovery(username: string): Promise<{
    available: boolean;
    message: string;
    methodHint?: string;
  }> {
    try {
      const res = await fetch('/api/auth/recovery/staff-check', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        available?: boolean;
        message?: string;
        methodHint?: string;
      };
      return {
        available: Boolean(data.available),
        methodHint: data.methodHint,
        message:
          data.message ||
          'No verified self-service recovery method is configured. Please use Owner Master Recovery or ask your Admin.',
      };
    } catch {
      return {
        available: false,
        message: 'Unable to check recovery configuration. Please contact your Admin or use Owner Master Recovery.',
      };
    }
  },

  async verifyOwnerRecovery(
    recoveryId: string,
    masterPassword: string
  ): Promise<{
    ok: boolean;
    recoveryToken?: string;
    users?: SafeUserSummary[];
    error?: string;
  }> {
    try {
      const res = await fetch('/api/auth/recovery/owner-verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryId, masterPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        recoveryToken?: string;
        users?: SafeUserSummary[];
        error?: string;
      };
      if (!res.ok || !data.ok || !data.recoveryToken) {
        return { ok: false, error: data.error || 'Invalid Owner Recovery credentials.' };
      }
      return {
        ok: true,
        recoveryToken: data.recoveryToken,
        users: data.users || [],
      };
    } catch {
      return { ok: false, error: 'Unable to reach authentication server for recovery.' };
    }
  },

  async resetPasswordWithOwnerRecovery(
    recoveryToken: string,
    targetUserId: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ ok: boolean; targetUsername?: string; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/recovery/owner-reset', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true, recoveryToken),
        body: JSON.stringify({ targetUserId, newPassword, confirmPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        targetUsername?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Failed to reset password.' };
      }
      return {
        ok: true,
        targetUsername: data.targetUsername,
        message: data.message,
      };
    } catch {
      return { ok: false, error: 'Unable to reach server to complete password reset.' };
    }
  },

  async listUsersAndAudit(): Promise<{
    ok: boolean;
    users?: SafeUserSummary[];
    auditLogs?: PasswordAuditEntry[];
    error?: string;
    status?: number;
  }> {
    try {
      const res = await fetch('/api/auth/users', {
        method: 'GET',
        credentials: 'include',
        headers: buildAuthHeaders(false),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        users?: SafeUserSummary[];
        auditLogs?: PasswordAuditEntry[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Unable to load user accounts.', status: res.status };
      }
      return {
        ok: true,
        users: data.users || [],
        auditLogs: data.auditLogs || [],
      };
    } catch {
      return { ok: false, error: 'Unable to reach server to load user accounts.' };
    }
  },

  async createStaffUser(payload: {
    name: string;
    username: string;
    role: 'admin' | 'accountant';
    password: string;
    confirmPassword: string;
  }): Promise<{ ok: boolean; user?: SafeUserSummary; error?: string }> {
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        user?: SafeUserSummary;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Failed to create staff account.' };
      }
      return { ok: true, user: data.user };
    } catch {
      return { ok: false, error: 'Unable to reach server to create staff account.' };
    }
  },

  async adminResetUserPassword(
    targetUserId: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ ok: boolean; targetUsername?: string; message?: string; error?: string }> {
    try {
      const res = await fetch('/api/auth/users/reset-password', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify({ targetUserId, newPassword, confirmPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        targetUsername?: string;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        return { ok: false, error: data.error || 'Failed to reset user password.' };
      }
      return {
        ok: true,
        targetUsername: data.targetUsername,
        message: data.message,
      };
    } catch {
      return { ok: false, error: 'Unable to reach server to reset user password.' };
    }
  },

  async changeOwnPassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<{
    ok: boolean;
    sessionsInvalidated?: boolean;
    message?: string;
    error?: string;
    unauthorized?: boolean;
  }> {
    try {
      const res = await fetch('/api/auth/change-own-password', {
        method: 'POST',
        credentials: 'include',
        headers: buildAuthHeaders(true),
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        sessionsInvalidated?: boolean;
        message?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          error: data.error || 'Failed to update password.',
          unauthorized: res.status === 401 && data.error !== 'Current password is incorrect.',
        };
      }
      setStoredUserToken(null);
      return {
        ok: true,
        sessionsInvalidated: Boolean(data.sessionsInvalidated),
        message: data.message || 'Password updated successfully.',
      };
    } catch {
      return { ok: false, error: 'Unable to reach server to update password.' };
    }
  },
};
