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

export function getLastSelectedPaperSize(defaultSize: BillPaperSize = 'a5'): BillPaperSize {
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
export function applyPrintPageSize(size: BillPaperSize = 'a5', targetElementId?: string): void {
  if (typeof document === 'undefined') return;
  const spec = PAPER_SIZE_SPECS[size] || PAPER_SIZE_SPECS.a5;
  let styleEl = document.getElementById('dynamic-print-page-style') as HTMLStyleElement | null;
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamic-print-page-style';
    document.head.appendChild(styleEl);
  }

  const isMultiPageLedgerOrReport = Boolean(
    targetElementId &&
      [
        'customer-ledger-detailed-print-area',
        'customer-ledger-short-print-area',
        'ledger-print-area',
        'sale-proceeds-print-area',
        'sale-proceeds-short-print-area',
        'group-sale-print-summary',
        'crate-statement-print-area',
        'report-print-area',
      ].includes(targetElementId)
  );

  const margins: Record<BillPaperSize, string> = {
    b7: '1.5mm 2.5mm 1.5mm 2.5mm',
    b6: '2mm 3mm 2mm 3mm',
    a5: '2mm 4mm 2mm 4mm',
    compact: '2mm 4mm 2.5mm 4mm',
    a4: isMultiPageLedgerOrReport ? '7mm 6mm 9mm 6mm' : '3mm 5mm 3.5mm 5mm',
  };
  const margin = margins[size] || margins.a5;

  styleEl.textContent = `
    @media print {
      @page {
        size: ${spec.widthMm}mm ${spec.heightMm}mm !important;
        margin: ${margin} !important;
      }
    }
  `;
}

// Track active print session cleanup so repeat print clicks are never deadlocked if afterprint fails to fire
let isPreparingPrint = false;
let activePrintCleanup: (() => void) | null = null;

/**
 * Safely trigger browser print using an isolated print mount outside #root.
 * This completely avoids blank screen issues caused by modal backdrops,
 * overflow clipping, parent scroll containers, and dark theme bleed-through.
 */
