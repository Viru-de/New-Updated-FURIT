import React, { useState } from 'react';
import { CompanyProfile, SaleProceeds } from '../../types';
import { db } from '../../services/db';
import { formatDate, formatBillAmount, numberToWordsIndian, formatCompanySignature, formatCleanBillNumber } from '../../utils/formatters';
import { Printer, Download, X, Building2 } from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { PrintBusinessHeader } from '../common/PrintBusinessHeader';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { formatBillQtyWithUnit, getBillItemNameCellClass } from '../../utils/billingCalculations';

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

  // Always fetch latest proceeds from database if it exists to ensure fresh saved values
  const proceeds = (initialProceeds?.id ? db.getSaleProceeds().find((s) => s.id === initialProceeds.id) : null) || initialProceeds;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const handlePrint = () => {
    setIsFormatModalOpen(true);
  };

  // Vendor / Consignor information (print shows name only)
  const vendor = proceeds.vendorId ? db.getVendorById(proceeds.vendorId) : undefined;
  const vendorName = proceeds.vendorName || vendor?.name || 'RAFAT RANA TRADERS';

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

  // Total Qty across all bill items (excluding weight)
  const totalQty = Math.round(
    items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0) * 1000
  ) / 1000 || proceeds.quantity || 0;

  // Total Weight across all bill items
  const totalWeight = Math.round(
    items.reduce((sum, it) => sum + (Number((it as any).weight ?? it.kg) || 0), 0) * 1000
  ) / 1000 || proceeds.weight || proceeds.kg || 0;

  const isB7 = pageSize === 'b7';
  const isB6 = pageSize === 'b6';
  const isA5 = pageSize === 'a5';

  // On B7 (105 x 148.5 mm portrait), paginate cleanly at max 10 items per page and never add artificial blank rows
  const b7PageSizeLimit = 10;
  const b7ItemPages = isB7
    ? items.length === 0
      ? [[]]
      : Array.from({ length: Math.ceil(items.length / b7PageSizeLimit) }, (_, pageIdx) =>
          items.slice(pageIdx * b7PageSizeLimit, (pageIdx + 1) * b7PageSizeLimit)
        )
    : [items];

  // Number of blank rows to maintain traditional wholesale mandi bill height scaled by paper size (B7 uses 0 artificial blank rows)
  const minRows =
    pageSize === 'b7' ? 0 : pageSize === 'b6' ? 4 : pageSize === 'a5' || pageSize === 'compact' ? 6 : 8;
  const blankRowsCount = Math.max(0, minRows - items.length);

  const colWidths = isB7
    ? {
        no: '7%',
        item: '36%',
        qty: '14%',
        weight: '12%',
        price: '13%',
        amount: '18%',
      }
    : isB6
    ? {
        no: '8%',
        item: '31%',
        qty: '18%',
        weight: '11%',
        price: '13%',
        amount: '19%',
      }
    : pageSize === 'a4'
    ? {
        no: '6%',
        item: '36%',
        qty: '16%',
        weight: '11%',
        price: '13%',
        amount: '18%',
      }
    : isA5
    ? {
        no: '7%',
        item: '32%',
        qty: '17%',
        weight: '12%',
        price: '13%',
        amount: '19%',
      }
    : {
        no: '7%',
        item: '31%',
        qty: '17%',
        weight: '12%',
        price: '13%',
        amount: '20%',
      };

  const tablePad = isB7 ? 'px-[3px] py-[3px]' : isB6 ? 'px-1 py-0.5' : isA5 ? 'px-1 py-[2px]' : 'px-1.5 py-1';
  const totalsPad = isB7 ? 'px-[4px] py-[3px]' : isB6 ? 'px-1 py-0.5' : isA5 ? 'px-1 py-[2px]' : 'px-1.5 py-1';
  const getB7RowHeightClass = (itemCountOnPage: number) => {
    if (itemCountOnPage <= 3) return 'h-[28px] leading-[1.2]';
    if (itemCountOnPage <= 5) return 'h-[26px] leading-[1.2]';
    if (itemCountOnPage <= 8) return 'h-[22px] leading-[1.2]';
    return 'h-[19px] leading-[1.15]';
  };
  const rowHeight = isB7 ? getB7RowHeightClass(b7ItemPages[0]?.length || items.length) : isB6 ? 'h-4' : isA5 ? 'h-[18px]' : 'h-6';
  const tableHeadFont = isB7
    ? 'text-[10px] print:text-[10.5px]'
    : isB6
    ? 'text-[9px] print:text-[10.5px]'
    : isA5
    ? 'text-[9.5px] print:text-[9.5px]'
    : pageSize === 'a4'
    ? 'text-[10.5px] print:text-[11.5px]'
    : 'text-[10px] print:text-[11px]';
  const tableBodyFont = isB7
    ? 'text-[10.5px] print:text-[11px] font-bold'
    : isB6
    ? 'text-[9.5px] print:text-[11px]'
    : isA5
    ? 'text-[10px] print:text-[10px] leading-[1.15]'
    : pageSize === 'a4'
    ? 'text-[11.5px] print:text-[12.5px]'
    : 'text-[11px] print:text-[11.5px]';
  const footerFont = isB7
    ? 'text-[9px] print:text-[9.5px]'
    : isB6
    ? 'text-[9px] print:text-[10px]'
    : isA5
    ? 'text-[9.5px] print:text-[9.5px]'
    : pageSize === 'a4'
    ? 'text-[11px] print:text-[12px]'
    : 'text-[10px] print:text-[10.5px]';
  const summaryLabelFont = isB7
    ? 'text-[10px] print:text-[10.5px] font-bold tracking-tight'
    : isB6
    ? 'text-[8.5px] print:text-[9.5px] tracking-tight'
    : isA5
    ? 'text-[9px] print:text-[9.5px] tracking-tight'
    : pageSize === 'a4'
    ? 'text-[11px] print:text-[11.5px]'
    : 'text-[9.5px] print:text-[10px] tracking-tight';
  const summaryValueFont = isB7
    ? 'text-[10.5px] print:text-[11px] font-extrabold tracking-tight'
    : isB6
    ? 'text-[9.5px] print:text-[10.5px] tracking-tight'
    : isA5
    ? 'text-[10px] print:text-[10.5px] tracking-tight'
    : pageSize === 'a4'
    ? 'text-[11.5px] print:text-[12.5px]'
    : 'text-[10.5px] print:text-[11px] tracking-tight';
  const totalQtyRowFont = isB7
    ? 'text-[10px] print:text-[10.5px] font-extrabold'
    : isB6
    ? 'text-[9px] print:text-[10px]'
    : isA5
    ? 'text-[9px] print:text-[9px]'
    : 'text-[10.5px] print:text-[11px]';
  const cleanProceedsNo = formatCleanBillNumber(proceeds.proceedsNo);

  // Subtotal, expenses and net total
  // Subtotal comes directly from user's entered amount (never forced to qty * rate!)
  const subTotal = proceeds.amount;
  const totalExpense = proceeds.totalExpense;
  const netTotal = proceeds.netAmount;
  const expenseDisplay = totalExpense !== 0 ? `-${formatBillAmount(totalExpense)}` : '0.00';

  // Amount in words
  const words = numberToWordsIndian(netTotal);

  const renderTableColGroup = () => (
    <colgroup>
      <col style={{ width: colWidths.no }} />
      <col style={{ width: colWidths.item }} />
      <col style={{ width: colWidths.qty }} />
      <col style={{ width: colWidths.weight }} />
      <col style={{ width: colWidths.price }} />
      <col style={{ width: colWidths.amount }} />
    </colgroup>
  );

  const renderFixedHeaderSection = () => (
    <div className={isB7 ? 'b7-bill-header shrink-0' : ''}>
      {/* Shared Business Header (JD -> English -> Hindi -> Address -> Contact) */}
      <PrintBusinessHeader
        profile={currentProfile}
        variant="bill"
        paperSize={pageSize}
        enlargeContactAndAddressOnB7={isB7}
      />

      {/* Document Title */}
      <div className={`text-center ${isB7 ? 'my-0.5' : isB6 || isA5 ? 'my-0.5' : 'my-1'}`}>
        <span className={`font-bold uppercase tracking-widest border-b border-black pb-0.5 ${isB7 ? 'text-[9.5px]' : isA5 ? 'text-[11px] sm:text-xs print:text-[11.5px]' : 'text-xs sm:text-sm'}`}>
          SALE PROCEED
        </span>
      </div>

      {/* Metadata Section: Customer Left, Bill No. & Date Right */}
      <div className={`flex justify-between items-start gap-2 ${isB7 ? 'text-[8.5px]' : isA5 ? 'text-[10.5px]' : 'text-xs'} pt-0 font-medium`}>
        {/* Left Side: M/s: Customer / Vendor Name only */}
        <div className="min-w-0 max-w-[62%] break-words">
          <div className={`font-bold uppercase text-black ${isB7 ? 'text-[9px] sm:text-[10px]' : isB6 ? 'text-xs' : isA5 ? 'text-[11px] sm:text-[11.5px]' : 'text-xs sm:text-sm'}`}>
            M/s: {vendorName}
          </div>
        </div>

        {/* Right Side: Bill No. & Date */}
        <div className={`shrink-0 text-right whitespace-nowrap ${isB7 ? 'text-[8px] print:text-[8.5px]' : isA5 ? 'text-[10px] print:text-[10.5px]' : 'text-[11px] print:text-[12px]'}`}>
          {cleanProceedsNo && (
            <div>
              NO.: <strong>{cleanProceedsNo}</strong>
            </div>
          )}
          <div className={isA5 ? 'mt-0' : 'mt-0.5'}>
            DATE: <strong>{formatDate(proceeds.date)}</strong>
          </div>
        </div>
      </div>

      {/* Challan Date centred below */}
      <div className={`text-center ${isB7 ? 'text-[8px] my-0.5' : isB6 || isA5 ? 'text-[10px] my-0.5' : 'text-[11px] print:text-[11.5px] my-1'} font-medium text-black`}>
        Challan DT: <strong>{formatDate(proceeds.challanDate || proceeds.date)}</strong>
      </div>
    </div>
  );

  const renderItemRow = (it: typeof items[number], idx: number, serialNo: number, customRowHeight?: string) => (
    <tr key={it.id || serialNo} className={`border-b border-black/40 text-slate-950 dark:text-slate-950 print:text-black ${customRowHeight || rowHeight}`}>
      <td className={`border-r border-black ${isB7 ? 'border-l-0 px-[2px] py-[3px] text-[10.5px] print:text-[11px] font-bold' : isB6 ? 'px-0.5 py-0.5' : 'px-0.5 py-[2px]'} box-border whitespace-nowrap tabular-nums text-center font-mono print:font-bold align-middle`}>
        {serialNo}
      </td>
      <td
        className={`border-r border-black ${isB7 ? 'pl-[4px] pr-[3px] py-[3px] font-bold' : isB6 ? 'pl-1.5 pr-1 py-0.5 font-semibold' : 'pl-1.5 pr-1 py-[2px] font-semibold'} box-border print:font-bold uppercase align-middle overflow-hidden ${getBillItemNameCellClass(it.fruitName, pageSize, 'SALE PROCEED')}`}
      >
        {it.fruitName}
      </td>
      <td
        className={`border-r border-black ${tablePad} box-border text-right font-mono tabular-nums ${isB7 ? 'font-bold' : 'print:font-semibold'} align-middle bill-qty-cell whitespace-nowrap ${
          isB7
            ? 'text-[9.5px] print:text-[10px] tracking-tight'
            : isB6
            ? 'text-[9px] print:text-[10px] tracking-tight'
            : 'print:tracking-tight'
        }`}
      >
        <span className="bill-qty-nowrap inline-block whitespace-nowrap">
          {formatBillQtyWithUnit(it.quantity, it.unit || proceeds.unit)}
        </span>
      </td>
      <td className={`border-r border-black ${tablePad} box-border whitespace-nowrap tabular-nums ${isB7 ? 'text-[10.5px] print:text-[11px] font-bold tracking-tight' : ''} text-right font-mono print:font-bold align-middle`}>
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
      <td className={`border-r border-black ${tablePad} box-border whitespace-nowrap tabular-nums ${isB7 ? 'text-[10px] print:text-[10.5px] font-bold tracking-tight' : isB6 ? 'tracking-tight' : ''} text-right font-mono print:font-bold align-middle`}>
        {formatBillAmount(it.rate)}
      </td>
      <td className={`${isB7 ? 'border-r-0 ' : ''}${tablePad} box-border whitespace-nowrap tabular-nums ${isB7 ? 'text-[10.5px] print:text-[11px] font-bold tracking-tight' : isB6 ? 'text-[9.5px] print:text-[10.5px] tracking-tight' : pageSize === 'compact' ? 'text-[10.5px] print:text-[11px] tracking-tight' : ''} text-right font-mono font-bold align-middle`}>
        {formatBillAmount(it.amount)}
      </td>
    </tr>
  );

  const renderFooterRows = () => (
    <tfoot>
      <tr className="border-t-2 border-b border-black font-bold bg-slate-50/70 print:bg-transparent text-slate-950 dark:text-slate-950 print:text-black">
        <td colSpan={2} className={`border-r border-black box-border ${tablePad}`}>
          &nbsp;
        </td>
        <td
          className={`border-r border-black ${tablePad} text-right font-bold leading-tight whitespace-nowrap tabular-nums box-border ${totalQtyRowFont} text-slate-950 dark:text-slate-950 print:text-black`}
        >
          <span className="font-mono font-black tabular-nums">{totalQty}</span>
        </td>
        <td
          className={`border-r border-black ${tablePad} text-right font-bold leading-tight whitespace-nowrap tabular-nums box-border ${totalQtyRowFont} text-slate-950 dark:text-slate-950 print:text-black`}
        >
          <span className="font-mono font-black tabular-nums">{totalWeight > 0 ? totalWeight : 0}</span>
        </td>
        <td className={`border-r border-black box-border ${tablePad}`}>
          &nbsp;
        </td>
        <td className={`box-border ${tablePad}`}>
          &nbsp;
        </td>
      </tr>
      <tr className="border-t border-black">
        {/* Left Bottom Section: E & O.E. + Expenses List */}
        <td colSpan={isB7 ? 2 : 4} className={`border-r border-black ${isB7 ? 'p-[4px]' : tablePad} align-top box-border`}>
          <div className={`flex flex-col justify-between h-full ${isB7 ? 'min-h-[30px] gap-1' : isB6 ? 'min-h-[34px] gap-0.5' : isA5 ? 'min-h-[34px] gap-0.5' : 'min-h-[50px] gap-1'}`}>
            <div className={`${isB7 ? 'text-[8.5px] print:text-[9px]' : isA5 ? 'text-[9px] print:text-[9px]' : 'text-[10px] print:text-[11px]'} font-bold text-slate-950 dark:text-slate-950 print:text-black`}>* E & O.E.</div>

            {/* Listed Individual Expenses */}
            {proceeds.expenses && proceeds.expenses.length > 0 && (
              <div className={`self-end w-full text-right font-mono ${isB7 ? 'text-[8.5px] print:text-[9px] leading-[1.2] space-y-0.5' : isB6 ? 'text-[9px] print:text-[10px]' : isA5 ? 'text-[9.5px] print:text-[9.5px] space-y-0' : 'text-[10.5px] print:text-[11.5px] space-y-0.5'} pr-0.5`}>
                {proceeds.expenses.map((exp, expIdx) => (
                  <div key={expIdx} className="flex justify-between items-baseline gap-1 sm:gap-2 text-slate-950 dark:text-slate-950 print:text-black">
                    <span className={`font-sans ${isB7 ? 'font-semibold' : 'font-medium print:font-semibold'} text-slate-950 dark:text-slate-950 print:text-black break-words min-w-0 text-left`}>{exp.name}</span>
                    <span className="font-bold whitespace-nowrap tabular-nums shrink-0 text-slate-950 dark:text-slate-950 print:text-black">{formatBillAmount(exp.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </td>

        {/* Right Bottom Section: Sub Total, Expenses, Net Total */}
        <td colSpan={isB7 ? 4 : 2} className="p-0 align-top box-border">
          <table className={`w-full max-w-full table-fixed box-border border-collapse bill-summary-table ${footerFont}`}>
            <colgroup>
              <col style={{ width: '47%' }} />
              <col style={{ width: '53%' }} />
            </colgroup>
            <tbody>
              <tr className="border-b border-black last:border-b-0">
                <td className={`${totalsPad} ${isB7 ? 'font-bold' : 'font-semibold'} text-left border-r border-black whitespace-nowrap box-border ${summaryLabelFont} text-slate-950 dark:text-slate-950 print:text-black leading-tight`}>Sub Total</td>
                <td className={`${totalsPad} text-right font-mono ${isB7 ? 'font-extrabold' : 'font-bold'} tabular-nums whitespace-nowrap box-border ${summaryValueFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                  {formatBillAmount(subTotal)}
                </td>
              </tr>
              <tr className="border-b border-black last:border-b-0">
                <td className={`${totalsPad} ${isB7 ? 'font-bold' : 'font-semibold'} text-left border-r border-black whitespace-nowrap box-border ${summaryLabelFont} text-slate-950 dark:text-slate-950 print:text-black leading-tight`}>Expenses</td>
                <td className={`${totalsPad} text-right font-mono ${isB7 ? 'font-extrabold' : 'font-bold'} tabular-nums whitespace-nowrap box-border ${summaryValueFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                  {expenseDisplay}
                </td>
              </tr>
              <tr className="border-b border-black last:border-b-0 bg-slate-100 print:bg-transparent">
                <td className={`${totalsPad} ${isB7 ? 'font-black text-[11px] print:text-[11.5px]' : 'font-bold'} text-left border-r border-black whitespace-nowrap box-border ${summaryLabelFont} text-slate-950 dark:text-slate-950 print:text-black leading-tight`}>
                  Net Total
                </td>
                <td className={`${totalsPad} text-right font-mono font-black tabular-nums whitespace-nowrap box-border ${isB7 ? 'text-[11px] print:text-[11.5px] tracking-tight' : summaryValueFont} text-slate-950 dark:text-slate-950 print:text-black`}>
                  {formatBillAmount(netTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </td>
      </tr>
    </tfoot>
  );

  const renderBottomFooterSection = () => (
    <div
      className="bill-bottom-footer"
      style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}
    >
      <div className={`${isB7 ? 'mt-1.5 pt-1 text-[8px] print:text-[8.5px]' : isB6 || isA5 ? `mt-0.5 pt-0.5 ${isB6 ? 'text-[9.5px] print:text-[10.5px]' : 'text-[9.5px] print:text-[9.5px]'}` : 'mt-1.5 pt-1 text-xs print:text-[12px]'} flex justify-between items-end gap-2 text-slate-950 dark:text-slate-950 print:text-black`}>
        {/* Amount in words */}
        <div className="font-bold italic min-w-0 max-w-[60%] break-words leading-tight text-slate-950 dark:text-slate-950 print:text-black">
          {words}
        </div>

        {/* Signatory for company profile */}
        <div className="shrink-0 max-w-[38%] text-right font-bold uppercase break-words leading-tight text-slate-950 dark:text-slate-950 print:text-black">
          <div>{formatCompanySignature(currentProfile)}</div>
        </div>
      </div>

      {/* Software attribution */}
      <div className={`${isB7 ? 'mt-1 pt-0.5 text-[7.5px]' : isB6 || isA5 ? 'mt-0.5 pt-0.5 text-[7.5px] print:text-[8px]' : 'mt-1.5 pt-0.5 text-[8px] sm:text-[8.5px]'} border-t border-dotted border-black/40 text-left text-slate-700 dark:text-slate-700 print:text-black font-mono break-words`}>
        Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
      </div>
    </div>
  );

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
                  {sizeKey === 'compact' ? 'Small Bill' : sizeKey.toUpperCase()}
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
              useCompatB7={true}
              optionLabelOverrides={{ compact: 'Small Bill', b7: 'B7' }}
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
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 bg-slate-100 dark:bg-slate-950">
          {isB7 ? (
            <div
              id="mandi-print-area"
              data-paper-size={pageSize}
              data-compat-105="true"
              data-theme-isolated="true"
              className="mx-auto bg-white text-slate-900 font-sans leading-tight border border-slate-200 print:border-none print:p-0 print:m-0 box-border shadow-md print-bill-canvas sale-proceed-print-canvas overflow-visible max-w-[397px] w-full text-[9px] p-0"
              style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif", boxSizing: 'border-box' }}
            >
              {b7ItemPages.map((pageItems, pageIdx) => {
                const isLastPage = pageIdx === b7ItemPages.length - 1;
                const totalPages = b7ItemPages.length;
                const startSerial = pageIdx * b7PageSizeLimit;
                const pageRowHeight = getB7RowHeightClass(pageItems.length);

                return (
                  <div
                    key={pageIdx}
                    data-b7-page={pageIdx + 1}
                    data-b7-total-pages={totalPages}
                    className={`b7-bill-page flex flex-col justify-between box-border bg-white text-slate-900 pt-1.5 px-2.5 pb-1.5 min-h-[534px] print:min-h-[139mm] ${
                      !isLastPage ? 'b7-bill-page-break border-b-2 border-dashed border-slate-300 mb-3 print:border-none print:mb-0' : ''
                    }`}
                  >
                    {/* 1. Fixed Header */}
                    {renderFixedHeaderSection()}

                    {/* 2 & 3. Framed Dynamic Middle Item Table + Pinned Footer Summary */}
                    <div className="b7-bill-frame flex-1 flex flex-col border border-black box-border min-h-0">
                      {/* Dynamic Middle Item Table (0 artificial blank rows, max 10 items per page) */}
                      <table className={`w-full max-w-full table-fixed box-border border-collapse border-0 bill-items-table ${isB7 ? 'b7-bill-table b7-single-line-table' : ''} ${tableBodyFont}`}>
                        {renderTableColGroup()}
                        <thead>
                          <tr className={`border-b border-black font-bold uppercase ${tableHeadFont} bg-slate-50 print:bg-transparent text-slate-950 dark:text-slate-950 print:text-black`}>
                            <th className="border-l-0 border-r border-black px-[2px] py-[3.5px] box-border text-center font-bold tracking-tight whitespace-nowrap">No.</th>
                            <th className="border-r border-black pl-[4px] pr-[3px] py-[3.5px] whitespace-nowrap box-border text-left font-bold">ITEM NAME</th>
                            <th className={`border-r border-black ${tablePad} box-border text-right font-bold bill-qty-col whitespace-nowrap`}>QTY</th>
                            <th className={`border-r border-black ${tablePad} box-border text-right font-bold text-[8.5px] print:text-[9px] tracking-tight whitespace-nowrap`}>WEIGHT</th>
                            <th className={`border-r border-black ${tablePad} box-border text-right font-bold whitespace-nowrap`}>PRICE</th>
                            <th className={`border-r-0 ${tablePad} box-border text-right font-bold whitespace-nowrap`}>AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pageItems.map((it, idx) => renderItemRow(it, idx, startSerial + idx + 1, pageRowHeight))}
                        </tbody>
                      </table>

                      {/* Exact colgroup-matched Column-Border Bridge: fills middle gap without artificial blank rows and aligns 0.0px with table borders */}
                      <div className="b7-columns-fill flex-1 flex flex-col w-full min-h-[2px]" aria-hidden="true">
                        <table className="w-full h-full flex-1 table-fixed box-border border-collapse border-0">
                          {renderTableColGroup()}
                          <tbody>
                            <tr className="h-full">
                              <td className="border-l-0 border-r border-black p-0 box-border">&nbsp;</td>
                              <td className="border-r border-black p-0 box-border">&nbsp;</td>
                              <td className="border-r border-black p-0 box-border">&nbsp;</td>
                              <td className="border-r border-black p-0 box-border">&nbsp;</td>
                              <td className="border-r border-black p-0 box-border">&nbsp;</td>
                              <td className="border-r-0 p-0 box-border">&nbsp;</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Fixed Footer Summary inside frame */}
                      {isLastPage ? (
                        <table className={`w-full max-w-full table-fixed box-border border-collapse b7-footer-summary-table ${tableBodyFont}`}>
                          {renderTableColGroup()}
                          {renderFooterRows()}
                        </table>
                      ) : (
                        <div className="border-t border-black px-1.5 py-1 flex items-center justify-between text-[8px] print:text-[8.5px] font-bold text-slate-950 print:text-black bg-slate-50/70 print:bg-transparent">
                          <span>Continued on Page {pageIdx + 2} of {totalPages}...</span>
                          <span>Page {pageIdx + 1} of {totalPages}</span>
                        </div>
                      )}
                    </div>

                    {/* Fixed Bottom Words, Signature & Software Footer */}
                    <div className="b7-bill-bottom-area shrink-0">
                      {isLastPage ? (
                        renderBottomFooterSection()
                      ) : (
                        <div className="bill-bottom-footer" style={{ breakInside: 'avoid', pageBreakInside: 'avoid' }}>
                          <div className="mt-1.5 pt-1 flex justify-between items-end text-[8px] print:text-[8.5px] text-slate-950 dark:text-slate-950 print:text-black">
                            <div className="font-semibold italic text-slate-700 print:text-black">
                              Items 1–{startSerial + pageItems.length} of {items.length}
                            </div>
                            <div className="text-right font-bold uppercase leading-tight text-slate-950 dark:text-slate-950 print:text-black">
                              <div>{formatCompanySignature(currentProfile)}</div>
                            </div>
                          </div>
                          <div className="mt-1 pt-0.5 text-[7.5px] border-t border-dotted border-black/40 text-left text-slate-700 dark:text-slate-700 print:text-black font-mono break-words">
                            Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div
              id="mandi-print-area"
              data-paper-size={pageSize}
              data-theme-isolated="true"
              className={`mx-auto bg-white text-slate-900 font-sans leading-tight border border-slate-200 print:border-none print:p-0 print:m-0 box-border shadow-md print-bill-canvas sale-proceed-print-canvas overflow-visible ${
                pageSize === 'a4'
                  ? 'max-w-[730px] w-full text-[12px] pt-1 px-4 pb-3 sm:pt-1.5 sm:px-5 sm:pb-4'
                  : pageSize === 'a5'
                  ? 'max-w-[550px] w-full text-[10px] pt-0.5 px-2.5 pb-1.5 sm:pt-1 sm:px-3 sm:pb-2'
                  : pageSize === 'b6'
                  ? 'max-w-[430px] w-full text-[10px] pt-1 px-2.5 pb-1.5 sm:px-3'
                  : 'max-w-[490px] w-full text-[11px] pt-0.5 px-3 pb-2 sm:pt-1 sm:px-3.5 sm:pb-2.5'
              }`}
              style={{ fontFamily: "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif", boxSizing: 'border-box' }}
            >
              {renderFixedHeaderSection()}

              {/* Item Table matching Reference 1 */}
              <table className={`w-full max-w-full table-fixed box-border border-collapse border border-black bill-items-table ${isB6 ? 'b6-bill-table' : ''} ${tableBodyFont}`}>
                {renderTableColGroup()}
                <thead>
                  <tr className={`border-b border-black font-bold uppercase ${tableHeadFont} bg-slate-50 print:bg-transparent text-slate-950 dark:text-slate-950 print:text-black`}>
                    <th className="border-r border-black px-0.5 py-1 box-border text-center tracking-tight whitespace-nowrap">No.</th>
                    <th className="border-r border-black pl-1.5 pr-1 py-1 box-border text-left">ITEM NAME</th>
                    <th className={`border-r border-black ${tablePad} box-border text-right bill-qty-col whitespace-nowrap`}>QTY</th>
                    <th className={`border-r border-black ${tablePad} box-border text-right whitespace-nowrap`}>WEIGHT</th>
                    <th className={`border-r border-black ${tablePad} box-border text-right whitespace-nowrap`}>PRICE</th>
                    <th className={`${tablePad} box-border text-right whitespace-nowrap`}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => renderItemRow(it, idx, idx + 1))}

                  {/* Preserved Blank Rows to maintain traditional wholesale bill spacing */}
                  {Array.from({ length: blankRowsCount }).map((_, bIdx) => (
                    <tr key={`blank-${bIdx}`} className={`border-b border-black/20 ${rowHeight}`}>
                      <td className={`border-r border-black box-border ${isB6 ? 'px-0.5 py-0.5' : 'px-0.5 py-[2px]'}`}>&nbsp;</td>
                      <td className={`border-r border-black box-border ${isB6 ? 'pl-1.5 pr-1 py-0.5' : 'pl-1.5 pr-1 py-[2px]'}`}>&nbsp;</td>
                      <td className={`border-r border-black box-border ${tablePad}`}>&nbsp;</td>
                      <td className={`border-r border-black box-border ${tablePad}`}>&nbsp;</td>
                      <td className={`border-r border-black box-border ${tablePad}`}>&nbsp;</td>
                      <td className={`box-border ${tablePad}`}>&nbsp;</td>
                    </tr>
                  ))}
                </tbody>

                {/* Lower Section: Fixed Total Qty & Total Weight Row + Expenses List & Financial Summary */}
                {renderFooterRows()}
              </table>

              {/* Bottom Words, Signatory & Attribution kept together across page breaks */}
              {renderBottomFooterSection()}
            </div>
          )}
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
        useCompatB7={true}
        optionLabelOverrides={{ compact: 'Small Bill', b7: 'B7' }}
      />
    </div>
  );
};
