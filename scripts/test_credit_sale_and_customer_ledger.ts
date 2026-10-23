import { db } from '../src/services/db';
import { getCustomerLedger } from '../src/services/accounting';

console.log('=== TEST: Customer Directory & Ledger Fixes ===\n');

// 1. Create Customer with Aadhaar Number (No GSTIN in form)
const custWithAadhaar = {
  id: 'cust_aadhaar_' + Date.now(),
  name: 'Kailash Fruit Suppliers',
  contactPerson: 'Kailash Chand',
  mobile: '9829011223',
  altMobile: '9414011223',
  address: 'Shop 22, Sabzi Mandi',
  city: 'Jaipur',
  state: 'Rajasthan',
  aadhaarNo: '1234 5678 9012',
  photo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  openingBalance: 12500,
  openingBalanceType: 'debit' as const,
  openingCrateBalance: 15,
  active: true,
  createdAt: new Date().toISOString()
};

db.saveCustomer(custWithAadhaar as any);
const retrievedA = db.getCustomerById(custWithAadhaar.id);
if (!retrievedA) throw new Error('Customer with Aadhaar could not be retrieved');
if (retrievedA.aadhaarNo !== '1234 5678 9012') throw new Error('Aadhaar number not preserved');
if (retrievedA.gstin !== undefined) throw new Error('New customer should not have GSTIN');
console.log('✓ Requirement 1: Customer saved with Aadhaar Number (no GSTIN in form)');

// 2. Create Customer with Blank Aadhaar
const custWithoutAadhaar = {
  id: 'cust_no_aadhaar_' + Date.now(),
  name: 'Sharma Fruit Trading',
  mobile: '9829044556',
  openingBalance: 5000,
  openingBalanceType: 'debit' as const,
  openingCrateBalance: 0,
  active: true,
  createdAt: new Date().toISOString()
};
db.saveCustomer(custWithoutAadhaar as any);
const retrievedB = db.getCustomerById(custWithoutAadhaar.id);
if (!retrievedB) throw new Error('Customer without Aadhaar could not be retrieved');
if (retrievedB.aadhaarNo) throw new Error('Customer should have blank/undefined Aadhaar');
console.log('✓ Requirement 3: Customer with blank Aadhaar has no aadhaarNo value');

// 3. Historical GSTIN preservation in database
const custWithLegacyGstin = {
  id: 'cust_legacy_' + Date.now(),
  name: 'Legacy Trader Pvt Ltd',
  mobile: '9829077889',
  gstin: '08AAAAA0000A1Z5',
  aadhaarNo: '9988 7766 5544',
  openingBalance: 20000,
  openingBalanceType: 'debit' as const,
  openingCrateBalance: 10,
  active: true,
  createdAt: new Date().toISOString()
};
db.saveCustomer(custWithLegacyGstin as any);
const retrievedC = db.getCustomerById(custWithLegacyGstin.id);
if (retrievedC?.gstin !== '08AAAAA0000A1Z5') throw new Error('Legacy GSTIN in database was lost');
console.log('✓ Requirement 1: Historical GSTIN data preserved in database');

// 4. Ledger Statement sync & calculations
const ledgerA = getCustomerLedger(custWithAadhaar.id);
if (ledgerA.closingBalance !== 12500) throw new Error(`Expected closing balance 12500, got ${ledgerA.closingBalance}`);

const ledgerB = getCustomerLedger(custWithoutAadhaar.id);
if (ledgerB.closingBalance !== 5000) throw new Error(`Expected closing balance 5000, got ${ledgerB.closingBalance}`);

console.log('✓ Requirement 2 & 4: Customer ledger data synced accurately from Customer Directory');
console.log('\nALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
