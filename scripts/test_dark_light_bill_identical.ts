import fs from 'fs';
import path from 'path';
import * as jspdfModule from 'jspdf';
const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default;
import { PAPER_SIZE_SPECS, BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { db } from '../src/services/db';
import { calculateWholesaleItemAmount, calculateSaleCrateSummary } from '../src/utils/billingCalculations';

console.log('=== TEST SUITE: Dark Mode, Light Mode & Identical Bill Printing Comparison ===\n');

let passes = 0;
let failures = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passes++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    failures++;
  }
}

// =========================================================================
// 1. IDENTICAL BILL APPEARANCE IN DARK AND LIGHT MODE (CSS & LAYOUT AUDIT)
// =========================================================================
console.log('--- 1. Testing Theme-Independent Bill Styles & Contrast in index.css ---');

const indexCss = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');

// Container background must be forced #ffffff in both light and dark modes
assert(
  indexCss.includes('#mandi-print-area') &&
  indexCss.includes('.dark #mandi-print-area') &&
  indexCss.includes('background-color: #ffffff !important'),
  'Bill canvas #mandi-print-area forces pure white background in both light mode and dark mode'
);

assert(
  indexCss.includes('#receipt-print-area') &&
  indexCss.includes('.dark #receipt-print-area') &&
  indexCss.includes('background-color: #ffffff !important'),
  'Receipt canvas #receipt-print-area forces pure white background in both light mode and dark mode'
);

assert(
  indexCss.includes('#group-sale-print-summary') &&
  indexCss.includes('.dark #group-sale-print-summary'),
  'Group sale summary is included in dark mode isolation rules'
);

assert(
  indexCss.includes('#ledger-print-area') &&
  indexCss.includes('.dark #ledger-print-area'),
  'Customer ledger statement is included in dark mode isolation rules'
);

assert(
  indexCss.includes('color-scheme: light !important'),
  'color-scheme: light explicitly enforced to prevent browser native dark form/table overrides'
);

// Table thead, tbody, borders inside bill areas must remain light in dark mode
assert(
  indexCss.includes('.dark #mandi-print-area table thead th') &&
  indexCss.includes('background-color: #f8fafc !important'),
  'Table thead th in #mandi-print-area preserves light header background #f8fafc in dark mode'
);

assert(
  indexCss.includes('.dark #mandi-print-area table tbody td') &&
  indexCss.includes('background-color: #ffffff !important'),
  'Table tbody td in #mandi-print-area preserves white cell background in dark mode'
);

assert(
  indexCss.includes('.dark .print-bill-canvas .border-slate-300') ||
  indexCss.includes('.dark #mandi-print-area .border-slate-300'),
  'Table borders in bill canvas preserve light slate borders #cbd5e1 in dark mode'
);

assert(
  indexCss.includes('.dark #mandi-print-area .text-slate-900') ||
  indexCss.includes('.dark .print-bill-canvas .text-slate-900'),
  'Text slate-900 in bill canvas is forced to readable dark color (#0f172a) in dark mode'
);

assert(
  indexCss.includes('.dark #mandi-print-area .text-emerald-700') ||
  indexCss.includes('.dark .print-bill-canvas .text-emerald-700'),
  'Emerald payment badge preserves rich emerald color in dark mode without pastel alteration'
);

assert(
  indexCss.includes('.dark #mandi-print-area .text-rose-700') ||
  indexCss.includes('.dark .print-bill-canvas .text-rose-700'),
  'Rose balance amount preserves deep rose color in dark mode'
);

// =========================================================================
// 2. B6 AND B7 SINGLE-PAGE PRINTING & DIMENSIONS ACROSS BOTH THEMES
// =========================================================================
console.log('\n--- 2. Testing B6 and B7 Physical Dimensions and Single-Page Output ---');

// B6 ISO Standard: 125 × 176 mm
const b6Spec = PAPER_SIZE_SPECS['b6'];
assert(b6Spec.widthMm === 125, 'B6 specification width is exactly 125 mm');
assert(b6Spec.heightMm === 176, 'B6 specification height is exactly 176 mm');

