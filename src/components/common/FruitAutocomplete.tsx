import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Fruit } from '../../types';
import { db } from '../../services/db';
import { getFruitEffectivePrice } from '../../utils/fruitUtils';
import { FruitBadge } from './FruitIconHelper';
import { Apple, Search, Check } from 'lucide-react';

interface FruitAutocompleteProps {
  valueFruitId?: string;
  valueFruitName?: string;
  onChange: (fruit: Fruit | null, customName?: string) => void;
  onEnterNext?: () => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

export const FruitAutocomplete: React.FC<FruitAutocompleteProps> = ({
  valueFruitId = '',
  valueFruitName = '',
  onChange,
  onEnterNext,
  placeholder = 'Search fruit / item name...',
  hasError = false,
  disabled = false,
  className = '',
  compact = false,
}) => {
  // Dynamically load fruits from Fruit/Item Master
  const fruits = db.getFruits();
  const selectedFruit =
    fruits.find(
      (f) =>
        (valueFruitId && f.id === valueFruitId) ||
        (valueFruitName && f.name.toLowerCase() === valueFruitName.toLowerCase())
    ) || null;

  const [searchTerm, setSearchTerm] = useState(
    valueFruitName || (selectedFruit ? selectedFruit.name : '')
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Position state for portal dropdown
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openAbove: boolean;
  }>({ top: 0, left: 0, width: 280, openAbove: false });

  // Sync internal search input if external value changes
  useEffect(() => {
    if (valueFruitName) {
      setSearchTerm(valueFruitName);
    } else if (selectedFruit) {
      setSearchTerm(selectedFruit.name);
    } else if (!valueFruitId && !valueFruitName) {
      setSearchTerm('');
    }
  }, [valueFruitId, valueFruitName, selectedFruit]);

  // Recalculate dropdown positioning relative to viewport
  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 250;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < 220 && spaceAbove > spaceBelow;

    const calculatedTop = openAbove
      ? Math.max(8, rect.top - dropdownHeight - 4)
      : rect.bottom + 4;

    const targetWidth = Math.max(rect.width, 280);
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
      // capture: true ensures scrolling in parent modals/tables dynamically moves the dropdown
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Case-insensitive partial matching across fruit name, category, or ID
  const query = searchTerm.trim().toLowerCase();
  const matchingFruits = query
    ? fruits.filter(
        (f) =>
          f.name.toLowerCase().includes(query) ||
          (f.category ? f.category.toLowerCase().includes(query) : false) ||
          f.id.toLowerCase().includes(query)
      )
    : fruits;

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Close dropdown on outside click
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
        if (selectedFruit) {
          setSearchTerm(selectedFruit.name);
        } else if (valueFruitName) {
          setSearchTerm(valueFruitName);
        } else if (searchTerm.trim()) {
          onChange(null, searchTerm.trim());
        } else {
          setSearchTerm('');
          onChange(null, '');
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedFruit, valueFruitName, searchTerm, onChange]);

  const handleSelect = (fruit: Fruit) => {
    setSearchTerm(fruit.name);
    onChange(fruit, fruit.name);
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
          prev < matchingFruits.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && matchingFruits.length > 0) {
        e.preventDefault();
        const picked = matchingFruits[highlightedIndex] || matchingFruits[0];
        if (picked) {
          handleSelect(picked);
        }
      } else if (!isOpen && onEnterNext) {
        onEnterNext();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedFruit) {
        setSearchTerm(selectedFruit.name);
      } else {
        setSearchTerm(valueFruitName || '');
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        {/* Left icon: fruit badge or search icon */}
        <div className="absolute left-2.5 z-10 pointer-events-none flex items-center">
          {selectedFruit ? (
            <FruitBadge
              fruitIcon={selectedFruit.fruitIcon}
              fruitName={selectedFruit.name}
              size="xs"
            />
          ) : (
            <Search className="h-4 w-4 text-slate-400" />
          )}
        </div>

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
            setSearchTerm(val);
            updateCoords();
            setIsOpen(true);
            const exactMatch = fruits.find((f) => f.name.toLowerCase() === val.trim().toLowerCase());
            onChange(exactMatch || null, val);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 border ${
            hasError
              ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500'
          }`}
        />

        {/* Right side search indicator or check */}
        {selectedFruit ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-emerald-600 dark:text-emerald-400 pointer-events-none">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button
            type="button"
            onClick={() => {
              updateCoords();
              setIsOpen(true);
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Search fruit items"
          >
            <Search className="h-3 w-3" />
          </button>
        )}
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
            className="max-h-60 overflow-y-auto p-1 text-xs shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {matchingFruits.length === 0 ? (
              <div className="p-3 text-center text-slate-400 dark:text-slate-500">
                <Apple className="mx-auto h-5 w-5 mb-1 opacity-50 text-slate-400 dark:text-slate-500" />
                <span>No matching items found</span>
              </div>
            ) : (
              matchingFruits.map((fruit, idx) => {
                const isSelected = selectedFruit?.id === fruit.id;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={fruit.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(fruit);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex cursor-pointer items-center justify-between px-2.5 py-1.5 rounded-lg transition-colors ${
                      isHighlighted
                        ? 'bg-emerald-600 text-white'
                        : isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FruitBadge
                        fruitIcon={fruit.fruitIcon}
                        fruitName={fruit.name}
                        size="sm"
                      />
                      <span className="font-semibold">{fruit.name}</span>
                      {fruit.category && (
                        <span
                          className={`text-[10px] px-1 rounded ${
                            isHighlighted
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {fruit.category}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono-numbers text-[11px] ${
                          isHighlighted ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        ₹{getFruitEffectivePrice(fruit)}/{fruit.unit || fruit.defaultUnit}
                      </span>
                      {isSelected && (
                        <Check
                          className={`h-3.5 w-3.5 ${
                            isHighlighted ? 'text-white' : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        />
                      )}
                    </div>
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
