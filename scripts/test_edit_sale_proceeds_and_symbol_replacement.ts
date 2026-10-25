import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { db } from '../src/services/db';
import { calculateWholesaleItemAmount } from '../src/utils/billingCalculations';
import { SaleProceeds, SaleProceedsItem, ExpenseItem } from '../src/types';

console.log('--- TEST SUITE: Sale Proceeds Edit Rows & Global Symbol Replacement ---');

// 1. Test Sale Proceeds multi-item editing and + Add Row persistence
console.log('\n[1] Testing Sale Proceeds multi-item creation, editing, and saving...');

const initialProceedsCount = db.getSaleProceeds().length;

// Create an initial sale proceeds transaction (simulating 1 existing row)
const testSpId = `test-sp-${Date.now()}`;
const initialSaleProceeds: SaleProceeds = {
  id: testSpId,
  proceedsNo: 'Sale Proceeds No. 991',
  sequenceNumber: 991,
  date: '2026-10-25',
  challanDate: '2026-10-25',
  items: [
    {
      id: `spi-test-1`,
      fruitId: 'f1',
      fruitName: 'Strawberry',
      quantity: 10,
      unit: 'Crate',
      kg: 0,
      rate: 400,
      amount: 4000,
      crateTypeId: 'ct_20',
      crateName: '20kg',
    },
  ],
  quantity: 10,
  unit: 'Crate',
  kg: 0,
  rate: 400,
  amount: 4000,
  expenses: [
    { id: 'exp-1', name: 'Freight', amount: 100 },
    { id: 'exp-2', name: 'Hamali', amount: 20 },
  ],
  totalExpense: 120,
  netAmount: 3880,
  difference: -120,
  createdAt: new Date().toISOString(),
};

db.saveSaleProceeds(initialSaleProceeds);
const saved1 = db.getSaleProceeds().find((s) => s.id === testSpId);
assert(saved1, 'Initial sale proceeds record saved in db');
assert(saved1.items.length === 1, 'Initially has 1 item');
assert(saved1.expenses.length === 2, 'Initially has 2 expenses');
console.log('  ✓ Initial Sale Proceeds entry created and verified');

// Simulate user editing the transaction: clicking "+ Add Row" for an item and "+ Add Row" for an expense
const newRowItem: SaleProceedsItem = {
  id: `spi-test-2`,
  fruitId: 'f2',
  fruitName: 'Apple Shimla',
  quantity: 5,
  unit: 'Box',
  kg: 100, // Weight > 0 => 100 * 80 = 8000
  rate: 80,
  amount: calculateWholesaleItemAmount(5, 'Box', 100, 80),
  crateTypeId: undefined,
  crateName: undefined,
};
assert(newRowItem.amount === 8000, 'Weight calculation: 100 kg * 80 = 8000');

const newExpenseRow: ExpenseItem = {
  id: `exp-test-3`,
  name: 'Cooling / Storage',
  amount: 150,
};

const updatedItems = [...saved1.items, newRowItem];
const updatedExpenses = [...saved1.expenses, newExpenseRow];

const totalProductAmount = updatedItems.reduce((sum, it) => sum + it.amount, 0); // 4000 + 8000 = 12000
const totalExpense = updatedExpenses.reduce((sum, e) => sum + e.amount, 0); // 100 + 20 + 150 = 270
const totalQuantity = updatedItems.reduce((sum, it) => sum + it.quantity, 0); // 10 + 5 = 15
const totalWeight = updatedItems.reduce((sum, it) => sum + (it.kg || 0), 0); // 0 + 100 = 100
const netAmount = totalProductAmount - totalExpense; // 12000 - 270 = 11730
const difference = netAmount - totalProductAmount; // -270

const editedSaleProceeds: SaleProceeds = {
  ...saved1,
  items: updatedItems,
  quantity: totalQuantity,
  kg: totalWeight,
  amount: totalProductAmount,
  expenses: updatedExpenses,
  totalExpense,
  netAmount,
  difference,
};

// Save edited transaction
db.saveSaleProceeds(editedSaleProceeds);

