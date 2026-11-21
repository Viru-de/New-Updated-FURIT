import fs from 'fs';
import path from 'path';
import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { PrintBusinessHeader } from '../src/components/common/PrintBusinessHeader';
import { DashboardView } from '../src/components/dashboard/DashboardView';
import { ReportsView } from '../src/components/reports/ReportsView';
import { TopNavbar } from '../src/components/layout/TopNavbar';
import { Header } from '../src/components/layout/Header';
import { Sidebar } from '../src/components/layout/Sidebar';
import { LoginView } from '../src/components/auth/LoginView';
import { db } from '../src/services/db';
import { ThemeProvider } from '../src/context/ThemeContext';
import { BillPaperSize } from '../src/utils/pdfAndShareEngine';
import { CompanyProfile } from '../src/types';

console.log('=== TEST SUITE: Targeted ERP Updates Verification ===\n');

let passes = 0;
let failures = 0;

function expect(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passes++;
  } else {
    console.error(`[FAIL] ${testName}${detail ? ': ' + detail : ''}`);
    failures++;
  }
}

// =========================================================================
// 1. LOGO / COMPANY TITLE SPACING ("HariKripa Fruit Company")
// =========================================================================
console.log('--- 1. Verifying Logo / Company Title Spacing ---');

const logoFiles = [
  'src/components/layout/TopNavbar.tsx',
  'src/components/layout/Header.tsx',
  'src/components/layout/Sidebar.tsx',
  'src/components/auth/LoginView.tsx',
  'src/components/modals/HfcLogoExportModal.tsx',
];

logoFiles.forEach((relPath) => {
  const content = fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
  expect(
    content.includes('HariKripa Fruit Company') && !content.includes('Hari Kripa Fruit Company'),
    `${relPath} displays HariKripa Fruit Company without unwanted space`
  );
});

const wrapTheme = (el: React.ReactElement) => React.createElement(ThemeProvider, null, el);

const topNavHtml = ReactDOMServer.renderToStaticMarkup(
  wrapTheme(
    React.createElement(TopNavbar, {
      currentView: 'dashboard',
      onNavigate: () => {},
      onLogout: () => {},
    })
  )
);
expect(
  topNavHtml.includes('HariKripa Fruit Company') && !topNavHtml.includes('Hari Kripa Fruit Company'),
  'TopNavbar renders HariKripa Fruit Company in both desktop bar and mobile drawer'
);

const headerHtml = ReactDOMServer.renderToStaticMarkup(
  wrapTheme(
    React.createElement(Header, {
      currentView: 'dashboard',
      onOpenSidebar: () => {},
      onNavigate: () => {},
      onLogout: () => {},
    })
  )
);
expect(
  headerHtml.includes('HariKripa Fruit Company') && !headerHtml.includes('Hari Kripa Fruit Company'),
  'Header renders HariKripa Fruit Company'
);

const sidebarHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(Sidebar, {
    isOpen: true,
    onClose: () => {},
    currentView: 'dashboard',
    onSelectView: () => {},
  })
);
expect(
  sidebarHtml.includes('HariKripa Fruit Company') && !sidebarHtml.includes('Hari Kripa Fruit Company'),
  'Sidebar renders HariKripa Fruit Company'
);

const loginHtml = ReactDOMServer.renderToStaticMarkup(
  wrapTheme(
    React.createElement(LoginView, {
      onLoginSuccess: () => {},
    })
  )
);
expect(
  loginHtml.includes('HariKripa Fruit Company') && !loginHtml.includes('Hari Kripa Fruit Company'),
  'LoginView renders HariKripa Fruit Company'
);

// =========================================================================
// 2. DASHBOARD HEADING, TOTAL CUSTOMERS CARD & CUSTOMER OUTSTANDING NAV
// =========================================================================
console.log('\n--- 2. Verifying Dashboard Heading & Cards ---');

const initialCustomers = db.getCustomers();
const dashboardHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(DashboardView, {
    onNavigate: () => {},
  })
);

expect(
  dashboardHtml.includes('>Dashboard<') &&
    !dashboardHtml.includes('Hari Kripa Fruit Company Dashboard') &&
    !dashboardHtml.includes('HariKripa Fruit Company Dashboard') &&
    !dashboardHtml.includes('Freshness. Quality. Trust.'),
  'Dashboard displays only "Dashboard" heading without company name or tagline'
);

expect(
  !dashboardHtml.includes('Expenses (Freight/Hamali)'),
  'Dashboard removes Expenses (Freight/Hamali) card'
);

expect(
  dashboardHtml.includes('Total Customers') && dashboardHtml.includes(`>${initialCustomers.length}<`),
  `Dashboard displays Total Customers card with live dynamic count (${initialCustomers.length})`
);

// Test dynamic count when adding a customer
const newCustId = 'test-cust-dynamic-count';
db.saveCustomer({
  id: newCustId,
  name: 'Dynamic Test Party',
  mobile: '9999988888',
  openingBalance: 0,
  openingBalanceType: 'debit',
  openingCrateBalance: 0,
  active: true,
  createdAt: new Date().toISOString(),
});
const updatedDashHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(DashboardView, { onNavigate: () => {} })
);
expect(
  updatedDashHtml.includes(`>${initialCustomers.length + 1}<`),
  `Total Customers updates dynamically when customer record added (${initialCustomers.length + 1})`
);
db.deleteCustomer(newCustId);

const dashSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/dashboard/DashboardView.tsx'), 'utf-8');
expect(
  dashSrc.includes("onClick={() => onNavigate('customerDirectory')}") &&
    dashSrc.includes('Total Customers'),
  'Total Customers card navigates directly to Customer Directory'
);
expect(
  dashSrc.includes("onClick={() => onNavigate('reports', 'customerOutstanding')}") &&
    dashSrc.includes('Customer Outstanding'),
  'Customer Outstanding card navigates directly to Accounting Reports -> Customer Outstanding'
);

// Verify ReportsView renders Customer Outstanding section when initialTab === 'customerOutstanding'
const reportsHtml = ReactDOMServer.renderToStaticMarkup(
  React.createElement(ReportsView, {
    initialTab: 'customerOutstanding',
  })
);
expect(
  reportsHtml.includes('Customer Outstanding Balances'),
  'ReportsView opens Customer Outstanding Balances section for initialTab="customerOutstanding"'
);

// =========================================================================
// 3. COMPANY SHORT NAME VISIBILITY IN ALL BILL PRINT FORMATS
// =========================================================================
console.log('\n--- 3. Verifying Bold & Prominent Company Short Name Across All Bill Formats ---');

const testProfile: CompanyProfile = {
  id: 'cp-short-test',
  name: 'HariKripa Fruit Company',
  hindiName: 'हरिकृपा फ्रूट कंपनी',
  shortName: 'HFC',
  shortCode: 'HFC',
  address: 'Shop-A/6 Wholesale Fruit Market, Camp 2, Power House',
  city: 'Bhilai (C.G.)',
  state: '',
  pincode: '',
  mobile: '7566996333',
  primaryContactName: 'Vishal',
  isDefault: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const billFormats: BillPaperSize[] = ['b7', 'b6', 'a5', 'compact', 'a4'];
billFormats.forEach((size) => {
  const html = ReactDOMServer.renderToStaticMarkup(
    React.createElement(PrintBusinessHeader, {
      profile: testProfile,
      variant: 'bill',
      paperSize: size,
    })
  );

  expect(
    html.includes('print-business-short-name font-black') &&
      html.includes('leading-snug pt-[1px]') &&
      html.includes('>HFC<'),
    `${size.toUpperCase()} bill renders bold (font-black) HFC short name with safe top clearance`
  );

  // Verify short name font size is comparable to English main company name
  if (size === 'b7') {
    expect(html.includes('text-[11px] print:text-[11.5px]'), 'B7 short name uses 11px/11.5px matching main title');
  } else if (size === 'b6') {
    expect(html.includes('text-[13.5px] print:text-[14px]'), 'B6 short name uses 13.5px/14px matching main title');
  } else if (size === 'a5') {
    expect(html.includes('text-[15.5px] sm:text-[16.5px] print:text-[16px]'), 'A5 short name uses 15.5-16.5px matching main title');
  } else if (size === 'a4') {
    expect(html.includes('text-[18px] sm:text-[20px] print:text-[19.5px]'), 'A4 short name uses 18-20px matching main title');
  } else {
    expect(html.includes('text-[15.5px] sm:text-[17px] print:text-[16.5px]'), 'Compact short name uses 15.5-17px matching main title');
  }
});

// =========================================================================
// 4. CSS/PRINT STYLING FOR SALE PROCEED & CUSTOMER LEDGER PRODUCT LINES
// =========================================================================
console.log('\n--- 4. Verifying CSS-Only Bold Product Text in Sale Proceed & Customer Ledgers ---');

const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');

const requiredSelectors = [
  '#sale-proceeds-print-area tbody > tr > td:nth-child(2) .sp-detail-line',
  '#customer-ledger-detailed-print-area tbody > tr > td:nth-child(2) .sp-detail-line',
  '#sale-proceeds-short-print-area tbody > tr > td:nth-child(2) > div',
  '#customer-ledger-short-print-area tbody > tr > td:nth-child(2) > div',
  '#erp-isolated-print-mount #sale-proceeds-print-area tbody > tr > td:nth-child(2) .sp-detail-line',
  '#erp-isolated-print-mount #customer-ledger-detailed-print-area tbody > tr > td:nth-child(2) .sp-detail-line',
  '#erp-isolated-print-mount #sale-proceeds-short-print-area tbody > tr > td:nth-child(2) > div',
  '#erp-isolated-print-mount #customer-ledger-short-print-area tbody > tr > td:nth-child(2) > div',
];

requiredSelectors.forEach((sel) => {
  expect(indexCss.includes(sel), `index.css defines bold styling selector: ${sel}`);
});

expect(
  indexCss.includes('font-weight: 700 !important;') &&
    indexCss.includes('color: #000000 !important;') &&
    indexCss.includes('font-size: 12px !important;'),
  'index.css applies font-weight: 700, #000000 color, and 12px font-size for product transaction lines'
);

// Ensure TSX layout of SaleProceedsLedgerView & CustomerLedgerView was NOT modified in this pass
const spLedgerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/SaleProceedsLedgerView.tsx'), 'utf-8');
const clLedgerSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/accounts/CustomerLedgerView.tsx'), 'utf-8');
expect(
  spLedgerSrc.includes('className="sp-detail-line flex items-baseline justify-between gap-3') &&
    clLedgerSrc.includes('className="sp-detail-line flex items-baseline justify-between gap-3'),
  'SaleProceedsLedgerView & CustomerLedgerView preserve original row/column structure unchanged'
);

console.log(`\n=== SUMMARY: ${passes} passed, ${failures} failed ===`);
if (failures > 0) {
  process.exit(1);
}
