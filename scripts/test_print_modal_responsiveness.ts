import fs from 'fs';
import path from 'path';

console.log('=== TEST SUITE: Print Popup Size & Responsiveness ===\n');

let passes = 0;
let failures = 0;

function expect(condition: boolean, msg: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passes++;
  } else {
    console.error(`[FAIL] ${msg}${detail ? ': ' + detail : ''}`);
    failures++;
  }
}

const printModals = [
  {
    name: 'CashSalePrintModal',
    filePath: 'src/components/print/CashSalePrintModal.tsx',
  },
  {
    name: 'CreditSalePrintModal',
    filePath: 'src/components/print/CreditSalePrintModal.tsx',
  },
  {
    name: 'ReceiptPrintModal',
    filePath: 'src/components/print/ReceiptPrintModal.tsx',
  },
  {
    name: 'SaleProceedPrintModal',
    filePath: 'src/components/print/SaleProceedPrintModal.tsx',
  },
  {
    name: 'ChooseBillPrintFormatModal',
    filePath: 'src/components/common/ChooseBillPrintFormatModal.tsx',
  },
];

for (const modal of printModals) {
  console.log(`--- Checking ${modal.name} ---`);
  const fullPath = path.resolve(process.cwd(), modal.filePath);
  const content = fs.readFileSync(fullPath, 'utf-8');

  // 1. Popup height containment within 90vh / 90dvh
  expect(
    content.includes('max-h-[90vh]') && content.includes('max-h-[90dvh]'),
    `${modal.name}: Constrained to max-h-[90vh] and max-h-[90dvh]`
  );

  // 2. Flex column layout for sticky header + scrollable body
  expect(
    content.includes('flex flex-col'),
    `${modal.name}: Uses flex flex-col for proper vertical sectioning`
  );

  // 3. Header has shrink-0 to guarantee it is always immediately visible
  expect(
    content.includes('shrink-0'),
    `${modal.name}: Top header / controls bar has shrink-0 (never pushed off-screen)`
  );

  // 4. Content body scrolls inside the popup with flex-1 min-h-0 overflow-y-auto
  expect(
    content.includes('flex-1') && content.includes('overflow-y-auto') && content.includes('min-h-0'),
    `${modal.name}: Content body has flex-1 min-h-0 overflow-y-auto (scrolls inside popup)`
  );

  // 5. Outer overlay prevents background scrolling
  expect(
    content.includes('fixed inset-0') && content.includes('overflow-hidden'),
    `${modal.name}: Outer overlay has overflow-hidden (prevents scrolling behind popup)`
  );

  // 6. Responsive width and centering
  expect(
    content.includes('items-center justify-center') && content.includes('w-full'),
    `${modal.name}: Centered and responsive w-full`
  );
}

console.log(`\n========================================`);
console.log(`SUMMARY: ${passes} Passed, ${failures} Failed`);
console.log(`========================================\n`);

if (failures > 0) {
  process.exit(1);
}
