import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { db } from '../services/db';
import {
  Fruit,
  Customer,
  Vendor,
  CashSale,
  CreditSale,
  SaleProceeds,
  Receipt,
  Unit,
  CrateType,
  CompanyProfile,
  Bill,
} from '../types';
import { formatDate, formatCurrency, getTodayIso } from './formatters';
import { maskAadhaar } from './aadhaarUtils';
import { getCustomerLedger, getSaleProceedsLedger, getCustomerCrateStatement } from '../services/accounting';

/**
 * Sanitizes cell values to prevent CSV / Excel formula injection.
 * Prepends a single quote if the text begins with =, +, -, @, \t, or \r.
 */
export function sanitizeCellValue(val: any): any {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (/^[=+\-@\t\r]/.test(trimmed)) {
      return `'${val}`;
    }
  }
  return val;
}

/**
 * Triggers a client-side download of a binary Blob.
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates and downloads a real .xlsx workbook.
 */
export function downloadWorkbook(wb: XLSX.WorkBook, fileName: string) {
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadBlob(blob, fileName);
}

/**
 * Automatically calculates suitable column widths for an XLSX worksheet.
 */
export function setAutoColumnWidths(ws: XLSX.WorkSheet, data: any[][]) {
  if (!data || data.length === 0) return;
  const colWidths = data[0].map((_, colIndex) => {
    let maxLen = 10;
    data.forEach((row) => {
      const cellVal = row[colIndex];
      if (cellVal !== undefined && cellVal !== null) {
        const str = String(cellVal);
        if (str.length > maxLen) {
          maxLen = Math.min(str.length, 50);
        }
      }
    });
    return { wch: maxLen + 3 };
  });
  ws['!cols'] = colWidths;
}

/* ========================================================================== */
/* EXPORT FUNCTIONS FOR INDIVIDUAL ERP MODULES                               */
/* ========================================================================== */

