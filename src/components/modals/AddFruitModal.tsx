import React, { useState } from 'react';
import { Fruit, CrateType } from '../../types';
import { db } from '../../services/db';
import { X, Plus, Package } from 'lucide-react';
import { FruitIconSelector } from '../common/FruitIconSelector';
import { QuantityInput } from '../common/QuantityInput';

interface AddFruitModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFruitCreated: (fruit: Fruit) => void;
}

export const AddFruitModal: React.FC<AddFruitModalProps> = ({
  isOpen,
  onClose,
  onFruitCreated,
}) => {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('');
  const [crateType, setCrateType] = useState('');
  // Default Price/Rate is 1 for new items
  const [price, setPrice] = useState<number | ''>(1);
  const [fruitIcon, setFruitIcon] = useState<string | undefined>(undefined);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Save exact unit text entered by user without altering capitalization, spacing, or defaulting
    const savedUnit = unit;
    const savedCrateType = crateType.trim();

    const newFruit: Fruit = {
      id: `f-${Date.now()}`,
      name: name.trim(),
      unit: savedUnit,
      defaultUnit: savedUnit, // for backward compatibility
      crateType: savedCrateType,
      crateName: savedCrateType,
      crateTypeId: savedCrateType ? 'ct_20' : undefined,
      crateWeightKg: savedCrateType ? 20 : 0,
      defaultRate: price !== '' ? Number(price) : 1, // Default price is 1
      fruitIcon,
      active: true,
      createdAt: new Date().toISOString(),
    };

    db.saveFruit(newFruit);
    onFruitCreated(newFruit);
    onClose();

    // Reset form for next use - Unit must be completely blank
    setName('');
    setUnit('');
    setCrateType('');
    setPrice(1);
    setFruitIcon(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-emerald-600" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-white">
              Add New Item
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
              Item Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              placeholder="e.g. Grapes Green 20kg, Apple, Mango"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Item Icon / Image selection */}
          <FruitIconSelector
            value={fruitIcon}
            onChange={setFruitIcon}
            fruitName={name}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Unit
              </label>
              <input
                type="text"
                placeholder=""
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Price/Rate (₹) <span className="text-rose-500">*</span>
              </label>
              <QuantityInput
                min={0}
                step="any"
                required
                value={price}
                onChange={(val) => setPrice(val)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Crate Type free-text input */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Crate Type (free-text label)
            </label>
            <input
              type="text"
              list="add-fruit-crates"
              placeholder="e.g. 20kg, 10kg (leave blank if none)"
              value={crateType}
              onChange={(e) => setCrateType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
            <datalist id="add-fruit-crates">
              <option value="20kg" />
              <option value="10kg" />
              <option value="15kg" />
              <option value="24kg" />
            </datalist>
            <p className="mt-1 text-[11px] text-slate-500">
              Only for identification and crate balance tracking. Leave blank if not applicable.
            </p>
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
              <Plus className="h-4 w-4" /> Save Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
