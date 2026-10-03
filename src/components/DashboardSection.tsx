/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Megaphone, Pin, Plus, Trash2, CheckCircle2, AlertCircle, Clock, 
  Sparkles, Award, BarChart3, ChevronRight, MessageSquare, 
  Laugh, BookOpen, Cake, Vote, Compass, ShieldCheck, UserCheck, UserX, 
  ShieldAlert, RefreshCw, KeyRound, Radio, Mail, User as UserIcon,
  PartyPopper, Calendar, X
} from 'lucide-react';
import { User, EntryRequest } from '../types';
import Polls from './Polls';
import {
  subscribeToEntryRequests,
  approveUserInFirestore,
} from '../lib/gatekeeperFirestore';
import { getBirthdaysThisWeek, BirthdayPerson } from '../lib/birthdayUtils';

interface Notice {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  color: string;
  timestamp: string;
}

interface DashboardSectionProps {
  currentUser: User;
  allClassmates?: User[];
  onNavigateToTab: (tab: 'chat' | 'memes' | 'fails' | 'notes' | 'settings', subjectFilter?: string) => void;
  onOpenUserProfile?: (student: User) => void;
}

const STICKY_COLORS = [
  { id: 'yellow', bg: 'bg-amber-100/95 dark:bg-amber-500/20', text: 'text-amber-900 dark:text-amber-100', border: 'border-amber-200 dark:border-amber-500/30', pin: 'text-amber-500' },
  { id: 'blue', bg: 'bg-sky-100/95 dark:bg-sky-500/20', text: 'text-sky-900 dark:text-sky-100', border: 'border-sky-200 dark:border-sky-500/30', pin: 'text-sky-500' },
  { id: 'pink', bg: 'bg-rose-100/95 dark:bg-rose-500/20', text: 'text-rose-900 dark:text-rose-100', border: 'border-rose-200 dark:border-rose-500/30', pin: 'text-rose-500' },
  { id: 'emerald', bg: 'bg-emerald-100/95 dark:bg-emerald-500/20', text: 'text-emerald-900 dark:text-emerald-100', border: 'border-emerald-200 dark:border-emerald-500/30', pin: 'text-emerald-500' },
];

