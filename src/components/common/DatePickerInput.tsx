import React, { useRef } from 'react';
import { Calendar } from 'lucide-react';
import { formatDate, toIsoDate, getTodayIso } from '../../utils/formatters';

interface DatePickerInputProps {
  value: string; // Accepts YYYY-MM-DD or DD-MM-YYYY
  onChange: (isoDate: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
  disabled?: boolean;
}

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  value,
  onChange,
  label,
  required = false,
  className = '',
  disabled = false,
}) => {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const isoValue = toIsoDate(value) || getTodayIso();
  const displayValue = formatDate(isoValue);

  const handleDisplayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    // If user enters DD-MM-YYYY format
    if (/^\d{2}-\d{2}-\d{4}$/.test(text)) {
      onChange(toIsoDate(text));
    }
  };

  const handleCalendarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChange(e.target.value);
    }
  };

  const triggerCalendar = () => {
    if (hiddenInputRef.current && !disabled) {
      try {
        if ('showPicker' in HTMLInputElement.prototype) {
          hiddenInputRef.current.showPicker();
        } else {
          hiddenInputRef.current.focus();
        }
      } catch {
        hiddenInputRef.current.focus();
      }
    }
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          value={displayValue}
          placeholder="DD-MM-YYYY"
          onChange={handleDisplayChange}
          disabled={disabled}
          className="neu-inset w-full px-3.5 py-2 text-sm font-mono-numbers text-slate-900 outline-none transition-all focus:ring-2 focus:ring-blue-500/40 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={triggerCalendar}
          disabled={disabled}
          title="Open Calendar Picker (Select any date)"
          className="absolute right-2 rounded-lg p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white/60 transition-colors"
        >
          <Calendar className="h-4 w-4" />
        </button>
        {/* Hidden native date input to trigger browser calendar */}
        <input
          ref={hiddenInputRef}
          type="date"
          value={isoValue}
          onChange={handleCalendarChange}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-0"
        />
      </div>
    </div>
  );
};
