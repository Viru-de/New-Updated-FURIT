import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { PAPER_SIZE_SPECS, BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { CompanyProfile } from '../src/types';
import { BillingLineItem } from '../src/utils/billingCalculations';

console.log('=== TEST SUITE: B-Series Short Name Visibility & Centered Ledger Print Headers ===\n');

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

const sampleProfile: CompanyProfile = {
  id: 'cp-test',
  name: 'JAIRAM DHIRUMAL',
  hindiName: 'जयराम धीरूमल',
  shortName: 'JD',
  shortCode: 'JD',
  address: 'Shop-A/6 Wholesale Fruit Market, Camp 2, Power House',
  city: 'Bhilai',
  state: 'Chhattisgarh',
  pincode: '490001',
  mobile: '9300910015',
  alternate1Mobile: '7566996333',
  primaryContactName: 'Dhirumal',
  alternate1ContactName: 'Vishal',
  logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const hfcProfile: CompanyProfile = {
  ...sampleProfile,
  id: 'cp-hfc',
  name: 'HariKripa Fruit Company',
  hindiName: 'हरिकृपा फ्रूट कंपनी',
  shortName: 'HFC',
  shortCode: 'HFC',
};

// =========================================================================
// 1. B-SERIES (B6 & B7) COMPANY SHORT NAME VISIBILITY & SAFE TOP CLEARANCE
// =========================================================================
console.log('--- 1. Testing B-Series (B6 & B7) Bill Header Short Name Visibility ---');

(['b7', 'b6'] as BillPaperSize[]).forEach((size) => {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(PrintBusinessHeader, {
      profile: hfcProfile,
      variant: 'bill',
      paperSize: size,
    })
  );

  expect(html.includes('print-business-header--bill'), `${size.toUpperCase()} bill uses bill header variant`);
  expect(html.includes('print-business-short-name'), `${size.toUpperCase()} renders Company Short Name element`);
  expect(html.includes('>HFC<'), `${size.toUpperCase()} displays HFC short name`);
  expect(html.includes('pt-1'), `${size.toUpperCase()} adds top clearance padding (pt-1) on header`);
  expect(
    html.includes('leading-snug') && html.includes('pt-[1px]'),
    `${size.toUpperCase()} uses leading-snug + pt-[1px] on short name to prevent top clipping`
  );

  const idxShort = html.indexOf('HFC');
  const idxEng = html.indexOf('HariKripa Fruit Company');
  const idxHindi = html.indexOf('हरिकृपा फ्रूट कंपनी');
  expect(
    idxShort !== -1 && idxEng !== -1 && idxHindi !== -1 && idxShort < idxEng && idxEng < idxHindi,
    `${size.toUpperCase()} preserves order: Short Name -> English -> Hindi`
  );
});

// Check BillTableCanvas SSR for B7 and B6 with Credit & Cash bills
const sampleItems: BillingLineItem[] = [
  {
    id: 'it-1',
    fruitId: 'f1',
    fruitName: 'Apple Washington',
    quantity: 5,
    unit: 'Crate',
    kg: 100,
    rate: 1200,
    amount: 6000,
  },
];

(['b7', 'b6'] as BillPaperSize[]).forEach((size) => {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(BillTableCanvas, {
      saleType: 'CREDIT SALE',
      billNumber: 'CS-101',
      date: '2026-05-01',
      customerName: 'Ramesh Traders',
      items: sampleItems,
      profile: sampleProfile,
      pageSize: size,
    })
  );
  expect(html.includes('pt-1.5'), `BillTableCanvas ${size.toUpperCase()} preview adds pt-1.5 clearance`);
  expect(html.includes('>JD<'), `BillTableCanvas ${size.toUpperCase()} renders JD short name cleanly`);
});

// Check B6/B7 wrapper clearances in modals/views & PDF/print engine
const modalAndViewFiles = [
  'src/components/print/SaleProceedPrintModal.tsx',
  'src/components/common/BillTableCanvas.tsx',
  'src/components/print/ReceiptPrintModal.tsx',
  'src/components/billing/CreateBillView.tsx',
  'src/components/billing/BillHistoryView.tsx',
];

modalAndViewFiles.forEach((relPath) => {
  const content = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
  expect(content.includes('pt-1.5'), `${relPath} uses pt-1.5 top padding for B6/B7`);
});

const spModalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
expect(
  !spModalSrc.includes('sale-proceed-print-canvas overflow-hidden') &&
    spModalSrc.includes('sale-proceed-print-canvas overflow-visible'),
  'SaleProceedPrintModal uses overflow-visible so B6/B7 top short name is never clipped'
);

const pdfEngineSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');
expect(pdfEngineSrc.includes("b7: '3mm 3.5mm 2mm 3.5mm'"), 'applyPrintPageSize allocates 3mm top margin for B7');
expect(pdfEngineSrc.includes("b6: '3mm 4mm 2.5mm 4mm'"), 'applyPrintPageSize allocates 3mm top margin for B6');
expect(pdfEngineSrc.includes("chosenSize === 'b7'\n      ? '1.5mm 2mm 1mm 2mm'"), 'triggerPrint sets 1.5mm top safePad for B7');
expect(pdfEngineSrc.includes("chosenSize === 'b6'\n      ? '1.5mm 2mm 1.5mm 2mm'"), 'triggerPrint sets 1.5mm top safePad for B6');
expect(
  pdfEngineSrc.includes("clonedElement.style.overflow = 'visible'") &&
    pdfEngineSrc.includes("paperSize === 'b7' || paperSize === 'b6'\n            ? '10px'"),
  'generatePdfDoc sets overflow=visible and 10px top padding for B6/B7'
);
expect(Object.keys(PAPER_SIZE_SPECS).length === 5, 'Existing 5 paper size presets preserved without breaking changes');

