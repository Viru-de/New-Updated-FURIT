import {
  Bill,
  CashSale,
  CompanyProfile,
  CrateTransaction,
  CrateType,
  CreditSale,
  Customer,
  Fruit,
  GeneralSettings,
  Receipt,
  SaleProceeds,
  SaleProceedsOpeningBalance,
  Unit,
  User,
  Vendor,
  TrashItem,
} from '../types';

const STORAGE_KEYS = {
  CUSTOMERS: 'hk_erp_customers',
  VENDORS: 'hk_erp_vendors',
  FRUITS: 'hk_erp_fruits',
  UNITS: 'hk_erp_units',
  CRATE_TYPES: 'hk_erp_crate_types',
  COMPANY_PROFILES: 'hk_erp_company_profiles',
  SALE_PROCEEDS: 'hk_erp_sale_proceeds',
  SALE_PROCEEDS_OB: 'hk_erp_sale_proceeds_ob',
  CREDIT_SALES: 'hk_erp_credit_sales',
  CASH_SALES: 'hk_erp_cash_sales',
  RECEIPTS: 'hk_erp_receipts',
  CRATE_TRANSACTIONS: 'hk_erp_crate_transactions',
  BILLS: 'hk_erp_bills',
  SETTINGS: 'hk_erp_settings',
  USERS: 'hk_erp_users',
  ACTIVE_USER: 'hk_erp_active_user',
  TRASH: 'hk_erp_trash',
};

type Listener = () => void;
const listeners: Set<Listener> = new Set();

function notifyListeners() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (e) {
      console.error('Error in db listener:', e);
    }
  });
}

const memStorage = new Map<string, string>();
const storage = {
  getItem: (key: string): string | null => {
    try {
      if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch {}
    return memStorage.get(key) || null;
  },
  setItem: (key: string, val: string): void => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(key, val);
    } catch {}
    memStorage.set(key, val);
  },
};

