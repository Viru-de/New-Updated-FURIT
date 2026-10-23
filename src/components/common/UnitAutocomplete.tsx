import React, { useState, useEffect, useRef } from 'react';
import { Unit } from '../../types';
import { db } from '../../services/db';
import { Scale, Check } from 'lucide-react';

interface UnitAutocompleteProps {
  valueUnit: string;
  onChange: (unitSymbol: string) => void;
  onEnterNext?: () => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
}

export const UnitAutocomplete: React.FC<UnitAutocompleteProps> = ({
  valueUnit,
  onChange,
  onEnterNext,
  placeholder = 'Unit...',
  hasError = false,
  disabled = false,
}) => {
  const units = db.getUnits();
  const selectedUnit = units.find(
    (u) =>
      u.symbol.toLowerCase() === (valueUnit || '').toLowerCase() ||
      u.name.toLowerCase() === (valueUnit || '').toLowerCase()
  ) || null;

  const [searchTerm, setSearchTerm] = useState(valueUnit || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchTerm(valueUnit || '');
  }, [valueUnit]);

  const query = searchTerm.trim().toLowerCase();
  const matchingUnits = query
    ? units.filter(
        (u) =>
          u.symbol.toLowerCase().includes(query) ||
          u.name.toLowerCase().includes(query)
      )
    : units;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        // If user typed something that didn't match or wasn't selected, revert to current valueUnit
        if (valueUnit) {
          setSearchTerm(valueUnit);
        } else {
          setSearchTerm('');
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [valueUnit]);

  const handleSelect = (unit: Unit) => {
    setSearchTerm(unit.symbol);
    onChange(unit.symbol);
    setIsOpen(false);
    if (onEnterNext) {
      setTimeout(() => onEnterNext(), 30);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        setHighlightedIndex((prev) =>
          prev < matchingUnits.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && matchingUnits.length > 0) {
        e.preventDefault();
        const picked = matchingUnits[highlightedIndex] || matchingUnits[0];
        if (picked) {
          handleSelect(picked);
        }
      } else if (!isOpen && onEnterNext) {
        onEnterNext();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (valueUnit) setSearchTerm(valueUnit);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            const val = e.target.value;
            setSearchTerm(val);
            setIsOpen(true);
            // If user types exact match of a symbol or name, allow direct update
            const exactMatch = units.find(
              (u) =>
                u.symbol.toLowerCase() === val.trim().toLowerCase() ||
                u.name.toLowerCase() === val.trim().toLowerCase()
            );
            if (exactMatch) {
              onChange(exactMatch.symbol);
            }
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg px-2.5 py-2 text-xs font-semibold text-slate-800 outline-none transition-all placeholder:text-slate-400 ${
            hasError
              ? 'border border-rose-500 bg-rose-50/50 text-rose-900 shadow-inner'
              : 'neu-inset'
          }`}
        />
      </div>

      {isOpen && (
        <div className="neu-dropdown absolute left-0 top-full z-50 mt-1 max-h-56 w-full min-w-[150px] overflow-y-auto p-1 text-xs animate-in fade-in slide-in-from-top-1 duration-150 shadow-lg bg-white border border-slate-200 rounded-lg">
          {matchingUnits.length === 0 ? (
            <div className="p-2.5 text-center text-slate-400">
              <Scale className="mx-auto h-4 w-4 mb-1 opacity-50 text-slate-400" />
              <span className="text-[11px]">No unit found</span>
            </div>
          ) : (
            matchingUnits.map((u, idx) => {
              const isSelected =
                u.symbol.toLowerCase() === (valueUnit || '').toLowerCase();
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={u.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleSelect(u);
                  }}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`flex cursor-pointer items-center justify-between px-2.5 py-1.5 rounded-md transition-colors ${
                    isHighlighted
                      ? 'bg-blue-600 text-white'
                      : isSelected
                      ? 'bg-blue-50 text-blue-900 font-bold'
                      : 'text-slate-700 hover:bg-slate-100/70'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-bold">{u.symbol}</span>
                    <span
                      className={`text-[10px] truncate ${
                        isHighlighted ? 'text-blue-100' : 'text-slate-400'
                      }`}
                    >
                      ({u.name})
                    </span>
                  </div>
                  {isSelected && (
                    <Check
                      className={`h-3 w-3 shrink-0 ml-1 ${
                        isHighlighted ? 'text-white' : 'text-blue-600'
                      }`}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
