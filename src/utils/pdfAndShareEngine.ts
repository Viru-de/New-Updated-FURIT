import jsPDF from 'jspdf';
import html2canvas from 'html2canvas-pro';

export type BillPaperSize = 'compact' | 'a4' | 'a5' | 'b6' | 'b7';

export interface PaperSizeSpec {
  id: BillPaperSize;
  name: string;
  dimensionsMm: string;
  widthMm: number;
  heightMm: number;
  description: string;
  warning?: string;
  defaultFor: 'bill' | 'statement';
}

export const PAPER_SIZE_SPECS: Record<BillPaperSize, PaperSizeSpec> = {
  compact: {
    id: 'compact',
    name: 'Compact (Mandi)',
    dimensionsMm: '140 × 210 mm',
    widthMm: 140,
    heightMm: 210,
    description: 'Designed for fruit mandi & wholesale billing. Compact layout with minimal unnecessary whitespace, keeping all line items, rates, crates, and totals crisp.',
    defaultFor: 'bill',
  },
  a4: {
    id: 'a4',
    name: 'A4 Standard',
    dimensionsMm: '210 × 297 mm',
    widthMm: 210,
    heightMm: 297,
    description: 'Standard office & filing paper size. Full-page width with professional margins, suitable for all laser and inkjet office printers.',
    defaultFor: 'statement',
  },
  a5: {
    id: 'a5',
    name: 'A5',
    dimensionsMm: '148 × 210 mm',
    widthMm: 148,
    heightMm: 210,
    description: 'Standard A5 dimensions (half of A4). Suitable for smaller invoices, half-sheet printing, and reduced paper consumption.',
    defaultFor: 'bill',
  },
  b6: {
    id: 'b6',
    name: 'B6',
    dimensionsMm: '125 × 176 mm',
    widthMm: 125,
    heightMm: 176,
    description: 'ISO B6 standard. Small-format invoices where the printer supports this size, maintaining readable text without content clipping.',
    defaultFor: 'bill',
  },
  b7: {
    id: 'b7',
    name: 'B7',
    dimensionsMm: '88 × 125 mm',
    widthMm: 88,
    heightMm: 125,
    description: 'ISO B7 standard pocket format. Suitable only for very small receipts or compact records.',
    warning: 'B7 (88 × 125 mm) has very limited space. Longer bills may require multiple pages or a larger paper size.',
    defaultFor: 'bill',
  },
};

const SESSION_STORAGE_KEY = 'hari_kripa_last_paper_size';

export function getLastSelectedPaperSize(defaultSize: BillPaperSize = 'compact'): BillPaperSize {
  if (typeof window === 'undefined') return defaultSize;
  try {
    const saved = sessionStorage.getItem(SESSION_STORAGE_KEY) as BillPaperSize | null;
    if (saved && PAPER_SIZE_SPECS[saved]) {
      return saved;
    }
  } catch {
    // sessionStorage unavailable
  }
  return defaultSize;
}

export function saveLastSelectedPaperSize(size: BillPaperSize): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SESSION_STORAGE_KEY, size);
  } catch {
    // sessionStorage unavailable
  }
}

/**
 * Dynamically injects an @page stylesheet rule before browser printing so that
 * the printer dialogue respects the selected paper dimensions and margins.
 */
