import React, { useState } from 'react';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { FruitBadge } from './FruitIconHelper';
import { CustomerAvatar } from './CustomerAvatar';
import { Search, X, Users, Apple, TrendingUp, ShoppingBag, CreditCard, FileText } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectResult: (view: string, id?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onSelectResult,
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const customers = db.getCustomers();
  const fruits = db.getFruits();
  const saleProceeds = db.getSaleProceeds();
  const creditSales = db.getCreditSales();
  const receipts = db.getReceipts();
  const bills = db.getBills();

  const q = query.trim().toLowerCase();

  const matchedCustomers = q
    ? customers.filter((c) => c.name.toLowerCase().includes(q) || c.mobile?.includes(q) || c.city?.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const matchedFruits = q
    ? fruits.filter((f) => f.name.toLowerCase().includes(q) || (f.category ? f.category.toLowerCase().includes(q) : false)).slice(0, 4)
    : [];
  const matchedProceeds = q
    ? saleProceeds.filter((s) => s.proceedsNo.toLowerCase().includes(q) || s.billNumber?.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const matchedCreditSales = q
    ? creditSales.filter((cs) => cs.creditSaleNo.toLowerCase().includes(q) || cs.customerName.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const matchedReceipts = q
    ? receipts.filter((r) => r.receiptNo.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q)).slice(0, 4)
    : [];
  const matchedBills = q
    ? bills.filter((b) => b.billNo.toLowerCase().includes(q) || b.customerName.toLowerCase().includes(q)).slice(0, 4)
    : [];

  const totalMatches =
    matchedCustomers.length +
    matchedFruits.length +
    matchedProceeds.length +
    matchedCreditSales.length +
    matchedReceipts.length +
    matchedBills.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-16 backdrop-blur-xs">
      <div className="neu-modal w-full max-w-xl overflow-hidden p-2">
        {/* Search Input Bar (Neumorphic Inset) */}
        <div className="neu-inset flex items-center px-4 py-3 mx-2 my-2">
          <Search className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search customers, fruits, sale proceeds, credit sales, bills..."
            className="w-full text-sm font-medium text-slate-800 dark:text-slate-100 bg-transparent outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={onClose}
            className="neu-btn p-1.5 ml-2 text-slate-500 hover:text-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results Body */}
        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {!q && (
            <div className="py-6 text-center text-xs text-slate-400">
              Type to search across customer ledger records, fruits, credit sales, receipts, and bills.
            </div>
          )}

          {q && totalMatches === 0 && (
            <div className="py-6 text-center text-xs text-slate-400">
              No matching records found for &quot;{query}&quot;.
            </div>
          )}

          {/* Customers */}
          {matchedCustomers.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Customers
              </span>
              <div className="space-y-1">
                {matchedCustomers.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      onSelectResult('customerLedger', c.id);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <CustomerAvatar
                        photo={c.photo}
                        name={c.name}
                        size="xs"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                      {c.city && <span className="text-slate-400">({c.city})</span>}
                    </div>
                    <span className="text-emerald-600 font-medium">View Ledger &rarr;</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sale Proceeds */}
          {matchedProceeds.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Sale Proceeds
              </span>
              <div className="space-y-1">
                {matchedProceeds.map((sp) => (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      onSelectResult('saleProceeds');
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{sp.proceedsNo}</span>
                      <span className="text-slate-400 font-mono-numbers">({formatDate(sp.date)})</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-slate-900 dark:text-white">
                      {formatCurrency(sp.netAmount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Credit Sales */}
          {matchedCreditSales.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Credit Sales
              </span>
              <div className="space-y-1">
                {matchedCreditSales.map((cs) => (
                  <button
                    key={cs.id}
                    type="button"
                    onClick={() => {
                      onSelectResult('creditSales');
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingBag className="h-4 w-4 text-blue-600" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{cs.creditSaleNo}</span>
                      <span className="text-slate-500 font-medium">({cs.customerName})</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-rose-600">
                      {formatCurrency(cs.finalAmount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Receipts */}
          {matchedReceipts.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Receipts
              </span>
              <div className="space-y-1">
                {matchedReceipts.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => {
                      onSelectResult('receipts');
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-emerald-600" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{r.receiptNo}</span>
                      <span className="text-slate-500">({r.customerName})</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-emerald-600">
                      {formatCurrency(r.amount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fruits */}
          {matchedFruits.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Fruit Master Items
              </span>
              <div className="space-y-1">
                {matchedFruits.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      onSelectResult('fruitMaster');
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2.5">
                      <FruitBadge
                        fruitIcon={f.fruitIcon}
                        fruitName={f.name}
                        size="xs"
                      />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{f.name}</span>
                      {f.category && <span className="text-slate-400">({f.category})</span>}
                    </div>
                    <span className="font-mono-numbers text-slate-600 dark:text-slate-400">
                      {f.crateWeightKg} KG / {f.unit || f.defaultUnit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bills */}
          {matchedBills.length > 0 && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Bills
              </span>
              <div className="space-y-1">
                {matchedBills.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => {
                      onSelectResult('billHistory');
                      onClose();
                    }}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-600" />
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{b.billNo}</span>
                      <span className="text-slate-500 font-medium">({b.customerName})</span>
                    </div>
                    <span className="font-mono-numbers font-bold text-slate-900 dark:text-white">
                      {formatCurrency(b.totalAmount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
