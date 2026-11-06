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
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { QuantityInput } from '../common/QuantityInput';

export const SaleProceedsLedgerView: React.FC = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [isEditObOpen, setIsEditObOpen] = useState(false);
  const [editingSaleProceeds, setEditingSaleProceeds] = useState<SaleProceeds | null>(null);
  const [isSaleProceedsModalOpen, setIsSaleProceedsModalOpen] = useState(false);

  // Customer search & filter state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
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

      {/* Ledger Table Container */}
      <div
        id="sale-proceeds-print-area"
        className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Printable Traditional Mandi Statement Header */}
        <div className="hidden print:block p-4 border-b border-black text-center mb-1">
          {(currentProfile.shortName || currentProfile.shortCode) && (
            <div className="font-black text-sm tracking-[0.2em] uppercase text-slate-950 print:text-black pb-0.5">
              {currentProfile.shortName || currentProfile.shortCode}
            </div>
          )}
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider">{currentProfile.name}</h1>
          {currentProfile.hindiName && (
            <div className="text-base sm:text-lg font-bold tracking-wide mt-0.5 font-devanagari text-slate-900 print:text-black">
              {currentProfile.hindiName}
            </div>
          )}
          <div className="text-[11px] text-slate-700 leading-snug mt-1">
            {currentProfile.address}
            {currentProfile.city ? `, ${currentProfile.city}` : ''}
            {currentProfile.state ? `, ${currentProfile.state}` : ''}
          </div>
          <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
          <div className="my-1.5 text-xs font-bold uppercase tracking-widest border-b border-t border-black py-0.5 inline-block">
            SALE PROCEEDS LEDGER STATEMENT
          </div>
          <div className="flex justify-between items-start text-xs mt-2 text-left border-t border-slate-300 pt-1.5">
            <div>
              <div className="font-bold text-sm">Account: Mandi Sale Consignment Proceeds</div>
              {selectedCustomer && (
                <div className="font-bold text-xs mt-0.5 text-slate-900 print:text-black">
                  Customer: {selectedCustomer.name} {selectedCustomer.mobile ? `· Contact: ${selectedCustomer.mobile}` : ''}
                </div>
              )}
              <div className="text-[11px]">Entity: {currentProfile.name}</div>
              {/* Crate Balance Information */}
              <div className="mt-2 text-xs">
                <div className="font-bold text-slate-900 print:text-black">
                  Balance Crate: {crateSummary.balanceCrate}
                </div>
                {crateSummary.typeBalances.map((tb, idx) => (
                  <div key={idx} className="font-bold text-slate-900 print:text-black">
                    {tb.crateName}: {tb.issued} Out ({tb.balance} Bal)
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div>DATE: <strong>{formatDate(getTodayIso())}</strong></div>
              {(filterStartDate || filterEndDate) ? (
                <div className="text-[11px]">Period: {filterStartDate ? formatDate(filterStartDate) : 'Opening'} to {filterEndDate ? formatDate(filterEndDate) : 'Today'}</div>
              ) : (
                <div className="text-[11px]">Period: Complete Statement{selectedCustomer ? ` (${selectedCustomer.name})` : ' (All Transactions)'}</div>
              )}
              <div className="mt-1 font-bold">
                Closing Balance: <strong>{formatCurrency(ledger.closingBalance)}</strong>
              </div>
            </div>
          </div>
        </div>

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

      {/* Short Print Layout for Sale Proceeds Ledger (Cloned & printed via Short Print button) */}
      <div
        id="sale-proceeds-short-print-area"
        className="hidden rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Printable Traditional Mandi Statement Header */}
        <div className="p-4 border-b border-black text-center mb-1">
          {(currentProfile.shortName || currentProfile.shortCode) && (
            <div className="font-black text-sm tracking-[0.2em] uppercase text-slate-950 print:text-black pb-0.5">
              {currentProfile.shortName || currentProfile.shortCode}
            </div>
          )}
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider">{currentProfile.name}</h1>
          {currentProfile.hindiName && (
            <div className="text-base sm:text-lg font-bold tracking-wide mt-0.5 font-devanagari text-slate-900 print:text-black">
              {currentProfile.hindiName}
            </div>
          )}
          <div className="text-[11px] text-slate-700 leading-snug mt-1">
            {currentProfile.address}
            {currentProfile.city ? `, ${currentProfile.city}` : ''}
            {currentProfile.state ? `, ${currentProfile.state}` : ''}
          </div>
          <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
          <div className="my-1.5 text-xs font-bold uppercase tracking-widest border-b border-t border-black py-0.5 inline-block">
            SALE PROCEEDS LEDGER (SHORT FORMAT)
          </div>
          <div className="flex justify-between items-start text-xs mt-2 text-left border-t border-slate-300 pt-1.5">
            <div>
              {selectedCustomer ? (
                <>
                  <div className="font-bold text-sm">M/s. {selectedCustomer.name}</div>
                  {selectedCustomer.city && <div className="text-[11px]">Mandi / City: {selectedCustomer.city}</div>}
                  {selectedCustomer.mobile && <div className="text-[11px]">Mob: {selectedCustomer.mobile}</div>}
                </>
              ) : (
                <>
                  <div className="font-bold text-sm">Account: Mandi Sale Consignment Proceeds</div>
                </>
              )}
              {/* Crate Balance Information */}
              <div className="mt-2 text-xs">
                <div className="font-bold text-slate-950 print:text-black">
                  Balance Crate: {crateSummary.balanceCrate}
                </div>
                {crateSummary.typeBalances.map((tb, idx) => (
                  <div key={idx} className="font-bold text-slate-950 print:text-black">
                    {tb.crateName}: {tb.issued} Out ({tb.balance} Bal)
                  </div>
                ))}
              </div>
            </div>
            <div className="text-right">
              <div>DATE: <strong>{formatDate(getTodayIso())}</strong></div>
              {(filterStartDate || filterEndDate) ? (
                <div className="text-[11px]">
                  Period: {filterStartDate ? formatDate(filterStartDate) : 'Opening'} to {filterEndDate ? formatDate(filterEndDate) : 'Today'}
                </div>
              ) : (
                <div className="text-[11px]">Period: Complete Statement</div>
              )}
              <div className="mt-1 font-bold">
                Closing Balance: <strong>{formatCurrency(ledger.closingBalance)}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Short Table: ONLY Sale Proceeds & Document Number, with single line Qty, Weight and Total */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse bg-white">
            <thead>
              <tr className="border-b border-black bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-800">
                <th className="px-5 py-3 w-32 border-b border-black">Date</th>
                <th className="px-5 py-3 border-b border-black">Particulars / Transaction</th>
                <th className="px-5 py-3 text-right w-36 border-b border-black">Debit (Dr)</th>
                <th className="px-5 py-3 text-right w-36 border-b border-black">Credit (Cr)</th>
                <th className="px-5 py-3 text-right w-44 border-b border-black">Balance (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-xs text-slate-500">
                    No transactions found in this period.
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  const rawNo = entry.referenceNo || entry.particulars || '';
                  const numMatch = rawNo.match(/\d+/);
                  const formattedNo = numMatch ? numMatch[0].padStart(3, '0') : '001';
                  const details = getSaleProceedsDetails(entry);

                  return (
                    <tr key={`short-${entry.id}`} className={isOb ? 'bg-amber-50/30 font-medium' : ''}>
                      <td className="px-5 py-2.5 font-mono text-xs text-slate-700 whitespace-nowrap align-top">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-5 py-2.5 text-slate-900 align-top">
                        {isOb ? (
                          <div className="font-bold text-sm">Opening Balance</div>
                        ) : (
                          <div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-sm text-slate-950">Sale Proceeds</div>
                              <div className="font-bold text-sm text-slate-950">No. {formattedNo}</div>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-800 print:text-black whitespace-nowrap mt-0.5">
                              <span>Qty: {details.qty}</span>
                              <span className="mx-1.5 opacity-60">|</span>
                              <span>Weight: {details.weight > 0 ? `${details.weight} Kg` : '0 Kg'}</span>
                              <span className="mx-1.5 opacity-60">|</span>
                              <span>Total: {formatCurrency(details.total)}</span>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs sm:text-sm text-rose-600 align-top">
                        {entry.debit !== null ? formatCurrency(entry.debit) : ''}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs sm:text-sm text-emerald-600 font-medium align-top">
                        {entry.credit !== null ? formatCurrency(entry.credit) : ''}
                      </td>
                      <td className="px-5 py-2.5 text-right font-mono text-xs sm:text-sm font-bold text-slate-900 align-top">
                        {formatCurrency(entry.balance)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-black bg-slate-50 font-bold">
                <td colSpan={2} className="px-5 py-3 text-xs uppercase tracking-wider text-slate-700">
                  Total & Closing Balance
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm text-rose-600">
                  {ledger.totalDebit > 0 ? formatCurrency(ledger.totalDebit) : ''}
                </td>
                <td className="px-5 py-3 text-right font-mono text-sm text-emerald-600">
                  {ledger.totalCredit > 0 ? formatCurrency(ledger.totalCredit) : ''}
                </td>
                <td className="px-5 py-3 text-right font-mono text-base text-emerald-700 font-black">
                  {formatCurrency(ledger.closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Short Print Bottom Crate & Balance Banner */}
        <div className="flex items-center justify-between border-t border-black bg-slate-50 px-6 py-3">
          <div className="text-xs">
            <div className="font-bold text-slate-950 print:text-black">
              Balance Crate: {crateSummary.balanceCrate}
            </div>
            {crateSummary.typeBalances.map((tb, idx) => (
              <div key={idx} className="font-bold text-slate-950 print:text-black">
                {tb.crateName}: {tb.issued} Out ({tb.balance} Bal)
              </div>
            ))}
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Closing Balance:
            </span>{' '}
            <span className="font-mono text-base font-black text-slate-950">
              {formatCurrency(ledger.closingBalance)}
            </span>
          </div>
        </div>

        {/* Software attribution & Signatory */}
        <div className="p-3 bg-white border-t border-slate-200 print:border-black flex justify-between items-center text-xs">
          <div className="text-[8px] sm:text-[8.5px] text-left text-slate-500 print:text-black font-mono">
            Software Developed by: {defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="hidden print:block text-right font-bold uppercase text-[11px]">
            {formatCompanySignature(defaultProfile)}
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
