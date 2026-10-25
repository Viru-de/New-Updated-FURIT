import { Customer } from '../types';

export interface PrintableCustomerContact {
  id: string;
  text: string;
}

/**
 * Returns formatted customer contact numbers for printable documents (PDFs, bills, ledgers, statements).
 * Removes the word "Alternate" from displayed labels as per Hari Kripa Fruit ERP requirements:
 *
 * Requirements:
 * 1. When customer details are printed or in print preview / PDF / statement / ledger / bill:
 *    Remove the word "Alternate" from the displayed labels.
 * 2. Print only the customer's name and phone number for these entries. For example:
 *    - Instead of "Alternate Number 1: 9876543210", print "Name: 9876543210" if contact name exists,
 *      or show the number / "Mob: 9876543210" without the word "Alternate".
 *    - Instead of "Alternate Number 2: 9123456780", print the number / name without "Alternate".
 * 3. Blank alternate numbers are NEVER returned or printed.
 * 4. Preserves underlying database fields and values.
 */
export function getCustomerPrintContactLines(
  customer?: Partial<Customer> | null,
  options?: {
    includePrimary?: boolean;
    prefixWithMob?: boolean;
  }
): PrintableCustomerContact[] {
  if (!customer) return [];

  const { includePrimary = false, prefixWithMob = true } = options || {};
  const lines: PrintableCustomerContact[] = [];

  const primary = (customer.mobile || '').trim();
  if (includePrimary && primary) {
    lines.push({
      id: 'primary',
      text: prefixWithMob ? `Mob: ${primary}` : primary,
    });
  }

  // Alternate Number 1
  const alt1Mobile = (
    customer.altMobile ||
    customer.alternate1Mobile ||
    customer.alternateNumber1 ||
    ''
  ).trim();
  const alt1Name = (customer.alternate1ContactName || '').trim();

  if (alt1Mobile && alt1Mobile !== primary) {
    if (alt1Name) {
      lines.push({
        id: 'alt1',
        text: `${alt1Name}: ${alt1Mobile}`,
      });
    } else {
      lines.push({
        id: 'alt1',
        text: prefixWithMob ? `Mob: ${alt1Mobile}` : alt1Mobile,
      });
    }
  }

  // Alternate Number 2
  const alt2Mobile = (
    customer.alternate2Mobile ||
    customer.alternateNumber2 ||
    ''
  ).trim();
  const alt2Name = (customer.alternate2ContactName || '').trim();

  if (alt2Mobile && alt2Mobile !== primary && alt2Mobile !== alt1Mobile) {
    if (alt2Name) {
      lines.push({
        id: 'alt2',
        text: `${alt2Name}: ${alt2Mobile}`,
      });
    } else {
      lines.push({
        id: 'alt2',
        text: prefixWithMob ? `Mob: ${alt2Mobile}` : alt2Mobile,
      });
    }
  }

  return lines;
}
