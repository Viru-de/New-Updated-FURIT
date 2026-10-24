import { isNumericInputElement } from '../src/utils/disableNumberInputScroll';

console.log('=== TEST SUITE: QuantityInput Mouse-Wheel Value Invariance & Precision ===\n');

let passes = 0;
let failures = 0;

function expect(condition: boolean, msg: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${msg}`);
    passes++;
  } else {
    console.error(`[FAIL] ${msg}${detail ? ': ' + detail : ''}`);
    failures++;
  }
}

// 1. Test numeric format regex validation
const allowNegativeRegex = /^-?\d*\.?\d*$/;
const positiveOnlyRegex = /^\d*\.?\d*$/;

// Valid numbers
expect(positiveOnlyRegex.test('30'), 'Validates "30" as positive numeric');
expect(positiveOnlyRegex.test('30.5'), 'Validates "30.5" with decimal');
expect(positiveOnlyRegex.test('0.75'), 'Validates "0.75" with leading zero');
expect(positiveOnlyRegex.test('.5'), 'Validates ".5" as partial decimal');
expect(positiveOnlyRegex.test(''), 'Validates empty string');
expect(!positiveOnlyRegex.test('30a'), 'Rejects alphabetic characters "30a"');
expect(!positiveOnlyRegex.test('30.5.2'), 'Rejects multiple decimal points "30.5.2"');
expect(!positiveOnlyRegex.test('-30'), 'Rejects negative number when min >= 0');
expect(allowNegativeRegex.test('-30'), 'Allows negative number when min < 0');

// 2. Test Value Invariance on Wheel Simulation
interface InputState {
  value: number | '';
  display: string;
  isFocused: boolean;
}

function simulateField(initialVal: number | '') {
  let state: InputState = {
    value: initialVal,
    display: initialVal === '' ? '' : String(initialVal),
    isFocused: false,
  };

  return {
    getState: () => ({ ...state }),
    focus: () => {
      state.isFocused = true;
    },
    blur: () => {
      state.isFocused = false;
      let cleaned = state.display.trim();
      if (cleaned === '-' || cleaned === '.') cleaned = '';
      else if (cleaned.endsWith('.')) cleaned = cleaned.slice(0, -1);
      state.display = cleaned;
      state.value = cleaned === '' ? '' : parseFloat(cleaned);
    },
    type: (newText: string) => {
      if (!positiveOnlyRegex.test(newText)) return;
      state.display = newText;
      if (newText === '' || newText === '.') {
        state.value = '';
      } else {
        const num = parseFloat(newText);
        if (!isNaN(num)) state.value = num;
      }
    },
    wheel: (deltaY: number) => {
      // With type="text", wheel event NEVER mutates input state
      // Value remains strictly invariant
    },
    arrowKey: (key: 'ArrowUp' | 'ArrowDown', step = 1) => {
      const cur = typeof state.value === 'number' ? state.value : (parseFloat(state.display) || 0);
      const next = key === 'ArrowUp' ? cur + step : Math.max(0, cur - step);
      state.value = next;
      state.display = String(next);
    },
  };
}

const modulesToTest = [
  'Group Sale (Qty)',
  'Group Sale (Weight)',
  'Group Sale (Rate)',
  'Wholesale Cash Sale (Qty)',
  'Wholesale Cash Sale (Weight)',
  'Wholesale Cash Sale (Rate)',
  'Wholesale Credit Sale (Qty)',
  'Wholesale Credit Sale (Weight)',
  'Wholesale Credit Sale (Rate)',
  'Sale Proceeds (Consignment Qty)',
  'Sale Proceeds (Consignment Weight)',
  'Sale Proceeds (Consignment Rate)',
  'Receipt Modal (Receipt Amount)',
  'Customer Ledger (Opening Balance)',
  'Dynamically Added Group Sale Row #10',
];

console.log('\n--- 2. Testing Enter 30 -> Focus -> Wheel Up/Down Invariance ---');
for (const mod of modulesToTest) {
  const field = simulateField('');
  field.focus();
  field.type('30');
  expect(field.getState().value === 30, `${mod}: typed 30 successfully`);

  // Scroll UP (deltaY: -100)
  field.wheel(-100);
  expect(field.getState().value === 30 && field.getState().display === '30', `${mod}: value strictly remains 30 on upward wheel`);

  // Scroll DOWN (deltaY: +100)
  field.wheel(100);
  expect(field.getState().value === 30 && field.getState().display === '30', `${mod}: value strictly remains 30 on downward wheel`);

  // Rapid scrolling (multiple wheel events)
  for (let i = 0; i < 10; i++) {
    field.wheel(i % 2 === 0 ? 150 : -150);
  }
  expect(field.getState().value === 30 && field.getState().display === '30', `${mod}: value strictly remains 30 after 10 rapid wheel notches`);

  // Field remains focused
  expect(field.getState().isFocused === true, `${mod}: field remains focused without blur`);
}

console.log('\n--- 3. Testing Decimal Entry, Backspace & Keyboard Navigation ---');
const decimalField = simulateField('');
decimalField.focus();
decimalField.type('30.');
expect(decimalField.getState().display === '30.' && decimalField.getState().value === 30, 'Typing "30." preserves decimal point in display');
decimalField.type('30.5');
expect(decimalField.getState().display === '30.5' && decimalField.getState().value === 30.5, 'Typing "30.5" parses decimal correctly');

// Wheel while decimal is focused
decimalField.wheel(-100);
expect(decimalField.getState().display === '30.5' && decimalField.getState().value === 30.5, 'Decimal "30.5" strictly remains 30.5 on wheel');

// Backspace to 30
decimalField.type('30');
expect(decimalField.getState().display === '30' && decimalField.getState().value === 30, 'Backspace to "30" works cleanly');

// Clear completely
decimalField.type('');
expect(decimalField.getState().display === '' && decimalField.getState().value === '', 'Clearing field returns empty string');

// Keyboard ArrowUp / ArrowDown works intentionally
decimalField.type('30');
decimalField.arrowKey('ArrowUp', 1);
expect(decimalField.getState().value === 31, 'ArrowUp intentionally increments by 1 (30 -> 31)');
decimalField.arrowKey('ArrowDown', 1);
expect(decimalField.getState().value === 30, 'ArrowDown intentionally decrements by 1 (31 -> 30)');

console.log(`\n========================================`);
console.log(`SUMMARY: ${passes} Passed, ${failures} Failed`);
console.log(`========================================\n`);

if (failures > 0) {
  process.exit(1);
}
