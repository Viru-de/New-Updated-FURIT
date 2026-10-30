import React, { useState, useEffect, useMemo } from 'react';
import { CashSale, CashSaleItem, Customer, ExpenseItem, Fruit, CrateMovementItem } from '../../types';
import { db } from '../../services/db';
import { getCustomerCrateBalanceByType } from '../../services/accounting';
import { formatCurrency, formatSequence, getTodayIso } from '../../utils/formatters';
import {
  isCrateUnit,
  getAvailableCrateSizes,
  getDefaultCrateSizeForFruit,
} from '../../utils/crateUtils';
import { getFruitEffectivePrice, getFruitSavedCrateType } from '../../utils/fruitUtils';
import {
  calculateLineKg,
  calculateLineAmount,
  calculateWholesaleItemAmount,
  calculateSaleCrateSummary,
  formatQtyWithUnit,
} from '../../utils/billingCalculations';
import { DatePickerInput } from '../common/DatePickerInput';
import { AddFruitModal } from '../modals/AddFruitModal';
import { AddCustomerModal } from '../modals/AddCustomerModal';
import { BillTableCanvas } from '../common/BillTableCanvas';
import { CashSalePrintModal } from '../print/CashSalePrintModal';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { FruitAutocomplete } from '../common/FruitAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import {
  X,
  Plus,
  Trash2,
  Box,
  UserPlus,
  Info,
  Printer,
  Eye,
  Edit3,
  CheckCircle2,
  Banknote,
  Users,
} from 'lucide-react';

interface SaleCrateRow {
  id: string;
  crateTypeId: string;
  outQuantity: number | '';
  inQuantity: number | '';
}
interface CashSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: CashSale | null;
  onSaved: (item: CashSale) => void;
  preselectedCustomerId?: string;
  onSaveAndPrint?: (item: CashSale) => void;
}

