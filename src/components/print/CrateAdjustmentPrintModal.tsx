import React, { useState, useEffect } from 'react';
import {
  CompanyProfile,
  CrateLedgerEntry,
  CrateTransaction,
  Customer,
} from '../../types';
import { db } from '../../services/db';
import {
  getCustomerCrateStatement,
  getCustomerCrateBalanceByType,
} from '../../services/accounting';
import { formatDate, formatCompanySignature } from '../../utils/formatters';
import {
  Printer,
  X,
  Building2,
  Box,
  ArrowDownLeft,
  ArrowUpRight,
} from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import {
  BillPaperSize,
  getLastSelectedPaperSize,
} from '../../utils/pdfAndShareEngine';
import { formatCustomerContactsInline } from '../../utils/customerContactUtils';

interface CrateAdjustmentPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: CrateTransaction;
  entry?: CrateLedgerEntry;
  customer?: Customer;
  initialProfileId?: string;
}

export const CrateAdjustmentPrintModal: React.FC<
  CrateAdjustmentPrintModalProps
> = ({
  isOpen,
  onClose,
  transaction,
  entry,
  customer,
  initialProfileId,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile() || profiles[0];

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    initialProfileId || defaultProfile?.id || profiles[0]?.id || ''
  );
  const [pageSize, setPageSize] = useState<BillPaperSize>(() =>
    getLastSelectedPaperSize('a5')
  );
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const latestDefault = db.getDefaultProfile();
      setSelectedProfileId(
        initialProfileId || latestDefault?.id || profiles[0]?.id || ''
      );
    }
  }, [isOpen, transaction?.id, initialProfileId]);

  if (!isOpen || !transaction) return null;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) ||
    defaultProfile ||
    profiles[0];

  const headerLogo = (
    currentProfile?.logo ||
    defaultProfile?.logo ||
    '/assets/hfc_circle_logo.png'
  ).trim();

  const resolvedCustomer =
    customer ||
    (transaction.customerId
      ? db.getCustomerById(transaction.customerId)
      : undefined);
  const customerName =
    resolvedCustomer?.name || transaction.customerName || 'Customer';
  const customerContactLine = resolvedCustomer
    ? formatCustomerContactsInline(resolvedCustomer)
    : '';

  const rawAddressParts = [
    resolvedCustomer?.address,
    resolvedCustomer?.city,
    resolvedCustomer?.state,
  ]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  const dedupedAddrParts: string[] = [];
  for (const part of rawAddressParts) {
    const lower = part.toLowerCase();
    if (
      !dedupedAddrParts.some((existing) =>
        existing.toLowerCase().includes(lower)
      )
    ) {
      dedupedAddrParts.push(part);
    }
  }
  const customerAddressLine = dedupedAddrParts.join(', ');

  // Read-only statement & balance lookup (never mutates transactions or balances)
  const fullStatement = transaction.customerId
    ? getCustomerCrateStatement(transaction.customerId)
    : null;
  const matchedEntry =
    fullStatement?.entries.find((e) => e.id === transaction.id) || entry;
  const selectedTypeBalance =
    transaction.customerId && transaction.crateTypeId
      ? getCustomerCrateBalanceByType(
          transaction.customerId,
          transaction.crateTypeId
        )
      : null;

  const isCrateReturn = transaction.referenceType === 'Return';
  const txTypeLabel = isCrateReturn ? 'Crate Return' : 'Crate Adjustment';
  const statementHeading = isCrateReturn
    ? 'CRATE RETURN STATEMENT'
    : 'CRATE ADJUSTMENT STATEMENT';

  const returnedQty = Number(transaction.inQuantity) || 0;
  const issuedQty = Number(transaction.outQuantity) || 0;
  const primaryQty =
    returnedQty > 0 && issuedQty === 0
      ? returnedQty
      : issuedQty > 0 && returnedQty === 0
      ? issuedQty
      : Math.max(returnedQty, issuedQty);
  const qtyUnitLabel = primaryQty === 1 ? 'Crate' : 'Crates';

  const referenceNumber = (
    transaction.referenceNo ||
    matchedEntry?.referenceNo ||
    ''
  ).trim();
  const remarksText = (transaction.notes || '').trim();
  const crateTypeName = (
    transaction.crateName ||
    matchedEntry?.crateName ||
    'Crate'
  ).trim();

  const updatedTotalBalance =
    matchedEntry?.balance !== undefined
      ? matchedEntry.balance
      : fullStatement?.closingCrates;
  const updatedTypeBalance = matchedEntry?.typeBalance;
  const updatedTotalKg =
    matchedEntry?.totalKg !== undefined
      ? matchedEntry.totalKg
      : fullStatement?.closingTotalKg;

  const safeRefSuffix = referenceNumber
    ? `_${referenceNumber.replace(/[^a-zA-Z0-9_-]+/g, '_')}`
    : '';
  const safeFilename = `${
    isCrateReturn ? 'Crate_Return' : 'Crate_Adjustment'
  }_${customerName.replace(/\s+/g, '_')}_${transaction.date}${safeRefSuffix}`;

  const summaryShareLines = [
    `Type: ${txTypeLabel}`,
    `Date: ${formatDate(transaction.date)}`,
    `Customer: ${customerName}`,
    `Crate Type: ${crateTypeName}`,
    returnedQty > 0
      ? `Returned: ${returnedQty} ${returnedQty === 1 ? 'Crate' : 'Crates'}`
      : '',
    issuedQty > 0
      ? `Adjusted / Issued: ${issuedQty} ${issuedQty === 1 ? 'Crate' : 'Crates'}`
      : '',
    referenceNumber ? `Ref No: ${referenceNumber}` : '',
    remarksText ? `Remarks: ${remarksText}` : '',
    updatedTotalBalance !== undefined
      ? `Updated Balance: ${updatedTotalBalance} ${
          updatedTotalBalance === 1 ? 'Crate' : 'Crates'
        }`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const isDraftPreview = transaction.id.startsWith('preview-draft-');

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-hidden">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] max-h-[90dvh] rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Preview Controls Bar (Hidden on Print & PDF) */}
        <div className="shrink-0 flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 gap-2 sm:gap-3 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5 text-sky-600" />
              {txTypeLabel} Print Preview
            </span>

            <div className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <select
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                className="rounded border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}{' '}
                    {p.shortName || p.shortCode
                      ? `(${p.shortName || p.shortCode})`
                      : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-1 text-xs">
              {(['compact', 'b7', 'b6', 'a5', 'a4'] as BillPaperSize[]).map(
                (sizeKey) => (
                  <button
                    key={sizeKey}
                    type="button"
                    onClick={() => setPageSize(sizeKey)}
                    className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded text-[11px] sm:text-xs font-semibold cursor-pointer transition-all ${
                      pageSize === sizeKey
                        ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow-2xs font-bold'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {sizeKey === 'compact' ? 'Compact' : sizeKey.toUpperCase()}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BillShareButtons
              elementId="crate-adjustment-print-area"
              filename={safeFilename}
              customerMobile={resolvedCustomer?.mobile}
              title={`${txTypeLabel} Statement - ${customerName}`}
              summaryText={summaryShareLines}
              defaultPaperSize={pageSize}
              onPaperSizeChange={setPageSize}
            />
            <button
              type="button"
              onClick={() => setIsFormatModalOpen(true)}
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 cursor-pointer"
              aria-label="Close print preview"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Individual Crate Return / Adjustment Statement Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 flex justify-center items-start bg-slate-100 dark:bg-slate-950">
          <div
            id="crate-adjustment-print-area"
            data-paper-size={pageSize}
            data-theme-isolated="true"
            data-crate-tx-id={transaction.id}
            className={`crate-statement-modern-print crate-adjustment-modern-print bg-white text-slate-900 border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 box-border shadow-sm print-bill-canvas ${
              pageSize === 'a4'
                ? 'max-w-[730px] w-full text-[12px] pt-2 px-5 pb-5 sm:pt-3 sm:px-6 sm:pb-6'
                : pageSize === 'a5'
                ? 'max-w-[550px] w-full text-[10.5px] pt-1.5 px-3.5 pb-4 sm:pt-2 sm:px-4 sm:pb-4'
                : pageSize === 'b6'
                ? 'max-w-[430px] w-full text-[10px] pt-1 px-2.5 pb-2 sm:px-3'
                : pageSize === 'b7'
                ? 'max-w-[300px] w-full text-[8.5px] pt-0.5 px-1.5 pb-1.5'
                : 'max-w-[490px] w-full text-[11px] pt-1 px-3.5 pb-3.5 sm:pt-1.5 sm:px-4 sm:pb-4'
            }`}
            style={{
              fontFamily:
                "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif",
            }}
          >
            {/* Centered HKC Company Header with Logo */}
            <div className="crate-adj-business-header text-center border-b border-black pb-2 mb-2">
              {headerLogo && (
                <div className="flex justify-center mb-1">
                  <img
                    src={headerLogo}
                    alt={
                      currentProfile?.shortName ||
                      currentProfile?.shortCode ||
                      currentProfile?.name ||
                      'HKC Logo'
                    }
                    className={`crate-adj-header-logo block object-contain rounded-full ${
                      pageSize === 'b7'
                        ? 'w-8 h-8'
                        : pageSize === 'b6'
                        ? 'w-10 h-10'
                        : pageSize === 'a5'
                        ? 'w-11 h-11'
                        : 'w-12 h-12'
                    }`}
                  />
                </div>
              )}
              <PrintBusinessHeader
                profile={currentProfile}
                variant="ledger-centered"
                paperSize={pageSize}
                className="border-b-0 pb-0 mb-0 pt-0"
              />
            </div>

            {/* Statement Title Band */}
            <div
              className={`crate-stmt-title-band border-y border-black bg-slate-100 flex items-center justify-between gap-2 ${
                pageSize === 'b7'
                  ? 'py-0.5 px-1.5 mb-1.5'
                  : pageSize === 'b6'
                  ? 'py-1 px-2 mb-2'
                  : 'py-1 px-2.5 mb-2.5'
              }`}
            >
              <span
                className={`crate-stmt-title-text font-black uppercase tracking-[0.12em] text-black ${
                  pageSize === 'b7'
                    ? 'text-[9px]'
                    : pageSize === 'b6'
                    ? 'text-[10.5px]'
                    : 'text-[13px]'
                }`}
              >
                {statementHeading}
              </span>
              <span
                className={`crate-stmt-date-badge font-bold text-black tabular-nums whitespace-nowrap ${
                  pageSize === 'b7'
                    ? 'text-[8px]'
                    : pageSize === 'b6'
                    ? 'text-[9.5px]'
                    : 'text-[11px]'
                }`}
              >
                Date: {formatDate(transaction.date)}
              </span>
            </div>

            {/* Customer Details & Transaction Summary Grid */}
            <div
              className={`crate-stmt-info-grid grid grid-cols-12 border border-slate-400 rounded-md overflow-hidden bg-white ${
                pageSize === 'b7' ? 'mb-1.5' : pageSize === 'b6' ? 'mb-2' : 'mb-3'
              }`}
            >
              <div
                className={`crate-stmt-customer-col col-span-7 bg-white ${
                  pageSize === 'b7'
                    ? 'p-1.5'
                    : pageSize === 'b6'
                    ? 'p-2'
                    : 'p-2.5 pr-3'
                }`}
              >
                <div
                  className={`crate-stmt-info-eyebrow font-extrabold uppercase tracking-[0.1em] text-slate-600 mb-0.5 ${
                    pageSize === 'b7' ? 'text-[7px]' : 'text-[9px]'
                  }`}
                >
                  CUSTOMER DETAILS
                </div>
                <div
                  className={`crate-stmt-party-name font-black uppercase text-black leading-snug ${
                    pageSize === 'b7'
                      ? 'text-[10px]'
                      : pageSize === 'b6'
                      ? 'text-[11.5px]'
                      : 'text-[14px]'
                  }`}
                >
                  M/s. {customerName}
                </div>
                {customerAddressLine && (
                  <div
                    className={`crate-stmt-info-line font-bold text-black leading-snug mt-0.5 ${
                      pageSize === 'b7' ? 'text-[7.5px]' : 'text-[11px]'
                    }`}
                  >
                    {customerAddressLine}
                  </div>
                )}
                <div
                  className={`crate-stmt-info-line font-bold text-black leading-snug mt-0.5 tabular-nums ${
                    pageSize === 'b7' ? 'text-[7.5px]' : 'text-[11px]'
                  }`}
                >
                  Contact: {customerContactLine || '-'}
                </div>
              </div>

              <div
                className={`crate-stmt-summary-col col-span-5 border-l border-slate-300 bg-slate-50 flex flex-col justify-between gap-1 ${
                  pageSize === 'b7'
                    ? 'p-1.5'
                    : pageSize === 'b6'
                    ? 'p-2'
                    : 'p-2.5 pl-3'
                }`}
              >
                <div
                  className={`crate-stmt-info-eyebrow font-extrabold uppercase tracking-[0.1em] text-slate-600 ${
                    pageSize === 'b7' ? 'text-[7px]' : 'text-[9px]'
                  }`}
                >
                  TRANSACTION DETAILS
                </div>
                <div
                  className={`crate-stmt-summary-row flex items-baseline justify-between gap-2 text-black ${
                    pageSize === 'b7' ? 'text-[7.5px]' : 'text-[11px]'
                  }`}
                >
                  <span className="font-semibold">Date:</span>
                  <span className="font-bold text-right tabular-nums">
                    {formatDate(transaction.date)}
                  </span>
                </div>
                <div
                  className={`crate-stmt-summary-row flex items-baseline justify-between gap-2 text-black ${
                    pageSize === 'b7' ? 'text-[7.5px]' : 'text-[11px]'
                  }`}
                >
                  <span className="font-semibold">Type:</span>
                  <span className="font-bold text-right">{txTypeLabel}</span>
                </div>
                {referenceNumber && (
                  <div
                    className={`crate-stmt-summary-row flex items-baseline justify-between gap-2 text-black ${
                      pageSize === 'b7' ? 'text-[7.5px]' : 'text-[11px]'
                    }`}
                  >
                    <span className="font-semibold">Ref No:</span>
                    <span className="font-bold text-right tabular-nums">
                      {referenceNumber}
                    </span>
                  </div>
                )}
                {updatedTotalBalance !== undefined && (
                  <div
                    className={`crate-stmt-summary-row flex items-baseline justify-between gap-2 text-black pt-1 border-t border-slate-300 ${
                      pageSize === 'b7' ? 'text-[8px]' : 'text-[11.5px]'
                    }`}
                  >
                    <span className="font-bold">Updated Balance:</span>
                    <span className="font-black text-right tabular-nums">
                      {updatedTotalBalance}{' '}
                      {updatedTotalBalance === 1 ? 'Crate' : 'Crates'}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Individual Transaction Details Table */}
            <table
              className={`crate-adj-table w-full border-collapse border border-black ${
                pageSize === 'b7'
                  ? 'text-[8px] mb-1.5'
                  : pageSize === 'b6'
                  ? 'text-[9.5px] mb-2'
                  : 'text-xs mb-3'
              }`}
            >
              <colgroup>
                <col style={{ width: '26%' }} />
                <col style={{ width: '24%' }} />
                <col style={{ width: '26%' }} />
                <col style={{ width: '24%' }} />
              </colgroup>
              <thead>
                <tr className="bg-slate-100 border-b border-black">
                  <th
                    className={`text-center font-extrabold uppercase text-black border-r border-slate-400 align-middle ${
                      pageSize === 'b7' ? 'px-1 py-1' : 'px-2.5 py-2'
                    }`}
                  >
                    Transaction Type
                  </th>
                  <th
                    className={`text-center font-extrabold uppercase text-black border-r border-slate-400 align-middle ${
                      pageSize === 'b7' ? 'px-1 py-1' : 'px-2.5 py-2'
                    }`}
                  >
                    Crate Type
                  </th>
                  <th
                    className={`text-center font-extrabold uppercase text-black border-r border-slate-400 align-middle ${
                      pageSize === 'b7' ? 'px-1 py-1' : 'px-2.5 py-2'
                    }`}
                  >
                    {isCrateReturn
                      ? 'Returned Crates'
                      : 'Adjusted Crates'}
                  </th>
                  <th
                    className={`text-center font-extrabold uppercase text-black align-middle ${
                      pageSize === 'b7' ? 'px-1 py-1' : 'px-2.5 py-2'
                    }`}
                  >
                    Updated Balance
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white border-b border-slate-300">
                  <td
                    className={`text-center font-bold text-black border-r border-slate-400 align-middle ${
                      pageSize === 'b7' ? 'px-1 py-1.5' : 'px-2.5 py-2.5'
                    }`}
                  >
                    {txTypeLabel}
                  </td>
                  <td
                    className={`text-center font-bold text-black border-r border-slate-400 align-middle ${
                      pageSize === 'b7' ? 'px-1 py-1.5' : 'px-2.5 py-2.5'
                    }`}
                  >
                    {crateTypeName}
                  </td>
                  <td
                    className={`text-center font-black text-black border-r border-slate-400 align-middle tabular-nums ${
                      pageSize === 'b7'
                        ? 'px-1 py-1.5 text-[8.5px]'
                        : 'px-2.5 py-2.5 text-[13px]'
                    }`}
                  >
                    {returnedQty > 0 && issuedQty > 0 ? (
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <span className="crate-stmt-qty-badge inline-flex items-center justify-center gap-1">
                          <ArrowDownLeft className="crate-stmt-dir-icon h-3 w-3 shrink-0 text-emerald-700 print:text-black" />
                          <span>
                            {returnedQty}{' '}
                            {returnedQty === 1 ? 'Crate' : 'Crates'} (Returned)
                          </span>
                        </span>
                        <span className="crate-stmt-qty-badge inline-flex items-center justify-center gap-1">
                          <ArrowUpRight className="crate-stmt-dir-icon h-3 w-3 shrink-0 text-amber-700 print:text-black" />
                          <span>
                            {issuedQty}{' '}
                            {issuedQty === 1 ? 'Crate' : 'Crates'} (Adjusted)
                          </span>
                        </span>
                      </div>
                    ) : returnedQty > 0 ? (
                      <span className="crate-stmt-qty-badge inline-flex items-center justify-center gap-1">
                        <ArrowDownLeft className="crate-stmt-dir-icon h-3 w-3 shrink-0 text-emerald-700 print:text-black" />
                        <span>
                          {returnedQty} {qtyUnitLabel}
                        </span>
                      </span>
                    ) : issuedQty > 0 ? (
                      <span className="crate-stmt-qty-badge inline-flex items-center justify-center gap-1">
                        <ArrowUpRight className="crate-stmt-dir-icon h-3 w-3 shrink-0 text-amber-700 print:text-black" />
                        <span>
                          {issuedQty} {qtyUnitLabel}
                        </span>
                      </span>
                    ) : (
                      <span>0 Crates</span>
                    )}
                  </td>
                  <td
                    className={`text-center font-black text-black align-middle tabular-nums ${
                      pageSize === 'b7'
                        ? 'px-1 py-1.5 text-[8.5px]'
                        : 'px-2.5 py-2.5 text-[13px]'
                    }`}
                  >
                    {updatedTotalBalance !== undefined
                      ? `${updatedTotalBalance} ${
                          updatedTotalBalance === 1 ? 'Crate' : 'Crates'
                        }`
                      : '-'}
                  </td>
                </tr>

                {referenceNumber && (
                  <tr className="bg-white border-b border-slate-300">
                    <td
                      className={`font-bold uppercase text-slate-700 print:text-black border-r border-slate-400 align-middle ${
                        pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                      }`}
                    >
                      Reference No.
                    </td>
                    <td
                      colSpan={3}
                      className={`font-bold text-black align-middle tabular-nums ${
                        pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                      }`}
                    >
                      {referenceNumber}
                    </td>
                  </tr>
                )}

                {remarksText && (
                  <tr className="bg-white border-b border-black">
                    <td
                      className={`font-bold uppercase text-slate-700 print:text-black border-r border-slate-400 align-middle ${
                        pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                      }`}
                    >
                      Remarks / Reason
                    </td>
                    <td
                      colSpan={3}
                      className={`font-semibold text-black align-middle break-words ${
                        pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                      }`}
                    >
                      {remarksText}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            {/* Updated Crate Balance Summary Box (Read-only) */}
            {updatedTotalBalance !== undefined && (
              <div
                className={`crate-stmt-closing-card border border-slate-400 rounded-md bg-slate-50 flex items-center justify-between gap-3 ${
                  pageSize === 'b7'
                    ? 'px-1.5 py-1 mb-2 text-[8px]'
                    : pageSize === 'b6'
                    ? 'px-2.5 py-1.5 mb-2.5 text-[10px]'
                    : 'px-3 py-2 mb-3.5 text-xs'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-black uppercase tracking-wide text-black">
                    Updated Crate Balance
                  </div>
                  {updatedTypeBalance !== undefined && (
                    <div
                      className={`${
                        pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10.5px]'
                      } font-bold text-black tabular-nums mt-0.5`}
                    >
                      {crateTypeName} (After Entry): {updatedTypeBalance}{' '}
                      {updatedTypeBalance === 1 ? 'Crate' : 'Crates'}
                    </div>
                  )}
                  {!isDraftPreview &&
                    selectedTypeBalance &&
                    fullStatement &&
                    fullStatement.closingCrates !== updatedTotalBalance && (
                      <div
                        className={`${
                          pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10.5px]'
                        } font-semibold text-black tabular-nums mt-0.5`}
                      >
                        Current Balance ({crateTypeName}):{' '}
                        {selectedTypeBalance.balance}{' '}
                        {selectedTypeBalance.balance === 1 ? 'Crate' : 'Crates'}{' '}
                        | Total: {fullStatement.closingCrates}{' '}
                        {fullStatement.closingCrates === 1 ? 'Crate' : 'Crates'}
                      </div>
                    )}
                </div>

                <div className="crate-stmt-closing-totals shrink-0 text-right border-l border-slate-300 pl-3 tabular-nums">
                  <div
                    className={`font-black text-black ${
                      pageSize === 'b7'
                        ? 'text-[9.5px]'
                        : pageSize === 'b6'
                        ? 'text-xs'
                        : 'text-sm'
                    }`}
                  >
                    {updatedTotalBalance}{' '}
                    {updatedTotalBalance === 1 ? 'Crate' : 'Crates'}
                  </div>
                  {updatedTotalKg !== undefined && (
                    <div
                      className={`${
                        pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10.5px]'
                      } font-bold text-black`}
                    >
                      Total Weight: {updatedTotalKg} KG
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Signature Footer */}
            <div
              className={`crate-stmt-signatory-row ${
                pageSize === 'b7'
                  ? 'mt-2 text-[8px]'
                  : pageSize === 'b6'
                  ? 'mt-3 text-[10px]'
                  : 'mt-5 text-xs'
              } flex justify-between items-end`}
            >
              <div className="text-center">
                <div
                  className={`${
                    pageSize === 'b7' ? 'w-20' : 'w-28'
                  } border-b border-black mb-1`}
                ></div>
                <span
                  className={`${
                    pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10px]'
                  } font-semibold text-black`}
                >
                  Customer Signature
                </span>
              </div>
              <div className="text-right">
                <div
                  className={`font-bold uppercase text-black ${
                    pageSize === 'b7' ? 'text-[8px]' : 'text-[11px]'
                  }`}
                >
                  {formatCompanySignature(currentProfile)}
                </div>
                <div
                  className={`${
                    pageSize === 'b7' ? 'text-[7.5px] mt-2' : 'text-[9.5px] mt-4'
                  } font-semibold uppercase tracking-wider text-black`}
                >
                  AUTHORISED SIGNATURE
                </div>
              </div>
            </div>

            {/* Software Footer */}
            <div
              className={`${
                pageSize === 'b7'
                  ? 'mt-1.5 pt-0.5 text-[7px]'
                  : pageSize === 'b6'
                  ? 'mt-2 pt-0.5 text-[7.5px]'
                  : 'mt-4 pt-1 text-[8px] sm:text-[8.5px]'
              } border-t border-dotted border-slate-400 print:border-black/40 text-left text-slate-600 print:text-black font-mono`}
            >
              Software Developed by:{' '}
              {currentProfile?.softwareDevelopedBy ||
                defaultProfile?.softwareDevelopedBy ||
                'Klyia Technology'}
            </div>
          </div>
        </div>
      </div>

      {/* Format Selection Dialog for Print Button */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={`${txTypeLabel} Statement - ${customerName}`}
        elementId="crate-adjustment-print-area"
        filename={safeFilename}
        defaultSize={pageSize}
        initialAction="print"
        onPaperSizeChange={setPageSize}
      />
    </div>
  );
};
