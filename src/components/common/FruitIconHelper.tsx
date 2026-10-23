import React from 'react';

export interface FruitIconDef {
  id: string;
  name: string;
  emoji: string;
  color: string;
  bgColor: string;
}

export const BUILTIN_FRUIT_ICONS: FruitIconDef[] = [
  { id: 'apple', name: 'Apple', emoji: '🍎', color: '#dc2626', bgColor: '#fee2e2' },
  { id: 'mango', name: 'Mango', emoji: '🥭', color: '#ea580c', bgColor: '#ffedd5' },
  { id: 'banana', name: 'Banana', emoji: '🍌', color: '#ca8a04', bgColor: '#fef9c3' },
  { id: 'orange', name: 'Orange / Citrus', emoji: '🍊', color: '#ea580c', bgColor: '#ffedd5' },
  { id: 'grapes', name: 'Grapes', emoji: '🍇', color: '#9333ea', bgColor: '#f3e8ff' },
  { id: 'strawberry', name: 'Strawberry', emoji: '🍓', color: '#e11d48', bgColor: '#ffe4e6' },
  { id: 'watermelon', name: 'Watermelon', emoji: '🍉', color: '#16a34a', bgColor: '#dcfce7' },
  { id: 'papaya', name: 'Papaya', emoji: '🍈', color: '#d97706', bgColor: '#fef3c7' },
  { id: 'pineapple', name: 'Pineapple', emoji: '🍍', color: '#ca8a04', bgColor: '#fef9c3' },
  { id: 'pomegranate', name: 'Pomegranate', emoji: '🍒', color: '#b91c1c', bgColor: '#fee2e2' },
  { id: 'lemon', name: 'Lemon / Mosambi', emoji: '🍋', color: '#ca8a04', bgColor: '#fef9c3' },
  { id: 'kiwi', name: 'Kiwi', emoji: '🥝', color: '#65a30d', bgColor: '#ecfccb' },
  { id: 'peach', name: 'Peach / Chikoo', emoji: '🍑', color: '#f97316', bgColor: '#ffedd5' },
  { id: 'guava', name: 'Guava / Pear', emoji: '🍐', color: '#16a34a', bgColor: '#dcfce7' },
  { id: 'coconut', name: 'Coconut', emoji: '🥥', color: '#78350f', bgColor: '#fef3c7' },
];

/**
 * Returns a fallback icon based on fruit name if none specified.
 */
export function getFruitIconFromName(name: string): FruitIconDef {
  const lower = name.toLowerCase();
  if (lower.includes('apple') || lower.includes('seb')) return BUILTIN_FRUIT_ICONS[0];
  if (lower.includes('mango') || lower.includes('aam')) return BUILTIN_FRUIT_ICONS[1];
  if (lower.includes('banana') || lower.includes('kela')) return BUILTIN_FRUIT_ICONS[2];
  if (lower.includes('orange') || lower.includes('sant') || lower.includes('kinnow') || lower.includes('citrus')) return BUILTIN_FRUIT_ICONS[3];
  if (lower.includes('grape') || lower.includes('angoor')) return BUILTIN_FRUIT_ICONS[4];
  if (lower.includes('straw') || lower.includes('berry')) return BUILTIN_FRUIT_ICONS[5];
  if (lower.includes('water') || lower.includes('tarbooz') || lower.includes('melon')) return BUILTIN_FRUIT_ICONS[6];
  if (lower.includes('papaya') || lower.includes('papita')) return BUILTIN_FRUIT_ICONS[7];
  if (lower.includes('pine') || lower.includes('ananas')) return BUILTIN_FRUIT_ICONS[8];
  if (lower.includes('pomegranate') || lower.includes('anar')) return BUILTIN_FRUIT_ICONS[9];
  if (lower.includes('lemon') || lower.includes('nimbu') || lower.includes('mosambi')) return BUILTIN_FRUIT_ICONS[10];
  if (lower.includes('kiwi')) return BUILTIN_FRUIT_ICONS[11];
  if (lower.includes('chikoo') || lower.includes('peach') || lower.includes('aadu')) return BUILTIN_FRUIT_ICONS[12];
  if (lower.includes('guava') || lower.includes('amrood') || lower.includes('pear') || lower.includes('nashpati')) return BUILTIN_FRUIT_ICONS[13];
  return BUILTIN_FRUIT_ICONS[0]; // default apple
}

interface FruitBadgeProps {
  fruitIcon?: string;
  fruitName?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export const FruitBadge: React.FC<FruitBadgeProps> = ({
  fruitIcon,
  fruitName = 'Fruit',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'w-5 h-5 text-xs',
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-xl',
  }[size];

  // If fruitIcon is a custom uploaded image (data:image or http/path)
  if (fruitIcon && (fruitIcon.startsWith('data:') || fruitIcon.startsWith('/') || fruitIcon.startsWith('http'))) {
    return (
      <div
        className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white overflow-hidden shadow-2xs ${sizeClasses} ${className}`}
      >
        <img
          src={fruitIcon}
          alt={fruitName}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      </div>
    );
  }

  // If fruitIcon is a preset ID
  const matched = fruitIcon ? BUILTIN_FRUIT_ICONS.find((b) => b.id === fruitIcon) : null;
  const iconDef = matched || getFruitIconFromName(fruitName);

  return (
    <div
      className={`inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-200/80 shadow-2xs ${sizeClasses} ${className}`}
      style={{ backgroundColor: iconDef.bgColor }}
      title={`${fruitName} (${iconDef.name})`}
    >
      <span className="select-none leading-none" role="img" aria-label={iconDef.name}>
        {iconDef.emoji}
      </span>
    </div>
  );
};
