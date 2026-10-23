import React, { useState } from 'react';
import { CompanyProfile } from '../../types';
import { db } from '../../services/db';
import { ImageUploader } from '../common/ImageUploader';
import { exportCompanyProfiles } from '../../utils/excelEngine';
import { maskAadhaar, formatAadhaarInput, validateAadhaarNumber } from '../../utils/aadhaarUtils';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  X,
  Phone,
  Mail,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Download,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';

export const CompanyBillProfilesView: React.FC = () => {
  const [profiles, setProfiles] = useState<CompanyProfile[]>(db.getCompanyProfiles());
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CompanyProfile | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [hindiName, setHindiName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [pincode, setPincode] = useState('');
  const [primaryContactName, setPrimaryContactName] = useState('');
  const [mobile, setMobile] = useState('');
  const [alternate1ContactName, setAlternate1ContactName] = useState('');
  const [alternate1Mobile, setAlternate1Mobile] = useState('');
  const [alternate2ContactName, setAlternate2ContactName] = useState('');
  const [alternate2Mobile, setAlternate2Mobile] = useState('');
  const [email, setEmail] = useState('');
  const [aadhaarNo, setAadhaarNo] = useState('');
  const [aadhaarError, setAadhaarError] = useState<string | null>(null);
  const [pan, setPan] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [branch, setBranch] = useState('');
  const [terms, setTerms] = useState('');
  const [footerText, setFooterText] = useState('');
  const [signatureTitle, setSignatureTitle] = useState('Authorized Signatory');
  const [logo, setLogo] = useState<string | undefined>(undefined);
  const [isDefault, setIsDefault] = useState(false);

  // State to toggle masked/revealed Aadhaar in profile cards
  const [revealedAadhaar, setRevealedAadhaar] = useState<Record<string, boolean>>({});
  const toggleRevealAadhaar = (id: string) => {
    setRevealedAadhaar((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const refreshList = () => {
    setProfiles(db.getCompanyProfiles());
  };

  const openAdd = () => {
    setEditingProfile(null);
    setName('');
    setHindiName('');
    setTradeName('');
    setAddress('');
    setCity('');
    setState('Maharashtra');
    setPincode('');
    setPrimaryContactName('');
    setMobile('');
    setAlternate1ContactName('');
    setAlternate1Mobile('');
    setAlternate2ContactName('');
    setAlternate2Mobile('');
    setEmail('');
    setAadhaarNo('');
    setAadhaarError(null);
    setPan('');
    setBankName('');
    setAccountNumber('');
    setIfsc('');
    setBranch('');
    setTerms('1. Goods once sold will not be taken back.\n2. Subject to local mandi jurisdiction.');
    setFooterText('Thank you for your business!');
    setSignatureTitle('Authorized Signatory');
    setLogo(undefined);
    setIsDefault(false);
    setIsModalOpen(true);
  };

  const openEdit = (p: CompanyProfile) => {
    setEditingProfile(p);
    setName(p.name);
    setHindiName(p.hindiName || '');
    setTradeName(p.tradeName || '');
    setAddress(p.address);
    setCity(p.city);
    setState(p.state);
    setPincode(p.pincode);
    setPrimaryContactName(p.primaryContactName || '');
    setMobile(p.mobile || '');
    setAlternate1ContactName(p.alternate1ContactName || '');
    setAlternate1Mobile(p.alternate1Mobile || p.alternateMobile || '');
    setAlternate2ContactName(p.alternate2ContactName || '');
    setAlternate2Mobile(p.alternate2Mobile || '');
    setEmail(p.email || '');
    setAadhaarNo(p.aadhaarNo ? formatAadhaarInput(p.aadhaarNo) : '');
    setAadhaarError(null);
    setPan(p.pan || '');
    setBankName(p.bankName || '');
    setAccountNumber(p.accountNumber || '');
    setIfsc(p.ifsc || '');
    setBranch(p.branch || '');
    setTerms(p.termsAndConditions || '');
    setFooterText(p.footerText || '');
    setSignatureTitle(p.signatureTitle || 'Authorized Signatory');
    setLogo(p.logo);
    setIsDefault(p.isDefault);
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    // Validate optional Aadhaar Card No.
    const trimmedAadhaar = aadhaarNo.trim();
    if (trimmedAadhaar) {
      const validation = validateAadhaarNumber(trimmedAadhaar);
      if (!validation.isValid) {
        setAadhaarError(validation.error || 'Aadhaar Card No. must be a valid 12-digit number (e.g. 1234 5678 9012).');
        return;
      }
    }

    const trimmedAlt1Mobile = alternate1Mobile.trim();
    const profileRecord: CompanyProfile = {
      id: editingProfile ? editingProfile.id : `cp-${Date.now()}`,
      name: name.trim(),
      hindiName: hindiName.trim() || undefined,
      tradeName: tradeName.trim() || undefined,
      shortCode: editingProfile?.shortCode,
      primaryContactName: primaryContactName.trim() || undefined,
      mobile: mobile.trim(),
      alternate1ContactName: alternate1ContactName.trim() || undefined,
      alternate1Mobile: trimmedAlt1Mobile || undefined,
      alternateMobile: trimmedAlt1Mobile || undefined, // Preserved for backward compatibility
      alternate2ContactName: alternate2ContactName.trim() || undefined,
      alternate2Mobile: alternate2Mobile.trim() || undefined,
      softwareDevelopedBy: editingProfile?.softwareDevelopedBy,
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode: pincode.trim(),
      email: email.trim() || undefined,
      aadhaarNo: trimmedAadhaar ? formatAadhaarInput(trimmedAadhaar) : undefined,
      gstin: editingProfile ? editingProfile.gstin : undefined, // Preserved in database without displaying in UI
      pan: pan.trim() || undefined,
      bankName: bankName.trim() || undefined,
      accountNumber: accountNumber.trim() || undefined,
      ifsc: ifsc.trim() || undefined,
      branch: branch.trim() || undefined,
      termsAndConditions: terms.trim() || undefined,
      footerText: footerText.trim() || undefined,
      signatureTitle: signatureTitle.trim() || undefined,
      logo,
      isDefault,
      createdAt: editingProfile ? editingProfile.createdAt : new Date().toISOString(),
    };

    db.saveCompanyProfile(profileRecord);
    refreshList();
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (profiles.length <= 1) {
      alert('Cannot delete the last company profile.');
      return;
    }
    if (confirm('Delete this company bill profile?')) {
      db.deleteCompanyProfile(id);
      refreshList();
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="h-5 w-5 text-emerald-600" /> Company Bill Profiles
          </h2>
          <p className="text-xs text-slate-500">
            Billing entities, letterheads, bank accounts, Aadhaar Card No. & terms printed on customer bills
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCompanyProfiles}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" /> Export Excel
          </button>
          <button
            type="button"
            onClick={openAdd}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 cursor-pointer"
          >
            <Plus className="h-4 w-4" /> + Add Billing Profile
          </button>
        </div>
      </div>

      {/* Profiles Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`rounded-xl border p-5 shadow-2xs transition-all dark:bg-slate-900 ${
              profile.isDefault
                ? 'border-emerald-500 bg-white ring-1 ring-emerald-500 dark:border-emerald-500'
                : 'border-slate-200 bg-white dark:border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-start gap-3 min-w-0">
                {profile.logo ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white p-1 overflow-hidden shadow-2xs dark:border-slate-800">
                    <img
                      src={profile.logo}
                      alt={profile.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500 shadow-2xs dark:border-slate-800 dark:bg-slate-800">
                    <Building2 className="h-6 w-6 text-emerald-600" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900 truncate dark:text-white">
                      {profile.name}
                    </h3>
                    {profile.isDefault && (
                      <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full dark:bg-emerald-950/40 dark:text-emerald-400 shrink-0">
                        <CheckCircle2 className="h-3 w-3" /> Default Billing Profile
                      </span>
                    )}
                  </div>
                  {profile.hindiName && (
                    <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 font-devanagari">
                      {profile.hindiName}
                    </div>
                  )}
                  {profile.tradeName && (
                    <div className="text-xs text-slate-500 truncate">{profile.tradeName}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => openEdit(profile)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                {!profile.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleDelete(profile.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1.5 mb-4">
              <p>{profile.address}, {profile.city}, {profile.state} - {profile.pincode}</p>
              <div className="space-y-1 text-slate-600 dark:text-slate-400 pt-0.5">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1 font-medium text-slate-800 dark:text-slate-200">
                    <Phone className="h-3 w-3 text-emerald-600" />
                    {profile.primaryContactName ? `Contact: ${profile.primaryContactName} — ` : ''}Mobile: {profile.mobile}
                  </span>
                  {profile.email && (
                    <span className="flex items-center gap-1 text-slate-500">
                      <Mail className="h-3 w-3" /> {profile.email}
                    </span>
                  )}
                </div>

                {(profile.alternate1Mobile || profile.alternateMobile) && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Alternate 1:</span>
                    {profile.alternate1ContactName ? `${profile.alternate1ContactName} — ` : ''}
                    <span>Mobile: {profile.alternate1Mobile || profile.alternateMobile}</span>
                  </div>
                )}

                {profile.alternate2Mobile && (
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Alternate 2:</span>
                    {profile.alternate2ContactName ? `${profile.alternate2ContactName} — ` : ''}
                    <span>Mobile: {profile.alternate2Mobile}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs dark:border-slate-800 dark:bg-slate-800/40 mb-3">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Aadhaar Card No.</span>
                <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {profile.aadhaarNo ? (
                    <>
                      <span>{revealedAadhaar[profile.id] ? profile.aadhaarNo : maskAadhaar(profile.aadhaarNo)}</span>
                      <button
                        type="button"
                        onClick={() => toggleRevealAadhaar(profile.id)}
                        title={revealedAadhaar[profile.id] ? 'Hide Aadhaar No.' : 'View Full Aadhaar No.'}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer p-0.5"
                      >
                        {revealedAadhaar[profile.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    </>
                  ) : (
                    <span className="text-slate-400 font-sans font-normal italic text-[11px]">Not provided</span>
                  )}
                </div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">PAN</span>
                <span className="font-mono-numbers font-semibold text-slate-800 dark:text-slate-200 font-mono">
                  {profile.pan || '-'}
                </span>
              </div>
            </div>

            {profile.bankName && (
              <div className="text-xs text-slate-500 rounded-lg border border-slate-100 p-2 dark:border-slate-800">
                <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-0.5">
                  Bank Account:
                </span>
                <span className="font-mono-numbers">
                  {profile.bankName} · A/C: {profile.accountNumber} · IFSC: {profile.ifsc}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900 max-h-[92vh] overflow-y-auto min-w-0 mx-2 sm:mx-auto">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 sm:px-6 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                {editingProfile ? 'Edit Company Bill Profile' : 'Add New Billing Profile'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 p-4 sm:p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company Name (English) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Hari Kripa Fruits"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-sans"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Company Name (Hindi) <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. हरि कृपा फ्रूट्स"
                    value={hindiName}
                    onChange={(e) => setHindiName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white font-devanagari"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Trade / Subtitle (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Wholesale Fruit Commission Agent"
                  value={tradeName}
                  onChange={(e) => setTradeName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Business Logo Upload */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <ImageUploader
                  label="Business Logo (Optional)"
                  helperText="Upload company logo for this billing profile. Preview and replace anytime."
                  currentValue={logo}
                  onChange={setLogo}
                  previewShape="rounded"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Address / Gala No. *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Market address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    City
                  </label>
                  <input
                    type="text"
                    required
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    State
                  </label>
                  <input
                    type="text"
                    required
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Pincode
                  </label>
                  <input
                    type="text"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              {/* Company Contact Numbers: Primary Mobile, Alternate 1 Mobile, Alternate 2 Mobile */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3 dark:border-slate-800 dark:bg-slate-900/40">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-emerald-600" /> Company Contact Numbers
                </div>

                {/* Primary Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Primary Contact Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Rajesh"
                      value={primaryContactName}
                      onChange={(e) => setPrimaryContactName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Primary Mobile Number *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. 9820012345"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Alternate 1 Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Alternate 1 Contact Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Suresh"
                      value={alternate1ContactName}
                      onChange={(e) => setAlternate1ContactName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Alternate 1 Mobile Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9876543210"
                      value={alternate1Mobile}
                      onChange={(e) => setAlternate1Mobile(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>

                {/* Alternate 2 Mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Alternate 2 Contact Name <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Mahesh"
                      value={alternate2ContactName}
                      onChange={(e) => setAlternate2ContactName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                      Alternate 2 Mobile Number <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 9811122233"
                      value={alternate2Mobile}
                      onChange={(e) => setAlternate2Mobile(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Aadhaar Card No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1234 5678 9012"
                    value={aadhaarNo}
                    maxLength={14}
                    onChange={(e) => {
                      setAadhaarNo(formatAadhaarInput(e.target.value));
                      setAadhaarError(null);
                    }}
                    className={`w-full rounded-lg border px-3 py-2 text-sm text-slate-900 outline-none dark:bg-slate-800 dark:text-white font-mono tracking-wider ${
                      aadhaarError
                        ? 'border-rose-500 focus:border-rose-600'
                        : 'border-slate-300 focus:border-emerald-500 dark:border-slate-700'
                    }`}
                  />
                  {aadhaarError && (
                    <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400 flex items-center gap-1 font-sans">
                      <AlertCircle className="h-3 w-3 shrink-0" /> {aadhaarError}
                    </p>
                  )}
                  <p className="mt-0.5 text-[10px] text-slate-400 dark:text-slate-500 font-sans">
                    Optional 12-digit number. Displayed masked in profile details and bill prints.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    PAN <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="AABCH1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white uppercase font-mono"
                  />
                </div>
              </div>

              {/* Bank Details */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  Bank Details for Invoice
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Bank Name (e.g. HDFC Bank)"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Account Number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="IFSC Code"
                    value={ifsc}
                    onChange={(e) => setIfsc(e.target.value.toUpperCase())}
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white uppercase"
                  />
                  <input
                    type="text"
                    placeholder="Branch"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    className="rounded border border-slate-300 px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Terms & Conditions
                </label>
                <textarea
                  rows={2}
                  value={terms}
                  onChange={(e) => setTerms(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="defaultProfileToggle"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <label
                  htmlFor="defaultProfileToggle"
                  className="text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Set as default profile for new bills
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                >
                  Save Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
