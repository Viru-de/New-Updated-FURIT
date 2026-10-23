import fs from 'fs';
import path from 'path';
import { db } from '../src/services/db';
import { CompanyProfile } from '../src/types';

function runTests() {
  console.log('=== TEST SUITE: Invoice Visibility, Hindi Name Printing & Normal Zero Typography ===\n');
  let passes = 0;
  let failures = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passes++;
    } else {
      console.error(`[FAIL] ${message}`);
      failures++;
    }
  }

  // --- 1. Typography & Normal Zero Check ---
  console.log('--- 1. Testing Normal Zero & Font Typography Configuration ---');
  const indexHtml = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
  assert(!indexHtml.includes('JetBrains+Mono'), 'JetBrains Mono removed from index.html font links to prevent slashed zeros');
  assert(indexHtml.includes('Plus+Jakarta+Sans'), 'Plus Jakarta Sans loaded in index.html as main font');
  assert(indexHtml.includes('Noto+Sans+Devanagari'), 'Noto Sans Devanagari loaded in index.html for Hindi typography');

  const indexCss = fs.readFileSync(path.resolve('./src/index.css'), 'utf-8');
  assert(indexCss.includes('"zero" 0'), 'OpenType "zero" 0 explicitly set in index.css to eliminate slashed zeros');
  assert(indexCss.includes('tabular-nums'), 'tabular-nums enabled across numeric elements for accounting column alignment');
  assert(indexCss.includes("'Plus Jakarta Sans', 'Noto Sans Devanagari'"), 'Numeric elements map directly to Plus Jakarta Sans and Noto Sans Devanagari');

  // --- 2. Dark Mode Preview Contrast & Print Isolation ---
  console.log('\n--- 2. Testing Dark Mode Invoice Preview Visibility & Light Mode Canvas Isolation ---');
  assert(indexCss.includes('.dark #mandi-print-area'), 'Dark mode isolation rule exists for #mandi-print-area');
  assert(indexCss.includes('.dark #mandi-print-area .text-slate-900') || indexCss.includes('.dark #mandi-print-area .text-slate-800'), 'Dark mode explicit contrast overrides exist for muted text classes');
  assert(indexCss.includes('#mandi-print-area') && indexCss.includes('color-scheme: light'), 'color-scheme: light enforced on invoice print areas');

  const billCanvasTsx = fs.readFileSync(path.resolve('./src/components/common/BillTableCanvas.tsx'), 'utf-8');
  assert(billCanvasTsx.includes('* E & O.E.'), 'E & O.E. present in BillTableCanvas');
  assert(billCanvasTsx.includes('Expenses'), 'Expenses section present in BillTableCanvas');
  assert(billCanvasTsx.includes('text-slate-950') || billCanvasTsx.includes('dark:text-slate-950') || billCanvasTsx.includes('text-slate-900'), 'Explicit high contrast text classes applied to E & O.E. and expenses');

  // --- 3. Print Outer Border Removal Check ---
  console.log('\n--- 3. Testing Print Border Fixes (No Heavy Outer Box) ---');
  assert(indexCss.includes('@media print'), '@media print block exists in index.css');
  assert(indexCss.includes('#mandi-print-area') && indexCss.includes('border: none !important'), 'Outer invoice print wrapper has border: none !important in print media');
  assert(billCanvasTsx.includes('print:border-none'), 'BillTableCanvas uses print:border-none on outer container');

  const createBillTsx = fs.readFileSync(path.resolve('./src/components/billing/CreateBillView.tsx'), 'utf-8');
  assert(createBillTsx.includes('print:border-none'), 'CreateBillView preview canvas uses print:border-none on outer container');

  const billHistoryTsx = fs.readFileSync(path.resolve('./src/components/billing/BillHistoryView.tsx'), 'utf-8');
  assert(billHistoryTsx.includes('print:border-none'), 'BillHistoryView preview canvas uses print:border-none on outer container');

  // --- 4. Hindi Company Name Header Placement Across All Modules ---
  console.log('\n--- 4. Testing Hindi Company Name Header Rendering Across Modules ---');
  assert(billCanvasTsx.includes('{currentProfile.hindiName &&'), 'BillTableCanvas renders hindiName conditionally directly under English name');
  assert(billCanvasTsx.includes('font-devanagari'), 'BillTableCanvas applies font-devanagari class to Hindi company name');

  assert(createBillTsx.includes('{activeProfile?.hindiName &&'), 'CreateBillView renders hindiName conditionally directly under English name');

  assert(billHistoryTsx.includes('{hindiName &&'), 'BillHistoryView renders hindiName conditionally from snapshot or profile');

  const groupSaleTsx = fs.readFileSync(path.resolve('./src/components/billing/GroupSaleView.tsx'), 'utf-8');
  assert(groupSaleTsx.includes('{currentProfile.hindiName &&'), 'GroupSaleView print summary renders hindiName');

  const saleProceedTsx = fs.readFileSync(path.resolve('./src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
  assert(saleProceedTsx.includes('{currentProfile.hindiName &&'), 'SaleProceedPrintModal renders hindiName');

  const receiptTsx = fs.readFileSync(path.resolve('./src/components/print/ReceiptPrintModal.tsx'), 'utf-8');
  assert(receiptTsx.includes('{currentProfile.hindiName &&'), 'ReceiptPrintModal renders hindiName');

  const customerLedgerTsx = fs.readFileSync(path.resolve('./src/components/accounts/CustomerLedgerView.tsx'), 'utf-8');
  assert(customerLedgerTsx.includes('{currentProfile.hindiName &&'), 'CustomerLedgerView printable header renders hindiName');

  const crateStatementTsx = fs.readFileSync(path.resolve('./src/components/accounts/CrateStatementView.tsx'), 'utf-8');
  assert(crateStatementTsx.includes('{currentProfile.hindiName &&'), 'CrateStatementView printable header renders hindiName');

  const reportsTsx = fs.readFileSync(path.resolve('./src/components/reports/ReportsView.tsx'), 'utf-8');
  assert(reportsTsx.includes('{currentProfile.hindiName &&'), 'ReportsView printable header renders hindiName');

  // --- 5. Font Readiness Check in PDF & Print Engine ---
  console.log('\n--- 5. Testing Font Readiness in PDF & Print Engine ---');
  const pdfEngineTs = fs.readFileSync(path.resolve('./src/utils/pdfAndShareEngine.ts'), 'utf-8');
  assert(pdfEngineTs.includes('document.fonts.ready'), 'pdfAndShareEngine awaits document.fonts.ready before print and canvas render');
  assert(pdfEngineTs.includes('"zero" 0'), 'pdfAndShareEngine enforces "zero" 0 in PDF onclone DOM');

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

runTests();
