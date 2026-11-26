import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedsLedgerView } from '../src/components/accounts/SaleProceedsLedgerView';
import { CustomerLedgerView } from '../src/components/accounts/CustomerLedgerView';
import { stripLedgerCrateInOut } from '../src/utils/shortPrintUtils';
import { stampPdfDynamicPageNumbers } from '../src/utils/pdfAndShareEngine';
import { db } from '../src/services/db';
import { BillingLineItem } from '../src/utils/billingCalculations';

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

async function run() {
  console.log('=== TEST SUITE: Ledger Fonts, Remove IN/OUT, B7 10-Item Layout & Dynamic Page Numbers ===\n');

  // 1. stripLedgerCrateInOut
  console.log('--- 1. Testing stripLedgerCrateInOut ---');
  check(stripLedgerCrateInOut('6 Out') === '6', 'Strips "6 Out" -> "6"');
  check(stripLedgerCrateInOut('10 In') === '10', 'Strips "10 In" -> "10"');
  check(
    stripLedgerCrateInOut('Out, 6 In (Bal: 31)') === '6 (Bal: 31)',
    'Strips "Out, 6 In (Bal: 31)" -> "6 (Bal: 31)"',
    stripLedgerCrateInOut('Out, 6 In (Bal: 31)')
  );
  check(
    stripLedgerCrateInOut('Crates OUT: 12, IN: 4 (Bal: 8)') === '12, 4 (Bal: 8)',
    'Strips "Crates OUT: 12, IN: 4 (Bal: 8)" -> "12, 4 (Bal: 8)"',
    stripLedgerCrateInOut('Crates OUT: 12, IN: 4 (Bal: 8)')
  );
  check(
    stripLedgerCrateInOut('Paid in full') === 'Paid in full',
    'Preserves normal English phrase "Paid in full"'
  );
  check(
    stripLedgerCrateInOut('Opening Balance') === 'Opening Balance',
    'Preserves "Opening Balance"'
  );

  // 2. SaleProceedsLedgerView & CustomerLedgerView SSR checks
  console.log('\n--- 2. Testing SaleProceedsLedgerView & CustomerLedgerView Print Output ---');
  const customers = db.getCustomers();
  const firstCustId = customers[0]?.id || '';

  const spHtml = renderToStaticMarkup(React.createElement(SaleProceedsLedgerView, {}));
  const spShortStart = spHtml.indexOf('id="sale-proceeds-short-print-area"');
  const spFullStart = spHtml.indexOf('id="sale-proceeds-print-area"');
  check(spShortStart !== -1 && spFullStart !== -1, 'SaleProceedsLedgerView renders both short and detailed print containers');

  const spShortSection = spHtml.slice(spShortStart, spFullStart);
  const spFullSection = spHtml.slice(spFullStart);

  check(
    spShortSection.includes('sp-ledger-uniform-font') &&
      spFullSection.includes('sp-ledger-uniform-font') &&
      !spShortSection.includes('font-mono') &&
      !spFullSection.includes('font-mono'),
    'SaleProceedsLedgerView print areas use uniform font class without font-mono'
  );
  check(
    !spShortSection.includes('Page 1 of 1') &&
      !spFullSection.includes('Page 1 of 1') &&
      spShortSection.includes('data-dynamic-page-numbers="true"') &&
      spFullSection.includes('data-dynamic-page-numbers="true"') &&
      spShortSection.includes('data-sp-page-footer="true"') &&
      spFullSection.includes('data-sp-page-footer="true"'),
    'SaleProceedsLedgerView removes hardcoded "Page 1 of 1" and adds dynamic page footer markers'
  );

  // Seed temporary transaction with Out/In crate text to verify CustomerLedgerView strips Out/In in print only
  const tempCustId = 'test-cust-inout-' + Date.now();
  const tempCsId = 'test-cs-inout-' + Date.now();
  db.saveCustomer({
    id: tempCustId,
    name: 'Test Ledger Party',
    mobile: '9876543210',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    active: true,
    createdAt: '2026-04-01T00:00:00.000Z',
  });
  db.saveCreditSale({
    id: tempCsId,
    creditSaleNo: 'Credit Sale No. 999',
    sequenceNumber: 999,
    date: '2026-04-10',
    customerId: tempCustId,
    customerName: 'Test Ledger Party',
    items: [
      { id: 'i1', fruitId: 'f1', fruitName: 'ALPHONSO MANGO', quantity: 6, unit: 'Crate', kg: 120, rate: 100, amount: 12000 },
    ],
    crateIn: 4,
    crateOut: 6,
    crateWeightKg: 0,
    crateMovements: [{ crateTypeId: 'ct1', crateName: '20Kg', outQuantity: 6, inQuantity: 4 }],
    expenses: [],
    productTotal: 12000,
    expenseTotal: 0,
    totalDebit: 12000,
    finalAmount: 12000,
    netTotal: 12000,
    oldBalance: 0,
    cashReceipt: 0,
    totalBalance: 12000,
    createdAt: new Date().toISOString(),
  });

  try {
    const clHtml = renderToStaticMarkup(
      React.createElement(CustomerLedgerView, { initialCustomerId: tempCustId || firstCustId })
    );
    const clDetStart = clHtml.indexOf('id="customer-ledger-detailed-print-area"');
    const clShortStart = clHtml.indexOf('id="customer-ledger-short-print-area"');
    check(clDetStart !== -1 && clShortStart !== -1, 'CustomerLedgerView renders both detailed and short print containers');

    const clDetSection = clHtml.slice(clDetStart, clShortStart);
    const clShortSection = clHtml.slice(clShortStart);

    check(
      clDetSection.includes('sp-ledger-uniform-font') &&
        clShortSection.includes('sp-ledger-uniform-font') &&
        !clDetSection.includes('font-mono') &&
        !clShortSection.includes('font-mono'),
      'CustomerLedgerView detailed and short print areas use uniform font without font-mono'
    );
    check(
      !clDetSection.includes('Page 1 of 1') &&
        !clShortSection.includes('Page 1 of 1') &&
        clDetSection.includes('data-dynamic-page-numbers="true"') &&
        clShortSection.includes('data-dynamic-page-numbers="true"'),
      'CustomerLedgerView removes hardcoded "Page 1 of 1" and enables dynamic page footer'
    );
    check(
      !clDetSection.includes('6 Out') &&
        !clDetSection.includes('4 In') &&
        clDetSection.includes('20Kg: 6, 4'),
      'CustomerLedgerView removes Out/In words from printed crate summary while keeping quantities (20Kg: 6, 4)'
    );
    check(
      clDetSection.includes('12000.00'),
      'CustomerLedgerView preserves untouched debit/balance calculations (12000.00)'
    );
  } finally {
    db.deleteCreditSale(tempCsId);
    db.deleteCustomer(tempCustId);
  }

  // 3. BillTableCanvas B7 10-item cap & centering for Credit Sale & Cash Sale
  console.log('\n--- 3. Testing Credit Sale & Cash Sale B7 10-Item Cap & Layout ---');
  const fifteenItems: BillingLineItem[] = Array.from({ length: 15 }, (_, idx) => ({
    id: `it-${idx + 1}`,
    fruitId: `f-${idx + 1}`,
    fruitName: `FRUIT ITEM ${idx + 1}`,
    quantity: 2,
    unit: 'Crate',
    kg: 20,
    rate: 100,
    amount: 2000,
  }));
  // Total Qty = 30, Total Weight = 300, Product Total = 30000
  const profile = db.getDefaultProfile();

  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    const html15 = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType,
        billNumber: saleType === 'CREDIT SALE' ? 'CS-500' : 'CASH-500',
        date: '2026-05-01',
        customerName: 'Ramesh Traders',
        items: fifteenItems,
        expenses: [{ id: 'e1', name: 'Hamali', amount: 500 }],
        oldBalance: saleType === 'CREDIT SALE' ? 5000 : undefined,
        cashReceipt: saleType === 'CREDIT SALE' ? 1000 : undefined,
        paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
        profile,
        pageSize: 'b7',
      })
    );

    check(
      html15.includes('>FRUIT ITEM 1<') &&
        html15.includes('>FRUIT ITEM 10<') &&
        !html15.includes('>FRUIT ITEM 11<') &&
        !html15.includes('>FRUIT ITEM 15<'),
      `${saleType} B7 displays max 10 item rows in original order (items 1-10 shown, 11-15 hidden)`
    );
    check(
      html15.includes('>30<') && html15.includes('>300<') && html15.includes('30000.00') && html15.includes('30500.00'),
      `${saleType} B7 preserves full calculations across all 15 items (Qty 30, KG 300, Total 30000.00, Net 30500.00)`
    );
    check(
      html15.includes('min-h-[534px]') &&
        html15.includes('flex flex-col justify-center') &&
        html15.includes('data-compat-105="true"'),
      `${saleType} B7 enables balanced vertical/horizontal centering on 105 × 148.5 mm page`
    );
  }

  // 4. jsPDF Dynamic Page Numbering (1-page, 2-page, 3-page)
  console.log('\n--- 4. Testing Dynamic Page Numbering in jsPDF Output ---');
  for (const totalPages of [1, 2, 3]) {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [210, 297] });
    for (let p = 2; p <= totalPages; p++) {
      doc.addPage([210, 297]);
    }
    stampPdfDynamicPageNumbers(doc, totalPages, 210, 297, 'HariKripa Fruit Company');
    const pdfRaw = doc.output('datauristring') + '\n' + doc.output();
    let allFound = true;
    for (let p = 1; p <= totalPages; p++) {
      if (!pdfRaw.includes(`Page ${p} of ${totalPages}`)) {
        allFound = false;
      }
    }
    check(
      allFound && doc.getNumberOfPages() === totalPages,
      `jsPDF multi-page footer renders exact Page X of ${totalPages} on all ${totalPages} page(s)`
    );
  }

  // 5. CSS rules verification
  console.log('\n--- 5. Testing src/index.css Rules ---');
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    cssSrc.includes('.sp-ledger-uniform-font') &&
      cssSrc.includes('.sp-print-page') &&
      cssSrc.includes('.sp-page-footer') &&
      cssSrc.includes('min-height: 141mm !important;') &&
      cssSrc.includes('min-height: 542px !important;'),
    'src/index.css includes uniform ledger font rules, print page footer rules, and Compat 105 centering rules'
  );

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
