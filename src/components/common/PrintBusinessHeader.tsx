import React from 'react';
import { CompanyProfile } from '../../types';
import { BillPaperSize } from '../../utils/pdfAndShareEngine';
import { CompanyContactsHeader } from './CompanyContactsHeader';

interface PrintBusinessHeaderProps {
  profile?: Partial<CompanyProfile> | null;
  variant?: 'bill' | 'ledger' | 'ledger-centered';
  paperSize?: BillPaperSize;
  className?: string;
}

/**
 * Shared traditional wholesale fruit-market business header used across all
 * Bill (Sale Proceed, Cash Sale, Credit Sale, Receipt, Tax Invoice) and
 * Ledger (Detailed & Short) print views.
 *
 * - Bill (`variant="bill"`): Classic centered single vertical sequence (no logo, starts near top):
 *   Short Code (e.g. HFC / JD) -> English Name -> Hindi Name -> Address -> Contacts
 * - Customer / Sale Proceed Ledger (`variant="ledger-centered"`): Centered vertical sequence:
 *   Short Code -> English Name -> Hindi Name -> Complete Address -> Contacts
 * - Other Reports / Statements (`variant="ledger"`): Two-column layout:
 *   LEFT SIDE: Logo (if present), Short Code, Bold English Name, Hindi Name
 *   RIGHT SIDE: Complete Business Address, Configured Contact Number(s)
 */
