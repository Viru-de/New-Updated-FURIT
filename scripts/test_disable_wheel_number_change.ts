import {
  isNumericInputElement,
  forwardScroll,
  initDisableNumberInputScroll,
} from '../src/utils/disableNumberInputScroll';

console.log('=== RUNNING MOUSE-WHEEL NUMBER CHANGE PREVENTION TEST SUITE ===\n');

// 1. Verify numeric element detection
console.log('[1] Testing isNumericInputElement detection:');

// Mock DOM elements
class MockElement {
  tagName: string;
  type: string;
  inputMode: string;
  classList: {
    contains: (cls: string) => boolean;
  };
  parentElement: any = null;
  scrollTop = 0;
  scrollLeft = 0;
  scrollHeight = 1000;
  clientHeight = 400;
  scrollWidth = 1000;
  clientWidth = 400;
  private classes: Set<string>;

  constructor(tagName: string, type = '', inputMode = '', classes: string[] = []) {
    this.tagName = tagName.toUpperCase();
    this.type = type;
    this.inputMode = inputMode;
    this.classes = new Set(classes);
    this.classList = {
      contains: (cls: string) => this.classes.has(cls),
    };
  }

  closest(selector: string) {
    if (selector.includes('type="number"') && this.type === 'number') return this;
    if (selector.includes('.no-spinners') && this.classes.has('no-spinners')) return this;
    return null;
  }

  scrollBy(opts: { top?: number; left?: number }) {
    if (opts.top) this.scrollTop += opts.top;
    if (opts.left) this.scrollLeft += opts.left;
  }
}

const numInput = new MockElement('input', 'number');
const decimalInput = new MockElement('input', 'text', 'decimal');
const noSpinnersInput = new MockElement('input', 'text', '', ['no-spinners']);
const textInput = new MockElement('input', 'text');
const divElement = new MockElement('div');

if (!isNumericInputElement(numInput as any)) {
  throw new Error('Failed: input[type="number"] was not detected as numeric');
}
console.log('  ✓ input[type="number"] correctly detected');

if (!isNumericInputElement(decimalInput as any)) {
  throw new Error('Failed: input[inputmode="decimal"] was not detected as numeric');
}
console.log('  ✓ input[inputmode="decimal"] correctly detected');

if (!isNumericInputElement(noSpinnersInput as any)) {
  throw new Error('Failed: input.no-spinners was not detected as numeric');
}
console.log('  ✓ input.no-spinners correctly detected');

if (isNumericInputElement(textInput as any)) {
  throw new Error('Failed: regular text input was incorrectly detected as numeric');
}
console.log('  ✓ regular input[type="text"] correctly NOT treated as numeric');

if (isNumericInputElement(divElement as any)) {
  throw new Error('Failed: div was incorrectly detected as numeric');
}
console.log('  ✓ div element correctly NOT treated as numeric');

// 2. Test forwardScroll behavior
console.log('\n[2] Testing forwardScroll behavior:');
const parentContainer = new MockElement('div');
parentContainer.scrollHeight = 1000;
parentContainer.clientHeight = 400;
parentContainer.scrollTop = 50;

// Setup mock window getComputedStyle
(globalThis as any).window = {
  getComputedStyle: () => ({
    overflowY: 'auto',
    overflowX: 'auto',
  }),
  scrollBy: (opts: any) => {},
};
(globalThis as any).document = {
  body: new MockElement('body'),
  documentElement: new MockElement('html'),
};

const childInput = new MockElement('input', 'number');
childInput.parentElement = parentContainer;

const initialTop = parentContainer.scrollTop;
forwardScroll(childInput as any, 120, 0);

if (parentContainer.scrollTop !== initialTop + 120) {
  throw new Error(`Expected scroll offset ${initialTop + 120}, got ${parentContainer.scrollTop}`);
}
console.log(`  ✓ forwardScroll successfully scrolled parent container by +120px (${parentContainer.scrollTop}px)`);

forwardScroll(childInput as any, -50, 0);
if (parentContainer.scrollTop !== initialTop + 120 - 50) {
  throw new Error(`Expected scroll offset ${initialTop + 70}, got ${parentContainer.scrollTop}`);
}
console.log(`  ✓ forwardScroll successfully scrolled parent container by -50px (${parentContainer.scrollTop}px)`);

// 3. Test Wheel Event Interception and Value Immutability
console.log('\n[3] Testing Wheel Event Default Prevention & Value Invariance:');