export function applyPrintPageSize(size: BillPaperSize = 'compact', targetElementId?: string): void {
  if (typeof document === 'undefined') return;
  const spec = PAPER_SIZE_SPECS[size] || PAPER_SIZE_SPECS.compact;
  let styleEl = document.getElementById('dynamic-print-page-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }

  const margin = size === 'b7' ? '3mm' : size === 'b6' ? '4mm' : size === 'a5' ? '4mm' : size === 'compact' ? '4mm' : '6mm';

  styleEl.textContent = `
    @media print {
      @page {
        size: ${spec.widthMm}mm ${spec.heightMm}mm !important;
        margin: ${margin} !important;
      }
    }
  `;
}

/**
 * Safely trigger browser print with selected paper dimensions after ensuring all
 * web fonts (such as Noto Sans Devanagari) are resolved.
 */
export async function triggerPrint(
  paperSize: BillPaperSize = 'compact',
  targetElementId?: string
): Promise<void> {
  const chosenSize = paperSize || getLastSelectedPaperSize('compact');
  applyPrintPageSize(chosenSize, targetElementId);
  saveLastSelectedPaperSize(chosenSize);

  const root = typeof document !== 'undefined' ? document.documentElement : null;
  const body = typeof document !== 'undefined' ? document.body : null;
  const isDark = Boolean(root?.classList.contains('dark') || body?.classList.contains('dark'));

  const isSinglePage =
    !targetElementId ||
    targetElementId === 'mandi-print-area' ||
    targetElementId === 'receipt-print-area' ||
    targetElementId === 'sale-proceeds-print-area';

  if (targetElementId && body) {
    body.setAttribute('data-print-target', targetElementId);
  }
  if (isSinglePage && body) {
    body.classList.add('print-single-page-bill');
  }

  // Temporarily switch DOM to light mode during browser print/preview
  // so all computed styles, borders, text, and canvas elements render with pure white background and black text
  if (isDark && root && body) {
    root.classList.remove('dark');
    body.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    root.style.colorScheme = 'light';
  }

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (body) {
      body.removeAttribute('data-print-target');
      body.classList.remove('print-single-page-bill');
    }
    if (isDark && root && body) {
      root.classList.add('dark');
      body.classList.add('dark');
      root.setAttribute('data-theme', 'dark');
      root.style.colorScheme = 'dark';
    }
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed even if fonts.ready fails
    }
  }

  window.print();

  // Safety fallback: ensure cleanup runs even if afterprint is cancelled or missed in embedded iframes
  setTimeout(cleanup, 1500);
}

export interface ShareOptions {
  elementId: string;
  filename: string;
  customerMobile?: string;
  title: string;
  summaryText: string;
  paperSize?: BillPaperSize;
}

/**
 * Capture an element using html2canvas-pro and convert it to a crisp, high-resolution jsPDF instance
 * matching the selected paper dimensions, splitting across multiple pages cleanly when needed.
 */
