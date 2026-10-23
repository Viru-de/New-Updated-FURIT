import assert from 'assert';
import fs from 'fs';
import path from 'path';
import * as jspdfModule from 'jspdf';
const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default;
import { PAPER_SIZE_SPECS, BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { calculateWholesaleItemAmount, calculateSaleCrateSummary } from '../src/utils/billingCalculations';
import { db } from '../src/services/db';

console.log('=== TEST SUITE: Paper Formats & Zero-Blank-Page Regression Verification ===\n');

let passes = 0;
let failures = 0;

function expect(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passes++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    failures++;
  }
}

// =========================================================================
// 1. PAPER SPECIFICATIONS & PHYSICAL DIMENSIONS ACROSS ALL 5 FORMATS
// =========================================================================
console.log('--- 1. Testing Paper Specifications & Physical Dimensions ---');

const supportedSizes: BillPaperSize[] = ['compact', 'a4', 'a5', 'b6', 'b7'];

expect(supportedSizes.length === 5, 'Exactly 5 paper formats supported');

// Compact (Mandi)
const compactSpec = PAPER_SIZE_SPECS['compact'];
expect(compactSpec.widthMm === 140, 'Compact width is exactly 140 mm');
expect(compactSpec.heightMm === 210, 'Compact height is exactly 210 mm');
expect(compactSpec.dimensionsMm.includes('140') && compactSpec.dimensionsMm.includes('210'), 'Compact dimensions label is 140 × 210 mm');

// A4 Standard
const a4Spec = PAPER_SIZE_SPECS['a4'];
expect(a4Spec.widthMm === 210, 'A4 width is exactly 210 mm');
expect(a4Spec.heightMm === 297, 'A4 height is exactly 297 mm');
expect(a4Spec.defaultFor === 'statement', 'A4 is defaultFor statements/reports');

// A5
const a5Spec = PAPER_SIZE_SPECS['a5'];
expect(a5Spec.widthMm === 148, 'A5 width is exactly 148 mm');
expect(a5Spec.heightMm === 210, 'A5 height is exactly 210 mm');

// B6 (ISO standard)
const b6Spec = PAPER_SIZE_SPECS['b6'];
expect(b6Spec.widthMm === 125, 'B6 width is exactly 125 mm');
expect(b6Spec.heightMm === 176, 'B6 height is exactly 176 mm');
expect(b6Spec.dimensionsMm.includes('125') && b6Spec.dimensionsMm.includes('176'), 'B6 dimensions label is 125 × 176 mm');

// B7 (ISO standard)
const b7Spec = PAPER_SIZE_SPECS['b7'];
expect(b7Spec.widthMm === 88, 'B7 width is exactly 88 mm');
expect(b7Spec.heightMm === 125, 'B7 height is exactly 125 mm');
expect(!!b7Spec.warning, 'B7 includes space notice warning for compact layout');

// =========================================================================
// 2. REAL JSPDF DIMENSIONS VERIFICATION ACROSS ALL 5 FORMATS
// =========================================================================
console.log('\n--- 2. Testing Real jsPDF Dimensions for all 5 Formats ---');

supportedSizes.forEach((size) => {
  const spec = PAPER_SIZE_SPECS[size];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [spec.widthMm, spec.heightMm],
  });

  const pageWidth = Math.round(doc.internal.pageSize.getWidth());
  const pageHeight = Math.round(doc.internal.pageSize.getHeight());

  expect(
    pageWidth === spec.widthMm && pageHeight === spec.heightMm,
    `jsPDF generated with real physical dimensions for ${spec.name} (${spec.widthMm} × ${spec.heightMm} mm)`
  );

  // Add sample content and verify page count is 1
  doc.setFontSize(10);
  doc.text(`TEST INVOICE - ${spec.name}`, 10, 15);
  expect(doc.getNumberOfPages() === 1, `Single-page document produces exactly 1 page in ${spec.name}`);
});

// =========================================================================
// 3. MULTI-PAGE PAGINATION & OVERFLOW TEST
// =========================================================================
console.log('\n--- 3. Testing Multi-Page Pagination in Small and Standard Formats ---');

// Test B6 pagination
const b6Doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [125, 176],
});
b6Doc.text('Page 1 Header', 10, 15);
b6Doc.addPage([125, 176]);
b6Doc.text('Page 2 Content', 10, 15);
expect(b6Doc.getNumberOfPages() === 2, 'B6 multi-page document paginates cleanly to 2 pages');
expect(Math.round(b6Doc.internal.pageSize.getWidth()) === 125, 'Page 2 in B6 maintains 125mm width');
expect(Math.round(b6Doc.internal.pageSize.getHeight()) === 176, 'Page 2 in B6 maintains 176mm height');

