import React, { useState, useEffect } from 'react';
import { db } from '../../services/db';
import {
  Home,
  Folder,
  FolderOpen,
  ClipboardList,
  ReceiptText,
  BarChart3,
  Settings,
  ChevronDown,
  ChevronRight,
  Apple,
  X,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  BookOpen,
  Users,
  Box,
  Building,
  FileText,
  History,
  Building2,
  Calendar,
  DollarSign,
  Scale,
  Trash2,
  TableProperties,
} from 'lucide-react';

interface SidebarProps {
  currentView: string;
  reportSubTab?: string;
  onSelectView: (view: string, reportTab?: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  reportSubTab = 'dailySales',
  onSelectView,
  isOpen,
  onClose,
}) => {
  // Collapsible dropdown sections state
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    accounts: true,
    master: true,
    billing: true,
    reports: true,
  });

  // Auto-expand section if active view belongs to it
  useEffect(() => {
    if (
      [
        'saleProceeds',
        'creditSales',
        'receipts',
        'saleProceedsLedger',
        'customerLedger',
        'crateStatement',
      ].includes(currentView)
    ) {
      setExpandedSections((prev) => ({ ...prev, accounts: true }));
    } else if (['customerDirectory', 'wholesaleDirectory', 'fruitMaster'].includes(currentView)) {
      setExpandedSections((prev) => ({ ...prev, master: true }));
    } else if (['createBill', 'billHistory', 'companyProfiles'].includes(currentView)) {
      setExpandedSections((prev) => ({ ...prev, billing: true }));
    } else if (currentView === 'reports') {
      setExpandedSections((prev) => ({ ...prev, reports: true }));
    }
  }, [currentView]);

  const toggleSection = (sectionKey: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const handleNavClick = (viewId: string, reportTab?: string) => {
    onSelectView(viewId, reportTab);
    if (window.innerWidth < 1024) {
      onClose();
    }
  };

  // Section items definition matching prompt exactly
  const accountsItems = [
    { id: 'saleProceeds', label: 'Sale Proceeds', icon: TrendingUp },
    { id: 'creditSales', label: 'Credit Sale', icon: ShoppingBag },
    { id: 'receipts', label: 'Receipt / Cash A/C', icon: CreditCard },
    { id: 'saleProceedsLedger', label: 'Sale Proceeds Ledger', icon: BookOpen },
    { id: 'customerLedger', label: 'Customer Ledger', icon: Users },
    { id: 'crateStatement', label: 'Crate Statement', icon: Box },
  ];

  const masterItems = [
    { id: 'customerDirectory', label: 'Customer Directory', icon: Users },
    { id: 'wholesaleDirectory', label: 'Wholesale Directory', icon: Building },
    { id: 'fruitMaster', label: 'Fruit / Item Master', icon: Apple },
    { id: 'trash', label: 'Trash / Recycle Bin', icon: Trash2 },
  ];

  const billingItems = [
    { id: 'groupSale', label: 'Group Sale', icon: TableProperties },
    { id: 'createBill', label: 'Create Bill', icon: FileText },
    { id: 'billHistory', label: 'Bill History', icon: History },
    { id: 'companyProfiles', label: 'Company Bill Profiles', icon: Building2 },
  ];

  const reportsItems = [
    { id: 'reports', tab: 'dailySales', label: 'Daily Sales', icon: Calendar },
    { id: 'reports', tab: 'customerOutstanding', label: 'Customer Outstanding', icon: Users },
    { id: 'reports', tab: 'vendorOutstanding', label: 'Vendor Outstanding', icon: Building },
    { id: 'reports', tab: 'expenses', label: 'Expense Report', icon: ReceiptText },
    { id: 'reports', tab: 'profit', label: 'Profit Report', icon: DollarSign },
    { id: 'reports', tab: 'crates', label: 'Crate Report', icon: Scale },
  ];

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden no-print"
        />
      )}

      {/* Vertical Menu Container fixed on upper/left */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 flex w-64 flex-col border-r border-slate-200 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-transform duration-200 ease-in-out lg:translate-x-0 no-print ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand Banner */}
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            {(() => {
              const defaultProfile = db.getCompanyProfiles().find((p) => p.isDefault) || db.getCompanyProfiles()[0];
              const customLogo = defaultProfile?.logo;
              return customLogo ? (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white p-0.5 shadow-xs shrink-0">
                  <img
                    src={customLogo}
                    alt="Company Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null;
            })()}
            <div>
              <div className="text-sm font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">
                Hari Kripa
              </div>
              <div className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 tracking-wider">
                Fruit ERP
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Vertical Scrollable Menu Body */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1 text-xs">
          {/* 1. Dashboard */}
          <button
            type="button"
            onClick={() => handleNavClick('dashboard')}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-semibold transition-all ${
              currentView === 'dashboard'
                ? 'bg-emerald-50 text-emerald-800 border-l-3 border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
            }`}
          >
            <Home className="h-4 w-4 shrink-0 text-slate-500" />
            <span className="flex-1 text-left">Dashboard</span>
          </button>

          {/* 2. Accounts (Dropdown) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => toggleSection('accounts')}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-bold text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {expandedSections.accounts ? (
                  <FolderOpen className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Folder className="h-4 w-4 text-slate-500" />
                )}
                <span>Accounts</span>
              </div>
              {expandedSections.accounts ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            {expandedSections.accounts && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5 mt-0.5">
                {accountsItems.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3. Master (Dropdown) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => toggleSection('master')}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-bold text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ClipboardList className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Master</span>
              </div>
              {expandedSections.master ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            {expandedSections.master && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5 mt-0.5">
                {masterItems.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4. Billing (Dropdown) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => toggleSection('billing')}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-bold text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <ReceiptText className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Billing</span>
              </div>
              {expandedSections.billing ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            {expandedSections.billing && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5 mt-0.5">
                {billingItems.map((item) => {
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleNavClick(item.id)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 5. Reports (Dropdown) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => toggleSection('reports')}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 font-bold text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <BarChart3 className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                <span>Reports</span>
              </div>
              {expandedSections.reports ? (
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              )}
            </button>

            {expandedSections.reports && (
              <div className="ml-4 pl-3 border-l border-slate-200 dark:border-slate-800 space-y-0.5 mt-0.5">
                {reportsItems.map((item) => {
                  const isActive = currentView === 'reports' && reportSubTab === item.tab;
                  return (
                    <button
                      key={item.tab}
                      type="button"
                      onClick={() => handleNavClick('reports', item.tab)}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 font-medium transition-all ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-700 font-semibold dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{item.label}</span>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* 6. Settings */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => handleNavClick('settings')}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-semibold transition-all ${
                currentView === 'settings'
                  ? 'bg-emerald-50 text-emerald-800 border-l-3 border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300'
                  : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/60 dark:hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4 shrink-0 text-slate-500" />
              <span className="flex-1 text-left">Settings</span>
            </button>
          </div>
        </nav>

        {/* Bottom Status / Firm Tag */}
        <div className="border-t border-slate-200 p-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-900/60 shrink-0">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Main Mandi Firm:</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">Hari Kripa</span>
          </div>
        </div>
      </aside>
    </>
  );
};