export async function generatePdfDoc(
  elementId: string,
  paperSize: BillPaperSize = 'compact'
): Promise<{ doc: jsPDF; canvas: HTMLCanvasElement; pageCount: number }> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Printable element #${elementId} not found in the DOM`);
  }

  const spec = PAPER_SIZE_SPECS[paperSize] || PAPER_SIZE_SPECS.compact;
  const targetPxWidth = Math.round(spec.widthMm * 3.7795);

  // CRITICAL: Ensure all web fonts (especially Noto Sans Devanagari & Plus Jakarta Sans) are fully loaded
  if (typeof document !== 'undefined' && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Proceed even if fonts.ready fails
    }
  }

  // If the target element is hidden in on-screen DOM (e.g. print-only summaries like #group-sale-print-summary),
  // temporarily position it offscreen with display block so html2canvas can measure and capture its layout.
  const computedStyle = window.getComputedStyle ? window.getComputedStyle(element) : null;
  const isCurrentlyHidden = computedStyle?.display === 'none' || element.classList.contains('hidden');
  const prevStyleAttr = element.getAttribute('style') || '';
  const prevClassAttr = element.getAttribute('class') || '';

  if (isCurrentlyHidden) {
    element.classList.remove('hidden');
    element.style.display = 'block';
    element.style.visibility = 'hidden';
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.top = '0';
    element.style.width = `${targetPxWidth}px`;
  }

  try {
    // Generate canvas with 2x resolution for clean text rendering
    // Ensure dark mode NEVER affects PDF output by enforcing light mode on the cloned DOM
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: targetPxWidth,
      onclone: (clonedDoc, clonedElement) => {
        // Ensure root element is visible in clone and matches paper size width
        clonedElement.style.display = 'block';
        clonedElement.style.visibility = 'visible';
        clonedElement.style.position = 'static';
        clonedElement.classList.remove('hidden');
        clonedElement.style.width = `${targetPxWidth}px`;
        clonedElement.style.maxWidth = `${targetPxWidth}px`;
        clonedElement.style.boxSizing = 'border-box';
        clonedElement.style.margin = '0 auto';

        clonedDoc.documentElement.classList.remove('dark');
        clonedDoc.body.classList.remove('dark');
        clonedElement.classList.remove('dark');
        clonedDoc.documentElement.setAttribute('data-theme', 'light');
        clonedDoc.documentElement.style.colorScheme = 'light';
        clonedDoc.body.style.colorScheme = 'light';
        clonedElement.style.colorScheme = 'light';
        clonedElement.style.backgroundColor = '#ffffff';
        clonedElement.style.color = '#000000';
        clonedElement.style.border = 'none';
        clonedElement.style.boxShadow = 'none';

        // 1. Unhide any print-only headers (such as statement and report headers) so they appear in PDFs
        const printBlocks = clonedElement.querySelectorAll('.print\\:block, [class*="print:block"], .hidden');
        printBlocks.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.classList.remove('hidden');
          htmlEl.style.display = 'block';
          htmlEl.style.visibility = 'visible';
        });

        // 2. Hide any on-screen only elements from the PDF
        const noPrints = clonedElement.querySelectorAll('.no-print, [class*="no-print"]');
        noPrints.forEach((el) => {
          (el as HTMLElement).style.display = 'none';
        });

        // 3. Guarantee crystal-clear normal unslashed zero and Hindi Devanagari typography in PDF output
        const allElements = clonedElement.querySelectorAll('*');
        allElements.forEach((node) => {
          const el = node as HTMLElement;
          el.style.fontFeatureSettings = '"tnum" 1, "zero" 0';
          if (el.classList.contains('font-devanagari')) {
            el.style.fontFamily = "'Noto Sans Devanagari', 'Plus Jakarta Sans', Arial, sans-serif";
          }
          if (
            el.classList.contains('font-mono') ||
            el.classList.contains('font-mono-numbers') ||
            el.tagName === 'TD' ||
            el.tagName === 'TH'
          ) {
            el.style.fontFamily = "'Plus Jakarta Sans', 'Noto Sans Devanagari', Arial, sans-serif";
            el.style.fontVariantNumeric = 'tabular-nums';
          }
        });
      },
    });

    // Determine target page dimensions
    const pageWidthMm = spec.widthMm;
    const pageHeightMm = spec.heightMm;

    // Total height in mm when fitted to pageWidthMm
    const totalContentHeightMm = (canvas.height * pageWidthMm) / canvas.width;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [pageWidthMm, pageHeightMm],
    });

    let pageCount = 1;

    // Case 1: Fits cleanly on a single page
    // For small-format bills (B7: 88x125mm, B6: 125x176mm), allow 6% sub-pixel rounding tolerance
    const singlePageTolerance = paperSize === 'b7' || paperSize === 'b6' ? 1.06 : 1.04;
    if (totalContentHeightMm <= pageHeightMm * singlePageTolerance) {
      const fitHeightMm = Math.min(totalContentHeightMm, pageHeightMm);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, fitHeightMm, undefined, 'FAST');
    } else {
      // Case 2: Multi-page document — slice canvas per page height to avoid any content overlap or cutoffs
      const pxPerPage = Math.floor((pageHeightMm / pageWidthMm) * canvas.width);
      const rawPageCount = Math.ceil(canvas.height / pxPerPage);
      let actualPages = 0;

      for (let i = 0; i < rawPageCount; i++) {
        const startY = i * pxPerPage;
        const slicePxHeight = Math.min(pxPerPage, canvas.height - startY);

        // Avoid adding a trailing blank page for a tiny sliver (< 30px) of white padding
        if (i > 0 && slicePxHeight < 30) {
          break;
        }

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = slicePxHeight;
        const ctx = pageCanvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
          ctx.drawImage(
            canvas,
            0,
            startY,
            canvas.width,
            slicePxHeight,
            0,
            0,
            canvas.width,
            slicePxHeight
          );
        }

        const sliceImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = (slicePxHeight * pageWidthMm) / canvas.width;

        if (actualPages > 0) {
          doc.addPage([pageWidthMm, pageHeightMm]);
        }
        doc.addImage(sliceImgData, 'JPEG', 0, 0, pageWidthMm, sliceHeightMm, undefined, 'FAST');
        actualPages++;
      }
      pageCount = actualPages;
    }

    return { doc, canvas, pageCount };
  } finally {
    if (isCurrentlyHidden) {
      element.setAttribute('style', prevStyleAttr);
      element.setAttribute('class', prevClassAttr);
    }
  }
}