// Test A4 pagination
const a4Doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [210, 297],
});
a4Doc.text('Ledger Page 1', 10, 15);
a4Doc.addPage([210, 297]);
a4Doc.text('Ledger Page 2', 10, 15);
a4Doc.addPage([210, 297]);
a4Doc.text('Ledger Page 3', 10, 15);
expect(a4Doc.getNumberOfPages() === 3, 'A4 multi-page document paginates cleanly to 3 pages');

// =========================================================================
// 4. PRINT CSS ISOLATION & ZERO-BLANK-PAGE VERIFICATION
// =========================================================================
console.log('\n--- 4. Testing Print CSS Isolation & Zero-Blank-Page Rules ---');

const indexCss = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

expect(indexCss.includes('@media print'), '@media print block is defined in index.css');
expect(indexCss.includes('.min-h-screen') && indexCss.includes('min-height: 0 !important'), 'Tailwind min-h-screen collapsed to min-height: 0 in print to prevent 100vh blank leading page');
expect(indexCss.includes('#root') && indexCss.includes('height: auto !important'), '#root height set to auto in print');
expect(indexCss.includes('.fixed.inset-0') && indexCss.includes('position: static !important'), 'Modal fixed backdrop unconstrained to static in print');
expect(indexCss.includes('page-break-before: avoid !important') || indexCss.includes('break-before: avoid !important'), 'break-before: avoid applied to print containers to guarantee bill starts on page 1');
expect(indexCss.includes('main > div > *:not(:has(#mandi-print-area))'), 'Background page siblings hidden when modal is printing to eliminate preceding height');
expect(indexCss.includes('.no-print') && indexCss.includes('display: none !important'), '.no-print elements completely removed from layout flow (display: none)');
expect(indexCss.includes('table-header-group !important'), 'Table thead repeats on every page in multi-page print (display: table-header-group)');
expect(indexCss.includes('page-break-inside: avoid !important') || indexCss.includes('break-inside: avoid !important'), 'Table rows avoid page breaks inside rows');

// =========================================================================
// 5. NO-PRINT CLASSES ON ON-SCREEN CONTAINERS IN LIST VIEWS
// =========================================================================
console.log('\n--- 5. Testing no-print Classes on View Containers ---');

const creditSaleListTsx = fs.readFileSync(path.resolve('./src/components/accounts/CreditSaleListView.tsx'), 'utf-8');
expect(creditSaleListTsx.includes('space-y-3 no-print'), 'CreditSaleListView cards container marked with no-print');

const cashSaleListTsx = fs.readFileSync(path.resolve('./src/components/accounts/CashSaleListView.tsx'), 'utf-8');
expect(cashSaleListTsx.includes('space-y-3 no-print'), 'CashSaleListView table container marked with no-print');

const saleProceedsListTsx = fs.readFileSync(path.resolve('./src/components/accounts/SaleProceedsListView.tsx'), 'utf-8');
expect(saleProceedsListTsx.includes('space-y-3.5 no-print'), 'SaleProceedsListView cards container marked with no-print');

const receiptListTsx = fs.readFileSync(path.resolve('./src/components/accounts/ReceiptListView.tsx'), 'utf-8');
expect(receiptListTsx.includes('overflow-hidden no-print'), 'ReceiptListView table container marked with no-print');

const groupSaleTsx = fs.readFileSync(path.resolve('./src/components/billing/GroupSaleView.tsx'), 'utf-8');
expect(groupSaleTsx.includes('gap-3.5 no-print'), 'GroupSaleView summary cards marked with no-print');
expect(groupSaleTsx.includes('max-w-full min-w-0 no-print'), 'GroupSaleView editable table marked with no-print so only summary prints');

const customerLedgerTsx = fs.readFileSync(path.resolve('./src/components/accounts/CustomerLedgerView.tsx'), 'utf-8');
expect(customerLedgerTsx.includes('gap-4 no-print'), 'CustomerLedgerView on-screen header marked with no-print');

const crateStmtTsx = fs.readFileSync(path.resolve('./src/components/accounts/CrateStatementView.tsx'), 'utf-8');
expect(crateStmtTsx.includes('gap-4 no-print'), 'CrateStatementView on-screen header marked with no-print');

const reportsTsx = fs.readFileSync(path.resolve('./src/components/reports/ReportsView.tsx'), 'utf-8');
expect(reportsTsx.includes('gap-4 no-print'), 'ReportsView on-screen header marked with no-print');

