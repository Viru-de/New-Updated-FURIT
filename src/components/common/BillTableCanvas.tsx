import React from 'react';
import { CompanyProfile, CrateMovementItem } from '../../types';
import { formatDate, formatBillAmount, numberToWordsIndian, formatCompanySignature, formatCleanBillNumber } from '../../utils/formatters';
import {
  BillingLineItem,
  formatBillQtyWithUnit,
  getBillItemNameCellClass,
  calculateLineKg,
  calculateSaleCrateSummary,
  calculateWholesaleItemAmount,
} from '../../utils/billingCalculations';
import { db } from '../../services/db';
import { PrintBusinessHeader } from './PrintBusinessHeader';
import { BillPaperSize } from '../../utils/pdfAndShareEngine';

export interface BillTableCanvasProps {
  saleType: 'CREDIT SALE' | 'CASH SALE';
  billNumber: string;
  date: string;
  customerName: string;
  customerAddress?: string;
  customerMobile?: string;
  customerContactPerson?: string;
  customerAlternateContacts?: string[];
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
  challanDate?: string;
}

export const BillTableCanvas: React.FC<BillTableCanvasProps> = ({
  saleType,
  billNumber,
  date,
  challanDate,
  customerName,
  customerAddress,
  customerMobile,
  customerContactPerson,
  customerAlternateContacts,
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
  pageSize = 'a5',
  isLivePreview = false,
}) => {
  const currentProfile = profile || db.getDefaultProfile() || db.getCompanyProfiles()[0];
  const fruitsCatalog = db.getFruits();

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

  // Total Qty across all bill items (excluding weight)
  const totalQty = Math.round(
    items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000
  ) / 1000;

  // Total Weight across all bill items
  const totalWeight = Math.round(
    items.reduce((sum, it) => sum + (Number((it as any).weight ?? it.kg) || 0), 0) * 1000
  ) / 1000;

  const isCreditSale = saleType === 'CREDIT SALE';

  // Minimum rows for clean mandi layout based on paper size
  const minRows =
    pageSize === 'b7' ? 2 : pageSize === 'b6' ? 4 : pageSize === 'a5' || pageSize === 'compact' ? 6 : 8;
  const blankRowsCount = Math.max(0, minRows - items.length);

  const isB7 = pageSize === 'b7';
  const isB6 = pageSize === 'b6';
  const isA5 = pageSize === 'a5';

  // Width & typography scaling for selected paper size
  const sizeClasses =
    pageSize === 'a4'
      ? 'max-w-[730px] w-full text-[12px] pt-1.5 px-4 pb-3 sm:pt-2 sm:px-5 sm:pb-4'
      : pageSize === 'a5'
      ? 'max-w-[550px] w-full text-[10px] pt-0.5 px-2.5 pb-1.5 sm:pt-1 sm:px-3 sm:pb-2'
      : pageSize === 'b6'
      ? 'max-w-[430px] w-full text-[10px] pt-1 px-2.5 pb-2 sm:px-3'
      : pageSize === 'b7'
      ? 'max-w-[300px] w-full text-[8.5px] pt-0.5 px-2 pb-1.5'
      : 'max-w-[490px] w-full text-[11px] pt-1 px-3 pb-2 sm:pt-1.5 sm:px-3.5 sm:pb-2.5';

  // Balanced percentage column widths matching Sale Proceed Bill Print
  const colWidths = isB7
    ? {
        no: '6%',
        item: '31%',
        qty: '21%',
        kg: '12%',
        rate: '13%',
        amount: '17%',
      }
    : isB6
    ? {
        no: '5%',
        item: '35%',
        qty: '19%',
        kg: '11%',
        rate: '13%',
        amount: '17%',
      }
    : pageSize === 'a4'
    ? {
        no: '5%',
        item: '37%',
        qty: '17%',
        kg: '12%',
        rate: '13%',
        amount: '16%',
      }
    : {
        no: '5%',
        item: '35%',
        qty: '18%',
        kg: '13%',
        rate: '13%',
        amount: '16%',
      };

  const tablePad = isB7 ? 'p-0.5' : isA5 ? 'px-1 py-[2px]' : 'p-1';
  const summaryCellPad = isA5 ? 'px-1 py-[2px]' : 'p-1';
  const rowHeight = isB7 ? 'h-3.5' : isB6 ? 'h-4' : isA5 ? 'h-[18px]' : 'h-5';
  const tableHeadFont = isB7
    ? 'text-[8px] print:text-[9px]'
    : isB6
    ? 'text-[9.5px] print:text-[11px]'
    : isA5
    ? 'text-[9.5px] print:text-[9.5px]'
    : 'text-[11px] print:text-[11.5px]';
  const tableBodyFont = isB7
    ? 'text-[8px] print:text-[9.5px]'
    : isB6
    ? 'text-[10px] print:text-[11.5px]'
    : isA5
    ? 'text-[10px] print:text-[10px] leading-[1.15]'
    : 'text-xs print:text-[12.5px]';
  const footerFont = isB7
    ? 'text-[7.5px] print:text-[9px]'
    : isB6
    ? 'text-[9.5px] print:text-[11px]'
    : isA5
    ? 'text-[9.5px] print:text-[9.5px]'
    : 'text-[11px] print:text-[12px]';
  const totalQtyRowFont = isB7
    ? 'text-[7.5px] print:text-[8.5px]'
    : isB6
    ? 'text-[9.5px] print:text-[10.5px]'
    : isA5
    ? 'text-[9px] print:text-[9px]'
    : 'text-[11px] print:text-[11.5px]';
  const cleanBillNumber = formatCleanBillNumber(billNumber);

  return (
    <div
      id={isLivePreview ? 'mandi-live-preview-canvas' : 'mandi-print-area'}
      data-theme-isolated="true"
      className={`bg-white text-slate-900 font-sans leading-tight ${
        isLivePreview
          ? 'border border-slate-300 print:border-none'
          : 'border border-slate-200 print:border-none'
      } print:p-0 print:m-0 box-border shadow-sm mx-auto print-bill-canvas ${sizeClasses}`}
      style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif", boxSizing: 'border-box' }}
    >
      {/* Shared Business Header (JD -> Hindi -> Bold English -> Address -> Contact) */}
      <PrintBusinessHeader
        profile={currentProfile}
        variant="bill"
        paperSize={pageSize}
      />

      {/* Sale Document Title: CREDIT SALE or CASH SALE */}
      <div className={`text-center ${isB7 || isA5 ? 'my-0.5' : 'my-1'} flex items-center justify-center gap-2`}>
        <span className={`font-bold uppercase tracking-widest border-b border-black pb-0.5 ${isB7 ? 'text-[9px]' : isA5 ? 'text-[11px] sm:text-xs print:text-[11.5px]' : 'text-xs sm:text-sm'}`}>
          {saleType}
        </span>
        {saleType === 'CASH SALE' && paymentMode && (
          <span className={`${isB7 ? 'text-[8px] px-1' : isA5 ? 'text-[9px] px-1' : 'text-[10px] px-1.5'} uppercase font-semibold text-emerald-700 bg-emerald-50 print:bg-transparent py-0.2 rounded border border-emerald-200 print:border-none`}>
            ({paymentMode} PAID)
          </span>
        )}
        {isLivePreview && (
          <span className="no-print text-[9px] uppercase font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
            Live Preview
          </span>
        )}
      </div>

      {/* Customer and Metadata Section (Customer Name on Left, Bill No. & Date on Right) */}
      <div className={`flex justify-between items-start gap-2 ${isB7 ? 'text-[8.5px] mb-1 pb-0.5' : isA5 ? 'text-[10.5px] mb-1 pb-0.5' : 'text-xs mb-1 pb-1'} pt-0 font-medium border-b border-black/40`}>
        {/* Left Side: M/s: Customer Name only */}
        <div className={`min-w-0 max-w-[62%] break-words ${isB7 ? 'min-h-[16px]' : isA5 ? 'min-h-[16px]' : 'min-h-[22px]'}`}>
          {saleType === 'CASH SALE' && !customerName?.trim() ? (
            /* Blank customer area for Cash Sale when customer is not provided */
            <div className={isB7 || isA5 ? 'h-4' : 'h-5'}>&nbsp;</div>
          ) : (
            <div className={`font-bold uppercase text-black ${isB7 ? 'text-[9px] sm:text-[10px]' : isB6 ? 'text-xs' : isA5 ? 'text-[11px] sm:text-[11.5px]' : 'text-xs sm:text-sm'}`}>
              M/s: {customerName?.trim() || (saleType === 'CREDIT SALE' ? 'Customer' : '')}
            </div>
          )}
        </div>

        {/* Right Side: Bill Number & Date */}
        <div className={`shrink-0 text-right whitespace-nowrap ${isB7 ? 'text-[8px] print:text-[8.5px]' : isA5 ? 'text-[10px] print:text-[10.5px]' : 'text-[11px] print:text-[12px]'}`}>
          {cleanBillNumber && (
            <div>
              NO.: <strong>{cleanBillNumber}</strong>
            </div>
          )}
          <div className={isA5 ? 'mt-0' : 'mt-0.5'}>
            DATE: <strong>{formatDate(date)}</strong>
          </div>
        </div>
      </div>

      {/* Optional Centered Challan Date if supplied */}
      {challanDate && (
        <div className={`text-center ${isB7 ? 'text-[8px] my-0.5' : isA5 ? 'text-[10px] my-0.5' : 'text-[11px] print:text-[11.5px] mb-1'} font-medium text-black`}>
          Challan DT: <strong>{formatDate(challanDate)}</strong>
        </div>
      )}

      {/* Exact Table Format: No. | Item Name | Qty | KG | Rate | Amount */}
      <table className={`w-full max-w-full table-fixed box-border border-collapse border border-black ${tableBodyFont}`}>
        <colgroup>
          <col style={{ width: colWidths.no }} />
          <col style={{ width: colWidths.item }} />
          <col style={{ width: colWidths.qty }} />
          <col style={{ width: colWidths.kg }} />
          <col style={{ width: colWidths.rate }} />
          <col style={{ width: colWidths.amount }} />
        </colgroup>
        <thead>
          <tr className={`border-b border-black font-bold uppercase ${tableHeadFont} bg-slate-50 print:bg-transparent text-slate-950 print:text-black`}>
            <th className={`border-r border-black ${tablePad} text-center`}>No.</th>
            <th className={`border-r border-black ${tablePad} text-left`}>ITEM NAME</th>
            <th className={`border-r border-black ${tablePad} text-right ${!isLivePreview ? 'bill-qty-col' : 'print:whitespace-nowrap'} whitespace-nowrap`}>QTY</th>
            <th className={`border-r border-black ${tablePad} text-right`}>KG</th>
            <th className={`border-r border-black ${tablePad} text-right`}>RATE</th>
            <th className={`${tablePad} text-right`}>AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => {
            const lineKg = Number((it as any).weight ?? it.kg) || 0;
            const lineAmount =
              it.amount !== undefined
                ? it.amount
                : calculateWholesaleItemAmount(it.quantity, it.unit, lineKg, it.rate);

            return (
              <tr
                key={it.id || idx}
                className={`border-b border-black/40 print:text-black ${rowHeight}`}
              >
                <td className={`border-r border-black ${tablePad} text-center font-mono print:font-semibold print:text-black align-middle`}>
                  {idx + 1}
                </td>
                <td
                  className={`border-r border-black ${tablePad} font-semibold print:font-bold uppercase print:text-black align-middle overflow-hidden ${getBillItemNameCellClass(it.fruitName, pageSize)}`}
                >
                  {it.fruitName || 'ITEM'}
                </td>
                <td
                  className={`border-r border-black ${tablePad} text-right font-mono font-medium print:font-semibold print:text-black align-middle ${
                    !isLivePreview
                      ? `bill-qty-cell whitespace-nowrap ${
                          isB7
                            ? 'text-[7px] print:text-[8px] tracking-tight print:px-0.5'
                            : isB6
                            ? 'text-[9px] print:text-[10px] tracking-tight print:px-1'
                            : 'print:tracking-tight print:px-1'
                        }`
                      : 'print:whitespace-nowrap print:tracking-tight print:px-1'
                  }`}
                >
                  <span className="bill-qty-nowrap inline-block whitespace-nowrap">
                    {formatBillQtyWithUnit(it.quantity, it.unit)}
                  </span>
                </td>
                <td className={`border-r border-black ${tablePad} text-right font-mono print:font-semibold print:text-black align-middle`}>
                  {lineKg > 0 ? lineKg : 0}
                </td>
                <td className={`border-r border-black ${tablePad} text-right font-mono print:font-semibold print:text-black align-middle`}>
                  {formatBillAmount(it.rate)}
                </td>
                <td className={`${tablePad} text-right font-mono font-bold print:text-black align-middle`}>
                  {formatBillAmount(lineAmount)}
                </td>
              </tr>
            );
          })}

          {/* Preserved Blank Rows for Mandi Balance */}
          {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
            <tr key={`blank-${bIdx}`} className={`border-b border-black/20 ${rowHeight}`}>
              <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
              <td className={`border-r border-black ${tablePad}`}>&nbsp;</td>
              <td className={tablePad}>&nbsp;</td>
            </tr>
          ))}
        </tbody>

        {/* Lower Section: Fixed Qty/KG Total Row + Balance Crate, Expenses & Financial Summary */}
        <tfoot>
          {isCreditSale ? (
            <tr className="border-t-2 border-b border-slate-300 print:border-black font-bold bg-slate-50/70 print:bg-transparent text-slate-950 dark:text-slate-950 print:text-black">
              <td
                colSpan={2}
                className={`border-r border-slate-300 print:border-black ${tablePad}`}
              >
                &nbsp;
              </td>
              <td
                className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-mono font-bold leading-tight break-words ${totalQtyRowFont} text-slate-950 dark:text-slate-950 print:text-black`}
              >
                Total: {totalQty}
              </td>
              <td
                className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-mono font-bold leading-tight break-words ${totalQtyRowFont} text-slate-950 dark:text-slate-950 print:text-black`}
              >
                Total: {totalWeight > 0 ? totalWeight : 0} KG
              </td>
              <td
                className={`border-r border-slate-300 print:border-black ${tablePad}`}
              >
                &nbsp;
              </td>
              <td className={`${tablePad}`}>
                &nbsp;
              </td>
            </tr>
          ) : (
            <tr className="border-t-2 border-b border-slate-300 print:border-black font-bold bg-slate-50/70 print:bg-transparent text-slate-950 dark:text-slate-950 print:text-black">
              <td
                colSpan={2}
                className={`border-r border-slate-300 print:border-black ${tablePad}`}
              >
                &nbsp;
              </td>
              <td
                className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-bold leading-tight break-words ${totalQtyRowFont} text-slate-950 dark:text-slate-950 print:text-black`}
              >
                Total Qty: <span className="font-mono font-black">{totalQty}</span>
              </td>
              <td
                className={`border-r border-slate-300 print:border-black ${tablePad} text-right font-bold leading-tight break-words ${totalQtyRowFont} text-slate-950 dark:text-slate-950 print:text-black`}
              >
                Total Weight: <span className="font-mono font-black">{totalWeight > 0 ? `${totalWeight} KG` : '0 KG'}</span>
              </td>
              <td
                className={`border-r border-slate-300 print:border-black ${tablePad}`}
              >
                &nbsp;
              </td>
              <td className={`${tablePad}`}>
                &nbsp;
              </td>
            </tr>
          )}
          {isB7 ? (
            /* B7 Compact Layout: 2 balanced half-spans to eliminate horizontal clipping and 2-line wraps */
            <tr className="border-t border-slate-300 print:border-black">
              {/* Left Side (colSpan=3): Balance Crate & Expenses stacked */}
              <td colSpan={3} className="border-r border-slate-300 print:border-black p-1 align-top">
                <div className="text-[7.5px] print:text-[9px] font-mono leading-tight space-y-1">
                  <div>
                    <div className="font-bold text-slate-950 dark:text-slate-950 print:text-black">
                      Balance Crate: {crateMovements && crateMovements.length > 0
                        ? crateMovements.reduce((sum, m) => sum + Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0)), 0)
                        : crateSummary.totalBalanceCrates}
                    </div>
                    {crateMovements && crateMovements.length > 0 ? (
                      <div className="space-y-0.5 mt-0.5 print:font-semibold text-slate-900 dark:text-slate-900 print:text-black">
                        {crateMovements.map((m, mIdx) => (
                          <div key={mIdx}>
                            {m.crateName}: {m.outQuantity || 0} Out{m.inQuantity ? `, ${m.inQuantity} In` : ''} ({Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0))} Bal)
                          </div>
                        ))}
                      </div>
                    ) : crateSummary.breakdown.length > 0 ? (
                      <div className="space-y-0.5 mt-0.5 print:font-semibold text-slate-900 dark:text-slate-900 print:text-black">
                        {crateSummary.breakdown.map((b) => (
                          <div key={b.weightKg}>
                            {b.weightKg}Kg = {b.count}
                          </div>
                        ))}
                      </div>
                    ) : (
                      crateSummary.totalBalanceCrates > 0 && (
                        <div className="text-slate-900 dark:text-slate-900 print:text-black mt-0.5 font-medium print:font-semibold">
                          {(crateWeightKg || 20)}Kg = {crateSummary.totalBalanceCrates}
                        </div>
                      )
                    )}
                  </div>

                  {expenses && expenses.length > 0 && (
                    <div className="border-t border-slate-200 print:border-black/50 pt-0.5 space-y-0.5">
                      <div className="font-bold uppercase text-[7px] print:text-[8.5px] text-slate-950 dark:text-slate-950 print:text-black">
                        Expenses
                      </div>
                      {expenses.map((exp, expIdx) => (
                        <div key={expIdx} className="flex justify-between text-slate-950 dark:text-slate-950 print:text-black font-semibold">
                          <span className="font-sans font-medium print:font-semibold text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                          <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[7px] print:text-[8.5px] font-bold text-slate-950 dark:text-slate-950 print:text-black pt-0.5">
                    * E & O.E.
                  </div>
                </div>
              </td>

              {/* Right Side (colSpan=3): Subtotal, Expenses, Net Total & Balances Table */}
              <td colSpan={3} className="p-0 align-top">
                <table className="w-full text-[8px] print:text-[9.5px] border-collapse">
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
              <td colSpan={2} className={`border-r border-slate-300 print:border-black ${isB6 ? 'p-1.5' : isA5 ? 'p-1' : 'p-2'} align-top`}>
                <div className={`${footerFont} font-mono leading-tight`}>
                  <div className="font-bold text-slate-950 dark:text-slate-950 print:text-black">
                    Balance Crate: {crateMovements && crateMovements.length > 0
                      ? crateMovements.reduce((sum, m) => sum + Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0)), 0)
                      : crateSummary.totalBalanceCrates}
                  </div>
                  {crateMovements && crateMovements.length > 0 ? (
                    <div className={`${isA5 ? 'space-y-0 mt-0.5' : 'space-y-0.5 mt-1'} print:font-semibold text-slate-900 dark:text-slate-900 print:text-black`}>
                      {crateMovements.map((m, mIdx) => (
                        <div key={mIdx}>
                          {m.crateName}: {m.outQuantity || 0} Out{m.inQuantity ? `, ${m.inQuantity} In` : ''} ({Math.max(0, (m.outQuantity || 0) - (m.inQuantity || 0))} Bal)
                        </div>
                      ))}
                    </div>
                  ) : crateSummary.breakdown.length > 0 ? (
                    <div className={`${isA5 ? 'space-y-0 mt-0.5' : 'space-y-0.5 mt-1'} print:font-semibold text-slate-900 dark:text-slate-900 print:text-black`}>
                      {crateSummary.breakdown.map((b) => (
                        <div key={b.weightKg}>
                          {b.weightKg}Kg = {b.count}
                        </div>
                      ))}
                    </div>
                  ) : (
                    crateSummary.totalBalanceCrates > 0 && (
                      <div className="text-slate-900 dark:text-slate-900 print:text-black mt-0.5 font-medium print:font-semibold">
                        {(crateWeightKg || 20)}Kg = {crateSummary.totalBalanceCrates}
                      </div>
                    )
                  )}
                  <div className={`${isB6 ? 'text-[8.5px] print:text-[9.5px]' : isA5 ? 'text-[9px] print:text-[9px] mt-1' : 'text-[10px] print:text-[11px] mt-2'} font-bold text-slate-950 dark:text-slate-950 print:text-black`}>
                    * E & O.E.
                  </div>
                </div>
              </td>

              {/* 2. Middle: Expenses (Freight, Hamali, Others) */}
              <td colSpan={2} className={`border-r border-slate-300 print:border-black ${isB6 ? 'p-1.5' : isA5 ? 'p-1' : 'p-2'} align-top`}>
                <div className={`${footerFont} font-mono leading-tight ${isA5 ? 'space-y-0.5' : 'space-y-1'}`}>
                  <div className={`font-bold uppercase ${isB6 ? 'text-[8.5px] print:text-[10.5px]' : isA5 ? 'text-[9px] print:text-[9.5px]' : 'text-[10px] print:text-[12px]'} text-slate-950 dark:text-slate-950 print:text-black border-b border-slate-300 print:border-black/50 pb-0.5`}>
                    Expenses
                  </div>
                  {expenses && expenses.length > 0 ? (
                    expenses.map((exp, expIdx) => (
                      <div key={expIdx} className="flex justify-between text-slate-950 dark:text-slate-950 print:text-black font-semibold">
                        <span className="font-sans font-medium print:font-semibold text-slate-950 dark:text-slate-950 print:text-black">{exp.name}</span>
                        <span className="font-bold text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className={`text-slate-600 dark:text-slate-600 print:text-black print:font-medium italic ${isB6 ? 'text-[8.5px] print:text-[10px]' : isA5 ? 'text-[9px] print:text-[9.5px]' : 'text-[10px] print:text-[11.5px]'}`}>Nil</div>
                  )}
                </div>
              </td>

              {/* 3. Right: Total, Expense, Net Total, Old Balance, Cash Receipt, Total Balance */}
              <td colSpan={2} className="p-0 align-top">
                <table className={`w-full ${footerFont} border-collapse`}>
                  <tbody>
                    <tr className="border-b border-slate-300 print:border-black">
                      <td className={`${summaryCellPad} font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        Total
                      </td>
                      <td className={`${summaryCellPad} text-right font-mono font-bold ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        {formatBillAmount(subTotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 print:border-black">
                      <td className={`${summaryCellPad} font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        Expense
                      </td>
                      <td className={`${summaryCellPad} text-right font-mono font-bold ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        {formatBillAmount(expTotal)}
                      </td>
                    </tr>
                    <tr className="border-b border-slate-300 print:border-black bg-slate-50 print:bg-transparent">
                      <td className={`${summaryCellPad} font-bold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                        Net Total
                      </td>
                      <td className={`${summaryCellPad} text-right font-mono font-black ${isB6 ? 'text-[10.5px] print:text-[11.5px]' : isA5 ? 'text-[10.5px] print:text-[10.5px]' : 'text-xs print:text-[13px]'} text-slate-950 dark:text-slate-950 print:text-black`}>
                        {formatBillAmount(netTotal)}
                      </td>
                    </tr>
                    {oldBalance !== undefined && (
                      <tr className="border-b border-slate-300 print:border-black">
                        <td className={`${summaryCellPad} font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                          Old Balance
                        </td>
                        <td className={`${summaryCellPad} text-right font-mono font-bold ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                          {formatBillAmount(oldBalance)}
                        </td>
                      </tr>
                    )}
                    {cashReceipt !== undefined && cashReceipt > 0 && (
                      <tr className="border-b border-slate-300 print:border-black">
                        <td className={`${summaryCellPad} font-semibold text-left border-r border-slate-300 print:border-black ${footerFont} text-emerald-800 print:text-black`}>
                          Cash Receipt
                        </td>
                        <td className={`${summaryCellPad} text-right font-mono font-bold ${footerFont} text-emerald-800 print:text-black`}>
                          -{formatBillAmount(cashReceipt)}
                        </td>
                      </tr>
                    )}
                    {oldBalance !== undefined && (
                      <tr className="bg-slate-100 print:bg-transparent">
                        <td className={`${summaryCellPad} font-black text-left border-r border-slate-300 print:border-black ${footerFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                          Total Balance
                        </td>
                        <td className={`${summaryCellPad} text-right font-mono font-black ${isB6 ? 'text-[11px] print:text-[12px]' : isA5 ? 'text-[10.5px] print:text-[10.5px]' : 'text-xs sm:text-sm print:text-[13.5px]'} text-rose-700 print:text-black`}>
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

      {/* Bottom Words, Signature & Software footer kept together across page breaks */}
      <div
        className="bill-bottom-footer"
        style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
      >
        <div className={`${isA5 ? 'mt-1 pt-0.5' : 'mt-1.5 pt-1'} flex justify-between items-end ${isB7 ? 'text-[7.5px] print:text-[8.5px]' : isB6 ? 'text-[9.5px] print:text-[10.5px]' : isA5 ? 'text-[9.5px] print:text-[9.5px]' : 'text-xs print:text-[12px]'} border-t border-slate-100 print:border-none text-slate-950 dark:text-slate-950 print:text-black`}>
          <div className="font-bold italic max-w-[60%] leading-tight text-slate-950 dark:text-slate-950 print:text-black">
            {words}
          </div>
          <div className="text-right font-bold uppercase leading-tight text-slate-950 dark:text-slate-950 print:text-black">
            <div>{formatCompanySignature(currentProfile)}</div>
          </div>
        </div>

        {/* Software footer */}
        <div className={`${isA5 ? 'mt-1 pt-0.5 text-[7.5px] print:text-[8px]' : `mt-1.5 pt-0.5 ${isB7 ? 'text-[7px]' : 'text-[8px] sm:text-[8.5px]'}`} border-t border-dotted border-slate-300 print:border-black/30 text-left text-slate-700 dark:text-slate-700 print:text-black font-mono`}>
          Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
        </div>
      </div>
    </div>
  );
};
