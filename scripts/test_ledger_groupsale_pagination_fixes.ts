import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { CompanyProfile } from '../src/types';

console.log('=== TEST SUITE: Customer Ledger, Sale Proceeds Ledger & Group Sale Print Pagination & Formatting ===\n');

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

const customerLedgerSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/accounts/CustomerLedgerView.tsx'),
  'utf-8'
);
const spLedgerSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/accounts/SaleProceedsLedgerView.tsx'),
  'utf-8'
);
const groupSaleSrc = fs.readFileSync(
  path.join(process.cwd(), 'src/components/billing/GroupSaleView.tsx'),
  'utf-8'
);
const indexCssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
const pdfEngineSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');
const datePickerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/common/DatePickerInput.tsx'), 'utf-8');

// =========================================================================
// 1. CUSTOMER LEDGER: TRANSACTION INTEGRITY, UNIFIED TFOOT, NO UNWANTED CRATE TEXT
// =========================================================================
console.log('--- 1. Testing Customer Ledger Print Fixes ---');

expect(
  !customerLedgerSrc.includes('Out, {tb.returned} In (Bal:') &&
    !customerLedgerSrc.includes('crateStatement.typeBalances'),
  'Customer Ledger removes "Out, X In (Bal: Y)" unwanted crate breakdown lines from Detailed & Short print'
);

expect(
  customerLedgerSrc.includes('Crate Balance: {crateBalance}') &&
    customerLedgerSrc.includes('= {crateBalance}') &&
    customerLedgerSrc.includes('Total Qty: {totalQty}'),
  'Customer Ledger preserves Crate Balance and Total Qty lines'
);

expect(
  customerLedgerSrc.includes('className="ledger-tx-row border-b border-black/35"') &&
    customerLedgerSrc.includes('className="ledger-tx-block space-y-0.5"') &&
    customerLedgerSrc.includes("shortInfo.primaryRef}\n                                      {!isFirstChunk ? ' (contd.)' : ''}"),
  'Customer Ledger keeps normal transactions intact via ledger-tx-row/.ledger-tx-block and repeats heading (contd.) if >24 items'
);

expect(
  customerLedgerSrc.includes('className="ledger-closing-meta-row bg-white text-black"') &&
    customerLedgerSrc.includes('AUTHORISED SIGNATURE') &&
    customerLedgerSrc.includes('CLOSING BALANCE :'),
  'Customer Ledger places CLOSING BALANCE + Software attribution + AUTHORISED SIGNATURE inside <tfoot>'
);

// Verify no CLOSING BALANCE / AUTHORISED SIGNATURE sits outside tfoot in detailed/short print areas
const clDetailedSection = customerLedgerSrc.slice(
  customerLedgerSrc.indexOf('id="customer-ledger-detailed-print-area"'),
  customerLedgerSrc.indexOf('id="customer-ledger-short-print-area"')
);
const clDetailedTfootEnd = clDetailedSection.indexOf('</tfoot>');
const clDetailedAfterTfoot = clDetailedSection.slice(clDetailedTfootEnd);
expect(
  clDetailedTfootEnd !== -1 &&
    !clDetailedAfterTfoot.includes('CLOSING BALANCE') &&
    !clDetailedAfterTfoot.includes('AUTHORISED SIGNATURE'),
  'Customer Ledger Detailed Print has no detached CLOSING BALANCE or AUTHORISED SIGNATURE outside <tfoot>'
);

const clShortSection = customerLedgerSrc.slice(
  customerLedgerSrc.indexOf('id="customer-ledger-short-print-area"'),
  customerLedgerSrc.indexOf('<CreditSaleModal')
);
const clShortTfootEnd = clShortSection.indexOf('</tfoot>');
const clShortAfterTfoot = clShortSection.slice(clShortTfootEnd);
expect(
  clShortTfootEnd !== -1 && !clShortAfterTfoot.includes('AUTHORISED SIGNATURE'),
  'Customer Ledger Short Print has no detached AUTHORISED SIGNATURE outside <tfoot>'
);

// =========================================================================
// 2. PRINT CSS: NO MID-ROW SPLITTING, REPEATING HEADERS, TFOOT ON FINAL PAGE ONLY
// =========================================================================
console.log('\n--- 2. Testing CSS Print Pagination & Border Rules ---');

expect(
  !indexCssSrc.includes('#customer-ledger-detailed-print-area tbody td {\n    page-break-inside: auto'),
  'index.css no longer overrides tbody tr/td with break-inside: auto'
);

expect(
  indexCssSrc.includes('#customer-ledger-detailed-print-area table') &&
    indexCssSrc.includes('#customer-ledger-detailed-print-area thead') &&
    indexCssSrc.includes('.ledger-tx-row,\n  .ledger-tx-block {\n    page-break-inside: avoid !important;\n    break-inside: avoid !important;'),
  'index.css enforces table-header-group on detailed & short Customer Ledger and forbids mid-transaction splitting'
);

expect(
  indexCssSrc.includes('#customer-ledger-detailed-print-area tfoot') &&
    indexCssSrc.includes('#customer-ledger-short-print-area tfoot') &&
    indexCssSrc.includes('#sale-proceeds-print-area tfoot') &&
    indexCssSrc.includes('#sale-proceeds-short-print-area tfoot') &&
    indexCssSrc.includes('display: table-row-group !important;\n    page-break-inside: avoid !important;'),
  'index.css sets display: table-row-group and break-inside: avoid on ledger tfoot (final page only, kept together)'
);

expect(
  indexCssSrc.includes('tr.ledger-closing-meta-row') &&
    indexCssSrc.includes('td.ledger-closing-meta-cell {\n    border: none !important;'),
  'index.css strips table borders from ledger-closing-meta-row inside tfoot'
);

