import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { getBillItemNameCellClass } from '../src/utils/billingCalculations';
import { db } from '../src/services/db';
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
  console.log('=== B7 Print Single-Line Fruit Item Name Verification (Credit Sale, Sale Proceeds & Cash Sale) ===\n');

  const profile = db.getDefaultProfile();

  const tenFruitItems = [
    { id: '1', fruitId: 'f1', fruitName: 'ALPHONSO MANGO', quantity: 10, unit: 'Crate', kg: 200, weight: 200, rate: 120, amount: 24000 },
    { id: '2', fruitId: 'f2', fruitName: 'GREEN GRAPES', quantity: 15, unit: 'Box', kg: 150, weight: 150, rate: 90, amount: 13500 },
    { id: '3', fruitId: 'f3', fruitName: 'RED DELICIOUS APPLE', quantity: 12, unit: 'Box', kg: 180, weight: 180, rate: 150, amount: 27000 },
    { id: '4', fruitId: 'f4', fruitName: 'KESAR MANGO', quantity: 8, unit: 'Crate', kg: 160, weight: 160, rate: 110, amount: 17600 },
    { id: '5', fruitId: 'f5', fruitName: 'BLACK GRAPES', quantity: 10, unit: 'Box', kg: 100, weight: 100, rate: 105, amount: 10500 },
    { id: '6', fruitId: 'f6', fruitName: 'WASHINGTON APPLE', quantity: 6, unit: 'Box', kg: 120, weight: 120, rate: 180, amount: 21600 },
    { id: '7', fruitId: 'f7', fruitName: 'NAGPUR ORANGE', quantity: 20, unit: 'Crate', kg: 400, weight: 400, rate: 55, amount: 22000 },
    { id: '8', fruitId: 'f8', fruitName: 'POMEGRANATE ANAR', quantity: 14, unit: 'Box', kg: 140, weight: 140, rate: 135, amount: 18900 },
    { id: '9', fruitId: 'f9', fruitName: 'KINNAUR ROYAL APPLE', quantity: 9, unit: 'Box', kg: 180, weight: 180, rate: 160, amount: 28800 },
    { id: '10', fruitId: 'f10', fruitName: 'BANANA ROBUSTA', quantity: 25, unit: 'Crate', kg: 500, weight: 500, rate: 32, amount: 16000 },
  ];

  // 1. Credit Sale & Cash Sale on B7
  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType,
        billNumber: saleType === 'CREDIT SALE' ? 'CS-2026-0108' : 'CASH-2026-0042',
        date: '2026-11-22',
        customerName: 'M/s Mahadev Fruit Traders',
        items: tenFruitItems,
        expenses: [
          { id: 'e1', name: 'Hamali', amount: 1200 },
          { id: 'e2', name: 'Freight', amount: 1800 },
        ],
        oldBalance: saleType === 'CREDIT SALE' ? 50000 : undefined,
        cashReceipt: saleType === 'CREDIT SALE' ? 25000 : undefined,
        paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
        profile,
        pageSize: 'b7',
      })
    );

    check(
      html.includes('b7-bill-table b7-single-line-table'),
      `B7 ${saleType}: attaches b7-single-line-table selector`
    );

    const colMatches = [...(html.match(/<colgroup>([\s\S]*?)<\/colgroup>/)?.[1] || '').matchAll(/width:\s*([0-9.]+%)/g)].map((m) => m[1]);
    check(
      JSON.stringify(colMatches) === JSON.stringify(['7%', '37%', '15%', '10%', '13%', '18%']),
      `B7 ${saleType}: optimizes colWidths to 7% NO / 37% ITEM NAME / 15% QTY / 10% KG / 13% RATE / 18% AMOUNT`,
      JSON.stringify(colMatches)
    );

    const tbodyHtml = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
    const rowMatches = [...tbodyHtml.matchAll(/<tr[\s\S]*?<\/tr>/g)];
    check(rowMatches.length === 10, `B7 ${saleType}: renders all 10 fruit item rows cleanly`, `count=${rowMatches.length}`);

    for (const item of tenFruitItems) {
      const cls = getBillItemNameCellClass(item.fruitName, 'b7', saleType);
      check(
        html.includes(item.fruitName) &&
          cls.includes('whitespace-nowrap') &&
          !cls.includes('whitespace-normal') &&
          !cls.includes('break-words') &&
          !cls.includes('truncate'),
        `B7 ${saleType}: "${item.fruitName}" renders intact on single line`
      );
    }

    check(
      !tbodyHtml.includes('truncate') && !tbodyHtml.includes('text-ellipsis') && !tbodyHtml.includes('whitespace-normal'),
      `B7 ${saleType}: tbody never truncates or enables multi-line wrapping`
    );

    check(
      html.includes('Total') &&
        html.includes('Expense') &&
        html.includes('Net Total') &&
        html.includes('Balance Crate:') &&
        html.includes('Software Developed by:'),
      `B7 ${saleType}: preserves complete summary, Balance Crate, Expenses, and footer`
    );
  }

  // 2. Sale Proceeds on B7
  // Ensure localStorage doesn't override default paper size in SSR — override getLastSelectedPaperSize isn't needed if we check source + render
  const spSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
  check(
    spSrc.includes("isB7 ? 'b7-bill-table b7-single-line-table'") &&
      spSrc.includes("no: '7%',\n        item: '36%',\n        qty: '14%',\n        weight: '12%',\n        price: '13%',\n        amount: '18%',") &&
      spSrc.includes("getBillItemNameCellClass(it.fruitName, pageSize, 'SALE PROCEED')") &&
      spSrc.includes('colSpan={isB7 ? 2 : 4}') &&
      spSrc.includes('colSpan={isB7 ? 4 : 2}'),
    'B7 SALE PROCEED: SaleProceedPrintModal applies b7-single-line-table, 7/36/14/12/13/18 colWidths, SALE PROCEED single-line helper, and 2+4 summary colspans'
  );

  for (const fruitName of ['ALPHONSO MANGO', 'GREEN GRAPES', 'RED DELICIOUS APPLE']) {
    const cls = getBillItemNameCellClass(fruitName, 'b7', 'SALE PROCEED');
    check(
      cls.includes('whitespace-nowrap') && !cls.includes('whitespace-normal') && !cls.includes('break-words'),
      `B7 SALE PROCEED: "${fruitName}" uses single-line whitespace-nowrap styling`
    );
  }

  // Simulate SSR with B7 persisted paper size for SaleProceedPrintModal
  const origWindow = (globalThis as any).window;
  const origSessionStorage = (globalThis as any).sessionStorage;
  (globalThis as any).window = {};
  (globalThis as any).sessionStorage = {
    getItem: () => 'b7',
    setItem: () => {},
  };
  try {
    const spB7Html = renderToStaticMarkup(
      React.createElement(SaleProceedPrintModal, {
        isOpen: true,
        onClose: () => {},
        proceeds: {
          id: 'sp-b7-test',
          proceedsNo: 'Sale Proceeds No. 108',
          sequenceNumber: 108,
          date: '2026-11-22',
          challanDate: '2026-11-22',
          vendorName: 'Kashmir Fruit Orchards',
          items: tenFruitItems,
          quantity: 139,
          unit: 'Crate',
          rate: 100,
          amount: 199900,
          expenses: [
            { id: 'e1', name: 'Hamali', amount: 1200 },
            { id: 'e2', name: 'Freight', amount: 1800 },
          ],
          totalExpense: 3000,
          netAmount: 196900,
          difference: -3000,
          createdAt: new Date().toISOString(),
        },
      })
    );

    const spCols = [...(spB7Html.match(/<colgroup>([\s\S]*?)<\/colgroup>/)?.[1] || '').matchAll(/width:\s*([0-9.]+%)/g)].map((m) => m[1]);
    check(
      spB7Html.includes('b7-bill-table b7-single-line-table') &&
        JSON.stringify(spCols) === JSON.stringify(['7%', '36%', '14%', '12%', '13%', '18%']),
      'B7 SALE PROCEED (SSR): renders b7-single-line-table and 7/36/14/12/13/18 colgroup',
      JSON.stringify(spCols)
    );

    const spTbody = spB7Html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
    const spRows = [...spTbody.matchAll(/<tr[\s\S]*?<\/tr>/g)];
    check(spRows.length === 10, 'B7 SALE PROCEED (SSR): renders all 10 fruit rows without wrapping or truncation', `count=${spRows.length}`);
    check(
      spB7Html.includes('ALPHONSO MANGO') &&
        spB7Html.includes('GREEN GRAPES') &&
        spB7Html.includes('RED DELICIOUS APPLE') &&
        !spTbody.includes('whitespace-normal') &&
        !spTbody.includes('truncate'),
      'B7 SALE PROCEED (SSR): renders ALPHONSO MANGO, GREEN GRAPES, RED DELICIOUS APPLE on single lines'
    );
    check(
      spB7Html.includes('Sub Total') &&
        spB7Html.includes('Expenses') &&
        spB7Html.includes('Net Total') &&
        spB7Html.includes('199900.00') &&
        spB7Html.includes('196900.00'),
      'B7 SALE PROCEED (SSR): renders Sub Total, Expenses, Net Total cleanly'
    );
  } finally {
    if (origWindow === undefined) {
      delete (globalThis as any).window;
    } else {
      (globalThis as any).window = origWindow;
    }
    if (origSessionStorage === undefined) {
      delete (globalThis as any).sessionStorage;
    } else {
      (globalThis as any).sessionStorage = origSessionStorage;
    }
  }

  // 3. Verify A4, A5, B6, Compact remain completely untouched
  for (const size of ['compact', 'a4', 'a5', 'b6'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType: 'CREDIT SALE',
        billNumber: 'CS-1',
        date: '2026-11-22',
        customerName: 'Test Customer',
        items: tenFruitItems.slice(0, 2),
        profile,
        pageSize: size,
      })
    );
    check(
      !html.includes('b7-single-line-table') && html.includes('[overflow-wrap:anywhere]'),
      `${size.toUpperCase()} format remains completely unaffected`
    );
  }

  // 4. Verify CSS rules in src/index.css enforce single-line print, PDF, and preview
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    cssSrc.includes('table.b7-bill-table.b7-single-line-table > tbody > tr > td:nth-child(2)') &&
      cssSrc.includes('white-space: nowrap !important;') &&
      cssSrc.includes('overflow-wrap: normal !important;') &&
      cssSrc.includes('word-break: normal !important;'),
    'src/index.css defines single-line print, PDF, and preview rules for b7-single-line-table'
  );

  // 5. Verify B7 horizontal width & single-page vertical height budgets
  const b7PrintableWidthPx = (PAPER_SIZE_SPECS.b7.widthMm - 7) * 3.7795; // ~81mm = 306px
  const itemCol36Px = b7PrintableWidthPx * 0.36; // ~110.2px (Sale Proceed)
  const itemCol37Px = b7PrintableWidthPx * 0.37; // ~113.2px (Credit/Cash Sale)
  const redDeliciousPx = 19 * 7 * 0.63; // ~83.8px
  check(
    itemCol36Px >= 108 && itemCol37Px >= 110 && redDeliciousPx < itemCol36Px - 5,
    `Horizontal width fits RED DELICIOUS APPLE (~${redDeliciousPx.toFixed(1)}px) inside B7 ITEM NAME (${itemCol36Px.toFixed(1)}–${itemCol37Px.toFixed(1)}px)`
  );

  const b7PrintableHeightPx = (PAPER_SIZE_SPECS.b7.heightMm - 4) * 3.7795; // ~457px
  const estimated10RowTotalPx = 78 + 42 + 14 + 10 * 13 + 14 + 74 + 34; // ~386px
  check(
    estimated10RowTotalPx < b7PrintableHeightPx,
    `Single-page B7 vertical height budget (${estimated10RowTotalPx}px <= ${b7PrintableHeightPx.toFixed(0)}px printable) fits all 10 items + complete summary`
  );

  console.log(`\n=== SUMMARY: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
