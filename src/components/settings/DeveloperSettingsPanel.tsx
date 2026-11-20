import React, { useState, useEffect } from 'react';
import { devAuthClient } from '../../services/devAuthClient';
import { db } from '../../services/db';
import { getPlatformCapabilities } from '../../platform/desktopBridge';
import {
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Lock,
  Monitor,
  Database,
  LogOut,
  Loader2,
} from 'lucide-react';

interface DeveloperSettingsPanelProps {
  onSessionInvalidated?: () => void;
}

export const DeveloperSettingsPanel: React.FC<DeveloperSettingsPanelProps> = ({
  onSessionInvalidated,
}) => {
  const activeUser = db.getActiveUser();
  const [sessionVerified, setSessionVerified] = useState<boolean | null>(null);
  const [isPasswordFormOpen, setIsPasswordFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [requireReLogin, setRequireReLogin] = useState(false);

  const currentPasswordInputRef = React.useRef<HTMLInputElement>(null);
  const capabilities = getPlatformCapabilities();

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const res = await devAuthClient.verifySession();
      if (cancelled) return;
      setSessionVerified(res.authenticated);
      if (!res.authenticated && onSessionInvalidated) {
        onSessionInvalidated();
      }
    };
    void check();
    return () => {
      cancelled = true;
    };
  }, [onSessionInvalidated]);

  if (!activeUser || activeUser.role !== 'developer') {
    return null;
  }

  const handleOpenPasswordForm = () => {
    setErrorMsg(null);
    if (!requireReLogin) {
      setSuccessMsg(null);
    }
    setIsPasswordFormOpen(true);
    setTimeout(() => {
      currentPasswordInputRef.current?.focus();
    }, 0);
  };

  const handleCancelPasswordForm = () => {
    setIsPasswordFormOpen(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setErrorMsg('Please fill in Current Password, New Password, and Confirm New Password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg('New Password and Confirm New Password do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMsg('New Password must be different from your Current Password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await devAuthClient.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });

      if (!result.ok) {
        setErrorMsg(result.error || 'Failed to update developer password.');
        if (result.unauthorized) {
          setSessionVerified(false);
        }
        return;
      }

      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setShowCurrentPassword(false);
      setShowNewPassword(false);
      setShowConfirmPassword(false);
      setSuccessMsg(
        result.message ||
          'Developer password updated successfully. All active developer sessions have been invalidated.'
      );
      setRequireReLogin(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteRelogin = () => {
    devAuthClient.clearClientToken();
    db.setActiveUser(null);
    if (onSessionInvalidated) {
      onSessionInvalidated();
    }
  };

  const isFormVisible = isPasswordFormOpen || requireReLogin;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Developer Role Banner + Prominent Top Action Button */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <span>Developer Account & Security</span>
                <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300">
                  Developer Role
                </span>
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Signed in as <strong>{activeUser.username}</strong>. Credentials are verified and hashed (bcrypt) on the server and are never visible to staff or administrators.
              </p>
            </div>
          </div>
          {sessionVerified === true && !requireReLogin && (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 shrink-0 self-start sm:self-center">
              <Lock className="h-3 w-3" /> Session Verified
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-indigo-200/70 pt-3 dark:border-indigo-900/60">
          <button
            type="button"
            onClick={handleOpenPasswordForm}
            disabled={requireReLogin}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <KeyRound className="h-4 w-4" />
            <span>Change / Reset Developer Password</span>
          </button>
          <span className="text-[11px] text-slate-600 dark:text-slate-300">
            Requires current password verification & invalidates active sessions on update.
          </span>
        </div>
      </div>

      {/* Password Management Form (Opened via Change / Reset Developer Password button) */}
      {isFormVisible && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-5">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  Change Developer Password
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Updating the developer password immediately invalidates all existing developer sessions.
                </p>
              </div>
            </div>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div
              role="status"
              className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-3"
            >
              <div className="flex items-start gap-2 font-semibold">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
              {requireReLogin && (
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-emerald-200/70 dark:border-emerald-800/60">
                  <span className="text-[11px] text-emerald-700 dark:text-emerald-300">
                    Please sign in again using your updated developer password.
                  </span>
                  <button
                    type="button"
                    onClick={handleCompleteRelogin}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer shrink-0"
                  >
                    <LogOut className="h-3.5 w-3.5" /> Sign In Again
                  </button>
                </div>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
            {/* Current Password */}
            <div>
              <label
                htmlFor="dev-current-password"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  ref={currentPasswordInputRef}
                  id="dev-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isSubmitting || requireReLogin}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current developer password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  aria-label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label
                htmlFor="dev-new-password"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="dev-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={isSubmitting || requireReLogin}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  aria-label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label
                htmlFor="dev-confirm-password"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="dev-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  disabled={isSubmitting || requireReLogin}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="Re-enter new developer password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={isSubmitting || requireReLogin}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Update Password</span>
                  </>
                )}
              </button>

              {!requireReLogin && (
                <button
                  type="button"
                  onClick={handleCancelPasswordForm}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
            <strong className="text-slate-800 dark:text-slate-200">Forgotten Developer Password?</strong>{' '}
            For security, Admin and Accountant accounts cannot reset Developer credentials from the interface. Recovery must be performed directly on the private server host via the server-side CLI recovery tool (<code className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-700 px-1 py-0.5 rounded">npm run dev:recover-password</code>).
          </div>
        </div>
      )}

      {/* Windows Desktop Conversion Readiness (Read-only Architecture Overview) */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Monitor className="h-4 w-4 text-emerald-600" />
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Windows Desktop Conversion Readiness
              </h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Active Host: <strong className="uppercase">{capabilities.runtimeHost}</strong> · SQLite Target Tables: <strong>{capabilities.sqliteTablesCount}</strong>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300">
            <Database className="h-3 w-3" /> Desktop Bridge Ready
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {capabilities.blueprintAreas.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-100 bg-slate-50/70 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/40"
            >
              <div className="font-bold text-slate-800 dark:text-slate-100">{item.area}</div>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600 dark:text-slate-400">
                <div>
                  <span className="font-semibold text-slate-700 dark:text-slate-300">Current Web:</span>{' '}
                  {item.currentWebImplementation}
                </div>
                <div>
                  <span className="font-semibold text-indigo-700 dark:text-indigo-300">Desktop Target:</span>{' '}
                  {item.futureWindowsImplementation}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