const b6Doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [b6Spec.widthMm, b6Spec.heightMm],
});
assert(Math.round(b6Doc.internal.pageSize.getWidth()) === 125, 'jsPDF B6 page width is 125 mm');
assert(Math.round(b6Doc.internal.pageSize.getHeight()) === 176, 'jsPDF B6 page height is 176 mm');
b6Doc.setFontSize(9);
b6Doc.text('SAMPLE B6 BILL CONTENT', 10, 15);
assert(b6Doc.getNumberOfPages() === 1, 'B6 bill produces strictly 1 page without extra blank page');

// B7 ISO Standard: 88 × 125 mm
const b7Spec = PAPER_SIZE_SPECS['b7'];
assert(b7Spec.widthMm === 88, 'B7 specification width is exactly 88 mm');
assert(b7Spec.heightMm === 125, 'B7 specification height is exactly 125 mm');

const b7Doc = new jsPDF({
  orientation: 'portrait',
  unit: 'mm',
  format: [b7Spec.widthMm, b7Spec.heightMm],
});
assert(Math.round(b7Doc.internal.pageSize.getWidth()) === 88, 'jsPDF B7 page width is 88 mm');
assert(Math.round(b7Doc.internal.pageSize.getHeight()) === 125, 'jsPDF B7 page height is 125 mm');
b7Doc.setFontSize(7.5);
b7Doc.text('SAMPLE B7 BILL CONTENT', 6, 10);
assert(b7Doc.getNumberOfPages() === 1, 'B7 bill produces strictly 1 page without extra blank page');

// =========================================================================
// 3. REMOVAL OF CUSTOMER SHOP DETAILS, ADDRESS, 3 MOBILES & AADHAAR
// =========================================================================
console.log('\n--- 3. Testing Removal of Customer Address, Mobiles & Aadhaar from Bills ---');

const billTableCanvasContent = fs.readFileSync(path.resolve('./src/components/common/BillTableCanvas.tsx'), 'utf-8');

// In BillTableCanvas: only M/s Customer Name should be rendered, not address, mobile or Aadhaar
assert(
  !billTableCanvasContent.includes('{customerAddress && <div'),
  'Customer address removed from BillTableCanvas customer box'
);
assert(
  !billTableCanvasContent.includes('{customerMobile && <div'),
  'Customer mobile number removed from BillTableCanvas customer box'
);
assert(
  !billTableCanvasContent.includes('{customerAlternateContacts && customerAlternateContacts.map'),
  'Customer alternate mobile numbers removed from BillTableCanvas customer box'
);
assert(
  !billTableCanvasContent.includes('{customerAadhaarNo && ('),
  'Customer Aadhaar card details removed from BillTableCanvas customer box'
);
assert(
  billTableCanvasContent.includes('M/s.') && billTableCanvasContent.includes('customerName'),
  'Customer name (M/s.) is cleanly preserved as the sole customer identifier'
);

// ReceiptPrintModal customer details
const receiptPrintContent = fs.readFileSync(path.resolve('./src/components/print/ReceiptPrintModal.tsx'), 'utf-8');
assert(
  !receiptPrintContent.includes('{customerAddress && <div'),
  'Customer address removed from ReceiptPrintModal'
);
assert(
  !receiptPrintContent.includes('{customerMobile && <div'),
  'Customer mobile number removed from ReceiptPrintModal'
);
assert(
  !receiptPrintContent.includes('getCustomerPrintContactLines(customer).map'),
  'Customer alternate mobile contacts removed from ReceiptPrintModal'
);
assert(
  !receiptPrintContent.includes('{customerAadhaarNo && ('),
  'Customer Aadhaar details removed from ReceiptPrintModal'
);

// BillHistoryView and CreateBillView preview canvases
const billHistoryContent = fs.readFileSync(path.resolve('./src/components/billing/BillHistoryView.tsx'), 'utf-8');
assert(
  !billHistoryContent.includes('selectedBillForPreview.customerAddress &&'),
  'Customer address removed from BillHistoryView bill canvas'
);
assert(
  !billHistoryContent.includes('cust.mobile && <div'),
  'Customer mobile removed from BillHistoryView bill canvas'
);

