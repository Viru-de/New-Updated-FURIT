import React, { useState } from 'react';
import { CompanyProfile, Receipt } from '../../types';
import { db } from '../../services/db';
import { getCustomerLedger } from '../../services/accounting';
import { formatDate, formatCurrency, formatBillAmount, numberToWordsIndian, formatCompanySignature } from '../../utils/formatters';
import { Printer, X, Building2, CheckCircle2 } from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { getCustomerPrintContactLines, formatCustomerContactsInline } from '../../utils/customerContactUtils';

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

  const handlePrint = () => {
    setIsFormatModalOpen(true);
  };

  const customer = receipt.customerId ? db.getCustomerById(receipt.customerId) : undefined;
  const customerName = receipt.customerName || customer?.name || 'Customer';
  const customerAddress =
    customer?.address ||
    (customer?.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ''}` : '');
  const customerMobile = customer?.mobile || '';

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
            data-theme-isolated="true"
            className={`bg-white text-slate-900 border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 box-border shadow-sm print-bill-canvas ${
              pageSize === 'a4'
                ? 'max-w-[730px] w-full text-[12px] pt-1 px-4 pb-4 sm:pt-1.5 sm:px-5 sm:pb-5'
                : pageSize === 'a5'
                ? 'max-w-[550px] w-full text-[10.5px] pt-0.5 px-3 pb-3 sm:pt-1 sm:px-3.5 sm:pb-4'
                : pageSize === 'b6'
                ? 'max-w-[430px] w-full text-[10px] pt-1.5 px-2.5 pb-2.5 sm:px-3'
                : pageSize === 'b7'
                ? 'max-w-[300px] w-full text-[8.5px] pt-1.5 px-2 pb-2'
                : 'max-w-[490px] w-full text-[11px] pt-0.5 px-3.5 pb-3 sm:pt-1 sm:px-4 sm:pb-4'
            }`}
            style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
          >
            {/* Shared Two-Column Business Header */}
            <PrintBusinessHeader
              profile={currentProfile}
              variant="bill"
              paperSize={pageSize}
            />

            {/* Document Title */}
            <div className={`text-center ${pageSize === 'b7' ? 'my-1' : pageSize === 'b6' ? 'my-2' : 'my-3'}`}>
              <span className={`font-bold uppercase tracking-widest border-b-2 border-slate-900 print:border-black pb-0.5 ${pageSize === 'b7' ? 'text-[9px]' : 'text-xs'}`}>
                PAYMENT / CASH RECEIPT
              </span>
            </div>

            {/* Receipt Meta */}
            <div className={`flex justify-between items-start ${pageSize === 'b7' ? 'text-[8.5px] print:text-[9.5px] mb-1.5 pb-1' : pageSize === 'b6' ? 'text-[9.5px] print:text-[11px] mb-2 pb-1.5' : 'text-xs print:text-[13.5px] mb-3 pb-2'} border-b border-slate-200 print:border-black/40`}>
              <div>
                <span className="text-slate-500 print:text-black print:font-semibold">Receipt No: </span>
                <strong className="font-mono text-slate-900 print:text-black">{receipt.receiptNo}</strong>
              </div>
              <div className="text-right">
                <span className="text-slate-500 print:text-black print:font-semibold">Date: </span>
                <strong className="print:text-black">{formatDate(receipt.date)}</strong>
              </div>
            </div>

            {/* Customer Details (M/s Customer Name & Inline Contact) */}
            <div className={`bg-slate-50 print:bg-transparent rounded border border-slate-200 print:border-black/30 ${pageSize === 'b7' ? 'p-1.5 mb-1.5 text-[8.5px] print:text-[9.5px]' : pageSize === 'b6' ? 'p-2 mb-2 text-[9.5px] print:text-[10.5px]' : 'p-2.5 mb-3 text-xs print:text-[13px]'}`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className={`text-slate-500 print:text-black ${pageSize === 'b7' ? 'text-[8px] print:text-[9px]' : 'text-[10px] print:text-[11px]'} uppercase font-bold block`}>
                    Received From (M/s)
                  </span>
                  <div className={`font-bold text-slate-900 print:text-black uppercase ${pageSize === 'b7' ? 'text-xs print:text-[13px]' : 'text-sm print:text-[15px]'}`}>
                    {customerName}
                  </div>
                  {customer && formatCustomerContactsInline(customer) && (
                    <div className={`${pageSize === 'b7' ? 'text-[7.5px] print:text-[8.5px]' : pageSize === 'b6' ? 'text-[8.5px] print:text-[9.5px]' : 'text-[10px] print:text-[11px]'} font-medium print:font-semibold text-slate-800 dark:text-slate-800 print:text-black leading-tight mt-0.5`}>
                      {formatCustomerContactsInline(customer)}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <span className={`text-slate-500 print:text-black ${pageSize === 'b7' ? 'text-[8px] print:text-[9px]' : 'text-[10px] print:text-[11px]'} uppercase font-bold block`}>
                    Payment Mode
                  </span>
                  <div className={`font-bold uppercase text-emerald-700 print:text-black flex items-center justify-end gap-1 ${pageSize === 'b7' ? 'text-[9px] print:text-[10px]' : 'text-xs print:text-[13px]'}`}>
                    <CheckCircle2 className="h-3 w-3 text-emerald-600 print:text-black" />
                    {receipt.paymentMode}
                  </div>
                </div>
              </div>
            </div>

            {/* Amount Box */}
            <div className={`border border-slate-300 print:border-black rounded ${pageSize === 'b7' ? 'p-1.5 mb-1.5' : pageSize === 'b6' ? 'p-2 mb-2' : 'p-3 mb-3'} bg-slate-50/50 print:bg-transparent`}>
              <div className="flex justify-between items-center">
                <div>
                  <span className={`${pageSize === 'b7' ? 'text-[8.5px] print:text-[9.5px]' : 'text-[11px] print:text-[12px]'} font-bold text-slate-600 print:text-black uppercase block`}>
                    Amount Received
                  </span>
                  <div className={`${pageSize === 'b7' ? 'text-[8px] print:text-[9px]' : 'text-[11px] print:text-[12px]'} italic text-slate-700 print:text-black font-medium print:font-semibold mt-0.5 leading-tight`}>
                    {words}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-mono font-black text-slate-900 print:text-black ${pageSize === 'b7' ? 'text-base print:text-[17px]' : 'text-lg sm:text-xl'}`}>
                    {formatCurrency(receipt.amount)}
                  </div>
                </div>
              </div>
            </div>

            {/* Balance Information */}
            <div className={`border-t border-b border-slate-200 print:border-black/40 ${pageSize === 'b7' ? 'py-1 mb-2 text-[8px] print:text-[9.5px] space-y-1' : pageSize === 'b6' ? 'py-1.5 mb-2.5 text-[9.5px] print:text-[11px] space-y-1' : 'py-2.5 mb-4 text-xs print:text-[13.5px] space-y-1.5'}`}>
              <div className="flex justify-between">
                <span className="text-slate-600 print:text-black font-medium print:font-semibold">Customer Current Balance:</span>
                <span className="font-mono font-bold text-slate-900 print:text-black">
                  {formatCurrency(closingBalance)}{' '}
                  <span className={`${pageSize === 'b7' ? 'text-[7.5px] print:text-[9px]' : 'text-[10px] print:text-[11.5px]'} font-normal print:font-semibold print:text-black`}>
                    {closingBalance > 0 ? '(Dr - Due)' : closingBalance < 0 ? '(Cr - Advance)' : '(Settled)'}
                  </span>
                </span>
              </div>
            </div>

            {/* Signature Footer */}
            <div className={`${pageSize === 'b7' ? 'mt-2 text-[8.5px] print:text-[9.5px]' : pageSize === 'b6' ? 'mt-3.5 text-[9.5px] print:text-[10.5px]' : 'mt-6 text-xs print:text-[12.5px]'} flex justify-between items-end`}>
              <div className="text-center">
                <div className={`${pageSize === 'b7' ? 'w-20' : 'w-28'} border-b border-slate-400 print:border-black mb-1`}></div>
                <span className={`${pageSize === 'b7' ? 'text-[8px] print:text-[9px]' : 'text-[10px] print:text-[11px]'} text-slate-500 print:text-black print:font-semibold`}>Customer Signature</span>
              </div>
              <div className="text-right">
                <div className={`font-bold uppercase ${pageSize === 'b7' ? 'text-[9px] print:text-[10px]' : 'text-[11px] print:text-[12px]'}`}>
                  {formatCompanySignature(currentProfile)}
                </div>
                <div className={`${pageSize === 'b7' ? 'text-[8px] print:text-[9px] mt-2' : 'text-[10px] print:text-[11px] mt-4'} text-slate-500 print:text-black print:font-semibold`}>Authorized Signatory</div>
              </div>
            </div>

            {/* Software Footer */}
            <div className={`${pageSize === 'b7' ? 'mt-1.5 pt-0.5 text-[7px]' : 'mt-4 pt-1 text-[8px] sm:text-[8.5px]'} border-t border-dotted border-slate-300 print:border-black/30 text-left text-slate-500 print:text-black font-mono`}>
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
