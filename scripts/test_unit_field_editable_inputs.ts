import fs from 'fs';
import path from 'path';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';
import { isCrateUnit } from '../src/utils/crateUtils';
import { db } from '../src/services/db';
import { CreditSale, CashSale, SaleProceeds } from '../src/types';

function runTests() {
  console.log('--- TEST SUITE: UNIT FIELD EDITABLE INPUTS & CALCULATION PRESERVATION ---');

  // Test 1: Check CreditSaleModal.tsx
  const creditModalPath = path.resolve(process.cwd(), 'src/components/accounts/CreditSaleModal.tsx');
  const creditModalContent = fs.readFileSync(creditModalPath, 'utf8');
  if (creditModalContent.includes('unit-options')) {
    throw new Error('FAIL: CreditSaleModal still contains unit-options datalist');
  }
  if (!creditModalContent.includes('placeholder="Unit"') || !creditModalContent.includes("handleItemChange(idx, 'unit', e.target.value)")) {
    throw new Error('FAIL: CreditSaleModal does not have editable Unit text input');
  }
  console.log('✓ CreditSaleModal: Unit is clean editable text input with no dropdown/datalist');

  // Test 2: Check CashSaleModal.tsx
  const cashModalPath = path.resolve(process.cwd(), 'src/components/accounts/CashSaleModal.tsx');
  const cashModalContent = fs.readFileSync(cashModalPath, 'utf8');
  if (cashModalContent.includes('cash-units')) {
    throw new Error('FAIL: CashSaleModal still contains cash-units datalist');
  }
  if (!cashModalContent.includes("handleItemChange(idx, 'unit', e.target.value)")) {
    throw new Error('FAIL: CashSaleModal does not have editable Unit text input');
  }
  console.log('✓ CashSaleModal: Unit is clean editable text input with no dropdown/datalist');

  // Test 3: Check CreateBillView.tsx
  const createBillPath = path.resolve(process.cwd(), 'src/components/billing/CreateBillView.tsx');
  const createBillContent = fs.readFileSync(createBillPath, 'utf8');
  if (createBillContent.includes('<select\n                      value={it.unit}') || createBillContent.includes('<select value={it.unit}')) {
    throw new Error('FAIL: CreateBillView still contains select dropdown for unit');
  }
  if (!createBillContent.includes("placeholder=\"Unit\"") || !createBillContent.includes("handleItemChange(idx, 'unit', e.target.value)")) {
    throw new Error('FAIL: CreateBillView does not have editable Unit text input');
  }
  console.log('✓ CreateBillView: Unit is clean editable text input with no select/dropdown');

  // Test 4: Check GroupSaleView.tsx
  const groupSalePath = path.resolve(process.cwd(), 'src/components/billing/GroupSaleView.tsx');
  const groupSaleContent = fs.readFileSync(groupSalePath, 'utf8');
  if (groupSaleContent.includes('<UnitAutocomplete')) {
    throw new Error('FAIL: GroupSaleView still uses UnitAutocomplete dropdown');
  }
  if (!groupSaleContent.includes("placeholder=\"Unit\"") || !groupSaleContent.includes("handleRowFieldChange(row.rowId, 'unit', e.target.value)")) {
    throw new Error('FAIL: GroupSaleView does not have editable Unit text input');
  }
  console.log('✓ GroupSaleView: Unit is clean editable text input with no dropdown');

  // Test 5: Check SaleProceedsModal.tsx
  const saleProceedsPath = path.resolve(process.cwd(), 'src/components/accounts/SaleProceedsModal.tsx');
  const saleProceedsContent = fs.readFileSync(saleProceedsPath, 'utf8');
  if (saleProceedsContent.includes('sp-unit-options')) {
    throw new Error('FAIL: SaleProceedsModal still contains sp-unit-options datalist');
  }
  if (!saleProceedsContent.includes("placeholder=\"Unit\"") || !saleProceedsContent.includes("handleItemChange(idx, 'unit', e.target.value)")) {
    throw new Error('FAIL: SaleProceedsModal does not have editable Unit text input');
  }
  console.log('✓ SaleProceedsModal: Unit is clean editable text input with no dropdown/datalist');

  // Test 6: Verify calculations with various standard and custom units
  // Case A: Standard Crate with Weight = 0 => Qty * Rate
  const amt1 = calculateWholesaleItemAmount(10, 'Crate', 0, 100);
  if (amt1 !== 1000) throw new Error(`FAIL: amt1 expected 1000, got ${amt1}`);

  // Case B: Standard Crate with Weight > 0 => Weight * Rate
  const amt2 = calculateWholesaleItemAmount(10, 'Crate', 200, 50);
  if (amt2 !== 10000) throw new Error(`FAIL: amt2 expected 10000, got ${amt2}`);

  // Case C: Custom unit 'DABBA' with Weight = 0 => Qty * Rate
  const amt3 = calculateWholesaleItemAmount(25, 'DABBA', 0, 120);
  if (amt3 !== 3000) throw new Error(`FAIL: amt3 expected 3000, got ${amt3}`);

  // Case D: Custom unit '20kg crate' with Weight = 0 => Qty * Rate
  const amt4 = calculateWholesaleItemAmount(5, '20kg crate', 0, 450);
  if (amt4 !== 2250) throw new Error(`FAIL: amt4 expected 2250, got ${amt4}`);

  // Case E: Custom unit 'Peti' with Weight > 0 => Weight * Rate
  const amt5 = calculateWholesaleItemAmount(10, 'Peti', 150, 60);
  if (amt5 !== 9000) throw new Error(`FAIL: amt5 expected 9000, got ${amt5}`);

  console.log('✓ Business calculations: Amount calculations for standard and custom units preserved 100%');

  // Test 7: Crate inventory logic check
  if (!isCrateUnit('Crate') || !isCrateUnit('crate') || !isCrateUnit(' CRATE ')) {
    throw new Error('FAIL: isCrateUnit failed for Crate');
  }
  if (isCrateUnit('DABBA') || isCrateUnit('Box') || isCrateUnit('Peti') || isCrateUnit('Kg')) {
    throw new Error('FAIL: isCrateUnit incorrectly flagged non-crate as crate');
  }
  console.log('✓ Crate inventory detection: crate vs non-crate logic preserved');

  // Test 8: End-to-end saving and loading in DB with custom units
  const testCreditSale: CreditSale = {
    id: `test-cs-${Date.now()}`,
    creditSaleNo: 'CS-TEST-999',
    sequenceNumber: 999,
    customerId: 'cust-1',
    customerName: 'Ramesh Fruit Co',
    date: '2026-10-28',
    items: [
      {
        id: 'csi-test-1',
        fruitName: 'Nagpur Oranges',
        quantity: 12,
        unit: 'DABBA',
        kg: 0,
        rate: 350,
        amount: 4200,
      },
      {
        id: 'csi-test-2',
        fruitName: 'Kashmiri Apples',
        quantity: 20,
        unit: 'Wooden Peti',
        kg: 380,
        rate: 85,
        amount: 32300,
      },
    ],
    crateIn: 0,
    crateOut: 0,
    crateWeightKg: 20,
    expenses: [],
    productTotal: 36500,
    expenseTotal: 0,
    totalDebit: 36500,
    finalAmount: 36500,
    netTotal: 36500,
    oldBalance: 0,
    cashReceipt: 0,
    totalBalance: 36500,
    totalCrateBalance: 0,
    createdAt: new Date().toISOString(),
  };

  db.saveCreditSale(testCreditSale);
  const loadedSales = db.getCreditSales();
  const foundSale = loadedSales.find((s) => s.id === testCreditSale.id);
  if (!foundSale) throw new Error('FAIL: Saved credit sale not found in db');
  if (foundSale.items[0].unit !== 'DABBA' || foundSale.items[1].unit !== 'Wooden Peti') {
    throw new Error(`FAIL: Custom units were not preserved in DB: ${JSON.stringify(foundSale.items)}`);
  }
  console.log('✓ Database persistence: CreditSale with custom units saved & retrieved with exact values');

  // Test 9: End-to-end Cash Sale with custom units
  const testCashSale: CashSale = {
    id: `test-cash-${Date.now()}`,
    cashSaleNo: 'CASH-TEST-999',
    sequenceNumber: 999,
    date: '2026-10-28',
    paymentMode: 'Cash',
    paymentStatus: 'Paid',
    receivedAmount: 19200,
    crateIn: 0,
    crateOut: 0,
    crateWeightKg: 20,
    items: [
      {
        id: 'cash-it-1',
        fruitName: 'Banana G9',
        quantity: 15,
        unit: '20kg crate',
        kg: 0,
        rate: 400,
        amount: 6000,
      },
      {
        id: 'cash-it-2',
        fruitName: 'Papaya',
        quantity: 30,
        unit: 'Bag',
        kg: 600,
        rate: 22,
        amount: 13200,
      },
    ],
    expenses: [],
    productTotal: 19200,
    expenseTotal: 0,
    totalAmount: 19200,
    finalAmount: 19200,
    createdAt: new Date().toISOString(),
  };

  db.saveCashSale(testCashSale);
  const loadedCash = db.getCashSales();
  const foundCash = loadedCash.find((c) => c.id === testCashSale.id);
  if (!foundCash) throw new Error('FAIL: Saved cash sale not found in db');
  if (foundCash.items[0].unit !== '20kg crate' || foundCash.items[1].unit !== 'Bag') {
    throw new Error(`FAIL: Custom units not preserved in Cash Sale: ${JSON.stringify(foundCash.items)}`);
  }
  console.log('✓ Database persistence: CashSale with custom units saved & retrieved with exact values');

  // Clean up test records
  db.deleteCreditSale(testCreditSale.id);
  db.deleteCashSale(testCashSale.id);
  console.log('✓ Cleanup: Test records cleaned up cleanly');

  console.log('\nALL 9 TESTS PASSED! Unit fields across all modules are editable text inputs with 0 dropdowns and 100% calculation integrity.');
}

runTests();
