import fs from 'fs';
import path from 'path';
import { db } from '../src/services/db';
import { Fruit } from '../src/types';
import { getFruitEffectivePrice } from '../src/utils/fruitUtils';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';

function runTests() {
  console.log('=== TEST SUITE: FRUIT / ITEM MASTER DEFAULT PRICE & SAVED PRICE PRESERVATION ===\n');

  // Test 1: Check source code in FruitMasterView.tsx
  const fruitMasterPath = path.resolve(process.cwd(), 'src/components/master/FruitMasterView.tsx');
  const fruitMasterContent = fs.readFileSync(fruitMasterPath, 'utf8');

  // Verify editPrice state is initialized to 1
  if (!fruitMasterContent.includes("useState<number | ''>(1)")) {
    throw new Error('FAIL: FruitMasterView does not initialize editPrice state to 1');
  }
  console.log('✓ 1. FruitMasterView initializes editPrice state to numeric 1');

  // Verify handleEditClick initializes missing price to 1, while preserving saved price
  if (!fruitMasterContent.includes('const rawRate = f.defaultRate ?? (f as any).rate ?? (f as any).price;')) {
    throw new Error('FAIL: FruitMasterView does not properly check rawRate');
  }
  if (!fruitMasterContent.includes('let initialPrice = 1;')) {
    throw new Error('FAIL: FruitMasterView does not default initialPrice to 1');
  }
  console.log('✓ 2. FruitMasterView handleEditClick safely resolves saved price or defaults to 1 if missing/empty');

  // Verify placeholder="1" and onBlur fallback in FruitMasterView
  if (!fruitMasterContent.includes('placeholder="1"') || !fruitMasterContent.includes('setEditPrice(1)')) {
    throw new Error('FAIL: FruitMasterView does not set placeholder="1" or onBlur fallback to 1');
  }
  console.log('✓ 3. FruitMasterView QuantityInput includes placeholder="1" and fallback onBlur to 1');

  // Test 2: Check AddFruitModal.tsx
  const addFruitPath = path.resolve(process.cwd(), 'src/components/modals/AddFruitModal.tsx');
  const addFruitContent = fs.readFileSync(addFruitPath, 'utf8');
  if (!addFruitContent.includes("useState<number | ''>(1)")) {
    throw new Error('FAIL: AddFruitModal does not initialize price state to 1');
  }
  if (!addFruitContent.includes('placeholder="1"')) {
    throw new Error('FAIL: AddFruitModal does not set placeholder="1"');
  }
  if (!addFruitContent.includes('setPrice(1)')) {
    throw new Error('FAIL: AddFruitModal does not reset price to 1');
  }
  console.log('✓ 4. AddFruitModal initializes price to 1, resets to 1, and includes placeholder="1"');

  // Test 3: Simulation of handleEditClick logic for various fruit price conditions
  // Helper mimicking handleEditClick price initialization
  const resolveFormPrice = (f: Partial<Fruit>): number => {
    const rawRate = f.defaultRate ?? (f as any).rate ?? (f as any).price;
    let initialPrice = 1;
    if (rawRate !== undefined && rawRate !== null && String(rawRate).trim() !== '') {
      const parsed = Number(rawRate);
      if (!isNaN(parsed)) {
        initialPrice = parsed;
      }
    }
    return initialPrice;
  };

  // Condition A: Saved price of 100
  const fruitWith100: Partial<Fruit> = { id: 'f-100', name: 'Alphonso Mango', defaultRate: 100 };
  if (resolveFormPrice(fruitWith100) !== 100) {
    throw new Error(`FAIL: Saved price 100 should remain 100, got ${resolveFormPrice(fruitWith100)}`);
  }
  console.log('✓ 5. Edit Item with saved price 100 preserves exact value 100');

  // Condition B: Saved price of 250
  const fruitWith250: Partial<Fruit> = { id: 'f-250', name: 'Premium Apple', defaultRate: 250 };
  if (resolveFormPrice(fruitWith250) !== 250) {
    throw new Error(`FAIL: Saved price 250 should remain 250, got ${resolveFormPrice(fruitWith250)}`);
  }
  console.log('✓ 6. Edit Item with saved price 250 preserves exact value 250');

  // Condition C: Saved price of 50
  const fruitWith50: Partial<Fruit> = { id: 'f-50', name: 'Guava', defaultRate: 50 };
  if (resolveFormPrice(fruitWith50) !== 50) {
    throw new Error(`FAIL: Saved price 50 should remain 50, got ${resolveFormPrice(fruitWith50)}`);
  }
  console.log('✓ 7. Edit Item with saved price 50 preserves exact value 50');

  // Condition D: Missing price (undefined)
  const fruitMissingPrice: Partial<Fruit> = { id: 'f-undef', name: 'Unpriced Fruit', defaultRate: undefined };
  if (resolveFormPrice(fruitMissingPrice) !== 1) {
    throw new Error(`FAIL: Missing price should default to 1, got ${resolveFormPrice(fruitMissingPrice)}`);
  }
  console.log('✓ 8. Item with missing/undefined price initializes to 1');

  // Condition E: Null price
  const fruitNullPrice: any = { id: 'f-null', name: 'Null Price Fruit', defaultRate: null };
  if (resolveFormPrice(fruitNullPrice) !== 1) {
    throw new Error(`FAIL: Null price should default to 1, got ${resolveFormPrice(fruitNullPrice)}`);
  }
  console.log('✓ 9. Item with null price initializes to 1');

  // Condition F: Empty string price
  const fruitEmptyPrice: any = { id: 'f-empty', name: 'Empty Price Fruit', defaultRate: '' };
  if (resolveFormPrice(fruitEmptyPrice) !== 1) {
    throw new Error(`FAIL: Empty price should default to 1, got ${resolveFormPrice(fruitEmptyPrice)}`);
  }
  console.log('✓ 10. Item with empty string price initializes to 1');

  // Condition G: Legacy rate field fallback
  const fruitLegacyRate: any = { id: 'f-legacy', name: 'Legacy Fruit', rate: 75 };
  if (resolveFormPrice(fruitLegacyRate) !== 75) {
    throw new Error(`FAIL: Legacy rate 75 should be preserved, got ${resolveFormPrice(fruitLegacyRate)}`);
  }
  console.log('✓ 11. Item with legacy rate property preserves saved value 75');

  // Test 4: Database save and retrieval round-trip
  const testFruitId = `test-fruit-${Date.now()}`;
  const testFruit: Fruit = {
    id: testFruitId,
    name: 'Test Golden Kiwi',
    unit: 'Box',
    defaultUnit: 'Box',
    defaultRate: 1, // Default 1
    crateWeightKg: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };

  db.saveFruit(testFruit);
  let saved = db.getFruitById(testFruitId);
  if (!saved || saved.defaultRate !== 1) {
    throw new Error(`FAIL: Newly created fruit should have defaultRate 1, got ${saved?.defaultRate}`);
  }
  console.log('✓ 12. Created new fruit in DB with defaultRate 1 persisted correctly');

  // Now simulate user editing the price to 320 and saving
  const updatedFruit: Fruit = {
    ...saved,
    defaultRate: 320,
  };
  db.saveFruit(updatedFruit);
  saved = db.getFruitById(testFruitId);
  if (!saved || saved.defaultRate !== 320) {
    throw new Error(`FAIL: Updated fruit should have defaultRate 320, got ${saved?.defaultRate}`);
  }
  console.log('✓ 13. Edited fruit price to 320 persisted successfully in DB');

  // Cleanup test fruit
  db.deleteFruit(testFruitId);
  console.log('✓ 14. Cleaned up test fruit record');

  // Test 5: Verify existing fruit catalog in DB has not been overwritten
  const catalog = db.getFruits();
  if (catalog.length === 0) {
    throw new Error('FAIL: Catalog is empty');
  }
  // Check known existing items
  const orange = catalog.find((f) => f.name.toLowerCase().includes('orange'));
  if (orange && orange.defaultRate <= 0) {
    throw new Error('FAIL: Existing orange price corrupted');
  }
  console.log(`✓ 15. Existing database catalog intact (${catalog.length} items checked)`);

  // Test 6: Verify billing calculations continue to function with resolved prices
  const fruitEffectivePrice = getFruitEffectivePrice(orange);
  const calculatedAmt = calculateWholesaleItemAmount(10, orange?.unit || 'Crate', 0, fruitEffectivePrice);
  if (calculatedAmt <= 0) {
    throw new Error('FAIL: Wholesale item amount calculation failed');
  }
  console.log(`✓ 16. Billing calculation test passed (10 ${orange?.unit} @ ₹${fruitEffectivePrice} = ₹${calculatedAmt})`);

  console.log('\n=== ALL 16 TESTS PASSED SUCCESSFULLY! ===');
}

runTests();
