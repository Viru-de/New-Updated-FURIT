import { CashSale, CreditSale, LedgerEntry, Receipt, SaleProceeds } from '../types';

export interface ShortPrintParticularsInfo {
  primaryRef: string;
  accountRef: string;
  qty: number;
}

const KNOWN_PAYMENT_MODES_REGEX = /\((Cash Paid|Cash|UPI|Bank Transfer|Cheque|RTGS\/NEFT)\)/gi;

/**
 * Formats a payment mode or account name into a clean accounting account reference
 * (e.g. "Cash" -> "Cash A/c") without ever inventing one if missing.
 */
export function formatAccountReference(paymentMode?: string | null): string {
  const raw = (paymentMode || '').trim();
  if (!raw) return '';

  const lower = raw.toLowerCase();
  if (lower === 'cash' || lower === 'cash paid') return 'Cash A/c';
  if (lower === 'upi') return 'UPI A/c';
  if (lower === 'bank transfer' || lower === 'bank') return 'Bank A/c';
  if (lower === 'cheque') return 'Cheque A/c';
  if (lower === 'rtgs/neft' || lower === 'rtgs' || lower === 'neft') return 'RTGS/NEFT A/c';

  if (/\ba\/c$/i.test(raw)) return raw;
  return raw;
}

/**
 * Extracts a payment mode from parentheticals such as "Receipt No. 001 (Cash)"
 * or "Cash Sale No. 001 (Cash Paid)".
 */
export function extractPaymentModeFromText(text?: string | null): string {
  if (!text) return '';
  const matches = text.match(/\((Cash Paid|Cash|UPI|Bank Transfer|Cheque|RTGS\/NEFT)\)/i);
  return matches ? matches[1] : '';
}

/**
 * Strips bill numbers, crate out/in notes, and descriptive narration from raw text
 * while keeping essential document references or genuine account names intact.
 */
export function sanitizeShortPrintText(raw?: string | null): string {
  if (!raw) return '';
  let text = raw.trim();

  // Remove parenthetical bill references, crate movement tags, and redundant payment parentheticals
  text = text.replace(/\(\s*Bill\s*:[^)]*\)/gi, '');
  text = text.replace(/\(\s*(?:out|in)\s*:[^)]*\)/gi, '');
  text = text.replace(KNOWN_PAYMENT_MODES_REGEX, '');

  // If a document number / account reference is followed by descriptive narration after " - ", " — ", or " | ",
  // keep only the core document/account reference.
  const dashSplit = text.split(/\s+(?:-|—|\|)\s+/);
  if (dashSplit.length > 1) {
    const first = dashSplit[0].trim();
    if (
      /\b(?:No\.?\s*\d+|A\/c|Opening Balance|Sale Proceeds?|Credit Sale|Cash Sale|Receipt)\b/i.test(first)
    ) {
      text = first;
    }
  }

  return text
    .replace(/\s+/g, ' ')
    .replace(/^[\s·\-—:|]+|[\s·\-—:|]+$/g, '')
    .trim();
}

/**
 * Keeps Opening Balance label clean (preserves optional "b/f as on DD-MM-YYYY" date context,
 * removes any bill tags or narration).
 */
export function sanitizeOpeningBalanceLabel(raw?: string | null): string {
  if (!raw || !raw.trim()) return 'Opening Balance';
  let text = raw.trim();
  text = text.replace(/\(\s*Bill\s*:[^)]*\)/gi, '');
  text = text.replace(/\(\s*(?:out|in)\s*:[^)]*\)/gi, '');

  const dashSplit = text.split(/\s+(?:-|—|\|)\s+/);
  if (dashSplit.length > 1 && /opening balance/i.test(dashSplit[0])) {
    text = dashSplit[0];
  }

  text = text.replace(/\s+/g, ' ').trim();
  return text || 'Opening Balance';
}

/**
 * Strips crate direction words ("IN" / "OUT") from printed ledger particulars and crate details
 * without modifying quantities, balances, or stored database records.
 * Examples:
 * - "6 Out" -> "6"
 * - "10 In" -> "10"
 * - "Out, 6 In (Bal: 31)" -> "6 (Bal: 31)"
 */
