import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';

export type StaffRole = 'admin' | 'accountant';

export interface StaffAuthRecord {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  passwordHash: string;
  passwordVersion: number;
  active: boolean;
  recoveryMethodConfigured: boolean;
  recoveryHint?: string;
  createdAt: string;
  updatedAt: string;
  lastPasswordResetAt?: string;
}

export interface SafeUserSummary {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
  active: boolean;
  recoveryMethodConfigured: boolean;
  recoveryHint?: string;
  createdAt: string;
  updatedAt: string;
  lastPasswordResetAt?: string;
}

export interface AuthenticatedErpUser {
  id: string;
  name: string;
  username: string;
  role: StaffRole;
}

export interface UserSessionRecord {
  tokenHash: string;
  userId: string;
  username: string;
  role: StaffRole;
  passwordVersion: number;
  createdAt: string;
  expiresAt: number;
}

export interface OwnerRecoveryTokenRecord {
  tokenHash: string;
  ownerUsername: string;
  createdAt: string;
  expiresAt: number;
}

export type PasswordAuditAction =
  | 'owner_master_recovery_reset'
  | 'admin_staff_reset'
  | 'self_password_change'
  | 'staff_account_created';

export interface PasswordAuditEntry {
  id: string;
  action: PasswordAuditAction;
  targetUserId: string;
  targetUsername: string;
  targetRole: StaffRole;
  performedBy: string;
  timestamp: string;
}

export interface UserAuthStoreOptions {
  dataDir?: string;
  ownerRecoveryUsername?: string;
  ownerRecoveryPassword?: string;
}

const BCRYPT_ROUNDS = 12;
const USER_SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours
const RECOVERY_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_AUDIT_ENTRIES = 250;

function toSafeSummary(record: StaffAuthRecord): SafeUserSummary {
  return {
    id: record.id,
    name: record.name,
    username: record.username,
    role: record.role,
    active: record.active,
    recoveryMethodConfigured: Boolean(record.recoveryMethodConfigured),
    recoveryHint: record.recoveryHint,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastPasswordResetAt: record.lastPasswordResetAt,
  };
}

