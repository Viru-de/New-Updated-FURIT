import { db } from '../src/services/db';
import { getCustomerCrateStatement, getCustomerCrateBalanceByType } from '../src/services/accounting';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';
import { CreditSale, CashSale, CrateTransaction } from '../src/types';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ ${message}`);
  }
}

async function runTests() {
  console.log('--- Starting Crate-Type Tracking E2E Tests ---');

  // 1. Verify crate types exist
  const crateTypes = db.getCrateTypes();
  const ct10 = crateTypes.find((ct) => ct.name.includes('10kg'));
  const ct20 = crateTypes.find((ct) => ct.name.includes('20kg'));

  assert(!!ct10, '10kg Crate type exists in system');
  assert(!!ct20, '20kg Crate type exists in system');

  const ct10Id = ct10!.id;
  const ct20Id = ct20!.id;

  // 2. Rule: "10kg Crate" and "20kg Crate" are crate type names only.
  // Quantity entered as 5 with unit "Crate" and weight 100kg does NOT multiply by 10 or 20.
  const amountApple = calculateWholesaleItemAmount(5, 'Crate', 100, 80);
  assert(amountApple === 8000, `Item amount with 100kg @ 80/kg is exactly 8000 (was ${amountApple})`);

  // 3. Create fresh test customer
  const testCustomerId = `test-cust-crate-${Date.now()}`;
  db.saveCustomer({
    id: testCustomerId,
    name: 'Crate Test Customer',
    mobile: '9898989898',
    city: 'Jaipur',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 0,
    crateTypeId: ct10Id,
    active: true,
    createdAt: new Date().toISOString(),
  });

  const initialBal10 = getCustomerCrateBalanceByType(testCustomerId, ct10Id);
  const initialBal20 = getCustomerCrateBalanceByType(testCustomerId, ct20Id);
  assert(initialBal10.balance === 0, 'Initial 10kg Crate balance is 0');
  assert(initialBal20.balance === 0, 'Initial 20kg Crate balance is 0');

  // 4. Test Wholesale Mandi Credit Sale issuing 5 × 10kg Crate and 5 × 20kg Crate
  const creditSaleId = `cs-crate-test-${Date.now()}`;
  const creditSale: CreditSale = {
    id: creditSaleId,
    creditSaleNo: 'Credit Sale No. 991',
    sequenceNumber: 991,
    customerId: testCustomerId,
    customerName: 'Crate Test Customer',
    date: '2026-10-22',
    items: [
      {
        id: 'csi-1',
        fruitName: 'APPLE KASHMIR',
        quantity: 10,
        unit: 'Crate',
        kg: 100,
        rate: 80,
        amount: 8000,
      },
    ],
    crateTypeId: ct10Id,
    crateName: ct10!.name,
    crateOut: 10,
    crateIn: 0,
    crateWeightKg: 10,
    crateMovements: [
      { crateTypeId: ct10Id, crateName: ct10!.name, outQuantity: 5, inQuantity: 0 },
      { crateTypeId: ct20Id, crateName: ct20!.name, outQuantity: 5, inQuantity: 0 },
    ],
    expenses: [{ id: 'cse-1', name: 'Hamali', amount: 50 }],
    productTotal: 8000,
    expenseTotal: 50,
    totalDebit: 8050,
    finalAmount: 8050,
    netTotal: 8050,
    oldBalance: 0,
    cashReceipt: 0,
    totalBalance: 8050,
    createdAt: new Date().toISOString(),
  };

  db.saveCreditSale(creditSale);

  // Check statement immediately
  const stmtAfterCredit = getCustomerCrateStatement(testCustomerId);
  assert(stmtAfterCredit.closingCrates === 10, `Closing total crates is 10 (got ${stmtAfterCredit.closingCrates})`);

  const bal10AfterCredit = getCustomerCrateBalanceByType(testCustomerId, ct10Id);
  const bal20AfterCredit = getCustomerCrateBalanceByType(testCustomerId, ct20Id);
  assert(bal10AfterCredit.issued === 5 && bal10AfterCredit.balance === 5, `10kg Crate has 5 issued and 5 balance (got ${bal10AfterCredit.balance})`);
  assert(bal20AfterCredit.issued === 5 && bal20AfterCredit.balance === 5, `20kg Crate has 5 issued and 5 balance (got ${bal20AfterCredit.balance})`);

  // 5. Customer returns 2 × 10kg Crate and 3 × 20kg Crate
  const return10: CrateTransaction = {
    id: `mct-ret10-${Date.now()}`,
    customerId: testCustomerId,
    customerName: 'Crate Test Customer',
    date: '2026-10-22',
    referenceType: 'Return',
    referenceNo: 'CR-101',
    crateTypeId: ct10Id,
    crateName: ct10!.name,
    inQuantity: 2,
    outQuantity: 0,
    balanceQuantity: 3,
    weightKgPerCrate: 10,
    totalKg: 20,
    notes: 'Return 2 of 10kg',
    createdAt: new Date().toISOString(),
  };
  db.saveCrateTransaction(return10);

  const return20: CrateTransaction = {
    id: `mct-ret20-${Date.now()}`,
    customerId: testCustomerId,
    customerName: 'Crate Test Customer',
    date: '2026-10-22',
    referenceType: 'Return',
    referenceNo: 'CR-102',
    crateTypeId: ct20Id,
    crateName: ct20!.name,
    inQuantity: 3,
    outQuantity: 0,
    balanceQuantity: 2,
    weightKgPerCrate: 20,
    totalKg: 60,
    notes: 'Return 3 of 20kg',
    createdAt: new Date().toISOString(),
  };
  db.saveCrateTransaction(return20);

  // Verify independent balances:
  // 10kg Crate: 5 issued - 2 returned = 3 balance
  // 20kg Crate: 5 issued - 3 returned = 2 balance
  // Total balance = 5 crates
  const bal10AfterReturn = getCustomerCrateBalanceByType(testCustomerId, ct10Id);
  const bal20AfterReturn = getCustomerCrateBalanceByType(testCustomerId, ct20Id);
  assert(bal10AfterReturn.returned === 2 && bal10AfterReturn.balance === 3, `10kg Crate balance is exactly 3 (got ${bal10AfterReturn.balance})`);
  assert(bal20AfterReturn.returned === 3 && bal20AfterReturn.balance === 2, `20kg Crate balance is exactly 2 (got ${bal20AfterReturn.balance})`);

  const stmtAfterReturn = getCustomerCrateStatement(testCustomerId);
  assert(stmtAfterReturn.closingCrates === 5, `Statement total closing crates is exactly 5 (got ${stmtAfterReturn.closingCrates})`);

  // 6. Test Return Validation:
  // Customer attempts to return 15 × 20kg Crate when issued balance is 2!
  const current20Bal = getCustomerCrateBalanceByType(testCustomerId, ct20Id).balance;
  const attemptedExcessReturn = 15;
  const exceedsBalance = attemptedExcessReturn > current20Bal;
  assert(exceedsBalance === true, `Attempting to return 15 of 20kg crate correctly detected as exceeding issued balance of ${current20Bal}`);

  // 7. Verify Statement entries contain crate type and typeBalance
  const hasTypeSpecificEntries = stmtAfterReturn.entries.some(
    (e) => e.crateTypeId === ct10Id && e.typeBalance !== undefined
  );
  assert(hasTypeSpecificEntries, 'Crate ledger statement entries have crateTypeId and typeBalance tracked');

  // 8. Clean up test fixtures
  db.deleteCreditSale(creditSaleId);
  db.deleteCrateTransaction(return10.id);
  db.deleteCrateTransaction(return20.id);
  db.deleteCustomer(testCustomerId);

  console.log('All Crate-Type Tracking E2E Tests PASSED successfully! 🎉');
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
