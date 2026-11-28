// Ensure window + localStorage shim exists BEFORE loading db.ts so db uses localStorage cleanly
const lsStore = new Map<string, string>();
const mockLs = {
  getItem: (k: string) => (lsStore.has(k) ? lsStore.get(k)! : null),
  setItem: (k: string, v: string) => lsStore.set(k, String(v)),
  removeItem: (k: string) => lsStore.delete(k),
  clear: () => lsStore.clear(),
};
if (typeof (globalThis as any).localStorage === 'undefined') {
  (globalThis as any).localStorage = mockLs;
}
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = { localStorage: (globalThis as any).localStorage };
}

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { db } from '../src/services/db';
import {
  getCustomerLedger,
  getSaleProceedsLedger,
  getAllCustomerOutstandings,
} from '../src/services/accounting';
import {
  customerHasType,
  formatCustomerTypesLabel,
  parseCustomerTypesFromText,
} from '../src/utils/customerTypeUtils';
import { Customer } from '../src/types';
import { SaleProceedsLedgerView } from '../src/components/accounts/SaleProceedsLedgerView';
import { CustomerDirectoryView } from '../src/components/master/CustomerDirectoryView';
import { AddCustomerModal } from '../src/components/modals/AddCustomerModal';

let passes = 0;
let failures = 0;

