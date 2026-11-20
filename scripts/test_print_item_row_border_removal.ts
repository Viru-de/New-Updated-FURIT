import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { db } from '../src/services/db';
import { BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';

let passes = 0;
let failures = 0;

function check(condition: boolean, message: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${message}`);
    passes++;
  } else {
    console.error(`[FAIL] ${message}${detail ? ' — ' + detail : ''}`);
    failures++;
  }
}

console.log('=== TEST SUITE: Remove Horizontal Border Below Item Name Rows in Print ===\n');

const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
const pdfEngine = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');
const billTableCanvas = fs.readFileSync(path.join(process.cwd(), 'src/components/common/BillTableCanvas.tsx'), 'utf-8');
const saleProceedModal = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
const createBillView = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/CreateBillView.tsx'), 'utf-8');
const billHistoryView = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/BillHistoryView.tsx'), 'utf-8');
const groupSaleView = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/GroupSaleView.tsx'), 'utf-8');

// 1. Verify CSS rules exist in both @media print and preview/PDF scopes
const printIdx = indexCss.indexOf('@media print');
check(printIdx !== -1, 'index.css contains @media print block');

const prePrintCss = indexCss.slice(0, printIdx);
const printCss = indexCss.slice(printIdx);

const expectedTargets = [
  '#mandi-print-area > table > tbody > tr:not(.border-b-2)',
  '#mandi-print-area > table > tbody > tr:not(.border-b-2) > td',
];

for (const sel of expectedTargets) {
  check(prePrintCss.includes(sel), `Preview/PDF CSS includes selector: ${sel}`);
  check(printCss.includes(sel), `@media print CSS includes selector: ${sel}`);
}

check(
  printCss.includes('#erp-isolated-print-mount #mandi-print-area > table > tbody > tr:not(.border-b-2) > td'),
  '@media print targets isolated print mount #mandi-print-area item/blank rows'
);
check(
  printCss.includes('#group-sale-print-summary > table > tbody > tr:not(.border-b-2) > td') &&
    printCss.includes('#erp-isolated-print-mount #group-sale-print-summary > table > tbody > tr:not(.border-b-2) > td'),
  '@media print targets #group-sale-print-summary item rows (normal & isolated mount)'
);
check(
  prePrintCss.includes('[data-pdf-export="true"]#group-sale-print-summary > table > tbody > tr:not(.border-b-2) > td') &&
    prePrintCss.includes('[data-pdf-export="true"] #mandi-print-area > table > tbody > tr:not(.border-b-2) > td'),
  'PDF export CSS targets [data-pdf-export="true"] bill & group-sale item rows'
);
check(
  printCss.includes('border-top-width: 0 !important;') &&
    printCss.includes('border-top-style: none !important;') &&
    printCss.includes('border-bottom-width: 0 !important;') &&
    printCss.includes('border-bottom-style: none !important;'),
  '@media print clears both top and bottom collapsed horizontal borders on item/blank tbody rows'
);

// 2. Verify pdfAndShareEngine tags clonedElement for PDF export
check(
  pdfEngine.includes("clonedElement.setAttribute('data-pdf-export', 'true');"),
  'generatePdfDoc marks cloned DOM with data-pdf-export="true"'
);

// 3. Verify nested summary tables, Total rows, header borders, and ledgers remain intact
check(
  createBillView.includes('<tr className="border-b-2 border-t border-black font-bold') &&
    billHistoryView.includes('<tr className="border-b-2 border-t border-black font-bold') &&
    groupSaleView.includes('<tr className="border-b-2 border-t border-black font-bold'),
  'CreateBillView, BillHistoryView, and GroupSaleView Total rows use .border-b-2 and are preserved by :not(.border-b-2)'
);
check(
  printCss.includes('.sp-short-table tbody tr.sp-zebra-even') &&
    printCss.includes('border: none !important;'),
  'Short Print (.sp-short-table) preserves borderless tbody rows and header borders'
);
check(
  printCss.includes('table.sp-detailed-ref-table thead th') &&
    printCss.includes('table.sp-detailed-ref-table tbody td') &&
    printCss.includes('table.ledger-ref-table tbody td'),
  'Detailed Print (.sp-detailed-ref-table & .ledger-ref-table) rules remain unchanged'
);
check(
  billTableCanvas.includes('<tr className={`border-b border-black font-bold uppercase') &&
    saleProceedModal.includes('<tr className={`border-b border-black font-bold uppercase'),
  'Table thead header border (border-b border-black) remains intact in BillTableCanvas & SaleProceedPrintModal'
);

// 4. Verify SSR rendered HTML preserves all item data, column separators, header borders, and totals across all paper sizes
const profile = db.getDefaultProfile();
const sampleItems = [
  { id: '1', fruitId: 'f1', fruitName: 'APPLE KASHMIR', quantity: 10, unit: 'Box', kg: 200, rate: 50, amount: 10000 },
  { id: '2', fruitId: 'f2', fruitName: 'ALPHONSO MANGO', quantity: 5, unit: 'Crate', kg: 100, rate: 80, amount: 8000 },
];

const sizes: BillPaperSize[] = ['a4', 'a5', 'compact', 'b6', 'b7'];
for (const size of sizes) {
  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType,
        billNumber: '101',
        date: '2026-11-20',
        customerName: 'TEST TRADER',
        items: sampleItems,
        expenses: [{ name: 'Freight', amount: 150 }],
        productTotal: 18000,
        expenseTotal: 150,
        finalAmount: 18150,
        oldBalance: saleType === 'CREDIT SALE' ? 5000 : undefined,
        profile,
        pageSize: size,
      })
    );

    check(
      html.includes('APPLE KASHMIR') &&
        html.includes('ALPHONSO MANGO') &&
        html.includes('10000.00') &&
        html.includes('8000.00') &&
        html.includes('Net Total') &&
        html.includes('>15<') &&
        html.includes('>300<'),
      `BillTableCanvas (${saleType} / ${size.toUpperCase()}): renders all item names, amounts, and totals intact`
    );
    check(
      html.includes('border-r border-black') && html.includes('border-b border-black'),
      `BillTableCanvas (${saleType} / ${size.toUpperCase()}): preserves vertical column dividers and thead/tfoot black borders`
    );
  }
}

// 5. Verify accounting calculation untouched
check(
  calculateWholesaleItemAmount(10, 'Box', 200, 50) === 10000 &&
    calculateWholesaleItemAmount(10, 'Box', 0, 500) === 5000,
  'Wholesale calculation logic untouched'
);

console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
if (failures > 0) process.exit(1);