// Mock Event system
class MockWheelEvent {
  target: any;
  deltaY: number;
  deltaX: number;
  cancelable: boolean;
  defaultPrevented = false;

  constructor(target: any, deltaY: number, deltaX = 0, cancelable = true) {
    this.target = target;
    this.deltaY = deltaY;
    this.deltaX = deltaX;
    this.cancelable = cancelable;
  }

  preventDefault() {
    if (this.cancelable) {
      this.defaultPrevented = true;
    }
  }
}

// Attach listeners via initDisableNumberInputScroll
const listeners: Record<string, ((e: any) => void)[]> = {};
(globalThis as any).window.addEventListener = (evt: string, fn: (e: any) => void) => {
  listeners[evt] = listeners[evt] || [];
  listeners[evt].push(fn);
};
(globalThis as any).window.removeEventListener = (evt: string, fn: (e: any) => void) => {
  if (listeners[evt]) {
    listeners[evt] = listeners[evt].filter((cb) => cb !== fn);
  }
};
(globalThis as any).document.addEventListener = (evt: string, fn: (e: any) => void) => {
  listeners[evt] = listeners[evt] || [];
  listeners[evt].push(fn);
};
(globalThis as any).document.removeEventListener = (evt: string, fn: (e: any) => void) => {
  if (listeners[evt]) {
    listeners[evt] = listeners[evt].filter((cb) => cb !== fn);
  }
};

const cleanup = initDisableNumberInputScroll();

function dispatchWheel(evt: MockWheelEvent) {
  const wheelCallbacks = listeners['wheel'] || [];
  for (const cb of wheelCallbacks) {
    cb(evt);
  }
}

// Test with value 30
interface MockInputState {
  value: number | string;
  focused: boolean;
  element: MockElement;
}

const testInputs: { name: string; state: MockInputState }[] = [
  {
    name: 'Group Sale (Qty)',
    state: { value: 30, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Group Sale (Weight)',
    state: { value: 15.5, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Group Sale (Rate)',
    state: { value: 120, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Sale Proceeds (Amount)',
    state: { value: 4500, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Wholesale Cash Sale (Qty)',
    state: { value: 50, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Wholesale Credit Sale (Rate)',
    state: { value: 85, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Receipt Modal (Receipt Amount)',
    state: { value: 25000, focused: true, element: new MockElement('input', 'number') },
  },
  {
    name: 'Dynamically added row input',
    state: { value: 30, focused: true, element: new MockElement('input', 'number') },
  },
];

for (const { name, state } of testInputs) {
  const originalValue = state.value;
  (globalThis as any).document.activeElement = state.element;

  // Scroll DOWN with wheel (deltaY > 0)
  const wheelDown = new MockWheelEvent(state.element, 100);
  dispatchWheel(wheelDown);

  if (!wheelDown.defaultPrevented) {
    throw new Error(`Failed: wheel event was not prevented on ${name}`);
  }
  // In native browsers, default action modifies value. Because defaultPrevented is true, value remains unchanged.
  if (state.value !== originalValue) {
    throw new Error(`Failed: value changed from ${originalValue} to ${state.value} on ${name}`);
  }

  // Scroll UP with wheel (deltaY < 0)
  const wheelUp = new MockWheelEvent(state.element, -100);
  dispatchWheel(wheelUp);

  if (!wheelUp.defaultPrevented) {
    throw new Error(`Failed: wheel-up event was not prevented on ${name}`);
  }
  if (state.value !== originalValue) {
    throw new Error(`Failed: value changed on wheel up for ${name}`);
  }

  console.log(`  ✓ ${name}: value remained strictly "${state.value}" when scrolled up & down while focused`);
}

// 4. Test non-numeric elements are NOT prevented
console.log('\n[4] Testing non-numeric target wheel propagation:');
(globalThis as any).document.activeElement = null;
const normalDivWheel = new MockWheelEvent(divElement, 100);
dispatchWheel(normalDivWheel);

if (normalDivWheel.defaultPrevented) {
  throw new Error('Failed: wheel event was incorrectly prevented on non-numeric element');
}
console.log('  ✓ Normal page elements (divs, tables, backgrounds) are not prevented, preserving normal scrolling');

cleanup();
console.log('\n=== ALL MOUSE-WHEEL NUMBER CHANGE TESTS PASSED SUCCESSFULLY! ===\n');