// =========================================================================
// 2. LEDGER CENTERED HEADER (CUSTOMER LEDGER & SALE PROCEED LEDGER)
// =========================================================================
console.log('\n--- 2. Testing Centered 5-Line Ledger Print Header ---');

const centeredLedgerHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(PrintBusinessHeader, {
    profile: sampleProfile,
    variant: 'ledger-centered',
  })
);

expect(
  centeredLedgerHtml.includes('print-business-header--ledger-centered'),
  'Centered ledger header outputs print-business-header--ledger-centered class'
);
expect(
  centeredLedgerHtml.includes('text-center'),
  'Centered ledger header applies text-center alignment'
);
expect(
  !centeredLedgerHtml.includes('<img'),
  'Centered ledger header removes logo img so entire block is a single centered stack'
);
expect(
  !centeredLedgerHtml.includes('print-business-header-left') &&
    !centeredLedgerHtml.includes('print-business-header-right'),
  'Centered ledger header removes two-column left/right layout'
);

const cIdxShort = centeredLedgerHtml.indexOf('JD');
const cIdxEng = centeredLedgerHtml.indexOf('JAIRAM DHIRUMAL');
const cIdxHindi = centeredLedgerHtml.indexOf('जयराम धीरूमल');
const cIdxAddr = centeredLedgerHtml.indexOf('Shop-A/6 Wholesale Fruit Market, Camp 2, Power House, Bhilai, Chhattisgarh');
const cIdxContact = centeredLedgerHtml.indexOf('Dhirumal:');

expect(
  cIdxShort !== -1 &&
    cIdxEng !== -1 &&
    cIdxHindi !== -1 &&
    cIdxAddr !== -1 &&
    cIdxContact !== -1 &&
    cIdxShort < cIdxEng &&
    cIdxEng < cIdxHindi &&
    cIdxHindi < cIdxAddr &&
    cIdxAddr < cIdxContact,
  'Centered ledger header stacks strictly in order: 1. Short Name -> 2. English Name -> 3. Hindi Name -> 4. Complete Address -> 5. Contact Number(s)'
);

// Verify CustomerLedgerView uses ledger-centered on all 3 print sections
const customerLedgerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CustomerLedgerView.tsx'), 'utf-8');
const clCenteredMatches = customerLedgerSrc.match(/variant="ledger-centered"/g) || [];
expect(
  clCenteredMatches.length === 3,
  `CustomerLedgerView uses variant="ledger-centered" on all 3 print areas (statement, detailed print, short print); found ${clCenteredMatches.length}`
);
expect(
  !customerLedgerSrc.includes('variant="ledger"'),
  'CustomerLedgerView has zero remaining two-column variant="ledger" headers'
);
expect(
  customerLedgerSrc.includes('id="customer-ledger-detailed-print-area"') &&
    customerLedgerSrc.includes('id="customer-ledger-short-print-area"') &&
    customerLedgerSrc.includes('ACCOUNT DETAILS'),
  'CustomerLedgerView preserves Detailed Print, Short Print, and ACCOUNT DETAILS section'
);

// Verify SaleProceedsLedgerView uses ledger-centered on both Short & Detailed print sections
const spLedgerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/SaleProceedsLedgerView.tsx'), 'utf-8');
const spCenteredMatches = spLedgerSrc.match(/variant="ledger-centered"/g) || [];
expect(
  spCenteredMatches.length === 2,
  `SaleProceedsLedgerView uses variant="ledger-centered" on both Short Print and Detailed Print; found ${spCenteredMatches.length}`
);
expect(
  !spLedgerSrc.includes('variant="ledger"'),
  'SaleProceedsLedgerView has zero remaining two-column variant="ledger" headers'
);
expect(
  spLedgerSrc.includes('id="sale-proceeds-short-print-area"') &&
    spLedgerSrc.includes('id="sale-proceeds-print-area"') &&
    spLedgerSrc.includes('ACCOUNT DETAILS'),
  'SaleProceedsLedgerView preserves Short Print, Detailed Print, and ACCOUNT DETAILS section'
);

// =========================================================================
// 3. OTHER REPORTS KEEP TWO-COLUMN LEDGER HEADER & PRINT CSS IS CLEAN
// =========================================================================
console.log('\n--- 3. Testing Unrelated Reports & Print CSS Integrity ---');

const standardLedgerHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(PrintBusinessHeader, {
    profile: sampleProfile,
    variant: 'ledger',
  })
);
expect(
  standardLedgerHtml.includes('print-business-header-left') &&
    standardLedgerHtml.includes('print-business-header-right'),
  'Standard variant="ledger" continues rendering two-column header for other reports'
);

['CrateStatementView.tsx', 'GroupSaleView.tsx', 'ReportsView.tsx'].forEach((file) => {
  const folder = file === 'CrateStatementView.tsx' ? 'accounts' : file === 'GroupSaleView.tsx' ? 'billing' : 'reports';
  const src = fs.readFileSync(path.join(process.cwd(), `src/components/${folder}/${file}`), 'utf-8');
  expect(src.includes('variant="ledger"'), `${file} retains two-column variant="ledger" untouched`);
});

const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
expect(
  indexCss.includes('[data-pdf-export="true"]') && indexCss.includes('overflow: visible !important'),
  'index.css enforces overflow: visible !important during PDF export'
);
expect(
  indexCss.includes('.print-business-header--ledger-centered') &&
    indexCss.includes('justify-content: center !important'),
  'index.css enforces centered layout and centered contact flex alignment for ledger-centered print headers'
);

console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
if (failures > 0) {
  process.exit(1);
}
