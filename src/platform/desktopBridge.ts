import { SQLITE_SCHEMA_STATEMENTS, WINDOWS_DESKTOP_BLUEPRINT } from './sqliteSchema';

/**
 * Runtime & Platform Abstraction Layer for Hari Kripa Fruit ERP.
 *
 * Today: runs cleanly in the existing Web Application (Express + Vite + Browser Storage).
 * Future Windows Desktop (Electron + React): Electron preload exposes `window.hkDesktop`
 * via contextBridge without requiring changes to UI components, ledgers, or calculations.
 */

export type RuntimeHost = 'web' | 'electron-desktop';

export interface DesktopAuthBridge {
  getStatus: () => Promise<{ configured: boolean }>;
  login: (username: string, password: string) => Promise<{
    authenticated: boolean;
    sessionToken?: string;
    user?: { id: string; name: string; username: string; role: 'developer' };
    error?: string;
  }>;
  verifySession: (sessionToken?: string | null) => Promise<{
    authenticated: boolean;
    user?: { id: string; name: string; username: string; role: 'developer' };
  }>;
  logout: (sessionToken?: string | null) => Promise<void>;
  changePassword: (payload: {
    sessionToken?: string | null;
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) => Promise<{
    success: boolean;
    sessionsInvalidated?: boolean;
    message?: string;
    error?: string;
  }>;
}

export interface DesktopPrintBridge {
  printCurrentView?: (options?: { silent?: boolean; pageSize?: string }) => Promise<boolean>;
  exportCurrentPdf?: (options?: { filename: string; pageSize?: string }) => Promise<Uint8Array | null>;
}

export interface DesktopBackupBridge {
  createSqliteBackup?: (targetPath?: string) => Promise<{ ok: boolean; path?: string; error?: string }>;
  restoreSqliteBackup?: (sourcePath: string) => Promise<{ ok: boolean; error?: string }>;
  checkForUpdates?: () => Promise<{ available: boolean; version?: string }>;
}

export interface ElectronDesktopBridge {
  platform: 'win32' | 'darwin' | 'linux';
  appVersion: string;
  auth?: DesktopAuthBridge;
  print?: DesktopPrintBridge;
  backup?: DesktopBackupBridge;
}

declare global {
  interface Window {
    hkDesktop?: ElectronDesktopBridge;
  }
}

export function detectRuntimeHost(): RuntimeHost {
  if (typeof window !== 'undefined' && window.hkDesktop) {
    return 'electron-desktop';
  }
  return 'web';
}

export function getDesktopBridge(): ElectronDesktopBridge | null {
  if (typeof window !== 'undefined' && window.hkDesktop) {
    return window.hkDesktop;
  }
  return null;
}

export function getPlatformCapabilities() {
  const host = detectRuntimeHost();
  const bridge = getDesktopBridge();
  return {
    runtimeHost: host,
    platform: bridge?.platform || 'browser',
    appVersion: bridge?.appVersion || 'web-1.0',
    supportsNativeSqlite: host === 'electron-desktop',
    supportsNativePrintToPdf: Boolean(bridge?.print?.exportCurrentPdf),
    supportsAutoUpdater: Boolean(bridge?.backup?.checkForUpdates),
    sqliteTablesCount: SQLITE_SCHEMA_STATEMENTS.length - 2,
    blueprintAreas: WINDOWS_DESKTOP_BLUEPRINT,
  };
}
