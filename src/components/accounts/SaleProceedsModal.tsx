import React, { useState, useEffect } from 'react';
import { ExpenseItem, Fruit, SaleProceeds } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatSequence, getTodayIso } from '../../utils/formatters';
import { getFruitEffectivePrice } from '../../utils/fruitUtils';
import { DatePickerInput } from '../common/DatePickerInput';
import { AddFruitModal } from '../modals/AddFruitModal';
import { FruitAutocomplete } from '../common/FruitAutocomplete';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import { X, Plus, Trash2, Calculator, Info } from 'lucide-react';

interface SaleProceedsModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: SaleProceeds | null;
  onSaved: (item: SaleProceeds) => void;
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
  const units = db.getUnits();
  const crateTypes = db.getCrateTypes();

  const [date, setDate] = useState(getTodayIso());
  const [challanDate, setChallanDate] = useState(getTodayIso());
  const [billNumber, setBillNumber] = useState('');
  const [selectedFruitId, setSelectedFruitId] = useState('');
  const [customFruitName, setCustomFruitName] = useState('');
  const [quantity, setQuantity] = useState<number | ''>(1);
  const [unit, setUnit] = useState('Crate');
  const [weight, setWeight] = useState<number | ''>(0);
  const [crateTypeId, setCrateTypeId] = useState('ct_20');
  const [crateName, setCrateName] = useState('20kg');
  const [rate, setRate] = useState<number | ''>(0);
  
  // Amount is manually editable or calculated
  const [amount, setAmount] = useState<number | ''>(0);
  const [vendorId, setVendorId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');

  // Expenses: Freight, Hamali, Postage, etc.
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: 'exp-1', name: 'Freight', amount: 100 },
    { id: 'exp-2', name: 'Hamali', amount: 10 },
    { id: 'exp-3', name: 'Postage', amount: 6 },
  ]);

  const [isAddFruitOpen, setIsAddFruitOpen] = useState(false);

  useEffect(() => {
    if (editItem) {
      setDate(editItem.date);
      setChallanDate(editItem.challanDate || editItem.date);
      setBillNumber(editItem.billNumber || '');
      const firstItem = editItem.items?.[0];
      setSelectedFruitId(firstItem?.fruitId || '');
      setCustomFruitName(firstItem?.fruitName || '');
      setQuantity(editItem.quantity);
      setUnit(editItem.unit || 'Crate');
      setWeight(editItem.kg !== undefined ? editItem.kg : (firstItem?.kg || 0));
      const ct = crateTypes.find((c) => c.id === editItem.crateTypeId || c.name.toLowerCase().includes(String(editItem.crateName || '').toLowerCase()));
      setCrateTypeId(editItem.crateTypeId || ct?.id || 'ct_20');
      setCrateName(editItem.crateName || (ct ? ct.name.replace(/\s*crate$/i, '').trim() : '20kg'));
      setRate(editItem.rate);
      setAmount(editItem.amount);
      setExpenses(editItem.expenses || []);
      setVendorId(editItem.vendorId || '');
      setCustomerId(editItem.customerId || '');
      setNotes(editItem.notes || '');
    } else {
      // Default new entry - starts completely blank
      setDate(getTodayIso());
      setChallanDate(getTodayIso());
      setBillNumber('');
      setSelectedFruitId('');
      setCustomFruitName('');
      const ct20 = crateTypes.find((c) => c.name.includes('20')) || crateTypes[0];
      setCrateTypeId(ct20?.id || 'ct_20');
      setCrateName(ct20 ? ct20.name.replace(/\s*crate$/i, '').trim() : '20kg');
      setUnit('Crate');
      setQuantity(1);
      setWeight(0);
      setRate(0);
      setAmount(0);
      setExpenses([
        { id: 'exp-1', name: 'Freight', amount: 100 },
        { id: 'exp-2', name: 'Hamali', amount: 10 },
        { id: 'exp-3', name: 'Postage', amount: 6 },
      ]);
      setVendorId('');
      setCustomerId('');
      setNotes('');
    }
  }, [editItem, isOpen]);

  if (!isOpen) return null;

  const currentFruit = fruits.find((f) => f.id === selectedFruitId);

  const handleFruitSelect = (target: Fruit | string) => {
    const fruit = typeof target === 'string' ? fruits.find((f) => f.id === target) : target;
    if (fruit) {
      setSelectedFruitId(fruit.id);
      setCustomFruitName(fruit.name);
      // 1. Auto-fill Unit
      setUnit(fruit.unit || fruit.defaultUnit || 'Crate');
      // 2. Auto-fill Rate
      const r = getFruitEffectivePrice(fruit);
      const newRate = typeof r === 'number' && !isNaN(r) ? r : (fruit.defaultRate || 1);
      setRate(newRate);
      // 3. Auto-fill Crate Type (save exactly what was entered, e.g. 20kg or 10kg, or blank)
      const ctName = fruit.crateType !== undefined ? fruit.crateType : (fruit.crateName || '');
      setCrateName(ctName);
      setCrateTypeId(ctName ? (crateTypes.find(c => c.name.toLowerCase().includes(ctName.toLowerCase()))?.id || fruit.crateTypeId || 'ct_20') : '');
      // 4. Qty defaults to 1 but remains editable
      setQuantity(1);
      // 5. Weight defaults to 0
      setWeight(0);
      // Amount = Qty * Rate
      setAmount(1 * newRate);
    }
  };

  const calculateAutoAmount = () => {
    const q = Number(quantity) || 0;
    const r = Number(rate) || 0;
    setAmount(q * r);
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
    setExpenses([
      ...expenses,
      { id: `exp-${Date.now()}`, name: 'Other', amount: 0 },
    ]);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  // Calculations
  const numericAmount = Number(amount) || 0;
  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netAmount = numericAmount - totalExpense;
  const difference = netAmount - numericAmount; // = -totalExpense

  const handleFruitCreated = (newFruit: Fruit) => {
    handleFruitSelect(newFruit);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFruitId && fruits.length === 0) return;

    const seq = editItem ? editItem.sequenceNumber : db.getNextSaleProceedsNumber();
    const proceedsNo = editItem
      ? editItem.proceedsNo
      : `Sale Proceeds No. ${formatSequence(seq, 3)}`;

    const selectedVendor = vendors.find((v) => v.id === vendorId);
    const selectedCustomer = customers.find((c) => c.id === customerId);
    const fruitName = currentFruit ? currentFruit.name : (customFruitName || 'Fruit');

    const saleRecord: SaleProceeds = {
      id: editItem ? editItem.id : `sp-${Date.now()}`,
      proceedsNo,
      sequenceNumber: seq,
      date,
      challanDate,
      billNumber: editItem ? editItem.billNumber : undefined,
      crateTypeId: unit === 'Crate' ? crateTypeId : undefined,
      crateName: unit === 'Crate' ? crateName : undefined,
      items: [
        {
          id: `spi-${Date.now()}`,
          fruitId: selectedFruitId,
          fruitName,
          quantity: Number(quantity) || 0,
          unit,
          kg: Number(weight) || 0,
          crateTypeId: crateName ? (crateTypeId || 'ct_20') : undefined,
          crateName: crateName || undefined,
          rate: Number(rate) || 0,
          amount: numericAmount,
        },
      ],
      quantity: Number(quantity) || 0,
      unit,
      kg: Number(weight) || 0,
      rate: Number(rate) || 0,
      amount: numericAmount,
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto min-w-0 mx-2 sm:mx-auto">
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
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
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
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Sale Product / Consignment
                  </span>
                  <p className="text-[11px] text-slate-500">
                    Exact column layout: No., Item Name, Qty, Unit, Weight, Crate Type, Rate, Amount
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddFruitOpen(true)}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <Plus className="h-3.5 w-3.5" /> + Add New Fruit
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-100/60 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="py-2.5 px-2 text-center w-10">No.</th>
                      <th className="py-2.5 px-2 min-w-[180px]">Item Name *</th>
                      <th className="py-2.5 px-2 w-20 text-right">Qty *</th>
                      <th className="py-2.5 px-2 w-24 text-center">Unit</th>
                      <th className="py-2.5 px-2 w-24 text-right">Weight</th>
                      <th className="py-2.5 px-2 w-28 text-center">Crate Type</th>
                      <th className="py-2.5 px-2 w-24 text-right">Rate (₹) *</th>
                      <th className="py-2.5 px-2 w-28 text-right">Amount (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    <tr>
                      {/* 1. No. */}
                      <td className="py-2 px-2 text-center font-mono text-slate-500 font-bold">1</td>

                      {/* 2. Item Name */}
                      <td className="py-2 px-2 min-w-[180px]">
                        <FruitAutocomplete
                          valueFruitId={selectedFruitId}
                          valueFruitName={currentFruit ? currentFruit.name : customFruitName}
                          onChange={(f, name) => {
                            if (f) {
                              handleFruitSelect(f);
                            } else {
                              setSelectedFruitId('');
                              setCustomFruitName(name || '');
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
                          value={quantity === 0 ? '' : quantity}
                          onChange={(val) => {
                            setQuantity(val);
                            const q = val === '' ? 0 : Number(val);
                            const r = Number(rate) || 0;
                            setAmount(q * r);
                          }}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>

                      {/* 4. Unit (free-text input, not a dropdown) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          list="sp-unit-options"
                          placeholder="Unit"
                          value={unit}
                          onChange={(e) => setUnit(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-center"
                        />
                        <datalist id="sp-unit-options">
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
                          value={weight === 0 ? '0' : (weight || '0')}
                          onChange={(val) => setWeight(val)}
                          className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>

                      {/* 6. Crate Type (free-text input; e.g. 20kg or 10kg, or blank) */}
                      <td className="py-2 px-2 text-center">
                        <input
                          type="text"
                          list="sp-crate-types"
                          placeholder="e.g. 20kg"
                          value={crateName}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCrateName(val);
                            const ct = crateTypes.find((c) => c.name.toLowerCase().includes(val.toLowerCase()));
                            if (ct) setCrateTypeId(ct.id);
                          }}
                          className="w-full rounded-lg border border-sky-300 bg-sky-50/60 dark:bg-slate-800 px-2 py-1.5 text-xs font-bold text-sky-800 dark:text-sky-300 outline-none focus:border-sky-500 dark:border-slate-700 text-center"
                          title="Crate Name is only a label for identification & balance tracking"
                        />
                        <datalist id="sp-crate-types">
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
                          value={rate === 0 ? '' : rate}
                          onChange={(val) => {
                            setRate(val);
                            const q = Number(quantity) || 0;
                            const r = val === '' ? 0 : Number(val);
                            setAmount(q * r);
                          }}
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 text-right outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </td>

                      {/* 8. Amount (Manually editable) */}
                      <td className="py-2 px-2 text-right">
                        <QuantityInput
                          step="any"
                          placeholder="0.00"
                          value={amount}
                          onChange={(val) => setAmount(val)}
                          className="w-full rounded-lg border-2 border-emerald-500 bg-white px-2 py-1.5 text-right font-mono font-bold text-xs text-slate-900 outline-none dark:bg-slate-900 dark:text-white"
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Amount note & auto button */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  Quantity {quantity || 0} × Rate ₹{rate || 0} = {formatCurrency((Number(quantity) || 0) * (Number(rate) || 0))} (Crate type {crateName ? `"${crateName}"` : 'blank'} is label only; never multiplied)
                </span>
                <button
                  type="button"
                  onClick={calculateAutoAmount}
                  title="Recalculate Qty × Rate"
                  className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 cursor-pointer"
                >
                  <Calculator className="h-3 w-3" /> Auto (Qty × Rate)
                </button>
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
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                >
                  <Plus className="h-3.5 w-3.5" /> + Add Expense
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
                        className="p-1.5 text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Summary Box */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[11px] font-medium text-slate-500">Amount</span>
                  <span className="text-base font-bold font-mono-numbers text-slate-900 dark:text-white">
                    {formatCurrency(numericAmount)}
                  </span>
                </div>
                <div className="p-2 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="block text-[11px] font-medium text-slate-500">Total Expense</span>
                  <span className="text-base font-bold font-mono-numbers text-rose-600 dark:text-rose-400">
                    {formatCurrency(totalExpense)}
                  </span>
                </div>
                <div className="p-2 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900">
                  <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Net Credit</span>
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
                <select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">-- No Vendor Selected --</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
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
                className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
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
