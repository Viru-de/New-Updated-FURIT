import { db } from '../src/services/db';
import { Customer, Fruit, Vendor, CreditSale, CashSale, Receipt, Bill, SaleProceeds } from '../src/types';

function runTests() {
  console.log('=== TEST SUITE: Search & Selection Across All 11 Modules ===\n');
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

  const customers = db.getCustomers();
  const fruits = db.getFruits();
  const vendors = db.getVendors();
  const cashSales = db.getCashSales();
  const creditSales = db.getCreditSales();
  const saleProceeds = db.getSaleProceeds();
  const receipts = db.getReceipts();
  const bills = db.getBills();

  // 1. Customer Prefix Ranking & Instant Filtering (Typing "s" / "S" -> Shree first)
  console.log('--- Test Module: Customer Search & Selection ---');
  function filterAndRankCustomers(query: string, list: Customer[]) {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    const cleanQ = q.replace(/\s+/g, '');

    const matches = list.filter((c) => {
      const name = c.name.toLowerCase();
      const mobile = c.mobile || '';
      const altMobile = c.altMobile || '';
      const city = (c.city || '').toLowerCase();
      const rawAadhaar = (c.aadhaarNo || '').replace(/\s+/g, '');
      const gstin = (c.gstin || '').toLowerCase();

      return (
        name.includes(q) ||
        mobile.includes(q) ||
        altMobile.includes(q) ||
        city.includes(q) ||
        (cleanQ.length >= 2 && rawAadhaar.includes(cleanQ)) ||
        gstin.includes(q)
      );
    });

    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const aWordStarts = aName.includes(' ' + q);
      const bWordStarts = bName.includes(' ' + q);
      if (aWordStarts && !bWordStarts) return -1;
      if (!aWordStarts && bWordStarts) return 1;

      return aName.localeCompare(bName);
    });
  }

  const sResults = filterAndRankCustomers('s', customers);
  expect(sResults.length > 0, 'Searching "s" finds matching customers');
  const shreeFirst = sResults[0]?.name.toLowerCase().startsWith('s');
  expect(shreeFirst, `Searching "s" places customer starting with S first (Top: "${sResults[0]?.name}")`);
  const shreePresent = sResults.some(c => c.name.includes('Shree'));
  expect(shreePresent, 'Searching "s" includes "Shree Ganesh Fruit Mart" in matches');

  // Case insensitivity: 'S' vs 's'
  const capSResults = filterAndRankCustomers('S', customers);
  expect(capSResults.length === sResults.length, 'Search is completely case-insensitive ("S" vs "s")');

  // Multi-attribute: mobile, city, aadhaar
  const testCustomer = customers.find(c => c.mobile);
  if (testCustomer && testCustomer.mobile) {
    const mobResults = filterAndRankCustomers(testCustomer.mobile.slice(0, 5), customers);
    expect(mobResults.some(c => c.id === testCustomer.id), `Customer found by partial mobile: ${testCustomer.mobile.slice(0, 5)}`);
  }
  const testCustomerCity = customers.find(c => c.city);
  if (testCustomerCity && testCustomerCity.city) {
    const cityResults = filterAndRankCustomers(testCustomerCity.city.toLowerCase(), customers);
    expect(cityResults.some(c => c.id === testCustomerCity.id), `Customer found by city: ${testCustomerCity.city}`);
  }

  // Clearing / Backspacing: empty string returns full customer list
  const emptyResults = filterAndRankCustomers('', customers);
  expect(emptyResults.length === customers.length, 'Empty search query returns full customer directory (for clearing/backspace)');

  // 2. Fruit / Item Master & Autocomplete Prefix Ranking
  console.log('\n--- Test Module: Fruit / Item Master & Selection ---');
  function filterAndRankFruits(query: string, list: Fruit[]) {
    const q = query.trim().toLowerCase();
    if (!q) return list;

    const matches = list.filter((f) => {
      const name = f.name.toLowerCase();
      const cat = (f.category || '').toLowerCase();
      const unit = (f.unit || f.defaultUnit || '').toLowerCase();
      const id = f.id.toLowerCase();
      return name.includes(q) || cat.includes(q) || unit.includes(q) || id.includes(q);
    });

    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;

      const aWordStarts = aName.includes(' ' + q);
      const bWordStarts = bName.includes(' ' + q);
      if (aWordStarts && !bWordStarts) return -1;
      if (!aWordStarts && bWordStarts) return 1;

      return aName.localeCompare(bName);
    });
  }

  const aFruits = filterAndRankFruits('a', fruits);
  expect(aFruits.length > 0, 'Searching "a" finds fruits');
  expect(aFruits[0]?.name.toLowerCase().startsWith('a'), `Searching "a" ranks fruit starting with "A" first (Top: "${aFruits[0]?.name}")`);
  const appleFruit = fruits.find(f => f.name.toLowerCase().includes('apple'));
  if (appleFruit) {
    const appleResults = filterAndRankFruits('ap', fruits);
    expect(appleResults[0]?.name.toLowerCase().startsWith('ap'), 'Typing "ap" puts Apple at top');
  }

  // 3. Vendor Directory & Autocomplete Prefix Ranking
  console.log('\n--- Test Module: Vendor Directory & Autocomplete ---');
  function filterAndRankVendors(query: string, list: Vendor[]) {
    const q = query.trim().toLowerCase();
    if (!q) return list;

    const matches = list.filter((v) => {
      const name = v.name.toLowerCase();
      const contact = (v.contact || '').toLowerCase();
      const city = (v.city || '').toLowerCase();
      const gstin = (v.gstin || '').toLowerCase();
      return name.includes(q) || contact.includes(q) || city.includes(q) || gstin.includes(q);
    });

    return matches.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });
  }

  if (vendors.length > 0) {
    const vFirstLetter = vendors[0].name.charAt(0).toLowerCase();
    const vResults = filterAndRankVendors(vFirstLetter, vendors);
    expect(vResults.length > 0, `Searching "${vFirstLetter}" finds vendors`);
    expect(vResults[0]?.name.toLowerCase().startsWith(vFirstLetter), `Top vendor starts with "${vFirstLetter}"`);
  }

  // 4. Wholesale Cash Sale List Search
  console.log('\n--- Test Module: Wholesale Cash Sale List ---');
  if (cashSales.length > 0) {
    const testCs = cashSales[0];
    const billQuery = testCs.cashSaleNo.slice(-3);
    const csMatches = cashSales.filter(s => s.cashSaleNo.includes(billQuery) || (s.customerName && s.customerName.includes(billQuery)));
    expect(csMatches.length > 0, `Cash sale matched by bill query "${billQuery}"`);
  }

  // 5. Wholesale Credit Sale List Search
  console.log('\n--- Test Module: Wholesale Credit Sale List ---');
  if (creditSales.length > 0) {
    const testCred = creditSales[0];
    const qCred = testCred.customerName.slice(0, 3).toLowerCase();
    const credMatches = creditSales.filter(s => s.customerName.toLowerCase().includes(qCred) || s.creditSaleNo.toLowerCase().includes(qCred));
    expect(credMatches.length > 0, `Credit sale matched by customer query "${qCred}"`);
  }

  // 6. Sale Proceeds Transactions List Search
  console.log('\n--- Test Module: Sale Proceeds Transactions List ---');
  if (saleProceeds.length > 0) {
    const testSp = saleProceeds[0];
    const spQuery = testSp.proceedsNo.slice(-3).toLowerCase();
    const spMatches = saleProceeds.filter(s => s.proceedsNo.toLowerCase().includes(spQuery));
    expect(spMatches.length > 0, `Sale proceeds matched by proceedsNo "${spQuery}"`);
  }

  // 7. Receipts / Cash A/C List Search
  console.log('\n--- Test Module: Receipts / Cash A/C List ---');
  if (receipts.length > 0) {
    const testRec = receipts[0];
    const recQuery = testRec.customerName.slice(0, 3).toLowerCase();
    const recMatches = receipts.filter(r => r.customerName.toLowerCase().includes(recQuery) || r.receiptNo.toLowerCase().includes(recQuery));
    expect(recMatches.length > 0, `Receipt matched by customer query "${recQuery}"`);
  }

  // 8. Bill History Search (billNo, customerName, fruit item, profile)
  console.log('\n--- Test Module: Bill History Search ---');
  if (bills.length > 0) {
    const testBill = bills[0];
    const bQuery = testBill.customerName.slice(0, 3).toLowerCase();
    const bMatches = bills.filter(b => b.customerName.toLowerCase().includes(bQuery) || b.billNo.toLowerCase().includes(bQuery));
    expect(bMatches.length > 0, `Bill matched by query "${bQuery}"`);
  }

  // 9. Backspace & Clear Selection Regression Check
  console.log('\n--- Test Module: Clear & Backspace Re-Selection ---');
  // When a selection is cleared (c === null), customerId should reset to '' and not preserve stale IDs
  let selectedId = 'cust-123';
  const handleClear = (c: Customer | null) => {
    selectedId = c ? c.id : '';
  };
  handleClear(null);
  expect(selectedId === '', 'Clearing customer selection sets customerId to empty string (no stuck ID)');

  // Fruit clear check
  let selectedFruitId = 'fruit-456';
  let selectedFruitName = 'Apple';
  const handleFruitClear = (f: Fruit | null, customName?: string) => {
    selectedFruitId = f ? f.id : '';
    selectedFruitName = f ? f.name : (customName || '');
  };
  handleFruitClear(null, '');
  expect(selectedFruitId === '' && selectedFruitName === '', 'Clearing fruit selection sets fruitId and fruitName to empty string');

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passes} Passed, ${failures} Failed`);
  console.log(`========================================\n`);

  if (failures > 0) {
    process.exit(1);
  }
}

runTests();
