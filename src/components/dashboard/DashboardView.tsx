import React, { useState } from 'react';
import { getDashboardMetrics } from '../../services/accounting';
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
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Wallet,
  TableProperties,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'all'>('today');
  const [customDate, setCustomDate] = useState(getTodayIso());

  const metrics = getDashboardMetrics(toIsoDate(customDate), datePreset);

  return (
    <div className="space-y-6">
      {/* Top Banner & Date Filter Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Wholesale Mandi Accounting Dashboard
          </h2>
          <p className="text-xs text-slate-500">
            Business: Hari Kripa · Real-time financial balances, crate holdings & daily sales
          </p>
        </div>

        {/* Date Filter Segmented Controls */}
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
                    ? 'neu-btn-active font-bold text-blue-600'
                    : 'font-semibold text-slate-600 hover:text-slate-900'
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

          <button
            type="button"
            onClick={() => onNavigate('groupSale')}
            className="neu-btn px-3 py-2 text-xs font-bold text-blue-700 hover:text-blue-800 flex items-center gap-1.5 shrink-0"
            title="Open Group Sale (Daily Grid)"
          >
            <TableProperties className="h-4 w-4 text-blue-600" />
            <span>Group Sale</span>
          </button>
        </div>
      </div>

      {/* 8 Essential Accounting KPI Cards (Neumorphic Raised Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Today's Sale Proceeds */}
        <div
          onClick={() => onNavigate('saleProceeds')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Sale Proceeds</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-slate-900">
            {formatCurrency(metrics.totalSaleProceeds)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{metrics.saleProceedsCount} Consignments</span>
            <span className="text-emerald-700 font-semibold">View &rarr;</span>
          </div>
        </div>

        {/* 2. Today's Credit Sales */}
        <div
          onClick={() => onNavigate('creditSales')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Credit Sales</span>
            <ShoppingBag className="h-4 w-4 text-blue-600" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-blue-700">
            {formatCurrency(metrics.totalCreditSales)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{metrics.creditSalesCount} Customer Bills</span>
            <span className="text-blue-600 font-semibold">View &rarr;</span>
          </div>
        </div>

        {/* 3. Today's Receipts */}
        <div
          onClick={() => onNavigate('receipts')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Receipts / Cash</span>
            <CreditCard className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-emerald-600">
            {formatCurrency(metrics.totalReceipts)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>{metrics.receiptsCount} Collections</span>
            <span className="text-emerald-700 font-semibold">View &rarr;</span>
          </div>
        </div>

        {/* 4. Today's Expenses */}
        <div
          onClick={() => onNavigate('reports')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Expenses (Freight/Hamali)</span>
            <Receipt className="h-4 w-4 text-rose-600" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-rose-600">
            {formatCurrency(metrics.totalExpenses)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Deductions & Charges</span>
            <span className="text-rose-600 font-semibold">Audit &rarr;</span>
          </div>
        </div>

        {/* 5. Net Profit */}
        <div
          onClick={() => onNavigate('reports')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all border border-emerald-300/40"
        >
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Net Profit</span>
            <Wallet className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="font-mono-numbers text-xl font-black text-emerald-700">
            {formatCurrency(metrics.netProfit)}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1">
            Revenue minus Expenses
          </div>
        </div>

        {/* 6. Customer Outstanding */}
        <div
          onClick={() => onNavigate('customerDirectory')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all border border-rose-300/40"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Customer Outstanding</span>
            <Users className="h-4 w-4 text-rose-600" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-rose-600">
            {formatCurrency(metrics.totalCustomerOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Total Receivables</span>
            <span className="text-slate-700 font-semibold">Directory &rarr;</span>
          </div>
        </div>

        {/* 7. Wholesale Vendor Outstanding */}
        <div
          onClick={() => onNavigate('wholesaleDirectory')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold">Vendor Outstanding</span>
            <Building className="h-4 w-4 text-amber-600" />
          </div>
          <div className="font-mono-numbers text-xl font-bold text-slate-900">
            {formatCurrency(metrics.totalVendorOutstanding)}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Consignor Payables</span>
            <span className="text-slate-700 font-semibold">Vendors &rarr;</span>
          </div>
        </div>

        {/* 8. Total Crate Balance */}
        <div
          onClick={() => onNavigate('crateStatement')}
          className="neu-card cursor-pointer p-4 hover:translate-y-[-2px] transition-all border border-blue-200/50"
        >
          <div className="flex items-center justify-between text-blue-800 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Crate Balance</span>
            <Box className="h-4 w-4 text-blue-600" />
          </div>
          <div className="font-mono-numbers text-xl font-black text-blue-900">
            {metrics.totalCrateBalance} Crates
          </div>
          <div className="text-[11px] text-blue-700 mt-1">
            ≈ {metrics.totalCrateBalance * 20} KG equivalent
          </div>
        </div>
      </div>

      {/* Recent Activity Sections (Sale Proceeds, Credit Sales, Receipts) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sale Proceeds */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between border-b border-slate-300/40 pb-3 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Recent Sale Proceeds
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('saleProceeds')}
              className="neu-btn px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
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
                  className="neu-inset-sm cursor-pointer flex items-center justify-between p-2.5 hover:bg-white/40 transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {sp.proceedsNo}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {formatDate(sp.date)} · Qty: {sp.quantity} {sp.unit}
                    </span>
                  </div>
                  <span className="font-mono-numbers text-xs font-bold text-emerald-600">
                    {formatCurrency(sp.netAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Credit Sales */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between border-b border-slate-300/40 pb-3 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Recent Credit Sales
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('creditSales')}
              className="neu-btn px-2.5 py-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
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
                  className="neu-inset-sm cursor-pointer flex items-center justify-between p-2.5 hover:bg-white/40 transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {cs.creditSaleNo}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {cs.customerName} · {formatDate(cs.date)}
                    </span>
                  </div>
                  <span className="font-mono-numbers text-xs font-bold text-rose-600">
                    {formatCurrency(cs.finalAmount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Receipts */}
        <div className="neu-card p-5">
          <div className="flex items-center justify-between border-b border-slate-300/40 pb-3 mb-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-700">
              Recent Collections / Cash
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('receipts')}
              className="neu-btn px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
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
                  className="neu-inset-sm cursor-pointer flex items-center justify-between p-2.5 hover:bg-white/40 transition-colors"
                >
                  <div>
                    <span className="font-bold text-xs text-slate-900 block">
                      {r.receiptNo} ({r.paymentMode})
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {r.customerName} · {formatDate(r.date)}
                    </span>
                  </div>
                  <span className="font-mono-numbers text-xs font-bold text-emerald-600">
                    {formatCurrency(r.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
