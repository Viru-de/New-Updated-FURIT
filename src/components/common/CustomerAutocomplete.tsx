import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Customer } from '../../types';
import { db } from '../../services/db';
import { CustomerAvatar } from './CustomerAvatar';
import { Users, Search, Phone, MapPin, Check } from 'lucide-react';

interface CustomerAutocompleteProps {
  valueCustomerId: string;
  onChange: (customer: Customer | null) => void;
  onEnterNext?: () => void;
  placeholder?: string;
  hasError?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  compact?: boolean;
}

export const CustomerAutocomplete: React.FC<CustomerAutocompleteProps> = ({
  valueCustomerId,
  onChange,
  onEnterNext,
  placeholder = 'Search customer name, mobile or city...',
  hasError = false,
  disabled = false,
  autoFocus = false,
  className = '',
  compact = false,
}) => {
  const customers = db.getCustomers();
  const selectedCustomer = customers.find((c) => c.id === valueCustomerId) || null;

  const [searchTerm, setSearchTerm] = useState(selectedCustomer ? selectedCustomer.name : '');
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

  // Sync internal search input if selectedCustomer changes from outside
  useEffect(() => {
    if (selectedCustomer) {
      setSearchTerm(selectedCustomer.name);
    } else if (!valueCustomerId) {
      setSearchTerm('');
    }
  }, [valueCustomerId, selectedCustomer]);

  // Recalculate dropdown positioning relative to viewport
  const updateCoords = () => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = 260;
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
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
      return () => {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      };
    }
  }, [isOpen]);

  // Filter matching customers: match name, id, mobile, city, altMobile
  const query = searchTerm.trim().toLowerCase();
  const matchingCustomers = query
    ? customers.filter((c) => {
        const nameMatch = c.name.toLowerCase().includes(query);
        const mobileMatch = c.mobile && c.mobile.includes(query);
        const idMatch = c.id.toLowerCase().includes(query);
        const cityMatch = c.city && c.city.toLowerCase().includes(query);
        return nameMatch || mobileMatch || idMatch || cityMatch;
      })
    : customers;

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
        if (selectedCustomer) {
          setSearchTerm(selectedCustomer.name);
        } else {
          setSearchTerm('');
          onChange(null);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [selectedCustomer, onChange]);

  const handleSelect = (customer: Customer) => {
    setSearchTerm(customer.name);
    onChange(customer);
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
          prev < matchingCustomers.length - 1 ? prev + 1 : prev
        );
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (isOpen) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      }
    } else if (e.key === 'Enter') {
      if (isOpen && matchingCustomers.length > 0) {
        e.preventDefault();
        const picked = matchingCustomers[highlightedIndex] || matchingCustomers[0];
        if (picked) {
          handleSelect(picked);
        }
      } else if (!isOpen && onEnterNext) {
        onEnterNext();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      if (selectedCustomer) {
        setSearchTerm(selectedCustomer.name);
      } else {
        setSearchTerm('');
      }
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <div className="relative flex items-center">
        {/* Left avatar or search icon */}
        <div className="absolute left-2.5 z-10 pointer-events-none flex items-center">
          {selectedCustomer ? (
            <CustomerAvatar
              photo={selectedCustomer.photo}
              name={selectedCustomer.name}
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
          autoFocus={autoFocus}
          placeholder={placeholder}
          onFocus={() => {
            updateCoords();
            setIsOpen(true);
          }}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            updateCoords();
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded-lg pl-8.5 pr-7 py-1.5 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 border ${
            hasError
              ? 'border-rose-500 bg-rose-50/50 dark:bg-rose-950/20 text-rose-900 dark:text-rose-200'
              : 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 focus:border-blue-500 dark:focus:border-blue-400 focus:ring-1 focus:ring-blue-500'
          }`}
        />

        {selectedCustomer ? (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center text-blue-600 dark:text-blue-400 pointer-events-none">
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
            title="Search customer directory"
          >
            <Search className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Dropdown suggestions rendered through portal */}
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
            className="max-h-64 overflow-y-auto p-1.5 text-xs shadow-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl"
          >
            {matchingCustomers.length === 0 ? (
              <div className="p-3 text-center text-slate-400">
                <Users className="mx-auto h-5 w-5 mb-1 opacity-50" />
                <span>No matching customer in Directory</span>
              </div>
            ) : (
              matchingCustomers.map((cust, idx) => {
                const isSelected = cust.id === valueCustomerId;
                const isHighlighted = idx === highlightedIndex;
                return (
                  <div
                    key={cust.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      handleSelect(cust);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`flex cursor-pointer items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      isHighlighted
                        ? 'bg-blue-600 text-white'
                        : isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 font-bold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CustomerAvatar
                        photo={cust.photo}
                        name={cust.name}
                        size="sm"
                      />
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm truncate">{cust.name}</span>
                          <span
                            className={`text-[10px] px-1 rounded shrink-0 ${
                              isHighlighted
                                ? 'bg-blue-500 text-white'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {cust.id}
                          </span>
                        </div>
                        <div
                          className={`flex items-center gap-2 text-[11px] mt-0.5 ${
                            isHighlighted ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {cust.mobile && (
                            <span className="flex items-center gap-0.5">
                              <Phone className="h-3 w-3" /> {cust.mobile}
                            </span>
                          )}
                          {cust.city && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="h-3 w-3" /> {cust.city}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <Check
                        className={`h-4 w-4 shrink-0 ${
                          isHighlighted ? 'text-white' : 'text-blue-600'
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
