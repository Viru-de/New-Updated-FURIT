import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { db } from '../src/services/db';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { ReceiptPrintModal } from '../src/components/print/ReceiptPrintModal';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
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
  console.log('=== Old HFC Single-Vertical Centered Bill Header Verification ===\n');

  const profiles = db.getCompanyProfiles();
  const hariKripa = profiles.find((p) => p.id === 'cp1') || profiles[0];
  const jairam = profiles.find((p) => p.id === 'cp_jd');

  const paperSizes: BillPaperSize[] = ['a4', 'a5', 'compact', 'b6', 'b7'];

  // 1. Verify PrintBusinessHeader variant="bill" renders centered single vertical sequence across all paper sizes
  for (const profile of [hariKripa, ...(jairam ? [jairam] : [])]) {
    const shortLabel = (profile.shortName || profile.shortCode || '').trim();
    const addressLine = [profile.address, profile.city, profile.state]
      .map((s) => (s || '').trim())
      .filter(Boolean)
      .join(', ');

    for (const size of paperSizes) {
      const label = `${profile.name} (${size.toUpperCase()})`;
      const html = renderToStaticMarkup(
        React.createElement(PrintBusinessHeader, {
          profile,
          variant: 'bill',
          paperSize: size,
        })
      );

      check(
        html.includes('print-business-header--bill') && html.includes('text-center'),
        `${label}: uses centered single-column bill header class`
      );
      check(
        !html.includes('print-business-header-left') &&
          !html.includes('print-business-header-right') &&
          !html.includes('justify-between'),
        `${label}: NO two-column left/right split present`
      );
      check(
        html.includes('justify-center text-center'),
        `${label}: contacts row centered below address`
      );

      // Verify exact top-to-bottom order in HTML: Short -> English -> Hindi -> Address -> Contact
      const shortIdx = shortLabel ? html.indexOf(shortLabel) : 0;
      const engIdx = html.indexOf(profile.name);
      const hindiIdx = profile.hindiName ? html.indexOf(profile.hindiName) : engIdx;
      const addrIdx = html.indexOf(addressLine);
      const contactIdx = html.indexOf(profile.mobile);

      check(
        shortIdx !== -1 &&
          engIdx !== -1 &&
          hindiIdx !== -1 &&
          addrIdx !== -1 &&
          contactIdx !== -1 &&
          shortIdx <= engIdx &&
          engIdx < hindiIdx &&
          hindiIdx < addrIdx &&
          addrIdx < contactIdx,
        `${label}: strict vertical sequence (${shortLabel || 'Name'} -> English -> Hindi -> Address -> Contact)`
      );
    }
  }

  // 2. Verify PrintBusinessHeader variant="ledger" remains strictly two-column left/right
  const ledgerHtml = renderToStaticMarkup(
    React.createElement(PrintBusinessHeader, {
      profile: hariKripa,
      variant: 'ledger',
      paperSize: 'a4',
    })
  );
  check(
    ledgerHtml.includes('print-business-header--ledger') &&
      ledgerHtml.includes('print-business-header-left') &&
      ledgerHtml.includes('print-business-header-right') &&
      ledgerHtml.includes('justify-between'),
    'Ledger header preserves two-column left/right layout unchanged'
  );

  // 3. Verify all 3 printable bill modals/canvases render centered old HFC bill header
  const creditHtml = renderToStaticMarkup(
    React.createElement(BillTableCanvas, {
      saleType: 'CREDIT SALE',
      billNumber: 'CS-202',
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
      pageSize: 'a5',
    })
  );
  check(
    creditHtml.includes('print-business-header--bill') &&
      !creditHtml.includes('print-business-header-left') &&
      creditHtml.includes('12000.00'),
    'BillTableCanvas (Credit/Cash Sale) renders centered bill header with calculations intact'
  );

  const saleProceedHtml = renderToStaticMarkup(
    React.createElement(SaleProceedPrintModal, {
      isOpen: true,
      onClose: () => {},
      proceeds: {
        id: 'sp-test',
        proceedsNo: 'Sale Proceeds No. 001',
        sequenceNumber: 1,
        date: '2026-11-20',
        challanDate: '2026-11-20',
        vendorName: 'Test Vendor',
        items: [
          {
            id: 'spi-1',
            fruitId: 'f1',
            fruitName: 'Mango',
            quantity: 5,
            unit: 'Box',
            rate: 500,
            amount: 2500,
          },
        ],
        quantity: 5,
        unit: 'Box',
        rate: 500,
        amount: 2500,
        expenses: [{ id: 'e1', name: 'Hamali', amount: 100 }],
        totalExpense: 100,
        netAmount: 2400,
        difference: -100,
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(
    saleProceedHtml.includes('print-business-header--bill') &&
      !saleProceedHtml.includes('print-business-header-left') &&
      saleProceedHtml.includes('SALE PROCEED'),
    'SaleProceedPrintModal renders centered bill header with Sale Proceed content intact'
  );

  const receiptHtml = renderToStaticMarkup(
    React.createElement(ReceiptPrintModal, {
      isOpen: true,
      onClose: () => {},
      receipt: {
        id: 'r-test',
        receiptNo: 'Receipt No. 001',
        sequenceNumber: 1,
        customerId: 'c1',
        customerName: 'ABC Customer',
        date: '2026-11-20',
        paymentMode: 'Cash',
        amount: 5000,
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(
    receiptHtml.includes('print-business-header--bill') &&
      !receiptHtml.includes('print-business-header-left') &&
      receiptHtml.includes('PAYMENT / CASH RECEIPT'),
    'ReceiptPrintModal renders centered bill header with Receipt content intact'
  );

  // 4. Verify all 5 bill modules pass variant="bill" and all 5 ledger/statement/report modules pass variant="ledger"
  const billFiles = [
    'src/components/common/BillTableCanvas.tsx',
    'src/components/print/SaleProceedPrintModal.tsx',
    'src/components/print/ReceiptPrintModal.tsx',
    'src/components/billing/CreateBillView.tsx',
    'src/components/billing/BillHistoryView.tsx',
  ];
  for (const rel of billFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    check(
      src.includes('variant="bill"') && !src.includes('variant="ledger"'),
      `${rel} strictly uses variant="bill"`
    );
  }

  const ledgerFiles = [
    'src/components/accounts/SaleProceedsLedgerView.tsx',
    'src/components/accounts/CustomerLedgerView.tsx',
    'src/components/accounts/CrateStatementView.tsx',
    'src/components/billing/GroupSaleView.tsx',
    'src/components/reports/ReportsView.tsx',
  ];
  for (const rel of ledgerFiles) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    check(
      src.includes('variant="ledger"') && !src.includes('variant="bill"'),
      `${rel} preserves variant="ledger" unchanged`
    );
  }

  // 5. Verify CSS scoping in src/index.css
  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    indexCss.includes('.print-business-header--bill') &&
      indexCss.includes('display: block !important;') &&
      indexCss.includes('justify-content: center !important;'),
    'src/index.css enforces centered single-column print rules for .print-business-header--bill'
  );
  check(
    indexCss.includes('.print-business-header--ledger .print-business-header-left') &&
      indexCss.includes('.print-business-header--ledger .print-business-header-right'),
    'src/index.css scopes two-column left/right flex print rules exclusively to .print-business-header--ledger'
  );

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