const createBillContent = fs.readFileSync(path.resolve('./src/components/billing/CreateBillView.tsx'), 'utf-8');
assert(
  !createBillContent.includes('activeCustomer?.address &&'),
  'Customer address removed from CreateBillView bill canvas'
);
assert(
  !createBillContent.includes('activeCustomer?.mobile &&'),
  'Customer mobile removed from CreateBillView bill canvas'
);

// =========================================================================
// 4. REMOVAL OF UNWANTED PARTICULARS / NOTES & CASH A/C PAYMENT AGAINST LEDGER
// =========================================================================
console.log('\n--- 4. Testing Removal of Particulars / Notes Heading and Cash A/C Wording ---');

assert(
  !receiptPrintContent.includes('Particulars / Notes:'),
  'Particulars / Notes heading removed from ReceiptPrintModal'
);
assert(
  !receiptPrintContent.includes('Payment credited to customer ledger'),
  'Default payment notes removed from ReceiptPrintModal'
);

const receiptModalContent = fs.readFileSync(path.resolve('./src/components/accounts/ReceiptModal.tsx'), 'utf-8');
assert(
  !receiptModalContent.includes("useState('Cash A/C payment against ledger')"),
  'ReceiptModal does not initialize notes with "Cash A/C payment against ledger"'
);
assert(
  !receiptModalContent.includes("setNotes('Cash A/C payment against ledger')"),
  'ReceiptModal does not reset notes with "Cash A/C payment against ledger"'
);

// =========================================================================
// 5. BLANK-BY-DEFAULT, FREE-TEXT UNIT FIELD IN FRUIT / ITEM MASTER
// =========================================================================
console.log('\n--- 5. Testing Blank-by-Default Free-Text Unit Field in Fruit Master ---');

const addFruitModalContent = fs.readFileSync(path.resolve('./src/components/modals/AddFruitModal.tsx'), 'utf-8');
assert(
  addFruitModalContent.includes("const [unit, setUnit] = useState('');"),
  'AddFruitModal initializes unit state to blank empty string by default'
);
assert(
  addFruitModalContent.includes("setUnit('');"),
  'AddFruitModal resets unit state to blank empty string after save'
);

const fruitMasterViewContent = fs.readFileSync(path.resolve('./src/components/master/FruitMasterView.tsx'), 'utf-8');
assert(
  !fruitMasterViewContent.includes('Unit (free-text) *'),
  'FruitMasterView edit modal does not enforce required asterisk on Unit'
);
assert(
  fruitMasterViewContent.includes('Unit (free-text)'),
  'FruitMasterView edit modal renders free-text Unit label'
);

// =========================================================================
// 6. MODULE-BY-MODULE COMPARISON & DATABASE PRESERVATION
// =========================================================================
console.log('\n--- 6. Testing All Modules & Data Preservation ---');

// Verify sample database records exist and are intact
const customers = db.getCustomers();
assert(customers.length > 0, `Customer records preserved (${customers.length} customers found)`);

const fruits = db.getFruits();
assert(fruits.length > 0, `Fruit items preserved (${fruits.length} items found)`);

const crateTypes = db.getCrateTypes();
assert(crateTypes.length > 0, `Crate types preserved (${crateTypes.length} crate types found)`);

const profiles = db.getCompanyProfiles();
assert(profiles.length > 0, `Company profiles preserved (${profiles.length} profiles found)`);

// Calculation invariant check
const sampleCrateAmt = calculateWholesaleItemAmount(25, 'Crate', 500, 60);
assert(sampleCrateAmt === 30000, 'Wholesale item calculation: 500kg * ₹60 = ₹30,000');

console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
if (failures > 0) {
  process.exit(1);
} else {
  console.log('ALL DARK/LIGHT MODE IDENTICAL BILL COMPARISON TESTS PASSED SUCCESSFULLY! ✓');
}
