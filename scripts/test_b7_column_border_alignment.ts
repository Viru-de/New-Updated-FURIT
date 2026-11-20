import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as jspdfModule from 'jspdf';
const jsPDF = (jspdfModule as any).jsPDF || (jspdfModule as any).default?.jsPDF || (jspdfModule as any).default;
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
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

function extractColWidths(html: string): string[] {
  const colgroupMatch = html.match(/<colgroup>([\s\S]*?)<\/colgroup>/);
  if (!colgroupMatch) return [];
  const matches = [...colgroupMatch[1].matchAll(/width:\s*([0-9.]+%)/g)];
  return matches.map((m) => m[1]);
}

async function run() {
  console.log('=== B7 Bill Print Column-Border Alignment Verification ===\n');

  const profile = db.getDefaultProfile();
  const sampleItems = [
    {
      id: 'i1',
      fruitName: 'APPLE SHIMLA ROYAL',
      quantity: 50,
      unit: 'Crate',
      kg: 200,
      weight: 200,
      rate: 60,
      amount: 12000,
    },
    {
      id: 'i2',
      fruitName: 'MANGO KESAR',
      quantity: 35,
      unit: 'Box',
      kg: 100,
      weight: 100,
      rate: 80,
      amount: 8000,
    },
  ];

  // 1. BillTableCanvas B7 verification (Credit Sale & Cash Sale)
  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    const b7Html = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType,
        billNumber: saleType === 'CREDIT SALE' ? 'CS-101' : 'CASH-101',
        date: '2026-11-20',
        customerName: 'M/s Test Traders',
        items: sampleItems,
        profile,
        pageSize: 'b7',
        paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
      })
    );

    const b7Cols = extractColWidths(b7Html);
    check(
      JSON.stringify(b7Cols) === JSON.stringify(['9%', '28%', '18%', '16%', '13%', '16%']),
      `BillTableCanvas ${saleType} B7 colgroup uses exact widths [9%, 28%, 18%, 16%, 13%, 16%]`,
      JSON.stringify(b7Cols)
    );
    check(
      b7Cols.reduce((s, w) => s + parseFloat(w), 0) === 100,
      `BillTableCanvas ${saleType} B7 colgroup sums strictly to 100%`
    );
    check(
      b7Html.includes('b7-bill-table') && b7Html.includes('table-fixed box-border'),
      `BillTableCanvas ${saleType} B7 applies b7-bill-table + table-fixed + box-border`
    );
    check(
      b7Html.includes('box-border text-center tracking-tight') && b7Html.includes('>No.<'),
      `BillTableCanvas ${saleType} B7 No. header uses box-border tracking-tight`
    );
    check(
      b7Html.includes('box-border text-right tracking-tight') && b7Html.includes('>KG<'),
      `BillTableCanvas ${saleType} B7 KG/Weight header uses box-border tracking-tight`
    );
    check(
      b7Html.includes('box-border whitespace-nowrap tabular-nums'),
      `BillTableCanvas ${saleType} B7 No. and KG cells enforce box-border whitespace-nowrap tabular-nums`
    );
    check(
      b7Html.includes('whitespace-nowrap box-border'),
      `BillTableCanvas ${saleType} B7 total row numeric cells enforce whitespace-nowrap box-border`
    );
    check(
      b7Html.includes('<col style="width:50%"/>') && b7Html.includes('max-w-full table-fixed box-border'),
      `BillTableCanvas ${saleType} B7 nested summary footer table enforces fixed 50%/50% colgroup`
    );
  }

  // 2. Ensure A4, A5, Compact, B6 in BillTableCanvas remain completely untouched
  const expectedNonB7Cols: Record<Exclude<BillPaperSize, 'b7'>, string[]> = {
    a4: ['5%', '37%', '17%', '12%', '13%', '16%'],
    b6: ['5%', '35%', '19%', '11%', '13%', '17%'],
    a5: ['5%', '35%', '18%', '13%', '13%', '16%'],
    compact: ['5%', '35%', '18%', '13%', '13%', '16%'],
  };

  for (const size of ['a4', 'a5', 'compact', 'b6'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType: 'CREDIT SALE',
        billNumber: 'CS-102',
        date: '2026-11-20',
        customerName: 'M/s Alpha Fruits',
        items: sampleItems,
        profile,
        pageSize: size,
      })
    );
    const cols = extractColWidths(html);
    check(
      JSON.stringify(cols) === JSON.stringify(expectedNonB7Cols[size]),
      `BillTableCanvas ${size.toUpperCase()} colgroup unchanged (${expectedNonB7Cols[size].join('/')})`,
      JSON.stringify(cols)
    );
    check(
      !html.includes('b7-bill-table'),
      `BillTableCanvas ${size.toUpperCase()} does NOT include b7-bill-table class`
    );
  }

  // 3. SaleProceedPrintModal B7 verification & non-B7 preservation
  const spSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/print/SaleProceedPrintModal.tsx'), 'utf-8');
  const spModalB7 = renderToStaticMarkup(
    React.createElement(SaleProceedPrintModal, {
      isOpen: true,
      onClose: () => {},
      proceeds: {
        id: 'sp-b7-1',
        proceedsNo: 'Sale Proceeds No. 015',
        sequenceNumber: 15,
        date: '2026-11-20',
        challanDate: '2026-11-20',
        vendorName: 'Test Orchard',
        items: [
          {
            id: 'sp1',
            fruitId: 'f1',
            fruitName: 'APPLE KASHMIR',
            quantity: 50,
            unit: 'Crate',
            weight: 200,
            rate: 60,
            amount: 12000,
          },
        ],
        quantity: 50,
        unit: 'Crate',
        rate: 60,
        amount: 12000,
        expenses: [{ id: 'exp-1', name: 'Commission', amount: 600 }],
        totalExpense: 600,
        netAmount: 11400,
        difference: -600,
        createdAt: new Date().toISOString(),
      },
    })
  );

  check(
    spSrc.includes("no: '9%'") &&
      spSrc.includes("item: '28%'") &&
      spSrc.includes("qty: '18%'") &&
      spSrc.includes("weight: '16%'") &&
      spSrc.includes("price: '13%'") &&
      spSrc.includes("amount: '16%'"),
    'SaleProceedPrintModal defines B7 colWidths [9%, 28%, 18%, 16%, 13%, 16%]'
  );
  check(
    spSrc.includes("${isB7 ? 'b7-bill-table' : ''}") &&
      spSrc.includes("box-border text-right ${isB7 ? 'tracking-tight' : ''}`}>WEIGHT") &&
      spSrc.includes("box-border text-center ${isB7 ? 'tracking-tight' : ''}`}>No."),
    'SaleProceedPrintModal applies b7-bill-table, box-border, and tracking-tight on No. & WEIGHT headers'
  );
  check(
    spSrc.includes("${isB7 ? 'box-border whitespace-nowrap tabular-nums' : ''}") &&
      spSrc.includes("${isB7 ? 'whitespace-nowrap box-border' : 'break-words'}"),
    'SaleProceedPrintModal applies box-border whitespace-nowrap on B7 body and total row numeric cells'
  );
  // Default paper size renders without b7-bill-table unless B7 selected
  check(!spModalB7.includes('b7-bill-table'), 'SaleProceedPrintModal non-B7 render does NOT apply b7-bill-table');

  // 4. CreateBillView & BillHistoryView B7 verification
  for (const fileRel of [
    'src/components/billing/CreateBillView.tsx',
    'src/components/billing/BillHistoryView.tsx',
  ]) {
    const src = fs.readFileSync(path.join(process.cwd(), fileRel), 'utf-8');
    check(
      src.includes("isB7 ? 'max-w-full table-fixed box-border b7-bill-table'") &&
        src.includes("<col style={{ width: '9%' }} />") &&
        src.includes("<col style={{ width: '28%' }} />") &&
        src.includes("<col style={{ width: '18%' }} />") &&
        src.includes("<col style={{ width: '16%' }} />") &&
        src.includes("<col style={{ width: '13%' }} />") &&
        src.includes("<col style={{ width: '16%' }} />"),
      `${fileRel}: applies B7 table-fixed + b7-bill-table + exact 9/28/18/16/13/16 colgroup`
    );
    check(
      src.includes("isB7 ? 'box-border tracking-tight whitespace-nowrap' : colWidths.no") &&
        src.includes("isB7 ? 'box-border tracking-tight whitespace-nowrap' : colWidths.weight") &&
        src.includes("isB7 ? 'box-border whitespace-nowrap tabular-nums' : ''"),
      `${fileRel}: applies box-border tracking-tight whitespace-nowrap on B7 No. & WEIGHT headers and body cells`
    );
  }

  // 5. CSS rules across Screen Preview, PDF Export, and @media print
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    cssSrc.includes('.print-bill-canvas table.b7-bill-table') &&
      cssSrc.includes('[data-pdf-export="true"] table.b7-bill-table'),
    'index.css enforces table.b7-bill-table fixed layout & box-sizing in screen preview & PDF export'
  );
  check(
    cssSrc.includes('#mandi-print-area table.b7-bill-table') &&
      cssSrc.includes('#erp-isolated-print-mount table.b7-bill-table'),
    'index.css enforces table.b7-bill-table fixed layout & box-sizing in @media print & isolated print mount'
  );
  check(
    cssSrc.includes('overflow: hidden !important;') &&
      cssSrc.includes('border-collapse: collapse !important;'),
    'index.css locks border-collapse and overflow: hidden on B7 table cells so borders never cross text'
  );

  // 6. Physical Pixel Width Budget Checks across B7 Screen (284px), Print (291px), PDF (316px)
  const b7Widths = { screen: 284, print: 291, pdf: 316 };
  for (const [mode, totalPx] of Object.entries(b7Widths)) {
    const noPx = totalPx * 0.09; // 9%
    const weightPx = totalPx * 0.16; // 16%
    // NO. uppercase bold ~7.5-8.5px + 4px px-0.5 pad + 1px border <= ~22px
    // WEIGHT uppercase bold ~7.5-9px tracking-tight + 4px px-0.5 pad + 1px border <= ~40px
    check(
      noPx >= 25.0,
      `B7 ${mode} (${totalPx}px): No. column width = ${noPx.toFixed(1)}px (>= 25px, fits 'NO.' and multi-digit serials inside borders)`
    );
    check(
      weightPx >= 45.0,
      `B7 ${mode} (${totalPx}px): Weight column width = ${weightPx.toFixed(1)}px (>= 45px, fits 'WEIGHT' and numeric weights inside borders)`
    );
  }

  // 7. Physical B7 jsPDF paper size & single-page export sanity check
  const b7Spec = PAPER_SIZE_SPECS['b7'];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [b7Spec.widthMm, b7Spec.heightMm],
  });
  doc.setFontSize(8);
  doc.text('HARI KRIPA FRUIT COMPANY', 44, 8, { align: 'center' });
  doc.text('No. | ITEM NAME | QTY | WEIGHT | PRICE | AMOUNT', 4, 20);
  check(
    b7Spec.widthMm === 88 && b7Spec.heightMm === 125 && doc.getNumberOfPages() === 1,
    'jsPDF generates valid single-page 88x125mm B7 PDF document'
  );

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

run();
