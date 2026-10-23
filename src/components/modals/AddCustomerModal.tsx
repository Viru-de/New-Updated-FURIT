import React, { useState } from 'react';
import { Customer } from '../../types';
import { db } from '../../services/db';
import { X, Plus, UserPlus } from 'lucide-react';
import { ImageUploader } from '../common/ImageUploader';

interface AddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCustomerCreated: (customer: Customer) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({
  isOpen,
  onClose,
  onCustomerCreated,
}) => {
  const crateTypes = db.getCrateTypes();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [altMobile, setAltMobile] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number | ''>(0);
  const [openingBalanceType, setOpeningBalanceType] = useState<'debit' | 'credit'>('debit');
  const [openingCrateBalance, setOpeningCrateBalance] = useState<number | ''>(0);
  const [crateTypeId, setCrateTypeId] = useState(crateTypes[0]?.id || '');
  const [notes, setNotes] = useState('');
  const [photo, setPhoto] = useState<string | undefined>(undefined);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCustomer: Customer = {
      id: `c-${Date.now()}`,
      name: name.trim(),
      mobile: mobile.trim(),
      altMobile: altMobile.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      aadhaarNo: aadhaarNo.trim() || undefined,
      openingBalance: Number(openingBalance) || 0,
      openingBalanceType,
      openingCrateBalance: Number(openingCrateBalance) || 0,
      crateTypeId,
      notes: notes.trim() || undefined,
      photo,
      active: true,
      createdAt: new Date().toISOString(),
    };

    db.saveCustomer(newCustomer);
    onCustomerCreated(newCustomer);
    onClose();

    // Reset
    setName('');
    setMobile('');
    setAltMobile('');
    setAddress('');
    setAadhaarNo('');
    setPhoto(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Add New Wholesale Customer
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Customer / Firm Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. ABC Customer, Ganesh Fruit Traders"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Customer Photo Upload */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
            <ImageUploader
              label="Customer Photo (Optional)"
              helperText="Upload buyer/vendor photo. Preview and replace anytime."
              currentValue={photo}
              onChange={setPhoto}
              previewShape="rounded"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Primary Mobile
              </label>
              <input
                type="tel"
                placeholder="10-digit mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Alternate Mobile
              </label>
              <input
                type="tel"
                placeholder="Optional"
                value={altMobile}
                onChange={(e) => setAltMobile(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              City / Market Yard
            </label>
            <input
              type="text"
              placeholder="e.g. Mumbai, Pune"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Aadhaar Card No.
            </label>
            <input
              type="text"
              placeholder="12-digit Aadhaar (e.g. 2345 6789 0123)"
              maxLength={14}
              value={aadhaarNo}
              onChange={(e) => setAadhaarNo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Address / Gala No.
            </label>
            <input
              type="text"
              placeholder="Shop / Gala / Stall address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60">
            <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Opening Balances (Money & Crate)
            </h4>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2">
                <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Opening Balance (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Balance Type
                </label>
                <select
                  value={openingBalanceType}
                  onChange={(e) => setOpeningBalanceType(e.target.value as 'debit' | 'credit')}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="debit">Dr (Due from customer)</option>
                  <option value="credit">Cr (Advance payment)</option>
                </select>
              </div>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Opening Crate Balance (Qty)
                </label>
                <input
                  type="number"
                  value={openingCrateBalance}
                  onChange={(e) => setOpeningCrateBalance(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-slate-600 dark:text-slate-400">
                  Default Crate Type
                </label>
                <select
                  value={crateTypeId}
                  onChange={(e) => setCrateTypeId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  {crateTypes.map((ct) => (
                    <option key={ct.id} value={ct.id}>
                      {ct.name} ({ct.defaultWeightKg} KG)
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4" /> Save Customer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
