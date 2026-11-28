import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { db } from './services/db';
import { userAuthClient } from './services/userAuthClient';
import { devAuthClient } from './services/devAuthClient';
import { Bill, SaleProceeds, User } from './types';
import { TopNavbar } from './components/layout/TopNavbar';
import { LoginView } from './components/auth/LoginView';
import { DashboardView } from './components/dashboard/DashboardView';
import { SaleProceedsListView } from './components/accounts/SaleProceedsListView';
import { CashSaleListView } from './components/accounts/CashSaleListView';
import { CreditSaleListView } from './components/accounts/CreditSaleListView';
import { ReceiptListView } from './components/accounts/ReceiptListView';
import { SaleProceedsLedgerView } from './components/accounts/SaleProceedsLedgerView';
import { CustomerLedgerView } from './components/accounts/CustomerLedgerView';
import { CrateStatementView } from './components/accounts/CrateStatementView';
import { CustomerDirectoryView } from './components/master/CustomerDirectoryView';
import { WholesaleDirectoryView } from './components/master/WholesaleDirectoryView';
import { FruitMasterView } from './components/master/FruitMasterView';
import { TrashView } from './components/master/TrashView';
import { GroupSaleView } from './components/billing/GroupSaleView';
import { CreateBillView } from './components/billing/CreateBillView';
import { BillHistoryView } from './components/billing/BillHistoryView';
import { CompanyBillProfilesView } from './components/billing/CompanyBillProfilesView';
import { ReportsView } from './components/reports/ReportsView';
import { SettingsView } from './components/settings/SettingsView';
import { initDisableNumberInputScroll } from './utils/disableNumberInputScroll';

