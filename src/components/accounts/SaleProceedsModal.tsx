import React, { useState, useEffect } from 'react';
import { ExpenseItem, Fruit, SaleProceeds, SaleProceedsItem } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatSequence, getTodayIso } from '../../utils/formatters';
import { getFruitEffectivePrice } from '../../utils/fruitUtils';
import { DatePickerInput } from '../common/DatePickerInput';
import { AddFruitModal } from '../modals/AddFruitModal';
import { FruitAutocomplete } from '../common/FruitAutocomplete';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { VendorAutocomplete } from '../common/VendorAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import { calculateWholesaleItemAmount } from '../../utils/billingCalculations';
import { X, Plus, Trash2, Calculator } from 'lucide-react';

interface SaleProceedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: SaleProceeds | null;
  onSaved: (item: SaleProceeds) => void;
}

export interface FormSaleProceedItem {
  id: string;
  fruitId: string;
  fruitName: string;
  quantity: number | '';
  unit: string;
  weight: number | '';
  crateTypeId?: string;
  crateName?: string;
  rate: number | '';
  amount: number | '';
}

export const SaleProceedsModal: React.FC<SaleProceedsModalProps> = ({
  isOpen,
  onClose,
  editItem,
  onSaved,
}) => {
  const fruits = db.getFruits();
  const vendors = db.getVendors();
  const customers = db.getCustomers();
  const crateTypes = db.getCrateTypes();

  const [date, setDate] = useState(getTodayIso());
  const [challanDate, setChallanDate] = useState(getTodayIso());
  const [billNumber, setBillNumber] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');

  // Multi-item rows support
  const [items, setItems] = useState<FormSaleProceedItem[]>([]);

  // Expenses: Freight, Hamali, Postage, etc.
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: 'exp-1', name: 'Freight', amount: 100 },
    { id: 'exp-2', name: 'Hamali', amount: 10 },
    { id: 'exp-3', name: 'Postage', amount: 6 },
  ]);

  const [isAddFruitOpen, setIsAddFruitOpen] = useState(false);
  const [activeFruitRowIndex, setActiveFruitRowIndex] = useState<number>(0);

  useEffect(() => {
    if (editItem) {
      setDate(editItem.date);
      setChallanDate(editItem.challanDate || editItem.date);
      setBillNumber(editItem.billNumber || '');
      setVendorId(editItem.vendorId || '');
      setCustomerId(editItem.customerId || '');
      setNotes(editItem.notes || '');

      // Load items from editItem (preserve existing item rows or map fallback)
      if (editItem.items && editItem.items.length > 0) {
        const loadedItems: FormSaleProceedItem[] = editItem.items.map((it, idx) => {
          const ctMatch = crateTypes.find(
            (c) =>
              c.id === it.crateTypeId ||
              c.name.toLowerCase().includes(String(it.crateName || '').toLowerCase())
          );
          const q = it.quantity !== undefined ? it.quantity : 1;
          const u = it.unit || 'Crate';
          const itemWeight = it.weight !== undefined && it.weight !== null
            ? it.weight
            : (it.kg !== undefined && it.kg !== null
              ? it.kg
              : (editItem.items?.length === 1 && editItem.weight !== undefined && editItem.weight !== null
                ? editItem.weight
                : (editItem.items?.length === 1 && editItem.kg !== undefined && editItem.kg !== null
                  ? editItem.kg
                  : 0)));
          const w = typeof itemWeight === 'number' ? itemWeight : (Number(itemWeight) || 0);
          const r = it.rate !== undefined ? it.rate : 0;
          const a =
            it.amount !== undefined && it.amount !== null
              ? it.amount
              : calculateWholesaleItemAmount(
                  Number(q) || 0,
                  u,
                  Number(w) || 0,
                  Number(r) || 0
                );
          return {
            id: it.id || `spi-${Date.now()}-${idx}`,
            fruitId: it.fruitId || '',
            fruitName: it.fruitName || '',
            quantity: q,
            unit: u,
            weight: w,
            crateTypeId: it.crateTypeId || ctMatch?.id || 'ct_20',
            crateName:
              it.crateName || (ctMatch ? ctMatch.name.replace(/\s*crate$/i, '').trim() : '20kg'),
            rate: r,
            amount: a,
          };
        });
        setItems(loadedItems);
      } else {
        const ctMatch = crateTypes.find(
          (c) =>
            c.id === editItem.crateTypeId ||
            c.name.toLowerCase().includes(String(editItem.crateName || '').toLowerCase())
        );
        const q = editItem.quantity !== undefined ? editItem.quantity : 1;
        const u = editItem.unit || 'Crate';
        const itemWeight = editItem.weight !== undefined && editItem.weight !== null
          ? editItem.weight
          : (editItem.kg !== undefined && editItem.kg !== null ? editItem.kg : 0);
        const w = typeof itemWeight === 'number' ? itemWeight : (Number(itemWeight) || 0);
        const r = editItem.rate !== undefined ? editItem.rate : 0;
        const a =
          editItem.amount !== undefined && editItem.amount !== null
            ? editItem.amount
            : calculateWholesaleItemAmount(
                Number(q) || 0,
                u,
                Number(w) || 0,
                Number(r) || 0
              );
        setItems([
          {
            id: `spi-${Date.now()}-1`,
            fruitId: (editItem as any).fruitId || '',
            fruitName: (editItem as any).fruitName || '',
            quantity: q,
            unit: u,
            weight: w,
            crateTypeId: editItem.crateTypeId || ctMatch?.id || 'ct_20',
            crateName:
              editItem.crateName || (ctMatch ? ctMatch.name.replace(/\s*crate$/i, '').trim() : '20kg'),
            rate: r,
            amount: a,
          },
        ]);
      }

      // Load expenses from editItem or fallback to defaults
      if (editItem.expenses && editItem.expenses.length > 0) {
        setExpenses(
          editItem.expenses.map((e, idx) => ({
            id: e.id || `exp-${Date.now()}-${idx}`,
            name: e.name || 'Expense',
            amount: e.amount !== undefined ? e.amount : 0,
          }))
        );
      } else {
        setExpenses([
          { id: 'exp-1', name: 'Freight', amount: 100 },
          { id: 'exp-2', name: 'Hamali', amount: 10 },
          { id: 'exp-3', name: 'Postage', amount: 6 },
        ]);
      }
    } else {
      // Default new entry
      setDate(getTodayIso());
      setChallanDate(getTodayIso());
      setBillNumber('');
      setVendorId('');
      setCustomerId('');
      setNotes('');

      const ct20 = crateTypes.find((c) => c.name.includes('20')) || crateTypes[0];
      setItems([
        {
          id: `spi-${Date.now()}-1`,
          fruitId: '',
          fruitName: '',
          quantity: 1,
          unit: 'Crate',
          weight: 0,
          crateTypeId: ct20?.id || 'ct_20',
          crateName: ct20 ? ct20.name.replace(/\s*crate$/i, '').trim() : '20kg',
          rate: 0,
          amount: 0,
        },
      ]);

      setExpenses([
        { id: 'exp-1', name: 'Freight', amount: 100 },
        { id: 'exp-2', name: 'Hamali', amount: 10 },
        { id: 'exp-3', name: 'Postage', amount: 6 },
      ]);
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const handleFruitSelect = (index: number, target: Fruit | string) => {
    const fruit = typeof target === 'string' ? fruits.find((f) => f.id === target) : target;
    const updated = [...items];
    const current = { ...updated[index] };

    if (fruit) {
      current.fruitId = fruit.id;
      current.fruitName = fruit.name;
      // 1. Auto-fill Unit
      current.unit = fruit.unit || fruit.defaultUnit || 'Crate';
      // 2. Auto-fill Rate
      const r = getFruitEffectivePrice(fruit);
      const newRate = typeof r === 'number' && !isNaN(r) ? r : (fruit.defaultRate || 1);
      current.rate = newRate;
      // 3. Auto-fill Crate Type
      const ctName = fruit.crateType !== undefined ? fruit.crateType : (fruit.crateName || '');
      current.crateName = ctName || '20kg';
      current.crateTypeId = ctName
        ? (crateTypes.find((c) => c.name.toLowerCase().includes(ctName.toLowerCase()))?.id ||
            fruit.crateTypeId ||
            'ct_20')
        : 'ct_20';
      // 4. Qty defaults to 1 if empty or 0
      if (!current.quantity || current.quantity === 0) {
        current.quantity = 1;
      }
      // 5. Weight defaults to 0
      if (current.weight === '') {
        current.weight = 0;
      }
      // Calculate Amount: Weight > 0 ? Weight * Rate : Qty * Rate
      const numQ = Number(current.quantity) || 0;
      const numW = Number(current.weight) || 0;
      current.amount = calculateWholesaleItemAmount(numQ, current.unit, numW, newRate);
    } else {
      current.fruitId = '';
      current.fruitName = typeof target === 'string' ? target : '';
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleItemChange = (index: number, field: keyof FormSaleProceedItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index] };

    if (field === 'fruitName') {
      current.fruitName = val;
    } else if (field === 'quantity') {
      const q = val === '' ? '' : Number(val);
      current.quantity = q;
      const numQ = q === '' ? 0 : q;
      const numW = current.weight === '' ? 0 : Number(current.weight);
      const numR = current.rate === '' ? 0 : Number(current.rate);
      current.amount = calculateWholesaleItemAmount(numQ, current.unit, numW, numR);
    } else if (field === 'unit') {
      current.unit = val;
      const numQ = current.quantity === '' ? 0 : Number(current.quantity);
      const numW = current.weight === '' ? 0 : Number(current.weight);
      const numR = current.rate === '' ? 0 : Number(current.rate);
      current.amount = calculateWholesaleItemAmount(numQ, val, numW, numR);
    } else if (field === 'weight') {
      const w = val === '' ? '' : Number(val);
      current.weight = w;
      const numW = w === '' ? 0 : w;
      const numQ = current.quantity === '' ? 0 : Number(current.quantity);
      const numR = current.rate === '' ? 0 : Number(current.rate);
      current.amount = calculateWholesaleItemAmount(numQ, current.unit, numW, numR);
    } else if (field === 'crateName') {
      current.crateName = val;
      const ct = crateTypes.find((c) => c.name.toLowerCase().includes(val.toLowerCase()));
      if (ct) current.crateTypeId = ct.id;
    } else if (field === 'rate') {
      const r = val === '' ? '' : Number(val);
      current.rate = r;
      const numR = r === '' ? 0 : r;
      const numQ = current.quantity === '' ? 0 : Number(current.quantity);
      const numW = current.weight === '' ? 0 : Number(current.weight);
      current.amount = calculateWholesaleItemAmount(numQ, current.unit, numW, numR);
    } else if (field === 'amount') {
      current.amount = val === '' ? '' : Number(val);
    }

    updated[index] = current;
    setItems(updated);
  };

  const handleAddRow = () => {
    const ct20 = crateTypes.find((c) => c.name.includes('20')) || crateTypes[0];
    setItems((prev) => [
      ...prev,
      {
        id: `spi-${Date.now()}-${prev.length + 1}`,
        fruitId: '',
        fruitName: '',
        quantity: 1,
        unit: 'Crate',
        weight: 0,
        crateTypeId: ct20?.id || 'ct_20',
        crateName: ct20 ? ct20.name.replace(/\s*crate$/i, '').trim() : '20kg',
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const calculateAutoAllAmounts = () => {
    setItems((prev) =>
      prev.map((it) => {
        const q = it.quantity === '' ? 0 : Number(it.quantity);
        const w = it.weight === '' ? 0 : Number(it.weight);
        const r = it.rate === '' ? 0 : Number(it.rate);
        return {
          ...it,
          amount: calculateWholesaleItemAmount(q, it.unit, w, r),
        };
      })
    );
  };

  const handleExpenseChange = (index: number, field: 'name' | 'amount', val: any) => {
    const updated = [...expenses];
    if (field === 'amount') {
      updated[index].amount = Number(val) || 0;
    } else {
      updated[index].name = val;
    }
    setExpenses(updated);
  };

  const handleAddExpense = () => {
    setExpenses((prev) => [
      ...prev,
      { id: `exp-${Date.now()}-${prev.length + 1}`, name: 'Other', amount: 0 },
    ]);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  const handleFruitCreated = (newFruit: Fruit) => {
    handleFruitSelect(activeFruitRowIndex, newFruit);
  };

  // Calculations
  const totalProductAmount = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalQuantity = items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalWeight = items.reduce((sum, it) => sum + (Number(it.weight) || 0), 0);
  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = totalProductAmount - totalExpense;
  const difference = netAmount - totalProductAmount; // = -totalExpense

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (items.length === 0) return;

    const seq = editItem ? editItem.sequenceNumber : db.getNextSaleProceedsNumber();
    const proceedsNo = editItem
      ? editItem.proceedsNo
      : `Sale Proceeds No. ${formatSequence(seq, 3)}`;

    const selectedVendor = vendors.find((v) => v.id === vendorId);
    const selectedCustomer = customers.find((c) => c.id === customerId);

    const saleItems: SaleProceedsItem[] = items.map((it, idx) => {
      const itemWeight = it.weight === '' ? 0 : Number(it.weight) || 0;
      const itemQty = it.quantity === '' ? 0 : Number(it.quantity) || 0;
      const itemRate = it.rate === '' ? 0 : Number(it.rate) || 0;
      const calculatedAmount = calculateWholesaleItemAmount(itemQty, it.unit, itemWeight, itemRate);
      const itemAmount = it.amount !== '' && it.amount !== undefined ? Number(it.amount) : calculatedAmount;

      return {
        id: it.id || `spi-${Date.now()}-${idx}`,
        fruitId: it.fruitId,
        fruitName: it.fruitName || 'Fruit',
        quantity: itemQty,
        unit: it.unit || 'Crate',
        kg: itemWeight,
        weight: itemWeight,
        crateTypeId: it.crateName ? (it.crateTypeId || 'ct_20') : undefined,
        crateName: it.crateName || undefined,
        rate: itemRate,
        amount: itemAmount,
      };
    });

    const primaryItem = saleItems[0] || {
      id: `spi-${Date.now()}`,
      fruitId: '',
      fruitName: 'Fruit',
      quantity: 0,
      unit: 'Crate',
      kg: 0,
      weight: 0,
      rate: 0,
      amount: 0,
    };

    const saleRecord: SaleProceeds = {
      id: editItem ? editItem.id : `sp-${Date.now()}`,
      proceedsNo,
      sequenceNumber: seq,
      date,
      challanDate,
      billNumber: editItem ? editItem.billNumber : undefined,
      crateTypeId: primaryItem.unit === 'Crate' ? primaryItem.crateTypeId : undefined,
      crateName: primaryItem.unit === 'Crate' ? primaryItem.crateName : undefined,
      items: saleItems,
      quantity: totalQuantity,
      unit: primaryItem.unit || 'Crate',
      kg: totalWeight,
      weight: totalWeight,
      rate: saleItems.length === 1 ? primaryItem.rate : 0,
      amount: totalProductAmount,
      expenses,
      totalExpense,
      netAmount,
      difference,
      vendorId: vendorId || undefined,
      vendorName: selectedVendor?.name,
      customerId: customerId || undefined,
      customerName: selectedCustomer?.name,
      notes: notes.trim() || undefined,
      createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
    };

    db.saveSaleProceeds(saleRecord);
    onSaved(saleRecord);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4 backdrop-blur-xs">
        <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto min-w-0 mx-2 sm:mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-4 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editItem ? `Edit ${editItem.proceedsNo}` : 'New Sale Proceeds Entry'}
              </h3>
              <p className="text-xs text-slate-500">
                Direct wholesale mandi consignment sale & proceeds calculation
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 p-4 sm:p-6">
            {/* Row 1: Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DatePickerInput
                label="Date"
                required
                value={date}
                onChange={setDate}
              />
              <DatePickerInput
                label="Challan Date"
                value={challanDate}
                onChange={setChallanDate}
              />
            </div>

            {/* Product Section: Table Format */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Sale Product / Consignment
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Exact column layout: No., Item Name, Qty, Unit, Weight, Crate Type, Rate, Amount
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveFruitRowIndex(items.length - 1 >= 0 ? items.length - 1 : 0);
                      setIsAddFruitOpen(true);
                    }}
                    className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> + Add New Fruit
                  </button>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" /> + Add Row
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="py-2.5 px-2 text-center w-8">No.</th>
                      <th className="py-2.5 px-2 min-w-[170px]">Item Name *</th>
                      <th className="py-2.5 px-2 w-20 text-right">Qty *</th>
                      <th className="py-2.5 px-2 w-20 text-center">Unit</th>
                      <th className="py-2.5 px-2 w-20 text-right">Weight</th>
                      <th className="py-2.5 px-2 w-24 text-center">Crate Type</th>
                      <th className="py-2.5 px-2 w-24 text-right">Rate (₹) *</th>
                      <th className="py-2.5 px-2 w-28 text-right">Amount (₹)</th>
                      <th className="py-2.5 px-1 text-center w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {items.map((it, idx) => (
                      <tr key={it.id || idx}>
                        {/* 1. No. */}
                        <td className="py-2 px-2 text-center font-mono text-slate-500 font-bold">
                          {idx + 1}
                        </td>

                        {/* 2. Item Name */}
                        <td className="py-2 px-2 min-w-[170px]">
                          <FruitAutocomplete
                            valueFruitId={it.fruitId}
                            valueFruitName={it.fruitName}
                            onChange={(f, name) => {
                              if (f) {
                                handleFruitSelect(idx, f);
                              } else {
                                handleItemChange(idx, 'fruitId', '');
                                handleItemChange(idx, 'fruitName', name || '');
                              }
                            }}
                            placeholder="Search fruit / item name..."
                          />
                        </td>

                        {/* 3. Qty */}
                        <td className="py-2 px-2 text-right">
                          <QuantityInput
                            required
                            min={0}
                            step="any"
                            value={it.quantity === 0 ? '' : it.quantity}
                            onChange={(val) => handleItemChange(idx, 'quantity', val)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>

                        {/* 4. Unit */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="text"
                            list={`sp-unit-options-${idx}`}
                            placeholder="Unit"
                            value={it.unit}
                            onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-center"
                          />
                          <datalist id={`sp-unit-options-${idx}`}>
                            <option value="Crate" />
                            <option value="Peti" />
                            <option value="Box" />
                            <option value="KG" />
                            <option value="Bag" />
                            <option value="Piece" />
                            <option value="Nag" />
                          </datalist>
                        </td>

                        {/* 5. Weight (default 0) */}
                        <td className="py-2 px-2 text-right">
                          <QuantityInput
                            min={0}
                            step="any"
                            placeholder="0"
                            value={it.weight}
                            onChange={(val) => handleItemChange(idx, 'weight', val)}
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                          />
                        </td>

                        {/* 6. Crate Type */}
                        <td className="py-2 px-2 text-center">
                          <input
                            type="text"
                            list={`sp-crate-types-${idx}`}
                            placeholder="e.g. 20kg"
                            value={it.crateName || ''}
                            onChange={(e) => handleItemChange(idx, 'crateName', e.target.value)}
                            className="w-full rounded-lg border border-sky-300 bg-sky-50/60 dark:bg-slate-800 px-2 py-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 outline-none focus:border-sky-500 dark:border-slate-700 text-center"
                            title="Crate Name is only a label for identification & balance tracking"
                          />
                          <datalist id={`sp-crate-types-${idx}`}>
                            <option value="20kg" />
                            <option value="10kg" />
                            <option value="15kg" />
                            <option value="24kg" />
                          </datalist>
                        </td>

                        {/* 7. Rate */}
                        <td className="py-2 px-2 text-right">
                          <QuantityInput
                            min={0}
                            step="any"
                            placeholder="0.00"
                            value={it.rate === 0 ? '' : it.rate}
                            onChange={(val) => handleItemChange(idx, 'rate', val)}
                            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 text-right outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />
                        </td>

                        {/* 8. Amount (Manually editable) */}
                        <td className="py-2 px-2 text-right">
                          <QuantityInput
                            step="any"
                            placeholder="0.00"
                            value={it.amount}
                            onChange={(val) => handleItemChange(idx, 'amount', val)}
                            className="w-full rounded-lg border-2 border-emerald-500 bg-white px-2 py-1.5 text-right font-mono font-bold text-xs text-slate-900 outline-none dark:bg-slate-900 dark:text-white"
                          />
                        </td>

                        {/* 9. Delete row */}
                        <td className="py-2 px-1 text-center">
                          {items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                              title="Delete Row"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Items Bottom Controls: + Add Row & Auto Recalculate */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" /> + Add Row
                </button>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <span>
                    Total Items: <strong>{items.length}</strong> · Total Qty:{' '}
                    <strong>{totalQuantity}</strong>
                  </span>
                  <span>
                    (Rule: Weight &gt; 0 ? Weight × Rate : Qty × Rate; Crate type is label only)
                  </span>
                  <button
                    type="button"
                    onClick={calculateAutoAllAmounts}
                    title="Recalculate All Amounts (Weight > 0 ? Weight × Rate : Qty × Rate)"
                    className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer font-medium"
                  >
                    <Calculator className="h-3 w-3" /> Auto Recalculate
                  </button>
                </div>
              </div>
            </div>

            {/* Expenses Section */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Consignment Expenses
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Freight, Hamali, Postage and custom deductions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> + Add Row
                </button>
              </div>

              <div className="space-y-2">
                {expenses.map((exp, idx) => (
                  <div key={exp.id || idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={exp.name}
                      placeholder="Expense Name (e.g. Freight, Hamali)"
                      onChange={(e) => handleExpenseChange(idx, 'name', e.target.value)}
                      className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <div className="relative w-36">
                      <span className="absolute left-3 top-2 text-xs text-slate-400">₹</span>
                      <QuantityInput
                        min={0}
                        step="any"
                        value={exp.amount === 0 ? '' : exp.amount}
                        placeholder="0.00"
                        onChange={(val) => handleExpenseChange(idx, 'amount', val)}
                        className="w-full rounded-lg border border-slate-300 pl-6 pr-3 py-1.5 text-right font-mono-numbers text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    {expenses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddExpense}
                className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-dashed border-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 cursor-pointer transition-colors"
              >
                <Plus className="h-4 w-4" /> + Add Row
              </button>
            </div>

            {/* Calculations Summary Box */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[11px] font-medium text-slate-500">Total Amount</span>
                  <span className="text-base font-bold font-mono-numbers text-slate-900 dark:text-white">
                    {formatCurrency(totalProductAmount)}
                  </span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[11px] font-medium text-slate-500">Total Expense</span>
                  <span className="text-base font-bold font-mono-numbers text-rose-600 dark:text-rose-400">
                    {formatCurrency(totalExpense)}
                  </span>
                </div>
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                    Net Credit
                  </span>
                  <span className="text-base font-bold font-mono-numbers text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(netAmount)}
                  </span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[11px] font-medium text-slate-500">Difference</span>
                  <span className="text-base font-bold font-mono-numbers text-slate-600 dark:text-slate-400">
                    {formatCurrency(difference)}
                  </span>
                </div>
              </div>
            </div>

            {/* Additional info */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Wholesale Vendor / Consignor
                </label>
                <VendorAutocomplete
                  valueVendorId={vendorId}
                  onChange={(v) => setVendorId(v ? v.id : '')}
                  placeholder="Search vendor / consignor name..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer (Optional)
                </label>
                <CustomerAutocomplete
                  valueCustomerId={customerId}
                  onChange={(c) => setCustomerId(c ? c.id : '')}
                  placeholder="Search customer name..."
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes / Consignment Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Hill harvest quality, vehicle no."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
              >
                {editItem ? 'Update Sale Proceeds' : 'Save Sale Proceeds'}
              </button>
            </div>
          </form>
        </div>
      </div>

      <AddFruitModal
        isOpen={isAddFruitOpen}
        onClose={() => setIsAddFruitOpen(false)}
        onFruitCreated={handleFruitCreated}
      />
    </>
  );
};
