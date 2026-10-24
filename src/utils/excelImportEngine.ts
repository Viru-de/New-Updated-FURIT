import * as XLSX from 'xlsx';
import { db } from '../services/db';
import {
  Fruit,
  Customer,
  Vendor,
  CashSale,
  CreditSale,
  Receipt,
  SaleProceeds,
  SaleProceedsItem,
  Unit,
  CrateType,
} from '../types';
import { downloadWorkbook, setAutoColumnWidths } from './excelEngine';
import { getFruitEffectivePrice } from './fruitUtils';
import { isCrateUnit, getDefaultCrateSizeForFruit } from './crateUtils';
import { getTodayIso } from './formatters';
import { calculateWholesaleItemAmount } from './billingCalculations';

export type ImportModule =
  | 'fruitMaster'
  | 'customers'
  | 'vendors'
  | 'cashSale'
  | 'creditSale'
  | 'receipts'
  | 'saleProceeds'
  | 'units'
  | 'crates';

export type DuplicateHandlingMode = 'skip' | 'update' | 'insertOnly';

export interface RowValidationResult {
  rowNumber: number;
  status: 'valid' | 'invalid' | 'duplicate';
  errors: string[];
  parsedData: any;
  rawRow: Record<string, any>;
  isDuplicate?: boolean;
}

export interface ImportPreviewSummary {
  module: ImportModule;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  rows: RowValidationResult[];
  detectedColumns: string[];
  mappedColumns: Record<string, string>;
}

export interface ImportExecutionResult {
  totalRows: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  errorsCount: number;
}

/**
 * Normalizes a header string for smart matching.
 * e.g. "Customer Name *" -> "customername", "Price (₹)" -> "price"
 */
export function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Maps standard ERP field aliases.
 */
const FIELD_ALIASES: Record<ImportModule, Record<string, string[]>> = {
  fruitMaster: {
    name: ['itemname', 'fruitname', 'name', 'item', 'productname'],
    unit: ['unit', 'defaultunit', 'uom'],
    price: ['price', 'rate', 'defaultrate', 'cost'],
    crateWeightKg: ['crateweightkg', 'crateweight', 'weightkg', 'weight'],
    active: ['active', 'status', 'isactive'],
  },
  customers: {
    name: ['customername', 'name', 'buyername', 'clientname', 'partyname'],
    mobile: ['phone', 'mobile', 'mobilephone', 'contact', 'cell'],
    city: ['city', 'area', 'town', 'mandi', 'location'],
    address: ['address', 'shopaddress', 'fulladdress'],
    aadhaarNo: ['aadhaarcardno', 'aadhaarno', 'aadhaar', 'adharno'],
    openingBalance: ['openingbalance', 'balance', 'opening', 'ob'],
  },
  vendors: {
    name: ['vendorname', 'name', 'suppliername', 'growername', 'kisan'],
    mobile: ['phone', 'mobile', 'contact'],
    city: ['citymandi', 'city', 'mandi', 'location'],
    address: ['address', 'orchardaddress'],
    openingBalance: ['openingbalance', 'opening', 'ob'],
    commissionRate: ['commissionrate', 'commission', 'comm'],
  },
  cashSale: {
    billNo: ['billno', 'billnumber', 'invoiceno', 'receiptno', 'cashsaleno', 'saleno'],
    date: ['date', 'saledate', 'billdate', 'transactiondate'],
    customerName: ['customername', 'customer', 'buyer', 'party'],
    itemName: ['itemname', 'fruitname', 'item', 'product'],
    quantity: ['quantity', 'qty', 'crates', 'count'],
    unit: ['unit', 'uom'],
    rate: ['rate', 'price', 'rateperunit'],
    expenses: ['expenses', 'hamali', 'freight', 'othercharges'],
    crateOut: ['crateout', 'cratesissued', 'cratesgiven'],
    crateIn: ['cratein', 'cratesrecd', 'cratesreturned'],
    paymentMode: ['paymentmode', 'paymode', 'mode', 'method'],
    notes: ['notes', 'remarks', 'narration'],
  },
  creditSale: {
    billNo: ['billno', 'billnumber', 'invoiceno', 'creditsaleno', 'saleno'],
    date: ['date', 'saledate', 'billdate', 'transactiondate'],
    customerName: ['customername', 'customer', 'buyer', 'party'],
    itemName: ['itemname', 'fruitname', 'item', 'product'],
    quantity: ['quantity', 'qty', 'crates', 'count'],
    unit: ['unit', 'uom'],
    rate: ['rate', 'price', 'rateperunit'],
    expenses: ['expenses', 'hamali', 'freight'],
    crateOut: ['crateout', 'cratesissued', 'cratesgiven'],
    crateIn: ['cratein', 'cratesrecd', 'cratesreturned'],
    notes: ['notes', 'remarks'],
  },
  receipts: {
    receiptNo: ['receiptno', 'receiptnumber', 'voucherno', 'recno'],
    date: ['date', 'receiptdate', 'paymentdate'],
    customerName: ['customername', 'customer', 'party'],
    amount: ['amount', 'amountrecd', 'netamount', 'total'],
    paymentMode: ['paymentmode', 'paymode', 'mode'],
    transactionRef: ['transactionref', 'refno', 'chequeno', 'upiref'],
    notes: ['notes', 'remarks'],
  },
  saleProceeds: {
    proceedsNo: ['proceedsno', 'pattino', 'consignno', 'refno'],
    date: ['date', 'proceedsdate'],
    vendorName: ['vendorname', 'vendor', 'supplier', 'kisan'],
    itemName: ['itemname', 'fruitname', 'item'],
    quantity: ['quantity', 'qty'],
    unit: ['unit', 'uom'],
    kg: ['kg', 'weight', 'weightkg', 'vajan'],
    rate: ['rate', 'price'],
    expenses: ['freighthamali', 'expenses', 'hamali'],
    advancePaid: ['advancepaid', 'advance'],
  },
  units: {
    name: ['unitname', 'name'],
    symbol: ['symbol', 'code'],
    isDefault: ['isdefault', 'default'],
  },
  crates: {
    name: ['cratename', 'name', 'size'],
    defaultWeightKg: ['defaultweightkg', 'weightkg', 'weight'],
    description: ['description', 'desc'],
  },
};