// =========================================================================
// 6. DYNAMIC PAPER SIZING & CONTROLS ACROSS MODALS
// =========================================================================
console.log('\n--- 6. Testing Paper Sizing and Format Controls in Modals ---');

const billTableCanvasTsx = fs.readFileSync(path.resolve('./src/components/common/BillTableCanvas.tsx'), 'utf-8');
expect(billTableCanvasTsx.includes("pageSize === 'b7' ? 2 : pageSize === 'b6' ? 4"), 'BillTableCanvas scales minRows based on pageSize to prevent empty row overflow');
expect(billTableCanvasTsx.includes("max-w-[430px]"), 'BillTableCanvas B6 max-width fits within 117mm printable width');
expect(billTableCanvasTsx.includes("max-w-[300px]"), 'BillTableCanvas B7 max-width fits within 82mm printable width');

const saleProceedModalTsx = fs.readFileSync(path.resolve('./src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
expect(saleProceedModalTsx.includes("pageSize === 'b7' ? 2 : pageSize === 'b6' ? 4"), 'SaleProceedPrintModal scales minRows based on pageSize');
expect(saleProceedModalTsx.includes("max-w-[430px]"), 'SaleProceedPrintModal B6 sizeClass fits within printable width');

const receiptModalTsx = fs.readFileSync(path.resolve('./src/components/print/ReceiptPrintModal.tsx'), 'utf-8');
expect(receiptModalTsx.includes("max-w-[430px]"), 'ReceiptPrintModal implements dynamic paper sizing for B6');
expect(receiptModalTsx.includes("ChooseBillPrintFormatModal"), 'ReceiptPrintModal renders ChooseBillPrintFormatModal');

const billHistoryTsx = fs.readFileSync(path.resolve('./src/components/billing/BillHistoryView.tsx'), 'utf-8');
expect(billHistoryTsx.includes("ChooseBillPrintFormatModal"), 'BillHistoryView renders ChooseBillPrintFormatModal');
expect(billHistoryTsx.includes("max-w-[430px]"), 'BillHistoryView supports B6 paper sizing');

const createBillTsx = fs.readFileSync(path.resolve('./src/components/billing/CreateBillView.tsx'), 'utf-8');
expect(createBillTsx.includes("ChooseBillPrintFormatModal"), 'CreateBillView renders ChooseBillPrintFormatModal');
expect(createBillTsx.includes("max-w-[430px]"), 'CreateBillView supports B6 paper sizing');

// =========================================================================
// 7. PRESERVATION OF CORE BUSINESS LOGIC & CRATE CALCULATIONS
// =========================================================================
console.log('\n--- 7. Testing Preservation of Business Calculations ---');

// Crate Rule A: Qty * Rate when Kg == 0
expect(calculateWholesaleItemAmount(10, 'Crate', 0, 1000) === 10000, 'Crate with Kg=0: 10 * 1000 = 10,000');
// Crate Rule B: Kg * Rate when Kg > 0
expect(calculateWholesaleItemAmount(20, 'Crate', 400, 50) === 20000, 'Crate with Kg=400: 400 * 50 = 20,000');
// Box: Qty * Rate
expect(calculateWholesaleItemAmount(15, 'Box', 0, 200) === 3000, 'Box with Kg=0: 15 * 200 = 3,000');
// Box: Kg * Rate when weight entered
expect(calculateWholesaleItemAmount(10, 'Box', 120, 100) === 12000, 'Box with Kg=120: 120 * 100 = 12,000');

// Crate summary breakdown
const items = [
  { fruitName: 'ANAR', quantity: 20, unit: 'Crate', crateSize: 20, rate: 50, amount: 20000 },
  { fruitName: 'GRAPES 10KG', quantity: 10, unit: 'Crate', crateSize: 10, rate: 50, amount: 10000 },
  { fruitName: 'APPLE BOX', quantity: 5, unit: 'Box', rate: 100, amount: 500 },
];
const crateSum = calculateSaleCrateSummary(items);
expect(crateSum.totalBalanceCrates === 30, 'Crate summary counts only Crate units (20 + 10 = 30 crates, Box excluded)');
expect(crateSum.breakdown.length === 2, 'Breakdown has 2 distinct crate sizes');
expect(crateSum.breakdown.some(b => b.weightKg === 10 && b.count === 10), '10kg breakdown = 10 crates');
expect(crateSum.breakdown.some(b => b.weightKg === 20 && b.count === 20), '20kg breakdown = 20 crates');

console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
if (failures > 0) {
  process.exit(1);
} else {
  console.log('ALL PAPER FORMAT REGRESSION VERIFICATION TESTS PASSED SUCCESSFULLY!');
}
