import React, { useState } from 'react';
import { Bill } from '../../types';
import { db } from '../../services/db';
import { formatCurrency, formatDate, formatBillAmount, numberToWordsIndian } from '../../utils/formatters';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportBillHistory } from '../../utils/excelEngine';
import {
  FileText,
  Search,
  Plus,
  Printer,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Building2,
  AlertCircle,
  X,
} from 'lucide-react';
import { BillShareButtons } from '../common/BillShareButtons';
import { AdminPasswordModal } from '../common/AdminPasswordModal';
import { triggerPrint, BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { getCustomerPrintContactLines } from '../../utils/customerContactUtils';

interface BillHistoryViewProps {
  onCreateNewBill: () => void;
  onEditBill: (bill: Bill) => void;
}

export const BillHistoryView: React.FC<BillHistoryViewProps> = ({
  onCreateNewBill,
  onEditBill,
}) => {
  const [bills, setBills] = useState<Bill[]>(db.getBills());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillForPreview, setSelectedBillForPreview] = useState<Bill | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<BillPaperSize>(() => getLastSelectedPaperSize('compact'));
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  const refreshList = () => {
    setBills(db.getBills());
  };

  const handleDuplicate = (b: Bill) => {
    const seq = db.getNextBillNumber();
    const duplicated: Bill = {
      ...b,
      id: `bill-${Date.now()}`,
      billNo: `BILL-${String(seq).padStart(3, '0')}`,
      sequenceNumber: seq,
      createdAt: new Date().toISOString(),
    };
    db.saveBill(duplicated);
    refreshList();
  };

  const confirmDelete = () => {
    if (deleteId) {
      const bill = bills.find((b) => b.id === deleteId);
      if (bill) {
        db.moveToTrash(
          'bill',
          bill.id,
          `Invoice ${bill.billNo}`,
          `Customer: ${bill.customerName} · Net Total: ₹${bill.totalAmount.toLocaleString('en-IN')}`,
          bill
        );
      } else {
        db.deleteBill(deleteId);
      }
      setDeleteId(null);
      refreshList();
    }
  };

  const q = searchTerm.trim().toLowerCase();

  const filteredBills = React.useMemo(() => {
    if (!q) return bills;

    const scored = bills
      .map((b) => {
        const billNoLower = b.billNo.toLowerCase();
        const custLower = (b.customerName || '').toLowerCase();
        const profileLower = (b.companyProfileSnapshot?.name || '').toLowerCase();
        const itemMatch = b.items?.some((it) => it.fruitName.toLowerCase().includes(q));

        if (billNoLower === q || custLower === q) return { bill: b, score: 0 };
        if (billNoLower.startsWith(q) || custLower.startsWith(q)) return { bill: b, score: 1 };
        const words = custLower.split(/\s+/);
        if (words.some((w) => w.startsWith(q))) return { bill: b, score: 2 };
        if (billNoLower.includes(q) || custLower.includes(q)) return { bill: b, score: 3 };
        if (profileLower.startsWith(q)) return { bill: b, score: 4 };
        if (profileLower.includes(q)) return { bill: b, score: 5 };
        if (itemMatch) return { bill: b, score: 6 };

        return null;
      })
      .filter((entry): entry is { bill: typeof bills[0]; score: number } => entry !== null);

    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.bill);
  }, [bills, q]);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="h-5 w-5 text-emerald-600" /> Bill History
          </h2>
          <p className="text-xs text-slate-500">
            All generated mandi invoices, billing company profiles and payment statuses
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ExcelActionBar
            module="creditSale"
            moduleTitle="Bill History"
            onExportFiltered={() => exportBillHistory(filteredBills, '_Filtered')}
            onExportAll={() => exportBillHistory(bills)}
            filteredCount={filteredBills.length}
            totalCount={bills.length}
            onImportComplete={refreshList}
          />
          <button
            type="button"
            onClick={onCreateNewBill}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> + Create New Bill
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
        <input
          type="text"
          placeholder="Search by Bill No, customer name, fruit, company profile..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full text-xs text-slate-900 outline-none placeholder:text-slate-400 dark:bg-slate-900 dark:text-white"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => setSearchTerm('')}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-1"
            title="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Bills Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden no-print">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                <th className="px-5 py-3.5 w-32">Bill No.</th>
                <th className="px-5 py-3.5 w-28">Date</th>
                <th className="px-5 py-3.5">Customer</th>
                <th className="px-5 py-3.5">Company Profile</th>
                <th className="px-5 py-3.5 text-right w-36">Total Amount</th>
                <th className="px-5 py-3.5 text-center w-28">Status</th>
                <th className="px-5 py-3.5 text-center w-36">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredBills.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-xs text-slate-500">
                    No bills generated yet. Click &quot;+ Create New Bill&quot; to generate an invoice.
                  </td>
                </tr>
              ) : (
                filteredBills.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50/60 transition-colors dark:hover:bg-slate-800/40"
                  >
                    <td className="px-5 py-3.5 font-bold font-mono-numbers text-xs text-slate-900 dark:text-white">
                      {b.billNo}
                    </td>
                    <td className="px-5 py-3.5 font-mono-numbers text-xs text-slate-600 dark:text-slate-400">
                      {formatDate(b.date)}
                    </td>
                    <td className="px-5 py-3.5 font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {b.customerName}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400">
                      <span className="flex items-center gap-1 font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded dark:bg-emerald-950/40 dark:text-emerald-300 w-fit">
                        <Building2 className="h-3 w-3" /> {b.companyProfileSnapshot?.name || 'Hari Kripa'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(b.totalAmount)}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                          b.status === 'Paid'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                            : b.status === 'Partial'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedBillForPreview(b)}
                          title="Preview / Print"
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditBill(b)}
                          title="Edit Bill"
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicate(b)}
                          title="Duplicate Bill"
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteId(b.id)}
                          title="Delete Bill"
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill Preview Modal */}
      {selectedBillForPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-8">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-6 py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Invoice {selectedBillForPreview.billNo} — Profile: {selectedBillForPreview.companyProfileSnapshot?.name}
              </span>
              <div className="flex flex-wrap items-center gap-2">
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
                <BillShareButtons
                  elementId="mandi-print-area"
                  filename={`Bill_${selectedBillForPreview.billNo.replace(/\s+/g, '_')}`}
                  customerMobile={selectedBillForPreview.customerMobile}
                  title={`Bill Invoice ${selectedBillForPreview.billNo}`}
                  summaryText={`Bill No: ${selectedBillForPreview.billNo}\nDate: ${selectedBillForPreview.date}\nCustomer: ${selectedBillForPreview.customerName}\nNet Total: ₹${selectedBillForPreview.totalAmount.toLocaleString('en-IN')}`}
                  defaultPaperSize={pageSize}
                  onPaperSizeChange={setPageSize}
                />
                <button
                  type="button"
                  onClick={() => setIsFormatModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 shadow-xs cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBillForPreview(null)}
                  className="rounded p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 overflow-x-auto flex justify-center bg-slate-100 dark:bg-slate-950">
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
                {/* Header: Company Initials & Bilingual Names (with historical snapshot preservation) */}
                {(() => {
                  const snap = selectedBillForPreview.companyProfileSnapshot;
                  const fallbackProf = selectedBillForPreview.companyProfileId
                    ? db.getCompanyProfiles().find((p) => p.id === selectedBillForPreview.companyProfileId)
                    : db.getDefaultProfile();
                  const shortCode = snap?.shortCode || fallbackProf?.shortCode;
                  const name = snap?.name || fallbackProf?.name;
                  const hindiName = snap?.hindiName || fallbackProf?.hindiName;
                  const address = snap?.address || fallbackProf?.address;
                  const city = snap?.city || fallbackProf?.city;
                  const state = snap?.state || fallbackProf?.state;
                  const mobile = snap?.mobile || fallbackProf?.mobile;

                  return (
                    <div className="text-center mb-1">
                      {shortCode && (
                        <div className="font-bold text-sm tracking-widest uppercase text-slate-900 dark:text-slate-900 print:text-black">
                          {shortCode}
                        </div>
                      )}
                      <h1 className="text-lg sm:text-xl font-black tracking-wider uppercase mt-0.5 text-slate-950 dark:text-slate-950 print:text-black">
                        {name}
                      </h1>
                      {hindiName && (
                        <div className="text-base sm:text-lg font-bold tracking-wide mt-0.5 font-devanagari text-slate-950 dark:text-slate-950 print:text-black">
                          {hindiName}
                        </div>
                      )}
                      <div className="text-[11px] leading-snug mt-1 text-slate-800 dark:text-slate-800 print:text-black">
                        {address}
                        {city ? `, ${city}` : ''}
                        {state ? `, ${state}` : ''}
                      </div>
                      <CompanyContactsHeader profile={snap || fallbackProf} className="mt-0.5" />
                    </div>
                  );
                })()}

                {/* Document Title */}
                <div className="text-center my-2">
                  <span className="font-bold uppercase tracking-widest text-sm border-b border-black pb-0.5">
                    TAX INVOICE
                  </span>
                </div>

                {/* Metadata Section */}
                <div className="flex justify-between items-start text-xs mb-2 pt-1 font-medium">
                  {/* Left Side: M/s. & Address */}
                  <div className="max-w-[65%]">
                    <div className="font-bold">M/s.</div>
                    <div className="font-bold uppercase">{selectedBillForPreview.customerName}</div>
                    {selectedBillForPreview.customerAddress && (
                      <div className="text-[11px]">{selectedBillForPreview.customerAddress}</div>
                    )}
                    {(() => {
                      const cust = selectedBillForPreview.customerId
                        ? db.getCustomerById(selectedBillForPreview.customerId)
                        : undefined;
                      if (!cust) return null;
                      return (
                        <>
                          {cust.mobile && <div className="text-[11px]">Mob: {cust.mobile}</div>}
                          {getCustomerPrintContactLines(cust).map((c) => (
                            <div key={c.id} className="text-[11px]">{c.text}</div>
                          ))}
                        </>
                      );
                    })()}
                    {selectedBillForPreview.challanNumber && (
                      <div className="mt-1 text-[11px]">
                        Challan DT: <strong>{formatDate(selectedBillForPreview.challanDate || selectedBillForPreview.date)}</strong>
                      </div>
                    )}
                  </div>

                  {/* Right Side: Number & Date */}
                  <div className="text-right whitespace-nowrap">
                    <div>
                      NUMBER: <strong className="font-mono">{selectedBillForPreview.sequenceNumber || selectedBillForPreview.billNo.replace(/\D/g, '')}</strong>
                    </div>
                    <div>
                      DATE: <strong>{formatDate(selectedBillForPreview.date)}</strong>
                    </div>
                  </div>
                </div>

                {/* Item Table matching Traditional Wholesale Reference */}
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
                    {selectedBillForPreview.items.map((it, idx) => (
                      <tr key={it.id || idx} className="border-b border-black/40">
                        <td className="border-r border-black p-1 text-center font-mono">{idx + 1}</td>
                        <td className="border-r border-black p-1 font-semibold uppercase">{it.fruitName}</td>
                        <td className="border-r border-black p-1 text-right font-mono">{it.quantity}</td>
                        <td className="border-r border-black p-1 text-right font-mono">
                          {it.unit === 'KG' ? `${it.quantity} KG` : ''}
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
                    {Array.from({ length: Math.max(0, 8 - selectedBillForPreview.items.length) }).map((_, bIdx) => (
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

                  {/* Lower Section: Expenses + Subtotal & Net Total Grid */}
                  <tfoot>
                    <tr className="border-t-2 border-black">
                      {/* Left Bottom Section: E & O.E. + Expenses List */}
                      <td colSpan={5} className="border-r border-black p-2 align-top">
                        <div className="flex flex-col justify-between h-full min-h-[75px]">
                          <div className="text-[10px] font-bold text-slate-950 dark:text-slate-950 print:text-black">* E & O.E.</div>

                          {/* Listed Individual Expenses (Freight, Hamali, etc.) */}
                          {selectedBillForPreview.expenses && selectedBillForPreview.expenses.length > 0 && (
                            <div className="self-end text-right font-mono text-[11px] space-y-0.5 pr-2">
                              {selectedBillForPreview.expenses.map((exp, expIdx) => (
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
                                {formatBillAmount(selectedBillForPreview.subtotal)}
                              </td>
                            </tr>
                            <tr className="border-b border-black">
                              <td className="p-1 font-semibold text-left border-r border-black text-slate-950 dark:text-slate-950 print:text-black">Expenses</td>
                              <td className="p-1 text-right font-mono font-bold text-slate-950 dark:text-slate-950 print:text-black">
                                {selectedBillForPreview.expenseTotal !== 0 ? `+${formatBillAmount(selectedBillForPreview.expenseTotal)}` : '0.00'}
                              </td>
                            </tr>
                            <tr>
                              <td className="p-1 font-bold text-left border-r border-black bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black">
                                Net Total
                              </td>
                              <td className="p-1 text-right font-mono font-black text-sm bg-slate-100 text-slate-950 dark:text-slate-950 print:bg-transparent print:text-black">
                                {formatBillAmount(selectedBillForPreview.totalAmount)}
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
                  <div className="font-bold italic max-w-[60%] text-slate-950 dark:text-slate-950 print:text-black">
                    {numberToWordsIndian(selectedBillForPreview.totalAmount)}
                  </div>

                  <div className="text-right font-bold uppercase text-slate-950 dark:text-slate-950 print:text-black">
                    <div>FOR, {selectedBillForPreview.companyProfileSnapshot?.signatureTitle || selectedBillForPreview.companyProfileSnapshot?.name}</div>
                  </div>
                </div>

                {/* Software attribution */}
                <div className="mt-4 pt-1 border-t border-dotted border-black/40 text-[8px] sm:text-[8.5px] text-left text-slate-700 dark:text-slate-700 print:text-black font-mono">
                  Software Developed by: {selectedBillForPreview.companyProfileSnapshot?.softwareDevelopedBy || 'Klyia Technology'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Password-Protected Delete Confirmation */}
      <AdminPasswordModal
        isOpen={!!deleteId}
        title="Delete Bill Invoice?"
        itemTitle={bills.find((b) => b.id === deleteId)?.billNo}
        description="The bill will be moved to the Trash / Recycle Bin with all line items intact. You can restore it anytime."
        confirmText="Verify & Move to Trash"
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Format Selection Dialog for Print Button */}
      {selectedBillForPreview && (
        <ChooseBillPrintFormatModal
          isOpen={isFormatModalOpen}
          onClose={() => setIsFormatModalOpen(false)}
          documentTitle={`Bill Invoice ${selectedBillForPreview.billNo}`}
          elementId="mandi-print-area"
          filename={`Bill_${selectedBillForPreview.billNo.replace(/\s+/g, '_')}`}
          defaultSize={pageSize}
          initialAction="print"
          onPaperSizeChange={setPageSize}
        />
      )}
    </div>
  );
};
