import React, { useState, useRef } from 'react';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Download,
  ArrowRight,
  RefreshCw,
  Sliders,
  ChevronRight,
  Database,
} from 'lucide-react';
import {
  ImportModule,
  DuplicateHandlingMode,
  ImportPreviewSummary,
  ImportExecutionResult,
  parseSpreadsheetBuffer,
  autoMapColumns,
  validateImportRows,
  downloadImportErrorReport,
  commitImportBatch,
} from '../../utils/excelImportEngine';
import { downloadBlankTemplate } from '../../utils/excelEngine';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  module: ImportModule;
  moduleTitle: string;
  onImportComplete?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  module,
  moduleTitle,
  onImportComplete,
}) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'completed'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Parsed spreadsheet data
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [duplicateMode, setDuplicateMode] = useState<DuplicateHandlingMode>('skip');

  // Preview & execution results
  const [previewSummary, setPreviewSummary] = useState<ImportPreviewSummary | null>(null);
  const [executionResult, setExecutionResult] = useState<ImportExecutionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    await processFile(selectedFile);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (!droppedFile) return;
    await processFile(droppedFile);
  };

  const processFile = async (f: File) => {
    setErrorMessage(null);
    if (!f.name.match(/\.(xlsx|xls|csv)$/i)) {
      setErrorMessage('Please select a valid Excel (.xlsx, .xls) or CSV (.csv) spreadsheet file.');
      return;
    }

    if (f.size > 15 * 1024 * 1024) {
      setErrorMessage('File size exceeds 15MB limit. Please upload a smaller file.');
      return;
    }

    setFile(f);
    setIsProcessing(true);

    try {
      const buffer = await f.arrayBuffer();
      const { headers, rows } = parseSpreadsheetBuffer(buffer);

      if (rows.length === 0) {
        throw new Error('Spreadsheet has no rows of data to import.');
      }

      setDetectedHeaders(headers);
      setRawRows(rows);

      // Auto-map columns
      const mapping = autoMapColumns(module, headers);
      setColumnMapping(mapping);

      // Run initial validation
      const summary = validateImportRows(module, rows, mapping);
      setPreviewSummary(summary);

      // Advance to preview (or mapping if user wants to review)
      setStep('preview');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to read spreadsheet. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemapChange = (header: string, targetField: string) => {
    const updated = { ...columnMapping, [header]: targetField };
    setColumnMapping(updated);
    const summary = validateImportRows(module, rawRows, updated);
    setPreviewSummary(summary);
  };

  const handleConfirmImport = () => {
    if (!previewSummary) return;
    setIsProcessing(true);

    try {
      const result = commitImportBatch(previewSummary, duplicateMode);
      setExecutionResult(result);
      setStep('completed');
      onImportComplete?.();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to import records into the ERP database.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = () => {
    downloadBlankTemplate(module as any);
  };

  const handleDownloadErrors = () => {
    if (previewSummary) {
      downloadImportErrorReport(previewSummary);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setErrorMessage(null);
    setPreviewSummary(null);
    setExecutionResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                Import {moduleTitle} from Excel
              </h3>
              <p className="text-xs text-slate-500">
                Upload .xlsx / .csv spreadsheet, validate records, and import safely
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="px-5 py-2.5 bg-slate-100/50 dark:bg-slate-950/40 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto">
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                step === 'upload' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center text-[11px] font-bold">
                1
              </span>
              Upload File
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                step === 'mapping' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold">
                2
              </span>
              Column Mapping
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                step === 'preview' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold">
                3
              </span>
              Validate & Preview
            </span>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <span
              className={`flex items-center gap-1.5 font-semibold ${
                step === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'
              }`}
            >
              <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-[11px] font-bold">
                4
              </span>
              Done
            </span>
          </div>

          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="hidden sm:flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            <Download className="h-3 w-3" /> Blank Template
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-800 dark:text-rose-200 text-xs flex items-start gap-2.5">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
              <div>
                <p className="font-bold">Error during import</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {/* STEP 1: FILE UPLOAD */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 rounded-2xl p-8 text-center cursor-pointer transition-colors bg-slate-50/50 dark:bg-slate-800/30 hover:bg-emerald-50/30"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="mx-auto w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 mb-3">
                  <Upload className="h-7 w-7" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                  Click to select or drag and drop your spreadsheet here
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Supports Excel (.xlsx, .xls) and CSV (.csv) up to 15MB
                </p>
                <div className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Choose Spreadsheet File
                </div>
              </div>

              {/* Template Banner */}
              <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <h5 className="font-bold text-blue-900 dark:text-blue-200">
                    Need the official spreadsheet template?
                  </h5>
                  <p className="text-blue-700 dark:text-blue-300">
                    Download our blank Excel template formatted with correct headers, validation instructions, and required columns.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shrink-0 cursor-pointer shadow-xs"
                >
                  <Download className="h-3.5 w-3.5" /> Download Blank Template
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: COLUMN MAPPING & CONFIGURATION */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    Map Spreadsheet Columns to ERP Fields
                  </h4>
                  <p className="text-xs text-slate-500">
                    Verify that your spreadsheet headers match the correct Hari Kripa ERP fields
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStep('preview')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs flex items-center gap-1 hover:bg-emerald-700 cursor-pointer shadow-xs"
                >
                  Apply & Preview <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-700 dark:text-slate-300 text-[11px]">
                    <tr>
                      <th className="p-2.5">Spreadsheet Column Header</th>
                      <th className="p-2.5">Sample Value (Row 1)</th>
                      <th className="p-2.5">Mapped ERP Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {detectedHeaders.map((header) => (
                      <tr key={header} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40">
                        <td className="p-2.5 font-semibold text-slate-900 dark:text-white">
                          {header}
                        </td>
                        <td className="p-2.5 text-slate-500 font-mono">
                          {String(rawRows[0]?.[header] ?? '')}
                        </td>
                        <td className="p-2.5">
                          <input
                            type="text"
                            value={columnMapping[header] || ''}
                            onChange={(e) => handleRemapChange(header, e.target.value)}
                            placeholder="ERP Field Name"
                            className="w-full max-w-xs px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: VALIDATION PREVIEW */}
          {step === 'preview' && previewSummary && (
            <div className="space-y-4">
              {/* Summary Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-[11px] text-slate-500 font-medium">Total Rows</div>
                  <div className="text-xl font-bold font-mono text-slate-900 dark:text-white">
                    {previewSummary.totalRows}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Valid Rows
                  </div>
                  <div className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {previewSummary.validCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20">
                  <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Duplicates
                  </div>
                  <div className="text-xl font-bold font-mono text-amber-700 dark:text-amber-400">
                    {previewSummary.duplicateCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20">
                  <div className="text-[11px] text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Invalid Rows
                  </div>
                  <div className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400">
                    {previewSummary.invalidCount}
                  </div>
                </div>
              </div>

              {/* Duplicate Handling Mode & Actions */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-slate-500" />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Duplicate Handling Mode:
                  </span>
                  <select
                    value={duplicateMode}
                    onChange={(e) => setDuplicateMode(e.target.value as DuplicateHandlingMode)}
                    className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-900 dark:text-white"
                  >
                    <option value="skip">Skip duplicates (Safe default)</option>
                    <option value="update">Update matching existing records</option>
                    <option value="insertOnly">Import new records only</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setStep('mapping')}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-semibold text-xs"
                  >
                    Adjust Mapping
                  </button>

                  {previewSummary.invalidCount > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrors}
                      className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-950 text-rose-800 dark:text-rose-200 font-semibold text-xs flex items-center gap-1"
                    >
                      <Download className="h-3 w-3" /> Download Error Report
                    </button>
                  )}
                </div>
              </div>

              {/* Rows Validation Table */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 font-bold uppercase text-slate-700 dark:text-slate-300 sticky top-0 text-[10px]">
                    <tr>
                      <th className="p-2 w-16 text-center">Row</th>
                      <th className="p-2 w-24">Status</th>
                      <th className="p-2">Details / Validation Messages</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {previewSummary.rows.slice(0, 50).map((r) => (
                      <tr
                        key={r.rowNumber}
                        className={
                          r.status === 'invalid'
                            ? 'bg-rose-50/50 dark:bg-rose-950/20'
                            : r.status === 'duplicate'
                            ? 'bg-amber-50/50 dark:bg-amber-950/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }
                      >
                        <td className="p-2 font-mono text-center font-bold">{r.rowNumber}</td>
                        <td className="p-2">
                          {r.status === 'valid' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" /> Valid
                            </span>
                          )}
                          {r.status === 'duplicate' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              <AlertTriangle className="h-3 w-3" /> Duplicate
                            </span>
                          )}
                          {r.status === 'invalid' && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                              <AlertCircle className="h-3 w-3" /> Error
                            </span>
                          )}
                        </td>
                        <td className="p-2">
                          {r.errors.length > 0 ? (
                            <div className="text-rose-600 dark:text-rose-400 font-medium">
                              {r.errors.join('; ')}
                            </div>
                          ) : (
                            <div className="text-slate-600 dark:text-slate-400 font-mono text-[11px] truncate">
                              {JSON.stringify(r.parsedData).slice(0, 100)}...
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {previewSummary.rows.length > 50 && (
                <div className="text-[11px] text-slate-500 text-center">
                  Showing first 50 rows of {previewSummary.rows.length} total rows.
                </div>
              )}
            </div>
          )}

          {/* STEP 4: COMPLETED SUMMARY */}
          {step === 'completed' && executionResult && (
            <div className="p-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <CheckCircle2 className="h-8 w-8" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                  Import Completed Successfully
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Spreadsheet records have been processed and saved into Hari Kripa ERP database
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto text-left">
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Rows</div>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-white">
                    {executionResult.totalRows}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/30">
                  <div className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-semibold">Inserted</div>
                  <div className="text-lg font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {executionResult.insertedCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30">
                  <div className="text-[10px] text-blue-700 dark:text-blue-400 uppercase font-semibold">Updated</div>
                  <div className="text-lg font-bold font-mono text-blue-700 dark:text-blue-400">
                    {executionResult.updatedCount}
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Skipped</div>
                  <div className="text-lg font-bold font-mono text-slate-700 dark:text-slate-300">
                    {executionResult.skippedCount}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
          <div>
            {step !== 'upload' && step !== 'completed' && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100"
              >
                Start Over
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
            >
              {step === 'completed' ? 'Close' : 'Cancel'}
            </button>

            {step === 'preview' && (
              <button
                type="button"
                disabled={isProcessing || !previewSummary || (previewSummary.validCount === 0 && previewSummary.duplicateCount === 0)}
                onClick={handleConfirmImport}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Importing...
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" /> Confirm & Import {previewSummary?.validCount || 0} Records
                  </>
                )}
              </button>
            )}

            {step === 'completed' && (
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                Done
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
