import React, { useState, useRef, useEffect } from 'react';
import { db } from '../../services/db';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { GlobalSearchModal } from '../common/GlobalSearchModal';
import {
  Menu,
  Search,
  Bell,
  User as UserIcon,
  LogOut,
  CheckCircle,
  Apple,
  X,
  TrendingUp,
  ShoppingBag,
  CreditCard,
  ShieldCheck,
} from 'lucide-react';

interface HeaderProps {
  currentView: string;
  onOpenSidebar: () => void;
  onNavigate: (view: string, id?: string) => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenSidebar,
  onNavigate,
  onLogout,
}) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const currentUser = db.getActiveUser();
  const recentProceeds = db.getSaleProceeds().slice(-2).reverse();
  const recentCreditSales = db.getCreditSales().slice(-2).reverse();
  const recentReceipts = db.getReceipts().slice(-2).reverse();

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-xs dark:border-slate-800 dark:bg-slate-900/95 no-print shadow-2xs">
        {/* Left Area: Hamburger (Mobile) + Application Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onOpenSidebar}
            title="Open Menu"
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:hidden dark:hover:bg-slate-800"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2.5">
            {(() => {
              const defaultProfile = db.getCompanyProfiles().find((p) => p.isDefault) || db.getCompanyProfiles()[0];
              const customLogo = defaultProfile?.logo;
              return customLogo ? (
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white p-0.5 shadow-xs shrink-0">
                  <img
                    src={customLogo}
                    alt="Company Logo"
                    className="h-full w-full object-contain"
                  />
                </div>
              ) : null;
            })()}
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Hari Kripa Fruit ERP
              </h1>
              {(() => {
                const defaultProfile = db.getCompanyProfiles().find((p) => p.isDefault) || db.getCompanyProfiles()[0];
                return defaultProfile?.hindiName ? (
                  <span className="hidden md:inline-block text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-devanagari">
                    ({defaultProfile.hindiName})
                  </span>
                ) : null;
              })()}
              <span className="hidden sm:inline-block text-slate-300 dark:text-slate-700">|</span>
              <span className="hidden sm:inline-block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Mandi Accounting
              </span>
            </div>
          </div>
        </div>

        {/* Right Area: Search, Notifications, User/Profile, Logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 1. Search */}
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
            title="Search ERP (Ctrl+K)"
          >
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden md:inline font-medium">Search records...</span>
            <kbd className="hidden md:inline rounded bg-white px-1.5 py-0.5 text-[10px] font-mono text-slate-400 border border-slate-200 dark:bg-slate-900 dark:border-slate-700">
              /
            </kbd>
          </button>

          {/* 2. Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setIsNotificationsOpen(!isNotificationsOpen);
                setIsProfileOpen(false);
              }}
              title="Notifications"
              className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </button>

            {/* Notifications Dropdown Popover */}
            {isNotificationsOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2 dark:border-slate-800">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Recent Activity
                  </span>
                  <span className="text-[10px] text-emerald-600 font-semibold">Live Feed</span>
                </div>

                <div className="space-y-2 text-xs">
                  {recentReceipts.map((r) => (
                    <div
                      key={r.id}
                      onClick={() => {
                        onNavigate('receipts');
                        setIsNotificationsOpen(false);
                      }}
                      className="cursor-pointer flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <CreditCard className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
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
                        onNavigate('creditSales');
                        setIsNotificationsOpen(false);
                      }}
                      className="cursor-pointer flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <ShoppingBag className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
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
                        onNavigate('saleProceeds');
                        setIsNotificationsOpen(false);
                      }}
                      className="cursor-pointer flex items-start gap-2 p-1.5 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <TrendingUp className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-semibold text-slate-800 dark:text-slate-200">
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

          {/* 3. User / Profile */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setIsProfileOpen(!isProfileOpen);
                setIsNotificationsOpen(false);
              }}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="User Profile"
            >
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-xs shadow-2xs">
                A
              </div>
              <div className="hidden sm:block text-left">
                <span className="block text-xs font-bold text-slate-800 dark:text-slate-200 leading-none">
                  {currentUser?.name || 'Mandi Admin'}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  Accountant
                </span>
              </div>
            </button>

            {/* Profile Popover */}
            {isProfileOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-slate-800 dark:bg-slate-900 z-50">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-3 mb-3 dark:border-slate-800">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white font-bold text-sm">
                    A
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                      {currentUser?.name || 'Mandi Admin'}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      User: <strong>admin</strong>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400 mb-3">
                  <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium">
                    <ShieldCheck className="h-4 w-4" /> Full ERP Accounting Access
                  </div>
                  <div>Firm: <strong>Hari Kripa</strong></div>
                  <div>Role: Master Mandi Accountant</div>
                </div>

                <button
                  type="button"
                  onClick={onLogout}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-rose-50 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" /> Log Out
                </button>
              </div>
            )}
          </div>

          {/* 4. Direct Logout button */}
          <button
            type="button"
            onClick={onLogout}
            title="Log Out of Accounting Session"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-rose-950/30 dark:hover:text-rose-400 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectResult={(view, id) => onNavigate(view, id)}
      />
    </>
  );
};
