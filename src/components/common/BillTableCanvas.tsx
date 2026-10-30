import React from 'react';
import { CompanyProfile, CrateMovementItem } from '../../types';
import { formatDate, formatBillAmount, numberToWordsIndian, formatCompanySignature } from '../../utils/formatters';
import {
  BillingLineItem,
  formatQtyWithUnit,
  calculateLineKg,
  calculateSaleCrateSummary,
  calculateWholesaleItemAmount,
} from '../../utils/billingCalculations';
import { maskAadhaar } from '../../utils/aadhaarUtils';
import { db } from '../../services/db';
import { CompanyContactsHeader } from './CompanyContactsHeader';
import { BillPaperSize } from '../../utils/pdfAndShareEngine';

export interface BillTableCanvasProps {
  saleType: 'CREDIT SALE' | 'CASH SALE';
  billNumber: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  customerMobile?: string;
  customerAlternateContacts?: string[];
  customerAadhaarNo?: string;
  items: BillingLineItem[];
  expenses?: Array<{ id?: string; name: string; amount: number }>;
  productTotal?: number;
  expenseTotal?: number;
  finalAmount?: number;
  netTotal?: number;
  oldBalance?: number;
  cashReceipt?: number;
  totalBalance?: number;
  paymentMode?: string;
  crateOut?: number;
  crateIn?: number;
  crateWeightKg?: number;
  crateMovements?: CrateMovementItem[];
  profile?: CompanyProfile;
  pageSize?: BillPaperSize;
  isLivePreview?: boolean;
}

