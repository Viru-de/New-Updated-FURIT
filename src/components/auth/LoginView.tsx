import React, { useState } from 'react';
import { db } from '../../services/db';
import { userAuthClient } from '../../services/userAuthClient';
import { devAuthClient } from '../../services/devAuthClient';
import { SafeUserSummary, User } from '../../types';
import {
  ShieldCheck,
  Sun,
  Moon,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Loader2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  HelpCircle,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

type LoginScreenMode = 'login' | 'recovery';
type RecoveryChoice = 'staff' | 'owner';

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [screenMode, setScreenMode] = useState<LoginScreenMode>('login');

  // Staff / Admin Login State
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  const [showPin, setShowPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Forgot Password / Recovery Flow State
  const [recoveryChoice, setRecoveryChoice] = useState<RecoveryChoice>('staff');
  const [staffLookupUsername, setStaffLookupUsername] = useState('');
  const [staffRecoveryInfo, setStaffRecoveryInfo] = useState<{
    checked: boolean;
    available: boolean;
    message: string;
    methodHint?: string;
  } | null>(null);
  const [isCheckingStaffRecovery, setIsCheckingStaffRecovery] = useState(false);

  // Owner Master Recovery State (never prefilled or hardcoded)
  const [ownerRecoveryId, setOwnerRecoveryId] = useState('');
  const [ownerMasterPassword, setOwnerMasterPassword] = useState('');
  const [showOwnerPassword, setShowOwnerPassword] = useState(false);
  const [isVerifyingOwner, setIsVerifyingOwner] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  // Step 2 of Owner Master Recovery (Reset selected staff password)
  const [recoveryToken, setRecoveryToken] = useState<string | null>(null);
  const [recoverableUsers, setRecoverableUsers] = useState<SafeUserSummary[]>([]);
  const [selectedTargetUserId, setSelectedTargetUserId] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const resetRecoveryState = () => {
    setRecoveryChoice('staff');
    setStaffLookupUsername('');
    setStaffRecoveryInfo(null);
    setOwnerRecoveryId('');
    setOwnerMasterPassword('');
    setShowOwnerPassword(false);
    setRecoveryError(null);
    setRecoveryToken(null);
    setRecoverableUsers([]);
    setSelectedTargetUserId('');
    setResetNewPassword('');
    setResetConfirmPassword('');
    setShowResetNewPassword(false);
    setShowResetConfirmPassword(false);
    setResetSuccessMessage(null);
  };

  const handleOpenForgotPassword = () => {
    setError(null);
    resetRecoveryState();
    setScreenMode('recovery');
  };

  const handleBackToLogin = () => {
    resetRecoveryState();
    setError(null);
    setScreenMode('login');
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !pin) {
      setError('Please enter your username and password / PIN.');
      return;
    }

    setIsSubmitting(true);
    try {
      devAuthClient.clearClientToken();
      const result = await userAuthClient.login(username.trim(), pin);
      if (!result.ok || !result.user) {
        setError(result.error || 'Invalid username or password / PIN.');
        return;
      }
      setPin('');
      db.setActiveUser(result.user);
      onLoginSuccess(result.user);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStaffRecoveryCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setStaffRecoveryInfo(null);
    if (!staffLookupUsername.trim()) {
      setRecoveryError('Please enter your staff username to check recovery options.');
      return;
    }

    setIsCheckingStaffRecovery(true);
    try {
      const res = await userAuthClient.checkStaffRecovery(staffLookupUsername.trim());
      setStaffRecoveryInfo({
        checked: true,
        available: res.available,
        message: res.message,
        methodHint: res.methodHint,
      });
    } finally {
      setIsCheckingStaffRecovery(false);
    }
  };

  const handleVerifyOwnerRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setResetSuccessMessage(null);

    if (!ownerRecoveryId.trim() || !ownerMasterPassword) {
      setRecoveryError('Please enter both Owner Recovery ID and Owner Master Password.');
      return;
    }

    setIsVerifyingOwner(true);
    try {
      const res = await userAuthClient.verifyOwnerRecovery(
        ownerRecoveryId.trim(),
        ownerMasterPassword
      );
      if (!res.ok || !res.recoveryToken) {
        setRecoveryError(res.error || 'Invalid Owner Recovery ID or Owner Master Password.');
        return;
      }

      setOwnerMasterPassword('');
      const users = res.users || [];
      setRecoveryToken(res.recoveryToken);
      setRecoverableUsers(users);
      // Pre-select first non-admin staff account if available, otherwise first user
      const defaultTarget = users.find((u) => u.role === 'accountant') || users[0];
      setSelectedTargetUserId(defaultTarget?.id || '');
    } finally {
      setIsVerifyingOwner(false);
    }
  };

  const handleOwnerResetStaffPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    setResetSuccessMessage(null);

    if (!recoveryToken) {
      setRecoveryError('Recovery authorization expired. Please verify Owner credentials again.');
      return;
    }
    if (!selectedTargetUserId) {
      setRecoveryError('Please select a staff or user account to reset.');
      return;
    }
    if (!resetNewPassword || !resetConfirmPassword) {
      setRecoveryError('Please enter and confirm the new password / PIN.');
      return;
    }
    if (resetNewPassword.length < 4) {
      setRecoveryError('New password / PIN must be at least 4 characters long.');
      return;
    }
    if (resetNewPassword !== resetConfirmPassword) {
      setRecoveryError('New Password and Confirm Password do not match.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await userAuthClient.resetPasswordWithOwnerRecovery(
        recoveryToken,
        selectedTargetUserId,
        resetNewPassword,
        resetConfirmPassword
      );
      if (!res.ok) {
        setRecoveryError(res.error || 'Failed to reset user password.');
        return;
      }

      setResetNewPassword('');
      setResetConfirmPassword('');
      setShowResetNewPassword(false);
      setShowResetConfirmPassword(false);
      setRecoveryToken(null);
      setResetSuccessMessage(
        res.message ||
          `Password reset successfully for @${res.targetUsername || 'user'}. You may now sign in with the new credentials.`
      );
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-100/85 dark:bg-[#0b1120] px-4 py-12 selection:bg-blue-100 selection:text-blue-900 transition-colors">
      <div className="absolute top-4 right-4">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          className="neu-btn p-2 text-slate-700 dark:text-slate-200"
        >
          {isDarkMode ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131d31] p-8 shadow-sm">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="flex justify-center pb-1">
            <img
              src="/assets/hfc_circle_logo.png"
              alt="HariKripa Fruit Company"
              className="h-24 w-24 sm:h-28 sm:w-28 object-contain select-none"
            />
          </div>
          <div>
            <h1 className="font-black text-xl sm:text-2xl tracking-wide text-red-950 dark:text-amber-100 uppercase leading-snug">
              HariKripa Fruit Company
            </h1>
            <p className="text-xs sm:text-sm font-semibold text-emerald-700 dark:text-emerald-400 tracking-wider mt-1">
              Freshness. Quality. Trust.
            </p>
          </div>
        </div>

        {screenMode === 'login' ? (
          <>
            {error && (
              <div
                role="alert"
                className="neu-inset-sm p-3 text-xs text-rose-600 font-medium text-center border border-rose-300/40"
              >
                {error}
              </div>
            )}

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="login-username"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Username
                </label>
                <div className="relative flex items-center">
                  <input
                    id="login-username"
                    type="text"
                    required
                    autoComplete="username"
                    disabled={isSubmitting}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username (e.g. admin or staff)"
                    className="neu-inset w-full px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Password / PIN Code
                  </label>
                  <button
                    type="button"
                    onClick={handleOpenForgotPassword}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative flex items-center">
                  <input
                    id="login-password"
                    type={showPin ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    disabled={isSubmitting}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Enter password or 4-digit PIN"
                    className="neu-inset w-full px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-white font-mono-numbers outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    aria-label={showPin ? 'Hide password' : 'Show password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="neu-inset-sm p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Default Demo Credentials: <strong>admin</strong> / PIN: <strong>1234</strong>
                </span>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="neu-btn-primary w-full py-3 text-sm font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Signing In...</span>
                  </>
                ) : (
                  <span>Access Accounting System</span>
                )}
              </button>
            </form>
          </>
        ) : (
          /* Password Recovery Screen (within the existing Login interface) */
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2.5">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Account Password Recovery
                </h2>
              </div>
              <button
                type="button"
                onClick={handleBackToLogin}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Sign In</span>
              </button>
            </div>

            {/* Two Recovery Choices */}
            {!recoveryToken && !resetSuccessMessage && (
              <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800/70">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryChoice('staff');
                    setRecoveryError(null);
                  }}
                  className={`rounded-lg py-2 px-2 text-xs font-bold transition-all cursor-pointer ${
                    recoveryChoice === 'staff'
                      ? 'bg-white text-slate-900 shadow-2xs dark:bg-slate-900 dark:text-white'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Staff Recovery
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryChoice('owner');
                    setRecoveryError(null);
                  }}
                  className={`rounded-lg py-2 px-2 text-xs font-bold transition-all cursor-pointer ${
                    recoveryChoice === 'owner'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  Owner Master Recovery
                </button>
              </div>
            )}

            {recoveryError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{recoveryError}</span>
              </div>
            )}

            {resetSuccessMessage ? (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 space-y-3"
              >
                <div className="flex items-start gap-2 font-semibold">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                  <span>{resetSuccessMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={handleBackToLogin}
                  className="neu-btn-primary w-full py-2.5 text-xs font-bold cursor-pointer"
                >
                  Return to Sign In
                </button>
              </div>
            ) : recoveryChoice === 'staff' && !recoveryToken ? (
              /* Choice 1: Normal Staff Password Recovery */
              <form onSubmit={handleStaffRecoveryCheck} className="space-y-4">
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Check whether a verified self-service recovery method (email/OTP) is configured for your staff account.
                </p>

                <div>
                  <label
                    htmlFor="recovery-staff-username"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Staff Username
                  </label>
                  <input
                    id="recovery-staff-username"
                    type="text"
                    required
                    value={staffLookupUsername}
                    onChange={(e) => setStaffLookupUsername(e.target.value)}
                    placeholder="Enter your username (e.g. staff)"
                    className="neu-inset w-full px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                {staffRecoveryInfo && (
                  <div
                    className={`rounded-xl border p-3 text-xs space-y-2 ${
                      staffRecoveryInfo.available
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{staffRecoveryInfo.message}</span>
                    </div>
                    {!staffRecoveryInfo.available && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecoveryChoice('owner');
                          setRecoveryError(null);
                        }}
                        className="text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline cursor-pointer"
                      >
                        Proceed with Owner Master Recovery →
                      </button>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isCheckingStaffRecovery}
                  className="neu-btn-primary w-full py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isCheckingStaffRecovery ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Checking Recovery Status...</span>
                    </>
                  ) : (
                    <span>Check Recovery Availability</span>
                  )}
                </button>
              </form>
            ) : !recoveryToken ? (
              /* Choice 2 - Step 1: Verify Owner Master Recovery Credentials */
              <form onSubmit={handleVerifyOwnerRecovery} className="space-y-4">
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300 flex items-start gap-2">
                  <Lock className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <span>
                    Owner Master Recovery authorizes resetting a staff or admin password only. It never logs in as a staff user.
                  </span>
                </div>

                <div>
                  <label
                    htmlFor="owner-recovery-id"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Owner Recovery ID
                  </label>
                  <input
                    id="owner-recovery-id"
                    type="text"
                    required
                    autoComplete="off"
                    disabled={isVerifyingOwner}
                    value={ownerRecoveryId}
                    onChange={(e) => setOwnerRecoveryId(e.target.value)}
                    placeholder="Enter Owner Recovery ID"
                    className="neu-inset w-full px-4 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="owner-master-password"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Owner Master Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="owner-master-password"
                      type={showOwnerPassword ? 'text' : 'password'}
                      required
                      autoComplete="off"
                      disabled={isVerifyingOwner}
                      value={ownerMasterPassword}
                      onChange={(e) => setOwnerMasterPassword(e.target.value)}
                      placeholder="Enter Owner Master Password"
                      className="neu-inset w-full px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOwnerPassword((prev) => !prev)}
                      aria-label={showOwnerPassword ? 'Hide master password' : 'Show master password'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showOwnerPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOwner}
                  className="neu-btn-primary w-full py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isVerifyingOwner ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Verifying Owner Credentials...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      <span>Verify Owner Recovery</span>
                    </>
                  )}
                </button>
              </form>
            ) : (
              /* Choice 2 - Step 2: Select Staff Account & Set New Password */
              <form onSubmit={handleOwnerResetStaffPassword} className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300 flex items-center gap-2 font-semibold">
                  <UserCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  <span>Owner Verified. Select a user account to reset its password.</span>
                </div>

                <div>
                  <label
                    htmlFor="recovery-target-user"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Select Staff / User Account
                  </label>
                  <select
                    id="recovery-target-user"
                    value={selectedTargetUserId}
                    onChange={(e) => setSelectedTargetUserId(e.target.value)}
                    disabled={isResettingPassword}
                    className="neu-inset w-full px-3 py-2.5 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                  >
                    {recoverableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} (@{u.username}) — {u.role === 'admin' ? 'Admin' : 'Staff / Accountant'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="recovery-new-password"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    New Password / PIN
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="recovery-new-password"
                      type={showResetNewPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      autoComplete="new-password"
                      disabled={isResettingPassword}
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      placeholder="Enter new password or PIN (min 4 chars)"
                      className="neu-inset w-full px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetNewPassword((prev) => !prev)}
                      aria-label={showResetNewPassword ? 'Hide new password' : 'Show new password'}
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="recovery-confirm-password"
                    className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Confirm New Password / PIN
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="recovery-confirm-password"
                      type={showResetConfirmPassword ? 'text' : 'password'}
                      required
                      minLength={4}
                      autoComplete="new-password"
                      disabled={isResettingPassword}
                      value={resetConfirmPassword}
                      onChange={(e) => setResetConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password or PIN"
                      className="neu-inset w-full px-4 py-2.5 pr-10 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetConfirmPassword((prev) => !prev)}
                      aria-label={
                        showResetConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showResetConfirmPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isResettingPassword}
                  className="neu-btn-primary w-full py-2.5 text-xs font-bold cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isResettingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Resetting Password...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      <span>Reset Password</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* Klyia Technology Attribution below login form */}
        <div className="pt-4 border-t border-slate-300/50 text-center space-y-1">
          <p className="text-xs font-semibold text-slate-600">
            Software provided by <span className="font-bold text-slate-800">Klyia Technology</span>
          </p>
          <p className="text-xs font-medium text-slate-500 font-mono-numbers">
            Phn. 8296887643
          </p>
          <p className="text-[10px] text-slate-400 pt-1">
            Protected Mandi Ledger Environment · Hari Kripa Wholesale Fruits
          </p>
        </div>
      </div>
    </div>
  );
};
