import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Customer } from '../../types';
import { db } from '../../services/db';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { Search, X, Users, Check, Phone, MapPin, ArrowRight } from 'lucide-react';
import { getCustomerPrintContactLines } from '../../utils/customerContactUtils';

interface SearchCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCustomer: (customer: Customer | null) => void;
  selectedCustomerId?: string;
}

export const SearchCustomerModal: React.FC<SearchCustomerModalProps> = ({
  isOpen,
  onClose,
  onSelectCustomer,
  selectedCustomerId = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<(HTMLDivElement | null)[]>([]);

  const customers = db.getCustomers();

  // Reset search and highlight whenever modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setHighlightedIndex(0);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Dynamic case-insensitive customer search by name or phone number
  const matchingCustomers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const cleanQ = q.replace(/[\s+-]/g, '');

    if (!q) return customers;

    return customers.filter((c) => {
      const name = (c.name || '').toLowerCase();
      const mobile = (c.mobile || '').replace(/[\s+-]/g, '');
      const alt1 = (c.altMobile || c.alternate1Mobile || c.alternateNumber1 || '').replace(/[\s+-]/g, '');
      const alt2 = (c.alternate2Mobile || c.alternateNumber2 || '').replace(/[\s+-]/g, '');
      const city = (c.city || '').toLowerCase();
      const contactPerson = (c.contactPerson || '').toLowerCase();

      return (
        name.includes(q) ||
        mobile.includes(cleanQ) ||
        alt1.includes(cleanQ) ||
        alt2.includes(cleanQ) ||
        city.includes(q) ||
        contactPerson.includes(q)
      );
    });
  }, [customers, searchTerm]);

  // Combined options: index 0 is "All Customers" (if query is empty or matches 'all'), followed by customers
  const showAllCustomersOption = !searchTerm.trim() || 'all customers'.includes(searchTerm.trim().toLowerCase());
  const totalOptionsCount = (showAllCustomersOption ? 1 : 0) + matchingCustomers.length;

  // Keep highlighted index in bounds
  useEffect(() => {
    if (highlightedIndex >= totalOptionsCount && totalOptionsCount > 0) {
      setHighlightedIndex(0);
    }
  }, [totalOptionsCount, highlightedIndex]);

  // Scroll highlighted item into view
  useEffect(() => {
    const el = itemsRef.current[highlightedIndex];
    if (el && listRef.current) {
      el.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  if (!isOpen) return null;

  const handleSelect = (customer: Customer | null) => {
    onSelectCustomer(customer);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (totalOptionsCount > 0) {
        setHighlightedIndex((prev) => (prev + 1) % totalOptionsCount);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (totalOptionsCount > 0) {
        setHighlightedIndex((prev) => (prev - 1 + totalOptionsCount) % totalOptionsCount);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (totalOptionsCount > 0) {
        if (showAllCustomersOption && highlightedIndex === 0) {
          handleSelect(null);
        } else {
          const customerIdx = showAllCustomersOption ? highlightedIndex - 1 : highlightedIndex;
          const picked = matchingCustomers[customerIdx];
          if (picked) {
            handleSelect(picked);
          }
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 md:p-6 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-customer-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h3 id="search-customer-title" className="text-base font-bold text-slate-900 dark:text-white">
                Search Customer
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Filter Sale Proceeds Ledger by customer name or mobile number
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4 w-4 text-emerald-600 dark:text-emerald-400 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setHighlightedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search customer by name or phone number..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 pl-10 pr-9 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:focus:border-emerald-500 dark:focus:bg-slate-800 transition-all placeholder:text-slate-400 font-medium"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  inputRef.current?.focus();
                }}
                className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                title="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="overflow-y-auto p-2 sm:p-3 space-y-1.5 flex-1 divide-y divide-transparent"
        >
          {/* Option: All Customers / Clear Search */}
          {showAllCustomersOption && (
            <div
              ref={(el) => {
                itemsRef.current[0] = el;
              }}
              onClick={() => handleSelect(null)}
              onMouseEnter={() => setHighlightedIndex(0)}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                highlightedIndex === 0
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : !selectedCustomerId
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                  : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                    highlightedIndex === 0
                      ? 'bg-white/20 text-white'
                      : !selectedCustomerId
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="font-bold text-sm leading-snug">All Customers</div>
                  <div
                    className={`text-[11px] leading-tight ${
                      highlightedIndex === 0 ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    Display complete Sale Proceeds Ledger across all customer transactions
                  </div>
                </div>
              </div>

              {!selectedCustomerId && (
                <span
                  className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                    highlightedIndex === 0
                      ? 'bg-white/20 text-white'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                  }`}
                >
                  <Check className="h-3.5 w-3.5" /> Active
                </span>
              )}
            </div>
          )}

          {/* Empty state matching requirement 8: "No customers found." */}
          {matchingCustomers.length === 0 && (
            <div className="p-8 text-center text-slate-500 dark:text-slate-400">
              <Users className="mx-auto h-8 w-8 mb-2 opacity-30 text-slate-400" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No customers found.
              </p>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                Please check the spelling or try searching with another phone number.
              </p>
            </div>
          )}

          {/* Matching Customer Rows */}
          {matchingCustomers.map((cust, idx) => {
            const optionIdx = showAllCustomersOption ? idx + 1 : idx;
            const isHighlighted = highlightedIndex === optionIdx;
            const isSelected = cust.id === selectedCustomerId;
            const altLines = getCustomerPrintContactLines(cust);

            return (
              <div
                key={cust.id}
                ref={(el) => {
                  itemsRef.current[optionIdx] = el;
                }}
                onClick={() => handleSelect(cust)}
                onMouseEnter={() => setHighlightedIndex(optionIdx)}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                  isHighlighted
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : isSelected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800/60'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <CustomerAvatar photo={cust.photo} name={cust.name} size="sm" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm truncate">{cust.name}</span>
                      {cust.city && (
                        <span
                          className={`flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded shrink-0 ${
                            isHighlighted
                              ? 'bg-white/20 text-white'
                              : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                          }`}
                        >
                          <MapPin className="h-2.5 w-2.5" />
                          {cust.city}
                        </span>
                      )}
                    </div>
                    <div
                      className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs mt-0.5 ${
                        isHighlighted ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cust.mobile && (
                        <span className="flex items-center gap-1 font-mono">
                          <Phone className="h-3 w-3" />
                          {cust.mobile}
                        </span>
                      )}
                      {altLines.map((alt) => (
                        <span key={alt.id} className="font-mono">
                          / {alt.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {isSelected && (
                    <span
                      className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-md ${
                        isHighlighted
                          ? 'bg-white/20 text-white'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" /> Selected
                    </span>
                  )}
                  {isHighlighted && !isSelected && (
                    <span className="text-white text-xs font-semibold flex items-center gap-0.5">
                      Select <ArrowRight className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer with keyboard guidance and Clear Search option */}
        <div className="flex flex-wrap items-center justify-between border-t border-slate-100 px-5 py-3 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400 gap-2">
          <div className="flex items-center gap-2">
            <span>
              Use <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↑</kbd> <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↓</kbd> to navigate
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">↵ Enter</kbd> to select
            </span>
            <span>·</span>
            <span>
              <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">Esc</kbd> to close
            </span>
          </div>

          {selectedCustomerId && (
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
            >
              Clear Search (All Customers)
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
