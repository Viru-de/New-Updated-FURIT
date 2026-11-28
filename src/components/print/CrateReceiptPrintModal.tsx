import React, { useState } from 'react';
import { CompanyProfile } from '../../types';
import { db } from '../../services/db';
import { getCustomerCrateStatement, getCustomerCrateBalanceByType } from '../../services/accounting';
import { formatDate, formatCompanySignature } from '../../utils/formatters';
import { Printer, X, Building2, Box } from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { formatCustomerContactsInline } from '../../utils/customerContactUtils';

export type CrateReceiptTxType = 'Crate Received' | 'Crate Out';

export interface CrateReceiptData {
  id: string;
  receiptRefNo?: string;
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  transactionType: CrateReceiptTxType;
  crateTypeId: string;
  crateName: string;
  quantity: number;
  remarks?: string;
}

interface CrateReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  crateReceipt: CrateReceiptData;
}

export const CrateReceiptPrintModal: React.FC<CrateReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  crateReceipt,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const [pageSize, setPageSize] = useState<BillPaperSize>(() => getLastSelectedPaperSize('a5'));
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      const latestDefault = db.getDefaultProfile();
      if (latestDefault?.id) {
        setSelectedProfileId(latestDefault.id);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const customer = crateReceipt.customerId ? db.getCustomerById(crateReceipt.customerId) : undefined;
  const customerName = crateReceipt.customerName || customer?.name || 'Customer';
  const customerContactLine = customer ? formatCustomerContactsInline(customer) : '';

  const rawAddressParts = [customer?.address, customer?.city, customer?.state]
    .map((p) => (p || '').trim())
    .filter(Boolean);
  const dedupedAddrParts: string[] = [];
  for (const part of rawAddressParts) {
    const lower = part.toLowerCase();
    if (!dedupedAddrParts.some((existing) => existing.toLowerCase().includes(lower))) {
      dedupedAddrParts.push(part);
    }
  }
  const customerAddressLine = dedupedAddrParts.join(', ');

  // Read-only closing crate balance lookup (does not modify inventory or customer balances)
  const crateStatement = crateReceipt.customerId
    ? getCustomerCrateStatement(crateReceipt.customerId)
    : null;
  const selectedTypeBalance =
    crateReceipt.customerId && crateReceipt.crateTypeId
      ? getCustomerCrateBalanceByType(crateReceipt.customerId, crateReceipt.crateTypeId)
      : null;

  const refDisplay = (crateReceipt.remarks || '').trim() || (crateReceipt.receiptRefNo || '').trim() || '-';
  const safeFilename = `Crate_Receipt_${customerName.replace(/\s+/g, '_')}_${crateReceipt.date}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-hidden">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] max-h-[90dvh] rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Controls Bar (Hidden on Print) */}
        <div className="shrink-0 flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 gap-2 sm:gap-3 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Box className="h-3.5 w-3.5 text-sky-600" />
              Crate Receipt Print Preview
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
                    {p.name} {p.shortName || p.shortCode ? `(${p.shortName || p.shortCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-1 text-xs">
              {(['compact', 'b7', 'b6', 'a5', 'a4'] as BillPaperSize[]).map((sizeKey) => (
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
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BillShareButtons
              elementId="crate-receipt-print-area"
              filename={safeFilename}
              customerMobile={customer?.mobile}
              title={`Crate Transaction Receipt - ${customerName}`}
              summaryText={`Type: ${crateReceipt.transactionType}\nDate: ${formatDate(crateReceipt.date)}\nCustomer: ${customerName}\nCrate Type: ${crateReceipt.crateName}\nCrates: ${crateReceipt.quantity}`}
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
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Printable Crate-Only Receipt Canvas */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 flex justify-center items-start bg-slate-100 dark:bg-slate-950">
          <div
            id="crate-receipt-print-area"
            data-paper-size={pageSize}
            data-theme-isolated="true"
            className={`crate-receipt-print-canvas bg-white text-slate-900 border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 box-border shadow-sm print-bill-canvas ${
              pageSize === 'a4'
                ? 'max-w-[730px] w-full text-[12px] pt-1 px-4 pb-4 sm:pt-1.5 sm:px-5 sm:pb-5'
                : pageSize === 'a5'
                ? 'max-w-[550px] w-full text-[10.5px] pt-0.5 px-3 pb-3 sm:pt-1 sm:px-3.5 sm:pb-4'
                : pageSize === 'b6'
                ? 'max-w-[430px] w-full text-[10px] pt-1 px-2.5 pb-1.5 sm:px-3'
                : pageSize === 'b7'
                ? 'max-w-[300px] w-full text-[8.5px] pt-0.5 px-1.5 pb-1'
                : 'max-w-[490px] w-full text-[11px] pt-0.5 px-3.5 pb-3 sm:pt-1 sm:px-4 sm:pb-4'
            }`}
            style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
          >
            {/* Centered HKC Company Header */}
            <PrintBusinessHeader
              profile={currentProfile}
              variant="ledger-centered"
              paperSize={pageSize}
            />

            {/* Document Title */}
            <div className={`text-center ${pageSize === 'b7' ? 'my-1' : pageSize === 'b6' ? 'my-1.5' : 'my-2.5'}`}>
              <span
                className={`font-black uppercase tracking-[0.14em] border-b-2 border-slate-900 print:border-black pb-0.5 text-black ${
                  pageSize === 'b7' ? 'text-[9.5px]' : pageSize === 'b6' ? 'text-[11px]' : 'text-[13px]'
                }`}
              >
                CRATE TRANSACTION RECEIPT
              </span>
            </div>

            {/* Transaction Date & Reference Meta */}
            <div
              className={`flex justify-between items-center ${
                pageSize === 'b7'
                  ? 'text-[8.5px] print:text-[9px] mb-1.5 pb-1'
                  : pageSize === 'b6'
                  ? 'text-[10px] print:text-[10.5px] mb-2 pb-1'
                  : 'text-xs print:text-[12.5px] mb-2.5 pb-1.5'
              } border-b border-slate-300 print:border-black/60`}
            >
              <div>
                <span className="text-slate-600 print:text-black font-semibold">Transaction: </span>
                <strong className="font-bold uppercase text-black">{crateReceipt.transactionType}</strong>
              </div>
              <div className="text-right tabular-nums">
                <span className="text-slate-600 print:text-black font-semibold">Date: </span>
                <strong className="font-bold text-black">{formatDate(crateReceipt.date)}</strong>
              </div>
            </div>

            {/* Customer Info Card */}
            <div
              className={`crate-receipt-customer-box rounded border border-slate-300 print:border-black bg-slate-50 print:bg-slate-50 ${
                pageSize === 'b7'
                  ? 'p-1.5 mb-1.5 text-[8.5px]'
                  : pageSize === 'b6'
                  ? 'p-2 mb-2 text-[10px]'
                  : 'p-2.5 mb-3 text-xs'
              }`}
            >
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0 flex-1">
                  <span
                    className={`text-slate-600 print:text-black ${
                      pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10px]'
                    } uppercase font-bold tracking-wider block`}
                  >
                    Customer Details
                  </span>
                  <div
                    className={`font-black text-black uppercase leading-snug ${
                      pageSize === 'b7' ? 'text-[11px]' : pageSize === 'b6' ? 'text-xs' : 'text-sm print:text-[14.5px]'
                    }`}
                  >
                    M/s. {customerName}
                  </div>
                  {customerAddressLine && (
                    <div
                      className={`${
                        pageSize === 'b7' ? 'text-[8px]' : 'text-[11px]'
                      } font-semibold text-black leading-snug mt-0.5`}
                    >
                      {customerAddressLine}
                    </div>
                  )}
                  {customerContactLine && (
                    <div
                      className={`${
                        pageSize === 'b7' ? 'text-[8px]' : 'text-[11px]'
                      } font-bold text-black leading-snug mt-0.5 tabular-nums`}
                    >
                      Contact: {customerContactLine}
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span
                    className={`text-slate-600 print:text-black ${
                      pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10px]'
                    } uppercase font-bold tracking-wider block`}
                  >
                    Type
                  </span>
                  <div
                    className={`font-black uppercase text-black ${
                      pageSize === 'b7' ? 'text-[9.5px]' : pageSize === 'b6' ? 'text-[11px]' : 'text-xs print:text-[13px]'
                    }`}
                  >
                    {crateReceipt.transactionType}
                  </div>
                </div>
              </div>
            </div>

            {/* Crate Transaction Details Table */}
            <table
              className={`crate-receipt-table w-full border-collapse border border-black ${
                pageSize === 'b7'
                  ? 'text-[8.5px] mb-1.5'
                  : pageSize === 'b6'
                  ? 'text-[10px] mb-2'
                  : 'text-xs print:text-[12.5px] mb-3'
              }`}
            >
              <thead>
                <tr className="bg-slate-100 border-b border-black">
                  <th
                    className={`text-left font-extrabold uppercase text-black border-r border-slate-400 ${
                      pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                    }`}
                  >
                    Transaction Type
                  </th>
                  <th
                    className={`text-left font-extrabold uppercase text-black border-r border-slate-400 ${
                      pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                    }`}
                  >
                    Crate Type
                  </th>
                  <th
                    className={`text-right font-extrabold uppercase text-black ${
                      pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'
                    }`}
                  >
                    No. of Crates
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-white border-b border-black">
                  <td
                    className={`font-bold text-black border-r border-slate-400 ${
                      pageSize === 'b7' ? 'px-1.5 py-1.5' : 'px-2.5 py-2'
                    }`}
                  >
                    {crateReceipt.transactionType}
                  </td>
                  <td
                    className={`font-bold text-black border-r border-slate-400 ${
                      pageSize === 'b7' ? 'px-1.5 py-1.5' : 'px-2.5 py-2'
                    }`}
                  >
                    {crateReceipt.crateName || 'Crate'}
                  </td>
                  <td
                    className={`text-right font-black text-black tabular-nums whitespace-nowrap ${
                      pageSize === 'b7' ? 'px-1.5 py-1.5 text-[10px]' : 'px-2.5 py-2 text-sm print:text-[14px]'
                    }`}
                  >
                    {crateReceipt.quantity} {crateReceipt.quantity === 1 ? 'Crate' : 'Crates'}
                  </td>
                </tr>
                <tr className="bg-white">
                  <td
                    colSpan={3}
                    className={`text-black ${pageSize === 'b7' ? 'px-1.5 py-1' : 'px-2.5 py-1.5'}`}
                  >
                    <span className="font-bold uppercase text-slate-700 print:text-black">
                      Reference / Remarks:{' '}
                    </span>
                    <span className="font-semibold text-black">{refDisplay}</span>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Closing Crate Balance (Read-only display if available) */}
            {crateStatement && (
              <div
                className={`crate-receipt-balance-box border border-black rounded bg-slate-50 print:bg-slate-50 flex items-center justify-between gap-3 ${
                  pageSize === 'b7'
                    ? 'px-1.5 py-1 mb-2 text-[8.5px]'
                    : pageSize === 'b6'
                    ? 'px-2.5 py-1.5 mb-2.5 text-[10.5px]'
                    : 'px-3 py-2 mb-3.5 text-xs print:text-[12.5px]'
                }`}
              >
                <div>
                  <div className="font-extrabold uppercase text-black">Closing Crate Balance</div>
                  {selectedTypeBalance && (
                    <div
                      className={`${
                        pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10.5px]'
                      } font-semibold text-black tabular-nums`}
                    >
                      {selectedTypeBalance.crateName} Balance: {selectedTypeBalance.balance}{' '}
                      {selectedTypeBalance.balance === 1 ? 'Crate' : 'Crates'}
                    </div>
                  )}
                </div>
                <div className="text-right tabular-nums">
                  <div
                    className={`font-black text-black ${
                      pageSize === 'b7' ? 'text-[10px]' : pageSize === 'b6' ? 'text-xs' : 'text-sm print:text-[14.5px]'
                    }`}
                  >
                    {crateStatement.closingCrates}{' '}
                    {crateStatement.closingCrates === 1 ? 'Crate' : 'Crates'}
                  </div>
                  <div className={`${pageSize === 'b7' ? 'text-[7.5px]' : 'text-[10.5px]'} font-bold text-black`}>
                    Total Weight: {crateStatement.closingTotalKg} KG
                  </div>
                </div>
              </div>
            )}

            {/* Signature Footer */}
            <div
              className={`${
                pageSize === 'b7'
                  ? 'mt-2 text-[8.5px]'
                  : pageSize === 'b6'
                  ? 'mt-3 text-[10px]'
                  : 'mt-5 text-xs print:text-[12px]'
              } flex justify-between items-end`}
            >
              <div className="text-center">
                <div className={`${pageSize === 'b7' ? 'w-20' : 'w-28'} border-b border-black mb-1`}></div>
                <span className={`${pageSize === 'b7' ? 'text-[8px]' : 'text-[10px] print:text-[11px]'} font-semibold text-black`}>
                  Customer Signature
                </span>
              </div>
              <div className="text-right">
                <div className={`font-bold uppercase text-black ${pageSize === 'b7' ? 'text-[8.5px]' : 'text-[11px] print:text-[12px]'}`}>
                  {formatCompanySignature(currentProfile)}
                </div>
                <div className={`${pageSize === 'b7' ? 'text-[8px] mt-2' : 'text-[10px] print:text-[11px] mt-4'} font-semibold text-black`}>
                  Authorized Signatory
                </div>
              </div>
            </div>

            {/* Software Footer */}
            <div
              className={`${
                pageSize === 'b7' ? 'mt-1.5 pt-0.5 text-[7px]' : pageSize === 'b6' ? 'mt-2 pt-0.5 text-[7.5px]' : 'mt-4 pt-1 text-[8px] sm:text-[8.5px]'
              } border-t border-dotted border-slate-400 print:border-black/40 text-left text-slate-600 print:text-black font-mono`}
            >
              Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
            </div>
          </div>
        </div>
      </div>

      {/* Format Selection Dialog for Print Button */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={`Crate Transaction Receipt - ${customerName}`}
        elementId="crate-receipt-print-area"
        filename={safeFilename}
        defaultSize={pageSize}
        initialAction="print"
        onPaperSizeChange={setPageSize}
      />
    </div>
  );
};