function check(condition: boolean, label: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${label}`);
    passes++;
  } else {
    console.error(`[FAIL] ${label}${detail ? ` — ${detail}` : ''}`);
    failures++;
  }
}

function run() {
  console.log('=== TEST SUITE: Customer Type Selection, Module Visibility & Sale Proceeds Customer Profile ===\n');

  // 1. Seed & Default Types Check
  console.log('--- 1. Default Customers & Type Helpers ---');
  const initialCustomers = db.getCustomers();
  check(initialCustomers.length >= 3, 'Initial customers loaded cleanly');

  const c1 = db.getCustomerById('c1');
  const c2 = db.getCustomerById('c2');
  const c3 = db.getCustomerById('c3');

  check(
    Boolean(c1 && customerHasType(c1, 'credit_sale') && customerHasType(c1, 'sale_proceeds') && !customerHasType(c1, 'cash_sale')),
    'c1 has credit_sale + sale_proceeds only'
  );
  check(
    Boolean(c2 && customerHasType(c2, 'cash_sale') && customerHasType(c2, 'credit_sale') && customerHasType(c2, 'sale_proceeds')),
    'c2 supports all 3 customer types simultaneously'
  );
  check(
    Boolean(c3 && customerHasType(c3, 'credit_sale') && !customerHasType(c3, 'cash_sale') && !customerHasType(c3, 'sale_proceeds')),
    'c3 has credit_sale only'
  );

  // 2. Creating Single & Multi-Type Customers (Zero Duplication)
  console.log('\n--- 2. Creating Single & Multi-Type Customers ---');
  const cashOnlyCust: Customer = {
    id: 'test-cash-only',
    name: 'Test Cash Buyer',
    mobile: '9000000001',
    customerTypes: ['cash_sale'],
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
  const spOnlyCust: Customer = {
    id: 'test-sp-only',
    name: 'Test Consignor Party',
    mobile: '9000000002',
    city: 'Nashik',
    address: 'Plot 12, Market Yard',
    aadhaarNo: '123456789012',
    customerTypes: ['sale_proceeds'],
    openingBalance: 0,
    openingBalanceType: 'credit',
    saleProceedsOpeningBalance: 5000,
    saleProceedsOpeningBalanceType: 'credit',
    openingCrateBalance: 4,
    active: true,
    createdAt: new Date().toISOString(),
  };
  const dualCust: Customer = {
    id: 'test-dual-cash-credit',
    name: 'Test Dual Buyer',
    mobile: '9000000003',
    customerTypes: ['cash_sale', 'credit_sale'],
    openingBalance: 2500,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };

  db.saveCustomer(cashOnlyCust);
  db.saveCustomer(spOnlyCust);
  db.saveCustomer(dualCust);

  const cashList = db.getCustomersByType('cash_sale');
  const creditList = db.getCustomersByType('credit_sale');
  const spList = db.getCustomersByType('sale_proceeds');

  check(
    cashList.some((c) => c.id === 'test-cash-only') &&
      !creditList.some((c) => c.id === 'test-cash-only') &&
      !spList.some((c) => c.id === 'test-cash-only'),
    'Cash Sale only customer appears ONLY in Cash Sale module'
  );
  check(
    !cashList.some((c) => c.id === 'test-sp-only') &&
      !creditList.some((c) => c.id === 'test-sp-only') &&
      spList.some((c) => c.id === 'test-sp-only'),
    'Sale Proceeds only customer appears ONLY in Sale Proceeds module'
  );
  check(
    cashList.some((c) => c.id === 'test-dual-cash-credit') &&
      creditList.some((c) => c.id === 'test-dual-cash-credit') &&
      !spList.some((c) => c.id === 'test-dual-cash-credit'),
    'Cash + Credit customer appears in Cash Sale and Credit Sale, excluded from Sale Proceeds'
  );

  // Verify zero duplicate customer records created for dualCust
  const matchingDualRecords = db.getCustomers().filter((c) => c.id === 'test-dual-cash-credit');
  check(matchingDualRecords.length === 1, 'Multi-type assignment uses a single customer record with zero duplicates');

  // 3. Updating Customer Type Later
  console.log('\n--- 3. Editing Customer Types Safely ---');
  db.saveCustomer({
    ...cashOnlyCust,
    customerTypes: ['cash_sale', 'sale_proceeds'],
  });
  check(
    db.getCustomersByType('sale_proceeds').some((c) => c.id === 'test-cash-only') &&
      db.getCustomersByType('cash_sale').some((c) => c.id === 'test-cash-only') &&
      db.getCustomers().filter((c) => c.id === 'test-cash-only').length === 1,
    'Updating customer types updates visibility immediately without creating duplicates'
  );

  // 4. Legacy Migration Check
  console.log('\n--- 4. Safe Legacy Customer Migration ---');
  const legacyNoType: Customer = {
    id: 'test-legacy-sp',
    name: 'Legacy SP Customer',
    mobile: '9000000099',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
  // Write raw customer without customerTypes directly into storage BEFORE transaction
  const rawList = db.getCustomers();
  db.saveSaleProceeds({
    id: 'sp-legacy-tx',
    proceedsNo: 'SP-LEG-1',
    sequenceNumber: 99,
    date: '2026-10-15',
    challanDate: '2026-10-15',
    customerId: 'test-legacy-sp',
    customerName: 'Legacy SP Customer',
    items: [],
    quantity: 10,
    unit: 'Crate',
    rate: 100,
    amount: 1000,
    expenses: [],
    totalExpense: 0,
    netAmount: 1000,
    difference: 0,
    createdAt: new Date().toISOString(),
  });
  localStorage.setItem('hk_erp_customers', JSON.stringify([...rawList, legacyNoType]));
  const migratedLegacy = db.getCustomerById('test-legacy-sp');
  check(
    Boolean(migratedLegacy && Array.isArray(migratedLegacy.customerTypes) && migratedLegacy.customerTypes.includes('sale_proceeds')),
    'Legacy customer missing customerTypes auto-migrates safely from existing Sale Proceeds history'
  );

  // 5. Strict Ledger Isolation (Credit Sale vs Cash Sale vs Sale Proceeds)
  console.log('\n--- 5. Strict Ledger Isolation ---');
  db.saveCashSale({
    id: 'cash-iso-1',
    cashSaleNo: 'CASH-ISO-1',
    sequenceNumber: 99,
    date: '2026-10-16',
    customerId: 'test-dual-cash-credit',
    customerName: 'Test Dual Buyer',
    items: [],
    crateIn: 0,
    crateOut: 0,
    crateWeightKg: 20,
    expenses: [],
    productTotal: 1500,
    expenseTotal: 0,
    totalAmount: 1500,
    finalAmount: 1500,
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
    receivedAmount: 1500,
    createdAt: new Date().toISOString(),
  });
  db.saveCreditSale({
    id: 'cs-iso-1',
    creditSaleNo: 'CS-ISO-1',
    sequenceNumber: 99,
    date: '2026-10-16',
    customerId: 'test-dual-cash-credit',
    customerName: 'Test Dual Buyer',
    items: [],
    crateIn: 0,
    crateOut: 0,
    crateWeightKg: 20,
    expenses: [],
    productTotal: 3000,
    expenseTotal: 0,
    totalDebit: 3000,
    finalAmount: 3000,
    createdAt: new Date().toISOString(),
  });
  db.saveSaleProceeds({
    id: 'sp-iso-1',
    proceedsNo: 'SP-ISO-1',
    sequenceNumber: 100,
    date: '2026-10-16',
    challanDate: '2026-10-16',
    customerId: 'test-sp-only',
    customerName: 'Test Consignor Party',
    items: [],
    quantity: 20,
    unit: 'Crate',
    rate: 200,
    amount: 4000,
    expenses: [],
    totalExpense: 0,
    netAmount: 4000,
    difference: 0,
    createdAt: new Date().toISOString(),
  });

  const dualCreditLedger = getCustomerLedger('test-dual-cash-credit');
  check(
    dualCreditLedger.entries.some((e) => e.referenceNo === 'CS-ISO-1') &&
      !dualCreditLedger.entries.some((e) => e.referenceNo === 'CASH-ISO-1') &&
      dualCreditLedger.closingBalance === 5500, // 2500 OB + 3000 Credit Sale
    'Customer Ledger strictly includes Credit Sales/Receipts only and excludes Cash Sales'
  );

  const spOnlyCreditLedger = getCustomerLedger('test-sp-only');
  check(
    !spOnlyCreditLedger.entries.some((e) => e.referenceNo === 'SP-ISO-1'),
    'Customer Ledger strictly excludes Sale Proceeds transactions'
  );

  const spOnlyProceedsLedger = getSaleProceedsLedger({ customerId: 'test-sp-only' });
  check(
    spOnlyProceedsLedger.entries.some((e) => e.referenceNo === 'SP-ISO-1') &&
      !spOnlyProceedsLedger.entries.some((e) => e.referenceNo === 'CS-ISO-1') &&
      spOnlyProceedsLedger.closingBalance === 9000, // 5000 SP OB + 4000 SP netAmount
    'Sale Proceeds Ledger strictly includes Sale Proceeds + SP Opening Balance (₹5,000 + ₹4,000 = ₹9,000)'
  );

  const outstandings = getAllCustomerOutstandings();
  const spOutstanding = outstandings.find((o) => o.customer.id === 'test-sp-only');
  check(
    Boolean(spOutstanding && spOutstanding.closingBalance === 0),
    'Sale Proceeds-only customer does not pollute Credit Sale outstandings'
  );

  // 6. Excel Helpers Check
  console.log('\n--- 6. Excel Type Formatting & Parsing ---');
  check(
    formatCustomerTypesLabel(['cash_sale', 'sale_proceeds']) === 'Cash Sale, Sale Proceeds',
    'formatCustomerTypesLabel formats multiple types cleanly'
  );
  const parsed = parseCustomerTypesFromText('Cash Sale, Credit Sale, Sale Proceeds');
  check(
    parsed.length === 3 && parsed.includes('cash_sale') && parsed.includes('credit_sale') && parsed.includes('sale_proceeds'),
    'parseCustomerTypesFromText parses multi-type strings cleanly'
  );

  // 7. SSR Checks for Sale Proceeds Customer Profile, Directory Tabs & Add Customer Modal
  console.log('\n--- 7. SSR UI Rendering Checks ---');
  const spProfileHtml = renderToStaticMarkup(
    React.createElement(SaleProceedsLedgerView, { initialCustomerId: 'test-sp-only' })
  );
  check(
    spProfileHtml.includes('id="sale-proceeds-customer-profile"') &&
      spProfileHtml.includes('Test Consignor Party') &&
      spProfileHtml.includes('Sale Proceeds Customer') &&
      spProfileHtml.includes('9000000002') &&
      spProfileHtml.includes('Plot 12, Market Yard') &&
      spProfileHtml.includes('123456789012') &&
      spProfileHtml.includes('SP-ISO-1') &&
      spProfileHtml.includes('id="sale-proceeds-short-print-area"') &&
      spProfileHtml.includes('id="sale-proceeds-print-area"'),
    'SaleProceedsLedgerView renders Sale Proceeds Customer Profile + SP entries + intact print containers'
  );

  const dirHtml = renderToStaticMarkup(
    React.createElement(CustomerDirectoryView, {
      onNavigateToLedger: () => {},
      onNavigateToSaleProceedsLedger: () => {},
      onNavigateToCrate: () => {},
      onNavigateToCreditSales: () => {},
      onNavigateToReceipts: () => {},
    })
  );
  check(
    dirHtml.includes('All Customers') &&
      dirHtml.includes('Cash Sale') &&
      dirHtml.includes('Credit Sale') &&
      dirHtml.includes('Sale Proceeds') &&
      dirHtml.includes('SP Profile'),
    'CustomerDirectoryView renders Customer Type filter tabs and SP Profile action'
  );

  const addModalHtml = renderToStaticMarkup(
    React.createElement(AddCustomerModal, {
      isOpen: true,
      onClose: () => {},
      onCustomerCreated: () => {},
    })
  );
  check(
    addModalHtml.includes('Customer Type') &&
      addModalHtml.includes('Cash Sale') &&
      addModalHtml.includes('Credit Sale') &&
      addModalHtml.includes('Sale Proceeds'),
    'AddCustomerModal renders multi-select Customer Type checkboxes'
  );

  console.log(`\n=== SUMMARY: ${passes} Passed, ${failures} Failed ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

run();
