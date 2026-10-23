import React from 'react';

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
  'aria-label'?: string;
}

/**
 * Reusable Quantity Input component for Hari Kripa Fruit ERP.
 * - Suppresses browser up/down spinner arrows completely.
 * - Allows direct, unobstructed keyboard typing and editing.
 * - Supports decimals/fractional quantities without unwanted rounding.
 * - Keeps empty string behavior when cleared.
 * - Clean responsive styling matching light and dark modes.
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
  'aria-label': ariaLabel,
}) => {
  const displayVal =
    value === 0 || value === '0'
      ? (value === 0 ? 0 : '0')
      : value === '' || value === undefined || value === null
      ? ''
      : value;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange('');
      return;
    }
    const num = Number(raw);
    if (!isNaN(num)) {
      onChange(num);
    }
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      id={id}
      name={name}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      value={displayVal}
      onChange={handleChange}
      onKeyDown={onKeyDown}
      onBlur={onBlur}
      aria-label={ariaLabel}
      className={`no-spinners font-mono font-bold text-slate-900 dark:text-white outline-none transition-colors ${className}`}
    />
  );
};