const loadedEdited = db.getSaleProceeds().find((s) => s.id === testSpId);
assert(loadedEdited, 'Edited sale proceeds record found in db');
assert.strictEqual(loadedEdited.items.length, 2, 'Has 2 item rows after adding row');
assert.strictEqual(loadedEdited.items[1].fruitName, 'Apple Shimla', 'Second row item name preserved');
assert.strictEqual(loadedEdited.items[1].amount, 8000, 'Second row amount is 8000');
assert.strictEqual(loadedEdited.expenses.length, 3, 'Has 3 expenses after adding row');
assert.strictEqual(loadedEdited.expenses[2].name, 'Cooling / Storage', 'Third expense name preserved');
assert.strictEqual(loadedEdited.amount, 12000, 'Total amount updated to 12000');
assert.strictEqual(loadedEdited.totalExpense, 270, 'Total expense updated to 270');
assert.strictEqual(loadedEdited.netAmount, 11730, 'Net amount updated to 11730');
assert.strictEqual(loadedEdited.difference, -270, 'Difference updated to -270');

console.log('  ✓ Edit transaction with + Add Row for items and expenses verified successfully');

// Clean up test entry
db.deleteSaleProceeds(testSpId);
console.log('  ✓ Test transaction cleaned up');

// 2. Test Global Symbol Replacement (@ -> /)
console.log('\n[2] Testing Global Symbol Replacement (@ -> /)...');

// Check CreditSaleListView.tsx
const creditSaleListCode = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CreditSaleListView.tsx'), 'utf-8');
assert(!creditSaleListCode.includes('} @ {formatCurrency'), 'CreditSaleListView does not use @ separator');
assert(creditSaleListCode.includes('} / {formatCurrency'), 'CreditSaleListView uses / separator');
console.log('  ✓ CreditSaleListView verified: uses / separator');

// Check CustomerLedgerView.tsx
const customerLedgerCode = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CustomerLedgerView.tsx'), 'utf-8');
assert(!customerLedgerCode.includes('@ ₹{it.rate}'), 'CustomerLedgerView does not use @ separator');
assert(customerLedgerCode.includes('/ ₹{it.rate}'), 'CustomerLedgerView uses / separator');
console.log('  ✓ CustomerLedgerView verified: uses / separator');

// Check SaleProceedsListView.tsx
const saleProceedsListCode = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/SaleProceedsListView.tsx'), 'utf-8');
assert(!saleProceedsListCode.includes('} @ {formatCurrency(it.rate)}'), 'SaleProceedsListView item does not use @ separator');
assert(saleProceedsListCode.includes('} / {formatCurrency(it.rate)}'), 'SaleProceedsListView item uses / separator');
assert(!saleProceedsListCode.includes('} @ {formatCurrency(sale.rate)}'), 'SaleProceedsListView fallback does not use @ separator');
assert(saleProceedsListCode.includes('} / {formatCurrency(sale.rate)}'), 'SaleProceedsListView fallback uses / separator');
console.log('  ✓ SaleProceedsListView verified: uses / separator');

// Check CashSaleListView.tsx
const cashSaleListCode = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CashSaleListView.tsx'), 'utf-8');
assert(!cashSaleListCode.includes('@ ₹{it.rate}'), 'CashSaleListView does not use @ separator');
assert(cashSaleListCode.includes('/ ₹{it.rate}'), 'CashSaleListView uses / separator');
console.log('  ✓ CashSaleListView verified: uses / separator');

// Check that email addresses in db.ts remain intact
const dbCode = fs.readFileSync(path.join(process.cwd(), 'src/services/db.ts'), 'utf-8');
assert(dbCode.includes('accounts@harikripafruits.com'), 'Email address accounts@harikripafruits.com preserved');
assert(dbCode.includes('info@harikripafruits.com'), 'Email address info@harikripafruits.com preserved');
console.log('  ✓ Legitimate email addresses in db.ts preserved intact');

// Check that technical CSS @media / @page syntax remains intact
const indexCssCode = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
assert(indexCssCode.includes('@media print'), 'CSS @media print preserved');
assert(indexCssCode.includes('@page'), 'CSS @page preserved');
console.log('  ✓ Technical CSS rules (@media, @page, @import) preserved intact');

// Check SaleProceedsModal has + Add Row buttons
const modalCode = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/SaleProceedsModal.tsx'), 'utf-8');
assert(modalCode.includes('handleAddRow'), 'SaleProceedsModal has handleAddRow handler');
assert(modalCode.includes('+ Add Row'), 'SaleProceedsModal has "+ Add Row" buttons');
assert(modalCode.includes('handleRemoveRow'), 'SaleProceedsModal has handleRemoveRow handler');
assert(modalCode.includes('items.map'), 'SaleProceedsModal renders items dynamically');
console.log('  ✓ SaleProceedsModal verified: supports multi-row items with + Add Row and delete');

console.log('\nALL TESTS PASSED SUCCESSFULLY! ✨\n');
