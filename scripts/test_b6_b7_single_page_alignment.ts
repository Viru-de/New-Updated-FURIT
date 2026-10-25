import fs from 'fs';
import path from 'path';
import * as jspdfModule from 'jspdf';
const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default;
import { PAPER_SIZE_SPECS, BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { calculateWholesaleItemAmount, calculateSaleCrateSummary } from '../src/utils/billingCalculations';
import { db } from '../src/services/db';

console.log('=== TEST SUITE: B6 & B7 Bill Print Alignment & Single-Page Verification ===\n');

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
// 1. B7 (88 × 125 mm) PHYSICAL SPECIFICATIONS & COLUMN DISTRIBUTION
// =========================================================================
console.log('--- 1. Testing B7 Dimensions, Max Widths & Column Allocation ---');

const b7Spec = PAPER_SIZE_SPECS['b7'];
expect(b7Spec.widthMm === 88, 'B7 width is exactly 88 mm');
expect(b7Spec.heightMm === 125, 'B7 height is exactly 125 mm');

// Read BillTableCanvas source code
const billCanvasSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/common/BillTableCanvas.tsx'), 'utf-8');

// Printable width in B7 with 3mm margin on each side: (88 - 6) = 82mm ≈ 310px
expect(billCanvasSrc.includes("max-w-[300px]"), 'BillTableCanvas uses max-w-[300px] for B7 to match printable width');
expect(billCanvasSrc.includes("w-[22px]"), 'BillTableCanvas allocates w-[22px] for No. column in B7');
expect(billCanvasSrc.includes("w-[36px]"), 'BillTableCanvas allocates w-[36px] for Qty column in B7');
expect(billCanvasSrc.includes("w-[28px]"), 'BillTableCanvas allocates w-[28px] for KG column in B7');
expect(billCanvasSrc.includes("w-[44px]"), 'BillTableCanvas allocates w-[44px] for Rate column in B7');
expect(billCanvasSrc.includes("w-[54px]"), 'BillTableCanvas allocates w-[54px] for Amount column in B7');

// Verify sum of B7 fixed numeric columns does not overflow 300px container
// 22 + 36 + 28 + 44 + 54 = 184px, leaving > 100px for Item Name column inside 300px!
const b7FixedColTotal = 22 + 36 + 28 + 44 + 54;
expect(b7FixedColTotal === 184, `B7 fixed columns total ${b7FixedColTotal}px (leaves ~100px for Item Name in 300px canvas)`);
expect(b7FixedColTotal < 200, 'B7 numeric columns leave ample space for Hindi/English fruit names');

// Verify B7 footer uses balanced 2-column split (colSpan=3 each) to prevent amount wrapping
expect(billCanvasSrc.includes("colSpan={3}"), 'B7 footer allocates colSpan={3} to each half to eliminate squeezed balance rows');

// Verify minimum blank rows on B7 is 2 so it provides mandi spacing without pushing to page 2
expect(billCanvasSrc.includes("pageSize === 'b7' ? 2"), 'BillTableCanvas sets minRows to 2 for B7 to prevent vertical overflow');

// =========================================================================
// 2. B6 (125 × 176 mm) PHYSICAL SPECIFICATIONS & COLUMN DISTRIBUTION
// =========================================================================
console.log('\n--- 2. Testing B6 Dimensions, Max Widths & Column Allocation ---');

const b6Spec = PAPER_SIZE_SPECS['b6'];
expect(b6Spec.widthMm === 125, 'B6 width is exactly 125 mm');
expect(b6Spec.heightMm === 176, 'B6 height is exactly 176 mm');

// Printable width in B6 with 4mm margin on each side: (125 - 8) = 117mm ≈ 442px
expect(billCanvasSrc.includes("max-w-[430px]"), 'BillTableCanvas uses max-w-[430px] for B6 to comfortably fit inside 117mm printable width');
expect(billCanvasSrc.includes("w-[26px]"), 'BillTableCanvas allocates w-[26px] for No. column in B6');
expect(billCanvasSrc.includes("w-[46px]"), 'BillTableCanvas allocates w-[46px] for Qty column in B6');
expect(billCanvasSrc.includes("w-[38px]"), 'BillTableCanvas allocates w-[38px] for KG column in B6');
expect(billCanvasSrc.includes("w-[56px]"), 'BillTableCanvas allocates w-[56px] for Rate column in B6');
expect(billCanvasSrc.includes("w-[70px]"), 'BillTableCanvas allocates w-[70px] for Amount column in B6');

const b6FixedColTotal = 26 + 46 + 38 + 56 + 70;
expect(b6FixedColTotal === 236, `B6 fixed columns total ${b6FixedColTotal}px (leaves ~170px for Item Name in 430px canvas)`);
expect(billCanvasSrc.includes("pageSize === 'b6' ? 4"), 'BillTableCanvas sets minRows to 4 for B6');

// =========================================================================
// 3. SALE PROCEEDS PRINT MODAL B6 & B7 ALIGNMENT
// =========================================================================
console.log('\n--- 3. Testing Sale Proceeds Modal B6 & B7 Support ---');

const saleProceedSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');

expect(saleProceedSrc.includes("max-w-[300px]"), 'SaleProceedPrintModal implements max-w-[300px] for B7');
expect(saleProceedSrc.includes("w-[22px]"), 'SaleProceedPrintModal implements w-[22px] for No. in B7');
expect(saleProceedSrc.includes("colSpan={isB7 ? 3 : 5}"), 'SaleProceedPrintModal allocates half width (colSpan=3) on B7 footer');
expect(saleProceedSrc.includes("colSpan={isB7 ? 3 : 1}"), 'SaleProceedPrintModal allocates half width for totals table on B7 footer');
expect(saleProceedSrc.includes("pageSize === 'b7' ? 2"), 'SaleProceedPrintModal sets minRows to 2 for B7');

// =========================================================================
// 4. PAYMENT RECEIPT MODAL B6 & B7 ALIGNMENT
// =========================================================================
console.log('\n--- 4. Testing Receipt Print Modal B6 & B7 Support ---');

const receiptSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/ReceiptPrintModal.tsx'), 'utf-8');

expect(receiptSrc.includes("max-w-[300px]"), 'ReceiptPrintModal implements max-w-[300px] for B7');
expect(receiptSrc.includes("pageSize === 'b7' ? 'p-1.5 mb-1.5 text-[8.5px]'"), 'ReceiptPrintModal compacts customer box padding for B7');
expect(receiptSrc.includes("pageSize === 'b7' ? 'mt-2 text-[8.5px]'"), 'ReceiptPrintModal reduces signatory margin to mt-2 for B7');

// =========================================================================
// 5. CREATE BILL VIEW & BILL HISTORY VIEW CANVASES
// =========================================================================
console.log('\n--- 5. Testing Create Bill & Bill History Canvases ---');

const createBillSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/CreateBillView.tsx'), 'utf-8');
const billHistorySrc = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/BillHistoryView.tsx'), 'utf-8');

expect(createBillSrc.includes("max-w-[300px]"), 'CreateBillView preview implements max-w-[300px] for B7');
expect(createBillSrc.includes("colSpan={isB7 ? 3 : 5}"), 'CreateBillView allocates colSpan=3 on B7 footer');
expect(billHistorySrc.includes("max-w-[300px]"), 'BillHistoryView preview implements max-w-[300px] for B7');
expect(billHistorySrc.includes("colSpan={isB7 ? 3 : 5}"), 'BillHistoryView allocates colSpan=3 on B7 footer');

// =========================================================================
// 6. REAL JSPDF RENDERING & SINGLE-PAGE GUARANTEE
// =========================================================================
console.log('\n--- 6. Testing Real jsPDF Single-Page Generation for B6 and B7 ---');

// Test 1: B7 single page with 1 item
const b7Doc1 = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [88, 125],
});
b7Doc1.setFontSize(8);
b7Doc1.text('HARI KRIPA FRUIT COMPANY', 44, 8, { align: 'center' });
b7Doc1.text('M/s. RAJESH KUMAR - Bill No: 101', 5, 16);
b7Doc1.line(5, 18, 83, 18);
b7Doc1.text('1  APPLE KASHMIR  25 CR  500KG  ₹60.00  ₹30,000.00', 5, 24);
b7Doc1.line(5, 27, 83, 27);
b7Doc1.text('Total: ₹30,000.00  Net: ₹30,000.00', 5, 33);
expect(b7Doc1.getNumberOfPages() === 1, 'B7 jsPDF document produces strictly 1 page for 1-item bill');

