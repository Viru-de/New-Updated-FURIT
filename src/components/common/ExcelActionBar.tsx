import React, { useState, useRef, useEffect } from 'react';
import { Download, Upload, FileSpreadsheet, ChevronDown } from 'lucide-react';
import { ExcelImportModal } from './ExcelImportModal';
import { ImportModule } from '../../utils/excelImportEngine';
import { TemplateModule, downloadBlankTemplate } from '../../utils/excelEngine';

interface ExcelActionBarProps {
  module: ImportModule;
  templateModule?: TemplateModule;
  moduleTitle: string;
  onExportFiltered?: () => void;
  onExportAll?: () => void;
  filteredCount?: number;
  totalCount?: number;
  onImportComplete?: () => void;
  hideImport?: boolean;
  hideTemplate?: boolean;
  className?: string;
}

export const ExcelActionBar: React.FC<ExcelActionBarProps> = ({
  module,
  templateModule,
  moduleTitle,
  onExportFiltered,
  onExportAll,
  filteredCount,
  totalCount,
  onImportComplete,
  hideImport = false,
  hideTemplate = false,
  className = '',
}) => {
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const tModule = templateModule || (module as unknown as TemplateModule);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsExportDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportClick = () => {
    if (onExportFiltered && onExportAll && filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount) {
      // Toggle dropdown if filtered and total differ
      setIsExportDropdownOpen(!isExportDropdownOpen);
    } else if (onExportFiltered) {
      onExportFiltered();
    } else if (onExportAll) {
      onExportAll();
    }
  };

  const handleDownloadTemplate = () => {
    downloadBlankTemplate(tModule);
  };

  return (
    <div className={`flex flex-wrap items-center gap-1.5 sm:gap-2 ${className}`}>
      {/* Export Excel Button with Filtered / All Option */}
      <div className="relative" ref={dropdownRef}>
        <div className="inline-flex rounded-lg shadow-2xs">
          <button
            type="button"
            onClick={handleExportClick}
            title="Export data to Excel (.xlsx)"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="hidden xs:inline">Export</span> Excel
            {onExportFiltered && onExportAll && filteredCount !== undefined && totalCount !== undefined && filteredCount !== totalCount && (
              <ChevronDown className="h-3 w-3 text-slate-400 ml-0.5" />
            )}
          </button>
        </div>

        {isExportDropdownOpen && (
          <div className="absolute right-0 top-full mt-1 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 shadow-xl z-40 text-xs">
            <button
              type="button"
              onClick={() => {
                setIsExportDropdownOpen(false);
                onExportFiltered?.();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center justify-between"
            >
              <span>Export Filtered Records</span>
              <span className="text-[10px] font-mono font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                {filteredCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsExportDropdownOpen(false);
                onExportAll?.();
              }}
              className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium flex items-center justify-between"
            >
              <span>Export All Records</span>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                {totalCount}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Import Excel Button */}
      {!hideImport && (
        <button
          type="button"
          onClick={() => setIsImportOpen(true)}
          title="Import records from Excel spreadsheet"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer shadow-2xs"
        >
          <Upload className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          <span className="hidden xs:inline">Import</span> Excel
        </button>
      )}

      {/* Download Blank Template Button */}
      {!hideTemplate && (
        <button
          type="button"
          onClick={handleDownloadTemplate}
          title="Download formatted blank template with instructions"
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-2.5 sm:px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors cursor-pointer shadow-2xs"
        >
          <FileSpreadsheet className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="hidden sm:inline">Template</span>
        </button>
      )}

      {/* Import Modal */}
      {!hideImport && (
        <ExcelImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          module={module}
          moduleTitle={moduleTitle}
          onImportComplete={() => {
            onImportComplete?.();
          }}
        />
      )}
    </div>
  );
};
