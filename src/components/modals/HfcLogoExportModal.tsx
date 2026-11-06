import React, { useState } from 'react';
import { X, Download, Check, Sparkles, Image as ImageIcon, Eye, Printer, FileText } from 'lucide-react';
import { db } from '../../services/db';

interface HfcLogoExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogoUpdated?: () => void;
}

export const HfcLogoExportModal: React.FC<HfcLogoExportModalProps> = ({
  isOpen,
  onClose,
  onLogoUpdated,
}) => {
  const [selectedBg, setSelectedBg] = useState<'cream' | 'white' | 'transparent'>('cream');
  const [copiedStatus, setCopiedStatus] = useState(false);

  if (!isOpen) return null;

  const logoMap = {
    cream: '/assets/hfc_full_logo.png',
    white: '/assets/hfc_full_logo_white.png',
    transparent: '/assets/hfc_full_logo_transparent.png',
  };

  const currentLogoSrc = logoMap[selectedBg];

  const handleDownload = (type: 'cream' | 'white' | 'transparent') => {
    const link = document.createElement('a');
    link.href = logoMap[type];
    link.download = `HFC_Hari_Kripa_Fruit_Company_Logo_${type}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyToErp = (type: 'cream' | 'white' | 'transparent') => {
    const defaultProfile = db.getDefaultProfile();
    if (defaultProfile) {
      db.saveCompanyProfile({
        ...defaultProfile,
        logo: logoMap[type],
      });
      setCopiedStatus(true);
      setTimeout(() => setCopiedStatus(false), 2500);
      if (onLogoUpdated) onLogoUpdated();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden my-6 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <ImageIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Official HFC Logo & High-Resolution Export
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Hari Kripa Fruit Company · Freshness. Quality. Trust.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 cursor-pointer transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-6">
          {/* Background Variant Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Background Preview:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100 dark:border-slate-700 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedBg('cream')}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    selectedBg === 'cream'
                      ? 'bg-amber-100 text-amber-950 shadow-xs border border-amber-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  Original Cream (#FDE9C8)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBg('white')}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    selectedBg === 'white'
                      ? 'bg-white text-slate-950 shadow-xs border border-slate-300'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  Pure White (Bills & Print)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedBg('transparent')}
                  className={`rounded-md px-3 py-1 text-xs font-bold transition-all cursor-pointer ${
                    selectedBg === 'transparent'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300'
                  }`}
                >
                  Transparent (Web & Dark Mode)
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => handleApplyToErp(selectedBg)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-xs cursor-pointer"
            >
              {copiedStatus ? <Check className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              <span>{copiedStatus ? 'Active in ERP!' : 'Set as Active ERP Logo'}</span>
            </button>
          </div>

          {/* Logo Showcase Display Box */}
          <div
            className={`relative flex items-center justify-center rounded-2xl border p-8 transition-colors ${
              selectedBg === 'cream'
                ? 'bg-[#FDE9C8] border-amber-200'
                : selectedBg === 'white'
                ? 'bg-white border-slate-200 shadow-inner'
                : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] dark:bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] bg-slate-100 dark:bg-slate-950 border-slate-300 dark:border-slate-700'
            }`}
          >
            <div className="max-w-[340px] sm:max-w-[420px] transition-transform duration-200 hover:scale-[1.01]">
              <img
                src={currentLogoSrc}
                alt="Hari Kripa Fruit Company Official HFC Logo"
                className="w-full h-auto drop-shadow-md rounded-xl select-none"
              />
            </div>
          </div>

          {/* Export Options Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Cream PNG */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white">
                    Original Cream PNG
                  </span>
                  <span className="text-[10px] font-mono text-amber-700 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 px-1.5 py-0.5 rounded">
                    1254 × 1600
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Full original champagne background with gold accents and branding.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload('cream')}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600" /> Download
              </button>
            </div>

            {/* 2. White Print PNG */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                    <Printer className="h-3.5 w-3.5 text-blue-600" />
                    <span>Print & Bill PNG</span>
                  </span>
                  <span className="text-[10px] font-mono text-blue-700 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 px-1.5 py-0.5 rounded">
                    White BG
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Pure white background for crisp invoices, bills, letterheads, and printing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload('white')}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-blue-600" /> Download
              </button>
            </div>

            {/* 3. Transparent PNG */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs text-slate-900 dark:text-white flex items-center gap-1">
                    <FileText className="h-3.5 w-3.5 text-purple-600" />
                    <span>Transparent PNG</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-700 bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 px-1.5 py-0.5 rounded">
                    Alpha BG
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Cutout circular emblem and typography with transparent backdrop.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDownload('transparent')}
                className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
              >
                <Download className="h-3.5 w-3.5 text-purple-600" /> Download
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3 dark:border-slate-800 dark:bg-slate-800/40">
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            High-Resolution 300 DPI Export · Original HFC Artwork 100% Preserved
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
