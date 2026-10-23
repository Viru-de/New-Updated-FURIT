import React, { useState } from 'react';
import { db } from '../../services/db';
import { ShieldCheck, Eye, EyeOff, X, AlertTriangle, Trash2 } from 'lucide-react';

interface AdminPasswordModalProps {
  isOpen: boolean;
  title: string;
  description?: string;
  itemTitle?: string;
  confirmText?: string;
  isPermanent?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export const AdminPasswordModal: React.FC<AdminPasswordModalProps> = ({
  isOpen,
  title,
  description,
  itemTitle,
  confirmText = 'Verify & Move to Trash',
  isPermanent = false,
  onConfirm,
  onClose,
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter the administrator password.');
      return;
    }

    const isValid = db.verifyAdminPassword(password);
    if (!isValid) {
      setError('Incorrect administrator password. Deletion cancelled.');
      return;
    }

    setError(null);
    setPassword('');
    onConfirm();
  };

  const handleClose = () => {
    setPassword('');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isPermanent ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}`}>
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500">
                Administrator Authorization Required
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {itemTitle && (
            <div className="rounded-lg bg-slate-50 p-2.5 text-xs text-slate-700 dark:bg-slate-800/60 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              <span className="font-semibold text-slate-500">Target Item: </span>
              <strong className="text-slate-900 dark:text-white">{itemTitle}</strong>
            </div>
          )}

          {description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {description}
            </p>
          )}

          {isPermanent && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400 border border-rose-200 dark:border-rose-900/40">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                <strong>Warning:</strong> Permanent deletion cannot be undone. All associated data will be removed forever.
              </span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Enter Admin Password / PIN Code
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Default: 1234"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-10 text-sm font-mono text-slate-900 outline-none focus:border-rose-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {error}
              </p>
            )}
            <p className="mt-1 text-[10px] text-slate-400">
              System default admin PIN: 1234
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-semibold text-white shadow-xs ${
                isPermanent
                  ? 'bg-rose-600 hover:bg-rose-700'
                  : 'bg-amber-600 hover:bg-amber-700'
              }`}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
