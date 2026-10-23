import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { processAndCompressImage } from '../../utils/imageStorage';

interface ImageUploaderProps {
  label: string;
  helperText?: string;
  currentValue?: string;
  onChange: (value: string | undefined) => void;
  aspect?: 'square' | 'wide';
  previewShape?: 'square' | 'rounded' | 'circle';
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  helperText = 'Supports JPG, PNG, WebP (auto-optimized)',
  currentValue,
  onChange,
  previewShape = 'rounded',
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUri = await processAndCompressImage(file, { maxWidth: 512, maxHeight: 512 });
      onChange(dataUri);
    } catch (err: any) {
      alert(err.message || 'Error processing image');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  const shapeClasses =
    previewShape === 'circle'
      ? 'rounded-full'
      : previewShape === 'square'
      ? 'rounded-none'
      : 'rounded-xl';

  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
        {label}
      </label>

      <div className="flex items-center gap-3">
        {/* Preview box */}
        <div
          className={`relative flex h-16 w-16 shrink-0 items-center justify-center border border-slate-200 bg-slate-50 overflow-hidden shadow-2xs dark:border-slate-700 dark:bg-slate-800 ${shapeClasses}`}
        >
          {currentValue ? (
            <>
              <img
                src={currentValue}
                alt="Preview"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={handleRemove}
                title="Remove Image"
                className="absolute top-1 right-1 rounded-full bg-slate-900/80 p-1 text-white hover:bg-rose-600 transition-colors"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          ) : (
            <ImageIcon className="h-6 w-6 text-slate-400" />
          )}
        </div>

        {/* Upload Buttons */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              {currentValue ? 'Change Image' : 'Upload Image'}
            </button>
            {currentValue && (
              <button
                type="button"
                onClick={handleRemove}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
              >
                Remove
              </button>
            )}
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {helperText}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};
