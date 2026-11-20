import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../../services/db';
import { userAuthClient } from '../../services/userAuthClient';
import type { PasswordAuditEntry, SafeUserSummary } from '../../types';
import {
  ShieldCheck,
  KeyRound,
  Users,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  History,
  Loader2,
  LogOut,
  RefreshCw,
} from 'lucide-react';

interface UserPasswordManagementPanelProps {
  onSessionInvalidated?: () => void;
}

const ACTION_LABELS: Record<PasswordAuditEntry['action'], string> = {
  owner_master_recovery_reset: 'Owner Master Recovery Reset',
  admin_staff_reset: 'Admin Staff Password Reset',
  self_password_change: 'Self Password Change',
  staff_account_created: 'Staff Account Created',
};

export const UserPasswordManagementPanel: React.FC<UserPasswordManagementPanelProps> = ({
  onSessionInvalidated,
}) => {
  const activeUser = db.getActiveUser();
  const [users, setUsers] = useState<SafeUserSummary[]>([]);
  const [auditLogs, setAuditLogs] = useState<PasswordAuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected staff member password reset state
  const [selectedUserForReset, setSelectedUserForReset] = useState<SafeUserSummary | null>(null);
  const [staffNewPassword, setStaffNewPassword] = useState('');
  const [staffConfirmPassword, setStaffConfirmPassword] = useState('');
  const [showStaffNewPassword, setShowStaffNewPassword] = useState(false);
  const [showStaffConfirmPassword, setShowStaffConfirmPassword] = useState(false);
  const [isResettingStaff, setIsResettingStaff] = useState(false);
  const [staffResetError, setStaffResetError] = useState<string | null>(null);
  const [staffResetSuccess, setStaffResetSuccess] = useState<string | null>(null);

  // Add Staff Account collapsible form
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserRole, setNewUserRole] = useState<'accountant' | 'admin'>('accountant');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserConfirmPassword, setNewUserConfirmPassword] = useState('');
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [showNewUserConfirmPassword, setShowNewUserConfirmPassword] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [createUserError, setCreateUserError] = useState<string | null>(null);
  const [createUserSuccess, setCreateUserSuccess] = useState<string | null>(null);

  // Change own password state
  const [isChangeOwnOpen, setIsChangeOwnOpen] = useState(false);
  const [ownCurrentPassword, setOwnCurrentPassword] = useState('');
  const [ownNewPassword, setOwnNewPassword] = useState('');
  const [ownConfirmPassword, setOwnConfirmPassword] = useState('');
  const [showOwnCurrent, setShowOwnCurrent] = useState(false);
  const [showOwnNew, setShowOwnNew] = useState(false);
  const [showOwnConfirm, setShowOwnConfirm] = useState(false);
  const [isChangingOwn, setIsChangingOwn] = useState(false);
  const [ownError, setOwnError] = useState<string | null>(null);
  const [ownSuccess, setOwnSuccess] = useState<string | null>(null);
  const [requireReLogin, setRequireReLogin] = useState(false);

  const loadDirectory = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    const res = await userAuthClient.listUsersAndAudit();
    if (!res.ok) {
      setLoadError(res.error || 'Failed to load user accounts.');
      setIsLoading(false);
      return;
    }
    setUsers(res.users || []);
    setAuditLogs(res.auditLogs || []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (activeUser?.role === 'admin') {
      void loadDirectory();
    }
  }, [activeUser?.role, loadDirectory]);

  if (!activeUser || activeUser.role !== 'admin') {
    return null;
  }

  const handleSelectUserForReset = (user: SafeUserSummary) => {
    setSelectedUserForReset(user);
    setStaffNewPassword('');
    setStaffConfirmPassword('');
    setShowStaffNewPassword(false);
    setShowStaffConfirmPassword(false);
    setStaffResetError(null);
    setStaffResetSuccess(null);
  };

  const handleCancelStaffReset = () => {
    setSelectedUserForReset(null);
    setStaffNewPassword('');
    setStaffConfirmPassword('');
    setShowStaffNewPassword(false);
    setShowStaffConfirmPassword(false);
    setStaffResetError(null);
  };

  const handleStaffResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForReset) return;
    setStaffResetError(null);
    setStaffResetSuccess(null);

    if (!staffNewPassword || !staffConfirmPassword) {
      setStaffResetError('Please enter and confirm the new password / PIN.');
      return;
    }
    if (staffNewPassword.length < 4) {
      setStaffResetError('New password / PIN must be at least 4 characters long.');
      return;
    }
    if (staffNewPassword !== staffConfirmPassword) {
      setStaffResetError('New password and confirmation do not match.');
      return;
    }

    setIsResettingStaff(true);
    try {
      const res = await userAuthClient.adminResetUserPassword(
        selectedUserForReset.id,
        staffNewPassword,
        staffConfirmPassword
      );
      if (!res.ok) {
        setStaffResetError(res.error || 'Failed to reset user password.');
        return;
      }

      const wasSelf = selectedUserForReset.id === activeUser.id;
      setStaffResetSuccess(
        res.message || `Password reset successfully for @${selectedUserForReset.username}.`
      );
      setStaffNewPassword('');
      setStaffConfirmPassword('');
      setShowStaffNewPassword(false);
      setShowStaffConfirmPassword(false);
      setSelectedUserForReset(null);
      if (wasSelf) {
        setRequireReLogin(true);
      } else {
        await loadDirectory();
      }
    } finally {
      setIsResettingStaff(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError(null);
    setCreateUserSuccess(null);

    if (!newUserName.trim() || !newUserUsername.trim() || !newUserPassword || !newUserConfirmPassword) {
      setCreateUserError('Please fill in all required staff account fields.');
      return;
    }
    if (newUserPassword.length < 4) {
      setCreateUserError('Password / PIN must be at least 4 characters long.');
      return;
    }
    if (newUserPassword !== newUserConfirmPassword) {
      setCreateUserError('Password and confirm password do not match.');
      return;
    }

    setIsCreatingUser(true);
    try {
      const res = await userAuthClient.createStaffUser({
        name: newUserName.trim(),
        username: newUserUsername.trim(),
        role: newUserRole,
        password: newUserPassword,
        confirmPassword: newUserConfirmPassword,
      });
      if (!res.ok || !res.user) {
        setCreateUserError(res.error || 'Failed to create staff account.');
        return;
      }

      setCreateUserSuccess(`Created account @${res.user.username} (${res.user.role}).`);
      setNewUserName('');
      setNewUserUsername('');
      setNewUserPassword('');
      setNewUserConfirmPassword('');
      setShowNewUserPassword(false);
      setShowNewUserConfirmPassword(false);
      setIsAddUserOpen(false);
      await loadDirectory();
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleChangeOwnSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setOwnError(null);
    setOwnSuccess(null);

    if (!ownCurrentPassword || !ownNewPassword || !ownConfirmPassword) {
      setOwnError('Current Password, New Password, and Confirm New Password are all required.');
      return;
    }
    if (ownNewPassword.length < 4) {
      setOwnError('New Password must be at least 4 characters long.');
      return;
    }
    if (ownNewPassword !== ownConfirmPassword) {
      setOwnError('New Password and Confirm New Password do not match.');
      return;
    }
    if (ownCurrentPassword === ownNewPassword) {
      setOwnError('New Password must be different from your Current Password.');
      return;
    }

    setIsChangingOwn(true);
    try {
      const res = await userAuthClient.changeOwnPassword({
        currentPassword: ownCurrentPassword,
        newPassword: ownNewPassword,
        confirmPassword: ownConfirmPassword,
      });
      if (!res.ok) {
        setOwnError(res.error || 'Failed to update password.');
        return;
      }
      setOwnCurrentPassword('');
      setOwnNewPassword('');
      setOwnConfirmPassword('');
      setShowOwnCurrent(false);
      setShowOwnNew(false);
      setShowOwnConfirm(false);
      setOwnSuccess(
        res.message ||
          'Your password has been updated. All existing sessions have been invalidated.'
      );
      setRequireReLogin(true);
    } finally {
      setIsChangingOwn(false);
    }
  };

  const handleCompleteRelogin = () => {
    userAuthClient.clearClientToken();
    db.setActiveUser(null);
    if (onSessionInvalidated) {
      onSessionInvalidated();
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header Banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>User & Password Management</span>
              <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                Admin / Owner Only
              </span>
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              Manage staff credentials, reset passwords securely using bcrypt hashing, and review password audit history. Plaintext passwords are never stored or shown.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              setIsChangeOwnOpen((prev) => !prev);
              setOwnError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>Change My Password</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsAddUserOpen((prev) => !prev);
              setCreateUserError(null);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
          >
            <UserPlus className="h-3.5 w-3.5" />
            <span>Add Staff User</span>
          </button>
        </div>
      </div>

      {/* Re-login Required Banner after self-password change */}
      {requireReLogin && (
        <div
          role="status"
          className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-xs text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-2 font-semibold">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
            <span>
              {ownSuccess || staffResetSuccess || 'Password updated. All existing sessions were invalidated.'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCompleteRelogin}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign In Again
          </button>
        </div>
      )}

      {/* Change Logged-In User's Own Password Card */}
      {(isChangeOwnOpen || ownError || (ownSuccess && !requireReLogin)) && !requireReLogin && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-slate-700 dark:text-slate-300" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Change My Password (@{activeUser.username})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => {
                setIsChangeOwnOpen(false);
                setOwnCurrentPassword('');
                setOwnNewPassword('');
                setOwnConfirmPassword('');
                setOwnError(null);
              }}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>

          {ownError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{ownError}</span>
            </div>
          )}

          <form onSubmit={handleChangeOwnSubmit} className="space-y-4 max-w-md">
            <div>
              <label
                htmlFor="own-current-password"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Current Password
              </label>
              <div className="relative">
                <input
                  id="own-current-password"
                  type={showOwnCurrent ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={isChangingOwn}
                  value={ownCurrentPassword}
                  onChange={(e) => setOwnCurrentPassword(e.target.value)}
                  placeholder="Enter current password / PIN"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnCurrent((p) => !p)}
                  aria-label={showOwnCurrent ? 'Hide current password' : 'Show current password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showOwnCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="own-new-password"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                New Password
              </label>
              <div className="relative">
                <input
                  id="own-new-password"
                  type={showOwnNew ? 'text' : 'password'}
                  required
                  minLength={4}
                  autoComplete="new-password"
                  disabled={isChangingOwn}
                  value={ownNewPassword}
                  onChange={(e) => setOwnNewPassword(e.target.value)}
                  placeholder="Enter new password / PIN (min 4 chars)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnNew((p) => !p)}
                  aria-label={showOwnNew ? 'Hide new password' : 'Show new password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showOwnNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="own-confirm-password"
                className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  id="own-confirm-password"
                  type={showOwnConfirm ? 'text' : 'password'}
                  required
                  minLength={4}
                  autoComplete="new-password"
                  disabled={isChangingOwn}
                  value={ownConfirmPassword}
                  onChange={(e) => setOwnConfirmPassword(e.target.value)}
                  placeholder="Confirm new password / PIN"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowOwnConfirm((p) => !p)}
                  aria-label={showOwnConfirm ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showOwnConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isChangingOwn}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 cursor-pointer disabled:opacity-50"
              >
                {isChangingOwn ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Update My Password</span>
                )}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsChangeOwnOpen(false);
                  setOwnCurrentPassword('');
                  setOwnNewPassword('');
                  setOwnConfirmPassword('');
                  setOwnError(null);
                }}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add New Staff User Form */}
      {isAddUserOpen && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                Add New Staff Account
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsAddUserOpen(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              Close
            </button>
          </div>

          {createUserError && (
            <div
              role="alert"
              className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 flex items-start gap-2"
            >
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{createUserError}</span>
            </div>
          )}

          <form onSubmit={handleCreateUserSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Full Name
              </label>
              <input
                type="text"
                required
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="e.g. Ramesh Kumar"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Username
              </label>
              <input
                type="text"
                required
                value={newUserUsername}
                onChange={(e) => setNewUserUsername(e.target.value)}
                placeholder="e.g. ramesh"
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Role
              </label>
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'accountant' | 'admin')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="accountant">Staff / Accountant</option>
                <option value="admin">Admin / Owner</option>
              </select>
            </div>

            <div className="hidden sm:block" />

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password / PIN
              </label>
              <div className="relative">
                <input
                  type={showNewUserPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  autoComplete="new-password"
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  placeholder="Min 4 characters"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewUserPassword((p) => !p)}
                  aria-label={showNewUserPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewUserPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Confirm Password / PIN
              </label>
              <div className="relative">
                <input
                  type={showNewUserConfirmPassword ? 'text' : 'password'}
                  required
                  minLength={4}
                  autoComplete="new-password"
                  value={newUserConfirmPassword}
                  onChange={(e) => setNewUserConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowNewUserConfirmPassword((p) => !p)}
                  aria-label={showNewUserConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showNewUserConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="sm:col-span-2 flex items-center gap-3 pt-1">
              <button
                type="submit"
                disabled={isCreatingUser}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                {isCreatingUser ? 'Creating...' : 'Create Staff Account'}
              </button>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {createUserSuccess && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{createUserSuccess}</span>
        </div>
      )}

      {staffResetSuccess && !requireReLogin && (
        <div
          role="status"
          className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300 flex items-center gap-2"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{staffResetSuccess}</span>
        </div>
      )}

      {/* Existing Staff Accounts Table + Selected Staff Reset Form */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Staff & Admin Accounts ({users.length})
            </h4>
          </div>
          <button
            type="button"
            onClick={() => void loadDirectory()}
            className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>

        {loadError && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            {loadError}
          </div>
        )}

        {isLoading ? (
          <div className="py-6 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading accounts...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-3 font-semibold">Name</th>
                  <th className="py-2 px-3 font-semibold">Username</th>
                  <th className="py-2 px-3 font-semibold">Role</th>
                  <th className="py-2 px-3 font-semibold">Last Password Reset</th>
                  <th className="py-2 pl-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {users.map((u) => {
                  const isSelected = selectedUserForReset?.id === u.id;
                  return (
                    <tr key={u.id} className={isSelected ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-900 dark:text-white">
                        {u.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 dark:text-slate-300">
                        @{u.username}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase ${
                            u.role === 'admin'
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {u.role === 'admin' ? 'Admin / Owner' : 'Staff / Accountant'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                        {u.lastPasswordResetAt
                          ? new Date(u.lastPasswordResetAt).toLocaleString()
                          : 'Default / Initial'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectUserForReset(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                        >
                          <KeyRound className="h-3 w-3 text-blue-600" />
                          <span>Reset Password</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Selected Staff Password Reset Panel */}
        {selectedUserForReset && (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-5 dark:border-blue-900/50 dark:bg-blue-950/20 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h5 className="text-xs font-bold text-slate-900 dark:text-white">
                  Reset Password for {selectedUserForReset.name} (@{selectedUserForReset.username})
                </h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Immediately invalidates all existing sessions for @{selectedUserForReset.username} and records this event in the audit log.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCancelStaffReset}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {staffResetError && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700 flex items-start gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{staffResetError}</span>
              </div>
            )}

            <form onSubmit={handleStaffResetSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
              <div>
                <label
                  htmlFor="staff-reset-new-password"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  New Password / PIN
                </label>
                <div className="relative">
                  <input
                    id="staff-reset-new-password"
                    type={showStaffNewPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    autoComplete="new-password"
                    disabled={isResettingStaff}
                    value={staffNewPassword}
                    onChange={(e) => setStaffNewPassword(e.target.value)}
                    placeholder="Min 4 characters"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffNewPassword((p) => !p)}
                    aria-label={showStaffNewPassword ? 'Hide new password' : 'Show new password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showStaffNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label
                  htmlFor="staff-reset-confirm-password"
                  className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300"
                >
                  Confirm New Password / PIN
                </label>
                <div className="relative">
                  <input
                    id="staff-reset-confirm-password"
                    type={showStaffConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={4}
                    autoComplete="new-password"
                    disabled={isResettingStaff}
                    value={staffConfirmPassword}
                    onChange={(e) => setStaffConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStaffConfirmPassword((p) => !p)}
                    aria-label={showStaffConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showStaffConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="sm:col-span-2 flex items-center gap-3">
                <button
                  type="submit"
                  disabled={isResettingStaff}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-50"
                >
                  {isResettingStaff ? 'Resetting...' : 'Confirm Password Reset'}
                </button>
                <button
                  type="button"
                  onClick={handleCancelStaffReset}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Password Reset Audit History */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-2xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
          <History className="h-4 w-4 text-slate-600 dark:text-slate-400" />
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Password Reset Audit History
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Records affected usernames, actors, and timestamps without ever storing plaintext passwords.
            </p>
          </div>
        </div>

        {auditLogs.length === 0 ? (
          <div className="py-4 text-center text-xs text-slate-500">
            No password reset events recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
                  <th className="py-2 pr-3 font-semibold">Timestamp</th>
                  <th className="py-2 px-3 font-semibold">Event</th>
                  <th className="py-2 px-3 font-semibold">Affected Account</th>
                  <th className="py-2 pl-3 font-semibold">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {auditLogs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="py-2 pr-3 text-slate-500 whitespace-nowrap">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {ACTION_LABELS[entry.action] || entry.action}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-700 dark:text-slate-300">
                      @{entry.targetUsername}
                    </td>
                    <td className="py-2 pl-3 text-slate-600 dark:text-slate-400">
                      {entry.performedBy}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
