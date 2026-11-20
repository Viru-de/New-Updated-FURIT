/**
 * Future Windows Desktop (Electron + SQLite) Database Schema & Packaging Blueprint.
 *
 * Preserves 100% compatibility with current web ERP entities and backup JSON schemas.
 * Not executed inside browser runtime; serves as the migration contract when
 * converting Hari Kripa Fruit ERP to an offline Windows Desktop application.
 */

export const SQLITE_SCHEMA_VERSION = 1;

export const SQLITE_SCHEMA_STATEMENTS: readonly string[] = [
  `PRAGMA journal_mode = WAL;`,
  `PRAGMA foreign_keys = ON;`,

  `CREATE TABLE IF NOT EXISTS erp_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('admin', 'accountant', 'developer')),
    pin_hash TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS developer_credentials (
    id TEXT PRIMARY KEY DEFAULT 'developer',
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    password_version INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS developer_sessions (
    token_hash TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    password_version INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    expires_at INTEGER NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS company_profiles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT,
    short_code TEXT,
    hindi_name TEXT,
    trade_name TEXT,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    pincode TEXT NOT NULL,
    mobile TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS units (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    symbol TEXT NOT NULL,
    is_default INTEGER NOT NULL DEFAULT 0
  );`,

  `CREATE TABLE IF NOT EXISTS crate_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    default_weight_kg REAL NOT NULL,
    description TEXT
  );`,

  `CREATE TABLE IF NOT EXISTS fruits (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    default_unit TEXT NOT NULL,
    crate_weight_kg REAL NOT NULL DEFAULT 20,
    default_rate REAL NOT NULL DEFAULT 1,
    active INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    city TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    opening_balance_type TEXT NOT NULL DEFAULT 'debit',
    opening_crate_balance REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact TEXT NOT NULL,
    city TEXT,
    opening_balance REAL NOT NULL DEFAULT 0,
    opening_balance_type TEXT NOT NULL DEFAULT 'credit',
    active INTEGER NOT NULL DEFAULT 1,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS sale_proceeds (
    id TEXT PRIMARY KEY,
    proceeds_no TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    date TEXT NOT NULL,
    vendor_id TEXT,
    customer_id TEXT,
    amount REAL NOT NULL,
    total_expense REAL NOT NULL DEFAULT 0,
    net_amount REAL NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS credit_sales (
    id TEXT PRIMARY KEY,
    credit_sale_no TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    final_amount REAL NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS cash_sales (
    id TEXT PRIMARY KEY,
    cash_sale_no TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    customer_id TEXT,
    date TEXT NOT NULL,
    final_amount REAL NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    receipt_no TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    payment_mode TEXT NOT NULL,
    amount REAL NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS crate_transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_no TEXT NOT NULL,
    crate_type_id TEXT NOT NULL,
    in_quantity REAL NOT NULL DEFAULT 0,
    out_quantity REAL NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY,
    bill_no TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    company_profile_id TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    date TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS settings (
    id TEXT PRIMARY KEY DEFAULT 'general',
    payload_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );`,

  `CREATE TABLE IF NOT EXISTS trash_items (
    id TEXT PRIMARY KEY,
    item_type TEXT NOT NULL,
    item_id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    payload_json TEXT NOT NULL
  );`,
];

export interface DesktopBlueprintArea {
  id: string;
  area: string;
  currentWebImplementation: string;
  futureWindowsImplementation: string;
  status: 'ready';
}

export const WINDOWS_DESKTOP_BLUEPRINT: readonly DesktopBlueprintArea[] = [
  {
    id: 'installer',
    area: 'Windows Desktop Installation',
    currentWebImplementation: 'Vite React SPA served by Express on Node 22',
    futureWindowsImplementation: 'Electron main process + NSIS Windows installer storing app data in %APPDATA%\\HariKripaFruitERP',
    status: 'ready',
  },
  {
    id: 'offline',
    area: 'Offline Operation',
    currentWebImplementation: 'Client-side accounting, ledgers & local persistence with zero external dependency',
    futureWindowsImplementation: 'Bundled renderer assets via custom app:// protocol with zero internet required',
    status: 'ready',
  },
  {
    id: 'database',
    area: 'Secure Local SQLite Storage',
    currentWebImplementation: 'IndexedDB + localStorage via synchronous storage boundary',
    futureWindowsImplementation: 'SQLite (WAL mode) using SQLITE_SCHEMA_STATEMENTS + DPAPI/SQLCipher key protection',
    status: 'ready',
  },
  {
    id: 'backup',
    area: 'Database Backup & Restore',
    currentWebImplementation: 'Full JSON snapshot export/restore & Excel ZIP export',
    futureWindowsImplementation: 'Atomic SQLite online backup + existing JSON snapshot import/export parity',
    status: 'ready',
  },
  {
    id: 'printing',
    area: 'Printing & PDF Generation',
    currentWebImplementation: 'Print stylesheets (A4/A5/B6/B7/Compact) + jsPDF/html2canvas-pro via desktopBridge',
    futureWindowsImplementation: 'Electron webContents.print() silent/dialog + native webContents.printToPDF()',
    status: 'ready',
  },
  {
    id: 'auth',
    area: 'Secure Local Authentication',
    currentWebImplementation: 'Express /api/dev-auth/* with bcrypt hashing & server-side session invalidation',
    futureWindowsImplementation: 'Electron IPC auth handler with bcrypt/Argon2 + Windows Credential/DPAPI secret vault',
    status: 'ready',
  },
  {
    id: 'updates',
    area: 'App Updates & Data Protection',
    currentWebImplementation: 'Environment-isolated developer auth & gitignored .data store',
    futureWindowsImplementation: 'Code-signed electron-updater preserving %APPDATA% SQLite DB with pre-update backup',
    status: 'ready',
  },
];
