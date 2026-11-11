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

      {/* Short Print Layout for Sale Proceeds Ledger (Cloned & printed via Short Print button) */}
      <div
        id="sale-proceeds-short-print-area"
        data-theme-isolated="true"
        className="hidden rounded-xl border border-black bg-white text-black print-bill-canvas max-w-[760px] w-full mx-auto"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Customer on Left, Account Detail on Right */}
        <div className="p-4 sm:p-5 border-b-2 border-black">
          <div className="flex justify-between items-start gap-4">
            {/* Top-Left: Prominent Customer Name & Location */}
            <div className="max-w-[65%]">
              <div className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight leading-tight">
                {selectedCustomer ? (
                  <>
                    <span className="text-xs sm:text-sm font-bold text-slate-600 block mb-0.5">M/s.</span>
                    {selectedCustomer.name}
                  </>
                ) : (
                  'All Customers / Mandi Sale Consignment Proceeds'
                )}
              </div>
              {selectedCustomer?.city && (
                <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1 uppercase tracking-wide">
                  {selectedCustomer.city}{selectedCustomer.state ? `, ${selectedCustomer.state}` : ''}
                </div>
              )}
              {selectedCustomer?.address && !selectedCustomer?.city && (
                <div className="text-xs sm:text-sm font-medium text-slate-700 mt-0.5">
                  {selectedCustomer.address}
                </div>
              )}
              {selectedCustomer?.mobile && (
                <div className="text-xs font-mono text-slate-700 mt-0.5">
                  Contact: {selectedCustomer.mobile}
                </div>
              )}
              {!selectedCustomer && (
                <div className="text-xs text-slate-600 mt-0.5">
                  {currentProfile.name}{currentProfile.city ? ` · ${currentProfile.city}` : ''}
                </div>
              )}
            </div>

            {/* Top-Right: Account Detail & Date Range */}
            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-black uppercase tracking-wider text-black">
                Account Detail
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1">
                {filterStartDate && filterEndDate ? (
                  <span>{formatDate(filterStartDate)} to {formatDate(filterEndDate)}</span>
                ) : filterStartDate ? (
                  <span>From {formatDate(filterStartDate)} to Today</span>
                ) : filterEndDate ? (
                  <span>Up to {formatDate(filterEndDate)}</span>
                ) : (
                  <span>Date: Up to {formatDate(getTodayIso())}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Report Date: {formatDate(getTodayIso())}
              </div>
            </div>
          </div>
        </div>

        {/* Short Ledger Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse bg-white">
            <thead>
              <tr className="border-b-2 border-black bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-black">
                <th className="py-2 px-3 w-24 text-left border-b border-black">DATE</th>
                <th className="py-2 px-3 text-left border-b border-black">PARTICULARS</th>
                <th className="py-2 px-3 text-right w-28 sm:w-32 border-b border-black">DEBIT</th>
                <th className="py-2 px-3 text-right w-28 sm:w-32 border-b border-black">CREDIT</th>
                <th className="py-2 px-3 text-right w-32 sm:w-36 border-b border-black">BALANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-xs text-slate-500">
                    No transactions found in this period.
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  const sp = entry.referenceId ? saleProceedsMap.get(entry.referenceId) : undefined;
                  const rawNo = entry.referenceNo || entry.particulars || '';
                  const numMatch = rawNo.match(/\d+/);
                  const formattedNo = numMatch ? numMatch[0].padStart(3, '0') : '001';
                  const details = getSaleProceedsDetails(entry);

                  // Extract item and crate summary for compact 1-line representation
                  const items = (sp?.items && sp.items.length > 0 ? sp.items : (entry.subDetails?.items || [])) as any[];
                  const firstItem = items[0];
                  const crateTypesInEntry = Array.from(new Set(items.map((it: any) => it.crateName).filter(Boolean)));
                  const crateTypeLabel = crateTypesInEntry.length > 0 ? crateTypesInEntry.join(', ') : '';

                  // Build compact 1-line description
                  let compactParticulars: React.ReactNode;
                  if (isOb) {
                    compactParticulars = (
                      <span className="font-bold text-xs text-black uppercase">
                        {entry.particulars || 'Opening Balance'}
                      </span>
                    );
                  } else if (entry.referenceType === 'Sale Proceeds' || sp) {
                    const itemName = firstItem ? (firstItem.fruitName || firstItem.name || '') : '';
                    const itemUnit = firstItem ? (firstItem.unit || 'Box') : 'Box';
                    compactParticulars = (
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs leading-tight">
                        <span className="font-bold text-black whitespace-nowrap">
                          Sale Proceed No. {formattedNo}
                        </span>
                        {itemName && (
                          <span className="font-semibold text-slate-900 uppercase">
                            · {itemName}
                            {items.length > 1 ? ` (+${items.length - 1})` : ''}
                          </span>
                        )}
                        {details.qty > 0 && (
                          <span className="font-mono text-slate-800">
                            · Qty: {details.qty} {itemUnit}
                          </span>
                        )}
                        {details.weight > 0 && (
                          <span className="font-mono text-slate-800">
                            ({details.weight} KG)
                          </span>
                        )}
                        {crateTypeLabel && (
                          <span className="text-slate-700">
                            · [{crateTypeLabel}]
                          </span>
                        )}
                        {sp?.billNumber && (
                          <span className="text-[10.5px] font-mono text-slate-500">
                            · Bill: {sp.billNumber}
                          </span>
                        )}
                      </div>
                    );
                  } else {
                    // Other entries (e.g. Crate Receipt or payment adjustments)
                    compactParticulars = (
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs leading-tight">
                        <span className="font-bold text-black">
                          {entry.particulars}
                        </span>
                        {entry.subDetails?.qty && (
                          <span className="font-mono text-slate-800">
                            · Qty: {entry.subDetails.qty}
                          </span>
                        )}
                      </div>
                    );
                  }

                  return (
                    <tr key={`short-acc-${entry.id}`} className="border-b border-slate-300">
                      {/* DATE */}
                      <td className="py-1.5 px-3 font-mono text-xs text-black align-middle whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>

                      {/* PARTICULARS (One compact line) */}
                      <td className="py-1.5 px-3 text-black align-middle">
                        {compactParticulars}
                      </td>

                      {/* DEBIT */}
                      <td className="py-1.5 px-3 text-right font-mono text-xs sm:text-sm text-black align-middle whitespace-nowrap">
                        {entry.debit !== null && entry.debit !== undefined && entry.debit > 0
                          ? formatCurrency(entry.debit)
                          : ''}
                      </td>

                      {/* CREDIT */}
                      <td className="py-1.5 px-3 text-right font-mono text-xs sm:text-sm text-black font-medium align-middle whitespace-nowrap">
                        {entry.credit !== null && entry.credit !== undefined && entry.credit > 0
                          ? formatCurrency(entry.credit)
                          : ''}
                      </td>

                      {/* BALANCE */}
                      <td className="py-1.5 px-3 text-right font-mono text-xs sm:text-sm font-bold text-black align-middle whitespace-nowrap">
                        {formatCurrency(Math.abs(entry.balance))}{' '}
                        <span className="text-[10px] font-semibold text-slate-600">
                          {entry.balance > 0 ? 'Cr' : entry.balance < 0 ? 'Dr' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              {/* Total Row aligned under respective columns */}
              <tr className="border-t-2 border-b-2 border-black font-bold text-xs uppercase bg-slate-50">
                <td colSpan={2} className="py-2 px-3 text-right font-bold text-black">
                  Total:
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs sm:text-sm font-bold text-black whitespace-nowrap">
                  {ledger.totalDebit > 0 ? formatCurrency(ledger.totalDebit) : ''}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs sm:text-sm font-bold text-black whitespace-nowrap">
                  {ledger.totalCredit > 0 ? formatCurrency(ledger.totalCredit) : ''}
                </td>
                <td className="py-2 px-3 text-right font-mono text-xs sm:text-sm font-extrabold text-black whitespace-nowrap">
                  {formatCurrency(Math.abs(ledger.closingBalance))}{' '}
                  <span className="text-[10px] font-bold">
                    {ledger.closingBalance > 0 ? 'Cr' : ledger.closingBalance < 0 ? 'Dr' : ''}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Summary: Crate Balance on Left, Prominent Closing Balance toward Right */}
        <div className="p-4 border-t-2 border-black flex flex-wrap justify-between items-start gap-4 bg-slate-50/50">
          {/* Crate Balance Information on the bottom-left */}
          <div className="text-xs space-y-1">
            <div className="font-bold text-sm text-black">
              Balance Crate: <span className="font-mono">{crateSummary.balanceCrate}</span>
            </div>
            {crateSummary.typeBalances.map((tb, idx) => (
              <div key={idx} className="font-medium text-slate-800">
                <span className="font-semibold">{tb.crateName}:</span> {tb.issued} Out ({tb.balance} Bal)
              </div>
            ))}
          </div>

          {/* CLOSING BALANCE prominently displayed toward the bottom-right */}
          <div className="text-right">
            <div className="text-xs uppercase font-bold tracking-wider text-slate-600">
              Closing Balance
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-black mt-0.5">
              {formatCurrency(Math.abs(ledger.closingBalance))}{' '}
              <span className="text-sm font-bold">
                {ledger.closingBalance > 0 ? 'Cr' : ledger.closingBalance < 0 ? 'Dr' : ''}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5">
              {ledger.closingBalance > 0
                ? 'Net Payable (Credit)'
                : ledger.closingBalance < 0
                ? 'Net Receivable (Debit)'
                : 'Account Cleared'}
            </div>
          </div>
        </div>

        {/* Software attribution & Signatory */}
        <div className="px-4 pb-4 pt-6 flex justify-between items-end text-xs border-t border-dashed border-slate-300">
          <div className="text-[9px] text-slate-500 font-mono">
            Software Developed by: {defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="text-right font-bold uppercase text-[11px] text-black">
            {formatCompanySignature(defaultProfile)}
          </div>
        </div>
      </div>

      {/* Printable Account Detail Statement Layout for Sale Proceeds Ledger (Full Print Ledger format) */}
      <div
        id="sale-proceeds-print-area"
        data-theme-isolated="true"
        className="hidden rounded-xl border border-black bg-white text-black print-bill-canvas max-w-[760px] w-full mx-auto"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Customer on Left, Account Detail on Right */}
        <div className="p-4 sm:p-5 border-b-2 border-black">
          <div className="flex justify-between items-start gap-4">
            {/* Top-Left: Prominent Customer Name & Location */}
            <div className="max-w-[65%]">
              <div className="text-xl sm:text-2xl font-black text-black uppercase tracking-tight leading-tight">
                {selectedCustomer ? (
                  <>
                    <span className="text-xs sm:text-sm font-bold text-slate-600 block mb-0.5">M/s.</span>
                    {selectedCustomer.name}
                  </>
                ) : (
                  'All Customers / Mandi Sale Consignment Proceeds'
                )}
              </div>
              {selectedCustomer?.city && (
                <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1 uppercase tracking-wide">
                  {selectedCustomer.city}{selectedCustomer.state ? `, ${selectedCustomer.state}` : ''}
                </div>
              )}
              {selectedCustomer?.address && !selectedCustomer?.city && (
                <div className="text-xs sm:text-sm font-medium text-slate-700 mt-0.5">
                  {selectedCustomer.address}
                </div>
              )}
              {selectedCustomer?.mobile && (
                <div className="text-xs font-mono text-slate-700 mt-0.5">
                  Contact: {selectedCustomer.mobile}
                </div>
              )}
              {!selectedCustomer && (
                <div className="text-xs text-slate-600 mt-0.5">
                  {currentProfile.name}{currentProfile.city ? ` · ${currentProfile.city}` : ''}
                </div>
              )}
            </div>

            {/* Top-Right: Account Detail & Date Range */}
            <div className="text-right shrink-0">
              <div className="text-xl sm:text-2xl font-black uppercase tracking-wider text-black">
                Account Detail
              </div>
              <div className="text-xs sm:text-sm font-semibold text-slate-800 mt-1">
                {filterStartDate && filterEndDate ? (
                  <span>{formatDate(filterStartDate)} to {formatDate(filterEndDate)}</span>
                ) : filterStartDate ? (
                  <span>From {formatDate(filterStartDate)} to Today</span>
                ) : filterEndDate ? (
                  <span>Up to {formatDate(filterEndDate)}</span>
                ) : (
                  <span>Date: Up to {formatDate(getTodayIso())}</span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                Report Date: {formatDate(getTodayIso())}
              </div>
            </div>
          </div>
        </div>

        {/* Ledger Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse bg-white">
            <thead>
              <tr className="border-b-2 border-black bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-black">
                <th className="py-2.5 px-3 w-24 text-left border-b border-black">DATE</th>
                <th className="py-2.5 px-3 text-left border-b border-black">PARTICULARS</th>
                <th className="py-2.5 px-3 text-right w-28 sm:w-32 border-b border-black">DEBIT</th>
                <th className="py-2.5 px-3 text-right w-28 sm:w-32 border-b border-black">CREDIT</th>
                <th className="py-2.5 px-3 text-right w-32 sm:w-36 border-b border-black">BALANCE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-xs text-slate-500">
                    No transactions found in this period.
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  const sp = entry.referenceId ? saleProceedsMap.get(entry.referenceId) : undefined;
                  const rawNo = entry.referenceNo || entry.particulars || '';
                  const numMatch = rawNo.match(/\d+/);
                  const formattedNo = numMatch ? numMatch[0].padStart(3, '0') : '001';

                  const items = sp?.items && sp.items.length > 0
                    ? sp.items
                    : (entry.subDetails?.items || []);

                  const expenses = sp?.expenses && sp.expenses.length > 0
                    ? sp.expenses
                    : (entry.subDetails?.expenses || []);

                  const topWeight = sp?.weight !== undefined && sp.weight !== null ? sp.weight : sp?.kg;

                  return (
                    <tr key={`print-full-${entry.id}`} className="border-b border-slate-300">
                      {/* DATE */}
                      <td className="py-2.5 px-3 font-mono text-xs text-black align-top whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>

                      {/* PARTICULARS */}
                      <td className="py-2.5 px-3 text-black align-top">
                        {isOb ? (
                          <div className="font-bold text-xs sm:text-sm text-black uppercase">
                            {entry.particulars || 'Opening Balance'}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {/* Bill number & Transaction Type */}
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-xs sm:text-sm text-black">
                                Sale Proceed No. {formattedNo}
                              </span>
                              {sp?.billNumber && (
                                <span className="text-[11px] font-mono text-slate-700">
                                  (Bill: {sp.billNumber})
                                </span>
                              )}
                              {sp?.challanDate && sp.challanDate !== sp.date && (
                                <span className="text-[11px] text-slate-600">
                                  Challan Dt: {formatDate(sp.challanDate)}
                                </span>
                              )}
                            </div>

                            {/* Item details: Fruit name, Qty, Unit, Weight KG, Crate, Rate, Amount */}
                            {items.length > 0 ? (
                              <div className="text-xs space-y-0.5 text-slate-800">
                                {items.map((it: any, iIdx: number) => {
                                  const itQty = it.quantity ?? it.qty ?? 0;
                                  const itUnit = it.unit || 'Box';
                                  const itWeight = it.weight ?? it.kg ?? (items.length === 1 && topWeight ? topWeight : undefined);
                                  const itRate = it.rate ?? 0;
                                  const itAmount = it.amount ?? (itQty * itRate);

                                  return (
                                    <div key={iIdx} className="flex flex-wrap items-center gap-x-2 text-[11.5px] leading-snug">
                                      <span className="font-semibold text-black uppercase">
                                        {it.fruitName || it.name || 'Item'}
                                      </span>
                                      <span>·</span>
                                      <span className="font-mono">
                                        {itQty} {itUnit}
                                      </span>
                                      {itWeight !== undefined && Number(itWeight) > 0 && (
                                        <>
                                          <span>·</span>
                                          <span className="font-mono">{itWeight} KG</span>
                                        </>
                                      )}
                                      {it.crateName && (
                                        <>
                                          <span>·</span>
                                          <span className="text-slate-600">[{it.crateName}]</span>
                                        </>
                                      )}
                                      <span>·</span>
                                      <span className="font-mono">
                                        @ ₹{Number(itRate).toLocaleString('en-IN')}
                                      </span>
                                      {itAmount > 0 && (
                                        <>
                                          <span>=</span>
                                          <span className="font-mono font-semibold">
                                            ₹{Number(itAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="text-xs text-slate-700 font-mono">
                                Qty: {sp?.quantity ?? entry.subDetails?.qty ?? 0}
                                {topWeight ? ` · ${topWeight} KG` : ''}
                                {sp?.rate ? ` @ ₹${sp.rate}` : ''}
                              </div>
                            )}

                            {/* Expenses Breakdown */}
                            {expenses.length > 0 && (
                              <div className="text-[11px] text-slate-700 mt-0.5 pt-0.5 border-t border-dashed border-slate-300">
                                <span className="font-semibold text-black">Expenses:</span>{' '}
                                {expenses.map((e: any) => `${e.name} ₹${Number(e.amount).toLocaleString('en-IN')}`).join(' + ')}
                                {sp?.totalExpense ? ` = ₹${Number(sp.totalExpense).toLocaleString('en-IN')}` : ''}
                              </div>
                            )}

                            {/* Optional Notes */}
                            {entry.notes && (
                              <div className="text-[10.5px] text-slate-600 italic">
                                Note: {entry.notes}
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* DEBIT */}
                      <td className="py-2.5 px-3 text-right font-mono text-xs sm:text-sm text-black align-top whitespace-nowrap">
                        {entry.debit !== null && entry.debit !== undefined && entry.debit > 0
                          ? formatCurrency(entry.debit)
                          : ''}
                      </td>

                      {/* CREDIT */}
                      <td className="py-2.5 px-3 text-right font-mono text-xs sm:text-sm text-black font-medium align-top whitespace-nowrap">
                        {entry.credit !== null && entry.credit !== undefined && entry.credit > 0
                          ? formatCurrency(entry.credit)
                          : ''}
                      </td>

                      {/* BALANCE */}
                      <td className="py-2.5 px-3 text-right font-mono text-xs sm:text-sm font-bold text-black align-top whitespace-nowrap">
                        {formatCurrency(Math.abs(entry.balance))}{' '}
                        <span className="text-[10px] font-semibold text-slate-600">
                          {entry.balance > 0 ? 'Cr' : entry.balance < 0 ? 'Dr' : ''}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              {/* Total Row */}
              <tr className="border-t-2 border-b-2 border-black font-bold text-xs uppercase bg-slate-50">
                <td colSpan={2} className="py-2.5 px-3 text-right font-bold text-black">
                  Total:
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-xs sm:text-sm font-bold text-black whitespace-nowrap">
                  {ledger.totalDebit > 0 ? formatCurrency(ledger.totalDebit) : ''}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-xs sm:text-sm font-bold text-black whitespace-nowrap">
                  {ledger.totalCredit > 0 ? formatCurrency(ledger.totalCredit) : ''}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-xs sm:text-sm font-extrabold text-black whitespace-nowrap">
                  {formatCurrency(Math.abs(ledger.closingBalance))}{' '}
                  <span className="text-[10px] font-bold">
                    {ledger.closingBalance > 0 ? 'Cr' : ledger.closingBalance < 0 ? 'Dr' : ''}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Summary: Crate Balance on Left, Prominent Closing Balance on Right */}
        <div className="p-4 border-t-2 border-black flex flex-wrap justify-between items-start gap-4 bg-slate-50/50">
          {/* Crate Balance Information */}
          <div className="text-xs space-y-1">
            <div className="font-bold text-sm text-black">
              Balance Crate: <span className="font-mono">{crateSummary.balanceCrate}</span>
            </div>
            {crateSummary.typeBalances.map((tb, idx) => (
              <div key={idx} className="font-medium text-slate-800">
                <span className="font-semibold">{tb.crateName}:</span> {tb.issued} Out ({tb.balance} Bal)
              </div>
            ))}
          </div>

          {/* Prominent Closing Balance with Dr/Cr */}
          <div className="text-right">
            <div className="text-xs uppercase font-bold tracking-wider text-slate-600">
              Closing Balance
            </div>
            <div className="text-xl sm:text-2xl font-black font-mono text-black mt-0.5">
              {formatCurrency(Math.abs(ledger.closingBalance))}{' '}
              <span className="text-sm font-bold">
                {ledger.closingBalance > 0 ? 'Cr' : ledger.closingBalance < 0 ? 'Dr' : ''}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 font-medium mt-0.5">
              {ledger.closingBalance > 0
                ? 'Net Payable (Credit)'
                : ledger.closingBalance < 0
                ? 'Net Receivable (Debit)'
                : 'Account Cleared'}
            </div>
          </div>
        </div>

        {/* Signatory & Software Developed By */}
        <div className="px-4 pb-4 pt-6 flex justify-between items-end text-xs border-t border-dashed border-slate-300">
          <div className="text-[9px] text-slate-500 font-mono">
            Software Developed by: {defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="text-right font-bold uppercase text-[11px] text-black">
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
