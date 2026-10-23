import React, { useState } from 'react';
import { db } from '../../services/db';
import { User } from '../../types';
import { ShieldCheck, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

interface LoginViewProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const { isDarkMode, toggleTheme } = useTheme();
  const [username, setUsername] = useState('admin');
  const [pin, setPin] = useState('1234');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim() === 'admin' && pin.trim() === '1234') {
      const user: User = {
        id: 'u-admin',
        name: 'Mandi Admin',
        username: 'admin',
        role: 'admin',
        pin: '1234',
      };
      db.setActiveUser(user);
      onLoginSuccess(user);
    } else {
      setError('Invalid username or PIN code. Use default admin / 1234.');
    }
  };

  const defaultProfile = db.getCompanyProfiles().find((p) => p.isDefault) || db.getCompanyProfiles()[0];
  const customLogo = defaultProfile?.logo;

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
        <div className="text-center space-y-2">
          {customLogo ? (
            <div className="flex justify-center pb-2">
              <img
                src={customLogo}
                alt="Business Logo"
                className="h-20 w-auto max-w-[200px] object-contain select-none"
              />
            </div>
          ) : null}
          <div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
              Hari Kripa <span className="text-emerald-600">Fruit ERP</span>
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Wholesale Mandi Commission & Accounts System
            </p>
          </div>
        </div>

        {error && (
          <div className="neu-inset-sm p-3 text-xs text-rose-600 font-medium text-center border border-rose-300/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Username
            </label>
            <div className="relative flex items-center">
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username (e.g. admin)"
                className="neu-inset w-full px-4 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700">
              Accountant PIN Code
            </label>
            <div className="relative flex items-center">
              <input
                type="password"
                required
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="4-digit PIN (1234)"
                className="neu-inset w-full px-4 py-2.5 text-sm text-slate-900 font-mono-numbers outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>

          <div className="neu-inset-sm p-3 text-xs text-emerald-800 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>Default Demo Credentials: <strong>admin</strong> / PIN: <strong>1234</strong></span>
          </div>

          <button
            type="submit"
            className="neu-btn-primary w-full py-3 text-sm font-bold"
          >
            Access Accounting System
          </button>
        </form>

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
