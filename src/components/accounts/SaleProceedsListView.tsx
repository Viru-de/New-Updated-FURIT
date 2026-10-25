import React, { useState } from 'react';
import { SaleProceeds } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { SaleProceedsModal } from './SaleProceedsModal';
import { SaleProceedPrintModal } from '../print/SaleProceedPrintModal';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportSaleProceeds } from '../../utils/excelEngine';
import {
  Plus,
  Search,
  X,
  ChevronDown,
  ChevronUp,
  Edit2,
  Trash2,
  Calendar,
  FileText,
  AlertCircle,
  Printer,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';

export const SaleProceedsListView: React.FC = () => {
  const [sales, setSales] = useState<SaleProceeds[]>(db.getSaleProceeds());
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(sales[0]?.id || null);

  // Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<SaleProceeds | null>(null);
  const [printingItem, setPrintingItem] = useState<SaleProceeds | null>(null);

  // Delete confirm
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refreshList = () => {
    setSales(db.getSaleProceeds());
  };

  const handleEdit = (item: SaleProceeds, e: React.MouseEvent) => {
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
      const sp = sales.find((s) => s.id === deleteId);
      if (sp) {
        db.moveToTrash(
          'saleProceeds',
          sp.id,
          sp.proceedsNo,
          `Consignor: ${sp.vendorName || 'Mandi Consignor'} · Net Amount: ₹${sp.netAmount} · Date: ${sp.date}`,
          sp
        );
      } else {
        db.deleteSaleProceeds(deleteId);
      }
      setDeleteId(null);
      refreshList();
    }
  };

  const filteredSales = React.useMemo(() => {
    if (!searchTerm.trim()) return sales;
    const q = searchTerm.trim().toLowerCase();

    const matches = sales.filter((s) => {
      const noMatch = s.proceedsNo.toLowerCase().includes(q);
      const fruitMatch = s.items?.some((it) => it.fruitName.toLowerCase().includes(q));
      const billMatch = s.billNumber?.toLowerCase().includes(q);
      const vendorMatch = s.vendorName?.toLowerCase().includes(q);
      return noMatch || fruitMatch || billMatch || vendorMatch;
    });

    return matches.sort((a, b) => {
      const aVendor = (a.vendorName || '').toLowerCase();
      const bVendor = (b.vendorName || '').toLowerCase();
      const aNo = a.proceedsNo.toLowerCase();
      const bNo = b.proceedsNo.toLowerCase();

      // Check vendor name prefix
      const aVendorStarts = aVendor.startsWith(q);
      const bVendorStarts = bVendor.startsWith(q);
      if (aVendorStarts && !bVendorStarts) return -1;
      if (!aVendorStarts && bVendorStarts) return 1;

      // Check proceeds no prefix
      const aNoStarts = aNo.startsWith(q);
      const bNoStarts = bNo.startsWith(q);
      if (aNoStarts && !bNoStarts) return -1;
      if (!aNoStarts && bNoStarts) return 1;

      // Check fruit name prefix
      const aFruitStarts = a.items?.some((it) => it.fruitName.toLowerCase().startsWith(q));
      const bFruitStarts = b.items?.some((it) => it.fruitName.toLowerCase().startsWith(q));
      if (aFruitStarts && !bFruitStarts) return -1;
      if (!aFruitStarts && bFruitStarts) return 1;

      return b.date.localeCompare(a.date);
    });
  }, [sales, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Title & Add Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Sale Proceeds Transactions
          </h2>
          <p className="text-xs text-slate-500">
            Consignment arrivals, mandi auctions, manual amounts & expense deductions
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="saleProceeds"
            moduleTitle="Sale Proceeds"
            onExportFiltered={() => exportSaleProceeds(filteredSales, '_Filtered')}
            onExportAll={() => exportSaleProceeds(sales)}
            filteredCount={filteredSales.length}
            totalCount={sales.length}
            onImportComplete={() => setSales(db.getSaleProceeds())}
          />
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="neu-btn-primary flex items-center gap-1.5 px-4 py-2 text-xs font-bold"
          >
            <Plus className="h-4 w-4" /> + Create Sale Proceeds
          </button>
        </div>
      </div>

      {/* Search Filter (Neumorphic Inset) */}
      <div className="neu-inset flex items-center px-4 py-2.5 no-print">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by proceeds number, fruit name, bill number, vendor..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs text-slate-800 bg-transparent outline-none placeholder:text-slate-400"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="neu-btn flex items-center gap-1 px-2 py-0.5 text-xs text-slate-600 hover:text-slate-900"
            title="Clear search"
          >
            <X className="h-3 w-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Transaction List Cards */}
      <div className="space-y-3.5 no-print">
        {filteredSales.length === 0 ? (
          <div className="neu-card p-12 text-center text-slate-500">
            <FileText className="mx-auto h-8 w-8 text-slate-400 mb-2" />
            <p className="text-sm font-semibold">No Sale Proceeds records found.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click &quot;+ Create Sale Proceeds&quot; to enter a new consignment transaction.
            </p>
          </div>
        ) : (
          filteredSales.map((sale) => {
            const isExpanded = expandedId === sale.id;
            return (
              <div
                key={sale.id}
                className="neu-card overflow-hidden transition-all hover:translate-y-[-1px]"
              >
                {/* Collapsed Bar / Header */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : sale.id)}
                  className="flex cursor-pointer flex-col sm:flex-row sm:items-center justify-between p-4 hover:bg-white/40 transition-colors gap-3"
                >
                  <div className="flex items-start sm:items-center gap-3">
                    <button
                      type="button"
                      className="neu-btn mt-0.5 sm:mt-0 p-1 text-slate-500 hover:text-slate-800"
                    >
                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-slate-900">
                          {sale.proceedsNo}
                        </span>
                        {sale.billNumber && (
                          <span className="text-[11px] text-slate-500 font-mono-numbers">
                            · Bill: {sale.billNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                        <span>Date: {formatDate(sale.date)}</span>
                        <span>·</span>
                        <span>
                          Qty: <strong className="text-slate-800">{sale.quantity} {sale.unit}</strong>
                        </span>
                        {sale.items?.[0] && (
                          <>
                            <span>·</span>
                            <span className="text-slate-700">{sale.items[0].fruitName}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-4 pl-7 sm:pl-0">
                    <div className="text-right">
                      <div className="text-[11px] text-slate-500">Net Credit</div>
                      <div className="font-mono-numbers text-base font-bold text-emerald-700">
                        {formatCurrency(sale.netAmount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrintingItem(sale);
                        }}
                        title="Print / PDF Bill (Reference 1)"
                        className="neu-btn p-1.5 text-blue-600 hover:text-blue-800"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleEdit(sale, e)}
                        title="Edit Transaction"
                        className="neu-btn p-1.5 text-slate-600 hover:text-slate-900"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(sale.id, e)}
                        title="Delete Transaction"
                        className="neu-btn p-1.5 text-rose-500 hover:text-rose-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details View */}
                {isExpanded && (
                  <div className="border-t border-slate-300/40 bg-[#e4e9f0]/40 p-5 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-slate-500 block">Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(sale.date)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Challan Date</span>
                        <span className="font-semibold text-slate-800">
                          {formatDate(sale.challanDate)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Bill Number</span>
                        <span className="font-semibold text-slate-800 font-mono-numbers">
                          {sale.billNumber || 'None'}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Consignor / Vendor</span>
                        <span className="font-semibold text-slate-800">
                          {sale.vendorName || 'General Mandi Consignment'}
                        </span>
                      </div>
                    </div>

                    {/* Products Row */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Products
                      </h4>
                      <div className="neu-inset-sm p-3 space-y-1">
                        {sale.items && sale.items.length > 0 ? (
                          sale.items.map((it, i) => (
                            <div
                              key={it.id || i}
                              className="flex items-center justify-between text-xs py-1"
                            >
                              <span className="font-semibold text-slate-800">
                                {it.fruitName}
                              </span>
                              <span className="font-mono-numbers text-slate-600">
                                {it.quantity} {it.unit} / {formatCurrency(it.rate)} ={' '}
                                <strong className="text-slate-900">
                                  {formatCurrency(it.amount)}
                                </strong>
                              </span>
                            </div>
                          ))
                        ) : (
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-800">
                              Product
                            </span>
                            <span className="font-mono-numbers text-slate-600">
                              {sale.quantity} {sale.unit} / {formatCurrency(sale.rate)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expenses Section */}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Consignment Expenses
                      </h4>
                      <div className="neu-inset-sm p-3 space-y-1.5 text-xs">
                        {sale.expenses && sale.expenses.length > 0 ? (
                          sale.expenses.map((exp, i) => (
                            <div key={exp.id || i} className="flex items-center justify-between">
                              <span className="text-slate-600">{exp.name}</span>
                              <span className="font-mono-numbers text-slate-800">
                                {formatCurrency(exp.amount)}
                              </span>
                            </div>
                          ))
                        ) : (
                          <span className="text-slate-400">No expenses recorded</span>
                        )}

                        <div className="flex items-center justify-between border-t border-slate-300/40 pt-2 font-semibold text-slate-800">
                          <span>Total Expense</span>
                          <span className="font-mono-numbers text-rose-600">
                            {formatCurrency(sale.totalExpense)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div className="neu-card-sm p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                      <div>
                        <span className="text-[11px] text-slate-500 block">Original Amount</span>
                        <span className="font-mono-numbers font-bold text-sm text-slate-900">
                          {formatCurrency(sale.amount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Total Expense</span>
                        <span className="font-mono-numbers font-bold text-sm text-rose-600">
                          {formatCurrency(sale.totalExpense)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-emerald-700 block font-semibold">Net Credit</span>
                        <span className="font-mono-numbers font-bold text-sm text-emerald-700">
                          {formatCurrency(sale.netAmount)}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">Difference</span>
                        <span className="font-mono-numbers font-bold text-sm text-slate-600">
                          {formatCurrency(sale.difference)}
                        </span>
                      </div>
                    </div>

                    {sale.notes && (
                      <p className="text-xs text-slate-500 italic">
                        Notes: {sale.notes}
                      </p>
                    )}

                    {/* Print Action in Expanded View */}
                    <div className="flex justify-end pt-2 border-t border-slate-300/30">
                      <button
                        type="button"
                        onClick={() => setPrintingItem(sale)}
                        className="neu-btn flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-blue-700 hover:text-blue-900"
                      >
                        <Printer className="h-4 w-4 text-blue-600" /> Print Sale Proceed (Ref 1)
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Password-Protected Delete Confirmation Modal */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Sale Proceeds?"
        itemTitle={sales.find((s) => s.id === deleteId)?.proceedsNo}
        description="The sale proceeds record will be moved to the Trash / Recycle Bin. You can restore it anytime with complete ledger accuracy."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Modal for Add / Edit */}
      <SaleProceedsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editItem={editingItem}
        onSaved={refreshList}
      />

      {/* Traditional Bill Print Modal (Reference 1) */}
      {printingItem && (
        <SaleProceedPrintModal
          isOpen={!!printingItem}
          onClose={() => setPrintingItem(null)}
          proceeds={printingItem}
        />
      )}
    </div>
  );
};
