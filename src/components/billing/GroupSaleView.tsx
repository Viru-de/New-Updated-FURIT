import React, { useState, useEffect, useMemo } from 'react';
import { CreditSale, CreditSaleItem, Customer, Fruit, ExpenseItem } from '../../types';
import { db } from '../../services/db';
import { getCustomerLedger } from '../../services/accounting';
import {
  formatCurrency,
  formatQuantity,
  formatDate,
  toIsoDate,
  getTodayIso,
  formatSequence,
  formatCompanySignature,
} from '../../utils/formatters';
import {
  isCrateUnit,
  getAvailableCrateSizes,
  getDefaultCrateSizeForFruit,
} from '../../utils/crateUtils';
import { calculateWholesaleItemAmount } from '../../utils/billingCalculations';
import { getFruitEffectivePrice } from '../../utils/fruitUtils';
import { DatePickerInput } from '../common/DatePickerInput';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { FruitAutocomplete } from '../common/FruitAutocomplete';
import { UnitAutocomplete } from '../common/UnitAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportCreditSales } from '../../utils/excelEngine';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { CreditSalePrintModal } from '../print/CreditSalePrintModal';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import {
  Plus,
  Save,
  RotateCcw,
  Trash2,
  Printer,
  Search,
  AlertCircle,
  CheckCircle2,
  Calendar,
  Layers,
  Users,
  Box,
  TrendingUp,
  FileSpreadsheet,
  AlertTriangle,
  Building2,
  X,
} from 'lucide-react';

export interface GroupSaleRow {
  rowId: string; // Temporary unique identifier for the row state
  id?: string; // If existing CreditSale, its real id
  creditSaleNo: string;
  sequenceNumber?: number;
  customerId: string;
  customerName: string;
  fruitId: string;
  fruitName: string;
  quantity: number | '';
  unit: string;
  kg: number | ''; // Weight in Kg (default 0)
  crateSize?: number | string; // Crate size options (10, 20, 30, 40 etc.)
  rate: number | '';
  crateTypeId?: string;
  crateName?: string;
  crateCount: number | ''; // Crate in/out count
  totalAmount: number;
  freight?: number | '';
  hamali?: number | '';
  othersExpense?: number | '';
  expenseTotal?: number;
  netTotal?: number;
  notes?: string;
  isExisting: boolean;
  isDirty?: boolean;
  errors?: {
    customer?: string;
    item?: string;
    quantity?: string;
    rate?: string;
  };
}

interface GroupSaleViewProps {
  initialDate?: string;
  onNavigateToCustomerLedger?: (customerId: string) => void;
}

