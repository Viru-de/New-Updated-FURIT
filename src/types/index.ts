export interface User {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'accountant';
  pin: string;
}

export interface CompanyProfile {
  id: string;
  name: string;
  tradeName?: string;
  shortCode?: string;
  hindiName?: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  mobile: string; // Primary Mobile Number
  primaryContactName?: string; // Optional Primary Contact Name
  alternate1ContactName?: string; // Optional Alternate 1 Contact Name
  alternate1Mobile?: string; // Optional Alternate 1 Mobile Number
  alternateMobile?: string; // Preserved for backward compatibility
  alternate2ContactName?: string; // Optional Alternate 2 Contact Name
  alternate2Mobile?: string; // Optional Alternate 2 Mobile Number
  email?: string;
  aadhaarNo?: string; // Aadhaar Card No. (optional 12-digit identification)
  gstin?: string; // Preserved legacy database field (hidden from Company Bill Profiles UI)
  pan?: string;
  bankName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
  termsAndConditions?: string;
  footerText?: string;
  signatureTitle?: string;
  softwareDevelopedBy?: string;
  logo?: string; // Uploaded business logo (stored in localStorage / image store)
  isDefault: boolean;
  createdAt: string;
}

export interface Unit {
  id: string;
  name: string;
  symbol: string;
  isDefault?: boolean;
}

export interface CrateType {
  id: string;
  name: string;
  defaultWeightKg: number;
  description?: string;
}

export interface Fruit {
  id: string;
  name: string; // Item Name
  category?: string;
  unit?: string; // Unit field (Kg, Piece, Bag, Crate, Peti, etc.)
  defaultUnit: string; // Preserved for backward compatibility
  crateTypeId?: string;
  crateType?: string; // Free-text input e.g. 20kg or 10kg, or blank
  crateName?: string; // Free-text input e.g. 20kg or 10kg, or blank
  crateWeightKg: number;
  defaultRate: number; // Price
  fruitIcon?: string; // Built-in icon ID or custom image data URI / asset path
  active: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  mobile: string;
  altMobile?: string;
  address?: string;
  aadhaarNo?: string;
  gstin?: string;
  city?: string;
  state?: string;
  openingBalance: number;
  openingBalanceType: 'debit' | 'credit';
  openingCrateBalance: number;
  crateTypeId?: string;
  notes?: string;
  photo?: string; // Optional uploaded customer photo (data URI or asset path)
  active: boolean;
  createdAt: string;
}

export interface Vendor {
  id: string;
  name: string;
  contact: string;
  address?: string;
  aadhaarNo?: string;
  gstin?: string;
  city?: string;
  state?: string;
  openingBalance: number;
  openingBalanceType: 'credit' | 'debit';
  notes?: string;
  active: boolean;
  createdAt: string;
}

export interface ExpenseItem {
  id: string;
  name: string;
  amount: number;
}

export interface SaleProceedsItem {
  id: string;
  fruitId: string;
  fruitName: string;
  quantity: number;
  unit: string;
  kg?: number;
  crateTypeId?: string;
  crateName?: string;
  rate: number;
  amount: number;
}

export interface SaleProceeds {
  id: string;
  proceedsNo: string;
  sequenceNumber: number;
  date: string; // YYYY-MM-DD
  challanDate: string; // YYYY-MM-DD
  billNumber?: string;
  items: SaleProceedsItem[];
  quantity: number;
  unit: string;
  kg?: number;
  rate: number;
  amount: number; // Manually editable amount!
  expenses: ExpenseItem[];
  totalExpense: number;
  netAmount: number; // amount - totalExpense
  difference: number; // netAmount - amount (e.g. -116)
  vendorId?: string;
  vendorName?: string;
  customerId?: string;
  customerName?: string;
  notes?: string;
  crateTypeId?: string;
  crateName?: string;
  createdAt: string;
}

export interface SaleProceedsOpeningBalance {
  id: string;
  amount: number;
  type: 'credit' | 'debit';
  date: string; // YYYY-MM-DD
  particulars: string;
}

export interface CrateMovementItem {
  crateTypeId: string;
  crateName: string;
  outQuantity: number;
  inQuantity: number;
}

export interface CrateTypeBalance {
  crateTypeId: string;
  crateName: string;
  issued: number;
  returned: number;
  balance: number;
  weightKg: number;
}

export interface CreditSaleItem {
  id: string;
  fruitId?: string;
  fruitName: string;
  quantity: number;
  unit: string;
  kg?: number;
  rate: number;
  amount: number;
  crateTypeId?: string;
  crateName?: string;
  crateSize?: number | string;
}

