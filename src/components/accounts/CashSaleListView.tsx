import React, { useState } from 'react';
import { CashSale } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CashSaleModal } from './CashSaleModal';
import { CashSalePrintModal } from '../print/CashSalePrintModal';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportCashSales } from '../../utils/excelEngine';
import {
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  Banknote,
  Box,
  AlertCircle,
  Printer,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';
import { CustomerAvatar } from '../common/CustomerAvatar';

interface CashSaleListViewProps {
  onNavigateToCustomerLedger?: (customerId: string) => void;
}

export const CashSaleListView: React.FC<CashSaleListViewProps> = ({
  onNavigateToCustomerLedger,
}) => {
  const [sales, setSales] = useState<CashSale[]>(db.getCashSales());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(sales[0]?.id || null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CashSale | null>(null);
  const [printingItem, setPrintingItem] = useState<CashSale | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refreshList = () => {
    setSales(db.getCashSales());
  };

  const handleEdit = (item: CashSale, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const sale = sales.find((s) => s.id === deleteId);
      if (sale) {
        db.moveToTrash(
          'cashSale',
          sale.id,
          sale.cashSaleNo,
          `Customer: ${sale.customerName || 'None'} · Amount: ₹${sale.finalAmount} · Date: ${sale.date}`,
          sale
        );
      } else {
        db.deleteCashSale(deleteId);
      }
      setDeleteId(null);
      refreshList();
    }
  };

  const q = searchTerm.trim().toLowerCase();

  const filteredSales = React.useMemo(() => {
    if (!q) return sales;

    const scored = sales
      .map((s) => {
        const noLower = s.cashSaleNo.toLowerCase();
        const custLower = (s.customerName || '').toLowerCase();
        const fruitMatch = s.items?.some((it) => it.fruitName.toLowerCase().includes(q));

        if (noLower === q || custLower === q) return { sale: s, score: 0 };
        if (noLower.startsWith(q) || custLower.startsWith(q)) return { sale: s, score: 1 };
        const words = custLower.split(/\s+/);
        if (words.some((w) => w.startsWith(q))) return { sale: s, score: 2 };
        if (noLower.includes(q) || custLower.includes(q)) return { sale: s, score: 3 };
        if (fruitMatch) return { sale: s, score: 4 };

        return null;
      })
      .filter((entry): entry is { sale: typeof sales[0]; score: number } => entry !== null);

    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.sale);
  }, [sales, q]);

  const totalCashRevenue = sales.reduce((sum, s) => sum + (s.finalAmount || 0), 0);
  const totalCratesOut = sales.reduce((sum, s) => sum + (s.crateOut || 0), 0);

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Banknote className="h-6 w-6 text-emerald-600" /> Wholesale Cash Sales
          </h2>
          <p className="text-xs text-slate-500">
            Immediate cash settlements with exact Qty/KG and Balance Crate tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="cashSale"
            moduleTitle="Cash Sales"
            onExportFiltered={() => exportCashSales(filteredSales, '_Filtered')}
            onExportAll={() => exportCashSales(sales)}
            filteredCount={filteredSales.length}
            totalCount={sales.length}
            onImportComplete={refreshList}
          />
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> + Create Cash Sale
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">Total Cash Sales</div>
          <div className="mt-1 font-mono-numbers text-xl font-bold text-slate-900 dark:text-white">
            {sales.length}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">Cash Revenue Collected</div>
          <div className="mt-1 font-mono-numbers text-xl font-bold text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalCashRevenue)}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="text-xs text-slate-500">Total Crates Issued</div>
          <div className="mt-1 font-mono-numbers text-xl font-bold text-sky-600 dark:text-sky-400">
            {totalCratesOut} Crates
          </div>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by Cash Sale No, customer name, fruit..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:bg-slate-900 dark:text-white"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Sales List Table */}
      <div className="space-y-3 no-print">
        {filteredSales.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            No cash sales found matching your criteria.
          </div>
        ) : (
          filteredSales.map((s) => {
            const isExpanded = expandedId === s.id;
            return (
              <div
                key={s.id}
                className="rounded-xl border border-slate-200 bg-white shadow-2xs transition-all dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
              >
                {/* Sale Row Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  className="flex flex-wrap items-center justify-between p-4 cursor-pointer hover:bg-slate-50/75 dark:hover:bg-slate-800/40 gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      <Banknote className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {s.cashSaleNo}
                        </span>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 uppercase">
                          PAID ({s.paymentMode || 'Cash'})
                        </span>
                      </div>
                      <div className="text-xs text-slate-500">
                        {formatDate(s.date)} ·{' '}
                        {s.customerName ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
                            <CustomerAvatar
                              photo={s.customerId ? db.getCustomerById(s.customerId)?.photo : undefined}
                              name={s.customerName}
                              size="xs"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (s.customerId) onNavigateToCustomerLedger?.(s.customerId);
                              }}
                              className="hover:text-emerald-600 dark:hover:text-emerald-400"
                            >
                              {s.customerName}
                            </button>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">No Customer (Cash)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono-numbers text-base font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(s.finalAmount)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {s.items?.length || 0} item(s) · {s.crateOut || 0} crates
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setPrintingItem(s)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 dark:hover:bg-slate-800 cursor-pointer"
                        title="Print Bill / PDF"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleEdit(s, e)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 cursor-pointer"
                        title="Edit Sale"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(s.id, e)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800 cursor-pointer"
                        title="Delete Sale"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Items */}
                      <div>
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                          Items Breakdown
                        </h4>
                        <div className="space-y-1.5">
                          {s.items?.map((it, idx) => (
                            <div
                              key={it.id || idx}
                              className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-800"
                            >
                              <div>
                                <span className="font-semibold text-slate-800 dark:text-slate-200">
                                  {it.fruitName}
                                </span>
                                <span className="text-slate-400 ml-2">
                                  {it.quantity} {it.unit}
                                  {it.kg && it.kg > 0 ? ` · ${it.kg} KG` : it.crateSize ? ` (${it.crateSize} KG)` : ''}
                                </span>
                              </div>
                              <div className="font-mono-numbers font-medium text-slate-900 dark:text-white">
                                / ₹{it.rate} = {formatCurrency(it.amount)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Crates & Expenses */}
                      <div className="space-y-3">
                        <div className="rounded-lg border border-sky-100 bg-sky-50/60 p-3 text-xs dark:border-sky-900/30 dark:bg-sky-950/20">
                          <span className="font-bold text-sky-900 dark:text-sky-300 block mb-1">
                            Balance Crate Status
                          </span>
                          <div className="flex justify-between text-sky-800 dark:text-sky-400">
                            <span>Balance Crate OUT: {s.crateOut || 0}</span>
                            <span>Balance Crate IN: {s.crateIn || 0}</span>
                            <span className="font-bold">Net: {(s.crateOut || 0) - (s.crateIn || 0)} Crates</span>
                          </div>
                        </div>

                        {s.expenses && s.expenses.length > 0 && (
                          <div className="text-xs">
                            <span className="font-semibold text-slate-500 block mb-1">Expenses:</span>
                            <div className="space-y-1">
                              {s.expenses.map((exp, idx) => (
                                <div key={idx} className="flex justify-between text-slate-600 dark:text-slate-400">
                                  <span>{exp.name}</span>
                                  <span className="font-mono">{formatCurrency(exp.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {s.notes && (
                          <div className="text-xs text-slate-500 italic">
                            &quot;{s.notes}&quot;
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Password-Protected Delete Confirmation */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Cash Sale?"
        itemTitle={sales.find((s) => s.id === deleteId)?.cashSaleNo}
        description="The cash sale record will be moved to the Trash / Recycle Bin. You can restore it anytime."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Add / Edit Modal */}
      <CashSaleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editItem={editingItem}
        onSaved={refreshList}
      />

      {/* Print Modal */}
      {printingItem && (
        <CashSalePrintModal
          isOpen={!!printingItem}
          onClose={() => setPrintingItem(null)}
          cashSale={printingItem}
        />
      )}
    </div>
  );
};
