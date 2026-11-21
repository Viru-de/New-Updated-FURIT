import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../services/db';
import { getCustomerLedger, getCustomerCrateStatement } from '../../services/accounting';
import { formatCurrency, formatDate, toIsoDate, getTodayIso, formatCompanySignature } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import { CreditSaleModal } from './CreditSaleModal';
import { ReceiptModal } from './ReceiptModal';
import { SaleProceedsModal } from './SaleProceedsModal';
import { CreditSale, Customer, LedgerEntry, Receipt, SaleProceeds } from '../../types';
import { Download, Printer, Plus, Phone, MapPin, CreditCard, ShoppingBag, Edit2, Building2, Box, User, ArrowLeft } from 'lucide-react';
import { CustomerAvatar, getCustomerInitials } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { exportCustomerLedger } from '../../utils/excelEngine';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { QuantityInput } from '../common/QuantityInput';
import { formatCustomerLedgerShortParticulars } from '../../utils/shortPrintUtils';

interface CustomerLedgerViewProps {
  initialCustomerId?: string;
  onNavigateToCrate?: (customerId: string) => void;
  onBackToReports?: () => void;
}

export const CustomerLedgerView: React.FC<CustomerLedgerViewProps> = ({
  initialCustomerId,
  onNavigateToCrate,
  onBackToReports,
}) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const customers = db.getCustomers();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialCustomerId || ''
  );

  useEffect(() => {
    const unsub = db.subscribe(() => {
      setRefreshKey((k) => k + 1);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Modals from ledger
  const [isCreditSaleOpen, setIsCreditSaleOpen] = useState(false);
  const [editingCreditSale, setEditingCreditSale] = useState<CreditSale | null>(null);

  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<Receipt | null>(null);

  const [isSaleProceedsOpen, setIsSaleProceedsOpen] = useState(false);
  const [editingSaleProceeds, setEditingSaleProceeds] = useState<SaleProceeds | null>(null);

  const [isEditCustomerObOpen, setIsEditCustomerObOpen] = useState(false);
  const [custObDate, setCustObDate] = useState('');
  const [custObAmount, setCustObAmount] = useState<number | ''>('');
  const [custObType, setCustObType] = useState<'debit' | 'credit'>('debit');

  const activeCustomer = selectedCustomerId
    ? customers.find((c) => c.id === selectedCustomerId) || null
    : null;
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile() || profiles[0];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const currentProfile = profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const ledger = activeCustomer
    ? getCustomerLedger(activeCustomer.id, {
        startDate: filterStartDate ? toIsoDate(filterStartDate) : undefined,
        endDate: filterEndDate ? toIsoDate(filterEndDate) : undefined,
      })
    : { customer: undefined, entries: [], closingBalance: 0, totalDebit: 0, totalCredit: 0 };

  const crateStatement = activeCustomer
    ? getCustomerCrateStatement(activeCustomer.id, {
        startDate: filterStartDate ? toIsoDate(filterStartDate) : undefined,
        endDate: filterEndDate ? toIsoDate(filterEndDate) : undefined,
      })
    : null;
  const crateBalance = crateStatement ? crateStatement.closingCrates : 0;

  const creditSalesMap = useMemo(() => {
    const map = new Map<string, CreditSale>();
    for (const cs of db.getCreditSales()) {
      map.set(cs.id, cs);
    }
    return map;
  }, [refreshKey]);

  const cashSalesMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof db.getCashSales>[number]>();
    for (const cs of db.getCashSales()) {
      map.set(cs.id, cs);
    }
    return map;
  }, [refreshKey]);

  const saleProceedsMap = useMemo(() => {
    const map = new Map<string, SaleProceeds>();
    for (const sp of db.getSaleProceeds()) {
      map.set(sp.id, sp);
    }
    return map;
  }, [refreshKey]);

  const receiptsMap = useMemo(() => {
    const map = new Map<string, Receipt>();
    for (const r of db.getReceipts()) {
      map.set(r.id, r);
    }
    return map;
  }, [refreshKey]);

  const totalQty = useMemo(() => {
    return Math.round(
      ledger.entries.reduce((sum, entry) => {
        if (entry.referenceType === 'Opening Balance' || entry.referenceType === 'Receipt') return sum;
        if (entry.subDetails?.items && entry.subDetails.items.length > 0) {
          return sum + entry.subDetails.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
        }
        return sum + (Number(entry.subDetails?.qty) || 0);
      }, 0) * 1000
    ) / 1000;
  }, [ledger.entries]);

  const handleEditEntry = (entry: LedgerEntry) => {
    if (entry.referenceType === 'Opening Balance') {
      if (!activeCustomer) return;
      setCustObDate(activeCustomer.createdAt ? activeCustomer.createdAt.split('T')[0] : getTodayIso());
      setCustObAmount(activeCustomer.openingBalance);
      setCustObType(activeCustomer.openingBalanceType || 'debit');
      setIsEditCustomerObOpen(true);
      return;
    }

    if (entry.referenceType === 'Credit Sale') {
      const cs = db.getCreditSales().find((s) => s.id === entry.referenceId || s.id === entry.id);
      if (cs) {
        setEditingCreditSale(cs);
        setIsCreditSaleOpen(true);
      }
      return;
    }

    if (entry.referenceType === 'Receipt') {
      const r = db.getReceipts().find((rec) => rec.id === entry.referenceId || rec.id === entry.id);
      if (r) {
        setEditingReceipt(r);
        setIsReceiptOpen(true);
      }
      return;
    }

    if (entry.referenceType === 'Sale Proceeds') {
      const sp = db.getSaleProceeds().find((s) => s.id === entry.referenceId || s.id === entry.id);
      if (sp) {
        setEditingSaleProceeds(sp);
        setIsSaleProceedsOpen(true);
      }
      return;
    }
  };

  const handleSaveCustomerOb = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeCustomer) return;
    const updated: Customer = {
      ...activeCustomer,
      openingBalance: Number(custObAmount) || 0,
      openingBalanceType: custObType,
      createdAt: custObDate ? `${custObDate}T00:00:00.000Z` : activeCustomer.createdAt,
    };
    db.saveCustomer(updated);
    setIsEditCustomerObOpen(false);
    setRefreshKey((k) => k + 1);
  };

  const handlePrint = () => {
    triggerPrint('a4', 'customer-ledger-detailed-print-area');
  };

  const handleShortPrint = () => {
    triggerPrint('a4', 'customer-ledger-short-print-area');
  };

  const handleExportCsv = () => {
    if (!activeCustomer) return;
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
    link.setAttribute('download', `Customer_Ledger_${activeCustomer.name}_${getTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          {onBackToReports && (
            <button
              type="button"
              onClick={onBackToReports}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to Accounting Reports</span>
            </button>
          )}
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Customer Ledger Statement
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => setIsCreditSaleOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <ShoppingBag className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" /> + Credit Sale
          </button>
          <button
            type="button"
            onClick={() => setIsReceiptOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> + Receipt
          </button>
          <button
            type="button"
            disabled={!activeCustomer}
            onClick={() => activeCustomer && exportCustomerLedger(activeCustomer.id)}
            className={`flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold transition-colors ${
              !activeCustomer
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-500'
                : 'bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer shadow-2xs'
            }`}
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Export Excel
          </button>
          <button
            type="button"
            disabled={!activeCustomer}
            onClick={handleExportCsv}
            className={`flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold transition-colors ${
              !activeCustomer
                ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 dark:bg-slate-800/40 dark:border-slate-800 dark:text-slate-500'
                : 'bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 cursor-pointer'
            }`}
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
          {activeCustomer && (
            <BillShareButtons
              elementId="customer-ledger-detailed-print-area"
              filename={`Customer_Ledger_${activeCustomer.name.replace(/\s+/g, '_')}`}
              customerMobile={activeCustomer.mobile}
              title={`Customer Ledger - ${activeCustomer.name}`}
              defaultPaperSize="a4"
              summaryText={`Customer: ${activeCustomer.name}\nDate: ${formatDate(getTodayIso())}\nTotal Debit: ₹${ledger.totalDebit.toLocaleString('en-IN')}\nTotal Credit: ₹${ledger.totalCredit.toLocaleString('en-IN')}\nClosing Balance: ₹${ledger.closingBalance.toLocaleString('en-IN')} ${ledger.closingBalance > 0 ? '(Dr - Due)' : ledger.closingBalance < 0 ? '(Cr - Advance)' : '(Settled)'}`}
            />
          )}
          <button
            type="button"
            disabled={!activeCustomer}
            onClick={handlePrint}
            className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
              !activeCustomer
                ? 'opacity-40 cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-slate-800 dark:text-slate-600'
                : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 cursor-pointer'
            }`}
            title="Print full Customer Ledger statement"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
          <button
            type="button"
            disabled={!activeCustomer}
            onClick={handleShortPrint}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold shadow-2xs transition-colors ${
              !activeCustomer
                ? 'opacity-40 cursor-not-allowed border-slate-200 text-slate-400 dark:border-slate-800 dark:text-slate-600'
                : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer'
            }`}
            title="Short Print: compact statement without expense or item breakdowns"
          >
            <Printer className="h-3.5 w-3.5 text-emerald-600" /> Short Print
          </button>
        </div>
      </div>

      {/* 1. Customer Selection Bar & Date Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-5">
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Customer
            </label>
            <CustomerAutocomplete
              valueCustomerId={selectedCustomerId}
              onChange={(c) => {
                setSelectedCustomerId(c ? c.id : '');
              }}
              placeholder="Search customer name, mobile, city or Aadhaar..."
            />
          </div>

          <div className="lg:col-span-7 flex flex-wrap items-end gap-2.5">
            <div className="w-36 sm:w-40 flex-1 sm:flex-none">
              <DatePickerInput
                label="From Date"
                value={filterStartDate}
                onChange={setFilterStartDate}
              />
            </div>
            <div className="w-36 sm:w-40 flex-1 sm:flex-none">
              <DatePickerInput
                label="To Date"
                value={filterEndDate}
                onChange={setFilterEndDate}
              />
            </div>
            <div className="flex items-center gap-1.5 pb-0.5">
              <button
                type="button"
                onClick={() => {
                  const today = getTodayIso();
                  setFilterStartDate(today);
                  setFilterEndDate(today);
                }}
                className={`rounded-lg px-2.5 py-2 text-xs font-semibold border cursor-pointer transition-colors ${
                  filterStartDate === getTodayIso() && filterEndDate === getTodayIso()
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                    : 'border-slate-300 text-slate-700 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                }`}
                title="View today's transactions and single-day ledger"
              >
                Today
              </button>
              {(filterStartDate || filterEndDate) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterStartDate('');
                    setFilterEndDate('');
                  }}
                  className="rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  title="Clear date filter and view all-time ledger"
                >
                  All Time
                </button>
              )}
            </div>

            {onNavigateToCrate && activeCustomer && (
              <button
                type="button"
                onClick={() => onNavigateToCrate(activeCustomer.id)}
                className="ml-auto flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300 cursor-pointer"
              >
                <Box className="h-3.5 w-3.5" />
                <span>Crate Statement →</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2. Customer Ledger Statement — Customer Profile or Selection Prompt */}
      {activeCustomer ? (
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 sm:p-6 shadow-xs relative overflow-hidden transition-all no-print">
          {/* Top border accent line */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600" />

          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5 sm:gap-6 pt-1">
            {/* Left Section: Large Photo + Comprehensive Non-Empty Details */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6 min-w-0 flex-1">
              {/* Prominent Large Customer Photo */}
              <div className="relative shrink-0">
                <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-2xl border-2 border-emerald-500/40 dark:border-emerald-500/30 shadow-md overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center select-none ring-4 ring-emerald-50 dark:ring-emerald-950/40">
                  {activeCustomer.photo ? (
                    <img
                      src={activeCustomer.photo}
                      alt={activeCustomer.name}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 to-teal-100/70 dark:from-slate-800 dark:to-emerald-950/50 text-emerald-800 dark:text-emerald-200">
                      <span className="font-mono-numbers text-3xl sm:text-4xl font-extrabold tracking-tight">
                        {getCustomerInitials(activeCustomer.name)}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-700/80 dark:text-emerald-300/80 uppercase tracking-wider mt-1">
                        No Photo
                      </span>
                    </div>
                  )}
                </div>
                {activeCustomer.active && (
                  <span
                    className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs border-2 border-white dark:border-slate-900"
                    title="Active Wholesale Customer"
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
                      {activeCustomer.name}
                    </h3>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      Wholesale Customer
                    </span>
                  </div>

                  {/* Description / Notes (only if non-empty) */}
                  {(activeCustomer.notes?.trim() || activeCustomer.description?.trim()) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                      "{activeCustomer.notes?.trim() || activeCustomer.description?.trim()}"
                    </p>
                  )}

                  {/* Contact Person (only if non-empty) */}
                  {activeCustomer.contactPerson && activeCustomer.contactPerson.trim() && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                      <span className="text-slate-400">Contact:</span> {activeCustomer.contactPerson.trim()}
                    </p>
                  )}
                </div>

                {/* Details Badges / Info Grid (Only non-empty fields displayed) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-2 text-xs text-slate-600 dark:text-slate-300">
                  {/* Phone / Mobile (only if non-empty) */}
                  {activeCustomer.mobile && activeCustomer.mobile.trim() ? (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
                        <Phone className="h-4 w-4" />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">Phone / Mobile</span>
                        <span className="font-semibold text-slate-900 dark:text-white font-mono-numbers text-xs sm:text-sm">
                          <a href={`tel:${activeCustomer.mobile.trim()}`} className="hover:underline">
                            {activeCustomer.mobile.trim()}
                          </a>
                        </span>
                        {activeCustomer.altMobile && activeCustomer.altMobile.trim() && (
                          <span className="text-slate-400 text-xs font-mono-numbers ml-1">
                            / {activeCustomer.altMobile.trim()}
                          </span>
                        )}
                      </div>
                    </div>
                  ) : activeCustomer.altMobile && activeCustomer.altMobile.trim() ? (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 shrink-0">
                        <Phone className="h-4 w-4" />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">Alternate Mobile</span>
                        <span className="font-semibold text-slate-900 dark:text-white font-mono-numbers text-xs sm:text-sm">
                          <a href={`tel:${activeCustomer.altMobile.trim()}`} className="hover:underline">
                            {activeCustomer.altMobile.trim()}
                          </a>
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {/* Address & City (only if non-empty) */}
                  {Boolean(activeCustomer.address?.trim() || activeCustomer.city?.trim() || activeCustomer.state?.trim()) && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-600 shrink-0">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">Address & City</span>
                        <span className="font-semibold text-slate-900 dark:text-white truncate block text-xs sm:text-sm">
                          {[activeCustomer.address?.trim(), activeCustomer.city?.trim(), activeCustomer.state?.trim()].filter(Boolean).join(', ')}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Aadhaar Number (only if non-empty, NO GSTIN) */}
                  {activeCustomer.aadhaarNo && activeCustomer.aadhaarNo.trim() && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 shrink-0">
                        <CreditCard className="h-4 w-4" />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">
                          Aadhaar Number
                        </span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono-numbers text-xs">
                          {activeCustomer.aadhaarNo.trim()}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Opening Crates (only if non-empty and non-zero) */}
                  {Boolean(activeCustomer.openingCrateBalance) && (
                    <div className="flex items-center gap-2.5">
                      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-sky-600 shrink-0">
                        <Box className="h-4 w-4" />
                      </span>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-400 block leading-3">Opening Crate Balance</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono-numbers text-xs">
                          {activeCustomer.openingCrateBalance} Crates
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Prominent Current Balance in Top-Right Corner */}
            <div className="w-full lg:w-72 shrink-0 flex flex-col justify-between bg-slate-50 dark:bg-slate-800/60 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700/60 shadow-2xs">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {(filterStartDate || filterEndDate) ? 'Period Balance' : 'Current Balance'}
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ledger.closingBalance > 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        : ledger.closingBalance < 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {ledger.closingBalance > 0 ? 'Dr · Due' : ledger.closingBalance < 0 ? 'Cr · Advance' : 'Settled'}
                  </span>
                </div>

                <div
                  className={`mt-1 font-mono-numbers text-2xl sm:text-3xl font-black tracking-tight ${
                    ledger.closingBalance > 0
                      ? 'text-rose-600 dark:text-rose-400'
                      : ledger.closingBalance < 0
                      ? 'text-emerald-600 dark:text-emerald-400'
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
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">Total Debit</span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">{formatCurrency(ledger.totalDebit)}</span>
                  </div>
                  <div className="text-right">
                    <span className="block text-[9px] uppercase tracking-wider text-slate-400">Total Credit</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(ledger.totalCredit)}</span>
                  </div>
                </div>
                {(filterStartDate || filterEndDate) && ledger.overallClosingBalance !== undefined && (
                  <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/60 dark:border-slate-700/60 text-[10px]">
                    <span className="uppercase tracking-wider text-slate-400">All-Time Due</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(ledger.overallClosingBalance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-8 sm:p-12 text-center bg-white dark:bg-slate-900 shadow-2xs no-print">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center mb-3">
            <User className="h-7 w-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            Please Select a Customer
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Type or search customer name, mobile, city, or Aadhaar number above to view their customer profile, balance, and complete transaction ledger.
          </p>
          {customers.length > 0 && (
            <div className="flex flex-wrap justify-center gap-2">
              {customers.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelectedCustomerId(c.id)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
                >
                  <CustomerAvatar photo={c.photo} name={c.name} size="xs" />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Ledger Table Container (Used for on-screen viewing, PDF generation, and printing) */}
      <div
        id="ledger-print-area"
        className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden"
      >
        {/* Printable Traditional Mandi Statement Header (matches company profile) */}
        <div className="hidden print:block px-3 pt-1 pb-1.5 text-center mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger-centered" />
          <div className="my-1 text-xs font-bold uppercase tracking-widest border-b border-t border-black py-0.5 inline-block">
            CUSTOMER LEDGER STATEMENT
          </div>
          <div className="flex justify-between items-start text-xs mt-1.5 text-left pt-1">
            <div>
              <div className="font-bold text-sm uppercase">M/s: {activeCustomer?.name || 'Customer'}</div>
            </div>
            <div className="text-right">
              <div>DATE: <strong>{formatDate(getTodayIso())}</strong></div>
              {(filterStartDate || filterEndDate) ? (
                <div className="text-[11px]">Period: {filterStartDate ? formatDate(filterStartDate) : 'Opening'} to {filterEndDate ? formatDate(filterEndDate) : 'Today'}</div>
              ) : (
                <div className="text-[11px]">Period: Complete Statement (All Transactions)</div>
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
                <th className="px-3 py-3 print:px-2 print:py-2 w-24 print:w-[82px] text-slate-800 dark:text-slate-100 font-bold whitespace-nowrap">Date</th>
                <th className="px-3.5 py-3 print:px-2.5 print:py-2 min-w-[260px] text-slate-800 dark:text-slate-100 font-bold">Particulars / Transaction</th>
                <th className="px-3 py-3 print:px-2 print:py-2 text-right w-24 print:w-[88px] text-slate-800 dark:text-slate-100 font-bold whitespace-nowrap">Debit (Dr)</th>
                <th className="px-3 py-3 print:px-2 print:py-2 text-right w-24 print:w-[88px] text-slate-800 dark:text-slate-100 font-bold whitespace-nowrap">Credit (Cr)</th>
                <th className="px-3 py-3 print:px-2 print:py-2 text-right w-28 print:w-[98px] text-slate-800 dark:text-slate-100 font-bold whitespace-nowrap">Balance (₹)</th>
                <th className="px-3 py-3 text-center w-20 text-slate-800 dark:text-slate-100 font-bold no-print whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {ledger.entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
                    {activeCustomer
                      ? 'No transactions found for this customer.'
                      : 'Please search and select a customer above to view their transaction ledger.'}
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/50 ${
                        isOb ? 'bg-amber-50/40 font-medium dark:bg-amber-950/30' : ''
                      }`}
                    >
                      <td className="px-3 py-3 print:px-2 print:py-2 font-mono-numbers text-xs print:text-[11.5px] text-slate-700 dark:text-slate-300 whitespace-nowrap align-top">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-3.5 py-3 print:px-2.5 print:py-2 text-slate-900 dark:text-slate-100 align-top min-w-[260px]">
                        <div
                          className={`font-bold text-sm sm:text-[15px] print:text-[13px] tracking-tight leading-snug ${
                            !isOb && entry.particulars.length <= 32 ? 'whitespace-nowrap' : ''
                          } ${isOb ? 'text-amber-900 dark:text-amber-200 font-bold' : 'text-slate-950 dark:text-slate-100'}`}
                        >
                          {entry.particulars}
                        </div>
                        {entry.subDetails?.items && entry.subDetails.items.length > 0 && (
                          <div className="mt-1 space-y-0.5 print:space-y-0.5">
                            {entry.subDetails.items.map((it, itemIdx) => (
                              <div
                                key={itemIdx}
                                className="text-xs sm:text-[13px] print:text-[11.5px] font-medium text-slate-800 dark:text-slate-200 leading-snug break-words"
                              >
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{it.name}</span>{' '}
                                <span className="whitespace-nowrap">
                                  <span className="text-slate-400 dark:text-slate-500 mr-1">—</span>
                                  <span className="font-mono-numbers text-slate-800 dark:text-slate-200">
                                    {it.qty} {it.unit} / ₹{it.rate}
                                  </span>
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        {entry.subDetails?.expenses && entry.subDetails.expenses.length > 0 && (
                          <div className="mt-1 text-xs sm:text-[12.5px] print:text-[11px] font-medium text-slate-700 dark:text-slate-300 leading-snug">
                            <span className="font-semibold text-rose-700 dark:text-rose-400">Expenses:</span>{' '}
                            {entry.subDetails.expenses.map((e) => `${e.name} ₹${e.amount}`).join(' · ')}
                          </div>
                        )}
                        {entry.notes && (
                          <div className="mt-1 text-xs print:text-[11px] text-slate-600 dark:text-slate-400 italic">
                            Note: {entry.notes}
                          </div>
                        )}
                      </td>
                      {/* Debit cell */}
                      <td className="px-3 py-3 print:px-2 print:py-2 text-right font-mono-numbers text-xs sm:text-sm print:text-[12px] font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap align-top">
                        {entry.debit !== null ? formatCurrency(entry.debit) : ''}
                      </td>
                      {/* Credit cell */}
                      <td className="px-3 py-3 print:px-2 print:py-2 text-right font-mono-numbers text-xs sm:text-sm print:text-[12px] font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap align-top">
                        {entry.credit !== null ? formatCurrency(entry.credit) : ''}
                      </td>
                      {/* Balance cell */}
                      <td className="px-3 py-3 print:px-2 print:py-2 text-right font-mono-numbers text-xs sm:text-sm print:text-[12px] font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap align-top">
                        {formatCurrency(entry.balance)}
                      </td>
                      <td className="px-3 py-3 text-center no-print whitespace-nowrap align-top">
                        <button
                          type="button"
                          onClick={() => handleEditEntry(entry)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-500 hover:text-emerald-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-emerald-500 dark:hover:text-emerald-400 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                          title="Edit Transaction"
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
                <td colSpan={2} className="px-3.5 py-3 print:px-2 print:py-2 text-xs uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Total Debits & Credits
                </td>
                <td className="px-3 py-3 print:px-2 print:py-2 text-right font-mono-numbers text-sm print:text-[12.5px] text-rose-600 dark:text-rose-400 whitespace-nowrap">
                  {ledger.totalDebit > 0 ? formatCurrency(ledger.totalDebit) : ''}
                </td>
                <td className="px-3 py-3 print:px-2 print:py-2 text-right font-mono-numbers text-sm print:text-[12.5px] text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                  {ledger.totalCredit > 0 ? formatCurrency(ledger.totalCredit) : ''}
                </td>
                <td className="px-3 py-3 print:px-2 print:py-2 text-right font-mono-numbers text-base print:text-[13.5px] text-slate-900 dark:text-slate-100 font-extrabold whitespace-nowrap">
                  {formatCurrency(ledger.closingBalance)}
                </td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="text-xs text-slate-600 dark:text-slate-400">
            Net balance is calculated dynamically from all historical transactions.
          </div>
          <div className="flex items-center gap-3 mt-2 sm:mt-0">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Customer Outstanding:
            </span>
            <span
              className={`font-mono-numbers text-lg font-extrabold ${
                ledger.closingBalance > 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : ledger.closingBalance < 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {formatCurrency(ledger.closingBalance)}
            </span>
          </div>
        </div>

        {/* Software attribution & Signatory (matches requirement: left side, smaller font size) */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-black flex justify-between items-center text-xs">
          <div className="text-[8px] sm:text-[8.5px] text-left text-slate-500 dark:text-slate-400 print:text-black font-mono">
            Software Developed by: {defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="hidden print:block text-right font-bold uppercase text-[11px]">
            {formatCompanySignature(defaultProfile)}
          </div>
        </div>
      </div>

      {/* Detailed Print Layout for Customer Ledger (Matches Sale Proceed Ledger & reference ledger print format) */}
      <div
        id="customer-ledger-detailed-print-area"
        data-theme-isolated="true"
        className="hidden bg-white text-black print-bill-canvas max-w-[760px] w-full mx-auto pt-1.5 print:pt-1 px-3 pb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Centered Company Header, then Customer on Left & ACCOUNT DETAILS on Right */}
        <div className="pb-1.5 mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger-centered" />
          <div className="flex justify-between items-end gap-4 pt-1">
            {/* Top-Left: M/s: Customer Name only */}
            <div className="max-w-[65%]">
              <div className="text-base sm:text-lg font-extrabold text-black uppercase tracking-tight leading-tight">
                M/s: {activeCustomer?.name || 'Customer'}
              </div>
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
                ) : ledger.entries.length > 0 ? (
                  <span>{formatDate(ledger.entries[0].date)} To {formatDate(getTodayIso())}</span>
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
          <table className="ledger-ref-table w-full text-left text-xs border-collapse bg-white text-black">
            <thead>
              <tr className="border-t border-b border-black bg-white text-[11px] font-bold uppercase tracking-wider text-black">
                <th className="py-1.5 px-2 w-[84px] text-left border-r border-black/35 whitespace-nowrap">DATE</th>
                <th className="py-1.5 px-2.5 text-left border-r border-black/35">PARTICULARS</th>
                <th className="py-1.5 px-2 text-right w-[84px] border-r border-black/35 whitespace-nowrap">DEBIT</th>
                <th className="py-1.5 px-2 text-right w-[84px] border-r border-black/35 whitespace-nowrap">CREDIT</th>
                <th className="py-1.5 px-2 text-right w-[96px] whitespace-nowrap">BALANCE</th>
              </tr>
            </thead>
            <tbody className="bg-white text-black">
              {ledger.entries.length === 0 ? (
                <tr className="border-b border-black/35">
                  <td colSpan={5} className="py-8 text-center text-xs text-black">
                    {activeCustomer
                      ? 'No transactions found for this customer in the selected period.'
                      : 'Please select a customer to view their detailed ledger statement.'}
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  const refKey = entry.referenceId || entry.id;
                  const csRecord =
                    entry.referenceType === 'Credit Sale' || entry.referenceType === 'Group Sale'
                      ? creditSalesMap.get(refKey)
                      : undefined;
                  const cashRecord =
                    entry.referenceType === 'Cash Sale'
                      ? cashSalesMap.get(refKey)
                      : undefined;
                  const spRecord =
                    entry.referenceType === 'Sale Proceeds'
                      ? saleProceedsMap.get(refKey)
                      : undefined;
                  const receiptRecord =
                    entry.referenceType === 'Receipt'
                      ? receiptsMap.get(refKey)
                      : undefined;

                  const shortInfo = formatCustomerLedgerShortParticulars(entry, {
                    csRecord,
                    cashRecord,
                    spRecord,
                    receiptRecord,
                  });

                  const rawItems: Array<{
                    name: string;
                    qty: number;
                    unit: string;
                    weight?: number;
                    rate: number;
                    amount: number;
                  }> = [];

                  if (csRecord?.items && csRecord.items.length > 0) {
                    for (const it of csRecord.items) {
                      rawItems.push({
                        name: it.fruitName,
                        qty: it.quantity,
                        unit: it.unit,
                        weight: it.kg,
                        rate: it.rate,
                        amount: it.amount,
                      });
                    }
                  } else if (cashRecord?.items && cashRecord.items.length > 0) {
                    for (const it of cashRecord.items) {
                      rawItems.push({
                        name: it.fruitName,
                        qty: it.quantity,
                        unit: it.unit,
                        weight: it.kg,
                        rate: it.rate,
                        amount: it.amount,
                      });
                    }
                  } else if (spRecord?.items && spRecord.items.length > 0) {
                    for (const it of spRecord.items) {
                      rawItems.push({
                        name: it.fruitName,
                        qty: it.quantity,
                        unit: it.unit,
                        weight: it.weight ?? it.kg,
                        rate: it.rate,
                        amount: it.amount,
                      });
                    }
                  } else if (entry.subDetails?.items && entry.subDetails.items.length > 0) {
                    for (const it of entry.subDetails.items) {
                      rawItems.push({
                        name: it.name,
                        qty: it.qty,
                        unit: it.unit,
                        rate: it.rate,
                        amount: it.amount,
                      });
                    }
                  }

                  const txQty =
                    rawItems.length > 0
                      ? Math.round(rawItems.reduce((s, it) => s + (Number(it.qty) || 0), 0) * 1000) / 1000
                      : spRecord
                      ? spRecord.quantity
                      : entry.subDetails?.qty || 0;

                  const txExpenses =
                    csRecord?.expenses?.length
                      ? csRecord.expenses
                      : cashRecord?.expenses?.length
                      ? cashRecord.expenses
                      : spRecord?.expenses?.length
                      ? spRecord.expenses
                      : entry.subDetails?.expenses || [];

                  const totalExpenseSum =
                    csRecord?.expenseTotal ??
                    cashRecord?.expenseTotal ??
                    spRecord?.totalExpense ??
                    txExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0);

                  const crateMovements = csRecord?.crateMovements?.length
                    ? csRecord.crateMovements
                    : cashRecord?.crateMovements?.length
                    ? cashRecord.crateMovements
                    : undefined;
                  const crateOutVal = csRecord?.crateOut ?? cashRecord?.crateOut ?? entry.subDetails?.crateOut ?? 0;
                  const crateInVal = csRecord?.crateIn ?? cashRecord?.crateIn ?? entry.subDetails?.crateIn ?? 0;
                  const crateNameVal = csRecord?.crateName || cashRecord?.crateName || spRecord?.crateName || '';

                  let crateLeft = '';
                  let crateRight = '';
                  if (crateMovements && crateMovements.length > 0) {
                    const parts = crateMovements
                      .filter((m) => (m.outQuantity || 0) > 0 || (m.inQuantity || 0) > 0)
                      .map((m) => {
                        const sub: string[] = [];
                        if (m.outQuantity > 0) sub.push(`${m.outQuantity} Out`);
                        if (m.inQuantity > 0) sub.push(`${m.inQuantity} In`);
                        return `${m.crateName}: ${sub.join(', ')}`;
                      });
                    if (parts.length > 0) {
                      crateLeft = 'Crates';
                      crateRight = parts.join(' | ');
                    }
                  } else if (crateOutVal > 0 || crateInVal > 0) {
                    const sub: string[] = [];
                    if (crateOutVal > 0) sub.push(`${crateOutVal} Out`);
                    if (crateInVal > 0) sub.push(`${crateInVal} In`);
                    crateLeft = `Crates${crateNameVal ? ` (${crateNameVal})` : ''}`;
                    crateRight = sub.join(', ');
                  }

                  const debitVal = entry.debit !== null && entry.debit !== undefined && entry.debit > 0 ? Number(entry.debit).toFixed(2) : '';
                  const creditVal = entry.credit !== null && entry.credit !== undefined && entry.credit > 0 ? Number(entry.credit).toFixed(2) : '';
                  const balanceVal = entry.balance < 0 ? `(${Math.abs(entry.balance).toFixed(2)})` : Number(entry.balance).toFixed(2);

                  return (
                    <tr key={`cl-det-${entry.id}`} className="border-b border-black/35">
                      {/* DATE */}
                      <td className="py-1.5 px-2 font-mono text-[11px] text-black align-top whitespace-nowrap border-r border-black/35">
                        {formatDate(entry.date)}
                      </td>

                      {/* PARTICULARS */}
                      <td className="py-1.5 px-2.5 text-black align-top border-r border-black/35">
                        {isOb ? (
                          <div className="font-semibold text-[11.5px] text-black uppercase">
                            {entry.particulars || 'Opening Balance'}
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            {/* Line 1: Transaction number on Left, Account Ref / Qty on Right */}
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
                                {txQty > 0 && (
                                  <span className="font-semibold whitespace-nowrap">
                                    Qty:{txQty}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Item details: Name on Left, Qty Unit [Weight] @ Rate = Amount on Right */}
                            {rawItems.length > 0 ? (
                              <div className="space-y-0.5 text-black">
                                {rawItems.map((it, iIdx) => {
                                  const itRate = Number(it.rate ?? 0);
                                  const itAmount = Number(it.amount ?? (it.qty * itRate));

                                  return (
                                    <div
                                      key={iIdx}
                                      className="sp-detail-line flex items-baseline justify-between gap-3 text-[11.5px] leading-snug text-black"
                                    >
                                      <span className="font-medium text-black uppercase">
                                        {it.name}
                                      </span>
                                      <span className="font-mono text-black text-right shrink-0">
                                        <span className="whitespace-nowrap sp-qty-nowrap">
                                          {it.qty} {it.unit}
                                        </span>
                                        {it.weight && Number(it.weight) > 0 ? ` ${it.weight}kg` : ''}
                                        {` @ ${Number(itRate.toFixed(2))}`}
                                        {itAmount > 0 ? ` = ${Number(itAmount.toFixed(2))}` : ''}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : spRecord && (spRecord.quantity > 0 || spRecord.rate > 0) ? (
                              <div className="flex items-baseline justify-between gap-3 text-[11.5px] text-black font-mono">
                                <span>&nbsp;</span>
                                <span>
                                  <span className="whitespace-nowrap sp-qty-nowrap">
                                    {spRecord.quantity} {spRecord.unit || 'Crate'}
                                  </span>
                                  {(spRecord.weight ?? spRecord.kg) ? ` ${spRecord.weight ?? spRecord.kg}kg` : ''}
                                  {spRecord.rate ? ` @ ${spRecord.rate}` : ''}
                                  {spRecord.amount ? ` = ${Number(Number(spRecord.amount).toFixed(2))}` : ''}
                                </span>
                              </div>
                            ) : null}

                            {/* Expenses Breakdown: items on Left, total expense on Right */}
                            {txExpenses.length > 0 && (
                              <div className="flex items-baseline justify-between gap-3 text-[11px] leading-snug text-black">
                                <span>
                                  {txExpenses.map((e) => `${e.name} ${Number(Number(e.amount).toFixed(2))}`).join('  ')}
                                </span>
                                {totalExpenseSum > 0 && (
                                  <span className="font-mono font-medium shrink-0">
                                    {Number(totalExpenseSum.toFixed(2))}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Crate Movement if present */}
                            {crateLeft && (
                              <div className="flex items-baseline justify-between gap-3 text-[10.5px] leading-snug text-black font-mono">
                                <span>{crateLeft}</span>
                                <span className="shrink-0">{crateRight}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      {/* DEBIT */}
                      <td className="py-1.5 px-2 text-right font-mono text-[11.5px] text-black align-top whitespace-nowrap border-r border-black/35">
                        {debitVal}
                      </td>

                      {/* CREDIT */}
                      <td className="py-1.5 px-2 text-right font-mono text-[11.5px] text-black align-top whitespace-nowrap border-r border-black/35">
                        {creditVal}
                      </td>

                      {/* BALANCE */}
                      <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black align-top whitespace-nowrap">
                        {balanceVal}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              {/* Total Row with Crate Balance on Left and Debit/Credit Totals aligned under columns */}
              <tr className="border-t border-b border-black text-xs bg-white text-black">
                <td colSpan={2} className="py-1.5 px-2 text-left text-[11.5px] font-semibold text-black border-r border-black/35 align-top">
                  <div>Crate Balance: {crateBalance}</div>
                  {crateStatement &&
                    crateStatement.typeBalances
                      .filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0)
                      .map((tb) => (
                        <div key={tb.crateTypeId} className="text-[10.5px] font-mono font-normal">
                          {tb.crateName}: {tb.issued} Out, {tb.returned} In (Bal: {tb.balance})
                        </div>
                      ))}
                  <div className="flex items-center gap-4">
                    <span>= {crateBalance}</span>
                    {totalQty > 0 && <span>Total Qty: {totalQty}</span>}
                  </div>
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black whitespace-nowrap border-r border-black/35 align-top">
                  {ledger.totalDebit > 0 ? Number(ledger.totalDebit).toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-semibold text-black whitespace-nowrap border-r border-black/35 align-top">
                  {ledger.totalCredit > 0 ? Number(ledger.totalCredit).toFixed(2) : ''}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-[11.5px] font-bold text-black whitespace-nowrap align-top">
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
            {Math.abs(ledger.closingBalance).toFixed(2)} {ledger.closingBalance > 0 ? 'Dr' : ledger.closingBalance < 0 ? 'Cr' : ''}
          </span>
        </div>

        {/* Software Developed By & Authorised Signature */}
        <div className="px-2 pt-2 pb-1 flex justify-between items-end text-xs bg-white text-black">
          <div className="text-[9px] text-black font-mono">
            Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10.5px] font-bold uppercase text-black">
              {formatCompanySignature(currentProfile)}
            </div>
            <div className="text-[8.5px] uppercase tracking-wider text-black mt-3">
              AUTHORISED SIGNATURE
            </div>
          </div>
        </div>
      </div>

      {/* Short Print Layout for Customer Ledger Statement (Matches Sale Proceed Ledger Short Print & reference ledger print format) */}
      <div
        id="customer-ledger-short-print-area"
        data-theme-isolated="true"
        className="hidden bg-white text-black print-bill-canvas max-w-[760px] w-full mx-auto pt-1.5 print:pt-1 px-3 pb-2"
        style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
      >
        {/* Header Layout: Centered Company Header, then Customer on Left & ACCOUNT DETAILS on Right */}
        <div className="pb-1.5 mb-1">
          <PrintBusinessHeader profile={currentProfile} variant="ledger-centered" />
          <div className="flex justify-between items-end gap-4 pt-1">
            {/* Top-Left: M/s: Customer Name only */}
            <div className="max-w-[65%]">
              <div className="text-base sm:text-lg font-extrabold text-black uppercase tracking-tight leading-tight">
                M/s: {activeCustomer?.name || 'Customer'}
              </div>
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
                ) : ledger.entries.length > 0 ? (
                  <span>{formatDate(ledger.entries[0].date)} To {formatDate(getTodayIso())}</span>
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

        {/* Short Ledger Table: DATE | PARTICULARS | DEBIT | CREDIT | BALANCE */}
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
                    {activeCustomer
                      ? 'No transactions found for this customer.'
                      : 'Please select a customer to view statement.'}
                  </td>
                </tr>
              ) : (
                ledger.entries.map((entry, idx) => {
                  const isOb = entry.referenceType === 'Opening Balance';
                  const refKey = entry.referenceId || entry.id;
                  const shortInfo = formatCustomerLedgerShortParticulars(entry, {
                    csRecord: creditSalesMap.get(refKey),
                    cashRecord: cashSalesMap.get(refKey),
                    spRecord: saleProceedsMap.get(refKey),
                    receiptRecord: receiptsMap.get(refKey),
                  });

                  const debitVal = entry.debit !== null && entry.debit !== undefined && entry.debit > 0 ? Number(entry.debit).toFixed(2) : '';
                  const creditVal = entry.credit !== null && entry.credit !== undefined && entry.credit > 0 ? Number(entry.credit).toFixed(2) : '';
                  const balanceVal = entry.balance < 0 ? `(${Math.abs(entry.balance).toFixed(2)})` : Number(entry.balance).toFixed(2);
                  const isShaded = idx % 2 === 0;

                  return (
                    <tr
                      key={`short-${entry.id}`}
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
                  <div>Crate Balance: {crateBalance}</div>
                  {crateStatement &&
                    crateStatement.typeBalances
                      .filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0)
                      .map((tb) => (
                        <div key={tb.crateTypeId} className="text-[10px] font-mono font-normal">
                          {tb.crateName}: {tb.issued} Out, {tb.returned} In (Bal: {tb.balance})
                        </div>
                      ))}
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
                    <span>= {crateBalance}</span>
                    {totalQty > 0 && <span>Total Qty: {totalQty}</span>}
                  </div>
                </td>
                <td colSpan={3} className="sp-short-closing-cell border-t border-black py-1.5 px-2 align-top">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-sm font-medium uppercase tracking-wide text-black whitespace-nowrap">
                      CLOSING BALANCE :
                    </span>
                    <span className="text-sm sm:text-base font-extrabold font-mono text-black whitespace-nowrap">
                      {Math.abs(ledger.closingBalance).toFixed(2)} {ledger.closingBalance > 0 ? 'Dr' : ledger.closingBalance < 0 ? 'Cr' : ''}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Software attribution & Signatory */}
        <div className="px-2 pt-2 pb-1 flex justify-between items-end text-xs bg-white text-black">
          <div className="text-[9px] text-black font-mono">
            Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="text-right shrink-0">
            <div className="text-[10.5px] font-bold uppercase text-black">
              {formatCompanySignature(currentProfile)}
            </div>
            <div className="text-[8.5px] uppercase tracking-wider text-black mt-3">
              AUTHORISED SIGNATURE
            </div>
          </div>
        </div>
      </div>

      <CreditSaleModal
        isOpen={isCreditSaleOpen}
        onClose={() => {
          setIsCreditSaleOpen(false);
          setEditingCreditSale(null);
        }}
        editItem={editingCreditSale}
        preselectedCustomerId={selectedCustomerId}
        onSaved={() => {
          setIsCreditSaleOpen(false);
          setEditingCreditSale(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      <ReceiptModal
        isOpen={isReceiptOpen}
        onClose={() => {
          setIsReceiptOpen(false);
          setEditingReceipt(null);
        }}
        editItem={editingReceipt}
        preselectedCustomerId={selectedCustomerId}
        onSaved={() => {
          setIsReceiptOpen(false);
          setEditingReceipt(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      <SaleProceedsModal
        isOpen={isSaleProceedsOpen}
        onClose={() => {
          setIsSaleProceedsOpen(false);
          setEditingSaleProceeds(null);
        }}
        editItem={editingSaleProceeds}
        onSaved={() => {
          setIsSaleProceedsOpen(false);
          setEditingSaleProceeds(null);
          setRefreshKey((k) => k + 1);
        }}
      />

      {isEditCustomerObOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Edit Opening Balance · {activeCustomer?.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditCustomerObOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCustomerOb} className="space-y-4 p-5">
              <DatePickerInput
                label="Opening Date"
                value={custObDate}
                onChange={setCustObDate}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Amount (₹)
                  </label>
                  <QuantityInput
                    step="any"
                    required
                    value={custObAmount}
                    onChange={(val) => setCustObAmount(val)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={custObType}
                    onChange={(e) => setCustObType(e.target.value as any)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="debit">Debit (Dr - Due)</option>
                    <option value="credit">Credit (Cr - Advance)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditCustomerObOpen(false)}
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
    </div>
  );
};
