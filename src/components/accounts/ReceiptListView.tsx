import React, { useState } from 'react';
import { Receipt } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ReceiptModal } from './ReceiptModal';
import { ReceiptPrintModal } from '../print/ReceiptPrintModal';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportReceipts } from '../../utils/excelEngine';
import {
  Plus,
  Search,
  X,
  Edit2,
  Trash2,
  CreditCard,
  AlertCircle,
  FileText,
  Printer,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';

interface ReceiptListViewProps {
  onNavigateToCustomerLedger?: (customerId: string) => void;
}

export const ReceiptListView: React.FC<ReceiptListViewProps> = ({
  onNavigateToCustomerLedger,
}) => {
  const [receipts, setReceipts] = useState<Receipt[]>(db.getReceipts());
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Receipt | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState<Receipt | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const refreshList = () => {
    setReceipts(db.getReceipts());
  };

  const handleEdit = (item: Receipt) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const rec = receipts.find((r) => r.id === deleteId);
      if (rec) {
        db.moveToTrash(
          'receipt',
          rec.id,
          rec.receiptNo,
          `Customer: ${rec.customerName} · Amount: ₹${rec.amount} · Mode: ${rec.paymentMode}`,
          rec
        );
      } else {
        db.deleteReceipt(deleteId);
      }
      setDeleteId(null);
      refreshList();
    }
  };

  const filteredReceipts = React.useMemo(() => {
    if (!searchTerm.trim()) return receipts;
    const q = searchTerm.trim().toLowerCase();

    const matches = receipts.filter((r) => {
      return (
        r.receiptNo.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        r.paymentMode.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    });

    return matches.sort((a, b) => {
      const aCust = a.customerName.toLowerCase();
      const bCust = b.customerName.toLowerCase();
      const aNo = a.receiptNo.toLowerCase();
      const bNo = b.receiptNo.toLowerCase();

      // Check customer prefix
      const aCustStarts = aCust.startsWith(q);
      const bCustStarts = bCust.startsWith(q);
      if (aCustStarts && !bCustStarts) return -1;
      if (!aCustStarts && bCustStarts) return 1;

      // Check receipt no prefix
      const aNoStarts = aNo.startsWith(q);
      const bNoStarts = bNo.startsWith(q);
      if (aNoStarts && !bNoStarts) return -1;
      if (!aNoStarts && bNoStarts) return 1;

      // Check customer word start
      const aCustWord = aCust.includes(' ' + q);
      const bCustWord = bCust.includes(' ' + q);
      if (aCustWord && !bCustWord) return -1;
      if (!aCustWord && bCustWord) return 1;

      return b.date.localeCompare(a.date);
    });
  }, [receipts, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Receipts / Cash A/C
          </h2>
          <p className="text-xs text-slate-500">
            Cash, UPI & Bank collections credited directly to customer ledger
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="receipts"
            moduleTitle="Receipts"
            onExportFiltered={() => exportReceipts(filteredReceipts, '_Filtered')}
            onExportAll={() => exportReceipts(receipts)}
            filteredCount={filteredReceipts.length}
            totalCount={receipts.length}
            onImportComplete={() => setReceipts(db.getReceipts())}
          />
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> + Create Receipt
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by receipt number, customer, payment mode..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:bg-slate-900 dark:text-white"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            title="Clear search"
          >
            <X className="h-3 w-3" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Receipts Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-5 py-3.5 w-32">Date</th>
                <th className="px-5 py-3.5 w-40">Receipt No.</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5 w-36">Mode</th>
                <th className="px-5 py-3.5">Notes</th>
                <th className="px-5 py-3.5 text-right w-36">Amount (₹)</th>
                <th className="px-5 py-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredReceipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-xs text-slate-500">
                    No receipts found.
                  </td>
                </tr>
              ) : (
                filteredReceipts.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3 font-mono-numbers text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(r.date)}
                    </td>
                    <td className="px-5 py-3 font-bold text-xs text-slate-900 dark:text-white">
                      {r.receiptNo}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        type="button"
                        onClick={() => onNavigateToCustomerLedger?.(r.customerId)}
                        className="font-semibold text-xs text-slate-900 hover:text-emerald-600 dark:text-white dark:hover:text-emerald-400 text-left"
                      >
                        {r.customerName}
                      </button>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-800">
                        {r.paymentMode}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500 truncate max-w-xs">
                      {r.notes || '-'}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-numbers text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(r.amount)}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setPrintingReceipt(r)}
                          className="p-1 text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                          title="Print Receipt"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(r)}
                          className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                          title="Edit Receipt"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(r.id)}
                          className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                          title="Delete Receipt"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password-Protected Delete Confirmation */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Receipt?"
        itemTitle={receipts.find((r) => r.id === deleteId)?.receiptNo}
        description="The receipt record will be moved to the Trash / Recycle Bin. You can restore it anytime with complete ledger accuracy."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Modal */}
      <ReceiptModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editItem={editingItem}
        onSaved={refreshList}
        onSaveAndPrint={(savedReceipt) => {
          refreshList();
          setIsModalOpen(false);
          setPrintingReceipt(savedReceipt);
        }}
      />

      {/* Print Receipt Modal */}
      {printingReceipt && (
        <ReceiptPrintModal
          isOpen={!!printingReceipt}
          onClose={() => setPrintingReceipt(null)}
          receipt={printingReceipt}
        />
      )}
    </div>
  );
};
