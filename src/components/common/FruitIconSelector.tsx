import React, { useState } from 'react';
import { BUILTIN_FRUIT_ICONS, FruitIconDef } from './FruitIconHelper';
import { ImageUploader } from './ImageUploader';
import { Apple, Grid, Upload } from 'lucide-react';

interface FruitIconSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  fruitName?: string;
}

export const FruitIconSelector: React.FC<FruitIconSelectorProps> = ({
  value,
  onChange,
  fruitName = '',
}) => {
  const isCustomUpload =
    value && (value.startsWith('data:') || value.startsWith('/') || value.startsWith('http'));

  const [mode, setMode] = useState<'preset' | 'upload'>(isCustomUpload ? 'upload' : 'preset');

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Apple className="h-4 w-4 text-emerald-600" />
          Fruit Icon / Image
        </label>

        {/* Tab switch */}
        <div className="flex items-center gap-1 rounded-lg bg-slate-200/80 p-0.5 text-[11px] font-semibold dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setMode('preset')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all ${
              mode === 'preset'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Grid className="h-3 w-3" /> Built-in Icon
          </button>
          <button
            type="button"
            onClick={() => setMode('upload')}
            className={`flex items-center gap-1 rounded-md px-2.5 py-1 transition-all ${
              mode === 'upload'
                ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-700 dark:text-white'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            <Upload className="h-3 w-3" /> Custom Image
          </button>
        </div>
      </div>

      {mode === 'preset' ? (
        <div className="space-y-2">
          <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 max-h-36 overflow-y-auto p-1">
            {BUILTIN_FRUIT_ICONS.map((icon) => {
              const isSelected = value === icon.id;
              return (
                <button
                  key={icon.id}
                  type="button"
                  onClick={() => onChange(icon.id)}
                  title={icon.name}
                  className={`flex flex-col items-center justify-center p-2 rounded-lg border text-base transition-all ${
                    isSelected
                      ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/30 dark:bg-emerald-950/40'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800'
                  }`}
                >
                  <span className="text-xl leading-none select-none">{icon.emoji}</span>
                  <span className="text-[10px] mt-1 text-slate-600 truncate max-w-full dark:text-slate-300">
                    {icon.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
          {value && !isCustomUpload && (
            <div className="flex justify-between items-center text-xs text-slate-500 pt-1 border-t border-slate-200/60 dark:border-slate-800">
              <span>
                Selected Icon:{' '}
                <strong className="text-slate-800 dark:text-slate-200 capitalize">
                  {value}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="text-rose-600 hover:underline text-[11px]"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          <ImageUploader
            label=""
            helperText="Upload any fruit photo (Apple, Mango, Banana, etc.). Resized for fast loading."
            currentValue={isCustomUpload ? value : undefined}
            onChange={(val) => onChange(val)}
          />
        </div>
      )}
    </div>
  );
};
