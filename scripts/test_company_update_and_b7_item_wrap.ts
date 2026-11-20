import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jspdfModule from 'jspdf';
const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default;
import { db } from '../src/services/db';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { ReceiptPrintModal } from '../src/components/print/ReceiptPrintModal';
import { getBillItemNameCellClass } from '../src/utils/billingCalculations';
import { formatCompanySignature } from '../src/utils/formatters';
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
  console.log('=== Company Profile Update & B7 Long Item-Name Wrapping Verification ===\n');

  const profile = db.getDefaultProfile();

  // 1. Company Name, Address & 3 Contacts in default profile
  check(
    profile.name === 'HariKripa Fruit Company',
    'Default company profile name is exact spelling: HariKripa Fruit Company',
    profile.name
  );
  check(
    profile.address === 'Shop-A/6 Wholesale Fruit Market, Camp 2, Power House' &&
      profile.city === 'Bhilai (C.G.)',
    'Default company address is Shop-A/6 Wholesale Fruit Market, Camp 2, Power House, Bhilai (C.G.)'
  );
  check(
    profile.primaryContactName === 'Vishal' &&
      profile.mobile === '7566996333' &&
      profile.alternate1ContactName === 'Ranjeet' &&
      profile.alternate1Mobile === '9329599950' &&
      profile.alternate2ContactName === 'Dhirumal' &&
      profile.alternate2Mobile === '9300910015',
    'All three contacts (Vishal 7566996333, Ranjeet 9329599950, Dhirumal 9300910015) configured in company profile'
  );
  check(
    formatCompanySignature(profile) === 'FOR, HariKripa Fruit Company',
    'Signature helper formats FOR, HariKripa Fruit Company'
  );

  // 2. Verify PrintBusinessHeader across B7, B6, A5, Compact, A4 (bill variant)
  const expectedAddress = 'Shop-A/6 Wholesale Fruit Market, Camp 2, Power House, Bhilai (C.G.)';
  const paperSizes: BillPaperSize[] = ['b7', 'b6', 'a5', 'compact', 'a4'];

  for (const size of paperSizes) {
    const html = renderToStaticMarkup(
      React.createElement(PrintBusinessHeader, {
        profile,
        variant: 'bill',
        paperSize: size,
      })
    );

    check(
      html.includes('>HariKripa Fruit Company<') && !/<h1[^>]*\buppercase\b/.test(html),
      `Bill header (${size.toUpperCase()}): renders exact spelling HariKripa Fruit Company without CSS uppercase distortion`
    );
    check(
      html.includes(profile.hindiName || 'श्री हरि कृपा'),
      `Bill header (${size.toUpperCase()}): renders Hindi company name below English name`
    );
    check(
      html.includes(expectedAddress),
      `Bill header (${size.toUpperCase()}): renders complete Bhilai address without duplication`
    );
    check(
      html.includes('Vishal: 7566996333') &&
        html.includes('Ranjeet: 9329599950') &&
        html.includes('Dhirumal: 9300910015'),
      `Bill header (${size.toUpperCase()}): renders all three contacts (Vishal, Ranjeet, Dhirumal)`
    );
    check(!html.includes('<img'), `Bill header (${size.toUpperCase()}): does NOT re-add logo`);

    const nIdx = html.indexOf('HariKripa Fruit Company');
    const hIdx = html.indexOf(profile.hindiName || '');
    const aIdx = html.indexOf(expectedAddress);
    const cIdx = html.indexOf('Vishal: 7566996333');
    check(
      nIdx !== -1 && hIdx !== -1 && aIdx !== -1 && cIdx !== -1 && nIdx < hIdx && hIdx < aIdx && aIdx < cIdx,
      `Bill header (${size.toUpperCase()}): keeps vertical order Name -> Hindi -> Address -> Contacts`
    );
  }

  // Deduplication check if user enters full address + Bhilai in city
  const dupHtml = renderToStaticMarkup(
    React.createElement(PrintBusinessHeader, {
      profile: {
        ...profile,
        address: expectedAddress,
        city: 'Bhilai (C.G.)',
        state: 'C.G.',
      },
      variant: 'bill',
      paperSize: 'a5',
    })
  );
  check(
    (dupHtml.match(/Bhilai/g) || []).length === 1,
    'PrintBusinessHeader deduplicates address components so Bhilai is never repeated'
  );

  // 3. B7 Long Item-Name Wrapping Fix (GRAPES GREEN 20KG & other long names)
  const longItemNames = [
    'GRAPES GREEN 20KG',
    'APPLE KASHMIR ROYAL 20KG',
    'POMEGRANATE BHAGWA SUPER 10KG',
    'ORANGE NAGPUR SPECIAL CRATE',
    'SUPERLONGUNBROKENFRUITNAMETEST',
  ];

  for (const name of longItemNames) {
    const b7Classes = getBillItemNameCellClass(name, 'b7');
    check(
      b7Classes.includes('whitespace-normal') &&
        b7Classes.includes('break-words') &&
        b7Classes.includes('[overflow-wrap:anywhere]') &&
        !b7Classes.includes('whitespace-nowrap'),
      `getBillItemNameCellClass('${name}', 'b7') allows clean wrapping inside column without nowrap clipping`,
      b7Classes
    );
  }

  // Ensure A4/A5/B6/Compact getBillItemNameCellClass behavior remained untouched
  check(
    getBillItemNameCellClass('GRAPES GREEN 20KG', 'a5').includes('whitespace-nowrap') &&
      getBillItemNameCellClass('GRAPES GREEN 20KG', 'a4').includes('whitespace-nowrap') &&
      getBillItemNameCellClass('GRAPES GREEN 20KG', 'b6').includes('whitespace-nowrap'),
    'A4, A5, and B6 item-name styling remains untouched'
  );

  // Render B7 Credit Sale & Cash Sale bills with GRAPES GREEN 20KG + long item names
  const testItems = [
    {
      id: 'it-grapes',
      fruitName: 'GRAPES GREEN 20KG',
      quantity: 12,
      unit: 'Crate',
      kg: 240,
      weight: 240,
      rate: 75,
      amount: 18000,
    },
    {
      id: 'it-pom',
      fruitName: 'POMEGRANATE BHAGWA SUPER 10KG',
      quantity: 8,
      unit: 'Box',
      kg: 80,
      weight: 80,
      rate: 110,
      amount: 8800,
    },
  ];

  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    const b7BillHtml = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType,
        billNumber: 'CS-777',
        date: '2026-11-20',
        customerName: 'M/s Bhilai Fruit Traders',
        items: testItems,
        profile,
        pageSize: 'b7',
        paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
      })
    );

    check(
      b7BillHtml.includes('HariKripa Fruit Company') &&
        b7BillHtml.includes(expectedAddress) &&
        b7BillHtml.includes('Vishal: 7566996333') &&
        b7BillHtml.includes('Ranjeet: 9329599950') &&
        b7BillHtml.includes('Dhirumal: 9300910015'),
      `B7 ${saleType}: renders updated company name, address, and all 3 contacts`
    );
    check(
      b7BillHtml.includes('GRAPES GREEN 20KG') &&
        b7BillHtml.includes('POMEGRANATE BHAGWA SUPER 10KG') &&
        b7BillHtml.includes('whitespace-normal break-words [overflow-wrap:anywhere]') &&
        b7BillHtml.includes('<col style="width:28%"/>'),
      `B7 ${saleType}: renders GRAPES GREEN 20KG & long names inside widened 28% wrapping column`
    );
    check(
      b7BillHtml.includes('18000.00') && b7BillHtml.includes('26800.00'),
      `B7 ${saleType}: preserves calculations & net total (26800.00)`
    );
  }

  // SaleProceedPrintModal & ReceiptPrintModal check
  const spHtml = renderToStaticMarkup(
    React.createElement(SaleProceedPrintModal, {
      isOpen: true,
      onClose: () => {},
      proceeds: {
        id: 'sp-check-1',
        proceedsNo: 'Sale Proceeds No. 099',
        sequenceNumber: 99,
        date: '2026-11-20',
        challanDate: '2026-11-20',
        vendorName: 'Nashik Grape Farm',
        items: [
          {
            id: 'sp1',
            fruitId: 'f1',
            fruitName: 'GRAPES GREEN 20KG',
            quantity: 12,
            unit: 'Crate',
            weight: 240,
            rate: 75,
            amount: 18000,
          },
        ],
        quantity: 12,
        unit: 'Crate',
        rate: 75,
        amount: 18000,
        expenses: [{ id: 'e1', name: 'Hamali', amount: 200 }],
        totalExpense: 200,
        netAmount: 17800,
        difference: -200,
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(
    spHtml.includes('HariKripa Fruit Company') &&
      spHtml.includes(expectedAddress) &&
      spHtml.includes('Vishal: 7566996333') &&
      spHtml.includes('Ranjeet: 9329599950') &&
      spHtml.includes('Dhirumal: 9300910015') &&
      spHtml.includes('GRAPES GREEN 20KG'),
    'SaleProceedPrintModal renders updated company info, 3 contacts, and GRAPES GREEN 20KG'
  );

  const rcHtml = renderToStaticMarkup(
    React.createElement(ReceiptPrintModal, {
      isOpen: true,
      onClose: () => {},
      receipt: {
        id: 'rc-check-1',
        receiptNo: 'RCP-099',
        sequenceNumber: 99,
        date: '2026-11-20',
        customerId: 'c1',
        customerName: 'Bhilai Traders',
        amount: 5000,
        paymentMode: 'Cash',
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(
    rcHtml.includes('HariKripa Fruit Company') &&
      rcHtml.includes(expectedAddress) &&
      rcHtml.includes('Vishal: 7566996333') &&
      rcHtml.includes('Ranjeet: 9329599950') &&
      rcHtml.includes('Dhirumal: 9300910015'),
    'ReceiptPrintModal renders updated company info and all 3 contacts'
  );

  // CSS rules for B7 item column wrapping
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    cssSrc.includes('.print-bill-canvas table.b7-bill-table tbody td:nth-child(2)') &&
      cssSrc.includes('[data-pdf-export="true"] table.b7-bill-table tbody td:nth-child(2)') &&
      cssSrc.includes('#mandi-print-area table.b7-bill-table tbody td:nth-child(2)') &&
      cssSrc.includes('#erp-isolated-print-mount table.b7-bill-table tbody td:nth-child(2)'),
    'index.css enforces B7 item-name cell wrapping in preview, PDF export, and @media print'
  );

  // jsPDF B7 export sanity check with updated header & GRAPES GREEN 20KG
  const b7Doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [88, 125] });
  b7Doc.setFontSize(10);
  b7Doc.text('HariKripa Fruit Company', 44, 6, { align: 'center' });
  b7Doc.setFontSize(7);
  b7Doc.text(expectedAddress, 44, 11, { align: 'center' });
  b7Doc.text('Vishal: 7566996333 | Ranjeet: 9329599950 | Dhirumal: 9300910015', 44, 15, { align: 'center' });
  b7Doc.text('1  GRAPES GREEN 20KG  12 CRATE  240  75.00  18000.00', 4, 24);
  check(b7Doc.getNumberOfPages() === 1, 'jsPDF produces valid single-page B7 PDF with updated header & item row');

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

run();
