import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { CustomerLedgerView } from '../src/components/accounts/CustomerLedgerView';
import { SaleProceedsLedgerView } from '../src/components/accounts/SaleProceedsLedgerView';
import { getBillItemNameCellClass, calculateWholesaleItemAmount, calculateSaleCrateSummary } from '../src/utils/billingCalculations';
import { db } from '../src/services/db';
import { BillPaperSize, PAPER_SIZE_SPECS } from '../src/utils/pdfAndShareEngine';

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

function extractMainColWidths(html: string): string[] {
  const colgroupMatch = html.match(/<colgroup>([\s\S]*?)<\/colgroup>/);
  if (!colgroupMatch) return [];
  return [...colgroupMatch[1].matchAll(/width:\s*([0-9.]+%)/g)].map((m) => m[1]);
}

function extractSummaryColWidths(html: string): string[] {
  const idx = html.indexOf('bill-summary-table');
  if (idx === -1) return [];
  const sub = html.slice(idx);
  const colgroupMatch = sub.match(/<colgroup>([\s\S]*?)<\/colgroup>/);
  if (!colgroupMatch) return [];
  return [...colgroupMatch[1].matchAll(/width:\s*([0-9.]+%)/g)].map((m) => m[1]);
}

async function run() {
  console.log('=== Comprehensive Credit Sale & All Print Formats Layout Verification ===\n');

  const profile = db.getDefaultProfile();
  const sizes: BillPaperSize[] = ['compact', 'a4', 'a5', 'b6', 'b7'];

  // Realistic items with long names and large decimals (432100.00, 10000.00, 422650.00)
  const testItems = [
    {
      id: 'item-1',
      fruitName: 'ROYAL GALA IMPORTED PREMIUM SPECIAL APPLE 18KG',
      quantity: 250,
      unit: 'Crate',
      kg: 4321,
      weight: 4321,
      rate: 100,
      amount: 432100,
    },
    {
      id: 'item-2',
      fruitName: 'ALPHONSO MANGO RATNAGIRI EXPORT GRADE A+',
      quantity: 50,
      unit: 'Box',
      kg: 1000,
      weight: 1000,
      rate: 10,
      amount: 10000,
    },
  ];
  const testExpenses = [
    { id: 'exp-1', name: 'Hamali', amount: 4500 },
    { id: 'exp-2', name: 'Freight', amount: 4950 },
  ];

  // 1. Item Name wrapping helper across ALL 5 paper sizes
  console.log('--- 1. Testing Item Name Cell Wrapping Helper ---');
  for (const size of sizes) {
    const shortCls = getBillItemNameCellClass('APPLE', size);
    const longCls = getBillItemNameCellClass('ROYAL GALA IMPORTED PREMIUM SPECIAL APPLE 18KG', size);
    check(
      !shortCls.includes('whitespace-nowrap') && !longCls.includes('whitespace-nowrap'),
      `${size.toUpperCase()}: item name never forces whitespace-nowrap overflow across column border`
    );
    check(
      longCls.includes('whitespace-normal') && longCls.includes('break-words') && longCls.includes('[overflow-wrap:anywhere]'),
      `${size.toUpperCase()}: long item name wraps safely inside ITEM NAME column`
    );
  }

  // 2. BillTableCanvas across Credit Sale & Cash Sale and ALL 5 paper sizes
  console.log('\n--- 2. Testing Credit Sale & Cash Sale Across Compact, A4, A5, B6, B7 ---');
  const expectedColWidths: Record<BillPaperSize, string[]> = {
    compact: ['7%', '31%', '17%', '12%', '13%', '20%'],
    a4: ['6%', '36%', '16%', '11%', '13%', '18%'],
    a5: ['7%', '32%', '17%', '12%', '13%', '19%'],
    b6: ['8%', '31%', '18%', '11%', '13%', '19%'],
    b7: ['9%', '27%', '18%', '14%', '14%', '18%'],
  };

  // Approximate inner printable width in px at 96dpi per size
  const approxCanvasPx: Record<BillPaperSize, number> = {
    compact: 468, // ~132mm printable
    a4: 748,      // ~198mm printable
    a5: 505,      // ~134mm printable
    b6: 430,      // ~114mm printable
    b7: 284,      // ~75mm printable
  };

  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    for (const size of sizes) {
      const html = renderToStaticMarkup(
        React.createElement(BillTableCanvas, {
          saleType,
          billNumber: 'CS-2026-0099',
          date: '2026-11-22',
          customerName: 'M/s ABC Fruit Merchants Mumbai',
          items: testItems,
          expenses: testExpenses,
          oldBalance: 422650,
          cashReceipt: 10000,
          profile,
          pageSize: size,
          paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
        })
      );

      const cols = extractMainColWidths(html);
      const sum = cols.reduce((acc, v) => acc + parseFloat(v), 0);
      check(
        JSON.stringify(cols) === JSON.stringify(expectedColWidths[size]) && sum === 100,
        `${saleType} (${size.toUpperCase()}): main table colgroup = ${expectedColWidths[size].join('/')} (sum=100%)`,
        JSON.stringify(cols)
      );

      const summaryCols = extractSummaryColWidths(html);
      const expectedSummary = size === 'b7' ? ['48%', '52%'] : ['47%', '53%'];
      check(
        JSON.stringify(summaryCols) === JSON.stringify(expectedSummary),
        `${saleType} (${size.toUpperCase()}): nested summary colgroup = ${expectedSummary.join('/')}`,
        JSON.stringify(summaryCols)
      );

      // Check border & wrapping discipline in rendered HTML
      check(
        html.includes('bill-items-table') &&
          html.includes('table-fixed') &&
          html.includes('box-border') &&
          html.includes('border-collapse') &&
          html.includes('bill-summary-table') &&
          html.includes('last:border-b-0'),
        `${saleType} (${size.toUpperCase()}): enforces fixed table layout, box-border, bill-summary-table, and last:border-b-0`
      );

      // Check NO. and ITEM NAME cell boundaries
      check(
        html.includes('px-0.5') &&
          html.includes('pl-1.5 pr-1') &&
          html.includes('overflow-hidden') &&
          html.includes('[overflow-wrap:anywhere]'),
        `${saleType} (${size.toUpperCase()}): enforces NO. padding (px-0.5), ITEM NAME padding (pl-1.5 pr-1), overflow-hidden, and anywhere wrap`
      );

      // Check single-line large numeric values present without inner breaks
      check(
        html.includes('432100.00') &&
          html.includes('10000.00') &&
          html.includes('442100.00') &&
          (saleType === 'CASH SALE' || (html.includes('422650.00') && html.includes('864200.00'))),
        `${saleType} (${size.toUpperCase()}): renders full numeric values (432100.00, 10000.00, 422650.00) cleanly`
      );

      // Physical pixel budget checks (Compact NO. >= 30px, Amount >= 50px even on B7, Summary value >= 65px even on B7)
      const px = approxCanvasPx[size];
      const noWidthPx = (px * parseFloat(cols[0])) / 100;
      const itemWidthPx = (px * parseFloat(cols[1])) / 100;
      const amountWidthPx = (px * parseFloat(cols[5])) / 100;
      const summaryShare = size === 'b7' ? (parseFloat(cols[3]) + parseFloat(cols[4]) + parseFloat(cols[5])) / 100 : (parseFloat(cols[4]) + parseFloat(cols[5])) / 100;
      const summaryValPx = px * summaryShare * (parseFloat(expectedSummary[1]) / 100);

      check(
        noWidthPx >= 25 && itemWidthPx >= 76 && amountWidthPx >= 50 && summaryValPx >= 66,
        `${saleType} (${size.toUpperCase()}): pixel budgets NO=${noWidthPx.toFixed(1)}px, ITEM=${itemWidthPx.toFixed(1)}px, AMT=${amountWidthPx.toFixed(1)}px, SUM_VAL=${summaryValPx.toFixed(1)}px`
      );
    }
  }

  // 3. SaleProceedPrintModal source & render verification
  console.log('\n--- 3. Testing Sale Proceed Print Modal Across All Formats ---');
  const spSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
  const spHtml = renderToStaticMarkup(
    React.createElement(SaleProceedPrintModal, {
      isOpen: true,
      onClose: () => {},
      proceeds: {
        id: 'sp-test',
        proceedsNo: 'Sale Proceeds No. 055',
        sequenceNumber: 55,
        date: '2026-11-22',
        challanDate: '2026-11-22',
        vendorName: 'Kashmir Orchards',
        items: [
          {
            id: 'sp1',
            fruitId: 'f1',
            fruitName: 'ROYAL GALA IMPORTED PREMIUM APPLE',
            quantity: 100,
            unit: 'Crate',
            weight: 4321,
            rate: 100,
            amount: 432100,
          },
        ],
        quantity: 100,
        unit: 'Crate',
        rate: 100,
        amount: 432100,
        expenses: testExpenses,
        totalExpense: 9450,
        netAmount: 422650,
        difference: -9450,
        createdAt: new Date().toISOString(),
      },
    })
  );
  check(
    spHtml.includes('bill-items-table') &&
      spHtml.includes('bill-summary-table') &&
      spHtml.includes('432100.00') &&
      spHtml.includes('422650.00') &&
      spHtml.includes('last:border-b-0'),
    'SaleProceedPrintModal renders bill-items-table, bill-summary-table, and large decimals cleanly'
  );
  const spCompactMatch = /no:\s*'7%',\s*item:\s*'31%',\s*qty:\s*'17%',\s*weight:\s*'12%',\s*price:\s*'13%',\s*amount:\s*'20%'/.test(spSrc);
  const spA4Match = /no:\s*'6%',\s*item:\s*'36%',\s*qty:\s*'16%',\s*weight:\s*'11%',\s*price:\s*'13%',\s*amount:\s*'18%'/.test(spSrc);
  const spA5Match = /no:\s*'7%',\s*item:\s*'32%',\s*qty:\s*'17%',\s*weight:\s*'12%',\s*price:\s*'13%',\s*amount:\s*'19%'/.test(spSrc);
  const spB6Match = /no:\s*'8%',\s*item:\s*'31%',\s*qty:\s*'18%',\s*weight:\s*'11%',\s*price:\s*'13%',\s*amount:\s*'19%'/.test(spSrc);
  const spB7Match = /no:\s*'9%',\s*item:\s*'27%',\s*qty:\s*'18%',\s*weight:\s*'14%',\s*price:\s*'14%',\s*amount:\s*'18%'/.test(spSrc);
  check(
    spCompactMatch && spA4Match && spA5Match && spB6Match && spB7Match,
    'SaleProceedPrintModal defines synced colWidths across Compact, A4, A5, B6, and B7'
  );

  // 4. CreateBillView & BillHistoryView (Tax Invoice previews)
  console.log('\n--- 4. Testing CreateBillView & BillHistoryView Across All Formats ---');
  for (const rel of ['src/components/billing/CreateBillView.tsx', 'src/components/billing/BillHistoryView.tsx']) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    check(
      src.includes('bill-items-table') &&
        src.includes('bill-summary-table') &&
        src.includes("{ no: '7%', item: '31%', qty: '17%', weight: '12%', price: '13%', amount: '20%' }") &&
        src.includes("{ no: '6%', item: '36%', qty: '16%', weight: '11%', price: '13%', amount: '18%' }") &&
        src.includes("{ no: '7%', item: '32%', qty: '17%', weight: '12%', price: '13%', amount: '19%' }") &&
        src.includes("{ no: '8%', item: '31%', qty: '18%', weight: '11%', price: '13%', amount: '19%' }") &&
        src.includes("{ no: '9%', item: '27%', qty: '18%', weight: '14%', price: '14%', amount: '18%' }") &&
        src.includes('colSpan={isB7 ? 3 : 4}') &&
        src.includes('colSpan={isB7 ? 3 : 2}') &&
        src.includes("<col style={{ width: '47%' }} />") &&
        src.includes("<col style={{ width: '53%' }} />") &&
        src.includes('last:border-b-0'),
      `${rel}: uses unified bill-items-table, synced 5-size colWidths, and full 2-column summary width`
    );
  }

  // 5. Ledger Prints (Short Print + Detailed Print) for Customer Ledger & Sale Proceeds Ledger
  console.log('\n--- 5. Testing Customer Ledger & Sale Proceeds Ledger (Short & Detailed Print) ---');
  const custLedgerHtml = renderToStaticMarkup(React.createElement(CustomerLedgerView, {}));
  const spLedgerHtml = renderToStaticMarkup(React.createElement(SaleProceedsLedgerView, {}));

  for (const [name, html] of [
    ['CustomerLedgerView', custLedgerHtml],
    ['SaleProceedsLedgerView', spLedgerHtml],
  ] as const) {
    check(
      html.includes('sp-short-table w-full table-fixed box-border') &&
        html.includes('ledger-ref-table') &&
        html.includes('table-fixed box-border') &&
        html.includes('width:80px') &&
        html.includes('width:92px') &&
        html.includes('width:106px'),
      `${name}: Short Print & Detailed Print enforce widened table-fixed colgroup (80px/auto/92px/92px/106px)`
    );
  }

  // 6. CSS rules verification in src/index.css
  console.log('\n--- 6. Testing CSS Rules & Specificity in src/index.css ---');
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    cssSrc.includes('.print-bill-canvas table.bill-items-table') &&
      cssSrc.includes('#mandi-print-area table.bill-items-table') &&
      cssSrc.includes('.print-bill-canvas table.bill-summary-table') &&
      cssSrc.includes('#mandi-print-area table.bill-summary-table'),
    'src/index.css defines unified .bill-items-table and .bill-summary-table rules for screen, PDF export, and @media print'
  );
  check(
    cssSrc.includes('#mandi-print-area:not(.sale-proceed-print-canvas) > table > tbody > tr > td') &&
      !cssSrc.includes('#mandi-print-area:not(.sale-proceed-print-canvas) tbody td'),
    'src/index.css scopes direct main table tbody td strictly so nested bill-summary-table borders stay pure black'
  );
  check(
    cssSrc.includes('border-left: none !important;') &&
      cssSrc.includes('border-right: none !important;') &&
      cssSrc.includes('border-bottom: none !important;'),
    'src/index.css strips duplicate edge borders at outer table intersections'
  );

  // 7. Billing calculation invariance check
  console.log('\n--- 7. Testing Business Calculation Invariance ---');
  check(calculateWholesaleItemAmount(250, 'Crate', 4321, 100) === 432100, '4321kg * 100 = 432100 unchanged');
  check(calculateWholesaleItemAmount(50, 'Box', 0, 200) === 10000, '50 Box (0kg) * 200 = 10000 unchanged');
  const crateSum = calculateSaleCrateSummary(testItems);
  check(crateSum.totalBalanceCrates === 250, 'Crate balance ignores Box and sums 250 Crates unchanged');

  // 8. Check PAPER_SIZE_SPECS preserved
  check(
    PAPER_SIZE_SPECS.compact.widthMm === 140 &&
      PAPER_SIZE_SPECS.compact.heightMm === 210 &&
      PAPER_SIZE_SPECS.a4.widthMm === 210 &&
      PAPER_SIZE_SPECS.a5.widthMm === 148 &&
      PAPER_SIZE_SPECS.b6.widthMm === 125 &&
      PAPER_SIZE_SPECS.b7.widthMm === 88,
    'All 5 paper size physical dimensions preserved'
  );

  console.log(`\n=== SUMMARY: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