/**
 * Generate and download formatted PDF file using reliable Blob URL triggering.
 */
export async function downloadPdfFromElement(
  elementId: string,
  filename: string,
  paperSize: BillPaperSize = 'compact'
): Promise<{ success: boolean; pageCount: number }> {
  const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const { doc, pageCount } = await generatePdfDoc(elementId, paperSize);

  // Directly construct Blob and download via anchor for reliable iframe/browser compatibility
  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.style.display = 'none';
  link.href = url;
  link.download = cleanFilename;
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 2500);

  return { success: true, pageCount };
}

/**
 * Generate PDF File object for Web Share API
 */
export async function generatePdfFile(
  elementId: string,
  filename: string,
  paperSize: BillPaperSize = 'compact'
): Promise<File> {
  const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;
  const { doc } = await generatePdfDoc(elementId, paperSize);
  const blob = doc.output('blob');
  return new File([blob], cleanFilename, { type: 'application/pdf' });
}

/**
 * Clean phone number for WhatsApp wa.me links
 */
export function formatWhatsAppPhone(mobile?: string): string {
  if (!mobile) return '';
  const digits = mobile.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return digits;
}

/**
 * Share via WhatsApp:
 * 1. Shares PDF attachment directly via Web Share API if supported.
 * 2. If direct attachment sharing is unsupported, downloads PDF and opens WhatsApp with formatted summary.
 */
export async function shareToWhatsApp(options: ShareOptions): Promise<void> {
  const { elementId, filename, customerMobile, title, summaryText, paperSize = 'compact' } = options;
  const cleanFilename = filename.toLowerCase().endsWith('.pdf') ? filename : `${filename}.pdf`;

  let pdfFile: File | null = null;
  try {
    pdfFile = await generatePdfFile(elementId, cleanFilename, paperSize);
  } catch (err) {
    console.error('Error generating PDF for WhatsApp sharing:', err);
  }

  // Attempt Web Share API with File Attachment
  if (
    pdfFile &&
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [pdfFile] })
  ) {
    try {
      await navigator.share({
        title,
        text: `${title}\n\n${summaryText}`,
        files: [pdfFile],
      });
      return;
    } catch (err: any) {
      // If user cancelled sharing, just exit
      if (err.name === 'AbortError') return;
      console.warn('Native share failed, falling back to download & WhatsApp link:', err);
    }
  }

  // Fallback: Download formatted PDF and open WhatsApp with detailed summary
  if (pdfFile) {
    const url = URL.createObjectURL(pdfFile);
    const link = document.createElement('a');
    link.style.display = 'none';
    link.href = url;
    link.download = cleanFilename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      if (document.body.contains(link)) {
        document.body.removeChild(link);
      }
      URL.revokeObjectURL(url);
    }, 2500);
  }

  // Format WhatsApp message
  const whatsappPhone = formatWhatsAppPhone(customerMobile);
  const formattedMsg = [
    `*HARI KRIPA FRUIT ERP*`,
    `----------------------------------------`,
    `📄 *${title.toUpperCase()}*`,
    summaryText.trim(),
    `----------------------------------------`,
    `_The detailed PDF invoice has been downloaded for your records._`,
  ].join('\n');

  const waUrl = whatsappPhone
    ? `https://api.whatsapp.com/send?phone=${whatsappPhone}&text=${encodeURIComponent(formattedMsg)}`
    : `https://api.whatsapp.com/send?text=${encodeURIComponent(formattedMsg)}`;

  // Use anchor to open WhatsApp without window.alert/window.open restrictions
  const waLink = document.createElement('a');
  waLink.href = waUrl;
  waLink.target = '_blank';
  waLink.rel = 'noopener noreferrer';
  document.body.appendChild(waLink);
  waLink.click();
  setTimeout(() => {
    if (document.body.contains(waLink)) {
      document.body.removeChild(waLink);
    }
  }, 1000);
}
