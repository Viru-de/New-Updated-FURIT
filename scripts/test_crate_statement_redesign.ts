import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { db } from '../src/services/db';
import { getCustomerCrateStatement } from '../src/services/accounting';
import { CrateStatementView } from '../src/components/accounts/CrateStatementView';

function runTests() {
  let passed = 0;
  const check = (cond: boolean, label: string) => {
    assert(cond, `FAILED: ${label}`);
    console.log(`PASS: ${label}`);
    passed++;
  };

  // Ensure a customer exists with multi-type crate transactions, address, and logo on profile
  const profiles = db.getCompanyProfiles();
  if (profiles[0] && !profiles[0].logo) {
    db.saveCompanyProfile({
      ...profiles[0],
      logo: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    });
  }

  const custId = 'cust-crate-redesign-test';
  db.saveCustomer({
    id: custId,
    name: 'Shree Ganesh Fruit Traders',
    customerTypes: ['credit_sale'],
    mobile: '9876543210',
    alternate1Mobile: '9123456789',
    address: 'Shop 14, Fruit Market',
    city: 'Indore',
    state: 'Madhya Pradesh',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 5,
    crateTypeId: 'ct_20',
    active: true,
    createdAt: '2026-05-01T09:00:00.000Z',
  });

  db.saveCreditSale({
    id: 'cs-crate-redesign-1',
    creditSaleNo: 'CS-9001',
    sequenceNumber: 9001,
    date: '2026-05-05',
    customerId: custId,
    customerName: 'Shree Ganesh Fruit Traders',
    items: [
      {
        id: 'item-1',
        fruitId: 'f1',
        fruitName: 'Apple Shimla',
        quantity: 10,
        unit: 'Crate',
        rate: 1200,
        amount: 12000,
      },
    ],
    productTotal: 12000,
    expenses: [],
    expenseTotal: 0,
    totalDebit: 12000,
    finalAmount: 12000,
    crateOut: 10,
    crateIn: 2,
    crateTypeId: 'ct_20',
    crateName: '20kg Crate',
    crateWeightKg: 20,
    crateMovements: [
      { crateTypeId: 'ct_20', crateName: '20kg Crate', outQuantity: 10, inQuantity: 2 },
      { crateTypeId: 'ct_10', crateName: '10kg Crate', outQuantity: 6, inQuantity: 1 },
    ],
    createdAt: '2026-05-05T10:00:00.000Z',
  });

  const statement = getCustomerCrateStatement(custId);
  // Opening 5 + (10 - 2) + (6 - 1) = 18 Crates
  check(statement.closingCrates === 18, 'Crate statement math preserves exact closing balance (18 Crates)');
  check(statement.closingTotalKg > 0, 'Crate statement math preserves positive closingTotalKg');

  const html = renderToStaticMarkup(React.createElement(CrateStatementView, { initialCustomerId: custId }));
  const printStart = html.indexOf('id="crate-statement-print-area"');
  check(printStart !== -1, 'CrateStatementView renders #crate-statement-print-area');
  const printAreaHtml = html.slice(printStart);

  // 1. Modern Centered Company Header Design
  const currentProf = db.getCompanyProfiles()[0];
  const shortCode = (currentProf?.shortName || currentProf?.shortCode || 'HFC').trim();
  const engName = (currentProf?.name || 'HariKripa Fruit Company').trim();
  const hindiName = (currentProf?.hindiName || 'श्री हरि कृपा').trim();

  check(
    printAreaHtml.includes('print-business-header--ledger-centered') &&
      printAreaHtml.includes('text-center') &&
      !printAreaHtml.includes('print-business-header-left') &&
      !printAreaHtml.includes('print-business-header-right'),
    'Modern header uses centered PrintBusinessHeader variant="ledger-centered" without left/right two-column layout'
  );

  const idxShort = printAreaHtml.indexOf(shortCode);
  const idxEng = printAreaHtml.indexOf(engName);
  const idxHindi = printAreaHtml.indexOf(hindiName);
  const idxAddr = printAreaHtml.indexOf(currentProf?.address || '');
  const idxContact = printAreaHtml.indexOf(currentProf?.mobile || '');
  const idxTitle = printAreaHtml.indexOf('CUSTOMER CRATE STATEMENT');

  check(
    idxShort !== -1 &&
      idxEng !== -1 &&
      idxHindi !== -1 &&
      idxAddr !== -1 &&
      idxContact !== -1 &&
      idxTitle !== -1 &&
      idxShort < idxEng &&
      idxEng < idxHindi &&
      idxHindi < idxAddr &&
      idxAddr < idxContact &&
      idxContact < idxTitle,
    'Centered header stacks in exact order (Short Code -> English Name -> Hindi Name -> Address -> Contacts) above CUSTOMER CRATE STATEMENT'
  );
  check(
    printAreaHtml.includes('CUSTOMER CRATE STATEMENT') && printAreaHtml.includes('Statement Date:'),
    'Modern header displays CUSTOMER CRATE STATEMENT title and Statement Date'
  );
  check(
    printAreaHtml.includes('data-dynamic-page-numbers="true"') &&
      printAreaHtml.includes('data-sp-page-footer="true"') &&
      printAreaHtml.includes('data-sp-page-number="true"'),
    'Print area enables dynamic Page X of Y numbering'
  );

  // 2. Customer Information Section
  check(
    printAreaHtml.includes('CUSTOMER DETAILS') &&
      printAreaHtml.includes('M/s. Shree Ganesh Fruit Traders') &&
      printAreaHtml.includes('Shop 14, Fruit Market, Indore, Madhya Pradesh') &&
      printAreaHtml.includes('9876543210'),
    'Customer information section displays customer name, full address, and contact numbers'
  );
  check(
    printAreaHtml.includes('STATEMENT SUMMARY') &&
      printAreaHtml.includes('Period:') &&
      printAreaHtml.includes('Closing Crate Balance:') &&
      printAreaHtml.includes('Total Crates / Total KG:') &&
      printAreaHtml.includes(`${statement.closingCrates} Crates / ${statement.closingTotalKg} KG`),
    'Statement summary box displays period, closing crate balance, total crates, and total KG'
  );

  // 3. Modern 8-Column Transaction Table
  check(
    printAreaHtml.includes('crate-stmt-table') &&
      printAreaHtml.includes('<colgroup>') &&
      printAreaHtml.includes('>Date</th>') &&
      printAreaHtml.includes('>Particulars / Reference</th>') &&
      printAreaHtml.includes('>Crate Type</th>') &&
      printAreaHtml.includes('<span class="hidden print:inline">Issued</span>') &&
      printAreaHtml.includes('<span class="hidden print:inline">Returned</span>') &&
      printAreaHtml.includes('>Type Balance</th>') &&
      printAreaHtml.includes('>Total Balance</th>') &&
      printAreaHtml.includes('>Total KG</th>'),
    'Modern table preserves all 8 columns with print-clean Issued and Returned headers'
  );

  // 4. Closing Crate Summary Card inside tfoot + Signature
  const tfootStart = printAreaHtml.indexOf('<tfoot>');
  const tfootEnd = printAreaHtml.indexOf('</tfoot>');
  check(tfootStart !== -1 && tfootEnd > tfootStart, 'Table renders tfoot summary section');
  const tfootHtml = printAreaHtml.slice(tfootStart, tfootEnd);
  check(
    tfootHtml.includes('ledger-closing-meta-row') &&
      tfootHtml.includes('crate-stmt-closing-card') &&
      tfootHtml.includes('Closing Crate Summary') &&
      tfootHtml.includes('Total Crates:') &&
      tfootHtml.includes('Total KG:') &&
      tfootHtml.includes('AUTHORISED SIGNATURE'),
    'tfoot includes Closing Crate Summary card with crate-type breakdown, totals, and Authorised Signature'
  );

  // 5. Verify zero IN/OUT words in printable output (strip print:hidden elements first)
  const printableOnlyHtml = printAreaHtml.replace(
    /<([a-z0-9]+)\b[^>]*class="[^"]*\bprint:hidden\b[^"]*"[^>]*>[\s\S]*?<\/\1>/gi,
    ''
  );
  // Also strip nested spans inside print:hidden divs (screen bottom banner)
  const printableText = printableOnlyHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const hasInOutWord = /\b(Out|In|OUT|IN)\b/.test(printableText);
  check(!hasInOutWord, 'Printable/PDF text of Customer Crate Statement contains zero IN or OUT words');

  // 6. Verify index.css includes PDF and print rules for crate-statement-modern-print across all paper sizes
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    css.includes('[data-pdf-export="true"]#crate-statement-print-area.crate-statement-modern-print') &&
      css.includes('#erp-isolated-print-mount #crate-statement-print-area.crate-statement-modern-print') &&
      css.includes('crate-statement-modern-print[data-paper-size="a5"]') &&
      css.includes('crate-statement-modern-print[data-paper-size="compact"]') &&
      css.includes('crate-statement-modern-print[data-paper-size="b6"]') &&
      css.includes('crate-statement-modern-print[data-paper-size="b7"]'),
    'index.css includes modern PDF & Print rules for Crate Statement across A4, A5, Compact, B6, and B7'
  );

  console.log(`\nAll ${passed} Customer Crate Statement redesign checks PASSED.`);
}

runTests();
