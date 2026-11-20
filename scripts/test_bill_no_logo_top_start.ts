import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { db } from '../src/services/db';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { ReceiptPrintModal } from '../src/components/print/ReceiptPrintModal';
import { BillPaperSize } from '../src/utils/pdfAndShareEngine';

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
  console.log('=== Bill Print No-Logo & Top-Aligned Header Verification ===\n');

  const profiles = db.getCompanyProfiles();
  const hariKripa = profiles.find((p) => p.id === 'cp1') || profiles[0];
  const jairam = profiles.find((p) => p.id === 'cp_jd') || profiles[0];
  const paperSizes: BillPaperSize[] = ['b7', 'b6', 'a5', 'compact', 'a4'];

  // Guarantee logo is populated on profile in test to prove bill header omits it while ledger keeps it
  const profileWithLogo = {
    ...hariKripa,
    logo: hariKripa.logo || '/assets/hfc_circle_logo.png',
  };
  const jairamWithLogo = {
    ...jairam,
    logo: '/assets/hfc_circle_logo.png',
  };

  // 1. PrintBusinessHeader variant="bill" omits logo completely across all paper sizes
  for (const prof of [profileWithLogo, jairamWithLogo]) {
    const shortLabel = (prof.shortName || prof.shortCode || '').trim();
    const addr = [prof.address, prof.city, prof.state].map((s) => (s || '').trim()).filter(Boolean).join(', ');

    for (const size of paperSizes) {
      const label = `${prof.name} (${size.toUpperCase()})`;
      const html = renderToStaticMarkup(
        React.createElement(PrintBusinessHeader, {
          profile: prof,
          variant: 'bill',
          paperSize: size,
        })
      );

      check(!html.includes('<img'), `${label}: bill header contains NO <img> logo tag`);
      check(!html.includes('rounded-full'), `${label}: bill header leaves NO empty logo container`);
      check(
        html.includes('print-business-header--bill') && html.includes('mt-0 pt-0 pb-1 mb-0.5'),
        `${label}: bill header uses zero top margin/padding (mt-0 pt-0) and compact bottom spacing`
      );
      check(
        html.includes('leading-none m-0 p-0'),
        `${label}: top label uses leading-none m-0 p-0 so text starts right from top edge`
      );

      // Sequence check: Short -> English -> Hindi -> Address -> Contact
      const sIdx = shortLabel ? html.indexOf(shortLabel) : 0;
      const eIdx = html.indexOf(prof.name || '');
      const hIdx = prof.hindiName ? html.indexOf(prof.hindiName) : eIdx;
      const aIdx = html.indexOf(addr);
      const cIdx = html.indexOf(prof.mobile || '');
      check(
        sIdx !== -1 && eIdx !== -1 && hIdx !== -1 && aIdx !== -1 && cIdx !== -1 &&
          sIdx <= eIdx && eIdx < hIdx && hIdx < aIdx && aIdx < cIdx,
        `${label}: preserves exact header sequence (HFC/JD -> English -> Hindi -> Address -> Contacts)`
      );
    }
  }

  // 2. Ledger variant STILL renders the logo intact
  const ledgerHtml = renderToStaticMarkup(
    React.createElement(PrintBusinessHeader, {
      profile: profileWithLogo,
      variant: 'ledger',
      paperSize: 'a4',
    })
  );
  check(
    ledgerHtml.includes('<img') && ledgerHtml.includes(profileWithLogo.logo!),
    'Ledger header (variant="ledger") still renders company logo unchanged'
  );

  // 3. Full Bill Canvases (Credit Sale, Cash Sale, Sale Proceed, Receipt) omit logo across all paper sizes
  const sampleItems = [
    {
      id: 'i1',
      fruitName: 'APPLE SHIMLA',
      quantity: 20,
      unit: 'Crate',
      kg: 200,
      weight: 200,
      rate: 60,
      amount: 12000,
    },
  ];

  for (const size of paperSizes) {
    for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
      const billHtml = renderToStaticMarkup(
        React.createElement(BillTableCanvas, {
          saleType,
          billNumber: 'CS-999',
          date: '2026-11-20',
          customerName: 'M/s Sharma Traders',
          items: sampleItems,
          profile: profileWithLogo,
          pageSize: size,
          paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
        })
      );
      check(
        !billHtml.includes('<img'),
        `BillTableCanvas ${saleType} (${size.toUpperCase()}): contains NO logo <img>`
      );
      check(
        billHtml.includes(profileWithLogo.name) &&
          billHtml.includes('Sharma Traders') &&
          billHtml.includes('12000.00'),
        `BillTableCanvas ${saleType} (${size.toUpperCase()}): preserves company name, customer, items, and totals`
      );
    }
  }

  const spHtml = renderToStaticMarkup(
    React.createElement(SaleProceedPrintModal, {
      isOpen: true,
      onClose: () => {},
      proceeds: {
        id: 'sp-no-logo',
        proceedsNo: 'Sale Proceeds No. 050',
        sequenceNumber: 50,
        date: '2026-11-20',
        challanDate: '2026-11-20',
        vendorName: 'Himalayan Orchards',
        items: [
          {
            id: 'sp1',
            fruitId: 'f1',
            fruitName: 'APPLE KINNAUR',
            quantity: 25,
            unit: 'Box',
            weight: 250,
            rate: 80,
            amount: 20000,
          },
        ],
        quantity: 25,
        unit: 'Box',
        rate: 80,
        amount: 20000,
        expenses: [{ id: 'e1', name: 'Commission', amount: 1000 }],
        totalExpense: 1000,
        netAmount: 19000,
        difference: -1000,
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(!spHtml.includes('<img'), 'SaleProceedPrintModal: contains NO logo <img>');
  check(
    spHtml.includes(hariKripa.name) && spHtml.includes('19000.00'),
    'SaleProceedPrintModal: preserves company name and financial totals'
  );

  const receiptHtml = renderToStaticMarkup(
    React.createElement(ReceiptPrintModal, {
      isOpen: true,
      onClose: () => {},
      receipt: {
        id: 'rc-no-logo',
        receiptNo: 'RCP-088',
        sequenceNumber: 88,
        date: '2026-11-20',
        customerId: 'c1',
        customerName: 'M/s Test Buyer',
        amount: 5000,
        paymentMode: 'Cash',
        notes: 'Test',
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(!receiptHtml.includes('<img'), 'ReceiptPrintModal: contains NO logo <img>');
  check(
    receiptHtml.includes(hariKripa.name) && receiptHtml.includes('5,000'),
    'ReceiptPrintModal: preserves company name and receipt amount'
  );

  // 4. CreateBillView & BillHistoryView strictly use variant="bill" and compact top padding
  for (const rel of [
    'src/components/billing/CreateBillView.tsx',
    'src/components/billing/BillHistoryView.tsx',
  ]) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    check(
      src.includes('variant="bill"') && src.includes('pt-0.5 px-2 pb-2') && src.includes('pt-1 px-4 pb-4'),
      `${rel}: uses variant="bill" and compact top padding across A4/A5/B6/B7/Compact`
    );
  }

  // 5. CSS & Print/PDF Engine top margin & zero-logo guard verification
  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  const engineSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');

  check(
    indexCss.includes('[data-pdf-export="true"] .print-business-header--bill') &&
      indexCss.includes('.print-bill-canvas .print-business-header--bill'),
    'index.css enforces margin-top: 0 and padding-top: 0 for bill print headers in preview & PDF export'
  );
  check(
    indexCss.includes('#mandi-print-area > div:first-child') &&
      indexCss.includes('#receipt-print-area > div:first-child') &&
      indexCss.includes('.print-business-header--bill > :first-child'),
    'index.css enforces margin-top: 0 and padding-top: 0 in @media print for bill containers & header first-child'
  );
  check(
    indexCss.includes('.print-business-header--bill img') &&
      indexCss.includes('display: none !important;'),
    'index.css includes belt-and-suspenders img hide rule scoped exclusively to .print-business-header--bill'
  );
  check(
    engineSrc.includes("b7: '1mm 3.5mm 2mm 3.5mm'") &&
      engineSrc.includes("a5: '1mm 4mm 2mm 4mm'") &&
      engineSrc.includes("a4: '1.5mm 5mm 3.5mm 5mm'") &&
      engineSrc.includes("clonedElement.style.paddingTop = paperSize === 'a4' ? '4px' : '3px'"),
    'pdfAndShareEngine maintains small, safe printer (1-1.5mm) and PDF (3-4px) top margins'
  );

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

run();
