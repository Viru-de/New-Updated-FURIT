import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

export interface DeveloperAuthRecord {
  username: string;
  passwordHash: string;
  passwordVersion: number;
  updatedAt: string;
}

export interface DeveloperSessionRecord {
  tokenHash: string;
  username: string;
  passwordVersion: number;
  createdAt: string;
  expiresAt: number;
}

export interface DevAuthUser {
  id: string;
  name: string;
  username: string;
  role: 'developer';
}

const BCRYPT_ROUNDS = 12;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export interface DevAuthStoreOptions {
  dataDir?: string;
  initialPassword?: string;
  username?: string;
}

export class DevAuthService {
  private readonly authFilePath: string;
  private readonly sessionsFilePath: string;
  private readonly dataDir: string;
  private readonly configuredUsername: string;
  private readonly initialPasswordEnv: string;
  private failedAttempts = new Map<string, { count: number; lockedUntil: number; firstAttemptAt: number }>();

  constructor(options: DevAuthStoreOptions = {}) {
    this.dataDir = options.dataDir || path.resolve(process.cwd(), '.data');
    this.authFilePath = path.join(this.dataDir, 'developer-auth.json');
    this.sessionsFilePath = path.join(this.dataDir, 'developer-sessions.json');
    this.configuredUsername = (
      options.username ??
      process.env.DEVELOPER_USERNAME ??
      'developer'
    ).trim();
    this.initialPasswordEnv = (
      options.initialPassword ??
      process.env.DEVELOPER_INITIAL_PASSWORD ??
      process.env.DEVELOPER_PASSWORD ??
      ''
    ).trim();
  }

  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    }
  }

  private writeJsonAtomic(filePath: string, payload: unknown): void {
    this.ensureDataDir();
    const tmpPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tmpPath, filePath);
  }

  private readAuthRecord(): DeveloperAuthRecord | null {
    try {
      if (!fs.existsSync(this.authFilePath)) return null;
      const raw = fs.readFileSync(this.authFilePath, 'utf8');
      const parsed = JSON.parse(raw) as DeveloperAuthRecord;
      if (!parsed || typeof parsed.passwordHash !== 'string' || !parsed.passwordHash.startsWith('$2')) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  private readSessions(): DeveloperSessionRecord[] {
    try {
      if (!fs.existsSync(this.sessionsFilePath)) return [];
      const raw = fs.readFileSync(this.sessionsFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.filter(
        (s): s is DeveloperSessionRecord =>
          Boolean(s && typeof s.tokenHash === 'string' && typeof s.expiresAt === 'number' && s.expiresAt > now)
      );
    } catch {
      return [];
    }
  }

  private writeSessions(sessions: DeveloperSessionRecord[]): void {
    this.writeJsonAtomic(this.sessionsFilePath, sessions);
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /**
   * Lazily initializes the bcrypt-hashed developer credential from the private
   * server-side environment secret on first use if not yet persisted.
   * Never creates a hardcoded fallback password.
   */
  public async ensureInitialized(): Promise<DeveloperAuthRecord | null> {
    const existing = this.readAuthRecord();
    if (existing) {
      return existing;
    }
    if (!this.initialPasswordEnv) {
      return null;
    }
    const passwordHash = await bcrypt.hash(this.initialPasswordEnv, BCRYPT_ROUNDS);
    const record: DeveloperAuthRecord = {
      username: this.configuredUsername || 'developer',
      passwordHash,
      passwordVersion: 1,
      updatedAt: new Date().toISOString(),
    };
    this.writeJsonAtomic(this.authFilePath, record);
    return record;
  }

  public async isConfigured(): Promise<boolean> {
    const record = await this.ensureInitialized();
    return Boolean(record && record.passwordHash);
  }

  private checkRateLimit(clientKey: string): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const entry = this.failedAttempts.get(clientKey);
    if (!entry) return { allowed: true };

    if (entry.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
      };
    }

    if (now - entry.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      this.failedAttempts.delete(clientKey);
    }
    return { allowed: true };
  }

  private recordFailedAttempt(clientKey: string): void {
    const now = Date.now();
    const existing = this.failedAttempts.get(clientKey);
    if (!existing || now - existing.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      this.failedAttempts.set(clientKey, {
        count: 1,
        firstAttemptAt: now,
        lockedUntil: 0,
      });
      return;
    }
    const nextCount = existing.count + 1;
    this.failedAttempts.set(clientKey, {
      count: nextCount,
      firstAttemptAt: existing.firstAttemptAt,
      lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : 0,
    });
  }

  private clearFailedAttempts(clientKey: string): void {
    this.failedAttempts.delete(clientKey);
  }

  public async login(
    usernameInput: string,
    passwordInput: string,
    clientKey: string = 'default'
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    sessionToken?: string;
    expiresAt?: number;
    user?: DevAuthUser;
  }> {
    const rate = this.checkRateLimit(clientKey);
    if (!rate.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Too many failed developer login attempts. Please try again in ${rate.retryAfterSeconds} seconds.`,
      };
    }

    const record = await this.ensureInitialized();
    if (!record) {
      return {
        ok: false,
        status: 503,
        error:
          'Developer access is not configured on the server. Set DEVELOPER_INITIAL_PASSWORD in server environment variables.',
      };
    }

    const normalizedInputUser = (usernameInput || '').trim().toLowerCase();
    const normalizedExpectedUser = record.username.trim().toLowerCase();
    const passwordMatches =
      typeof passwordInput === 'string' && passwordInput.length > 0
        ? await bcrypt.compare(passwordInput, record.passwordHash)
        : false;

    if (normalizedInputUser !== normalizedExpectedUser || !passwordMatches) {
      this.recordFailedAttempt(clientKey);
      return {
        ok: false,
        status: 401,
        error: 'Invalid developer credentials.',
      };
    }

    this.clearFailedAttempts(clientKey);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + SESSION_TTL_MS;
    const sessions = this.readSessions();
    sessions.push({
      tokenHash: this.hashToken(sessionToken),
      username: record.username,
      passwordVersion: record.passwordVersion,
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    this.writeSessions(sessions);

    return {
      ok: true,
      status: 200,
      sessionToken,
      expiresAt,
      user: {
        id: 'u-developer',
        name: 'System Developer',
        username: record.username,
        role: 'developer',
      },
    };
  }

  public verifySession(token: string | undefined | null): DevAuthUser | null {
    if (!token || typeof token !== 'string') return null;
    const record = this.readAuthRecord();
    if (!record) return null;

    const tokenHash = this.hashToken(token.trim());
    const sessions = this.readSessions();
    const active = sessions.find(
      (s) => s.tokenHash === tokenHash && s.passwordVersion === record.passwordVersion && s.expiresAt > Date.now()
    );
    if (!active) return null;

    return {
      id: 'u-developer',
      name: 'System Developer',
      username: record.username,
      role: 'developer',
    };
  }

  public logout(token: string | undefined | null): void {
    if (!token || typeof token !== 'string') return;
    const tokenHash = this.hashToken(token.trim());
    const sessions = this.readSessions().filter((s) => s.tokenHash !== tokenHash);
    this.writeSessions(sessions);
  }

  public invalidateAllSessions(): void {
    this.writeSessions([]);
  }

  public async changePassword(
    token: string | undefined | null,
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    message?: string;
    sessionsInvalidated?: boolean;
  }> {
    const user = this.verifySession(token);
    if (!user) {
      return {
        ok: false,
        status: 401,
        error: 'Developer authentication required. Your session may have expired or been invalidated.',
      };
    }

    const record = this.readAuthRecord();
    if (!record) {
      return {
        ok: false,
        status: 503,
        error: 'Developer credentials store is unavailable.',
      };
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return {
        ok: false,
        status: 400,
        error: 'Current password, new password, and confirm password are all required.',
      };
    }

    if (newPassword !== confirmNewPassword) {
      return {
        ok: false,
        status: 400,
        error: 'New password and confirm password do not match.',
      };
    }

    if (newPassword.length < 8) {
      return {
        ok: false,
        status: 400,
        error: 'New password must be at least 8 characters long.',
      };
    }

    if (newPassword.length > 128) {
      return {
        ok: false,
        status: 400,
        error: 'New password must not exceed 128 characters.',
      };
    }

    const currentMatches = await bcrypt.compare(currentPassword, record.passwordHash);
    if (!currentMatches) {
      return {
        ok: false,
        status: 401,
        error: 'Current password is incorrect.',
      };
    }

    if (currentPassword === newPassword) {
      return {
        ok: false,
        status: 400,
        error: 'New password must be different from your current password.',
      };
    }

    const nextHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updatedRecord: DeveloperAuthRecord = {
      username: record.username,
      passwordHash: nextHash,
      passwordVersion: (record.passwordVersion || 1) + 1,
      updatedAt: new Date().toISOString(),
    };
    this.writeJsonAtomic(this.authFilePath, updatedRecord);

    // Immediately invalidate all active developer sessions
    this.invalidateAllSessions();

    return {
      ok: true,
      status: 200,
      sessionsInvalidated: true,
      message: 'Developer password updated successfully. All active sessions have been invalidated.',
    };
  }

  /**
   * Private server-side recovery mechanism intended solely for direct host/CLI invocation
   * when the Developer forgets their current password. Never exposed via HTTP endpoints or UI.
   */
  public async recoverPasswordFromServerCli(
    newPassword: string
  ): Promise<{ ok: boolean; error?: string; username?: string }> {
    if (typeof newPassword !== 'string' || newPassword.length < 8) {
      return {
        ok: false,
        error: 'Recovery password must be at least 8 characters long.',
      };
    }

    if (newPassword.length > 128) {
      return {
        ok: false,
        error: 'Recovery password must not exceed 128 characters.',
      };
    }

    const existing = this.readAuthRecord();
    const username = existing?.username || this.configuredUsername || 'developer';
    const nextHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const updatedRecord: DeveloperAuthRecord = {
      username,
      passwordHash: nextHash,
      passwordVersion: (existing?.passwordVersion || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    this.writeJsonAtomic(this.authFilePath, updatedRecord);
    this.invalidateAllSessions();
    this.failedAttempts.clear();

    return {
      ok: true,
      username,
    };
  }
}
