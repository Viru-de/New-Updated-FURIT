import React, { useState, useEffect } from 'react';
import {
  Printer,
  Download,
  X,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  FileText,
} from 'lucide-react';
import {
  BillPaperSize,
  PAPER_SIZE_SPECS,
  getLastSelectedPaperSize,
  saveLastSelectedPaperSize,
  downloadPdfFromElement,
  triggerPrint,
} from '../../utils/pdfAndShareEngine';

export interface ChooseBillPrintFormatModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  elementId: string;
  filename: string;
  defaultSize?: BillPaperSize;
  initialAction?: 'print' | 'download';
  onPaperSizeChange?: (size: BillPaperSize) => void;
}

export const ChooseBillPrintFormatModal: React.FC<ChooseBillPrintFormatModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  elementId,
  filename,
  defaultSize = 'compact',
  initialAction = 'print',
  onPaperSizeChange,
}) => {
  const [selectedSize, setSelectedSize] = useState<BillPaperSize>(() =>
    getLastSelectedPaperSize(defaultSize)
  );
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const initial = getLastSelectedPaperSize(defaultSize);
      setSelectedSize(initial);
      setErrorMessage(null);
      setDownloadSuccess(false);
      onPaperSizeChange?.(initial);
    }
  }, [isOpen, defaultSize, onPaperSizeChange]);

  if (!isOpen) return null;

  const handleSelectSize = (size: BillPaperSize) => {
    setSelectedSize(size);
    saveLastSelectedPaperSize(size);
    setErrorMessage(null);
    onPaperSizeChange?.(size);
  };

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      setErrorMessage(null);
      saveLastSelectedPaperSize(selectedSize);
      await triggerPrint(selectedSize);
      onClose();
    } catch (err: any) {
      console.error('Print trigger failed:', err);
      setErrorMessage(err.message || 'Unable to open print dialogue. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const handleDownload = async () => {
    if (isDownloading) return; // Prevent duplicate clicks
    try {
      setIsDownloading(true);
      setErrorMessage(null);
      setDownloadSuccess(false);
      saveLastSelectedPaperSize(selectedSize);

      const res = await downloadPdfFromElement(elementId, filename, selectedSize);
      if (res.success) {
        setDownloadSuccess(true);
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      console.error('Download PDF failed:', err);
      setErrorMessage(
        err.message ||
          'Failed to generate PDF. Please ensure the bill preview is fully loaded and try again.'
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const currentSpec = PAPER_SIZE_SPECS[selectedSize];
  const sizeKeys: BillPaperSize[] = ['compact', 'a4', 'a5', 'b6', 'b7'];

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/70 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto no-print">
      <div
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        role="dialog"
        aria-labelledby="choose-bill-print-format-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50 dark:bg-slate-850">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-blue-100 p-2 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="choose-bill-print-format-title"
                className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white"
              >
                Choose Bill Print Format
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
                {documentTitle}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading || isPrinting}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Format selection options */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Select Paper Size / Layout
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {sizeKeys.map((key) => {
                const spec = PAPER_SIZE_SPECS[key];
                const isSelected = selectedSize === key;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => handleSelectSize(key)}
                    className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/70 dark:border-blue-500 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/80 dark:border-slate-700/80 dark:bg-slate-850 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-bold ${
                            isSelected
                              ? 'text-blue-900 dark:text-blue-200'
                              : 'text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          {spec.name}
                        </span>
                        <span className="rounded bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-[11px] font-mono text-slate-600 dark:text-slate-300">
                          {spec.dimensionsMm}
                        </span>
                        {key === 'compact' && (
                          <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 text-[10px] font-bold px-2 py-0.5">
                            Mandi Default
                          </span>
                        )}
                        {key === 'a4' && (
                          <span className="rounded-full bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300 text-[10px] font-bold px-2 py-0.5">
                            Office Standard
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        {spec.description}
                      </p>
                    </div>

                    <div className="pt-0.5 shrink-0">
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          isSelected
                            ? 'border-blue-600 bg-blue-600 dark:border-blue-500 dark:bg-blue-500'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* B7 Special Size Notice */}
          {currentSpec.warning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 flex items-start gap-2.5 text-amber-900 dark:text-amber-200 text-xs">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Paper Size Notice: </strong>
                {currentSpec.warning}
              </div>
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 dark:border-rose-800 dark:bg-rose-950/40 p-3 flex items-start gap-2.5 text-rose-900 dark:text-rose-200 text-xs">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold">Error: </strong>
                {errorMessage}
              </div>
            </div>
          )}

          {/* Success Notification */}
          {downloadSuccess && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 p-3 flex items-center gap-2 text-emerald-900 dark:text-emerald-200 text-xs font-bold">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>PDF downloaded successfully! ({currentSpec.name})</span>
            </div>
          )}
        </div>

        {/* Modal Actions Footer */}
        <div className="border-t border-slate-200 dark:border-slate-800 px-5 py-4 bg-slate-50 dark:bg-slate-850 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDownloading || isPrinting}
            className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Secondary Action: Download PDF */}
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading || isPrinting}
              className={`flex items-center gap-1.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 shadow-2xs hover:bg-slate-100 dark:hover:bg-slate-750 transition-colors cursor-pointer disabled:opacity-60 ${
                initialAction === 'download'
                  ? 'ring-2 ring-blue-500/30 border-blue-500 font-black'
                  : ''
              }`}
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
              ) : (
                <Download className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              )}
              <span>{isDownloading ? 'Generating PDF...' : 'Download PDF'}</span>
            </button>

            {/* Primary Action: Print Bill */}
            <button
              type="button"
              onClick={handlePrint}
              disabled={isDownloading || isPrinting}
              className={`flex items-center gap-2 rounded-xl bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-5 py-2 text-xs sm:text-sm font-bold shadow-md hover:bg-slate-800 dark:hover:bg-white transition-colors cursor-pointer disabled:opacity-60 ${
                initialAction === 'print' ? 'ring-2 ring-blue-400/50 font-black' : ''
              }`}
            >
              {isPrinting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              <span>Print Bill</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
