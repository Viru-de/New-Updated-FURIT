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
    if (pName) {
      entries.push({ id: 'primary', text: `Contact: ${pName} — Mobile: ${pMobile}` });
    } else {
      entries.push({ id: 'primary', text: `Mobile: ${pMobile}` });
    }
  }

  // 2. Alternate 1 Contact
  const alt1Mobile = (profile.alternate1Mobile || profile.alternateMobile || '').trim();
  const alt1Name = (profile.alternate1ContactName || '').trim();
  if (alt1Mobile) {
    if (alt1Name) {
      entries.push({ id: 'alt1', text: `Alternate 1: ${alt1Name} — Mobile: ${alt1Mobile}` });
    } else {
      entries.push({ id: 'alt1', text: `Alternate 1 Mobile: ${alt1Mobile}` });
    }
  }

  // 3. Alternate 2 Contact
  const alt2Mobile = (profile.alternate2Mobile || '').trim();
  const alt2Name = (profile.alternate2ContactName || '').trim();
  if (alt2Mobile) {
    if (alt2Name) {
      entries.push({ id: 'alt2', text: `Alternate 2: ${alt2Name} — Mobile: ${alt2Mobile}` });
    } else {
      entries.push({ id: 'alt2', text: `Alternate 2 Mobile: ${alt2Mobile}` });
    }
  }

  return entries;
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
    <div className={`space-y-0.5 ${className}`}>
      {entries.map((entry) => (
        <div
          key={entry.id}
          className={`text-[11px] font-medium text-slate-800 dark:text-slate-800 print:text-black leading-snug ${itemClassName}`}
        >
          {entry.text}
        </div>
      ))}
    </div>
  );
};
