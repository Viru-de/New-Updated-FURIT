import React, { useState } from 'react';
import { db } from '../../services/db';
import { getCustomerCrateStatement, getCustomerCrateBalanceByType } from '../../services/accounting';
import { formatDate, toIsoDate, getTodayIso, formatCompanySignature } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import { CrateTransaction, CrateLedgerEntry } from '../../types';
import { Box, Download, Printer, Plus, ArrowDownLeft, ArrowUpRight, Building2, AlertTriangle } from 'lucide-react';
import { exportCrateStatement } from '../../utils/excelEngine';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { QuantityInput } from '../common/QuantityInput';
import { formatCustomerContactsInline } from '../../utils/customerContactUtils';
import { stripLedgerCrateInOut } from '../../utils/shortPrintUtils';
import { CrateAdjustmentPrintModal } from '../print/CrateAdjustmentPrintModal';

interface CrateStatementViewProps {
  initialCustomerId?: string;
}

export const CrateStatementView: React.FC<CrateStatementViewProps> = ({
  initialCustomerId,
}) => {
  const customers = db.getCustomers();
  const crateTypes = db.getCrateTypes();
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile() || profiles[0];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const currentProfile = profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const [selectedCustomerId, setSelectedCustomerId] = useState(
    initialCustomerId || customers[0]?.id || ''
  );
  const [, setRefreshKey] = useState(0);

  React.useEffect(() => {
    if (initialCustomerId) {
      setSelectedCustomerId(initialCustomerId);
    }
  }, [initialCustomerId]);

  React.useEffect(() => {
    return db.subscribe(() => setRefreshKey((k) => k + 1));
  }, []);

  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Manual crate adjustment modal
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'Return' | 'Manual Adjustment'>('Return');
  const [adjustDate, setAdjustDate] = useState(getTodayIso());
  const [adjustCrateTypeId, setAdjustCrateTypeId] = useState<string>('');
  const [inQty, setInQty] = useState<number | ''>(0);
  const [outQty, setOutQty] = useState<number | ''>(0);
  const [adjustNotes, setAdjustNotes] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [printingCrateTx, setPrintingCrateTx] = useState<{
    tx: CrateTransaction;
    entry?: CrateLedgerEntry;
  } | null>(null);
  const [selectedModalTxId, setSelectedModalTxId] = useState<string>('');

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  const manualCrateTransactions = selectedCustomerId
    ? db
        .getCrateTransactions()
        .filter(
          (tx) =>
            tx.customerId === selectedCustomerId &&
            (tx.referenceType === 'Return' || tx.referenceType === 'Manual Adjustment')
        )
    : [];

  const sortedManualCrateTxs = [...manualCrateTransactions].sort(
    (a, b) =>
      (b.date || '').localeCompare(a.date || '') ||
      (b.createdAt || '').localeCompare(a.createdAt || '')
  );

  const manualCrateTxById = new Map<string, CrateTransaction>(
    manualCrateTransactions.map((tx) => [tx.id, tx] as [string, CrateTransaction])
  );

  const statement = selectedCustomerId
    ? getCustomerCrateStatement(selectedCustomerId, {
        startDate: filterStartDate ? toIsoDate(filterStartDate) : undefined,
        endDate: filterEndDate ? toIsoDate(filterEndDate) : undefined,
      })
    : { customer: undefined, entries: [], closingCrates: 0, crateWeightKg: 20, closingTotalKg: 0, typeBalances: [] };

  const activeTypeBalances = (statement.typeBalances || []).filter(
    (tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0
  );
  const totalIssued = statement.entries.reduce((sum, e) => sum + (Number(e.outQuantity) || 0), 0);
  const totalReturned = statement.entries.reduce((sum, e) => sum + (Number(e.inQuantity) || 0), 0);

  const rawCustomerAddrParts = [activeCustomer?.address, activeCustomer?.city, activeCustomer?.state]
    .map((part) => (part || '').trim())
    .filter(Boolean);
  const customerAddressParts: string[] = [];
  for (const part of rawCustomerAddrParts) {
    const lowerPart = part.toLowerCase();
    if (!customerAddressParts.some((existing) => existing.toLowerCase().includes(lowerPart))) {
      customerAddressParts.push(part);
    }
  }
  const customerAddressLine = customerAddressParts.join(', ');
  const customerContactLine = activeCustomer ? formatCustomerContactsInline(activeCustomer) : '';
  const statementPeriodLabel =
    filterStartDate || filterEndDate
      ? `${filterStartDate ? formatDate(filterStartDate) : 'Opening'} to ${filterEndDate ? formatDate(filterEndDate) : 'Today'}`
      : 'Complete Statement (All Transactions)';

  const effectiveAdjustCrateTypeId = adjustCrateTypeId || activeCustomer?.crateTypeId || crateTypes[0]?.id || '';
  const selectedAdjustCrateType = crateTypes.find((c) => c.id === effectiveAdjustCrateTypeId) || crateTypes[0];

  // Current balance for the selected crate type
  const currentTypeBalance = selectedCustomerId && effectiveAdjustCrateTypeId
    ? getCustomerCrateBalanceByType(selectedCustomerId, effectiveAdjustCrateTypeId).balance
    : 0;

  const isReturn = adjustType === 'Return' || (Number(inQty) > 0 && Number(outQty) === 0);
  const isExcessReturn = isReturn && Number(inQty) > currentTypeBalance;

  const handleOpenAdjustmentModal = () => {
    setAdjustCrateTypeId(activeCustomer?.crateTypeId || crateTypes[0]?.id || '');
    setInQty(0);
    setOutQty(0);
    setAdjustNotes('');
    setValidationError(null);
    setSelectedModalTxId('');
    setIsAdjustmentModalOpen(true);
  };

  const selectedModalTx = selectedModalTxId
    ? manualCrateTxById.get(selectedModalTxId)
    : undefined;

  const hasFormDraftQty = (Number(inQty) || 0) > 0 || (Number(outQty) || 0) > 0;
  const canPrintInModal = Boolean(
    selectedModalTx || hasFormDraftQty || sortedManualCrateTxs.length > 0
  );

  const handlePrintFromAdjustmentModal = (explicitSavedTx?: CrateTransaction) => {
    if (!selectedCustomerId) return;

    const targetSavedTx = explicitSavedTx || selectedModalTx;
    if (targetSavedTx) {
      const matchedEntry = statement.entries.find((e) => e.id === targetSavedTx.id);
      setPrintingCrateTx({ tx: targetSavedTx, entry: matchedEntry });
      return;
    }

    const returnVal = Number(inQty) || 0;
    const issueVal = Number(outQty) || 0;
    if (returnVal > 0 || issueVal > 0) {
      const ct = selectedAdjustCrateType;
      const weightKg = ct?.defaultWeightKg || 20;
      const projectedTotalBalance = statement.closingCrates + issueVal - returnVal;
      const projectedTypeBalance = currentTypeBalance + issueVal - returnVal;
      const draftTx: CrateTransaction = {
        id: `preview-draft-${Date.now()}`,
        customerId: selectedCustomerId,
        customerName: activeCustomer ? activeCustomer.name : '',
        date: adjustDate,
        referenceType: adjustType,
        referenceNo: '',
        crateTypeId: ct?.id || 'ct_20',
        crateName: ct?.name || 'Standard Crate',
        inQuantity: returnVal,
        outQuantity: issueVal,
        balanceQuantity: projectedTotalBalance,
        weightKgPerCrate: weightKg,
        totalKg: projectedTotalBalance * weightKg,
        notes: adjustNotes.trim(),
        createdAt: new Date().toISOString(),
      };
      const draftEntry: CrateLedgerEntry = {
        id: draftTx.id,
        date: draftTx.date,
        particulars: `${adjustType}: ${draftTx.notes}`.trim(),
        referenceNo: '',
        crateTypeId: draftTx.crateTypeId,
        crateName: draftTx.crateName || 'Crate',
        inQuantity: returnVal,
        outQuantity: issueVal,
        balance: projectedTotalBalance,
        typeBalance: projectedTypeBalance,
        weightKg,
        totalKg: projectedTotalBalance * weightKg,
      };
      setPrintingCrateTx({ tx: draftTx, entry: draftEntry });
      return;
    }

    if (sortedManualCrateTxs[0]) {
      const latestTx = sortedManualCrateTxs[0];
      const matchedEntry = statement.entries.find((e) => e.id === latestTx.id);
      setPrintingCrateTx({ tx: latestTx, entry: matchedEntry });
    }
  };

  const handlePrint = () => {
    triggerPrint('a4', 'crate-statement-print-area');
  };

  const handleExportCsv = () => {
    if (!activeCustomer) return;
    const headers = ['Date', 'Particulars', 'Reference', 'Crate Type', 'IN (Crates)', 'OUT (Crates)', 'Type Balance', 'Total Balance', 'Weight (KG)', 'Total (KG)'];
    const rows = statement.entries.map((e) => [
      formatDate(e.date),
      `"${e.particulars}"`,
      e.referenceNo,
      `"${e.crateName || 'Crate'}"`,
      e.inQuantity || '0',
      e.outQuantity || '0',
      e.typeBalance !== undefined ? e.typeBalance : e.balance,
      e.balance,
      e.weightKg,
      e.totalKg,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Crate_Statement_${activeCustomer.name}_${getTodayIso()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) return;

    const ct = selectedAdjustCrateType;
    const returnVal = Number(inQty) || 0;
    const issueVal = Number(outQty) || 0;

    // Validation: Do not silently accept returns that exceed the quantity issued for that crate type
    if ((adjustType === 'Return' || returnVal > 0) && returnVal > currentTypeBalance) {
      setValidationError(
        `Validation Warning: Return quantity (${returnVal}) exceeds issued balance (${currentTypeBalance}) for ${ct?.name}. Cannot return more crates than issued for this crate type.`
      );
      return;
    }

    const manualTx: CrateTransaction = {
      id: `ct-${Date.now()}`,
      customerId: selectedCustomerId,
      customerName: activeCustomer ? activeCustomer.name : '',
      date: adjustDate,
      referenceType: adjustType,
      referenceNo: `CR-${Date.now().toString().slice(-4)}`,
      crateTypeId: ct?.id || 'ct_20',
      crateName: ct?.name || 'Standard Crate',
      inQuantity: returnVal,
      outQuantity: issueVal,
      balanceQuantity: 0,
      weightKgPerCrate: ct?.defaultWeightKg || 20,
      totalKg: 0,
      notes: adjustNotes || 'Empty crates returned to Mandi yard',
      createdAt: new Date().toISOString(),
    };

    db.saveCrateTransaction(manualTx);
    setIsAdjustmentModalOpen(false);
    setInQty(0);
    setOutQty(0);
    setAdjustNotes('');
    setValidationError(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Box className="h-5 w-5 text-sky-600" /> Crate Ledger & Statement
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={handleOpenAdjustmentModal}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Plus className="h-3.5 w-3.5 text-sky-600" /> Return / Adjust Crate
          </button>
          <button
            type="button"
            onClick={() => exportCrateStatement(activeCustomer?.id)}
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
            elementId="crate-statement-print-area"
            filename={`Crate_Statement_${(activeCustomer?.name || 'Customer').replace(/\s+/g, '_')}`}
            customerMobile={activeCustomer?.mobile}
            title={`Customer Crate Statement - ${activeCustomer?.name || 'Customer'}`}
            summaryText={`Customer: ${activeCustomer?.name || 'Customer'}\nDate: ${formatDate(getTodayIso())}\nClosing Crates: ${statement.closingCrates} Crates\nTotal Weight: ${statement.closingTotalKg} KG`}
          />
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print Statement
          </button>
        </div>
      </div>

      {/* Customer Selector & Visual Formula Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-5">
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Select Customer
            </label>
            <CustomerAutocomplete
              valueCustomerId={selectedCustomerId}
              onChange={(c) => {
                setSelectedCustomerId(c ? c.id : '');
              }}
              placeholder="Search customer name, mobile or city..."
            />
          </div>

          <div className="md:col-span-7 bg-sky-50 border border-sky-100 erp-dark-panel rounded-lg p-3 dark:border-sky-400/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {activeCustomer && (
                  <CustomerAvatar
                    photo={activeCustomer.photo}
                    name={activeCustomer.name}
                    size="md"
                  />
                )}
                <div>
                  <span className="block text-xs font-medium text-sky-800 dark:text-sky-200">
                    Current Customer Crate Balance
                  </span>
                  <span className="text-sm font-bold text-sky-950 dark:text-white">
                    {activeCustomer?.name}
                  </span>
                  {activeCustomer?.mobile && (
                    <span className="block text-[11px] text-sky-700 dark:text-sky-200">
                      Mob: {activeCustomer.mobile} {activeCustomer.city ? `· ${activeCustomer.city}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base sm:text-lg font-bold font-mono-numbers text-sky-900 dark:text-white">
                  Total: {statement.closingCrates} Crates
                </div>
                <div className="text-[11px] text-sky-600 dark:text-sky-200">
                  Weight Equivalent: {statement.closingTotalKg} KG
                </div>
              </div>
            </div>

            {/* Individual Crate-Type Balances Breakdown */}
            <div className="mt-3 pt-2.5 border-t border-sky-200/70 dark:border-slate-400/40">
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-900 dark:text-sky-200 mb-1.5">
                Crate-Type Breakdown (Tracked Separately)
              </div>
              <div className="flex flex-wrap gap-2">
                {statement.typeBalances && statement.typeBalances.length > 0 ? (
                  statement.typeBalances
                    .filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0)
                    .map((tb) => (
                      <div
                        key={tb.crateTypeId}
                        className="erp-dark-card flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-xs font-mono shadow-2xs border border-sky-200 dark:border-sky-700/60"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">{tb.crateName}:</span>
                        <span className="text-slate-500 dark:text-slate-300 text-[11px]">
                          {tb.issued} Out - {tb.returned} In
                        </span>
                        <span className="text-slate-400">=</span>
                        <span
                          className={`font-black ${
                            tb.balance > 0
                              ? 'text-sky-700 dark:text-sky-300'
                              : tb.balance < 0
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-slate-500 dark:text-slate-300'
                          }`}
                        >
                          {tb.balance} Bal
                        </span>
                      </div>
                    ))
                ) : null}
                {(!statement.typeBalances ||
                  statement.typeBalances.filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0).length === 0) && (
                  <span className="text-xs text-sky-700 dark:text-sky-200 italic">
                    No individual crate types active. Combined balance: {statement.closingCrates} Crates.
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Date Filter */}
        <div className="mt-3 flex flex-wrap items-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="w-40">
            <DatePickerInput
              label="From Date"
              value={filterStartDate}
              onChange={setFilterStartDate}
            />
          </div>
          <div className="w-40">
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
              className="mb-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Crate Statement Table */}
      <div
        id="crate-statement-print-area"
        data-dynamic-page-numbers="true"
        className="crate-statement-modern-print rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden erp-print-area"
      >
        {/* Modern Printable Statement Header & Customer Information Section */}
        <div className="hidden print:block crate-stmt-doc-header pt-0.5 px-1 pb-2.5 mb-2">
          <PrintBusinessHeader
            profile={currentProfile}
            variant="ledger-centered"
            className="crate-stmt-business-header pb-2 mb-2"
          />

          <div className="crate-stmt-title-band border-y border-black py-1 px-2 mb-2 flex items-center justify-between gap-3 bg-slate-100">
            <span className="crate-stmt-title-text text-[14.5px] font-black uppercase tracking-[0.16em] text-black">
              CUSTOMER CRATE STATEMENT
            </span>
            <span className="crate-stmt-date-badge text-[11.5px] font-bold text-black tabular-nums whitespace-nowrap">
              Statement Date: {formatDate(getTodayIso())}
            </span>
          </div>

          <div className="crate-stmt-info-grid grid grid-cols-12 border border-slate-400 rounded-md overflow-hidden bg-white">
            <div className="crate-stmt-customer-col col-span-7 p-2.5 pr-3 bg-white">
              <div className="crate-stmt-info-eyebrow text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-slate-600 mb-0.5">
                CUSTOMER DETAILS
              </div>
              <div className="crate-stmt-party-name text-[15px] font-black uppercase text-black leading-snug">
                M/s. {activeCustomer?.name || 'Customer'}
              </div>
              {customerAddressLine && (
                <div className="crate-stmt-info-line text-[12px] font-bold text-black leading-snug mt-0.5">
                  {customerAddressLine}
                </div>
              )}
              {customerContactLine && (
                <div className="crate-stmt-info-line text-[12px] font-bold text-black leading-snug mt-0.5 tabular-nums">
                  Contact: {customerContactLine}
                </div>
              )}
            </div>

            <div className="crate-stmt-summary-col col-span-5 p-2.5 pl-3 border-l border-slate-300 bg-slate-50 flex flex-col justify-between gap-1">
              <div className="crate-stmt-info-eyebrow text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-slate-600">
                STATEMENT SUMMARY
              </div>
              <div className="crate-stmt-summary-row flex items-baseline justify-between gap-2 text-[11.5px] text-black">
                <span className="font-semibold">Period:</span>
                <span className="font-bold text-right tabular-nums">{statementPeriodLabel}</span>
              </div>
              <div className="crate-stmt-summary-row flex items-baseline justify-between gap-2 text-[12px] text-black pt-1 border-t border-slate-300">
                <span className="font-bold">Closing Crate Balance:</span>
                <span className="crate-stmt-summary-highlight font-black text-[13.5px] text-right tabular-nums">
                  {statement.closingCrates} {statement.closingCrates === 1 ? 'Crate' : 'Crates'}
                </span>
              </div>
              <div className="crate-stmt-summary-row flex items-baseline justify-between gap-2 text-[12px] text-black">
                <span className="font-bold">Total Crates / Total KG:</span>
                <span className="crate-stmt-summary-highlight font-black text-[13px] text-right tabular-nums">
                  {statement.closingCrates} Crates / {statement.closingTotalKg} KG
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse crate-stmt-table">
            <colgroup>
              <col style={{ width: '12%' }} />
              <col style={{ width: '22%' }} />
              <col style={{ width: '12.5%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '11.5%' }} />
              <col style={{ width: '10.5%' }} />
              <col style={{ width: '11.5%' }} />
              <col style={{ width: '10%' }} />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                <th className="px-3 py-3.5 text-center align-middle">Date</th>
                <th className="px-3 py-3.5 text-center align-middle">Particulars / Reference</th>
                <th className="px-3 py-3.5 text-center align-middle">Crate Type</th>
                <th className="px-2.5 py-3.5 text-center align-middle">
                  <span className="print:hidden">OUT (Issued)</span>
                  <span className="hidden print:inline">Issued</span>
                </th>
                <th className="px-2.5 py-3.5 text-center align-middle">
                  <span className="print:hidden">IN (Returned)</span>
                  <span className="hidden print:inline">Returned</span>
                </th>
                <th className="px-2.5 py-3.5 text-center align-middle">Type Balance</th>
                <th className="px-3 py-3.5 text-center align-middle">Total Balance</th>
                <th className="px-3 py-3.5 text-center align-middle">Total KG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {statement.entries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-xs text-slate-500">
                    No crate movements found for this customer.
                  </td>
                </tr>
              ) : (
                statement.entries.map((entry) => {
                  const isOb =
                    entry.id.startsWith('ob-') ||
                    entry.particulars.startsWith('Opening Crate Balance');
                  const manualTx = !isOb ? manualCrateTxById.get(entry.id) : undefined;
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40 ${
                        isOb ? 'crate-stmt-ob-row bg-sky-50/40 font-medium dark:bg-sky-950/30' : ''
                      }`}
                    >
                      <td className="px-3 py-3 font-mono-numbers text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap align-middle">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-3 py-3 text-slate-900 dark:text-slate-100 align-middle">
                        <div
                          className={`crate-stmt-particulars font-bold text-sm tracking-tight leading-snug ${
                            isOb ? 'text-sky-900 dark:text-sky-200 font-bold' : 'text-slate-950 dark:text-slate-100'
                          }`}
                        >
                          <span className="print:hidden">{entry.particulars}</span>
                          <span className="hidden print:inline">
                            {stripLedgerCrateInOut(entry.particulars) || entry.particulars}
                          </span>
                        </div>
                        {((entry.referenceNo && entry.referenceNo !== 'OB') || manualTx) && (
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {entry.referenceNo && entry.referenceNo !== 'OB' && (
                              <span className="crate-stmt-ref text-[11px] text-slate-500 font-mono">
                                Ref: {entry.referenceNo}
                              </span>
                            )}
                            {manualTx && (
                              <button
                                type="button"
                                data-crate-tx-print-id={manualTx.id}
                                onClick={() => setPrintingCrateTx({ tx: manualTx, entry })}
                                title={`Print individual ${
                                  manualTx.referenceType === 'Return'
                                    ? 'Crate Return'
                                    : 'Crate Adjustment'
                                } statement`}
                                className="print:hidden no-print inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 hover:bg-sky-100 hover:border-sky-400 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900/70 transition-colors cursor-pointer shrink-0"
                              >
                                <Printer className="h-3 w-3" />
                                <span>Print</span>
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center align-middle">
                        <span className="crate-stmt-type-pill inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono bg-sky-50 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200 border border-sky-300 dark:border-sky-800">
                          {entry.crateName || 'Crate'}
                        </span>
                      </td>
                      {/* Issued */}
                      <td className="crate-stmt-issued-cell px-2.5 py-3 text-center font-mono-numbers text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400 align-middle whitespace-nowrap">
                        {entry.outQuantity > 0 ? (
                          <span className="crate-stmt-qty-badge inline-flex w-full items-center justify-center gap-1 font-bold leading-none">
                            <ArrowUpRight className="crate-stmt-dir-icon h-3 w-3 shrink-0" />
                            <span>{entry.outQuantity}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      {/* Returned */}
                      <td className="crate-stmt-returned-cell px-2.5 py-3 text-center font-mono-numbers text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400 align-middle whitespace-nowrap">
                        {entry.inQuantity > 0 ? (
                          <span className="crate-stmt-qty-badge inline-flex w-full items-center justify-center gap-1 font-bold leading-none">
                            <ArrowDownLeft className="crate-stmt-dir-icon h-3 w-3 shrink-0" />
                            <span>{entry.inQuantity}</span>
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      {/* Type Balance */}
                      <td className="px-2.5 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-sky-800 dark:text-sky-300 align-middle whitespace-nowrap">
                        {entry.typeBalance !== undefined ? `${entry.typeBalance}` : `${entry.balance}`}
                      </td>
                      {/* Total Balance (Crates) */}
                      <td className="px-3 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-slate-900 dark:text-white align-middle whitespace-nowrap">
                        {entry.balance} {entry.balance === 1 ? 'Crate' : 'Crates'}
                      </td>
                      {/* Total KG */}
                      <td className="px-3 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400 align-middle whitespace-nowrap">
                        {entry.totalKg} KG
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="crate-stmt-total-row border-t-2 border-slate-300 bg-slate-50/90 font-bold dark:border-slate-700 dark:bg-slate-800/80">
                <td colSpan={3} className="px-3 py-3 text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300 align-middle">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-extrabold">Closing Crate Summary</span>
                    <div className="print:hidden flex flex-wrap gap-2 font-mono text-xs normal-case">
                      {activeTypeBalances.map((tb) => (
                        <span
                          key={tb.crateTypeId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200 border border-sky-300 dark:border-sky-800"
                        >
                          <strong>{tb.crateName}:</strong> {tb.balance}
                        </span>
                      ))}
                    </div>
                  </div>
                </td>
                <td className="px-2.5 py-3 text-center font-mono-numbers text-sm font-extrabold text-slate-900 dark:text-white align-middle whitespace-nowrap">
                  {totalIssued > 0 ? totalIssued : '-'}
                </td>
                <td className="px-2.5 py-3 text-center font-mono-numbers text-sm font-extrabold text-slate-900 dark:text-white align-middle whitespace-nowrap">
                  {totalReturned > 0 ? totalReturned : '-'}
                </td>
                <td className="px-2.5 py-3 text-right text-xs font-extrabold uppercase tracking-wide text-slate-600 dark:text-slate-300 align-middle whitespace-nowrap">
                  <span className="hidden print:inline">Closing</span>
                  <span className="print:hidden">-</span>
                </td>
                <td className="px-3 py-3 text-right font-mono-numbers text-base font-black text-slate-900 dark:text-white align-middle whitespace-nowrap">
                  {statement.closingCrates} {statement.closingCrates === 1 ? 'Crate' : 'Crates'}
                </td>
                <td className="px-3 py-3 text-right font-mono-numbers text-base font-black text-sky-700 dark:text-sky-300 align-middle whitespace-nowrap">
                  {statement.closingTotalKg} KG
                </td>
              </tr>

              {/* Printable Closing Crate Summary Card & Authorised Signature inside tfoot so multi-page prints keep them together on final page */}
              <tr className="ledger-closing-meta-row hidden print:table-row bg-white text-black">
                <td colSpan={8} className="ledger-closing-meta-cell p-0 pt-2.5 bg-white text-black">
                  <div className="crate-stmt-closing-card border border-slate-400 rounded-md p-2.5 bg-slate-50 flex items-center justify-between gap-4 text-black">
                    <div className="min-w-0 flex-1">
                      <div className="crate-stmt-closing-heading text-[10.5px] font-black uppercase tracking-[0.12em] text-black mb-1">
                        Closing Crate Summary — {activeCustomer?.name || 'Customer'}
                      </div>
                      <div className="crate-stmt-type-breakdown flex flex-wrap gap-x-4 gap-y-1 text-[12px] font-bold text-black">
                        {activeTypeBalances.length > 0 ? (
                          activeTypeBalances.map((tb) => (
                            <span key={tb.crateTypeId} className="crate-stmt-type-summary-item tabular-nums">
                              {tb.crateName}: <strong>{tb.balance}</strong> {tb.balance === 1 ? 'Crate' : 'Crates'}
                            </span>
                          ))
                        ) : (
                          <span className="crate-stmt-type-summary-item tabular-nums">
                            Combined Crate Balance: <strong>{statement.closingCrates}</strong> Crates
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="crate-stmt-closing-totals shrink-0 text-right border-l border-slate-300 pl-4 tabular-nums">
                      <div className="crate-stmt-closing-line text-[12px] font-extrabold uppercase text-black">
                        Total Crates:{' '}
                        <span className="crate-stmt-closing-big text-[15px] font-black">
                          {statement.closingCrates} {statement.closingCrates === 1 ? 'Crate' : 'Crates'}
                        </span>
                      </div>
                      <div className="crate-stmt-closing-line text-[12px] font-extrabold uppercase text-black mt-0.5">
                        Total KG:{' '}
                        <span className="crate-stmt-closing-big text-[15px] font-black">
                          {statement.closingTotalKg} KG
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="crate-stmt-signatory-row px-1 pt-3 pb-1 flex justify-between items-end text-[10.5px] bg-white text-black">
                    <div className="text-[10.5px] font-medium text-black">
                      Software Developed By: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[11px] font-bold uppercase text-black">
                        {formatCompanySignature(currentProfile)}
                      </div>
                      <div className="text-[9.5px] uppercase tracking-wider text-black mt-3">
                        AUTHORISED SIGNATURE
                      </div>
                    </div>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* On-Screen Bottom Banner */}
        <div className="print:hidden flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-sky-50/60 px-6 py-4 dark:border-slate-800 dark:bg-sky-950/20">
          <div className="text-xs text-sky-800 dark:text-sky-300">
            Total Crates held by <strong>{activeCustomer?.name}</strong>: {statement.closingCrates} Crates
          </div>
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              Total Weight Equivalent:
            </span>
            <span className="font-mono-numbers text-lg font-extrabold text-sky-800 dark:text-sky-200">
              {statement.closingTotalKg} KG
            </span>
          </div>
        </div>

        {/* On-Screen Software attribution */}
        <div className="print:hidden p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs">
          <div className="text-[8px] sm:text-[8.5px] text-left text-slate-500 font-mono">
            Software Developed by: {currentProfile.softwareDevelopedBy || defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
        </div>

        {/* Dynamic Page Footer for Browser Print & PDF */}
        <div
          data-sp-page-footer="true"
          className="hidden print:flex sp-page-footer mt-2 pt-1 border-t border-slate-300 justify-between items-center text-[10.5px] font-medium text-black bg-white"
        >
          <span>{currentProfile.name || defaultProfile.name}</span>
          <span data-sp-page-number="true"></span>
        </div>
      </div>

      {/* Manual Crate Adjustment Modal */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Record Crate Return or Adjustment
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4 p-5">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer
                </label>
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  {activeCustomer?.name}
                </div>
              </div>

              {sortedManualCrateTxs.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/60 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Saved Crate Return / Adjustment Transaction
                    </label>
                    <button
                      type="button"
                      data-crate-adj-saved-print="true"
                      onClick={() =>
                        handlePrintFromAdjustmentModal(
                          selectedModalTx || sortedManualCrateTxs[0]
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/60 dark:text-sky-200 dark:hover:bg-sky-900/70 cursor-pointer shrink-0"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                  <select
                    value={selectedModalTxId}
                    onChange={(e) => setSelectedModalTxId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-900 outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  >
                    <option value="">
                      Current Form Entry (or Latest Saved:{' '}
                      {formatDate(sortedManualCrateTxs[0].date)} ·{' '}
                      {sortedManualCrateTxs[0].referenceNo || 'CR'})
                    </option>
                    {sortedManualCrateTxs.map((tx) => {
                      const txQty =
                        tx.inQuantity > 0
                          ? `${tx.inQuantity} Returned`
                          : `${tx.outQuantity} Adjusted`;
                      const txLabel =
                        tx.referenceType === 'Return'
                          ? 'Crate Return'
                          : 'Crate Adjustment';
                      return (
                        <option key={tx.id} value={tx.id}>
                          {formatDate(tx.date)} — {txLabel} —{' '}
                          {tx.crateName || 'Crate'} ({txQty})
                          {tx.referenceNo ? ` — Ref: ${tx.referenceNo}` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {selectedModalTx && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-0.5 pt-0.5">
                      <span>
                        <strong>Type:</strong>{' '}
                        {selectedModalTx.referenceType === 'Return'
                          ? 'Crate Return'
                          : 'Crate Adjustment'}
                      </span>
                      <span>
                        <strong>Crate:</strong> {selectedModalTx.crateName || 'Crate'}
                      </span>
                      <span>
                        <strong>Qty:</strong>{' '}
                        {selectedModalTx.inQuantity > 0
                          ? `${selectedModalTx.inQuantity} Returned`
                          : `${selectedModalTx.outQuantity} Adjusted`}
                      </span>
                      {selectedModalTx.referenceNo && (
                        <span>
                          <strong>Ref:</strong> {selectedModalTx.referenceNo}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Crate Type Selection with Live Type Balance */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Crate Type *
                  </label>
                  <span className="text-[11px] font-mono text-sky-700 dark:text-sky-300">
                    Current Issued Balance:{' '}
                    <strong className="underline">{currentTypeBalance}</strong>
                  </span>
                </div>
                <select
                  value={effectiveAdjustCrateTypeId}
                  onChange={(e) => {
                    setAdjustCrateTypeId(e.target.value);
                    setValidationError(null);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-medium"
                >
                  {crateTypes.map((ct) => {
                    const tb = selectedCustomerId
                      ? getCustomerCrateBalanceByType(selectedCustomerId, ct.id).balance
                      : 0;
                    return (
                      <option key={ct.id} value={ct.id}>
                        {ct.name} — Current Balance: {tb}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DatePickerInput
                  label="Date"
                  required
                  value={adjustDate}
                  onChange={setAdjustDate}
                />
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Type
                  </label>
                  <select
                    value={adjustType}
                    onChange={(e) => {
                      setAdjustType(e.target.value as any);
                      setValidationError(null);
                    }}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="Return">Empty Crate Return (IN)</option>
                    <option value="Manual Adjustment">Manual Issue (OUT)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Crate IN (Returned)
                  </label>
                  <QuantityInput
                    min={0}
                    step="any"
                    value={inQty}
                    onChange={(val) => {
                      setInQty(val);
                      if (Number(val) > currentTypeBalance && (adjustType === 'Return' || Number(val) > 0)) {
                        setValidationError(
                          `Validation Warning: Return quantity (${val}) exceeds issued balance (${currentTypeBalance}) for ${selectedAdjustCrateType?.name}. Cannot return more crates than issued.`
                        );
                      } else {
                        setValidationError(null);
                      }
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none dark:bg-slate-800 dark:text-white ${
                      isExcessReturn
                        ? 'border-rose-500 bg-rose-50/50 dark:border-rose-600 dark:bg-rose-950/30'
                        : 'border-slate-300 focus:border-sky-500 dark:border-slate-700'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Crate OUT (Issued)
                  </label>
                  <QuantityInput
                    min={0}
                    step="any"
                    value={outQty}
                    onChange={(val) => setOutQty(val)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono-numbers text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Validation Warning Alert */}
              {(validationError || isExcessReturn) && (
                <div className="rounded-lg bg-rose-50 p-3 border border-rose-200 text-xs text-rose-800 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-200 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold">Validation Warning</div>
                    <div>
                      {validationError ||
                        `Return quantity (${inQty}) exceeds issued balance (${currentTypeBalance}) for ${selectedAdjustCrateType?.name}. Customer only has ${currentTypeBalance} crates of this type.`}
                    </div>
                    <div className="text-[11px] text-rose-600 dark:text-rose-300 mt-1">
                      * Please correct the entry before saving. Crates cannot be returned in excess of issued balance.
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Notes
                </label>
                <input
                  type="text"
                  placeholder="e.g. Returned crates via tempo"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  data-crate-adj-modal-print="true"
                  disabled={!canPrintInModal}
                  onClick={() => handlePrintFromAdjustmentModal()}
                  title={
                    canPrintInModal
                      ? 'Print individual Crate Return or Adjustment statement'
                      : 'Enter crate quantity or select a saved entry to print'
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs font-semibold transition-colors ${
                    canPrintInModal
                      ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer'
                      : 'border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <Printer className="h-3.5 w-3.5 text-sky-600" />
                  <span>Print</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdjustmentModalOpen(false)}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isExcessReturn}
                    className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                      isExcessReturn
                        ? 'bg-slate-400 cursor-not-allowed opacity-60'
                        : 'bg-sky-600 hover:bg-sky-700 cursor-pointer'
                    }`}
                  >
                    Save Crate Entry
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Individual Crate Return / Adjustment Statement Print Modal */}
      {printingCrateTx && (
        <CrateAdjustmentPrintModal
          isOpen={Boolean(printingCrateTx)}
          onClose={() => setPrintingCrateTx(null)}
          transaction={printingCrateTx.tx}
          entry={printingCrateTx.entry}
          customer={activeCustomer}
          initialProfileId={selectedProfileId}
        />
      )}
    </div>
  );
};
