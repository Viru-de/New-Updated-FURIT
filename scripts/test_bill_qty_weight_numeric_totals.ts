import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { db } from '../src/services/db';
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
  console.log('=== Bill Print Numeric Qty & Weight Total Summary Verification ===\n');

  const profile = db.getDefaultProfile();
  const sampleItems = [
    {
      id: 'i1',
      fruitName: 'APPLE SHIMLA',
      quantity: 50,
      unit: 'Crate',
      kg: 200,
      weight: 200,
      rate: 60,
      amount: 12000,
    },
    {
      id: 'i2',
      fruitName: 'MANGO',
      quantity: 35,
      unit: 'Box',
      kg: 100,
      weight: 100,
      rate: 80,
      amount: 8000,
    },
  ]; // totalQty = 85, totalWeight = 300

  const paperSizes: BillPaperSize[] = ['a4', 'a5', 'compact', 'b6', 'b7'];

  // 1. Credit Sale & Cash Sale in BillTableCanvas across all paper sizes
  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    for (const size of paperSizes) {
      const html = renderToStaticMarkup(
        React.createElement(BillTableCanvas, {
          saleType,
          billNumber: saleType === 'CREDIT SALE' ? 'CS-101' : 'CASH-101',
          date: '2026-11-20',
          customerName: 'M/s Test Traders',
          items: sampleItems,
          profile,
          pageSize: size,
          paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
        })
      );

      // Extract the first <tr> inside <tfoot> (the Qty/Weight total summary row)
      const tfootStart = html.indexOf('<tfoot>');
      const firstRowEnd = html.indexOf('</tr>', tfootStart);
      const totalRowHtml = html.slice(tfootStart, firstRowEnd + 5);

      check(
        totalRowHtml.includes('>85<') && totalRowHtml.includes('>300<'),
        `${saleType} (${size.toUpperCase()}): total row renders numeric values 85 and 300`
      );
      check(
        !/Total Qty|Total Weight|Qty Total|Total:|KG|kg/i.test(totalRowHtml),
        `${saleType} (${size.toUpperCase()}): total row has NO 'Qty Total', 'Total Qty', 'Total Weight', 'Total:', or 'kg' text`,
        totalRowHtml
      );
      // Column headings and individual item-row units remain intact
      check(
        html.includes('QTY') && html.includes('KG') && html.includes('50 CRATE') && html.includes('35 BOX'),
        `${saleType} (${size.toUpperCase()}): column headings and individual item-row units preserved`
      );
    }
  }

  // 2. SaleProceedPrintModal
  const saleProceedHtml = renderToStaticMarkup(
    React.createElement(SaleProceedPrintModal, {
      isOpen: true,
      onClose: () => {},
      proceeds: {
        id: 'sp-qty-test',
        proceedsNo: 'Sale Proceeds No. 010',
        sequenceNumber: 10,
        date: '2026-11-20',
        challanDate: '2026-11-20',
        vendorName: 'Test Vendor',
        items: [
          {
            id: 'sp1',
            fruitId: 'f1',
            fruitName: 'APPLE SHIMLA',
            quantity: 50,
            unit: 'Crate',
            weight: 200,
            rate: 60,
            amount: 12000,
          },
          {
            id: 'sp2',
            fruitId: 'f2',
            fruitName: 'MANGO',
            quantity: 35,
            unit: 'Box',
            weight: 100,
            rate: 80,
            amount: 8000,
          },
        ],
        quantity: 85,
        unit: 'Crate',
        rate: 60,
        amount: 20000,
        expenses: [{ id: 'e1', name: 'Hamali', amount: 100 }],
        totalExpense: 100,
        netAmount: 19900,
        difference: -100,
        createdAt: new Date().toISOString(),
      },
    })
  );

  const spTfootStart = saleProceedHtml.indexOf('<tfoot>');
  const spFirstRowEnd = saleProceedHtml.indexOf('</tr>', spTfootStart);
  const spTotalRowHtml = saleProceedHtml.slice(spTfootStart, spFirstRowEnd + 5);

  check(
    spTotalRowHtml.includes('>85<') && spTotalRowHtml.includes('>300<'),
    'SaleProceedPrintModal: total row renders numeric values 85 and 300'
  );
  check(
    !/Total Qty|Total Weight|Qty Total|Total:|KG|kg/i.test(spTotalRowHtml),
    'SaleProceedPrintModal: total row has NO Total Qty, Total Weight, Total:, or kg text',
    spTotalRowHtml
  );
  check(
    saleProceedHtml.includes('QTY') &&
      saleProceedHtml.includes('WEIGHT') &&
      saleProceedHtml.includes('50 CRATE') &&
      saleProceedHtml.includes('35 BOX'),
    'SaleProceedPrintModal: column headings and individual item-row units preserved'
  );

  // 3. CreateBillView and BillHistoryView source verification
  for (const rel of ['src/components/billing/CreateBillView.tsx', 'src/components/billing/BillHistoryView.tsx']) {
    const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf-8');
    const markerIdx = src.indexOf('{/* Total Qty & Total Weight Row: immediately below the item rows */}');
    const rowEndIdx = src.indexOf('</tr>', markerIdx);
    const totalRowSrc = src.slice(markerIdx, rowEndIdx);

    check(
      !totalRowSrc.includes('Total:') && !totalRowSrc.includes('KG') && totalRowSrc.includes('{totalQty}') && totalRowSrc.includes('{totalWeight > 0 ? totalWeight : 0}'),
      `${rel}: print table total row displays only numeric totalQty and totalWeight without Total: or KG`
    );
  }

  console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
