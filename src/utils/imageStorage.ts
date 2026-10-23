/**
 * Image storage & optimization utility for Hari Kripa Fruit ERP.
 * Optimizes uploaded images with browser canvas to keep storage compact,
 * fast, and fully offline compatible.
 */

const MAX_WIDTH = 400;
const MAX_HEIGHT = 400;
const QUALITY = 0.82;

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

/**
 * Resizes and compresses an image file before storage.
 * Returns a Promise that resolves with a compact base64 data URL.
 */
export async function processAndCompressImage(
  file: File,
  options: ProcessImageOptions = {}
): Promise<string> {
  const maxWidth = options.maxWidth || MAX_WIDTH;
  const maxHeight = options.maxHeight || MAX_HEIGHT;
  const quality = options.quality || QUALITY;

  return new Promise((resolve, reject) => {
    // Basic file validation
    if (!file.type.startsWith('image/')) {
      reject(new Error('Selected file is not an image.'));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('Image is too large. Please select an image under 8MB.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for processing.'));
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Fallback to original read string if canvas 2d isn't available
          resolve(event.target?.result as string);
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp or jpeg for compact footprint
        try {
          const dataUrl = canvas.toDataURL('image/webp', quality);
          resolve(dataUrl);
        } catch {
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}
