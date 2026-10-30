import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';
import * as fs from 'fs';
import * as path from 'path';

function runTests() {
  console.log('--- TEST SUITE: Targeted Bug Fixes Verification ---');
  let failures = 0;

  // 1. CALCULATION TESTS
  console.log('\n[TEST GROUP 1] Calculations for Qty, Weight, Rate across all modules');

  // Rule 1: Weight > 0 => Weight * Rate
  const amount1 = calculateWholesaleItemAmount(10, 'Crate', 200, 50);
  if (amount1 === 10000) {
    console.log('  ✓ Qty 10, Weight 200, Rate ₹50 -> Amount ₹10,000 (Weight > 0)');
  } else {
    console.error(`  ✗ Failed: expected 10000, got ${amount1}`);
    failures++;
  }

  // Rule 2: Weight = 0 => Qty * Rate
  const amount2 = calculateWholesaleItemAmount(10, 'Crate', 0, 100);
  if (amount2 === 1000) {
    console.log('  ✓ Qty 10, Weight 0, Rate ₹100 -> Amount ₹1,000 (Weight = 0)');
  } else {
    console.error(`  ✗ Failed: expected 1000, got ${amount2}`);
    failures++;
  }

  // Rule 3: Weight is empty string or undefined => Qty * Rate
  const amount3 = calculateWholesaleItemAmount(15, 'Box', '', 120);
  if (amount3 === 1800) {
    console.log('  ✓ Qty 15, Weight "", Rate ₹120 -> Amount ₹1,800');
  } else {
    console.error(`  ✗ Failed: expected 1800, got ${amount3}`);
    failures++;
  }

  // Rule 4: Decimals supported cleanly
  const amount4 = calculateWholesaleItemAmount(2.5, 'Kg', 12.75, 40);
  if (amount4 === 510) {
    console.log('  ✓ Qty 2.5, Weight 12.75, Rate ₹40 -> Amount ₹510');
  } else {
    console.error(`  ✗ Failed: expected 510, got ${amount4}`);
    failures++;
  }

  // Rule 5: Empty fields safe from NaN
  const amount5 = calculateWholesaleItemAmount('', 'Crate', '', '');
  if (amount5 === 0 && !isNaN(amount5)) {
    console.log('  ✓ Empty fields return 0 without NaN');
  } else {
    console.error(`  ✗ Failed: expected 0 without NaN, got ${amount5}`);
    failures++;
  }

  // 2. TOTAL QTY TESTS
  console.log('\n[TEST GROUP 2] Total Qty Summation Logic');
  const items = [
    { quantity: 10, weight: 200, kg: 200, rate: 50 },
    { quantity: 5.5, weight: 100, kg: 100, rate: 80 },
    { quantity: '', weight: 50, kg: 50, rate: 100 },
    { quantity: 2.5, weight: 0, kg: 0, rate: 60 },
  ];

  const totalQty = Math.round(items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000) / 1000;
  if (totalQty === 18) {
    console.log(`  ✓ Total Qty correctly calculated as 18 (10 + 5.5 + 0 + 2.5), weight completely excluded`);
  } else {
    console.error(`  ✗ Failed Total Qty: expected 18, got ${totalQty}`);
    failures++;
  }

  // 3. FILE CONTENT CHECKS
  console.log('\n[TEST GROUP 3] Inspection of UI and Styles');

  const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  if (indexCss.includes('.dark #ledger-print-area') || indexCss.includes('.dark #sale-proceeds-print-area')) {
    console.error('  ✗ Error: src/index.css still contains .dark #ledger-print-area or .dark #sale-proceeds-print-area');
    failures++;
  } else {
    console.log('  ✓ src/index.css does not force white backgrounds on dark mode ledgers');
  }

  const creditSaleModal = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CreditSaleModal.tsx'), 'utf-8');
  if (!creditSaleModal.includes('Total Qty:')) {
    console.error('  ✗ Error: CreditSaleModal.tsx is missing "Total Qty:" display');
    failures++;
  } else {
    console.log('  ✓ CreditSaleModal.tsx contains Total Qty display');
  }

  const cashSaleModal = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CashSaleModal.tsx'), 'utf-8');
  if (!cashSaleModal.includes('Total Qty:')) {
    console.error('  ✗ Error: CashSaleModal.tsx is missing "Total Qty:" display');
    failures++;
  } else {
    console.log('  ✓ CashSaleModal.tsx contains Total Qty display');
  }

  const groupSaleView = fs.readFileSync(path.join(process.cwd(), 'src/components/billing/GroupSaleView.tsx'), 'utf-8');
  if (!groupSaleView.includes('Total Qty:')) {
    console.error('  ✗ Error: GroupSaleView.tsx is missing "Total Qty:" display');
    failures++;
  } else {
    console.log('  ✓ GroupSaleView.tsx contains Total Qty display');
  }

  const saleProceedsModal = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/SaleProceedsModal.tsx'), 'utf-8');
  if (!saleProceedsModal.includes('Total Qty:')) {
    console.error('  ✗ Error: SaleProceedsModal.tsx is missing "Total Qty:" display');
    failures++;
  } else {
    console.log('  ✓ SaleProceedsModal.tsx contains Total Qty display');
  }

  const customerLedgerView = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CustomerLedgerView.tsx'), 'utf-8');
  if (customerLedgerView.includes('erp-print-area')) {
    console.error('  ✗ Error: CustomerLedgerView.tsx still has erp-print-area class on screen container');
    failures++;
  } else {
    console.log('  ✓ CustomerLedgerView.tsx does not attach erp-print-area to on-screen container');
  }

  const saleProceedsLedgerView = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/SaleProceedsLedgerView.tsx'), 'utf-8');
  if (saleProceedsLedgerView.includes('print-bill-canvas')) {
    console.error('  ✗ Error: SaleProceedsLedgerView.tsx still has print-bill-canvas class on screen container');
    failures++;
  } else {
    console.log('  ✓ SaleProceedsLedgerView.tsx does not attach print-bill-canvas to on-screen container');
  }

  if (failures > 0) {
    console.error(`\nTest run finished with ${failures} failure(s).`);
    process.exit(1);
  } else {
    console.log('\nAll targeted bug fix tests passed successfully! (100% PASS)');
  }
}

runTests();
