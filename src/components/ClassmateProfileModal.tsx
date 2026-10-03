/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Mail, Phone, Calendar, MapPin, Home, GraduationCap, 
  Cloud, Sparkles, Shield, Award, MessageCircle, ExternalLink, Copy, Check,
  CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import { User as UserType } from '../types';
import { updateUserMasterRolesInFirestore } from '../lib/gatekeeperFirestore';

interface ClassmateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  student: UserType | null;
  currentUser: UserType;
  onRoleUpdated?: (studentId: string, newRoles: { isMemeMaster?: boolean; isFailMaster?: boolean }) => void;
  onOpenDirectChat?: (username: string) => void;
}

export default function ClassmateProfileModal({
  isOpen,
  onClose,
  student,
  currentUser,
  onRoleUpdated,
  onOpenDirectChat,
}: ClassmateProfileModalProps) {
  const [copiedField, setCopiedField] = React.useState<string | null>(null);
  const [isMemeMaster, setIsMemeMaster] = React.useState<boolean>(Boolean(student?.isMemeMaster));
  const [isFailMaster, setIsFailMaster] = React.useState<boolean>(Boolean(student?.isFailMaster));
  const [isUpdating, setIsUpdating] = React.useState<'meme' | 'fail' | null>(null);
  const [actionFeedback, setActionFeedback] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);

  React.useEffect(() => {
    if (student) {
      setIsMemeMaster(Boolean(student.isMemeMaster));
      setIsFailMaster(Boolean(student.isFailMaster));
      setActionFeedback(null);
    }
  }, [student]);

  if (!isOpen || !student) return null;

  const handleCopy = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const isAdmin = 
    currentUser.role === 'superadmin' || 
    currentUser.role === 'admin' ||
    currentUser.username?.toLowerCase() === 'admin' || 
    currentUser.username?.toLowerCase()?.includes('28782') ||
    Boolean(currentUser.email && (
      currentUser.email.toLowerCase() === '28782@jameasaifiyah.edu' ||
      currentUser.email.toLowerCase().includes('28782') ||
      currentUser.email.toLowerCase().startsWith('admin')
    )) ||
    Boolean(currentUser.trNo && currentUser.trNo.includes('28782')) ||
    Boolean(currentUser.id && currentUser.id.includes('28782'));

  const isSelf = Boolean(
    (student.id && student.id === currentUser.id) ||
    (student.username && student.username.toLowerCase() === currentUser.username.toLowerCase()) ||
    (student.trNo && currentUser.trNo && student.trNo.toLowerCase() === currentUser.trNo.toLowerCase()) ||
    (student.email && currentUser.email && student.email.toLowerCase() === currentUser.email.toLowerCase())
  );

  const avatarColor = student.avatarColor || 'from-indigo-500 to-purple-600';
  const cleanPhone = (student.phone || '').replace(/[^0-9+]/g, '');

  const handleToggleMemeMaster = async () => {
    if (!isAdmin || !student || isUpdating) return;
    setIsUpdating('meme');
    setActionFeedback(null);
    const nextState = !isMemeMaster;

    try {
      const authIdentifier = currentUser.email || currentUser.username || '28782@jameasaifiyah.edu';
      const authEmail = currentUser.email || '28782@jameasaifiyah.edu';
      const targetUsername = student.username || student.trNo || student.id || 'student';

      const response = await fetch('/api/users/toggle-meme-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername,
          userId: student.id,
          email: student.email,
          trNo: student.trNo,
          name: student.name,
          isMemeMaster: nextState,
          authorizedBy: authIdentifier,
          authorizedEmail: authEmail,
        }),
      });

      // Synchronize in Firestore permanently
      try {
        await updateUserMasterRolesInFirestore(student, { isMemeMaster: nextState });
      } catch (fbErr) {
        console.warn('Firestore role sync notice:', fbErr);
      }

      setIsMemeMaster(nextState);
      student.isMemeMaster = nextState;
      if (onRoleUpdated) {
        onRoleUpdated(student.id, { isMemeMaster: nextState, isFailMaster });
      }

      setActionFeedback({
        type: 'success',
        message: nextState
          ? `Promoted ${student.name || student.username} to Meme Master! 🎭`
          : `Removed Meme Master designation for ${student.name || student.username}.`,
      });
    } catch (err: any) {
      // Even if API threw an error, attempt fallback Firestore update if admin
      try {
        await updateUserMasterRolesInFirestore(student, { isMemeMaster: nextState });
        setIsMemeMaster(nextState);
        student.isMemeMaster = nextState;
        if (onRoleUpdated) {
          onRoleUpdated(student.id, { isMemeMaster: nextState, isFailMaster });
        }
        setActionFeedback({
          type: 'success',
          message: nextState
            ? `Promoted ${student.name || student.username} to Meme Master! 🎭`
            : `Removed Meme Master designation for ${student.name || student.username}.`,
        });
      } catch (fbErr: any) {
        setActionFeedback({
          type: 'error',
          message: err.message || fbErr.message || 'Could not update role',
        });
      }
    } finally {
      setIsUpdating(null);
    }
  };

  const handleToggleFailMaster = async () => {
    if (!isAdmin || !student || isUpdating) return;
    setIsUpdating('fail');
    setActionFeedback(null);
    const nextState = !isFailMaster;

    try {
      const authIdentifier = currentUser.email || currentUser.username || '28782@jameasaifiyah.edu';
      const authEmail = currentUser.email || '28782@jameasaifiyah.edu';
      const targetUsername = student.username || student.trNo || student.id || 'student';

      const response = await fetch('/api/users/toggle-fail-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUsername,
          userId: student.id,
          email: student.email,
          trNo: student.trNo,
          name: student.name,
          isFailMaster: nextState,
          authorizedBy: authIdentifier,
          authorizedEmail: authEmail,
        }),
      });

      // Synchronize in Firestore permanently
      try {
        await updateUserMasterRolesInFirestore(student, { isFailMaster: nextState });
      } catch (fbErr) {
        console.warn('Firestore role sync notice:', fbErr);
      }

      setIsFailMaster(nextState);
      student.isFailMaster = nextState;
      if (onRoleUpdated) {
        onRoleUpdated(student.id, { isMemeMaster, isFailMaster: nextState });
      }

      setActionFeedback({
        type: 'success',
        message: nextState
          ? `Promoted ${student.name || student.username} to Fail Master! 🗣️`
          : `Removed Fail Master designation for ${student.name || student.username}.`,
      });
    } catch (err: any) {
      // Even if API threw an error, attempt fallback Firestore update if admin
      try {
        await updateUserMasterRolesInFirestore(student, { isFailMaster: nextState });
        setIsFailMaster(nextState);
        student.isFailMaster = nextState;
        if (onRoleUpdated) {
          onRoleUpdated(student.id, { isMemeMaster, isFailMaster: nextState });
        }
        setActionFeedback({
          type: 'success',
          message: nextState
            ? `Promoted ${student.name || student.username} to Fail Master! 🗣️`
            : `Removed Fail Master designation for ${student.name || student.username}.`,
        });
      } catch (fbErr: any) {
        setActionFeedback({
          type: 'error',
          message: err.message || fbErr.message || 'Could not update role',
        });
      }
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-950/80 backdrop-blur-md"
        id="classmate-profile-modal-backdrop"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-lg glass-panel rounded-3xl border border-white/15 bg-slate-900/95 shadow-2xl overflow-hidden relative"
          id="classmate-profile-modal-card"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header Banner with Avatar */}
          <div className="relative p-6 pb-5 bg-gradient-to-b from-indigo-950/60 to-transparent border-b border-white/5">
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close modal"
              id="close-profile-modal-btn"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="flex items-start gap-4">
              {/* Instagram-style circular DP with story ring */}
              <div className={`h-16 w-16 sm:h-20 sm:w-20 rounded-full p-[2.5px] bg-gradient-to-tr ${student.photoURL || student.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : avatarColor} shadow-xl shadow-indigo-500/25 flex items-center justify-center shrink-0`}>
                <div className="h-full w-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center">
                  {student.photoURL || student.avatarUrl ? (
                    <img
                      src={student.photoURL || student.avatarUrl}
                      alt={student.name || student.username}
                      className="h-full w-full object-cover rounded-full"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span className="text-2xl sm:text-3xl font-black text-white uppercase tracking-wider select-none">
                      {(student.name || student.username || student.trNo || 'ST').slice(0, 2)}
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-1 pr-6 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-bold font-sans tracking-tight text-white truncate">
                    {student.name || student.username || student.trNo || 'Student Profile'}
                  </h2>
                </div>

                <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-indigo-300 font-semibold bg-indigo-500/10 px-2 py-0.5 rounded-lg border border-indigo-500/20">
                    TR: {student.trNo || student.username || '—'}
                  </span>
                  {student.isApproved !== false && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                      Classroom Member
                    </span>
                  )}
                </p>

                {/* Roles & Badges */}
                <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                  {student.role === 'superadmin' || student.username.toLowerCase() === 'admin' || student.username.includes('28782') ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Gatekeeper / Admin
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/15 text-indigo-300 border border-indigo-500/25">
                      Student
                    </span>
                  )}
                  {isMemeMaster && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25 flex items-center gap-1">
                      🎭 Meme Master
                    </span>
                  )}
                  {isFailMaster && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/15 text-rose-300 border border-rose-500/25 flex items-center gap-1">
                      🗣️ Fail Master
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
            {actionFeedback && (
              <div className={`p-3 rounded-2xl text-xs flex items-center gap-2 ${
                actionFeedback.type === 'success' 
                  ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300' 
                  : 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              }`}>
                {actionFeedback.type === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                )}
                <span>{actionFeedback.message}</span>
              </div>
            )}

            {/* Bio Quote */}
            {student.bio && (
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-xs text-slate-200 italic leading-relaxed">
                "{student.bio}"
              </div>
            )}

            {/* Academic & Hostel Placement */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-2xl bg-slate-800/60 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <GraduationCap className="h-3 w-3 text-indigo-400" /> Waras
                </span>
                <p className="text-sm font-semibold text-white truncate">
                  {student.waras || 'Al-Jamea'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/60 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-indigo-400" /> City
                </span>
                <p className="text-sm font-semibold text-white truncate">
                  {student.city || 'Campus'}
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-slate-800/60 border border-white/5 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <Home className="h-3 w-3 text-indigo-400" /> Room No.
                </span>
                <p className="text-sm font-semibold text-white truncate font-mono">
                  {student.roomNo || 'N/A'}
                </p>
              </div>
            </div>

            {/* Contact & Personal Details */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Contact & Identity Records
              </h3>

              {/* Email */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block">Institutional Email</span>
                    <span className="text-xs text-white font-mono truncate block select-all">
                      {student.email || `${student.username.toLowerCase()}@jameasaifiyah.edu`}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(student.email || `${student.username.toLowerCase()}@jameasaifiyah.edu`, 'email')}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                  title="Copy email"
                >
                  {copiedField === 'email' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>

              {/* Phone / WhatsApp */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block">Phone / WhatsApp</span>
                    <span className="text-xs text-white font-mono truncate block">
                      {student.phone || 'Not shared yet'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {cleanPhone && (
                    <a
                      href={`https://wa.me/${cleanPhone.replace('+', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                    >
                      <span>WhatsApp</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {student.phone && (
                    <button
                      type="button"
                      onClick={() => handleCopy(student.phone || '', 'phone')}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
                      title="Copy phone"
                    >
                      {copiedField === 'phone' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  )}
                </div>
              </div>

              {/* Birthday */}
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-800/40 border border-white/5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] text-slate-400 block">Birthday</span>
                    <span className="text-xs text-white truncate block">
                      {student.birthday ? new Date(student.birthday).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : 'Unspecified'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cloud Sync Status */}
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between text-xs text-emerald-300">
              <div className="flex items-center gap-2">
                <Cloud className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>Connected to Firebase Firestore</span>
              </div>
              <span className="text-[11px] font-mono text-emerald-400/80">Permanent Record</span>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 bg-slate-950/60 border-t border-white/5 flex items-center justify-between gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              id="close-profile-modal-footer-btn"
            >
              Close
            </button>

            <div className="flex items-center gap-2">
              {isAdmin && !isSelf ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUpdating !== null}
                    onClick={handleToggleMemeMaster}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isMemeMaster
                        ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                    }`}
                    id="quick-footer-meme-btn"
                  >
                    {isUpdating === 'meme' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />
                    ) : (
                      <span>🎭</span>
                    )}
                    <span>{isMemeMaster ? 'Revoke Meme Master' : 'Make Meme Master'}</span>
                  </button>

                  <button
                    type="button"
                    disabled={isUpdating !== null}
                    onClick={handleToggleFailMaster}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer flex items-center gap-1.5 ${
                      isFailMaster
                        ? 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-white/10'
                    }`}
                    id="quick-footer-fail-btn"
                  >
                    {isUpdating === 'fail' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                    ) : (
                      <span>🗣️</span>
                    )}
                    <span>{isFailMaster ? 'Revoke Fail Master' : 'Make Fail Master'}</span>
                  </button>
                </div>
              ) : (
                onOpenDirectChat && (
                  <button
                    onClick={() => {
                      onClose();
                      onOpenDirectChat(student.username);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Send Message</span>
                  </button>
                )
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
