import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { formatCurrency } from '../../utils/formatters';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import {
  Home,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  BookOpen,
  Users,
  Box,
  Building,
  Apple,
  FileText,
  History,
  Building2,
  Calendar,
  ReceiptText,
  DollarSign,
  Scale,
  Settings,
  Sliders,
  BarChart3,
  ChevronDown,
  Menu,
  X,
  Search,
  Bell,
  LogOut,
  ShieldCheck,
  Package,
  Layers,
  Check,
  TableProperties,
  Sun,
  Moon,
  Banknote,
  Trash2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface TopNavbarProps {
  currentView: string;
  reportSubTab?: string;
  settingsSubTab?: string;
  onNavigate: (view: string, subParam?: string) => void;
  onLogout: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  currentView,
  reportSubTab = 'dailySales',
  settingsSubTab = 'general',
  onNavigate,
  onLogout,
}) => {
  const { isDarkMode, toggleTheme } = useTheme();

  // Desktop dropdown state: which top menu is currently open ('accounts' | 'master' | 'billing' | 'reports' | 'settings' | null)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  // Mobile menu drawer state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileExpandedSection, setMobileExpandedSection] = useState<{ [key: string]: boolean }>({
    accounts: true,
    master: false,
    billing: false,
    reports: false,
    settings: false,
  });

  // Header popovers
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentUser = db.getActiveUser();
  const defaultProfile = db.getCompanyProfiles().find((p) => p.isDefault) || db.getCompanyProfiles()[0];
  const customLogo = defaultProfile?.logo;
  const recentProceeds = db.getSaleProceeds().slice(-2).reverse();
  const recentCreditSales = db.getCreditSales().slice(-2).reverse();
  const recentReceipts = db.getReceipts().slice(-2).reverse();

  // Close desktop dropdowns & popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Parent active detection
  const isAccountsActive = [
    'saleProceeds',
    'cashSales',
    'creditSales',
    'receipts',
    'saleProceedsLedger',
    'customerLedger',
    'crateStatement',
  ].includes(currentView);

  const isMasterActive = ['customerDirectory', 'wholesaleDirectory', 'fruitMaster'].includes(
    currentView
  );

  const isBillingActive = ['groupSale', 'createBill', 'billHistory', 'companyProfiles'].includes(currentView);

  const isReportsActive = currentView === 'reports';

  const isSettingsActive = currentView === 'settings';

  const handleSelectPage = (view: string, subParam?: string) => {
    setOpenDropdown(null);
    setMobileMenuOpen(false);
    onNavigate(view, subParam);
  };

  const toggleDropdown = (name: string) => {
    setOpenDropdown((prev) => (prev === name ? null : name));
  };

  const toggleMobileSection = (key: string) => {
    setMobileExpandedSection((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return (
    <>
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs no-print">
        {/* ROW 1: Brand & Top Utilities Header */}
        <div className="flex h-14 items-center justify-between px-4 sm:px-6 lg:px-8 border-b border-slate-100">
          {/* Left: Mobile hamburger & Brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="neu-btn lg:hidden p-2 text-slate-700 hover:text-slate-900 transition-colors"
              title="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => handleSelectPage('dashboard')}
              className="flex items-center gap-3 text-left group transition-transform active:scale-98"
            >
              {customLogo && (
                <img
                  src={customLogo}
                  alt="Business Logo"
                  className="h-10 sm:h-11 w-auto max-w-[140px] sm:max-w-[160px] object-contain select-none shrink-0"
                />
              )}
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-sm tracking-tight text-slate-900 uppercase leading-none font-sans">
                    Hari Kripa
                  </span>
                  <span className="font-extrabold text-xs text-emerald-600 uppercase leading-none">
                    Fruit ERP
                  </span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium tracking-wide">
                  Wholesale Mandi Accounting
                </span>
              </div>
            </button>
          </div>

          {/* Right: Search, Notifications, Profile, Logout */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search */}
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="neu-inset-sm flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:text-slate-900 transition-all cursor-pointer"
              title="Search ERP (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5 text-slate-400" />
              <span className="hidden md:inline font-medium">Search...</span>
              <kbd className="hidden md:inline rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 shadow-2xs">
                /
              </kbd>
            </button>

            {/* Dark Mode / Light Mode Toggle Button */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              className="neu-btn flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold cursor-pointer transition-all"
            >
              {isDarkMode ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="hidden sm:inline">Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-600 shrink-0" />
                  <span className="hidden sm:inline">Dark Mode</span>
                </>
              )}
            </button>

            {/* Notifications Feed */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setIsNotificationsOpen(!isNotificationsOpen);
                  setIsProfileOpen(false);
                  setOpenDropdown(null);
                }}
                className={`neu-btn relative p-2 text-slate-600 hover:text-slate-900 ${isNotificationsOpen ? 'neu-btn-active' : ''}`}
                title="Recent Mandi Activity"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </button>

              {isNotificationsOpen && (
                <div className="neu-dropdown absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-80 p-3.5 z-50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-2">
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Recent Activity
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold">Live Feed</span>
                  </div>

                  <div className="space-y-2 text-xs">
                    {recentReceipts.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => {
                          handleSelectPage('receipts');
                          setIsNotificationsOpen(false);
                        }}
                        className="neu-inset-sm cursor-pointer flex items-start gap-2 p-2 hover:bg-white/40 transition-colors"
                      >
                        <CreditCard className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            {r.receiptNo} received
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {r.customerName} · {formatCurrency(r.amount)}
                          </div>
                        </div>
                      </div>
                    ))}

                    {recentCreditSales.map((cs) => (
                      <div
                        key={cs.id}
                        onClick={() => {
                          handleSelectPage('creditSales');
                          setIsNotificationsOpen(false);
                        }}
                        className="neu-inset-sm cursor-pointer flex items-start gap-2 p-2 hover:bg-white/40 transition-colors"
                      >
                        <ShoppingBag className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            {cs.creditSaleNo} posted
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {cs.customerName} · {formatCurrency(cs.finalAmount)}
                          </div>
                        </div>
                      </div>
                    ))}

                    {recentProceeds.map((sp) => (
                      <div
                        key={sp.id}
                        onClick={() => {
                          handleSelectPage('saleProceeds');
                          setIsNotificationsOpen(false);
                        }}
                        className="neu-inset-sm cursor-pointer flex items-start gap-2 p-2 hover:bg-white/40 transition-colors"
                      >
                        <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-slate-800">
                            {sp.proceedsNo}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Qty: {sp.quantity} · Net: {formatCurrency(sp.netAmount)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Popover */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(!isProfileOpen);
                  setIsNotificationsOpen(false);
                  setOpenDropdown(null);
                }}
                className={`neu-btn flex items-center gap-2 rounded-xl p-1.5 transition-all ${isProfileOpen ? 'neu-btn-active' : ''}`}
                title="User Profile"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-xs">
                  {currentUser?.name?.charAt(0) || 'H'}
                </div>
                <div className="hidden sm:block text-left pr-1">
                  <span className="block text-xs font-bold text-slate-800 leading-none">
                    {currentUser?.name || 'Mandi Admin'}
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">
                    Accountant
                  </span>
                </div>
              </button>

              {isProfileOpen && (
                <div className="neu-dropdown absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:w-64 p-4 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                  <div className="flex items-center gap-3 border-b border-slate-200 pb-3 mb-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-sm shadow-sm">
                      {currentUser?.name?.charAt(0) || 'H'}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">
                        {currentUser?.name || 'Mandi Admin'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        User: <strong>admin</strong>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                    <div className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <ShieldCheck className="h-4 w-4" /> Full ERP Accounting Access
                    </div>
                    <div>
                      Firm: <strong>Hari Kripa</strong>
                    </div>
                    <div>Role: Master Mandi Accountant</div>
                  </div>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="neu-btn-danger flex w-full items-center justify-center gap-2 py-2 text-xs font-semibold"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Log Out
                  </button>
                </div>
              )}
            </div>

            {/* Logout shortcut */}
            <button
              type="button"
              onClick={onLogout}
              title="Log Out"
              className="neu-btn flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-600 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-rose-500" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        {/* ROW 2: Desktop Horizontal Navigation Bar */}
        <div ref={navRef} className="hidden lg:block bg-slate-50/90 border-t border-slate-100 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <nav className="flex items-center space-x-1.5 py-1.5 text-xs">
              {/* 1. Dashboard Link */}
              <button
                type="button"
                onClick={() => handleSelectPage('dashboard')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentView === 'dashboard'
                    ? 'neu-nav-active'
                    : 'neu-btn text-slate-700 hover:text-slate-900'
                }`}
              >
                <Home className="h-4 w-4 text-emerald-600" />
                <span>Dashboard</span>
              </button>

              {/* Group Sale Button (Prominent direct module) */}
              <button
                type="button"
                onClick={() => handleSelectPage('groupSale')}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                  currentView === 'groupSale'
                    ? 'neu-nav-active'
                    : 'neu-btn text-slate-700 hover:text-slate-900'
                }`}
              >
                <TableProperties className="h-4 w-4 text-blue-600" />
                <span>Group Sale</span>
              </button>

              <div className="h-4 w-[1px] bg-slate-300/60 mx-1" />

              {/* 2. Accounts ▼ Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('accounts')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isAccountsActive
                      ? 'neu-nav-active'
                      : openDropdown === 'accounts'
                      ? 'neu-btn-active text-slate-900'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <TrendingUp className="h-4 w-4 text-emerald-600" />
                  <span>Accounts</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openDropdown === 'accounts' ? 'rotate-180 text-blue-600' : 'text-slate-500'
                    }`}
                  />
                </button>

                {openDropdown === 'accounts' && (
                  <div className="neu-dropdown absolute top-full left-0 mt-2 w-64 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/40 mb-1">
                      Accounts Modules
                    </div>
                    {[
                      { id: 'saleProceeds', label: 'Sale Proceeds', icon: TrendingUp },
                      { id: 'cashSales', label: 'Cash Sale', icon: Banknote },
                      { id: 'creditSales', label: 'Credit Sale', icon: ShoppingBag },
                      { id: 'receipts', label: 'Receipt / Cash A/C', icon: CreditCard },
                      { id: 'saleProceedsLedger', label: 'Sale Proceeds Ledger', icon: BookOpen },
                      { id: 'customerLedger', label: 'Customer Ledger', icon: Users },
                      { id: 'crateStatement', label: 'Crate Statement', icon: Box },
                    ].map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPage(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'neu-inset text-blue-600 font-bold'
                              : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 ${
                                isActive ? 'text-blue-600' : 'text-slate-500'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Master ▼ Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('master')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isMasterActive
                      ? 'neu-nav-active'
                      : openDropdown === 'master'
                      ? 'neu-btn-active text-slate-900'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Package className="h-4 w-4 text-emerald-600" />
                  <span>Master</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openDropdown === 'master' ? 'rotate-180 text-blue-600' : 'text-slate-500'
                    }`}
                  />
                </button>

                {openDropdown === 'master' && (
                  <div className="neu-dropdown absolute top-full left-0 mt-2 w-60 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/40 mb-1">
                      Directory & Master Records
                    </div>
                    {[
                      { id: 'customerDirectory', label: 'Customer Directory', icon: Users },
                      { id: 'wholesaleDirectory', label: 'Wholesale Directory', icon: Building },
                      { id: 'fruitMaster', label: 'Fruit / Item Master', icon: Apple },
                      { id: 'trash', label: 'Trash / Recycle Bin', icon: Trash2 },
                    ].map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPage(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'neu-inset text-blue-600 font-bold'
                              : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 ${
                                isActive ? 'text-blue-600' : 'text-slate-500'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 4. Billing ▼ Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('billing')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isBillingActive
                      ? 'neu-nav-active'
                      : openDropdown === 'billing'
                      ? 'neu-btn-active text-slate-900'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <ReceiptText className="h-4 w-4 text-emerald-600" />
                  <span>Billing</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openDropdown === 'billing' ? 'rotate-180 text-blue-600' : 'text-slate-500'
                    }`}
                  />
                </button>

                {openDropdown === 'billing' && (
                  <div className="neu-dropdown absolute top-full left-0 mt-2 w-64 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/40 mb-1">
                      Billing & Invoicing
                    </div>
                    {[
                      { id: 'groupSale', label: 'Group Sale (Daily Grid)', icon: TableProperties },
                      { id: 'createBill', label: 'Create Bill', icon: FileText },
                      { id: 'billHistory', label: 'Bill History', icon: History },
                      { id: 'companyProfiles', label: 'Company Bill Profiles', icon: Building2 },
                    ].map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPage(item.id)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'neu-inset text-blue-600 font-bold'
                              : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 ${
                                isActive ? 'text-blue-600' : 'text-slate-500'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 5. Reports ▼ Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('reports')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isReportsActive
                      ? 'neu-nav-active'
                      : openDropdown === 'reports'
                      ? 'neu-btn-active text-slate-900'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <BarChart3 className="h-4 w-4 text-emerald-600" />
                  <span>Reports</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openDropdown === 'reports' ? 'rotate-180 text-blue-600' : 'text-slate-500'
                    }`}
                  />
                </button>

                {openDropdown === 'reports' && (
                  <div className="neu-dropdown absolute top-full left-0 mt-2 w-64 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/40 mb-1">
                      Accounting Reports
                    </div>
                    {[
                      { tab: 'dailySales', label: 'Daily Sales', icon: Calendar },
                      { tab: 'customerOutstanding', label: 'Customer Outstanding', icon: Users },
                      { tab: 'vendorOutstanding', label: 'Vendor Outstanding', icon: Building },
                      { tab: 'expenses', label: 'Expense Report', icon: ReceiptText },
                      { tab: 'profit', label: 'Profit Report', icon: DollarSign },
                      { tab: 'crates', label: 'Crate Report', icon: Scale },
                    ].map((item) => {
                      const isActive = currentView === 'reports' && reportSubTab === item.tab;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.tab}
                          type="button"
                          onClick={() => handleSelectPage('reports', item.tab)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'neu-inset text-blue-600 font-bold'
                              : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 ${
                                isActive ? 'text-blue-600' : 'text-slate-500'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 6. Settings ▼ Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => toggleDropdown('settings')}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isSettingsActive
                      ? 'neu-nav-active'
                      : openDropdown === 'settings'
                      ? 'neu-btn-active text-slate-900'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <Settings className="h-4 w-4 text-emerald-600" />
                  <span>Settings</span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      openDropdown === 'settings' ? 'rotate-180 text-blue-600' : 'text-slate-500'
                    }`}
                  />
                </button>

                {openDropdown === 'settings' && (
                  <div className="neu-dropdown absolute top-full left-0 mt-2 w-64 p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-300/40 mb-1">
                      System Configuration
                    </div>
                    {[
                      {
                        view: 'companyProfiles',
                        subParam: undefined,
                        label: 'Company / Bill Profiles',
                        icon: Building2,
                      },
                      {
                        view: 'settings',
                        subParam: 'units',
                        label: 'Units',
                        icon: Scale,
                      },
                      {
                        view: 'settings',
                        subParam: 'crates',
                        label: 'Crate Types',
                        icon: Box,
                      },
                      {
                        view: 'settings',
                        subParam: 'general',
                        label: 'General Settings',
                        icon: Sliders,
                      },
                    ].map((item) => {
                      const isActive =
                        item.view === 'companyProfiles'
                          ? currentView === 'companyProfiles'
                          : currentView === 'settings' && settingsSubTab === item.subParam;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleSelectPage(item.view, item.subParam)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                            isActive
                              ? 'neu-inset text-blue-600 font-bold'
                              : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 ${
                                isActive ? 'text-blue-600' : 'text-slate-500'
                              }`}
                            />
                            <span>{item.label}</span>
                          </div>
                          {isActive && <Check className="h-3.5 w-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>
        </div>
      </header>

      {/* MOBILE RESPONSIVE DRAWER */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop overlay */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Drawer Sheet */}
          <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col z-50 border-r border-slate-200 animate-in slide-in-from-left duration-200">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-white">
              <div className="flex items-center gap-2.5">
                {customLogo && (
                  <img
                    src={customLogo}
                    alt="Business Logo"
                    className="h-10 w-auto object-contain select-none shrink-0"
                  />
                )}
                <div>
                  <h2 className="text-sm font-bold text-slate-900 leading-none">
                    HARI KRIPA
                  </h2>
                  <span className="text-[10px] text-emerald-600 font-semibold">Fruit ERP</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="neu-btn p-1.5 text-slate-600 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Drawer Navigation List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 text-xs">
              {/* Dashboard */}
              <button
                type="button"
                onClick={() => handleSelectPage('dashboard')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-all ${
                  currentView === 'dashboard'
                    ? 'neu-nav-active'
                    : 'neu-btn text-slate-700 hover:text-slate-900'
                }`}
              >
                <Home className="h-4 w-4 text-emerald-600" />
                <span>Dashboard</span>
              </button>

              {/* Group Sale Direct Link */}
              <button
                type="button"
                onClick={() => handleSelectPage('groupSale')}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl font-bold transition-all ${
                  currentView === 'groupSale'
                    ? 'neu-nav-active'
                    : 'neu-btn text-slate-700 hover:text-slate-900'
                }`}
              >
                <TableProperties className="h-4 w-4 text-blue-600" />
                <span>Group Sale (Daily Grid)</span>
              </button>

              {/* Accounts Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('accounts')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                    isAccountsActive
                      ? 'neu-nav-active'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <TrendingUp className="h-4 w-4 text-emerald-600" />
                    <span>Accounts</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      mobileExpandedSection.accounts ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection.accounts && (
                  <div className="pl-3 pr-1 py-1.5 space-y-1 ml-2 mt-1">
                    {[
                      { id: 'saleProceeds', label: 'Sale Proceeds', icon: TrendingUp },
                      { id: 'cashSales', label: 'Cash Sale', icon: Banknote },
                      { id: 'creditSales', label: 'Credit Sale', icon: ShoppingBag },
                      { id: 'receipts', label: 'Receipt / Cash A/C', icon: CreditCard },
                      { id: 'saleProceedsLedger', label: 'Sale Proceeds Ledger', icon: BookOpen },
                      { id: 'customerLedger', label: 'Customer Ledger', icon: Users },
                      { id: 'crateStatement', label: 'Crate Statement', icon: Box },
                    ].map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPage(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Master Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('master')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                    isMasterActive
                      ? 'neu-nav-active'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Package className="h-4 w-4 text-emerald-600" />
                    <span>Master</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      mobileExpandedSection.master ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection.master && (
                  <div className="pl-3 pr-1 py-1.5 space-y-1 ml-2 mt-1">
                    {[
                      { id: 'customerDirectory', label: 'Customer Directory', icon: Users },
                      { id: 'wholesaleDirectory', label: 'Wholesale Directory', icon: Building },
                      { id: 'fruitMaster', label: 'Fruit / Item Master', icon: Apple },
                      { id: 'trash', label: 'Trash / Recycle Bin', icon: Trash2 },
                    ].map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPage(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Billing Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('billing')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                    isBillingActive
                      ? 'neu-nav-active'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <ReceiptText className="h-4 w-4 text-emerald-600" />
                    <span>Billing</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      mobileExpandedSection.billing ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection.billing && (
                  <div className="pl-3 pr-1 py-1.5 space-y-1 ml-2 mt-1">
                    {[
                      { id: 'groupSale', label: 'Group Sale', icon: TableProperties },
                      { id: 'createBill', label: 'Create Bill', icon: FileText },
                      { id: 'billHistory', label: 'Bill History', icon: History },
                      { id: 'companyProfiles', label: 'Company Bill Profiles', icon: Building2 },
                    ].map((item) => {
                      const isActive = currentView === item.id;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectPage(item.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Reports Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('reports')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                    isReportsActive
                      ? 'neu-nav-active'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="h-4 w-4 text-emerald-600" />
                    <span>Reports</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      mobileExpandedSection.reports ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection.reports && (
                  <div className="pl-3 pr-1 py-1.5 space-y-1 ml-2 mt-1">
                    {[
                      { tab: 'dailySales', label: 'Daily Sales', icon: Calendar },
                      { tab: 'customerOutstanding', label: 'Customer Outstanding', icon: Users },
                      { tab: 'vendorOutstanding', label: 'Vendor Outstanding', icon: Building },
                      { tab: 'expenses', label: 'Expense Report', icon: ReceiptText },
                      { tab: 'profit', label: 'Profit Report', icon: DollarSign },
                      { tab: 'crates', label: 'Crate Report', icon: Scale },
                    ].map((item) => {
                      const isActive = currentView === 'reports' && reportSubTab === item.tab;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.tab}
                          type="button"
                          onClick={() => handleSelectPage('reports', item.tab)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Settings Accordion */}
              <div>
                <button
                  type="button"
                  onClick={() => toggleMobileSection('settings')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold transition-all ${
                    isSettingsActive
                      ? 'neu-nav-active'
                      : 'neu-btn text-slate-700 hover:text-slate-900'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="h-4 w-4 text-emerald-600" />
                    <span>Settings</span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      mobileExpandedSection.settings ? 'rotate-180 text-blue-600' : ''
                    }`}
                  />
                </button>
                {mobileExpandedSection.settings && (
                  <div className="pl-3 pr-1 py-1.5 space-y-1 ml-2 mt-1">
                    {[
                      {
                        view: 'companyProfiles',
                        subParam: undefined,
                        label: 'Company / Bill Profiles',
                        icon: Building2,
                      },
                      {
                        view: 'settings',
                        subParam: 'units',
                        label: 'Units',
                        icon: Scale,
                      },
                      {
                        view: 'settings',
                        subParam: 'crates',
                        label: 'Crate Types',
                        icon: Box,
                      },
                      {
                        view: 'settings',
                        subParam: 'general',
                        label: 'General Settings',
                        icon: Sliders,
                      },
                    ].map((item) => {
                      const isActive =
                        item.view === 'companyProfiles'
                          ? currentView === 'companyProfiles'
                          : currentView === 'settings' && settingsSubTab === item.subParam;
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => handleSelectPage(item.view, item.subParam)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg font-medium transition-all ${
                            isActive
                              ? 'bg-blue-50 text-blue-700 font-bold border border-blue-200'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                          <span>{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Drawer Footer with User & Logout */}
            <div className="border-t border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-xs shadow-xs">
                    {currentUser?.name?.charAt(0) || 'H'}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 leading-none">
                      {currentUser?.name || 'Mandi Admin'}
                    </div>
                    <div className="text-[10px] text-slate-500">Master Accountant</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={toggleTheme}
                    aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    className="neu-btn p-2 text-slate-700 hover:text-slate-900"
                  >
                    {isDarkMode ? (
                      <Sun className="h-4 w-4 text-amber-400" />
                    ) : (
                      <Moon className="h-4 w-4 text-slate-600" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={onLogout}
                    className="neu-btn p-2 text-rose-600 hover:text-rose-700"
                    title="Logout"
                  >
                    <LogOut className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(view, id) => handleSelectPage(view, id)}
      />
    </>
  );
};
