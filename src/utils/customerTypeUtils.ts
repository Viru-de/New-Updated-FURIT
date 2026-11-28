import { Customer, CustomerType } from '../types';

export const ALL_CUSTOMER_TYPES: CustomerType[] = [
  'cash_sale',
  'credit_sale',
  'sale_proceeds',
];

export interface CustomerTypeMeta {
  value: CustomerType;
  label: string;
  shortLabel: string;
  description: string;
  visibilityHint: string;
  badgeClass: string;
}

export const CUSTOMER_TYPE_OPTIONS: CustomerTypeMeta[] = [
  {
    value: 'cash_sale',
    label: 'Cash Sale',
    shortLabel: 'Cash Sale',
    description: 'Immediate cash / UPI wholesale buyers',
    visibilityHint: 'Cash Sale module',
    badgeClass:
      'bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/70',
  },
  {
    value: 'credit_sale',
    label: 'Credit Sale',
    shortLabel: 'Credit Sale',
    description: 'Credit billing, Group Sale, Receipts & Customer Ledger',
    visibilityHint: 'Credit Sale, Group Sale, Receipts & Customer Ledger',
    badgeClass:
      'bg-blue-50 text-blue-800 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800/70',
  },
  {
    value: 'sale_proceeds',
    label: 'Sale Proceeds',
    shortLabel: 'Sale Proceeds',
    description: 'Consignment / Sale Proceeds billing & profile',
    visibilityHint: 'Sale Proceeds & Sale Proceeds Ledger',
    badgeClass:
      'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800/70',
  },
];

export function getCustomerTypeMeta(type: CustomerType): CustomerTypeMeta {
  return (
    CUSTOMER_TYPE_OPTIONS.find((opt) => opt.value === type) || CUSTOMER_TYPE_OPTIONS[1]
  );
}

export function normalizeCustomerTypes(raw?: unknown): CustomerType[] {
  if (!Array.isArray(raw)) return [];
  const validSet = new Set<CustomerType>();
  for (const item of raw) {
    if (item === 'cash_sale' || item === 'credit_sale' || item === 'sale_proceeds') {
      validSet.add(item);
    }
  }
  // Keep canonical display order
  return ALL_CUSTOMER_TYPES.filter((t) => validSet.has(t));
}

export function getEffectiveCustomerTypes(
  customer: Pick<Customer, 'customerTypes'> | null | undefined
): CustomerType[] {
  if (!customer) return [];
  if (Array.isArray(customer.customerTypes)) {
    return normalizeCustomerTypes(customer.customerTypes);
  }
  return ['credit_sale'];
}

export function customerHasType(
  customer: Pick<Customer, 'customerTypes'> | null | undefined,
  required?: CustomerType | CustomerType[]
): boolean {
  if (!customer) return false;
  if (!required) return true;
  const types = getEffectiveCustomerTypes(customer);
  if (Array.isArray(required)) {
    if (required.length === 0) return true;
    return required.some((req) => types.includes(req));
  }
  return types.includes(required);
}

export function formatCustomerTypesLabel(types?: CustomerType[]): string {
  const normalized = normalizeCustomerTypes(types);
  if (normalized.length === 0) return 'Unassigned';
  return normalized.map((t) => getCustomerTypeMeta(t).label).join(', ');
}

export function parseCustomerTypesFromText(raw?: unknown): CustomerType[] {
  if (Array.isArray(raw)) {
    return normalizeCustomerTypes(raw);
  }
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  const tokens = raw
    .toLowerCase()
    .split(/[,;|+/]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const result = new Set<CustomerType>();
  for (const tok of tokens) {
    if (tok.includes('cash')) result.add('cash_sale');
    if (tok.includes('credit')) result.add('credit_sale');
    if (tok.includes('proceed') || tok === 'sp') result.add('sale_proceeds');
  }
  return ALL_CUSTOMER_TYPES.filter((t) => result.has(t));
}