export default function DashboardSection({ 
  currentUser, 
  allClassmates = [],
  onNavigateToTab,
  onOpenUserProfile 
}: DashboardSectionProps) {
  // Birthday state & calculation
  const [birthdayClassmates, setBirthdayClassmates] = useState<User[]>([]);
  const [showBirthdayModal, setShowBirthdayModal] = useState<boolean>(false);

  // Compute classmates who have a birthday this week
  const effectiveUsers = useMemo(() => {
    return (allClassmates && allClassmates.length > 0) ? allClassmates : birthdayClassmates;
  }, [allClassmates, birthdayClassmates]);

  const birthdaysThisWeek = useMemo(() => {
    return getBirthdaysThisWeek(effectiveUsers);
  }, [effectiveUsers]);

  // Notice states
  const [notices, setNotices] = useState<Notice[]>([]);
  const [newNoticeText, setNewNoticeText] = useState('');
  const [selectedColor, setSelectedColor] = useState('yellow');
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [isPostingNotice, setIsPostingNotice] = useState(false);

  // Admin Entry Requests state
  const [pendingRequests, setPendingRequests] = useState<EntryRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [approvalActionMsg, setApprovalActionMsg] = useState<string | null>(null);
  const admittedSetRef = useRef<Set<string>>(new Set());

  const filterPendingRequests = (reqs: EntryRequest[]) => {
    return reqs.filter((r) => {
      if (r.status !== 'pending') return false;
      const u = r.username?.toLowerCase()?.trim();
      const e = r.email?.toLowerCase()?.trim();
      const id = r.userId?.toLowerCase()?.trim();
      const tr = r.trNo?.toLowerCase()?.trim();
      const reqId = r.id?.toLowerCase()?.trim();

      if (u && admittedSetRef.current.has(u)) return false;
      if (e && admittedSetRef.current.has(e)) return false;
      if (id && admittedSetRef.current.has(id)) return false;
      if (tr && admittedSetRef.current.has(tr)) return false;
      if (reqId && admittedSetRef.current.has(reqId)) return false;
      return true;
    });
  };

  const isAdmin =
    Boolean(currentUser) && (
      currentUser.username?.toLowerCase() === 'admin' ||
      currentUser.username?.toLowerCase().includes('28782') ||
      currentUser.role === 'superadmin' ||
      currentUser.role === 'admin' ||
      (currentUser.email && (
        currentUser.email.toLowerCase() === '28782@jameasaifiyah.edu' ||
        currentUser.email.toLowerCase().includes('28782')
      )) ||
      (currentUser.trNo && currentUser.trNo.toLowerCase().includes('28782')) ||
      (currentUser.id && currentUser.id.toLowerCase().includes('28782'))
    );

  // Stats states
  const [stats, setStats] = useState({
    students: 0,
    notes: 0,
    memes: 0,
    messages: 0
  });

  // Countdown target (e.g. Next major event)
  const [daysLeft, setDaysLeft] = useState(0);

  const fetchNotices = async () => {
    try {
      const res = await fetch('/api/notices');
      if (res.ok) {
        const data = await res.json();
        setNotices(data.notices || []);
      }
    } catch (err) {
      console.error('Error fetching notices:', err);
    }
  };

  const fetchEntryRequests = async () => {
    if (!isAdmin) return;
    setRequestsLoading(true);
    try {
      const authId = currentUser.email || currentUser.username || '28782@jameasaifiyah.edu';
      const res = await fetch(`/api/users/requests?authorizedBy=${encodeURIComponent(authId)}`);
      if (res.ok) {
        const data = await res.json();
        const pending = (data.requests || []).filter((r: EntryRequest) => r.status === 'pending');
        setPendingRequests(filterPendingRequests(pending));
      }
    } catch (err) {
      console.error('Error fetching admission requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  };

  const handleApproveRequest = async (request: EntryRequest, approved: boolean) => {
    try {
      setApprovalActionMsg(null);

      // Permanently record in admitted set so this user can never show up again
      if (approved) {
        if (request.username) admittedSetRef.current.add(request.username.toLowerCase().trim());
        if (request.email) admittedSetRef.current.add(request.email.toLowerCase().trim());
        if (request.userId) admittedSetRef.current.add(request.userId.toLowerCase().trim());
        if (request.trNo) admittedSetRef.current.add(request.trNo.toLowerCase().trim());
        if (request.id) admittedSetRef.current.add(request.id.toLowerCase().trim());
      }

      // 1. Immediately update Firestore for persistent access across all future sessions
      try {
        await approveUserInFirestore(
          request.id,
          {
            username: request.username,
            userId: request.userId,
            email: request.email,
            trNo: request.trNo,
            name: request.name,
          },
          approved
        );
      } catch (fErr) {
        console.warn('Firestore direct approve notice:', fErr);
      }

      // 2. Notify backend to update in-memory user registry and broadcast SSE
      const authId = currentUser.email || currentUser.username || '28782@jameasaifiyah.edu';
      const res = await fetch('/api/users/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: request.username,
          userId: request.userId,
          email: request.email,
          approved,
          authorizedBy: authId,
        }),
      });

      if (res.ok || approved) {
        const data = res.ok ? await res.json() : null;
        setApprovalActionMsg(
          data?.message || (approved
            ? `✅ Access permanently granted for ${request.name || request.username}! They enter the classroom automatically.`
            : `Entry request denied for ${request.name || request.username}.`)
        );
        setPendingRequests(prev => filterPendingRequests(prev.filter(r => r.id !== request.id && r.username !== request.username)));
        fetchStatsAndInfo();
        setTimeout(() => setApprovalActionMsg(null), 4500);
      }
    } catch (err) {
      console.error('Error executing approval action:', err);
    }
  };

  const fetchStatsAndInfo = async () => {
    try {
      // Students
      const usersRes = await fetch('/api/users');
      let studentsCount = 0;
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        const rawUsers = usersData.users || [];
        setBirthdayClassmates(rawUsers);
        const admittedUsers = rawUsers.filter((u: any) => u.isApproved !== false);
        studentsCount = admittedUsers.length;
        admittedUsers.forEach((u: any) => {
          if (u.id) admittedSetRef.current.add(u.id.toLowerCase().trim());
          if (u.username) admittedSetRef.current.add(u.username.toLowerCase().trim());
          if (u.email) admittedSetRef.current.add(u.email.toLowerCase().trim());
          if (u.trNo) admittedSetRef.current.add(u.trNo.toLowerCase().trim());
        });
      }

      // Notes
      const notesRes = await fetch('/api/notes');
      let notesCount = 0;
      if (notesRes.ok) {
        const notesData = await notesRes.json();
        notesCount = (notesData.notes || []).length;
      }

      // Memes
      const memesRes = await fetch('/api/memes');
      let memesCount = 0;
      if (memesRes.ok) {
        const memesData = await memesRes.json();
        memesCount = (memesData.memes || []).length;
      }

      // Messages
      const msgRes = await fetch('/api/chat');
      let msgCount = 0;
      if (msgRes.ok) {
        const msgData = await msgRes.json();
        msgCount = (msgData.messages || []).length;
      }

      setStats({
        students: studentsCount,
        notes: notesCount,
        memes: memesCount,
        messages: msgCount
      });

      const now = new Date();
      const targetDate = new Date();
      const dayOfWeek = 2; // Tuesday
      const distance = (dayOfWeek + 7 - now.getDay()) % 7;
      targetDate.setDate(now.getDate() + (distance === 0 ? 7 : distance));
      targetDate.setHours(9, 0, 0, 0);
      
      const diffTime = targetDate.getTime() - now.getTime();
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      setDaysLeft(diffDays);

    } catch (err) {
      console.error('Error fetching classroom stats:', err);
    }
  };

  useEffect(() => {
    fetchNotices();
    fetchStatsAndInfo();
    if (isAdmin) {
      fetchEntryRequests();
    }

    // 1. Direct Firestore real-time listener for incoming admission requests
    let unsubFirestore: (() => void) | null = null;
    if (isAdmin) {
      unsubFirestore = subscribeToEntryRequests((requests) => {
        setPendingRequests(filterPendingRequests(requests as any));
      });
    }

    // 2. Live SSE updates for instant gatekeeping across connections
    const eventSource = new EventSource('/api/events/stream');
    const refreshGatekeeper = () => {
      if (isAdmin) {
        fetchEntryRequests();
      }
    };

    eventSource.addEventListener('user_entry_requested', refreshGatekeeper);
    eventSource.addEventListener('user_approved', refreshGatekeeper);
    eventSource.addEventListener('user_rejected', refreshGatekeeper);
    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'user_entry_requested' || payload.type === 'user_approved' || payload.type === 'user_rejected') {
          refreshGatekeeper();
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    const interval = setInterval(() => {
      fetchNotices();
      fetchStatsAndInfo();
      if (isAdmin) {
        fetchEntryRequests();
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      eventSource.close();
      if (unsubFirestore) unsubFirestore();
    };
  }, [isAdmin, currentUser]);

  const handlePostNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeText.trim()) return;

    setIsPostingNotice(true);
    setNoticeError(null);

    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: newNoticeText.trim(),
          authorId: currentUser.id,
          authorName: currentUser.username,
          color: selectedColor
        })
      });

      if (res.ok) {
        setNewNoticeText('');
        fetchNotices();
        fetchStatsAndInfo();
      } else {
        const errData = await res.json();
        setNoticeError(errData.error || 'Failed to post notice.');
      }
    } catch (err) {
      setNoticeError('Connection error posting notice.');
    } finally {
      setIsPostingNotice(false);
    }
  };

  const handleDeleteNotice = async (id: string) => {
    try {
      const res = await fetch(`/api/notices/${id}?userId=${currentUser.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchNotices();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete notice.');
      }
    } catch (err) {
      console.error('Error deleting notice:', err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-5">
      
      {/* HEADER SECTION (COMPACT & CLUTTERLESS) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 glass-panel rounded-2xl p-4 sm:p-5 relative overflow-hidden">
        <div className="space-y-1 relative z-10 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 text-[11px] font-semibold border border-indigo-500/20">
            <Compass className="h-3 w-3" />
            <span>Classroom Portal</span>
          </div>
          <h1 className="text-[clamp(1.15rem,2.2vw,1.5rem)] font-extrabold font-sans tracking-tight text-white leading-snug">
            Welcome back, <span className="text-indigo-400">{currentUser.name || currentUser.username}</span>!
          </h1>
          <p className="text-xs text-slate-300 max-w-xl">
            {isAdmin
              ? 'Administrator terminal: Gatekeeper access controls and classroom boards are live.'
              : 'Study hub home terminal: check daily notices, participate in polls, and collaborate.'}
          </p>
        </div>

        {/* Badges container: Birthday Notification Badge & Exam countdown */}
        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap relative z-10 shrink-0">
          {/* Classmate Birthday This Week Notification Badge */}
          {birthdaysThisWeek.length > 0 && (
            <motion.button
              type="button"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowBirthdayModal(true)}
              className="flex items-center gap-2.5 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-indigo-500/20 border border-pink-500/40 hover:border-pink-400 px-3 py-2 rounded-xl shrink-0 cursor-pointer shadow-lg group transition-all text-left"
              id="dashboard-birthday-notification-badge"
              title="Click to view classmate birthdays this week & send wishes"
            >
              <div className="h-8 w-8 rounded-lg bg-pink-500/30 text-pink-300 flex items-center justify-center font-bold relative shrink-0">
                <Cake className="h-4 w-4 text-pink-300 animate-bounce" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-pink-500 border border-slate-900" />
                </span>
              </div>
              <div className="min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] text-pink-300 font-extrabold uppercase tracking-wider block">
                    Birthday This Week! 🎉
                  </span>
                  <span className="px-1.5 py-0.2 rounded-full bg-pink-500 text-white text-[9px] font-bold">
                    {birthdaysThisWeek.length}
                  </span>
                </div>
                <span className="text-xs font-bold text-white block truncate max-w-[150px] group-hover:text-pink-200 transition-colors">
                  {birthdaysThisWeek.map((b) => b.user.name || b.user.username).join(', ')}
                </span>
                <span className="text-[9px] text-pink-200/90 font-mono block">
                  {birthdaysThisWeek[0].relativeDay}
                </span>
              </div>
            </motion.button>
          )}

          {/* Exam countdown badge */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 py-2.5 rounded-xl shrink-0">
            <div className="h-8 w-8 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold">
              <Clock className="h-4 w-4" />
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                Next Milestone: Nahw Quiz
              </span>
              <span className="text-sm font-bold text-white block font-mono">
                In {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
              </span>
            </div>
          </div>
        </div>

        {/* Ambient aura */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[80px] rounded-full pointer-events-none" />
      </div>

      {/* CLASSMATE BIRTHDAY CELEBRATION SHOWCASE BANNER */}
      {birthdaysThisWeek.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel p-3.5 sm:p-4 rounded-2xl border border-pink-500/30 bg-gradient-to-r from-pink-950/40 via-purple-950/30 to-indigo-950/40 backdrop-blur-md shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-3.5"
          id="dashboard-birthday-announcement-card"
        >
          <div className="flex items-center gap-3 relative z-10">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <PartyPopper className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 text-[10px] font-bold border border-pink-500/30">
                  <Sparkles className="h-2.5 w-2.5" />
                  Classmate Birthday This Week
                </span>
                <span className="text-xs font-semibold text-slate-300">
                  {birthdaysThisWeek.length === 1
                    ? 'A classmate is celebrating their birthday this week!'
                    : `${birthdaysThisWeek.length} classmates are celebrating birthdays this week!`}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {birthdaysThisWeek.map((b, idx) => (
                  <button
                    key={`bday-tag-${b.user.id || idx}`}
                    type="button"
                    onClick={() => {
                      if (onOpenUserProfile) {
                        onOpenUserProfile(b.user);
                      } else {
                        setShowBirthdayModal(true);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-pink-500/40 px-2.5 py-1 rounded-xl text-xs transition cursor-pointer text-left group"
                    title="Click to view student profile"
                  >
                    <div className={`h-5 w-5 rounded-full bg-gradient-to-tr ${b.user.avatarColor || 'from-pink-500 to-indigo-600'} text-[9px] font-bold text-white flex items-center justify-center`}>
                      {(b.user.name || b.user.username || 'ST').slice(0, 1)}
                    </div>
                    <span className="font-bold text-white group-hover:text-pink-200 transition-colors">
                      {b.user.name || b.user.username}
                    </span>
                    {b.user.trNo && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        ({b.user.trNo})
                      </span>
                    )}
                    <span className="text-[10px] font-mono text-pink-300 bg-pink-500/20 px-1.5 py-0.2 rounded font-semibold border border-pink-500/30">
                      {b.relativeDay}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto relative z-10 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateToTab('chat')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-500 active:scale-95 text-white font-bold text-xs transition shadow-sm cursor-pointer"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Wish in Chat 🎉</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBirthdayModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition cursor-pointer"
            >
              Details
            </button>
          </div>
        </motion.div>
      )}

      {/* ADMIN GATEKEEPER & ADMISSION REQUESTS MODULE */}
      {isAdmin && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-2xl p-4 sm:p-5 border border-amber-500/40 bg-gradient-to-br from-slate-900/95 via-slate-950/90 to-amber-950/20 backdrop-blur-xl shadow-xl relative overflow-hidden"
          id="admin-gatekeeper-banner"
        >
          {/* Subtle ambient accent */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 blur-[90px] rounded-full pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3.5 relative z-10">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
                <ShieldAlert className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Classroom Gatekeeper & Entry Requests
                  </h2>
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Listening
                  </span>
                  {pendingRequests.length > 0 && (
                    <span className="px-2 py-0.2 rounded-full bg-amber-500 text-slate-950 font-bold text-[10px] animate-pulse">
                      {pendingRequests.length} Pending
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Authorized Admin: <span className="text-amber-300 font-mono font-medium">28782@jameasaifiyah.edu</span>
                </p>
              </div>
            </div>

            <button
              onClick={fetchEntryRequests}
              disabled={requestsLoading}
              className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-semibold text-slate-300 border border-white/10 transition-all cursor-pointer shadow-xs active:scale-95"
            >
              <RefreshCw className={`h-3 w-3 ${requestsLoading ? 'animate-spin text-amber-400' : ''}`} />
              <span>Sync</span>
            </button>
          </div>

          {approvalActionMsg && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 p-2.5 text-xs rounded-xl flex items-center gap-2 mb-3 shadow-lg relative z-10"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{approvalActionMsg}</span>
            </motion.div>
          )}

          {pendingRequests.length === 0 ? (
            <div className="p-3.5 rounded-xl border border-white/5 bg-slate-900/50 backdrop-blur-sm text-xs text-slate-300 flex flex-col sm:flex-row items-center justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <span>
                  No pending student requests. Any new sign-in will show up here instantly.
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 shrink-0">
                1-Click Approval
              </span>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3 relative z-10">
              {pendingRequests.map((req, idx) => (
                <div
                  key={`pending-req-${req.id || idx}-${idx}`}
                  className="p-3.5 rounded-xl border border-amber-500/20 bg-slate-900/80 backdrop-blur-md flex flex-col justify-between gap-2.5 hover:border-amber-500/40 transition-all shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      {req.photoURL ? (
                        <img
                          src={req.photoURL}
                          alt={req.name || req.username}
                          className="h-9 w-9 rounded-lg object-cover border border-white/10 shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-xs">
                          {(req.name || req.username).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white tracking-tight">
                            {req.name || req.username}
                          </span>
                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[10px] border border-indigo-500/30">
                            {req.trNo}
                          </span>
                        </div>
                        {req.email && (
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-0.5 font-mono">
                            <Mail className="h-2.5 w-2.5 text-slate-500 shrink-0" />
                            <span className="truncate max-w-[180px]">{req.email}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {req.waras ? `${req.waras} • ` : ''}{req.city || 'Surat'}{req.roomNo ? ` • Room ${req.roomNo}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-[9px] text-amber-400/90 font-mono bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20 shrink-0">
                      {new Date(req.requestedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                    <button
                      onClick={() => handleApproveRequest(req, true)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold text-xs transition-all shadow-xs cursor-pointer"
                      id={`dashboard-approve-${req.username}`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleApproveRequest(req, false)}
                      className="py-1.5 px-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 active:scale-[0.98] text-red-300 border border-red-500/25 font-semibold text-xs transition-all cursor-pointer"
                      id={`dashboard-deny-${req.username}`}
                    >
                      <UserX className="h-3.5 w-3.5" />
                      <span>Deny</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* QUICK CORE STATS RIBBON (COMPACT & CLEAN) */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2.5 sm:gap-3">
        {[
          { label: 'Classmates', value: stats.students, icon: Award, color: 'text-indigo-400', bg: 'bg-indigo-500/10', action: () => onNavigateToTab('settings') },
          { label: 'Discussion Posts', value: stats.messages, icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-500/10', action: () => onNavigateToTab('chat') },
          { label: 'Study Notes', value: stats.notes, icon: BookOpen, color: 'text-sky-400', bg: 'bg-sky-500/10', action: () => onNavigateToTab('notes') },
          { label: 'Board Memes', value: stats.memes, icon: Laugh, color: 'text-amber-400', bg: 'bg-amber-500/10', action: () => onNavigateToTab('memes') },
        ].map((item, index) => {
          const Icon = item.icon;
          return (
            <motion.div
              whileHover={{ y: -1 }}
              key={index}
              onClick={item.action}
              className="glass-panel p-3 rounded-xl border border-white/5 flex items-center gap-3 cursor-pointer hover:border-white/15 transition-all select-none"
            >
              <div className={`h-8 w-8 rounded-lg ${item.bg} flex items-center justify-center ${item.color} shrink-0`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="truncate">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">
                  {item.label}
                </span>
                <span className="text-base sm:text-lg font-bold font-mono text-white block leading-tight">
                  {item.value}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* TWO COLUMN GRID: NOTICE BOARD & CLASS POLL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
        
        {/* LEFT COLUMN: VIRTUAL NOTICE BOARD */}
        <div className="lg:col-span-7 space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-indigo-400" />
              <span>Interactive Notice Board</span>
            </h2>
            <span className="text-xs text-slate-400 font-mono">
              {notices.length} active
            </span>
          </div>

          {/* Sticky Notice Publisher Form */}
          <form onSubmit={handlePostNotice} className="glass-panel rounded-2xl p-3 border border-white/5 space-y-2.5">
            {noticeError && (
              <div className="bg-red-500/10 border-l-3 border-red-500 text-red-300 p-1.5 text-xs rounded-r">
                {noticeError}
              </div>
            )}
            
            <div className="relative">
              <textarea
                value={newNoticeText}
                onChange={(e) => setNewNoticeText(e.target.value.slice(0, 150))}
                placeholder="Pin a quick memo or study reminder... (max 150 chars)"
                rows={2}
                className="w-full bg-slate-950/30 text-white placeholder-slate-500 p-2.5 rounded-xl border border-white/5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/40 transition-all resize-none"
              />
              <span className="absolute bottom-1.5 right-2 text-[9px] text-slate-500 font-mono">
                {newNoticeText.length}/150
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 pt-0.5">
              {/* Color selectors */}
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-slate-400 font-bold uppercase">Color:</span>
                <div className="flex items-center gap-1">
                  {STICKY_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedColor(c.id)}
                      className={`h-4 w-4 rounded-full border transition-all ${
                        c.id === 'yellow' ? 'bg-amber-400' :
                        c.id === 'blue' ? 'bg-sky-400' :
                        c.id === 'pink' ? 'bg-rose-400' : 'bg-emerald-400'
                      } ${selectedColor === c.id ? 'ring-2 ring-indigo-400 scale-110 border-white' : 'border-transparent hover:scale-105'}`}
                      title={`${c.id} theme`}
                    />
                  ))}
                </div>
              </div>

              {/* Pin notice button */}
              <button
                type="submit"
                disabled={isPostingNotice || !newNoticeText.trim()}
                className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer shadow-xs border border-white/10"
              >
                <Plus className="h-3 w-3" />
                <span>Pin Memo</span>
              </button>
            </div>
          </form>

          {/* Sticky Notes Grid Container */}
          <div className="flex-1 max-h-[380px] overflow-y-auto pr-0.5 space-y-3">
            <AnimatePresence mode="popLayout">
              {notices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500 bg-white/2 rounded-2xl border border-dashed border-white/5">
                  <Pin className="h-6 w-6 text-slate-600 mb-1.5 rotate-45" />
                  <span className="text-xs font-semibold text-slate-400">Notice Board is empty</span>
                  <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                    Be the first classmate to pin a helpful notice or homework hint above!
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-2.5">
                  {notices.map((notice, nIdx) => {
                    const colorStyle = STICKY_COLORS.find(c => c.id === notice.color) || STICKY_COLORS[0];
                    const isAuthor = notice.authorId === currentUser.id;
                    
                    return (
                      <motion.div
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                        key={`notice-${notice.id || nIdx}-${nIdx}`}
                        className={`p-3 rounded-xl border ${colorStyle.bg} ${colorStyle.border} flex flex-col justify-between shadow-xs relative overflow-hidden group`}
                      >
                        <div className="absolute top-2 right-2 flex items-center justify-between w-full pl-3 pointer-events-none">
                          <Pin className={`h-3 w-3 -rotate-12 ${colorStyle.pin}`} />
                        </div>

                        <div className="space-y-1 pt-1">
                          <p className={`text-xs font-medium break-words leading-relaxed ${colorStyle.text}`}>
                            {notice.text}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2.5 pt-1.5 border-t border-black/5 dark:border-white/5">
                          <div className="flex flex-col">
                            <span className={`text-[9px] font-bold ${colorStyle.text} uppercase`}>
                              {notice.authorName}
                            </span>
                            <span className="text-[8px] text-slate-500 dark:text-slate-400">
                              {new Date(notice.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          {(isAuthor || isAdmin) && (
                            <button
                              onClick={() => handleDeleteNotice(notice.id)}
                              className="p-1 rounded bg-black/5 hover:bg-red-500/20 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer"
                              title="Remove pinned memo"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT COLUMN: INTERACTIVE DAILY CLASS POLL & QUICK LINKS */}
        <div className="lg:col-span-5 space-y-4">
          <Polls currentUser={currentUser} />

          {/* QUICK LINKS & JUMP POINTS (2x2 GRID FOR MINIMAL VERTICAL SPACE) */}
          <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-2.5">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Award className="h-4 w-4 text-indigo-400" />
              <span>Study Board Shortcuts</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { name: 'Arabic Grammar (Nahw)', subject: 'Nahw', desc: 'Rules & endings' },
                { name: 'Jurisprudence (Fiqh)', subject: 'Fiqh', desc: 'Daily guidelines' },
                { name: 'Adab & Rhetoric', subject: 'Adab', desc: 'Poetry & letters' },
                { name: 'General Notes', subject: 'General', desc: 'Homework & tasks' },
              ].map((sub, idx) => (
                <button
                  key={idx}
                  onClick={() => onNavigateToTab('notes', sub.subject)}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10 text-left transition-all cursor-pointer text-slate-200 group"
                >
                  <div className="truncate pr-1">
                    <span className="text-xs font-bold block text-white group-hover:text-indigo-300 transition-colors truncate">
                      {sub.name}
                    </span>
                    <span className="text-[9px] text-slate-400 block truncate">
                      {sub.desc}
                    </span>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-white transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>

        </div>

      </div>

      {/* INTERACTIVE BIRTHDAYS THIS WEEK CELEBRATION MODAL */}
      <AnimatePresence>
        {showBirthdayModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="glass-panel w-full max-w-lg rounded-2xl border border-pink-500/30 bg-slate-900/95 p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 flex items-center justify-center text-white shadow-md shrink-0">
                    <Cake className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white flex items-center gap-2">
                      <span>Classmate Birthdays This Week</span>
                      <span className="px-2 py-0.2 rounded-full bg-pink-500 text-white font-bold text-[10px]">
                        {birthdaysThisWeek.length}
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300">
                      Celebrate milestones and send high vibes to your study hub peers!
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBirthdayModal(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                  title="Close modal"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3">
                {birthdaysThisWeek.map((b, idx) => (
                  <div
                    key={`bday-card-${b.user.id || idx}`}
                    className="p-3.5 rounded-xl border border-pink-500/20 bg-slate-950/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-pink-500/40 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-11 w-11 rounded-full p-[2px] bg-gradient-to-tr ${b.user.photoURL || b.user.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : (b.user.avatarColor || 'from-pink-500 to-indigo-600')} shadow-md shrink-0 flex items-center justify-center`}>
                        <div className="h-full w-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center">
                          {b.user.photoURL || b.user.avatarUrl ? (
                            <img
                              src={b.user.photoURL || b.user.avatarUrl}
                              alt={b.user.name || b.user.username}
                              className="h-full w-full object-cover rounded-full"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <span className="text-sm font-bold text-white uppercase select-none">
                              {(b.user.name || b.user.username || 'ST').slice(0, 2).toUpperCase()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">
                            {b.user.name || b.user.username}
                          </span>
                          {b.user.trNo && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono font-bold text-[10px] border border-indigo-500/30">
                              {b.user.trNo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                          <span className="text-pink-300 font-bold flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {b.formattedDate} ({b.dayName})
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">
                            {b.relativeDay}
                          </span>
                        </div>
                        {b.user.waras && (
                          <p className="text-[11px] text-slate-400">
                            {b.user.waras} {b.user.city ? `• ${b.user.city}` : ''}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setShowBirthdayModal(false);
                          if (onOpenUserProfile) {
                            onOpenUserProfile(b.user);
                          } else {
                            onNavigateToTab('settings');
                          }
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition cursor-pointer"
                      >
                        Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowBirthdayModal(false);
                          onNavigateToTab('chat');
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs transition shadow-sm cursor-pointer"
                      >
                        <MessageSquare className="h-3 w-3" />
                        <span>Wish in Chat</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                <span>Classroom Birthday Synchronizer</span>
                <button
                  type="button"
                  onClick={() => setShowBirthdayModal(false)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium text-xs transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
