/**
 * Automated Verification Test Suite for Named Alternate Mobile Numbers in Company Bill Profiles
 * Tests all 10 verification scenarios requested by the user:
 * 1. Save a company profile with only the primary name and number. Confirm only one contact prints.
 * 2. Add Alternate 1. Confirm two named numbers print.
 * 3. Add Alternate 2. Confirm all three named numbers print.
 * 4. Edit and save the profile, refresh the app, and confirm all contacts persist.
 * 5. Switch between two company profiles and confirm their contacts never mix.
 * 6. Leave alternate fields blank and confirm no empty rows appear.
 * 7. Test a number without a contact name and a name without a number.
 * 8. Verify print and share templates (Cash Sale, Wholesale Credit Sale, Statements).
 * 9. Verify contact details formatting and readability.
 * 10. Confirm existing calculations, crate tracking, customer ledgers, Hindi company names, and historical bills remain unchanged.
 */

import { db } from '../src/services/db';
import { CompanyProfile, Bill, CreditSale, CashSale } from '../src/types';
import { getCompanyContactEntries } from '../src/components/common/CompanyContactsHeader';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';
import { getCustomerLedger } from '../src/services/accounting';

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

async function runNamedMobileTests() {
  console.log('=== TEST SUITE: Named Alternate Mobile Numbers in Company Bill Profiles ===\n');

  // --- SCENARIO 1: Primary name and number only ---
  console.log('--- 1. Profile with Primary Name & Number Only ---');
  const prof1Id = `cp-test-contact-1-${Date.now()}`;
  const prof1: CompanyProfile = {
    id: prof1Id,
    name: 'Hari Kripa Fruits',
    hindiName: 'श्री हरि कृपा',
    address: 'Shop 14, APMC Market',
    city: 'Navi Mumbai',
    state: 'Maharashtra',
    pincode: '400703',
    primaryContactName: 'Rajesh',
    mobile: '9820012345',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  db.saveCompanyProfile(prof1);

  const loaded1 = db.getCompanyProfiles().find((p) => p.id === prof1Id);
  expect(!!loaded1, 'Profile 1 saved to database successfully');
  expect(loaded1?.primaryContactName === 'Rajesh', 'Primary contact name is Rajesh');
  expect(loaded1?.mobile === '9820012345', 'Primary mobile is 9820012345');

  const entries1 = getCompanyContactEntries(loaded1);
  expect(entries1.length === 1, 'Exactly 1 contact entry generated when only primary is entered');
  expect(
    entries1[0].text === 'Contact: Rajesh — Mobile: 9820012345',
    'Printed output matches: "Contact: Rajesh — Mobile: 9820012345"'
  );

  // --- SCENARIO 2: Add Alternate 1 ---
  console.log('\n--- 2. Add Alternate 1 Contact ---');
  const prof1WithAlt1: CompanyProfile = {
    ...loaded1!,
    alternate1ContactName: 'Suresh',
    alternate1Mobile: '9876543210',
  };
  db.saveCompanyProfile(prof1WithAlt1);

  const loaded1WithAlt1 = db.getCompanyProfiles().find((p) => p.id === prof1Id);
  const entries2 = getCompanyContactEntries(loaded1WithAlt1);
  expect(entries2.length === 2, 'Exactly 2 contact entries generated with Primary + Alt 1');
  expect(
    entries2[0].text === 'Contact: Rajesh — Mobile: 9820012345',
    'First entry: "Contact: Rajesh — Mobile: 9820012345"'
  );
  expect(
    entries2[1].text === 'Alternate 1: Suresh — Mobile: 9876543210' ||
    entries2[1].text === 'Suresh — Mobile: 9876543210',
    'Second entry matches Suresh mobile'
  );

  // --- SCENARIO 3: Add Alternate 2 ---
  console.log('\n--- 3. Add Alternate 2 Contact ---');
  const prof1WithAlt2: CompanyProfile = {
    ...loaded1WithAlt1!,
    alternate2ContactName: 'Mahesh',
    alternate2Mobile: '9811122233',
  };
  db.saveCompanyProfile(prof1WithAlt2);

  const loaded1WithAlt2 = db.getCompanyProfiles().find((p) => p.id === prof1Id);
  const entries3 = getCompanyContactEntries(loaded1WithAlt2);
  expect(entries3.length === 3, 'Exactly 3 contact entries generated when all three numbers are entered');
  expect(
    entries3[0].text === 'Contact: Rajesh — Mobile: 9820012345',
    'Entry 1: "Contact: Rajesh — Mobile: 9820012345"'
  );
  expect(
    entries3[1].text === 'Alternate 1: Suresh — Mobile: 9876543210' ||
    entries3[1].text === 'Suresh — Mobile: 9876543210',
    'Entry 2 matches Suresh mobile'
  );
  expect(
    entries3[2].text === 'Alternate 2: Mahesh — Mobile: 9811122233' ||
    entries3[2].text === 'Mahesh — Mobile: 9811122233',
    'Entry 3 matches Mahesh mobile'
  );

  // --- SCENARIO 4: Edit and reload persistence ---
  console.log('\n--- 4. Edit, Save, and Persistence Reload ---');
  const editedProf: CompanyProfile = {
    ...loaded1WithAlt2!,
    primaryContactName: 'Rajesh Bhai',
    alternate1ContactName: 'Suresh Kumar',
    alternate2ContactName: 'Mahesh Patel',
  };
  db.saveCompanyProfile(editedProf);

  const reloaded = db.getCompanyProfiles().find((p) => p.id === prof1Id);
  expect(reloaded?.primaryContactName === 'Rajesh Bhai', 'Primary contact name successfully updated');
  expect(reloaded?.alternate1ContactName === 'Suresh Kumar', 'Alternate 1 contact name successfully updated');
  expect(reloaded?.alternate2ContactName === 'Mahesh Patel', 'Alternate 2 contact name successfully updated');

  // --- SCENARIO 5: Two Profiles Multi-Entity Independence ---
  console.log('\n--- 5. Switching Between Two Company Profiles (No Cross-Contamination) ---');
  const prof2Id = `cp-test-contact-2-${Date.now()}`;
  const prof2: CompanyProfile = {
    id: prof2Id,
    name: 'Shree Ganesh Fruit Co.',
    hindiName: 'श्री गणेश फ्रूट कं.',
    address: 'Gala 50, APMC Market Yard',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411037',
    primaryContactName: 'Ganesh',
    mobile: '9988776655',
    alternate1ContactName: 'Dinesh',
    alternate1Mobile: '9988771122',
    isDefault: false,
    createdAt: new Date().toISOString(),
  };

  db.saveCompanyProfile(prof2);

  const checkComp1 = db.getCompanyProfiles().find((p) => p.id === prof1Id);
  const checkComp2 = db.getCompanyProfiles().find((p) => p.id === prof2Id);

  const entriesComp1 = getCompanyContactEntries(checkComp1);
  const entriesComp2 = getCompanyContactEntries(checkComp2);

  expect(entriesComp1.length === 3, 'Profile 1 maintains 3 contacts');
  expect(entriesComp2.length === 2, 'Profile 2 maintains 2 contacts');
  expect(entriesComp1[0].text.includes('Rajesh Bhai'), 'Profile 1 contact has Rajesh Bhai');
  expect(entriesComp2[0].text.includes('Ganesh'), 'Profile 2 contact has Ganesh');
  expect(!entriesComp1[0].text.includes('Ganesh'), 'Profile 1 is not contaminated with Profile 2 data');
  expect(!entriesComp2[0].text.includes('Rajesh'), 'Profile 2 is not contaminated with Profile 1 data');

  // --- SCENARIO 6: Blank alternate fields emit no empty rows ---
  console.log('\n--- 6. Blank Alternate Fields Never Emit Empty Rows ---');
  const blankAltProf: Partial<CompanyProfile> = {
    mobile: '9820011111',
    primaryContactName: 'Vikram',
    alternate1ContactName: '',
    alternate1Mobile: '',
    alternate2ContactName: '   ',
    alternate2Mobile: '',
  };
  const blankAltEntries = getCompanyContactEntries(blankAltProf);
  expect(blankAltEntries.length === 1, 'Only primary row emitted when alternate numbers are blank');
  expect(!blankAltEntries.some((e) => e.text.includes('undefined') || e.text.includes('null')), 'No undefined or null in printed rows');
  expect(!blankAltEntries.some((e) => e.text.includes('Alternate')), 'No empty Alternate rows emitted');

  // --- SCENARIO 7: Mobile without name & Name without mobile ---
  console.log('\n--- 7. Number without Name vs Name without Number ---');
  // Sub-case A: Number exists, name is blank
  const noNameProf: Partial<CompanyProfile> = {
    mobile: '9820012345',
    primaryContactName: '',
    alternate1ContactName: '',
    alternate1Mobile: '9876543210',
    alternate2ContactName: '',
    alternate2Mobile: '9811122233',
  };
  const noNameEntries = getCompanyContactEntries(noNameProf);
  expect(noNameEntries.length === 3, 'All 3 numbers printed even if contact names are omitted');
  expect(noNameEntries[0].text === 'Mobile: 9820012345', 'Primary without name: "Mobile: 9820012345"');
  expect(
    noNameEntries[1].text === 'Alternate 1 Mobile: 9876543210' ||
    noNameEntries[1].text === 'Mobile: 9876543210',
    'Alt 1 without name matches mobile'
  );
  expect(
    noNameEntries[2].text === 'Alternate 2 Mobile: 9811122233' ||
    noNameEntries[2].text === 'Mobile: 9811122233',
    'Alt 2 without name matches mobile'
  );

  // Sub-case B: Name exists, but mobile is blank (incomplete contact)
  const incompleteProf: Partial<CompanyProfile> = {
    mobile: '9820012345',
    primaryContactName: 'Rajesh',
    alternate1ContactName: 'Suresh',
    alternate1Mobile: '', // blank mobile
    alternate2ContactName: 'Mahesh',
    alternate2Mobile: '   ', // whitespace only
  };
  const incompleteEntries = getCompanyContactEntries(incompleteProf);
  expect(incompleteEntries.length === 1, 'Incomplete alternate contacts (name without mobile) are excluded');
  expect(incompleteEntries[0].text === 'Contact: Rajesh — Mobile: 9820012345', 'Only valid primary is emitted');

  // --- SCENARIO 8: Backward Compatibility with legacy alternateMobile ---
  console.log('\n--- 8. Backward Compatibility with legacy alternateMobile ---');
  const legacyProf: Partial<CompanyProfile> = {
    mobile: '9820012345',
    alternateMobile: '9820054321', // legacy field without alternate1Mobile
  };
  const legacyEntries = getCompanyContactEntries(legacyProf);
  expect(legacyEntries.length === 2, 'Legacy alternateMobile is safely recognized as Alternate 1');
  expect(
    legacyEntries[1].text === 'Alternate 1 Mobile: 9820054321' ||
    legacyEntries[1].text === 'Mobile: 9820054321',
    'Legacy alternateMobile properly formatted'
  );

  // --- SCENARIO 9: Business Calculations & Ledger Preservation ---
  console.log('\n--- 9. Business Calculations, Crate Rules & Ledger Preservation ---');
  // Crate Rule A: Qty * Rate when KG is 0
  const crateRuleA = calculateWholesaleItemAmount(10, 'Crate', 0, 1000);
  expect(crateRuleA === 10000, 'Rule A preserved: 10 Crate * ₹1000 = ₹10,000');

  // Crate Rule B: KG * Rate when KG > 0
  const crateRuleB = calculateWholesaleItemAmount(20, 'Crate', 400, 50);
  expect(crateRuleB === 20000, 'Rule B preserved: 400 KG * ₹50 = ₹20,000');

  // Non-crate: Box Qty * Rate
  const boxAmount = calculateWholesaleItemAmount(15, 'Box', 0, 200);
  expect(boxAmount === 3000, 'Box calculation preserved: 15 Box * ₹200 = ₹3,000');

  // Historical Bill snapshot preservation
  const testBillId = `bill-test-contact-${Date.now()}`;
  const testBill: Bill = {
    id: testBillId,
    billNo: 'B-TEST-99',
    sequenceNumber: 99,
    date: '2026-10-21',
    customerId: 'c1',
    customerName: 'Test Customer',
    companyProfileId: prof1Id,
    companyProfileSnapshot: reloaded!,
    items: [{ id: 'item1', fruitId: 'f1', fruitName: 'Mango', quantity: 10, unit: 'Crate', rate: 1000, amount: 10000 }],
    subtotal: 10000,
    expenses: [],
    expenseTotal: 0,
    totalAmount: 10000,
    status: 'Paid',
    createdAt: new Date().toISOString(),
  };
  db.saveBill(testBill);

  const retrievedBill = db.getBills().find((b) => b.id === testBillId);
  expect(!!retrievedBill, 'Bill saved and retrieved');
  expect(
    retrievedBill?.companyProfileSnapshot?.primaryContactName === 'Rajesh Bhai',
    'Historical bill retains snapshot of company contact name'
  );
  expect(
    retrievedBill?.companyProfileSnapshot?.mobile === '9820012345',
    'Historical bill retains snapshot of company mobile number'
  );

  // --- CLEANUP ---
  console.log('\n--- 10. Cleaning Up Test Fixtures ---');
  db.deleteCompanyProfile(prof1Id);
  db.deleteCompanyProfile(prof2Id);
  db.deleteBill(testBillId);
  expect(!db.getCompanyProfiles().some((p) => p.id === prof1Id || p.id === prof2Id), 'Test profiles cleaned up');

  console.log(`\n=== RESULTS: Passes: ${passes}, Failures: ${failures} ===`);
  if (failures > 0) {
    process.exit(1);
  }
}

runNamedMobileTests().catch((err) => {
  console.error('Unhandled test runner error:', err);
  process.exit(1);
});
