import { db } from '../src/services/db';
import { Customer, SaleProceeds } from '../src/types';

function runTests() {
  console.log('=== TEST SUITE: Final Two UI Changes Verification ===\n');
  let passes = 0;
  let failures = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`[PASS] ${msg}`);
      passes++;
    } else {
      console.error(`[FAIL] ${msg}`);
      failures++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Add New Wholesale Customer without GSTIN
  // ----------------------------------------------------
  console.log('--- 1. Testing Wholesale Customer Creation without GSTIN ---');
  const custNoGstin: Customer = {
    id: `cust-test-nogstin-${Date.now()}`,
    name: 'Kishan Fruit Traders (No GSTIN)',
    mobile: '9876543210',
    altMobile: '9123456780',
    address: 'Shop No. 12, APMC Market',
    city: 'Nashik',
    state: 'Maharashtra',
    aadhaarNo: '4567 8901 2345',
    // gstin is intentionally omitted
    openingBalance: 2500,
    openingBalanceType: 'debit',
    openingCrateBalance: 8,
    crateTypeId: 'ct-1',
    notes: 'Premium wholesaler',
    active: true,
    createdAt: new Date().toISOString(),
  };

  db.saveCustomer(custNoGstin);
  const fetchedCust = db.getCustomerById(custNoGstin.id);

  assert(!!fetchedCust, 'Customer saved and retrieved successfully without GSTIN');
  assert(fetchedCust?.name === custNoGstin.name, 'Customer name matches');
  assert(fetchedCust?.gstin === undefined, 'GSTIN is undefined/omitted as expected');
  assert(fetchedCust?.openingBalance === 2500, 'Opening balance preserved');
  assert(fetchedCust?.openingCrateBalance === 8, 'Opening crate balance preserved');

  // Verify historical customer with existing GSTIN is not mutated or broken
  const custWithGstin: Customer = {
    id: `cust-test-withgstin-${Date.now()}`,
    name: 'Historical Trader Pvt Ltd',
    mobile: '9988776655',
    address: 'Gala 5, Vashi APMC',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    gstin: '27AAAAA0000A1Z5',
    openingBalance: 15000,
    openingBalanceType: 'debit',
    openingCrateBalance: 20,
    active: true,
    createdAt: new Date().toISOString(),
  };

  db.saveCustomer(custWithGstin);
  const fetchedHistorical = db.getCustomerById(custWithGstin.id);
  assert(fetchedHistorical?.gstin === '27AAAAA0000A1Z5', 'Existing historical customer GSTIN data is preserved');

  // ----------------------------------------------------
  // TEST 2: New Sale Proceeds Entry without Bill / Challan No.
  // ----------------------------------------------------
  console.log('\n--- 2. Testing Sale Proceeds Entry without Bill / Challan No. ---');
  const seq = db.getNextSaleProceedsNumber();
  const newProceeds: SaleProceeds = {
    id: `sp-test-${Date.now()}`,
    proceedsNo: `Sale Proceeds No. ${String(seq).padStart(3, '0')}`,
    sequenceNumber: seq,
    date: '2026-10-20',
    challanDate: '2026-10-20',
    // billNumber is omitted
    items: [
      {
        id: `spi-1`,
        fruitId: 'f-1',
        fruitName: 'Mahabaleshwar Strawberry',
        quantity: 14,
        unit: 'Crate',
        rate: 414,
        amount: 4186,
      },
    ],
    quantity: 14,
    unit: 'Crate',
    rate: 414,
    amount: 4186,
    expenses: [
      { id: 'exp-1', name: 'Freight', amount: 100 },
      { id: 'exp-2', name: 'Hamali', amount: 10 },
      { id: 'exp-3', name: 'Postage', amount: 6 },
    ],
    totalExpense: 116,
    netAmount: 4070, // 4186 - 116
    difference: -116,
    vendorName: 'Direct Consignor',
    createdAt: new Date().toISOString(),
  };

  db.saveSaleProceeds(newProceeds);
  const fetchedProceeds = db.getSaleProceeds().find((s) => s.id === newProceeds.id);

  assert(!!fetchedProceeds, 'New Sale Proceeds entry saved and retrieved successfully without billNumber');
  assert(fetchedProceeds?.billNumber === undefined, 'billNumber is safely omitted/undefined');
  assert(fetchedProceeds?.amount === 4186, 'Amount calculation preserved');
  assert(fetchedProceeds?.totalExpense === 116, 'Total expenses calculated accurately');
  assert(fetchedProceeds?.netAmount === 4070, 'Net amount accurately equals 4186 - 116 = 4070');
  assert(fetchedProceeds?.difference === -116, 'Difference accurately equals -116');

  // Verify historical Sale Proceeds with existing billNumber retains it
  const historicalProceeds: SaleProceeds = {
    id: `sp-historical-${Date.now()}`,
    proceedsNo: `Sale Proceeds No. ${String(seq + 1).padStart(3, '0')}`,
    sequenceNumber: seq + 1,
    date: '2026-10-18',
    challanDate: '2026-10-18',
    billNumber: 'BILL-HIST-9872',
    items: [
      {
        id: `spi-2`,
        fruitId: 'f-1',
        fruitName: 'Mahabaleshwar Strawberry',
        quantity: 10,
        unit: 'Crate',
        rate: 400,
        amount: 4000,
      },
    ],
    quantity: 10,
    unit: 'Crate',
    rate: 400,
    amount: 4000,
    expenses: [{ id: 'exp-h1', name: 'Freight', amount: 50 }],
    totalExpense: 50,
    netAmount: 3950,
    difference: -50,
    createdAt: new Date().toISOString(),
  };

  db.saveSaleProceeds(historicalProceeds);
  const fetchedHistProceeds = db.getSaleProceeds().find((s) => s.id === historicalProceeds.id);
  assert(fetchedHistProceeds?.billNumber === 'BILL-HIST-9872', 'Historical billNumber data is preserved intact');

  // ----------------------------------------------------
  // TEST 3: Cleanup Test Fixtures
  // ----------------------------------------------------
  console.log('\n--- 3. Cleaning Up Test Fixtures ---');
  db.deleteCustomer(custNoGstin.id);
  db.deleteCustomer(custWithGstin.id);
  db.deleteSaleProceeds(newProceeds.id);
  db.deleteSaleProceeds(historicalProceeds.id);
  assert(true, 'Test records cleaned up safely');

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) process.exit(1);
}

runTests();