export async function triggerPrint(
  paperSize: BillPaperSize = 'a5',
  targetElementId?: string
): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (isPreparingPrint) return; // Ignore rapid double-clicks during preparation

  // If a prior print session never fired afterprint (e.g. embedded iframe or browser quirk),
  // clean it up first instead of blocking subsequent Print clicks for 45 seconds.
  if (activePrintCleanup) {
    activePrintCleanup();
  }

  const chosenSize = paperSize || getLastSelectedPaperSize('a5');
  applyPrintPageSize(chosenSize, targetElementId);
  saveLastSelectedPaperSize(chosenSize);

  // 1. Locate the printable element
  let targetEl: HTMLElement | null = null;
  if (targetElementId) {
    targetEl = document.getElementById(targetElementId);
  }

  // Fallback search through standard ERP print IDs
  if (!targetEl) {
    const candidateIds = [
      'mandi-print-area',
      'receipt-print-area',
      'customer-ledger-detailed-print-area',
      'ledger-print-area',
      'customer-ledger-short-print-area',
      'crate-statement-print-area',
      'sale-proceeds-print-area',
      'sale-proceeds-short-print-area',
      'group-sale-print-summary',
      'report-print-area',
    ];
    for (const cid of candidateIds) {
      const candidate = document.getElementById(cid);
      if (candidate) {
        targetEl = candidate;
        break;
      }
    }
  }

  // If still not found, search by recognizable printable class
  if (!targetEl) {
    targetEl =
      (document.querySelector('.print-bill-canvas') as HTMLElement) ||
      (document.querySelector('.erp-print-area') as HTMLElement) ||
      (document.querySelector('[data-theme-isolated="true"]') as HTMLElement);
  }

  // If no specific container is found, fall back to standard window.print()
  if (!targetEl) {
    window.print();
    return;
  }

  isPreparingPrint = true;

  // 2. Track existing dark mode state to ensure clean restoration after print dialog dismisses
  const wasDark =
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';
  const prevHtmlClass = document.documentElement.className;
  const prevBodyClass = document.body.className;
  const prevDataTheme = document.documentElement.getAttribute('data-theme');
  const prevHtmlColorScheme = document.documentElement.style.colorScheme;
  const prevBodyColorScheme = document.body.style.colorScheme;

  // Switch DOM temporarily to light mode so browser print engine renders 100% white theme
  if (wasDark) {
    document.documentElement.classList.remove('dark');
    document.body.classList.remove('dark');
    document.documentElement.setAttribute('data-theme', 'light');
    document.documentElement.style.colorScheme = 'light';
    document.body.style.colorScheme = 'light';
  }

  // 3. Setup isolated print container attached directly to document.body (outside #root)
  const MOUNT_ID = 'erp-isolated-print-mount';
  let mountEl = document.getElementById(MOUNT_ID) as HTMLElement | null;
  if (!mountEl) {
    mountEl = document.createElement('div');
    mountEl.id = MOUNT_ID;
    document.body.appendChild(mountEl);
  }
  mountEl.innerHTML = '';
  mountEl.className = 'light bg-white text-black';
  mountEl.setAttribute('data-theme', 'light');
  mountEl.style.colorScheme = 'light';

  // 4. Deep-clone the target printable node
  const clone = targetEl.cloneNode(true) as HTMLElement;

  // 5. Sanitize and prepare clone for pristine white-background print
  clone.classList.remove('hidden');
  clone.style.display = 'block';
  clone.style.visibility = 'visible';
  clone.style.position = 'static';
  clone.style.boxSizing = 'border-box';
  clone.style.width = '100%';
  clone.style.maxWidth = '100%';
  clone.style.height = 'auto';
  clone.style.minHeight = '0';
  clone.style.maxHeight = 'none';
  clone.style.margin = '0 auto';
  // Provide print-safe internal padding so content never cuts at physical sheet boundaries
  const safePad =
    chosenSize === 'b7'
      ? '0.5mm 1mm 0.5mm 1mm'
      : chosenSize === 'b6'
      ? '0.5mm 1.5mm 1mm 1.5mm'
      : chosenSize === 'a5'
      ? '1mm 2mm 1mm 2mm'
      : chosenSize === 'compact'
      ? '1mm 2.5mm 1.5mm 2.5mm'
      : '1mm 2.5mm 2mm 2.5mm';
  clone.style.padding = safePad;
  clone.style.marginTop = '0';
  clone.style.overflow = 'visible';
  clone.style.backgroundColor = '#ffffff';
  clone.style.color = '#000000';
  clone.style.boxShadow = 'none';
  clone.style.border = 'none';
  clone.style.pageBreakAfter = 'auto';
  (clone.style as any).breakAfter = 'auto';

  // Strip non-printable UI elements (action buttons, tabs, pagination bars)
  const noPrints = clone.querySelectorAll('.no-print, [class*="no-print"], button:not(.keep-in-print)');
  noPrints.forEach((el) => el.remove());

  // Unhide print headers and summary sections
  const printBlocks = clone.querySelectorAll('.print\\:block, [class*="print:block"], [class*="print:flex"]');
  printBlocks.forEach((el) => {
    const htmlEl = el as HTMLElement;
    htmlEl.classList.remove('hidden');
    if (htmlEl.classList.contains('print:flex') || htmlEl.className.includes('print:flex')) {
      htmlEl.style.display = 'flex';
    } else {
      htmlEl.style.display = 'block';
    }
    htmlEl.style.visibility = 'visible';
  });

  // Strip all dark mode and dark: utility classes from clone & all descendants
  const allCloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))];
  allCloneNodes.forEach((node) => {
    if (node instanceof HTMLElement) {
      const classesToRemove: string[] = [];
      for (let i = 0; i < node.classList.length; i++) {
        const cls = node.classList.item(i);
        if (cls && (cls === 'dark' || cls.startsWith('dark:'))) {
          classesToRemove.push(cls);
        }
      }
      classesToRemove.forEach((cls) => node.classList.remove(cls));
    }
  });

  // Ensure normal unslashed zero and tabular numerals throughout the cloned element
  const allSubEls = clone.querySelectorAll('*');
  allSubEls.forEach((node) => {
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

  mountEl.appendChild(clone);

  // Set print state on body
  document.body.classList.add('has-print-mount');
  if (targetElementId || targetEl.id) {
    document.body.setAttribute('data-print-target', targetElementId || targetEl.id);
  }

  let cleanedUp = false;
  let fallbackTimer: ReturnType<typeof setTimeout> | null = null;
  const mql = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('print') : null;
  const mqlListener = (e: MediaQueryListEvent) => {
    if (!e.matches) cleanup();
  };

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    isPreparingPrint = false;
    if (activePrintCleanup === cleanup) {
      activePrintCleanup = null;
    }
    if (fallbackTimer !== null) {
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
    }
    document.body.classList.remove('has-print-mount');
    document.body.removeAttribute('data-print-target');
    if (mountEl) {
      mountEl.innerHTML = '';
    }

    // Seamlessly restore dark mode state if it was active
    if (wasDark) {
      document.documentElement.className = prevHtmlClass;
      document.body.className = prevBodyClass;
      if (prevDataTheme) {
        document.documentElement.setAttribute('data-theme', prevDataTheme);
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      document.documentElement.style.colorScheme = prevHtmlColorScheme || 'dark';
      document.body.style.colorScheme = prevBodyColorScheme || 'dark';
    }

    window.removeEventListener('afterprint', cleanup);
    if (mql && mql.removeEventListener) {
      mql.removeEventListener('change', mqlListener);
    }
  };

  activePrintCleanup = cleanup;

  try {
    // 6. Ensure web fonts loaded without blocking if already ready (preserves Safari/Firefox user gesture)
    if (document.fonts && document.fonts.status !== 'loaded') {
      try {
        await Promise.race([
          document.fonts.ready,
          new Promise((resolve) => setTimeout(resolve, 40)),
        ]);
      } catch {
        // Proceed even if fonts.ready fails
      }
    }

    // Allow browser layout engine one animation frame to paint DOM changes before opening print dialog
    await new Promise<void>((resolve) => {
      if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => resolve());
      } else {
        setTimeout(resolve, 16);
      }
    });

    isPreparingPrint = false;

    // Only run cleanup after the browser print dialog has actually finished / dismissed
    window.addEventListener('afterprint', cleanup, { once: true });
    if (mql && mql.addEventListener) {
      mql.addEventListener('change', mqlListener);
    }

    window.print();

    // Safety fallback in case afterprint does not fire in an embedded iframe
    fallbackTimer = setTimeout(cleanup, 15000);
  } catch (err) {
    cleanup();
    throw err;
  }
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
  paperSize: BillPaperSize = 'a5'
): Promise<{ doc: jsPDF; canvas: HTMLCanvasElement; pageCount: number }> {
  const element = document.getElementById(elementId);
  if (!element) {
    throw new Error(`Printable element #${elementId} not found in the DOM`);
  }

  const spec = PAPER_SIZE_SPECS[paperSize] || PAPER_SIZE_SPECS.a5;
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

  // Track unbreakable DOM element bounds (rows, tfoot, bottom signature) & repeating table header bounds in CSS px relative to root
  let unbreakableCssBounds: Array<{ top: number; bottom: number }> = [];
  const tableMeasure: {
    theadCssBounds: { top: number; bottom: number } | null;
    tfootCssTop: number | null;
  } = {
    theadCssBounds: null,
    tfootCssTop: null,
  };
  let clonedScrollHeight = 0;

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
        clonedElement.setAttribute('data-pdf-export', 'true');
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
        clonedElement.style.overflow = 'visible';
        // Keep safe compact PDF margins without clipping Company Short Name
        clonedElement.style.marginTop = '0';
        clonedElement.style.paddingTop =
          paperSize === 'b7' ? '4px' : paperSize === 'b6' ? '5px' : '8px';
        if (paperSize === 'b7') {
          clonedElement.style.paddingLeft = '5px';
          clonedElement.style.paddingRight = '5px';
          clonedElement.style.paddingBottom = '4px';
        } else if (paperSize === 'b6') {
          clonedElement.style.paddingLeft = '7px';
          clonedElement.style.paddingRight = '7px';
          clonedElement.style.paddingBottom = '6px';
        }

        // Strip dark variant classes from all cloned elements
        const allClonedNodes = [clonedElement, ...Array.from(clonedElement.querySelectorAll('*'))];
        allClonedNodes.forEach((node) => {
          if (node instanceof HTMLElement) {
            const classesToRemove: string[] = [];
            for (let i = 0; i < node.classList.length; i++) {
              const cls = node.classList.item(i);
              if (cls && (cls === 'dark' || cls.startsWith('dark:'))) {
                classesToRemove.push(cls);
              }
            }
            classesToRemove.forEach((cls) => node.classList.remove(cls));
          }
        });

        // 1. Unhide any print-only headers (such as statement and report headers) so they appear in PDFs
        const printBlocks = clonedElement.querySelectorAll('.print\\:block, [class*="print:block"], [class*="print:flex"], .hidden');
        printBlocks.forEach((el) => {
          const htmlEl = el as HTMLElement;
          htmlEl.classList.remove('hidden');
          if (htmlEl.classList.contains('print:flex') || htmlEl.className.includes('print:flex')) {
            htmlEl.style.display = 'flex';
          } else {
            htmlEl.style.display = 'block';
          }
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

        // 4. Measure unbreakable row/block boundaries and primary table header bounds for clean multi-page splits
        const rootRect = clonedElement.getBoundingClientRect();
        clonedScrollHeight = clonedElement.scrollHeight || rootRect.height;

        const primaryThead = clonedElement.querySelector('table > thead') as HTMLElement | null;
        if (primaryThead) {
          const hr = primaryThead.getBoundingClientRect();
          if (hr.height > 0) {
            tableMeasure.theadCssBounds = {
              top: hr.top - rootRect.top,
              bottom: hr.bottom - rootRect.top,
            };
          }
        }

        const primaryTfoot = clonedElement.querySelector('table > tfoot') as HTMLElement | null;
        if (primaryTfoot) {
          const fr = primaryTfoot.getBoundingClientRect();
          if (fr.height > 0) {
            tableMeasure.tfootCssTop = fr.top - rootRect.top;
          }
        }

        const protectedEls = clonedElement.querySelectorAll(
          'tbody > tr, .ledger-tx-row, tfoot, .ledger-closing-meta-row, .bill-bottom-footer'
        );
        unbreakableCssBounds = Array.from(protectedEls)
          .map((el) => {
            const r = (el as HTMLElement).getBoundingClientRect();
            return {
              top: r.top - rootRect.top,
              bottom: r.bottom - rootRect.top,
            };
          })
          .filter((b) => b.bottom > b.top);
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

    // Case 1: Fits cleanly on a single page (allow minor sub-pixel tolerance without distorting layout)
    const singlePageTolerance = paperSize === 'b7' || paperSize === 'b6' ? 1.03 : 1.04;
    if (totalContentHeightMm <= pageHeightMm * singlePageTolerance) {
      const fitHeightMm = Math.min(totalContentHeightMm, pageHeightMm);
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      doc.addImage(imgData, 'JPEG', 0, 0, pageWidthMm, fitHeightMm, undefined, 'FAST');
    } else {
      // Case 2: Multi-page document — slice canvas at clean row/footer boundaries, repeat table headers on continuation pages, and reserve safe top/bottom margins
      const canvasScaleY =
        clonedScrollHeight > 0 ? canvas.height / clonedScrollHeight : 2;
      const canvasBounds = unbreakableCssBounds.map((b) => ({
        top: b.top * canvasScaleY,
        bottom: b.bottom * canvasScaleY,
      }));
      const theadCanvasBounds = tableMeasure.theadCssBounds
        ? {
            top: Math.max(0, Math.floor(tableMeasure.theadCssBounds.top * canvasScaleY)),
            bottom: Math.min(canvas.height, Math.ceil(tableMeasure.theadCssBounds.bottom * canvasScaleY)),
          }
        : null;
      const tfootCanvasTop =
        tableMeasure.tfootCssTop !== null
          ? Math.floor(tableMeasure.tfootCssTop * canvasScaleY)
          : null;

      const page1BottomMarginMm = 6;
      const continuationTopMarginMm = 6;
      const continuationBottomMarginMm = 7;

      const pxPerPage1 = Math.floor(
        ((pageHeightMm - page1BottomMarginMm) / pageWidthMm) * canvas.width
      );

      let repeatedTheadImgData: string | null = null;
      let repeatedTheadHeightMm = 0;
      let repeatedTheadHeightPx = 0;

      if (theadCanvasBounds && theadCanvasBounds.bottom > theadCanvasBounds.top + 4) {
        repeatedTheadHeightPx = theadCanvasBounds.bottom - theadCanvasBounds.top;
        const theadCanvas = document.createElement('canvas');
        theadCanvas.width = canvas.width;
        theadCanvas.height = repeatedTheadHeightPx;
        const hCtx = theadCanvas.getContext('2d');
        if (hCtx) {
          hCtx.fillStyle = '#ffffff';
          hCtx.fillRect(0, 0, theadCanvas.width, theadCanvas.height);
          hCtx.drawImage(
            canvas,
            0,
            theadCanvasBounds.top,
            canvas.width,
            repeatedTheadHeightPx,
            0,
            0,
            canvas.width,
            repeatedTheadHeightPx
          );
          repeatedTheadImgData = theadCanvas.toDataURL('image/jpeg', 0.95);
          repeatedTheadHeightMm = (repeatedTheadHeightPx * pageWidthMm) / canvas.width;
        }
      }

      let startY = 0;
      let actualPages = 0;

      while (startY < canvas.height) {
        const remaining = canvas.height - startY;
        if (actualPages > 0 && remaining < 24) {
          break;
        }

        const shouldRepeatThead =
          actualPages > 0 &&
          Boolean(repeatedTheadImgData) &&
          theadCanvasBounds !== null &&
          startY >= theadCanvasBounds.bottom &&
          (tfootCanvasTop === null || startY < tfootCanvasTop);

        const headerReserveMm = shouldRepeatThead ? repeatedTheadHeightMm + 0.8 : 0;
        const maxUsableHeightMm =
          actualPages === 0
            ? pageHeightMm - page1BottomMarginMm
            : pageHeightMm - continuationTopMarginMm - continuationBottomMarginMm - headerReserveMm;

        const maxSlice = Math.max(
          80,
          actualPages === 0
            ? pxPerPage1
            : Math.floor((maxUsableHeightMm / pageWidthMm) * canvas.width)
        );
        let endY = Math.min(canvas.height, startY + maxSlice);

        if (endY < canvas.height) {
          // Snap upward before any unbreakable block (row, tfoot, footer) straddling endY
          for (const b of canvasBounds) {
            if (b.top < endY && b.bottom > endY && b.top > startY + 40) {
              endY = Math.min(endY, Math.floor(b.top) - 1);
            }
          }
          // Guarantee positive forward progress even if a single block exceeds one page
          if (endY <= startY + 40) {
            endY = Math.min(canvas.height, startY + maxSlice);
          }
        }

        const slicePxHeight = Math.max(1, endY - startY);
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

        let drawY = actualPages === 0 ? 0 : continuationTopMarginMm;
        if (shouldRepeatThead && repeatedTheadImgData) {
          doc.addImage(
            repeatedTheadImgData,
            'JPEG',
            0,
            drawY,
            pageWidthMm,
            repeatedTheadHeightMm,
            undefined,
            'FAST'
          );
          drawY += repeatedTheadHeightMm + 0.8;
        }

        doc.addImage(sliceImgData, 'JPEG', 0, drawY, pageWidthMm, sliceHeightMm, undefined, 'FAST');
        actualPages++;
        startY = endY;
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
  paperSize: BillPaperSize = 'a5'
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
  paperSize: BillPaperSize = 'a5'
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
