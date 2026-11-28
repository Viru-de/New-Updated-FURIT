import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { db } from '../src/services/db';
import { BillingLineItem } from '../src/utils/billingCalculations';

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

function makeItems(count: number): BillingLineItem[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `item-${idx + 1}`,
    fruitId: `fruit-${idx + 1}`,
    fruitName: `FRUIT ITEM ${idx + 1}`,
    quantity: 5,
    unit: 'Crate',
    kg: 100,
    rate: 80,
    amount: 4000,
  }));
}

async function run() {
  console.log('=== B7 Dynamic Middle Section Verification (1, 5, 10, >10 Items) ===\n');

  const profile = db.getDefaultProfile();

  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    for (const count of [1, 5, 10, 15] as const) {
      const items = makeItems(count);
      const html = renderToStaticMarkup(
        React.createElement(BillTableCanvas, {
          saleType,
          billNumber: saleType === 'CREDIT SALE' ? 'CS-777' : 'CASH-777',
          date: '2026-11-26',
          challanDate: '2026-11-25',
          customerName: 'Ramesh Fruit Co.',
          items,
          expenses: [
            { id: 'e1', name: 'Hamali', amount: 300 },
            { id: 'e2', name: 'Freight', amount: 700 },
          ],
          oldBalance: saleType === 'CREDIT SALE' ? 12000 : undefined,
          cashReceipt: saleType === 'CREDIT SALE' ? 2000 : undefined,
          paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
          profile,
          pageSize: 'b7',
        })
      );

      const expectedPages = Math.ceil(count / 10);
      const pageTags = [...html.matchAll(/data-b7-page="(\d+)"/g)].map((m) => Number(m[1]));

      check(
        pageTags.length === expectedPages &&
          html.includes(`data-b7-total-pages="${expectedPages}"`),
        `${saleType} (${count} items): renders exact ${expectedPages} B7 page(s)`,
        `pages=${JSON.stringify(pageTags)}`
      );

      // Fixed Header & Fixed Footer structure + increased bold fonts + symmetric side borders + bold B7 address & contact
      const expectedRowHeightClass = count <= 3 ? 'h-[28px]' : count <= 5 ? 'h-[26px]' : 'h-[19px]';
      check(
        html.includes('b7-bill-header') &&
          html.includes('b7-bill-frame') &&
          html.includes('b7-columns-fill') &&
          html.includes('b7-footer-summary-table') &&
          html.includes('b7-bill-bottom-area') &&
          html.includes('justify-between') &&
          html.includes('px-2.5') &&
          html.includes('text-[10px] print:text-[10.5px]') &&
          html.includes('text-[10.5px] print:text-[11px] font-bold') &&
          html.includes('text-[7.5px] print:text-[8px] font-bold text-black') &&
          html.includes('text-[6.5px] print:text-[7px] tracking-tight font-bold text-black') &&
          !html.includes('text-[9px] print:text-[9.5px] font-semibold text-black') &&
          html.includes(expectedRowHeightClass),
        `${saleType} (${count} items): locks fixed header/footer, symmetric margins, bold enlarged B7 fonts, bold B7 address/mobile, and proportional row height (${expectedRowHeightClass})`
      );

      // Zero artificial blank item rows (&nbsp; placeholder rows from blankRowsCount)
      const firstTbodyHtml = html.match(/<table[^>]*b7-bill-table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
      const tbodies = [...html.matchAll(/<table[^>]*b7-bill-table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g)].map((m) => m[1]);
      const totalRenderedItemRows = tbodies.reduce(
        (sum, tb) => sum + [...tb.matchAll(/<tr[\s\S]*?<\/tr>/g)].length,
        0
      );
      check(
        firstTbodyHtml.includes('FRUIT ITEM 1') &&
          totalRenderedItemRows === count &&
          !html.includes('border-b border-black/20'),
        `${saleType} (${count} items): renders exact ${count} item rows with zero artificial blank rows`,
        `rows=${totalRenderedItemRows}`
      );

      // Check max 10 rows per page and global serial numbering
      const pageBlocks = html.split(/data-b7-page="/).slice(1);
      let pageRowCapOk = true;
      for (const pb of pageBlocks) {
        const firstTbody = pb.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] || '';
        const rowsInPage = [...firstTbody.matchAll(/<tr[\s\S]*?<\/tr>/g)].length;
        if (rowsInPage > 10 || rowsInPage === 0) pageRowCapOk = false;
      }
      check(
        pageRowCapOk,
        `${saleType} (${count} items): enforces max 10 item rows per B7 page`
      );

      if (count === 15) {
        check(
          pageBlocks[0].includes('>FRUIT ITEM 1<') &&
            pageBlocks[0].includes('>FRUIT ITEM 10<') &&
            !pageBlocks[0].includes('>FRUIT ITEM 11<') &&
            pageBlocks[0].includes('Continued on Page 2 of 2') &&
            pageBlocks[1].includes('>FRUIT ITEM 11<') &&
            pageBlocks[1].includes('>FRUIT ITEM 15<') &&
            pageBlocks[1].includes('Balance Crate:') &&
            pageBlocks[1].includes('Net Total'),
          `${saleType} (15 items): Page 1 has items 1–10 + continuation bar, Page 2 has items 11–15 + complete fixed footer`
        );
      }

      // Full totals across all items
      const expectedTotalQty = count * 5;
      const expectedTotalKg = count * 100;
      const expectedProductTotal = (count * 4000).toFixed(2);
      const expectedNetTotal = (count * 4000 + 1000).toFixed(2);
      check(
        html.includes(`>${expectedTotalQty}<`) &&
          html.includes(`>${expectedTotalKg}<`) &&
          html.includes(expectedProductTotal) &&
          html.includes(expectedNetTotal) &&
          html.includes('Balance Crate:') &&
          html.includes('Software Developed by:'),
        `${saleType} (${count} items): preserves full Qty (${expectedTotalQty}), KG (${expectedTotalKg}), Total (${expectedProductTotal}), Net Total (${expectedNetTotal}) & Footer`
      );
    }
  }

  // Sale Proceeds B7 dynamic middle layout, aligned borders, enlarged address/contact & enlarged totals/amounts
  const origWindow = (globalThis as any).window;
  const origSessionStorage = (globalThis as any).sessionStorage;
  (globalThis as any).window = {};
  (globalThis as any).sessionStorage = {
    getItem: () => 'b7',
    setItem: () => {},
  };
  try {
    for (const count of [1, 5, 10, 15] as const) {
      const items = makeItems(count).map((it, idx) => ({
        ...it,
        id: it.id || `sp-item-${idx + 1}`,
        fruitId: it.fruitId || `sp-fruit-${idx + 1}`,
        weight: it.kg,
      }));
      const expectedProductTotal = count * 4000;
      const expectedNetTotal = expectedProductTotal - 1000;
      const html = renderToStaticMarkup(
        React.createElement(SaleProceedPrintModal, {
          isOpen: true,
          onClose: () => {},
          proceeds: {
            id: `sp-b7-${count}`,
            proceedsNo: `Sale Proceeds No. 70${count}`,
            sequenceNumber: 700 + count,
            date: '2026-11-26',
            challanDate: '2026-11-25',
            vendorName: 'Kashmir Fruit Orchards',
            items,
            quantity: count * 5,
            unit: 'Crate',
            weight: count * 100,
            rate: 80,
            amount: expectedProductTotal,
            expenses: [
              { id: 'e1', name: 'Hamali', amount: 300 },
              { id: 'e2', name: 'Freight', amount: 700 },
            ],
            totalExpense: 1000,
            netAmount: expectedNetTotal,
            difference: -1000,
            createdAt: new Date().toISOString(),
          },
        })
      );

      const expectedPages = Math.ceil(count / 10);
      const pageTags = [...html.matchAll(/data-b7-page="(\d+)"/g)].map((m) => Number(m[1]));
      const expectedRowHeightClass = count <= 3 ? 'h-[28px]' : count <= 5 ? 'h-[26px]' : 'h-[19px]';

      check(
        pageTags.length === expectedPages &&
          html.includes(`data-b7-total-pages="${expectedPages}"`) &&
          html.includes('data-compat-105="true"') &&
          html.includes('max-w-[397px]'),
        `SALE PROCEED B7 (${count} items): renders exact ${expectedPages} page(s) in 105 × 148.5 mm portrait`
      );

      check(
        html.includes('b7-bill-header') &&
          html.includes('b7-bill-frame') &&
          html.includes('b7-columns-fill') &&
          html.includes('b7-footer-summary-table') &&
          html.includes('b7-bill-bottom-area') &&
          html.includes('px-2.5') &&
          html.includes('text-[9px] print:text-[9.5px] font-semibold text-black') &&
          html.includes('text-[8.5px] print:text-[9px] tracking-tight font-bold text-black') &&
          html.includes('text-[10px] print:text-[10.5px] font-bold tracking-tight') &&
          html.includes('text-[10.5px] print:text-[11px] font-extrabold tracking-tight') &&
          html.includes('text-[11px] print:text-[11.5px] tracking-tight') &&
          html.includes(expectedRowHeightClass),
        `SALE PROCEED B7 (${count} items): applies aligned .b7-bill-frame borders, enlarged address/mobile, enlarged Sub Total/Expenses/Net Total fonts, and proportional row height (${expectedRowHeightClass})`
      );

      const tbodies = [...html.matchAll(/<table[^>]*b7-bill-table[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/g)].map((m) => m[1]);
      const totalRenderedItemRows = tbodies.reduce(
        (sum, tb) => sum + [...tb.matchAll(/<tr[\s\S]*?<\/tr>/g)].length,
        0
      );
      check(
        totalRenderedItemRows === count && !html.includes('border-b border-black/20'),
        `SALE PROCEED B7 (${count} items): renders exact ${count} item rows with zero artificial blank rows`
      );

      if (count === 15) {
        const pageBlocks = html.split(/data-b7-page="/).slice(1);
        check(
          pageBlocks[0].includes('>FRUIT ITEM 1<') &&
            pageBlocks[0].includes('>FRUIT ITEM 10<') &&
            !pageBlocks[0].includes('>FRUIT ITEM 11<') &&
            pageBlocks[0].includes('Continued on Page 2 of 2') &&
            pageBlocks[1].includes('>FRUIT ITEM 11<') &&
            pageBlocks[1].includes('>FRUIT ITEM 15<') &&
            pageBlocks[1].includes('Sub Total') &&
            pageBlocks[1].includes('Net Total'),
          'SALE PROCEED B7 (15 items): Page 1 has items 1–10 + continuation bar, Page 2 has items 11–15 + fixed totals summary'
        );
      }
    }

    // Verify non-B7 sizes remain completely untouched on SaleProceedPrintModal
    (globalThis as any).sessionStorage = {
      getItem: () => 'a5',
      setItem: () => {},
    };
    const spA5Html = renderToStaticMarkup(
      React.createElement(SaleProceedPrintModal, {
        isOpen: true,
        onClose: () => {},
        proceeds: {
          id: 'sp-a5-untouched',
          proceedsNo: 'Sale Proceeds No. 001',
          sequenceNumber: 1,
          date: '2026-11-26',
          challanDate: '2026-11-26',
          vendorName: 'Test Vendor',
          items: makeItems(1).map((it, idx) => ({
            ...it,
            id: it.id || `sp-a5-item-${idx + 1}`,
            fruitId: it.fruitId || `sp-a5-fruit-${idx + 1}`,
            weight: it.kg,
          })),
          quantity: 5,
          unit: 'Crate',
          weight: 100,
          rate: 80,
          amount: 4000,
          expenses: [],
          totalExpense: 0,
          netAmount: 4000,
          difference: 0,
          createdAt: new Date().toISOString(),
        },
      })
    );
    check(
      !spA5Html.includes('b7-bill-page') &&
        !spA5Html.includes('b7-columns-fill') &&
        !spA5Html.includes('data-compat-105') &&
        spA5Html.includes('border-b border-black/20'),
      'SaleProceedPrintModal A5 remains completely untouched with standard blank rows'
    );
  } finally {
    if (origWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = origWindow;
    if (origSessionStorage === undefined) delete (globalThis as any).sessionStorage;
    else (globalThis as any).sessionStorage = origSessionStorage;
  }

  // Verify non-B7 sizes still preserve their standard blankRowsCount & single-table markup in BillTableCanvas
  for (const size of ['compact', 'b6', 'a5', 'a4'] as const) {
    const htmlOther = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType: 'CREDIT SALE',
        billNumber: 'CS-1',
        date: '2026-11-26',
        customerName: 'Other Size Test',
        items: makeItems(1),
        profile,
        pageSize: size,
      })
    );
    check(
      !htmlOther.includes('b7-bill-page') &&
        !htmlOther.includes('b7-columns-fill') &&
        htmlOther.includes('border-b border-black/20'),
      `Paper size ${size.toUpperCase()} remains completely untouched with standard blank mandi rows`
    );
  }

  // Verify CSS & PDF engine rules for .b7-bill-page & unclipped .b7-bill-frame borders
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  const pdfSrc = fs.readFileSync(path.join(process.cwd(), 'src/utils/pdfAndShareEngine.ts'), 'utf-8');
  check(
    cssSrc.includes('.b7-bill-page') &&
      cssSrc.includes('.b7-bill-page-break') &&
      cssSrc.includes('justify-content: space-between !important;') &&
      cssSrc.includes('.b7-bill-frame > table.b7-bill-table') &&
      cssSrc.includes('.b7-bill-frame .b7-columns-fill > table') &&
      cssSrc.includes('padding: 1.5mm 2.5mm 1.5mm 2.5mm !important;') &&
      cssSrc.includes('padding: 6px 10px 6px 10px !important;') &&
      pdfSrc.includes('b7PageCssBounds') &&
      pdfSrc.includes("querySelectorAll('.b7-bill-page')"),
    'src/index.css and pdfAndShareEngine.ts enforce unclipped symmetric .b7-bill-frame borders, equal margins, and multi-page B7 PDF slicing'
  );

  console.log(`\n=== SUMMARY: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
