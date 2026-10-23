/**
 * Utility functions for Indian currency, dates, and number formatting.
 */

export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '';
  }
  
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format in Indian number system with 2 decimals
  const fixed = absAmount.toFixed(2);
  const [integerPart, decimalPart] = fixed.split('.');
  
  let result = '';
  if (integerPart.length <= 3) {
    result = integerPart;
  } else {
    const lastThree = integerPart.substring(integerPart.length - 3);
    const otherNumbers = integerPart.substring(0, integerPart.length - 3);
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = formattedOther + ',' + lastThree;
  }
  
  const formattedWithDecimals = `${result}.${decimalPart}`;
  return isNegative ? `-₹${formattedWithDecimals}` : `₹${formattedWithDecimals}`;
}

export function formatQuantity(qty: number | null | undefined): string {
  if (qty === null || qty === undefined || isNaN(qty)) return '0';
  return Number.isInteger(qty) ? qty.toString() : qty.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Format ISO date string (YYYY-MM-DD) to Indian DD-MM-YYYY
 */
export function formatDate(isoDateString: string | null | undefined): string {
  if (!isoDateString) return '';
  // If already DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(isoDateString)) {
    return isoDateString;
  }
  try {
    const parts = isoDateString.split('T')[0].split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}`;
    }
  } catch {
    // fallback
  }
  return isoDateString;
}

/**
 * Convert DD-MM-YYYY to YYYY-MM-DD for standard date input
 */
export function toIsoDate(ddMmYyyy: string): string {
  if (!ddMmYyyy) return getTodayIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(ddMmYyyy)) {
    return ddMmYyyy;
  }
  const parts = ddMmYyyy.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return ddMmYyyy;
}

export function getTodayIso(): string {
  // Respect user prompt current date anchor: 2026-10-08
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getTodayDisplay(): string {
  return formatDate(getTodayIso());
}

/**
 * Compare two dates for chronological sorting
 */
export function compareDates(dateA: string, dateB: string): number {
  const isoA = toIsoDate(dateA);
  const isoB = toIsoDate(dateB);
  return isoA.localeCompare(isoB);
}

/**
 * Generate serial formatted code like "001", "002"
 */
export function formatSequence(seq: number | string, digits: number = 3): string {
  const num = typeof seq === 'string' ? parseInt(seq, 10) || 0 : seq;
  return String(num).padStart(digits, '0');
}

/**
 * Convert number to Indian English words: e.g. Rs Four Thousand Seventy Only
 */
export function numberToWordsIndian(amount: number): string {
  if (isNaN(amount) || amount === 0) return 'Rs Zero Only';
  const isNegative = amount < 0;
  const abs = Math.round(Math.abs(amount));

  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertTwoDigits(num: number): string {
    if (num < 20) return ones[num];
    const t = tens[Math.floor(num / 10)];
    const o = ones[num % 10];
    return o ? `${t} ${o}` : t;
  }

  function convertThreeDigits(num: number): string {
    const h = Math.floor(num / 100);
    const rest = num % 100;
    if (h > 0 && rest > 0) return `${ones[h]} Hundred ${convertTwoDigits(rest)}`;
    if (h > 0) return `${ones[h]} Hundred`;
    return convertTwoDigits(rest);
  }

  const crore = Math.floor(abs / 10000000);
  let remainder = abs % 10000000;
  const lakh = Math.floor(remainder / 100000);
  remainder = remainder % 100000;
  const thousand = Math.floor(remainder / 1000);
  remainder = remainder % 1000;
  const hundreds = remainder;

  let words = '';
  if (crore > 0) words += `${convertTwoDigits(crore)} Crore `;
  if (lakh > 0) words += `${convertTwoDigits(lakh)} Lakh `;
  if (thousand > 0) words += `${convertTwoDigits(thousand)} Thousand `;
  if (hundreds > 0) words += `${convertThreeDigits(hundreds)} `;

  words = words.trim();
  return `${isNegative ? 'Minus ' : ''}Rs ${words} Only`;
}

/**
 * Format plain 2-decimal accounting numbers for traditional mandi bills (e.g. 4186.00, -116.00)
 */
export function formatBillAmount(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return '0.00';
  return amount.toFixed(2);
}
