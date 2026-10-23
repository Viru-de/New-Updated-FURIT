import { db } from '../src/services/db';
import {
  calculateWholesaleItemAmount,
  calculateLineAmountByKg,
  calculateLineKg,
  calculateSaleCrateSummary,
} from '../src/utils/billingCalculations';
import { isCrateUnit } from '../src/utils/crateUtils';
import {
  getCustomerLedger,
  getSaleProceedsLedger,
  getCustomerCrateStatement,
  getAllCustomerOutstandings,
} from '../src/services/accounting';
import { maskAadhaar, validateAadhaarNumber } from '../src/utils/aadhaarUtils';
import { formatCurrency, formatDate, numberToWordsIndian } from '../src/utils/formatters';
import { Customer, CreditSale, Receipt, TrashItem, Fruit, Vendor } from '../src/types';

async function runTests() {
  console.log('=== TEST SUITE: Hari Kripa Fruit ERP ===\n');
  let failures = 0;
  let passes = 0;

  function expect(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passes++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failures++;
    }
  }

  // --- 1. AMOUNT CALCULATIONS (Crate & Non-Crate) ---
  console.log('--- 1. Testing Calculation Engine ---');
  // Crate: Rule A: If Kg is 0 or empty -> Qty * Rate. Rule B: If Kg > 0 -> Kg * Rate
  expect(calculateWholesaleItemAmount(10, 'Crate', 200, 50) === 10000, 'Crate with Kg=200, Rate=50 equals 10,000');
  expect(calculateWholesaleItemAmount(10, 'Crate', 0, 1000) === 10000, 'Crate with Qty=10, Kg=0, Rate=1000 equals 10,000 (Rule A: Qty * Rate)');
  expect(calculateWholesaleItemAmount(5, 'crate', '', 200) === 1000, 'Crate with Qty=5, blank Kg, Rate=200 equals 1,000 (Rule A: Qty * Rate)');
  expect(calculateWholesaleItemAmount(20, 'Crate', 400, 50) === 20000, 'Crate with Qty=20, Kg=400, Rate=50 equals 20,000 (Rule B: Kg * Rate)');

  // Non-Crate (Box, Peti, DABBA, Piece, Bag, etc.):
  // If Kg == 0 or empty -> Qty * Rate
  expect(calculateWholesaleItemAmount(10, 'Box', 0, 100) === 1000, 'Box with Kg=0: Amount = Qty * Rate (10 * 100 = 1000)');
  expect(calculateWholesaleItemAmount(10, 'Box', '', 100) === 1000, 'Box with Kg="": Amount = Qty * Rate (1000)');
  expect(calculateWholesaleItemAmount(5, 'Peti', 0, 80) === 400, 'Peti with Kg=0: Amount = Qty * Rate (5 * 80 = 400)');
  expect(calculateWholesaleItemAmount(20, 'DABBA', 0, 30) === 600, 'DABBA with Kg=0: Amount = Qty * Rate (20 * 30 = 600)');
  expect(calculateWholesaleItemAmount(50, 'Piece', 0, 12) === 600, 'Piece with Kg=0: Amount = Qty * Rate (50 * 12 = 600)');
  expect(calculateWholesaleItemAmount(4, 'Bag', 0, 500) === 2000, 'Bag with Kg=0: Amount = Qty * Rate (4 * 500 = 2000)');

  // Non-Crate: If Kg > 0 -> Amount = Kg * Rate
  expect(calculateWholesaleItemAmount(10, 'Box', 120, 100) === 12000, 'Box with Kg=120: Amount = Kg * Rate (120 * 100 = 12000)');
  expect(calculateWholesaleItemAmount(5, 'Peti', 85, 80) === 6800, 'Peti with Kg=85: Amount = Kg * Rate (85 * 80 = 6800)');
  expect(calculateWholesaleItemAmount(20, 'DABBA', 300, 30) === 9000, 'DABBA with Kg=300: Amount = Kg * Rate (300 * 30 = 9000)');

  // --- 2. FORMATTERS & AADHAAR UTILITIES ---
  console.log('\n--- 2. Testing Utilities & Formatters ---');
  expect(maskAadhaar('123456789012').includes('9012'), 'Aadhaar masking displays masked prefix and ending digits 9012');
  expect(validateAadhaarNumber('123456789012').isValid === true, 'Valid 12-digit Aadhaar passes validation');
  expect(validateAadhaarNumber('12345').isValid === false, 'Invalid Aadhaar (< 12 digits) rejected');
  expect(formatCurrency(1500).includes('1,500'), 'Currency formatting includes commas for thousands');
  expect(numberToWordsIndian(1500).toLowerCase().includes('one thousand'), 'Number to words Indian formats correctly');

  // --- 3. CUSTOMER MANAGEMENT & INDIVIDUAL LEDGER INTEGRITY ---
  console.log('\n--- 3. Testing Customer Ledger & Multi-Customer Isolation ---');
  const custIdA = `test-cust-a-${Date.now()}`;
  const custIdB = `test-cust-b-${Date.now()}`;

  const custA: Customer = {
    id: custIdA,
    name: 'Customer Alpha',
    mobile: '9876543211',
    city: 'Jaipur',
    openingBalance: 10000,
    openingBalanceType: 'debit',
    openingCrateBalance: 5,
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  const custB: Customer = {
    id: custIdB,
    name: 'Customer Beta',
    mobile: '9876543222',
    city: 'Jodhpur',
    openingBalance: 5000,
    openingBalanceType: 'debit',
    openingCrateBalance: 2,
    active: true,
    createdAt: '2026-10-01T00:00:00.000Z',
  };

  db.saveCustomer(custA);
  db.saveCustomer(custB);

  expect(db.getCustomerById(custIdA)?.name === 'Customer Alpha', 'Customer Alpha saved and retrieved');
  expect(db.getCustomerById(custIdB)?.name === 'Customer Beta', 'Customer Beta saved and retrieved');

  // Verify initial ledgers
  const ledgerA1 = getCustomerLedger(custIdA);
  const ledgerB1 = getCustomerLedger(custIdB);
  expect(ledgerA1.closingBalance === 10000, 'Customer Alpha opening balance is 10,000 Dr');
  expect(ledgerB1.closingBalance === 5000, 'Customer Beta opening balance is 5,000 Dr');

  // Post a Group Sale containing entries for BOTH Customer Alpha and Customer Beta
  // Verify Requirement 2: "Save Every Transaction to the Correct Individual Customer Ledger"
  const saleA: CreditSale = {
    id: `sale-a-${Date.now()}`,
    creditSaleNo: 'CS-ALPHA-01',
    sequenceNumber: 1001,
    customerId: custIdA,
    customerName: custA.name,
    date: '2026-10-20',
    items: [
      {
        id: 'it-a1',
        fruitName: 'Apple Box',
        quantity: 10,
        unit: 'Box',
        kg: 0,
        rate: 500,
        amount: 5000,
      },
    ],
    crateIn: 0,
    crateOut: 0,
    crateWeightKg: 0,
    productTotal: 5000,
    expenses: [{ id: 'exp-1', name: 'Freight', amount: 100 }],
    expenseTotal: 100,
    totalDebit: 5100,
    finalAmount: 5100,
    netTotal: 5100,
    oldBalance: 10000,
    totalBalance: 15100,
    createdAt: new Date().toISOString(),
  };

  const saleB: CreditSale = {
    id: `sale-b-${Date.now()}`,
    creditSaleNo: 'CS-BETA-01',
    sequenceNumber: 1002,
    customerId: custIdB,
    customerName: custB.name,
    date: '2026-10-20',
    items: [
      {
        id: 'it-b1',
        fruitName: 'Pomegranate Crate',
        quantity: 5,
        unit: 'Crate',
        kg: 100,
        rate: 80,
        amount: 8000,
      },
    ],
    crateIn: 0,
    crateOut: 0,
    crateWeightKg: 0,
    productTotal: 8000,
    expenses: [{ id: 'exp-2', name: 'Hamali', amount: 50 }],
    expenseTotal: 50,
    totalDebit: 8050,
    finalAmount: 8050,
    netTotal: 8050,
    oldBalance: 5000,
    totalBalance: 13050,
    createdAt: new Date().toISOString(),
  };

  // Save both credit sales (simulating Group Sale batch save)
  db.saveCreditSalesBatch([saleA, saleB]);

  // Check that Alpha's transaction is ONLY in Alpha's ledger
  const ledgerA2 = getCustomerLedger(custIdA);
  const ledgerB2 = getCustomerLedger(custIdB);

  expect(ledgerA2.closingBalance === 15100, 'Customer Alpha balance correctly updated to 15,100 (10000 + 5100)');
  expect(ledgerB2.closingBalance === 13050, 'Customer Beta balance correctly updated to 13,050 (5000 + 8050)');

  const alphaHasBetaTx = ledgerA2.entries.some((e) => e.particulars.includes('BETA'));
  const betaHasAlphaTx = ledgerB2.entries.some((e) => e.particulars.includes('ALPHA'));
  expect(!alphaHasBetaTx && !betaHasAlphaTx, 'Individual ledgers are strictly segregated (no cross-contamination)');

  // Receipt Test
  const receiptA: Receipt = {
    id: `rcpt-a-${Date.now()}`,
    receiptNo: 'RCP-001',
    sequenceNumber: 2001,
    customerId: custIdA,
    customerName: custA.name,
    amount: 5100,
    date: '2026-10-20',
    paymentMode: 'Cash',
    createdAt: new Date().toISOString(),
  };
  db.saveReceipt(receiptA);

  const ledgerA3 = getCustomerLedger(custIdA);
  expect(ledgerA3.closingBalance === 10000, 'Customer Alpha balance returns to 10,000 after 5,100 receipt');

  // --- 4. CRATE TRACKING INTEGRITY ---
  console.log('\n--- 4. Testing Crate Movements & Balances ---');
  const crateTx1 = {
    id: `ctx-1-${Date.now()}`,
    date: '2026-10-20',
    customerId: custIdA,
    customerName: custA.name,
    referenceType: 'Manual Adjustment' as const,
    referenceNo: 'CR-001',
    crateTypeId: 'ct1',
    crateName: 'Standard Crate',
    inQuantity: 0,
    outQuantity: 10,
    balanceQuantity: 15,
    weightKgPerCrate: 20,
    totalKg: 300,
    createdAt: new Date().toISOString(),
  };
  db.saveCrateTransaction(crateTx1);

  const crateStmtA1 = getCustomerCrateStatement(custIdA);
  // Opening: 5, Issued: 10 -> Closing: 15
  expect(crateStmtA1.closingCrates === 15, 'Customer Alpha crate balance correctly reflects Opening(5) + Issue(10) = 15');

  const crateTx2 = {
    id: `ctx-2-${Date.now()}`,
    date: '2026-10-20',
    customerId: custIdA,
    customerName: custA.name,
    referenceType: 'Return' as const,
    referenceNo: 'CR-002',
    crateTypeId: 'ct1',
    crateName: 'Standard Crate',
    inQuantity: 6,
    outQuantity: 0,
    balanceQuantity: 9,
    weightKgPerCrate: 20,
    totalKg: 180,
    createdAt: new Date().toISOString(),
  };
  db.saveCrateTransaction(crateTx2);

  const crateStmtA2 = getCustomerCrateStatement(custIdA);
  // 15 - 6 = 9
  expect(crateStmtA2.closingCrates === 9, 'Customer Alpha crate balance correctly reflects Return(6) -> 9 Crates');

  // --- 5. CLEAN UP TEST DATA ---
  console.log('\n--- 5. Cleaning Up Test Fixtures ---');
  db.deleteCreditSale(saleA.id);
  db.deleteCreditSale(saleB.id);
  db.deleteReceipt(receiptA.id);
  db.deleteCrateTransaction(crateTx1.id);
  db.deleteCrateTransaction(crateTx2.id);
  db.deleteCustomer(custIdA);
  db.deleteCustomer(custIdB);

  expect(db.getCustomerById(custIdA) === undefined, 'Test customer Alpha cleaned up');
  expect(db.getCustomerById(custIdB) === undefined, 'Test customer Beta cleaned up');

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