// 1. Fruit / Item Master
export function exportFruitMaster(records?: Fruit[], fileNameSuffix = '') {
  const items = records || db.getFruits();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Fruit_Master_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Item ID',
    'Item Name',
    'Default Unit',
    'Price (₹)',
    'Crate Weight (Kg)',
    'Status',
    'Created At',
  ];

  const rows = items.map((f) => [
    sanitizeCellValue(f.id),
    sanitizeCellValue(f.name),
    sanitizeCellValue(f.unit || f.defaultUnit || 'Crate'),
    typeof f.defaultRate === 'number' ? f.defaultRate : 1,
    f.crateWeightKg || 20,
    f.active ? 'Active' : 'Inactive',
    f.createdAt ? formatDate(f.createdAt) : '',
  ]);

  const wsData = [
    ['HARI KRIPA FRUIT ERP — FRUIT / ITEM MASTER CATALOG'],
    [`Export Date: ${formatDate(dateStr)} | Total Records: ${items.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fruit Master');
  downloadWorkbook(wb, fileName);
}

// 2. Customer Master
export function exportCustomers(records?: Customer[], fileNameSuffix = '') {
  const customers = records || db.getCustomers();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Customers_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Customer ID',
    'Customer Name',
    'Mobile / Phone',
    'City / Area',
    'Address',
    'Aadhaar Card No. (Masked)',
    'Opening Balance (₹)',
    'Current Balance (₹)',
    'Balance Crates',
  ];

  const rows = customers.map((c) => {
    let curBal = 0;
    let balCrates = 0;
    try {
      curBal = getCustomerLedger(c.id).closingBalance;
      balCrates = getCustomerCrateStatement(c.id).closingCrates;
    } catch {
      curBal = c.openingBalance || 0;
      balCrates = c.openingCrateBalance || 0;
    }
    return [
      sanitizeCellValue(c.id),
      sanitizeCellValue(c.name),
      sanitizeCellValue(c.mobile || ''),
      sanitizeCellValue(c.city || ''),
      sanitizeCellValue(c.address || ''),
      c.aadhaarNo ? maskAadhaar(c.aadhaarNo) : '',
      c.openingBalance || 0,
      curBal,
      balCrates,
    ];
  });

  const wsData = [
    ['HARI KRIPA FRUIT ERP — CUSTOMER DIRECTORY'],
    [`Export Date: ${formatDate(dateStr)} | Total Customers: ${customers.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  downloadWorkbook(wb, fileName);
}

// 3. Vendor / Wholesale Directory
export function exportVendors(records?: Vendor[], fileNameSuffix = '') {
  const vendors = records || db.getVendors();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Vendors_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Vendor ID',
    'Vendor Name',
    'Mobile / Phone',
    'City / Mandi',
    'Address',
    'Opening Balance (₹)',
    'Commission Rate (%)',
  ];

  const rows = vendors.map((v) => [
    sanitizeCellValue(v.id),
    sanitizeCellValue(v.name),
    sanitizeCellValue(v.contact || ''),
    sanitizeCellValue(v.city || ''),
    sanitizeCellValue(v.address || ''),
    v.openingBalance || 0,
    (v as any).commissionRate || 0,
  ]);

  const wsData = [
    ['HARI KRIPA FRUIT ERP — VENDOR & WHOLESALE DIRECTORY'],
    [`Export Date: ${formatDate(dateStr)} | Total Vendors: ${vendors.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Vendors');
  downloadWorkbook(wb, fileName);
}

// 4. Cash Sales
export function exportCashSales(records?: CashSale[], fileNameSuffix = '') {
  const sales = records || db.getCashSales();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Cash_Sales_${dateStr}${fileNameSuffix}.xlsx`;

  // Multi-row support per bill
  const headers = [
    'Bill No.',
    'Date',
    'Customer ID',
    'Customer Name',
    'Payment Mode',
    'Item Name',
    'Quantity',
    'Unit',
    'Rate (₹)',
    'Amount (₹)',
    'Expenses (₹)',
    'Crate In',
    'Crate Out',
    'Net Bill Amount (₹)',
    'Notes',
  ];

  const rows: any[][] = [];
  sales.forEach((s) => {
    const items = s.items && s.items.length > 0 ? s.items : [{ fruitName: '', quantity: 1, unit: '', rate: 0, amount: s.productTotal || 0 }];
    items.forEach((it, idx) => {
      rows.push([
        sanitizeCellValue(s.cashSaleNo),
        formatDate(s.date),
        sanitizeCellValue(s.customerId),
        sanitizeCellValue(s.customerName),
        sanitizeCellValue(s.paymentMode || 'Cash'),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.rate,
        it.amount,
        idx === 0 ? s.expenseTotal || 0 : '',
        idx === 0 ? s.crateIn || 0 : '',
        idx === 0 ? s.crateOut || 0 : '',
        idx === 0 ? s.finalAmount : '',
        idx === 0 ? sanitizeCellValue(s.notes || '') : '',
      ]);
    });
  });

  const wsData = [
    ['HARI KRIPA FRUIT ERP — CASH SALES TRANSACTIONS'],
    [`Export Date: ${formatDate(dateStr)} | Total Bills: ${sales.length} | Line Rows: ${rows.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cash Sales');
  downloadWorkbook(wb, fileName);
}

// 5. Credit Sales
export function exportCreditSales(records?: CreditSale[], fileNameSuffix = '') {
  const sales = records || db.getCreditSales();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Credit_Sales_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Bill No.',
    'Date',
    'Customer ID',
    'Customer Name',
    'Item Name',
    'Quantity',
    'Unit',
    'Kg',
    'Rate (₹)',
    'Amount (₹)',
    'Expenses (₹)',
    'Crate In',
    'Crate Out',
    'Net Bill Amount (₹)',
    'Notes',
  ];

  const rows: any[][] = [];
  sales.forEach((s) => {
    const items = s.items && s.items.length > 0 ? s.items : [{ fruitName: '', quantity: 1, unit: '', rate: 0, amount: s.productTotal || 0, kg: 0 }];
    items.forEach((it, idx) => {
      rows.push([
        sanitizeCellValue(s.creditSaleNo),
        formatDate(s.date),
        sanitizeCellValue(s.customerId),
        sanitizeCellValue(s.customerName),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.kg !== undefined ? it.kg : '',
        it.rate,
        it.amount,
        idx === 0 ? s.expenseTotal || 0 : '',
        idx === 0 ? s.crateIn || 0 : '',
        idx === 0 ? s.crateOut || 0 : '',
        idx === 0 ? s.finalAmount : '',
        idx === 0 ? sanitizeCellValue(s.notes || '') : '',
      ]);
    });
  });

  const wsData = [
    ['HARI KRIPA FRUIT ERP — CREDIT SALES TRANSACTIONS'],
    [`Export Date: ${formatDate(dateStr)} | Total Bills: ${sales.length} | Line Rows: ${rows.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Credit Sales');
  downloadWorkbook(wb, fileName);
}

// 6. Sale Proceeds (Consignment Sales)
export function exportSaleProceeds(records?: SaleProceeds[], fileNameSuffix = '') {
  const list = records || db.getSaleProceeds();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Sale_Proceeds_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Proceeds No.',
    'Date',
    'Vendor ID',
    'Vendor Name',
    'Item Name',
    'Quantity',
    'Unit',
    'Rate (₹)',
    'Gross Total (₹)',
    'Expenses (₹)',
    'Advance Paid (₹)',
    'Net Payable (₹)',
  ];

  const rows: any[][] = [];
  list.forEach((sp) => {
    const items = sp.items && sp.items.length > 0 ? sp.items : [{ fruitName: '', quantity: sp.quantity || 1, unit: sp.unit || '', rate: sp.rate || 0, amount: sp.amount || 0 }];
    items.forEach((it, idx) => {
      rows.push([
        sanitizeCellValue(sp.proceedsNo),
        formatDate(sp.date),
        sanitizeCellValue(sp.vendorId || ''),
        sanitizeCellValue(sp.vendorName || ''),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.rate,
        idx === 0 ? sp.amount : '',
        idx === 0 ? sp.totalExpense : '',
        idx === 0 ? 0 : '',
        idx === 0 ? sp.netAmount : '',
      ]);
    });
  });

  const wsData = [
    ['HARI KRIPA FRUIT ERP — SALE PROCEEDS (CONSIGNMENT SALES)'],
    [`Export Date: ${formatDate(dateStr)} | Total Records: ${list.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sale Proceeds');
  downloadWorkbook(wb, fileName);
}

// 7. Receipts / Cash A/C
export function exportReceipts(records?: Receipt[], fileNameSuffix = '') {
  const list = records || db.getReceipts();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Cash_Receipts_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Receipt No.',
    'Date',
    'Customer ID',
    'Customer Name',
    'Amount (₹)',
    'Payment Mode',
    'Transaction Ref',
    'Notes',
  ];

  const rows = list.map((r) => [
    sanitizeCellValue(r.receiptNo),
    formatDate(r.date),
    sanitizeCellValue(r.customerId),
    sanitizeCellValue(r.customerName),
    r.amount,
    sanitizeCellValue(r.paymentMode || 'Cash'),
    sanitizeCellValue((r as any).transactionRef || ''),
    sanitizeCellValue(r.notes || ''),
  ]);

  const wsData = [
    ['HARI KRIPA FRUIT ERP — CASH & BANK RECEIPTS'],
    [`Export Date: ${formatDate(dateStr)} | Total Receipts: ${list.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cash Receipts');
  downloadWorkbook(wb, fileName);
}

// 8. Customer Ledger (Single or All)
export function exportCustomerLedger(customerId?: string, fileNameSuffix = '') {
  const customers = db.getCustomers();
  const targetCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
  const dateStr = getTodayIso();

  if (targetCustomer) {
    const ledger = getCustomerLedger(targetCustomer.id);
    const fileName = `Hari_Kripa_Customer_Ledger_${targetCustomer.name.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

    const headers = [
      'Date',
      'Voucher / Bill No.',
      'Particulars',
      'Debit (₹)',
      'Credit (₹)',
      'Running Balance (₹)',
      'Crate In',
      'Crate Out',
      'Balance Crates',
    ];

    const rows = ledger.entries.map((e) => [
      formatDate(e.date),
      sanitizeCellValue(e.referenceNo || ''),
      sanitizeCellValue(e.particulars),
      e.debit ? e.debit : '',
      e.credit ? e.credit : '',
      e.balance,
      e.subDetails?.crateIn || '',
      e.subDetails?.crateOut || '',
      '',
    ]);

    const wsData = [
      [`HARI KRIPA FRUIT ERP — CUSTOMER STATEMENT: ${targetCustomer.name.toUpperCase()}`],
      [`Mobile: ${targetCustomer.mobile || 'N/A'} | City: ${targetCustomer.city || 'N/A'} | Export Date: ${formatDate(dateStr)}`],
      [`Opening Balance: ₹${targetCustomer.openingBalance} | Total Debit: ₹${ledger.totalDebit} | Total Credit: ₹${ledger.totalCredit} | Closing Balance: ₹${ledger.closingBalance}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Ledger');
    downloadWorkbook(wb, fileName);
  } else {
    // Consolidated all customer ledgers
    const fileName = `Hari_Kripa_All_Customer_Ledgers_${dateStr}${fileNameSuffix}.xlsx`;
    const headers = [
      'Customer ID',
      'Customer Name',
      'Mobile',
      'Opening Balance (₹)',
      'Total Debit / Sales (₹)',
      'Total Credit / Receipts (₹)',
      'Closing Outstanding (₹)',
      'Balance Crates',
    ];

    const rows = customers.map((c) => {
      const l = getCustomerLedger(c.id);
      return [
        sanitizeCellValue(c.id),
        sanitizeCellValue(c.name),
        sanitizeCellValue(c.mobile || ''),
        c.openingBalance,
        l.totalDebit,
        l.totalCredit,
        l.closingBalance,
        c.openingCrateBalance,
      ];
    });

    const wsData = [
      ['HARI KRIPA FRUIT ERP — CONSOLIDATED CUSTOMER BALANCES & OUTSTANDINGS'],
      [`Export Date: ${formatDate(dateStr)} | Total Customers: ${customers.length}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Customer Summary');
    downloadWorkbook(wb, fileName);
  }
}

// 9. Sale Proceeds Ledger / Vendor Consignment Ledger
export function exportSaleProceedsLedger(vendorId?: string, fileNameSuffix = '') {
  const vendors = db.getVendors();
  const dateStr = getTodayIso();
  const targetVendor = vendorId ? vendors.find((v) => v.id === vendorId) : null;

  if (targetVendor) {
    const ledger = getSaleProceedsLedger();
    const fileName = `Hari_Kripa_Vendor_Ledger_${targetVendor.name.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

    const headers = [
      'Date',
      'Voucher / Bill No.',
      'Particulars',
      'Debit (₹)',
      'Credit (₹)',
      'Running Balance (₹)',
    ];

    const rows = ledger.entries.map((e) => [
      formatDate(e.date),
      sanitizeCellValue(e.referenceNo || ''),
      sanitizeCellValue(e.particulars),
      e.debit || '',
      e.credit || '',
      e.balance,
    ]);

    const wsData = [
      [`HARI KRIPA FRUIT ERP — VENDOR CONSIGNMENT STATEMENT: ${targetVendor.name.toUpperCase()}`],
      [`Mobile: ${targetVendor.contact || 'N/A'} | Mandi: ${targetVendor.city || 'N/A'} | Export Date: ${formatDate(dateStr)}`],
      [`Opening Balance: ₹${targetVendor.openingBalance} | Closing Payable: ₹${ledger.closingBalance}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor Ledger');
    downloadWorkbook(wb, fileName);
  } else {
    // All vendors
    const fileName = `Hari_Kripa_All_Vendor_Ledgers_${dateStr}${fileNameSuffix}.xlsx`;
    const headers = [
      'Vendor ID',
      'Vendor Name',
      'City / Mandi',
      'Opening Balance (₹)',
      'Total Consignments (₹)',
      'Closing Balance (₹)',
    ];

    const rows = vendors.map((v) => {
      return [
        sanitizeCellValue(v.id),
        sanitizeCellValue(v.name),
        sanitizeCellValue(v.city || ''),
        v.openingBalance,
        0,
        v.openingBalance,
      ];
    });

    const wsData = [
      ['HARI KRIPA FRUIT ERP — CONSOLIDATED VENDOR BALANCES'],
      [`Export Date: ${formatDate(dateStr)} | Total Vendors: ${vendors.length}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor Summary');
    downloadWorkbook(wb, fileName);
  }
}

// 9b. Sale Proceeds Customer Ledger Export
export function exportSaleProceedsCustomerLedger(customerId: string) {
  const cust = db.getCustomerById(customerId);
  const dateStr = getTodayIso();
  const ledger = getSaleProceedsLedger({ customerId });
  const fileName = `Hari_Kripa_Sale_Proceeds_${cust ? cust.name.replace(/\s+/g, '_') : customerId}_${dateStr}.xlsx`;

  const headers = [
    'Date',
    'Particulars',
    'Debit (₹)',
    'Credit (₹)',
    'Running Balance (₹)',
  ];

  const rows = ledger.entries.map((e) => [
    formatDate(e.date),
    sanitizeCellValue(e.particulars),
    e.debit || '',
    e.credit || '',
    e.balance,
  ]);

  const wsData = [
    [`HARI KRIPA FRUIT ERP — SALE PROCEEDS LEDGER: ${cust ? cust.name.toUpperCase() : 'CUSTOMER'}`],
    [`Mobile: ${cust?.mobile || 'N/A'} | City: ${cust?.city || 'N/A'} | Export Date: ${formatDate(dateStr)}`],
    [`Total Credit: ₹${ledger.totalCredit} | Total Debit: ₹${ledger.totalDebit} | Closing Balance: ₹${ledger.closingBalance}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customer Sale Proceeds');
  downloadWorkbook(wb, fileName);
}

// 10. Crate Statement
export function exportCrateStatement(customerId?: string, fileNameSuffix = '') {
  const customers = db.getCustomers();
  const dateStr = getTodayIso();
  const targetCust = customerId ? customers.find((c) => c.id === customerId) : null;

  if (targetCust) {
    const statement = getCustomerCrateStatement(targetCust.id);
    const fileName = `Hari_Kripa_Crate_Statement_${targetCust.name.replace(/\s+/g, '_')}_${dateStr}.xlsx`;

    const headers = [
      'Date',
      'Voucher / Bill No.',
      'Particulars',
      'Crate In (Recd)',
      'Crate Out (Issued)',
      'Net Balance Crates',
    ];

    const rows = statement.entries.map((t) => [
      formatDate(t.date),
      sanitizeCellValue(t.referenceNo || ''),
      sanitizeCellValue(t.particulars),
      t.inQuantity || 0,
      t.outQuantity || 0,
      t.balance,
    ]);

    const wsData = [
      [`HARI KRIPA FRUIT ERP — CRATE STATEMENT: ${targetCust.name.toUpperCase()}`],
      [`Export Date: ${formatDate(dateStr)} | Total Balance Crates Due: ${statement.closingCrates} (${statement.closingTotalKg} KG)`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Crate Statement');
    downloadWorkbook(wb, fileName);
  } else {
    const fileName = `Hari_Kripa_Consolidated_Crates_${dateStr}${fileNameSuffix}.xlsx`;
    const headers = [
      'Customer ID',
      'Customer Name',
      'Phone',
      'Closing Balance Crates Due',
      'KG Equivalent',
    ];

    const rows = customers.map((c) => {
      const b = getCustomerCrateStatement(c.id);
      return [
        sanitizeCellValue(c.id),
        sanitizeCellValue(c.name),
        sanitizeCellValue(c.mobile || ''),
        b.closingCrates,
        b.closingTotalKg,
      ];
    });

    const wsData = [
      ['HARI KRIPA FRUIT ERP — CONSOLIDATED CRATE BALANCES BY CUSTOMER'],
      [`Export Date: ${formatDate(dateStr)} | Total Customers: ${customers.length}`],
      [],
      headers,
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'All Crates');
    downloadWorkbook(wb, fileName);
  }
}

// 11. Expenses Report
export function exportExpenses(records?: Array<{ date: string; expenseType: string; amount: number; reference: string; source: string }>, fileNameSuffix = '') {
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Expenses_${dateStr}${fileNameSuffix}.xlsx`;

  let expenseRows: any[][] = [];
  if (records && records.length > 0) {
    expenseRows = records.map((e) => [
      formatDate(e.date),
      sanitizeCellValue(e.expenseType),
      e.amount,
      sanitizeCellValue(e.reference),
      sanitizeCellValue(e.source),
    ]);
  } else {
    // Extract from all sales and sale proceeds
    const cashSales = db.getCashSales();
    const creditSales = db.getCreditSales();
    const proceeds = db.getSaleProceeds();

    cashSales.forEach((cs) => {
      cs.expenses?.forEach((exp) => {
        expenseRows.push([
          formatDate(cs.date),
          sanitizeCellValue(exp.name),
          exp.amount,
          sanitizeCellValue(cs.cashSaleNo),
          'Cash Sale',
        ]);
      });
    });

    creditSales.forEach((cs) => {
      cs.expenses?.forEach((exp) => {
        expenseRows.push([
          formatDate(cs.date),
          sanitizeCellValue(exp.name),
          exp.amount,
          sanitizeCellValue(cs.creditSaleNo),
          'Credit Sale',
        ]);
      });
    });

    proceeds.forEach((sp) => {
      sp.expenses?.forEach((exp) => {
        expenseRows.push([
          formatDate(sp.date),
          sanitizeCellValue(exp.name),
          exp.amount,
          sanitizeCellValue(sp.proceedsNo),
          'Sale Proceeds',
        ]);
      });
    });
  }

  const headers = ['Date', 'Expense Type / Category', 'Amount (₹)', 'Voucher Reference', 'Source Module'];

  const totalExpense = expenseRows.reduce((sum, r) => sum + (Number(r[2]) || 0), 0);

  const wsData = [
    ['HARI KRIPA FRUIT ERP — MANDI OPERATIONAL EXPENSES LOG'],
    [`Export Date: ${formatDate(dateStr)} | Total Expense Entries: ${expenseRows.length} | Grand Total: ₹${totalExpense}`],
    [],
    headers,
    ...expenseRows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...expenseRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
  downloadWorkbook(wb, fileName);
}

// 12. Bills / Sales Transaction History
export function exportBillHistory(records?: Bill[], fileNameSuffix = '') {
  const bills = records || db.getBills();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Bill_History_${dateStr}${fileNameSuffix}.xlsx`;

  const headers = [
    'Bill No.',
    'Date',
    'Customer Name',
    'Item Name',
    'Quantity',
    'Unit',
    'Rate (₹)',
    'Amount (₹)',
    'Expenses (₹)',
    'Net Amount (₹)',
    'Payment Status',
  ];

  const rows: any[][] = [];
  bills.forEach((b) => {
    const items = b.items && b.items.length > 0 ? b.items : [{ fruitName: '', quantity: 1, unit: '', rate: 0, amount: b.subtotal || 0 }];
    items.forEach((it, idx) => {
      rows.push([
        sanitizeCellValue(b.billNo),
        formatDate(b.date),
        sanitizeCellValue(b.customerName),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.rate,
        it.amount,
        idx === 0 ? b.expenseTotal || 0 : '',
        idx === 0 ? b.totalAmount : '',
        idx === 0 ? sanitizeCellValue(b.status || 'Paid') : '',
      ]);
    });
  });

  const wsData = [
    ['HARI KRIPA FRUIT ERP — BILLING & INVOICE HISTORY'],
    [`Export Date: ${formatDate(dateStr)} | Total Bills: ${bills.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Bills');
  downloadWorkbook(wb, fileName);
}

// 13. Units & Crates Configuration
export function exportUnitsAndCrates() {
  const units = db.getUnits();
  const crates = db.getCrateTypes();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Units_And_Crates_${dateStr}.xlsx`;

  const wb = XLSX.utils.book_new();

  // Units Sheet
  const unitHeaders = ['Unit ID', 'Unit Name', 'Symbol', 'Is Default'];
  const unitRows = units.map((u) => [
    sanitizeCellValue(u.id),
    sanitizeCellValue(u.name),
    sanitizeCellValue(u.symbol),
    u.isDefault ? 'Yes' : 'No',
  ]);
  const wsUnits = XLSX.utils.aoa_to_sheet([
    ['HARI KRIPA FRUIT ERP — MEASUREMENT UNITS'],
    [],
    unitHeaders,
    ...unitRows,
  ]);
  setAutoColumnWidths(wsUnits, [unitHeaders, ...unitRows]);
  XLSX.utils.book_append_sheet(wb, wsUnits, 'Units');

  // Crates Sheet
  const crateHeaders = ['Crate ID', 'Crate Name', 'Default Weight (Kg)', 'Description'];
  const crateRows = crates.map((c) => [
    sanitizeCellValue(c.id),
    sanitizeCellValue(c.name),
    c.defaultWeightKg,
    sanitizeCellValue(c.description || ''),
  ]);
  const wsCrates = XLSX.utils.aoa_to_sheet([
    ['HARI KRIPA FRUIT ERP — CRATE SIZES & TYPES'],
    [],
    crateHeaders,
    ...crateRows,
  ]);
  setAutoColumnWidths(wsCrates, [crateHeaders, ...crateRows]);
  XLSX.utils.book_append_sheet(wb, wsCrates, 'Crate Types');

  downloadWorkbook(wb, fileName);
}

// 14. Company Profiles
export function exportCompanyProfiles() {
  const profiles = db.getCompanyProfiles();
  const dateStr = getTodayIso();
  const fileName = `Hari_Kripa_Company_Profiles_${dateStr}.xlsx`;

  const headers = [
    'Profile ID',
    'Firm / Company Name',
    'Trade Name',
    'Hindi Name',
    'Short Code',
    'Address',
    'City',
    'State',
    'Primary Contact Name',
    'Primary Mobile Number',
    'Alternate 1 Contact Name',
    'Alternate 1 Mobile Number',
    'Alternate 2 Contact Name',
    'Alternate 2 Mobile Number',
    'Aadhaar Card No.',
    'Bank Name',
    'Account Number',
    'IFSC',
    'Branch',
    'Is Default',
  ];

  const rows = profiles.map((p) => [
    sanitizeCellValue(p.id),
    sanitizeCellValue(p.name),
    sanitizeCellValue(p.tradeName || ''),
    sanitizeCellValue(p.hindiName || ''),
    sanitizeCellValue(p.shortCode || ''),
    sanitizeCellValue(p.address || ''),
    sanitizeCellValue(p.city || ''),
    sanitizeCellValue(p.state || ''),
    sanitizeCellValue(p.primaryContactName || ''),
    sanitizeCellValue(p.mobile || ''),
    sanitizeCellValue(p.alternate1ContactName || ''),
    sanitizeCellValue(p.alternate1Mobile || p.alternateMobile || ''),
    sanitizeCellValue(p.alternate2ContactName || ''),
    sanitizeCellValue(p.alternate2Mobile || ''),
    p.aadhaarNo ? maskAadhaar(p.aadhaarNo) : '',
    sanitizeCellValue(p.bankName || ''),
    sanitizeCellValue(p.accountNumber || ''),
    sanitizeCellValue(p.ifsc || ''),
    sanitizeCellValue(p.branch || ''),
    p.isDefault ? 'Yes' : 'No',
  ]);

  const wsData = [
    ['HARI KRIPA FRUIT ERP — COMPANY / BILL PROFILES'],
    [`Export Date: ${formatDate(dateStr)} | Total Profiles: ${profiles.length}`],
    [],
    headers,
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  setAutoColumnWidths(ws, [headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Company Profiles');
  downloadWorkbook(wb, fileName);
}

/* ========================================================================== */
/* EXPORT ALL ERP DATA (ZIP CONTAINER)                                        */
/* ========================================================================== */

/**
 * Creates separate genuine .xlsx workbooks for all ERP modules,
 * packs them into a single ZIP archive, and downloads it.
 */
export async function exportAllErpDataZip(onProgress?: (msg: string) => void) {
  const dateStr = getTodayIso();
  const zip = new JSZip();

  function createWorkbookBuffer(title: string, headers: string[], rows: any[][], sheetName = 'Data'): Uint8Array {
    const wsData = [
      [title],
      [`Export Date: ${formatDate(dateStr)} | Rows: ${rows.length}`],
      [],
      headers,
      ...rows,
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    setAutoColumnWidths(ws, [headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  }

  onProgress?.('Generating Fruit Master workbook...');
  const fruits = db.getFruits();
  zip.file(
    'Fruit_Master.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — FRUIT / ITEM MASTER',
      ['Item ID', 'Item Name', 'Unit', 'Price (₹)', 'Crate Weight (Kg)', 'Status'],
      fruits.map((f) => [
        sanitizeCellValue(f.id),
        sanitizeCellValue(f.name),
        sanitizeCellValue(f.unit || f.defaultUnit || 'Crate'),
        typeof f.defaultRate === 'number' ? f.defaultRate : 1,
        f.crateWeightKg || 20,
        f.active ? 'Active' : 'Inactive',
      ])
    )
  );

  onProgress?.('Generating Customers workbook...');
  const customers = db.getCustomers();
  zip.file(
    'Customers.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — CUSTOMERS',
      ['Customer ID', 'Customer Name', 'Phone', 'City', 'Address', 'Opening Balance (₹)', 'Current Balance (₹)', 'Balance Crates'],
      customers.map((c) => [
        sanitizeCellValue(c.id),
        sanitizeCellValue(c.name),
        sanitizeCellValue(c.mobile || ''),
        sanitizeCellValue(c.city || ''),
        sanitizeCellValue(c.address || ''),
        c.openingBalance || 0,
        c.openingBalance || 0,
        c.openingCrateBalance || 0,
      ])
    )
  );

  onProgress?.('Generating Vendors workbook...');
  const vendors = db.getVendors();
  zip.file(
    'Vendors.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — VENDORS / SUPPLIERS',
      ['Vendor ID', 'Vendor Name', 'Phone', 'City / Mandi', 'Address', 'Opening Balance (₹)'],
      vendors.map((v) => [
        sanitizeCellValue(v.id),
        sanitizeCellValue(v.name),
        sanitizeCellValue(v.contact || ''),
        sanitizeCellValue(v.city || ''),
        sanitizeCellValue(v.address || ''),
        v.openingBalance || 0,
      ])
    )
  );

  onProgress?.('Generating Cash Sales workbook...');
  const cashSales = db.getCashSales();
  const cashRows: any[][] = [];
  cashSales.forEach((s) => {
    (s.items || []).forEach((it, idx) => {
      cashRows.push([
        sanitizeCellValue(s.cashSaleNo),
        formatDate(s.date),
        sanitizeCellValue(s.customerId),
        sanitizeCellValue(s.customerName),
        sanitizeCellValue(s.paymentMode || 'Cash'),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.rate,
        it.amount,
        idx === 0 ? s.expenseTotal || 0 : '',
        idx === 0 ? s.crateIn || 0 : '',
        idx === 0 ? s.crateOut || 0 : '',
        idx === 0 ? s.finalAmount : '',
      ]);
    });
  });
  zip.file(
    'Cash_Sales.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — CASH SALES',
      ['Bill No.', 'Date', 'Customer ID', 'Customer Name', 'Payment Mode', 'Item Name', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)', 'Expenses (₹)', 'Crate In', 'Crate Out', 'Net Amount (₹)'],
      cashRows
    )
  );

  onProgress?.('Generating Credit Sales workbook...');
  const creditSales = db.getCreditSales();
  const creditRows: any[][] = [];
  creditSales.forEach((s) => {
    (s.items || []).forEach((it, idx) => {
      creditRows.push([
        sanitizeCellValue(s.creditSaleNo),
        formatDate(s.date),
        sanitizeCellValue(s.customerId),
        sanitizeCellValue(s.customerName),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.rate,
        it.amount,
        idx === 0 ? s.expenseTotal || 0 : '',
        idx === 0 ? s.crateIn || 0 : '',
        idx === 0 ? s.crateOut || 0 : '',
        idx === 0 ? s.finalAmount : '',
      ]);
    });
  });
  zip.file(
    'Credit_Sales.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — CREDIT SALES',
      ['Bill No.', 'Date', 'Customer ID', 'Customer Name', 'Item Name', 'Quantity', 'Unit', 'Rate (₹)', 'Amount (₹)', 'Expenses (₹)', 'Crate In', 'Crate Out', 'Net Amount (₹)'],
      creditRows
    )
  );

  onProgress?.('Generating Sale Proceeds workbook...');
  const proceeds = db.getSaleProceeds();
  const procRows: any[][] = [];
  proceeds.forEach((sp) => {
    (sp.items || []).forEach((it, idx) => {
      procRows.push([
        sanitizeCellValue(sp.proceedsNo),
        formatDate(sp.date),
        sanitizeCellValue(sp.vendorId),
        sanitizeCellValue(sp.vendorName),
        sanitizeCellValue(it.fruitName),
        it.quantity,
        sanitizeCellValue(it.unit),
        it.rate,
        idx === 0 ? sp.amount : '',
        idx === 0 ? sp.totalExpense : '',
        idx === 0 ? 0 : '',
        idx === 0 ? sp.netAmount : '',
      ]);
    });
  });
  zip.file(
    'Sale_Proceeds.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — SALE PROCEEDS',
      ['Proceeds No.', 'Date', 'Vendor ID', 'Vendor Name', 'Item Name', 'Quantity', 'Unit', 'Rate (₹)', 'Gross Total (₹)', 'Expenses (₹)', 'Advance (₹)', 'Net Payable (₹)'],
      procRows
    )
  );

  onProgress?.('Generating Cash Receipts workbook...');
  const receipts = db.getReceipts();
  zip.file(
    'Cash_Receipts.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — RECEIPTS',
      ['Receipt No.', 'Date', 'Customer ID', 'Customer Name', 'Amount (₹)', 'Payment Mode', 'Notes'],
      receipts.map((r) => [
        sanitizeCellValue(r.receiptNo),
        formatDate(r.date),
        sanitizeCellValue(r.customerId),
        sanitizeCellValue(r.customerName),
        r.amount,
        sanitizeCellValue(r.paymentMode || 'Cash'),
        sanitizeCellValue(r.notes || ''),
      ])
    )
  );

  onProgress?.('Generating Operational Expenses workbook...');
  const expenseRows: any[][] = [];
  cashSales.forEach((cs) => {
    cs.expenses?.forEach((exp) => {
      expenseRows.push([formatDate(cs.date), sanitizeCellValue(exp.name), exp.amount, sanitizeCellValue(cs.cashSaleNo), 'Cash Sale']);
    });
  });
  creditSales.forEach((cs) => {
    cs.expenses?.forEach((exp) => {
      expenseRows.push([formatDate(cs.date), sanitizeCellValue(exp.name), exp.amount, sanitizeCellValue(cs.creditSaleNo), 'Credit Sale']);
    });
  });
  proceeds.forEach((sp) => {
    sp.expenses?.forEach((exp) => {
      expenseRows.push([formatDate(sp.date), sanitizeCellValue(exp.name), exp.amount, sanitizeCellValue(sp.proceedsNo), 'Sale Proceeds']);
    });
  });
  zip.file(
    'Expenses.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — MANDI OPERATIONAL EXPENSES',
      ['Date', 'Expense Type', 'Amount (₹)', 'Reference', 'Source'],
      expenseRows
    )
  );

  onProgress?.('Generating Customer Ledger Summary workbook...');
  zip.file(
    'Customer_Ledger_Summary.xlsx',
    createWorkbookBuffer(
      'HARI KRIPA FRUIT ERP — CUSTOMER LEDGERS',
      ['Customer ID', 'Customer Name', 'Opening Balance (₹)', 'Total Debit (₹)', 'Total Credit (₹)', 'Closing Balance (₹)', 'Crates Due'],
      customers.map((c) => {
        const l = getCustomerLedger(c.id);
        return [
          sanitizeCellValue(c.id),
          sanitizeCellValue(c.name),
          c.openingBalance,
          l.totalDebit,
          l.totalCredit,
          l.closingBalance,
          c.openingCrateBalance,
        ];
      })
    )
  );

  onProgress?.('Generating Master Configurations workbook...');
  const units = db.getUnits();
  const crates = db.getCrateTypes();
  const profiles = db.getCompanyProfiles();
  const configWb = XLSX.utils.book_new();

  const wsUnits = XLSX.utils.aoa_to_sheet([
    ['Units Master'],
    ['Unit ID', 'Unit Name', 'Symbol', 'Default'],
    ...units.map((u) => [sanitizeCellValue(u.id), sanitizeCellValue(u.name), sanitizeCellValue(u.symbol), u.isDefault ? 'Yes' : 'No']),
  ]);
  const wsCrates = XLSX.utils.aoa_to_sheet([
    ['Crate Types'],
    ['Crate ID', 'Name', 'Weight (Kg)', 'Description'],
    ...crates.map((c) => [sanitizeCellValue(c.id), sanitizeCellValue(c.name), c.defaultWeightKg, sanitizeCellValue(c.description || '')]),
  ]);
  const wsProfiles = XLSX.utils.aoa_to_sheet([
    ['Company Profiles'],
    ['ID', 'Name', 'Trade Name', 'Address', 'Mobile', 'Aadhaar Card No.'],
    ...profiles.map((p) => [sanitizeCellValue(p.id), sanitizeCellValue(p.name), sanitizeCellValue(p.tradeName || ''), sanitizeCellValue(p.address || ''), sanitizeCellValue(p.mobile || ''), p.aadhaarNo ? maskAadhaar(p.aadhaarNo) : '']),
  ]);
  XLSX.utils.book_append_sheet(configWb, wsUnits, 'Units');
  XLSX.utils.book_append_sheet(configWb, wsCrates, 'Crate Types');
  XLSX.utils.book_append_sheet(configWb, wsProfiles, 'Profiles');
  zip.file('Master_Configurations.xlsx', XLSX.write(configWb, { bookType: 'xlsx', type: 'array' }));

  onProgress?.('Packing ZIP archive...');
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const zipFileName = `Hari_Kripa_FruitERP_Full_Export_${dateStr}.zip`;
  downloadBlob(zipBlob, zipFileName);
}

/* ========================================================================== */
/* BLANK TEMPLATE GENERATORS                                                  */
/* ========================================================================== */

export type TemplateModule =
  | 'fruitMaster'
  | 'customers'
  | 'vendors'
  | 'cashSale'
  | 'creditSale'
  | 'receipts'
  | 'saleProceeds'
  | 'units'
  | 'crates';

export function downloadBlankTemplate(module: TemplateModule) {
  const wb = XLSX.utils.book_new();
  const availableUnits = db.getUnits().map((u) => u.symbol).join(', ') || 'Crate, Kg, Box, Peti, Piece';

  switch (module) {
    case 'fruitMaster': {
      // Data entry sheet
      const headers = ['Item Name *', 'Category', 'Unit', 'Price (₹)', 'Crate Weight (Kg)', 'Active (Yes/No)'];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Items');

      // Instructions sheet
      const instructions = [
        ['HARI KRIPA FRUIT ERP — FRUIT / ITEM MASTER IMPORT TEMPLATE INSTRUCTIONS'],
        [],
        ['Field', 'Required', 'Description', 'Allowed / Example Values'],
        ['Item Name *', 'YES', 'Name of fruit or vegetable item', 'Apple Royal, Mango Alphonso, Strawberry'],
        ['Category', 'NO', 'Grouping category', 'Apple, Citrus, Tropical, Berries'],
        ['Unit', 'NO', `Billing unit (Defaults to Crate if blank)`, availableUnits],
        ['Price (₹)', 'NO', 'Default price per unit (Defaults to ₹1 for new items if left blank)', '1, 50, 120, 250'],
        ['Crate Weight (Kg)', 'NO', 'Weight per crate in kilograms', '10, 15, 20, 24 (Default: 20)'],
        ['Active (Yes/No)', 'NO', 'Catalog active status', 'Yes / No (Default: Yes)'],
        [],
        ['NOTES:'],
        ['1. Do NOT delete or modify column headings on the Items sheet.'],
        ['2. Price defaults to ₹1 when left blank, as per wholesale catalog policy.'],
        ['3. You can import up to 1,000 items in a single spreadsheet.'],
      ];
      const instSheet = XLSX.utils.aoa_to_sheet(instructions);
      instSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, instSheet, 'Instructions');

      downloadWorkbook(wb, 'Hari_Kripa_Fruit_Master_Template.xlsx');
      break;
    }

    case 'customers': {
      const headers = ['Customer Name *', 'Phone', 'City', 'Address', 'Aadhaar Card No. (Optional)', 'Opening Balance (₹)'];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 18 }, { wch: 32 }, { wch: 26 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Customers');

      const instructions = [
        ['HARI KRIPA FRUIT ERP — CUSTOMER MASTER IMPORT TEMPLATE INSTRUCTIONS'],
        [],
        ['Field', 'Required', 'Description', 'Example Values'],
        ['Customer Name *', 'YES', 'Full trading name of customer / buyer', 'Sharma Fruit Co, Ramesh Bhai'],
        ['Phone', 'NO', '10-digit mobile contact number', '9820012345'],
        ['City', 'NO', 'City, Mandi or District name', 'Mumbai, Pune, Surat, Bhilai'],
        ['Address', 'NO', 'Shop / Mandi address', 'Gala 45, APMC Fruit Market'],
        ['Aadhaar Card No. (Optional)', 'NO', '12-digit Aadhaar Card Number (stored securely)', '1234 5678 9012'],
        ['Opening Balance (₹)', 'NO', 'Initial ledger balance in rupees (positive = customer owes money)', '0, 15000, 50000'],
        [],
        ['IMPORTANT PRIVACY GUIDELINES:'],
        ['1. Never share client Aadhaar data with unauthorized third parties.'],
        ['2. Duplicate customer names can be either skipped or updated based on your selection.'],
      ];
      const instSheet = XLSX.utils.aoa_to_sheet(instructions);
      instSheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 45 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, instSheet, 'Instructions');

      downloadWorkbook(wb, 'Hari_Kripa_Customer_Template.xlsx');
      break;
    }

    case 'vendors': {
      const headers = ['Vendor Name *', 'Phone', 'City / Mandi', 'Address', 'Opening Balance (₹)', 'Commission Rate (%)'];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 20 }, { wch: 32 }, { wch: 20 }, { wch: 22 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Vendors');

      const instructions = [
        ['HARI KRIPA FRUIT ERP — VENDOR / SUPPLIER IMPORT TEMPLATE INSTRUCTIONS'],
        [],
        ['Field', 'Required', 'Description', 'Example Values'],
        ['Vendor Name *', 'YES', 'Name of fruit grower, supplier, or transport agency', 'Kisan Fruit Mandi, Nashik Grapes'],
        ['Phone', 'NO', '10-digit mobile contact number', '9890011223'],
        ['City / Mandi', 'NO', 'Source mandi location', 'Nashik, Nagpur, Kashmir, Shimla'],
        ['Address', 'NO', 'Registered mandi or orchard address', 'Plot 12, APMC Cold Storage'],
        ['Opening Balance (₹)', 'NO', 'Initial payable to vendor in rupees', '0, 25000'],
        ['Commission Rate (%)', 'NO', 'Commission percentage (e.g., 6%)', '6, 8, 10'],
      ];
      const instSheet = XLSX.utils.aoa_to_sheet(instructions);
      instSheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 45 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, instSheet, 'Instructions');

      downloadWorkbook(wb, 'Hari_Kripa_Vendor_Template.xlsx');
      break;
    }

    case 'cashSale':
    case 'creditSale': {
      const isCash = module === 'cashSale';
      const headers = [
        'Bill No. *',
        'Date * (YYYY-MM-DD)',
        'Customer Name *',
        'Item Name *',
        'Quantity *',
        'Unit *',
        'Rate (₹) *',
        'Expenses (₹)',
        'Crate Out',
        'Crate In',
        isCash ? 'Payment Mode' : 'Notes',
      ];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [
        { wch: 16 },
        { wch: 18 },
        { wch: 24 },
        { wch: 22 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 14 },
        { wch: 18 },
      ];
      XLSX.utils.book_append_sheet(wb, dataSheet, isCash ? 'Cash Sales' : 'Credit Sales');

      const instructions = [
        [`HARI KRIPA FRUIT ERP — ${isCash ? 'CASH' : 'CREDIT'} SALE IMPORT TEMPLATE INSTRUCTIONS`],
        [],
        ['Field', 'Required', 'Description', 'Example Values'],
        ['Bill No. *', 'YES', 'Unique Bill Number. Group multi-item bills with same Bill No.', 'CS-001, CASH-101'],
        ['Date *', 'YES', 'Transaction Date (format: YYYY-MM-DD or DD/MM/YYYY)', `${getTodayIso()}`],
        ['Customer Name *', 'YES', 'Must match existing customer or a new customer will be registered', 'Ramesh Fruits, Cash Client'],
        ['Item Name *', 'YES', 'Must match existing Fruit Master item (or will be matched case-insensitively)', 'Apple Royal, Grapes Black'],
        ['Quantity *', 'YES', 'Number of units / crates / kg', '10, 25, 50'],
        ['Unit *', 'YES', 'Measurement unit', availableUnits],
        ['Rate (₹) *', 'YES', 'Price per unit in rupees', '50, 120, 250'],
        ['Expenses (₹)', 'NO', 'Freight, hamali, postage (applied to bill total)', '50, 100 (Default: 0)'],
        ['Crate Out', 'NO', 'Number of crates given to buyer', '10, 20 (Default: 0)'],
        ['Crate In', 'NO', 'Number of empty crates returned by buyer', '0, 5 (Default: 0)'],
        [isCash ? 'Payment Mode' : 'Notes', 'NO', isCash ? 'Payment method' : 'Remarks', isCash ? 'Cash, UPI, Bank Transfer' : 'Payment due in 7 days'],
        [],
        ['CRITICAL BUSINESS LOGIC RULES:'],
        ['1. Multi-Item Bills: If a bill has 3 items, provide 3 rows with the identical Bill No., Date, and Customer Name.'],
        ['2. Line amounts and bill totals are automatically recalculated to prevent accounting discrepancies.'],
        ['3. Crate balances and ledger balances are updated accurately based on ERP rules.'],
        [isCash ? '4. Cash Sales DO NOT create outstanding customer credit balances.' : '4. Credit Sales correctly update the customer debit ledger.'],
      ];
      const instSheet = XLSX.utils.aoa_to_sheet(instructions);
      instSheet['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 55 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, instSheet, 'Instructions');

      downloadWorkbook(wb, isCash ? 'Hari_Kripa_Cash_Sale_Template.xlsx' : 'Hari_Kripa_Credit_Sale_Template.xlsx');
      break;
    }

    case 'receipts': {
      const headers = ['Receipt No. *', 'Date * (YYYY-MM-DD)', 'Customer Name *', 'Amount (₹) *', 'Payment Mode', 'Transaction Ref', 'Notes'];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 20 }, { wch: 26 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Receipts');

      const instructions = [
        ['HARI KRIPA FRUIT ERP — CASH / BANK RECEIPT IMPORT TEMPLATE INSTRUCTIONS'],
        [],
        ['Field', 'Required', 'Description', 'Example Values'],
        ['Receipt No. *', 'YES', 'Unique receipt identifier', 'REC-001, RCT-105'],
        ['Date *', 'YES', 'Payment receipt date (YYYY-MM-DD)', getTodayIso()],
        ['Customer Name *', 'YES', 'Name of paying customer', 'Sharma Fruit Co'],
        ['Amount (₹) *', 'YES', 'Amount received in rupees', '5000, 25000'],
        ['Payment Mode', 'NO', 'Cash, UPI, Cheque, NEFT/RTGS', 'Cash (Default)'],
        ['Transaction Ref', 'NO', 'Cheque number or UPI reference ID', 'UPI/123456789, CHQ-4455'],
        ['Notes', 'NO', 'Payment remarks', 'Part payment for Bill #101'],
      ];
      const instSheet = XLSX.utils.aoa_to_sheet(instructions);
      instSheet['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, instSheet, 'Instructions');

      downloadWorkbook(wb, 'Hari_Kripa_Receipt_Template.xlsx');
      break;
    }

    case 'saleProceeds': {
      const headers = [
        'Proceeds No. *',
        'Date * (YYYY-MM-DD)',
        'Vendor Name *',
        'Item Name *',
        'Quantity *',
        'Unit *',
        'Rate (₹) *',
        'Freight & Hamali (₹)',
        'Advance Paid (₹)',
      ];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 18 }, { wch: 18 }, { wch: 24 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 20 }, { wch: 18 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Sale Proceeds');

      const instructions = [
        ['HARI KRIPA FRUIT ERP — SALE PROCEEDS (CONSIGNMENT SALES) TEMPLATE INSTRUCTIONS'],
        [],
        ['Field', 'Required', 'Description', 'Example Values'],
        ['Proceeds No. *', 'YES', 'Consignment / Patti number', 'SP-001, PATTI-12'],
        ['Date *', 'YES', 'Consignment sale date (YYYY-MM-DD)', getTodayIso()],
        ['Vendor Name *', 'YES', 'Consignor / grower / vendor name', 'Kisan Fruit Mandi'],
        ['Item Name *', 'YES', 'Consignment fruit item', 'Apple Royal, Grapes Green'],
        ['Quantity *', 'YES', 'Quantity sold', '100, 250'],
        ['Unit *', 'YES', 'Measurement unit', availableUnits],
        ['Rate (₹) *', 'YES', 'Mandi auction rate per unit', '45, 80'],
        ['Freight & Hamali (₹)', 'NO', 'Deducted mandi expenses', '150, 300'],
        ['Advance Paid (₹)', 'NO', 'Advance paid to truck driver or vendor', '500, 2000'],
      ];
      const instSheet = XLSX.utils.aoa_to_sheet(instructions);
      instSheet['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 45 }, { wch: 30 }];
      XLSX.utils.book_append_sheet(wb, instSheet, 'Instructions');

      downloadWorkbook(wb, 'Hari_Kripa_Sale_Proceeds_Template.xlsx');
      break;
    }

    case 'units': {
      const headers = ['Unit Name *', 'Symbol *', 'Is Default (Yes/No)'];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Units');
      downloadWorkbook(wb, 'Hari_Kripa_Units_Template.xlsx');
      break;
    }

    case 'crates': {
      const headers = ['Crate Name *', 'Default Weight (Kg) *', 'Description'];
      const dataSheet = XLSX.utils.aoa_to_sheet([headers]);
      dataSheet['!cols'] = [{ wch: 25 }, { wch: 22 }, { wch: 35 }];
      XLSX.utils.book_append_sheet(wb, dataSheet, 'Crate Types');
      downloadWorkbook(wb, 'Hari_Kripa_Crate_Types_Template.xlsx');
      break;
    }
  }
}
