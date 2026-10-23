import React, { useState } from 'react';
import { Customer } from '../../types';
import { db } from '../../services/db';
import { getAllCustomerOutstandings } from '../../services/accounting';
import { formatCurrency } from '../../utils/formatters';
import { AddCustomerModal } from '../modals/AddCustomerModal';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { ImageUploader } from '../common/ImageUploader';
import { CreditSaleModal } from '../accounts/CreditSaleModal';
import { ReceiptModal } from '../accounts/ReceiptModal';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportCustomers } from '../../utils/excelEngine';
import {
  UserPlus,
  Search,
  BookOpen,
  Box,
  ShoppingBag,
  CreditCard,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  AlertCircle,
  X,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';

interface CustomerDirectoryViewProps {
  onNavigateToLedger: (customerId: string) => void;
  onNavigateToCrate: (customerId: string) => void;
  onNavigateToCreditSales: (customerId: string) => void;
  onNavigateToReceipts: (customerId: string) => void;
}

export const CustomerDirectoryView: React.FC<CustomerDirectoryViewProps> = ({
  onNavigateToLedger,
  onNavigateToCrate,
  onNavigateToCreditSales,
  onNavigateToReceipts,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [, setVersion] = useState(0);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit Customer Modal State
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editGstin, setEditGstin] = useState('');
  const [editAadhaarNo, setEditAadhaarNo] = useState('');
  const [editPhoto, setEditPhoto] = useState<string | undefined>(undefined);

  // Quick action modals
  const [activeCustomerIdForSale, setActiveCustomerIdForSale] = useState<string | null>(null);
  const [activeCustomerIdForReceipt, setActiveCustomerIdForReceipt] = useState<string | null>(null);

  const outstandings = getAllCustomerOutstandings();

  const filtered = outstandings.filter((o) => {
    const q = searchTerm.toLowerCase();
    return (
      o.customer.name.toLowerCase().includes(q) ||
      (o.customer.mobile && o.customer.mobile.includes(q)) ||
      (o.customer.city && o.customer.city.toLowerCase().includes(q)) ||
      (o.customer.gstin && o.customer.gstin.toLowerCase().includes(q)) ||
      (o.customer.aadhaarNo && o.customer.aadhaarNo.includes(q))
    );
  });

  const handleEditClick = (c: Customer) => {
    setEditingCustomer(c);
    setEditName(c.name);
    setEditMobile(c.mobile || '');
    setEditCity(c.city || '');
    setEditAddress(c.address || '');
    setEditGstin(c.gstin || '');
    setEditAadhaarNo(c.aadhaarNo || '');
    setEditPhoto(c.photo);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer || !editName.trim()) return;

    const updated: Customer = {
      ...editingCustomer,
      name: editName.trim(),
      mobile: editMobile.trim(),
      city: editCity.trim() || undefined,
      address: editAddress.trim() || undefined,
      gstin: editGstin.trim() || undefined,
      aadhaarNo: editAadhaarNo.trim() || undefined,
      photo: editPhoto,
    };

    db.saveCustomer(updated);
    setEditingCustomer(null);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const cust = db.getCustomerById(deleteId);
      if (cust) {
        const relatedCreditSales = db.getCreditSales().filter((s) => s.customerId === deleteId);
        const relatedCashSales = db.getCashSales().filter((s) => s.customerId === deleteId);
        const relatedReceipts = db.getReceipts().filter((r) => r.customerId === deleteId);
        db.moveToTrash(
          'customer',
          cust.id,
          cust.name,
          `Mobile: ${cust.mobile || 'N/A'} · City: ${cust.city || 'Mandi'} · Opening Bal: ₹${cust.openingBalance}`,
          cust,
          {
            creditSales: relatedCreditSales,
            cashSales: relatedCashSales,
            receipts: relatedReceipts,
          }
        );
      } else {
        db.deleteCustomer(deleteId);
      }
      setDeleteId(null);
      setVersion((v) => v + 1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Customer Directory
          </h2>
          <p className="text-xs text-slate-500">
            Wholesale buyers, mandi commission clients, ledger balances and crate accounts
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="customers"
            moduleTitle="Customer Master"
            onExportFiltered={() => exportCustomers(filtered.map((f) => f.customer), '_Filtered')}
            onExportAll={() => exportCustomers(db.getCustomers())}
            filteredCount={filtered.length}
            totalCount={outstandings.length}
            onImportComplete={() => setVersion((v) => v + 1)}
          />
          <button
            type="button"
            onClick={() => {
              setEditingCustomer(null);
              setIsAddCustomerOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <UserPlus className="h-4 w-4" /> + Add New Customer
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by customer name, mobile, city, GSTIN..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:bg-slate-900 dark:text-white"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => {
          const { customer, closingBalance, crateBalance, crateKg } = item;
          return (
            <div
              key={customer.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-2xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-start gap-3 min-w-0">
                    <CustomerAvatar
                      photo={customer.photo}
                      name={customer.name}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate dark:text-white">
                        {customer.name}
                      </h3>
                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                        {customer.mobile && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {customer.mobile}
                          </span>
                        )}
                        {customer.city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> {customer.city}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditClick(customer)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      title="Edit Customer & Photo"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(customer.id)}
                      className="p-1 text-slate-400 hover:text-rose-500"
                      title="Delete Customer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {customer.address && (
                  <p className="text-[11px] text-slate-500 line-clamp-1 mb-3">
                    {customer.address}
                  </p>
                )}

                {/* Balances strip */}
                <div className="grid grid-cols-2 gap-2 my-3 rounded-lg border border-slate-100 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Outstanding (₹)
                    </span>
                    <span
                      className={`font-mono-numbers text-xs sm:text-sm font-bold ${
                        closingBalance > 0
                          ? 'text-rose-600 dark:text-rose-400'
                          : closingBalance < 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {formatCurrency(closingBalance)}
                    </span>
                  </div>

                  <div>
                    <span className="block text-[10px] uppercase font-bold text-slate-400">
                      Crate Balance
                    </span>
                    <span className="font-mono-numbers text-xs sm:text-sm font-bold text-sky-700 dark:text-sky-300">
                      {crateBalance} Crates ({crateKg} KG)
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons as requested in Section 14 */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onNavigateToLedger(customer.id)}
                    className="flex items-center justify-center gap-1 rounded bg-slate-100 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                  >
                    <BookOpen className="h-3 w-3" /> View Ledger
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigateToCrate(customer.id)}
                    className="flex items-center justify-center gap-1 rounded bg-sky-50 py-1.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300"
                  >
                    <Box className="h-3 w-3" /> Crate Statement
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setActiveCustomerIdForSale(customer.id)}
                    className="flex items-center justify-center gap-1 rounded bg-emerald-50 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <ShoppingBag className="h-3 w-3" /> + Credit Sale
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveCustomerIdForReceipt(customer.id)}
                    className="flex items-center justify-center gap-1 rounded bg-emerald-50 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    <CreditCard className="h-3 w-3" /> + Receipt
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Password-Protected Delete Confirmation */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Customer Record?"
        itemTitle={db.getCustomerById(deleteId || '')?.name}
        description="The customer will be moved to the Trash / Recycle Bin with all balances preserved. You can restore this customer anytime."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Modals */}
      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={() => setIsAddCustomerOpen(false)}
      />

      {/* Edit Customer Modal */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Customer & Photo
              </h3>
              <button
                type="button"
                onClick={() => setEditingCustomer(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer / Firm Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Photo Uploader */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <ImageUploader
                  label="Customer Photo"
                  helperText="Upload or update customer photo. Preview before saving."
                  currentValue={editPhoto}
                  onChange={setEditPhoto}
                  previewShape="rounded"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City / Mandi Yard
                  </label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={(e) => setEditCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Aadhaar Card No.
                </label>
                <input
                  type="text"
                  placeholder="12-digit Aadhaar"
                  maxLength={14}
                  value={editAadhaarNo}
                  onChange={(e) => setEditAadhaarNo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Address / Gala No.
                </label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeCustomerIdForSale && (
        <CreditSaleModal
          isOpen={true}
          onClose={() => setActiveCustomerIdForSale(null)}
          preselectedCustomerId={activeCustomerIdForSale}
          onSaved={() => setActiveCustomerIdForSale(null)}
        />
      )}

      {activeCustomerIdForReceipt && (
        <ReceiptModal
          isOpen={true}
          onClose={() => setActiveCustomerIdForReceipt(null)}
          preselectedCustomerId={activeCustomerIdForReceipt}
          onSaved={() => setActiveCustomerIdForReceipt(null)}
        />
      )}
    </div>
  );
};
