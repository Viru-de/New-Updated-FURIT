import React, { useState } from 'react';
import { CompanyProfile, SaleProceeds } from '../../types';
import { db } from '../../services/db';
import { formatDate, formatBillAmount, numberToWordsIndian, formatCompanySignature } from '../../utils/formatters';
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
  proceeds: initialProceeds,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(defaultProfile?.id || profiles[0]?.id || '');
  const [pageSize, setPageSize] = useState<BillPaperSize>(() => getLastSelectedPaperSize('compact'));
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  if (!isOpen) return null;

  // Always fetch latest proceeds from database if it exists to ensure fresh saved values
  const proceeds = (initialProceeds?.id ? db.getSaleProceeds().find((s) => s.id === initialProceeds.id) : null) || initialProceeds;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const handlePrint = () => {
    setIsFormatModalOpen(true);
  };

  // Vendor / Consignor information
  const vendor = proceeds.vendorId ? db.getVendorById(proceeds.vendorId) : undefined;
  const vendorName = proceeds.vendorName || vendor?.name || 'RAFAT RANA TRADERS';
  const vendorAddress = vendor?.address || vendor?.city || '';

  // Extract sequence number (e.g. 503 or 1)
  const proceedsDisplayNumber = proceeds.sequenceNumber || proceeds.proceedsNo.replace(/\D/g, '') || '503';

  // Items formatting
  const effectiveWeight = proceeds.weight !== undefined && proceeds.weight !== null ? proceeds.weight : proceeds.kg;
  const items = proceeds.items && proceeds.items.length > 0
    ? proceeds.items
    : [
        {
          id: 'spi1',
          fruitId: (proceeds as any).fruitId || 'f1',
          fruitName: (proceeds as any).fruitName || 'STRAWBERRY',
          quantity: proceeds.quantity,
          unit: proceeds.unit,
          kg: effectiveWeight,
          weight: effectiveWeight,
          rate: proceeds.rate,
          amount: proceeds.amount,
        },
      ];

  // Number of blank rows to maintain traditional wholesale mandi bill height scaled by paper size
  const minRows =
    pageSize === 'b7' ? 2 : pageSize === 'b6' ? 4 : pageSize === 'a5' || pageSize === 'compact' ? 6 : 8;
  const blankRowsCount = Math.max(0, minRows - items.length);

  const isB7 = pageSize === 'b7';
  const isB6 = pageSize === 'b6';

  const colWidths = isB7
    ? {
        no: 'w-[22px]',
        qty: 'w-[32px]',
        weight: 'w-[32px]',
        price: 'w-[44px]',
        amount: 'w-[54px]',
      }
    : isB6
    ? {
        no: 'w-[26px]',
        qty: 'w-[42px]',
        weight: 'w-[42px]',
        price: 'w-[56px]',
        amount: 'w-[70px]',
      }
    : {
        no: 'w-8',
        qty: 'w-14',
        weight: 'w-16',
        price: 'w-18',
        amount: 'w-22',
      };

  const tablePad = isB7 ? 'p-0.5' : 'p-1';
  const tableHeadFont = isB7 ? 'text-[8px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]';
  const tableBodyFont = isB7 ? 'text-[8px]' : isB6 ? 'text-[10px]' : 'text-xs';
  const footerFont = isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-xs';

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
            data-theme-isolated="true"
            className={`bg-white text-slate-900 font-sans leading-tight border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 shadow-md print-bill-canvas ${
              pageSize === 'a4'
                ? 'max-w-[730px] w-full text-[12px] p-5 sm:p-6'
                : pageSize === 'a5'
                ? 'max-w-[510px] w-full text-[11px] p-4 sm:p-5'
                : pageSize === 'b6'
                ? 'max-w-[430px] w-full text-[10px] p-2.5 sm:p-3'
                : pageSize === 'b7'
                ? 'max-w-[300px] w-full text-[8.5px] p-2 sm:p-2.5'
                : 'max-w-[490px] w-full text-[11px] p-4 sm:p-5'
            }`}
            style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
          >
            {/* Header: Company Initials & Bilingual Names */}
            <div className={`text-center mb-1 ${isB7 ? 'pb-1' : 'pb-1.5'}`}>
              {currentProfile.shortCode && (
                <div className={`font-bold tracking-widest uppercase text-slate-900 dark:text-slate-900 print:text-black ${isB7 ? 'text-[10px]' : 'text-sm'}`}>
                  {currentProfile.shortCode}
                </div>
              )}
              <h1 className={`font-black tracking-wider uppercase mt-0.5 text-slate-950 dark:text-slate-950 print:text-black ${isB7 ? 'text-sm sm:text-base' : isB6 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>
                {currentProfile.name}
              </h1>
              {currentProfile.hindiName && (
                <div className={`font-bold tracking-wide mt-0.5 font-devanagari text-slate-950 dark:text-slate-950 print:text-black ${isB7 ? 'text-xs sm:text-sm' : isB6 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}>
                  {currentProfile.hindiName}
                </div>
              )}
              <div className={`${isB7 ? 'text-[8.5px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]'} leading-snug mt-0.5 text-slate-800 dark:text-slate-800 print:text-black`}>
                {currentProfile.address}
                {currentProfile.city ? `, ${currentProfile.city}` : ''}
                {currentProfile.state ? `, ${currentProfile.state}` : ''}
              </div>
              <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
            </div>

            {/* Document Title */}
            <div className={`text-center ${isB7 ? 'my-1' : 'my-2'}`}>
              <span className={`font-bold uppercase tracking-widest border-b border-black pb-0.5 ${isB7 ? 'text-[9px]' : 'text-sm'}`}>
                SALE PROCEED
              </span>
            </div>

            {/* Metadata Section */}
            <div className={`flex justify-between items-start ${isB7 ? 'text-[8.5px] mb-1' : 'text-xs mb-2'} pt-1 font-medium`}>
              {/* Left Side: M/s. & Address */}
              <div className="max-w-[65%]">
                <div className="font-bold text-slate-500 print:text-black">M/s.</div>
                <div className={`font-bold uppercase ${isB7 ? 'text-[9px] sm:text-[10px]' : isB6 ? 'text-xs' : 'text-xs sm:text-sm'}`}>{vendorName}</div>
                {vendorAddress && <div className={isB7 ? 'text-[8px]' : 'text-[11px]'}>{vendorAddress}</div>}
                <div className={`mt-0.5 ${isB7 ? 'text-[8px]' : 'text-[11px]'}`}>
                  Challan DT: <strong>{formatDate(proceeds.challanDate || proceeds.date)}</strong>
                </div>
              </div>

              {/* Right Side: Number & Date */}
              <div className={`text-right whitespace-nowrap ${isB7 ? 'text-[8px]' : 'text-xs'}`}>
                <div>
                  NUMBER: <strong className="font-mono">{proceedsDisplayNumber}</strong>
                </div>
                <div>
                  DATE: <strong>{formatDate(proceeds.date)}</strong>
                </div>
              </div>
            </div>

            {/* Item Table matching Reference 1 */}
            <table className={`w-full border-collapse border border-black ${tableBodyFont}`}>
              <thead>
                <tr className={`border-b border-black font-bold uppercase ${tableHeadFont} bg-slate-50 print:bg-transparent`}>
                  <th className={`border-r border-black ${tablePad} text-center ${colWidths.no}`}>No.</th>
                  <th className={`border-r border-black ${tablePad} text-left`}>ITEM NAME</th>
                  <th className={`border-r border-black ${tablePad} text-right ${colWidths.qty}`}>QTY</th>
                  <th className={`border-r border-black ${tablePad} text-right ${colWidths.weight}`}>WEIGHT</th>
                  <th className={`border-r border-black ${tablePad} text-right ${colWidths.price}`}>PRICE</th>
                  <th className={`${tablePad} text-right ${colWidths.amount}`}>AMOUNT</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id || idx} className="border-b border-black/40">
                    <td className={`border-r border-black ${tablePad} text-center font-mono`}>{idx + 1}</td>
                    <td className={`border-r border-black ${tablePad} font-semibold uppercase`}>{it.fruitName}</td>
                    <td className={`border-r border-black ${tablePad} text-right font-mono`}>{it.quantity}</td>
                    <td className={`border-r border-black ${tablePad} text-right font-mono`}>
                      {(() => {
                        const itemWeight = it.weight !== undefined && it.weight !== null
                          ? it.weight
                          : (it.kg !== undefined && it.kg !== null ? it.kg : undefined);
                        const numW = itemWeight !== undefined ? Number(itemWeight) : undefined;
                        if (numW !== undefined && !isNaN(numW) && numW > 0) {
                          return numW;
                        }
                        if (items.length === 1 && itemWeight === undefined) {
                          const topWeight = proceeds.weight !== undefined && proceeds.weight !== null
                            ? proceeds.weight
                            : proceeds.kg;
                          const topNum = topWeight !== undefined ? Number(topWeight) : 0;
                          return topNum > 0 ? topNum : '';
                        }
                        return '';
                      })()}
                    </td>
                    <td className={`border-r border-black ${tablePad} text-right font-mono`}>
                      {formatBillAmount(it.rate)}
                    </td>
                    <td className={`${tablePad} text-right font-mono font-bold`}>
                      {formatBillAmount(it.amount)}
                    </td>
                  </tr>
                ))}

                {/* Preserved Blank Rows to maintain traditional wholesale bill spacing */}
                {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
                  <tr key={`blank-${bIdx}`} className={`border-b border-black/20 ${isB7 ? 'h-3.5' : isB6 ? 'h-4' : 'h-6'}`}>
                    <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                    <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                    <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                    <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                    <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
                    <td className={tablePad}>&nbsp;</td>
                  </tr>
                ))}
              </tbody>

              {/* Lower Section: Expenses List + Subtotal & Net Total Grid */}
              <tfoot>
                <tr className="border-t-2 border-black">
                  {/* Left Bottom Section: E & O.E. + Expenses List */}
                  <td colSpan={isB7 ? 3 : 5} className={`border-r border-black ${tablePad} align-top`}>
                    <div className="flex flex-col justify-between h-full min-h-[50px]">
                      <div className={`${isB7 ? 'text-[7.5px]' : 'text-[10px]'} font-bold text-slate-950 dark:text-slate-950 print:text-black`}>* E & O.E.</div>

                      {/* Listed Individual Expenses */}
                      {proceeds.expenses && proceeds.expenses.length > 0 && (
                        <div className={`self-end text-right font-mono ${isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]'} space-y-0.5 pr-1`}>
                          {proceeds.expenses.map((exp, expIdx) => (
                            <div key={expIdx} className="flex justify-end gap-2 sm:gap-3 text-slate-950 dark:text-slate-950 print:text-black">
                              <span className="font-sans font-medium text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                              <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Right Bottom Section: Sub Total, Expenses, Net Total */}
                  <td colSpan={isB7 ? 3 : 1} className="p-0 align-top">
                    <table className={`w-full ${footerFont} border-collapse`}>
                      <tbody>
                        <tr className="border-b border-black">
                          <td className={`${tablePad} font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black`}>Sub Total</td>
                          <td className={`${tablePad} text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black`}>
                            {formatBillAmount(subTotal)}
                          </td>
                        </tr>
                        <tr className="border-b border-black">
                          <td className={`${tablePad} font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black`}>Expenses</td>
                          <td className={`${tablePad} text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black`}>
                            {expenseDisplay}
                          </td>
                        </tr>
                        <tr>
                          <td className={`${tablePad} font-bold text-left border-r border-black bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black`}>
                            Net Total
                          </td>
                          <td className={`${tablePad} text-right font-mono font-black ${isB7 ? 'text-[8.5px]' : isB6 ? 'text-[11px]' : 'text-sm'} bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black`}>
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
            <div className={`mt-2 flex justify-between items-end ${isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-xs'} pt-1 text-slate-950 dark:text-slate-950 print:text-black`}>
              {/* Amount in words */}
              <div className="font-bold italic max-w-[60%] leading-tight text-slate-950 dark:text-slate-950 print:text-black">
                {words}
              </div>

              {/* Signatory for company profile */}
              <div className="text-right font-bold uppercase leading-tight text-slate-950 dark:text-slate-950 print:text-black">
                <div>{formatCompanySignature(currentProfile)}</div>
              </div>
            </div>

            {/* Software attribution */}
            <div className={`mt-2 pt-0.5 border-t border-dotted border-black/40 ${isB7 ? 'text-[7px]' : 'text-[8px] sm:text-[8.5px]'} text-left text-slate-700 dark:text-slate-700 print:text-black font-mono`}>
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
