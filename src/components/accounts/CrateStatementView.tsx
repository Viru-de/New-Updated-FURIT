import React, { useState } from 'react';
import { db } from '../../services/db';
import { getCustomerCrateStatement, getCustomerCrateBalanceByType } from '../../services/accounting';
import { formatDate, toIsoDate, getTodayIso } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import { CrateTransaction } from '../../types';
import { Box, Download, Printer, Plus, ArrowDownLeft, ArrowUpRight, Building2, AlertTriangle } from 'lucide-react';
import { exportCrateStatement } from '../../utils/excelEngine';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { QuantityInput } from '../common/QuantityInput';

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

  const activeCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  const statement = selectedCustomerId
    ? getCustomerCrateStatement(selectedCustomerId, {
        startDate: filterStartDate ? toIsoDate(filterStartDate) : undefined,
        endDate: filterEndDate ? toIsoDate(filterEndDate) : undefined,
      })
    : { customer: undefined, entries: [], closingCrates: 0, crateWeightKg: 20, closingTotalKg: 0, typeBalances: [] };

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
    setIsAdjustmentModalOpen(true);
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
          <p className="text-xs text-slate-500">
            Independent quantity ledger: tracking empty and loaded crate movements in units & KG
          </p>
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

          <div className="md:col-span-7 bg-sky-50 border border-sky-100 rounded-lg p-3 dark:border-sky-900/50 dark:bg-sky-950/20">
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
                  <span className="block text-xs font-medium text-sky-800 dark:text-sky-300">
                    Current Customer Crate Balance
                  </span>
                  <span className="text-sm font-bold text-sky-950 dark:text-white">
                    {activeCustomer?.name}
                  </span>
                  {activeCustomer?.mobile && (
                    <span className="block text-[11px] text-sky-700 dark:text-sky-400">
                      Mob: {activeCustomer.mobile} {activeCustomer.city ? `· ${activeCustomer.city}` : ''}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <div className="text-base sm:text-lg font-bold font-mono-numbers text-sky-900 dark:text-sky-200">
                  Total: {statement.closingCrates} Crates
                </div>
                <div className="text-[11px] text-sky-600 dark:text-sky-400">
                  Weight Equivalent: {statement.closingTotalKg} KG
                </div>
              </div>
            </div>

            {/* Individual Crate-Type Balances Breakdown */}
            <div className="mt-3 pt-2.5 border-t border-sky-200/70 dark:border-sky-900/60">
              <div className="text-[11px] font-bold uppercase tracking-wider text-sky-900 dark:text-sky-300 mb-1.5">
                Crate-Type Breakdown (Tracked Separately)
              </div>
              <div className="flex flex-wrap gap-2">
                {statement.typeBalances && statement.typeBalances.length > 0 ? (
                  statement.typeBalances
                    .filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0)
                    .map((tb) => (
                      <div
                        key={tb.crateTypeId}
                        className="flex items-center gap-2 rounded-lg bg-white/90 dark:bg-slate-900/90 px-3 py-1.5 text-xs font-mono shadow-2xs border border-sky-200 dark:border-sky-800"
                      >
                        <span className="font-bold text-slate-900 dark:text-white">{tb.crateName}:</span>
                        <span className="text-slate-500 text-[11px]">
                          {tb.issued} Out - {tb.returned} In
                        </span>
                        <span className="text-slate-400">=</span>
                        <span
                          className={`font-black ${
                            tb.balance > 0
                              ? 'text-sky-700 dark:text-sky-300'
                              : tb.balance < 0
                              ? 'text-rose-600'
                              : 'text-slate-500'
                          }`}
                        >
                          {tb.balance} Bal
                        </span>
                      </div>
                    ))
                ) : null}
                {(!statement.typeBalances ||
                  statement.typeBalances.filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0).length === 0) && (
                  <span className="text-xs text-sky-700 dark:text-sky-400 italic">
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
        className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden erp-print-area print-bill-canvas"
      >
        {/* Printable Traditional Mandi Statement Header */}
        <div className="hidden print:block p-4 border-b border-black text-center mb-1">
          {currentProfile.shortCode && (
            <div className="font-bold text-xs tracking-widest uppercase text-slate-700 print:text-black">
              {currentProfile.shortCode}
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
            CUSTOMER CRATE STATEMENT
          </div>
          <div className="flex justify-between items-start text-xs mt-2 text-left border-t border-slate-300 pt-1.5">
            <div>
              <div className="font-bold text-sm">M/s. {activeCustomer?.name || 'Customer'}</div>
              {activeCustomer?.address && <div className="text-[11px]">{activeCustomer.address}</div>}
              {activeCustomer?.city && <div className="text-[11px]">{activeCustomer.city}</div>}
              {activeCustomer?.mobile && <div className="text-[11px]">Mob: {activeCustomer.mobile}</div>}
              {activeCustomer?.aadhaarNo && <div className="text-[10px]">Aadhaar: {activeCustomer.aadhaarNo}</div>}
            </div>
            <div className="text-right">
              <div>DATE: <strong>{formatDate(getTodayIso())}</strong></div>
              {(filterStartDate || filterEndDate) ? (
                <div className="text-[11px]">Period: {filterStartDate ? formatDate(filterStartDate) : 'Opening'} to {filterEndDate ? formatDate(filterEndDate) : 'Today'}</div>
              ) : (
                <div className="text-[11px]">Period: Complete Statement (All Transactions)</div>
              )}
              <div className="mt-1 font-bold">
                Closing Balance: <strong>{statement.closingCrates} Crates ({statement.closingTotalKg} KG)</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-4 py-3.5 w-28">Date</th>
                <th className="px-4 py-3.5">Particulars / Reference</th>
                <th className="px-4 py-3.5 text-center w-36">Crate Type</th>
                <th className="px-4 py-3.5 text-center w-28">OUT (Issued)</th>
                <th className="px-4 py-3.5 text-center w-28">IN (Returned)</th>
                <th className="px-4 py-3.5 text-right w-32">Type Balance</th>
                <th className="px-4 py-3.5 text-right w-32">Total Balance</th>
                <th className="px-4 py-3.5 text-right w-28">Total KG</th>
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
                  const isOb = entry.particulars === 'Opening Crate Balance';
                  return (
                    <tr
                      key={entry.id}
                      className={`hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40 ${
                        isOb ? 'bg-sky-50/20 font-medium' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono-numbers text-xs text-slate-700 dark:text-slate-300 whitespace-nowrap">
                        {formatDate(entry.date)}
                      </td>
                      <td className="px-4 py-3.5 text-slate-900 dark:text-white align-top">
                        <div className="font-bold text-sm text-slate-950 dark:text-white tracking-tight leading-snug">
                          {entry.particulars}
                        </div>
                        {entry.referenceNo && entry.referenceNo !== 'OB' && (
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                            Ref: {entry.referenceNo}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center align-top">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold font-mono bg-sky-50 text-sky-900 dark:bg-sky-950/70 dark:text-sky-200 border border-sky-300 dark:border-sky-800">
                          {entry.crateName || 'Crate'}
                        </span>
                      </td>
                      {/* OUT */}
                      <td className="px-4 py-3 text-center font-mono-numbers text-xs sm:text-sm font-semibold text-amber-600 dark:text-amber-400">
                        {entry.outQuantity > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" /> {entry.outQuantity}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      {/* IN */}
                      <td className="px-4 py-3 text-center font-mono-numbers text-xs sm:text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {entry.inQuantity > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <ArrowDownLeft className="h-3 w-3" /> {entry.inQuantity}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      {/* Type Balance */}
                      <td className="px-4 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-sky-800 dark:text-sky-300">
                        {entry.typeBalance !== undefined ? `${entry.typeBalance}` : `${entry.balance}`}
                      </td>
                      {/* Total Balance (Crates) */}
                      <td className="px-4 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {entry.balance} {entry.balance === 1 ? 'Crate' : 'Crates'}
                      </td>
                      {/* Total KG */}
                      <td className="px-4 py-3 text-right font-mono-numbers text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-400">
                        {entry.totalKg} KG
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-300 bg-slate-50/90 font-bold dark:border-slate-700 dark:bg-slate-800/80">
                <td colSpan={5} className="px-5 py-3.5 text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span>Closing Crate Summary</span>
                    <div className="flex flex-wrap gap-2 font-mono text-xs normal-case">
                      {statement.typeBalances
                        .filter((tb) => tb.issued > 0 || tb.returned > 0 || tb.balance !== 0)
                        .map((tb) => (
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
                <td colSpan={2} className="px-5 py-3.5 text-right font-mono-numbers text-base text-slate-900 dark:text-white">
                  {statement.closingCrates} Crates Total
                </td>
                <td className="px-5 py-3.5 text-right font-mono-numbers text-base text-sky-700 dark:text-sky-300">
                  {statement.closingTotalKg} KG
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Bottom Banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 bg-sky-50/60 px-6 py-4 dark:border-slate-800 dark:bg-sky-950/20">
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

        {/* Software attribution & Signatory */}
        <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-black flex justify-between items-center text-xs">
          <div className="text-[8px] sm:text-[8.5px] text-left text-slate-500 print:text-black font-mono">
            Software Developed by: {defaultProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="hidden print:block text-right font-bold uppercase text-[11px]">
            FOR, {defaultProfile.signatureTitle || defaultProfile.name}
          </div>
        </div>
      </div>

      {/* Manual Crate Adjustment Modal */}
      {isAdjustmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Record Crate Return or Adjustment
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustmentModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustmentModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isExcessReturn}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold text-white ${
                    isExcessReturn
                      ? 'bg-slate-400 cursor-not-allowed opacity-60'
                      : 'bg-sky-600 hover:bg-sky-700'
                  }`}
                >
                  Save Crate Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
