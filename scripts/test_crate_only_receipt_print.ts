import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { db } from '../src/services/db';
import { getCustomerCrateStatement } from '../src/services/accounting';
import { formatDate } from '../src/utils/formatters';
import { ReceiptModal } from '../src/components/accounts/ReceiptModal';
import { CrateReceiptPrintModal } from '../src/components/print/CrateReceiptPrintModal';
import { ReceiptPrintModal } from '../src/components/print/ReceiptPrintModal';

function runTests() {
  let passed = 0;
  const check = (cond: boolean, label: string) => {
    assert(cond, `FAILED: ${label}`);
    console.log(`PASS: ${label}`);
    passed++;
  };

  const custId = 'cust-crate-receipt-test';
  db.saveCustomer({
    id: custId,
    name: 'Patel Fruit Suppliers',
    customerTypes: ['credit_sale'],
    mobile: '9876500111',
    alternate1Mobile: '9876500222',
    address: 'Shop 9, Mandi Yard',
    city: 'Bhilai (C.G.)',
    openingBalance: 5000,
    openingBalanceType: 'debit',
    openingCrateBalance: 14,
    crateTypeId: 'ct_20',
    active: true,
    createdAt: '2026-05-01T09:00:00.000Z',
  });

  const beforeReceiptsLen = db.getReceipts().length;
  const beforeCrateTxLen = db.getCrateTransactions().length;
  const beforeStatement = getCustomerCrateStatement(custId);

  // 1. ReceiptModal renders New Customer Receipt / Cash A/C with Crate Print Option (Crate Received & Crate Out)
  const modalHtml = renderToStaticMarkup(
    React.createElement(ReceiptModal, {
      isOpen: true,
      onClose: () => {},
      onSaved: () => {},
      preselectedCustomerId: custId,
    })
  );
  check(
    modalHtml.includes('New Customer Receipt / Cash A/C') &&
      modalHtml.includes('Crate Print Option') &&
      modalHtml.includes('Crate Received') &&
      modalHtml.includes('Crate Out') &&
      modalHtml.includes('Print Receipt') &&
      modalHtml.includes('Save Receipt'),
    'ReceiptModal preserves Cash Receipt actions and exposes Crate Print Option with Crate Received & Crate Out'
  );

  // 2. CrateReceiptPrintModal renders Crate Received receipt (Crate-Only, Centered HKC Header)
  for (const txType of ['Crate Received', 'Crate Out'] as const) {
    const html = renderToStaticMarkup(
      React.createElement(CrateReceiptPrintModal, {
        isOpen: true,
        onClose: () => {},
        crateReceipt: {
          id: `cr-test-${txType}`,
          customerId: custId,
          customerName: 'Patel Fruit Suppliers',
          date: '2026-05-12',
          transactionType: txType,
          crateTypeId: 'ct_20',
          crateName: '20kg Crate',
          quantity: txType === 'Crate Received' ? 6 : 12,
          remarks: 'Tempo No. CG-07-1234',
        },
      })
    );

    const printStart = html.indexOf('id="crate-receipt-print-area"');
    check(printStart !== -1, `CrateReceiptPrintModal (${txType}) renders #crate-receipt-print-area`);
    const printHtml = html.slice(printStart);
    const printText = printHtml.replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

    check(
      printHtml.includes('print-business-header--ledger-centered') &&
        !printHtml.includes('print-business-header-left') &&
        !printHtml.includes('print-business-header-right'),
      `CrateReceiptPrintModal (${txType}) uses centered HKC company header`
    );

    const qtyLabel = txType === 'Crate Received' ? '6 Crates' : '12 Crates';
    const expectedDate = formatDate('2026-05-12');
    check(
      printText.includes('CRATE TRANSACTION RECEIPT') &&
        printText.includes('M/s. Patel Fruit Suppliers') &&
        printText.includes('9876500111') &&
        printText.includes(expectedDate) &&
        printText.includes(txType) &&
        printText.includes('20kg Crate') &&
        printText.includes(qtyLabel) &&
        printText.includes('Tempo No. CG-07-1234') &&
        printText.includes('Closing Crate Balance') &&
        printText.includes(`${beforeStatement.closingCrates} Crates`),
      `CrateReceiptPrintModal (${txType}) prints all required crate transaction details and closing crate balance`
    );

    check(
      !printText.includes('PAYMENT / CASH RECEIPT') &&
        !printText.includes('Amount Received') &&
        !printText.includes('Payment Mode'),
      `CrateReceiptPrintModal (${txType}) excludes regular cash receipt format fields`
    );
  }

  // 3. Regular ReceiptPrintModal remains untouched
  const cashReceiptHtml = renderToStaticMarkup(
    React.createElement(ReceiptPrintModal, {
      isOpen: true,
      onClose: () => {},
      receipt: {
        id: 'r-test-1',
        receiptNo: 'Receipt No. 999',
        sequenceNumber: 999,
        customerId: custId,
        customerName: 'Patel Fruit Suppliers',
        date: '2026-05-12',
        paymentMode: 'Cash',
        amount: 5000,
        createdAt: '2026-05-12T10:00:00.000Z',
      },
    })
  );
  check(
    cashReceiptHtml.includes('PAYMENT / CASH RECEIPT') &&
      cashReceiptHtml.includes('Amount Received') &&
      cashReceiptHtml.includes('Payment Mode'),
    'Regular ReceiptPrintModal remains completely unchanged'
  );

  // 4. Verify zero unintended mutations to stored receipts, crate transactions, or crate balances
  const afterStatement = getCustomerCrateStatement(custId);
  check(
    db.getReceipts().length === beforeReceiptsLen &&
      db.getCrateTransactions().length === beforeCrateTxLen &&
      afterStatement.closingCrates === beforeStatement.closingCrates,
    'Crate Print option does not modify crate calculations, balances, or transaction records'
  );

  // 5. Verify index.css includes #crate-receipt-print-area
  const css = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf-8');
  check(
    css.includes('#crate-receipt-print-area'),
    'src/index.css includes print rules for #crate-receipt-print-area'
  );

  console.log(`\nAll ${passed} Crate-Only Receipt Print checks PASSED.`);
}

runTests();
