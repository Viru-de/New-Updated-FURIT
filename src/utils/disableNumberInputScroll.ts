/**
 * disableNumberInputScroll.ts
 *
 * Reliable global protection against mouse-wheel number changes across Hari Kripa Fruit ERP.
 * 
 * Rules enforced:
 * 1. For any input[type="number"], prevents the browser from modifying values on wheel events
 *    using event.preventDefault() with non-passive event listeners.
 * 2. Works reliably across dynamically created rows, modals, and React re-renders.
 * 3. Does NOT manually forward wheel events (avoiding double scrolling and event conflicts).
 * 4. Preserves normal natural page and modal scrolling.
 */

let isInitialized = false;

export function isNumericInputElement(el: unknown): el is HTMLInputElement {
  if (!el || typeof el !== 'object') return false;
  const target = el as HTMLElement;
  if (target.tagName === 'INPUT') {
    const input = target as HTMLInputElement;
    const type = (input.type || '').toLowerCase();
    if (type === 'number') return true;
    const mode = (input.inputMode || '').toLowerCase();
    if (mode === 'decimal' || mode === 'numeric') return true;
    if (input.classList && input.classList.contains('no-spinners')) return true;
  }
  if (typeof target.closest === 'function') {
    return target.closest('input[type="number"], input.no-spinners') !== null;
  }
  return false;
}

export function forwardScroll(target: HTMLElement, deltaY: number, deltaX: number): void {
  // Legacy helper preserved for tests without interfering with natural native scrolling
  if (!target || (!deltaY && !deltaX)) return;
  const parent = target.parentElement;
  if (parent && typeof parent.scrollBy === 'function') {
    parent.scrollBy({ top: deltaY, left: deltaX });
  }
}

function handleWheel(event: WheelEvent): void {
  const target = event.target;
  const activeEl = typeof document !== 'undefined' ? document.activeElement : null;

  const targetIsNumber = target && (target as any).tagName === 'INPUT' && (target as any).type === 'number';
  const activeIsNumber = activeEl && (activeEl as any).tagName === 'INPUT' && (activeEl as any).type === 'number';

  if (targetIsNumber || (activeIsNumber && target === activeEl)) {
    if (event.cancelable) {
      event.preventDefault();
    }
  }
}

function handleFocusIn(event: FocusEvent): void {
  const target = event.target as HTMLElement | null;
  if (target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'number') {
    const input = target as HTMLInputElement;
    if (!(input as any).__wheelPreventAttached) {
      (input as any).__wheelPreventAttached = true;
      input.addEventListener(
        'wheel',
        (e: WheelEvent) => {
          if (e.cancelable) {
            e.preventDefault();
          }
        },
        { passive: false }
      );
    }
  }
}

/**
 * Initializes the global protection against mouse-wheel number changes.
 * Idempotent: safe to call multiple times without duplicate listeners.
 */
export function initDisableNumberInputScroll(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  if (!isInitialized) {
    // Non-passive capture phase listener on document
    document.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    // When inputs receive focus, attach direct non-passive listener to catch any element-level stepping
    document.addEventListener('focusin', handleFocusIn, { capture: true });

    isInitialized = true;
  }

  return () => {
    document.removeEventListener('wheel', handleWheel, { capture: true });
    document.removeEventListener('focusin', handleFocusIn, { capture: true });
    isInitialized = false;
  };
}

// Auto-initialize immediately if running in browser
if (typeof window !== 'undefined') {
  initDisableNumberInputScroll();
}
