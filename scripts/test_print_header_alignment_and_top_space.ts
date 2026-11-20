import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { jsPDF } from 'jspdf';
import { db } from '../src/services/db';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { PAPER_SIZE_SPECS } from '../src/utils/pdfAndShareEngine';

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
  console.log('=== Print Header Alignment & Top Space Verification ===\n');

  const profiles = db.getCompanyProfiles();
  const hariKripa = profiles.find((p) => p.id === 'cp1') || profiles[0];
  const jairam = profiles.find((p) => p.id === 'cp_jd');

  // 1. Verify company data matches updated HariKripa Fruit Company profile
  check(Boolean(hariKripa && hariKripa.name === 'HariKripa Fruit Company'), 'HariKripa company name updated');
  check(hariKripa?.shortName === 'HFC' || hariKripa?.shortCode === 'HFC', 'HFC short branding preserved');
  check(hariKripa?.hindiName === 'श्री हरि कृपा', 'HariKripa Hindi name preserved');
  check(
    hariKripa?.address === 'Shop-A/6 Wholesale Fruit Market, Camp 2, Power House' &&
      hariKripa?.city === 'Bhilai (C.G.)',
    'HariKripa complete Bhilai address updated'
  );
  check(hariKripa?.logo === '/assets/hfc_circle_logo.png', 'HFC logo path preserved');

  // 2. Render PrintBusinessHeader in Bill (A4/A5 centered vertical) and Ledger (two-column left/right) variants
  for (const caseSpec of [
    { label: 'Hari Kripa A4 Bill', profile: hariKripa, variant: 'bill' as const, paperSize: 'a4' as const },
    { label: 'Hari Kripa A5 Bill', profile: hariKripa, variant: 'bill' as const, paperSize: 'a5' as const },
    { label: 'Hari Kripa Ledger (A4)', profile: hariKripa, variant: 'ledger' as const, paperSize: 'a4' as const },
    ...(jairam
      ? [
          { label: 'Jairam Dhirumal A4 Bill (No Logo)', profile: jairam, variant: 'bill' as const, paperSize: 'a4' as const },
          { label: 'Jairam Dhirumal A5 Bill (No Logo)', profile: jairam, variant: 'bill' as const, paperSize: 'a5' as const },
        ]
      : []),
  ]) {
    const html = renderToStaticMarkup(
      React.createElement(PrintBusinessHeader, {
        profile: caseSpec.profile,
        variant: caseSpec.variant,
        paperSize: caseSpec.paperSize,
      })
    );

    check(html.includes('mt-0 pt-0'), `${caseSpec.label}: header starts with zero top margin/padding`);

    if (caseSpec.variant === 'bill') {
      check(
        html.includes('print-business-header--bill') &&
          html.includes('text-center') &&
          !html.includes('print-business-header-left') &&
          !html.includes('print-business-header-right'),
        `${caseSpec.label}: uses centered single-vertical bill header without two-column split`
      );
      check(html.includes(caseSpec.profile.name), `${caseSpec.label}: English name rendered`);
      if (caseSpec.profile.hindiName) {
        check(html.includes(caseSpec.profile.hindiName), `${caseSpec.label}: Hindi name rendered`);
      }
      check(html.includes(caseSpec.profile.address), `${caseSpec.label}: address rendered`);
      check(html.includes(caseSpec.profile.mobile), `${caseSpec.label}: phone number rendered`);
    } else {
      const leftIdx = html.indexOf('print-business-header-left');
      const rightIdx = html.indexOf('print-business-header-right');

      check(leftIdx !== -1 && rightIdx !== -1 && leftIdx < rightIdx, `${caseSpec.label}: two-column left/right structure present in order`);

      const leftSection = html.slice(leftIdx, rightIdx);
      const rightSection = html.slice(rightIdx);

      if (caseSpec.profile.logo) {
        check(leftSection.includes('<img') && leftSection.includes(caseSpec.profile.logo), `${caseSpec.label}: logo grouped in LEFT section`);
      } else {
        check(!leftSection.includes('<img'), `${caseSpec.label}: no broken img when logo absent`);
      }
      check(leftSection.includes(caseSpec.profile.name), `${caseSpec.label}: English name in LEFT section`);
      if (caseSpec.profile.hindiName) {
        check(leftSection.includes(caseSpec.profile.hindiName), `${caseSpec.label}: Hindi name in LEFT section`);
      }
      if (caseSpec.profile.shortName || caseSpec.profile.shortCode) {
        check(
          leftSection.includes(caseSpec.profile.shortName || caseSpec.profile.shortCode || ''),
          `${caseSpec.label}: short branding in LEFT section`
        );
      }

      check(!rightSection.includes(caseSpec.profile.name), `${caseSpec.label}: company name NOT leaked into RIGHT section`);
      check(rightSection.includes(caseSpec.profile.address), `${caseSpec.label}: address aligned in RIGHT section`);
      check(rightSection.includes(caseSpec.profile.mobile), `${caseSpec.label}: phone number aligned in RIGHT section`);
      check(rightSection.includes('text-right') && rightSection.includes('items-end'), `${caseSpec.label}: right section neatly right-aligned`);
    }
  }

  // 3. Render BillTableCanvas in A4 and A5
  for (const size of ['a4', 'a5'] as const) {
    const billHtml = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType: 'CREDIT SALE',
        billNumber: 'CS-101',
        date: '2026-11-20',
        customerName: 'M/s Test Traders',
        items: [
          {
            id: 'i1',
            fruitName: 'Apple Shimla',
            quantity: 10,
            unit: 'Crate',
            kg: 200,
            rate: 60,
            amount: 12000,
          },
        ],
        profile: hariKripa,
        pageSize: size,
      })
    );
    check(
      billHtml.includes('print-business-header') &&
        billHtml.includes('CREDIT SALE') &&
        billHtml.includes('12000.00'),
      `BillTableCanvas (${size.toUpperCase()}) renders header and bill totals intact`
    );
  }

  // 4. Verify CSS and pdfAndShareEngine rules
  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  const pdfEngine = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');

  check(indexCss.includes('margin: 1mm 4mm 3mm 4mm;'), 'index.css reduces default @page top margin to safe 1mm');
  check(indexCss.includes('gap: 12px !important;'), 'index.css enforces clean gap between left and right header columns in print');
  check(indexCss.includes('flex: 1 1 52% !important;') && indexCss.includes('flex: 0 1 48% !important;'), 'index.css enforces balanced 52%/48% two-column print proportions');
  check(indexCss.includes('#ledger-print-area > div:first-child') && indexCss.includes('#report-print-area > div:first-child'), 'index.css zeroes top spacing on all ledger/report print wrappers');

  check(pdfEngine.includes("a4: '1.5mm 5mm 3.5mm 5mm'") && pdfEngine.includes("a5: '1mm 4mm 2mm 4mm'"), 'pdfAndShareEngine reduces A4/A5 @page top margins safely');
  check(pdfEngine.includes("clone.style.paddingTop = '0mm'") && pdfEngine.includes("clonedElement.style.paddingTop = paperSize === 'a4' ? '4px' : '3px'"), 'pdfAndShareEngine tightens top padding in both triggerPrint and generatePdfDoc');

  // 5. Verify all 10 bill & ledger print modules use PrintBusinessHeader consistently
  const expectedHeaderFiles = [
    'src/components/common/BillTableCanvas.tsx',
    'src/components/print/SaleProceedPrintModal.tsx',
    'src/components/print/ReceiptPrintModal.tsx',
    'src/components/billing/CreateBillView.tsx',
    'src/components/billing/BillHistoryView.tsx',
    'src/components/accounts/SaleProceedsLedgerView.tsx',
    'src/components/accounts/CustomerLedgerView.tsx',
    'src/components/accounts/CrateStatementView.tsx',
    'src/components/reports/ReportsView.tsx',
    'src/components/billing/GroupSaleView.tsx',
  ];
  for (const rel of expectedHeaderFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    check(src.includes('<PrintBusinessHeader'), `${rel} uses shared PrintBusinessHeader`);
  }

  // 6. Verify jsPDF A4 and A5 document instantiation with exact dimensions
  for (const size of ['a4', 'a5'] as const) {
    const spec = PAPER_SIZE_SPECS[size];
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [spec.widthMm, spec.heightMm],
    });
    const out = doc.output('arraybuffer');
    check(
      out.byteLength > 500 &&
        Math.round(doc.internal.pageSize.getWidth()) === spec.widthMm &&
        Math.round(doc.internal.pageSize.getHeight()) === spec.heightMm,
      `jsPDF generates valid ${size.toUpperCase()} (${spec.widthMm}x${spec.heightMm}mm) PDF output`
    );
  }

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
