import assert from 'assert';
import fs from 'fs';

console.log('--- TEST SUITE: HTML2CANVAS OKLCH SUPPORT VERIFICATION ---');

// 1. Verify that html2canvas-pro is installed and exports html2canvas
import html2canvas from 'html2canvas-pro';
assert(typeof html2canvas === 'function', 'html2canvas-pro should export a function');
console.log('✓ html2canvas-pro successfully loaded and exports function');

// 2. Verify that SUPPORTED_COLOR_FUNCTIONS includes oklch, oklab, lab, lch, color, color-mix
const h2cSource = fs.readFileSync('node_modules/html2canvas-pro/dist/html2canvas-pro.js', 'utf8');
assert(h2cSource.includes('oklch: packOkLch'), 'html2canvas-pro must include oklch in SUPPORTED_COLOR_FUNCTIONS');
assert(h2cSource.includes('extractOkLchComponents'), 'html2canvas-pro must implement extractOkLchComponents');
console.log('✓ html2canvas-pro contains native OKLCH parser and converter');

// 3. Verify that old html2canvas is replaced in pdfAndShareEngine.ts
const engineSource = fs.readFileSync('src/utils/pdfAndShareEngine.ts', 'utf8');
assert(engineSource.includes("from 'html2canvas-pro'"), "pdfAndShareEngine.ts must import from 'html2canvas-pro'");
assert(!engineSource.includes("from 'html2canvas';"), "pdfAndShareEngine.ts must not import from old 'html2canvas'");
console.log('✓ pdfAndShareEngine.ts correctly imports html2canvas-pro');

console.log('\n--- ALL OKLCH PDF ENGINE VERIFICATION TESTS PASSED ---');
