import { db } from './db';
import {
  CashSale,
  CrateLedgerEntry,
  CrateTypeBalance,
  CreditSale,
  Customer,
  LedgerEntry,
  Receipt,
  SaleProceeds,
  Vendor,
} from '../types';
import { compareDates, formatDate, toIsoDate } from '../utils/formatters';

export interface DateFilterRange {
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  customerId?: string;
}

/**
 * Computes the complete Sale Proceeds Ledger dynamically.
 * Starts with Opening Balance, then adds all Sale Proceeds in chronological order.
 * Credit increases balance, Debit decreases balance.
 * When customerId filter is provided, displays only that customer's records.
 */
export function getSaleProceedsLedger(filter?: DateFilterRange): {
  entries: LedgerEntry[];
  closingBalance: number;
  totalCredit: number;
  totalDebit: number;
} {
  const ob = db.getSaleProceedsOpeningBalance();
  const sales = db.getSaleProceeds();
  const targetCustomerId = filter?.customerId;
  const targetCustomer = targetCustomerId ? db.getCustomerById(targetCustomerId) : null;
  const targetCustomerName = targetCustomer ? targetCustomer.name.trim().toLowerCase() : '';

  // Sort sales chronologically by date, then by sequence number
  const sortedSales = [...sales].sort((a, b) => {
    const dComp = compareDates(a.date, b.date);
    if (dComp !== 0) return dComp;
    return (a.sequenceNumber || 0) - (b.sequenceNumber || 0);
  });

  const entries: LedgerEntry[] = [];
  let currentBalance = 0;

  // 1. Opening Balance - only included when viewing complete/consolidated ledger (not filtered by a single customer)
  if (!targetCustomerId && ob && ob.amount > 0) {
    const isCredit = ob.type === 'credit';
    const credit = isCredit ? ob.amount : null;
    const debit = isCredit ? null : ob.amount;
    currentBalance = isCredit ? ob.amount : -ob.amount;

    entries.push({
      id: ob.id,
      date: ob.date,
      particulars: ob.particulars || 'Opening Balance',
      referenceType: 'Opening Balance',
      debit,
      credit,
      balance: currentBalance,
    });
  }

  // 2. Sale Proceeds
  for (const sp of sortedSales) {
    // If filtered by customer, only include sales matching this customer
    if (targetCustomerId) {
      const matchId = sp.customerId === targetCustomerId;
      const matchName = targetCustomerName && sp.customerName?.trim().toLowerCase() === targetCustomerName;
      if (!matchId && !matchName) {
        continue;
      }
    }

    const isCredit = sp.netAmount >= 0;
    const credit = isCredit ? sp.netAmount : null;
    const debit = isCredit ? null : Math.abs(sp.netAmount);
    currentBalance += sp.netAmount;

    entries.push({
      id: sp.id,
      date: sp.date,
      particulars: sp.proceedsNo,
      referenceType: 'Sale Proceeds',
      referenceId: sp.id,
      referenceNo: sp.proceedsNo,
      customerId: sp.customerId,
      customerName: sp.customerName,
      debit,
      credit,
      balance: currentBalance,
      notes: sp.notes,
      subDetails: {
        qty: sp.quantity,
        rate: sp.rate,
        items: sp.items?.map(it => ({
          name: it.fruitName,
          qty: it.quantity,
          unit: it.unit,
          rate: it.rate,
          amount: it.amount
        })),
        expenses: sp.expenses?.map(e => ({ name: e.name, amount: e.amount })),
      },
    });
  }

  // Filter if date range provided
  let filteredEntries = entries;
  if (filter?.startDate || filter?.endDate) {
    filteredEntries = entries.filter((e) => {
      const eDate = toIsoDate(e.date);
      if (filter.startDate && eDate < filter.startDate) return false;
      if (filter.endDate && eDate > filter.endDate) return false;
      return true;
    });
  }

  // Recalculate totals strictly from the applicable transactions in date range
  const totalCredit = filteredEntries.reduce((sum, e) => sum + (e.credit || 0), 0);
  const totalDebit = filteredEntries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const closingBalance = filteredEntries.length > 0
    ? filteredEntries[filteredEntries.length - 1].balance
    : (entries.length > 0 ? entries[entries.length - 1].balance : 0);

  return {
    entries: filteredEntries,
    closingBalance,
    totalCredit,
    totalDebit,
  };
}

