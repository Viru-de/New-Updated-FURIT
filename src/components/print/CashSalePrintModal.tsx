import React, { useState } from 'react';
import { CompanyProfile, CashSale } from '../../types';
import { db } from '../../services/db';
import { Printer, X, Building2 } from 'lucide-react';
import { BillTableCanvas } from '../common/BillTableCanvas';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';
import { getCustomerPrintContactLines } from '../../utils/customerContactUtils';

interface CashSalePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  cashSale: CashSale;
}

export const CashSalePrintModal: React.FC<CashSalePrintModalProps> = ({
  isOpen,
  onClose,
  cashSale,
}) => {
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile();

  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const [pageSize, setPageSize] = useState<BillPaperSize>(() =>
    getLastSelectedPaperSize('compact')
  );
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);

  if (!isOpen) return null;

  const currentProfile: CompanyProfile =
    profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  const handlePrint = () => {
    setIsFormatModalOpen(true);
  };

  const customer = cashSale.customerId ? db.getCustomerById(cashSale.customerId) : undefined;
  // If no customer is selected, leave completely blank - no CASH CUSTOMER or N/A
  const customerName = customer?.name || cashSale.customerName || '';
  const customerAddress =
    customer?.address ||
    (customer?.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ''}` : '');
  const customerMobile = customer?.mobile || '';
  const customerAadhaarNo = customer?.aadhaarNo || customer?.gstin;

  const summaryText = `Bill No: ${cashSale.cashSaleNo}\nDate: ${cashSale.date}${customerName ? `\nCustomer: ${customerName}` : ''}\nTotal: ₹${cashSale.finalAmount.toLocaleString('en-IN')}\nStatus: Paid (${cashSale.paymentMode})`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4 md:p-6 backdrop-blur-xs overflow-hidden">
      <div className="flex flex-col w-full max-w-4xl max-h-[90vh] max-h-[90dvh] rounded-xl sm:rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Controls Bar (Always visible at top, hidden during print) */}
        <div className="shrink-0 flex flex-wrap items-center justify-between border-b border-slate-200 px-4 sm:px-6 py-2.5 sm:py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/80 gap-2 sm:gap-3 z-10">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Cash Sale Bill Print Preview
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
              filename={`Cash-Sale-${cashSale.cashSaleNo.replace(/\s+/g, '-')}`}
              customerMobile={customerMobile}
              title={`Cash Sale Bill ${cashSale.cashSaleNo}`}
              summaryText={summaryText}
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

        {/* Printable Traditional Wholesale Mandi Bill Canvas (Scrollable inside popup) */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-3 sm:p-6 flex justify-center items-start bg-slate-100 dark:bg-slate-950">
          <BillTableCanvas
            saleType="CASH SALE"
            billNumber={cashSale.cashSaleNo}
            date={cashSale.date}
            customerName={customerName}
            customerAddress={customerAddress}
            customerMobile={customerMobile}
            customerAlternateContacts={customer ? getCustomerPrintContactLines(customer).map((c) => c.text) : undefined}
            customerAadhaarNo={customerAadhaarNo}
            items={cashSale.items || []}
            expenses={cashSale.expenses || []}
            productTotal={cashSale.productTotal}
            expenseTotal={cashSale.expenseTotal}
            finalAmount={cashSale.finalAmount}
            paymentMode={cashSale.paymentMode}
            crateOut={cashSale.crateOut}
            crateIn={cashSale.crateIn}
            crateWeightKg={cashSale.crateWeightKg}
            crateMovements={cashSale.crateMovements}
            profile={currentProfile}
            pageSize={pageSize}
          />
        </div>
      </div>

      {/* Format Selection Dialog for Print Button */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={`Cash Sale Bill ${cashSale.cashSaleNo}`}
        elementId="mandi-print-area"
        filename={`Cash-Sale-${cashSale.cashSaleNo.replace(/\s+/g, '-')}`}
        defaultSize={pageSize}
        initialAction="print"
        onPaperSizeChange={setPageSize}
      />
    </div>
  );
};
