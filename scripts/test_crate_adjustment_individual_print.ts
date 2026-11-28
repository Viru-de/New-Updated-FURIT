import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { db } from '../src/services/db';
import { getCustomerCrateStatement } from '../src/services/accounting';
import { CrateStatementView } from '../src/components/accounts/CrateStatementView';
import { CrateAdjustmentPrintModal } from '../src/components/print/CrateAdjustmentPrintModal';
import { CrateTransaction } from '../src/types';

function runTests() {
  let passed = 0;
  const check = (cond: boolean, label: string) => {
    assert(cond, `FAILED: ${label}`);
    console.log(`PASS: ${label}`);
    passed++;
  };

  // Setup two separate customers to verify zero data mixing
  const custAId = 'cust-crate-adj-print-a';
  const custBId = 'cust-crate-adj-print-b';

  db.saveCustomer({
    id: custAId,
    name: 'Narmada Fruit Agencies',
    customerTypes: ['credit_sale'],
    mobile: '9826111222',
    alternate1Mobile: '9826333444',
    address: 'Shop 9, Supela Fruit Mandi',
    city: 'Bhilai (C.G.)',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 12,
    crateTypeId: 'ct_20',
    active: true,
    createdAt: '2026-06-01T09:00:00.000Z',
  });

  db.saveCustomer({
    id: custBId,
    name: 'Other Mandi Trader',
    customerTypes: ['credit_sale'],
    mobile: '9000090000',
    address: 'Sector 6 Market',
    city: 'Durg',
    openingBalance: 0,
    openingBalanceType: 'debit',
    openingCrateBalance: 20,
    crateTypeId: 'ct_20',
    active: true,
    createdAt: '2026-06-01T09:00:00.000Z',
  });

  // Save a Credit Sale for Customer A (should NOT receive individual adjustment print button)
  db.saveCreditSale({
    id: 'cs-adj-test-1',
    creditSaleNo: 'CS-7701',
    sequenceNumber: 7701,
    date: '2026-06-03',
    customerId: custAId,
    customerName: 'Narmada Fruit Agencies',
    items: [
      {
        id: 'item-adj-1',
        fruitId: 'f1',
        fruitName: 'Mango',
        quantity: 8,
        unit: 'Crate',
        rate: 1000,
        amount: 8000,
      },
    ],
    productTotal: 8000,
    expenses: [],
    expenseTotal: 0,
    totalDebit: 8000,
    finalAmount: 8000,
    crateOut: 8,
    crateIn: 0,
    crateTypeId: 'ct_20',
    crateName: '20kg Crate',
    crateWeightKg: 20,
    createdAt: '2026-06-03T10:00:00.000Z',
  });

  // Save Crate Return & Manual Adjustment for Customer A + another for Customer B
  const returnTx: CrateTransaction = {
    id: 'ct-return-unique-101',
    customerId: custAId,
    customerName: 'Narmada Fruit Agencies',
    date: '2026-06-05',
    referenceType: 'Return',
    referenceNo: 'CR-5101',
    crateTypeId: 'ct_20',
    crateName: '20kg Crate',
    inQuantity: 5,
    outQuantity: 0,
    balanceQuantity: 0,
    weightKgPerCrate: 20,
    totalKg: 0,
    notes: 'Returned empty crates via Chota Hathi',
    createdAt: '2026-06-05T11:00:00.000Z',
  };

  const adjustTx: CrateTransaction = {
    id: 'ct-manual-unique-202',
    customerId: custAId,
    customerName: 'Narmada Fruit Agencies',
    date: '2026-06-07',
    referenceType: 'Manual Adjustment',
    referenceNo: 'CR-5202',
    crateTypeId: 'ct_10',
    crateName: '10kg Crate',
    inQuantity: 0,
    outQuantity: 3,
    balanceQuantity: 0,
    weightKgPerCrate: 10,
    totalKg: 0,
    notes: 'Manual extra issue for evening load',
    createdAt: '2026-06-07T14:00:00.000Z',
  };

  const otherCustTx: CrateTransaction = {
    id: 'ct-other-cust-999',
    customerId: custBId,
    customerName: 'Other Mandi Trader',
    date: '2026-06-06',
    referenceType: 'Return',
    referenceNo: 'CR-9999',
    crateTypeId: 'ct_20',
    crateName: '20kg Crate',
    inQuantity: 4,
    outQuantity: 0,
    balanceQuantity: 0,
    weightKgPerCrate: 20,
    totalKg: 0,
    notes: 'Secret customer B note',
    createdAt: '2026-06-06T12:00:00.000Z',
  };

  db.saveCrateTransaction(returnTx);
  db.saveCrateTransaction(adjustTx);
  db.saveCrateTransaction(otherCustTx);

  const txCountBefore = db.getCrateTransactions().length;
  const stmtBefore = getCustomerCrateStatement(custAId);
  // Balance: 12 OB + 8 (CS-7701) - 5 (Return) + 3 (Manual Adj) = 18
  check(
    stmtBefore.closingCrates === 18,
    'Customer A closing balance math unchanged (18 Crates)'
  );

  // 1. CrateStatementView shows a unique Print button for BOTH Return and Manual Adjustment, and NOT for Credit Sale / OB / Customer B
  const stmtHtml = renderToStaticMarkup(
    React.createElement(CrateStatementView, { initialCustomerId: custAId })
  );
  check(
    stmtHtml.includes(`data-crate-tx-print-id="${returnTx.id}"`) &&
      stmtHtml.includes(`data-crate-tx-print-id="${adjustTx.id}"`),
    'CrateStatementView renders dedicated Print button for each Return and Manual Adjustment transaction'
  );
  check(
    !stmtHtml.includes(`data-crate-tx-print-id="${otherCustTx.id}"`) &&
      !stmtHtml.includes('data-crate-tx-print-id="cs-adj-test-1"') &&
      !stmtHtml.includes(`data-crate-tx-print-id="ob-crate-${custAId}"`),
    'CrateStatementView only attaches Print buttons to Customer A manual Return/Adjustment rows'
  );

  // 2. Render Individual Print Modal for Crate Return
  const returnEntry = stmtBefore.entries.find((e) => e.id === returnTx.id);
  const returnModalHtml = renderToStaticMarkup(
    React.createElement(CrateAdjustmentPrintModal, {
      isOpen: true,
      onClose: () => {},
      transaction: returnTx,
      entry: returnEntry,
    })
  );

  const returnAreaStart = returnModalHtml.indexOf('id="crate-adjustment-print-area"');
  check(
    returnAreaStart !== -1,
    'CrateAdjustmentPrintModal renders #crate-adjustment-print-area for Crate Return'
  );
  const returnAreaHtml = returnModalHtml.slice(returnAreaStart);

  const defaultProfile = db.getDefaultProfile() || db.getCompanyProfiles()[0];
  const expectedLogo = defaultProfile.logo || '/assets/hfc_circle_logo.png';

  check(
    returnAreaHtml.includes(expectedLogo) &&
      returnAreaHtml.includes('HariKripa Fruit Company') &&
      returnAreaHtml.includes('श्री हरि कृपा') &&
      returnAreaHtml.includes('Shop-A/6 Wholesale Fruit Market, Camp 2, Power House') &&
      returnAreaHtml.includes('Bhilai (C.G.)') &&
      returnAreaHtml.includes('Vishal: 7566996333') &&
      returnAreaHtml.includes('Ranjeet: 9329599950') &&
      returnAreaHtml.includes('Dhirumal: 9300910015'),
    'Individual Crate Return statement renders centered HKC logo and full company header & contacts'
  );

  check(
    returnAreaHtml.includes('CRATE RETURN STATEMENT') &&
      returnAreaHtml.includes('Crate Return') &&
      returnAreaHtml.includes('M/s. Narmada Fruit Agencies') &&
      returnAreaHtml.includes('9826111222') &&
      returnAreaHtml.includes('20kg Crate') &&
      returnAreaHtml.includes('5 Crates') &&
      returnAreaHtml.includes('CR-5101') &&
      returnAreaHtml.includes('Returned empty crates via Chota Hathi') &&
      returnAreaHtml.includes('15 Crates'), // 12 + 8 - 5 = 15 right after returnTx
    'Crate Return print statement includes customer, date, type, crate type, qty (5 Crates), ref CR-5101, remarks, and updated balance (15 Crates)'
  );

  check(
    !returnAreaHtml.includes('CR-5202') &&
      !returnAreaHtml.includes('Manual extra issue for evening load') &&
      !returnAreaHtml.includes('CR-9999') &&
      !returnAreaHtml.includes('Other Mandi Trader') &&
      !returnAreaHtml.includes('Secret customer B note'),
    'Crate Return print output isolates ONLY the selected transaction and never mixes other transactions or customers'
  );

  // 3. Render Individual Print Modal for Crate Adjustment (Manual Adjustment)
  const adjustEntry = stmtBefore.entries.find((e) => e.id === adjustTx.id);
  const adjustModalHtml = renderToStaticMarkup(
    React.createElement(CrateAdjustmentPrintModal, {
      isOpen: true,
      onClose: () => {},
      transaction: adjustTx,
      entry: adjustEntry,
    })
  );
  const adjustAreaHtml = adjustModalHtml.slice(
    adjustModalHtml.indexOf('id="crate-adjustment-print-area"')
  );

  check(
    adjustAreaHtml.includes('CRATE ADJUSTMENT STATEMENT') &&
      adjustAreaHtml.includes('Crate Adjustment') &&
      adjustAreaHtml.includes('10kg Crate') &&
      adjustAreaHtml.includes('3 Crates') &&
      adjustAreaHtml.includes('CR-5202') &&
      adjustAreaHtml.includes('Manual extra issue for evening load') &&
      adjustAreaHtml.includes('18 Crates') &&
      !adjustAreaHtml.includes('CR-5101') &&
      !adjustAreaHtml.includes('Returned empty crates via Chota Hathi'),
    'Crate Adjustment print statement renders independently with exact transaction details and updated balance (18 Crates)'
  );

  // 4. Verify zero duplicate transactions or calculation mutations
  const txCountAfter = db.getCrateTransactions().length;
  const stmtAfter = getCustomerCrateStatement(custAId);
  check(
    txCountAfter === txCountBefore && stmtAfter.closingCrates === stmtBefore.closingCrates,
    'Printing individual Crate Return / Adjustment entries creates zero duplicate transactions and preserves balances'
  );

  // 5. Verify Record Crate Return or Adjustment modal in CrateStatementView.tsx contains dedicated Print controls
  const crateViewSource = fs.readFileSync(
    path.join(process.cwd(), 'src/components/accounts/CrateStatementView.tsx'),
    'utf-8'
  );
  const modalIdx = crateViewSource.indexOf('Record Crate Return or Adjustment');
  check(modalIdx !== -1, 'CrateStatementView contains Record Crate Return or Adjustment modal');
  const modalSourceSlice = crateViewSource.slice(modalIdx);
  check(
    modalSourceSlice.includes('data-crate-adj-modal-print="true"') &&
      modalSourceSlice.includes('data-crate-adj-saved-print="true"') &&
      modalSourceSlice.includes('handlePrintFromAdjustmentModal') &&
      modalSourceSlice.includes('Save Crate Entry'),
    'Record Crate Return or Adjustment modal includes Print buttons alongside saved transaction details and action controls'
  );

  // 6. Verify draft preview inside adjustment modal prints cleanly without modifying DB
  const draftTx: CrateTransaction = {
    id: 'preview-draft-999',
    customerId: custAId,
    customerName: 'Narmada Fruit Agencies',
    date: '2026-06-08',
    referenceType: 'Return',
    referenceNo: '',
    crateTypeId: 'ct_20',
    crateName: '20kg Crate',
    inQuantity: 2,
    outQuantity: 0,
    balanceQuantity: 16,
    weightKgPerCrate: 20,
    totalKg: 320,
    notes: 'Draft return slip check',
    createdAt: '2026-06-08T10:00:00.000Z',
  };
  const draftModalHtml = renderToStaticMarkup(
    React.createElement(CrateAdjustmentPrintModal, {
      isOpen: true,
      onClose: () => {},
      transaction: draftTx,
      entry: {
        id: draftTx.id,
        date: draftTx.date,
        particulars: 'Return: Draft return slip check',
        referenceNo: '',
        crateTypeId: 'ct_20',
        crateName: '20kg Crate',
        inQuantity: 2,
        outQuantity: 0,
        balance: 16,
        typeBalance: 10,
        weightKg: 20,
        totalKg: 320,
      },
    })
  );
  check(
    draftModalHtml.includes('CRATE RETURN STATEMENT') &&
      draftModalHtml.includes('2 Crates') &&
      draftModalHtml.includes('16 Crates') &&
      draftModalHtml.includes('Draft return slip check') &&
      db.getCrateTransactions().length === txCountAfter,
    'Draft print preview from adjustment modal renders updated balance (16 Crates) without creating duplicate DB records'
  );

  // 7. Verify CSS rules exist for both PDF export and Print
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    css.includes('[data-pdf-export="true"]#crate-adjustment-print-area') &&
      css.includes('#erp-isolated-print-mount #crate-adjustment-print-area'),
    'index.css includes PDF export and browser print rules for #crate-adjustment-print-area'
  );

  console.log(`\nAll ${passed} individual Crate Return/Adjustment print tests PASSED.`);
}

runTests();