export function stripLedgerCrateInOut(raw?: string | null): string {
  if (!raw) return '';
  let text = String(raw);
  // 1. "<number> Out" or "<number> In" -> "<number>"
  text = text.replace(/\b(\d+(?:\.\d+)?)\s+(?:Out|In)\b/gi, '$1');
  // 2. Prefix tags like "Crates OUT:" / "OUT:" / "IN:" -> ""
  text = text.replace(/\b(?:Crates?\s+)?(?:OUT|IN)\s*:\s*/gi, '');
  // 3. Uppercase "OUT 10" / "IN 4" or "Crate(s) Out/In" -> remove direction word
  text = text.replace(/\b(?:Crates?\s+)?(?:OUT|IN)\s+(?=\d)/g, '');
  text = text.replace(/\b(Crates?\s+)(?:Out|In)\b/gi, '$1');
  // 4. Orphaned "Out," / "In," or "Out" / "In" right before "(Bal" or separators or inside parens "(IN)"/"(OUT)"
  text = text.replace(/(^|[,;|(\[]\s*|\s+)(?:Out|In)\s*,\s*/gi, '$1');
  text = text.replace(/(^|[,;|(\[]\s*|\s+)(?:Out|In)(?=\s*(?:\(Bal\b|[,;|)\]]|$))/gi, '$1');
  text = text.replace(/\(\s*(?:IN|OUT)\s*\)/gi, '');
  // 5. Clean up redundant whitespace, empty parens, and stray delimiters
  text = text
    .replace(/\(\s*\)/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,;|)])/g, '$1')
    .replace(/([(|])\s+/g, '$1')
    .replace(/^[,\s;|]+|[,\s;|]+$/g, '')
    .trim();
  return text;
}

/**
 * Formats a bill crate movement line without "IN" or "OUT" labels,
 * preserving crate name, quantities, and remaining crate balance.
 */
export function formatBillCrateMovementText(movement: {
  crateName: string;
  outQuantity?: number;
  inQuantity?: number;
}): string {
  const cleanName = stripLedgerCrateInOut(movement.crateName) || movement.crateName;
  const outQty = Number(movement.outQuantity) || 0;
  const inQty = Number(movement.inQuantity) || 0;
  const bal = Math.max(0, outQty - inQty);
  const qtyParts: number[] = [];
  if (outQty > 0) qtyParts.push(outQty);
  if (inQty > 0) qtyParts.push(inQty);
  const qtyStr = qtyParts.length > 0 ? qtyParts.join(', ') : '0';
  return `${cleanName}: ${qtyStr} (${bal} Bal)`;
}

/**
 * Computes actual numeric transaction quantity for Short Print (0 for Opening Balance / Receipt).
 */
export function computeShortPrintQty(
  entry: LedgerEntry,
  record?: CreditSale | CashSale | SaleProceeds | null
): number {
  if (entry.referenceType === 'Opening Balance' || entry.referenceType === 'Receipt') {
    return 0;
  }

  if (record && 'items' in record && Array.isArray(record.items) && record.items.length > 0) {
    const sum = record.items.reduce((s, it) => s + (Number(it.quantity) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }

  if (entry.subDetails?.items && entry.subDetails.items.length > 0) {
    const sum = entry.subDetails.items.reduce((s, it) => s + (Number(it.qty) || 0), 0);
    return Math.round(sum * 1000) / 1000;
  }

  if (record && 'quantity' in record && typeof record.quantity === 'number') {
    return Math.round((Number(record.quantity) || 0) * 1000) / 1000;
  }

  return Math.round((Number(entry.subDetails?.qty) || 0) * 1000) / 1000;
}

/**
 * Formats Particulars for Sale Proceed Ledger – Short Print:
 * Keeps only essential Sale Proceed No. (+ genuine account ref if present) and numeric Qty.
 * Excludes fruit descriptions, units, weights, bill numbers, and remarks/notes.
 */
export function formatSaleProceedShortParticulars(
  entry: LedgerEntry,
  sp?: SaleProceeds,
  resolvedQty?: number
): ShortPrintParticularsInfo {
  if (entry.referenceType === 'Opening Balance') {
    return {
      primaryRef: sanitizeOpeningBalanceLabel(entry.particulars),
      accountRef: '',
      qty: 0,
    };
  }

  if (entry.referenceType === 'Sale Proceeds' || sp) {
    const rawNo = sp?.proceedsNo || entry.referenceNo || entry.particulars || '';
    const numMatch = rawNo.match(/\d+/);
    const formattedNo = numMatch ? numMatch[0].padStart(3, '0') : '';
    const primaryRef = formattedNo
      ? `Sale Proceed No. ${formattedNo}`
      : sanitizeShortPrintText(rawNo) || 'Sale Proceed';

    const accountRef = formatAccountReference(sp?.paymentMode);
    const qty =
      resolvedQty !== undefined
        ? Math.round((Number(resolvedQty) || 0) * 1000) / 1000
        : computeShortPrintQty(entry, sp);

    return {
      primaryRef,
      accountRef,
      qty: qty > 0 ? qty : 0,
    };
  }

  const fallbackQty = Math.round((Number(entry.subDetails?.qty) || 0) * 1000) / 1000;
  return {
    primaryRef: sanitizeShortPrintText(entry.particulars) || entry.referenceType || '',
    accountRef: '',
    qty: fallbackQty > 0 ? fallbackQty : 0,
  };
}

/**
 * Formats Particulars for Customer Ledger – Short Print:
 * Keeps only essential transaction/account reference (e.g. Cash A/c, Credit Sale No. 001, Receipt No. 001)
 * and actual transaction quantity (Qty: X) when applicable.
 * Excludes notes, bill refs, crate issue narration, and product/expense breakdowns.
 */
export function formatCustomerLedgerShortParticulars(
  entry: LedgerEntry,
  records: {
    csRecord?: CreditSale;
    cashRecord?: CashSale;
    spRecord?: SaleProceeds;
    receiptRecord?: Receipt;
  }
): ShortPrintParticularsInfo {
  const { csRecord, cashRecord, spRecord, receiptRecord } = records;

  if (entry.referenceType === 'Opening Balance') {
    return {
      primaryRef: sanitizeOpeningBalanceLabel(entry.particulars),
      accountRef: '',
      qty: 0,
    };
  }

  if (entry.referenceType === 'Credit Sale' || entry.referenceType === 'Group Sale') {
    const isGroup =
      entry.referenceType === 'Group Sale' ||
      csRecord?.saleType === 'group' ||
      csRecord?.isGroupSale === true;
    const rawNo = csRecord?.creditSaleNo || entry.referenceNo || entry.particulars || 'Credit Sale';
    const cleanNo = sanitizeShortPrintText(rawNo) || 'Credit Sale';
    const primaryRef =
      isGroup && !/\bgroup\s+sale\b/i.test(cleanNo) ? `${cleanNo} (Group Sale)` : cleanNo;
    const qty = computeShortPrintQty(entry, csRecord);
    return {
      primaryRef,
      accountRef: '',
      qty: qty > 0 ? qty : 0,
    };
  }

  if (entry.referenceType === 'Cash Sale') {
    const rawNo = cashRecord?.cashSaleNo || entry.referenceNo || entry.particulars || 'Cash Sale';
    const primaryRef = sanitizeShortPrintText(rawNo) || 'Cash Sale';
    const mode = cashRecord?.paymentMode || extractPaymentModeFromText(entry.particulars);
    const accountRef = formatAccountReference(mode);
    const qty = computeShortPrintQty(entry, cashRecord);
    return {
      primaryRef,
      accountRef,
      qty: qty > 0 ? qty : 0,
    };
  }

  if (entry.referenceType === 'Receipt') {
    const rawNo = receiptRecord?.receiptNo || entry.referenceNo || entry.particulars || 'Receipt';
    const primaryRef = sanitizeShortPrintText(rawNo) || 'Receipt';
    const mode = receiptRecord?.paymentMode || extractPaymentModeFromText(entry.particulars);
    const accountRef = formatAccountReference(mode);
    return {
      primaryRef,
      accountRef,
      qty: 0,
    };
  }

  if (entry.referenceType === 'Sale Proceeds') {
    const rawNo = spRecord?.proceedsNo || entry.referenceNo || entry.particulars || 'Sale Proceeds';
    const primaryRef = sanitizeShortPrintText(rawNo) || 'Sale Proceeds';
    const accountRef = formatAccountReference(spRecord?.paymentMode);
    const qty = computeShortPrintQty(entry, spRecord);
    return {
      primaryRef,
      accountRef,
      qty: qty > 0 ? qty : 0,
    };
  }

  const fallbackQty = computeShortPrintQty(entry, undefined);
  return {
    primaryRef: sanitizeShortPrintText(entry.particulars) || entry.referenceType || '',
    accountRef: '',
    qty: fallbackQty > 0 ? fallbackQty : 0,
  };
}
