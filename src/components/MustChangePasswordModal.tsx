/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Lock, KeyRound, ShieldAlert, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { User as UserType } from '../types';

interface MustChangePasswordModalProps {
  currentUser: UserType;
  onPasswordChanged: (updatedUser: UserType) => void;
  onDismiss?: () => void;
}

export default function MustChangePasswordModal({
  currentUser,
  onPasswordChanged,
  onDismiss,
}: MustChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!newPassword.trim() || !confirmPassword.trim()) {
      setError('Please enter and confirm your new personalized password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword.toLowerCase() === 'classroom123' || newPassword.toLowerCase() === 'class123') {
      setError('Please choose a new custom password different from the temporary default.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: currentUser.username,
          oldPassword: oldPassword.trim() || 'classroom123',
          newPassword: newPassword.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password');
      }

      setSuccess('Your password has been personalized successfully!');
      
      setTimeout(() => {
        const updatedUser: UserType = {
          ...currentUser,
          hasChangedDefaultPassword: true,
        };
        onPasswordChanged(updatedUser);
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Error updating password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-amber-500/30 shadow-2xl shadow-amber-500/10 rounded-3xl p-6 md:p-8 text-white relative overflow-hidden"
        id="change-temp-password-modal"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="h-12 w-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <KeyRound className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold font-sans text-white">
              Set Your Password
            </h2>
            <p className="text-xs text-amber-300 font-medium">
              You are currently using the temporary password
            </p>
          </div>
        </div>

        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3.5 text-xs text-slate-300 leading-relaxed mb-5">
          <p>
            Welcome, <strong className="text-white font-semibold">{currentUser.name || currentUser.username}</strong>! For security, please update your initial password to a personal confidential password before accessing the classroom.
          </p>
        </div>

        {error && (
          <div className="bg-red-950/50 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs mb-4 flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 p-3 rounded-xl text-xs mb-4 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Temporary / Current Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-500 hover:text-white"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              New Personal Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4 text-indigo-400" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter a new secure password..."
                className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-500">
                <Lock className="h-4 w-4 text-indigo-400" />
              </span>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password..."
                className="w-full pl-9 pr-10 py-2.5 bg-slate-800/80 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                required
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:from-amber-700 active:to-orange-800 text-white py-2.5 px-4 rounded-xl font-semibold shadow-lg shadow-amber-600/20 flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer disabled:opacity-50 text-sm"
              id="submit-password-change-btn"
            >
              {isLoading ? (
                <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <KeyRound className="h-4 w-4" />
                  <span>Save New Password & Continue</span>
                </>
              )}
            </button>

            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="w-full text-slate-400 hover:text-slate-300 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                id="skip-password-change-btn"
              >
                Change Later in Settings
              </button>
            )}
          </div>
        </form>
      </motion.div>
    </div>
  );
}