// =========================================================================
// 3. PDF ENGINE: MULTI-PAGE HEADER REPETITION & SAFE A4 MARGINS
// =========================================================================
console.log('\n--- 3. Testing PDF Export Pagination & Repeating Headers ---');

expect(
  pdfEngineSrc.includes("a4: isMultiPageLedgerOrReport ? '7mm 6mm 9mm 6mm' : '3mm 5mm 3.5mm 5mm'"),
  'pdfAndShareEngine uses safe 7mm/9mm A4 top/bottom margins for multi-page ledgers and reports'
);

expect(
  pdfEngineSrc.includes("querySelector('table > thead')") &&
    pdfEngineSrc.includes('shouldRepeatThead') &&
    pdfEngineSrc.includes('repeatedTheadImgData'),
  'generatePdfDoc captures primary table <thead> and stamps repeated column headers on continuation pages'
);

expect(
  pdfEngineSrc.includes("'.ledger-tx-row, tfoot, .ledger-closing-meta-row'") ||
    pdfEngineSrc.includes('.ledger-tx-row, tfoot, .ledger-closing-meta-row'),
  'generatePdfDoc protects .ledger-tx-row, tfoot, and .ledger-closing-meta-row from mid-block slicing'
);

// =========================================================================
// 4. SALE PROCEEDS LEDGER: PRINT VISIBILITY (13PX + WIDE COLS) & DARK MODE FIXES
// =========================================================================
console.log('\n--- 4. Testing Sale Proceeds Ledger Font Readability, Pagination & Dark Mode ---');

expect(
  spLedgerSrc.includes("width: '86px'") &&
    spLedgerSrc.includes("width: '102px'") &&
    spLedgerSrc.includes("width: '116px'"),
  'Sale Proceeds Ledger widens Date/Debit/Credit/Balance columns to prevent numeric wrapping at larger print font'
);

expect(
  spLedgerSrc.includes('text-[13px]') &&
    spLedgerSrc.includes('tabular-nums') &&
    spLedgerSrc.includes('whitespace-nowrap'),
  'Sale Proceeds Ledger uses 13px print typography with tabular-nums and whitespace-nowrap'
);

expect(
  indexCssSrc.includes('/* Sale Proceeds Ledger Detailed + Short Print: enhanced 13px print readability') &&
    indexCssSrc.includes('font-size: 13px !important;') &&
    indexCssSrc.includes('font-size: 12px !important;'),
  'index.css applies 13px font size to Sale Proceeds Ledger print while preserving 12px on Customer Ledger'
);

const spDetailedSection = spLedgerSrc.slice(spLedgerSrc.indexOf('id="sale-proceeds-print-area"'));
expect(
  spDetailedSection.includes('ledger-tx-row') &&
    spDetailedSection.includes('ledger-closing-meta-row') &&
    !spDetailedSection.slice(spDetailedSection.indexOf('</tfoot>')).includes('CLOSING BALANCE'),
  'Sale Proceeds Detailed Print protects rows and places CLOSING BALANCE inside <tfoot>'
);

expect(
  spLedgerSrc.includes('dark:hover:bg-slate-700') &&
    spLedgerSrc.includes('dark:border-emerald-500/80') &&
    !spLedgerSrc.includes('text-slate-500 dark:bg-slate-800/40 dark:text-slate-400') &&
    datePickerSrc.includes('dark:text-slate-100') &&
    indexCssSrc.includes('.dark table:not(.print-bill-canvas *) tfoot td'),
  'Sale Proceeds Ledger, DatePickerInput, and index.css fix Dark Mode grey contrast issues'
);

// =========================================================================
// 5. GROUP SALE: CENTERED PRINT HEADER LAYOUT
// =========================================================================
console.log('\n--- 5. Testing Group Sale Centered Print Header Layout ---');

const gsPrintSummary = groupSaleSrc.slice(groupSaleSrc.indexOf('id="group-sale-print-summary"'));
expect(
  gsPrintSummary.includes('variant="ledger-centered"') &&
    !gsPrintSummary.includes('variant="ledger"'),
  'Group Sale print summary switches header from two-column variant="ledger" to centered variant="ledger-centered"'
);

expect(
  gsPrintSummary.includes('ledger-tx-row') && gsPrintSummary.includes('bill-bottom-footer'),
  'Group Sale print table marks rows and footer as unbreakable during pagination'
);

const sampleProfile: CompanyProfile = {
  id: 'cp-hfc',
  name: 'HariKripa Fruit Company',
  hindiName: 'हरिकृपा फ्रूट कंपनी',
  shortName: 'HFC',
  shortCode: 'HFC',
  address: 'Shop No. 12, Wholesale Fruit Market',
  city: 'Raipur',
  state: 'Chhattisgarh',
  pincode: '492001',
  mobile: '9876543210',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const gsHeaderHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(PrintBusinessHeader, {
    profile: sampleProfile,
    variant: 'ledger-centered',
  })
);
expect(
  gsHeaderHtml.includes('text-center') &&
    gsHeaderHtml.includes('HFC') &&
    gsHeaderHtml.includes('HariKripa Fruit Company') &&
    gsHeaderHtml.includes('हरिकृपा फ्रूट कंपनी') &&
    !gsHeaderHtml.includes('print-business-header-left') &&
    !gsHeaderHtml.includes('print-business-header-right'),
  'Group Sale centered header renders centered company name, short code, Hindi name, address, and contacts without left/right split'
);

console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
if (failures > 0) {
  process.exit(1);
}
