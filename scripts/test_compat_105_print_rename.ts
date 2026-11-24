import fs from 'fs';
import path from 'path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BillTableCanvas } from '../src/components/common/BillTableCanvas';
import { ChooseBillPrintFormatModal } from '../src/components/common/ChooseBillPrintFormatModal';
import { CreditSalePrintModal } from '../src/components/print/CreditSalePrintModal';
import { CashSalePrintModal } from '../src/components/print/CashSalePrintModal';
import { SaleProceedPrintModal } from '../src/components/print/SaleProceedPrintModal';
import { db } from '../src/services/db';
import {
  PAPER_SIZE_SPECS,
  resolvePaperSizeSpec,
  applyPrintPageSize,
} from '../src/utils/pdfAndShareEngine';

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
  console.log('=== Compat (105 × 148.5 mm) Cash Sale & Credit Sale Verification ===\n');

  const profile = db.getDefaultProfile();
  const sampleItems = [
    { id: '1', fruitId: 'f1', fruitName: 'ALPHONSO MANGO', quantity: 10, unit: 'Crate', kg: 200, weight: 200, rate: 120, amount: 24000 },
    { id: '2', fruitId: 'f2', fruitName: 'GREEN GRAPES', quantity: 15, unit: 'Box', kg: 150, weight: 150, rate: 90, amount: 13500 },
    { id: '3', fruitId: 'f3', fruitName: 'RED DELICIOUS APPLE', quantity: 12, unit: 'Box', kg: 180, weight: 180, rate: 150, amount: 27000 },
  ];

  // 1. Check Cash Sale & Credit Sale BillTableCanvas preview dimensions & centering
  for (const saleType of ['CREDIT SALE', 'CASH SALE'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(BillTableCanvas, {
        saleType,
        billNumber: saleType === 'CREDIT SALE' ? 'CS-2026-0111' : 'CASH-2026-0055',
        date: '2026-11-24',
        customerName: 'M/s Mahadev Fruit Traders',
        items: sampleItems,
        expenses: [{ id: 'e1', name: 'Hamali', amount: 1200 }],
        oldBalance: saleType === 'CREDIT SALE' ? 50000 : undefined,
        cashReceipt: saleType === 'CREDIT SALE' ? 10000 : undefined,
        paymentMode: saleType === 'CASH SALE' ? 'Cash' : undefined,
        profile,
        pageSize: 'b7',
      })
    );

    check(
      html.includes('data-paper-size="b7"') &&
        html.includes('data-compat-105="true"') &&
        html.includes('max-w-[397px]') &&
        html.includes('mx-auto'),
      `${saleType} Compat preview uses internal key b7, 105mm (397px) width, and centered mx-auto layout`
    );
  }

  // 2. Check CreditSalePrintModal & CashSalePrintModal visible option button displays "Compat" instead of "B7"
  const origWindow = (globalThis as any).window;
  const origSessionStorage = (globalThis as any).sessionStorage;
  (globalThis as any).window = {};
  (globalThis as any).sessionStorage = {
    getItem: () => 'b7',
    setItem: () => {},
  };

  try {
    const csModalHtml = renderToStaticMarkup(
      React.createElement(CreditSalePrintModal, {
        isOpen: true,
        onClose: () => {},
        creditSale: {
          id: 'cs-compat',
          creditSaleNo: 'Credit Sale No. 111',
          sequenceNumber: 111,
          date: '2026-11-24',
          customerId: 'c1',
          customerName: 'M/s Mahadev Fruit Traders',
          items: sampleItems,
          crateIn: 0,
          crateOut: 10,
          crateWeightKg: 200,
          expenses: [{ id: 'e1', name: 'Hamali', amount: 1200 }],
          productTotal: 64500,
          expenseTotal: 1200,
          totalDebit: 65700,
          finalAmount: 65700,
          netTotal: 65700,
          oldBalance: 50000,
          cashReceipt: 10000,
          totalBalance: 105700,
          createdAt: new Date().toISOString(),
        },
      })
    );

    const smallBillIdx = csModalHtml.indexOf('>Small Bill</button>');
    const b7Idx = csModalHtml.indexOf('>B7</button>');
    const b6Idx = csModalHtml.indexOf('>B6</button>');
    const a5Idx = csModalHtml.indexOf('>A5</button>');
    const a4Idx = csModalHtml.indexOf('>A4</button>');
    check(
      smallBillIdx !== -1 &&
        b7Idx > smallBillIdx &&
        b6Idx > b7Idx &&
        a5Idx > b6Idx &&
        a4Idx > a5Idx &&
        !csModalHtml.includes('>Compact</button>') &&
        !csModalHtml.includes('>Compat</button>'),
      'CreditSalePrintModal displays exact ordered buttons: Small Bill, B7, B6, A5, A4'
    );

    const cashModalHtml = renderToStaticMarkup(
      React.createElement(CashSalePrintModal, {
        isOpen: true,
        onClose: () => {},
        cashSale: {
          id: 'cash-compat',
          cashSaleNo: 'Cash Sale No. 055',
          sequenceNumber: 55,
          date: '2026-11-24',
          customerName: 'M/s Mahadev Fruit Traders',
          items: sampleItems,
          crateIn: 0,
          crateOut: 10,
          crateWeightKg: 200,
          expenses: [{ id: 'e1', name: 'Hamali', amount: 1200 }],
          productTotal: 64500,
          expenseTotal: 1200,
          totalAmount: 65700,
          finalAmount: 65700,
          paymentMode: 'Cash',
          paymentStatus: 'Paid',
          receivedAmount: 65700,
          createdAt: new Date().toISOString(),
        },
      })
    );

    const cashSmallBillIdx = cashModalHtml.indexOf('>Small Bill</button>');
    const cashB7Idx = cashModalHtml.indexOf('>B7</button>');
    const cashB6Idx = cashModalHtml.indexOf('>B6</button>');
    const cashA5Idx = cashModalHtml.indexOf('>A5</button>');
    const cashA4Idx = cashModalHtml.indexOf('>A4</button>');
    check(
      cashSmallBillIdx !== -1 &&
        cashB7Idx > cashSmallBillIdx &&
        cashB6Idx > cashB7Idx &&
        cashA5Idx > cashB6Idx &&
        cashA4Idx > cashA5Idx &&
        !cashModalHtml.includes('>Compact</button>') &&
        !cashModalHtml.includes('>Compat</button>'),
      'CashSalePrintModal displays exact ordered buttons: Small Bill, B7, B6, A5, A4'
    );

    // 3. Check SaleProceedPrintModal remains completely untouched (still shows B7 & 88x125)
    const spModalHtml = renderToStaticMarkup(
      React.createElement(SaleProceedPrintModal, {
        isOpen: true,
        onClose: () => {},
        proceeds: {
          id: 'sp-unchanged',
          proceedsNo: 'Sale Proceeds No. 108',
          sequenceNumber: 108,
          date: '2026-11-24',
          challanDate: '2026-11-24',
          vendorName: 'Kashmir Orchards',
          items: sampleItems,
          quantity: 37,
          unit: 'Crate',
          rate: 100,
          amount: 64500,
          expenses: [{ id: 'e1', name: 'Hamali', amount: 1200 }],
          totalExpense: 1200,
          netAmount: 63300,
          difference: -1200,
          createdAt: new Date().toISOString(),
        },
      })
    );

    const spSmallBillIdx = spModalHtml.indexOf('>Small Bill</button>');
    const spB7Idx = spModalHtml.indexOf('>B7</button>');
    const spB6Idx = spModalHtml.indexOf('>B6</button>');
    const spA5Idx = spModalHtml.indexOf('>A5</button>');
    const spA4Idx = spModalHtml.indexOf('>A4</button>');
    check(
      spSmallBillIdx !== -1 &&
        spB7Idx > spSmallBillIdx &&
        spB6Idx > spB7Idx &&
        spA5Idx > spB6Idx &&
        spA4Idx > spA5Idx &&
        !spModalHtml.includes('>Compact</button>') &&
        !spModalHtml.includes('>Compat</button>') &&
        !spModalHtml.includes('data-compat-105'),
      'SaleProceedPrintModal displays exact ordered buttons (Small Bill, B7, B6, A5, A4) without altering 88×125 override'
    );

    // 4. Check ChooseBillPrintFormatModal displays Small Bill (140 × 210 mm) & B7 (105 × 148.5 mm) for Credit Sale, and preserves B7 (88 × 125 mm) when false
    const formatModalCreditSaleHtml = renderToStaticMarkup(
      React.createElement(ChooseBillPrintFormatModal, {
        isOpen: true,
        onClose: () => {},
        documentTitle: 'Credit Sale Bill 111',
        elementId: 'mandi-print-area',
        filename: 'Credit-Sale-111',
        defaultSize: 'b7',
        useCompatB7: true,
        optionLabelOverrides: { compact: 'Small Bill', b7: 'B7' },
      })
    );
    check(
      formatModalCreditSaleHtml.includes('>Small Bill</span>') &&
        formatModalCreditSaleHtml.includes('140 × 210 mm') &&
        formatModalCreditSaleHtml.includes('>B7</span>') &&
        formatModalCreditSaleHtml.includes('105 × 148.5 mm') &&
        !formatModalCreditSaleHtml.includes('>Compat</span>') &&
        !formatModalCreditSaleHtml.includes('>Compact (Mandi)</span>'),
      'ChooseBillPrintFormatModal displays Small Bill (140 × 210 mm) & B7 (105 × 148.5 mm) for Credit Sale'
    );

    const formatModalCompatHtml = renderToStaticMarkup(
      React.createElement(ChooseBillPrintFormatModal, {
        isOpen: true,
        onClose: () => {},
        documentTitle: 'Cash Sale Bill 055',
        elementId: 'mandi-print-area',
        filename: 'Cash-Sale-055',
        defaultSize: 'b7',
        useCompatB7: true,
        optionLabelOverrides: { compact: 'Small Bill', b7: 'B7' },
      })
    );
    check(
      formatModalCompatHtml.includes('>Small Bill</span>') &&
        formatModalCompatHtml.includes('140 × 210 mm') &&
        formatModalCompatHtml.includes('>B7</span>') &&
        formatModalCompatHtml.includes('105 × 148.5 mm') &&
        !formatModalCompatHtml.includes('>Compat</span>') &&
        !formatModalCompatHtml.includes('>Compact (Mandi)</span>'),
      'ChooseBillPrintFormatModal displays Small Bill (140 × 210 mm) & B7 (105 × 148.5 mm) for Cash Sale identically to Credit Sale'
    );

    const formatModalStandardHtml = renderToStaticMarkup(
      React.createElement(ChooseBillPrintFormatModal, {
        isOpen: true,
        onClose: () => {},
        documentTitle: 'Sale Proceeds Bill 108',
        elementId: 'mandi-print-area',
        filename: 'Sale-Proceeds-108',
        defaultSize: 'b7',
        useCompatB7: false,
        optionLabelOverrides: { compact: 'Small Bill', b7: 'B7' },
      })
    );
    check(
      formatModalStandardHtml.includes('>Small Bill</span>') &&
        formatModalStandardHtml.includes('140 × 210 mm') &&
        formatModalStandardHtml.includes('>B7</span>') &&
        formatModalStandardHtml.includes('88 × 125 mm') &&
        !formatModalStandardHtml.includes('>Compat</span>') &&
        !formatModalStandardHtml.includes('>Compact (Mandi)</span>'),
      'ChooseBillPrintFormatModal displays Small Bill (140 × 210 mm) & B7 (88 × 125 mm) for Sale Proceeds'
    );
  } finally {
    if (origWindow === undefined) delete (globalThis as any).window;
    else (globalThis as any).window = origWindow;
    if (origSessionStorage === undefined) delete (globalThis as any).sessionStorage;
    else (globalThis as any).sessionStorage = origSessionStorage;
  }

  // 5. Verify resolvePaperSizeSpec & applyPrintPageSize inject exact 105mm × 148.5mm portrait CSS
  const mockCompatEl = {
    getAttribute: (name: string) => (name === 'data-compat-105' ? 'true' : null),
  } as unknown as HTMLElement;
  const compatSpec = resolvePaperSizeSpec('b7', mockCompatEl);
  check(
    compatSpec.id === 'b7' &&
      compatSpec.name === 'Small Bill' &&
      compatSpec.widthMm === 105 &&
      compatSpec.heightMm === 148.5 &&
      compatSpec.widthMm < compatSpec.heightMm,
    'resolvePaperSizeSpec resolves Credit/Cash Sale b7 to id="b7", name="Small Bill", 105 × 148.5 mm Portrait'
  );

  const mockSaleProceedEl = {
    getAttribute: () => null,
  } as unknown as HTMLElement;
  const spSpec = resolvePaperSizeSpec('b7', mockSaleProceedEl);
  check(
    spSpec.id === 'b7' && spSpec.name === 'B7' && spSpec.widthMm === 88 && spSpec.heightMm === 125,
    'resolvePaperSizeSpec preserves 88 × 125 mm B7 for Sale Proceeds and other sections'
  );

  // Mock minimal document to verify @page CSS generated by applyPrintPageSize
  const origDocument = (globalThis as any).document;
  const styleNode = { id: 'dynamic-print-page-style', textContent: '' };
  (globalThis as any).document = {
    getElementById: (id: string) => {
      if (id === 'dynamic-print-page-style') return styleNode;
      if (id === 'mandi-print-area') return mockCompatEl;
      return null;
    },
  };
  try {
    applyPrintPageSize('b7', 'mandi-print-area');
    check(
      styleNode.textContent.includes('size: 105mm 148.5mm !important;') &&
        styleNode.textContent.includes('margin: 2mm 2.5mm 2mm 2.5mm !important;'),
      'applyPrintPageSize injects @page size: 105mm 148.5mm portrait with centered symmetric 2.5mm left/right margins'
    );
  } finally {
    if (origDocument === undefined) delete (globalThis as any).document;
    else (globalThis as any).document = origDocument;
  }

  // 6. Verify PAPER_SIZE_SPECS internal config preserved
  check(
    PAPER_SIZE_SPECS.b7.id === 'b7' &&
      PAPER_SIZE_SPECS.b7.widthMm === 88 &&
      PAPER_SIZE_SPECS.b7.heightMm === 125,
    'Internal PAPER_SIZE_SPECS.b7 config preserved untouched for other modules'
  );

  // 7. Verify centering CSS rule present in src/index.css
  const cssSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    cssSrc.includes('#mandi-print-area[data-paper-size="b7"][data-compat-105="true"]') &&
      cssSrc.includes('margin: 0 auto !important;'),
    'src/index.css centers Compat 105 × 148.5 mm print layout cleanly'
  );

  console.log(`\n=== SUMMARY: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
