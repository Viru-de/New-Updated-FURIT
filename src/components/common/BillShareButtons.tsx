import React, { useState } from 'react';
import { Download, MessageCircle, Loader2, Printer } from 'lucide-react';
import {
  shareToWhatsApp,
  BillPaperSize,
  getLastSelectedPaperSize,
} from '../../utils/pdfAndShareEngine';
import { ChooseBillPrintFormatModal } from './ChooseBillPrintFormatModal';

export interface BillShareButtonsProps {
  elementId: string;
  filename: string;
  customerMobile?: string;
  title: string;
  summaryText: string;
  className?: string;
  size?: 'sm' | 'md';
  defaultPaperSize?: BillPaperSize;
  onPaperSizeChange?: (size: BillPaperSize) => void;
  showPrintButton?: boolean;
}

export const BillShareButtons: React.FC<BillShareButtonsProps> = ({
  elementId,
  filename,
  customerMobile,
  title,
  summaryText,
  className = '',
  size = 'sm',
  defaultPaperSize = 'compact',
  onPaperSizeChange,
  showPrintButton = false,
}) => {
  const [isFormatModalOpen, setIsFormatModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState<'print' | 'download'>('download');
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);

  const handleOpenFormatModal = (action: 'print' | 'download') => {
    setModalAction(action);
    setIsFormatModalOpen(true);
  };

  const handleWhatsAppShare = async () => {
    try {
      setIsSharingWhatsApp(true);
      const selectedSize = getLastSelectedPaperSize(defaultPaperSize);
      await shareToWhatsApp({
        elementId,
        filename,
        customerMobile,
        title,
        summaryText,
        paperSize: selectedSize,
      });
    } catch (err) {
      console.error('Failed to share to WhatsApp:', err);
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  const btnPadding = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm';

  return (
    <>
      <div className={`flex items-center gap-2 ${className}`}>
        {/* Optional Print Button */}
        {showPrintButton && (
          <button
            type="button"
            onClick={() => handleOpenFormatModal('print')}
            className={`flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-1.5 font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 shadow-xs cursor-pointer ${btnPadding}`}
            title="Print bill with chosen paper format"
          >
            <Printer className="h-3.5 w-3.5" />
            <span>Print Bill</span>
          </button>
        )}

        {/* WhatsApp Share Button */}
        <button
          type="button"
          disabled={isSharingWhatsApp}
          onClick={handleWhatsAppShare}
          className={`flex items-center gap-1.5 rounded-lg bg-emerald-600 font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60 transition-colors cursor-pointer ${btnPadding}`}
          title="Share formatted PDF or bill details on WhatsApp"
        >
          {isSharingWhatsApp ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <MessageCircle className="h-3.5 w-3.5" />
          )}
          <span>{isSharingWhatsApp ? 'Sharing...' : 'WhatsApp Share'}</span>
        </button>

        {/* Download PDF Button */}
        <button
          type="button"
          onClick={() => handleOpenFormatModal('download')}
          className={`flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white font-semibold text-slate-800 shadow-2xs hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 disabled:opacity-60 transition-colors cursor-pointer ${btnPadding}`}
          title="Choose format and download actual PDF invoice"
        >
          <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span>Download PDF</span>
        </button>
      </div>

      {/* Format Selection Dialog */}
      <ChooseBillPrintFormatModal
        isOpen={isFormatModalOpen}
        onClose={() => setIsFormatModalOpen(false)}
        documentTitle={title}
        elementId={elementId}
        filename={filename}
        defaultSize={defaultPaperSize}
        initialAction={modalAction}
        onPaperSizeChange={onPaperSizeChange}
      />
    </>
  );
};
