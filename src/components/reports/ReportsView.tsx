import React, { useState } from 'react';
import { db } from '../../services/db';
import {
  getAllCustomerOutstandings,
  getCustomerLedger,
  getSaleProceedsLedger,
} from '../../services/accounting';
import { formatCurrency, formatDate, toIsoDate, getTodayIso } from '../../utils/formatters';
import { DatePickerInput } from '../common/DatePickerInput';
import {
  BarChart3,
  Users,
  Building,
  Receipt,
  TrendingUp,
  Box,
  Download,
  Calendar,
  Printer,
  FileSpreadsheet,
  Building2,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { BillShareButtons } from '../common/BillShareButtons';
import { triggerPrint } from '../../utils/pdfAndShareEngine';
import { CompanyContactsHeader } from '../common/CompanyContactsHeader';
import {
  exportExpenses,
  exportCustomerLedger,
  exportSaleProceedsLedger,
  exportCrateStatement,
  downloadWorkbook,
  setAutoColumnWidths,
} from '../../utils/excelEngine';

interface ReportsViewProps {
  initialTab?: 'dailySales' | 'customerOutstanding' | 'vendorOutstanding' | 'expenses' | 'profit' | 'crates';
  onTabChange?: (tab: 'dailySales' | 'customerOutstanding' | 'vendorOutstanding' | 'expenses' | 'profit' | 'crates') => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  initialTab = 'dailySales',
  onTabChange,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dailySales' | 'customerOutstanding' | 'vendorOutstanding' | 'expenses' | 'profit' | 'crates'
  >(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabSelect = (tab: 'dailySales' | 'customerOutstanding' | 'vendorOutstanding' | 'expenses' | 'profit' | 'crates') => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const [filterStartDate, setFilterStartDate] = useState(getTodayIso());
  const [filterEndDate, setFilterEndDate] = useState(getTodayIso());

  const saleProceeds = db.getSaleProceeds();
  const creditSales = db.getCreditSales();
  const receipts = db.getReceipts();
  const customers = db.getCustomers();
  const vendors = db.getVendors();
  const customerOutstandings = getAllCustomerOutstandings();
  const profiles = db.getCompanyProfiles();
  const defaultProfile = db.getDefaultProfile() || profiles[0];
  const [selectedProfileId, setSelectedProfileId] = useState<string>(
    defaultProfile?.id || profiles[0]?.id || ''
  );
  const currentProfile = profiles.find((p) => p.id === selectedProfileId) || defaultProfile || profiles[0];

  // 1. Daily Sales Report Aggregator
  const getDailySalesData = () => {
    const datesSet = new Set<string>();
    saleProceeds.forEach((s) => datesSet.add(s.date));
    creditSales.forEach((c) => datesSet.add(c.date));
    receipts.forEach((r) => datesSet.add(r.date));

    const sortedDates = Array.from(datesSet).sort().reverse();

    return sortedDates.map((d) => {
      const spForDate = saleProceeds.filter((s) => s.date === d);
      const csForDate = creditSales.filter((c) => c.date === d);
      const rForDate = receipts.filter((r) => r.date === d);

      const spTotal = spForDate.reduce((sum, s) => sum + s.netAmount, 0);
      const csTotal = csForDate.reduce((sum, c) => sum + c.finalAmount, 0);
      const recTotal = rForDate.reduce((sum, r) => sum + r.amount, 0);

      const spExp = spForDate.reduce((sum, s) => sum + s.totalExpense, 0);
      const csExp = csForDate.reduce((sum, c) => sum + c.expenseTotal, 0);
      const totalExp = spExp + csExp;

      const net = (spTotal + csTotal) - totalExp;

      return {
        date: d,
        saleProceeds: spTotal,
        creditSales: csTotal,
        receipts: recTotal,
        expenses: totalExp,
        net,
      };
    });
  };

  // 2. Expense Report Aggregator
  const getExpenseData = () => {
    const list: {
      date: string;
      expenseType: string;
      amount: number;
      reference: string;
      source: string;
    }[] = [];

    saleProceeds.forEach((sp) => {
      sp.expenses?.forEach((e) => {
        list.push({
          date: sp.date,
          expenseType: e.name,
          amount: e.amount,
          reference: sp.proceedsNo,
          source: 'Sale Proceeds',
        });
      });
    });

    creditSales.forEach((cs) => {
      cs.expenses?.forEach((e) => {
        list.push({
          date: cs.date,
          expenseType: e.name,
          amount: e.amount,
          reference: cs.creditSaleNo,
          source: 'Credit Sale',
        });
      });
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  };

  // 3. Profit Report
  const totalSales = saleProceeds.reduce((sum, s) => sum + s.netAmount, 0) +
    creditSales.reduce((sum, c) => sum + c.finalAmount, 0);
  const totalExpenses = saleProceeds.reduce((sum, s) => sum + s.totalExpense, 0) +
    creditSales.reduce((sum, c) => sum + c.expenseTotal, 0);
  const netProfit = totalSales - totalExpenses;

  const handleExportCsv = () => {
    let headers: string[] = [];
    let rows: (string | number)[][] = [];
    let filename = `Report_${activeTab}_${getTodayIso()}.csv`;

    if (activeTab === 'dailySales') {
      headers = ['Date', 'Sale Proceeds (₹)', 'Credit Sales (₹)', 'Receipts (₹)', 'Expenses (₹)', 'Net (₹)'];
      rows = getDailySalesData().map((d) => [
        formatDate(d.date),
        d.saleProceeds.toFixed(2),
        d.creditSales.toFixed(2),
        d.receipts.toFixed(2),
        d.expenses.toFixed(2),
        d.net.toFixed(2),
      ]);
    } else if (activeTab === 'customerOutstanding') {
      headers = ['Customer', 'Opening (₹)', 'Debit (₹)', 'Credit (₹)', 'Closing Balance (₹)'];
      rows = customerOutstandings.map((o) => [
        `"${o.customer.name}"`,
        o.openingBalance.toFixed(2),
        o.totalDebit.toFixed(2),
        o.totalCredit.toFixed(2),
        o.closingBalance.toFixed(2),
      ]);
    } else if (activeTab === 'vendorOutstanding') {
      headers = ['Vendor', 'Opening (₹)', 'Closing Balance (₹)'];
      rows = vendors.map((v) => [
        `"${v.name}"`,
        v.openingBalance.toFixed(2),
        v.openingBalance.toFixed(2),
      ]);
    } else if (activeTab === 'expenses') {
      headers = ['Date', 'Expense Type', 'Amount (₹)', 'Reference', 'Source'];
      rows = getExpenseData().map((e) => [
        formatDate(e.date),
        `"${e.expenseType}"`,
        e.amount.toFixed(2),
        `"${e.reference}"`,
        `"${e.source}"`,
      ]);
    } else if (activeTab === 'crates') {
      headers = ['Customer', 'Opening Crates', 'Current Crates', 'KG Equivalent'];
      rows = customerOutstandings.map((o) => [
        `"${o.customer.name}"`,
        o.customer.openingCrateBalance,
        o.crateBalance,
        o.crateKg,
      ]);
    }

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    if (activeTab === 'expenses') {
      exportExpenses(getExpenseData());
    } else if (activeTab === 'customerOutstanding') {
      exportCustomerLedger();
    } else if (activeTab === 'vendorOutstanding') {
      exportSaleProceedsLedger();
    } else if (activeTab === 'crates') {
      exportCrateStatement();
    } else {
      // dailySales
      const headers = ['Date', 'Sale Proceeds (₹)', 'Credit Sales (₹)', 'Receipts (₹)', 'Expenses (₹)', 'Net (₹)'];
      const rows = getDailySalesData().map((d) => [
        formatDate(d.date),
        d.saleProceeds,
        d.creditSales,
        d.receipts,
        d.expenses,
        d.net,
      ]);
      const wsData = [
        ['HARI KRIPA FRUIT ERP — DAILY SALES & CONSIGNMENT SUMMARY'],
        [`Export Date: ${getTodayIso()}`],
        [],
        headers,
        ...rows,
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      setAutoColumnWidths(ws, [headers, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Daily Sales');
      downloadWorkbook(wb, `Hari_Kripa_Daily_Sales_${getTodayIso()}.xlsx`);
    }
  };

  const tabTitles: Record<string, string> = {
    dailySales: 'Daily Mandi Sales & Net Audit Report',
    customerOutstanding: 'Customer Outstanding Statement Report',
    vendorOutstanding: 'Vendor Outstanding Statement Report',
    expenses: 'Mandi Expenses Audit Report',
    profit: 'Consignment Profit & Loss Analytics Report',
    crates: 'Customer Crate Balance Report',
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-emerald-600" /> Accounting Reports
          </h2>
          <p className="text-xs text-slate-500">
            Real-time wholesale sales, outstandings, expense audits & crate analytics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <div className="flex items-center gap-1.5 no-print">
            <Building2 className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-800 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              title="Select Billing Profile for Report Header"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.hindiName ? `(${p.hindiName})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <BillShareButtons
            elementId="report-print-area"
            filename={`${(tabTitles[activeTab] || 'Report').replace(/\s+/g, '_')}_${formatDate(getTodayIso()).replace(/\//g, '_')}`}
            title={tabTitles[activeTab] || 'Mandi Report'}
            summaryText={`Report: ${tabTitles[activeTab] || 'Mandi Report'}\nDate: ${formatDate(getTodayIso())}\nPeriod: ${formatDate(filterStartDate)} to ${formatDate(filterEndDate)}`}
            defaultPaperSize="a4"
          />
          <button
            type="button"
            onClick={() => triggerPrint('a4', 'report-print-area')}
            className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900 no-print">
        <button
          type="button"
          onClick={() => handleTabSelect('dailySales')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'dailySales'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Calendar className="h-3.5 w-3.5" /> Daily Sales
        </button>
        <button
          type="button"
          onClick={() => handleTabSelect('customerOutstanding')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'customerOutstanding'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Users className="h-3.5 w-3.5" /> Customer Outstanding
        </button>
        <button
          type="button"
          onClick={() => handleTabSelect('vendorOutstanding')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'vendorOutstanding'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Building className="h-3.5 w-3.5" /> Vendor Outstanding
        </button>
        <button
          type="button"
          onClick={() => handleTabSelect('expenses')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'expenses'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Receipt className="h-3.5 w-3.5" /> Expense Report
        </button>
        <button
          type="button"
          onClick={() => handleTabSelect('profit')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'profit'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" /> Profit Report
        </button>
        <button
          type="button"
          onClick={() => handleTabSelect('crates')}
          className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            activeTab === 'crates'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
        >
          <Box className="h-3.5 w-3.5" /> Crate Report
        </button>
      </div>

      {/* Report Printable Area */}
      <div id="report-print-area" className="erp-print-area print-bill-canvas space-y-4">
        {/* Printable Traditional Mandi Report Header */}
        <div className="hidden print:block p-4 border-b border-black text-center mb-1">
          {currentProfile.shortCode && (
            <div className="font-bold text-xs tracking-widest uppercase text-slate-700 print:text-black">
              {currentProfile.shortCode}
            </div>
          )}
          <h1 className="text-lg sm:text-xl font-black uppercase tracking-wider">{currentProfile.name}</h1>
          {currentProfile.hindiName && (
            <div className="text-base sm:text-lg font-bold tracking-wide mt-0.5 font-devanagari text-slate-900 print:text-black">
              {currentProfile.hindiName}
            </div>
          )}
          <div className="text-[11px] text-slate-700 leading-snug mt-1">
            {currentProfile.address}
            {currentProfile.city ? `, ${currentProfile.city}` : ''}
            {currentProfile.state ? `, ${currentProfile.state}` : ''}
          </div>
          <CompanyContactsHeader profile={currentProfile} className="mt-0.5" />
          <div className="my-1.5 text-xs font-bold uppercase tracking-widest border-b border-t border-black py-0.5 inline-block">
            {tabTitles[activeTab] || 'BUSINESS REPORT'}
          </div>
          <div className="flex justify-between items-start text-xs mt-2 text-left border-t border-slate-300 pt-1.5">
            <div>
              <div className="font-bold text-sm">{tabTitles[activeTab] || 'Report'}</div>
              <div className="text-[11px]">Entity: {currentProfile.name}</div>
            </div>
            <div className="text-right">
              <div>DATE: <strong>{formatDate(getTodayIso())}</strong></div>
              {(filterStartDate || filterEndDate) ? (
                <div className="text-[11px]">Period: {filterStartDate ? formatDate(filterStartDate) : 'Opening'} to {filterEndDate ? formatDate(filterEndDate) : 'Today'}</div>
              ) : (
                <div className="text-[11px]">Period: Complete Statement</div>
              )}
            </div>
          </div>
        </div>

        {/* Tab 1: Daily Sales Report */}
        {activeTab === 'dailySales' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Daily Mandi Sales & Net Audit</h3>
            <p className="text-xs text-slate-500">Summary of all daily consignments, credit sales, cash receipts and expenses</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <th className="px-5 py-3.5">Date</th>
                  <th className="px-5 py-3.5 text-right">Sale Proceeds (₹)</th>
                  <th className="px-5 py-3.5 text-right">Credit Sales (₹)</th>
                  <th className="px-5 py-3.5 text-right">Receipts (₹)</th>
                  <th className="px-5 py-3.5 text-right">Expenses (₹)</th>
                  <th className="px-5 py-3.5 text-right">Net (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {getDailySalesData().map((d) => (
                  <tr key={d.date} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-mono-numbers text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatDate(d.date)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-slate-800 dark:text-slate-200">
                      {formatCurrency(d.saleProceeds)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-slate-800 dark:text-slate-200">
                      {formatCurrency(d.creditSales)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      {formatCurrency(d.receipts)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-rose-600 dark:text-rose-400">
                      {formatCurrency(d.expenses)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(d.net)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Customer Outstanding Report */}
      {activeTab === 'customerOutstanding' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Customer Outstanding Balances</h3>
            <p className="text-xs text-slate-500">Breakdown of customer opening balance, total debits, total credits and closing due</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <th className="px-5 py-3.5">Customer Name</th>
                  <th className="px-5 py-3.5 text-right">Opening (₹)</th>
                  <th className="px-5 py-3.5 text-right">Debit / Sales (₹)</th>
                  <th className="px-5 py-3.5 text-right">Credit / Receipts (₹)</th>
                  <th className="px-5 py-3.5 text-right">Closing Outstanding (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerOutstandings.map((o) => (
                  <tr key={o.customer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-bold text-xs text-slate-900 dark:text-white">
                      {o.customer.name}
                      {o.customer.city && (
                        <span className="text-[11px] font-normal text-slate-400 ml-1.5">({o.customer.city})</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-slate-600 dark:text-slate-400">
                      {formatCurrency(o.openingBalance)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-rose-600 dark:text-rose-400">
                      {formatCurrency(o.totalDebit)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-emerald-600 dark:text-emerald-400">
                      {formatCurrency(o.totalCredit)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(o.closingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Vendor Outstanding */}
      {activeTab === 'vendorOutstanding' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Wholesale Vendor & Consignor Payables</h3>
            <p className="text-xs text-slate-500">Amounts payable to growers and wholesale syndicates</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <th className="px-5 py-3.5">Vendor Name</th>
                  <th className="px-5 py-3.5">Location</th>
                  <th className="px-5 py-3.5 text-right">Opening Balance</th>
                  <th className="px-5 py-3.5 text-right">Closing Payable (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-bold text-xs text-slate-900 dark:text-white">
                      {v.name}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {v.city || 'Mandi'} {v.state ? `, ${v.state}` : ''}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers text-xs text-slate-600">
                      {formatCurrency(v.openingBalance)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers font-bold text-sm text-slate-900 dark:text-white">
                      {formatCurrency(v.openingBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Expense Report */}
      {activeTab === 'expenses' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Consignment & Operational Expense Audit</h3>
            <p className="text-xs text-slate-500">Freight, Hamali, Postage and mandi handling expenses</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <th className="px-5 py-3.5 w-32">Date</th>
                  <th className="px-5 py-3.5">Expense Type</th>
                  <th className="px-5 py-3.5">Reference No.</th>
                  <th className="px-5 py-3.5">Source Module</th>
                  <th className="px-5 py-3.5 text-right w-36">Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {getExpenseData().map((e, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3 font-mono-numbers text-xs text-slate-700 dark:text-slate-300">
                      {formatDate(e.date)}
                    </td>
                    <td className="px-5 py-3 font-semibold text-xs text-slate-800 dark:text-slate-200">
                      {e.expenseType}
                    </td>
                    <td className="px-5 py-3 font-mono-numbers text-xs text-slate-600">
                      {e.reference}
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-500">
                      {e.source}
                    </td>
                    <td className="px-5 py-3 text-right font-mono-numbers font-bold text-xs text-rose-600 dark:text-rose-400">
                      {formatCurrency(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 5: Profit Report */}
      {activeTab === 'profit' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-6">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white">Wholesale Trading Profit Statement</h3>
            <p className="text-xs text-slate-500">Sales - Consignment Expenses = Net Wholesale Profit</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40">
              <span className="text-xs font-semibold text-slate-500 block mb-1">Total Sales Revenue</span>
              <span className="font-mono-numbers text-2xl font-black text-slate-900 dark:text-white">
                {formatCurrency(totalSales)}
              </span>
              <span className="block text-[11px] text-slate-400 mt-1">Sale Proceeds Net + Credit Sales</span>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-5 dark:border-rose-950/40 dark:bg-rose-950/20">
              <span className="text-xs font-semibold text-rose-600 block mb-1">Total Expenses</span>
              <span className="font-mono-numbers text-2xl font-black text-rose-600 dark:text-rose-400">
                {formatCurrency(totalExpenses)}
              </span>
              <span className="block text-[11px] text-rose-400 mt-1">Freight, Hamali & Market charges</span>
            </div>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-950/40 dark:bg-emerald-950/20">
              <span className="text-xs font-semibold text-emerald-700 block mb-1">Net Profit</span>
              <span className="font-mono-numbers text-2xl font-black text-emerald-700 dark:text-emerald-300">
                {formatCurrency(netProfit)}
              </span>
              <span className="block text-[11px] text-emerald-600 mt-1">
                Sales − Expenses = Net Margin
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Tab 6: Crate Report */}
      {activeTab === 'crates' && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
          <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Customer Crate Holdings & KG Equivalent</h3>
            <p className="text-xs text-slate-500">Live quantity ledger auditing plastic & wooden crates with customers</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-300">
                  <th className="px-5 py-3.5">Customer</th>
                  <th className="px-5 py-3.5 text-center">Opening Crates</th>
                  <th className="px-5 py-3.5 text-center">Current Crate Balance</th>
                  <th className="px-5 py-3.5 text-right">KG Equivalent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {customerOutstandings.map((o) => (
                  <tr key={o.customer.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-5 py-3.5 font-bold text-xs text-slate-900 dark:text-white">
                      {o.customer.name}
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono-numbers text-xs text-slate-500">
                      {o.customer.openingCrateBalance} Crates
                    </td>
                    <td className="px-5 py-3.5 text-center font-mono-numbers font-bold text-xs text-sky-700 dark:text-sky-300">
                      {o.crateBalance} Crates
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono-numbers font-bold text-xs text-sky-800 dark:text-sky-200">
                      {o.crateKg} KG
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

        {/* Software attribution & Signatory */}
        <div className="hidden print:flex p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 print:border-black justify-between items-center text-xs">
          <div className="text-[8px] sm:text-[8.5px] text-left text-slate-500 print:text-black font-mono">
            Software Developed by: {currentProfile.softwareDevelopedBy || 'Klyia Technology'}
          </div>
          <div className="text-right font-bold uppercase text-[11px]">
            FOR, {currentProfile.signatureTitle || currentProfile.name}
          </div>
        </div>
      </div>
    </div>
  );
};