function timingSafeEqualString(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export class UserAuthService {
  private readonly dataDir: string;
  private readonly usersFilePath: string;
  private readonly sessionsFilePath: string;
  private readonly recoveryTokensFilePath: string;
  private readonly auditFilePath: string;
  private readonly ownerUsernameOverride?: string;
  private readonly ownerPasswordOverride?: string;
  private initPromise: Promise<StaffAuthRecord[]> | null = null;

  private loginFailedAttempts = new Map<
    string,
    { count: number; lockedUntil: number; firstAttemptAt: number }
  >();
  private recoveryFailedAttempts = new Map<
    string,
    { count: number; lockedUntil: number; firstAttemptAt: number }
  >();

  constructor(options: UserAuthStoreOptions = {}) {
    this.dataDir = options.dataDir || path.resolve(process.cwd(), '.data');
    this.usersFilePath = path.join(this.dataDir, 'users-auth.json');
    this.sessionsFilePath = path.join(this.dataDir, 'user-sessions.json');
    this.recoveryTokensFilePath = path.join(this.dataDir, 'owner-recovery-tokens.json');
    this.auditFilePath = path.join(this.dataDir, 'password-audit.json');
    this.ownerUsernameOverride = options.ownerRecoveryUsername;
    this.ownerPasswordOverride = options.ownerRecoveryPassword;
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private readUsersRaw(): StaffAuthRecord[] | null {
    try {
      if (!fs.existsSync(this.usersFilePath)) return null;
      const raw = fs.readFileSync(this.usersFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      return parsed.filter(
        (u): u is StaffAuthRecord =>
          Boolean(
            u &&
              typeof u.id === 'string' &&
              typeof u.username === 'string' &&
              typeof u.passwordHash === 'string' &&
              u.passwordHash.startsWith('$2')
          )
      );
    } catch {
      return null;
    }
  }

  public async ensureInitialized(): Promise<StaffAuthRecord[]> {
    const existing = this.readUsersRaw();
    if (existing && existing.length > 0) {
      return existing;
    }

    if (!this.initPromise) {
      this.initPromise = (async () => {
        const recheck = this.readUsersRaw();
        if (recheck && recheck.length > 0) {
          return recheck;
        }
        const now = new Date().toISOString();
        const defaultPinHash = await bcrypt.hash('1234', BCRYPT_ROUNDS);
        const initialUsers: StaffAuthRecord[] = [
          {
            id: 'u-admin',
            name: 'Mandi Admin',
            username: 'admin',
            role: 'admin',
            passwordHash: defaultPinHash,
            passwordVersion: 1,
            active: true,
            recoveryMethodConfigured: false,
            createdAt: now,
            updatedAt: now,
          },
          {
            id: 'u-staff',
            name: 'Counter Staff',
            username: 'staff',
            role: 'accountant',
            passwordHash: defaultPinHash,
            passwordVersion: 1,
            active: true,
            recoveryMethodConfigured: false,
            createdAt: now,
            updatedAt: now,
          },
        ];
        this.writeJsonAtomic(this.usersFilePath, initialUsers);
        return initialUsers;
      })().finally(() => {
        this.initPromise = null;
      });
    }

    return this.initPromise;
  }

  private writeUsers(users: StaffAuthRecord[]): void {
    this.writeJsonAtomic(this.usersFilePath, users);
  }

  private readSessions(): UserSessionRecord[] {
    try {
      if (!fs.existsSync(this.sessionsFilePath)) return [];
      const raw = fs.readFileSync(this.sessionsFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.filter(
        (s): s is UserSessionRecord =>
          Boolean(s && typeof s.tokenHash === 'string' && typeof s.expiresAt === 'number' && s.expiresAt > now)
      );
    } catch {
      return [];
    }
  }

  private writeSessions(sessions: UserSessionRecord[]): void {
    this.writeJsonAtomic(this.sessionsFilePath, sessions);
  }

  public invalidateUserSessions(userId: string): void {
    const remaining = this.readSessions().filter((s) => s.userId !== userId);
    this.writeSessions(remaining);
  }

  private readRecoveryTokens(): OwnerRecoveryTokenRecord[] {
    try {
      if (!fs.existsSync(this.recoveryTokensFilePath)) return [];
      const raw = fs.readFileSync(this.recoveryTokensFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      const now = Date.now();
      return parsed.filter(
        (t): t is OwnerRecoveryTokenRecord =>
          Boolean(t && typeof t.tokenHash === 'string' && typeof t.expiresAt === 'number' && t.expiresAt > now)
      );
    } catch {
      return [];
    }
  }

  private writeRecoveryTokens(tokens: OwnerRecoveryTokenRecord[]): void {
    this.writeJsonAtomic(this.recoveryTokensFilePath, tokens);
  }

  private readAuditLogs(): PasswordAuditEntry[] {
    try {
      if (!fs.existsSync(this.auditFilePath)) return [];
      const raw = fs.readFileSync(this.auditFilePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  private appendAuditLog(entry: Omit<PasswordAuditEntry, 'id' | 'timestamp'>): PasswordAuditEntry {
    const logs = this.readAuditLogs();
    const record: PasswordAuditEntry = {
      id: `aud-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
      ...entry,
      timestamp: new Date().toISOString(),
    };
    logs.unshift(record);
    this.writeJsonAtomic(this.auditFilePath, logs.slice(0, MAX_AUDIT_ENTRIES));
    return record;
  }

  private checkRateLimit(
    store: Map<string, { count: number; lockedUntil: number; firstAttemptAt: number }>,
    clientKey: string
  ): { allowed: boolean; retryAfterSeconds?: number } {
    const now = Date.now();
    const entry = store.get(clientKey);
    if (!entry) return { allowed: true };

    if (entry.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((entry.lockedUntil - now) / 1000)),
      };
    }

    if (now - entry.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      store.delete(clientKey);
    }
    return { allowed: true };
  }

  private recordFailedAttempt(
    store: Map<string, { count: number; lockedUntil: number; firstAttemptAt: number }>,
    clientKey: string
  ): void {
    const now = Date.now();
    const existing = store.get(clientKey);
    if (!existing || now - existing.firstAttemptAt > LOCKOUT_WINDOW_MS) {
      store.set(clientKey, { count: 1, firstAttemptAt: now, lockedUntil: 0 });
      return;
    }
    const nextCount = existing.count + 1;
    store.set(clientKey, {
      count: nextCount,
      firstAttemptAt: existing.firstAttemptAt,
      lockedUntil: nextCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : 0,
    });
  }

  private getOwnerRecoverySecrets(): { username: string; password: string } {
    const username = (
      this.ownerUsernameOverride ??
      process.env.OWNER_RECOVERY_USERNAME ??
      ''
    ).trim();
    const password =
      this.ownerPasswordOverride ?? process.env.OWNER_RECOVERY_PASSWORD ?? '';
    return { username, password };
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
    user?: AuthenticatedErpUser;
  }> {
    const rate = this.checkRateLimit(this.loginFailedAttempts, clientKey);
    if (!rate.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Too many failed login attempts. Please try again in ${rate.retryAfterSeconds} seconds.`,
      };
    }

    const users = await this.ensureInitialized();
    const normalizedUsername = (usernameInput || '').trim().toLowerCase();
    const matchedUser = users.find((u) => u.username.trim().toLowerCase() === normalizedUsername);

    const passwordOk =
      matchedUser && matchedUser.active && typeof passwordInput === 'string' && passwordInput.length > 0
        ? await bcrypt.compare(passwordInput, matchedUser.passwordHash)
        : false;

    if (!matchedUser || !matchedUser.active || !passwordOk) {
      this.recordFailedAttempt(this.loginFailedAttempts, clientKey);
      return {
        ok: false,
        status: 401,
        error: 'Invalid username or password / PIN.',
      };
    }

    this.loginFailedAttempts.delete(clientKey);

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + USER_SESSION_TTL_MS;
    const sessions = this.readSessions();
    sessions.push({
      tokenHash: this.hashToken(sessionToken),
      userId: matchedUser.id,
      username: matchedUser.username,
      role: matchedUser.role,
      passwordVersion: matchedUser.passwordVersion,
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
        id: matchedUser.id,
        name: matchedUser.name,
        username: matchedUser.username,
        role: matchedUser.role,
      },
    };
  }

  public async verifySession(token: string | undefined | null): Promise<AuthenticatedErpUser | null> {
    if (!token || typeof token !== 'string') return null;
    const users = await this.ensureInitialized();
    const tokenHash = this.hashToken(token.trim());
    const sessions = this.readSessions();
    const activeSession = sessions.find(
      (s) => s.tokenHash === tokenHash && s.expiresAt > Date.now()
    );
    if (!activeSession) return null;

    const user = users.find(
      (u) =>
        u.id === activeSession.userId &&
        u.active &&
        u.passwordVersion === activeSession.passwordVersion
    );
    if (!user) return null;

    return {
      id: user.id,
      name: user.name,
      username: user.username,
      role: user.role,
    };
  }

  public logout(token: string | undefined | null): void {
    if (!token || typeof token !== 'string') return;
    const tokenHash = this.hashToken(token.trim());
    const sessions = this.readSessions().filter((s) => s.tokenHash !== tokenHash);
    this.writeSessions(sessions);
  }

  public async checkStaffRecovery(usernameInput: string): Promise<{
    available: boolean;
    message: string;
    methodHint?: string;
  }> {
    const users = await this.ensureInitialized();
    const normalized = (usernameInput || '').trim().toLowerCase();
    const user = normalized
      ? users.find((u) => u.username.trim().toLowerCase() === normalized)
      : undefined;

    if (user && user.recoveryMethodConfigured) {
      return {
        available: true,
        methodHint: user.recoveryHint || 'Verified recovery contact on file.',
        message: 'A verified recovery channel is configured. Follow your administrator instructions to complete verification.',
      };
    }

    return {
      available: false,
      message:
        'No verified self-service recovery method (email/OTP) is configured for this account. Please ask an Admin/Owner to reset your password in Settings → User & Password Management, or use Owner Master Recovery.',
    };
  }

  public async verifyOwnerRecovery(
    recoveryIdInput: string,
    masterPasswordInput: string,
    clientKey: string = 'default'
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    recoveryToken?: string;
    expiresAt?: number;
    users?: SafeUserSummary[];
  }> {
    const rate = this.checkRateLimit(this.recoveryFailedAttempts, clientKey);
    if (!rate.allowed) {
      return {
        ok: false,
        status: 429,
        error: `Too many failed Owner Master Recovery attempts. Temporary lockout active for ${rate.retryAfterSeconds} seconds.`,
      };
    }

    const { username: expectedId, password: expectedPassword } = this.getOwnerRecoverySecrets();
    if (!expectedId || !expectedPassword) {
      return {
        ok: false,
        status: 503,
        error:
          'Owner Master Recovery is not configured on the server. Configure OWNER_RECOVERY_USERNAME and OWNER_RECOVERY_PASSWORD in server environment variables.',
      };
    }

    const providedId = (recoveryIdInput || '').trim().toLowerCase();
    const providedPassword = typeof masterPasswordInput === 'string' ? masterPasswordInput : '';

    const idMatches =
      providedId.length > 0 && timingSafeEqualString(providedId, expectedId.toLowerCase());
    const passwordMatches =
      providedPassword.length > 0 && timingSafeEqualString(providedPassword, expectedPassword);

    if (!idMatches || !passwordMatches) {
      this.recordFailedAttempt(this.recoveryFailedAttempts, clientKey);
      return {
        ok: false,
        status: 401,
        error: 'Invalid Owner Recovery ID or Owner Master Password.',
      };
    }

    this.recoveryFailedAttempts.delete(clientKey);
    const users = await this.ensureInitialized();

    const recoveryToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + RECOVERY_TOKEN_TTL_MS;
    const tokens = this.readRecoveryTokens();
    tokens.push({
      tokenHash: this.hashToken(recoveryToken),
      ownerUsername: expectedId,
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    this.writeRecoveryTokens(tokens);

    return {
      ok: true,
      status: 200,
      recoveryToken,
      expiresAt,
      users: users.map(toSafeSummary),
    };
  }

  public verifyRecoveryToken(token: string | undefined | null): OwnerRecoveryTokenRecord | null {
    if (!token || typeof token !== 'string') return null;
    const tokenHash = this.hashToken(token.trim());
    const tokens = this.readRecoveryTokens();
    return tokens.find((t) => t.tokenHash === tokenHash && t.expiresAt > Date.now()) || null;
  }

  public async getRecoveryStaffList(token: string | undefined | null): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    users?: SafeUserSummary[];
  }> {
    const tokenRecord = this.verifyRecoveryToken(token);
    if (!tokenRecord) {
      return {
        ok: false,
        status: 401,
        error: 'Owner Master Recovery authorization has expired or is invalid.',
      };
    }
    const users = await this.ensureInitialized();
    return {
      ok: true,
      status: 200,
      users: users.map(toSafeSummary),
    };
  }

  public async resetPasswordWithOwnerRecovery(
    recoveryToken: string | undefined | null,
    targetUserId: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    message?: string;
    targetUsername?: string;
  }> {
    const tokenRecord = this.verifyRecoveryToken(recoveryToken);
    if (!tokenRecord) {
      return {
        ok: false,
        status: 401,
        error: 'Owner Master Recovery authorization has expired or is invalid. Please re-verify.',
      };
    }

    if (!targetUserId || typeof targetUserId !== 'string') {
      return { ok: false, status: 400, error: 'Please select a staff/user account.' };
    }

    if (!newPassword || !confirmPassword) {
      return { ok: false, status: 400, error: 'New password and confirmation are required.' };
    }

    if (newPassword !== confirmPassword) {
      return { ok: false, status: 400, error: 'New password and confirm password do not match.' };
    }

    if (newPassword.length < 4) {
      return { ok: false, status: 400, error: 'New password / PIN must be at least 4 characters long.' };
    }

    if (newPassword.length > 128) {
      return { ok: false, status: 400, error: 'New password must not exceed 128 characters.' };
    }

    const users = await this.ensureInitialized();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx < 0) {
      return { ok: false, status: 404, error: 'Selected user account was not found.' };
    }

    const now = new Date().toISOString();
    const nextHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const target = users[idx];
    users[idx] = {
      ...target,
      passwordHash: nextHash,
      passwordVersion: (target.passwordVersion || 1) + 1,
      updatedAt: now,
      lastPasswordResetAt: now,
    };
    this.writeUsers(users);
    this.invalidateUserSessions(target.id);

    // Consume recovery token after successful reset
    const usedHash = this.hashToken((recoveryToken || '').trim());
    this.writeRecoveryTokens(this.readRecoveryTokens().filter((t) => t.tokenHash !== usedHash));

    this.appendAuditLog({
      action: 'owner_master_recovery_reset',
      targetUserId: target.id,
      targetUsername: target.username,
      targetRole: target.role,
      performedBy: `Owner Recovery (${tokenRecord.ownerUsername})`,
    });

    return {
      ok: true,
      status: 200,
      targetUsername: target.username,
      message: `Password reset successfully for @${target.username}. All existing sessions for this user have been invalidated.`,
    };
  }

  public async listUsersAndAudit(actingUser: AuthenticatedErpUser): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    users?: SafeUserSummary[];
    auditLogs?: PasswordAuditEntry[];
  }> {
    if (actingUser.role !== 'admin') {
      return {
        ok: false,
        status: 403,
        error: 'Access denied. Only Admin/Owner accounts can manage users and password resets.',
      };
    }

    const users = await this.ensureInitialized();
    const auditLogs = this.readAuditLogs();
    return {
      ok: true,
      status: 200,
      users: users.map(toSafeSummary),
      auditLogs,
    };
  }

  public async createStaffUser(
    actingUser: AuthenticatedErpUser,
    input: {
      name: string;
      username: string;
      role: StaffRole;
      password: string;
      confirmPassword: string;
    }
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    user?: SafeUserSummary;
  }> {
    if (actingUser.role !== 'admin') {
      return {
        ok: false,
        status: 403,
        error: 'Access denied. Only Admin/Owner accounts can create user accounts.',
      };
    }

    const name = (input.name || '').trim();
    const username = (input.username || '').trim();
    const role: StaffRole = input.role === 'admin' ? 'admin' : 'accountant';
    const password = input.password || '';
    const confirmPassword = input.confirmPassword || '';

    if (!name || !username) {
      return { ok: false, status: 400, error: 'Name and username are required.' };
    }
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
      return {
        ok: false,
        status: 400,
        error: 'Username must be 3-32 characters (letters, numbers, dot, underscore, or hyphen).',
      };
    }
    if (!password || password.length < 4) {
      return { ok: false, status: 400, error: 'Password / PIN must be at least 4 characters long.' };
    }
    if (password.length > 128) {
      return { ok: false, status: 400, error: 'Password must not exceed 128 characters.' };
    }
    if (password !== confirmPassword) {
      return { ok: false, status: 400, error: 'Password and confirm password do not match.' };
    }

    const users = await this.ensureInitialized();
    if (users.some((u) => u.username.trim().toLowerCase() === username.toLowerCase())) {
      return { ok: false, status: 409, error: `Username "@${username}" already exists.` };
    }

    const now = new Date().toISOString();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const created: StaffAuthRecord = {
      id: `u-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
      name,
      username,
      role,
      passwordHash,
      passwordVersion: 1,
      active: true,
      recoveryMethodConfigured: false,
      createdAt: now,
      updatedAt: now,
    };

    users.push(created);
    this.writeUsers(users);
    this.appendAuditLog({
      action: 'staff_account_created',
      targetUserId: created.id,
      targetUsername: created.username,
      targetRole: created.role,
      performedBy: actingUser.username,
    });

    return {
      ok: true,
      status: 201,
      user: toSafeSummary(created),
    };
  }

  public async adminResetUserPassword(
    actingUser: AuthenticatedErpUser,
    targetUserId: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    message?: string;
    targetUsername?: string;
  }> {
    if (actingUser.role !== 'admin') {
      return {
        ok: false,
        status: 403,
        error: 'Access denied. Only Admin/Owner accounts can reset staff passwords.',
      };
    }

    if (!targetUserId) {
      return { ok: false, status: 400, error: 'Please select a user account.' };
    }
    if (!newPassword || !confirmPassword) {
      return { ok: false, status: 400, error: 'New password and confirmation are required.' };
    }
    if (newPassword !== confirmPassword) {
      return { ok: false, status: 400, error: 'New password and confirm password do not match.' };
    }
    if (newPassword.length < 4) {
      return { ok: false, status: 400, error: 'New password / PIN must be at least 4 characters long.' };
    }
    if (newPassword.length > 128) {
      return { ok: false, status: 400, error: 'New password must not exceed 128 characters.' };
    }

    const users = await this.ensureInitialized();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx < 0) {
      return { ok: false, status: 404, error: 'Selected user account was not found.' };
    }

    const now = new Date().toISOString();
    const nextHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const target = users[idx];
    users[idx] = {
      ...target,
      passwordHash: nextHash,
      passwordVersion: (target.passwordVersion || 1) + 1,
      updatedAt: now,
      lastPasswordResetAt: now,
    };
    this.writeUsers(users);
    this.invalidateUserSessions(target.id);

    this.appendAuditLog({
      action: 'admin_staff_reset',
      targetUserId: target.id,
      targetUsername: target.username,
      targetRole: target.role,
      performedBy: actingUser.username,
    });

    return {
      ok: true,
      status: 200,
      targetUsername: target.username,
      message: `Password reset successfully for @${target.username}. All active sessions for this user have been invalidated.`,
    };
  }

  public async changeOwnPassword(
    actingUser: AuthenticatedErpUser,
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{
    ok: boolean;
    status: number;
    error?: string;
    message?: string;
    sessionsInvalidated?: boolean;
  }> {
    if (!currentPassword || !newPassword || !confirmPassword) {
      return {
        ok: false,
        status: 400,
        error: 'Current password, new password, and confirmation are all required.',
      };
    }

    if (newPassword !== confirmPassword) {
      return {
        ok: false,
        status: 400,
        error: 'New password and confirm password do not match.',
      };
    }

    if (newPassword.length < 4) {
      return {
        ok: false,
        status: 400,
        error: 'New password / PIN must be at least 4 characters long.',
      };
    }

    if (newPassword.length > 128) {
      return {
        ok: false,
        status: 400,
        error: 'New password must not exceed 128 characters.',
      };
    }

    const users = await this.ensureInitialized();
    const idx = users.findIndex((u) => u.id === actingUser.id);
    if (idx < 0) {
      return { ok: false, status: 404, error: 'User account not found.' };
    }

    const target = users[idx];
    const currentOk = await bcrypt.compare(currentPassword, target.passwordHash);
    if (!currentOk) {
      return { ok: false, status: 401, error: 'Current password is incorrect.' };
    }

    if (currentPassword === newPassword) {
      return {
        ok: false,
        status: 400,
        error: 'New password must be different from your current password.',
      };
    }

    const now = new Date().toISOString();
    const nextHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    users[idx] = {
      ...target,
      passwordHash: nextHash,
      passwordVersion: (target.passwordVersion || 1) + 1,
      updatedAt: now,
      lastPasswordResetAt: now,
    };
    this.writeUsers(users);
    this.invalidateUserSessions(target.id);

    this.appendAuditLog({
      action: 'self_password_change',
      targetUserId: target.id,
      targetUsername: target.username,
      targetRole: target.role,
      performedBy: actingUser.username,
    });

    return {
      ok: true,
      status: 200,
      sessionsInvalidated: true,
      message: 'Your password has been updated. All existing sessions have been invalidated.',
    };
  }
}