export const PrintBusinessHeader: React.FC<PrintBusinessHeaderProps> = ({
  profile,
  variant = 'ledger',
  paperSize = 'a5',
  className = '',
}) => {
  if (!profile) return null;

  const logoSrc = (profile.logo || '').trim();
  const shortLabel = (profile.shortName || profile.shortCode || '').trim();
  const englishName = (profile.name || profile.tradeName || '').trim();
  const hindiName = (profile.hindiName || '').trim();
  const rawAddressParts = [profile.address, profile.city, profile.state]
    .map((part) => (part || '').trim())
    .filter(Boolean);
  const dedupedAddressParts: string[] = [];
  for (const part of rawAddressParts) {
    const lowerPart = part.toLowerCase();
    if (!dedupedAddressParts.some((existing) => existing.toLowerCase().includes(lowerPart))) {
      dedupedAddressParts.push(part);
    }
  }
  const addressLine = dedupedAddressParts.join(', ');

  const showShortLabel =
    Boolean(shortLabel) && shortLabel.toUpperCase() !== englishName.toUpperCase();

  const isBill = variant === 'bill';
  const isLedgerCentered = variant === 'ledger-centered';
  const isB7 = isBill && paperSize === 'b7';
  const isB6 = isBill && paperSize === 'b6';
  const isA5Bill = isBill && paperSize === 'a5';
  const isA4Bill = isBill && paperSize === 'a4';

  const ledgerLogoSizeClass = 'w-11 h-11 sm:w-12 sm:h-12 print:w-11 print:h-11';

  const shortClass = isLedgerCentered
    ? 'text-[19px] sm:text-[21px] print:text-[20px] tracking-[0.14em]'
    : !isBill
    ? 'text-[13px] sm:text-[14px] print:text-[13.5px] tracking-[0.18em]'
    : isB7
    ? 'text-[12px] print:text-[12px] tracking-[0.10em]'
    : isB6
    ? 'text-[14px] print:text-[14.5px] tracking-[0.12em]'
    : isA5Bill
    ? 'text-[17px] sm:text-[18px] print:text-[17.5px] tracking-[0.14em]'
    : isA4Bill
    ? 'text-[19px] sm:text-[21px] print:text-[21px] tracking-[0.14em]'
    : 'text-[17px] sm:text-[18.5px] print:text-[18px] tracking-[0.14em]';

  const englishClass = !isBill
    ? 'text-[19px] sm:text-[21px] print:text-[20px]'
    : isB7
    ? 'text-[11px] print:text-[11.5px]'
    : isB6
    ? 'text-[13.5px] print:text-[14px]'
    : isA5Bill
    ? 'text-base sm:text-[17px] print:text-[16.5px]'
    : isA4Bill
    ? 'text-lg sm:text-xl print:text-[20px]'
    : 'text-base sm:text-lg print:text-[17px]';

  const hindiClass = !isBill
    ? 'text-[14.5px] sm:text-[16px] print:text-[15.5px]'
    : isB7
    ? 'text-[9px] print:text-[9.5px]'
    : isB6
    ? 'text-[11px] print:text-[11.5px]'
    : isA5Bill
    ? 'text-[13px] sm:text-[14px] print:text-[13.5px]'
    : isA4Bill
    ? 'text-base sm:text-lg print:text-[16px]'
    : 'text-sm sm:text-base print:text-[14px]';

  const addressClass = !isBill
    ? 'text-[11px] sm:text-[12px] print:text-[11.5px]'
    : isB7
    ? 'text-[7.5px] print:text-[8px]'
    : isB6
    ? 'text-[9px] print:text-[9.5px]'
    : isA5Bill
    ? 'text-[10px] sm:text-[10.5px] print:text-[10px]'
    : isA4Bill
    ? 'text-[11px] sm:text-[12px] print:text-[11.5px]'
    : 'text-[10.5px] sm:text-[11px] print:text-[10.5px]';

  const contactClass = !isBill
    ? 'text-[10.5px] sm:text-[11.5px] print:text-[11px] font-semibold text-black'
    : isB7
    ? 'text-[6.5px] print:text-[7px] tracking-tight font-medium text-slate-800 dark:text-slate-800 print:text-black'
    : isB6
    ? 'text-[8.5px] print:text-[9px] font-medium text-slate-800 dark:text-slate-800 print:text-black'
    : isA5Bill
    ? 'text-[9.5px] sm:text-[10px] print:text-[9.5px] font-medium text-slate-800 dark:text-slate-800 print:text-black'
    : isA4Bill
    ? 'text-[10.5px] sm:text-[11px] print:text-[11px] font-medium text-slate-800 dark:text-slate-800 print:text-black'
    : 'text-[10px] sm:text-[10.5px] print:text-[10px] font-medium text-slate-800 dark:text-slate-800 print:text-black';

  if (isBill || isLedgerCentered) {
    return (
      <div
        className={`print-business-header ${
          isLedgerCentered
            ? 'print-business-header--ledger-centered pb-1.5 mb-1 pt-1'
            : `print-business-header--bill ${isB7 ? 'pb-0.5 mb-0.5' : 'pb-1 mb-0.5'} pt-0`
        } text-center border-b border-black mt-0 ${className}`}
      >
        {showShortLabel && (
          <div
            className={`print-business-short-name font-black text-slate-950 dark:text-slate-950 uppercase print:text-black leading-[1.22] break-words overflow-visible pt-[2px] m-0 px-0 pb-0 ${shortClass}`}
          >
            {shortLabel}
          </div>
        )}

        {englishName && (
          <h1
            className={`font-black tracking-wide text-slate-950 dark:text-slate-950 print:text-black leading-[1.12] m-0 p-0 break-words ${
              showShortLabel ? 'mt-0.5' : 'mt-0'
            } ${englishClass}`}
          >
            {englishName}
          </h1>
        )}

        {hindiName && (
          <div
            className={`font-bold tracking-wide font-devanagari text-slate-900 dark:text-slate-900 print:text-black leading-tight m-0 p-0 mt-0.5 break-words ${hindiClass}`}
          >
            {hindiName}
          </div>
        )}

        {addressLine && (
          <div
            className={`${isLedgerCentered ? 'font-semibold text-black' : 'font-medium text-slate-800 dark:text-slate-800 print:text-black'} leading-snug break-words m-0 p-0 mt-0.5 ${addressClass}`}
          >
            {addressLine}
          </div>
        )}

        <CompanyContactsHeader
          profile={profile}
          align="center"
          className="mt-0.5 w-full"
          itemClassName={contactClass}
        />
      </div>
    );
  }

  return (
    <div
      className={`print-business-header print-business-header--ledger flex items-center justify-between border-b border-black mt-0 pt-0 gap-4 sm:gap-5 pb-1.5 mb-1 ${className}`}
    >
      {/* LEFT SIDE: Logo (if present) + Short Code + English Name + Hindi Name */}
      <div className="print-business-header-left flex items-center min-w-0 flex-1 text-left m-0 p-0 gap-2.5 sm:gap-3">
        {logoSrc && (
          <img
            src={logoSrc}
            alt={shortLabel || englishName || 'Company Logo'}
            className={`block shrink-0 object-contain rounded-full m-0 ${ledgerLogoSizeClass}`}
          />
        )}
        <div className="print-business-header-text min-w-0 flex-1 text-left m-0 p-0">
          {showShortLabel && (
            <div className={`font-black uppercase text-black leading-none m-0 p-0 ${shortClass}`}>
              {shortLabel}
            </div>
          )}

          {englishName && (
            <h1
              className={`font-black tracking-wide text-black leading-[1.15] m-0 p-0 break-words ${
                showShortLabel ? 'mt-0.5' : 'mt-0'
              } ${englishClass}`}
            >
              {englishName}
            </h1>
          )}

          {hindiName && (
            <div
              className={`font-bold tracking-wide font-devanagari text-black leading-tight m-0 p-0 mt-0.5 break-words ${hindiClass}`}
            >
              {hindiName}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT SIDE: Complete Address + Contact Details */}
      <div className="print-business-header-right shrink-0 text-right flex flex-col items-end justify-center min-w-0 m-0 p-0 max-w-[48%]">
        {addressLine && (
          <div className={`font-semibold text-black leading-snug text-right break-words m-0 p-0 w-full ${addressClass}`}>
            {addressLine}
          </div>
        )}

        <CompanyContactsHeader
          profile={profile}
          align="right"
          className="mt-0.5 w-full"
          itemClassName={contactClass}
        />
      </div>
    </div>
  );
};