export const BillTableCanvas: React.FC<BillTableCanvasProps> = ({
  saleType,
  billNumber,
  date,
  customerName,
  customerAddress,
  customerMobile,
  customerAlternateContacts,
  customerAadhaarNo,
  items,
  expenses = [],
  productTotal,
  expenseTotal,
  finalAmount,
  netTotal: passedNetTotal,
  oldBalance,
  cashReceipt,
  totalBalance: passedTotalBalance,
  paymentMode,
  crateOut,
  crateIn,
  crateWeightKg,
  crateMovements,
  profile,
  pageSize = 'compact',
  isLivePreview = false,
}) => {
  const currentProfile = profile || db.getDefaultProfile() || db.getCompanyProfiles()[0];
  const fruitsCatalog = db.getFruits();

  // Clean bill number display (e.g. Credit Sale No. 001 -> 001)
  const displayNumber = billNumber.replace(/\D/g, '') || billNumber || '001';

  // Subtotal & net totals
  const subTotal =
    productTotal !== undefined
      ? productTotal
      : items.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
  const expTotal =
    expenseTotal !== undefined
      ? expenseTotal
      : expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const netTotal =
    passedNetTotal !== undefined
      ? passedNetTotal
      : (finalAmount !== undefined ? finalAmount : subTotal + expTotal);
  const numCashReceipt = cashReceipt !== undefined ? cashReceipt : 0;
  const totalBalance =
    passedTotalBalance !== undefined
      ? passedTotalBalance
      : (oldBalance !== undefined ? Math.round((netTotal + oldBalance - numCashReceipt) * 100) / 100 : netTotal);
  const words = numberToWordsIndian(netTotal);

  // Balance Crate calculation
  const crateSummary = calculateSaleCrateSummary(items, crateOut, crateIn, crateWeightKg);

  // Minimum rows for clean mandi layout based on paper size
  const minRows =
    pageSize === 'b7' ? 2 : pageSize === 'b6' ? 4 : pageSize === 'a5' || pageSize === 'compact' ? 6 : 8;
  const blankRowsCount = Math.max(0, minRows - items.length);

  const isB7 = pageSize === 'b7';
  const isB6 = pageSize === 'b6';

  // Width & typography scaling for selected paper size
  const sizeClasses =
    pageSize === 'a4'
      ? 'max-w-[730px] w-full text-[12px] p-5 sm:p-6'
      : pageSize === 'a5'
      ? 'max-w-[510px] w-full text-[11px] p-4 sm:p-5'
      : pageSize === 'b6'
      ? 'max-w-[430px] w-full text-[10px] p-2.5 sm:p-3'
      : pageSize === 'b7'
      ? 'max-w-[300px] w-full text-[8.5px] p-2 sm:p-2.5'
      : 'max-w-[490px] w-full text-[11px] p-4 sm:p-5';

  // Responsive column widths and spacing per format
  const colWidths = isB7
    ? {
        no: 'w-[22px]',
        qty: 'w-[36px]',
        kg: 'w-[28px]',
        rate: 'w-[44px]',
        amount: 'w-[54px]',
      }
    : isB6
    ? {
        no: 'w-[26px]',
        qty: 'w-[46px]',
        kg: 'w-[38px]',
        rate: 'w-[56px]',
        amount: 'w-[70px]',
      }
    : {
        no: 'w-8',
        qty: 'w-16',
        kg: 'w-16',
        rate: 'w-18',
        amount: 'w-22',
      };

  const tablePad = isB7 ? 'p-0.5' : 'p-1';
  const tableHeadFont = isB7 ? 'text-[8px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]';
  const tableBodyFont = isB7 ? 'text-[8px]' : isB6 ? 'text-[10px]' : 'text-xs';
  const footerFont = isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]';

  return (
    <div
      id={isLivePreview ? 'mandi-live-preview-canvas' : 'mandi-print-area'}
      data-theme-isolated="true"
      className={`bg-white text-slate-900 font-sans leading-tight border border-slate-300 print:border-none print:shadow-none print:p-0 print:m-0 shadow-sm mx-auto print-bill-canvas ${sizeClasses}`}
      style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif" }}
    >
      {/* Header: Company Details (English + Hindi Bilingual) */}
      <div className={`text-center mb-1 border-b border-slate-200 print:border-black/60 ${isB7 ? 'pb-1' : 'pb-2'}`}>
        {currentProfile.shortCode && (
          <div className={`font-bold tracking-widest uppercase text-slate-900 dark:text-slate-900 print:text-black ${isB7 ? 'text-[10px]' : 'text-xs'}`}>
            {currentProfile.shortCode}
          </div>
        )}
        <h1 className={`font-black tracking-wider uppercase mt-0.5 text-slate-950 dark:text-slate-950 print:text-black ${isB7 ? 'text-sm sm:text-base' : isB6 ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'}`}>
          {currentProfile.name}
        </h1>
        {currentProfile.hindiName && (
          <div className={`font-bold tracking-wide text-slate-900 dark:text-slate-900 print:text-black mt-0.5 font-devanagari ${isB7 ? 'text-xs sm:text-sm' : isB6 ? 'text-sm sm:text-base' : 'text-base sm:text-lg'}`}>
            {currentProfile.hindiName}
          </div>
        )}
        <div className={`${isB7 ? 'text-[8.5px]' : isB6 ? 'text-[9.5px]' : 'text-[11px]'} text-slate-800 dark:text-slate-800 print:text-black leading-snug mt-0.5`}>
          {currentProfile.address}
          {currentProfile.city ? `, ${currentProfile.city}` : ''}
          {currentProfile.state ? `, ${currentProfile.state}` : ''}
        </div>
        <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
        {currentProfile.aadhaarNo && (
          <div className={`${isB7 ? 'text-[7.5px]' : 'text-[10px]'} font-mono text-slate-800 dark:text-slate-800 print:text-black`}>
            Aadhaar: {maskAadhaar(currentProfile.aadhaarNo)}
          </div>
        )}
      </div>

      {/* Sale Document Title: CREDIT SALE or CASH SALE */}
      <div className={`text-center ${isB7 ? 'my-1' : 'my-2'} flex items-center justify-center gap-2`}>
        <span className={`font-bold uppercase tracking-widest border-b border-slate-800 print:border-black pb-0.5 ${isB7 ? 'text-[9px]' : 'text-xs'}`}>
          {saleType}
        </span>
        {saleType === 'CASH SALE' && paymentMode && (
          <span className={`${isB7 ? 'text-[8px] px-1' : 'text-[10px] px-1.5'} uppercase font-semibold text-emerald-700 bg-emerald-50 print:bg-transparent py-0.2 rounded border border-emerald-200 print:border-none`}>
            ({paymentMode} PAID)
          </span>
        )}
        {isLivePreview && (
          <span className="no-print text-[9px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
            Live Preview
          </span>
        )}
      </div>

      {/* Customer and Metadata Section (Only M/s Customer Name - no address, mobile, or Aadhaar) */}
      <div className={`flex justify-between items-start ${isB7 ? 'text-[8.5px] mb-1 pb-1' : 'text-xs mb-2 pb-2'} pt-1 font-medium border-b border-slate-200 print:border-black/40`}>
        {/* Left Side: M/s. Customer Name */}
        <div className={`max-w-[65%] ${isB7 ? 'min-h-[24px]' : 'min-h-[36px]'}`}>
          {saleType === 'CASH SALE' && !customerName?.trim() ? (
            /* Blank customer area for Cash Sale when customer is not provided */
            <div className={isB7 ? 'h-4' : 'h-6'}>&nbsp;</div>
          ) : (
            <>
              <div className="font-bold text-slate-500 print:text-black">M/s.</div>
              <div className={`font-bold uppercase text-slate-900 print:text-black ${isB7 ? 'text-[9px] sm:text-[10px]' : isB6 ? 'text-xs' : 'text-xs sm:text-sm'}`}>
                {customerName?.trim() || (saleType === 'CREDIT SALE' ? 'Customer' : '')}
              </div>
            </>
          )}
        </div>

        {/* Right Side: Bill No & Date */}
        <div className={`text-right whitespace-nowrap ${isB7 ? 'text-[8px]' : 'text-xs'}`}>
          <div>
            NUMBER: <strong className="font-mono text-slate-900 print:text-black">{displayNumber}</strong>
          </div>
          <div>
            DATE: <strong>{formatDate(date)}</strong>
          </div>
        </div>
      </div>

      {/* Exact Table Format: No. | Item Name | Qty | KG | Rate | Amount */}
      <table className={`w-full border-collapse border border-slate-300 print:border-black ${tableBodyFont}`}>
        <thead>
          <tr className={`border-b border-slate-300 print:border-black font-bold uppercase ${tableHeadFont} bg-slate-50 print:bg-transparent text-slate-800 print:text-black`}>
            <th className={`border-r border-slate-300 print:border-black ${tablePad} text-center ${colWidths.no}`}>No.</th>
            <th className={`border-r border-slate-300 print:border-black ${tablePad} text-left`}>ITEM NAME</th>
            <th className={`border-r border-slate-300 print:border-black ${tablePad} text-right ${colWidths.qty}`}>QTY</th>
            <th className={`border-r border-slate-300 print:border-black ${tablePad} text-right ${colWidths.kg}`}>KG</th>
            <th className={`border-r border-slate-300 print:border-black ${tablePad} text-right ${colWidths.rate}`}>RATE</th>
            <th className={`${tablePad} text-right ${colWidths.amount}`}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const lineKg = it.kg !== undefined ? (Number(it.kg) || 0) : 0;
            const lineAmount =
              it.amount !== undefined
                ? it.amount
                : calculateWholesaleItemAmount(it.quantity, it.unit, lineKg, it.rate);

            return (
              <tr key={it.id || idx} className="border-b border-slate-200 print:border-black/30">
                <td className={`border-r border-slate-300 print:border-black ${tablePad} text-center font-mono`}>
                  {idx + 1}
                </td>
                <td className={`border-r border-slate-300 print:border-black ${tablePad} font-semibold uppercase`}>
                  {it.fruitName || 'ITEM'}
                </td>
                <td className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-mono font-medium`}>
                  {formatQtyWithUnit(it.quantity, it.unit)}
                </td>
                <td className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-mono`}>
                  {lineKg > 0 ? lineKg : 0}
                </td>
                <td className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-mono`}>
                  {formatBillAmount(it.rate)}
                </td>
                <td className={`${tablePad} text-right font-mono font-bold`}>
                  {formatBillAmount(lineAmount)}
                </td>
              </tr>
            );
          })}

          {/* Preserved Blank Rows for Mandi Balance */}
          {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
            <tr key={`blank-${bIdx}`} className={`border-b border-slate-100 print:border-black/20 ${isB7 ? 'h-3.5' : isB6 ? 'h-4' : 'h-5'}`}>
              <td className={`border-r border-slate-300 print:border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-slate-300 print:border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-slate-300 print:border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-slate-300 print:border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-slate-300 print:border-black ${tablePad}`}>&nbsp;</td>
              <td className={tablePad}>&nbsp;</td>
            </tr>
          ))}
        </tbody>

        {/* Lower Section: Structured totals, balance crate, and expenses */}
        <tfoot>
          {isB7 ? (
            /* B7 Compact Layout: 2 balanced half-spans to eliminate horizontal clipping and 2-line wraps */
            <tr className="border-t border-slate-300 print:border-black">
              {/* Left Side (colSpan=3): Balance Crate & Expenses stacked */}
              <td colSpan={3} className="border-r border-slate-300 print:border-black p-1 align-top">
                <div className="text-[7.5px] font-mono leading-tight space-y-1">
                  <div>
                    <div className="font-bold text-slate-950 dark:text-slate-950 print:text-black">
                      Balance Crate: {crateMovements && crateMovements.length > 0
                        ? crateMovements.reduce((sum, m) => sum + Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0)), 0)
                        : crateSummary.totalBalanceCrates}
                    </div>
                    {crateMovements && crateMovements.length > 0 ? (
                      <div className="space-y-0.5 mt-0.5 text-slate-900 dark:text-slate-900 print:text-black">
                        {crateMovements.map((m, mIdx) => (
                          <div key={mIdx}>
                            {m.crateName}: {m.outQuantity || 0} Out{m.inQuantity ? `, ${m.inQuantity} In` : ''} ({Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0))} Bal)
                          </div>
                        ))}
                      </div>
                    ) : crateSummary.breakdown.length > 0 ? (
                      <div className="space-y-0.5 mt-0.5 text-slate-900 dark:text-slate-900 print:text-black">
                        {crateSummary.breakdown.map((b) => (
                          <div key={b.weightKg}>
                            {b.weightKg}Kg = {b.count}
                          </div>
                        ))}
                      </div>
                    ) : (
                      crateSummary.totalBalanceCrates > 0 && (
                        <div className="text-slate-900 dark:text-slate-900 print:text-black mt-0.5 font-medium">
                          {(crateWeightKg || 20)}Kg = {crateSummary.totalBalanceCrates}
                        </div>
                      )
                    )}
                  </div>

                  {expenses && expenses.length > 0 && (
                    <div className="border-t border-slate-200 print:border-black/30 pt-0.5 space-y-0.5">
                      <div className="font-bold uppercase text-[7px] text-slate-950 dark:text-slate-950 print:text-black">
                        Expenses
                      </div>
                      {expenses.map((exp, expIdx) => (
                        <div key={expIdx} className="flex justify-between text-slate-950 dark:text-slate-950 print:text-black font-semibold">
                          <span className="font-sans font-medium text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                          <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[7px] font-bold text-slate-950 dark:text-slate-950 print:text-black pt-0.5">
                    * E & O.E.
                  </div>
                </div>
              </td>

              {/* Right Side (colSpan=3): Subtotal, Expenses, Net Total & Balances Table */}
              <td colSpan={3} className="p-0 align-top">
                <table className="w-full text-[8px] border-collapse">
                  <tbody>
                    <tr className="border-b border-slate-300 print:border-black">
                      <td className="p-0.5 font-semibold text-left border-r border-slate-300 print:border-black text-slate-950 dark:text-slate-950 print:text-black">
                        Total
                      </td>
                      <td className="p-0.5 text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black">
                        {formatBillAmount(subTotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 print:border-black">
                      <td className="p-0.5 font-semibold text-left border-r border-slate-300 print:border-black text-slate-950 dark:text-slate-950 print:text-black">
                        Expense
                      </td>
                      <td className="p-0.5 text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black">
                        {formatBillAmount(expTotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 print:border-black bg-slate-50 print:bg-transparent">
                      <td className="p-0.5 font-bold text-left border-r border-slate-300 print:border-black text-slate-950 dark:text-slate-950 print:text-black">
                        Net Total
                      </td>
                      <td className="p-0.5 text-right font-mono font-black text-slate-950 dark:text-slate-950 print:text-black">
                        {formatBillAmount(netTotal)}
                      </td>
                    </tr>
                    {oldBalance !== undefined && (
                      <tr className="border-b border-slate-300 print:border-black">
                        <td className="p-0.5 font-semibold text-left border-r border-slate-300 print:border-black text-slate-950 dark:text-slate-950 print:text-black">
                          Old Balance
                        </td>
                        <td className="p-0.5 text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black">
                          {formatBillAmount(oldBalance)}
                        </td>
                      </tr>
                    )}
                    {cashReceipt !== undefined && cashReceipt > 0 && (
                      <tr className="border-b border-slate-300 print:border-black">
                        <td className="p-0.5 font-semibold text-left border-r border-slate-300 print:border-black text-emerald-800 print:text-black">
                          Cash Receipt
                        </td>
                        <td className="p-0.5 text-right font-mono font-bold text-emerald-800 print:text-black">
                          -{formatBillAmount(cashReceipt)}
                        </td>
                      </tr>
                    )}
                    {oldBalance !== undefined && (
                      <tr className="bg-slate-100 print:bg-transparent">
                        <td className="p-0.5 font-black text-left border-r border-slate-300 print:border-black text-slate-950 dark:text-slate-950 print:text-black">
                          Total Balance
                        </td>
                        <td className="p-0.5 text-right font-mono font-black text-rose-700 print:text-black">
                          {formatBillAmount(totalBalance)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          ) : (
            /* B6, A5, Compact, A4 3-column reference bottom summary */
            <tr className="border-t border-slate-300 print:border-black">
              {/* 1. Left: Balance Crate & Breakdown */}
              <td colSpan={2} className={`border-r border-slate-300 print:border-black ${isB6 ? 'p-1.5' : 'p-2'} align-top`}>
                <div className={`${footerFont} font-mono leading-tight`}>
                  <div className="font-bold text-slate-950 dark:text-slate-950 print:text-black">
                    Balance Crate: {crateMovements && crateMovements.length > 0
                      ? crateMovements.reduce((sum, m) => sum + Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0)), 0)
                      : crateSummary.totalBalanceCrates}
                  </div>
                  {crateMovements && crateMovements.length > 0 ? (
                    <div className="space-y-0.5 mt-1 text-slate-900 dark:text-slate-900 print:text-black">
                      {crateMovements.map((m, mIdx) => (
                        <div key={mIdx}>
                          {m.crateName}: {m.outQuantity || 0} Out{m.inQuantity ? `, ${m.inQuantity} In` : ''} ({Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0))} Bal)
                        </div>
                      ))}
                    </div>
                  ) : crateSummary.breakdown.length > 0 ? (
                    <div className="space-y-0.5 mt-1 text-slate-900 dark:text-slate-900 print:text-black">
                      {crateSummary.breakdown.map((b) => (
                        <div key={b.weightKg}>
                          {b.weightKg}Kg = {b.count}
                        </div>
                      ))}
                    </div>
                  ) : (
                    crateSummary.totalBalanceCrates > 0 && (
                      <div className="text-slate-900 dark:text-slate-900 print:text-black mt-0.5 font-medium">
                        {(crateWeightKg || 20)}Kg = {crateSummary.totalBalanceCrates}
                      </div>
                    )
                  )}
                  <div className={`${isB6 ? 'text-[8.5px]' : 'text-[10px]'} font-bold text-slate-950 dark:text-slate-950 print:text-black mt-2`}>
                    * E & O.E.
                  </div>
                </div>
              </td>

              {/* 2. Middle: Expenses (Freight, Hamali, Others) */}
              <td colSpan={2} className={`border-r border-slate-300 print:border-black ${isB6 ? 'p-1.5' : 'p-2'} align-top`}>
                <div className={`${footerFont} font-mono leading-tight space-y-1`}>
                  <div className={`font-bold uppercase ${isB6 ? 'text-[8.5px]' : 'text-[10px]'} text-slate-950 dark:text-slate-950 print:text-black border-b border-slate-300 print:border-black/30 pb-0.5`}>
                    Expenses
                  </div>
                  {expenses && expenses.length > 0 ? (
                    expenses.map((exp, expIdx) => (
                      <div key={expIdx} className="flex justify-between text-slate-950 dark:text-slate-950 print:text-black font-semibold">
                        <span className="font-sans font-medium text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                        <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={`text-slate-600 dark:text-slate-600 italic ${isB6 ? 'text-[8.5px]' : 'text-[10px]'}`}>Nil</div>
                  )}
                </div>
              </td>

              {/* 3. Right: Total, Expense, Net Total, Old Balance, Cash Receipt, Total Balance */}
              <td colSpan={2} className="p-0 align-top">
                <table className={`w-full ${footerFont} border-collapse`}>
                  <tbody>
                    <tr className="border-b border-slate-300 print:border-black">
                      <td className={`p-1 font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        Total
                      </td>
                      <td className={`p-1 text-right font-mono font-bold ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        {formatBillAmount(subTotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 print:border-black">
                      <td className={`p-1 font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        Expense
                      </td>
                      <td className={`p-1 text-right font-mono font-bold ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        {formatBillAmount(expTotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 print:border-black bg-slate-50 print:bg-transparent">
                      <td className={`p-1 font-bold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        Net Total
                      </td>
                      <td className={`p-1 text-right font-mono font-black ${isB6 ? 'text-[10.5px]' : 'text-xs'} text-slate-950 dark:text-slate-950 print:text-black`}>
                        {formatBillAmount(netTotal)}
                      </td>
                    </tr>
                    {oldBalance !== undefined && (
                      <tr className="border-b border-slate-300 print:border-black">
                        <td className={`p-1 font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                          Old Balance
                        </td>
                        <td className={`p-1 text-right font-mono font-bold ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                          {formatBillAmount(oldBalance)}
                        </td>
                      </tr>
                    )}
                    {cashReceipt !== undefined && cashReceipt > 0 && (
                      <tr className="border-b border-slate-300 print:border-black">
                        <td className={`p-1 font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-emerald-800 print:text-black`}>
                          Cash Receipt
                        </td>
                        <td className={`p-1 text-right font-mono font-bold ${footerFont} text-emerald-800 print:text-black`}>
                          -{formatBillAmount(cashReceipt)}
                        </td>
                      </tr>
                    )}
                    {oldBalance !== undefined && (
                      <tr className="bg-slate-100 print:bg-transparent">
                        <td className={`p-1 font-black text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                          Total Balance
                        </td>
                        <td className={`p-1 text-right font-mono font-black ${isB6 ? 'text-[11px]' : 'text-xs sm:text-sm'} text-rose-700 print:text-black`}>
                          {formatBillAmount(totalBalance)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </td>
            </tr>
          )}
        </tfoot>
      </table>

      {/* Amount in words & Signature */}
      <div className={`mt-1.5 flex justify-between items-end ${isB7 ? 'text-[7.5px]' : isB6 ? 'text-[9.5px]' : 'text-xs'} pt-1 border-t border-slate-100 print:border-none text-slate-950 dark:text-slate-950 print:text-black`}>
        <div className="font-bold italic max-w-[60%] leading-tight text-slate-950 dark:text-slate-950 print:text-black">
          {words}
        </div>
        <div className="text-right font-bold uppercase leading-tight text-slate-950 dark:text-slate-950 print:text-black">
          <div>{formatCompanySignature(currentProfile)}</div>
        </div>
      </div>

      {/* Software footer */}
      <div className={`mt-1.5 pt-0.5 border-t border-dotted border-slate-300 print:border-black/30 ${isB7 ? 'text-[7px]' : 'text-[8px] sm:text-[8.5px]'} text-left text-slate-700 dark:text-slate-700 print:text-black font-mono`}>
        Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
      </div>
    </div>
  );
};
