import React, { useState } from 'react';
import { CompanyProfile, Receipt } from '../../types';
import { db } from '../../services/db';
import { getCustomerLedger } from '../../services/accounting';
import { formatDate, formatCurrency, formatBillAmount, numberToWordsIndian, formatCompanySignature } from '../../utils/formatters';
import { maskAadhaar } from '../../utils/aadhaarUtils';
import { Printer, X, Building2, CheckCircle2 } from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { getCustomerPrintContactLines } from '../../utils/customerContactUtils';

interface ReceiptPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: Receipt;
}

export const ReceiptPrintModal: React.FC<ReceiptPrintModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const [pageSize, setPageSize] = useState<BillPaperSize>(() => getLastSelectedPaperSize('compact'));
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  if (!isOpen) return null;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const handlePrint = () => {
    setIsFormatModalOpen(true);
  };

  const customer = receipt.customerId ? db.getCustomerById(receipt.customerId) : undefined;
  const customerName = receipt.customerName || customer?.name || 'Customer';
  const customerAddress =
    customer?.address ||
    (customer?.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ''}` : '');
  const customerMobile = customer?.mobile || '';
  const customerAadhaarNo = customer?.aadhaarNo || customer?.gstin;

  // Customer outstanding balance calculation
  const ledger = receipt.customerId ? getCustomerLedger(receipt.customerId) : null;
  const closingBalance = ledger?.closingBalance || 0;

  const words = numberToWordsIndian(receipt.amount);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-hidden">
      <div className="flex flex-col w-full max-w-3xl max-h-[90vh] max-h-[90dvh] rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Controls Bar (Always visible at top, hidden on print) */}
        <div className="shrink-0 flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 gap-2 sm:gap-3 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Cash Receipt Print Preview
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
                    {p.name} {p.shortCode ? `(${p.shortCode})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setPageSize('compact')}
                className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  pageSize === 'compact'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                Compact (Mandi)
              </button>
              <button
                type="button"
                onClick={() => setPageSize('a4')}
                className={`px-2.5 py-1 rounded text-xs font-semibold ${
                  pageSize === 'a4'
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                A4 Standard
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BillShareButtons
              elementId="receipt-print-area"
              filename={`Receipt_${receipt.receiptNo.replace(/\s+/g, '_')}`}
              customerMobile={customer?.mobile}
              title={`Payment Receipt ${receipt.receiptNo}`}
              summaryText={`Receipt No: ${receipt.receiptNo}\nDate: ${receipt.date}\nCustomer: ${customerName}\nAmount Paid: ₹${receipt.amount.toLocaleString('en-IN')}\nMode: ${receipt.paymentMode || 'Cash'}`}
              defaultPaperSize={pageSize}
              onPaperSizeChange={setPageSize}
            />
            <button
              type="button"
              onClick={handlePrint}
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

        {/* Printable Receipt Canvas (Scrollable inside popup) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 flex justify-center items-start bg-slate-100 dark:bg-slate-950">
          <div
            id="receipt-print-area"
            className={`bg-white text-slate-900 border border-slate-300 print:border-none shadow-sm print-bill-canvas ${
              pageSize === 'a4'
                ? 'max-w-[730px] w-full text-[12px] p-5 sm:p-6'
                : pageSize === 'a5'
                ? 'max-w-[510px] w-full text-[11px] p-4 sm:p-5'
                : pageSize === 'b6'
                ? 'max-w-[430px] w-full text-[10px] p-3 sm:p-3.5'
                : pageSize === 'b7'
                ? 'max-w-[300px] w-full text-[8.5px] p-2 sm:p-2.5'
                : 'max-w-[490px] w-full text-[11px] p-4 sm:p-5'
            }`}
            style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
          >
            {/* Header: Company Details (English + Hindi Bilingual) */}
            <div className="text-center border-b border-slate-200 print:border-black pb-3">
              {currentProfile.shortCode && (
                <div className="font-bold text-xs tracking-widest uppercase text-slate-900 dark:text-slate-900 print:text-black">
                  {currentProfile.shortCode}
                </div>
              )}
              <h1 className="text-base sm:text-lg font-black tracking-wider uppercase text-slate-950 dark:text-slate-950 print:text-black">
                {currentProfile.name}
              </h1>
              {currentProfile.hindiName && (
                <div className="text-sm sm:text-base font-bold tracking-wide mt-0.5 font-devanagari text-slate-950 dark:text-slate-950 print:text-black">
                  {currentProfile.hindiName}
                </div>
              )}
              <div className="text-[11px] text-slate-800 dark:text-slate-800 print:text-black leading-snug mt-1">
                {currentProfile.address}
                {currentProfile.city ? `, ${currentProfile.city}` : ''}
                {currentProfile.state ? `, ${currentProfile.state}` : ''}
              </div>
              <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
            </div>

            {/* Document Title */}
            <div className="text-center my-3">
              <span className="font-bold uppercase tracking-widest text-xs border-b-2 border-slate-900 print:border-black pb-0.5">
                PAYMENT / CASH RECEIPT
              </span>
            </div>

            {/* Receipt Meta */}
            <div className="flex justify-between items-start text-xs mb-3 border-b border-slate-200 print:border-black/40 pb-2">
              <div>
                <span className="text-slate-500 print:text-black">Receipt No: </span>
                <strong className="font-mono text-slate-900 print:text-black">{receipt.receiptNo}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500 print:text-black">Date: </span>
                <strong>{formatDate(receipt.date)}</strong>
              </div>
            </div>

            {/* Customer Details */}
            <div className="bg-slate-50 print:bg-transparent rounded border border-slate-200 print:border-black/30 p-2.5 mb-3 text-xs">
              <div className="flex justify-between">
                <div>
                  <span className="text-slate-500 print:text-black text-[10px] uppercase font-bold block">
                    Received From (M/s)
                  </span>
                  <div className="font-bold text-sm text-slate-900 print:text-black uppercase">
                    {customerName}
                  </div>
                  {customerAddress && <div className="text-[11px] text-slate-600 print:text-black">{customerAddress}</div>}
                  {customerMobile && <div className="text-[11px] text-slate-600 print:text-black">Mob: {customerMobile}</div>}
                  {customer && getCustomerPrintContactLines(customer).map((c) => (
                    <div key={c.id} className="text-[11px] text-slate-600 print:text-black">{c.text}</div>
                  ))}
                  {customerAadhaarNo && (
                    <div className="text-[10px] text-slate-600 print:text-black font-mono">
                      Aadhaar Card No.: {maskAadhaar(customerAadhaarNo)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-slate-500 print:text-black text-[10px] uppercase font-bold block">
                    Payment Mode
                  </span>
                  <div className="font-bold text-xs uppercase text-emerald-700 print:text-black flex items-center justify-end gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 print:text-black" />
                    {receipt.paymentMode}
                  </div>
                </div>
              </div>
            </div>

            {/* Amount Box */}
            <div className="border border-slate-300 print:border-black rounded p-3 mb-3 bg-slate-50/50 print:bg-transparent">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[11px] font-bold text-slate-600 print:text-black uppercase block">
                    Amount Received
                  </span>
                  <div className="text-[11px] italic text-slate-700 print:text-black font-medium mt-0.5">
                    {words}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-lg sm:text-xl font-black text-slate-900 print:text-black">
                    {formatCurrency(receipt.amount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Particulars & Balance Information */}
            <div className="border-t border-b border-slate-200 print:border-black/40 py-2.5 mb-4 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-500 print:text-black">Particulars / Notes:</span>
                <span className="font-medium text-slate-800 print:text-black text-right">
                  {receipt.notes || 'Payment credited to customer ledger'}
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-100 print:border-black/20 pt-1.5">
                <span className="text-slate-600 print:text-black font-medium">Customer Current Balance:</span>
                <span className="font-mono font-bold text-slate-900 print:text-black">
                  {formatCurrency(closingBalance)}{' '}
                  <span className="text-[10px] font-normal">
                    {closingBalance > 0 ? '(Dr - Due)' : closingBalance < 0 ? '(Cr - Advance)' : '(Settled)'}
                  </span>
                </span>
              </div>
            </div>

            {/* Signature Footer */}
            <div className="mt-6 flex justify-between items-end text-xs">
              <div className="text-center">
                <div className="w-28 border-b border-slate-400 print:border-black mb-1"></div>
                <span className="text-[10px] text-slate-500 print:text-black">Customer Signature</span>
              </div>
              <div className="text-right">
                <div className="font-bold uppercase text-[11px]">
                  {formatCompanySignature(currentProfile)}
                </div>
                <div className="text-[10px] text-slate-500 print:text-black mt-4">Authorized Signatory</div>
              </div>
            </div>

            {/* Software Footer */}
            <div className="mt-4 pt-1 border-t border-dotted border-slate-300 print:border-black/30 text-[8px] sm:text-[8.5px] text-left text-slate-500 print:text-black font-mono">
              Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
            </div>
          </div>
        </div>
      </div>
      {/* Format Selection Dialog for Print Button */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={`Payment Receipt ${receipt.receiptNo}`}
        elementId="receipt-print-area"
        filename={`Receipt_${receipt.receiptNo.replace(/\s+/g, '_')}`}
        defaultSize={pageSize}
        initialAction="print"
        onPaperSizeChange={setPageSize}
      />
    </div>
  );
};
