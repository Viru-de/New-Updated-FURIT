import React, { useState } from 'react';
import { CompanyProfile, CreditSale } from '../../types';
import { db } from '../../services/db';
import { Printer, X, Building2 } from 'lucide-react';
import { BillTableCanvas } from '../common/BillTableCanvas';
import { BillShareButtons } from '../common/BillShareButtons';
import { ChooseBillPrintFormatModal } from '../common/ChooseBillPrintFormatModal';
import { BillPaperSize, getLastSelectedPaperSize } from '../../utils/pdfAndShareEngine';

interface CreditSalePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditSale: CreditSale;
}

export const CreditSalePrintModal: React.FC<CreditSalePrintModalProps> = ({
  isOpen,
  onClose,
  creditSale,
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

  const customer = creditSale.customerId ? db.getCustomerById(creditSale.customerId) : undefined;
  const customerName = creditSale.customerName || customer?.name || 'Customer';
  const customerAddress =
    customer?.address ||
    (customer?.city ? `${customer.city}${customer.state ? `, ${customer.state}` : ''}` : '');
  const customerMobile = customer?.mobile || '';
  const customerAadhaarNo = customer?.aadhaarNo || customer?.gstin;

  const summaryText = `Bill No: ${creditSale.creditSaleNo}\nDate: ${creditSale.date}\nCustomer: ${customerName}\nDebit Amount: ₹${creditSale.finalAmount.toLocaleString('en-IN')}\nStatus: Added to Customer Ledger`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 my-6">
        {/* Modal Controls Bar (Hidden during print) */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-200 px-6 py-3 no-print bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Credit Sale Bill Print Preview
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
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <BillShareButtons
              elementId="mandi-print-area"
              filename={`Credit-Sale-${creditSale.creditSaleNo.replace(/\s+/g, '-')}`}
              customerMobile={customerMobile}
              title={`Credit Sale Bill ${creditSale.creditSaleNo}`}
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

        {/* Printable Traditional Wholesale Mandi Bill Canvas */}
        <div className="p-4 sm:p-6 overflow-x-auto flex justify-center bg-slate-100 dark:bg-slate-950">
          <BillTableCanvas
            saleType="CREDIT SALE"
            billNumber={creditSale.creditSaleNo}
            date={creditSale.date}
            customerName={customerName}
            customerAddress={customerAddress}
            customerMobile={customerMobile}
            customerAadhaarNo={customerAadhaarNo}
            items={creditSale.items || []}
            expenses={creditSale.expenses || []}
            productTotal={creditSale.productTotal}
            expenseTotal={creditSale.expenseTotal}
            finalAmount={creditSale.finalAmount}
            netTotal={creditSale.netTotal}
            oldBalance={creditSale.oldBalance}
            cashReceipt={creditSale.cashReceipt}
            totalBalance={creditSale.totalBalance}
            crateOut={creditSale.crateOut}
            crateIn={creditSale.crateIn}
            crateWeightKg={creditSale.crateWeightKg}
            crateMovements={creditSale.crateMovements}
            profile={currentProfile}
            pageSize={pageSize}
          />
        </div>
      </div>

      {/* Format Selection Dialog for Print Button */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={`Credit Sale Bill ${creditSale.creditSaleNo}`}
        elementId="mandi-print-area"
        filename={`Credit-Sale-${creditSale.creditSaleNo.replace(/\s+/g, '-')}`}
        defaultSize={pageSize}
        initialAction="print"
        onPaperSizeChange={setPageSize}
      />
    </div>
  );
};
