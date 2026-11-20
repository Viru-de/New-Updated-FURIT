import React from 'react';
import { CompanyProfile } from '../../types';
import { BillPaperSize } from '../../utils/pdfAndShareEngine';
import { CompanyContactsHeader } from './CompanyContactsHeader';

interface PrintBusinessHeaderProps {
  profile?: Partial<CompanyProfile> | null;
  variant?: 'bill' | 'ledger';
  paperSize?: BillPaperSize;
  className?: string;
}

/**
 * Shared traditional wholesale fruit-market business header used across all
 * Bill (Sale Proceed, Cash Sale, Credit Sale, Receipt) and Ledger (Detailed & Short) print views.
 *
 * Two-Column Layout:
 * - LEFT SIDE: Logo (if present), Short Code (e.g. HFC / JD), Bold English Name, Hindi Name
 * - RIGHT SIDE: Complete Business Address, Configured Contact Number(s)
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
  const addressLine = [profile.address, profile.city, profile.state]
    .map((part) => (part || '').trim())
    .filter(Boolean)
    .join(', ');

  const showShortLabel =
    Boolean(shortLabel) && shortLabel.toUpperCase() !== englishName.toUpperCase();

  const isBill = variant === 'bill';
  const isB7 = isBill && paperSize === 'b7';
  const isB6 = isBill && paperSize === 'b6';
  const isA5Bill = isBill && paperSize === 'a5';
  const isA4Bill = isBill && paperSize === 'a4';

  const logoSizeClass = !isBill
    ? 'w-11 h-11 sm:w-12 sm:h-12 print:w-11 print:h-11'
    : isB7
    ? 'w-6 h-6 print:w-6 print:h-6'
    : isB6
    ? 'w-8 h-8 print:w-8 print:h-8'
    : isA5Bill
    ? 'w-9 h-9 print:w-9 print:h-9'
    : isA4Bill
    ? 'w-11 h-11 sm:w-12 sm:h-12 print:w-11 print:h-11'
    : 'w-9 h-9 sm:w-10 sm:h-10 print:w-9 print:h-9';

  const shortClass = !isBill
    ? 'text-[13px] sm:text-[14px] print:text-[14px] tracking-[0.18em]'
    : isB7
    ? 'text-[8.5px] print:text-[9px] tracking-[0.14em]'
    : isB6
    ? 'text-[10px] print:text-[10.5px] tracking-[0.16em]'
    : isA5Bill
    ? 'text-[11px] sm:text-[12px] print:text-[12px] tracking-[0.16em]'
    : isA4Bill
    ? 'text-[13px] sm:text-[14px] print:text-[14px] tracking-[0.18em]'
    : 'text-[11.5px] sm:text-[12.5px] print:text-[12px] tracking-[0.16em]';

  const englishClass = !isBill
    ? 'text-[19px] sm:text-[21px] print:text-[20px]'
    : isB7
    ? 'text-[10.5px] print:text-[11px]'
    : isB6
    ? 'text-[13px] print:text-[13.5px]'
    : isA5Bill
    ? 'text-[15px] sm:text-[16px] print:text-[16px]'
    : isA4Bill
    ? 'text-[19px] sm:text-[21px] print:text-[20px]'
    : 'text-[15.5px] sm:text-[17px] print:text-[16.5px]';

  const hindiClass = !isBill
    ? 'text-[14.5px] sm:text-[16px] print:text-[15.5px]'
    : isB7
    ? 'text-[8.5px] print:text-[9px]'
    : isB6
    ? 'text-[10.5px] print:text-[11px]'
    : isA5Bill
    ? 'text-[12px] sm:text-[13px] print:text-[12.5px]'
    : isA4Bill
    ? 'text-[14.5px] sm:text-[16px] print:text-[15.5px]'
    : 'text-[12.5px] sm:text-[13.5px] print:text-[13px]';

  const addressClass = !isBill
    ? 'text-[11px] sm:text-[12px] print:text-[11.5px]'
    : isB7
    ? 'text-[7px] print:text-[7.5px]'
    : isB6
    ? 'text-[8.5px] print:text-[9px]'
    : isA5Bill
    ? 'text-[9.5px] sm:text-[10px] print:text-[9.5px]'
    : isA4Bill
    ? 'text-[11px] sm:text-[12px] print:text-[11.5px]'
    : 'text-[10px] sm:text-[10.5px] print:text-[10px]';

  const contactClass = !isBill
    ? 'text-[10.5px] sm:text-[11.5px] print:text-[11px] font-semibold text-black'
    : isB7
    ? 'text-[7px] print:text-[7px] font-semibold text-black'
    : isB6
    ? 'text-[8px] print:text-[8.5px] font-semibold text-black'
    : isA5Bill
    ? 'text-[9px] sm:text-[9.5px] print:text-[9px] font-semibold text-black'
    : isA4Bill
    ? 'text-[10.5px] sm:text-[11.5px] print:text-[11px] font-semibold text-black'
    : 'text-[9.5px] sm:text-[10px] print:text-[9.5px] font-semibold text-black';

  return (
    <div
      className={`print-business-header flex items-center justify-between border-b border-black mt-0 pt-0 ${
        isB7
          ? 'gap-2 pb-1 mb-0.5'
          : isB6
          ? 'gap-2.5 pb-1 mb-0.5'
          : isA5Bill
          ? 'gap-3 pb-1 mb-0.5'
          : 'gap-4 sm:gap-5 pb-1.5 mb-1'
      } ${className}`}
    >
      {/* LEFT SIDE: Logo (if present) + Short Code + English Name + Hindi Name */}
      <div
        className={`print-business-header-left flex items-center min-w-0 flex-1 text-left m-0 p-0 ${
          isB7 ? 'gap-1.5' : isA5Bill ? 'gap-2' : 'gap-2.5 sm:gap-3'
        }`}
      >
        {logoSrc && (
          <img
            src={logoSrc}
            alt={shortLabel || englishName || 'Company Logo'}
            className={`block shrink-0 object-contain rounded-full m-0 ${logoSizeClass}`}
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
              className={`font-black uppercase tracking-wide text-black leading-[1.15] m-0 p-0 break-words ${
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
      <div
        className={`print-business-header-right shrink-0 text-right flex flex-col items-end justify-center min-w-0 m-0 p-0 ${
          isB7 ? 'max-w-[46%]' : isB6 ? 'max-w-[47%]' : 'max-w-[48%]'
        }`}
      >
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
