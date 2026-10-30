import React, { useState, useEffect, useMemo, useRef } from 'react';
import { CreditSale, CreditSaleItem, Customer, ExpenseItem, Fruit, CrateMovementItem } from '../../types';
import { db } from '../../services/db';
import { getCustomerLedger, getCustomerCrateBalanceByType } from '../../services/accounting';
import { formatCurrency, formatSequence, getTodayIso } from '../../utils/formatters';
import { isCrateUnit } from '../../utils/crateUtils';
import { calculateSaleCrateSummary, formatQtyWithUnit, calculateWholesaleItemAmount } from '../../utils/billingCalculations';
import { getFruitEffectivePrice, getFruitSavedCrateType } from '../../utils/fruitUtils';
import { DatePickerInput } from '../common/DatePickerInput';
import { AddCustomerModal } from '../modals/AddCustomerModal';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { FruitAutocomplete } from '../common/FruitAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import { CreditSalePrintModal } from '../print/CreditSalePrintModal';
import { X, Plus, Trash2, UserPlus, Calculator, Users, AlertTriangle, Printer } from 'lucide-react';

interface CreditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: CreditSale | null;
  onSaved: (item: CreditSale) => void;
  preselectedCustomerId?: string;
  onSaveAndPrint?: (item: CreditSale) => void;
}

