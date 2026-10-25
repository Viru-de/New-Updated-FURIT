import React, { useState } from 'react';
import { CreditSale } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditSaleModal } from './CreditSaleModal';
import { CreditSalePrintModal } from '../print/CreditSalePrintModal';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportCreditSales } from '../../utils/excelEngine';
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  ShoppingBag,
  Box,
  AlertCircle,
  FileText,
  Printer,
  X,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';
import { CustomerAvatar } from '../common/CustomerAvatar';

interface CreditSaleListViewProps {
  onNavigateToCustomerLedger?: (customerId: string) => void;
}

export const CreditSaleListView: React.FC<CreditSaleListViewProps> = ({
  onNavigateToCustomerLedger,
}) => {
  const [sales, setSales] = useState<CreditSale[]>(db.getCreditSales());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(sales[0]?.id || null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CreditSale | null>(null);
  const [printingItem, setPrintingItem] = useState<CreditSale | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refreshList = () => {
    setSales(db.getCreditSales());
  };

  const handleEdit = (item: CreditSale, e: React.MouseEvent) => {
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
          'creditSale',
          sale.id,
          sale.creditSaleNo,
          `Customer: ${sale.customerName} · Amount: ₹${sale.finalAmount} · Date: ${sale.date}`,
          sale
        );
      } else {
        db.deleteCreditSale(deleteId);
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
        const noLower = s.creditSaleNo.toLowerCase();
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

  return (
    <div className="space-y-6">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Wholesale Credit Sales
          </h2>
          <p className="text-xs text-slate-500">
            Posts Debit directly to Customer Ledger and updates Crate Statement
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="creditSale"
            moduleTitle="Credit Sales"
            onExportFiltered={() => exportCreditSales(filteredSales, '_Filtered')}
            onExportAll={() => exportCreditSales(sales)}
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
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> + Create Credit Sale
          </button>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by Credit Sale No, customer name, fruit..."
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

      {/* Cards List */}
      <div className="space-y-3 no-print">
        {filteredSales.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 dark:border-slate-800 dark:bg-slate-900">
            <ShoppingBag className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold">No Credit Sales recorded.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;+ Create Credit Sale&quot; to issue fruits to a customer on credit.
            </p>
          </div>
        ) : (
          filteredSales.map((sale) => {
            const isExpanded = expandedId === sale.id;
            return (
              <div
                key={sale.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs transition-all dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Collapsed Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                  className="flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-slate-50/70 transition-colors dark:hover:bg-slate-800/40 gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      type="button"
                      className="mt-0.5 sm:mt-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white">
                          {sale.creditSaleNo}
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded dark:bg-blue-950/40 dark:text-blue-300">
                          <CustomerAvatar
                            photo={db.getCustomerById(sale.customerId)?.photo}
                            name={sale.customerName}
                            size="xs"
                          />
                          <span>{sale.customerName}</span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                        <span>Date: {formatDate(sale.date)}</span>
                        <span>·</span>
                        <span>
                          {sale.items?.length || 0} Products
                        </span>
                        {(sale.crateIn > 0 || sale.crateOut > 0) && (
                          <>
                            <span>·</span>
                            <span className="text-sky-600 dark:text-sky-400">
                              Crates OUT: {sale.crateOut} / IN: {sale.crateIn}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Total Debit</div>
                      <div className="font-mono-numbers text-base font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(sale.finalAmount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintingItem(sale);
                        }}
                        title="Print / PDF Bill (Reference 2)"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-800"
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleEdit(sale, e)}
                        title="Edit Credit Sale"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(sale.id, e)}
                        title="Delete Credit Sale"
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-800/30 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-2.5">
                        <CustomerAvatar
                          photo={db.getCustomerById(sale.customerId)?.photo}
                          name={sale.customerName}
                          size="sm"
                        />
                        <div>
                          <span className="text-slate-500 block text-[11px]">Customer</span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">
                            {sale.customerName}
                          </span>
                        </div>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Date</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {formatDate(sale.date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Crate Movement</span>
                        <span className="font-semibold text-sky-700 dark:text-sky-300">
                          OUT: {sale.crateOut} | IN: {sale.crateIn} ({sale.crateWeightKg} KG/crate)
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Ledger Debit</span>
                        <span className="font-mono-numbers font-bold text-rose-600 dark:text-rose-400">
                          {formatCurrency(sale.finalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Products list */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                        Fruit Items
                      </h4>
                      <div className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:divide-slate-800">
                        {sale.items?.map((it, idx) => (
                          <div
                            key={it.id || idx}
                            className="flex items-center justify-between p-2.5 text-xs"
                          >
                            <div>
                              <span className="font-bold text-slate-800 dark:text-white">
                                {it.fruitName}
                              </span>
                              <span className="text-slate-500 ml-2">
                                {it.quantity} {it.unit}
                                {it.kg !== undefined && it.kg > 0 ? ` · ${it.kg} Kg` : ''} / {formatCurrency(it.rate)}
                              </span>
                            </div>
                            <span className="font-mono-numbers font-bold text-slate-900 dark:text-white">
                              {formatCurrency(it.amount)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Expenses & Crate details */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                          Expenses
                        </h4>
                        <div className="rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900 space-y-1 text-xs">
                          {sale.expenses && sale.expenses.length > 0 ? (
                            sale.expenses.map((exp, i) => (
                              <div key={exp.id || i} className="flex items-center justify-between">
                                <span className="text-slate-600 dark:text-slate-400">{exp.name}</span>
                                <span className="font-mono-numbers text-slate-800 dark:text-slate-200">
                                  {formatCurrency(exp.amount)}
                                </span>
                              </div>
                            ))
                          ) : (
                            <span className="text-slate-400">No expenses recorded</span>
                          )}
                          <div className="flex items-center justify-between border-t border-slate-100 pt-1 font-semibold dark:border-slate-800">
                            <span>Total Expense</span>
                            <span className="font-mono-numbers text-rose-600">
                              {formatCurrency(sale.expenseTotal)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                          Crate Summary
                        </h4>
                        <div className="rounded-lg border border-sky-100 bg-sky-50/50 p-3 dark:border-sky-900/40 dark:bg-sky-950/20 text-xs space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Balance Crates Issued:</span>
                            <span className="font-mono font-bold text-sky-700 dark:text-sky-300">
                              {sale.totalCrateBalance !== undefined ? sale.totalCrateBalance : sale.crateOut} Crates
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-600 dark:text-slate-400">Crate Return (IN):</span>
                            <span className="font-mono-numbers font-medium text-emerald-600">
                              {sale.crateIn || 0} Crates
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border border-slate-200 bg-white p-3 text-center dark:border-slate-800 dark:bg-slate-900 text-xs">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Product Total</span>
                        <span className="font-mono-numbers font-bold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(sale.productTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Expenses</span>
                        <span className="font-mono-numbers font-bold text-sm text-slate-700 dark:text-slate-300">
                          {formatCurrency(sale.expenseTotal)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Net Total (Debit)</span>
                        <span className="font-mono-numbers font-bold text-sm text-slate-900 dark:text-white">
                          {formatCurrency(sale.finalAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-rose-600 block">
                          {sale.totalBalance !== undefined ? 'Total Balance' : 'Final Amount'}
                        </span>
                        <span className="font-mono-numbers font-black text-sm text-rose-600 dark:text-rose-400">
                          {formatCurrency(sale.totalBalance !== undefined ? sale.totalBalance : sale.finalAmount)}
                        </span>
                      </div>
                    </div>

                    {/* Action buttons in expanded view */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => setPrintingItem(sale)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <Printer className="h-3.5 w-3.5 text-emerald-600" /> Print Credit Sale (Ref 2)
                      </button>

                      {onNavigateToCustomerLedger && (
                        <button
                          type="button"
                          onClick={() => onNavigateToCustomerLedger(sale.customerId)}
                          className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                        >
                          → View {sale.customerName}&apos;s Ledger Statement
                        </button>
                      )}
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
        title="Delete Credit Sale?"
        itemTitle={sales.find((s) => s.id === deleteId)?.creditSaleNo}
        description="The credit sale will be moved to the Trash / Recycle Bin. You can restore it anytime with complete ledger accuracy."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Modal */}
      <CreditSaleModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editItem={editingItem}
        onSaved={refreshList}
      />

      {/* Traditional Bill Print Modal (Reference 2) */}
      {printingItem && (
        <CreditSalePrintModal
          isOpen={!!printingItem}
          onClose={() => setPrintingItem(null)}
          creditSale={printingItem}
        />
      )}
    </div>
  );
};