/**
 * Parses raw ArrayBuffer into raw header and row records.
 */
export function parseSpreadsheetBuffer(buffer: ArrayBuffer): {
  headers: string[];
  rows: Record<string, any>[];
  sheetName: string;
} {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  // Find first non-empty sheet (prefer data sheet over instructions)
  let sheetName = wb.SheetNames[0];
  for (const s of wb.SheetNames) {
    if (!s.toLowerCase().includes('instruction')) {
      sheetName = s;
      break;
    }
  }

  const ws = wb.Sheets[sheetName];
  if (!ws) {
    throw new Error('Spreadsheet has no valid sheets to import.');
  }

  // Convert to JSON with headers
  const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, {
    raw: false,
    dateNF: 'yyyy-mm-dd',
  });

  if (!jsonData || jsonData.length === 0) {
    throw new Error('Spreadsheet is empty or has no data rows.');
  }

  const headers = Object.keys(jsonData[0] || {});
  return { headers, rows: jsonData, sheetName };
}

/**
 * Auto-maps incoming spreadsheet headers to standard entity fields.
 */
export function autoMapColumns(module: ImportModule, rawHeaders: string[]): Record<string, string> {
  const aliasMap = FIELD_ALIASES[module] || {};
  const mapping: Record<string, string> = {};

  rawHeaders.forEach((rawH) => {
    const norm = normalizeHeader(rawH);
    for (const [targetField, aliases] of Object.entries(aliasMap)) {
      if (aliases.includes(norm) || norm.includes(targetField.toLowerCase())) {
        mapping[rawH] = targetField;
        break;
      }
    }
  });

  return mapping;
}

/**
 * Validates and parses spreadsheet rows based on target module schema and ERP rules.
 */