export const CreditSaleModal: React.FC<CreditSaleModalProps> = ({
  isOpen,
  onClose,
  editItem,
  onSaved,
  preselectedCustomerId,
  onSaveAndPrint,
}) => {
  const customers = db.getCustomers();
  const fruitsCatalog = db.getFruits();
  const fruits = fruitsCatalog;
  const crateTypes = db.getCrateTypes();

  // Basic info
  const [customerId, setCustomerId] = useState('');
  const selectedCustomer = customers.find((c) => c.id === customerId);
  const [date, setDate] = useState(getTodayIso());
  const [notes, setNotes] = useState('');

  // Bill items
  const [items, setItems] = useState<CreditSaleItem[]>([]);

  // Expenses (dynamic rows with Freight, Hamali, Others by default)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: 'cse-1', name: 'Freight', amount: 100 },
    { id: 'cse-2', name: 'Hamali', amount: 100 },
    { id: 'cse-3', name: 'Others', amount: 50 },
  ]);

  // Financial summary
  const [oldBalance, setOldBalance] = useState<number>(0);
  const [cashReceipt, setCashReceipt] = useState<number | ''>('');
  const [customerError, setCustomerError] = useState(false);

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Initialize or reset form
  useEffect(() => {
    if (!isOpen) return;
    setCustomerError(false);

    if (editItem) {
      setCustomerId(editItem.customerId);
      setDate(editItem.date);
      setNotes(editItem.notes || '');

      // Load items
      const loadedItems: CreditSaleItem[] = (editItem.items || []).map((it, idx) => {
        const kgVal = it.kg !== undefined ? it.kg : 0;
        const rateVal = it.rate || 0;
        const calculatedAmount = calculateWholesaleItemAmount(it.quantity || 1, it.unit || 'Crate', kgVal, rateVal);
        const ctMatch = it.crateTypeId
          ? crateTypes.find((c) => c.id === it.crateTypeId)
          : crateTypes.find((c) => c.name.toLowerCase().includes(String(it.crateName || '').toLowerCase())) || crateTypes[0];

        return {
          id: it.id || `csi-${Date.now()}-${idx}`,
          fruitId: it.fruitId,
          fruitName: it.fruitName || '',
          quantity: it.quantity || 1,
          unit: it.unit || 'Crate',
          kg: kgVal,
          crateTypeId: it.crateTypeId || (it.crateName && ctMatch ? ctMatch.id : ''),
          crateName: it.crateName !== undefined ? it.crateName : (ctMatch ? ctMatch.name.replace(/\s*crate$/i, '').trim() : ''),
          rate: rateVal,
          amount: it.amount !== undefined ? it.amount : calculatedAmount,
          crateSize: it.crateSize,
        };
      });
      setItems(loadedItems);

      // Load expenses from editItem or fallback to defaults
      if (editItem.expenses && editItem.expenses.length > 0) {
        setExpenses(
          editItem.expenses.map((e, idx) => ({
            id: e.id || `cse-${Date.now()}-${idx}`,
            name: e.name || 'Expense',
            amount: e.amount !== undefined ? e.amount : 0,
          }))
        );
      } else {
        setExpenses([
          { id: 'cse-1', name: 'Freight', amount: 100 },
          { id: 'cse-2', name: 'Hamali', amount: 100 },
          { id: 'cse-3', name: 'Others', amount: 50 },
        ]);
      }

      // Calculate old balance before this edit bill
      try {
        const ledger = getCustomerLedger(editItem.customerId);
        const billDebit = editItem.finalAmount || 0;
        const prevReceipt = editItem.cashReceipt || 0;
        const computedOld = Math.round((ledger.closingBalance - billDebit + prevReceipt) * 100) / 100;
        setOldBalance(editItem.oldBalance !== undefined ? editItem.oldBalance : computedOld);
      } catch {
        setOldBalance(editItem.oldBalance || 0);
      }

      setCashReceipt(editItem.cashReceipt !== undefined && editItem.cashReceipt > 0 ? editItem.cashReceipt : '');
    } else {
      const initialCustId = preselectedCustomerId || '';
      setCustomerId(initialCustId);
      setDate(getTodayIso());
      setNotes('');

      // Start with a clean, blank item row for new bill
      setItems([
        {
          id: `csi-${Date.now()}-1`,
          fruitId: '',
          fruitName: '',
          quantity: 1,
          unit: 'Crate',
          crateTypeId: '',
          crateName: '',
          rate: 0,
          amount: 0,
        },
      ]);

      setExpenses([
        { id: 'cse-1', name: 'Freight', amount: 100 },
        { id: 'cse-2', name: 'Hamali', amount: 100 },
        { id: 'cse-3', name: 'Others', amount: 50 },
      ]);
      setCashReceipt('');

      if (initialCustId) {
        try {
          const ledger = getCustomerLedger(initialCustId);
          setOldBalance(ledger.closingBalance);
        } catch {
          setOldBalance(0);
        }
      } else {
        setOldBalance(0);
      }
    }
  }, [isOpen, editItem, preselectedCustomerId]);

  // Update customer balance when customer selection changes (for new bills)
  const handleCustomerChange = (newCustId: string) => {
    setCustomerId(newCustId);
    if (newCustId) {
      setCustomerError(false);
    }
    if (!newCustId) {
      setOldBalance(0);
      return;
    }
    try {
      const ledger = getCustomerLedger(newCustId);
      if (editItem && editItem.customerId === newCustId) {
        const billDebit = editItem.finalAmount || 0;
        const prevReceipt = editItem.cashReceipt || 0;
        setOldBalance(Math.round((ledger.closingBalance - billDebit + prevReceipt) * 100) / 100);
      } else {
        setOldBalance(ledger.closingBalance);
      }
    } catch {
      setOldBalance(0);
    }
  };



  // Row change handler with calculation rules:
  // - Crate items: Amount = Qty × Rate (Crate name/type 20kg or 10kg is only a label for identification & balance tracking)
  // - Non-Crate items (Box, Peti, DABBA, etc.):
  //   If Kg > 0 => Amount = Kg × Rate;
  //   If Kg is 0 or empty => Amount = Qty × Rate.
  const handleItemChange = (index: number, field: keyof CreditSaleItem, val: any) => {
    const updated = [...items];
    const current = { ...updated[index] };

    if (field === 'fruitId') {
      current.fruitId = val;
      const fr = fruits.find((f) => f.id === val);
      if (fr) {
        current.fruitName = fr.name;
        current.unit = fr.unit || fr.defaultUnit || 'Crate';
        const r = getFruitEffectivePrice(fr);
        current.rate = typeof r === 'number' && !isNaN(r) ? r : (fr.defaultRate || 1);
        const fruitCrateType = getFruitSavedCrateType(fr);
        current.crateName = fruitCrateType;
        current.crateTypeId = fruitCrateType ? (fr.crateTypeId || 'ct_20') : '';
      } else {
        current.crateName = '';
        current.crateTypeId = '';
      }
    } else if (field === 'fruitName') {
      current.fruitName = val;
      const fr = fruits.find((f) => f.name.toLowerCase() === String(val).toLowerCase());
      if (fr) {
        current.fruitId = fr.id;
        const fruitCrateType = getFruitSavedCrateType(fr);
        current.crateName = fruitCrateType;
        current.crateTypeId = fruitCrateType ? (fr.crateTypeId || 'ct_20') : '';
      } else {
        current.fruitId = '';
        current.crateName = '';
        current.crateTypeId = '';
      }
    } else if (field === 'quantity') {
      const q = val === '' ? '' : Number(val);
      current.quantity = (q === '' || isNaN(q as number)) ? (val === '' ? '' : 0) as any : q;
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
    } else if (field === 'kg') {
      const k = val === '' ? '' : Number(val);
      current.kg = (k === '' || isNaN(k as number)) ? (val === '' ? '' : 0) as any : k;
    } else if (field === 'rate') {
      const r = val === '' ? '' : Number(val);
      current.rate = (r === '' || isNaN(r as number)) ? (val === '' ? '' : 0) as any : r;
    }

    const qNum = (current.quantity as any) === '' ? 0 : (Number(current.quantity) || 0);
    const kNum = (current.kg as any) === '' ? 0 : (Number(current.kg) || 0);
    const rNum = (current.rate as any) === '' ? 0 : (Number(current.rate) || 0);

    // Live amount calculation: updates immediately whenever Qty, unit, Kg, or Rate changes
    current.amount = calculateWholesaleItemAmount(
      qNum,
      current.unit,
      kNum,
      rNum
    );

    updated[index] = current;
    setItems(updated);
  };

  // Selecting a fruit suggestion loads catalog details and auto-fills fields
  const handleSelectSuggestion = (index: number, fruit: Fruit) => {
    const updated = [...items];
    const current = { ...updated[index] };
    current.fruitId = fruit.id;
    current.fruitName = fruit.name;

    // 1. Auto-fill Unit
    current.unit = fruit.unit || fruit.defaultUnit || 'Crate';

    // 2. Auto-fill Rate
    const rate = getFruitEffectivePrice(fruit);
    current.rate = typeof rate === 'number' && !isNaN(rate) ? rate : (fruit.defaultRate || 1);

    // 3. Crate Type: automatically fetched from Fruit / Item Master (exact value or blank)
    const fruitCrateType = getFruitSavedCrateType(fruit);
    current.crateName = fruitCrateType;
    current.crateTypeId = fruitCrateType ? (fruit.crateTypeId || 'ct_20') : '';

    // 4. Qty defaults to 1 but remains editable
    current.quantity = 1;

    // 5. Weight defaults to 0
    current.kg = 0;

    // Live amount calculation: Qty × Rate (Weight and Crate Type are separate informational fields)
    current.amount = calculateWholesaleItemAmount(
      current.quantity,
      current.unit,
      current.kg,
      current.rate
    );
    updated[index] = current;
    setItems(updated);
  };

  const handleAddRow = () => {
    setItems([
      ...items,
      {
        id: `csi-${Date.now()}-${items.length + 1}`,
        fruitId: '',
        fruitName: '',
        quantity: 1,
        unit: 'Crate',
        kg: 0,
        crateTypeId: '',
        crateName: '',
        rate: 0,
        amount: 0,
      },
    ]);
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) {
      setItems([
        {
          id: `csi-${Date.now()}`,
          fruitName: '',
          quantity: 10,
          unit: 'Crate',
          crateTypeId: '',
          crateName: '',
          rate: 0,
          amount: 0,
        },
      ]);
      return;
    }
    setItems(items.filter((_, i) => i !== index));
  };

  // Crate Balance: Track crate quantities separately by crate type (e.g. 10 of 20kg vs 10 of 10kg)
  const crateSummary = useMemo(() => {
    return calculateSaleCrateSummary(items);
  }, [items]);

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

  const totalCrateBalance = crateSummary.totalBalanceCrates;

  // Middle section: Expenses calculations and dynamic handlers
  const handleExpenseChange = (index: number, field: 'name' | 'amount', val: any) => {
    const updated = [...expenses];
    if (field === 'amount') {
      const num = val === '' ? '' : Number(val);
      updated[index] = { ...updated[index], amount: isNaN(num as number) ? 0 : (num as any) };
    } else {
      updated[index] = { ...updated[index], name: val };
    }
    setExpenses(updated);
  };

  const handleAddExpense = () => {
    setExpenses((prev) => [
      ...prev,
      { id: `cse-${Date.now()}-${prev.length + 1}`, name: 'Other', amount: 0 },
    ]);
  };

  const handleRemoveExpense = (index: number) => {
    setExpenses((prev) => prev.filter((_, i) => i !== index));
  };

  const totalExpense = Math.round(
    expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) * 100
  ) / 100;

  // Right side: Financial Totals
  // Total = sum of all item Amount values
  const totalItemAmount = useMemo(() => {
    return items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  }, [items]);

  // Total Qty = sum of all item quantities (empty treated as 0, decimals supported, Weight strictly not included)
  const totalQty = useMemo(() => {
    return Math.round(items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000) / 1000;
  }, [items]);

  // Net Total = Total + Expense
  const netTotal = Math.round((totalItemAmount + totalExpense) * 100) / 100;

  // Cash Receipt
  const numCashReceipt = typeof cashReceipt === 'number' ? cashReceipt : (Number(cashReceipt) || 0);

  // Total Balance = Net Total + Old Balance - Cash Receipt
  const totalBalance = Math.round((netTotal + oldBalance - numCashReceipt) * 100) / 100;

  // Memoized current sale record for live print preview
  const currentSaleRecord: CreditSale = useMemo(() => {
    const cust = customers.find((c) => c.id === customerId);
    const seq = editItem ? editItem.sequenceNumber : 1;
    const creditSaleNo = editItem
      ? editItem.creditSaleNo
      : `Credit Sale No. ${formatSequence(seq, 3)}`;

    const expensesList: ExpenseItem[] = expenses.map((e, idx) => ({
      id: e.id || `cse-${Date.now()}-${idx}`,
      name: (e.name || '').trim() || 'Expense',
      amount: Number(e.amount) || 0,
    }));

    const crateTypeMap = new Map<string, { crateTypeId: string; crateName: string; outQuantity: number }>();
    items.forEach((it) => {
      if (isCrateUnit(it.unit)) {
        const q = Number(it.quantity) || 0;
        if (q > 0) {
          const ct = crateTypes.find((c) => c.id === it.crateTypeId || c.name.toLowerCase().includes(String(it.crateName || '').toLowerCase())) || crateTypes[0];
          const ctId = ct ? ct.id : (it.crateTypeId || 'ct_20');
          const ctName = it.crateName || (ct ? ct.name.replace(/\s*crate$/i, '').trim() : '20kg');
          const existing = crateTypeMap.get(ctId) || { crateTypeId: ctId, crateName: ctName, outQuantity: 0 };
          existing.outQuantity += q;
          crateTypeMap.set(ctId, existing);
        }
      }
    });

    const preparedCrateMovements: CrateMovementItem[] = Array.from(crateTypeMap.values()).map((c) => ({
      crateTypeId: c.crateTypeId,
      crateName: c.crateName,
      outQuantity: c.outQuantity,
      inQuantity: 0,
    }));

    const totalCrateOut = preparedCrateMovements.reduce((sum, m) => sum + m.outQuantity, 0);
    const firstCtId = preparedCrateMovements[0]?.crateTypeId || crateTypes[0]?.id || 'ct_20';
    const firstCt = crateTypes.find((c) => c.id === firstCtId) || crateTypes[0];

    return {
      id: editItem ? editItem.id : 'preview-credit-sale',
      creditSaleNo,
      sequenceNumber: seq,
      customerId,
      customerName: cust ? cust.name : (selectedCustomer?.name || 'Customer'),
      date,
      items: items.map((it) => ({
        ...it,
        amount: calculateWholesaleItemAmount(it.quantity, it.unit, it.kg, it.rate),
      })),
      crateTypeId: firstCt?.id,
      crateName: firstCt?.name,
      crateIn: 0,
      crateOut: totalCrateOut,
      crateWeightKg: firstCt?.defaultWeightKg || 20,
      crateMovements: preparedCrateMovements.length > 0 ? preparedCrateMovements : undefined,
      expenses: expensesList,
      productTotal: totalItemAmount,
      expenseTotal: totalExpense,
      totalDebit: netTotal,
      finalAmount: netTotal,
      netTotal,
      oldBalance,
      cashReceipt: numCashReceipt,
      totalBalance,
      totalCrateBalance: totalCrateOut,
      notes: notes.trim() || undefined,
      createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
      saleType: 'wholesale',
    };
  }, [editItem, customerId, customers, selectedCustomer, date, items, expenses, totalItemAmount, totalExpense, netTotal, oldBalance, numCashReceipt, totalBalance, notes, crateTypes]);

  const handleSubmit = (e: React.FormEvent, andPrint = false) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!customerId) {
      setCustomerError(true);
      return;
    }
    if (items.length === 0) return;
    setIsSubmitting(true);

    const cust = customers.find((c) => c.id === customerId);
    const seq = editItem ? editItem.sequenceNumber : db.getNextCreditSaleNumber();
    const creditSaleNo = editItem
      ? editItem.creditSaleNo
      : `Credit Sale No. ${formatSequence(seq, 3)}`;

    // Prepare expenses array
    const expensesList: ExpenseItem[] = expenses.map((e, idx) => ({
      id: e.id || `cse-${Date.now()}-${idx}`,
      name: (e.name || '').trim() || 'Expense',
      amount: Number(e.amount) || 0,
    }));

    // Prepare crate movements directly from line items where unit is Crate, grouped by crate type
    const crateTypeMap = new Map<string, { crateTypeId: string; crateName: string; outQuantity: number }>();
    items.forEach((it) => {
      if (isCrateUnit(it.unit)) {
        const q = Number(it.quantity) || 0;
        if (q > 0) {
          const ct = crateTypes.find((c) => c.id === it.crateTypeId || c.name.toLowerCase().includes(String(it.crateName || '').toLowerCase())) || crateTypes[0];
          const ctId = ct ? ct.id : (it.crateTypeId || 'ct_20');
          const ctName = it.crateName || (ct ? ct.name.replace(/\s*crate$/i, '').trim() : '20kg');
          const existing = crateTypeMap.get(ctId) || { crateTypeId: ctId, crateName: ctName, outQuantity: 0 };
          existing.outQuantity += q;
          crateTypeMap.set(ctId, existing);
        }
      }
    });

    const preparedCrateMovements: CrateMovementItem[] = Array.from(crateTypeMap.values()).map((c) => ({
      crateTypeId: c.crateTypeId,
      crateName: c.crateName,
      outQuantity: c.outQuantity,
      inQuantity: 0,
    }));

    const totalCrateOut = preparedCrateMovements.reduce((sum, m) => sum + m.outQuantity, 0);

    const firstCtId = preparedCrateMovements[0]?.crateTypeId || crateTypes[0]?.id || 'ct_20';
    const firstCt = crateTypes.find((c) => c.id === firstCtId) || crateTypes[0];

    const saleRecord: CreditSale = {
      id: editItem ? editItem.id : `cs-${Date.now()}`,
      creditSaleNo,
      sequenceNumber: seq,
      customerId,
      customerName: cust ? cust.name : 'Customer',
      date,
      items: items.map((it) => ({
        ...it,
        amount: calculateWholesaleItemAmount(it.quantity, it.unit, it.kg, it.rate),
      })),
      crateTypeId: firstCt?.id,
      crateName: firstCt?.name,
      crateIn: 0,
      crateOut: totalCrateOut,
      crateWeightKg: firstCt?.defaultWeightKg || 20,
      crateMovements: preparedCrateMovements.length > 0 ? preparedCrateMovements : undefined,
      expenses: expensesList,
      productTotal: totalItemAmount,
      expenseTotal: totalExpense,
      totalDebit: netTotal,
      finalAmount: netTotal, // Debit added to customer ledger
      netTotal,
      oldBalance,
      cashReceipt: numCashReceipt,
      totalBalance,
      totalCrateBalance: totalCrateOut,
      notes: notes.trim() || undefined,
      createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
      saleType: editItem ? (editItem.saleType || 'wholesale') : 'wholesale',
      isGroupSale: editItem ? Boolean(editItem.isGroupSale) : false,
      groupId: editItem ? editItem.groupId : undefined,
    };

    // Save credit sale to database
    db.saveCreditSale(saleRecord);

    // Synchronize Cash Receipt if entered
    const linkedReceiptId = `rec-cs-${saleRecord.id}`;
    if (numCashReceipt > 0) {
      db.saveReceipt({
        id: linkedReceiptId,
        receiptNo: `REC-CS-${formatSequence(saleRecord.sequenceNumber, 3)}`,
        sequenceNumber: db.getNextReceiptNumber(),
        customerId: saleRecord.customerId,
        customerName: saleRecord.customerName,
        date: saleRecord.date,
        paymentMode: 'Cash',
        amount: numCashReceipt,
        notes: `Cash Receipt against ${saleRecord.creditSaleNo}`,
        createdAt: saleRecord.createdAt,
      });
    } else {
      // Remove any previously recorded cash receipt if updated to 0
      db.deleteReceipt(linkedReceiptId);
    onSaved(saleRecord);
    if (andPrint && onSaveAndPrint) {
      onSaveAndPrint(saleRecord);
    }
    setIsSubmitting(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-4xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto min-w-0 mx-2 sm:mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-4 dark:border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editItem ? `Edit ${editItem.creditSaleNo}` : 'New Wholesale Credit Sale'}
              </h3>
              <p className="text-xs text-slate-500">
                Direct wholesale mandi credit sale & billing calculation
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
            {/* Customer & Date Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Customer *
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddCustomerOpen(true)}
                      className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                    >
                      <UserPlus className="h-3.5 w-3.5" /> + Add Customer
                    </button>
                  </div>
                  <CustomerAutocomplete
                    valueCustomerId={customerId}
                    onChange={(cust) => handleCustomerChange(cust ? cust.id : '')}
                    hasError={customerError}
                    placeholder="Search customer name, mobile or city..."
                  />
                  {customerError && (
                    <p className="mt-1 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Please search and select a customer before entering the sale.
                    </p>
                  )}
                  {selectedCustomer && (
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {selectedCustomer.mobile && (
                        <span>Mob: <strong className="text-slate-700 dark:text-slate-300">{selectedCustomer.mobile}</strong></span>
                      )}
                      {selectedCustomer.city && (
                        <span>City: <strong className="text-slate-700 dark:text-slate-300">{selectedCustomer.city}</strong></span>
                      )}
                      <span>Old Bal: <strong className="text-slate-700 dark:text-slate-300 font-mono-numbers">{formatCurrency(oldBalance)}</strong></span>
                    </div>
                  )}
                </div>

                <div>
                  <DatePickerInput
                    label="Date"
                    required
                    value={date}
                    onChange={setDate}
                  />
                </div>
              </div>
            </div>

            {/* Bill Items Card */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800 dark:bg-slate-800/30">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Bill Items ({items.length})
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                    Total Qty: <strong className="font-mono text-emerald-900 dark:text-emerald-200">{totalQty}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" /> + Add Row
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
                      <th className="py-2.5 px-1 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                    {items.map((it, idx) => {
                      return (
                        <tr key={it.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                          {/* 1. No. */}
                          <td className="py-2 px-2 text-center font-mono text-slate-500 font-bold">
                            {idx + 1}
                          </td>

                          {/* 2. Item Name */}
                          <td className="py-2 px-2 min-w-[180px]">
                            <FruitAutocomplete
                              valueFruitId={it.fruitId || ''}
                              valueFruitName={it.fruitName}
                              onChange={(fruit, customName) => {
                                if (fruit) {
                                  handleSelectSuggestion(idx, fruit);
                                } else {
                                  handleItemChange(idx, 'fruitName', customName || '');
                                  handleItemChange(idx, 'fruitId', '');
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
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-right font-mono font-bold outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800"
                            />
                          </td>

                          {/* 4. Unit */}
                          <td className="py-2 px-2 text-center">
                            <input
                              type="text"
                              placeholder="Unit"
                              value={it.unit || ''}
                              onChange={(e) => handleItemChange(idx, 'unit', e.target.value)}
                              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white text-center"
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
                              list={`crate-types-${idx}`}
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
                            <datalist id={`crate-types-${idx}`}>
                              <option value="20kg" />
                              <option value="10kg" />
                              <option value="15kg" />
                              <option value="24kg" />
                            </datalist>
                          </td>

                          {/* 7. Rate */}
                          <td className="py-2 px-2 text-right">
                            <div className="relative">
                              <span className="absolute left-2 top-1.5 text-[11px] text-slate-400">₹</span>
                              <QuantityInput
                                min={0}
                                step="any"
                                placeholder="0.00"
                                value={it.rate === 0 ? '' : it.rate}
                                onChange={(val) => handleItemChange(idx, 'rate', val)}
                                className="w-full rounded-lg border border-slate-300 bg-white pl-5 pr-2 py-1.5 text-right font-medium text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                              />
                            </div>
                          </td>

                          {/* 8. Amount */}
                          <td className="py-2 px-2 text-right">
                            <span className="font-mono font-bold text-xs text-slate-900 dark:text-white block py-1.5">
                              {formatCurrency(it.amount)}
                            </span>
                          </td>

                          {/* Action */}
                          <td className="py-2 px-1 text-center">
                            <button
                              type="button"
                              onClick={() => handleRemoveRow(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                              title="Remove item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 bg-slate-100/70 font-bold dark:border-slate-800 dark:bg-slate-800/60">
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
                        {formatCurrency(totalItemAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                <button
                  type="button"
                  onClick={handleAddRow}
                  className="flex items-center gap-1 font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  <Plus className="h-3.5 w-3.5" /> + Add Another Item
                </button>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-400">
                    Crate Balance:
                  </span>
                  {crateBreakdownText ? (
                    <span className="font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 rounded border border-sky-200 dark:border-sky-800">
                      {crateBreakdownText}
                    </span>
                  ) : (
                    <span className="text-slate-400">No crate items</span>
                  )}
                  <span className="text-[11px] text-slate-400 ml-1">
                    (Amount = Qty × Rate)
                  </span>
                </div>
              </div>
            </div>

            {/* Consignment Expenses Card */}
            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    Consignment Expenses
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Freight, Hamali, and other deductions added to the bill
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddExpense}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
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
                        className="w-full rounded-lg border border-slate-300 pl-6 pr-3 py-1.5 text-right font-mono text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                    {expenses.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveExpense(idx)}
                        className="p-1.5 text-slate-400 hover:text-rose-500"
                        title="Remove expense"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Summary Box (4 metric cards matching Sale Proceeds) */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="block text-[11px] font-medium text-slate-500">Items Total</span>
                  <span className="text-base font-bold font-mono-numbers text-slate-900 dark:text-white">
                    {formatCurrency(totalItemAmount)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="block text-[11px] font-medium text-slate-500">Total Expense</span>
                  <span className="text-base font-bold font-mono-numbers text-rose-600 dark:text-rose-400">
                    +{formatCurrency(totalExpense)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 shadow-2xs">
                  <span className="block text-[11px] font-medium text-emerald-700 dark:text-emerald-300">Net Bill Total</span>
                  <span className="text-base font-bold font-mono-numbers text-emerald-700 dark:text-emerald-300">
                    {formatCurrency(netTotal)}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs">
                  <span className="block text-[11px] font-medium text-slate-500">Total Balance</span>
                  <span className="text-base font-bold font-mono-numbers text-rose-600 dark:text-rose-400">
                    {formatCurrency(totalBalance)}
                  </span>
                </div>
              </div>

              {/* Old Balance & Cash Receipt Row */}
              <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Customer Old Balance:</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {formatCurrency(oldBalance)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400 font-medium">Cash Receipt (Paid Now):</span>
                  <div className="relative w-36">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400">₹</span>
                    <QuantityInput
                      min={0}
                      step="any"
                      placeholder="0.00"
                      value={cashReceipt}
                      onChange={(val) => setCashReceipt(val)}
                      className="w-full rounded-lg border border-emerald-400 pl-6 pr-2 py-1 text-right font-mono text-xs font-bold text-emerald-700 outline-none focus:border-emerald-600 dark:bg-slate-800 dark:text-emerald-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Notes / Mandi Remarks
              </label>
              <input
                type="text"
                placeholder="Optional bill notes or remarks"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(true)}
                disabled={items.length === 0}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600 px-3.5 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer className="h-3.5 w-3.5" /> Preview / Print Bill
              </button>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                {onSaveAndPrint && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={(e) => handleSubmit(e, true)}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-500 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    <Printer className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                    {isSubmitting ? 'Processing...' : editItem ? 'Update & Print' : 'Save & Print'}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Saving...' : editItem ? 'Update Credit Sale' : 'Save Credit Sale'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={(newCust) => {
          handleCustomerChange(newCust.id);
          setIsAddCustomerOpen(false);
        }}
      />

      {isPrintModalOpen && (
        <CreditSalePrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          creditSale={currentSaleRecord}
        />
      )}
    </>
  );
};

