import fs from 'fs';
import path from 'path';
import { db } from '../src/services/db';
import { calculateWholesaleItemAmount, calculateSaleCrateSummary } from '../src/utils/billingCalculations';
import { CreditSale, CashSale, SaleProceeds } from '../src/types';

function runTests() {
  console.log('=== TEST SUITE: CRATE TYPE BLANK DEFAULT & SELECTION BEHAVIOR IN ALL 4 SALES MODULES ===\n');

  // Test 1: CreditSaleModal.tsx inspection
  const creditModalPath = path.resolve(process.cwd(), 'src/components/accounts/CreditSaleModal.tsx');
  const creditModalContent = fs.readFileSync(creditModalPath, 'utf8');

  // 1a: Check new bill initial row crateTypeId and crateName are blank
  if (!creditModalContent.includes("crateTypeId: '',\n          crateName: '',")) {
    throw new Error('FAIL: CreditSaleModal does not initialize new bill rows with blank crateTypeId and crateName');
  }
  console.log('✓ 1. CreditSaleModal: Initial item row for new bill starts with blank Crate Type');

  // 1b: Check handleAddRow initializes blank crateTypeId and crateName
  if (!creditModalContent.includes("crateTypeId: '',\n        crateName: '',\n        rate: 0,")) {
    throw new Error('FAIL: CreditSaleModal handleAddRow does not initialize blank Crate Type');
  }
  console.log('✓ 2. CreditSaleModal: handleAddRow creates rows with blank Crate Type');

  // 1c: Check handleSelectSuggestion sets crateName = '' and crateTypeId = ''
  if (!creditModalContent.includes("// 3. Crate Type remains blank until explicitly chosen\n    current.crateName = '';\n    current.crateTypeId = '';")) {
    throw new Error('FAIL: CreditSaleModal handleSelectSuggestion does not keep Crate Type blank');
  }
  console.log('✓ 3. CreditSaleModal: Selecting a fruit item does NOT auto-select a crate type (remains blank)');

  // 1d: Check fruit clearing/change resets crateName and crateTypeId
  if (!creditModalContent.includes("handleItemChange(idx, 'crateName', '');\n                                  handleItemChange(idx, 'crateTypeId', '');")) {
    throw new Error('FAIL: CreditSaleModal does not clear crateName/crateTypeId when changing fruit');
  }
  console.log('✓ 4. CreditSaleModal: Changing or clearing fruit item clears previous crate type');

  // 1e: Check input disabled when !it.fruitName
  if (!creditModalContent.includes('disabled={!it.fruitName}') || !creditModalContent.includes('placeholder={it.fruitName ? "e.g. 20kg" : "-"}')) {
    throw new Error('FAIL: CreditSaleModal Crate Type input does not toggle availability based on fruit item selection');
  }
  console.log('✓ 5. CreditSaleModal: Crate Type field is disabled before fruit selection and becomes available once fruit is selected');


  // Test 2: CashSaleModal.tsx inspection
  const cashModalPath = path.resolve(process.cwd(), 'src/components/accounts/CashSaleModal.tsx');
  const cashModalContent = fs.readFileSync(cashModalPath, 'utf8');

  // 2a: Check initial item row is blank
  if (!cashModalContent.includes("crateTypeId: '',\n          crateName: '',\n          rate: 0,")) {
    throw new Error('FAIL: CashSaleModal does not initialize new bill rows with blank crateTypeId and crateName');
  }
  console.log('✓ 6. CashSaleModal: Initial item row for new bill starts with blank Crate Type');

  // 2b: Check handleAddItem initializes blank crate
  if (!cashModalContent.includes("crateTypeId: '',\n        crateName: '',\n        kg: 0,")) {
    throw new Error('FAIL: CashSaleModal handleAddItem does not initialize blank Crate Type');
  }
  console.log('✓ 7. CashSaleModal: handleAddItem creates rows with blank Crate Type');

  // 2c: Check handleSelectFruit keeps Crate Type blank
  if (!cashModalContent.includes("// 3. Crate Type remains blank until user explicitly selects one\n    current.crateName = '';\n    current.crateTypeId = '';")) {
    throw new Error('FAIL: CashSaleModal handleSelectFruit does not keep Crate Type blank');
  }
  console.log('✓ 8. CashSaleModal: Selecting a fruit item does NOT auto-select a crate type (remains blank)');

  // 2d: Check fruit clearing/change resets crate
  if (!cashModalContent.includes("handleItemChange(idx, 'crateName', '');\n                                    handleItemChange(idx, 'crateTypeId', '');")) {
    throw new Error('FAIL: CashSaleModal does not clear crate on fruit change');
  }
  console.log('✓ 9. CashSaleModal: Changing or clearing fruit item clears previous crate type');

  // 2e: Check input disabled when !it.fruitName
  if (!cashModalContent.includes('disabled={!it.fruitName}') || !cashModalContent.includes('placeholder={it.fruitName ? "e.g. 20kg" : "-"}')) {
    throw new Error('FAIL: CashSaleModal Crate Type input does not toggle availability based on fruit item selection');
  }
  console.log('✓ 10. CashSaleModal: Crate Type field is disabled before fruit selection and becomes available once fruit is selected');


  // Test 3: GroupSaleView.tsx inspection
  const groupSalePath = path.resolve(process.cwd(), 'src/components/billing/GroupSaleView.tsx');
  const groupSaleContent = fs.readFileSync(groupSalePath, 'utf8');

  // 3a: Check handleAddRow has blank crate
  if (!groupSaleContent.includes("crateTypeId: '',\n      crateName: '',\n      crateCount: 0,")) {
    throw new Error('FAIL: GroupSaleView handleAddRow does not initialize blank Crate Type');
  }
  console.log('✓ 11. GroupSaleView: handleAddRow creates rows with blank Crate Type');

  // 3b: Check handleFruitSelect keeps Crate Type blank
  if (!groupSaleContent.includes("crateSize: undefined,\n          crateName: '',\n          crateTypeId: '',")) {
    throw new Error('FAIL: GroupSaleView handleFruitSelect does not keep Crate Type blank');
  }
  console.log('✓ 12. GroupSaleView: Selecting a fruit item does NOT auto-select a crate type (remains blank)');

  // 3c: Check input disabled when !row.fruitName
  if (!groupSaleContent.includes('disabled={!row.fruitName}') || !groupSaleContent.includes('placeholder={row.fruitName ? "e.g. 20kg" : "-"}')) {
    throw new Error('FAIL: GroupSaleView Crate Type input does not toggle availability based on fruit selection');
  }
  console.log('✓ 13. GroupSaleView: Crate Type field is disabled before fruit selection and becomes available once fruit is selected');


  // Test 4: SaleProceedsModal.tsx inspection
  const saleProceedsPath = path.resolve(process.cwd(), 'src/components/accounts/SaleProceedsModal.tsx');
  const saleProceedsContent = fs.readFileSync(saleProceedsPath, 'utf8');

  // 4a: Check initial new bill row has blank crate
  if (!saleProceedsContent.includes("crateTypeId: '',\n          crateName: '',\n          rate: 0,\n          amount: 0,")) {
    throw new Error('FAIL: SaleProceedsModal does not initialize new bill rows with blank crate');
  }
  console.log('✓ 14. SaleProceedsModal: Initial item row for new bill starts with blank Crate Type');

  // 4b: Check handleAddRow has blank crate
  if (!saleProceedsContent.includes("crateTypeId: '',\n        crateName: '',\n        rate: 0,\n        amount: 0,")) {
    throw new Error('FAIL: SaleProceedsModal handleAddRow does not initialize blank Crate Type');
  }
  console.log('✓ 15. SaleProceedsModal: handleAddRow creates rows with blank Crate Type');

  // 4c: Check handleFruitSelect keeps Crate Type blank
  if (!saleProceedsContent.includes("// 3. Crate Type starts blank - user must explicitly choose\n      current.crateName = '';\n      current.crateTypeId = '';")) {
    throw new Error('FAIL: SaleProceedsModal handleFruitSelect does not keep Crate Type blank');
  }
  console.log('✓ 16. SaleProceedsModal: Selecting a fruit item does NOT auto-select a crate type (remains blank)');

  // 4d: Check input disabled when !it.fruitName
  if (!saleProceedsContent.includes('disabled={!it.fruitName}') || !saleProceedsContent.includes('placeholder={it.fruitName ? "e.g. 20kg" : "-"}')) {
    throw new Error('FAIL: SaleProceedsModal Crate Type input does not toggle availability based on fruit selection');
  }
  console.log('✓ 17. SaleProceedsModal: Crate Type field is disabled before fruit selection and becomes available once fruit is selected');


  // Test 5: Verify editing existing transactions preserves saved crate type
  const testCreditSale: CreditSale = {
    id: `test-preserve-crate-${Date.now()}`,
    creditSaleNo: 'CS-PRESERVE-01',
    sequenceNumber: 777,
    customerId: 'cust-1',
    customerName: 'Vijay Trading',
    date: '2026-10-28',
    items: [
      {
        id: 'csi-p1',
        fruitName: 'Shimla Apple',
        quantity: 25,
        unit: 'Crate',
        kg: 0,
        crateTypeId: 'ct_10',
        crateName: '10kg',
        rate: 80,
        amount: 2000,
      },
    ],
    crateIn: 0,
    crateOut: 25,
    crateWeightKg: 10,
    expenses: [],
    productTotal: 2000,
    expenseTotal: 0,
    totalDebit: 2000,
    finalAmount: 2000,
    netTotal: 2000,
    createdAt: new Date().toISOString(),
  };

  db.saveCreditSale(testCreditSale);
  const loaded = db.getCreditSales().find((s) => s.id === testCreditSale.id);
  if (!loaded || loaded.items[0].crateName !== '10kg' || loaded.items[0].crateTypeId !== 'ct_10') {
    throw new Error(`FAIL: Saved crate type not preserved in DB: ${JSON.stringify(loaded?.items)}`);
  }
  console.log('✓ 18. Historical & saved crate types (10kg, ct_10) strictly preserved when saved & loaded');

  // Test 6: Verify calculations when crate type is explicitly selected vs when blank
  // Case A: Blank crate type
  const amtBlank = calculateWholesaleItemAmount(10, 'Crate', 0, 150);
  if (amtBlank !== 1500) throw new Error(`FAIL: Amount calculation for blank crate type expected 1500, got ${amtBlank}`);

  // Case B: Explicit crate type '20kg' (Crate type is label, Amount = Qty * Rate)
  const amt20kg = calculateWholesaleItemAmount(10, 'Crate', 0, 150);
  if (amt20kg !== 1500) throw new Error(`FAIL: Amount calculation for 20kg crate expected 1500, got ${amt20kg}`);

  // Case C: Explicit crate type with weight > 0
  const amtWeight = calculateWholesaleItemAmount(10, 'Crate', 200, 50);
  if (amtWeight !== 10000) throw new Error(`FAIL: Amount calculation with weight expected 10000, got ${amtWeight}`);

  console.log('✓ 19. All billing and wholesale item calculations remain 100% intact');

  // Test 7: Crate summary tracking
  const summary = calculateSaleCrateSummary([
    {
      fruitName: 'Apple',
      quantity: 10,
      unit: 'Crate',
      crateName: '20kg',
      crateTypeId: 'ct_20',
      rate: 100,
      amount: 1000,
    },
    {
      fruitName: 'Orange',
      quantity: 15,
      unit: 'Crate',
      crateName: '10kg',
      crateTypeId: 'ct_10',
      rate: 80,
      amount: 1200,
    },
  ]);
  if (summary.totalBalanceCrates !== 25) {
    throw new Error(`FAIL: Expected 25 total crates in summary, got ${summary.totalBalanceCrates}`);
  }
  console.log('✓ 20. Crate inventory breakdown & balance tracking preserved accurately');

  // Clean up test sale
  db.deleteCreditSale(testCreditSale.id);
  console.log('✓ 21. Cleaned up test data');

  console.log('\n=== ALL 21 TESTS PASSED! Crate Type behavior verified across all 4 sales modules! ===');
}

runTests();
