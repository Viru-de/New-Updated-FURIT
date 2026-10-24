import React, { useState } from 'react';
import { CompanyProfile, SaleProceeds } from '../../types';
import { db } from '../../services/db';
import { formatDate, formatBillAmount, numberToWordsIndian } from '../../utils/formatters';
import { Printer, Download, X, Building2 } from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';

interface SaleProceedPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  proceeds: SaleProceeds;
}

export const SaleProceedPrintModal: React.FC<SaleProceedPrintModalProps> = ({
  isOpen,
  onClose,
  proceeds,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(defaultProfile?.id || profiles[0]?.id || '');
  const [pageSize, setPageSize] = useState<BillPaperSize>(() => getLastSelectedPaperSize('compact'));
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  if (!isOpen) return null;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const handlePrint = () => {
    setIsFormatModalOpen(true);
  };

  // Vendor / Consignor information
  const vendorName = proceeds.vendorName || 'RAFAT RANA TRADERS';
  const vendor = proceeds.vendorId ? db.getVendorById(proceeds.vendorId) : undefined;
  const vendorAddress = vendor?.address || vendor?.city || '';

  // Extract sequence number (e.g. 503 or 1)
  const proceedsDisplayNumber = proceeds.sequenceNumber || proceeds.proceedsNo.replace(/\D/g, '') || '503';

  // Items formatting
  const items = proceeds.items && proceeds.items.length > 0
    ? proceeds.items
    : [
        {
          id: 'spi1',
          fruitId: 'f1',
          fruitName: 'STRAWBERRY',
          quantity: proceeds.quantity,
          unit: proceeds.unit,
          kg: proceeds.kg,
          rate: proceeds.rate,
          amount: proceeds.amount,
        },
      ];

  // Number of blank rows to maintain traditional wholesale mandi bill height scaled by paper size
  const minRows =
    pageSize === 'b7' ? 2 : pageSize === 'b6' ? 4 : pageSize === 'a5' || pageSize === 'compact' ? 6 : 8;
  const blankRowsCount = Math.max(0, minRows - items.length);

  // Subtotal, expenses and net total
  // Subtotal comes directly from user's entered amount (never forced to qty * rate!)
  const subTotal = proceeds.amount;
  const totalExpense = proceeds.totalExpense;
  const netTotal = proceeds.netAmount;
  const expenseDisplay = totalExpense !== 0 ? `-${formatBillAmount(totalExpense)}` : '0.00';

  // Amount in words
  const words = numberToWordsIndian(netTotal);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-hidden">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] max-h-[90dvh] rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls Bar (Always visible at top, hidden during print) */}
        <div className="shrink-0 flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 gap-2 sm:gap-3 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Sale Proceed Bill Preview
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
              elementId="mandi-print-area"
              filename={`Sale-Proceeds-${proceeds.proceedsNo.replace(/\s+/g, '-')}`}
              customerMobile={vendor?.contact}
              title={`Sale Proceeds Bill ${proceeds.proceedsNo}`}
              summaryText={`Sale Proceeds No: ${proceeds.proceedsNo}\nDate: ${proceeds.date}\nConsignor: ${vendorName}\nNet Amount: ₹${proceeds.netAmount.toLocaleString('en-IN')}`}
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

        {/* Printable Traditional Bill Canvas (Scrollable inside popup) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 flex justify-center items-start bg-slate-100 dark:bg-slate-950">
          <div
            id="mandi-print-area"
            className={`bg-white text-slate-900 font-sans leading-tight border border-slate-300 print:border-none shadow-md print-bill-canvas ${
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
            {/* Header: Company Initials & Bilingual Names */}
            <div className="text-center mb-1">
              {currentProfile.shortCode && (
                <div className="font-bold text-sm tracking-widest uppercase text-slate-900 dark:text-slate-900 print:text-black">
                  {currentProfile.shortCode}
                </div>
              )}
              <h1 className="text-lg sm:text-xl font-black tracking-wider uppercase mt-0.5 text-slate-950 dark:text-slate-950 print:text-black">
                {currentProfile.name}
              </h1>
              {currentProfile.hindiName && (
                <div className="text-base sm:text-lg font-bold tracking-wide mt-0.5 font-devanagari text-slate-950 dark:text-slate-950 print:text-black">
                  {currentProfile.hindiName}
                </div>
              )}
              <div className="text-[11px] leading-snug mt-1 text-slate-800 dark:text-slate-800 print:text-black">
                {currentProfile.address}
                {currentProfile.city ? `, ${currentProfile.city}` : ''}
                {currentProfile.state ? `, ${currentProfile.state}` : ''}
              </div>
              <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
            </div>

            {/* Document Title */}
            <div className="text-center my-2">
              <span className="font-bold uppercase tracking-widest text-sm border-b border-black pb-0.5">
                SALE PROCEED
              </span>
            </div>

            {/* Metadata Section */}
            <div className="flex justify-between items-start text-xs mb-2 pt-1 font-medium">
              {/* Left Side: M/s. & Address */}
              <div className="max-w-[65%]">
                <div className="font-bold">M/s.</div>
                <div className="font-bold uppercase">{vendorName}</div>
                {vendorAddress && <div className="text-[11px]">{vendorAddress}</div>}
                <div className="mt-1 text-[11px]">
                  Challan DT: <strong>{formatDate(proceeds.challanDate || proceeds.date)}</strong>
                </div>
              </div>

              {/* Right Side: Number & Date */}
              <div className="text-right whitespace-nowrap">
                <div>
                  NUMBER: <strong className="font-mono">{proceedsDisplayNumber}</strong>
                </div>
                <div>
                  DATE: <strong>{formatDate(proceeds.date)}</strong>
                </div>
              </div>
            </div>

            {/* Item Table matching Reference 1 */}
            <table className="w-full border-collapse border border-black text-xs">
              <thead>
                <tr className="border-b border-black font-bold uppercase text-[11px] bg-slate-50 print:bg-transparent">
                  <th className="border-r border-black p-1 text-center w-8">No.</th>
                  <th className="border-r border-black p-1 text-left">ITEM NAME</th>
                  <th className="border-r border-black p-1 text-right w-14">QTY</th>
                  <th className="border-r border-black p-1 text-right w-16">WEIGHT</th>
                  <th className="border-r border-black p-1 text-right w-18">PRICE</th>
                  <th className="p-1 text-right w-22">AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id || idx} className="border-b border-black/40">
                    <td className="border-r border-black p-1 text-center font-mono">{idx + 1}</td>
                    <td className="border-r border-black p-1 font-semibold uppercase">{it.fruitName}</td>
                    <td className="border-r border-black p-1 text-right font-mono">{it.quantity}</td>
                    <td className="border-r border-black p-1 text-right font-mono">
                      {it.kg && it.kg > 0 ? it.kg : (proceeds.kg && proceeds.kg > 0 ? proceeds.kg : '')}
                    </td>
                    <td className="border-r border-black p-1 text-right font-mono">
                      {formatBillAmount(it.rate)}
                    </td>
                    <td className="p-1 text-right font-mono font-bold">
                      {formatBillAmount(it.amount)}
                    </td>
                  </tr>
                ))}

                {/* Preserved Blank Rows to maintain traditional wholesale bill spacing */}
                {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
                  <tr key={`blank-${bIdx}`} className="border-b border-black/20 h-6">
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="border-r border-black p-1">&nbsp;</td>
                    <td className="p-1">&nbsp;</td>
                  </tr>
                ))}
              </tbody>

              {/* Lower Section: Expenses List + Subtotal & Net Total Grid */}
              <tfoot>
                <tr className="border-t-2 border-black">
                  {/* Left Bottom Section: E & O.E. + Expenses List */}
                  <td colSpan={5} className="border-r border-black p-2 align-top">
                    <div className="flex flex-col justify-between h-full min-h-[75px]">
                      <div className="text-[10px] font-bold text-slate-950 dark:text-slate-950 print:text-black">* E & O.E.</div>

                      {/* Listed Individual Expenses */}
                      {proceeds.expenses && proceeds.expenses.length > 0 && (
                        <div className="self-end text-right font-mono text-[11px] space-y-0.5 pr-2">
                          {proceeds.expenses.map((exp, expIdx) => (
                            <div key={expIdx} className="flex justify-end gap-3 text-slate-950 dark:text-slate-950 print:text-black">
                              <span className="font-sans font-medium text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                              <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Right Bottom Section: Sub Total, Expenses, Net Total */}
                  <td className="p-0 align-top">
                    <table className="w-full text-xs border-collapse">
                      <tbody>
                        <tr className="border-b border-black">
                          <td className="p-1 font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black">Sub Total</td>
                          <td className="p-1 text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black">
                            {formatBillAmount(subTotal)}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className="p-1 font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black">Expenses</td>
                          <td className="p-1 text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black">
                            {expenseDisplay}
                          </td>
                        </tr>
                        <tr>
                          <td className="p-1 font-bold text-left border-r border-black bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black">
                            Net Total
                          </td>
                          <td className="p-1 text-right font-mono font-black text-sm bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black">
                            {formatBillAmount(netTotal)}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </tfoot>
            </table>

            {/* Bottom Words & Signatory Footer */}
            <div className="mt-3 flex justify-between items-end text-xs pt-1 text-slate-950 dark:text-slate-950 print:text-black">
              {/* Amount in words */}
              <div className="font-bold italic max-w-[60%] text-slate-950 dark:text-slate-950 print:text-black">
                {words}
              </div>

              {/* Signatory for company profile */}
              <div className="text-right font-bold uppercase text-slate-950 dark:text-slate-950 print:text-black">
                <div>FOR, {currentProfile.signatureTitle || currentProfile.name}</div>
              </div>
            </div>

            {/* Software attribution */}
            <div className="mt-4 pt-1 border-t border-dotted border-black/40 text-[8px] sm:text-[8.5px] text-left text-slate-700 dark:text-slate-700 print:text-black font-mono">
              Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
            </div>
          </div>
        </div>
      </div>

      {/* Format Selection Dialog for Print Button */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={`Sale Proceeds Bill ${proceeds.proceedsNo}`}
        elementId="mandi-print-area"
        filename={`Sale-Proceeds-${proceeds.proceedsNo.replace(/\s+/g, '-')}`}
        defaultSize={pageSize}
        initialAction="print"
        onPaperSizeChange={setPageSize}
      />
    </div>
  );
};
