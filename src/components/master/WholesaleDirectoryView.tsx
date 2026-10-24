import React, { useState } from 'react';
import { Vendor } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportVendors } from '../../utils/excelEngine';
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  Phone,
  MapPin,
  X,
  AlertCircle,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';
import { QuantityInput } from '../common/QuantityInput';

export const WholesaleDirectoryView: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>(db.getVendors());
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'credit' | 'debit'>('credit');
  const [notes, setNotes] = useState('');

  const refreshList = () => {
    setVendors(db.getVendors());
  };

  const openAdd = () => {
    setEditingVendor(null);
    setName('');
    setContact('');
    setAddress('');
    setCity('');
    setState('Maharashtra');
    setOpeningBalance(0);
    setOpeningBalanceType('credit');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingVendor(v);
    setName(v.name);
    setContact(v.contact);
    setAddress(v.address || '');
    setCity(v.city || '');
    setState(v.state || 'Maharashtra');
    setOpeningBalance(v.openingBalance);
    setOpeningBalanceType(v.openingBalanceType);
    setNotes(v.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const vendorRecord: Vendor = {
      id: editingVendor ? editingVendor.id : `v-${Date.now()}`,
      name: name.trim(),
      contact: contact.trim(),
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      gstin: editingVendor ? editingVendor.gstin : undefined, // Preserved from historical database record without requesting or modifying in UI
      openingBalance: Number(openingBalance) || 0,
      openingBalanceType,
      notes: notes.trim() || undefined,
      active: true,
      createdAt: editingVendor ? editingVendor.createdAt : new Date().toISOString(),
    };

    db.saveVendor(vendorRecord);
    refreshList();
    setIsModalOpen(false);
  };

  const confirmDelete = () => {
    if (deleteId) {
      const vendor = vendors.find((v) => v.id === deleteId);
      if (vendor) {
        const relatedSaleProceeds = db.getSaleProceeds().filter((sp) => sp.vendorId === deleteId);
        db.moveToTrash(
          'vendor',
          vendor.id,
          vendor.name,
          `Contact: ${vendor.contact} · City: ${vendor.city || 'Mandi'} · Opening Bal: ₹${vendor.openingBalance}`,
          vendor,
          { saleProceeds: relatedSaleProceeds }
        );
      } else {
        db.deleteVendor(deleteId);
      }
      setDeleteId(null);
      refreshList();
    }
  };

  const q = searchTerm.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!q) return vendors;

    const scored = vendors
      .map((v) => {
        const nameLower = v.name.toLowerCase();
        const cityLower = v.city ? v.city.toLowerCase() : '';
        const stateLower = v.state ? v.state.toLowerCase() : '';
        const contact = v.contact || '';
        const idLower = v.id.toLowerCase();

        if (nameLower === q) return { vendor: v, score: 0 };
        if (nameLower.startsWith(q)) return { vendor: v, score: 1 };
        const words = nameLower.split(/\s+/);
        if (words.some((w) => w.startsWith(q))) return { vendor: v, score: 2 };
        if (nameLower.includes(q)) return { vendor: v, score: 3 };
        if (contact.startsWith(q)) return { vendor: v, score: 4 };
        if (cityLower.startsWith(q)) return { vendor: v, score: 5 };
        if (contact.includes(q)) return { vendor: v, score: 6 };
        if (cityLower.includes(q) || stateLower.includes(q)) return { vendor: v, score: 7 };
        if (idLower.includes(q)) return { vendor: v, score: 8 };

        return null;
      })
      .filter((entry): entry is { vendor: Vendor; score: number } => entry !== null);

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.vendor.name.localeCompare(b.vendor.name);
    });

    return scored.map((s) => s.vendor);
  }, [vendors, q]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Wholesale Directory (Vendors & Growers)
          </h2>
          <p className="text-xs text-slate-500">
            Consignors, farmers, valley suppliers and commission partners
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="vendors"
            moduleTitle="Vendor Master"
            onExportFiltered={() => exportVendors(filtered, '_Filtered')}
            onExportAll={() => exportVendors(vendors)}
            filteredCount={filtered.length}
            totalCount={vendors.length}
            onImportComplete={refreshList}
          />
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> + Add Wholesale Vendor
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by vendor name, contact, city..."
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

      {/* Vendors Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-5 py-3.5">Vendor Name</th>
                <th className="px-5 py-3.5">Contact & Location</th>
                <th className="px-5 py-3.5 text-right w-44">Opening Balance</th>
                <th className="px-5 py-3.5 text-right w-44">Payable Outstanding</th>
                <th className="px-5 py-3.5 text-center w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500">
                    No vendors found.
                  </td>
                </tr>
              ) : (
                filtered.map((v) => {
                  const isCredit = v.openingBalanceType === 'credit';
                  return (
                    <tr
                      key={v.id}
                      className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                    >
                      <td className="px-5 py-3.5 font-bold text-xs text-slate-900 dark:text-white">
                        {v.name}
                        {v.notes && (
                          <div className="text-[11px] font-normal text-slate-400">{v.notes}</div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-slate-400" /> {v.contact}
                        </div>
                        {v.city && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <MapPin className="h-3 w-3 text-slate-400" /> {v.city}, {v.state}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-slate-600 dark:text-slate-400">
                        {formatCurrency(v.openingBalance)} ({isCredit ? 'Cr' : 'Dr'})
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono-numbers text-sm font-bold text-slate-900 dark:text-white">
                        {formatCurrency(v.openingBalance)}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(v)}
                            className="p-1 text-slate-400 hover:text-slate-700"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(v.id)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingVendor ? 'Edit Vendor' : 'Add Wholesale Vendor'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Vendor / Consignor Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nashik Valley Growers"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9822012345"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City / Mandi
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    State
                  </label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Opening Balance (₹)
                  </label>
                  <QuantityInput
                    step="any"
                    value={openingBalance}
                    onChange={(val) => setOpeningBalance(val)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={openingBalanceType}
                    onChange={(e) => setOpeningBalanceType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="credit">Cr (Payable to vendor)</option>
                    <option value="debit">Dr (Advance given)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hill harvest strawberry syndicate"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save Vendor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password-Protected Delete confirmation */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Vendor Record?"
        itemTitle={vendors.find((v) => v.id === deleteId)?.name}
        description="The vendor will be moved to the Trash / Recycle Bin with all balances preserved. You can restore this vendor anytime."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
};
