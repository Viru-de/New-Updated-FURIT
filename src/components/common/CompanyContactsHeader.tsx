import React from 'react';
import { CompanyProfile } from '../../types';

export interface CompanyContactItem {
  id: 'primary' | 'alt1' | 'alt2';
  text: string;
}

/**
 * Extracts and formats all completed company contact entries (Primary, Alternate 1, Alternate 2)
 * following the exact business specifications:
 * - With name: "Contact: Rajesh — Mobile: 9820012345"
 * - Without name: "Mobile: 9820012345"
 * - Alternate with name: "Alternate 1: Suresh — Mobile: 9876543210"
 * - Alternate without name: "Alternate 1 Mobile: 9876543210"
 * - If name exists but number is blank, incomplete row is NEVER emitted.
 * - Empty rows, undefined, or nulls are never emitted.
 */
export function getCompanyContactEntries(profile?: Partial<CompanyProfile> | null): CompanyContactItem[] {
  if (!profile) return [];
  const entries: CompanyContactItem[] = [];

  // 1. Primary Contact
  const pMobile = (profile.mobile || '').trim();
  const pName = (profile.primaryContactName || '').trim();
  if (pMobile) {
    const text = pName ? `${pName}: ${pMobile}` : `Contact: ${pMobile}`;
    entries.push({ id: 'primary', text });
  }

  // 2. Alternate 1 Contact (No "Alt" label; show Name: Mobile or Mobile only)
  const alt1Mobile = (profile.alternate1Mobile || profile.alternateMobile || '').trim();
  const alt1Name = (profile.alternate1ContactName || '').trim();
  if (alt1Mobile && alt1Mobile !== pMobile) {
    const text = alt1Name ? `${alt1Name}: ${alt1Mobile}` : alt1Mobile;
    entries.push({ id: 'alt1', text });
  }

  // 3. Alternate 2 Contact (No "Alt" label; show Name: Mobile or Mobile only)
  const alt2Mobile = (profile.alternate2Mobile || '').trim();
  const alt2Name = (profile.alternate2ContactName || '').trim();
  if (alt2Mobile && alt2Mobile !== pMobile && alt2Mobile !== alt1Mobile) {
    const text = alt2Name ? `${alt2Name}: ${alt2Mobile}` : alt2Mobile;
    entries.push({ id: 'alt2', text });
  }

  return entries;
}

/**
 * Returns all available company contact numbers formatted in a single inline horizontal string:
 * E.g. "Contact: 9876543210 | Nikita: 9123456780 | Rahul: 9988776655"
 */
export function formatCompanyContactsInline(profile?: Partial<CompanyProfile> | null): string {
  return getCompanyContactEntries(profile)
    .map((e) => e.text)
    .join(' | ');
}

interface CompanyContactsHeaderProps {
  profile?: Partial<CompanyProfile> | null;
  className?: string;
  itemClassName?: string;
}

export const CompanyContactsHeader: React.FC<CompanyContactsHeaderProps> = ({
  profile,
  className = '',
  itemClassName = '',
}) => {
  const entries = getCompanyContactEntries(profile);
  if (entries.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-0.5 text-center leading-snug ${className}`}
    >
      {entries.map((entry, idx) => (
        <React.Fragment key={entry.id}>
          {idx > 0 && (
            <span className="text-slate-400 print:text-black font-normal select-none" aria-hidden="true">
              |
            </span>
          )}
          <span
            className={`text-[10px] sm:text-[11px] font-medium text-slate-800 dark:text-slate-800 print:text-black whitespace-nowrap ${itemClassName}`}
          >
            {entry.text}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
};
