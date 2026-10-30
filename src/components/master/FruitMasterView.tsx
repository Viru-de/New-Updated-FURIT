import React, { useState } from 'react';
import { Fruit, CrateType } from '../../types';
import { db } from '../../services/db';
import { formatCurrency } from '../../utils/formatters';
import { AddFruitModal } from '../modals/AddFruitModal';
import { FruitBadge } from '../common/FruitIconHelper';
import { FruitIconSelector } from '../common/FruitIconSelector';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportFruitMaster } from '../../utils/excelEngine';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Package,
} from 'lucide-react';
import { AdminPasswordModal } from '../common/AdminPasswordModal';
import { QuantityInput } from '../common/QuantityInput';

export const FruitMasterView: React.FC = () => {
  const [fruits, setFruits] = useState<Fruit[]>(db.getFruits());
  const [crateTypes, setCrateTypes] = useState<CrateType[]>(db.getCrateTypes());
  const units = db.getUnits();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingFruit, setEditingFruit] = useState<Fruit | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Edit modal state
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');
  const [editCrateType, setEditCrateType] = useState('');
  const [editPrice, setEditPrice] = useState<number | ''>(1);
  const [editFruitIcon, setEditFruitIcon] = useState<string | undefined>(undefined);

  const refreshList = () => {
    setFruits(db.getFruits());
    setCrateTypes(db.getCrateTypes());
  };

  const handleEditClick = (f: Fruit) => {
    setEditingFruit(f);
    setEditName(f.name);
    // Load exact saved unit without forcing 'Crate'
    const unitVal = f.unit !== undefined && f.unit !== null ? f.unit : (f.defaultUnit || '');
    setEditUnit(unitVal);
    const ctVal = f.crateType !== undefined ? f.crateType : (f.crateName || '');
    setEditCrateType(ctVal);
    // Preserve existing saved price; default 1 if unset, missing, empty, or undefined
    const rawRate = f.defaultRate ?? (f as any).rate ?? (f as any).price;
    let initialPrice = 1;
    if (rawRate !== undefined && rawRate !== null && String(rawRate).trim() !== '') {
      const parsed = Number(rawRate);
      if (!isNaN(parsed)) {
        initialPrice = parsed;
      }
    }
    setEditPrice(initialPrice);
    setEditFruitIcon(f.fruitIcon);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFruit || !editName.trim()) return;

    // Preserve exact user unit text without forcing 'Crate' or changing casing
    const savedUnit = editUnit !== undefined ? editUnit : (editingFruit.unit || editingFruit.defaultUnit || '');
    const savedCrateType = editCrateType !== undefined ? editCrateType.trim() : '';

    // If editPrice was entered, use it; if blank/empty, prevent unintentional wiping: fallback to existing saved price or 1
    const savedPrice = editPrice !== '' && !isNaN(Number(editPrice))
      ? Number(editPrice)
      : (typeof editingFruit.defaultRate === 'number' && !isNaN(editingFruit.defaultRate) ? editingFruit.defaultRate : 1);

    const updated: Fruit = {
      ...editingFruit,
      name: editName.trim(),
      unit: savedUnit,
      defaultUnit: savedUnit, // preserved for backward compatibility
      crateType: savedCrateType,
      crateName: savedCrateType,
      crateTypeId: savedCrateType ? (editingFruit.crateTypeId || 'ct_20') : undefined,
      crateWeightKg: 0,
      defaultRate: savedPrice,
      fruitIcon: editFruitIcon,
    };

    db.saveFruit(updated);
    setEditingFruit(null);
    refreshList();
  };

  const confirmDelete = () => {
    if (deleteId) {
      const fruit = fruits.find((f) => f.id === deleteId);
      if (fruit) {
        db.moveToTrash(
          'fruit',
          fruit.id,
          fruit.name,
          `Default Unit: ${fruit.defaultUnit || 'Crate'} · Rate: ₹${fruit.defaultRate}`,
          fruit
        );
      } else {
        db.deleteFruit(deleteId);
      }
      setDeleteId(null);
      refreshList();
    }
  };

  const isEditUnitCrate = editUnit.trim().toLowerCase() === 'crate';

  const q = searchTerm.trim().toLowerCase();

  const filtered = React.useMemo(() => {
    if (!q) return fruits;

    const scored = fruits
      .map((f) => {
        const nameLower = f.name.toLowerCase();
        const catLower = f.category ? f.category.toLowerCase() : '';
        const unitLower = (f.unit || f.defaultUnit || '').toLowerCase();
        const idLower = f.id.toLowerCase();

        if (nameLower === q) return { fruit: f, score: 0 };
        if (nameLower.startsWith(q)) return { fruit: f, score: 1 };
        const words = nameLower.split(/\s+/);
        if (words.some((w) => w.startsWith(q))) return { fruit: f, score: 2 };
        if (nameLower.includes(q)) return { fruit: f, score: 3 };
        if (catLower.startsWith(q)) return { fruit: f, score: 4 };
        if (catLower.includes(q)) return { fruit: f, score: 5 };
        if (unitLower.includes(q)) return { fruit: f, score: 6 };
        if (idLower.includes(q)) return { fruit: f, score: 7 };

        return null;
      })
      .filter((entry): entry is { fruit: Fruit; score: number } => entry !== null);

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return a.fruit.name.localeCompare(b.fruit.name);
    });

    return scored.map((s) => s.fruit);
  }, [fruits, q]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Fruit / Item Master
          </h2>
          <p className="text-xs text-slate-500">
            Wholesale item catalog, standard units, crate sizes & default item prices
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="fruitMaster"
            moduleTitle="Fruit / Item Master"
            onExportFiltered={() => exportFruitMaster(filtered, '_Filtered')}
            onExportAll={() => exportFruitMaster(fruits)}
            filteredCount={filtered.length}
            totalCount={fruits.length}
            onImportComplete={refreshList}
          />
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
          >
            <Plus className="h-4 w-4" /> + Add New Item
          </button>
        </div>
      </div>

      {/* Search by Item Name */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by item name, category or unit (e.g. Apple, Strawberry, Mango)..."
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

      {/* Items Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map((fruit) => {
          const unit = fruit.unit || fruit.defaultUnit || 'Crate';
          const crateTypeLabel = fruit.crateType !== undefined ? fruit.crateType : (fruit.crateName || '');

          return (
            <div
              key={fruit.id}
              className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-2xs transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FruitBadge
                      fruitIcon={fruit.fruitIcon}
                      fruitName={fruit.name}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-slate-900 truncate dark:text-white">
                        {fruit.name}
                      </h3>
                      <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block truncate">
                        Unit: {unit}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleEditClick(fruit)}
                      className="p-1 text-slate-400 hover:text-slate-700"
                      title="Edit Item"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(fruit.id)}
                      className="p-1 text-slate-400 hover:text-rose-600"
                      title="Delete Item"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unit:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {unit}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Crate Type:</span>
                    <span className="font-semibold text-sky-700 dark:text-sky-300">
                      {crateTypeLabel || '-'}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-slate-500">Price:</span>
                    <span className="font-mono-numbers font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(fruit.defaultRate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span>{crateTypeLabel ? `${crateTypeLabel} · ${unit}` : unit}</span>
                <span className="text-emerald-600 font-medium">Active</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Item Modal */}
      <AddFruitModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onFruitCreated={refreshList}
      />

      {/* Edit Item Modal */}
      {editingFruit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Item
              </h3>
              <button
                type="button"
                onClick={() => setEditingFruit(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Item Icon / Image selection */}
              <FruitIconSelector
                value={editFruitIcon}
                onChange={setEditFruitIcon}
                fruitName={editName}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Unit (free-text)
                  </label>
                  <input
                    type="text"
                    list="edit-fruit-units"
                    placeholder="e.g. Crate, Peti, Box, KG"
                    value={editUnit}
                    onChange={(e) => setEditUnit(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <datalist id="edit-fruit-units">
                    <option value="Crate" />
                    <option value="Peti" />
                    <option value="Box" />
                    <option value="KG" />
                    <option value="Bag" />
                    <option value="Piece" />
                    <option value="Nag" />
                  </datalist>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Price/Rate (₹) *
                  </label>
                  <QuantityInput
                    step="any"
                    min={0}
                    required
                    placeholder="1"
                    value={editPrice}
                    onChange={(val) => setEditPrice(val)}
                    onBlur={() => {
                      if (editPrice === '' || editPrice === undefined) {
                        setEditPrice(1);
                      }
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  list="edit-fruit-crates"
                  placeholder="e.g. 20kg, 10kg (leave blank if none)"
                  value={editCrateType}
                  onChange={(e) => setEditCrateType(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <datalist id="edit-fruit-crates">
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
                  onClick={() => setEditingFruit(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password-Protected Delete confirmation */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Fruit / Item?"
        itemTitle={fruits.find((f) => f.id === deleteId)?.name}
        description="The fruit item will be moved to the Trash / Recycle Bin. You can restore it anytime without affecting transaction history."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />
    </div>
  );
};