function getItem<T>(key: string, defaultValue: T): T {
  try {
    const raw = storage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading key ${key} from storage:`, err);
    return defaultValue;
  }
}

function setItem<T>(key: string, value: T): void {
  try {
    storage.setItem(key, JSON.stringify(value));
    notifyListeners();
  } catch (err) {
    console.error(`Error writing key ${key} to storage:`, err);
  }
}

// Initial seed definitions
const INITIAL_UNITS: Unit[] = [
  { id: 'u1', name: 'Crate', symbol: 'Crate', isDefault: true },
  { id: 'u2', name: 'Kilogram', symbol: 'Kg', isDefault: false },
  { id: 'u_piece', name: 'Piece', symbol: 'Piece', isDefault: false },
  { id: 'u_bag', name: 'Bag', symbol: 'Bag', isDefault: false },
  { id: 'u3', name: 'Peti', symbol: 'Peti', isDefault: false },
  { id: 'u4', name: 'Box', symbol: 'Box', isDefault: false },
  { id: 'u5', name: 'Nag', symbol: 'Nag', isDefault: false },
  { id: 'u6', name: 'Dozen', symbol: 'Dzn', isDefault: false },
];

const INITIAL_CRATE_TYPES: CrateType[] = [
  { id: 'ct_10', name: '10kg Crate', defaultWeightKg: 10, description: '10kg Crate' },
  { id: 'ct_20', name: '20kg Crate', defaultWeightKg: 20, description: '20kg Crate' },
  { id: 'ct1', name: '20 KG Standard Crate', defaultWeightKg: 20, description: 'Standard plastic fruit crate' },
  { id: 'ct2', name: '10 KG Cardboard Box', defaultWeightKg: 10, description: 'Telescopic carton' },
  { id: 'ct3', name: '15 KG Wooden Peti', defaultWeightKg: 15, description: 'Traditional wooden box' },
  { id: 'ct4', name: '24 KG Heavy Crate', defaultWeightKg: 24, description: 'Large apple & citrus crate' },
];

const INITIAL_PROFILES: CompanyProfile[] = [
  {
    id: 'cp1',
    name: 'Hari Kripa',
    tradeName: 'Hari Kripa Wholesale Fruits',
    shortCode: 'HK',
    hindiName: 'श्री हरि कृपा',
    address: 'Shop No. 14, APMC Fruit Market, Sector 19',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400703',
    mobile: '9820012345',
    primaryContactName: 'Rajesh',
    alternate1ContactName: 'Suresh',
    alternate1Mobile: '9820054321',
    alternateMobile: '9820054321',
    email: 'accounts@harikripafruits.com',
    aadhaarNo: '2345 6789 0123',
    gstin: '27AABCH1234F1Z5',
    pan: 'AABCH1234F',
    bankName: 'HDFC Bank',
    accountNumber: '50200012345678',
    ifsc: 'HDFC0000123',
    branch: 'APMC Vashi Branch',
    termsAndConditions: '1. Goods once sold will not be taken back.\n2. Crate return due within 15 days.\n3. Subject to local mandi jurisdiction.',
    footerText: 'Thank you for your business with Hari Kripa!',
    signatureTitle: 'FOR, HARI KRIPA',
    softwareDevelopedBy: 'Klyia Technology',
    isDefault: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'cp_jd',
    name: 'JAIRAM DHIRUMAL',
    tradeName: 'Jairam Dhirumal Fruit Commission Agent',
    shortCode: 'JD',
    hindiName: 'जय राम घीशूमल',
    address: 'A-6, Vijay Complex, Camp-2',
    city: 'Bhilai',
    state: 'Durg (CG)',
    pincode: '490001',
    mobile: '1234',
    gstin: '22AAAAA0000A1Z5',
    termsAndConditions: '* E & O.E.',
    footerText: 'Fresh Mandi Fruits',
    signatureTitle: 'FOR, JAIRAM DHIRUMAL',
    softwareDevelopedBy: 'Klyia Technology',
    isDefault: false,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'cp2',
    name: 'Hari Kripa Fruits',
    tradeName: 'Hari Kripa Fruits Trading Co.',
    shortCode: 'HKF',
    hindiName: 'हरि कृपा फ्रूट्स',
    address: 'Gala 22, B-Block, Fruit Yard',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400703',
    mobile: '9820098765',
    email: 'info@harikripafruits.com',
    gstin: '27AABCH9999F1Z2',
    pan: 'AABCH9999F',
    bankName: 'ICICI Bank',
    accountNumber: '001205009876',
    ifsc: 'ICIC0000012',
    branch: 'Vashi Market Branch',
    termsAndConditions: 'Payment due on receipt of bill.',
    footerText: 'Fresh Fruits Wholesale',
    signatureTitle: 'Authorized Signatory',
    isDefault: false,
    createdAt: '2026-10-02T00:00:00.000Z',
  },
  {
    id: 'cp3',
    name: 'ABC Fruits',
    tradeName: 'ABC Commission Agent & Traders',
    address: 'Stall No. 5, Subji Mandi Yard',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411037',
    mobile: '9765432100',
    gstin: '27ABCFP5678K1Z9',
    pan: 'ABCFP5678K',
    bankName: 'State Bank of India',
    accountNumber: '30098765432',
    ifsc: 'SBIN0004567',
    branch: 'Market Yard Pune',
    termsAndConditions: 'Immediate payment required.',
    footerText: 'Direct Farmer to Mandi Distribution',
    signatureTitle: 'Proprietor',
    isDefault: false,
    createdAt: '2026-10-03T00:00:00.000Z',
  },
  {
    id: 'cp4',
    name: 'XYZ Trading',
    tradeName: 'XYZ Cold Storage & Distribution',
    address: 'Plot 45, Industrial Agro Park',
    city: 'Nashik',
    state: 'Maharashtra',
    pincode: '422001',
    mobile: '9422012345',
    gstin: '27XYZTR4321L1Z0',
    pan: 'XYZTR4321L',
    isDefault: false,
    createdAt: '2026-10-04T00:00:00.000Z',
  },
];

const INITIAL_FRUITS: Fruit[] = [
  {
    id: 'f_grapes_green_20kg',
    name: 'Grapes Green 20kg',
    category: 'Grapes',
    unit: 'Crate',
    defaultUnit: 'Crate',
    crateType: '20kg',
    crateName: '20kg',
    crateTypeId: 'ct_20',
    crateWeightKg: 20,
    defaultRate: 100,
    fruitIcon: 'grapes',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f_apple',
    name: 'Apple',
    category: 'Apples',
    unit: 'Peti',
    defaultUnit: 'Peti',
    crateType: '',
    crateName: '',
    crateWeightKg: 0,
    defaultRate: 1,
    fruitIcon: 'apple',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f1',
    name: 'Strawberry',
    category: 'Berberries',
    unit: 'Crate',
    defaultUnit: 'Crate',
    crateType: '20kg',
    crateName: '20kg',
    crateTypeId: 'ct1',
    crateWeightKg: 20,
    defaultRate: 414,
    fruitIcon: 'strawberry',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f2',
    name: 'Grapes Black',
    category: 'Grapes',
    unit: 'KG',
    defaultUnit: 'KG',
    crateType: '10kg',
    crateName: '10kg',
    crateTypeId: 'ct1',
    crateWeightKg: 10,
    defaultRate: 50,
    fruitIcon: 'grapes',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f3',
    name: 'Maharaji Apple',
    category: 'Apples',
    unit: 'Peti',
    defaultUnit: 'Peti',
    crateType: '',
    crateName: '',
    crateTypeId: 'ct3',
    crateWeightKg: 20,
    defaultRate: 500,
    fruitIcon: 'apple',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f_mango',
    name: 'Mango',
    category: 'Mangoes',
    unit: 'Crate',
    defaultUnit: 'Crate',
    crateType: '20kg',
    crateName: '20kg',
    crateTypeId: 'ct_20',
    crateWeightKg: 20,
    defaultRate: 150,
    fruitIcon: 'mango',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f4',
    name: 'Alphonso Mango',
    category: 'Mangoes',
    defaultUnit: 'Peti',
    crateTypeId: 'ct2',
    crateWeightKg: 10,
    defaultRate: 1200,
    fruitIcon: 'mango',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'f5',
    name: 'Kinnow Mandarin',
    category: 'Citrus',
    defaultUnit: 'Crate',
    crateTypeId: 'ct4',
    crateWeightKg: 24,
    defaultRate: 650,
    fruitIcon: 'orange',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'c1',
    name: 'ABC Customer',
    mobile: '9876543210',
    altMobile: '9876500000',
    address: 'Shop 8, Vegetable & Fruit Market',
    city: 'Mumbai',
    state: 'Maharashtra',
    gstin: '27AABCU1234F1Z1',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    crateTypeId: 'ct1',
    notes: 'Regular mandi wholesale buyer',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'c2',
    name: 'Shree Ganesh Fruit Mart',
    mobile: '9819001122',
    address: 'Station Road, Dadar',
    city: 'Mumbai',
    state: 'Maharashtra',
    openingBalance: 15000,
    openingBalanceType: 'debit',
    openingCrateBalance: 12,
    crateTypeId: 'ct1',
    notes: 'Weekly settling customer',
    active: true,
    createdAt: '2026-10-02T00:00:00.000Z',
  },
  {
    id: 'c3',
    name: 'Royal Fruit Palace',
    mobile: '9822334455',
    address: 'Kalyan APMC Yard',
    city: 'Thane',
    state: 'Maharashtra',
    openingBalance: 8500,
    openingBalanceType: 'debit',
    openingCrateBalance: 5,
    crateTypeId: 'ct1',
    active: true,
    createdAt: '2026-10-03T00:00:00.000Z',
  },
];

const INITIAL_VENDORS: Vendor[] = [
  {
    id: 'v1',
    name: 'Mahabaleshwar Strawberry Growers Co-Op',
    contact: '9423011223',
    address: 'Panchgani Road',
    city: 'Mahabaleshwar',
    state: 'Maharashtra',
    openingBalance: 25000,
    openingBalanceType: 'credit',
    notes: 'Primary strawberry supplier',
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'v2',
    name: 'Kashmir Valley Apple Syndicate',
    contact: '9419012345',
    address: 'Fruit Mandi Sopore',
    city: 'Sopore',
    state: 'Jammu & Kashmir',
    openingBalance: 120000,
    openingBalanceType: 'credit',
    notes: 'Direct grower shipments',
    active: true,
    createdAt: '2026-10-02T00:00:00.000Z',
  },
];

const INITIAL_SALE_PROCEEDS_OB: SaleProceedsOpeningBalance = {
  id: 'sp-ob-1',
  amount: 42016,
  type: 'credit',
  date: '2026-10-08',
  particulars: 'Opening Balance',
};

const INITIAL_SALE_PROCEEDS: SaleProceeds[] = [
  {
    id: 'sp1',
    proceedsNo: 'Sale Proceeds No. 001',
    sequenceNumber: 1,
    date: '2026-10-08',
    challanDate: '2026-10-08',
    billNumber: 'CH-4091',
    items: [
      {
        id: 'spi1',
        fruitId: 'f1',
        fruitName: 'Strawberry',
        quantity: 14,
        unit: 'Crate',
        rate: 414,
        amount: 4186, // Manual override as per test scenario
      },
    ],
    quantity: 14,
    unit: 'Crate',
    rate: 414,
    amount: 4186, // User manually entered 4186
    expenses: [
      { id: 'spe1', name: 'Freight', amount: 100 },
      { id: 'spe2', name: 'Hamali', amount: 10 },
      { id: 'spe3', name: 'Postage', amount: 6 },
    ],
    totalExpense: 116,
    netAmount: 4070, // 4186 - 116 = 4070
    difference: -116, // netAmount - amount
    vendorId: 'v1',
    vendorName: 'Mahabaleshwar Strawberry Growers Co-Op',
    customerId: 'c1',
    customerName: 'ABC Customer',
    notes: 'Premium batch from hill harvest',
    createdAt: '2026-10-08T08:00:00.000Z',
  },
  {
    id: 'sp2',
    proceedsNo: 'Sale Proceeds No. 002',
    sequenceNumber: 2,
    date: '2026-10-10',
    challanDate: '2026-10-10',
    billNumber: 'CH-4098',
    items: [
      {
        id: 'spi2',
        fruitId: 'f_grapes_green_20kg',
        fruitName: 'Grapes Green 20kg',
        quantity: 20,
        unit: 'Crate',
        rate: 650,
        amount: 13000,
      },
    ],
    quantity: 20,
    unit: 'Crate',
    rate: 650,
    amount: 13000,
    expenses: [
      { id: 'spe4', name: 'Freight', amount: 250 },
      { id: 'spe5', name: 'Hamali', amount: 40 },
    ],
    totalExpense: 290,
    netAmount: 12710,
    difference: -290,
    vendorId: 'v2',
    vendorName: 'Kashmir Valley Apple Syndicate',
    customerId: 'c2',
    customerName: 'Shree Ganesh Fruit Mart',
    notes: 'Consignment sale proceeds settlement',
    createdAt: '2026-10-10T09:30:00.000Z',
  },
];

const INITIAL_CREDIT_SALES: CreditSale[] = [
  {
    id: 'cs1',
    creditSaleNo: 'Credit Sale No. 001',
    sequenceNumber: 1,
    customerId: 'c1',
    customerName: 'ABC Customer',
    date: '2026-10-08',
    items: [
      {
        id: 'csi1',
        fruitId: 'f2',
        fruitName: 'Grapes Black',
        quantity: 10,
        unit: 'KG',
        rate: 50,
        amount: 500,
      },
      {
        id: 'csi2',
        fruitId: 'f3',
        fruitName: 'Maharaji Apple',
        quantity: 1,
        unit: 'Peti',
        rate: 500,
        amount: 500,
      },
    ],
    crateTypeId: 'ct1',
    crateName: '20 KG Standard Crate',
    crateIn: 1,
    crateOut: 1,
    crateWeightKg: 20,
    expenses: [
      { id: 'cse1', name: 'Freight', amount: 100 },
      { id: 'cse2', name: 'Hamali', amount: 100 },
      { id: 'cse3', name: 'Other', amount: 50 },
    ],
    productTotal: 1000,
    expenseTotal: 250,
    totalDebit: 1250,
    finalAmount: 1250,
    notes: 'Morning wholesale auction lot',
    createdAt: '2026-10-08T09:00:00.000Z',
    saleType: 'wholesale',
    isGroupSale: false,
  },
  {
    id: 'cs2',
    creditSaleNo: 'Credit Sale No. 002',
    sequenceNumber: 2,
    customerId: 'c1',
    customerName: 'ABC Customer',
    date: '2026-10-08',
    items: [
      {
        id: 'csi3',
        fruitId: 'f1',
        fruitName: 'Strawberry',
        quantity: 2,
        unit: 'Crate',
        rate: 450,
        amount: 900,
      },
    ],
    crateTypeId: 'ct1',
    crateName: '20 KG Standard Crate',
    crateIn: 1,
    crateOut: 1,
    crateWeightKg: 20,
    expenses: [
      { id: 'cse4', name: 'Hamali', amount: 20 },
    ],
    productTotal: 900,
    expenseTotal: 20,
    totalDebit: 920,
    finalAmount: 920,
    notes: '2nd dispatch',
    createdAt: '2026-10-08T10:00:00.000Z',
    saleType: 'wholesale',
    isGroupSale: false,
  },
  {
    id: 'cs3',
    creditSaleNo: 'Credit Sale No. 003',
    sequenceNumber: 3,
    customerId: 'c1',
    customerName: 'ABC Customer',
    date: '2026-10-09',
    items: [
      {
        id: 'csi4',
        fruitId: 'f1',
        fruitName: 'Strawberry',
        quantity: 5,
        unit: 'Crate',
        rate: 430,
        amount: 2150,
      },
    ],
    crateTypeId: 'ct1',
    crateName: '20 KG Standard Crate',
    crateIn: 0,
    crateOut: 5,
    crateWeightKg: 20,
    expenses: [
      { id: 'cse5', name: 'Freight', amount: 50 },
    ],
    productTotal: 2150,
    expenseTotal: 50,
    totalDebit: 2200,
    finalAmount: 2200,
    notes: '5 Crates issued to ABC Customer (out: 5)',
    createdAt: '2026-10-09T08:30:00.000Z',
    saleType: 'wholesale',
    isGroupSale: false,
  },
];

const INITIAL_CASH_SALES: CashSale[] = [
  {
    id: 'cash-s1',
    cashSaleNo: 'Cash Sale No. 001',
    sequenceNumber: 1,
    customerId: 'c2',
    customerName: 'Shree Ganesh Fruit Mart',
    date: '2026-10-09',
    items: [
      {
        id: 'csi-cash-1',
        fruitId: 'f1',
        fruitName: 'Strawberry',
        quantity: 10,
        unit: 'Crate',
        crateSize: 10,
        rate: 420,
        amount: 4200,
      },
      {
        id: 'csi-cash-2',
        fruitId: 'f2',
        fruitName: 'Grapes Black',
        quantity: 20,
        unit: 'Crate',
        crateSize: 20,
        rate: 55,
        amount: 1100,
      },
    ],
    crateTypeId: 'ct1',
    crateName: '20 KG Standard Crate',
    crateIn: 0,
    crateOut: 30,
    crateWeightKg: 20,
    expenses: [
      { id: 'cse-cash-1', name: 'Hamali', amount: 50 },
    ],
    productTotal: 5300,
    expenseTotal: 50,
    totalAmount: 5350,
    finalAmount: 5350,
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
    receivedAmount: 5350,
    notes: 'Direct cash auction delivery',
    createdAt: '2026-10-09T09:15:00.000Z',
  },
];

const INITIAL_RECEIPTS: Receipt[] = [
  {
    id: 'r1',
    receiptNo: 'Receipt No. 001',
    sequenceNumber: 1,
    customerId: 'c1',
    customerName: 'ABC Customer',
    date: '2026-10-08',
    paymentMode: 'Cash',
    amount: 10000,
    notes: 'Cash A/C payment against ledger',
    createdAt: '2026-10-08T11:00:00.000Z',
  },
];

const INITIAL_SETTINGS: GeneralSettings = {
  businessName: 'Hari Kripa Fruit ERP',
  businessNameHindi: 'श्री हरि कृपा फ्रूट ईआरपी',
  mainAccountName: 'Hari Kripa',
  financialYear: '2026-2027',
  currencySymbol: '₹',
  defaultCrateWeightKg: 20,
  allowManualAmounts: true,
  defaultPaymentMode: 'Cash',
};

const INITIAL_USER: User = {
  id: 'u-admin',
  name: 'Mandi Admin',
  username: 'admin',
  role: 'admin',
  pin: '1234',
};

// Initialize DB on module load if not present
export function initDb(forceReset: boolean = false): void {
  if (forceReset || !storage.getItem(STORAGE_KEYS.SETTINGS)) {
    storage.setItem(STORAGE_KEYS.UNITS, JSON.stringify(INITIAL_UNITS));
    storage.setItem(STORAGE_KEYS.CRATE_TYPES, JSON.stringify(INITIAL_CRATE_TYPES));
    storage.setItem(STORAGE_KEYS.COMPANY_PROFILES, JSON.stringify(INITIAL_PROFILES));
    storage.setItem(STORAGE_KEYS.FRUITS, JSON.stringify(INITIAL_FRUITS));
    storage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(INITIAL_CUSTOMERS));
    storage.setItem(STORAGE_KEYS.VENDORS, JSON.stringify(INITIAL_VENDORS));
    storage.setItem(STORAGE_KEYS.SALE_PROCEEDS_OB, JSON.stringify(INITIAL_SALE_PROCEEDS_OB));
    storage.setItem(STORAGE_KEYS.SALE_PROCEEDS, JSON.stringify(INITIAL_SALE_PROCEEDS));
    storage.setItem(STORAGE_KEYS.CREDIT_SALES, JSON.stringify(INITIAL_CREDIT_SALES));
    storage.setItem(STORAGE_KEYS.RECEIPTS, JSON.stringify(INITIAL_RECEIPTS));
    storage.setItem(STORAGE_KEYS.CRATE_TRANSACTIONS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.BILLS, JSON.stringify([]));
    storage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(INITIAL_SETTINGS));
    storage.setItem(STORAGE_KEYS.USERS, JSON.stringify([INITIAL_USER]));
    storage.setItem(STORAGE_KEYS.ACTIVE_USER, JSON.stringify(INITIAL_USER));
    notifyListeners();
  }
}

// Auto-run init
initDb();

export const db = {
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  // Auth & Session
  getActiveUser(): User | null {
    return getItem<User | null>(STORAGE_KEYS.ACTIVE_USER, INITIAL_USER);
  },
  setActiveUser(user: User | null): void {
    setItem(STORAGE_KEYS.ACTIVE_USER, user);
  },

  // Units
  getUnits(): Unit[] {
    const list = getItem<Unit[]>(STORAGE_KEYS.UNITS, INITIAL_UNITS);
    const standardUnits: Unit[] = [
      { id: 'u1', name: 'Crate', symbol: 'Crate', isDefault: true },
      { id: 'u2', name: 'Kilogram', symbol: 'Kg', isDefault: false },
      { id: 'u_piece', name: 'Piece', symbol: 'Piece', isDefault: false },
      { id: 'u_bag', name: 'Bag', symbol: 'Bag', isDefault: false },
    ];
    let updated = false;
    for (const su of standardUnits) {
      if (!list.some((u) => u.symbol.toLowerCase() === su.symbol.toLowerCase())) {
        list.push(su);
        updated = true;
      }
    }
    if (updated) {
      setItem(STORAGE_KEYS.UNITS, list);
    }
    return list;
  },
  saveUnit(unit: Unit): void {
    const list = this.getUnits();
    const idx = list.findIndex((u) => u.id === unit.id);
    if (idx >= 0) {
      list[idx] = unit;
    } else {
      list.push(unit);
    }
    setItem(STORAGE_KEYS.UNITS, list);
  },
  deleteUnit(id: string): void {
    const list = this.getUnits().filter((u) => u.id !== id);
    setItem(STORAGE_KEYS.UNITS, list);
  },

  // Crate Types
  getCrateTypes(): CrateType[] {
    const list = getItem<CrateType[]>(STORAGE_KEYS.CRATE_TYPES, INITIAL_CRATE_TYPES);
    const standardCrates: CrateType[] = [
      { id: 'ct_10', name: '10kg Crate', defaultWeightKg: 10, description: '10kg Crate' },
      { id: 'ct_20', name: '20kg Crate', defaultWeightKg: 20, description: '20kg Crate' },
    ];
    let updated = false;
    for (const sc of standardCrates) {
      const match = list.find(
        (c) =>
          c.id === sc.id ||
          c.name.toLowerCase().replace(/\s+/g, '') === sc.name.toLowerCase().replace(/\s+/g, '') ||
          c.name.toLowerCase().replace(/\s+/g, '') === sc.name.toLowerCase().replace('crate', '').trim().replace(/\s+/g, '')
      );
      if (!match) {
        list.unshift(sc);
        updated = true;
      } else if (match.name === '10 Kg' || match.name === '20 Kg') {
        match.name = sc.name;
        updated = true;
      }
    }
    if (updated) {
      setItem(STORAGE_KEYS.CRATE_TYPES, list);
    }
    return list;
  },
  saveCrateType(ct: CrateType): void {
    const list = this.getCrateTypes();
    const idx = list.findIndex((item) => item.id === ct.id);
    if (idx >= 0) {
      list[idx] = ct;
    } else {
      list.push(ct);
    }
    setItem(STORAGE_KEYS.CRATE_TYPES, list);
  },
  deleteCrateType(id: string): void {
    const list = this.getCrateTypes().filter((item) => item.id !== id);
    setItem(STORAGE_KEYS.CRATE_TYPES, list);
  },

  // Fruits
  getFruits(): Fruit[] {
    const rawList = getItem<Fruit[]>(STORAGE_KEYS.FRUITS, INITIAL_FRUITS);
    const hasMango = rawList.some((f) => f.name.toLowerCase() === 'mango');
    if (!hasMango) {
      rawList.unshift({
        id: 'f_mango',
        name: 'Mango',
        category: 'Mangoes',
        unit: 'Crate',
        defaultUnit: 'Crate',
        crateType: '20kg',
        crateName: '20kg',
        crateTypeId: 'ct_20',
        crateWeightKg: 20,
        defaultRate: 150,
        fruitIcon: 'mango',
        active: true,
        createdAt: '2026-10-01T00:00:00.000Z',
      });
      setItem(STORAGE_KEYS.FRUITS, rawList);
    }
    const hasGrapesGreen = rawList.some((f) => f.name.toLowerCase().includes('grapes green 20kg'));
    if (!hasGrapesGreen) {
      rawList.unshift({
        id: 'f_grapes_green_20kg',
        name: 'Grapes Green 20kg',
        category: 'Grapes',
        unit: 'Crate',
        defaultUnit: 'Crate',
        crateType: '20kg',
        crateName: '20kg',
        crateTypeId: 'ct_20',
        crateWeightKg: 20,
        defaultRate: 100,
        fruitIcon: 'grapes',
        active: true,
        createdAt: '2026-10-01T00:00:00.000Z',
      });
      setItem(STORAGE_KEYS.FRUITS, rawList);
    }
    const hasApple = rawList.some((f) => f.name.toLowerCase() === 'apple');
    if (!hasApple) {
      rawList.push({
        id: 'f_apple',
        name: 'Apple',
        category: 'Apples',
        unit: 'Peti',
        defaultUnit: 'Peti',
        crateType: '',
        crateName: '',
        crateWeightKg: 0,
        defaultRate: 1,
        fruitIcon: 'apple',
        active: true,
        createdAt: '2026-10-01T00:00:00.000Z',
      });
      setItem(STORAGE_KEYS.FRUITS, rawList);
    }

    return rawList.map((f) => {
      const unit = f.unit || f.defaultUnit || 'Crate';
      const defaultRate = typeof f.defaultRate === 'number' && !isNaN(f.defaultRate) ? f.defaultRate : 1;
      const crateType = f.crateType !== undefined ? f.crateType : (f.crateName || '');
      const crateName = f.crateName !== undefined ? f.crateName : (f.crateType || '');
      return {
        ...f,
        unit,
        defaultUnit: unit,
        crateType,
        crateName,
        defaultRate,
      };
    });
  },
  getFruitById(id: string): Fruit | undefined {
    return this.getFruits().find((f) => f.id === id);
  },
  saveFruit(fruit: Fruit): void {
    const list = getItem<Fruit[]>(STORAGE_KEYS.FRUITS, INITIAL_FRUITS);
    const unit = (fruit.unit || fruit.defaultUnit || 'Crate').trim();
    const crateType = fruit.crateType !== undefined ? fruit.crateType.trim() : (fruit.crateName ? fruit.crateName.trim() : '');
    const defaultRate = typeof fruit.defaultRate === 'number' && !isNaN(fruit.defaultRate) ? fruit.defaultRate : 1;
    const normalized: Fruit = {
      ...fruit,
      unit,
      defaultUnit: unit,
      crateType,
      crateName: crateType,
      crateTypeId: fruit.crateTypeId || (crateType ? 'ct_20' : undefined),
      defaultRate,
    };
    const idx = list.findIndex((f) => f.id === normalized.id);
    if (idx >= 0) {
      list[idx] = normalized;
    } else {
      list.push(normalized);
    }
    setItem(STORAGE_KEYS.FRUITS, list);
  },
  deleteFruit(id: string): void {
    const list = getItem<Fruit[]>(STORAGE_KEYS.FRUITS, INITIAL_FRUITS).filter((f) => f.id !== id);
    setItem(STORAGE_KEYS.FRUITS, list);
  },

  // Customers
  getCustomers(): Customer[] {
    return getItem<Customer[]>(STORAGE_KEYS.CUSTOMERS, INITIAL_CUSTOMERS);
  },
  getCustomerById(id: string): Customer | undefined {
    return this.getCustomers().find((c) => c.id === id);
  },
  saveCustomer(customer: Customer): void {
    const list = this.getCustomers();
    const idx = list.findIndex((c) => c.id === customer.id);
    if (idx >= 0) {
      list[idx] = customer;
    } else {
      list.push(customer);
    }
    setItem(STORAGE_KEYS.CUSTOMERS, list);
  },
  deleteCustomer(id: string): void {
    const list = this.getCustomers().filter((c) => c.id !== id);
    setItem(STORAGE_KEYS.CUSTOMERS, list);
  },

  // Vendors
  getVendors(): Vendor[] {
    return getItem<Vendor[]>(STORAGE_KEYS.VENDORS, INITIAL_VENDORS);
  },
  getVendorById(id: string): Vendor | undefined {
    return this.getVendors().find((v) => v.id === id);
  },
  saveVendor(vendor: Vendor): void {
    const list = this.getVendors();
    const idx = list.findIndex((v) => v.id === vendor.id);
    if (idx >= 0) {
      list[idx] = vendor;
    } else {
      list.push(vendor);
    }
    setItem(STORAGE_KEYS.VENDORS, list);
  },
  deleteVendor(id: string): void {
    const list = this.getVendors().filter((v) => v.id !== id);
    setItem(STORAGE_KEYS.VENDORS, list);
  },

  // Company Bill Profiles
  getCompanyProfiles(): CompanyProfile[] {
    const profiles = getItem<CompanyProfile[]>(STORAGE_KEYS.COMPANY_PROFILES, INITIAL_PROFILES);
    return profiles.map((p) => {
      if (p.hindiName === undefined) {
        const init = INITIAL_PROFILES.find((ip) => ip.id === p.id);
        if (init?.hindiName) {
          return { ...p, hindiName: init.hindiName };
        }
      }
      return p;
    });
  },
  getDefaultProfile(): CompanyProfile {
    const profiles = this.getCompanyProfiles();
    return profiles.find((p) => p.isDefault) || profiles[0] || INITIAL_PROFILES[0];
  },
  saveCompanyProfile(profile: CompanyProfile): void {
    let list = this.getCompanyProfiles();
    if (profile.isDefault) {
      list = list.map((p) => ({ ...p, isDefault: p.id === profile.id }));
    }
    const idx = list.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      list[idx] = profile;
    } else {
      list.push(profile);
    }
    setItem(STORAGE_KEYS.COMPANY_PROFILES, list);
  },
  deleteCompanyProfile(id: string): void {
    const list = this.getCompanyProfiles().filter((p) => p.id !== id);
    if (list.length > 0 && !list.some((p) => p.isDefault)) {
      list[0].isDefault = true;
    }
    setItem(STORAGE_KEYS.COMPANY_PROFILES, list);
  },

  // Sale Proceeds Opening Balance
  getSaleProceedsOpeningBalance(): SaleProceedsOpeningBalance {
    return getItem<SaleProceedsOpeningBalance>(STORAGE_KEYS.SALE_PROCEEDS_OB, INITIAL_SALE_PROCEEDS_OB);
  },
  saveSaleProceedsOpeningBalance(ob: SaleProceedsOpeningBalance): void {
    setItem(STORAGE_KEYS.SALE_PROCEEDS_OB, ob);
  },

  // Sale Proceeds
  getSaleProceeds(): SaleProceeds[] {
    return getItem<SaleProceeds[]>(STORAGE_KEYS.SALE_PROCEEDS, INITIAL_SALE_PROCEEDS);
  },
  getNextSaleProceedsNumber(): number {
    const list = this.getSaleProceeds();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((sp) => sp.sequenceNumber || 0));
    return max + 1;
  },
  saveSaleProceeds(item: SaleProceeds): void {
    const list = this.getSaleProceeds();
    const updatedRecord: SaleProceeds = {
      ...item,
      updatedAt: new Date().toISOString(),
    };

    const idx = list.findIndex((sp) => sp.id === item.id);
    if (idx >= 0) {
      list[idx] = updatedRecord;
    } else {
      const billNoIdx = list.findIndex((sp) => sp.proceedsNo === item.proceedsNo);
      if (billNoIdx >= 0) {
        list[billNoIdx] = updatedRecord;
      } else {
        // Debounce rapid duplicate submission within 3 seconds
        const dupIdx = list.findIndex(
          (sp) =>
            sp.vendorId === item.vendorId &&
            sp.customerId === item.customerId &&
            sp.date === item.date &&
            sp.amount === item.amount &&
            sp.items?.length === item.items?.length &&
            Math.abs(new Date(item.createdAt || '').getTime() - new Date(sp.createdAt || '').getTime()) < 3000
        );
        if (dupIdx >= 0) {
          list[dupIdx] = updatedRecord;
        } else {
          list.push(updatedRecord);
        }
      }
    }
    setItem(STORAGE_KEYS.SALE_PROCEEDS, list);

    // If there is a linked bill or billId, keep the bill updated as well
    if (item.billId || item.id) {
      const bills = this.getBills();
      const bIdx = bills.findIndex((b) => b.id === item.billId || b.sourceTransactionId === item.id);
      if (bIdx >= 0) {
        const existingBill = bills[bIdx];
        bills[bIdx] = {
          ...existingBill,
          billNo: item.billNumber || existingBill.billNo,
          customerId: item.customerId || existingBill.customerId,
          customerName: item.customerName || existingBill.customerName,
          customerMobile: item.customerMobile || existingBill.customerMobile,
          customerAddress: item.customerAddress || existingBill.customerAddress,
          customerAadhaarNo: item.customerAadhaarNo || existingBill.customerAadhaarNo,
          date: item.date,
          challanNumber: item.billNumber || item.proceedsNo,
          challanDate: item.challanDate || item.date,
          subtotal: item.amount,
          expenseTotal: item.totalExpense,
          totalAmount: item.amount + item.totalExpense,
          sourceTransactionId: item.id,
          sourceTransactionNo: item.proceedsNo,
          sourceType: 'saleProceeds',
          items: item.items.map((it) => ({
            id: it.id,
            fruitId: it.fruitId,
            fruitName: it.fruitName,
            quantity: it.quantity,
            unit: it.unit,
            kg: it.weight !== undefined ? it.weight : it.kg,
            rate: it.rate,
            amount: it.amount,
            crateSize: it.crateName || undefined,
          })),
          expenses: item.expenses,
        };
        setItem(STORAGE_KEYS.BILLS, bills);
      }
    }
  },
  deleteSaleProceeds(id: string): void {
    const list = this.getSaleProceeds().filter((sp) => sp.id !== id);
    setItem(STORAGE_KEYS.SALE_PROCEEDS, list);
  },

  // Credit Sales
  getCreditSales(): CreditSale[] {
    const rawList = getItem<CreditSale[]>(STORAGE_KEYS.CREDIT_SALES, INITIAL_CREDIT_SALES);
    return rawList.map((cs) => {
      const isGroup = cs.saleType === 'group' || cs.isGroupSale === true || Boolean(cs.notes?.toLowerCase().includes('group sale'));
      return {
        ...cs,
        saleType: cs.saleType || (isGroup ? 'group' : 'wholesale'),
        isGroupSale: isGroup,
      };
    });
  },
  getNextCreditSaleNumber(): number {
    const list = this.getCreditSales();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((cs) => cs.sequenceNumber || 0));
    return max + 1;
  },
  saveCreditSale(sale: CreditSale): void {
    const list = this.getCreditSales();
    const idx = list.findIndex((cs) => cs.id === sale.id);
    if (idx >= 0) {
      list[idx] = sale;
    } else {
      // 1. Check if a sale with identical bill number already exists
      const billNoIdx = list.findIndex((cs) => cs.creditSaleNo === sale.creditSaleNo);
      if (billNoIdx >= 0) {
        list[billNoIdx] = sale;
      } else {
        // 2. Prevent rapid duplicate submission (within 3 seconds with same customer, date, amount)
        const dupIdx = list.findIndex(
          (cs) =>
            cs.customerId === sale.customerId &&
            cs.date === sale.date &&
            cs.finalAmount === sale.finalAmount &&
            cs.items?.length === sale.items?.length &&
            Math.abs(new Date(sale.createdAt || '').getTime() - new Date(cs.createdAt || '').getTime()) < 3000
        );
        if (dupIdx >= 0) {
          list[dupIdx] = sale;
        } else {
          list.push(sale);
        }
      }
    }
    setItem(STORAGE_KEYS.CREDIT_SALES, list);
  },
  saveCreditSalesBatch(salesToSave: CreditSale[]): void {
    const list = this.getCreditSales();
    const idMap = new Map<string, number>();
    const billMap = new Map<string, number>();
    list.forEach((s, idx) => {
      idMap.set(s.id, idx);
      if (s.creditSaleNo) billMap.set(s.creditSaleNo, idx);
    });

    for (const sale of salesToSave) {
      if (idMap.has(sale.id)) {
        list[idMap.get(sale.id)!] = sale;
      } else if (sale.creditSaleNo && billMap.has(sale.creditSaleNo)) {
        list[billMap.get(sale.creditSaleNo)!] = sale;
      } else {
        list.push(sale);
        const newIdx = list.length - 1;
        idMap.set(sale.id, newIdx);
        if (sale.creditSaleNo) billMap.set(sale.creditSaleNo, newIdx);
      }
    }
    setItem(STORAGE_KEYS.CREDIT_SALES, list);
  },
  deleteCreditSale(id: string): void {
    const list = this.getCreditSales().filter((cs) => cs.id !== id);
    setItem(STORAGE_KEYS.CREDIT_SALES, list);
  },
  deleteCreditSalesBatch(ids: string[]): void {
    const idSet = new Set(ids);
    const list = this.getCreditSales().filter((cs) => !idSet.has(cs.id));
    setItem(STORAGE_KEYS.CREDIT_SALES, list);
  },

  // Cash Sales (Paid wholesale sales)
  getCashSales(): CashSale[] {
    return getItem<CashSale[]>(STORAGE_KEYS.CASH_SALES, INITIAL_CASH_SALES);
  },
  getNextCashSaleNumber(): number {
    const list = this.getCashSales();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((cs) => cs.sequenceNumber || 0));
    return max + 1;
  },
  saveCashSale(sale: CashSale): void {
    const list = this.getCashSales();
    const idx = list.findIndex((cs) => cs.id === sale.id);
    if (idx >= 0) {
      list[idx] = sale;
    } else {
      const billNoIdx = list.findIndex((cs) => cs.cashSaleNo === sale.cashSaleNo);
      if (billNoIdx >= 0) {
        list[billNoIdx] = sale;
      } else {
        const dupIdx = list.findIndex(
          (cs) =>
            cs.customerId === sale.customerId &&
            cs.date === sale.date &&
            cs.finalAmount === sale.finalAmount &&
            cs.items?.length === sale.items?.length &&
            Math.abs(new Date(sale.createdAt || '').getTime() - new Date(cs.createdAt || '').getTime()) < 3000
        );
        if (dupIdx >= 0) {
          list[dupIdx] = sale;
        } else {
          list.push(sale);
        }
      }
    }
    setItem(STORAGE_KEYS.CASH_SALES, list);
  },
  deleteCashSale(id: string): void {
    const list = this.getCashSales().filter((cs) => cs.id !== id);
    setItem(STORAGE_KEYS.CASH_SALES, list);
  },

  // Receipts
  getReceipts(): Receipt[] {
    return getItem<Receipt[]>(STORAGE_KEYS.RECEIPTS, INITIAL_RECEIPTS);
  },
  getNextReceiptNumber(): number {
    const list = this.getReceipts();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((r) => r.sequenceNumber || 0));
    return max + 1;
  },
  saveReceipt(receipt: Receipt): void {
    const list = this.getReceipts();
    const idx = list.findIndex((r) => r.id === receipt.id);
    if (idx >= 0) {
      list[idx] = receipt;
    } else {
      const recNoIdx = list.findIndex((r) => r.receiptNo === receipt.receiptNo);
      if (recNoIdx >= 0) {
        list[recNoIdx] = receipt;
      } else {
        const dupIdx = list.findIndex(
          (r) =>
            r.customerId === receipt.customerId &&
            r.date === receipt.date &&
            r.amount === receipt.amount &&
            r.paymentMode === receipt.paymentMode &&
            Math.abs(new Date(receipt.createdAt || '').getTime() - new Date(r.createdAt || '').getTime()) < 3000
        );
        if (dupIdx >= 0) {
          list[dupIdx] = receipt;
        } else {
          list.push(receipt);
        }
      }
    }
    setItem(STORAGE_KEYS.RECEIPTS, list);
  },
  deleteReceipt(id: string): void {
    const list = this.getReceipts().filter((r) => r.id !== id);
    setItem(STORAGE_KEYS.RECEIPTS, list);
  },

  // Manual Crate Transactions (returns or adjustments not originating from credit sale)
  getCrateTransactions(): CrateTransaction[] {
    return getItem<CrateTransaction[]>(STORAGE_KEYS.CRATE_TRANSACTIONS, []);
  },
  saveCrateTransaction(tx: CrateTransaction): void {
    const list = this.getCrateTransactions();
    const idx = list.findIndex((t) => t.id === tx.id);
    if (idx >= 0) {
      list[idx] = tx;
    } else {
      list.push(tx);
    }
    setItem(STORAGE_KEYS.CRATE_TRANSACTIONS, list);
  },
  deleteCrateTransaction(id: string): void {
    const list = this.getCrateTransactions().filter((t) => t.id !== id);
    setItem(STORAGE_KEYS.CRATE_TRANSACTIONS, list);
  },

  // Bills
  getBills(): Bill[] {
    return getItem<Bill[]>(STORAGE_KEYS.BILLS, []);
  },
  getNextBillNumber(): number {
    const list = this.getBills();
    if (list.length === 0) return 1;
    const max = Math.max(...list.map((b) => b.sequenceNumber || 0));
    return max + 1;
  },
  saveBill(bill: Bill): void {
    const list = this.getBills();
    const idx = list.findIndex((b) => b.id === bill.id);
    if (idx >= 0) {
      list[idx] = bill;
    } else {
      const billNoIdx = list.findIndex((b) => b.billNo === bill.billNo);
      if (billNoIdx >= 0) {
        list[billNoIdx] = bill;
      } else {
        list.push(bill);
      }
    }
    setItem(STORAGE_KEYS.BILLS, list);

    // If this bill originated from a Sale Proceeds, synchronize the sale proceeds record
    if (bill.sourceTransactionId) {
      const proceeds = this.getSaleProceeds();
      const pIdx = proceeds.findIndex((p) => p.id === bill.sourceTransactionId);
      if (pIdx >= 0) {
        proceeds[pIdx] = {
          ...proceeds[pIdx],
          billId: bill.id,
          billNumber: bill.billNo,
          customerId: bill.customerId || proceeds[pIdx].customerId,
          customerName: bill.customerName || proceeds[pIdx].customerName,
          customerMobile: bill.customerMobile || proceeds[pIdx].customerMobile,
          customerAddress: bill.customerAddress || proceeds[pIdx].customerAddress,
          customerAadhaarNo: bill.customerAadhaarNo || proceeds[pIdx].customerAadhaarNo,
          updatedAt: new Date().toISOString(),
        };
        setItem(STORAGE_KEYS.SALE_PROCEEDS, proceeds);
      }
    }
  },
  deleteBill(id: string): void {
    const list = this.getBills().filter((b) => b.id !== id);
    setItem(STORAGE_KEYS.BILLS, list);
  },

  // Settings
  getSettings(): GeneralSettings {
    return getItem<GeneralSettings>(STORAGE_KEYS.SETTINGS, INITIAL_SETTINGS);
  },
  saveSettings(settings: GeneralSettings): void {
    setItem(STORAGE_KEYS.SETTINGS, settings);
  },

  // Backup & Restore
  exportDatabaseJson(): string {
    const snapshot = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      units: this.getUnits(),
      crateTypes: this.getCrateTypes(),
      companyProfiles: this.getCompanyProfiles(),
      fruits: this.getFruits(),
      customers: this.getCustomers(),
      vendors: this.getVendors(),
      saleProceedsOB: this.getSaleProceedsOpeningBalance(),
      saleProceeds: this.getSaleProceeds(),
      creditSales: this.getCreditSales(),
      receipts: this.getReceipts(),
      crateTransactions: this.getCrateTransactions(),
      bills: this.getBills(),
      settings: this.getSettings(),
    };
    return JSON.stringify(snapshot, null, 2);
  },

  importDatabaseJson(jsonString: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (data.units) setItem(STORAGE_KEYS.UNITS, data.units);
      if (data.crateTypes) setItem(STORAGE_KEYS.CRATE_TYPES, data.crateTypes);
      if (data.companyProfiles) setItem(STORAGE_KEYS.COMPANY_PROFILES, data.companyProfiles);
      if (data.fruits) setItem(STORAGE_KEYS.FRUITS, data.fruits);
      if (data.customers) setItem(STORAGE_KEYS.CUSTOMERS, data.customers);
      if (data.vendors) setItem(STORAGE_KEYS.VENDORS, data.vendors);
      if (data.saleProceedsOB) setItem(STORAGE_KEYS.SALE_PROCEEDS_OB, data.saleProceedsOB);
      if (data.saleProceeds) setItem(STORAGE_KEYS.SALE_PROCEEDS, data.saleProceeds);
      if (data.creditSales) setItem(STORAGE_KEYS.CREDIT_SALES, data.creditSales);
      if (data.receipts) setItem(STORAGE_KEYS.RECEIPTS, data.receipts);
      if (data.crateTransactions) setItem(STORAGE_KEYS.CRATE_TRANSACTIONS, data.crateTransactions);
      if (data.bills) setItem(STORAGE_KEYS.BILLS, data.bills);
      if (data.settings) setItem(STORAGE_KEYS.SETTINGS, data.settings);
      notifyListeners();
      return true;
    } catch (e) {
      console.error('Failed to import database:', e);
      return false;
    }
  },

  resetToDefaultData(): void {
    initDb(true);
  },

  clearAllTransactions(): void {
    setItem(STORAGE_KEYS.SALE_PROCEEDS, []);
    setItem(STORAGE_KEYS.CREDIT_SALES, []);
    setItem(STORAGE_KEYS.RECEIPTS, []);
    setItem(STORAGE_KEYS.CRATE_TRANSACTIONS, []);
    setItem(STORAGE_KEYS.BILLS, []);
  },

  // Administrator Password Verification
  verifyAdminPassword(password: string): boolean {
    const trimmed = (password || '').trim();
    if (!trimmed) return false;
    if (trimmed === '1234') return true;
    const activeUser = this.getActiveUser();
    if (activeUser && activeUser.pin === trimmed) return true;
    const users = getItem<User[]>(STORAGE_KEYS.USERS, []);
    const adminUser = users.find((u) => u.role === 'admin' && u.pin === trimmed);
    return !!adminUser;
  },

  // Trash / Recycle Bin System
  getTrash(): TrashItem[] {
    return getItem<TrashItem[]>(STORAGE_KEYS.TRASH, []);
  },

  moveToTrash(
    itemType: TrashItem['itemType'],
    itemId: string,
    title: string,
    subtitle?: string,
    data?: any,
    relatedTransactions?: any
  ): TrashItem {
    const currentUser = this.getActiveUser();
    const trashList = this.getTrash();
    const trashEntry: TrashItem = {
      id: `trash-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      itemType,
      itemId,
      title: title || 'Deleted Record',
      subtitle,
      data: data || null,
      relatedTransactions: relatedTransactions || null,
      deletedAt: new Date().toISOString(),
      deletedBy: currentUser?.name || 'Administrator',
    };

    trashList.unshift(trashEntry);
    setItem(STORAGE_KEYS.TRASH, trashList);

    // Remove from the active dataset based on type
    if (itemType === 'customer') {
      const list = this.getCustomers().filter((c) => c.id !== itemId);
      setItem(STORAGE_KEYS.CUSTOMERS, list);
    } else if (itemType === 'fruit') {
      const list = this.getFruits().filter((f) => f.id !== itemId);
      setItem(STORAGE_KEYS.FRUITS, list);
    } else if (itemType === 'vendor') {
      const list = this.getVendors().filter((v) => v.id !== itemId);
      setItem(STORAGE_KEYS.VENDORS, list);
    } else if (itemType === 'creditSale') {
      const list = this.getCreditSales().filter((s) => s.id !== itemId);
      setItem(STORAGE_KEYS.CREDIT_SALES, list);
    } else if (itemType === 'cashSale') {
      const list = this.getCashSales().filter((s) => s.id !== itemId);
      setItem(STORAGE_KEYS.CASH_SALES, list);
    } else if (itemType === 'saleProceeds') {
      const list = this.getSaleProceeds().filter((s) => s.id !== itemId);
      setItem(STORAGE_KEYS.SALE_PROCEEDS, list);
    } else if (itemType === 'receipt') {
      const list = this.getReceipts().filter((r) => r.id !== itemId);
      setItem(STORAGE_KEYS.RECEIPTS, list);
    } else if (itemType === 'bill') {
      const list = this.getBills().filter((b) => b.id !== itemId);
      setItem(STORAGE_KEYS.BILLS, list);
    }

    return trashEntry;
  },

  restoreFromTrash(trashId: string): { success: boolean; message: string } {
    const trashList = this.getTrash();
    const itemIndex = trashList.findIndex((t) => t.id === trashId);
    if (itemIndex < 0) {
      return { success: false, message: 'Item not found in Trash' };
    }

    const trashItem = trashList[itemIndex];
    const { itemType, data, title } = trashItem;

    if (!data) {
      // Remove orphaned trash item
      trashList.splice(itemIndex, 1);
      setItem(STORAGE_KEYS.TRASH, trashList);
      return { success: false, message: 'Cannot restore: Record data is empty' };
    }

    try {
      if (itemType === 'customer') {
        const customers = this.getCustomers();
        const existingIdx = customers.findIndex((c) => c.id === data.id);
        if (existingIdx >= 0) {
          customers[existingIdx] = data;
        } else {
          customers.push(data);
        }
        setItem(STORAGE_KEYS.CUSTOMERS, customers);
      } else if (itemType === 'fruit') {
        const fruits = this.getFruits();
        const existingIdx = fruits.findIndex((f) => f.id === data.id);
        if (existingIdx >= 0) {
          fruits[existingIdx] = data;
        } else {
          fruits.push(data);
        }
        setItem(STORAGE_KEYS.FRUITS, fruits);
      } else if (itemType === 'vendor') {
        const vendors = this.getVendors();
        const existingIdx = vendors.findIndex((v) => v.id === data.id);
        if (existingIdx >= 0) {
          vendors[existingIdx] = data;
        } else {
          vendors.push(data);
        }
        setItem(STORAGE_KEYS.VENDORS, vendors);
      } else if (itemType === 'creditSale') {
        const sales = this.getCreditSales();
        const existingIdx = sales.findIndex((s) => s.id === data.id);
        if (existingIdx >= 0) {
          sales[existingIdx] = data;
        } else {
          sales.push(data);
        }
        setItem(STORAGE_KEYS.CREDIT_SALES, sales);
      } else if (itemType === 'cashSale') {
        const sales = this.getCashSales();
        const existingIdx = sales.findIndex((s) => s.id === data.id);
        if (existingIdx >= 0) {
          sales[existingIdx] = data;
        } else {
          sales.push(data);
        }
        setItem(STORAGE_KEYS.CASH_SALES, sales);
      } else if (itemType === 'saleProceeds') {
        const list = this.getSaleProceeds();
        const existingIdx = list.findIndex((s) => s.id === data.id);
        if (existingIdx >= 0) {
          list[existingIdx] = data;
        } else {
          list.push(data);
        }
        setItem(STORAGE_KEYS.SALE_PROCEEDS, list);
      } else if (itemType === 'receipt') {
        const list = this.getReceipts();
        const existingIdx = list.findIndex((r) => r.id === data.id);
        if (existingIdx >= 0) {
          list[existingIdx] = data;
        } else {
          list.push(data);
        }
        setItem(STORAGE_KEYS.RECEIPTS, list);
      } else if (itemType === 'bill') {
        const list = this.getBills();
        const existingIdx = list.findIndex((b) => b.id === data.id);
        if (existingIdx >= 0) {
          list[existingIdx] = data;
        } else {
          list.push(data);
        }
        setItem(STORAGE_KEYS.BILLS, list);
      }

      // Remove from trash after successful restoration
      trashList.splice(itemIndex, 1);
      setItem(STORAGE_KEYS.TRASH, trashList);

      return { success: true, message: `"${title}" has been restored successfully.` };
    } catch (err) {
      console.error('Error restoring item from trash:', err);
      return { success: false, message: 'Failed to restore record.' };
    }
  },

  permanentDeleteTrash(trashId: string): void {
    const trashList = this.getTrash().filter((t) => t.id !== trashId);
    setItem(STORAGE_KEYS.TRASH, trashList);
  },

  emptyTrash(): void {
    setItem(STORAGE_KEYS.TRASH, []);
  },
};
