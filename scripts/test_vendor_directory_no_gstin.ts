import { db } from '../src/services/db';
import { Vendor } from '../src/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`[PASS] ${msg}`);
}

console.log('--- 1. Testing Vendor Creation without GSTIN ---');
const newVendor: Vendor = {
  id: `v-test-${Date.now()}`,
  name: 'Nashik Valley Farms (No GSTIN)',
  contact: '9822099999',
  city: 'Nashik',
  state: 'Maharashtra',
  openingBalance: 15000,
  openingBalanceType: 'credit',
  active: true,
  createdAt: new Date().toISOString(),
};

db.saveVendor(newVendor);
const fetched = db.getVendorById(newVendor.id);
assert(!!fetched, 'Vendor saved and retrieved successfully');
assert(fetched?.name === newVendor.name, 'Vendor name matches');
assert(fetched?.gstin === undefined, 'GSTIN is undefined/omitted on new vendor');
assert(fetched?.openingBalance === 15000, 'Opening balance preserved');

console.log('--- 2. Testing Editing Vendor with Existing Historical GSTIN ---');
// Create a vendor with historical GSTIN
const historicalVendor: Vendor = {
  id: `v-hist-${Date.now()}`,
  name: 'Kashmir Apple Grower Syndicate',
  contact: '9419011111',
  city: 'Sopore',
  state: 'Jammu and Kashmir',
  gstin: '01AAAAA0000A1Z5',
  openingBalance: 50000,
  openingBalanceType: 'credit',
  active: true,
  createdAt: new Date().toISOString(),
};
db.saveVendor(historicalVendor);

// Simulate the edit action performed by WholesaleDirectoryView (where gstin is preserved from editingVendor.gstin without asking user)
const updatedVendor: Vendor = {
  id: historicalVendor.id,
  name: 'Kashmir Apple Grower Syndicate (Updated Name)',
  contact: '9419022222',
  city: 'Sopore',
  state: 'Jammu and Kashmir',
  gstin: historicalVendor.gstin, // Preserved from editingVendor?.gstin
  openingBalance: 50000,
  openingBalanceType: 'credit',
  active: true,
  createdAt: historicalVendor.createdAt,
};
db.saveVendor(updatedVendor);

const fetchedHist = db.getVendorById(historicalVendor.id);
assert(!!fetchedHist, 'Historical vendor retrieved');
assert(fetchedHist?.name === 'Kashmir Apple Grower Syndicate (Updated Name)', 'Name updated');
assert(fetchedHist?.contact === '9419022222', 'Contact phone updated');
assert(fetchedHist?.gstin === '01AAAAA0000A1Z5', 'Historical GSTIN preserved intact in database');

// Clean up
db.deleteVendor(newVendor.id);
db.deleteVendor(historicalVendor.id);
console.log('[PASS] Test cleanup successful');
console.log('ALL VENDOR DIRECTORY GSTIN TESTS PASSED! ✓');
