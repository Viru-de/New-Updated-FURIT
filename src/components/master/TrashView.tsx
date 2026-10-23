import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import { TrashItem } from '../../types';
import { formatDate } from '../../utils/formatters';
import { AdminPasswordModal } from '../common/AdminPasswordModal';
import {
  Trash2,
  RotateCcw,
  Search,
  AlertTriangle,
  Users,
  Apple,
  ShoppingBag,
  Banknote,
  ReceiptText,
  CreditCard,
  Building,
  FileText,
  CheckCircle2,
  Clock,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

interface TrashViewProps {
  onNavigateToCustomerLedger?: (customerId: string) => void;
}

export const TrashView: React.FC<TrashViewProps> = () => {
  const [trashItems, setTrashItems] = useState<TrashItem[]>(db.getTrash());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Password confirmation states
  const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);
  const [isEmptyTrashOpen, setIsEmptyTrashOpen] = useState(false);

  const refreshTrash = () => {
    setTrashItems(db.getTrash());
  };

  useEffect(() => {
    const unsub = db.subscribe(refreshTrash);
    return unsub;
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleRestore = (item: TrashItem) => {
    const result = db.restoreFromTrash(item.id);
    if (result.success) {
      showToast(result.message);
      refreshTrash();
    } else {
      alert(result.message);
    }
  };

  const handleConfirmPermanentDelete = () => {
    if (permanentDeleteId) {
      db.permanentDeleteTrash(permanentDeleteId);
      setPermanentDeleteId(null);
      refreshTrash();
      showToast('Item permanently deleted from database.');
    }
  };

  const handleConfirmEmptyTrash = () => {
    db.emptyTrash();
    setIsEmptyTrashOpen(false);
    refreshTrash();
    showToast('Trash / Recycle Bin emptied completely.');
  };

  const filteredItems = trashItems.filter((item) => {
    const typeMatch = selectedType === 'all' || item.itemType === selectedType;
    const query = searchTerm.toLowerCase().trim();
    const textMatch =
      !query ||
      item.title.toLowerCase().includes(query) ||
      (item.subtitle && item.subtitle.toLowerCase().includes(query)) ||
      item.itemId.toLowerCase().includes(query);
    return typeMatch && textMatch;
  });

  const getItemTypeBadge = (type: TrashItem['itemType']) => {
    switch (type) {
      case 'customer':
        return { label: 'Customer', color: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300', icon: Users };
      case 'fruit':
        return { label: 'Fruit Item', color: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300', icon: Apple };
      case 'creditSale':
        return { label: 'Credit Sale', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/50 dark:text-indigo-300', icon: ShoppingBag };
      case 'cashSale':
        return { label: 'Cash Sale', color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300', icon: Banknote };
      case 'receipt':
        return { label: 'Receipt', color: 'bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-300', icon: CreditCard };
      case 'saleProceeds':
        return { label: 'Sale Proceeds', color: 'bg-purple-100 text-purple-800 dark:bg-purple-950/50 dark:text-purple-300', icon: ReceiptText };
      case 'bill':
        return { label: 'Mandi Bill', color: 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300', icon: FileText };
      case 'vendor':
        return { label: 'Vendor', color: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-300', icon: Building };
      default:
        return { label: type, color: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300', icon: FileText };
    }
  };

  const countsByType = {
    all: trashItems.length,
    customer: trashItems.filter((i) => i.itemType === 'customer').length,
    fruit: trashItems.filter((i) => i.itemType === 'fruit').length,
    creditSale: trashItems.filter((i) => i.itemType === 'creditSale').length,
    cashSale: trashItems.filter((i) => i.itemType === 'cashSale').length,
    receipt: trashItems.filter((i) => i.itemType === 'receipt').length,
    saleProceeds: trashItems.filter((i) => i.itemType === 'saleProceeds').length,
    bill: trashItems.filter((i) => i.itemType === 'bill').length,
    vendor: trashItems.filter((i) => i.itemType === 'vendor').length,
  };

  const targetPermanentItem = trashItems.find((i) => i.id === permanentDeleteId);

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white shadow-xl animate-fade-in">
          <CheckCircle2 className="h-4 w-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Trash2 className="h-6 w-6 text-rose-600" />
            Trash / Recycle Bin
          </h2>
          <p className="text-xs text-slate-500">
            Protected archive for deleted customers, invoices, fruits, receipts & business data. Restore anytime.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refreshTrash}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          {trashItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsEmptyTrashOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer shadow-xs"
            >
              <Trash2 className="h-3.5 w-3.5" /> Empty Trash
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { id: 'all', label: 'All Records', count: countsByType.all },
            { id: 'customer', label: 'Customers', count: countsByType.customer },
            { id: 'creditSale', label: 'Credit Sales', count: countsByType.creditSale },
            { id: 'cashSale', label: 'Cash Sales', count: countsByType.cashSale },
            { id: 'receipt', label: 'Receipts', count: countsByType.receipt },
            { id: 'saleProceeds', label: 'Sale Proceeds', count: countsByType.saleProceeds },
            { id: 'fruit', label: 'Fruit Items', count: countsByType.fruit },
            { id: 'bill', label: 'Mandi Bills', count: countsByType.bill },
            { id: 'vendor', label: 'Vendors', count: countsByType.vendor },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSelectedType(tab.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
                selectedType === tab.id
                  ? 'bg-slate-900 text-white shadow-2xs dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  selectedType === tab.id
                    ? 'bg-white/20 text-white dark:bg-slate-900/20 dark:text-slate-900'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search deleted records by title, customer, invoice no, or details..."
            className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-4 py-2 text-xs text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>

      {/* Trash Records Table / List */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500 mb-3">
              <Trash2 className="h-7 w-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Recycle Bin is Empty
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
              No deleted items found in this section. Whenever any customer, bill, fruit or transaction is removed, it is securely archived here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredItems.map((item) => {
              const badge = getItemTypeBadge(item.itemType);
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={item.id}
                  className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2.5 rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 shrink-0 mt-0.5">
                      <BadgeIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {item.title}
                        </span>
                        <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ${badge.color}`}>
                          {badge.label}
                        </span>
                      </div>
                      {item.subtitle && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 break-words">
                          {item.subtitle}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Moved to trash: {formatDate(item.deletedAt.split('T')[0])}
                        </span>
                        <span>·</span>
                        <span>Deleted by: {item.deletedBy}</span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleRestore(item)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 px-3 py-1.5 text-xs font-semibold border border-emerald-200 dark:border-emerald-800 cursor-pointer shadow-2xs"
                      title="Restore record back to active database"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Restore Record
                    </button>
                    <button
                      type="button"
                      onClick={() => setPermanentDeleteId(item.id)}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 px-2.5 py-1.5 text-xs font-medium cursor-pointer"
                      title="Permanently remove from database (Admin password required)"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete Forever
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Password-Protected Permanent Deletion Modal */}
      <AdminPasswordModal
        isOpen={!!permanentDeleteId}
        title="Permanently Delete Record?"
        itemTitle={targetPermanentItem?.title}
        description="This will permanently delete this record from the database. It CANNOT be recovered after this step."
        confirmText="Verify & Delete Forever"
        isPermanent={true}
        onConfirm={handleConfirmPermanentDelete}
        onClose={() => setPermanentDeleteId(null)}
      />

      {/* Password-Protected Empty Trash Modal */}
      <AdminPasswordModal
        isOpen={isEmptyTrashOpen}
        title="Empty Entire Recycle Bin?"
        itemTitle={`All ${trashItems.length} deleted records`}
        description="This will permanently erase all archived records currently in the Recycle Bin. This action cannot be reversed."
        confirmText="Verify & Empty Trash"
        isPermanent={true}
        onConfirm={handleConfirmEmptyTrash}
        onClose={() => setIsEmptyTrashOpen(false)}
      />
    </div>
  );
};