/**
 * Computes an individual Customer's Ledger.
 * Debit increases customer outstanding, Credit reduces customer outstanding.
 */
export function getCustomerLedger(
  customerId: string,
  filter?: DateFilterRange
): {
  customer: Customer | undefined;
  entries: LedgerEntry[];
  closingBalance: number;
  totalDebit: number;
  totalCredit: number;
  overallClosingBalance?: number;
  periodOpeningBalance?: number;
} {
  const customer = db.getCustomerById(customerId);
  const creditSales = db.getCreditSales().filter((cs) => cs.customerId === customerId);
  const cashSales = db.getCashSales().filter((cs) => cs.customerId === customerId);
  const receipts = db.getReceipts().filter((r) => r.customerId === customerId);
  const saleProceeds = db.getSaleProceeds().filter((sp) => sp.customerId === customerId);

  interface RawTx {
    id: string;
    date: string;
    createdAt: string;
    type: 'CREDIT_SALE' | 'CASH_SALE' | 'RECEIPT' | 'SALE_PROCEEDS';
    data: CreditSale | CashSale | Receipt | SaleProceeds;
  }

  const rawTxList: RawTx[] = [
    ...creditSales.map((cs) => ({
      id: cs.id,
      date: cs.date,
      createdAt: cs.createdAt,
      type: 'CREDIT_SALE' as const,
      data: cs,
    })),
    ...cashSales.map((cs) => ({
      id: cs.id,
      date: cs.date,
      createdAt: cs.createdAt,
      type: 'CASH_SALE' as const,
      data: cs,
    })),
    ...receipts.map((r) => ({
      id: r.id,
      date: r.date,
      createdAt: r.createdAt,
      type: 'RECEIPT' as const,
      data: r,
    })),
    ...saleProceeds.map((sp) => ({
      id: sp.id,
      date: sp.date,
      createdAt: sp.createdAt,
      type: 'SALE_PROCEEDS' as const,
      data: sp,
    })),
  ];

  // Sort transactions chronologically
  rawTxList.sort((a, b) => {
    const dComp = compareDates(a.date, b.date);
    if (dComp !== 0) return dComp;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  // Calculate master initial balance from customer record
  let masterInitialBalance = 0;
  if (customer && customer.openingBalance !== 0) {
    masterInitialBalance =
      customer.openingBalanceType === 'debit'
        ? customer.openingBalance
        : -customer.openingBalance;
  }

  const startIso = filter?.startDate ? toIsoDate(filter.startDate) : undefined;
  const endIso = filter?.endDate ? toIsoDate(filter.endDate) : undefined;

  // Calculate opening balance immediately before start date
  let periodOpeningBalance = masterInitialBalance;
  const inPeriodTxs: RawTx[] = [];

  for (const tx of rawTxList) {
    const txIso = toIsoDate(tx.date);
    if (startIso && txIso < startIso) {
      // Occurred prior to start date -> rolls into periodOpeningBalance
      if (tx.type === 'CREDIT_SALE') {
        const cs = tx.data as CreditSale;
        periodOpeningBalance += cs.finalAmount;
      } else if (tx.type === 'RECEIPT') {
        const r = tx.data as Receipt;
        periodOpeningBalance -= r.amount;
      } else if (tx.type === 'SALE_PROCEEDS') {
        const sp = tx.data as SaleProceeds;
        if (sp.netAmount >= 0) {
          periodOpeningBalance -= sp.netAmount;
        } else {
          periodOpeningBalance += Math.abs(sp.netAmount);
        }
      }
      // Cash sales do not alter balance (immediate settlement offset)
    } else if (!endIso || txIso <= endIso) {
      // Transaction within selected date filter
      inPeriodTxs.push(tx);
    }
  }

  const entries: LedgerEntry[] = [];
  let runningBalance = periodOpeningBalance;

  // 1. Opening Balance row
  if (startIso) {
    // Single-day or date-range filter: show opening balance as of the start date
    const isDr = periodOpeningBalance > 0;
    const isCr = periodOpeningBalance < 0;
    entries.push({
      id: `ob-period-${customerId}`,
      date: startIso,
      particulars: `Opening Balance (b/f as on ${formatDate(startIso)})`,
      referenceType: 'Opening Balance',
      debit: isDr ? periodOpeningBalance : null,
      credit: isCr ? Math.abs(periodOpeningBalance) : null,
      balance: periodOpeningBalance,
    });
  } else if (customer) {
    // All-time statement: show customer's master opening balance row
    const isDebit = customer.openingBalanceType === 'debit';
    const debit = isDebit && customer.openingBalance !== 0 ? customer.openingBalance : null;
    const credit = !isDebit && customer.openingBalance !== 0 ? customer.openingBalance : null;
    entries.push({
      id: `ob-${customer.id}`,
      date: customer.createdAt ? customer.createdAt.split('T')[0] : '2026-10-01',
      particulars: 'Opening Balance',
      referenceType: 'Opening Balance',
      debit,
      credit,
      balance: periodOpeningBalance,
    });
  }

  // 2. In-Period Transactions
  let totalDebit = 0;
  let totalCredit = 0;

  for (const tx of inPeriodTxs) {
    if (tx.type === 'CREDIT_SALE') {
      const cs = tx.data as CreditSale;
      const debit = cs.finalAmount;
      runningBalance += debit;
      totalDebit += debit;

      const isGroup = cs.saleType === 'group' || cs.isGroupSale === true;
      const refType = isGroup ? 'Group Sale' : 'Credit Sale';
      const particularTitle = isGroup
        ? (cs.notes?.includes('Group Sale') ? cs.notes : `${cs.creditSaleNo} (Group Sale)`)
        : cs.creditSaleNo;

      entries.push({
        id: cs.id,
        date: cs.date,
        particulars: particularTitle,
        referenceType: refType,
        referenceId: cs.id,
        referenceNo: cs.creditSaleNo,
        debit,
        credit: null,
        balance: runningBalance,
        notes: cs.notes,
        subDetails: {
          items: cs.items?.map((it) => ({
            name: it.fruitName,
            qty: it.quantity,
            unit: it.unit,
            rate: it.rate,
            amount: it.amount,
          })),
          expenses: cs.expenses?.map((e) => ({ name: e.name, amount: e.amount })),
          crateIn: cs.crateIn,
          crateOut: cs.crateOut,
        },
      });
    } else if (tx.type === 'CASH_SALE') {
      const cs = tx.data as CashSale;
      totalDebit += cs.finalAmount;
      totalCredit += cs.finalAmount;

      entries.push({
        id: cs.id,
        date: cs.date,
        particulars: `${cs.cashSaleNo} (Cash Paid)`,
        referenceType: 'Cash Sale',
        referenceId: cs.id,
        referenceNo: cs.cashSaleNo,
        debit: cs.finalAmount,
        credit: cs.finalAmount,
        balance: runningBalance,
        notes: cs.notes,
        subDetails: {
          items: cs.items?.map((it) => ({
            name: it.fruitName,
            qty: it.quantity,
            unit: it.unit,
            rate: it.rate,
            amount: it.amount,
          })),
          expenses: cs.expenses?.map((e) => ({ name: e.name, amount: e.amount })),
          crateIn: cs.crateIn,
          crateOut: cs.crateOut,
        },
      });
    } else if (tx.type === 'RECEIPT') {
      const r = tx.data as Receipt;
      const credit = r.amount;
      runningBalance -= credit;
      totalCredit += credit;

      entries.push({
        id: r.id,
        date: r.date,
        particulars: `${r.receiptNo} (${r.paymentMode})`,
        referenceType: 'Receipt',
        referenceId: r.id,
        referenceNo: r.receiptNo,
        debit: null,
        credit,
        balance: runningBalance,
        notes: r.notes,
      });
    } else if (tx.type === 'SALE_PROCEEDS') {
      const sp = tx.data as SaleProceeds;
      const isCredit = sp.netAmount >= 0;
      const credit = isCredit ? sp.netAmount : null;
      const debit = isCredit ? null : Math.abs(sp.netAmount);

      if (credit) {
        runningBalance -= credit;
        totalCredit += credit;
      }
      if (debit) {
        runningBalance += debit;
        totalDebit += debit;
      }

      entries.push({
        id: sp.id,
        date: sp.date,
        particulars: sp.proceedsNo,
        referenceType: 'Sale Proceeds',
        referenceId: sp.id,
        referenceNo: sp.proceedsNo,
        debit,
        credit,
        balance: runningBalance,
        notes: sp.notes,
        subDetails: {
          qty: sp.quantity,
          rate: sp.rate,
          items: sp.items?.map((it) => ({
            name: it.fruitName,
            qty: it.quantity,
            unit: it.unit,
            rate: it.rate,
            amount: it.amount,
          })),
          expenses: sp.expenses?.map((e) => ({ name: e.name, amount: e.amount })),
        },
      });
    }
  }

  // Calculate overall un-filtered closing balance for comparison
  let overallBalance = masterInitialBalance;
  for (const tx of rawTxList) {
    if (tx.type === 'CREDIT_SALE') {
      overallBalance += (tx.data as CreditSale).finalAmount;
    } else if (tx.type === 'RECEIPT') {
      overallBalance -= (tx.data as Receipt).amount;
    } else if (tx.type === 'SALE_PROCEEDS') {
      const sp = tx.data as SaleProceeds;
      if (sp.netAmount >= 0) overallBalance -= sp.netAmount;
      else overallBalance += Math.abs(sp.netAmount);
    }
  }

  return {
    customer,
    entries,
    closingBalance: runningBalance,
    totalDebit,
    totalCredit,
    overallClosingBalance: overallBalance,
    periodOpeningBalance,
  };
}

/**
 * Computes an individual Customer's Crate Statement.
 * Separate quantity ledger.
 * Balance = Opening + OUT - IN
 * Tracks each crate type independently while providing an overall summary.
 */
export function getCustomerCrateStatement(
  customerId: string,
  filter?: DateFilterRange
): {
  customer: Customer | undefined;
  entries: CrateLedgerEntry[];
  closingCrates: number;
  crateWeightKg: number;
  closingTotalKg: number;
  typeBalances: CrateTypeBalance[];
} {
  const customer = db.getCustomerById(customerId);
  const creditSales = db.getCreditSales().filter((cs) => cs.customerId === customerId);
  const manualCrates = db.getCrateTransactions().filter((ct) => ct.customerId === customerId);
  const crateTypes = db.getCrateTypes();

  // Find default crate weight
  const configuredCrateType = customer?.crateTypeId
    ? crateTypes.find((ct) => ct.id === customer.crateTypeId)
    : crateTypes[0];
  const defaultWeightKg = configuredCrateType ? configuredCrateType.defaultWeightKg : 20;
  const defaultCrateName = configuredCrateType ? configuredCrateType.name : 'Standard Crate';
  const defaultCrateId = configuredCrateType ? configuredCrateType.id : 'ct_20';

  interface RawCrateItem {
    id: string;
    date: string;
    particulars: string;
    referenceNo: string;
    crateTypeId: string;
    crateName: string;
    inQuantity: number;
    outQuantity: number;
    weightKg: number;
    createdAt: string;
  }

  const list: RawCrateItem[] = [];

  // Helper to resolve crate type details
  const resolveCrateDetails = (typeId?: string, fallbackName?: string) => {
    if (typeId) {
      const match = crateTypes.find((c) => c.id === typeId || c.name.toLowerCase() === typeId.toLowerCase());
      if (match) return { id: match.id, name: match.name, weight: match.defaultWeightKg };
    }
    if (fallbackName) {
      const match = crateTypes.find((c) => c.name.toLowerCase() === fallbackName.toLowerCase());
      if (match) return { id: match.id, name: match.name, weight: match.defaultWeightKg };
    }
    return { id: defaultCrateId, name: fallbackName || defaultCrateName, weight: defaultWeightKg };
  };

  // 1. Credit sales with crate activity
  for (const cs of creditSales) {
    if (cs.crateMovements && cs.crateMovements.length > 0) {
      cs.crateMovements.forEach((mv, mIdx) => {
        const inQty = mv.inQuantity || 0;
        const outQty = mv.outQuantity || 0;
        if (inQty > 0 || outQty > 0) {
          const det = resolveCrateDetails(mv.crateTypeId, mv.crateName);
          list.push({
            id: `${cs.id}-${mv.crateTypeId || mIdx}`,
            date: cs.date,
            particulars: `${cs.creditSaleNo} (${det.name})`,
            referenceNo: cs.creditSaleNo,
            crateTypeId: det.id,
            crateName: det.name,
            inQuantity: inQty,
            outQuantity: outQty,
            weightKg: det.weight || cs.crateWeightKg || defaultWeightKg,
            createdAt: cs.createdAt,
          });
        }
      });
    } else {
      const inQty = cs.crateIn || 0;
      const outQty = cs.crateOut || 0;
      if (inQty > 0 || outQty > 0) {
        const det = resolveCrateDetails(cs.crateTypeId, cs.crateName);
        list.push({
          id: cs.id,
          date: cs.date,
          particulars: cs.creditSaleNo,
          referenceNo: cs.creditSaleNo,
          crateTypeId: det.id,
          crateName: det.name,
          inQuantity: inQty,
          outQuantity: outQty,
          weightKg: cs.crateWeightKg || det.weight || defaultWeightKg,
          createdAt: cs.createdAt,
        });
      }
    }
  }

  // 1b. Cash sales with crate activity
  const cashSalesForCrates = db.getCashSales().filter((cs) => cs.customerId === customerId);
  for (const cs of cashSalesForCrates) {
    if (cs.crateMovements && cs.crateMovements.length > 0) {
      cs.crateMovements.forEach((mv, mIdx) => {
        const inQty = mv.inQuantity || 0;
        const outQty = mv.outQuantity || 0;
        if (inQty > 0 || outQty > 0) {
          const det = resolveCrateDetails(mv.crateTypeId, mv.crateName);
          list.push({
            id: `${cs.id}-${mv.crateTypeId || mIdx}`,
            date: cs.date,
            particulars: `${cs.cashSaleNo} (${det.name})`,
            referenceNo: cs.cashSaleNo,
            crateTypeId: det.id,
            crateName: det.name,
            inQuantity: inQty,
            outQuantity: outQty,
            weightKg: det.weight || cs.crateWeightKg || defaultWeightKg,
            createdAt: cs.createdAt,
          });
        }
      });
    } else {
      const inQty = cs.crateIn || 0;
      const outQty = cs.crateOut || 0;
      if (inQty > 0 || outQty > 0) {
        const det = resolveCrateDetails(cs.crateTypeId, cs.crateName);
        list.push({
          id: cs.id,
          date: cs.date,
          particulars: cs.cashSaleNo,
          referenceNo: cs.cashSaleNo,
          crateTypeId: det.id,
          crateName: det.name,
          inQuantity: inQty,
          outQuantity: outQty,
          weightKg: cs.crateWeightKg || det.weight || defaultWeightKg,
          createdAt: cs.createdAt,
        });
      }
    }
  }

  // 2. Manual crate transactions
  for (const mt of manualCrates) {
    const det = resolveCrateDetails(mt.crateTypeId, mt.crateName);
    const inQty = mt.inQuantity !== undefined ? mt.inQuantity : ((mt as any).type === 'in' ? (mt as any).quantity : 0);
    const outQty = mt.outQuantity !== undefined ? mt.outQuantity : ((mt as any).type === 'out' ? (mt as any).quantity : 0);
    list.push({
      id: mt.id,
      date: mt.date,
      particulars: `${mt.referenceType || 'Crate Movement'}: ${mt.notes || ''}`.trim(),
      referenceNo: mt.referenceNo || `CR-${mt.id.slice(-4)}`,
      crateTypeId: det.id,
      crateName: det.name,
      inQuantity: inQty || 0,
      outQuantity: outQty || 0,
      weightKg: mt.weightKgPerCrate || det.weight || defaultWeightKg,
      createdAt: mt.createdAt,
    });
  }

  list.sort((a, b) => {
    const dComp = compareDates(a.date, b.date);
    if (dComp !== 0) return dComp;
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });

  const startIso = filter?.startDate ? toIsoDate(filter.startDate) : undefined;
  const endIso = filter?.endDate ? toIsoDate(filter.endDate) : undefined;

  let masterCrateBalance = customer?.openingCrateBalance || 0;
  let periodOpeningCrateBalance = masterCrateBalance;
  const inPeriodCrates: RawCrateItem[] = [];

  for (const item of list) {
    const itemIso = toIsoDate(item.date);
    if (startIso && itemIso < startIso) {
      periodOpeningCrateBalance += (item.outQuantity - item.inQuantity);
    } else if (!endIso || itemIso <= endIso) {
      inPeriodCrates.push(item);
    }
  }

  const entries: CrateLedgerEntry[] = [];
  let currentBalance = periodOpeningCrateBalance;

  // Running balance map per crate type
  const typeRunningBalances = new Map<string, number>();
  const openingTypeId = customer?.crateTypeId || defaultCrateId;
  const openingTypeName = (customer?.crateTypeId ? crateTypes.find((c) => c.id === customer.crateTypeId)?.name : undefined) || defaultCrateName;

  if (startIso) {
    entries.push({
      id: `ob-period-crate-${customerId}`,
      date: startIso,
      particulars: `Opening Crate Balance (b/f as on ${formatDate(startIso)})`,
      referenceNo: 'OB',
      crateTypeId: openingTypeId,
      crateName: openingTypeName,
      inQuantity: 0,
      outQuantity: 0,
      balance: periodOpeningCrateBalance,
      typeBalance: periodOpeningCrateBalance,
      weightKg: defaultWeightKg,
      totalKg: periodOpeningCrateBalance * defaultWeightKg,
    });
  } else {
    entries.push({
      id: `ob-crate-${customerId}`,
      date: customer?.createdAt ? customer.createdAt.split('T')[0] : '2026-10-01',
      particulars: 'Opening Crate Balance',
      referenceNo: 'OB',
      crateTypeId: openingTypeId,
      crateName: openingTypeName,
      inQuantity: 0,
      outQuantity: 0,
      balance: masterCrateBalance,
      typeBalance: masterCrateBalance,
      weightKg: defaultWeightKg,
      totalKg: masterCrateBalance * defaultWeightKg,
    });
  }

  for (const item of inPeriodCrates) {
    currentBalance = currentBalance + item.outQuantity - item.inQuantity;
    const prevTypeBal = typeRunningBalances.get(item.crateTypeId) || 0;
    const nextTypeBal = prevTypeBal + item.outQuantity - item.inQuantity;
    typeRunningBalances.set(item.crateTypeId, nextTypeBal);

    entries.push({
      id: item.id,
      date: item.date,
      particulars: item.particulars,
      referenceNo: item.referenceNo,
      crateTypeId: item.crateTypeId,
      crateName: item.crateName,
      inQuantity: item.inQuantity,
      outQuantity: item.outQuantity,
      balance: currentBalance,
      typeBalance: nextTypeBal,
      weightKg: item.weightKg,
      totalKg: currentBalance * item.weightKg,
    });
  }

  // Calculate distinct crate-type balances
  const allKnownTypeIds = new Set<string>();
  crateTypes.forEach((ct) => allKnownTypeIds.add(ct.id));
  entries.forEach((e) => {
    if (e.crateTypeId) allKnownTypeIds.add(e.crateTypeId);
  });

  const typeBalances: CrateTypeBalance[] = [];
  for (const tid of allKnownTypeIds) {
    const matchedType = crateTypes.find((c) => c.id === tid);
    const cName = matchedType ? matchedType.name : (entries.find((e) => e.crateTypeId === tid)?.crateName || 'Crate');
    const cWeight = matchedType ? matchedType.defaultWeightKg : defaultWeightKg;

    const ob = (openingTypeId === tid && customer) ? (customer.openingCrateBalance || 0) : 0;
    const typeEntries = entries.filter((e) => e.crateTypeId === tid && !e.id.startsWith('ob-'));
    const issued = ob + typeEntries.reduce((sum, e) => sum + (e.outQuantity || 0), 0);
    const returned = typeEntries.reduce((sum, e) => sum + (e.inQuantity || 0), 0);
    const bal = issued - returned;

    typeBalances.push({
      crateTypeId: tid,
      crateName: cName,
      issued,
      returned,
      balance: bal,
      weightKg: cWeight,
    });
  }

  // Sort: active/used crate types with non-zero balances or movements first, then by name
  typeBalances.sort((a, b) => {
    const aActive = a.issued > 0 || a.returned > 0 || a.balance !== 0 ? 1 : 0;
    const bActive = b.issued > 0 || b.returned > 0 || b.balance !== 0 ? 1 : 0;
    if (aActive !== bActive) return bActive - aActive;
    return a.crateName.localeCompare(b.crateName);
  });

  return {
    customer,
    entries,
    closingCrates: currentBalance,
    crateWeightKg: defaultWeightKg,
    closingTotalKg: currentBalance * defaultWeightKg,
    typeBalances,
  };
}

/**
 * Returns current balance for a specific customer and crate type.
 * Used for return validations: return cannot exceed issued balance for that specific type.
 */
export function getCustomerCrateBalanceByType(
  customerId: string,
  crateTypeId: string
): { crateTypeId: string; crateName: string; issued: number; returned: number; balance: number } {
  const statement = getCustomerCrateStatement(customerId);
  const found = statement.typeBalances.find((tb) => tb.crateTypeId === crateTypeId);
  if (found) {
    return {
      crateTypeId: found.crateTypeId,
      crateName: found.crateName,
      issued: found.issued,
      returned: found.returned,
      balance: found.balance,
    };
  }
  const ct = db.getCrateTypes().find((c) => c.id === crateTypeId);
  return {
    crateTypeId,
    crateName: ct ? ct.name : 'Crate',
    issued: 0,
    returned: 0,
    balance: 0,
  };
}

/**
 * Computes total outstanding for all customers
 */
export function getAllCustomerOutstandings(filter?: DateFilterRange): {
  customer: Customer;
  openingBalance: number;
  totalDebit: number;
  totalCredit: number;
  closingBalance: number;
  crateBalance: number;
  crateKg: number;
}[] {
  const customers = db.getCustomers();
  return customers.map((c) => {
    const ledger = getCustomerLedger(c.id, filter);
    const crateStmt = getCustomerCrateStatement(c.id, filter);
    return {
      customer: c,
      openingBalance: filter?.startDate ? (ledger.periodOpeningBalance || 0) : (c.openingBalanceType === 'debit' ? c.openingBalance : -c.openingBalance),
      totalDebit: ledger.totalDebit,
      totalCredit: ledger.totalCredit,
      closingBalance: ledger.closingBalance,
      crateBalance: crateStmt.closingCrates,
      crateKg: crateStmt.closingTotalKg,
    };
  });
}

/**
 * Computes dashboard statistics dynamically from real database records.
 */
export function getDashboardMetrics(selectedDateIso: string, datePreset: 'today' | 'yesterday' | 'week' | 'month' | 'all') {
  const saleProceeds = db.getSaleProceeds();
  const creditSales = db.getCreditSales();
  const receipts = db.getReceipts();
  const outstandings = getAllCustomerOutstandings();

  // Helper date match
  const isInRange = (dateStr: string) => {
    const iso = toIsoDate(dateStr);
    if (datePreset === 'all') return true;
    if (datePreset === 'today') return iso === selectedDateIso;
    if (datePreset === 'yesterday') {
      const d = new Date(selectedDateIso);
      d.setDate(d.getDate() - 1);
      const yesterdayIso = d.toISOString().split('T')[0];
      return iso === yesterdayIso;
    }
    if (datePreset === 'week') {
      const d = new Date(selectedDateIso);
      d.setDate(d.getDate() - 7);
      const weekAgoIso = d.toISOString().split('T')[0];
      return iso >= weekAgoIso && iso <= selectedDateIso;
    }
    if (datePreset === 'month') {
      const d = new Date(selectedDateIso);
      d.setDate(d.getDate() - 30);
      const monthAgoIso = d.toISOString().split('T')[0];
      return iso >= monthAgoIso && iso <= selectedDateIso;
    }
    return iso === selectedDateIso;
  };

  const periodSaleProceeds = saleProceeds.filter((sp) => isInRange(sp.date));
  const periodCreditSales = creditSales.filter((cs) => isInRange(cs.date));
  const periodReceipts = receipts.filter((r) => isInRange(r.date));

  const totalSaleProceeds = periodSaleProceeds.reduce((sum, sp) => sum + sp.netAmount, 0);
  const totalCreditSales = periodCreditSales.reduce((sum, cs) => sum + cs.finalAmount, 0);
  const totalReceipts = periodReceipts.reduce((sum, r) => sum + r.amount, 0);

  // Total expenses = sale proceeds expenses + credit sales expenses
  const saleExpenses = periodSaleProceeds.reduce((sum, sp) => sum + sp.totalExpense, 0);
  const creditExpenses = periodCreditSales.reduce((sum, cs) => sum + cs.expenseTotal, 0);
  const totalExpenses = saleExpenses + creditExpenses;

  // Net Profit = (Sale Proceeds Net + Credit Sales Product Total) - Expenses
  // In fruit wholesale commission / trading:
  // Revenue = Total Sales
  // Net Profit = (totalSaleProceeds + totalCreditSales) - totalExpenses
  const netProfit = (totalSaleProceeds + totalCreditSales) - totalExpenses;

  // Total Customer Outstanding
  const totalCustomerOutstanding = outstandings.reduce((sum, o) => sum + o.closingBalance, 0);

  // Total Crates
  const totalCrates = outstandings.reduce((sum, o) => sum + o.crateBalance, 0);

  // Wholesale Vendor Outstanding
  const vendors = db.getVendors();
  const totalVendorOutstanding = vendors.reduce((sum, v) => {
    return sum + (v.openingBalanceType === 'credit' ? v.openingBalance : -v.openingBalance);
  }, 0);

  return {
    saleProceedsCount: periodSaleProceeds.length,
    totalSaleProceeds,
    creditSalesCount: periodCreditSales.length,
    totalCreditSales,
    receiptsCount: periodReceipts.length,
    totalReceipts,
    totalExpenses,
    netProfit,
    totalCustomerOutstanding,
    totalVendorOutstanding,
    totalCrateBalance: totalCrates,
    recentSaleProceeds: periodSaleProceeds.slice(-5).reverse(),
    recentCreditSales: periodCreditSales.slice(-5).reverse(),
    recentReceipts: periodReceipts.slice(-5).reverse(),
  };
}
