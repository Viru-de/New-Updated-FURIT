/**
 * Aadhaar Card Number utilities for Hari Kripa Fruit ERP.
 * Provides safe masking (e.g. •••• •••• 1234 or XXXX-XXXX-1234) for ordinary views and reports
 * while preserving complete identification in authorized edit forms.
 */

export function maskAadhaar(val?: string | null): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (!trimmed) return '';

  // If 12-digit standard Aadhaar (with or without spaces)
  const digitsOnly = trimmed.replace(/\D/g, '');
  if (digitsOnly.length === 12) {
    return `•••• •••• ${digitsOnly.slice(8)}`;
  }

  // If already formatted with dashes/spaces
  if (trimmed.length > 4) {
    const last4 = trimmed.slice(-4);
    return `•••• •••• ${last4}`;
  }

  return trimmed;
}

export function formatAadhaarInput(val: string): string {
  const digits = val.replace(/\D/g, '').slice(0, 12);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(' ');
}

export function cleanAadhaar(val?: string | null): string {
  if (!val) return '';
  return val.replace(/\D/g, '').slice(0, 12);
}

export function validateAadhaarNumber(val?: string | null): { isValid: boolean; error?: string } {
  if (!val || !val.trim()) return { isValid: true };
  const digits = val.replace(/\D/g, '');
  if (digits.length !== 12) {
    return {
      isValid: false,
      error: 'Aadhaar Card No. must be exactly 12 digits (e.g. 2345 6789 0123).',
    };
  }
  return { isValid: true };
}
