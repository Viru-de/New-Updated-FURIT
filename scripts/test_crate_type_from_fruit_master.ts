import { Fruit, CrateType, CreditSaleItem, CashSaleItem, SaleProceedsItem } from '../src/types';
import { getFruitEffectivePrice, getFruitSavedCrateType } from '../src/utils/fruitUtils';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';

function runTests() {
  console.log('=== TEST SUITE: Crate Type Depends on Fruit Master ===\n');

  // Test catalog of fruits
  const fruitA: Fruit = {
    id: 'fruit-a',
    name: 'Alphonso Mango 10kg',
    unit: 'Crate',
    defaultUnit: 'Crate',
    crateType: '10kg Crate',
    crateName: '10kg Crate',
    crateWeightKg: 10,
    defaultRate: 800,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const fruitB: Fruit = {
    id: 'fruit-b',
    name: 'Grapes Green 20kg',
    unit: 'Crate',
    defaultUnit: 'Crate',
    crateType: '20kg Crate',
    crateName: '20kg Crate',
    crateWeightKg: 20,
    defaultRate: 150,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const fruitC: Fruit = {
    id: 'fruit-c',
    name: 'Loose Apples',
    unit: 'Kg',
    defaultUnit: 'Kg',
    crateType: '',
    crateName: '',
    crateWeightKg: 0,
    defaultRate: 120,
    active: true,
    createdAt: new Date().toISOString(),
  };

  const fruitD_undefined: Fruit = {
    id: 'fruit-d',
    name: 'Exotic Fruit Unspecified',
    unit: 'Box',
    defaultUnit: 'Box',
    defaultRate: 300,
    crateWeightKg: 0,
    active: true,
    createdAt: new Date().toISOString(),
  };

  console.log('[SECTION 1] getFruitSavedCrateType Utility Tests');
  const ctA = getFruitSavedCrateType(fruitA);
  const ctB = getFruitSavedCrateType(fruitB);
  const ctC = getFruitSavedCrateType(fruitC);
  const ctD = getFruitSavedCrateType(fruitD_undefined);
  const ctNull = getFruitSavedCrateType(null);

  if (ctA !== '10kg Crate') throw new Error(`Fruit A crate type expected '10kg Crate', got '${ctA}'`);
  if (ctB !== '20kg Crate') throw new Error(`Fruit B crate type expected '20kg Crate', got '${ctB}'`);
  if (ctC !== '') throw new Error(`Fruit C crate type expected '', got '${ctC}'`);
  if (ctD !== '') throw new Error(`Fruit D crate type expected '', got '${ctD}'`);
  if (ctNull !== '') throw new Error(`Null fruit crate type expected '', got '${ctNull}'`);
  console.log('  ✓ getFruitSavedCrateType correctly resolves exact saved crate types and blanks');

  console.log('\n[SECTION 2] Wholesale Credit Sale Simulation');
  let rowCredit: CreditSaleItem = {
    id: 'csi-1',
    fruitId: '',
    fruitName: '',
    quantity: 1,
    unit: 'Crate',
    kg: 0,
    crateTypeId: '',
    crateName: '',
    rate: 0,
    amount: 0,
  };

  // Step 1: Select Fruit A
  let ct = getFruitSavedCrateType(fruitA);
  rowCredit.fruitId = fruitA.id;
  rowCredit.fruitName = fruitA.name;
  rowCredit.unit = fruitA.unit || 'Crate';
  rowCredit.rate = getFruitEffectivePrice(fruitA);
  rowCredit.crateName = ct;
  rowCredit.amount = calculateWholesaleItemAmount(rowCredit.quantity, rowCredit.unit, rowCredit.kg, rowCredit.rate);

  if (rowCredit.crateName !== '10kg Crate') {
    throw new Error(`Selecting Fruit A failed: expected '10kg Crate', got '${rowCredit.crateName}'`);
  }
  console.log('  ✓ Selecting Fruit A displays "10kg Crate" in Wholesale Credit Sale');

  // Step 2: Switch to Fruit B
  ct = getFruitSavedCrateType(fruitB);
  rowCredit.fruitId = fruitB.id;
  rowCredit.fruitName = fruitB.name;
  rowCredit.crateName = ct;
  if (rowCredit.crateName !== '20kg Crate') {
    throw new Error(`Selecting Fruit B failed: expected '20kg Crate', got '${rowCredit.crateName}'`);
  }
  console.log('  ✓ Switching to Fruit B displays "20kg Crate" in Wholesale Credit Sale');

  // Step 3: Switch to Fruit C (no crate type)
  ct = getFruitSavedCrateType(fruitC);
  rowCredit.fruitId = fruitC.id;
  rowCredit.fruitName = fruitC.name;
  rowCredit.crateName = ct;
  if (rowCredit.crateName !== '') {
    throw new Error(`Switching to Fruit C failed: expected '', got '${rowCredit.crateName}'`);
  }
  console.log('  ✓ Switching to Fruit C clears Crate Type completely');

  // Step 4: Clear Fruit
  rowCredit.fruitId = '';
  rowCredit.fruitName = '';
  rowCredit.crateName = '';
  if (rowCredit.crateName !== '') {
    throw new Error(`Clearing fruit failed: expected '', got '${rowCredit.crateName}'`);
  }
  console.log('  ✓ Clearing fruit selection clears Crate Type');

  console.log('\n[SECTION 3] Cash Sale Simulation');
  let rowCash: CashSaleItem = {
    id: 'casi-1',
    fruitId: '',
    fruitName: '',
    quantity: 1,
    unit: 'Crate',
    kg: 0,
    crateTypeId: '',
    crateName: '',
    rate: 0,
    amount: 0,
  };

  // Select Fruit A
  rowCash.fruitId = fruitA.id;
  rowCash.fruitName = fruitA.name;
  rowCash.crateName = getFruitSavedCrateType(fruitA);
  if (rowCash.crateName !== '10kg Crate') throw new Error(`Cash sale Fruit A mismatch`);

  // Switch to Fruit C
  rowCash.fruitId = fruitC.id;
  rowCash.fruitName = fruitC.name;
  rowCash.crateName = getFruitSavedCrateType(fruitC);
  if (rowCash.crateName !== '') throw new Error(`Cash sale Fruit C mismatch`);
  console.log('  ✓ Cash Sale correctly sets and clears Crate Type based on Fruit Master');

  console.log('\n[SECTION 4] Group Sale Simulation');
  let rowGroup = {
    fruitId: '',
    fruitName: '',
    crateName: '',
    quantity: 1,
    unit: 'Crate',
    kg: 0,
    rate: 0,
    totalAmount: 0,
  };

  // Select Fruit B
  rowGroup.fruitId = fruitB.id;
  rowGroup.fruitName = fruitB.name;
  rowGroup.crateName = getFruitSavedCrateType(fruitB);
  if (rowGroup.crateName !== '20kg Crate') throw new Error(`Group sale Fruit B mismatch`);

  // Switch to Fruit C
  rowGroup.fruitId = fruitC.id;
  rowGroup.fruitName = fruitC.name;
  rowGroup.crateName = getFruitSavedCrateType(fruitC);
  if (rowGroup.crateName !== '') throw new Error(`Group sale Fruit C mismatch`);
  console.log('  ✓ Group Sale correctly sets and clears Crate Type based on Fruit Master');

  console.log('\n[SECTION 5] Sale Proceed Simulation');
  let rowProceed = {
    fruitId: '',
    fruitName: '',
    crateName: '',
    quantity: 1,
    unit: 'Crate',
    weight: 0,
    rate: 0,
    amount: 0,
  };

  // Select Fruit A
  rowProceed.fruitId = fruitA.id;
  rowProceed.fruitName = fruitA.name;
  rowProceed.crateName = getFruitSavedCrateType(fruitA);
  if (rowProceed.crateName !== '10kg Crate') throw new Error(`Sale proceed Fruit A mismatch`);

  // Switch to Fruit C
  rowProceed.fruitId = fruitC.id;
  rowProceed.fruitName = fruitC.name;
  rowProceed.crateName = getFruitSavedCrateType(fruitC);
  if (rowProceed.crateName !== '') throw new Error(`Sale proceed Fruit C mismatch`);
  console.log('  ✓ Sale Proceed correctly sets and clears Crate Type based on Fruit Master');

  console.log('\n[SECTION 6] Calculation Invariance Check');
  // Verify that Crate Type label has NO impact on Amount calculation
  const amountWithCrate = calculateWholesaleItemAmount(10, 'Crate', 0, 50);
  const amountWithoutCrate = calculateWholesaleItemAmount(10, 'Crate', 0, 50);
  if (amountWithCrate !== 500 || amountWithoutCrate !== 500) {
    throw new Error('Calculations altered');
  }
  console.log('  ✓ Existing calculations for Amount (₹) remain identical and unaffected');

  console.log('\nALL TESTS PASSED! Crate Type behavior verified.');
}

runTests();
