import React, { useState, useMemo, useEffect } from 'react';
import { db } from '../../services/db';
import { getSaleProceedsLedger, getCustomerCrateStatement } from '../../services/accounting';
import { formatCurrency, formatDate, toIsoDate, getTodayIso, formatCompanySignature } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import { Customer, LedgerEntry, SaleProceeds, SaleProceedsOpeningBalance } from '../../types';
import { SaleProceedsModal } from './SaleProceedsModal';
import { SearchCustomerModal } from '../modals/SearchCustomerModal';
import { CustomerAvatar, getCustomerInitials } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import {
  customerHasType,
  getEffectiveCustomerTypes,
  getCustomerTypeMeta,
} from '../../utils/customerTypeUtils';
import {
  Edit2,
  Download,
  Printer,
  Filter,
  Calendar,
  Building2,
  Search,
  X,
  Users,
  Phone,
  MapPin,
  CreditCard,
  Box,
  Wallet,
} from 'lucide-react';
import { exportSaleProceedsLedger, exportSaleProceedsCustomerLedger } from '../../utils/excelEngine';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { QuantityInput } from '../common/QuantityInput';
import { formatSaleProceedShortParticulars, sanitizeOpeningBalanceLabel, stripLedgerCrateInOut } from '../../utils/shortPrintUtils';

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

  useEffect(() => {
    if (initialCustomerId !== undefined) {
      setSelectedCustomerId(initialCustomerId || '');
    }
  }, [initialCustomerId]);

  useEffect(() => {
    return db.subscribe(() => setRefreshKey((k) => k + 1));
  }, []);

  const allCustomers = useMemo(() => db.getCustomers(), [refreshKey]);
  const saleProceedsCustomers = useMemo(
    () => allCustomers.filter((c) => customerHasType(c, 'sale_proceeds')),
    [allCustomers]
  );
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
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500 bg-emerald-50/70 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/80 dark:bg-emerald-950/60 dark:text-emerald-200 dark:hover:bg-emerald-900/70 cursor-pointer shadow-2xs transition-colors"
            title="Search and filter by customer"
          >
            <Search className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Search Customer</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEditObOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-slate-600 cursor-pointer transition-colors"
          >
            <Edit2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Opening Balance
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
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-slate-600 cursor-pointer shadow-2xs transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-slate-600 cursor-pointer transition-colors"
          >
            <Download className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" /> CSV
          </button>
          <div className="flex items-center gap-1.5 no-print">
            <Building2 className="h-3.5 w-3.5 text-slate-500 dark:text-slate-300" />
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
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
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-emerald-600 dark:text-white dark:hover:bg-emerald-500 shadow-xs cursor-pointer transition-colors"
            title="Print full Sale Proceeds ledger"
          >
            <Printer className="h-3.5 w-3.5" /> Print Ledger
          </button>
          <button
            type="button"
            onClick={handleShortPrint}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 dark:hover:border-slate-600 cursor-pointer shadow-2xs transition-colors"
            title="Short Print: document number and sale proceeds only"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Short Print
          </button>
        </div>
      </div>

      {/* Date & Customer Filter Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="flex flex-wrap items-end gap-3">
          {/* Sale Proceeds Customer Autocomplete */}
          <div className="w-full sm:w-64">
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-200">
              Sale Proceeds Customer
            </label>
            <CustomerAutocomplete
              valueCustomerId={selectedCustomerId}
              customerType="sale_proceeds"
              onChange={(cust) => setSelectedCustomerId(cust ? cust.id : '')}
              placeholder="Select Sale Proceeds customer..."
            />
          </div>

          {/* Prominent Search Customer Button */}
          <div>
            <button
              type="button"
              onClick={() => setIsSearchCustomerOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500 cursor-pointer transition-all"
            >
              <Search className="h-4 w-4" />
              <span>Search Customer</span>
            </button>
          </div>

          {/* All Customers / Clear Search button when filtered */}
          {selectedCustomerId ? (
            <button
              type="button"
              onClick={() => setSelectedCustomerId('')}
              className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer shadow-2xs transition-colors"
            >
              <X className="h-3.5 w-3.5 text-rose-500" />
              <span>All Customers</span>
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 erp-dark-panel px-3 py-2 text-xs font-medium text-slate-700">
              <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
              <span>All Customers ({saleProceedsCustomers.length} profiles)</span>
            </div>
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
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer transition-colors"
            >
              Clear Dates
            </button>
          )}

          {/* Crate Balance Quick Summary on screen */}
          <div className="sm:ml-auto rounded-lg border border-slate-200 bg-slate-50/80 erp-dark-panel px-3 py-1.5 text-xs">
            <div className="font-bold text-slate-900 dark:text-white">
              Balance Crate: <span className="text-emerald-700 dark:text-emerald-300">{crateSummary.balanceCrate}</span>
            </div>
            {crateSummary.typeBalances.map((tb, idx) => (
              <div key={idx} className="font-semibold text-slate-700 dark:text-slate-200">
                {tb.crateName}: {tb.issued} ({tb.balance} Bal)
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sale Proceeds Customer Profile Card (Isolated from Credit Sale Customer Ledger) */}
      {selectedCustomer ? (() => {
        const custTypes = getEffectiveCustomerTypes(selectedCustomer);
        const hasSpOb =
          selectedCustomer.saleProceedsOpeningBalance !== undefined &&
          selectedCustomer.saleProceedsOpeningBalance !== 0;
        const usesFallbackOb =
          !hasSpOb &&
          !customerHasType(selectedCustomer, 'credit_sale') &&
          selectedCustomer.openingBalance !== 0;
        const spObAmount = hasSpOb
          ? selectedCustomer.saleProceedsOpeningBalance || 0
          : usesFallbackOb
          ? selectedCustomer.openingBalance || 0
          : 0;
        const spObType = hasSpOb
          ? selectedCustomer.saleProceedsOpeningBalanceType || 'credit'
          : usesFallbackOb
          ? selectedCustomer.openingBalanceType || 'credit'
          : 'credit';

        return (
          <div
            id="sale-proceeds-customer-profile"
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all no-print"
          >
            {/* Top border accent line */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600" />

            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 sm:gap-6 pt-1">
              {/* Left Section: Large Photo + Customer Details */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 min-w-0 flex-1">
                <div className="relative shrink-0">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center select-none ring-4 ring-emerald-50 dark:ring-emerald-950/40">
                    {selectedCustomer.photo ? (
                      <img
                        src={selectedCustomer.photo}
                        alt={selectedCustomer.name}
                        className="w-full h-full object-cover"
                        loading="eager"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100/70 dark:from-slate-800 dark:to-emerald-950/50 text-emerald-800 dark:text-emerald-200">
                        <span className="font-mono-numbers text-3xl sm:text-4xl font-extrabold tracking-tight">
                          {getCustomerInitials(selectedCustomer.name)}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 uppercase tracking-wider mt-1">
                          No Photo
                        </span>
                      </div>
                    )}
                  </div>
                  {selectedCustomer.active && (
                    <span
                      className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs border-2 border-white dark:border-slate-900"
                      title="Active Sale Proceeds Customer"
                    >
                      Active
                    </span>
                  )}
                </div>

                {/* Customer Details Content */}
                <div className="min-w-0 space-y-2.5 flex-1">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
                        {selectedCustomer.name}
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        Sale Proceeds Customer
                      </span>
                      {custTypes
                        .filter((t) => t !== 'sale_proceeds')
                        .map((t) => {
                          const meta = getCustomerTypeMeta(t);
                          return (
                            <span
                              key={t}
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${meta.badgeClass}`}
                            >
                              {meta.shortLabel}
                            </span>
                          );
                        })}
                    </div>

                    {(selectedCustomer.notes?.trim() || selectedCustomer.description?.trim()) && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                        &ldquo;{selectedCustomer.notes?.trim() || selectedCustomer.description?.trim()}&rdquo;
                      </p>
                    )}

                    {selectedCustomer.contactPerson && selectedCustomer.contactPerson.trim() && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                        <span className="text-slate-400">Contact:</span> {selectedCustomer.contactPerson.trim()}
                      </p>
                    )}
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                    {selectedCustomer.mobile && selectedCustomer.mobile.trim() ? (
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
                          <Phone className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                            Phone / Mobile
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white font-mono-numbers text-xs sm:text-sm">
                            <a href={`tel:${selectedCustomer.mobile.trim()}`} className="hover:underline">
                              {selectedCustomer.mobile.trim()}
                            </a>
                          </span>
                          {selectedCustomer.altMobile && selectedCustomer.altMobile.trim() && (
                            <span className="text-slate-400 text-xs font-mono-numbers ml-1">
                              / {selectedCustomer.altMobile.trim()}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : selectedCustomer.altMobile && selectedCustomer.altMobile.trim() ? (
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
                          <Phone className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                            Alternate Mobile
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white font-mono-numbers text-xs sm:text-sm">
                            <a href={`tel:${selectedCustomer.altMobile.trim()}`} className="hover:underline">
                              {selectedCustomer.altMobile.trim()}
                            </a>
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {Boolean(
                      selectedCustomer.address?.trim() ||
                        selectedCustomer.city?.trim() ||
                        selectedCustomer.state?.trim()
                    ) && (
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 shrink-0">
                          <MapPin className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                            Address &amp; City
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white truncate block text-xs sm:text-sm">
                            {[
                              selectedCustomer.address?.trim(),
                              selectedCustomer.city?.trim(),
                              selectedCustomer.state?.trim(),
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </span>
                        </div>
                      </div>
                    )}

                    {selectedCustomer.aadhaarNo && selectedCustomer.aadhaarNo.trim() && (
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 shrink-0">
                          <CreditCard className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                            Aadhaar Number
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono-numbers text-xs">
                            {selectedCustomer.aadhaarNo.trim()}
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-600 shrink-0">
                        <Wallet className="h-4 w-4" />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                          Opening Balance (SP)
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono-numbers text-xs">
                          {formatCurrency(spObAmount)}
                          {spObAmount > 0 ? ` (${spObType === 'credit' ? 'Cr' : 'Dr'})` : ''}
                        </span>
                      </div>
                    </div>

                    {Boolean(selectedCustomer.openingCrateBalance) && (
                      <div className="flex items-center gap-2.5">
                        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 shrink-0">
                          <Box className="h-4 w-4" />
                        </span>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                            Opening Crate Balance
                          </span>
                          <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono-numbers text-xs">
                            {selectedCustomer.openingCrateBalance} Crates
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Top-Right Sale Proceeds Balance Card */}
              <div className="w-full lg:w-72 shrink-0 flex flex-col justify-between bg-slate-50 erp-dark-panel p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-200">
                      {filterStartDate || filterEndDate ? 'Period Balance' : 'Sale Proceeds Balance'}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        ledger.closingBalance > 0
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-[#131d31] dark:text-emerald-300 dark:border dark:border-emerald-400/50'
                          : ledger.closingBalance < 0
                          ? 'bg-rose-100 text-rose-800 dark:bg-[#131d31] dark:text-rose-300 dark:border dark:border-rose-400/50'
                          : 'bg-slate-200 text-slate-700 dark:bg-[#131d31] dark:text-slate-200 dark:border dark:border-slate-500'
                      }`}
                    >
                      {ledger.closingBalance > 0
                        ? 'Cr · Payable'
                        : ledger.closingBalance < 0
                        ? 'Dr · Receivable'
                        : 'Settled'}
                    </span>
                  </div>

                  <div
                    className={`mt-1 font-mono-numbers text-2xl sm:text-3xl font-black tracking-tight ${
                      ledger.closingBalance > 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : ledger.closingBalance < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {formatCurrency(ledger.closingBalance)}
                  </div>
                </div>

                {/* Summary totals inside balance box */}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700 text-[11px] space-y-1.5 text-slate-500 font-mono-numbers">
                  {(filterStartDate || filterEndDate) && ledger.periodOpeningBalance !== undefined && (
                    <div className="flex items-center justify-between gap-2 text-[10px]">
                      <span className="uppercase tracking-wider text-slate-400">Opening (b/f)</span>
                      <span className="font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(ledger.periodOpeningBalance)}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400">
                        Total Credit
                      </span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(ledger.totalCredit)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] uppercase tracking-wider text-slate-400">
                        Total Debit
                      </span>
                      <span className="font-bold text-rose-600 dark:text-rose-400">
                        {formatCurrency(ledger.totalDebit)}
                      </span>
                    </div>
                  </div>
                  {(filterStartDate || filterEndDate) && ledger.overallClosingBalance !== undefined && (
                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                      <span className="uppercase tracking-wider text-slate-400">All-Time Balance</span>
                      <span className="font-bold text-slate-900 dark:text-white">
                        {formatCurrency(ledger.overallClosingBalance)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })() : (
        saleProceedsCustomers.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                Sale Proceeds Customer Profiles ({saleProceedsCustomers.length})
              </span>
              <span className="text-[11px] text-slate-400">
                Click any customer to open their dedicated Sale Proceeds profile &amp; statement
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {saleProceedsCustomers.slice(0, 12).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(c.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-600 dark:hover:bg-emerald-950/50 cursor-pointer transition-colors"
                >
                  <CustomerAvatar photo={c.photo} name={c.name} size="xs" />
                  <span>{c.name}</span>
                  {c.city && (
                    <span className="text-[10px] font-normal text-slate-400">({c.city})</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* On-screen Ledger Table Container (Interactive, full dark mode and edit support) */}
      <div
        id="sale-proceeds-screen-table"
        className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse bg-white dark:bg-slate-900">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] print:text-[13.5px] font-bold print:font-extrabold uppercase tracking-wider text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <th className="px-5 py-3.5 w-32 text-slate-800 dark:text-slate-100 font-bold print:font-extrabold">Date</th>
                <th className="px-5 py-3.5 text-slate-800 dark:text-slate-100 font-bold print:font-extrabold">Particulars</th>
                <th className="px-5 py-3.5 text-right w-36 text-slate-800 dark:text-slate-100 font-bold print:font-extrabold">Debit (Dr)</th>
                <th className="px-5 py-3.5 text-right w-36 text-slate-800 dark:text-slate-100 font-bold print:font-extrabold">Credit (Cr)</th>
                <th className="px-5 py-3.5 text-right w-44 text-slate-800 dark:text-slate-100 font-bold print:font-extrabold">Balance (₹)</th>
                <th className="px-4 py-3.5 text-center w-24 text-slate-800 dark:text-slate-100 font-bold no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs print:text-[13px] print:font-bold text-slate-500 dark:text-slate-400">
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
                        isOb ? 'bg-amber-50/40 font-medium print:font-bold dark:bg-amber-950/30' : ''
                      }`}
                    >
                      <td className="px-5 py-3 font-mono-numbers text-xs print:text-[13px] print:font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-5 py-3 text-slate-900 dark:text-slate-100">
                        <div className={`font-semibold print:font-bold text-xs sm:text-sm print:text-[13px] ${isOb ? 'text-amber-900 dark:text-amber-300 font-bold' : 'text-slate-900 dark:text-slate-100'}`}>
                          <span className="print:hidden">{entry.particulars}</span>
                          <span className="hidden print:inline">{stripLedgerCrateInOut(entry.particulars) || entry.particulars}</span>
                        </div>
                        {!isOb && (
                          <div className="text-[11px] print:text-[13px] font-semibold print:font-bold text-slate-700 dark:text-slate-300 print:text-black mt-0.5 whitespace-nowrap">
                            <span>Qty: {details.qty}</span>
                            <span className="mx-1.5 opacity-60">|</span>
                            <span>Weight: {details.weight > 0 ? `${details.weight} Kg` : '0 Kg'}</span>
                            <span className="mx-1.5 opacity-60">|</span>
                            <span>Total: {formatCurrency(details.total)}</span>
                          </div>
                        )}
                      </td>
                      {/* Debit cell - blank if null */}
                      <td className="px-5 py-3 text-right font-mono-numbers text-xs sm:text-sm print:text-[13px] text-rose-600 dark:text-rose-400 font-semibold print:font-bold whitespace-nowrap">
                        {entry.debit !== null ? formatCurrency(entry.debit) : ''}
                      </td>
                      {/* Credit cell - blank if null */}
                      <td className="px-5 py-3 text-right font-mono-numbers text-xs sm:text-sm print:text-[13px] text-emerald-600 dark:text-emerald-400 font-semibold print:font-bold whitespace-nowrap">
                        {entry.credit !== null ? formatCurrency(entry.credit) : ''}
                      </td>
                      {/* Balance cell */}
                      <td className="px-5 py-3 text-right font-mono-numbers text-xs sm:text-sm print:text-[13px] font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {formatCurrency(entry.balance)}
                      </td>
                      <td className="px-4 py-3 text-center no-print whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleEditEntry(entry)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-emerald-500 dark:hover:text-emerald-400 dark:hover:bg-slate-700 transition-colors cursor-pointer"
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
              <tr className="border-t-2 border-slate-300 bg-slate-100 font-bold print:font-extrabold dark:border-slate-700 dark:bg-slate-800">
                <td colSpan={2} className="px-5 py-3.5 text-xs print:text-[13.5px] uppercase tracking-wider text-slate-800 dark:text-slate-100">
                  Total & Closing Balance
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-sm print:text-[13.5px] text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {ledger.totalDebit > 0 ? formatCurrency(ledger.totalDebit) : ''}
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-sm print:text-[13.5px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {ledger.totalCredit > 0 ? formatCurrency(ledger.totalCredit) : ''}
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-base print:text-[15px] text-emerald-700 dark:text-emerald-300 font-extrabold print:font-black whitespace-nowrap">
                  {formatCurrency(ledger.closingBalance)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Closing Balance Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-emerald-50/70 erp-dark-panel px-6 py-4">
          <div>
            <div className="text-xs font-medium text-emerald-950 dark:text-emerald-100">
              {selectedCustomer ? (
                <span>Sale Proceeds Ledger Balance for <strong className="text-emerald-950 dark:text-white">{selectedCustomer.name}</strong></span>
              ) : (
                <span>Current Account Balance for <strong className="text-emerald-950 dark:text-white">HariKripa Fruit Company</strong></span>
              )}
            </div>
            {/* Crate Balance Information */}
            <div className="mt-2 text-xs">
              <div className="font-bold text-slate-900 dark:text-white print:text-black">
                Balance Crate: {crateSummary.balanceCrate}
              </div>
              {crateSummary.typeBalances.map((tb, idx) => (
                <div key={idx} className="font-bold text-slate-800 dark:text-slate-200 print:text-black">
                  {tb.crateName}: {tb.issued}<span className="print:hidden"> Out</span> ({tb.balance} Bal)
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-3 sm:mt-0">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-950 dark:text-emerald-200">
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
        data-dynamic-page-numbers="true"
        className="hidden bg-white text-black print-bill-canvas sp-ledger-uniform-font max-w-[760px] w-full mx-auto pt-1.5 print:pt-1 px-3 pb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Centered Company Header, then Customer on Left & ACCOUNT DETAILS on Right */}
        <div className="pb-1.5 mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger-centered" />
          <div className="flex justify-between items-end gap-4 pt-1">
            {/* Top-Left: M/s: Customer Name only */}
            <div className="max-w-[65%]">
              {resolvedPrintCustomer ? (
                <div className="sp-ledger-party-name text-[17px] font-extrabold text-black uppercase tracking-tight leading-tight">
                  M/s: {resolvedPrintCustomer.name || 'Customer'}
                </div>
              ) : (
                <div className="sp-ledger-party-name text-[17px] font-extrabold text-black uppercase tracking-tight leading-tight">
                  ALL CUSTOMERS
                </div>
              )}
            </div>

            {/* Top-Right: ACCOUNT DETAILS & Date Range */}
            <div className="text-right shrink-0">
              <div className="sp-ledger-account-heading text-[16px] font-black uppercase tracking-wider text-black leading-tight">
                ACCOUNT DETAILS
              </div>
              <div className="sp-ledger-date-range text-[13px] font-bold text-black mt-0.5">
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
            </div>
          </div>
        </div>

        {/* Short Print Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
        <div className="overflow-x-auto">
          <table className="sp-short-table w-full table-fixed box-border text-left text-[13px] border-collapse bg-white text-black">
            <colgroup>
              <col style={{ width: '94px' }} />
              <col />
              <col style={{ width: '104px' }} />
              <col style={{ width: '104px' }} />
              <col style={{ width: '116px' }} />
            </colgroup>
            <thead>
              <tr className="sp-short-col-header border-t border-b border-black bg-white text-[13.5px] font-extrabold uppercase tracking-wider text-black">
                <th className="py-2 px-2 text-left whitespace-nowrap box-border">DATE</th>
                <th className="py-2 px-2.5 text-left box-border">PARTICULARS</th>
                <th className="py-2 px-2 text-right whitespace-nowrap box-border">DEBIT</th>
                <th className="py-2 px-2 text-right whitespace-nowrap box-border">CREDIT</th>
                <th className="py-2 px-2 text-right whitespace-nowrap box-border">BALANCE</th>
              </tr>
            </thead>
            <tbody className="bg-white text-black">
              {ledger.entries.length === 0 ? (
                <tr className="bg-white">
                  <td colSpan={5} className="py-6 text-center text-[13px] font-bold text-black">
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
                  const cleanPrimaryRef = stripLedgerCrateInOut(shortInfo.primaryRef);
                  const cleanAccountRef = stripLedgerCrateInOut(shortInfo.accountRef);

                  const debitVal = entry.debit !== null && entry.debit !== undefined && entry.debit > 0 ? Number(entry.debit).toFixed(2) : '';
                  const creditVal = entry.credit !== null && entry.credit !== undefined && entry.credit > 0 ? Number(entry.credit).toFixed(2) : '';
                  const balanceVal = entry.balance < 0 ? `(${Math.abs(entry.balance).toFixed(2)})` : Number(entry.balance).toFixed(2);
                  const isShaded = idx % 2 === 0;

                  return (
                    <tr
                      key={`short-acc-${entry.id}`}
                      className={`ledger-tx-row ${isShaded ? 'sp-zebra-even bg-[#eaedf1]' : 'sp-zebra-odd bg-white'}`}
                    >
                      <td className="py-1.5 px-2 text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums">
                        {formatDate(entry.date)}
                      </td>
                      <td className="py-1.5 px-2.5 text-[13px] font-bold text-black align-top">
                        {isOb ? (
                          <span className="font-bold text-[13px] text-black uppercase">
                            {cleanPrimaryRef || 'Opening Balance'}
                          </span>
                        ) : (
                          <div className="flex items-baseline justify-between gap-3 text-[13px] font-bold leading-snug text-black">
                            <span className="font-bold text-black whitespace-nowrap">
                              {cleanPrimaryRef}
                            </span>
                            <div className="flex items-baseline gap-2.5 shrink-0 font-bold text-black tabular-nums">
                              {cleanAccountRef && (
                                <span className="uppercase font-bold whitespace-nowrap">
                                  {cleanAccountRef}
                                </span>
                              )}
                              {shortInfo.qty > 0 && (
                                <span className="font-bold whitespace-nowrap">
                                  Qty:{shortInfo.qty}
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="py-1.5 px-2 text-right text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums">
                        {debitVal}
                      </td>
                      <td className="py-1.5 px-2 text-right text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums">
                        {creditVal}
                      </td>
                      <td className="py-1.5 px-2 text-right text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums">
                        {balanceVal}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="sp-short-total-row border-t border-black text-[13.5px] bg-white text-black">
                <td colSpan={2} className="pt-1.5 pb-0.5 px-2 text-left text-[13.5px] font-extrabold text-black align-top">
                  Crate Balance: {crateSummary.balanceCrate}
                </td>
                <td className="pt-1.5 pb-0.5 px-2 text-right text-[13.5px] font-extrabold text-black whitespace-nowrap tabular-nums align-top">
                  {ledger.totalDebit > 0 ? Number(ledger.totalDebit).toFixed(2) : ''}
                </td>
                <td className="pt-1.5 pb-0.5 px-2 text-right text-[13.5px] font-extrabold text-black whitespace-nowrap tabular-nums align-top">
                  {ledger.totalCredit > 0 ? Number(ledger.totalCredit).toFixed(2) : ''}
                </td>
                <td className="pt-1.5 pb-0.5 px-2 text-right text-[13.5px] font-extrabold text-black whitespace-nowrap align-top">
                  &nbsp;
                </td>
              </tr>
              <tr className="sp-short-closing-row bg-white text-black">
                <td colSpan={2} className="py-1 px-2 text-left text-[13.5px] font-extrabold text-black align-top">
                  <div className="flex items-center gap-4">
                    <span>= {crateSummary.balanceCrate}</span>
                    {totalQty > 0 && <span>Total Qty: {totalQty}</span>}
                  </div>
                </td>
                <td colSpan={3} className="sp-short-closing-cell border-t border-black py-1.5 px-2 align-top">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="sp-closing-label text-[14.5px] font-extrabold uppercase tracking-wide text-black whitespace-nowrap">
                      CLOSING BALANCE :
                    </span>
                    <span className="sp-closing-value text-[16px] font-black text-black whitespace-nowrap tabular-nums">
                      {Math.abs(ledger.closingBalance).toFixed(2)} {ledger.closingBalance < 0 ? 'Dr' : ledger.closingBalance > 0 ? 'Cr' : ''}
                    </span>
                  </div>
                </td>
              </tr>
              <tr className="ledger-closing-meta-row bg-white text-black">
                <td colSpan={5} className="ledger-closing-meta-cell px-2 pt-2 pb-1 bg-white text-black">
                  <div className="flex justify-between items-end text-[10.5px] bg-white text-black">
                    <div className="text-[10.5px] font-medium text-black">
                      Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Dynamic Page Footer */}
        <div
          data-sp-page-footer="true"
          className="sp-page-footer mt-2 pt-1 border-t border-slate-300 flex justify-between items-center text-[10.5px] font-medium text-black bg-white"
        >
          <span>{currentProfile.name || defaultProfile.name}</span>
          <span data-sp-page-number="true"></span>
        </div>
      </div>

      {/* Printable Account Detail Statement Layout for Sale Proceeds Ledger (Matches reference ledger print format) */}
      <div
        id="sale-proceeds-print-area"
        data-theme-isolated="true"
        data-dynamic-page-numbers="true"
        className="hidden bg-white text-black print-bill-canvas sp-ledger-uniform-font max-w-[760px] w-full mx-auto pt-1.5 print:pt-1 px-3 pb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Centered Company Header, then Customer on Left & ACCOUNT DETAILS on Right */}
        <div className="pb-1.5 mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger-centered" />
          <div className="flex justify-between items-end gap-4 pt-1">
            {/* Top-Left: M/s: Customer Name only */}
            <div className="max-w-[65%]">
              {resolvedPrintCustomer ? (
                <div className="sp-ledger-party-name text-[17px] font-extrabold text-black uppercase tracking-tight leading-tight">
                  M/s: {resolvedPrintCustomer.name || 'Customer'}
                </div>
              ) : (
                <div className="sp-ledger-party-name text-[17px] font-extrabold text-black uppercase tracking-tight leading-tight">
                  ALL CUSTOMERS
                </div>
              )}
            </div>

            {/* Top-Right: ACCOUNT DETAILS & Date Range */}
            <div className="text-right shrink-0">
              <div className="sp-ledger-account-heading text-[16px] font-black uppercase tracking-wider text-black leading-tight">
                ACCOUNT DETAILS
              </div>
              <div className="sp-ledger-date-range text-[13px] font-bold text-black mt-0.5">
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
            </div>
          </div>
        </div>

        {/* Ledger Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
        <div className="overflow-x-auto">
          <table className="ledger-ref-table sp-detailed-ref-table w-full table-fixed box-border text-left text-[13px] border-collapse bg-white text-black">
            <colgroup>
              <col style={{ width: '94px' }} />
              <col />
              <col style={{ width: '104px' }} />
              <col style={{ width: '104px' }} />
              <col style={{ width: '116px' }} />
            </colgroup>
            <thead>
              <tr className="border-0 bg-white text-[13.5px] font-extrabold uppercase tracking-wider text-black">
                <th className="py-2 px-2 text-left border-t border-b border-black border-r border-r-slate-300 whitespace-nowrap">DATE</th>
                <th className="py-2 px-2.5 text-left border-t border-b border-black border-r border-r-slate-300">PARTICULARS</th>
                <th className="py-2 px-2 text-right border-t border-b border-black border-r border-r-slate-300 whitespace-nowrap">DEBIT</th>
                <th className="py-2 px-2 text-right border-t border-b border-black border-r border-r-slate-300 whitespace-nowrap">CREDIT</th>
                <th className="py-2 px-2 text-right border-t border-b border-black whitespace-nowrap">BALANCE</th>
              </tr>
            </thead>
            <tbody className="bg-white text-black">
              {ledger.entries.length === 0 ? (
                <tr className="border-0">
                  <td colSpan={5} className="py-8 text-center text-[13px] font-bold text-black border-b border-slate-300">
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

                  const rawNo = stripLedgerCrateInOut(entry.referenceNo || entry.particulars || '');
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
                  const cleanObLabel = stripLedgerCrateInOut(sanitizeOpeningBalanceLabel(entry.particulars)) || 'Opening Balance';

                  // Keep every normal transaction together as an unbroken block; chunk only if >24 items (exceeds one full A4 page)
                  const ITEM_CHUNK_LIMIT = 24;
                  const ITEM_CHUNK_SIZE = 22;
                  const itemChunks: any[][] =
                    items.length > ITEM_CHUNK_LIMIT
                      ? Array.from(
                          { length: Math.ceil(items.length / ITEM_CHUNK_SIZE) },
                          (_, cIdx) => items.slice(cIdx * ITEM_CHUNK_SIZE, (cIdx + 1) * ITEM_CHUNK_SIZE)
                        )
                      : [items];

                  return (
                    <React.Fragment key={`print-full-grp-${entry.id}`}>
                      {itemChunks.map((chunkItems, chunkIdx) => {
                        const isFirstChunk = chunkIdx === 0;
                        const isLastChunk = chunkIdx === itemChunks.length - 1;
                        return (
                          <tr
                            key={`print-full-${entry.id}${itemChunks.length > 1 ? `-c${chunkIdx}` : ''}`}
                            className="ledger-tx-row border-0"
                          >
                            {/* DATE */}
                            <td className="py-1.5 px-2 text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums border-b border-slate-300 border-r border-r-slate-300">
                              {isFirstChunk ? formatDate(entry.date) : ''}
                            </td>

                            {/* PARTICULARS */}
                            <td className="py-1.5 px-2.5 text-[13px] font-bold text-black align-top border-b border-slate-300 border-r border-r-slate-300">
                              {isOb ? (
                                <div className="ledger-tx-block font-bold text-[13px] text-black uppercase">
                                  {cleanObLabel}
                                </div>
                              ) : (
                                <div className="ledger-tx-block space-y-0.5">
                                  {/* Line 1: Transaction number on Left, Qty on Right */}
                                  <div className="flex items-baseline justify-between gap-3 text-[13px] font-bold leading-snug text-black">
                                    <div className="flex flex-wrap items-baseline gap-1.5">
                                      <span className="font-bold text-black whitespace-nowrap">
                                        Sale Proceed No. {formattedNo}{!isFirstChunk ? ' (contd.)' : ''}
                                      </span>
                                      {isFirstChunk && sp?.challanDate && sp.challanDate !== sp.date && (
                                        <span className="text-[13px] font-bold text-black">
                                          Challan Dt: {formatDate(sp.challanDate)}
                                        </span>
                                      )}
                                    </div>
                                    {isFirstChunk && details.qty > 0 && (
                                      <span className="font-bold text-black whitespace-nowrap shrink-0 tabular-nums">
                                        Qty:{details.qty}
                                      </span>
                                    )}
                                  </div>

                                  {/* Item details: Name on Left, Qty Unit [Weight] @ Rate = Amount on Right */}
                                  {chunkItems.length > 0 ? (
                                    <div className="space-y-0.5 text-black">
                                      {chunkItems.map((it: any, iIdx: number) => {
                                        const itQty = it.quantity ?? it.qty ?? 0;
                                        const itUnit = it.unit || 'Box';
                                        const itWeight = it.weight ?? it.kg ?? (items.length === 1 && topWeight ? topWeight : undefined);
                                        const itRate = Number(it.rate ?? 0);
                                        const itAmount = Number(it.amount ?? (itQty * itRate));

                                        return (
                                          <div key={iIdx} className="sp-detail-line flex items-baseline justify-between gap-3 text-[13px] font-bold leading-snug text-black">
                                            <span className="font-bold text-black uppercase">
                                              {it.fruitName || it.name || 'Item'}
                                            </span>
                                            <span className="font-bold text-black text-right shrink-0 tabular-nums">
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
                                  ) : isFirstChunk ? (
                                    <div className="flex items-baseline justify-between gap-3 text-[13px] font-bold text-black tabular-nums">
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
                                  ) : null}

                                  {/* Expenses Breakdown: items on Left, total expense on Right */}
                                  {isLastChunk && expenses.length > 0 && (
                                    <div className="flex items-baseline justify-between gap-3 text-[13px] font-bold leading-snug text-black">
                                      <span>
                                        {expenses.map((e: any) => `${e.name} ${Number(Number(e.amount).toFixed(2))}`).join('  ')}
                                      </span>
                                      {totalExpenseSum > 0 && (
                                        <span className="font-bold shrink-0 tabular-nums">
                                          {Number(totalExpenseSum.toFixed(2))}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </td>

                            {/* DEBIT */}
                            <td className="py-1.5 px-2 text-right text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums border-b border-slate-300 border-r border-r-slate-300">
                              {isLastChunk ? debitVal : ''}
                            </td>

                            {/* CREDIT */}
                            <td className="py-1.5 px-2 text-right text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums border-b border-slate-300 border-r border-r-slate-300">
                              {isLastChunk ? creditVal : ''}
                            </td>

                            {/* BALANCE */}
                            <td className="py-1.5 px-2 text-right text-[13px] font-bold text-black align-top whitespace-nowrap tabular-nums border-b border-slate-300">
                              {isLastChunk ? balanceVal : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
            <tfoot>
              {/* Total Row with Crate Balance on Left and Debit/Credit Totals aligned under columns */}
              <tr className="border-0 text-[13.5px] bg-white text-black">
                <td colSpan={2} className="py-1.5 px-2 text-left text-[13.5px] font-extrabold text-black border-t border-b border-black border-r border-r-slate-300 align-top">
                  <div>Crate Balance: {crateSummary.balanceCrate}</div>
                  <div className="flex items-center gap-4">
                    <span>= {crateSummary.balanceCrate}</span>
                    {totalQty > 0 && <span>Total Qty: {totalQty}</span>}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right text-[13.5px] font-extrabold text-black whitespace-nowrap tabular-nums border-t border-b border-black border-r border-r-slate-300 align-top">
                  {ledger.totalDebit > 0 ? Number(ledger.totalDebit).toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-2 text-right text-[13.5px] font-extrabold text-black whitespace-nowrap tabular-nums border-t border-b border-black border-r border-r-slate-300 align-top">
                  {ledger.totalCredit > 0 ? Number(ledger.totalCredit).toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-2 text-right text-[13.5px] font-extrabold text-black whitespace-nowrap border-t border-b border-black align-top">
                  &nbsp;
                </td>
              </tr>

              {/* Closing Balance & Software Attribution kept together inside tfoot for final page only */}
              <tr className="ledger-closing-meta-row bg-white text-black">
                <td colSpan={5} className="ledger-closing-meta-cell p-0 bg-white text-black">
                  <div className="pt-2 pb-1 px-2 flex justify-end items-baseline gap-6 bg-white text-black">
                    <span className="sp-closing-label text-[14.5px] font-extrabold uppercase tracking-wide text-black">
                      CLOSING BALANCE :
                    </span>
                    <span className="sp-closing-value text-[16px] font-black text-black whitespace-nowrap tabular-nums">
                      {Math.abs(ledger.closingBalance).toFixed(2)} {ledger.closingBalance < 0 ? 'Dr' : ledger.closingBalance > 0 ? 'Cr' : ''}
                    </span>
                  </div>
                  <div className="px-2 pt-2 pb-1 flex justify-between items-end text-[10.5px] bg-white text-black">
                    <div className="text-[10.5px] font-medium text-black">
                      Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Dynamic Page Footer */}
        <div
          data-sp-page-footer="true"
          className="sp-page-footer mt-2 pt-1 border-t border-slate-300 flex justify-between items-center text-[10.5px] font-medium text-black bg-white"
        >
          <span>{currentProfile.name || defaultProfile.name}</span>
          <span data-sp-page-number="true"></span>
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
        customerType="sale_proceeds"
        subtitle="Select a Sale Proceeds customer to view their profile & statement"
      />
    </div>
  );
};
