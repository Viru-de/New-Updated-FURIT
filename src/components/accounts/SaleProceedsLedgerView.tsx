import React, { useState, useMemo } from 'react';
import { db } from '../../services/db';
import { getSaleProceedsLedger, getCustomerCrateStatement } from '../../services/accounting';
import { formatCurrency, formatDate, toIsoDate, getTodayIso, formatCompanySignature } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import { Customer, LedgerEntry, SaleProceeds, SaleProceedsOpeningBalance } from '../../types';
import { SaleProceedsModal } from './SaleProceedsModal';
import { SearchCustomerModal } from '../modals/SearchCustomerModal';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { Edit2, Download, Printer, Filter, Calendar, Building2, Search, X, Users } from 'lucide-react';
import { exportSaleProceedsLedger, exportSaleProceedsCustomerLedger } from '../../utils/excelEngine';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { QuantityInput } from '../common/QuantityInput';
import { formatSaleProceedShortParticulars, sanitizeOpeningBalanceLabel } from '../../utils/shortPrintUtils';

interface SaleProceedsLedgerViewProps {
  initialCustomerId?: string;
}

export const SaleProceedsLedgerView: React.FC<SaleProceedsLedgerViewProps> = ({
  initialCustomerId,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditObOpen, setIsEditObOpen] = useState(false);
  const [editingSaleProceeds, setEditingSaleProceeds] = useState<SaleProceeds | null>(null);
  const [isSaleProceedsModalOpen, setIsSaleProceedsModalOpen] = useState(false);

  // Customer search & filter state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(initialCustomerId || '');
  const [isSearchCustomerOpen, setIsSearchCustomerOpen] = useState(false);
  const selectedCustomer = selectedCustomerId ? db.getCustomerById(selectedCustomerId) : null;

  const currentOb = db.getSaleProceedsOpeningBalance();

  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile() || profiles[0];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const currentProfile = profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const [obAmount, setObAmount] = useState<number | ''>(currentOb.amount);
  const [obDate, setObDate] = useState(currentOb.date || getTodayIso());
  const [obParticulars, setObParticulars] = useState(currentOb.particulars || 'Opening Balance');
  const [obType, setObType] = useState<'credit' | 'debit'>(currentOb.type || 'credit');

  // Filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const ledger = getSaleProceedsLedger({
    startDate: filterStartDate ? toIsoDate(filterStartDate) : undefined,
    endDate: filterEndDate ? toIsoDate(filterEndDate) : undefined,
    customerId: selectedCustomerId || undefined,
  });

  const allSaleProceeds = useMemo(() => db.getSaleProceeds(), [refreshKey]);
  const saleProceedsMap = useMemo(() => {
    const map = new Map<string, SaleProceeds>();
    for (const sp of allSaleProceeds) {
      map.set(sp.id, sp);
      if (sp.proceedsNo) {
        map.set(sp.proceedsNo.trim().toLowerCase(), sp);
      }
    }
    return map;
  }, [allSaleProceeds]);

  const resolvedPrintCustomer: Partial<Customer> | null = useMemo(() => {
    if (selectedCustomer) return selectedCustomer;
    const customerKeys = new Set<string>();
    let matchedId = '';
    let matchedName = '';
    for (const entry of ledger.entries) {
      if (entry.referenceType === 'Opening Balance') continue;
      let sp: SaleProceeds | undefined;
      if (entry.referenceId) sp = saleProceedsMap.get(entry.referenceId);
      if (!sp && entry.id) sp = saleProceedsMap.get(entry.id);
      if (!sp && entry.referenceNo) sp = saleProceedsMap.get(entry.referenceNo.trim().toLowerCase());
      if (!sp && entry.particulars) sp = saleProceedsMap.get(entry.particulars.trim().toLowerCase());
      const cid = sp?.customerId || '';
      const cname = (sp?.customerName || '').trim();
      if (cid || cname) {
        customerKeys.add(cid || cname.toLowerCase());
        matchedId = cid;
        matchedName = cname;
      }
    }
    if (customerKeys.size === 1) {
      if (matchedId) {
        const found = db.getCustomerById(matchedId);
        if (found) return found;
      }
      if (matchedName) {
        const byName = db.getCustomers().find(
          (c) => c.name.trim().toLowerCase() === matchedName.toLowerCase()
        );
        if (byName) return byName;
        return { name: matchedName };
      }
    }
    return null;
  }, [selectedCustomer, ledger.entries, saleProceedsMap]);

  const getSaleProceedsDetails = (entry: LedgerEntry) => {
    let sp: SaleProceeds | undefined;
    if (entry.referenceId) sp = saleProceedsMap.get(entry.referenceId);
    if (!sp && entry.id) sp = saleProceedsMap.get(entry.id);
    if (!sp && entry.referenceNo) sp = saleProceedsMap.get(entry.referenceNo.trim().toLowerCase());
    if (!sp && entry.particulars) sp = saleProceedsMap.get(entry.particulars.trim().toLowerCase());

    const qty =
      sp?.items && sp.items.length > 0
        ? Math.round(sp.items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000) / 1000
        : (sp?.quantity ?? entry.subDetails?.qty ?? 0);

    const weight =
      sp?.items && sp.items.length > 0
        ? Math.round(sp.items.reduce((sum, it) => sum + (Number(it.weight ?? it.kg) || 0), 0) * 1000) / 1000
        : (sp?.weight ?? sp?.kg ?? 0);

    const total =
      sp?.netAmount !== undefined
        ? sp.netAmount
        : (entry.credit !== null ? entry.credit : (entry.debit !== null ? entry.debit : (sp?.amount ?? 0)));

    return { qty, weight, total };
  };

  const totalQty = useMemo(() => {
    return Math.round(
      ledger.entries.reduce((sum, entry) => {
        if (entry.referenceType === 'Opening Balance') return sum;
        return sum + (Number(getSaleProceedsDetails(entry).qty) || 0);
      }, 0) * 1000
    ) / 1000;
  }, [ledger.entries, saleProceedsMap]);

  const crateSummary = useMemo(() => {
    const crateTypes = db.getCrateTypes();
    const formatName = (name: string) => name.replace(/\s+Crate$/i, '').trim() || name;

    if (selectedCustomerId) {
      const stmt = getCustomerCrateStatement(selectedCustomerId);
      const activeTypes = stmt.typeBalances
        .filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0)
        .map((tb) => ({
          crateName: formatName(tb.crateName),
          issued: tb.issued,
          returned: tb.returned,
          balance: tb.balance,
        }));

      return {
        balanceCrate: stmt.closingCrates,
        typeBalances:
          activeTypes.length > 0
            ? activeTypes
            : [
                {
                  crateName: formatName(crateTypes[0]?.name || '20kg'),
                  issued: 0,
                  returned: 0,
                  balance: 0,
                },
              ],
      };
    }

    // Consolidated across all customers
    const customers = db.getCustomers();
    let totalBal = 0;
    const typeMap = new Map<string, { crateName: string; issued: number; returned: number; balance: number }>();

    for (const c of customers) {
      const stmt = getCustomerCrateStatement(c.id);
      totalBal += stmt.closingCrates;
      for (const tb of stmt.typeBalances) {
        const cleanName = formatName(tb.crateName);
        if (!typeMap.has(tb.crateTypeId)) {
          typeMap.set(tb.crateTypeId, {
            crateName: cleanName,
            issued: 0,
            returned: 0,
            balance: 0,
          });
        }
        const curr = typeMap.get(tb.crateTypeId)!;
        curr.issued += tb.issued;
        curr.returned += tb.returned;
        curr.balance += tb.balance;
      }
    }

    const activeTypes = Array.from(typeMap.values()).filter(
      (tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0
    );

    return {
      balanceCrate: totalBal,
      typeBalances:
        activeTypes.length > 0
          ? activeTypes
          : [
              {
                crateName: formatName(crateTypes[0]?.name || '20kg'),
                issued: 0,
                returned: 0,
                balance: 0,
              },
            ],
    };
  }, [selectedCustomerId, refreshKey]);

  const handleEditEntry = (entry: LedgerEntry) => {
    if (entry.referenceType === 'Opening Balance') {
      const ob = db.getSaleProceedsOpeningBalance();
      setObAmount(ob.amount);
      setObDate(ob.date || getTodayIso());
      setObParticulars(ob.particulars || 'Opening Balance');
      setObType(ob.type || 'credit');
      setIsEditObOpen(true);
      return;
    }

    if (entry.referenceType === 'Sale Proceeds') {
      const sp = db.getSaleProceeds().find((s) => s.id === entry.referenceId || s.id === entry.id);
      if (sp) {
        setEditingSaleProceeds(sp);
        setIsSaleProceedsModalOpen(true);
      }
    }
  };

  const handleSaveOb = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedOb: SaleProceedsOpeningBalance = {
      id: currentOb.id || 'sp-ob-1',
      amount: Number(obAmount) || 0,
      date: obDate,
      particulars: obParticulars.trim() || 'Opening Balance',
      type: obType,
    };
    db.saveSaleProceedsOpeningBalance(updatedOb);
    setIsEditObOpen(false);
    setRefreshKey((k) => k + 1);
  };

  const handlePrint = () => {
    triggerPrint('a4', 'sale-proceeds-print-area');
  };

  const handleShortPrint = () => {
    triggerPrint('a4', 'sale-proceeds-short-print-area');
  };

  const handleExportCsv = () => {
    const headers = ['Date', 'Particulars', 'Debit (₹)', 'Credit (₹)', 'Balance (₹)'];
    const rows = ledger.entries.map((e) => [
      formatDate(e.date),
      `"${e.particulars}"`,
      e.debit !== null ? e.debit.toFixed(2) : '',
      e.credit !== null ? e.credit.toFixed(2) : '',
      e.balance.toFixed(2),
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Sale_Proceeds_Ledger_${getTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Sale Proceeds Ledger
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setIsSearchCustomerOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-300 cursor-pointer shadow-2xs"
            title="Search and filter by customer"
          >
            <Search className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Search Customer</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditObOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Edit2 className="h-3.5 w-3.5 text-emerald-600" /> Opening Balance
          </button>
          <button
            type="button"
            onClick={() => {
              if (selectedCustomerId) {
                exportSaleProceedsCustomerLedger(selectedCustomerId);
              } else {
                exportSaleProceedsLedger();
              }
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
          <div className="flex items-center gap-1.5 no-print">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title="Select Billing Profile for Statement Header"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.hindiName ? `(${p.hindiName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <BillShareButtons
            elementId="sale-proceeds-print-area"
            filename={`Sale_Proceeds_Ledger_${selectedCustomer ? `${selectedCustomer.name.replace(/\s+/g, '_')}_` : ''}${formatDate(getTodayIso()).replace(/\//g, '_')}`}
            title={selectedCustomer ? `Sale Proceeds Ledger — ${selectedCustomer.name}` : "Sale Proceeds Ledger Statement"}
            summaryText={`Account: Sale Proceeds Ledger${selectedCustomer ? `\nCustomer: ${selectedCustomer.name}` : ''}\nDate: ${formatDate(getTodayIso())}\nTotal Debit: ₹${ledger.totalDebit.toLocaleString('en-IN')}\nTotal Credit: ₹${ledger.totalCredit.toLocaleString('en-IN')}\nClosing Balance: ₹${ledger.closingBalance.toLocaleString('en-IN')}`}
          />
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs cursor-pointer"
            title="Print full Sale Proceeds ledger"
          >
            <Printer className="h-3.5 w-3.5" /> Print Ledger
          </button>
          <button
            type="button"
            onClick={handleShortPrint}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
            title="Short Print: document number and sale proceeds only"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-600" /> Short Print
          </button>
        </div>
      </div>

      {/* Date & Customer Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-end gap-3">
          {/* Prominent Search Customer Button */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Customer Filter
            </label>
            <button
              type="button"
              onClick={() => setIsSearchCustomerOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 cursor-pointer transition-all"
            >
              <Search className="h-4 w-4" />
              <span>Search Customer</span>
            </button>
          </div>

          {/* Active Customer Indicator with Clear Search / All Customers option */}
          {selectedCustomer ? (
            <div className="flex items-center gap-2.5 rounded-lg border border-emerald-300 bg-emerald-50/90 px-3 py-1.5 text-xs dark:border-emerald-800 dark:bg-emerald-950/50">
              <CustomerAvatar photo={selectedCustomer.photo} name={selectedCustomer.name} size="xs" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-emerald-950 dark:text-emerald-100 truncate">
                    {selectedCustomer.name}
                  </span>
                  {selectedCustomer.city && (
                    <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/60 px-1.5 py-0.2 rounded">
                      {selectedCustomer.city}
                    </span>
                  )}
                </div>
                {selectedCustomer.mobile && (
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-300 font-mono">
                    Mob: {selectedCustomer.mobile}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomerId('')}
                className="ml-1 rounded p-1 text-emerald-700 hover:bg-emerald-200 hover:text-rose-600 dark:text-emerald-300 dark:hover:bg-emerald-900 dark:hover:text-rose-300 cursor-pointer transition-colors"
                title="Clear Search / Show All Customers"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-400">
              <Users className="h-4 w-4 opacity-50" />
              <span>All Customers (Complete Ledger)</span>
            </div>
          )}

          {/* All Customers / Clear Search button when filtered */}
          {selectedCustomerId && (
            <button
              type="button"
              onClick={() => setSelectedCustomerId('')}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
            >
              All Customers (Clear Search)
            </button>
          )}

          <div className="w-36 sm:w-44">
            <DatePickerInput
              label="From Date"
              value={filterStartDate}
              onChange={setFilterStartDate}
            />
          </div>
          <div className="w-36 sm:w-44">
            <DatePickerInput
              label="To Date"
              value={filterEndDate}
              onChange={setFilterEndDate}
            />
          </div>
          {(filterStartDate || filterEndDate) && (
            <button
              type="button"
              onClick={() => {
                setFilterStartDate('');
                setFilterEndDate('');
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
            >
              Clear Dates
            </button>
          )}

          {/* Crate Balance Quick Summary on screen */}
          <div className="sm:ml-auto rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-800/60">
            <div className="font-bold text-slate-900 dark:text-slate-100">
              Balance Crate: {crateSummary.balanceCrate}
            </div>
            {crateSummary.typeBalances.map((tb, idx) => (
              <div key={idx} className="font-bold text-slate-700 dark:text-slate-300">
                {tb.crateName}: {tb.issued} Out ({tb.balance} Bal)
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* On-screen Ledger Table Container (Interactive, full dark mode and edit support) */}
      <div
        id="sale-proceeds-screen-table"
        className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse bg-white dark:bg-slate-900">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <th className="px-5 py-3.5 w-32 text-slate-800 dark:text-slate-100 font-bold">Date</th>
                <th className="px-5 py-3.5 text-slate-800 dark:text-slate-100 font-bold">Particulars</th>
                <th className="px-5 py-3.5 text-right w-36 text-slate-800 dark:text-slate-100 font-bold">Debit (Dr)</th>
                <th className="px-5 py-3.5 text-right w-36 text-slate-800 dark:text-slate-100 font-bold">Credit (Cr)</th>
                <th className="px-5 py-3.5 text-right w-44 text-slate-800 dark:text-slate-100 font-bold">Balance (₹)</th>
                <th className="px-4 py-3.5 text-center w-24 text-slate-800 dark:text-slate-100 font-bold no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {selectedCustomer
                      ? `No sale proceeds records found for ${selectedCustomer.name}${filterStartDate || filterEndDate ? ' in this date range.' : '.'}`
                      : 'No ledger transactions recorded in this period.'}
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  const details = getSaleProceedsDetails(entry);
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40 ${
                        isOb ? 'bg-amber-50/40 font-medium dark:bg-amber-950/30' : ''
                      }`}
                    >
                      <td className="px-5 py-3 font-mono-numbers text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-5 py-3 text-slate-900 dark:text-slate-100">
                        <div className={`font-semibold text-xs sm:text-sm ${isOb ? 'text-amber-900 dark:text-amber-300 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
                          {entry.particulars}
                        </div>
                        {!isOb && (
                          <div className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 print:text-black mt-0.5 whitespace-nowrap">
                            <span>Qty: {details.qty}</span>
                            <span className="mx-1.5 opacity-60">|</span>
                            <span>Weight: {details.weight > 0 ? `${details.weight} Kg` : '0 Kg'}</span>
                            <span className="mx-1.5 opacity-60">|</span>
                            <span>Total: {formatCurrency(details.total)}</span>
                          </div>
                        )}
                      </td>
                      {/* Debit cell - blank if null */}
                      <td className="px-5 py-3 text-right font-mono-numbers text-xs sm:text-sm text-rose-600 dark:text-rose-400 font-semibold">
                        {entry.debit !== null ? formatCurrency(entry.debit) : ''}
                      </td>
                      {/* Credit cell - blank if null */}
                      <td className="px-5 py-3 text-right font-mono-numbers text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-semibold">
                        {entry.credit !== null ? formatCurrency(entry.credit) : ''}
                      </td>
                      {/* Balance cell */}
                      <td className="px-5 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(entry.balance)}
                      </td>
                      <td className="px-4 py-3 text-center no-print whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEditEntry(entry)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Edit Entry"
                        >
                          <Edit2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Edit</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold dark:border-slate-700 dark:bg-slate-800/90">
                <td colSpan={2} className="px-5 py-3.5 text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Total & Closing Balance
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-sm text-rose-600 dark:text-rose-400">
                  {ledger.totalDebit > 0 ? formatCurrency(ledger.totalDebit) : ''}
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-sm text-emerald-600 dark:text-emerald-400">
                  {ledger.totalCredit > 0 ? formatCurrency(ledger.totalCredit) : ''}
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-base text-emerald-700 dark:text-emerald-300 font-extrabold">
                  {formatCurrency(ledger.closingBalance)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Closing Balance Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-emerald-50/70 px-6 py-4 dark:border-slate-800 dark:bg-emerald-950/40">
          <div>
            <div className="text-xs font-medium text-emerald-950 dark:text-emerald-200">
              {selectedCustomer ? (
                <span>Sale Proceeds Ledger Balance for <strong className="text-emerald-950 dark:text-emerald-100">{selectedCustomer.name}</strong></span>
              ) : (
                <span>Current Account Balance for <strong className="text-emerald-950 dark:text-emerald-100">Hari Kripa</strong></span>
              )}
            </div>
            {/* Crate Balance Information */}
            <div className="mt-2 text-xs">
              <div className="font-bold text-slate-900 dark:text-slate-100 print:text-black">
                Balance Crate: {crateSummary.balanceCrate}
              </div>
              {crateSummary.typeBalances.map((tb, idx) => (
                <div key={idx} className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                  {tb.crateName}: {tb.issued} Out ({tb.balance} Bal)
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 dark:text-emerald-300">
              Closing Balance:
            </span>
            <span className="font-mono-numbers text-lg font-extrabold text-emerald-700 dark:text-emerald-300">
              {formatCurrency(ledger.closingBalance)}
            </span>
          </div>
        </div>

        {/* Software attribution & Signatory */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-black flex justify-between items-center text-xs">
          <div className="text-[8px] sm:text-[8.5px] text-left text-slate-500 dark:text-slate-400 print:text-black font-mono">
            Software Developed by: {defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="hidden print:block text-right font-bold uppercase text-[11px]">
            {formatCompanySignature(defaultProfile)}
          </div>
        </div>
      </div>

      {/* Short Print Layout for Sale Proceeds Ledger (Matches reference ledger print format) */}
      <div
        id="sale-proceeds-short-print-area"
        data-theme-isolated="true"
        className="hidden bg-white text-black print-bill-canvas max-w-[760px] w-full mx-auto pt-1 print:pt-0 px-3 pb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Company Header + Customer on Left, ACCOUNT DETAILS on Right */}
        <div className="pb-1.5 mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger" />
          <div className="flex justify-between items-end gap-4 pt-1">
            {/* Top-Left: M/s: Customer Name only */}
            <div className="max-w-[65%]">
              {resolvedPrintCustomer ? (
                <div className="text-base sm:text-lg font-extrabold text-black uppercase tracking-tight leading-tight">
                  M/s: {resolvedPrintCustomer.name || 'Customer'}
                </div>
              ) : (
                <div className="text-base sm:text-lg font-extrabold text-black uppercase tracking-tight leading-tight">
                  ALL CUSTOMERS
                </div>
              )}
            </div>

            {/* Top-Right: ACCOUNT DETAILS, Date Range & Page */}
            <div className="text-right shrink-0">
              <div className="text-sm sm:text-base font-black uppercase tracking-wider text-black leading-tight">
                ACCOUNT DETAILS
              </div>
              <div className="text-xs font-semibold text-black mt-0.5">
                {filterStartDate && filterEndDate ? (
                  <span>{formatDate(filterStartDate)} To {formatDate(filterEndDate)}</span>
                ) : filterStartDate ? (
                  <span>From {formatDate(filterStartDate)} To Today</span>
                ) : filterEndDate ? (
                  <span>Up to {formatDate(filterEndDate)}</span>
                ) : (
                  <span>01-04-2026 To {formatDate(getTodayIso())}</span>
                )}
              </div>
              <div className="text-[10px] text-black font-mono mt-0.5">
                Page 1 of 1
              </div>
            </div>
          </div>
        </div>

        {/* Short Print Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
        <div className="overflow-x-auto">
          <table className="sp-short-table w-full text-left text-xs border-collapse bg-white text-black">
            <thead>
              <tr className="sp-short-col-header border-t border-b border-black bg-white text-[11px] font-bold uppercase tracking-wider text-black">
                <th className="py-1.5 px-2 w-[84px] text-left whitespace-nowrap">DATE</th>
                <th className="py-1.5 px-2.5 text-left">PARTICULARS</th>
                <th className="py-1.5 px-2 text-right w-[84px] whitespace-nowrap">DEBIT</th>
                <th className="py-1.5 px-2 text-right w-[84px] whitespace-nowrap">CREDIT</th>
                <th className="py-1.5 px-2 text-right w-[96px] whitespace-nowrap">BALANCE</th>
              </tr>
            </thead>
            <tbody className="bg-white text-black">
              {ledger.entries.length === 0 ? (
                <tr className="bg-white">
                  <td colSpan={5} className="py-6 text-center text-xs text-black">
                    No transactions found in this period.
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry, idx) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  let sp: SaleProceeds | undefined;
                  if (entry.referenceId) sp = saleProceedsMap.get(entry.referenceId);
                  if (!sp && entry.id) sp = saleProceedsMap.get(entry.id);
                  if (!sp && entry.referenceNo) sp = saleProceedsMap.get(entry.referenceNo.trim().toLowerCase());
                  if (!sp && entry.particulars) sp = saleProceedsMap.get(entry.particulars.trim().toLowerCase());

                  const details = getSaleProceedsDetails(entry);
                  const shortInfo = formatSaleProceedShortParticulars(entry, sp, details.qty);

                  const debitVal = entry.debit !== null && entry.debit !== undefined && entry.debit > 0 ? Number(entry.debit).toFixed(2) : '';
                  const creditVal = entry.credit !== null && entry.credit !== undefined && entry.credit > 0 ? Number(entry.credit).toFixed(2) : '';
                  const balanceVal = entry.balance < 0 ? `(${Math.abs(entry.balance).toFixed(2)})` : Number(entry.balance).toFixed(2);
                  const isShaded = idx % 2 === 0;

                  return (
                    <tr
                      key={`short-acc-${entry.id}`}
                      className={isShaded ? 'sp-zebra-even bg-[#eaedf1]' : 'sp-zebra-odd bg-white'}
                    >
                      <td className="py-1 px-2 font-mono text-[11px] text-black align-top whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-1 px-2.5 text-black align-top">
                        {isOb ? (
                          <span className="font-semibold text-[11.5px] text-black uppercase">
                            {shortInfo.primaryRef}
                          </span>
                        ) : (
                          <div className="flex items-baseline justify-between gap-3 text-[11.5px] leading-snug text-black">
                            <span className="font-semibold text-black whitespace-nowrap">
                              {shortInfo.primaryRef}
                            </span>
                            <div className="flex items-baseline gap-2.5 shrink-0 font-mono text-black">
                              {shortInfo.accountRef && (
                                <span className="uppercase font-medium whitespace-nowrap">
                                  {shortInfo.accountRef}
                                </span>
                              )}
                              {shortInfo.qty > 0 && (
                                <span className="font-semibold whitespace-nowrap">
                                  Qty:{shortInfo.qty}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-[11.5px] text-black align-top whitespace-nowrap">
                        {debitVal}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-[11.5px] text-black align-top whitespace-nowrap">
                        {creditVal}
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-[11.5px] font-semibold text-black align-top whitespace-nowrap">
                        {balanceVal}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="sp-short-total-row border-t border-black text-xs bg-white text-black">
                <td colSpan={2} className="pt-1.5 pb-0.5 px-2 text-left text-[11.5px] font-semibold text-black align-top">
                  Crate Balance: {crateSummary.balanceCrate}
                </td>
                <td className="pt-1.5 pb-0.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black whitespace-nowrap align-top">
                  {ledger.totalDebit > 0 ? Number(ledger.totalDebit).toFixed(2) : ''}
                </td>
                <td className="pt-1.5 pb-0.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black whitespace-nowrap align-top">
                  {ledger.totalCredit > 0 ? Number(ledger.totalCredit).toFixed(2) : ''}
                </td>
                <td className="pt-1.5 pb-0.5 px-2 text-right font-mono text-[11.5px] font-bold text-black whitespace-nowrap align-top">
                  &nbsp;
                </td>
              </tr>
              <tr className="sp-short-closing-row bg-white text-black">
                <td colSpan={2} className="py-1 px-2 text-left text-[11.5px] font-semibold text-black align-top">
                  <div className="flex items-center gap-4">
                    <span>= {crateSummary.balanceCrate}</span>
                    {totalQty > 0 && <span>Total Qty: {totalQty}</span>}
                  </div>
                </td>
                <td colSpan={3} className="sp-short-closing-cell border-t border-black py-1.5 px-2 align-top">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium uppercase tracking-wide text-black whitespace-nowrap">
                      CLOSING BALANCE :
                    </span>
                    <span className="text-sm sm:text-base font-extrabold font-mono text-black whitespace-nowrap">
                      {Math.abs(ledger.closingBalance).toFixed(2)} {ledger.closingBalance < 0 ? 'Dr' : ledger.closingBalance > 0 ? 'Cr' : ''}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Software attribution */}
        <div className="px-2 pt-2 pb-1 flex justify-between items-end text-xs bg-white text-black">
          <div className="text-[9px] text-black font-mono">
            Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
        </div>
      </div>

      {/* Printable Account Detail Statement Layout for Sale Proceeds Ledger (Matches reference ledger print format) */}
      <div
        id="sale-proceeds-print-area"
        data-theme-isolated="true"
        className="hidden bg-white text-black print-bill-canvas max-w-[760px] w-full mx-auto pt-1 print:pt-0 px-3 pb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Company Header + Customer on Left, ACCOUNT DETAILS on Right */}
        <div className="pb-1.5 mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger" />
          <div className="flex justify-between items-end gap-4 pt-1">
            {/* Top-Left: M/s: Customer Name only */}
            <div className="max-w-[65%]">
              {resolvedPrintCustomer ? (
                <div className="text-base sm:text-lg font-extrabold text-black uppercase tracking-tight leading-tight">
                  M/s: {resolvedPrintCustomer.name || 'Customer'}
                </div>
              ) : (
                <div className="text-base sm:text-lg font-extrabold text-black uppercase tracking-tight leading-tight">
                  ALL CUSTOMERS
                </div>
              )}
            </div>

            {/* Top-Right: ACCOUNT DETAILS, Date Range & Page */}
            <div className="text-right shrink-0">
              <div className="text-sm sm:text-base font-black uppercase tracking-wider text-black leading-tight">
                ACCOUNT DETAILS
              </div>
              <div className="text-xs font-semibold text-black mt-0.5">
                {filterStartDate && filterEndDate ? (
                  <span>{formatDate(filterStartDate)} To {formatDate(filterEndDate)}</span>
                ) : filterStartDate ? (
                  <span>From {formatDate(filterStartDate)} To Today</span>
                ) : filterEndDate ? (
                  <span>Up to {formatDate(filterEndDate)}</span>
                ) : (
                  <span>01-04-2026 To {formatDate(getTodayIso())}</span>
                )}
              </div>
              <div className="text-[10px] text-black font-mono mt-0.5">
                Page 1 of 1
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
        <div className="overflow-x-auto">
          <table className="ledger-ref-table sp-detailed-ref-table w-full table-fixed text-left text-xs border-collapse bg-white text-black">
            <colgroup>
              <col style={{ width: '84px' }} />
              <col />
              <col style={{ width: '84px' }} />
              <col style={{ width: '84px' }} />
              <col style={{ width: '96px' }} />
            </colgroup>
            <thead>
              <tr className="border-0 bg-white text-[11px] font-bold uppercase tracking-wider text-black">
                <th className="py-1.5 px-2 text-left border-t border-b border-black border-r border-r-slate-300 whitespace-nowrap">DATE</th>
                <th className="py-1.5 px-2.5 text-left border-t border-b border-black border-r border-r-slate-300">PARTICULARS</th>
                <th className="py-1.5 px-2 text-right border-t border-b border-black border-r border-r-slate-300 whitespace-nowrap">DEBIT</th>
                <th className="py-1.5 px-2 text-right border-t border-b border-black border-r border-r-slate-300 whitespace-nowrap">CREDIT</th>
                <th className="py-1.5 px-2 text-right border-t border-b border-black whitespace-nowrap">BALANCE</th>
              </tr>
            </thead>
            <tbody className="bg-white text-black">
              {ledger.entries.length === 0 ? (
                <tr className="border-0">
                  <td colSpan={5} className="py-8 text-center text-xs text-black border-b border-slate-300">
                    No transactions found in this period.
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  let sp: SaleProceeds | undefined;
                  if (entry.referenceId) sp = saleProceedsMap.get(entry.referenceId);
                  if (!sp && entry.id) sp = saleProceedsMap.get(entry.id);
                  if (!sp && entry.referenceNo) sp = saleProceedsMap.get(entry.referenceNo.trim().toLowerCase());
                  if (!sp && entry.particulars) sp = saleProceedsMap.get(entry.particulars.trim().toLowerCase());

                  const rawNo = entry.referenceNo || entry.particulars || '';
                  const numMatch = rawNo.match(/\d+/);
                  const formattedNo = numMatch ? numMatch[0].padStart(3, '0') : '001';

                  const items = sp?.items && sp.items.length > 0
                    ? sp.items
                    : (entry.subDetails?.items || []);

                  const expenses = sp?.expenses && sp.expenses.length > 0
                    ? sp.expenses
                    : (entry.subDetails?.expenses || []);

                  const details = getSaleProceedsDetails(entry);
                  const topWeight = sp?.weight !== undefined && sp.weight !== null ? sp.weight : sp?.kg;

                  const totalExpenseSum = sp?.totalExpense ?? expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0);

                  const debitVal = entry.debit !== null && entry.debit !== undefined && entry.debit > 0 ? Number(entry.debit).toFixed(2) : '';
                  const creditVal = entry.credit !== null && entry.credit !== undefined && entry.credit > 0 ? Number(entry.credit).toFixed(2) : '';
                  const balanceVal = entry.balance < 0 ? `(${Math.abs(entry.balance).toFixed(2)})` : Number(entry.balance).toFixed(2);

                  return (
                    <tr key={`print-full-${entry.id}`} className="border-0">
                      {/* DATE */}
                      <td className="py-1.5 px-2 font-mono text-[11px] text-black align-top whitespace-nowrap border-b border-slate-300 border-r border-r-slate-300">
                        {formatDate(entry.date)}
                      </td>

                      {/* PARTICULARS */}
                      <td className="py-1.5 px-2.5 text-black align-top border-b border-slate-300 border-r border-r-slate-300">
                        {isOb ? (
                          <div className="font-semibold text-[11.5px] text-black uppercase">
                            {sanitizeOpeningBalanceLabel(entry.particulars)}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {/* Line 1: Transaction number on Left, Qty on Right */}
                            <div className="flex items-baseline justify-between gap-3 text-[11.5px] leading-snug text-black">
                              <div className="flex flex-wrap items-baseline gap-1.5">
                                <span className="font-semibold text-black whitespace-nowrap">
                                  Sale Proceed No. {formattedNo}
                                </span>
                                {sp?.challanDate && sp.challanDate !== sp.date && (
                                  <span className="text-[10.5px] text-black">
                                    Challan Dt: {formatDate(sp.challanDate)}
                                  </span>
                                )}
                              </div>
                              {details.qty > 0 && (
                                <span className="font-mono font-semibold text-black whitespace-nowrap shrink-0">
                                  Qty:{details.qty}
                                </span>
                              )}
                            </div>

                            {/* Item details: Name on Left, Qty Unit [Weight] @ Rate = Amount on Right */}
                            {items.length > 0 ? (
                              <div className="space-y-0.5 text-black">
                                {items.map((it: any, iIdx: number) => {
                                  const itQty = it.quantity ?? it.qty ?? 0;
                                  const itUnit = it.unit || 'Box';
                                  const itWeight = it.weight ?? it.kg ?? (items.length === 1 && topWeight ? topWeight : undefined);
                                  const itRate = Number(it.rate ?? 0);
                                  const itAmount = Number(it.amount ?? (itQty * itRate));

                                  return (
                                    <div key={iIdx} className="sp-detail-line flex items-baseline justify-between gap-3 text-[11.5px] leading-snug text-black">
                                      <span className="font-medium text-black uppercase">
                                        {it.fruitName || it.name || 'Item'}
                                      </span>
                                      <span className="font-mono text-black text-right shrink-0">
                                        <span className="whitespace-nowrap sp-qty-nowrap">
                                          {itQty} {itUnit}
                                        </span>
                                        {itWeight !== undefined && Number(itWeight) > 0 ? ` ${itWeight}kg` : ''}
                                        {` @ ${Number(itRate.toFixed(2))}`}
                                        {itAmount > 0 ? ` = ${Number(itAmount.toFixed(2))}` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="flex items-baseline justify-between gap-3 text-[11.5px] text-black font-mono">
                                <span>&nbsp;</span>
                                <span>
                                  <span className="whitespace-nowrap sp-qty-nowrap">
                                    {sp?.quantity ?? entry.subDetails?.qty ?? 0}
                                    {sp?.unit ? ` ${sp.unit}` : ''}
                                  </span>
                                  {topWeight ? ` ${topWeight}kg` : ''}
                                  {sp?.rate ? ` @ ${sp.rate}` : ''}
                                </span>
                              </div>
                            )}

                            {/* Expenses Breakdown: items on Left, total expense on Right */}
                            {expenses.length > 0 && (
                              <div className="flex items-baseline justify-between gap-3 text-[11px] leading-snug text-black">
                                <span>
                                  {expenses.map((e: any) => `${e.name} ${Number(Number(e.amount).toFixed(2))}`).join('  ')}
                                </span>
                                {totalExpenseSum > 0 && (
                                  <span className="font-mono font-medium shrink-0">
                                    {Number(totalExpenseSum.toFixed(2))}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* DEBIT */}
                      <td className="py-1.5 px-2 text-right font-mono text-[11.5px] text-black align-top whitespace-nowrap border-b border-slate-300 border-r border-r-slate-300">
                        {debitVal}
                      </td>

                      {/* CREDIT */}
                      <td className="py-1.5 px-2 text-right font-mono text-[11.5px] text-black align-top whitespace-nowrap border-b border-slate-300 border-r border-r-slate-300">
                        {creditVal}
                      </td>

                      {/* BALANCE */}
                      <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black align-top whitespace-nowrap border-b border-slate-300">
                        {balanceVal}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              {/* Total Row with Crate Balance on Left and Debit/Credit Totals aligned under columns */}
              <tr className="border-0 text-xs bg-white text-black">
                <td colSpan={2} className="py-1.5 px-2 text-left text-[11.5px] font-semibold text-black border-t border-b border-black border-r border-r-slate-300 align-top">
                  <div>Crate Balance: {crateSummary.balanceCrate}</div>
                  <div className="flex items-center gap-4">
                    <span>= {crateSummary.balanceCrate}</span>
                    {totalQty > 0 && <span>Total Qty: {totalQty}</span>}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black whitespace-nowrap border-t border-b border-black border-r border-r-slate-300 align-top">
                  {ledger.totalDebit > 0 ? Number(ledger.totalDebit).toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black whitespace-nowrap border-t border-b border-black border-r border-r-slate-300 align-top">
                  {ledger.totalCredit > 0 ? Number(ledger.totalCredit).toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-bold text-black whitespace-nowrap border-t border-b border-black align-top">
                  &nbsp;
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Closing Balance Line matching reference image */}
        <div className="pt-2 pb-1 px-2 flex justify-end items-baseline gap-6 bg-white text-black">
          <span className="text-sm font-medium uppercase tracking-wide text-black">
            CLOSING BALANCE :
          </span>
          <span className="text-sm sm:text-base font-extrabold font-mono text-black whitespace-nowrap">
            {Math.abs(ledger.closingBalance).toFixed(2)} {ledger.closingBalance < 0 ? 'Dr' : ledger.closingBalance > 0 ? 'Cr' : ''}
          </span>
        </div>

        {/* Software Developed By */}
        <div className="px-2 pt-2 pb-1 flex justify-between items-end text-xs bg-white text-black">
          <div className="text-[9px] text-black font-mono">
            Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
        </div>
      </div>

      {/* Opening Balance Modal */}
      {isEditObOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Sale Proceeds Account Opening Balance
              </h3>
              <button
                type="button"
                onClick={() => setIsEditObOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveOb} className="space-y-4 p-5">
              <DatePickerInput
                label="Opening Date"
                required
                value={obDate}
                onChange={setObDate}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Particulars
                </label>
                <input
                  type="text"
                  required
                  value={obParticulars}
                  onChange={(e) => setObParticulars(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Opening Amount (₹)
                  </label>
                  <QuantityInput
                    step="any"
                    required
                    value={obAmount}
                    onChange={(val) => setObAmount(val)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={obType}
                    onChange={(e) => setObType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="credit">Credit (Cr)</option>
                    <option value="debit">Debit (Dr)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditObOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save Opening Balance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sale Proceeds Edit Modal */}
      <SaleProceedsModal
        isOpen={isSaleProceedsModalOpen}
        onClose={() => {
          setIsSaleProceedsModalOpen(false);
          setEditingSaleProceeds(null);
        }}
        editItem={editingSaleProceeds}
        onSaved={() => {
          setIsSaleProceedsModalOpen(false);
          setEditingSaleProceeds(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      {/* Search Customer Modal */}
      <SearchCustomerModal
        isOpen={isSearchCustomerOpen}
        onClose={() => setIsSearchCustomerOpen(false)}
        onSelectCustomer={(c) => {
          setSelectedCustomerId(c ? c.id : '');
        }}
        selectedCustomerId={selectedCustomerId}
      />
    </div>
  );
};