export function validateImportRows(
  module: ImportModule,
  rawRows: Record<string, any>[],
  columnMapping: Record<string, string>
): ImportPreviewSummary {
  const results: RowValidationResult[] = [];
  const existingFruits = db.getFruits();
  const existingCustomers = db.getCustomers();
  const existingVendors = db.getVendors();
  const existingCashSales = db.getCashSales();
  const existingCreditSales = db.getCreditSales();
  const existingReceipts = db.getReceipts();
  const existingProceeds = db.getSaleProceeds();
  const existingUnits = db.getUnits();
  const existingCrates = db.getCrateTypes();

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Row 1 is header
    const errors: string[] = [];
    const normalizedRow: Record<string, any> = {};

    // Remap row keys using user column mapping
    Object.entries(row).forEach(([colName, cellVal]) => {
      const targetField = columnMapping[colName];
      if (targetField) {
        normalizedRow[targetField] = typeof cellVal === 'string' ? cellVal.trim() : cellVal;
      }
    });

    let status: 'valid' | 'invalid' | 'duplicate' = 'valid';
    let isDuplicate = false;
    let parsedData: any = null;

    switch (module) {
      /* ---------------- FRUIT MASTER ---------------- */
      case 'fruitMaster': {
        const name = normalizedRow.name || '';
        if (!name) {
          errors.push(`Row ${rowNumber}: Item Name is required.`);
        }

        // Rule: Default price is 1 if empty/missing
        let price = 1;
        if (normalizedRow.price !== undefined && normalizedRow.price !== '') {
          const numPrice = Number(normalizedRow.price);
          if (isNaN(numPrice) || numPrice < 0) {
            errors.push(`Row ${rowNumber}: Price must be a valid positive number or 0.`);
          } else {
            price = numPrice;
          }
        }

        const unit = normalizedRow.unit || 'Crate';
        const weight = Number(normalizedRow.crateWeightKg) || 20;
        const active = String(normalizedRow.active || '').toLowerCase() !== 'no';

        // Duplicate detection by case-insensitive name
        const match = existingFruits.find((f) => f.name.toLowerCase() === name.toLowerCase());
        if (match) {
          isDuplicate = true;
        }

        parsedData = {
          id: match?.id || `f-${Date.now()}-${idx}`,
          name,
          unit,
          defaultUnit: unit,
          defaultRate: price,
          crateWeightKg: weight,
          active,
          createdAt: match?.createdAt || new Date().toISOString(),
        };
        break;
      }

      /* ---------------- CUSTOMERS ---------------- */
      case 'customers': {
        const name = normalizedRow.name || '';
        if (!name) {
          errors.push(`Row ${rowNumber}: Customer Name is required.`);
        }

        const mobile = normalizedRow.mobile ? String(normalizedRow.mobile).replace(/\D/g, '') : '';
        const openingBalance = normalizedRow.openingBalance !== undefined && normalizedRow.openingBalance !== ''
          ? Number(normalizedRow.openingBalance) || 0
          : 0;

        // Duplicate detection by name or mobile
        const match = existingCustomers.find(
          (c) => c.name.toLowerCase() === name.toLowerCase() || (mobile && c.mobile === mobile)
        );
        if (match) {
          isDuplicate = true;
        }

        parsedData = {
          id: match?.id || `c-${Date.now()}-${idx}`,
          name,
          mobile: normalizedRow.mobile || '',
          city: normalizedRow.city || '',
          address: normalizedRow.address || '',
          aadhaarNo: normalizedRow.aadhaarNo ? String(normalizedRow.aadhaarNo) : undefined,
          openingBalance,
          openingBalanceType: 'debit' as const,
          openingCrateBalance: Number(normalizedRow.openingCrateBalance) || 0,
          active: true,
          createdAt: match ? match.createdAt : new Date().toISOString(),
        };
        break;
      }

      /* ---------------- VENDORS ---------------- */
      case 'vendors': {
        const name = normalizedRow.name || '';
        if (!name) {
          errors.push(`Row ${rowNumber}: Vendor Name is required.`);
        }

        const openingBalance = Number(normalizedRow.openingBalance) || 0;
        const commRate = Number(normalizedRow.commissionRate) || 0;

        const match = existingVendors.find((v) => v.name.toLowerCase() === name.toLowerCase());
        if (match) {
          isDuplicate = true;
        }

        parsedData = {
          id: match?.id || `v-${Date.now()}-${idx}`,
          name,
          mobile: normalizedRow.mobile || '',
          city: normalizedRow.city || '',
          address: normalizedRow.address || '',
          openingBalance,
          commissionRate: commRate,
        };
        break;
      }

      /* ---------------- CASH SALE / CREDIT SALE ---------------- */
      case 'cashSale':
      case 'creditSale': {
        const isCash = module === 'cashSale';
        const billNo = normalizedRow.billNo || '';
        const date = normalizedRow.date || '';
        const custName = normalizedRow.customerName || '';
        const itemName = normalizedRow.itemName || '';
        const qty = Number(normalizedRow.quantity);
        const rate = Number(normalizedRow.rate);

        if (!billNo) errors.push(`Row ${rowNumber}: Bill Number is required.`);
        if (!date || isNaN(Date.parse(date))) errors.push(`Row ${rowNumber}: Invalid transaction date.`);
        if (!custName) errors.push(`Row ${rowNumber}: Customer Name is required.`);
        if (!itemName) errors.push(`Row ${rowNumber}: Item Name is required.`);
        if (isNaN(qty) || qty <= 0) errors.push(`Row ${rowNumber}: Quantity must be greater than 0.`);
        if (isNaN(rate) || rate < 0) errors.push(`Row ${rowNumber}: Rate must be a valid number.`);

        // Resolve customer
        let cust = existingCustomers.find((c) => c.name.toLowerCase() === custName.toLowerCase() || c.id === custName);
        if (!cust && custName) {
          // Will be auto-created upon import
        }

        // Resolve fruit item
        const fruit = existingFruits.find((f) => f.name.toLowerCase() === itemName.toLowerCase() || f.id === itemName);
        const effectiveUnit = normalizedRow.unit || fruit?.unit || fruit?.defaultUnit || 'Crate';
        const effectiveRate = !isNaN(rate) ? rate : getFruitEffectivePrice(fruit);
        const lineAmount = calculateWholesaleItemAmount(qty, effectiveUnit, normalizedRow.kg, effectiveRate);

        // Duplicate check
        const match = isCash
          ? existingCashSales.find((s) => s.cashSaleNo.toLowerCase() === billNo.toLowerCase())
          : existingCreditSales.find((s) => s.creditSaleNo.toLowerCase() === billNo.toLowerCase());
        if (match) {
          isDuplicate = true;
        }

        parsedData = {
          billNo,
          date,
          customerName: custName,
          customerId: cust?.id || '',
          itemName,
          fruitId: fruit?.id || '',
          quantity: qty,
          unit: effectiveUnit,
          kg: normalizedRow.kg !== undefined && normalizedRow.kg !== '' ? Number(normalizedRow.kg) : undefined,
          rate: effectiveRate,
          amount: lineAmount,
          expenses: Number(normalizedRow.expenses) || 0,
          crateOut: Number(normalizedRow.crateOut) || 0,
          crateIn: Number(normalizedRow.crateIn) || 0,
          paymentMode: normalizedRow.paymentMode || 'Cash',
          notes: normalizedRow.notes || '',
        };
        break;
      }

      /* ---------------- RECEIPTS ---------------- */
      case 'receipts': {
        const receiptNo = normalizedRow.receiptNo || '';
        const date = normalizedRow.date || '';
        const custName = normalizedRow.customerName || '';
        const amount = Number(normalizedRow.amount);

        if (!receiptNo) errors.push(`Row ${rowNumber}: Receipt Number is required.`);
        if (!date || isNaN(Date.parse(date))) errors.push(`Row ${rowNumber}: Invalid date format.`);
        if (!custName) errors.push(`Row ${rowNumber}: Customer Name is required.`);
        if (isNaN(amount) || amount <= 0) errors.push(`Row ${rowNumber}: Amount must be a positive number.`);

        const match = existingReceipts.find((r) => r.receiptNo.toLowerCase() === receiptNo.toLowerCase());
        if (match) {
          isDuplicate = true;
        }

        const cust = existingCustomers.find((c) => c.name.toLowerCase() === custName.toLowerCase());

        parsedData = {
          id: match?.id || `r-${Date.now()}-${idx}`,
          receiptNo,
          date,
          customerId: cust?.id || '',
          customerName: custName,
          amount,
          paymentMode: normalizedRow.paymentMode || 'Cash',
          transactionRef: normalizedRow.transactionRef || '',
          notes: normalizedRow.notes || '',
        };
        break;
      }

      /* ---------------- SALE PROCEEDS ---------------- */
      case 'saleProceeds': {
        const proceedsNo = normalizedRow.proceedsNo || '';
        const date = normalizedRow.date || '';
        const vendorName = normalizedRow.vendorName || '';
        const itemName = normalizedRow.itemName || '';
        const qty = Number(normalizedRow.quantity);
        const rate = Number(normalizedRow.rate);

        if (!proceedsNo) errors.push(`Row ${rowNumber}: Proceeds No. is required.`);
        if (!date || isNaN(Date.parse(date))) errors.push(`Row ${rowNumber}: Invalid date.`);
        if (!vendorName) errors.push(`Row ${rowNumber}: Vendor Name is required.`);
        if (!itemName) errors.push(`Row ${rowNumber}: Item Name is required.`);
        if (isNaN(qty) || qty <= 0) errors.push(`Row ${rowNumber}: Quantity must be greater than 0.`);
        if (isNaN(rate) || rate < 0) errors.push(`Row ${rowNumber}: Rate must be a valid number.`);

        const match = existingProceeds.find((sp) => sp.proceedsNo.toLowerCase() === proceedsNo.toLowerCase());
        if (match) {
          isDuplicate = true;
        }

        const vendor = existingVendors.find((v) => v.name.toLowerCase() === vendorName.toLowerCase());
        const fruit = existingFruits.find((f) => f.name.toLowerCase() === itemName.toLowerCase());

        const spWeight = normalizedRow.kg !== undefined && normalizedRow.kg !== ''
          ? Number(normalizedRow.kg)
          : (normalizedRow.weight !== undefined && normalizedRow.weight !== '' ? Number(normalizedRow.weight) : 0);
        const spUnit = normalizedRow.unit || fruit?.unit || 'Crate';
        const spAmount = calculateWholesaleItemAmount(qty, spUnit, spWeight, rate);

        parsedData = {
          proceedsNo,
          date,
          vendorName,
          vendorId: vendor?.id || '',
          itemName,
          fruitId: fruit?.id || '',
          quantity: qty,
          unit: spUnit,
          kg: spWeight > 0 ? spWeight : 0,
          rate,
          amount: spAmount,
          expenses: Number(normalizedRow.expenses) || 0,
          advancePaid: Number(normalizedRow.advancePaid) || 0,
        };
        break;
      }

      /* ---------------- UNITS & CRATES ---------------- */
      case 'units': {
        const name = normalizedRow.name || '';
        const symbol = normalizedRow.symbol || '';
        if (!name) errors.push(`Row ${rowNumber}: Unit Name is required.`);
        if (!symbol) errors.push(`Row ${rowNumber}: Unit Symbol is required.`);

        const match = existingUnits.find((u) => u.name.toLowerCase() === name.toLowerCase() || u.symbol.toLowerCase() === symbol.toLowerCase());
        if (match) isDuplicate = true;

        parsedData = {
          id: match?.id || `u-${Date.now()}-${idx}`,
          name,
          symbol,
          isDefault: String(normalizedRow.isDefault).toLowerCase() === 'yes',
        };
        break;
      }

      case 'crates': {
        const name = normalizedRow.name || '';
        const weight = Number(normalizedRow.defaultWeightKg);
        if (!name) errors.push(`Row ${rowNumber}: Crate Name is required.`);
        if (isNaN(weight) || weight <= 0) errors.push(`Row ${rowNumber}: Weight must be greater than 0.`);

        const match = existingCrates.find((c) => c.name.toLowerCase() === name.toLowerCase());
        if (match) isDuplicate = true;

        parsedData = {
          id: match?.id || `ct-${Date.now()}-${idx}`,
          name,
          defaultWeightKg: weight || 20,
          description: normalizedRow.description || `${weight} Kg crate size`,
        };
        break;
      }
    }

    if (errors.length > 0) {
      status = 'invalid';
    } else if (isDuplicate) {
      status = 'duplicate';
    } else {
      status = 'valid';
    }

    results.push({
      rowNumber,
      status,
      errors,
      parsedData,
      rawRow: row,
      isDuplicate,
    });
  });

  const validCount = results.filter((r) => r.status === 'valid').length;
  const invalidCount = results.filter((r) => r.status === 'invalid').length;
  const duplicateCount = results.filter((r) => r.status === 'duplicate').length;

  return {
    module,
    totalRows: results.length,
    validCount,
    invalidCount,
    duplicateCount,
    rows: results,
    detectedColumns: Object.keys(rawRows[0] || {}),
    mappedColumns: columnMapping,
  };
}