export const CashSaleModal: React.FC<CashSaleModalProps> = ({
  isOpen,
  onClose,
  editItem,
  onSaved,
  preselectedCustomerId,
  onSaveAndPrint,
}) => {
  const customers = db.getCustomers();
  const fruits = db.getFruits();
  const crateTypes = db.getCrateTypes();
  const units = db.getUnits();
  const availableCrateSizes = useMemo(() => getAvailableCrateSizes(), [crateTypes]);

  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form');
  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(getTodayIso());
  const [paymentMode, setPaymentMode] = useState<CashSale['paymentMode']>('Cash');
  const [items, setItems] = useState<CashSaleItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: 'cse-1', name: 'Hamali', amount: 50 },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Manual final amount adjustment option
  const [isManualAmountOverridden, setIsManualAmountOverridden] = useState(false);
  const [manualAmount, setManualAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');

  const [isAddFruitOpen, setIsAddFruitOpen] = useState(false);
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    if (editItem) {
      setCustomerId(editItem.customerId || '');
      setDate(editItem.date);
      setPaymentMode(editItem.paymentMode || 'Cash');
      const loadedItems: CashSaleItem[] = (editItem.items || []).map((it) => {
        const ctMatch = crateTypes.find((c) => c.id === it.crateTypeId || c.name.toLowerCase().includes(String(it.crateName || '').toLowerCase()));
        return {
          ...it,
          crateTypeId: it.crateTypeId || (it.crateName && ctMatch ? ctMatch.id : ''),
          crateName: it.crateName !== undefined ? it.crateName : (ctMatch ? ctMatch.name.replace(/\s*crate$/i, '').trim() : ''),
          amount: it.amount !== undefined ? it.amount : calculateWholesaleItemAmount(it.quantity, it.unit, it.kg, it.rate),
        };
      });
      setItems(loadedItems);
      setExpenses(editItem.expenses || []);

      if (editItem.manualAdjustedAmount !== undefined) {
        setIsManualAmountOverridden(true);
        setManualAmount(editItem.manualAdjustedAmount);
      } else {
        setIsManualAmountOverridden(false);
        setManualAmount('');
      }
      setNotes(editItem.notes || '');
    } else {
      setCustomerId(preselectedCustomerId || '');
      setDate(getTodayIso());
      setPaymentMode('Cash');

      const ct20 = crateTypes.find((c) => c.name.includes('20')) || crateTypes[0];

      // Start with a clean, blank item row for new bill with completely blank Rate
      setItems([
        {
          id: `casi-${Date.now()}-1`,
          fruitId: '',
          fruitName: '',
          quantity: 1,
          unit: 'Crate',
          crateTypeId: '',
          crateName: '',
          rate: '' as any,
          amount: 0,
        },
      ]);

      setExpenses([{ id: 'cse-cash-1', name: 'Hamali', amount: 50 }]);
      setIsManualAmountOverridden(false);
      setManualAmount('');
      setNotes('');
    }
  }, [editItem, isOpen, preselectedCustomerId]);

  const selectedCustomer = customers.find((c) => c.id === customerId);

  // Directly handle fruit selection from Fruit/Item Master
  const handleSelectFruit = (index: number, f: Fruit) => {
    const updated = [...items];
    const current = { ...updated[index] };
    current.fruitId = f.id;
    current.fruitName = f.name;
    // 1. Auto-fill Unit
    current.unit = f.unit || f.defaultUnit || 'Crate';
    // 2. Rate must be blank by default: user must manually enter it
    current.rate = '' as any;
    // 3. Crate Type: automatically fetched from Fruit / Item Master (exact value or blank)
    const fruitCrateType = getFruitSavedCrateType(f);
    current.crateName = fruitCrateType;
    current.crateTypeId = fruitCrateType ? (f.crateTypeId || 'ct_20') : '';
    // 4. Qty defaults to 1 but remains editable
    current.quantity = 1;
    // 5. Weight defaults to 0
    current.kg = 0;
    current.amount = 0;
    updated[index] = current;
    setItems(updated);
  };

  // Item manipulations
  const handleItemChange = (index: number, field: keyof CashSaleItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index] };

    if (field === 'fruitId') {
      const fr = fruits.find((f) => f.id === val);
      if (fr) {
        current.fruitId = fr.id;
        current.fruitName = fr.name;
        // 1. Auto-fill Unit
        current.unit = fr.unit || fr.defaultUnit || 'Crate';
        // 2. Rate must be blank by default: user must manually enter it
        current.rate = '' as any;
        // 3. Crate Type: automatically fetched from Fruit / Item Master
        const fruitCrateType = getFruitSavedCrateType(fr);
        current.crateName = fruitCrateType;
        current.crateTypeId = fruitCrateType ? (fr.crateTypeId || 'ct_20') : '';
        // 4. Qty defaults to 1 but remains editable
        current.quantity = 1;
        // 5. Weight defaults to 0
        current.kg = 0;
      } else {
        current.fruitId = '';
        current.crateName = '';
        current.crateTypeId = '';
        // When clearing fruit, do not retain old rate
        current.rate = '' as any;
      }
    } else if (field === 'fruitName') {
      current.fruitName = val;
      const fr = fruits.find((f) => f.name.toLowerCase() === String(val).toLowerCase());
      if (fr) {
        current.fruitId = fr.id;
        const fruitCrateType = getFruitSavedCrateType(fr);
        current.crateName = fruitCrateType;
        current.crateTypeId = fruitCrateType ? (fr.crateTypeId || 'ct_20') : '';
        current.rate = '' as any;
      } else {
        current.fruitId = '';
        current.crateName = '';
        current.crateTypeId = '';
        current.rate = '' as any;
      }
    } else if (field === 'unit') {
      const nextUnit = String(val);
      current.unit = nextUnit;
    } else if (field === 'crateTypeId') {
      current.crateTypeId = val;
      const ct = crateTypes.find((c) => c.id === val);
      current.crateName = ct ? ct.name.replace(/\s*crate$/i, '').trim() : '';
    } else if (field === 'crateName') {
      current.crateName = val;
      if (val) {
        const ct = crateTypes.find((c) => c.name.toLowerCase().includes(String(val).toLowerCase()));
        current.crateTypeId = ct ? ct.id : '';
      } else {
        current.crateTypeId = '';
      }
    } else if (field === 'quantity') {
      const q = val === '' ? '' : Number(val);
      current.quantity = (q === '' || isNaN(q as number)) ? (val === '' ? '' : 0) as any : q;
    } else if (field === 'kg') {
      const k = val === '' ? '' : Number(val);
      current.kg = (k === '' || isNaN(k as number)) ? (val === '' ? '' : 0) as any : k;
    } else if (field === 'rate') {
      const r = val === '' ? '' : Number(val);
      current.rate = (r === '' || isNaN(r as number)) ? ('' as any) : r;
    } else if (field === 'crateSize') {
      current.crateSize = val;
    }

    const qNum = (current.quantity as any) === '' ? 0 : (Number(current.quantity) || 0);
    const kNum = (current.kg as any) === '' ? 0 : (Number(current.kg) || 0);
    const rNum = (current.rate as any) === '' || (current.rate as any) === undefined ? 0 : (Number(current.rate) || 0);

    // Live calculation:
    // For crate items: Amount = Qty × Rate (Crate Name 20kg or 10kg is only a label for identification & balance tracking)
    // For non-crate items: Amount = Kg × Rate if Kg > 0, else Qty × Rate
    current.amount = calculateWholesaleItemAmount(
      qNum,
      current.unit,
      kNum,
      rNum
    );

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `casi-${Date.now()}`,
        fruitId: '',
        fruitName: '',
        quantity: 1,
        unit: 'Crate',
        crateTypeId: '',
        crateName: '',
        kg: 0,
        rate: '' as any,
        amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
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
      { id: `cse-${Date.now()}`, name: 'Other', amount: 0 },
    ]);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  // Crate Balance: Track crate quantities separately by crate type (10 of 20kg type distinguishable from 10 of 10kg type)
  const crateBreakdownText = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((it) => {
      if (isCrateUnit(it.unit)) {
        const q = Number(it.quantity) || 0;
        if (q > 0) {
          const ct = crateTypes.find((c) => c.id === it.crateTypeId);
          const name = it.crateName || (ct ? ct.name.replace(/\s*crate$/i, '').trim() : '20kg');
          map.set(name, (map.get(name) || 0) + q);
        }
      }
    });
    if (map.size === 0) return null;
    return Array.from(map.entries())
      .map(([name, count]) => `${count} crates of ${name}`)
      .join(', ');
  }, [items, crateTypes]);

  // Prepared crate movements grouped by crate type directly from line items
  const preparedCrateMovements: CrateMovementItem[] = useMemo(() => {
    const crateTypeMap = new Map<string, { crateTypeId: string; crateName: string; outQuantity: number }>();
    items.forEach((it) => {
      if (isCrateUnit(it.unit)) {
        const q = Number(it.quantity) || 0;
        if (q > 0) {
          const ct =
            crateTypes.find(
              (c) =>
                c.id === it.crateTypeId ||
                c.name.toLowerCase().includes(String(it.crateName || '').toLowerCase())
            ) || crateTypes[0];
          const ctId = ct ? ct.id : it.crateTypeId || 'ct_20';
          const ctName = it.crateName || (ct ? ct.name.replace(/\s*crate$/i, '').trim() : '20kg');
          const existing = crateTypeMap.get(ctId) || {
            crateTypeId: ctId,
            crateName: ctName,
            outQuantity: 0,
          };
          existing.outQuantity += q;
          crateTypeMap.set(ctId, existing);
        }
      }
    });

    return Array.from(crateTypeMap.values()).map((c) => ({
      crateTypeId: c.crateTypeId,
      crateName: c.crateName,
      outQuantity: c.outQuantity,
      inQuantity: 0,
    }));
  }, [items, crateTypes]);

  const totalCrateOut = useMemo(() => {
    return preparedCrateMovements.reduce((sum, m) => sum + m.outQuantity, 0);
  }, [preparedCrateMovements]);

  const totalCrateBalance = totalCrateOut;

  // Calculations
  const productTotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalQty = useMemo(() => {
    return Math.round(items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000) / 1000;
  }, [items]);
  const expenseTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalAmount = productTotal + expenseTotal;
  const finalAmount = isManualAmountOverridden && manualAmount !== ''
    ? Number(manualAmount)
    : totalAmount;

  const seqNumber = editItem ? editItem.sequenceNumber : db.getNextCashSaleNumber();
  const cashSaleNo = editItem ? editItem.cashSaleNo : `Cash Sale No. ${formatSequence(seqNumber, 3)}`;

  const firstCtId = preparedCrateMovements[0]?.crateTypeId || crateTypes[0]?.id || 'ct_20';
  const firstCt = crateTypes.find((c) => c.id === firstCtId) || crateTypes[0];

  const currentSaleRecord: CashSale = {
    id: editItem ? editItem.id : `cash-s-${Date.now()}`,
    cashSaleNo,
    sequenceNumber: seqNumber,
    customerId: customerId || undefined,
    customerName: selectedCustomer ? selectedCustomer.name : '',
    date,
    items: items.map((it) => ({
      ...it,
      amount: calculateWholesaleItemAmount(it.quantity, it.unit, it.kg, it.rate),
    })),
    crateTypeId: firstCtId,
    crateName: preparedCrateMovements[0]?.crateName || firstCt?.name || '20kg',
    crateIn: 0,
    crateOut: totalCrateOut,
    crateWeightKg: 20,
    crateMovements: preparedCrateMovements,
    expenses,
    productTotal,
    expenseTotal,
    totalAmount,
    manualAdjustedAmount: isManualAmountOverridden ? Number(manualAmount) : undefined,
    finalAmount,
    paymentMode,
    paymentStatus: 'Paid',
    receivedAmount: finalAmount,
    notes: notes.trim() || undefined,
    createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (items.length === 0) return;
    setIsSubmitting(true);

    db.saveCashSale(currentSaleRecord);
    onSaved(currentSaleRecord);
    setIsSubmitting(false);
    onClose();
  };

  const handleSaveAndPrint = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (items.length === 0) return;
    setIsSubmitting(true);

    db.saveCashSale(currentSaleRecord);
    if (onSaveAndPrint) {
      onSaveAndPrint(currentSaleRecord);
    } else {
      onSaved(currentSaleRecord);
      setIsPrintModalOpen(true);
    }
    setIsSubmitting(false);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto min-w-0 mx-2 sm:mx-auto">
          {/* Header & Tabs */}
          <div className="flex flex-wrap items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-3.5 dark:border-slate-800 gap-3">
            <div className="flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editItem ? `Edit ${editItem.cashSaleNo}` : 'New Wholesale Cash Sale'}
                </h3>
                <p className="text-xs text-slate-500">
                  Paid wholesale bill with exact item Qty/KG & Balance Crate calculation
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Tab Switcher: Form vs Live Preview */}
              <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-100 dark:border-slate-800 dark:bg-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setActiveTab('form')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                    activeTab === 'form'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Edit3 className="h-3.5 w-3.5" /> Form Entry
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-semibold transition-all ${
                    activeTab === 'preview'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Eye className="h-3.5 w-3.5" /> Live Bill Preview
                </button>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {activeTab === 'preview' ? (
            <div className="p-4 sm:p-6 bg-slate-100 dark:bg-slate-950 flex flex-col items-center">
              <div className="mb-4 flex items-center justify-between w-full max-w-xl">
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  Live synchronized bill preview matching printed bill
                </div>
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-xs cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Print Bill / PDF
                </button>
              </div>
              <BillTableCanvas
                saleType="CASH SALE"
                billNumber={cashSaleNo}
                date={date}
                customerName={selectedCustomer?.name || ''}
                customerAddress={selectedCustomer?.address}
                customerMobile={selectedCustomer?.mobile}
                customerAadhaarNo={selectedCustomer?.aadhaarNo || selectedCustomer?.gstin}
                items={items}
                expenses={expenses}
                productTotal={productTotal}
                expenseTotal={expenseTotal}
                finalAmount={finalAmount}
                paymentMode={paymentMode}
                crateOut={totalCrateOut}
                crateIn={0}
                crateWeightKg={20}
                crateMovements={preparedCrateMovements}
                isLivePreview={true}
              />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5 p-4 sm:p-6">
              {/* Customer, Date & Payment Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Customer (Optional)
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddCustomerOpen(true)}
                      className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      <UserPlus className="h-3 w-3" /> + Add
                    </button>
                  </div>
                  <CustomerAutocomplete
                    valueCustomerId={customerId}
                    onChange={(c) => setCustomerId(c ? c.id : '')}
                    placeholder="Search customer name, mobile or city..."
                  />
                  {selectedCustomer && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                      {selectedCustomer.mobile && (
                        <span>Mob: <strong className="text-slate-700 dark:text-slate-300">{selectedCustomer.mobile}</strong></span>
                      )}
                      {selectedCustomer.city && (
                        <span>City: <strong className="text-slate-700 dark:text-slate-300">{selectedCustomer.city}</strong></span>
                      )}
                    </div>
                  )}
                </div>

                <DatePickerInput
                  label="Sale Date"
                  required
                  value={date}
                  onChange={setDate}
                />

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Payment Mode (Paid) *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                  >
                    <option value="Cash">Cash (Immediate Settlement)</option>
                    <option value="UPI">UPI / QR Code</option>
                    <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  </select>
                </div>
              </div>

              {/* Items Table with exact headings: No. | Item Name | Qty | KG | Rate | Amount */}
              <div className="rounded-lg border border-slate-200 p-3 sm:p-4 dark:border-slate-800">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      Sale Items
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Exact column layout: No., Item Name, Qty, Unit, Crate Type, Rate, Amount
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      Total Qty: <strong className="font-mono text-emerald-900 dark:text-emerald-200">{totalQty}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddFruitOpen(true)}
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                    >
                      + New Fruit
                    </button>
                    <button
                      type="button"
                      onClick={handleAddItem}
                      className="flex items-center gap-1 rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                    >
                      <Plus className="h-3.5 w-3.5" /> + Add Row
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/40">
                        <th className="py-2.5 px-2 text-center w-10">No.</th>
                        <th className="py-2.5 px-2 min-w-[180px]">Item Name *</th>
                        <th className="py-2.5 px-2 w-20 text-right">Qty *</th>
                        <th className="py-2.5 px-2 w-24 text-center">Unit</th>
                        <th className="py-2.5 px-2 w-24 text-right">Weight</th>
                        <th className="py-2.5 px-2 w-28 text-center">Crate Type</th>
                        <th className="py-2.5 px-2 w-24 text-right">Rate (₹) *</th>
                        <th className="py-2.5 px-2 w-28 text-right">Amount (₹)</th>
                        <th className="py-2.5 px-1 w-8 text-center"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((it, idx) => {
                        return (
                          <tr key={it.id || idx}>
                            {/* 1. No. */}
                            <td className="py-2 px-2 text-center font-mono font-bold text-slate-400">
                              {idx + 1}
                            </td>

                            {/* 2. Item Name */}
                            <td className="py-2 px-2 min-w-[180px]">
                              <FruitAutocomplete
                                valueFruitId={it.fruitId || ''}
                                valueFruitName={it.fruitName}
                                onChange={(f, customName) => {
                                  if (f) {
                                    handleSelectFruit(idx, f);
                                  } else {
                                    handleItemChange(idx, 'fruitId', '');
                                    handleItemChange(idx, 'fruitName', customName || '');
                                    handleItemChange(idx, 'crateName', '');
                                    handleItemChange(idx, 'crateTypeId', '');
                                  }
                                }}
                                placeholder="Search fruit / item..."
                              />
                            </td>

                            {/* 3. Qty */}
                            <td className="py-2 px-2 text-right">
                              <QuantityInput
                                min={0}
                                step="any"
                                placeholder="Qty"
                                value={it.quantity === 0 ? '' : it.quantity}
                                onChange={(val) => handleItemChange(idx, 'quantity', val)}
                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right font-mono font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                              />
                            </td>

                            {/* 4. Unit */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="text"
                                value={it.unit || ''}
                                onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-center font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                                placeholder="Unit"
                              />
                            </td>

                            {/* 5. Weight */}
                            <td className="py-2 px-2 text-right">
                              <QuantityInput
                                min={0}
                                step="any"
                                placeholder="0"
                                value={it.kg === 0 ? '' : it.kg}
                                onChange={(val) => handleItemChange(idx, 'kg', val)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                              />
                            </td>

                            {/* 6. Crate Type */}
                            <td className="py-2 px-2 text-center">
                              <input
                                type="text"
                                list={`cash-crate-types-${idx}`}
                                placeholder={it.fruitName ? "e.g. 20kg" : "-"}
                                disabled={!it.fruitName}
                                value={it.crateName || ''}
                                onChange={(e) => handleItemChange(idx, 'crateName', e.target.value)}
                                className={`w-full rounded-lg border px-2 py-1.5 text-xs font-bold text-center outline-none ${
                                  !it.fruitName
                                    ? 'border-slate-200 bg-slate-100/70 text-slate-400 dark:border-slate-800 dark:bg-slate-800/40 cursor-not-allowed'
                                    : 'border-sky-300 bg-sky-50/60 text-sky-800 dark:bg-slate-800 dark:text-sky-300 focus:border-sky-500 dark:border-slate-700'
                                }`}
                                title={it.fruitName ? "Crate Name is only a label for identification & balance tracking" : "Select a fruit item first"}
                              />
                              <datalist id={`cash-crate-types-${idx}`}>
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
                                value={(it.rate as any) === '' || it.rate === undefined ? '' : it.rate}
                                onChange={(val) => handleItemChange(idx, 'rate', val)}
                                className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono font-bold text-slate-900 text-right outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </td>

                            {/* 8. Amount */}
                            <td className="py-2 px-2 text-right font-mono font-bold text-slate-900 dark:text-white">
                              {formatCurrency(it.amount)}
                            </td>

                            <td className="py-2 px-1 text-center">
                              {items.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="text-slate-400 hover:text-rose-600 p-1"
                                  title="Remove Item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-50/80 font-bold dark:border-slate-800 dark:bg-slate-800/60">
                      <td colSpan={2} className="py-2.5 px-2 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Total Qty:
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {totalQty}
                      </td>
                      <td colSpan={4} className="py-2.5 px-2 text-right text-xs uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Items Subtotal:
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrency(productTotal)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

                {/* Crate Balance Indicator (tracked separately by crate type) */}
                {crateBreakdownText && (
                  <div className="mt-3 flex items-center justify-between rounded-lg border border-sky-200 bg-sky-50/70 px-3.5 py-2 text-xs dark:border-sky-900/50 dark:bg-sky-950/30">
                    <div className="flex items-center gap-2">
                      <Box className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                      <span className="font-semibold text-sky-900 dark:text-sky-200">
                        Crate Balance: <strong className="font-bold text-sky-800 dark:text-sky-100">{crateBreakdownText}</strong>
                      </span>
                    </div>
                    <span className="font-mono text-xs font-bold text-sky-700 dark:text-sky-300">
                      Total: {totalCrateBalance} Crates
                    </span>
                  </div>
                )}
              </div>

              {/* Expenses */}
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Cash Sale Expenses (Hamali, Freight, etc.)
                  </span>
                  <button
                    type="button"
                    onClick={handleAddExpense}
                    className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <Plus className="h-3 w-3" /> + Add Expense
                  </button>
                </div>

                <div className="space-y-2">
                  {expenses.map((exp, idx) => (
                    <div key={exp.id || idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={exp.name}
                        onChange={(e) => handleExpenseChange(idx, 'name', e.target.value)}
                        placeholder="Expense Name (Freight, Hamali, Other)"
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <div className="relative w-32">
                        <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                        <QuantityInput
                          min={0}
                          step="any"
                          placeholder="0.00"
                          value={exp.amount === 0 ? '' : exp.amount}
                          onChange={(val) => handleExpenseChange(idx, 'amount', val)}
                          className="w-full rounded-lg border border-slate-300 pl-6 pr-2 py-1.5 text-xs font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals Summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                  <div>
                    <span className="text-[11px] text-slate-500">Items Total</span>
                    <div className="font-mono-numbers text-sm font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(productTotal)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">+ Expenses</span>
                    <div className="font-mono-numbers text-sm font-bold text-slate-800 dark:text-slate-200">
                      +{formatCurrency(expenseTotal)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500">Calculated Bill</span>
                    <div className="font-mono-numbers text-sm font-bold text-slate-800 dark:text-slate-200">
                      {formatCurrency(totalAmount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[11px] text-emerald-600 font-bold uppercase">Final Cash Amount</span>
                    <div className="font-mono-numbers text-base font-black text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(finalAmount)}
                    </div>
                  </div>
                </div>

                {/* Manual Amount Override */}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={isManualAmountOverridden}
                      onChange={(e) => setIsManualAmountOverridden(e.target.checked)}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Adjust final cash bill amount manually</span>
                  </label>
                  {isManualAmountOverridden && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-600 dark:text-slate-400">Fixed Total: ₹</span>
                      <QuantityInput
                        min={0}
                        step="any"
                        placeholder="Manual Amount"
                        value={manualAmount}
                        onChange={(val) => setManualAmount(val)}
                        className="w-32 rounded-lg border-2 border-emerald-500 px-2.5 py-1 text-xs font-mono-numbers font-bold text-slate-900 outline-none dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes / Auction Remarks
                </label>
                <input
                  type="text"
                  placeholder="e.g. Counter cash, Spot settlement"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Footer Controls */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPrintModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Preview / Print Bill
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveAndPrint}
                    disabled={isSubmitting || items.length === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    {isSubmitting ? 'Processing...' : editItem ? 'Update & Print' : 'Save & Print'}
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? 'Saving...' : editItem ? 'Update Cash Sale' : 'Save Cash Sale'}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>

      <AddFruitModal
        isOpen={isAddFruitOpen}
        onClose={() => setIsAddFruitOpen(false)}
        onFruitCreated={(f) => {
          handleAddItem();
        }}
      />

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={(c) => setCustomerId(c.id)}
      />

      {isPrintModalOpen && (
        <CashSalePrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          cashSale={currentSaleRecord}
        />
      )}
    </>
  );
};