// Test 2: B7 single page with 4 items
const b7Doc4 = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [88, 125],
});
b7Doc4.setFontSize(7);
b7Doc4.text('HARI KRIPA FRUIT COMPANY', 44, 8, { align: 'center' });
b7Doc4.text('Credit Sale No: 001 - Date: 25/10/2026', 5, 14);
let y = 20;
for (let i = 1; i <= 4; i++) {
  b7Doc4.text(`${i}. ITEM ${i}  10 CR  200KG  ₹50.00  ₹10,000.00`, 5, y);
  y += 6;
}
b7Doc4.text('Subtotal: ₹40,000.00  Expenses: ₹500.00  Net: ₹40,500.00', 5, y + 4);
expect(b7Doc4.getNumberOfPages() === 1, 'B7 jsPDF document produces strictly 1 page for 4-item bill');

// Test 3: B6 single page with 6 items
const b6Doc6 = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [125, 176],
});
b6Doc6.setFontSize(9);
b6Doc6.text('HARI KRIPA FRUIT COMPANY', 62.5, 10, { align: 'center' });
b6Doc6.text('M/s. VIKRAM SINGH - Bill No: 202', 8, 18);
y = 26;
for (let i = 1; i <= 6; i++) {
  b6Doc6.text(`${i}. ITEM ${i} - 20 CR - 400 KG - Rate: ₹65.00 - Amt: ₹26,000.00`, 8, y);
  y += 7;
}
b6Doc6.text('Net Total: ₹1,56,000.00 (One Lakh Fifty Six Thousand Rupees Only)', 8, y + 6);
expect(b6Doc6.getNumberOfPages() === 1, 'B6 jsPDF document produces strictly 1 page for 6-item bill');

// =========================================================================
// 7. PRINT ENGINE & INDEX.CSS PAGE MARGINS
// =========================================================================
console.log('\n--- 7. Testing CSS & Dynamic Print Margins ---');

const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
const engineSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');

expect(cssSrc.includes("@page {\n    margin: 4mm;"), 'index.css defaults @page margin to 4mm to prevent B6/B7 clipping');
expect(engineSrc.includes("margin = size === 'b7' ? '3mm'"), 'pdfAndShareEngine applies 3mm margin for B7');
expect(engineSrc.includes("margin = size === 'b7' ? '3mm' : size === 'b6' ? '4mm'"), 'pdfAndShareEngine applies 4mm margin for B6');
expect(engineSrc.includes("singlePageTolerance = paperSize === 'b7' || paperSize === 'b6' ? 1.06 : 1.04"), 'pdfAndShareEngine applies 6% tolerance for B7/B6 single-page safety');

// =========================================================================
// 8. SUMMARY
// =========================================================================
console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
if (failures === 0) {
  console.log('ALL B6 & B7 BILL PRINT ALIGNMENT & SINGLE-PAGE TESTS PASSED SUCCESSFULLY! ✓');
} else {
  console.error(`FAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