export interface CreditSale {
  id: string;
  creditSaleNo: string;
  sequenceNumber: number;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  items: CreditSaleItem[];
  crateTypeId?: string;
  crateName?: string;
  crateIn: number;
  crateOut: number;
  crateWeightKg: number;
  crateMovements?: CrateMovementItem[];
  expenses: ExpenseItem[];
  productTotal: number;
  expenseTotal: number;
  totalDebit: number;
  manualAdjustedAmount?: number;
  finalAmount: number; // Debit added to customer ledger
  netTotal?: number;
  oldBalance?: number;
  cashReceipt?: number;
  totalBalance?: number;
  totalCrateBalance?: number;
  notes?: string;
  createdAt: string;
}

export interface CashSaleItem {
  id: string;
  fruitId?: string;
  fruitName: string;
  quantity: number;
  unit: string;
  kg?: number;
  rate: number;
  amount: number;
  crateTypeId?: string;
  crateName?: string;
  crateSize?: number | string;
}

export interface CashSale {
  id: string;
  cashSaleNo: string;
  sequenceNumber: number;
  customerId?: string;
  customerName?: string;
  date: string; // YYYY-MM-DD
  items: CashSaleItem[];
  crateTypeId?: string;
  crateName?: string;
  crateIn: number;
  crateOut: number;
  crateWeightKg: number;
  crateMovements?: CrateMovementItem[];
  expenses: ExpenseItem[];
  productTotal: number;
  expenseTotal: number;
  totalAmount: number;
  manualAdjustedAmount?: number;
  finalAmount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer';
  paymentStatus: 'Paid';
  receivedAmount: number;
  notes?: string;
  createdAt: string;
}

export interface Receipt {
  id: string;
  receiptNo: string;
  sequenceNumber: number;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque' | 'RTGS/NEFT';
  amount: number;
  notes?: string;
  createdAt: string;
}

export interface CrateTransaction {
  id: string;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  referenceType: 'Credit Sale' | 'Return' | 'Manual Adjustment' | 'Opening Balance';
  referenceNo: string;
  crateTypeId: string;
  crateName: string;
  inQuantity: number;
  outQuantity: number;
  balanceQuantity: number;
  weightKgPerCrate: number;
  totalKg: number;
  notes?: string;
  createdAt: string;
}

export interface BillItem {
  id: string;
  fruitId: string;
  fruitName: string;
  quantity: number;
  unit: string;
  rate: number;
  amount: number;
  crateSize?: number | string;
}

export interface Bill {
  id: string;
  billNo: string;
  sequenceNumber: number;
  companyProfileId: string;
  companyProfileSnapshot: CompanyProfile;
  customerId: string;
  customerName: string;
  customerMobile?: string;
  customerAddress?: string;
  customerAadhaarNo?: string;
  customerGstin?: string;
  date: string; // YYYY-MM-DD
  challanNumber?: string;
  challanDate?: string; // YYYY-MM-DD
  items: BillItem[];
  expenses: ExpenseItem[];
  subtotal: number;
  expenseTotal: number;
  totalAmount: number;
  notes?: string;
  status: 'Paid' | 'Unpaid' | 'Partial';
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  date: string;
  particulars: string;
  referenceType?: string;
  referenceId?: string;
  referenceNo?: string;
  debit: number | null;
  credit: number | null;
  balance: number;
  notes?: string;
  subDetails?: {
    qty?: number;
    rate?: number;
    items?: { name: string; qty: number; unit: string; rate: number; amount: number }[];
    expenses?: { name: string; amount: number }[];
    crateIn?: number;
    crateOut?: number;
  };
}

export interface CrateLedgerEntry {
  id: string;
  date: string;
  particulars: string;
  referenceNo: string;
  crateTypeId?: string;
  crateName: string;
  inQuantity: number;
  outQuantity: number;
  balance: number;
  typeBalance?: number;
  weightKg: number;
  totalKg: number;
}

export interface GeneralSettings {
  businessName: string;
  businessNameHindi?: string;
  mainAccountName: string;
  financialYear: string;
  currencySymbol: string;
  defaultCrateWeightKg: number;
  allowManualAmounts: boolean;
  defaultPaymentMode: string;
}

export interface TrashItem {
  id: string;
  itemType:
    | 'customer'
    | 'fruit'
    | 'vendor'
    | 'creditSale'
    | 'cashSale'
    | 'saleProceeds'
    | 'receipt'
    | 'bill'
    | 'unit'
    | 'crateType';
  itemId: string;
  title: string;
  subtitle?: string;
  data: any;
  relatedTransactions?: any;
  deletedAt: string;
  deletedBy: string;
}
