import React, { useState } from 'react';
import { getDashboardMetrics } from '../../services/accounting';
import { db } from '../../services/db';
import { formatCurrency, formatDate, getTodayIso, toIsoDate } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import {
  TrendingUp,
  CreditCard,
  ShoppingBag,
  Receipt,
  Users,
  Building,
  Box,
  Wallet,
  TableProperties,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  X,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [customDate, setCustomDate] = useState(getTodayIso());

  // Dashboard Lock state (persisted in localStorage)
  const [isLocked, setIsLocked] = useState<boolean>(() => {
    try {
      return localStorage.getItem('hk_dashboard_locked') === 'true';
    } catch {
      return false;
    }
  });

  // Password Unlock Modal State
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [showUnlockPassword, setShowUnlockPassword] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const metrics = getDashboardMetrics(toIsoDate(customDate), datePreset);

  const handleLockClick = () => {
    setIsLocked(true);
    try {
      localStorage.setItem('hk_dashboard_locked', 'true');
    } catch {}
  };

  const handleUnlockClick = () => {
    setUnlockPassword('');
    setUnlockError(null);
    setShowUnlockPassword(false);
    setIsUnlockModalOpen(true);
  };

  const handleUnlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockPassword.trim()) {
      setUnlockError('Please enter administrator password or PIN.');
      return;
    }
    const isValid = db.verifyAdminPassword(unlockPassword);
    if (!isValid) {
      setUnlockError('Incorrect administrator password. (Default PIN: 1234)');
      return;
    }
    setIsLocked(false);
    try {
      localStorage.setItem('hk_dashboard_locked', 'false');
    } catch {}
    setUnlockPassword('');
    setUnlockError(null);
    setIsUnlockModalOpen(false);
  };

  // Masking helpers: hide sensitive numbers when dashboard is locked
  const maskAmount = (val: number) => {
    if (isLocked) {
      return '₹ ••••••';
    }
    return formatCurrency(val);
  };

  const maskCrates = (crates: number) => {
    if (isLocked) {
      return '•••••• Crates';
    }
    return `${crates} Crates`;
  };

  const maskCrateWeight = (crates: number) => {
    if (isLocked) {
      return '≈ •••••• KG equivalent';
    }
    return `≈ ${crates * 20} KG equivalent`;
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Wholesale Mandi Accounting Dashboard
            </h2>
            {isLocked && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Business: Hari Kripa · Real-time financial balances, crate holdings & daily sales
          </p>
        </div>

        {/* Date Filter Segmented Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 max-w-full min-w-0">
          <div className="neu-inset flex items-center p-1 overflow-x-auto max-w-full">
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'all', label: 'All Time' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setDatePreset(item.id)}
                className={`rounded-lg px-2.5 sm:px-3 py-1.5 text-xs whitespace-nowrap transition-all ${
                  datePreset === item.id
                    ? 'neu-btn-active font-bold text-blue-600 dark:text-blue-400'
                    : 'font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="w-36 shrink-0">
            <DatePickerInput
              value={customDate}
              onChange={(d) => {
                setCustomDate(d);
                setDatePreset('today');
              }}
            />
          </div>

          {/* Dashboard Lock / Unlock System Button */}
          {isLocked ? (
            <button
              type="button"
              onClick={handleUnlockClick}
              className="neu-btn px-3 py-2 text-xs font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-1.5 shrink-0 border border-amber-300 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/40 cursor-pointer"
              title="Dashboard numbers are hidden. Click to enter administrator password and unlock."
            >
              <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span>Unlock Numbers</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLockClick}
              className="neu-btn px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 shrink-0 cursor-pointer"
              title="Hide sensitive financial numbers on this dashboard"
            >
              <Unlock className="h-4 w-4 text-slate-500 dark:text-slate-400" />
              <span>Lock Numbers</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('groupSale')}
            className="neu-btn px-3 py-2 text-xs font-bold text-blue-700 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1.5 shrink-0 cursor-pointer"
            title="Open Group Sale (Daily Grid)"
          >
            <TableProperties className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span>Group Sale</span>
          </button>
        </div>
      </div>

      {/* 8 Essential Accounting KPI Cards (Neumorphic Raised Cards) */}
      {/* Note: Clicking ANY card navigates to its corresponding page whether locked or unlocked! */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Sale Proceeds */}
        <div
          onClick={() => onNavigate('saleProceeds')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
          title="Click to view Sale Proceeds"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Sale Proceeds</span>
            <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {maskAmount(metrics.totalSaleProceeds)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>{metrics.saleProceedsCount} Consignments</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">View &rarr;</span>
          </div>
        </div>

        {/* 2. Today's Credit Sales */}
        <div
          onClick={() => onNavigate('creditSales')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
          title="Click to view Credit Sales"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Credit Sales</span>
            <ShoppingBag className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-blue-700 dark:text-blue-400 tracking-tight">
            {maskAmount(metrics.totalCreditSales)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>{metrics.creditSalesCount} Customer Bills</span>
            <span className="text-blue-600 dark:text-blue-400 font-semibold">View &rarr;</span>
          </div>
        </div>

        {/* 3. Today's Receipts */}
        <div
          onClick={() => onNavigate('receipts')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
          title="Click to view Receipts & Collections"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Receipts / Cash</span>
            <CreditCard className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-emerald-600 dark:text-emerald-400 tracking-tight">
            {maskAmount(metrics.totalReceipts)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>{metrics.receiptsCount} Collections</span>
            <span className="text-emerald-700 dark:text-emerald-400 font-semibold">View &rarr;</span>
          </div>
        </div>

        {/* 4. Today's Expenses */}
        <div
          onClick={() => onNavigate('reports')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
          title="Click to view Expenses report"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Expenses (Freight/Hamali)</span>
            <Receipt className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
            {maskAmount(metrics.totalExpenses)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Deductions & Charges</span>
            <span className="text-rose-600 dark:text-rose-400 font-semibold">Audit &rarr;</span>
          </div>
        </div>

        {/* 5. Net Profit */}
        <div
          onClick={() => onNavigate('reports')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all border border-emerald-300/40 dark:border-emerald-800/50"
          title="Click to view Profit report"
        >
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Profit</span>
            <Wallet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="font-mono-numbers text-xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight">
            {maskAmount(metrics.netProfit)}
          </div>
          <div className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-1">
            Revenue minus Expenses
          </div>
        </div>

        {/* 6. Customer Outstanding */}
        <div
          onClick={() => onNavigate('customerDirectory')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all border border-rose-300/40 dark:border-rose-800/50"
          title="Click to view Customer Directory"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Customer Outstanding</span>
            <Users className="h-4 w-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-rose-600 dark:text-rose-400 tracking-tight">
            {maskAmount(metrics.totalCustomerOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Total Receivables</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Directory &rarr;</span>
          </div>
        </div>

        {/* 7. Wholesale Vendor Outstanding */}
        <div
          onClick={() => onNavigate('wholesaleDirectory')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
          title="Click to view Vendors"
        >
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold">Vendor Outstanding</span>
            <Building className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {maskAmount(metrics.totalVendorOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 flex items-center justify-between">
            <span>Consignor Payables</span>
            <span className="text-slate-700 dark:text-slate-300 font-semibold">Vendors &rarr;</span>
          </div>
        </div>

        {/* 8. Total Crate Balance */}
        <div
          onClick={() => onNavigate('crateStatement')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all border border-blue-200/50 dark:border-blue-800/50"
          title="Click to view Crate Statement"
        >
          <div className="flex items-center justify-between text-blue-800 dark:text-blue-300 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Crate Balance</span>
            <Box className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="font-mono-numbers text-xl font-black text-blue-900 dark:text-blue-300 tracking-tight">
            {maskCrates(metrics.totalCrateBalance)}
          </div>
          <div className="text-[11px] text-blue-700 dark:text-blue-400 mt-1">
            {maskCrateWeight(metrics.totalCrateBalance)}
          </div>
        </div>
      </div>

      {/* Recent Activity Sections (Sale Proceeds, Credit Sales, Receipts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sale Proceeds */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between border-b border-slate-300/40 dark:border-slate-700 pb-3 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Sale Proceeds
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('saleProceeds')}
              className="neu-btn px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
            >
              All &rarr;
            </button>
          </div>
          <div className="space-y-2.5">
            {metrics.recentSaleProceeds.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent proceeds</p>
            ) : (
              metrics.recentSaleProceeds.map((sp) => (
                <div
                  key={sp.id}
                  onClick={() => onNavigate('saleProceeds')}
                  className="neu-inset-sm cursor-pointer flex items-center justify-between p-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {sp.proceedsNo}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formatDate(sp.date)} · Qty: {sp.quantity} {sp.unit}
                    </span>
                  </div>
                  <span className="font-mono-numbers text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {maskAmount(sp.netAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Credit Sales */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between border-b border-slate-300/40 dark:border-slate-700 pb-3 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Credit Sales
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('creditSales')}
              className="neu-btn px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer"
            >
              All &rarr;
            </button>
          </div>
          <div className="space-y-2.5">
            {metrics.recentCreditSales.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent credit sales</p>
            ) : (
              metrics.recentCreditSales.map((cs) => (
                <div
                  key={cs.id}
                  onClick={() => onNavigate('creditSales')}
                  className="neu-inset-sm cursor-pointer flex items-center justify-between p-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {cs.creditSaleNo}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {cs.customerName} · {formatDate(cs.date)}
                    </span>
                  </div>
                  <span className="font-mono-numbers text-xs font-bold text-rose-600 dark:text-rose-400">
                    {maskAmount(cs.finalAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Receipts */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between border-b border-slate-300/40 dark:border-slate-700 pb-3 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Recent Collections / Cash
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('receipts')}
              className="neu-btn px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 cursor-pointer"
            >
              All &rarr;
            </button>
          </div>
          <div className="space-y-2.5">
            {metrics.recentReceipts.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent receipts</p>
            ) : (
              metrics.recentReceipts.map((r) => (
                <div
                  key={r.id}
                  onClick={() => onNavigate('receipts')}
                  className="neu-inset-sm cursor-pointer flex items-center justify-between p-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block">
                      {r.receiptNo} ({r.paymentMode})
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {r.customerName} · {formatDate(r.date)}
                    </span>
                  </div>
                  <span className="font-mono-numbers text-xs font-bold text-emerald-600 dark:text-emerald-400">
                    {maskAmount(r.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Password Unlock Modal Dialog */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Unlock Dashboard
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Administrator Authorization Required
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsUnlockModalOpen(false);
                  setUnlockError(null);
                  setUnlockPassword('');
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleUnlockSubmit} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Admin Password or PIN
                </label>
                <div className="relative">
                  <input
                    type={showUnlockPassword ? 'text' : 'password'}
                    autoFocus
                    value={unlockPassword}
                    onChange={(e) => {
                      setUnlockPassword(e.target.value);
                      if (unlockError) setUnlockError(null);
                    }}
                    placeholder="Enter PIN (e.g. 1234)"
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowUnlockPassword((prev) => !prev)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1 cursor-pointer"
                  >
                    {showUnlockPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {unlockError && (
                  <p className="mt-1.5 text-xs text-rose-600 dark:text-rose-400 font-medium">
                    {unlockError}
                  </p>
                )}
                <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                  Default administrator PIN is <strong className="font-mono text-slate-700 dark:text-slate-300">1234</strong>
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsUnlockModalOpen(false);
                    setUnlockError(null);
                    setUnlockPassword('');
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 transition-colors shadow-xs cursor-pointer"
                >
                  Unlock Numbers
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
