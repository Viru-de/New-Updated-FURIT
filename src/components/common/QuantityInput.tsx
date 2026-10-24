import React, { useState, useEffect, useRef } from 'react';

export interface QuantityInputProps {
  value?: number | '' | string | null;
  onChange: (val: number | '') => void;
  min?: number;
  max?: number;
  step?: number | 'any';
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  id?: string;
  name?: string;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLInputElement>) => void;
  'aria-label'?: string;
}

/**
 * Reusable Numeric / Quantity Input component for Hari Kripa Fruit ERP.
 * 
 * Reliability guarantees:
 * - Uses type="text" with inputMode="decimal" to 100% prevent the browser from
 *   stepping or changing values when the mouse wheel is scrolled.
 * - If a user types '30', the value strictly remains '30' when scrolling the mouse wheel.
 * - Field remains focused with no blur or cursor jumping.
 * - Normal page scrolling and modal container scrolling is 100% natively preserved.
 * - Supports keyboard typing, backspace, delete, selecting, pasting, and decimals.
 * - Supports intentional keyboard ArrowUp / ArrowDown stepping.
 */
export const QuantityInput: React.FC<QuantityInputProps> = ({
  value,
  onChange,
  min = 0,
  max,
  step = 'any',
  placeholder = '0',
  disabled = false,
  required = false,
  autoFocus = false,
  className = '',
  id,
  name,
  onKeyDown,
  onBlur,
  onWheel,
  'aria-label': ariaLabel,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isFocusedRef = useRef(false);

  // Compute initial string representation
  const formatInitial = (val: number | '' | string | null | undefined): string => {
    if (val === 0 || val === '0') return '0';
    if (val === '' || val === undefined || val === null) return '';
    return String(val);
  };

  const [displayVal, setDisplayVal] = useState<string>(() => formatInitial(value));

  // Synchronize when external value changes
  useEffect(() => {
    if (isFocusedRef.current) {
      // If user is focused and typing something like "30." or "0.", don't overwrite if numbers match
      const currentNum = parseFloat(displayVal);
      const propNum = typeof value === 'number' ? value : parseFloat(String(value || ''));
      if (!isNaN(currentNum) && !isNaN(propNum) && currentNum === propNum) {
        return;
      }
    }

    setDisplayVal(formatInitial(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    if (raw === '') {
      setDisplayVal('');
      onChange('');
      return;
    }

    // Strict numeric decimal regex: optional minus (if min < 0), digits, optional single decimal dot
    const allowNegative = min === undefined || min < 0;
    const regex = allowNegative ? /^-?\d*\.?\d*$/ : /^\d*\.?\d*$/;

    if (!regex.test(raw)) {
      return; // Reject illegal characters (letters, multiple dots, etc.)
    }

    setDisplayVal(raw);

    // If incomplete number (e.g. just '-' or '.'), notify parent as empty
    if (raw === '-' || raw === '.') {
      onChange('');
      return;
    }

    const num = parseFloat(raw);
    if (!isNaN(num)) {
      if (max !== undefined && num > max) {
        return;
      }
      onChange(num);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Intentional keyboard ArrowUp / ArrowDown stepping
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseFloat(displayVal) || 0;
      const stepVal = typeof step === 'number' ? step : 1;
      const next = Math.round((current + stepVal) * 1000) / 1000;
      if (max === undefined || next <= max) {
        const nextStr = String(next);
        setDisplayVal(nextStr);
        onChange(next);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFloat(displayVal) || 0;
      const stepVal = typeof step === 'number' ? step : 1;
      const next = Math.round((current - stepVal) * 1000) / 1000;
      if (min === undefined || next >= min) {
        const nextStr = String(next);
        setDisplayVal(nextStr);
        onChange(next);
      }
    }

    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    let cleaned = displayVal.trim();
    if (cleaned === '-' || cleaned === '.') {
      cleaned = '';
    } else if (cleaned.endsWith('.')) {
      cleaned = cleaned.slice(0, -1);
    }

    if (cleaned !== displayVal) {
      setDisplayVal(cleaned);
      onChange(cleaned === '' ? '' : (parseFloat(cleaned) || 0));
    }

    if (onBlur) {
      onBlur(e);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    // With type="text", the browser never steps values on mouse-wheel.
    // Allow wheel event to bubble naturally so the page/modal scrolls.
    if (onWheel) {
      onWheel(e);
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      id={id}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      value={displayVal}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onWheel={handleWheel}
      aria-label={ariaLabel}
      className={`no-spinners font-mono font-bold text-slate-900 dark:text-white outline-none transition-colors ${className}`}
    />
  );
};
