import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Fruit } from '../../types';
import { db } from '../../services/db';
import { getFruitEffectivePrice } from '../../utils/fruitUtils';
import { FruitBadge } from './FruitIconHelper';
import { Apple, Search } from 'lucide-react';

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
}) => {
  // Dynamically load fruits from Fruit/Item Master
  const fruits = db.getFruits();
  const selectedFruit = useMemo(
    () =>
      fruits.find(
        (f) =>
          (valueFruitId && f.id === valueFruitId) ||
          (valueFruitName && f.name.toLowerCase() === valueFruitName.toLowerCase())
      ) || null,
    [fruits, valueFruitId, valueFruitName]
  );

  const [searchTerm, setSearchTerm] = useState(
    valueFruitName || (selectedFruit ? selectedFruit.name : '')
  );
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isUserInputActiveRef = useRef(false);
  const lastPropFruitIdRef = useRef(valueFruitId);
  const lastPropFruitNameRef = useRef(valueFruitName);

  // Position state for portal dropdown
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    openAbove: boolean;
  }>({ top: 0, left: 0, width: 260, openAbove: false });

  // Sync internal search input if external value changes (only if user is not actively typing)
  useEffect(() => {
    const propChanged =
      valueFruitId !== lastPropFruitIdRef.current ||
      valueFruitName !== lastPropFruitNameRef.current;

    if (propChanged) {
      lastPropFruitIdRef.current = valueFruitId;
      lastPropFruitNameRef.current = valueFruitName;
      if (!isUserInputActiveRef.current) {
        setSearchTerm(valueFruitName || (selectedFruit ? selectedFruit.name : ''));
      }
    } else if (!isUserInputActiveRef.current) {
      if (valueFruitName && searchTerm !== valueFruitName) {
        setSearchTerm(valueFruitName);
      } else if (selectedFruit && searchTerm !== selectedFruit.name) {
        setSearchTerm(selectedFruit.name);
      }
    }
  }, [valueFruitId, valueFruitName, selectedFruit]);

  // Recalculate dropdown positioning relative to viewport
  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 240;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    const calculatedTop = openAbove
      ? Math.max(8, rect.top - dropdownHeight - 4)
      : rect.bottom + 4;

    const targetWidth = Math.max(rect.width, 240);
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

  // Prefix ranking and case-insensitive matching across fruit name, category, or ID
  const query = searchTerm.trim().toLowerCase();
  const matchingFruits = useMemo(() => {
    if (!query) return fruits;

    const scored = fruits
      .map((f) => {
        const nameLower = f.name.toLowerCase();
        const catLower = f.category ? f.category.toLowerCase() : '';
        const idLower = f.id.toLowerCase();

        // Exact match
        if (nameLower === query) return { fruit: f, score: 0 };
        // Name starts with query (e.g. 'g' -> 'Grapes Green')
        if (nameLower.startsWith(query)) return { fruit: f, score: 1 };
        // Word in name starts with query (e.g. 'green' -> 'Grapes Green')
        const words = nameLower.split(/\s+/);
        if (words.some((w) => w.startsWith(query))) return { fruit: f, score: 2 };
        // Name contains query
        if (nameLower.includes(query)) return { fruit: f, score: 3 };
        // Category starts with query
        if (catLower.startsWith(query)) return { fruit: f, score: 4 };
        // Category contains query
        if (catLower.includes(query)) return { fruit: f, score: 5 };
        // ID matches
        if (idLower.includes(query)) return { fruit: f, score: 6 };

        return null;
      })
      .filter((item): item is { fruit: Fruit; score: number } => item !== null);

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.fruit.name.localeCompare(b.fruit.name);
    });

    return scored.map((s) => s.fruit);
  }, [fruits, query]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm]);

  // Keep highlighted item visible in scrolling dropdown
  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const itemEl = dropdownRef.current.querySelector(
        `[data-index="${highlightedIndex}"]`
      ) as HTMLElement | null;
      if (itemEl) {
        itemEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

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
        isUserInputActiveRef.current = false;

        const trimmed = searchTerm.trim();
        if (!trimmed) {
          setSearchTerm('');
          lastPropFruitIdRef.current = '';
          lastPropFruitNameRef.current = '';
          onChange(null, '');
        } else {
          // Check for exact matching fruit
          const exact = fruits.find((f) => f.name.toLowerCase() === trimmed.toLowerCase());
          if (exact) {
            setSearchTerm(exact.name);
            lastPropFruitIdRef.current = exact.id;
            lastPropFruitNameRef.current = exact.name;
            onChange(exact, exact.name);
          } else if (selectedFruit && trimmed.toLowerCase() === selectedFruit.name.toLowerCase()) {
            setSearchTerm(selectedFruit.name);
          } else {
            // Keep custom name without creating duplicate item
            onChange(null, trimmed);
          }
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedFruit, searchTerm, fruits, onChange]);

  const handleSelect = (fruit: Fruit) => {
    isUserInputActiveRef.current = false;
    lastPropFruitIdRef.current = fruit.id;
    lastPropFruitNameRef.current = fruit.name;
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
        updateCoords();
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
      isUserInputActiveRef.current = false;
      if (selectedFruit) {
        setSearchTerm(selectedFruit.name);
      } else {
        setSearchTerm(valueFruitName || '');
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false);
      isUserInputActiveRef.current = false;
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
            <Search className="h-3.5 w-3.5 text-slate-400" />
          )}
        </div>

        {/* Clean, standard autocomplete input with NO X or ✓ buttons */}
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={(e) => {
            updateCoords();
            setIsOpen(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const val = e.target.value;
            isUserInputActiveRef.current = true;
            setSearchTerm(val);
            updateCoords();
            setIsOpen(true);
            const exactMatch = fruits.find(
              (f) => f.name.toLowerCase() === val.trim().toLowerCase()
            );
            onChange(exactMatch || null, val);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg pl-8 pr-3 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 border ${
            hasError
              ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-1 focus:ring-emerald-500'
          }`}
        />
      </div>

      {/* Suggestion Dropdown portal to body (never clipped by table/modal overflow) */}
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
            className="max-h-60 overflow-y-auto p-1.5 text-xs shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {matchingFruits.length === 0 ? (
              <div className="p-3 text-center text-slate-400 dark:text-slate-500">
                <Apple className="mx-auto h-5 w-5 mb-1 opacity-50 text-slate-400 dark:text-slate-500" />
                <span>No matching items</span>
              </div>
            ) : (
              matchingFruits.map((fruit, idx) => {
                const isSelected = selectedFruit?.id === fruit.id;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={fruit.id}
                    data-index={idx}
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
                          isHighlighted
                            ? 'text-emerald-100'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        ₹{getFruitEffectivePrice(fruit)}/{fruit.unit || fruit.defaultUnit}
                      </span>
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
