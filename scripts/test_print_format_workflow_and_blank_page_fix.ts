import fs from 'fs';
import path from 'path';
import { PAPER_SIZE_SPECS, BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { db } from '../src/services/db';

console.log('=== TEST SUITE: Print Format Selection Workflow & Blank Page Elimination ===\n');

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
// 1. CHOOSE BILL PRINT FORMAT MODAL INSPECTION
// =========================================================================
console.log('--- 1. Testing ChooseBillPrintFormatModal Implementation ---');

const formatModalSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/common/ChooseBillPrintFormatModal.tsx'),
  'utf-8'
);

// All 5 paper formats supported
const requiredSizes: BillPaperSize[] = ['compact', 'b7', 'b6', 'a5', 'a4'];
for (const size of requiredSizes) {
  expect(
    Boolean(PAPER_SIZE_SPECS[size]),
    `Paper size specification '${size}' exists with dimensions ${PAPER_SIZE_SPECS[size]?.dimensionsMm}`
  );
}

// B7 and B6 dimensions exact
expect(
  PAPER_SIZE_SPECS['b7'].widthMm === 88 && PAPER_SIZE_SPECS['b7'].heightMm === 125,
  'B7 format is exactly 88 × 125 mm'
);
expect(
  PAPER_SIZE_SPECS['b6'].widthMm === 125 && PAPER_SIZE_SPECS['b6'].heightMm === 176,
  'B6 format is exactly 125 × 176 mm'
);
expect(
  PAPER_SIZE_SPECS['compact'].widthMm === 140 && PAPER_SIZE_SPECS['compact'].heightMm === 210,
  'Compact Mandi format is 140 × 210 mm'
);
expect(
  PAPER_SIZE_SPECS['a5'].widthMm === 148 && PAPER_SIZE_SPECS['a5'].heightMm === 210,
  'A5 format is 148 × 210 mm'
);
expect(
  PAPER_SIZE_SPECS['a4'].widthMm === 210 && PAPER_SIZE_SPECS['a4'].heightMm === 297,
  'A4 format is 210 × 297 mm'
);

// Check that ChooseBillPrintFormatModal unmounts/closes BEFORE calling triggerPrint
expect(
  formatModalSrc.indexOf('onClose()') < formatModalSrc.indexOf('await triggerPrint(selectedSize, elementId)'),
  'ChooseBillPrintFormatModal calls onClose() before triggerPrint so the format selection screen is NEVER printed into the bill'
);

// Check that format modal has no-print and print:hidden classes
expect(
  formatModalSrc.includes('no-print') && formatModalSrc.includes('print:hidden'),
  'ChooseBillPrintFormatModal has no-print and print:hidden to guarantee it is hidden in print media'
);

// =========================================================================
// 2. PRINT CSS & BLANK PAGE PREVENTION IN INDEX.CSS
// =========================================================================
console.log('\n--- 2. Testing @media print CSS in index.css ---');

const indexCssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');

// Ensure no-print elements and modal backdrops are display: none
expect(
  indexCssSrc.includes('.fixed.inset-0.no-print') && indexCssSrc.includes('.no-print *'),
  'index.css explicitly sets .fixed.inset-0.no-print and .no-print * to display: none !important'
);

// Ensure only non-no-print modals are positioned static
expect(
  indexCssSrc.includes('.fixed.inset-0:not(.no-print):not(.print\\:hidden)'),
  'index.css restricts position: static to .fixed.inset-0:not(.no-print):not(.print:hidden)'
);

// Verify html, body, and #root do NOT have overflow: hidden or height: 100% that clip or produce blank pages
expect(
  indexCssSrc.includes('html, body, html.dark, body.dark, .dark, [data-theme="dark"], #root') &&
  indexCssSrc.includes('overflow: visible !important;') &&
  indexCssSrc.includes('height: auto !important;'),
  'index.css sets html, body, and #root to height: auto !important and overflow: visible !important in print media'
);

// Verify single-page canvas page-break rules
expect(
  indexCssSrc.includes('page-break-before: avoid !important;') &&
  indexCssSrc.includes('page-break-after: avoid !important;'),
  'index.css sets page-break-before: avoid and page-break-after: avoid to eliminate leading or trailing blank pages'
);

// =========================================================================
// 3. ALL BILL MODULES PRESERVE CHOOSE FORMAT WORKFLOW
// =========================================================================
console.log('\n--- 3. Testing Print Format Selection in All Bill Views ---');

const cashModalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/CashSalePrintModal.tsx'), 'utf-8');
const creditModalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/CreditSalePrintModal.tsx'), 'utf-8');
const proceedsModalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
const receiptModalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/ReceiptPrintModal.tsx'), 'utf-8');
const createBillSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/CreateBillView.tsx'), 'utf-8');
const billHistorySrc = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/BillHistoryView.tsx'), 'utf-8');

// Cash Sale Print Modal
expect(cashModalSrc.includes('<ChooseBillPrintFormatModal'), 'CashSalePrintModal renders ChooseBillPrintFormatModal');
expect(cashModalSrc.includes("handlePrint = () => {\n    setIsFormatModalOpen(true);\n  }"), 'CashSalePrintModal handlePrint opens format selection screen instead of bypassing');
expect(cashModalSrc.includes("b7") && cashModalSrc.includes("b6"), 'CashSalePrintModal preview bar includes B7 and B6 paper sizes');

// Credit Sale Print Modal
expect(creditModalSrc.includes('<ChooseBillPrintFormatModal'), 'CreditSalePrintModal renders ChooseBillPrintFormatModal');
expect(creditModalSrc.includes("handlePrint = () => {\n    setIsFormatModalOpen(true);\n  }"), 'CreditSalePrintModal handlePrint opens format selection screen instead of bypassing');
expect(creditModalSrc.includes("b7") && creditModalSrc.includes("b6"), 'CreditSalePrintModal preview bar includes B7 and B6 paper sizes');

// Sale Proceeds Print Modal
expect(proceedsModalSrc.includes('<ChooseBillPrintFormatModal'), 'SaleProceedPrintModal renders ChooseBillPrintFormatModal');
expect(proceedsModalSrc.includes("handlePrint = () => {\n    setIsFormatModalOpen(true);\n  }"), 'SaleProceedPrintModal handlePrint opens format selection screen instead of bypassing');
expect(proceedsModalSrc.includes("b7") && proceedsModalSrc.includes("b6"), 'SaleProceedPrintModal preview bar includes B7 and B6 paper sizes');

// Receipt Print Modal
expect(receiptModalSrc.includes('<ChooseBillPrintFormatModal'), 'ReceiptPrintModal renders ChooseBillPrintFormatModal');
expect(receiptModalSrc.includes("handlePrint = () => {\n    setIsFormatModalOpen(true);\n  }"), 'ReceiptPrintModal handlePrint opens format selection screen instead of bypassing');
expect(receiptModalSrc.includes("b7") && receiptModalSrc.includes("b6"), 'ReceiptPrintModal preview bar includes B7 and B6 paper sizes');

// Create Bill View
expect(createBillSrc.includes('<ChooseBillPrintFormatModal'), 'CreateBillView renders ChooseBillPrintFormatModal');
expect(createBillSrc.includes("setIsFormatModalOpen(true)"), 'CreateBillView print button opens format selection screen');
expect(createBillSrc.includes("b7") && createBillSrc.includes("b6"), 'CreateBillView preview bar includes B7 and B6 paper sizes');

// Bill History View
expect(billHistorySrc.includes('<ChooseBillPrintFormatModal'), 'BillHistoryView renders ChooseBillPrintFormatModal');
expect(billHistorySrc.includes("setIsFormatModalOpen(true)"), 'BillHistoryView print button opens format selection screen');
expect(billHistorySrc.includes("b7") && billHistorySrc.includes("b6"), 'BillHistoryView preview bar includes B7 and B6 paper sizes');

// =========================================================================
// 4. DATABASE & BUSINESS LOGIC PRESERVATION
// =========================================================================
console.log('\n--- 4. Testing Business Logic & Data Preservation ---');

expect(db.getCustomers().length > 0, 'Customer directory intact');
expect(db.getFruits().length > 0, 'Fruit items catalog intact');
expect(db.getCrateTypes().length > 0, 'Crate types inventory intact');
expect(db.getCompanyProfiles().length > 0, 'Company branding and profiles intact');
expect(db.getCashSales().length > 0, 'Cash sale transactions intact');
expect(db.getCreditSales().length > 0, 'Credit sale transactions intact');

// =========================================================================
// SUMMARY
// =========================================================================
console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
if (failures === 0) {
  console.log('ALL PRINT FORMAT SELECTION & BLANK PAGE ELIMINATION TESTS PASSED! ✓');
} else {
  console.error(`FAILED: ${failures} test(s) failed.`);
  process.exit(1);
}