function AppContent() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => db.getActiveUser());
  const [currentView, setCurrentView] = useState<string>('dashboard');
  const [reportSubTab, setReportSubTab] = useState<
    'dailySales' | 'customerOutstanding' | 'vendorOutstanding' | 'expenses' | 'profit' | 'crates'
  >('dailySales');
  const [settingsSubTab, setSettingsSubTab] = useState<
    'general' | 'profiles' | 'units' | 'crates' | 'backup' | 'users'
  >('general');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | undefined>(undefined);
  const [selectedSaleProceedsCustomerId, setSelectedSaleProceedsCustomerId] = useState<string | undefined>(undefined);
  const [ledgerReturnToReports, setLedgerReturnToReports] = useState<boolean>(false);
  const [dashboardVisitKey, setDashboardVisitKey] = useState<number>(0);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [sourceProceedsForBill, setSourceProceedsForBill] = useState<SaleProceeds | null>(null);

  useEffect(() => {
    const cleanupScroll = initDisableNumberInputScroll();
    const unsubscribe = db.subscribe(() => {
      setCurrentUser(db.getActiveUser());
    });
    return () => {
      cleanupScroll();
      unsubscribe();
    };
  }, []);

  // Verify backend session integrity on boot, view navigation, and focus so invalidated sessions log out immediately
  useEffect(() => {
    if (!currentUser) return;
    let cancelled = false;
    const verify = () => {
      void userAuthClient.verifySession().then((res) => {
        if (!cancelled && !res.authenticated) {
          db.setActiveUser(null);
          setCurrentUser(null);
        }
      });
    };
    verify();
    window.addEventListener('focus', verify);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', verify);
    };
  }, [currentUser?.id, currentUser?.role, currentView]);

  const handleLogout = () => {
    devAuthClient.clearClientToken();
    void userAuthClient.logout();
    db.setActiveUser(null);
    setLedgerReturnToReports(false);
    setDashboardVisitKey((k) => k + 1);
    setCurrentView('dashboard');
    setCurrentUser(null);
  };

  const handleNavigate = (view: string, subParam?: string) => {
    setLedgerReturnToReports(false);
    if (view === 'dashboard') {
      setDashboardVisitKey((k) => k + 1);
      setCurrentView('dashboard');
      return;
    }

    if (view === 'reports') {
      setCurrentView('reports');
      if (
        subParam &&
        ['dailySales', 'customerOutstanding', 'vendorOutstanding', 'expenses', 'profit', 'crates'].includes(
          subParam
        )
      ) {
        setReportSubTab(
          subParam as 'dailySales' | 'customerOutstanding' | 'vendorOutstanding' | 'expenses' | 'profit' | 'crates'
        );
      }
      return;
    }

    if (view === 'settings') {
      setCurrentView('settings');
      if (subParam && ['general', 'profiles', 'units', 'crates', 'backup', 'users'].includes(subParam)) {
        if (subParam === 'users' && currentUser?.role !== 'admin') {
          setSettingsSubTab('general');
        } else {
          setSettingsSubTab(subParam as 'general' | 'profiles' | 'units' | 'crates' | 'backup' | 'users');
        }
      } else if (settingsSubTab === 'users' && currentUser?.role !== 'admin') {
        setSettingsSubTab('general');
      }
      return;
    }

    if (view === 'customerLedger' || view === 'crateStatement') {
      if (subParam) {
        setSelectedCustomerId(subParam);
      }
      setCurrentView(view);
      return;
    }

    if (view === 'saleProceedsLedger') {
      if (subParam !== undefined) {
        setSelectedSaleProceedsCustomerId(subParam || undefined);
      }
      setCurrentView('saleProceedsLedger');
      return;
    }

    if (view === 'createBill') {
      setEditingBill(null);
      setSourceProceedsForBill(null);
      setCurrentView('createBill');
      return;
    }

    setCurrentView(view);
  };

  if (!currentUser) {
    return (
      <LoginView
        onLoginSuccess={(user) => {
          setLedgerReturnToReports(false);
          setDashboardVisitKey((k) => k + 1);
          setCurrentUser(user);
          setCurrentView('dashboard');
        }}
      />
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView key={dashboardVisitKey} onNavigate={handleNavigate} />;
      case 'saleProceeds':
        return (
          <SaleProceedsListView
            onNavigateToCreateBill={(sp) => {
              setEditingBill(null);
              setSourceProceedsForBill(sp);
              setCurrentView('createBill');
            }}
            onNavigateToCustomerLedger={(cId) => {
              setSelectedSaleProceedsCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('saleProceedsLedger');
            }}
          />
        );
      case 'cashSales':
        return (
          <CashSaleListView
            onNavigateToCustomerLedger={(cId) => {
              setSelectedCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('customerLedger');
            }}
          />
        );
      case 'creditSales':
        return (
          <CreditSaleListView
            onNavigateToCustomerLedger={(cId) => {
              setSelectedCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('customerLedger');
            }}
          />
        );
      case 'receipts':
        return (
          <ReceiptListView
            onNavigateToCustomerLedger={(cId) => {
              setSelectedCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('customerLedger');
            }}
          />
        );
      case 'saleProceedsLedger':
        return <SaleProceedsLedgerView initialCustomerId={selectedSaleProceedsCustomerId} />;
      case 'customerLedger':
        return (
          <CustomerLedgerView
            initialCustomerId={selectedCustomerId}
            onNavigateToCrate={(cId) => {
              setSelectedCustomerId(cId);
              setCurrentView('crateStatement');
            }}
            onBackToReports={
              ledgerReturnToReports
                ? () => {
                    setLedgerReturnToReports(false);
                    setCurrentView('reports');
                  }
                : undefined
            }
          />
        );
      case 'crateStatement':
        return <CrateStatementView initialCustomerId={selectedCustomerId} />;
      case 'customerDirectory':
        return (
          <CustomerDirectoryView
            onNavigateToLedger={(cId) => {
              setSelectedCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('customerLedger');
            }}
            onNavigateToSaleProceedsLedger={(cId) => {
              setSelectedSaleProceedsCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('saleProceedsLedger');
            }}
            onNavigateToCrate={(cId) => {
              setSelectedCustomerId(cId);
              setCurrentView('crateStatement');
            }}
            onNavigateToCreditSales={(cId) => {
              setSelectedCustomerId(cId);
              setCurrentView('creditSales');
            }}
            onNavigateToReceipts={(cId) => {
              setSelectedCustomerId(cId);
              setCurrentView('receipts');
            }}
          />
        );
      case 'wholesaleDirectory':
        return <WholesaleDirectoryView />;
      case 'fruitMaster':
        return <FruitMasterView />;
      case 'trash':
        return (
          <TrashView
            onNavigateToCustomerLedger={(cId) => {
              setSelectedCustomerId(cId);
              setLedgerReturnToReports(false);
              setCurrentView('customerLedger');
            }}
          />
        );
      case 'groupSale':
        return <GroupSaleView />;
      case 'createBill':
        return (
          <CreateBillView
            editBill={editingBill}
            sourceProceeds={sourceProceedsForBill}
            onSaved={() => {
              setEditingBill(null);
              setSourceProceedsForBill(null);
              setCurrentView('billHistory');
            }}
            onNavigateToHistory={() => {
              setEditingBill(null);
              setSourceProceedsForBill(null);
              setCurrentView('billHistory');
            }}
          />
        );
      case 'billHistory':
        return (
          <BillHistoryView
            onCreateNewBill={() => {
              setEditingBill(null);
              setCurrentView('createBill');
            }}
            onEditBill={(bill) => {
              setEditingBill(bill);
              setCurrentView('createBill');
            }}
          />
        );
      case 'companyProfiles':
        return <CompanyBillProfilesView />;
      case 'reports':
        return (
          <ReportsView
            initialTab={reportSubTab}
            onTabChange={(tab) => setReportSubTab(tab)}
            onNavigateToCustomerLedger={(cId) => {
              setSelectedCustomerId(cId);
              setLedgerReturnToReports(true);
              setCurrentView('customerLedger');
            }}
          />
        );
      case 'settings':
        return <SettingsView initialTab={settingsSubTab} />;
      default:
        return <DashboardView key={dashboardVisitKey} onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="erp-app-shell min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-[#0b1120] dark:text-slate-100 flex flex-col">
      <TopNavbar
        currentView={currentView}
        reportSubTab={reportSubTab}
        settingsSubTab={settingsSubTab}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
      />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderView()}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
