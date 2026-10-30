import React, { useState, useEffect } from 'react';
import { Bill, BillItem, CompanyProfile, Customer, ExpenseItem, Fruit, SaleProceeds } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatSequence, getTodayIso, formatDate, formatBillAmount, numberToWordsIndian, formatCompanySignature } from '../../utils/formatters';
import { getFruitEffectivePrice } from '../../utils/fruitUtils';
import { calculateWholesaleItemAmount } from '../../utils/billingCalculations';
import { maskAadhaar } from '../../utils/aadhaarUtils';
import { DatePickerInput } from '../common/DatePickerInput';
import { AddFruitModal } from '../modals/AddFruitModal';
import { FruitBadge } from '../common/FruitIconHelper';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint, BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { getCustomerPrintContactLines } from '../../utils/customerContactUtils';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { FruitAutocomplete } from '../common/FruitAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import {
  FileText,
  Plus,
  Trash2,
  Printer,
  Eye,
  Copy,
  Building2,
  CheckCircle,
  X,
  Phone,
  Mail,
  MapPin,
  Link as LinkIcon,
} from 'lucide-react';

interface CreateBillViewProps {
  editBill?: Bill | null;
  sourceProceeds?: SaleProceeds | null;
  initialCustomerId?: string;
  onSaved?: (bill: Bill) => void;
  onNavigateToHistory?: () => void;
}

