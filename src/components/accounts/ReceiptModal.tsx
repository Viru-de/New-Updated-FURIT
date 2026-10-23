import React, { useState, useEffect } from 'react';
import { Customer, Receipt } from '../../types';
import { db } from '../../services/db';
import { getCustomerLedger } from '../../services/accounting';
import { formatCurrency, formatSequence, getTodayIso } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import { AddCustomerModal } from '../modals/AddCustomerModal';
import { ReceiptPrintModal } from '../print/ReceiptPrintModal';
import { CustomerAvatar } from '../common/CustomerAvatar';
import { CustomerAutocomplete } from '../common/CustomerAutocomplete';
import { X, UserPlus, CreditCard, ArrowDownRight, Printer } from 'lucide-react';

interface ReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  editItem?: Receipt | null;
  onSaved: (item: Receipt) => void;
  preselectedCustomerId?: string;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  onClose,
  editItem,
  onSaved,
  preselectedCustomerId,
}) => {
  const customers = db.getCustomers();

  const [customerId, setCustomerId] = useState('');
  const [date, setDate] = useState(getTodayIso());
  const [paymentMode, setPaymentMode] = useState<Receipt['paymentMode']>('Cash');
  const [amount, setAmount] = useState<number | ''>(10000);
  const [notes, setNotes] = useState('Cash A/C payment against ledger');
  const [isPrintOpen, setIsPrintOpen] = useState(false);

  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);

  useEffect(() => {
    if (editItem) {
      setCustomerId(editItem.customerId);
      setDate(editItem.date);
      setPaymentMode(editItem.paymentMode);
      setAmount(editItem.amount);
      setNotes(editItem.notes || '');
    } else {
      setCustomerId(preselectedCustomerId || customers[0]?.id || '');
      setDate(getTodayIso());
      setPaymentMode('Cash');
      setAmount(10000);
      setNotes('Cash A/C payment against ledger');
    }
  }, [editItem, isOpen, preselectedCustomerId]);

  if (!isOpen) return null;

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const currentLedger = customerId ? getCustomerLedger(customerId) : null;
  const currentOutstanding = currentLedger ? currentLedger.closingBalance : 0;
  const numAmount = Number(amount) || 0;
  const newProjectedOutstanding = currentOutstanding - numAmount;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId || !amount) return;

    const seq = editItem ? editItem.sequenceNumber : db.getNextReceiptNumber();
    const receiptNo = editItem
      ? editItem.receiptNo
      : `Receipt No. ${formatSequence(seq, 3)}`;

    const receiptRecord: Receipt = {
      id: editItem ? editItem.id : `r-${Date.now()}`,
      receiptNo,
      sequenceNumber: seq,
      customerId,
      customerName: selectedCustomer ? selectedCustomer.name : 'Customer',
      date,
      paymentMode,
      amount: numAmount,
      notes: notes.trim() || undefined,
      createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
    };

    db.saveReceipt(receiptRecord);
    onSaved(receiptRecord);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto min-w-0 mx-2 sm:mx-auto">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-4 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  {editItem ? `Edit ${editItem.receiptNo}` : 'New Customer Receipt / Cash A/C'}
                </h3>
                <p className="text-xs text-slate-500">
                  Record payment receipt to credit customer ledger
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-6">
            {/* Customer select */}
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Customer *
                </label>
                <button
                  type="button"
                  onClick={() => setIsAddCustomerOpen(true)}
                  className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-700"
                >
                  <UserPlus className="h-3 w-3" /> + Add Customer
                </button>
              </div>
              <CustomerAutocomplete
                valueCustomerId={customerId}
                onChange={(c) => setCustomerId(c ? c.id : '')}
                placeholder="Search customer name, mobile or city..."
              />
            </div>

            {/* Current Balance Indicator */}
            {selectedCustomer && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <CustomerAvatar
                      photo={selectedCustomer.photo}
                      name={selectedCustomer.name}
                      size="xs"
                    />
                    <span className="text-slate-600 dark:text-slate-300 font-semibold">{selectedCustomer.name}</span>
                  </div>
                  <span className="font-mono-numbers font-bold text-slate-800 dark:text-slate-200">
                    Outstanding: {formatCurrency(currentOutstanding)}
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <span className="flex items-center gap-1">
                    <ArrowDownRight className="h-3.5 w-3.5" /> Balance after Receipt:
                  </span>
                  <span className="font-mono-numbers font-bold">
                    {formatCurrency(newProjectedOutstanding)}
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <DatePickerInput
                label="Receipt Date"
                required
                value={date}
                onChange={setDate}
              />

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Payment Mode *
                </label>
                <select
                  value={paymentMode}
                  onChange={(e) => setPaymentMode(e.target.value as any)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="Cash">Cash (Cash A/C)</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Bank Transfer">Bank Transfer (NEFT/RTGS)</option>
                  <option value="Cheque">Cheque</option>
                  <option value="RTGS/NEFT">RTGS / IMPS</option>
                </select>
              </div>
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Receipt Amount (Credit ₹) *
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-base font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="any"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : '')}
                  className="w-full rounded-lg border-2 border-emerald-500 bg-white pl-8 pr-3 py-2 text-lg font-bold font-mono-numbers text-slate-900 outline-none focus:ring-1 focus:ring-emerald-500 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Particulars / Notes
              </label>
              <input
                type="text"
                placeholder="e.g. Cash A/C, Cheque No, Transaction ID"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsPrintOpen(true)}
                disabled={!customerId || numAmount <= 0}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-600 dark:border-emerald-500 px-3.5 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-40 cursor-pointer"
                title="Print this receipt directly"
              >
                <Printer className="h-3.5 w-3.5" /> Print Receipt
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
                >
                  {editItem ? 'Update Receipt' : 'Save Receipt'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <AddCustomerModal
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        onCustomerCreated={(c) => setCustomerId(c.id)}
      />

      {isPrintOpen && (
        <ReceiptPrintModal
          isOpen={isPrintOpen}
          onClose={() => setIsPrintOpen(false)}
          receipt={{
            id: editItem ? editItem.id : 'preview-receipt',
            receiptNo: editItem
              ? editItem.receiptNo
              : `Receipt No. ${formatSequence(db.getNextReceiptNumber(), 3)}`,
            sequenceNumber: editItem ? editItem.sequenceNumber : db.getNextReceiptNumber(),
            customerId,
            customerName: selectedCustomer ? selectedCustomer.name : 'Customer',
            date,
            paymentMode,
            amount: numAmount,
            notes: notes.trim() || undefined,
            createdAt: editItem ? editItem.createdAt : new Date().toISOString(),
          }}
        />
      )}
    </>
  );
};
