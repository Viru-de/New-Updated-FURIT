import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedsLedgerView } from '../src/components/accounts/SaleProceedsLedgerView';
import { CustomerLedgerView } from '../src/components/accounts/CustomerLedgerView';
import { CrateStatementView } from '../src/components/accounts/CrateStatementView';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { formatBillCrateMovementText, stripLedgerCrateInOut } from '../src/utils/shortPrintUtils';
import { BillPaperSize, stampPdfDynamicPageNumbers } from '../src/utils/pdfAndShareEngine';
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

  // 3. BillTableCanvas B7 10-item per page pagination & fixed header/footer layout for Credit Sale & Cash Sale
  console.log('\n--- 3. Testing Credit Sale & Cash Sale B7 10-Item Pagination & Layout ---');
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

    const page1Match = html15.match(/data-b7-page="1"[\s\S]*?(?=data-b7-page="2")/)?.[0] || '';
    const page2Match = html15.match(/data-b7-page="2"[\s\S]*$/)?.[0] || '';
    check(
      page1Match.includes('>FRUIT ITEM 1<') &&
        page1Match.includes('>FRUIT ITEM 10<') &&
        !page1Match.includes('>FRUIT ITEM 11<') &&
        page2Match.includes('>FRUIT ITEM 11<') &&
        page2Match.includes('>FRUIT ITEM 15<'),
      `${saleType} B7 paginates max 10 item rows per page (items 1-10 on page 1, items 11-15 on page 2)`
    );
    check(
      html15.includes('>30<') && html15.includes('>300<') && html15.includes('30000.00') && html15.includes('30500.00'),
      `${saleType} B7 preserves full calculations across all 15 items (Qty 30, KG 300, Total 30000.00, Net 30500.00)`
    );
    check(
      html15.includes('min-h-[534px]') &&
        html15.includes('flex flex-col justify-between') &&
        html15.includes('data-compat-105="true"'),
      `${saleType} B7 enables fixed-header/fixed-footer dynamic-middle layout on 105 × 148.5 mm page`
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
      cssSrc.includes('min-height: 139mm !important;') &&
      cssSrc.includes('min-height: 542px !important;'),
    'src/index.css includes uniform ledger font rules, print page footer rules, and Compat 105 centering rules'
  );

  // 6. Remove IN/OUT across ALL bill types, ALL print formats, and CrateStatementView
  console.log('\n--- 6. Testing IN/OUT Removal Across All Bill Formats & Crate Statement ---');
  check(
    formatBillCrateMovementText({ crateName: '20Kg', outQuantity: 10, inQuantity: 0 }) === '20Kg: 10 (10 Bal)',
    'formatBillCrateMovementText formats out-only without "Out"'
  );
  check(
    formatBillCrateMovementText({ crateName: '20Kg', outQuantity: 10, inQuantity: 4 }) === '20Kg: 10, 4 (6 Bal)',
    'formatBillCrateMovementText formats out+in without "Out"/"In"'
  );
  check(
    formatBillCrateMovementText({ crateName: '20Kg', outQuantity: 0, inQuantity: 6 }) === '20Kg: 6 (0 Bal)',
    'formatBillCrateMovementText formats in-only without "Out"/"In"'
  );

  const allPaperSizes: BillPaperSize[] = ['compact', 'b7', 'b6', 'a5', 'a4'];
  const sampleMovements = [
    { crateTypeId: 'ct1', crateName: '20Kg', outQuantity: 10, inQuantity: 4 },
    { crateTypeId: 'ct2', crateName: '10Kg', outQuantity: 5, inQuantity: 0 },
  ];

  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    for (const ps of allPaperSizes) {
      const billHtml = renderToStaticMarkup(
        React.createElement(BillTableCanvas, {
          saleType,
          billNumber: `${saleType === 'CREDIT SALE' ? 'CS' : 'CASH'}-901`,
          date: '2026-05-10',
          customerName: 'Patel Fruit Mart',
          items: fifteenItems.slice(0, 3),
          crateOut: 15,
          crateIn: 4,
          crateWeightKg: 20,
          crateMovements: sampleMovements,
          profile,
          pageSize: ps,
        })
      );
      const hasInOutLabel = /\b(Out|In|OUT|IN)\b/.test(billHtml.replace(/<[^>]+>/g, ' '));
      check(
        !hasInOutLabel && billHtml.includes('20Kg: 10, 4 (6 Bal)') && billHtml.includes('10Kg: 5 (5 Bal)') && billHtml.includes('Balance Crate: 11'),
        `${saleType} [${ps.toUpperCase()}] omits all IN/OUT words while keeping crate quantities and Balance Crate`
      );
    }
  }

  // SaleProceedPrintModal across all formats
  const firstSp = db.getSaleProceeds()[0];
  if (firstSp) {
    const spModalHtml = renderToStaticMarkup(
      React.createElement(SaleProceedPrintModal, { isOpen: true, onClose: () => {}, proceeds: firstSp })
    );
    const spCanvasStart = spModalHtml.indexOf('id="mandi-print-area"');
    const spCanvasText = spModalHtml.slice(spCanvasStart).replace(/<[^>]+>/g, ' ');
    check(!/\b(Out|In|OUT|IN)\b/.test(spCanvasText), 'SaleProceedPrintModal printable canvas contains zero IN/OUT words');
  }

  // CrateStatementView print area
  const crateHtml = renderToStaticMarkup(React.createElement(CrateStatementView, { initialCustomerId: firstCustId }));
  const cratePrintStart = crateHtml.indexOf('id="crate-statement-print-area"');
  check(cratePrintStart !== -1, 'CrateStatementView renders #crate-statement-print-area');
  const cratePrintHtml = crateHtml.slice(cratePrintStart, crateHtml.indexOf('</section>', cratePrintStart) !== -1 ? undefined : crateHtml.length);
  check(
    cratePrintHtml.includes('<span class="hidden print:inline">Issued</span>') &&
      cratePrintHtml.includes('<span class="hidden print:inline">Returned</span>'),
    'CrateStatementView print headers render Issued and Returned without OUT/IN in print & PDF'
  );

  // 7. Bold & Increased Font Sizes Across Sale Proceeds & Customer Ledgers (All 5 Formats, Print & PDF)
  console.log('\n--- 7. Testing Bold & Increased Ledger Typography Across All 5 Print Formats ---');
  check(
    spFullSection.includes('text-[13px] font-bold') &&
      spFullSection.includes('text-[13.5px] font-extrabold') &&
      spFullSection.includes('sp-closing-value text-[16px] font-black') &&
      !spFullSection.includes('text-[12px] font-medium') &&
      !spFullSection.includes('text-[12px] font-normal'),
    'SaleProceedsLedgerView detailed print renders bold 13px inside text and distinct 13.5px/16px headings/totals/closing'
  );
  check(
    spShortSection.includes('text-[13px] font-bold') &&
      spShortSection.includes('text-[13.5px] font-extrabold') &&
      spShortSection.includes('sp-closing-value text-[16px] font-black') &&
      !spShortSection.includes('text-[12px] font-medium'),
    'SaleProceedsLedgerView short print renders bold 13px inside text and distinct 13.5px/16px headings/totals/closing'
  );

  const clCheckHtml = renderToStaticMarkup(React.createElement(CustomerLedgerView, { initialCustomerId: firstCustId }));
  const clCheckDetStart = clCheckHtml.indexOf('id="customer-ledger-detailed-print-area"');
  const clCheckShortStart = clCheckHtml.indexOf('id="customer-ledger-short-print-area"');
  const clCheckDet = clCheckHtml.slice(clCheckDetStart, clCheckShortStart);
  const clCheckShort = clCheckHtml.slice(clCheckShortStart);

  check(
    clCheckDet.includes('text-[13px] font-bold') &&
      clCheckDet.includes('text-[13.5px] font-extrabold') &&
      clCheckDet.includes('sp-closing-value text-[16px] font-black') &&
      !clCheckDet.includes('text-[12px] font-medium') &&
      !clCheckDet.includes('text-[12px] font-normal'),
    'CustomerLedgerView detailed print renders bold 13px inside text and distinct 13.5px/16px headings/totals/closing'
  );
  check(
    clCheckShort.includes('text-[13px] font-bold') &&
      clCheckShort.includes('text-[13.5px] font-extrabold') &&
      clCheckShort.includes('sp-closing-value text-[16px] font-black') &&
      !clCheckShort.includes('text-[12px] font-medium'),
    'CustomerLedgerView short print renders bold 13px inside text and distinct 13.5px/16px headings/totals/closing'
  );

  check(
    cssSrc.includes('font-size: 13px !important;') &&
      cssSrc.includes('font-size: 13.5px !important;') &&
      cssSrc.includes('font-size: 16px !important;') &&
      !cssSrc.includes('font-weight: 500 !important;\n  color: #000000 !important;\n  font-size: 12px !important;'),
    'src/index.css enforces bold 13px ledger body text and removes old 500-weight 12px detail overrides'
  );

  for (const ps of ['a5', 'compact', 'b6', 'b7'] as const) {
    check(
      cssSrc.includes(`[data-pdf-export="true"]#sale-proceeds-print-area[data-paper-size="${ps}"]`) &&
        cssSrc.includes(`[data-pdf-export="true"]#customer-ledger-detailed-print-area[data-paper-size="${ps}"]`) &&
        cssSrc.includes(`#erp-isolated-print-mount #sale-proceeds-print-area[data-paper-size="${ps}"]`) &&
        cssSrc.includes(`#erp-isolated-print-mount #customer-ledger-detailed-print-area[data-paper-size="${ps}"]`),
      `src/index.css includes responsive bold typography and column fit rules for [${ps.toUpperCase()}] in both PDF & Print`
    );
  }

  const pdfEngineSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');
  check(
    pdfEngineSrc.includes("clone.setAttribute('data-paper-size', chosenSize)") &&
      pdfEngineSrc.includes("clonedElement.setAttribute('data-paper-size', paperSize)") &&
      pdfEngineSrc.includes('const measureWidthMm = spec.widthMm >= 200 ? 198 : Math.max(76, spec.widthMm - 6);'),
    'pdfAndShareEngine.ts propagates data-paper-size to both browser print and PDF clones with accurate width measurement'
  );

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