export const CreateBillView: React.FC<CreateBillViewProps> = ({
  editBill,
  sourceProceeds,
  initialCustomerId,
  onSaved,
  onNavigateToHistory,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile();
  const customers = db.getCustomers();
  const fruits = db.getFruits();
  const units = db.getUnits();

  // Form states
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    editBill?.companyProfileId || defaultProfile?.id || profiles[0]?.id || ''
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    editBill?.customerId || sourceProceeds?.customerId || initialCustomerId || customers[0]?.id || ''
  );
  const [billDate, setBillDate] = useState<string>(
    editBill?.date || sourceProceeds?.date || getTodayIso()
  );
  const [billNo, setBillNo] = useState<string>(
    editBill?.billNo || sourceProceeds?.billNumber || `BILL-${formatSequence(db.getNextBillNumber(), 3)}`
  );
  const [challanNo, setChallanNo] = useState<string>(
    editBill?.challanNumber || sourceProceeds?.proceedsNo || ''
  );
  const [challanDate, setChallanDate] = useState<string>(
    editBill?.challanDate || sourceProceeds?.challanDate || sourceProceeds?.date || getTodayIso()
  );
  const [items, setItems] = useState<BillItem[]>(
    editBill?.items || [
      {
        id: `bi-${Date.now()}-1`,
        fruitId: '',
        fruitName: '',
        quantity: 1,
        unit: 'Crate',
        rate: '' as any,
        amount: 0,
      },
    ]
  );
  const [expenses, setExpenses] = useState<ExpenseItem[]>(
    editBill?.expenses || [{ id: 'be-1', name: 'Freight & Hamali', amount: 150 }]
  );
  const [notes, setNotes] = useState<string>(editBill?.notes || sourceProceeds?.notes || '');
  const [status, setStatus] = useState<Bill['status']>(editBill?.status || 'Unpaid');

  // Preview Modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAddFruitOpen, setIsAddFruitOpen] = useState(false);
  const [pageSize, setPageSize] = useState<BillPaperSize>(() => getLastSelectedPaperSize('compact'));
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  useEffect(() => {
    if (editBill) {
      setSelectedProfileId(editBill.companyProfileId);
      setSelectedCustomerId(editBill.customerId);
      setBillDate(editBill.date);
      setBillNo(editBill.billNo);
      setChallanNo(editBill.challanNumber || '');
      setChallanDate(editBill.challanDate || editBill.date);
      setItems(editBill.items);
      setExpenses(editBill.expenses);
      setNotes(editBill.notes || '');
      setStatus(editBill.status);
    } else if (sourceProceeds) {
      if (sourceProceeds.customerId) {
        setSelectedCustomerId(sourceProceeds.customerId);
      }
      setBillDate(sourceProceeds.date);
      if (sourceProceeds.billNumber) {
        setBillNo(sourceProceeds.billNumber);
      }
      setChallanNo(sourceProceeds.proceedsNo || '');
      setChallanDate(sourceProceeds.challanDate || sourceProceeds.date);
      if (sourceProceeds.items && sourceProceeds.items.length > 0) {
        setItems(
          sourceProceeds.items.map((it, idx) => ({
            id: `bi-${Date.now()}-${idx}`,
            fruitId: it.fruitId || '',
            fruitName: it.fruitName || 'Fruit',
            quantity: it.quantity,
            unit: it.unit || 'Crate',
            kg: it.kg || it.weight || 0,
            rate: it.rate,
            amount: it.amount,
          }))
        );
      }
      if (sourceProceeds.expenses && sourceProceeds.expenses.length > 0) {
        setExpenses(
          sourceProceeds.expenses.map((e, idx) => ({
            id: `be-${Date.now()}-${idx}`,
            name: e.name,
            amount: e.amount,
          }))
        );
      }
      if (sourceProceeds.notes) {
        setNotes(sourceProceeds.notes);
      }
    } else if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [editBill, sourceProceeds, initialCustomerId]);

  const activeProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];
  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Item manipulations
  const handleItemChange = (index: number, field: keyof BillItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index] };

    if (field === 'fruitId') {
      current.fruitId = val;
      const f = fruits.find((fr) => fr.id === val);
      if (f) {
        current.fruitName = f.name;
        current.unit = f.defaultUnit || 'Crate';
        current.rate = '' as any;
      } else {
        current.fruitName = '';
        current.rate = '' as any;
      }
    } else if (field === 'fruitName') {
      current.fruitName = val;
    } else if (field === 'quantity') {
      const q = val === '' ? '' : Number(val);
      current.quantity = (q === '' || isNaN(q as number)) ? (val === '' ? '' : 0) as any : q;
    } else if (field === 'unit') {
      current.unit = String(val);
    } else if (field === 'rate') {
      const r = val === '' ? '' : Number(val);
      current.rate = (r === '' || isNaN(r as number)) ? ('' as any) : r;
    } else if (field === 'kg') {
      const k = val === '' ? '' : Number(val);
      current.kg = (k === '' || isNaN(k as number)) ? (val === '' ? '' : 0) as any : k;
    } else {
      (current as any)[field] = val;
    }

    const qNum = (current.quantity as any) === '' ? 0 : (Number(current.quantity) || 0);
    const rNum = (current.rate as any) === '' || (current.rate as any) === undefined ? 0 : (Number(current.rate) || 0);
    const kNum = (current.kg as any) === '' ? 0 : (Number(current.kg) || 0);
    current.amount = calculateWholesaleItemAmount(qNum, current.unit, kNum, rNum);

    updated[index] = current;
    setItems(updated);
  };

  const handleAddItem = () => {
    setItems([
      ...items,
      {
        id: `bi-${Date.now()}`,
        fruitId: '',
        fruitName: '',
        quantity: 1,
        unit: 'Crate',
        rate: '' as any,
        amount: 0,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Expenses manipulation
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
    setExpenses([...expenses, { id: `be-${Date.now()}`, name: 'Other', amount: 0 }]);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index));
  };

  // Totals
  const subtotal = items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const totalQty = Math.round(items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000) / 1000;
  const expenseTotal = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalAmount = subtotal + expenseTotal;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId || items.length === 0) return;

    const seq = editBill ? editBill.sequenceNumber : db.getNextBillNumber();
    const finalBillNo = billNo.trim() || `BILL-${formatSequence(seq, 3)}`;

    const billRecord: Bill = {
      id: editBill ? editBill.id : `bill-${Date.now()}`,
      billNo: finalBillNo,
      sequenceNumber: seq,
      companyProfileId: selectedProfileId,
      companyProfileSnapshot: activeProfile,
      customerId: selectedCustomerId,
      customerName: activeCustomer ? activeCustomer.name : '',
      customerMobile: activeCustomer?.mobile,
      customerAddress: activeCustomer?.address || activeCustomer?.city,
      customerGstin: activeCustomer?.gstin,
      customerAadhaarNo: activeCustomer?.aadhaarNo,
      sourceTransactionId: editBill?.sourceTransactionId || sourceProceeds?.id || undefined,
      sourceTransactionNo: editBill?.sourceTransactionNo || sourceProceeds?.proceedsNo || undefined,
      sourceType: editBill?.sourceType || (sourceProceeds ? 'saleProceeds' : 'direct'),
      date: billDate,
      challanNumber: challanNo.trim() || undefined,
      challanDate: challanDate || billDate,
      items,
      expenses,
      subtotal,
      expenseTotal,
      totalAmount,
      notes: notes.trim() || undefined,
      status,
      createdAt: editBill ? editBill.createdAt : new Date().toISOString(),
    };

    db.saveBill(billRecord);
    if (onSaved) onSaved(billRecord);
    if (onNavigateToHistory) onNavigateToHistory();
  };

  const handleFruitCreated = (f: Fruit) => {
    setItems([
      ...items,
      {
        id: `bi-${Date.now()}`,
        fruitId: f.id,
        fruitName: f.name,
        quantity: 1,
        unit: f.defaultUnit || 'Crate',
        rate: '' as any,
        amount: 0,
      },
    ]);
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" />
            {editBill ? `Edit Bill: ${editBill.billNo}` : 'Create Wholesale Mandi Bill'}
          </h2>
          <p className="text-xs text-slate-500">
            Generate tax invoices with custom company profiles, letterheads and terms
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Eye className="h-3.5 w-3.5" /> Preview Invoice
          </button>
          {onNavigateToHistory && (
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              Bill History
            </button>
          )}
        </div>
      </div>

      {sourceProceeds && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300 no-print">
          <LinkIcon className="h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Prefilled and linked to Sale Proceeds <strong>{sourceProceeds.proceedsNo}</strong>. Saving this bill will update the proceeds transaction and customer ledger automatically.
          </span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 no-print">
        {/* Company Bill Profile Selector Card (Critical Requirement #20 & #21) */}
        <div className="rounded-xl border-2 border-emerald-500 bg-emerald-50/40 p-5 dark:border-emerald-600 dark:bg-emerald-950/20">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                <Building2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                Select Bill Profile (Company / Firm Name on Invoice) *
              </label>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Choose which business letterhead, address, Aadhaar Card No. and bank details appear on this bill.
              </p>
            </div>

            <div className="w-full md:w-80">
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="w-full rounded-lg border-2 border-emerald-600 bg-white px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-slate-900 dark:text-white"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Profile Info Banner */}
          {activeProfile && (
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-emerald-200 pt-3 text-xs text-slate-700 dark:border-emerald-800 dark:text-slate-300">
              <span>
                Firm: <strong>{activeProfile.name}</strong>
              </span>
              <span>·</span>
              <span>City: {activeProfile.city}</span>
              {activeProfile.aadhaarNo && (
                <>
                  <span>·</span>
                  <span>Aadhaar: <strong className="font-mono">{maskAadhaar(activeProfile.aadhaarNo)}</strong></span>
                </>
              )}
              <span>·</span>
              <span>Bank: {activeProfile.bankName || 'Standard'}</span>
            </div>
          )}
        </div>

        {/* Customer & Bill Dates Info */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Customer *
              </label>
              <CustomerAutocomplete
                valueCustomerId={selectedCustomerId}
                onChange={(c) => {
                  setSelectedCustomerId(c ? c.id : '');
                }}
                placeholder="Search customer name, mobile or city..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Bill Number *
              </label>
              <input
                type="text"
                required
                value={billNo}
                onChange={(e) => setBillNo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono-numbers font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <DatePickerInput
              label="Bill Date"
              required
              value={billDate}
              onChange={setBillDate}
            />

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Challan Number
              </label>
              <input
                type="text"
                placeholder="e.g. CH-101"
                value={challanNo}
                onChange={(e) => setChallanNo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Bill Items Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Bill Products & Quantities
              </h4>
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                Total Qty: <strong className="font-mono text-emerald-900 dark:text-emerald-200">{totalQty}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
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

          <div className="space-y-2.5 sm:space-y-2">
            {items.map((it, idx) => (
              <div
                key={it.id || idx}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 sm:gap-2 items-center p-3 sm:p-0 rounded-xl sm:rounded-none bg-slate-50/80 sm:bg-transparent border sm:border-0 border-slate-200"
              >
                <div className="col-span-1 sm:col-span-5 min-w-0">
                  <FruitAutocomplete
                    valueFruitId={it.fruitId}
                    valueFruitName={it.fruitName}
                    onChange={(f, customName) => {
                      if (f) {
                        handleItemChange(idx, 'fruitId', f.id);
                      } else {
                        handleItemChange(idx, 'fruitId', '');
                        handleItemChange(idx, 'fruitName', customName || '');
                      }
                    }}
                    placeholder="Search fruit / item..."
                  />
                </div>

                <div className="col-span-1 sm:col-span-7 grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-4 sm:col-span-4">
                    <QuantityInput
                      min={0}
                      step="any"
                      placeholder="Qty"
                      value={it.quantity === 0 ? '' : it.quantity}
                      onChange={(val) => handleItemChange(idx, 'quantity', val)}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-right outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>

                  <div className="col-span-3 sm:col-span-3">
                    <input
                      type="text"
                      placeholder="Unit"
                      value={it.unit || ''}
                      onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-center text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                    />
                  </div>

                  <div className="col-span-4 sm:col-span-4">
                    <div className="relative">
                      <span className="absolute left-2 top-1.5 text-xs text-slate-400">₹</span>
                      <QuantityInput
                        min={0}
                        step="any"
                        placeholder="Rate"
                        value={(it.rate as any) === '' || it.rate === undefined ? '' : it.rate}
                        onChange={(val) => handleItemChange(idx, 'rate', val)}
                        className="w-full rounded-lg border border-slate-300 pl-5 pr-2 py-1.5 text-right text-xs font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="col-span-1 flex items-center justify-end">
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        title="Remove Product"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 font-semibold">
              <span>Total Qty:</span>
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">{totalQty}</strong>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Items Subtotal:</span>
              <span className="font-mono-numbers text-sm font-bold text-slate-900 dark:text-white">
                {formatCurrency(subtotal)}
              </span>
            </div>
          </div>
        </div>

        {/* Expenses */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Freight, Hamali & Invoice Additions
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
                  placeholder="Expense Name (e.g. Freight, Hamali)"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <div className="relative w-36">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                  <QuantityInput
                    min={0}
                    step="any"
                    value={exp.amount === 0 ? '' : exp.amount}
                    placeholder="0.00"
                    onChange={(val) => handleExpenseChange(idx, 'amount', val)}
                    className="w-full rounded-lg border border-slate-300 pl-5 pr-2 py-1.5 text-right font-mono-numbers text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                {expenses.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveExpense(idx)}
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Total Banner & Actions */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-xs text-slate-500 block">Total Invoice Payable Amount</span>
            <span className="font-mono-numbers text-2xl font-black text-emerald-700 dark:text-emerald-400">
              {formatCurrency(totalAmount)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsPreviewOpen(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Eye className="h-4 w-4" /> Preview & Print
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
            >
              <CheckCircle className="h-4 w-4" /> Save Bill
            </button>
          </div>
        </div>
      </form>

      {/* Invoice Preview & Print Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
            {/* Modal Controls Bar (hidden during print) */}
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-6 py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Invoice Preview — Using Profile: {activeProfile?.name}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  {(['compact', 'b7', 'b6', 'a5', 'a4'] as BillPaperSize[]).map((sizeKey) => (
                    <button
                      key={sizeKey}
                      type="button"
                      onClick={() => setPageSize(sizeKey)}
                      className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-xs font-semibold cursor-pointer transition-all ${
                        pageSize === sizeKey
                          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-bold'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      {sizeKey === 'compact' ? 'Compact' : sizeKey.toUpperCase()}
                    </button>
                  ))}
                </div>
                <BillShareButtons
                  elementId="mandi-print-area"
                  filename={`Bill_${billNo.replace(/\s+/g, '_')}`}
                  customerMobile={activeCustomer?.mobile}
                  title={`Bill Invoice ${billNo}`}
                  summaryText={`Bill No: ${billNo}\nDate: ${billDate}\nCustomer: ${activeCustomer?.name || 'Customer'}\nNet Total: ₹${totalAmount.toLocaleString('en-IN')}`}
                  defaultPaperSize={pageSize}
                  onPaperSizeChange={setPageSize}
                />
                <button
                  type="button"
                  onClick={() => setIsFormatModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setIsPreviewOpen(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Printable Traditional Wholesale Mandi Bill Canvas */}
            <div className="p-4 sm:p-6 overflow-x-auto flex justify-center bg-slate-100 dark:bg-slate-950">
              <div
                id="mandi-print-area"
                data-theme-isolated="true"
                className={`bg-white text-slate-900 font-sans leading-tight border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 shadow-md print-bill-canvas ${
                  pageSize === 'a4'
                    ? 'max-w-[730px] w-full text-[12px] p-5 sm:p-6'
                    : pageSize === 'a5'
                    ? 'max-w-[510px] w-full text-[11px] p-4 sm:p-5'
                    : pageSize === 'b6'
                    ? 'max-w-[430px] w-full text-[10px] p-2.5 sm:p-3'
                    : pageSize === 'b7'
                    ? 'max-w-[300px] w-full text-[8.5px] p-2 sm:p-2.5'
                    : 'max-w-[490px] w-full text-[11px] p-4 sm:p-5'
                }`}
                style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
              >
                {/* Header: Company Initials & Bilingual Names */}
                <div className={`text-center mb-1 ${pageSize === 'b7' ? 'pb-1' : 'pb-1.5'}`}>
                  {activeProfile?.shortCode && (
                    <div className={`font-bold tracking-widest uppercase text-slate-900 dark:text-slate-900 print:text-black ${pageSize === 'b7' ? 'text-[10px]' : 'text-sm'}`}>
                      {activeProfile.shortCode}
                    </div>
                  )}
                  <h1 className={`font-black tracking-wider uppercase mt-0.5 text-slate-950 dark:text-slate-950 print:text-black ${pageSize === 'b7' ? 'text-sm sm:text-base' : pageSize === 'b6' ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>
                    {activeProfile?.name}
                  </h1>
                  {activeProfile?.hindiName && (
                    <div className={`font-bold tracking-wide mt-0.5 font-devanagari text-slate-950 dark:text-slate-950 print:text-black ${pageSize === 'b7' ? 'text-xs sm:text-sm' : pageSize === 'b6' ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}>
                      {activeProfile.hindiName}
                    </div>
                  )}
                  <div className={`${pageSize === 'b7' ? 'text-[8.5px]' : pageSize === 'b6' ? 'text-[9.5px]' : 'text-[11px]'} leading-snug mt-0.5 text-slate-800 dark:text-slate-800 print:text-black`}>
                    {activeProfile?.address}
                    {activeProfile?.city ? `, ${activeProfile.city}` : ''}
                    {activeProfile?.state ? `, ${activeProfile.state}` : ''}
                  </div>
                  <CompanyContactsHeader profile={activeProfile} className="mt-0.5" />
                  {activeProfile?.aadhaarNo && (
                    <div className={`${pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10px]'} font-mono text-slate-800 dark:text-slate-800 print:text-black`}>
                      Aadhaar: {maskAadhaar(activeProfile.aadhaarNo)}
                    </div>
                  )}
                </div>

                {/* Document Title */}
                <div className={`text-center ${pageSize === 'b7' ? 'my-1' : 'my-2'}`}>
                  <span className={`font-bold uppercase tracking-widest border-b border-black pb-0.5 ${pageSize === 'b7' ? 'text-[9px]' : 'text-sm'}`}>
                    TAX INVOICE
                  </span>
                </div>

                {/* Metadata Section */}
                <div className={`flex justify-between items-start ${pageSize === 'b7' ? 'text-[8.5px] mb-1' : 'text-xs mb-2'} pt-1 font-medium`}>
                  {/* Left Side: M/s. Customer Name */}
                  <div className="max-w-[65%]">
                    <div className="font-bold text-slate-500 print:text-black">M/s.</div>
                    <div className={`font-bold uppercase ${pageSize === 'b7' ? 'text-[9px] sm:text-[10px]' : pageSize === 'b6' ? 'text-xs' : 'text-xs sm:text-sm'}`}>{activeCustomer?.name}</div>
                    {challanNo && (
                      <div className={`mt-0.5 ${pageSize === 'b7' ? 'text-[8px]' : 'text-[11px]'}`}>
                        Challan DT: <strong>{formatDate(challanDate)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Number & Date */}
                  <div className={`text-right whitespace-nowrap ${pageSize === 'b7' ? 'text-[8px]' : 'text-xs'}`}>
                    <div>
                      NUMBER: <strong className="font-mono">{billNo.replace(/\D/g, '') || billNo}</strong>
                    </div>
                    <div>
                      DATE: <strong>{formatDate(billDate)}</strong>
                    </div>
                  </div>
                </div>

                {/* Item Table matching Traditional Wholesale Reference */}
                {(() => {
                  const isB7 = pageSize === 'b7';
                  const isB6 = pageSize === 'b6';
                  const colWidths = isB7
                    ? { no: 'w-[22px]', qty: 'w-[32px]', weight: 'w-[32px]', price: 'w-[44px]', amount: 'w-[54px]' }
                    : isB6
                    ? { no: 'w-[26px]', qty: 'w-[42px]', weight: 'w-[42px]', price: 'w-[56px]', amount: 'w-[70px]' }
                    : { no: 'w-8', qty: 'w-14', weight: 'w-16', price: 'w-18', amount: 'w-22' };
                  const tablePad = isB7 ? 'p-0.5' : 'p-1';
                  const tableHeadFont = isB7 ? 'text-[8px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]';
                  const tableBodyFont = isB7 ? 'text-[8px]' : isB6 ? 'text-[10px]' : 'text-xs';
                  const footerFont = isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-xs';
                  const blankRows = Math.max(0, (isB7 ? 1 : isB6 ? 3 : 6) - items.length);

                  return (
                    <table className={`w-full border-collapse border border-black ${tableBodyFont}`}>
                      <thead>
                        <tr className={`border-b border-black font-bold uppercase ${tableHeadFont} bg-slate-50 print:bg-transparent`}>
                          <th className={`border-r border-black ${tablePad} text-center ${colWidths.no}`}>No.</th>
                          <th className={`border-r border-black ${tablePad} text-left`}>ITEM NAME</th>
                          <th className={`border-r border-black ${tablePad} text-right ${colWidths.qty}`}>QTY</th>
                          <th className={`border-r border-black ${tablePad} text-right ${colWidths.weight}`}>WEIGHT</th>
                          <th className={`border-r border-black ${tablePad} text-right ${colWidths.price}`}>PRICE</th>
                          <th className={`${tablePad} text-right ${colWidths.amount}`}>AMOUNT</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((it, idx) => (
                          <tr key={it.id || idx} className="border-b border-black/40">
                            <td className={`border-r border-black ${tablePad} text-center font-mono`}>{idx + 1}</td>
                            <td className={`border-r border-black ${tablePad} font-semibold uppercase`}>{it.fruitName}</td>
                            <td className={`border-r border-black ${tablePad} text-right font-mono`}>{it.quantity}</td>
                            <td className={`border-r border-black ${tablePad} text-right font-mono`}>
                              {it.unit === 'KG' ? `${it.quantity} KG` : ''}
                            </td>
                            <td className={`border-r border-black ${tablePad} text-right font-mono`}>
                              {formatBillAmount(it.rate)}
                            </td>
                            <td className={`${tablePad} text-right font-mono font-bold`}>
                              {formatBillAmount(it.amount)}
                            </td>
                          </tr>
                        ))}

                        {/* Preserved Blank Rows to maintain traditional wholesale bill spacing */}
                        {Array.from({ length: blankRows }).map((_, bIdx) => (
                          <tr key={`blank-${bIdx}`} className={`border-b border-black/20 ${isB7 ? 'h-3.5' : isB6 ? 'h-4' : 'h-6'}`}>
                            <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                            <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                            <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                            <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                            <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                            <td className={tablePad}>&nbsp;</td>
                          </tr>
                        ))}
                      </tbody>

                      {/* Lower Section: Expenses + Subtotal & Net Total Grid */}
                      <tfoot>
                        <tr className="border-t-2 border-black">
                          {/* Left Bottom Section: E & O.E. + Expenses List */}
                          <td colSpan={isB7 ? 3 : 5} className={`border-r border-black ${tablePad} align-top`}>
                            <div className="flex flex-col justify-between h-full min-h-[50px]">
                              <div className={`${isB7 ? 'text-[7.5px]' : 'text-[10px]'} font-bold text-slate-950 dark:text-slate-950 print:text-black`}>* E & O.E.</div>

                              {/* Listed Individual Expenses (Freight, Hamali, etc.) */}
                              {expenses && expenses.length > 0 && (
                                <div className={`self-end text-right font-mono ${isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]'} space-y-0.5 pr-1`}>
                                  {expenses.map((exp, expIdx) => (
                                    <div key={expIdx} className="flex justify-end gap-2 sm:gap-3 text-slate-950 dark:text-slate-950 print:text-black">
                                      <span className="font-sans font-medium text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                                      <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Right Bottom Section: Sub Total, Expenses, Net Total */}
                          <td colSpan={isB7 ? 3 : 1} className="p-0 align-top">
                            <table className={`w-full ${footerFont} border-collapse`}>
                              <tbody>
                                <tr className="border-b border-black">
                                  <td className={`${tablePad} font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black`}>Sub Total</td>
                                  <td className={`${tablePad} text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black`}>
                                    {formatBillAmount(subtotal)}
                                  </td>
                                </tr>
                                <tr className="border-b border-black">
                                  <td className={`${tablePad} font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black`}>Expenses</td>
                                  <td className={`${tablePad} text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black`}>
                                    {expenses.reduce((s, e) => s + (e.amount || 0), 0) !== 0 ? `+${formatBillAmount(expenses.reduce((s, e) => s + (e.amount || 0), 0))}` : '0.00'}
                                  </td>
                                </tr>
                                <tr>
                                  <td className={`${tablePad} font-bold text-left border-r border-black bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black`}>
                                    Net Total
                                  </td>
                                  <td className={`${tablePad} text-right font-mono font-black ${isB7 ? 'text-[8.5px]' : isB6 ? 'text-[11px]' : 'text-sm'} bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black`}>
                                    {formatBillAmount(totalAmount)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  );
                })()}

                {/* Bottom Words & Signatory Footer */}
                <div className={`mt-2 flex justify-between items-end ${pageSize === 'b7' ? 'text-[7.5px]' : pageSize === 'b6' ? 'text-[9.5px]' : 'text-xs'} pt-1 text-slate-950 dark:text-slate-950 print:text-black`}>
                  <div className="font-bold italic max-w-[60%] leading-tight text-slate-950 dark:text-slate-950 print:text-black">
                    {numberToWordsIndian(totalAmount)}
                  </div>

                  <div className="text-right font-bold uppercase leading-tight text-slate-950 dark:text-slate-950 print:text-black">
                    <div>{formatCompanySignature(activeProfile)}</div>
                  </div>
                </div>

                {/* Software attribution */}
                <div className={`mt-2 pt-0.5 border-t border-dotted border-black/40 ${pageSize === 'b7' ? 'text-[7px]' : 'text-[8px] sm:text-[8.5px]'} text-left text-slate-700 dark:text-slate-700 print:text-black font-mono`}>
                  Software Developed by: {activeProfile?.softwareDevelopedBy || 'Klyia Technology'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AddFruitModal
        isOpen={isAddFruitOpen}
        onClose={() => setIsAddFruitOpen(false)}
        onFruitCreated={handleFruitCreated}
      />

      {/* Format Selection Dialog for Print Button */}
      {isPreviewOpen && (
        <ChooseBillPrintFormatModal
          isOpen={isFormatModalOpen}
          onClose={() => setIsFormatModalOpen(false)}
          documentTitle={`Bill Invoice ${billNo}`}
          elementId="mandi-print-area"
          filename={`Bill_${billNo.replace(/\s+/g, '_')}`}
          defaultSize={pageSize}
          initialAction="print"
          onPaperSizeChange={setPageSize}
        />
      )}
    </div>
  );
};