export const GroupSaleView: React.FC<GroupSaleViewProps> = ({
  initialDate,
  onNavigateToCustomerLedger,
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate ? toIsoDate(initialDate) : getTodayIso()
  );

  const [rows, setRows] = useState<GroupSaleRow[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingDateChange, setPendingDateChange] = useState<string | null>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modal for previewing/printing an individual customer's Credit Sale Bill
  const [printingSale, setPrintingSale] = useState<CreditSale | null>(null);

  // Cached masters
  const customers = db.getCustomers();
  const fruits = db.getFruits();
  const crateTypes = db.getCrateTypes();
  const defaultCrate = crateTypes[0];
  const availableCrateSizes = useMemo(() => getAvailableCrateSizes(), [crateTypes]);

  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile() || profiles[0];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const currentProfile = profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  // Load sales records for the selected date
  const loadSalesForDate = (dateToLoad: string) => {
    const allCreditSales = db.getCreditSales();
    const targetIso = toIsoDate(dateToLoad);
    // ONLY load records belonging to Group Sale. Independent Wholesale Credit Sales must never appear here.
    const dateSales = allCreditSales.filter(
      (cs) => cs.date === targetIso && (cs.saleType === 'group' || cs.isGroupSale === true)
    );

    // Map existing credit sales into editable rows
    const loadedRows: GroupSaleRow[] = [];

    dateSales.forEach((sale) => {
      if (sale.items && sale.items.length > 0) {
        sale.items.forEach((item, itemIdx) => {
          const isCrate = isCrateUnit(item.unit);
          const kgVal = item.kg !== undefined ? item.kg : 0;
          const rateVal = item.rate || 0;
          const calculatedAmount = calculateWholesaleItemAmount(
            item.quantity,
            item.unit,
            kgVal,
            rateVal
          );

          const freightExp = sale.expenses?.find((e) => e.name.toLowerCase().includes('freight'))?.amount || 0;
          const hamaliExp = sale.expenses?.find((e) => e.name.toLowerCase().includes('hamali'))?.amount || 0;
          const othersExp = sale.expenses?.find((e) => !e.name.toLowerCase().includes('freight') && !e.name.toLowerCase().includes('hamali'))?.amount || 0;

          loadedRows.push({
            rowId: `row-${sale.id}-${item.id || itemIdx}`,
            id: sale.id,
            creditSaleNo: sale.creditSaleNo,
            sequenceNumber: sale.sequenceNumber,
            customerId: sale.customerId,
            customerName: sale.customerName,
            fruitId: item.fruitId || '',
            fruitName: item.fruitName,
            quantity: item.quantity,
            unit: item.unit || 'Crate',
            kg: kgVal,
            crateSize: isCrate
              ? (item.crateSize !== undefined ? item.crateSize : (sale.crateWeightKg || undefined))
              : undefined,
            rate: rateVal,
            crateTypeId: item.crateTypeId || sale.crateTypeId || defaultCrate?.id || 'ct_20',
            crateName: item.crateName || sale.crateName || (defaultCrate ? defaultCrate.name.replace(/\s*crate$/i, '').trim() : '20kg'),
            crateCount: isCrate ? (sale.crateOut || item.quantity || 0) : 0,
            totalAmount: item.amount !== undefined ? item.amount : calculatedAmount,
            freight: itemIdx === 0 ? freightExp : 0,
            hamali: itemIdx === 0 ? hamaliExp : 0,
            othersExpense: itemIdx === 0 ? othersExp : 0,
            expenseTotal: itemIdx === 0 ? (sale.expenseTotal || 0) : 0,
            netTotal: itemIdx === 0 ? (sale.finalAmount || item.amount) : item.amount,
            notes: sale.notes,
            isExisting: true,
            isDirty: false,
          });
        });
      } else {
        // Fallback for flat structure
        const rateVal = sale.finalAmount || 0;
        const calculatedAmount = calculateWholesaleItemAmount(1, 'Crate', 0, rateVal);
        loadedRows.push({
          rowId: `row-${sale.id}`,
          id: sale.id,
          creditSaleNo: sale.creditSaleNo,
          sequenceNumber: sale.sequenceNumber,
          customerId: sale.customerId,
          customerName: sale.customerName,
          fruitId: fruits[0]?.id || '',
          fruitName: fruits[0]?.name || 'Fruit',
          quantity: 1,
          unit: 'Crate',
          kg: 0,
          crateSize: sale.crateWeightKg || undefined,
          rate: rateVal,
          crateTypeId: sale.crateTypeId || defaultCrate?.id || 'ct_20',
          crateName: sale.crateName || (defaultCrate ? defaultCrate.name.replace(/\s*crate$/i, '').trim() : '20kg'),
          crateCount: sale.crateOut || 1,
          totalAmount: sale.productTotal !== undefined ? sale.productTotal : calculatedAmount,
          freight: 0,
          hamali: 0,
          othersExpense: 0,
          expenseTotal: sale.expenseTotal || 0,
          netTotal: sale.finalAmount || calculatedAmount,
          notes: sale.notes,
          isExisting: true,
          isDirty: false,
        });
      }
    });

    setRows(loadedRows);
    setDeletedIds([]);
    setHasUnsavedChanges(false);
  };

  // Initial load or date switch
  useEffect(() => {
    loadSalesForDate(selectedDate);
  }, [selectedDate]);

  // Window beforeunload warning if unsaved
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Handle Date Selection with Unsaved Check
  const handleDateChange = (newDateIso: string) => {
    if (newDateIso === selectedDate) return;
    if (hasUnsavedChanges) {
      setPendingDateChange(newDateIso);
      setShowDiscardConfirm(true);
    } else {
      setSelectedDate(newDateIso);
    }
  };

  const confirmDiscardDateChange = () => {
    if (pendingDateChange) {
      setSelectedDate(pendingDateChange);
      setPendingDateChange(null);
    }
    setShowDiscardConfirm(false);
    setHasUnsavedChanges(false);
  };

  // Add new empty row matching Wholesale Credit Sale rules
  const handleAddRow = () => {
    const nextSeq = db.getNextCreditSaleNumber() + rows.filter((r) => !r.isExisting).length;
    const billNo = `Credit Sale No. ${formatSequence(nextSeq, 3)}`;

    const newRow: GroupSaleRow = {
      rowId: `new-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      creditSaleNo: billNo,
      sequenceNumber: nextSeq,
      customerId: '',
      customerName: '',
      fruitId: '',
      fruitName: '',
      quantity: 1, // Default Qty = 1
      unit: 'Crate',
      kg: 0, // Default Kg to 0 for new rows
      crateSize: undefined,
      rate: 0,
      crateTypeId: defaultCrate?.id || 'ct_20',
      crateName: defaultCrate ? defaultCrate.name.replace(/\s*crate$/i, '').trim() : '20kg',
      crateCount: 0,
      totalAmount: 0,
      freight: 0,
      hamali: 0,
      othersExpense: 0,
      expenseTotal: 0,
      netTotal: 0,
      isExisting: false,
      isDirty: true,
    };

    setRows((prev) => [...prev, newRow]);
    setHasUnsavedChanges(true);
  };

  // Remove row
  const handleRemoveRow = (rowId: string) => {
    const target = rows.find((r) => r.rowId === rowId);
    if (!target) return;

    if (target.isExisting && target.id) {
      setDeletedIds((prev) => [...prev, target.id!]);
    }

    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
    setHasUnsavedChanges(true);
  };

  // Clear only unsaved rows
  const handleClearUnsavedRows = () => {
    const unsavedCount = rows.filter((r) => !r.isExisting).length;
    if (unsavedCount === 0) return;
    setRows((prev) => prev.filter((r) => r.isExisting));
    setHasUnsavedChanges(rows.some((r) => r.isDirty && r.isExisting));
    setShowClearConfirm(false);
    setNotification({
      type: 'info',
      message: `Cleared ${unsavedCount} unsaved row(s).`,
    });
  };

  // Row field change updates following Wholesale Credit Sale calculation rules
  const handleRowFieldChange = (
    rowId: string,
    field: keyof GroupSaleRow,
    value: any
  ) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        const updated = { ...r, [field]: value, isDirty: true };

        // 1. When Unit changes
        if (field === 'unit') {
          const prevWasCrate = isCrateUnit(r.unit);
          const nextUnit = String(value).trim();
          updated.unit = nextUnit;
          if (isCrateUnit(nextUnit)) {
            if (!updated.crateTypeId) {
              updated.crateTypeId = defaultCrate?.id || 'ct_20';
              updated.crateName = defaultCrate ? defaultCrate.name.replace(/\s*crate$/i, '').trim() : '20kg';
            }
            const q = typeof updated.quantity === 'number' ? updated.quantity : Number(updated.quantity) || 1;
            updated.crateCount = q;
          } else {
            updated.crateSize = undefined;
            updated.crateCount = 0;
          }
        }

        // 2. When crateTypeId changes
        if (field === 'crateTypeId') {
          updated.crateTypeId = value;
          const ct = crateTypes.find((c) => c.id === value);
          updated.crateName = ct ? ct.name.replace(/\s*crate$/i, '').trim() : '20kg';
        }

        // 2b. When crateName changes
        if (field === 'crateName') {
          updated.crateName = value;
        }

        // 3. When crateSize changes
        if (field === 'crateSize') {
          updated.crateSize = value !== '' && value !== undefined ? Number(value) : undefined;
        }

        // 3. Recalculate amount whenever Qty, Unit, Kg, or Rate changes
        if (field === 'quantity' || field === 'kg' || field === 'rate' || field === 'unit') {
          const q = typeof updated.quantity === 'number' ? updated.quantity : Number(updated.quantity) || 0;
          const k = typeof updated.kg === 'number' ? updated.kg : Number(updated.kg) || 0;
          const p = typeof updated.rate === 'number' ? updated.rate : Number(updated.rate) || 0;

          if (field === 'quantity' && isCrateUnit(updated.unit)) {
            updated.crateCount = q;
          }

          // Exact Calculation: Weight > 0 ? Weight × Rate : Quantity × Rate (regardless of unit)
          updated.totalAmount = calculateWholesaleItemAmount(q, updated.unit, k, p);

          const f = typeof updated.freight === 'number' ? updated.freight : Number(updated.freight) || 0;
          const h = typeof updated.hamali === 'number' ? updated.hamali : Number(updated.hamali) || 0;
          const o = typeof updated.othersExpense === 'number' ? updated.othersExpense : Number(updated.othersExpense) || 0;
          updated.expenseTotal = Math.round((f + h + o) * 100) / 100;
          updated.netTotal = Math.round((updated.totalAmount + updated.expenseTotal) * 100) / 100;
        }

        return updated;
      })
    );
    setHasUnsavedChanges(true);
  };

  // Customer selected in row
  const handleCustomerSelect = (rowId: string, customer: Customer | null) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        return {
          ...r,
          customerId: customer ? customer.id : '',
          customerName: customer ? customer.name : '',
          isDirty: true,
          errors: { ...r.errors, customer: undefined },
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Fruit selected or cleared in row
  const handleFruitSelect = (rowId: string, fruit: Fruit | null, customName?: string) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        if (!fruit) {
          return {
            ...r,
            fruitId: '',
            fruitName: customName || '',
            crateSize: undefined,
            crateName: '',
            crateTypeId: '',
            rate: 0,
            kg: 0,
            totalAmount: 0,
            crateCount: 0,
            isDirty: true,
          };
        }
        // 1. Qty defaults to 1 but remains editable
        const currentQty = 1;
        // 2. Auto-fill Rate
        const newRate = getFruitEffectivePrice(fruit);
        // 3. Auto-fill Unit
        const newUnit = fruit.unit || fruit.defaultUnit || 'Crate';
        const isCrate = isCrateUnit(newUnit);
        // 4. Auto-fill Crate Type (save exactly what was entered, e.g. 20kg or 10kg, or blank)
        const ctName = fruit.crateType !== undefined ? fruit.crateType : (fruit.crateName || '');
        const crateSize = isCrate ? getDefaultCrateSizeForFruit(fruit) : undefined;
        // 5. Weight defaults to 0
        const currentKg = 0;

        const newAmount = calculateWholesaleItemAmount(currentQty, newUnit, currentKg, newRate);

        return {
          ...r,
          fruitId: fruit.id,
          fruitName: fruit.name,
          quantity: currentQty,
          unit: newUnit,
          kg: currentKg,
          crateSize: crateSize,
          crateName: ctName,
          crateTypeId: ctName ? (crateTypes.find(c => c.name.toLowerCase().includes(ctName.toLowerCase()))?.id || fruit.crateTypeId || 'ct_20') : '',
          rate: newRate,
          totalAmount: newAmount,
          crateCount: isCrate ? currentQty : 0,
          isDirty: true,
          errors: { ...r.errors, item: undefined },
        };
      })
    );
    setHasUnsavedChanges(true);
  };

  // Prepare CreditSale object for printing in Wholesale Credit Sale format
  const handlePrintRowBill = (row: GroupSaleRow) => {
    const cust = customers.find((c) => c.id === row.customerId);
    const q = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity) || 0;
    const k = typeof row.kg === 'number' ? row.kg : Number(row.kg) || 0;
    const r = typeof row.rate === 'number' ? row.rate : Number(row.rate) || 0;
    const amount = calculateWholesaleItemAmount(q, row.unit, k, r);
    const isCrate = isCrateUnit(row.unit);
    const crates = typeof row.crateCount === 'number' ? row.crateCount : Number(row.crateCount) || 0;
    const crateSizeVal = isCrate && row.crateSize ? Number(row.crateSize) : undefined;

    const ctMatch = crateTypes.find((c) => c.id === row.crateTypeId || c.name.toLowerCase().includes(String(row.crateName || '').toLowerCase()));
    const ctId = ctMatch?.id || row.crateTypeId || defaultCrate?.id || 'ct_20';
    const ctName = row.crateName || (ctMatch ? ctMatch.name.replace(/\s*crate$/i, '').trim() : '20kg');
    const crateMovementsList = isCrate && q > 0 ? [
      {
        crateTypeId: ctId,
        crateName: ctName,
        outQuantity: crates > 0 ? crates : q,
        inQuantity: 0,
      }
    ] : [];

    let customerOldBalance = 0;
    if (cust) {
      try {
        const ledger = getCustomerLedger(cust.id);
        customerOldBalance = ledger.closingBalance;
      } catch {
        customerOldBalance = 0;
      }
    }

    const expensesList: ExpenseItem[] = [];
    if (row.freight && Number(row.freight) > 0) expensesList.push({ id: 'f1', name: 'Freight', amount: Number(row.freight) });
    if (row.hamali && Number(row.hamali) > 0) expensesList.push({ id: 'h1', name: 'Hamali', amount: Number(row.hamali) });
    if (row.othersExpense && Number(row.othersExpense) > 0) expensesList.push({ id: 'o1', name: 'Others', amount: Number(row.othersExpense) });

    const expTotal = expensesList.reduce((sum, e) => sum + e.amount, 0);
    const netTotal = amount + expTotal;

    const saleRecord: CreditSale = {
      id: row.id || `preview-${row.rowId}`,
      creditSaleNo: row.creditSaleNo,
      sequenceNumber: row.sequenceNumber || 1,
      customerId: row.customerId,
      customerName: cust ? cust.name : (row.customerName || 'Customer'),
      date: selectedDate,
      items: [
        {
          id: `csi-${row.rowId}`,
          fruitId: row.fruitId,
          fruitName: row.fruitName,
          quantity: q,
          unit: row.unit || 'Crate',
          crateTypeId: isCrate ? ctId : undefined,
          crateName: isCrate ? ctName : undefined,
          kg: k,
          crateSize: crateSizeVal,
          rate: r,
          amount: amount,
        },
      ],
      crateTypeId: ctId,
      crateName: ctName,
      crateIn: 0,
      crateOut: isCrate ? (crates > 0 ? crates : q) : 0,
      crateWeightKg: crateSizeVal || defaultCrate?.defaultWeightKg || 20,
      crateMovements: crateMovementsList,
      expenses: expensesList,
      productTotal: amount,
      expenseTotal: expTotal,
      totalDebit: netTotal,
      finalAmount: netTotal,
      netTotal: netTotal,
      oldBalance: customerOldBalance,
      cashReceipt: 0,
      totalBalance: customerOldBalance + netTotal,
      totalCrateBalance: isCrate ? (crates > 0 ? crates : q) : 0,
      notes: row.notes || `Group Sale on ${formatDate(selectedDate)}`,
      createdAt: new Date().toISOString(),
    };

    setPrintingSale(saleRecord);
  };

  // Validate and Save All Rows to Individual Customer Ledgers
  const handleSaveAll = () => {
    setIsSaving(true);
    setNotification(null);

    // Validate rows
    let hasValidationErrors = false;
    const validatedRows = rows.map((r) => {
      const errors: GroupSaleRow['errors'] = {};

      if (!r.customerId || !r.customerName) {
        errors.customer = 'Please select a customer';
        hasValidationErrors = true;
      }

      if (!r.fruitId || !r.fruitName) {
        errors.item = 'Please select a valid fruit item';
        hasValidationErrors = true;
      }

      const q = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity);
      if (isNaN(q) || q <= 0) {
        errors.quantity = 'Quantity must be > 0';
        hasValidationErrors = true;
      }

      const p = typeof r.rate === 'number' ? r.rate : Number(r.rate);
      if (isNaN(p) || p < 0) {
        errors.rate = 'Rate cannot be negative';
        hasValidationErrors = true;
      }

      return { ...r, errors };
    });

    if (hasValidationErrors) {
      setRows(validatedRows);
      setIsSaving(false);
      setNotification({
        type: 'error',
        message: 'Validation failed: Please ensure each entry has an assigned customer, item, and valid quantity.',
      });
      return;
    }

    try {
      // 1. Process deletions
      if (deletedIds.length > 0) {
        db.deleteCreditSalesBatch(deletedIds);
      }

      // 2. Prepare sales records to save directly to each individual customer's ledger
      let nextAvailableSeq = db.getNextCreditSaleNumber();
      const currentSavedSales = db.getCreditSales();
      const dateIso = toIsoDate(selectedDate);

      const salesToBatch: CreditSale[] = [];

      for (const row of rows) {
        // Safe check: If any transaction has no assigned customer, do not touch any customer ledger
        if (!row.customerId) {
          continue;
        }

        const q = typeof row.quantity === 'number' ? row.quantity : Number(row.quantity) || 0;
        const k = typeof row.kg === 'number' ? row.kg : Number(row.kg) || 0;
        const rRate = typeof row.rate === 'number' ? row.rate : Number(row.rate) || 0;
        const total = calculateWholesaleItemAmount(q, row.unit, k, rRate);
        const crates = typeof row.crateCount === 'number' ? row.crateCount : Number(row.crateCount) || 0;

        const isCrate = isCrateUnit(row.unit);
        const crateSizeVal = isCrate && row.crateSize ? Number(row.crateSize) : undefined;

        const ctMatch = crateTypes.find((c) => c.id === row.crateTypeId || c.name.toLowerCase().includes(String(row.crateName || '').toLowerCase()));
        const ctId = ctMatch?.id || row.crateTypeId || defaultCrate?.id || 'ct_20';
        const ctName = row.crateName || (ctMatch ? ctMatch.name.replace(/\s*crate$/i, '').trim() : '20kg');
        const crateMovementsList = isCrate && q > 0 ? [
          {
            crateTypeId: ctId,
            crateName: ctName,
            outQuantity: crates > 0 ? crates : q,
            inQuantity: 0,
          }
        ] : [];

        const fruitItem: CreditSaleItem = {
          id: `csi-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          fruitId: row.fruitId,
          fruitName: row.fruitName,
          quantity: q,
          unit: row.unit || 'Crate',
          crateTypeId: isCrate ? ctId : undefined,
          crateName: isCrate ? ctName : undefined,
          kg: k,
          crateSize: crateSizeVal,
          rate: rRate,
          amount: total,
        };

        const expensesList: ExpenseItem[] = [];
        if (row.freight && Number(row.freight) > 0) expensesList.push({ id: 'f1', name: 'Freight', amount: Number(row.freight) });
        if (row.hamali && Number(row.hamali) > 0) expensesList.push({ id: 'h1', name: 'Hamali', amount: Number(row.hamali) });
        if (row.othersExpense && Number(row.othersExpense) > 0) expensesList.push({ id: 'o1', name: 'Others', amount: Number(row.othersExpense) });
        const expTotal = expensesList.reduce((sum, e) => sum + e.amount, 0);
        const netTotal = total + expTotal;

        // Customer's old balance before this sale
        const customer = db.getCustomerById(row.customerId);
        let custOldBal = 0;
        if (customer) {
          try {
            const ledger = getCustomerLedger(customer.id);
            custOldBal = ledger.closingBalance;
          } catch {
            custOldBal = 0;
          }
        }

        const existing = row.id ? currentSavedSales.find((s) => s.id === row.id) : undefined;
        const groupTxId = existing?.groupId || `grp-${dateIso.replace(/-/g, '')}`;

        if (row.isExisting && row.id) {
          // UPDATE existing record without corrupting historical sequence or duplicate entries
          const updatedSale: CreditSale = {
            id: row.id,
            creditSaleNo: existing?.creditSaleNo || row.creditSaleNo,
            sequenceNumber: existing?.sequenceNumber || row.sequenceNumber || 1,
            customerId: row.customerId,
            customerName: row.customerName,
            date: dateIso,
            items: [fruitItem],
            crateTypeId: ctId,
            crateName: ctName,
            crateIn: 0,
            crateOut: isCrate ? (crates > 0 ? crates : q) : 0,
            crateWeightKg: crateSizeVal || defaultCrate?.defaultWeightKg || 20,
            crateMovements: crateMovementsList,
            expenses: expensesList.length > 0 ? expensesList : (existing?.expenses || []),
            productTotal: total,
            expenseTotal: expTotal > 0 ? expTotal : (existing?.expenseTotal || 0),
            totalDebit: netTotal,
            manualAdjustedAmount: undefined,
            finalAmount: netTotal,
            netTotal: netTotal,
            oldBalance: existing?.oldBalance !== undefined ? existing.oldBalance : custOldBal,
            totalBalance: custOldBal + netTotal,
            totalCrateBalance: isCrate ? (crates > 0 ? crates : q) : 0,
            notes: row.notes || existing?.notes,
            createdAt: existing?.createdAt || new Date().toISOString(),
            saleType: 'group',
            isGroupSale: true,
            groupId: groupTxId,
            groupTitle: `Group Sale (${formatDate(dateIso)})`,
          };
          salesToBatch.push(updatedSale);
        } else {
          // INSERT NEW record under respective customer's account
          const assignedSeq = nextAvailableSeq++;
          const billNo = row.creditSaleNo && row.creditSaleNo.includes('Group')
            ? row.creditSaleNo
            : `Group Sale No. ${formatSequence(assignedSeq, 3)}`;

          const newSale: CreditSale = {
            id: row.id || `cs-grp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            creditSaleNo: billNo,
            sequenceNumber: assignedSeq,
            customerId: row.customerId,
            customerName: row.customerName,
            date: dateIso,
            items: [fruitItem],
            crateTypeId: ctId,
            crateName: ctName,
            crateIn: 0,
            crateOut: isCrate ? (crates > 0 ? crates : q) : 0,
            crateWeightKg: crateSizeVal || defaultCrate?.defaultWeightKg || 20,
            crateMovements: crateMovementsList,
            expenses: expensesList,
            productTotal: total,
            expenseTotal: expTotal,
            totalDebit: netTotal,
            manualAdjustedAmount: undefined,
            finalAmount: netTotal,
            netTotal: netTotal,
            oldBalance: custOldBal,
            totalBalance: custOldBal + netTotal,
            totalCrateBalance: isCrate ? (crates > 0 ? crates : q) : 0,
            notes: row.notes || `Group Sale on ${formatDate(dateIso)}`,
            createdAt: new Date().toISOString(),
            saleType: 'group',
            isGroupSale: true,
            groupId: groupTxId,
            groupTitle: `Group Sale (${formatDate(dateIso)})`,
          };
          salesToBatch.push(newSale);
        }
      }

      // Batch save - persists to individual customer accounts
      db.saveCreditSalesBatch(salesToBatch);

      // Reload fresh state from DB
      loadSalesForDate(selectedDate);

      setIsSaving(false);
      setNotification({
        type: 'success',
        message: `Saved ${salesToBatch.length} customer transaction(s) to respective individual ledgers for ${formatDate(dateIso)}!`,
      });

      setTimeout(() => {
        setNotification(null);
      }, 4000);
    } catch (err: any) {
      console.error('Error saving group sales:', err);
      setIsSaving(false);
      setNotification({
        type: 'error',
        message: `Failed to save sales: ${err.message || 'Unknown database error'}`,
      });
    }
  };

  // Filtered rows for search within loaded sales with prefix ranking
  const filteredRows = useMemo(() => {
    if (!searchFilter.trim()) return rows;
    const q = searchFilter.trim().toLowerCase();
    const matches = rows.filter(
      (r) =>
        r.customerName.toLowerCase().includes(q) ||
        r.creditSaleNo.toLowerCase().includes(q) ||
        r.fruitName.toLowerCase().includes(q) ||
        r.customerId.toLowerCase().includes(q)
    );

    return matches.sort((a, b) => {
      const aCust = a.customerName.toLowerCase();
      const bCust = b.customerName.toLowerCase();
      const aCustStarts = aCust.startsWith(q);
      const bCustStarts = bCust.startsWith(q);
      if (aCustStarts && !bCustStarts) return -1;
      if (!aCustStarts && bCustStarts) return 1;

      const aFruit = a.fruitName.toLowerCase();
      const bFruit = b.fruitName.toLowerCase();
      const aFruitStarts = aFruit.startsWith(q);
      const bFruitStarts = bFruit.startsWith(q);
      if (aFruitStarts && !bFruitStarts) return -1;
      if (!aFruitStarts && bFruitStarts) return 1;

      const aCustWord = aCust.includes(' ' + q);
      const bCustWord = bCust.includes(' ' + q);
      if (aCustWord && !bCustWord) return -1;
      if (!aCustWord && bCustWord) return 1;

      return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
    });
  }, [rows, searchFilter]);

  // Date-Wise Summary Calculations
  const summary = useMemo(() => {
    const totalBills = rows.length;
    const uniqueCustomerIds = new Set(
      rows.map((r) => r.customerId).filter(Boolean)
    );
    const totalCustomers = uniqueCustomerIds.size;

    const totalQuantity = rows.reduce((sum, r) => {
      const q = typeof r.quantity === 'number' ? r.quantity : Number(r.quantity) || 0;
      return sum + q;
    }, 0);

    // Crate count strictly counts only rows where unit is Crate
    const totalCrates = rows.reduce((sum, r) => {
      if (!isCrateUnit(r.unit)) return sum;
      const c = typeof r.crateCount === 'number' ? r.crateCount : Number(r.crateCount) || 0;
      return sum + (c > 0 ? c : (Number(r.quantity) || 0));
    }, 0);

    const totalSalesAmount = rows.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    return {
      totalBills,
      totalCustomers,
      totalQuantity,
      totalCrates,
      totalSalesAmount,
    };
  }, [rows]);

  const handlePrintDailySummary = () => {
    triggerPrint('a4', 'group-sale-print-summary');
  };

  return (
    <div className="w-full space-y-6">
      {/* 1. Header & Date Selector Section */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 no-print">
        <div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Group Sale (Bulk Daily Sales Entry)
            </h1>
            <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-300 font-bold text-[11px] sm:text-xs uppercase px-2.5 py-1">
              Multi-Customer Ledger Posting
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Fast bulk entry for Mandi auction customer bills. Automatically calculates item amounts and updates each individual customer ledger.
          </p>
        </div>

        {/* Date Selector & Actions */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex flex-wrap items-center gap-2 w-full sm:w-auto shadow-xs">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4 text-emerald-600 ml-1 shrink-0" />
              <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wide">
                Sale Date:
              </span>
            </div>
            <div className="w-36 sm:w-40 flex-1 sm:flex-none">
              <DatePickerInput
                value={selectedDate}
                onChange={handleDateChange}
              />
            </div>
            <button
              type="button"
              onClick={() => {
                if (hasUnsavedChanges) {
                  setShowDiscardConfirm(true);
                  setPendingDateChange(selectedDate);
                } else {
                  loadSalesForDate(selectedDate);
                  setNotification({
                    type: 'info',
                    message: `Reloaded sales for ${formatDate(selectedDate)}`,
                  });
                }
              }}
              title="Refresh sales for selected date"
              className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 sm:px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="h-3.5 w-3.5 text-blue-600" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto flex-1">
            <ExcelActionBar
              module="creditSale"
              moduleTitle="Group / Daily Sales"
              onExportAll={() => exportCreditSales(db.getCreditSales())}
              totalCount={db.getCreditSales().length}
              onImportComplete={() => loadSalesForDate(selectedDate)}
            />

            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3.5 sm:px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1.5 hover:bg-emerald-100 cursor-pointer flex-1 sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Row</span>
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 sm:px-6 py-2.5 text-xs sm:text-sm font-black flex items-center justify-center gap-2 tracking-wide shadow-md flex-1 sm:flex-none whitespace-nowrap cursor-pointer transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'SAVING...' : 'SAVE ALL SALES'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Unsaved changes notification banner */}
      {hasUnsavedChanges && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 p-3 flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200 no-print animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              You have unsaved changes on {formatDate(selectedDate)}. Click <strong>SAVE ALL SALES</strong> to persist to individual customer ledgers.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className="rounded-lg border border-rose-300 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 cursor-pointer"
            >
              Clear Unsaved Rows
            </button>
          </div>
        </div>
      )}

      {/* Success / Error notification */}
      {notification && (
        <div
          className={`rounded-xl p-3.5 flex items-center justify-between gap-3 text-xs font-bold no-print animate-in slide-in-from-top-1 ${
            notification.type === 'success'
              ? 'border border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300'
              : notification.type === 'error'
              ? 'border border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300'
              : 'border border-blue-400 bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {notification.type === 'success' && <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />}
            {notification.type === 'error' && <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />}
            {notification.type === 'info' && <AlertCircle className="h-4 w-4 text-blue-600 shrink-0" />}
            <span>{notification.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="rounded border border-slate-300 px-2 py-0.5 text-[10px] cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 2. Date-Wise Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 no-print">
        {/* Card 1: Total Bills */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Total Bills</span>
            <FileSpreadsheet className="h-4 w-4 text-blue-600" />
          </div>
          <div className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {summary.totalBills}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Recorded for {formatDate(selectedDate)}
          </div>
        </div>

        {/* Card 2: Total Customers */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Unique Customers</span>
            <Users className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono-numbers text-2xl font-black text-emerald-700 dark:text-emerald-400">
            {summary.totalCustomers}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Separate buyer ledgers updated
          </div>
        </div>

        {/* Card 3: Total Quantity */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Total Quantity</span>
            <Layers className="h-4 w-4 text-amber-600" />
          </div>
          <div className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
            {formatQuantity(summary.totalQuantity)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Sum of all items dispatched
          </div>
        </div>

        {/* Card 4: Total Crates (Automatic crate calculation counts only Crate units) */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Total Crates</span>
            <Box className="h-4 w-4 text-indigo-600" />
          </div>
          <div className="font-mono-numbers text-2xl font-black text-indigo-900 dark:text-indigo-400">
            {summary.totalCrates}
          </div>
          <div className="text-[11px] text-indigo-600 dark:text-indigo-300 font-medium mt-1">
            Crate packaging balance
          </div>
        </div>

        {/* Card 5: Total Sales Amount */}
        <div className="rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50/40 dark:bg-blue-950/20 p-4 col-span-2 sm:col-span-1 shadow-xs">
          <div className="flex items-center justify-between text-blue-900 dark:text-blue-300 mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider">Total Sales (₹)</span>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div className="font-mono-numbers text-2xl font-black text-blue-700 dark:text-blue-400">
            {formatCurrency(summary.totalSalesAmount)}
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-300 font-semibold mt-1">
            Total ledger debit
          </div>
        </div>
      </div>

      {/* 3. Search & Productivity Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
        <div className="flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3.5 py-2 w-full sm:max-w-md shadow-2xs">
          <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
          <input
            type="text"
            placeholder="Search loaded rows by customer, bill no, fruit..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            className="w-full text-xs text-slate-800 dark:text-white bg-transparent outline-none placeholder:text-slate-400 font-medium"
          />
          {searchFilter && (
            <button
              type="button"
              onClick={() => setSearchFilter('')}
              className="flex items-center gap-1 rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-slate-600 dark:text-slate-300 hover:text-slate-900 cursor-pointer"
              title="Clear search"
            >
              <X className="h-3 w-3" />
              <span>Clear</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 no-print">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              title="Select Billing Profile for Summary Header"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.hindiName ? `(${p.hindiName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handlePrintDailySummary}
            className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 hover:bg-slate-50 cursor-pointer shadow-2xs"
          >
            <Printer className="h-4 w-4 text-slate-500" />
            <span>Print Daily Summary</span>
          </button>

          <button
            type="button"
            onClick={handleAddRow}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Row</span>
          </button>
        </div>
      </div>

      {/* 4. Full-Width Editable Group Sale Table */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 sm:p-5 shadow-xs overflow-hidden max-w-full min-w-0 no-print">
        <div className="overflow-x-auto min-h-[350px] max-w-full min-w-0">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold uppercase tracking-wider">
                <th className="py-3 px-2 w-12 text-center">No.</th>
                <th className="py-3 px-3 w-32">Bill No.</th>
                <th className="py-3 px-3 min-w-[220px]">Customer *</th>
                <th className="py-3 px-3 min-w-[190px]">Item Name *</th>
                <th className="py-3 px-2 w-20 text-right">Qty *</th>
                <th className="py-3 px-2 w-24">Unit</th>
                <th className="py-3 px-2 w-24 text-right">Weight</th>
                <th className="py-3 px-2 w-28 text-center">Crate Type</th>
                <th className="py-3 px-2 w-24 text-right">Rate (₹) *</th>
                <th className="py-3 px-3 w-28 text-right">Amount (₹)</th>
                <th className="py-3 px-2 w-24 text-center no-print">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-slate-400">
                    <FileSpreadsheet className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-base font-bold text-slate-700 dark:text-slate-300">
                      No sales records for {formatDate(selectedDate)}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click <strong>+ Add Row</strong> to record wholesale consignments for this date.
                    </p>
                    <button
                      type="button"
                      onClick={handleAddRow}
                      className="mt-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold cursor-pointer"
                    >
                      + Add First Sale Row
                    </button>
                  </td>
                </tr>
              ) : (
                filteredRows.map((row, index) => {
                  const isCrate = isCrateUnit(row.unit);
                  return (
                    <tr
                      key={row.rowId}
                      className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors ${
                        row.isDirty ? 'bg-amber-50/30 dark:bg-amber-950/10' : ''
                      }`}
                    >
                      {/* 1. S. No. */}
                      <td className="py-3 px-2 text-center font-bold text-slate-500">
                        {index + 1}
                      </td>

                      {/* 2. Bill No. */}
                      <td className="py-3 px-3">
                        <div className="font-mono text-xs font-bold text-slate-800 dark:text-slate-200">
                          {row.creditSaleNo}
                        </div>
                        {row.isExisting ? (
                          <span className="text-[10px] text-emerald-700 font-semibold bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-1 py-0.2 rounded">
                            Saved
                          </span>
                        ) : (
                          <span className="text-[10px] text-amber-700 font-semibold bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 px-1 py-0.2 rounded">
                            Unsaved
                          </span>
                        )}
                      </td>

                      {/* 3. Customer */}
                      <td className="py-3 px-3">
                        <CustomerAutocomplete
                          valueCustomerId={row.customerId}
                          onChange={(cust) => handleCustomerSelect(row.rowId, cust)}
                          hasError={!!row.errors?.customer}
                          placeholder="Select customer..."
                        />
                        {row.errors?.customer && (
                          <span className="text-[11px] font-semibold text-rose-600 block mt-0.5">
                            {row.errors.customer}
                          </span>
                        )}
                        {row.customerId && onNavigateToCustomerLedger && (
                          <button
                            type="button"
                            onClick={() => onNavigateToCustomerLedger(row.customerId)}
                            className="text-[10px] text-blue-600 hover:underline block mt-0.5"
                          >
                            View Individual Ledger →
                          </button>
                        )}
                      </td>

                      {/* 4. Item Name */}
                      <td className="py-3 px-3">
                        <FruitAutocomplete
                          valueFruitId={row.fruitId}
                          valueFruitName={row.fruitName}
                          onChange={(fruit, customName) => handleFruitSelect(row.rowId, fruit, customName)}
                          hasError={!!row.errors?.item}
                        />
                        {row.errors?.item && (
                          <span className="text-[11px] font-semibold text-rose-600 block mt-0.5">
                            {row.errors.item}
                          </span>
                        )}
                      </td>

                      {/* 5. Qty */}
                      <td className="py-3 px-2 text-right">
                        <QuantityInput
                          step="any"
                          min={0.01}
                          value={row.quantity}
                          onChange={(val) =>
                            handleRowFieldChange(row.rowId, 'quantity', val)
                          }
                          className={`w-full rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white outline-none border ${
                            row.errors?.quantity
                              ? 'border-rose-500 bg-rose-50'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                          }`}
                        />
                      </td>

                      {/* 6. Unit */}
                      <td className="py-3 px-2">
                        <UnitAutocomplete
                          valueUnit={row.unit}
                          onChange={(newUnit) =>
                            handleRowFieldChange(row.rowId, 'unit', newUnit)
                          }
                        />
                      </td>

                      {/* 7. Weight (Default 0) */}
                      <td className="py-3 px-2 text-right">
                        <QuantityInput
                          step="any"
                          min={0}
                          placeholder="0"
                          value={row.kg === 0 ? '0' : row.kg}
                          onChange={(val) =>
                            handleRowFieldChange(row.rowId, 'kg', val)
                          }
                          className="w-full rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white outline-none border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        />
                      </td>

                      {/* 8. Crate Type (free-text e.g. 20kg or 10kg, or blank) */}
                      <td className="py-3 px-2 text-center">
                        <input
                          type="text"
                          list={`group-crate-types-${row.rowId}`}
                          placeholder="e.g. 20kg"
                          value={row.crateName || ''}
                          onChange={(e) => handleRowFieldChange(row.rowId, 'crateName', e.target.value)}
                          className="w-full rounded-lg px-1.5 py-1.5 text-xs font-bold text-center font-mono text-sky-800 dark:text-sky-300 outline-none border border-sky-300 bg-sky-50/60 dark:border-slate-700 dark:bg-slate-800 text-center"
                          title="Crate Name is only a label for identification & balance tracking"
                        />
                        <datalist id={`group-crate-types-${row.rowId}`}>
                          <option value="20kg" />
                          <option value="10kg" />
                          <option value="15kg" />
                          <option value="24kg" />
                        </datalist>
                      </td>

                      {/* 9. Rate (₹) */}
                      <td className="py-3 px-2 text-right">
                        <QuantityInput
                          min={0}
                          step="any"
                          placeholder="0.00"
                          value={row.rate}
                          onChange={(val) =>
                            handleRowFieldChange(
                              row.rowId,
                              'rate',
                              val
                            )
                          }
                          className={`w-full rounded-lg px-2 py-1.5 text-xs text-right font-mono font-bold text-slate-900 dark:text-white outline-none border ${
                            row.errors?.rate
                              ? 'border-rose-500 bg-rose-50'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                          }`}
                        />
                      </td>

                      {/* 10. Amount (₹) */}
                      <td className="py-3 px-3 text-right">
                        <span className="font-mono text-sm font-black text-blue-700 dark:text-blue-400">
                          {formatCurrency(row.totalAmount)}
                        </span>
                      </td>

                      {/* 11. Actions: Print Bill & Remove */}
                      <td className="py-3 px-2 text-center no-print">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handlePrintRowBill(row)}
                            title="Print Customer Bill (Wholesale Credit Sale format)"
                            className="rounded-lg p-1.5 text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer transition-colors"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowId)}
                            title="Remove row"
                            className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer: Grand Total */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 font-black text-slate-800 dark:text-slate-200 text-xs">
                  <td colSpan={4} className="py-3.5 px-3 text-right uppercase tracking-wide">
                    Grand Total ({filteredRows.length} Entries):
                  </td>
                  <td className="py-3.5 px-2 text-right font-mono">
                    {formatQuantity(summary.totalQuantity)}
                  </td>
                  <td className="py-3.5 px-2 text-slate-500">Units</td>
                  <td className="py-3.5 px-2"></td>
                  <td className="py-3.5 px-2 text-center font-mono text-indigo-700 dark:text-indigo-400">
                    {summary.totalCrates > 0 ? `${summary.totalCrates} Crates` : '—'}
                  </td>
                  <td className="py-3.5 px-2 text-right text-slate-500">—</td>
                  <td className="py-3.5 px-3 text-right font-mono text-base font-black text-blue-700 dark:text-blue-400">
                    {formatCurrency(summary.totalSalesAmount)}
                  </td>
                  <td className="py-3.5 px-2 no-print"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Bottom Action Footer */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleAddRow}
              className="rounded-lg border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-4 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 hover:bg-emerald-100 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add Row</span>
            </button>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              Each row posts debit directly to the respective customer's ledger upon saving.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving}
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 text-sm font-black flex items-center gap-2 shadow-lg cursor-pointer transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{isSaving ? 'SAVING SALES...' : 'SAVE ALL SALES'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Discard confirmation modal on date switch */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Unsaved Changes Warning</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You have unsaved changes on <strong>{formatDate(selectedDate)}</strong>. Switching dates will discard your unsaved edits. Would you like to proceed?
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  setPendingDateChange(null);
                }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Stay on Current Date
              </button>
              <button
                type="button"
                onClick={confirmDiscardDateChange}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Discard & Switch Date
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear unsaved confirmation modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-slate-900 p-6 space-y-4 border border-slate-200 dark:border-slate-800 shadow-xl">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertTriangle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Clear Unsaved Rows</h3>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Are you sure you want to remove all unsaved rows? Existing saved sales records will not be affected.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearUnsavedRows}
                className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 text-xs font-bold cursor-pointer"
              >
                Clear Unsaved
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credit Sale Print Modal for individual customer bills */}
      {printingSale && (
        <CreditSalePrintModal
          isOpen={true}
          onClose={() => setPrintingSale(null)}
          creditSale={printingSale}
        />
      )}

      {/* Clean Printable Daily Summary for window.print() */}
      <div className="hidden print:block font-sans text-black p-6 bg-white" id="group-sale-print-summary" style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}>
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          {currentProfile.shortCode && (
            <div className="font-bold text-xs tracking-widest uppercase text-slate-700 print:text-black">
              {currentProfile.shortCode}
            </div>
          )}
          <h1 className="text-xl font-black uppercase tracking-wider">{currentProfile.name}</h1>
          {currentProfile.hindiName && (
            <div className="text-base sm:text-lg font-bold tracking-wide mt-0.5 font-devanagari text-slate-900 print:text-black">
              {currentProfile.hindiName}
            </div>
          )}
          <div className="text-[11px] text-slate-700 leading-snug mt-1">
            {currentProfile.address}{currentProfile.city ? `, ${currentProfile.city}` : ''}{currentProfile.state ? `, ${currentProfile.state}` : ''}
          </div>
          <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
          <p className="text-xs font-semibold mt-1">Daily Group Sale Summary — {formatDate(selectedDate)}</p>
        </div>

        <div className="flex justify-between text-xs mb-4">
          <div>
            <strong>Date:</strong> {formatDate(selectedDate)}
          </div>
          <div>
            <strong>Total Bills:</strong> {summary.totalBills} | <strong>Customers:</strong> {summary.totalCustomers}
          </div>
          <div>
            <strong>Total Quantity:</strong> {formatQuantity(summary.totalQuantity)} | <strong>Crates:</strong> {summary.totalCrates}
          </div>
          <div>
            <strong>Total Amount:</strong> {formatCurrency(summary.totalSalesAmount)}
          </div>
        </div>

        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="border-b border-black bg-slate-100">
              <th className="border border-black p-1 text-center">S.No.</th>
              <th className="border border-black p-1">Bill No</th>
              <th className="border border-black p-1">Customer</th>
              <th className="border border-black p-1">Item</th>
              <th className="border border-black p-1 text-right">Qty</th>
              <th className="border border-black p-1">Unit</th>
              <th className="border border-black p-1 text-right">Kg</th>
              <th className="border border-black p-1 text-right">Rate (₹)</th>
              <th className="border border-black p-1 text-center">Crate</th>
              <th className="border border-black p-1 text-right">Amount (₹)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.rowId} className="border-b border-black">
                <td className="border border-black p-1 text-center">{i + 1}</td>
                <td className="border border-black p-1">{r.creditSaleNo}</td>
                <td className="border border-black p-1 font-bold">{r.customerName}</td>
                <td className="border border-black p-1">{r.fruitName}</td>
                <td className="border border-black p-1 text-right">{r.quantity}</td>
                <td className="border border-black p-1">{r.unit}</td>
                <td className="border border-black p-1 text-right">{r.kg || 0}</td>
                <td className="border border-black p-1 text-right">{r.rate}</td>
                <td className="border border-black p-1 text-center">{isCrateUnit(r.unit) ? (r.crateCount || r.quantity || 0) : '—'}</td>
                <td className="border border-black p-1 text-right font-bold">{formatCurrency(r.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold border-t-2 border-black bg-slate-50">
              <td colSpan={4} className="border border-black p-2 text-right">GRAND TOTAL:</td>
              <td className="border border-black p-2 text-right">{formatQuantity(summary.totalQuantity)}</td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2"></td>
              <td className="border border-black p-2 text-center">{summary.totalCrates}</td>
              <td className="border border-black p-2 text-right">{formatCurrency(summary.totalSalesAmount)}</td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-8 flex justify-between text-xs pt-8 border-t border-dashed border-gray-400">
          <div>Prepared By: Mandi Accountant</div>
          <div>Authorized Signature: {formatCompanySignature(currentProfile)}</div>
        </div>
      </div>
    </div>
  );
};
