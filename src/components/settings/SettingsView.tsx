import React, { useState, useRef } from 'react';
import { db } from '../../services/db';
import { CrateType, GeneralSettings, Unit } from '../../types';
import { CompanyBillProfilesView } from '../billing/CompanyBillProfilesView';
import { ImageUploader } from '../common/ImageUploader';
import { ExcelActionBar } from '../common/ExcelActionBar';
import { exportAllErpDataZip, exportUnitsAndCrates } from '../../utils/excelEngine';
import {
  Settings,
  Building2,
  Box,
  Scale,
  Database,
  Download,
  Upload,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

interface SettingsViewProps {
  initialTab?: 'general' | 'profiles' | 'units' | 'crates' | 'backup';
}

export const SettingsView: React.FC<SettingsViewProps> = ({ initialTab = 'general' }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'profiles' | 'units' | 'crates' | 'backup'>(initialTab);

  React.useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);
  const [settings, setSettings] = useState<GeneralSettings>(db.getSettings());
  const [units, setUnits] = useState<Unit[]>(db.getUnits());
  const [crateTypes, setCrateTypes] = useState<CrateType[]>(db.getCrateTypes());

  // Unit modal
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitSymbol, setNewUnitSymbol] = useState('');

  // Crate modal
  const [newCrateName, setNewCrateName] = useState('');
  const [newCrateWeight, setNewCrateWeight] = useState<number | ''>(20);
  const [newCrateDesc, setNewCrateDesc] = useState('');

  // Import file
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [zipProgress, setZipProgress] = useState<string | null>(null);
  const [isExportingZip, setIsExportingZip] = useState(false);

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    db.saveSettings(settings);
    alert('General settings saved successfully.');
  };

  const handleAddUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUnitName.trim() || !newUnitSymbol.trim()) return;
    const u: Unit = {
      id: `u-${Date.now()}`,
      name: newUnitName.trim(),
      symbol: newUnitSymbol.trim(),
    };
    db.saveUnit(u);
    setUnits(db.getUnits());
    setNewUnitName('');
    setNewUnitSymbol('');
  };

  const handleDeleteUnit = (id: string) => {
    db.deleteUnit(id);
    setUnits(db.getUnits());
  };

  const handleAddCrateType = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCrateName.trim() || !newCrateWeight) return;
    const ct: CrateType = {
      id: `ct-${Date.now()}`,
      name: newCrateName.trim(),
      defaultWeightKg: Number(newCrateWeight),
      description: newCrateDesc.trim(),
    };
    db.saveCrateType(ct);
    setCrateTypes(db.getCrateTypes());
    setNewCrateName('');
    setNewCrateWeight(20);
    setNewCrateDesc('');
  };

  const handleDeleteCrateType = (id: string) => {
    db.deleteCrateType(id);
    setCrateTypes(db.getCrateTypes());
  };

  const handleExportAllZip = async () => {
    setIsExportingZip(true);
    setZipProgress('Starting full ERP export...');
    try {
      await exportAllErpDataZip((msg) => setZipProgress(msg));
      setZipProgress('Export completed! ZIP file downloaded.');
      setTimeout(() => setZipProgress(null), 4000);
    } catch (err: any) {
      alert('Failed to export ERP data: ' + err.message);
      setZipProgress(null);
    } finally {
      setIsExportingZip(false);
    }
  };

  const handleExportBackup = () => {
    const json = db.exportDatabaseJson();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `HariKripa_FruitERP_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = db.importDatabaseJson(content);
      if (success) {
        setImportStatus('Database successfully restored from backup.');
        setSettings(db.getSettings());
        setUnits(db.getUnits());
        setCrateTypes(db.getCrateTypes());
      } else {
        setImportStatus('Failed to restore backup. Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  };

  const handleResetSampleData = () => {
    if (confirm('Load default test/sample data as specified in the test scenario? This preserves clean demo records.')) {
      db.resetToDefaultData();
      setSettings(db.getSettings());
      setUnits(db.getUnits());
      setCrateTypes(db.getCrateTypes());
      alert('Sample test data loaded successfully.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
          <Settings className="h-5 w-5 text-emerald-600" /> Settings & Master Configuration
        </h2>
        <p className="text-xs text-slate-500">
          Billing profiles, measurement units, smart crate conversions and data backup
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'general'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          General Settings
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('profiles')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'profiles'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Building2 className="h-3.5 w-3.5" /> Company / Bill Profiles
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('units')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'units'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Scale className="h-3.5 w-3.5" /> Units
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('crates')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'crates'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Box className="h-3.5 w-3.5" /> Crate Types
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === 'backup'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Database className="h-3.5 w-3.5" /> Data Backup & Safety
        </button>
      </div>

      {/* General Settings Tab */}
      {activeTab === 'general' && (
        <form onSubmit={handleSaveSettings} className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 max-w-2xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Application Name (English)
              </label>
              <input
                type="text"
                value={settings.businessName}
                onChange={(e) => setSettings({ ...settings, businessName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Application Name (Hindi) <span className="text-slate-400 font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. हरि कृपा फ्रूट ईआरपी"
                value={settings.businessNameHindi || ''}
                onChange={(e) => setSettings({ ...settings, businessNameHindi: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-devanagari"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Main Business / Account Name
            </label>
            <input
              type="text"
              value={settings.mainAccountName}
              onChange={(e) => setSettings({ ...settings, mainAccountName: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Financial Year
              </label>
              <input
                type="text"
                value={settings.financialYear}
                onChange={(e) => setSettings({ ...settings, financialYear: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Currency Symbol
              </label>
              <input
                type="text"
                value={settings.currencySymbol}
                onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Business Logo Section for Primary Default Profile */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider dark:text-slate-200 flex items-center justify-between">
              <span>Primary Business Logo</span>
              <span className="text-[11px] font-normal text-emerald-600">Default Mandi Profile</span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Upload your company business logo. This logo appears in your business profile and documents.
            </p>
            <div className="pt-1">
              <ImageUploader
                label=""
                helperText="Upload JPG, PNG or WebP logo file. Stored securely for future sessions."
                currentValue={db.getDefaultProfile()?.logo}
                onChange={(logoUri) => {
                  const defaultProf = db.getDefaultProfile();
                  if (defaultProf) {
                    db.saveCompanyProfile({ ...defaultProf, logo: logoUri });
                    setSettings({ ...settings });
                  }
                }}
                previewShape="rounded"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Default Crate Weight (KG)
            </label>
            <input
              type="number"
              value={settings.defaultCrateWeightKg}
              onChange={(e) => setSettings({ ...settings, defaultCrateWeightKg: Number(e.target.value) })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Save Configuration
            </button>
          </div>
        </form>
      )}

      {/* Profiles Tab */}
      {activeTab === 'profiles' && <CompanyBillProfilesView />}

      {/* Units Tab */}
      {activeTab === 'units' && (
        <div className="space-y-6">
          <form onSubmit={handleAddUnit} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex flex-wrap items-end gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Unit Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Kilogram"
                value={newUnitName}
                onChange={(e) => setNewUnitName(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Symbol / Abbr</label>
              <input
                type="text"
                required
                placeholder="e.g. KG"
                value={newUnitSymbol}
                onChange={(e) => setNewUnitSymbol(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Unit
              </button>
              <ExcelActionBar
                module="units"
                moduleTitle="Units"
                onExportAll={exportUnitsAndCrates}
                totalCount={units.length}
                onImportComplete={() => setUnits(db.getUnits())}
              />
            </div>
          </form>

          <div className="rounded-xl border border-slate-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold text-[11px] uppercase dark:border-slate-800 dark:bg-slate-800/60">
                <tr>
                  <th className="px-5 py-3">Unit Name</th>
                  <th className="px-5 py-3">Symbol</th>
                  <th className="px-5 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {units.map((u) => (
                  <tr key={u.id}>
                    <td className="px-5 py-3 font-semibold text-xs text-slate-800 dark:text-slate-200">{u.name}</td>
                    <td className="px-5 py-3 font-mono-numbers text-xs text-slate-600">{u.symbol}</td>
                    <td className="px-5 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteUnit(u.id)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Crate Types Tab */}
      {activeTab === 'crates' && (
        <div className="space-y-6">
          <form onSubmit={handleAddCrateType} className="rounded-xl border border-slate-200 bg-white p-5 shadow-2xs dark:border-slate-800 dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Crate Type Name</label>
              <input
                type="text"
                required
                placeholder="e.g. 20 KG Standard Crate"
                value={newCrateName}
                onChange={(e) => setNewCrateName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Default Weight (KG)</label>
              <input
                type="number"
                required
                min="0.1"
                step="0.5"
                placeholder="20"
                value={newCrateWeight}
                onChange={(e) => setNewCrateWeight(e.target.value ? Number(e.target.value) : '')}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-mono-numbers text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">Description</label>
              <input
                type="text"
                placeholder="e.g. Plastic crate"
                value={newCrateDesc}
                onChange={(e) => setNewCrateDesc(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="submit"
                className="flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" /> Add Crate Type
              </button>
              <ExcelActionBar
                module="crates"
                moduleTitle="Crate Types"
                onExportAll={exportUnitsAndCrates}
                totalCount={crateTypes.length}
                onImportComplete={() => setCrateTypes(db.getCrateTypes())}
              />
            </div>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {crateTypes.map((ct) => (
              <div key={ct.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs dark:border-slate-800 dark:bg-slate-900 flex justify-between items-start">
                <div>
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white">{ct.name}</h4>
                  <div className="text-xs text-sky-700 dark:text-sky-300 font-semibold font-mono-numbers mt-1">
                    Standard Conversion: 1 Crate = {ct.defaultWeightKg} KG
                  </div>
                  {ct.description && (
                    <div className="text-[11px] text-slate-500 mt-1">{ct.description}</div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteCrateType(ct.id)}
                  className="p-1 text-slate-400 hover:text-rose-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Backup & Safety Tab */}
      {activeTab === 'backup' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-6 max-w-2xl">
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Database Backup & Recovery</h3>
            <p className="text-xs text-slate-500">
              Export complete business database to JSON file, or restore existing backup
            </p>
          </div>

          {importStatus && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
              {importStatus}
            </div>
          )}

          <div className="space-y-4">
            {/* Full ERP Excel ZIP Export */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/30">
              <div>
                <span className="font-bold text-xs text-emerald-900 dark:text-emerald-200 block flex items-center gap-1.5">
                  <Database className="h-4 w-4 text-emerald-600" /> Export All ERP Data (Excel Workbooks ZIP)
                </span>
                <span className="text-[11px] text-emerald-700 dark:text-emerald-300 block mt-0.5">
                  Generates a single ZIP package containing separate genuine .xlsx workbooks for Fruit Master, Customers, Vendors, Cash Sales, Credit Sales, Sale Proceeds, Receipts, Expenses, and Ledgers.
                </span>
                {zipProgress && (
                  <div className="mt-2 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5 animate-pulse">
                    <RefreshCw className="h-3 w-3 animate-spin text-emerald-600" /> {zipProgress}
                  </div>
                )}
              </div>
              <button
                type="button"
                disabled={isExportingZip}
                onClick={handleExportAllZip}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shrink-0 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Download className="h-4 w-4" /> {isExportingZip ? 'Packaging...' : 'Export All (ZIP)'}
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
              <div>
                <span className="font-semibold text-xs text-slate-900 dark:text-white block">Export Database Backup</span>
                <span className="text-[11px] text-slate-500">
                  Downloads all customers, ledgers, proceeds, receipts, crate balances & bills as a JSON file.
                </span>
              </div>
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 shrink-0"
              >
                <Download className="h-4 w-4" /> Download Backup
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/40">
              <div>
                <span className="font-semibold text-xs text-slate-900 dark:text-white block">Restore from Backup</span>
                <span className="text-[11px] text-slate-500">
                  Select a previously downloaded JSON backup file to restore database state.
                </span>
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleImportBackup}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white shrink-0"
                >
                  <Upload className="h-4 w-4" /> Import Backup File
                </button>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
              <div>
                <span className="font-semibold text-xs text-amber-900 dark:text-amber-300 block">
                  Reset / Seed Sample Test Data
                </span>
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  Restores clean test records: Sale Proceeds No. 001 (₹4,186 / net ₹4,070), Credit Sale No. 001, 20 KG crates and ledger balances.
                </span>
              </div>
              <button
                type="button"
                onClick={handleResetSampleData}
                className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700 shrink-0"
              >
                <RefreshCw className="h-4 w-4" /> Load Sample Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
