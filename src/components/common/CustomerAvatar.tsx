import React, { useState, useEffect } from 'react';
import { User } from 'lucide-react';

interface CustomerAvatarProps {
  photo?: string;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export function getCustomerInitials(name?: string | null): string {
  if (!name) return '?';
  const trimmed = name.trim();
  if (!trimmed) return '?';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }
  // Use first letter of first name and first letter of second name/word
  // e.g. "Virendra Patel" -> "VP", "Amit Kumar Sharma" -> "AK", "Ravi" -> "R"
  return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
}

export const CustomerAvatar: React.FC<CustomerAvatarProps> = ({
  photo,
  name,
  size = 'md',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [photo]);

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs font-semibold',
    md: 'w-10 h-10 text-sm font-bold',
    lg: 'w-12 h-12 text-base font-bold',
    xl: 'w-16 h-16 text-lg font-bold',
  }[size];

  const iconSizes = {
    xs: 'h-3 w-3',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6',
    xl: 'h-8 w-8',
  }[size];

  const hasPhoto = Boolean(
    !imageError &&
      photo &&
      (photo.startsWith('data:') || photo.startsWith('/') || photo.startsWith('http'))
  );

  if (hasPhoto) {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden shadow-2xs select-none ${sizeClasses} ${className}`}
      >
        <img
          src={photo}
          alt={name ? `${name}'s photo` : 'Customer photo'}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  const initials = getCustomerInitials(name);

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-300 dark:border-emerald-700/80 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 font-bold shadow-2xs select-none ${sizeClasses} ${className}`}
      title={name || 'Customer'}
      aria-label={name ? `${name} avatar` : 'Customer avatar'}
    >
      {initials && initials !== '?' ? (
        <span>{initials}</span>
      ) : (
        <User className={`${iconSizes} text-emerald-600 dark:text-emerald-400`} />
      )}
    </div>
  );
};

