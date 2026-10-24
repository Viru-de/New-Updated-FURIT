import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Unit } from '../../types';
import { db } from '../../services/db';
import { Scale, Check, ChevronDown } from 'lucide-react';

interface UnitAutocompleteProps {
  valueUnit: string;
  onChange: (unitSymbol: string) => void;
  onEnterNext?: () => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
}

export const UnitAutocomplete: React.FC<UnitAutocompleteProps> = ({
  valueUnit,
  onChange,
  onEnterNext,
  placeholder = 'Unit...',
  hasError = false,
  disabled = false,
  className = '',
}) => {
  const units = db.getUnits();
  const [searchTerm, setSearchTerm] = useState(valueUnit || '');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isUserInputActiveRef = useRef(false);

  // Position state for portal dropdown
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openAbove: boolean;
  }>({ top: 0, left: 0, width: 140, openAbove: false });

  useEffect(() => {
    if (!isUserInputActiveRef.current) {
      setSearchTerm(valueUnit || '');
    }
  }, [valueUnit]);

  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 220;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    const calculatedTop = openAbove
      ? Math.max(8, rect.top - dropdownHeight - 4)
      : rect.bottom + 4;

    const targetWidth = Math.max(rect.width, 140);
    let calculatedLeft = rect.left;
    if (calculatedLeft + targetWidth > window.innerWidth - 8) {
      calculatedLeft = Math.max(8, window.innerWidth - targetWidth - 8);
    }

    setCoords({
      top: calculatedTop,
      left: calculatedLeft,
      width: targetWidth,
      openAbove,
    });
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      const handleScrollOrResize = () => {
        updateCoords();
      };
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  const query = searchTerm.trim().toLowerCase();
  const matchingUnits = useMemo(() => {
    if (!query) return units;

    const scored = units
      .map((u) => {
        const sym = u.symbol.toLowerCase();
        const nm = u.name.toLowerCase();
        if (sym === query || nm === query) return { unit: u, score: 0 };
        if (sym.startsWith(query) || nm.startsWith(query)) return { unit: u, score: 1 };
        if (sym.includes(query) || nm.includes(query)) return { unit: u, score: 2 };
        return null;
      })
      .filter((item): item is { unit: Unit; score: number } => item !== null);

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.unit.symbol.localeCompare(b.unit.symbol);
    });

    return scored.map((s) => s.unit);
  }, [units, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
        isUserInputActiveRef.current = false;
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
    isUserInputActiveRef.current = false;
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
      isUserInputActiveRef.current = false;
      setSearchTerm(valueUnit || '');
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            updateCoords();
            setIsOpen(true);
          }}
          onChange={(e) => {
            const val = e.target.value;
            isUserInputActiveRef.current = true;
            setSearchTerm(val);
            updateCoords();
            setIsOpen(true);
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
          className={`w-full rounded-lg px-2 py-1.5 pr-6 text-xs font-bold text-center text-slate-800 dark:text-white outline-none border transition-colors ${
            hasError
              ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/20 text-rose-900'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500'
          }`}
        />
        <button
          type="button"
          onClick={() => {
            updateCoords();
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }}
          className="absolute right-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5 cursor-pointer"
          title="Select unit"
        >
          <ChevronDown className="h-3 w-3" />
        </button>
      </div>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 99999,
            }}
            className="max-h-56 overflow-y-auto p-1 text-xs shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            {matchingUnits.length === 0 ? (
              <div className="p-2 text-center text-slate-400">
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
                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold">{u.symbol}</span>
                      <span
                        className={`text-[10px] ${
                          isHighlighted ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        ({u.name})
                      </span>
                    </div>
                    {isSelected && (
                      <Check
                        className={`h-3.5 w-3.5 ${
                          isHighlighted ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                        }`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
};
