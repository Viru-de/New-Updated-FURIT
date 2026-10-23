import { db } from '../src/services/db';
import { Customer, CreditSale, CashSale, ExpenseItem } from '../src/types';
import { getCustomerInitials } from '../src/components/common/CustomerAvatar';
import { getCustomerLedger, getCustomerCrateStatement } from '../src/services/accounting';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';
import { formatCurrency, formatDate } from '../src/utils/formatters';

async function runVerification() {
  console.log('=== TEST SUITE: Expenses, Customer Photos & Ledger Readability ===\n');
  let passes = 0;
  let failures = 0;

  function expect(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passes++;
    } else {
      console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
      failures++;
    }
  }

  // --- 1. DYNAMIC EXPENSES IN WHOLESALE CREDIT SALES ---
  console.log('--- 1. Testing Dynamic Wholesale Credit Sale Expenses ---');
  const custId = `test-cust-exp-${Date.now()}`;
  const testCustomer: Customer = {
    id: custId,
    name: 'Virendra Patel',
    mobile: '9876543210',
    city: 'Ahmedabad',
    openingBalance: 5000,
    openingBalanceType: 'debit',
    openingCrateBalance: 10,
    crateTypeId: 'ct1',
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.saveCustomer(testCustomer);

  // Initial standard credit sale with default 3 expenses
  const initialExpenses: ExpenseItem[] = [
    { id: 'exp-1', name: 'Freight', amount: 100 },
    { id: 'exp-2', name: 'Hamali', amount: 100 },
    { id: 'exp-3', name: 'Others', amount: 50 },
  ];
  const itemTotal = 20000; // e.g. 20 Crate * 400 Kg @ 50 = 20,000
  const initialExpTotal = initialExpenses.reduce((sum, e) => sum + e.amount, 0); // 250
  const initialNetTotal = itemTotal + initialExpTotal; // 20250

  const creditSale1: CreditSale = {
    id: `cs-exp-test-${Date.now()}`,
    creditSaleNo: 'CS-EXP-001',
    sequenceNumber: 9001,
    customerId: custId,
    customerName: testCustomer.name,
    date: '2026-10-22',
    items: [
      {
        id: 'it-1',
        fruitName: 'ANAR',
        quantity: 20,
        unit: 'Crate',
        kg: 400,
        rate: 50,
        amount: 20000,
      },
    ],
    crateIn: 0,
    crateOut: 20,
    crateWeightKg: 20,
    expenses: initialExpenses,
    productTotal: itemTotal,
    expenseTotal: initialExpTotal,
    totalDebit: initialNetTotal,
    finalAmount: initialNetTotal,
    netTotal: initialNetTotal,
    oldBalance: 5000,
    totalBalance: 5000 + initialNetTotal,
    totalCrateBalance: 20,
    createdAt: new Date().toISOString(),
  };

  db.saveCreditSale(creditSale1);
  const fetchedSale1 = db.getCreditSales().find((s) => s.id === creditSale1.id);
  expect(!!fetchedSale1, 'Credit sale saved to database');
  expect(fetchedSale1?.expenseTotal === 250, 'Expense total correctly calculates 250');
  expect(fetchedSale1?.finalAmount === 20250, 'Bill total correctly derives 20,250');
  expect(fetchedSale1?.expenses.length === 3, 'Initial 3 expense rows stored');

  // Edit and add 2 more dynamic expenses + remove 1 existing
  // e.g. Freight (100) + Hamali (120 - edited) + Packaging (80 - new) + Unloading (60 - new) = 360
  const updatedExpenses: ExpenseItem[] = [
    { id: 'exp-1', name: 'Freight', amount: 100 },
    { id: 'exp-2', name: 'Hamali', amount: 120 }, // edited amount
    { id: 'exp-4', name: 'Packaging', amount: 80 }, // newly added
    { id: 'exp-5', name: 'Unloading', amount: 60 }, // newly added
  ];
  const updatedExpTotal = updatedExpenses.reduce((sum, e) => sum + e.amount, 0); // 360
  const updatedNetTotal = itemTotal + updatedExpTotal; // 20360

  const creditSale1Updated: CreditSale = {
    ...fetchedSale1!,
    expenses: updatedExpenses,
    expenseTotal: updatedExpTotal,
    totalDebit: updatedNetTotal,
    finalAmount: updatedNetTotal,
    netTotal: updatedNetTotal,
    totalBalance: 5000 + updatedNetTotal,
  };

  db.saveCreditSale(creditSale1Updated);
  const reloadedSale1 = db.getCreditSales().find((s) => s.id === creditSale1.id);
  expect(reloadedSale1?.expenses.length === 4, 'Reopening bill preserves exactly 4 dynamic expense rows');
  expect(reloadedSale1?.expenseTotal === 360, 'Updated expense total is strictly 360 without double-counting');
  expect(reloadedSale1?.finalAmount === 20360, 'Updated bill total is strictly 20,360');
  expect(
    Boolean(reloadedSale1?.expenses.some((e) => e.name === 'Packaging' && e.amount === 80)),
    'Newly added Packaging expense is preserved'
  );
  expect(
    !reloadedSale1?.expenses.some((e) => e.name === 'Others'),
    'Removed Others expense is cleanly deleted'
  );

  // Check Customer Ledger reflects updated debit
  const ledger1 = getCustomerLedger(custId);
  // Opening: 5,000 + Debit: 20,360 = 25,360
  expect(ledger1.closingBalance === 25360, 'Customer ledger reflects exactly 25,360 closing balance');
  const ledgerEntry = ledger1.entries.find((e) => e.referenceNo === 'CS-EXP-001');
  expect(ledgerEntry?.subDetails?.expenses?.length === 4, 'Ledger entry subDetails loads all 4 expenses');

  // --- 2. CUSTOMER PHOTO & INITIALS GENERATION ---
  console.log('\n--- 2. Testing Customer Initials & Fallback Generator ---');
  expect(getCustomerInitials('Virendra Patel') === 'VP', 'Virendra Patel generates VP');
  expect(getCustomerInitials('Amit Kumar Sharma') === 'AK', 'Amit Kumar Sharma generates AK');
  expect(getCustomerInitials('Ravi') === 'R', 'Ravi generates R');
  expect(getCustomerInitials('   Rajesh   Kumar   ') === 'RK', 'Whitespace trimmed properly generates RK');
  expect(getCustomerInitials('') === '?', 'Empty string generates ? safely');
  expect(getCustomerInitials(null) === '?', 'Null value generates ? safely');

  // Customer with photo
  const samplePhotoUri = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
  const custWithPhoto: Customer = {
    id: `cust-photo-${Date.now()}`,
    name: 'Ramesh Shah',
    mobile: '9820098200',
    city: 'Mumbai',
    photo: samplePhotoUri,
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.saveCustomer(custWithPhoto);
  const reloadedCustWithPhoto = db.getCustomerById(custWithPhoto.id);
  expect(reloadedCustWithPhoto?.photo === samplePhotoUri, 'Customer photo persists and reloads from DB');

  // Customer without photo
  const custWithoutPhoto: Customer = {
    id: `cust-nophoto-${Date.now()}`,
    name: 'Virendra Patel',
    mobile: '9820011111',
    city: 'Surat',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };
  db.saveCustomer(custWithoutPhoto);
  const reloadedCustNoPhoto = db.getCustomerById(custWithoutPhoto.id);
  expect(reloadedCustNoPhoto?.photo === undefined, 'Customer without photo preserves undefined photo');
  expect(getCustomerInitials(reloadedCustNoPhoto?.name) === 'VP', 'Customer without photo resolves fallback initials VP');

  // --- 3. CUSTOMER LEDGER STATEMENT READABILITY DATA ---
  console.log('\n--- 3. Testing Customer Ledger Statement Particulars Data Integrity ---');
  const ledgerData = getCustomerLedger(custId);
  expect(ledgerData.entries.length > 0, 'Ledger entries generated');
  const targetTx = ledgerData.entries.find((e) => e.referenceNo === 'CS-EXP-001');
  expect(targetTx?.particulars === 'CS-EXP-001', 'Transaction heading is CS-EXP-001');
  expect(targetTx?.subDetails?.items?.[0].name === 'ANAR', 'Item ANAR preserved');
  expect(targetTx?.subDetails?.items?.[0].qty === 20, 'Item quantity 20 preserved');
  expect(targetTx?.subDetails?.items?.[0].rate === 50, 'Item rate 50 preserved');

  // --- 4. CRATE STATEMENT READABILITY DATA ---
  console.log('\n--- 4. Testing Crate Statement Data Integrity ---');
  const crateStmt = getCustomerCrateStatement(custId);
  expect(crateStmt.closingCrates === 30, 'Crate balance: Opening (10) + Issue (20) = 30 crates');
  expect(crateStmt.closingTotalKg === 600, 'Crate weight: 30 crates * 20 KG = 600 KG');
  const crateTx = crateStmt.entries.find((e) => e.referenceNo === 'CS-EXP-001');
  expect(crateTx?.crateName?.includes('Standard Crate') === true, 'Crate name contains Standard Crate');
  expect(crateTx?.weightKg === 20, 'Crate weight is 20 KG');

  // --- 5. CLEANUP ---
  console.log('\n--- 5. Cleaning Up Test Fixtures ---');
  db.deleteCustomer(custId);
  db.deleteCustomer(custWithPhoto.id);
  db.deleteCustomer(custWithoutPhoto.id);
  db.deleteCreditSale(creditSale1.id);
  expect(db.getCustomerById(custId) === undefined, 'Test customer cleaned up');
  expect(db.getCustomerById(custWithPhoto.id) === undefined, 'Photo customer cleaned up');

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

runVerification().catch((err) => {
  console.error('Fatal error in tests:', err);
  process.exit(1);
});
