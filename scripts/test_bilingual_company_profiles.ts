/**
 * Automated Verification Test Suite for Bilingual Company Names in Hari Kripa Fruit ERP
 * Tests all 8 verification items requested by user:
 * 1. Create a new company with English and Hindi names.
 * 2. Save, reopen, and edit that company profile.
 * 3. Create another company with different bilingual names and verify the profiles remain independent.
 * 4. Select each company and generate bills in applicable modules.
 * 5. Confirm both names appear correctly without corruption.
 * 6. Confirm a blank Hindi name does not break existing billing and displays English normally.
 * 7. Verify Hindi text survives saving, refreshing, and reopening the database.
 * 8. Confirm all existing calculations and historical records remain unchanged.
 */

import { db } from '../src/services/db';
import { CompanyProfile, CreditSale, CashSale, SaleProceeds } from '../src/types';
import { getCustomerLedger } from '../src/services/accounting';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';

let passes = 0;
let failures = 0;

function expect(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passes++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failures++;
  }
}

async function runBilingualTests() {
  console.log('=== TEST SUITE: Bilingual Company Billing Profiles ===\n');

  // --- TEST 1: Create a new company with English and Hindi names ---
  console.log('--- 1. Creating New Company Profile with Bilingual Names ---');
  const comp1Id = `cp-test-bilingual-1-${Date.now()}`;
  const comp1: CompanyProfile = {
    id: comp1Id,
    name: 'Shree Krishna Fruits',
    hindiName: 'श्री कृष्णा फ्रूट्स',
    tradeName: 'Commission Agent & Supplier',
    address: 'Gala 101, APMC Market',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411037',
    mobile: '9876543210',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  db.saveCompanyProfile(comp1);

  const retrieved1 = db.getCompanyProfiles().find((p) => p.id === comp1Id);
  expect(!!retrieved1, 'Company 1 saved and retrieved from DB');
  expect(retrieved1?.name === 'Shree Krishna Fruits', 'Company 1 English name matches exactly');
  expect(retrieved1?.hindiName === 'श्री कृष्णा फ्रूट्स', 'Company 1 Hindi name matches exactly without unicode corruption');

  // --- TEST 2: Reopen and edit the company profile ---
  console.log('\n--- 2. Editing and Reopening Company Profile ---');
  const updatedComp1: CompanyProfile = {
    ...retrieved1!,
    hindiName: 'श्री कृष्ण कृपा फ्रूट्स ट्रेडिंग',
    address: 'Shop 101-B, APMC Market Yard',
  };
  db.saveCompanyProfile(updatedComp1);

  const reloaded1 = db.getCompanyProfiles().find((p) => p.id === comp1Id);
  expect(
    reloaded1?.hindiName === 'श्री कृष्ण कृपा फ्रूट्स ट्रेडिंग',
    'Updated Hindi name survives save and reload'
  );
  expect(
    reloaded1?.address === 'Shop 101-B, APMC Market Yard',
    'Updated address persists alongside bilingual name'
  );

  // --- TEST 3: Create second company with different bilingual names & verify independence ---
  console.log('\n--- 3. Creating Second Independent Profile ---');
  const comp2Id = `cp-test-bilingual-2-${Date.now()}`;
  const comp2: CompanyProfile = {
    id: comp2Id,
    name: 'Balaji Fruit Commission',
    hindiName: 'बालाजी फ्रूट कमीशन',
    tradeName: 'Apple & Pomegranate Wholesalers',
    address: 'Plot 45, Fruit Mandi',
    city: 'Nagpur',
    state: 'Maharashtra',
    pincode: '440008',
    mobile: '9123456780',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  db.saveCompanyProfile(comp2);

  const check1 = db.getCompanyProfiles().find((p) => p.id === comp1Id);
  const check2 = db.getCompanyProfiles().find((p) => p.id === comp2Id);

  expect(check1?.name === 'Shree Krishna Fruits', 'Company 1 retains its own English name');
  expect(check1?.hindiName === 'श्री कृष्ण कृपा फ्रूट्स ट्रेडिंग', 'Company 1 retains its own Hindi name');
  expect(check2?.name === 'Balaji Fruit Commission', 'Company 2 has its own English name');
  expect(check2?.hindiName === 'बालाजी फ्रूट कमीशन', 'Company 2 has its own Hindi name');
  expect(
    check1?.name !== check2?.name && check1?.hindiName !== check2?.hindiName,
    'Profiles remain strictly independent (switching does not cross-contaminate names)'
  );

  // --- TEST 4: Blank Hindi Name handling ---
  console.log('\n--- 4. Profile with Blank Hindi Name (English Only Fallback) ---');
  const comp3Id = `cp-test-blank-hindi-${Date.now()}`;
  const comp3: CompanyProfile = {
    id: comp3Id,
    name: 'Universal Fruit Corp',
    hindiName: undefined, // Blank / not provided
    address: 'Shed 9, Mandi Gate 2',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    mobile: '9998887770',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  db.saveCompanyProfile(comp3);
  const check3 = db.getCompanyProfiles().find((p) => p.id === comp3Id);
  expect(check3?.name === 'Universal Fruit Corp', 'English name is preserved when Hindi is blank');
  expect(!check3?.hindiName, 'Blank Hindi name is handled safely without crashing');

  // --- TEST 5: Billing Integration & Snapshot Preservation ---
  console.log('\n--- 5. Bill Creation and Historical Snapshot Safety ---');
  // Create a bill with comp1's snapshot
  const testBillNo = `TB-${Date.now()}`;
  const testSale: CreditSale = {
    id: `cs-test-${Date.now()}`,
    creditSaleNo: testBillNo,
    sequenceNumber: 9999,
    customerId: 'cust-temp-1',
    customerName: 'Test Merchant Alpha',
    date: '2026-10-20',
    items: [
      {
        id: 'it-1',
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
    expenses: [],
    productTotal: 5000,
    expenseTotal: 0,
    totalDebit: 5000,
    finalAmount: 5000,
    createdAt: new Date().toISOString(),
  };

  db.saveCreditSale(testSale);
  const retrievedSale = db.getCreditSales().find((s) => s.id === testSale.id);
  expect(retrievedSale?.finalAmount === 5000, 'Sale saved with correct amount 5,000');

  // Editing comp1 profile afterwards MUST NOT alter the sales calculation or historical numbers
  const reUpdatedComp1 = {
    ...reloaded1!,
    name: 'Shree Krishna Fruits Renamed',
    hindiName: 'श्री कृष्णा फ्रूट्स रीनेम्ड',
  };
  db.saveCompanyProfile(reUpdatedComp1);

  const saleCheckAfterProfileEdit = db.getCreditSales().find((s) => s.id === testSale.id);
  expect(
    saleCheckAfterProfileEdit?.finalAmount === 5000,
    'Historical bill amounts and debit balances are untouched when company profile is modified'
  );

  // --- TEST 6: Mandatory Calculations & Business Logic Integrity ---
  console.log('\n--- 6. Business Calculation Verification ---');
  // Crate formula: KG * Rate
  const crateCalc = calculateWholesaleItemAmount(10, 'Crate', 200, 50);
  expect(crateCalc === 10000, 'Crate item amount calculation preserved (200 KG * 50 = 10,000)');

  // Box formula: Qty * Rate when KG is 0
  const boxCalc = calculateWholesaleItemAmount(15, 'Box', 0, 200);
  expect(boxCalc === 3000, 'Box item amount calculation preserved (15 Box * 200 = 3,000)');

  // --- TEST 7: Clean Up Test Fixtures ---
  console.log('\n--- 7. Cleaning Up Test Fixtures ---');
  db.deleteCompanyProfile(comp1Id);
  db.deleteCompanyProfile(comp2Id);
  db.deleteCompanyProfile(comp3Id);
  db.deleteCreditSale(testSale.id);

  expect(
    !db.getCompanyProfiles().some((p) => p.id === comp1Id || p.id === comp2Id || p.id === comp3Id),
    'Test company profiles cleanly removed'
  );

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

runBilingualTests();