/**
 * Generates and downloads a dedicated Excel Error Report for rows that failed validation.
 */
export function downloadImportErrorReport(summary: ImportPreviewSummary) {
  const invalidRows = summary.rows.filter((r) => r.status === 'invalid');
  if (invalidRows.length === 0) return;

  const rawKeys = summary.detectedColumns;
  const headers = ['Row Number', 'Errors', ...rawKeys];

  const rows = invalidRows.map((r) => [
    r.rowNumber,
    r.errors.join('; '),
    ...rawKeys.map((k) => r.rawRow[k] ?? ''),
  ]);

  const wsData = [
    [`HARI KRIPA FRUIT ERP — IMPORT VALIDATION ERROR REPORT (${summary.module.toUpperCase()})`],
    [`Export Date: ${getTodayIso()} | Total Errors: ${invalidRows.length}`],
    ['Fix the reported errors in your file and re-import.'],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Errors');
  downloadWorkbook(wb, `Hari_Kripa_Import_Errors_${summary.module}_${getTodayIso()}.xlsx`);
}

/**
 * Commits validated records to db.ts respecting the chosen DuplicateHandlingMode.
 */
export function commitImportBatch(
  summary: ImportPreviewSummary,
  dupMode: DuplicateHandlingMode
): ImportExecutionResult {
  let insertedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorsCount = 0;

  const validAndDuplicateRows = summary.rows.filter((r) => r.status !== 'invalid');
  errorsCount = summary.rows.filter((r) => r.status === 'invalid').length;

  switch (summary.module) {
    case 'fruitMaster': {
      const current = db.getFruits();
      validAndDuplicateRows.forEach((r) => {
        const item: Fruit = r.parsedData;
        const existingIdx = current.findIndex((f) => f.name.toLowerCase() === item.name.toLowerCase());

        if (existingIdx >= 0) {
          if (dupMode === 'skip' || dupMode === 'insertOnly') {
            skippedCount++;
          } else if (dupMode === 'update') {
            current[existingIdx] = { ...current[existingIdx], ...item, id: current[existingIdx].id };
            updatedCount++;
          }
        } else {
          current.push(item);
          insertedCount++;
        }
      });
      // Save all
      current.forEach((f) => db.saveFruit(f));
      break;
    }

    case 'customers': {
      const current = db.getCustomers();
      validAndDuplicateRows.forEach((r) => {
        const item: Customer = r.parsedData;
        const existingIdx = current.findIndex(
          (c) => c.name.toLowerCase() === item.name.toLowerCase() || (item.mobile && c.mobile === item.mobile)
        );

        if (existingIdx >= 0) {
          if (dupMode === 'skip' || dupMode === 'insertOnly') {
            skippedCount++;
          } else if (dupMode === 'update') {
            current[existingIdx] = { ...current[existingIdx], ...item, id: current[existingIdx].id };
            updatedCount++;
          }
        } else {
          current.push(item);
          insertedCount++;
        }
      });
      current.forEach((c) => db.saveCustomer(c));
      break;
    }

    case 'vendors': {
      const current = db.getVendors();
      validAndDuplicateRows.forEach((r) => {
        const item: Vendor = r.parsedData;
        const existingIdx = current.findIndex((v) => v.name.toLowerCase() === item.name.toLowerCase());

        if (existingIdx >= 0) {
          if (dupMode === 'skip' || dupMode === 'insertOnly') {
            skippedCount++;
          } else if (dupMode === 'update') {
            current[existingIdx] = { ...current[existingIdx], ...item, id: current[existingIdx].id };
            updatedCount++;
          }
        } else {
          current.push(item);
          insertedCount++;
        }
      });
      current.forEach((v) => db.saveVendor(v));
      break;
    }

    case 'cashSale':
    case 'creditSale': {
      const isCash = summary.module === 'cashSale';
      // Group multi-item rows by Bill No!
      const groupedByBill: Record<string, typeof validAndDuplicateRows> = {};
      validAndDuplicateRows.forEach((r) => {
        const bNo = r.parsedData.billNo;
        if (!groupedByBill[bNo]) groupedByBill[bNo] = [];
        groupedByBill[bNo].push(r);
      });

      const existingSales = isCash ? db.getCashSales() : db.getCreditSales();
      const existingCustomers = db.getCustomers();
      const existingFruits = db.getFruits();

      Object.entries(groupedByBill).forEach(([billNo, rows]) => {
        const first = rows[0].parsedData;
        const isExisting = isCash
          ? (existingSales as CashSale[]).some((s) => s.cashSaleNo.toLowerCase() === billNo.toLowerCase())
          : (existingSales as CreditSale[]).some((s) => s.creditSaleNo.toLowerCase() === billNo.toLowerCase());

        if (isExisting) {
          if (dupMode === 'skip' || dupMode === 'insertOnly') {
            skippedCount += rows.length;
            return;
          }
        }

        // Ensure customer exists or auto-create customer
        let cust = existingCustomers.find(
          (c) => c.name.toLowerCase() === first.customerName.toLowerCase() || c.id === first.customerId
        );
        if (!cust) {
          const newCust: Customer = {
            id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: first.customerName,
            mobile: '',
            openingBalance: 0,
            openingBalanceType: 'debit',
            openingCrateBalance: 0,
            active: true,
            createdAt: new Date().toISOString(),
          };
          db.saveCustomer(newCust);
          existingCustomers.push(newCust);
          cust = newCust;
        }

        // Build line items
        const lineItems = rows.map((r, rIdx) => {
          const itData = r.parsedData;
          let fr = existingFruits.find((f) => f.name.toLowerCase() === itData.itemName.toLowerCase() || f.id === itData.fruitId);
          if (!fr) {
            const newFruit: Fruit = {
              id: `f-${Date.now()}-${rIdx}`,
              name: itData.itemName,
              unit: itData.unit || 'Crate',
              defaultUnit: itData.unit || 'Crate',
              defaultRate: itData.rate || 0,
              crateWeightKg: 20,
              active: true,
              createdAt: new Date().toISOString(),
            };
            db.saveFruit(newFruit);
            existingFruits.push(newFruit);
            fr = newFruit;
          }

          const isCrate = isCrateUnit(itData.unit);
          return {
            id: `bi-${Date.now()}-${rIdx}`,
            fruitId: fr.id,
            fruitName: fr.name,
            quantity: itData.quantity,
            unit: itData.unit,
            kg: itData.kg,
            rate: itData.rate,
            amount: itData.amount,
            crateSize: isCrate ? getDefaultCrateSizeForFruit(fr) : undefined,
          };
        });

        const productTotal = lineItems.reduce((sum, it) => sum + (it.amount || 0), 0);
        const expenseTotal = first.expenses || 0;
        const finalAmount = productTotal + expenseTotal;

        if (isCash) {
          const cashSale: CashSale = {
            id: `cash-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            cashSaleNo: billNo,
            sequenceNumber: db.getNextCashSaleNumber(),
            date: first.date,
            customerId: cust.id,
            customerName: cust.name,
            items: lineItems,
            crateIn: first.crateIn || 0,
            crateOut: first.crateOut || 0,
            crateWeightKg: 20,
            expenses: expenseTotal > 0 ? [{ id: 'exp-1', name: 'Freight & Hamali', amount: expenseTotal }] : [],
            productTotal,
            expenseTotal,
            totalAmount: finalAmount,
            finalAmount,
            paymentMode: first.paymentMode || 'Cash',
            paymentStatus: 'Paid',
            receivedAmount: finalAmount,
            notes: first.notes || '',
            createdAt: new Date().toISOString(),
          };
          db.saveCashSale(cashSale);
        } else {
          const creditSale: CreditSale = {
            id: `cs-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            creditSaleNo: billNo,
            sequenceNumber: db.getNextCreditSaleNumber(),
            customerId: cust.id,
            customerName: cust.name,
            date: first.date,
            items: lineItems,
            crateIn: first.crateIn || 0,
            crateOut: first.crateOut || 0,
            crateWeightKg: 20,
            expenses: expenseTotal > 0 ? [{ id: 'exp-1', name: 'Freight & Hamali', amount: expenseTotal }] : [],
            productTotal,
            expenseTotal,
            totalDebit: finalAmount,
            finalAmount,
            notes: first.notes || '',
            createdAt: new Date().toISOString(),
          };
          db.saveCreditSale(creditSale);
        }

        if (isExisting) {
          updatedCount += rows.length;
        } else {
          insertedCount += rows.length;
        }
      });
      break;
    }

    case 'receipts': {
      const existing = db.getReceipts();
      const existingCustomers = db.getCustomers();

      validAndDuplicateRows.forEach((r) => {
        const item = r.parsedData;
        const isExisting = existing.some((ex) => ex.receiptNo.toLowerCase() === item.receiptNo.toLowerCase());

        if (isExisting && (dupMode === 'skip' || dupMode === 'insertOnly')) {
          skippedCount++;
          return;
        }

        let cust = existingCustomers.find((c) => c.name.toLowerCase() === item.customerName.toLowerCase() || c.id === item.customerId);
        if (!cust) {
          const newCust: Customer = {
            id: `c-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: item.customerName,
            mobile: '',
            openingBalance: 0,
            openingBalanceType: 'debit',
            openingCrateBalance: 0,
            active: true,
            createdAt: new Date().toISOString(),
          };
          db.saveCustomer(newCust);
          existingCustomers.push(newCust);
          cust = newCust;
        }

        const receipt: Receipt = {
          id: item.id || `r-${Date.now()}`,
          receiptNo: item.receiptNo,
          sequenceNumber: db.getNextReceiptNumber(),
          date: item.date,
          customerId: cust.id,
          customerName: cust.name,
          amount: item.amount,
          paymentMode: item.paymentMode || 'Cash',
          notes: item.transactionRef ? `Ref: ${item.transactionRef} | ${item.notes || ''}`.trim() : (item.notes || ''),
          createdAt: new Date().toISOString(),
        };

        db.saveReceipt(receipt);
        if (isExisting) updatedCount++;
        else insertedCount++;
      });
      break;
    }

    case 'saleProceeds': {
      const existing = db.getSaleProceeds();
      const existingVendors = db.getVendors();
      const existingFruits = db.getFruits();

      // Group by Proceeds No
      const groupedByProceeds: Record<string, typeof validAndDuplicateRows> = {};
      validAndDuplicateRows.forEach((r) => {
        const pNo = r.parsedData.proceedsNo;
        if (!groupedByProceeds[pNo]) groupedByProceeds[pNo] = [];
        groupedByProceeds[pNo].push(r);
      });

      Object.entries(groupedByProceeds).forEach(([procNo, rows]) => {
        const first = rows[0].parsedData;
        const isExisting = existing.some((sp) => sp.proceedsNo.toLowerCase() === procNo.toLowerCase());

        if (isExisting && (dupMode === 'skip' || dupMode === 'insertOnly')) {
          skippedCount += rows.length;
          return;
        }

        let vendor = existingVendors.find((v) => v.name.toLowerCase() === first.vendorName.toLowerCase() || v.id === first.vendorId);
        if (!vendor) {
          const newVendor: Vendor = {
            id: `v-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            name: first.vendorName,
            contact: '',
            openingBalance: 0,
            openingBalanceType: 'credit',
            active: true,
            createdAt: new Date().toISOString(),
          };
          db.saveVendor(newVendor);
          existingVendors.push(newVendor);
          vendor = newVendor;
        }

        const lineItems: SaleProceedsItem[] = rows.map((r, rIdx) => {
          const it = r.parsedData;
          let fr = existingFruits.find((f) => f.name.toLowerCase() === it.itemName.toLowerCase() || f.id === it.fruitId);
          if (!fr) {
            const newFr: Fruit = {
              id: `f-${Date.now()}-${rIdx}`,
              name: it.itemName,
              unit: it.unit || 'Crate',
              defaultUnit: it.unit || 'Crate',
              defaultRate: it.rate || 0,
              crateWeightKg: 20,
              active: true,
              createdAt: new Date().toISOString(),
            };
            db.saveFruit(newFr);
            existingFruits.push(newFr);
            fr = newFr;
          }

          return {
            id: `spi-${Date.now()}-${rIdx}`,
            fruitId: fr.id,
            fruitName: fr.name,
            quantity: it.quantity,
            unit: it.unit,
            rate: it.rate,
            amount: it.amount,
          };
        });

        const grossTotal = lineItems.reduce((sum, it) => sum + (it.amount || 0), 0);
        const expTotal = first.expenses || 0;
        const netPayable = grossTotal - expTotal;

        const sp: SaleProceeds = {
          id: `sp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          proceedsNo: procNo,
          sequenceNumber: db.getNextSaleProceedsNumber(),
          date: first.date,
          challanDate: first.date,
          vendorId: vendor.id,
          vendorName: vendor.name,
          items: lineItems,
          quantity: lineItems.reduce((s, it) => s + (it.quantity || 0), 0),
          unit: lineItems[0]?.unit || 'Crate',
          rate: lineItems[0]?.rate || 0,
          amount: grossTotal,
          expenses: expTotal > 0 ? [{ id: 'e-1', name: 'Freight & Mandi Charges', amount: expTotal }] : [],
          totalExpense: expTotal,
          netAmount: netPayable,
          difference: 0,
          notes: first.notes || '',
          createdAt: new Date().toISOString(),
        };

        db.saveSaleProceeds(sp);
        if (isExisting) updatedCount += rows.length;
        else insertedCount += rows.length;
      });
      break;
    }

    case 'units': {
      validAndDuplicateRows.forEach((r) => {
        db.saveUnit(r.parsedData);
        if (r.isDuplicate) updatedCount++;
        else insertedCount++;
      });
      break;
    }

    case 'crates': {
      validAndDuplicateRows.forEach((r) => {
        db.saveCrateType(r.parsedData);
        if (r.isDuplicate) updatedCount++;
        else insertedCount++;
      });
      break;
    }
  }

  return {
    totalRows: summary.totalRows,
    insertedCount,
    updatedCount,
    skippedCount,
    errorsCount,
  };
}
