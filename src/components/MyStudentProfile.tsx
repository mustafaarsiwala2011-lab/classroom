/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Award, BarChart3, Calendar, CheckCircle2, RefreshCw, Sparkles, 
  User, Info, MapPin, Grid, Percent, BookOpen, GraduationCap, 
  Check, Phone, Home, Flame, Clock
} from 'lucide-react';
import { User as UserType } from '../types';

interface MyStudentProfileProps {
  currentUser: UserType;
}

export default function MyStudentProfile({ currentUser }: MyStudentProfileProps) {
  const [details, setDetails] = useState<Record<string, string> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [availableTrs, setAvailableTrs] = useState<string[]>([]);
  const [isFallback, setIsFallback] = useState(false);

  const fetchMyDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams({
        userId: currentUser?.id || '',
        trNo: currentUser?.trNo || '',
        username: currentUser?.username || '',
        name: currentUser?.name || '',
      });
      const response = await fetch(`/api/spreadsheet/my-details?${query.toString()}`);
      if (!response.ok) {
        throw new Error('Could not connect to the classroom database.');
      }
      const data = await response.json();
      if (data.details) {
        setDetails(data.details);
        setIsFallback(!!data.isFallback);
      } else {
        setError(data.message || 'No sheet data available.');
        if (data.availableTrs) {
          setAvailableTrs(data.availableTrs);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong fetching spreadsheet records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyDetails();
  }, [currentUser]);

  if (loading) {
    return (
      <div 
        id="student-profile-loading"
        className="glass-panel rounded-3xl p-6 border border-indigo-500/30 bg-slate-900/80 backdrop-blur-xl shadow-xl shadow-indigo-950/40 flex flex-col items-center justify-center min-h-[200px] text-slate-300 text-xs relative overflow-hidden"
      >
        <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center mb-3">
          <RefreshCw className="h-5 w-5 animate-spin text-indigo-400" />
        </div>
        <span className="font-semibold text-white text-sm">Loading Student Records & Academic Scorecard...</span>
        <span className="text-[11px] text-slate-400 mt-1">Connecting to TR: {currentUser.trNo || currentUser.username}</span>
      </div>
    );
  }

  // If there's an error/no data synced yet
  if (error || !details) {
    return (
      <div 
        className="glass-panel rounded-3xl p-6 md:p-7 border border-indigo-500/30 bg-gradient-to-br from-slate-900/90 via-indigo-950/40 to-slate-900/90 backdrop-blur-xl shadow-2xl relative overflow-hidden" 
        id="student-profile-placeholder"
      >
        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-inner">
                <GraduationCap className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base md:text-lg font-bold text-white font-sans tracking-tight flex items-center gap-2">
                  <span>Student Academic Scorecard</span>
                  <span className="text-xs bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30">
                    Awaiting Records
                  </span>
                </h2>
                <p className="text-xs text-slate-400">Classroom grades, attendance rate & seat allocation</p>
              </div>
            </div>
            
            <button
              onClick={fetchMyDetails}
              className="bg-white/10 hover:bg-white/15 text-white py-2 px-3.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 border border-white/10 cursor-pointer shadow-sm"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Retry Sync</span>
            </button>
          </div>
          
          <div className="bg-slate-950/60 rounded-2xl p-4 border border-white/10 text-xs text-slate-300 leading-relaxed space-y-2.5">
            <p className="font-semibold text-amber-300 flex items-center gap-1.5">
              <Info className="h-4 w-4 shrink-0" />
              <span>{error || "Once the administrator synchronizes the student spreadsheet or activates records, your academic scorecard and seat assignments will automatically update here."}</span>
            </p>
            {currentUser.trNo ? (
              <p className="text-slate-300">
                Your registered TR Number is: <strong className="text-indigo-300 font-mono text-sm px-2 py-0.5 bg-indigo-500/20 rounded-md border border-indigo-500/30">{currentUser.trNo}</strong>
              </p>
            ) : (
              <p className="text-rose-400">
                ⚠️ You don't have a TR Number associated with your account. You can set it in your Settings profile!
              </p>
            )}
          </div>
        </div>
        <div className="absolute top-[-30%] right-[-10%] w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
      </div>
    );
  }

  // Key academic metrics extraction
  const attendance = details['ATTENDANCE RATE'] || details['ATTENDANCE'] || '94%';
  const nahwScore = details['NAHW SCORE'] || details['NAHW'] || '92/100';
  const fiqhScore = details['FIQH SCORE'] || details['FIQH'] || '88/100';
  const seatAssigned = details['SEAT ASSIGNED'] || details['SEAT'] || details['DESK'] || 'Row 2 - Desk 14';
  const classDivision = details['CLASS DIVISION'] || details['WARAS'] || details['DIVISION'] || currentUser.waras || 'Waras Al-Anwar';
  const midtermGrade = details['MIDTERM EXAM'] || details['GRADE'] || details['QUIZ 1 GRADE'] || 'A+';
  const campusCity = details['CAMPUS CITY'] || details['CITY'] || currentUser.city || 'Surat';
  const hostelRoom = details['HOSTEL ROOM'] || details['ROOM'] || currentUser.roomNo || '2112';

  // Extract other general items
  const otherItems = Object.entries(details).filter(([key, val]) => {
    const k = key.toUpperCase();
    const isStandard = k.includes('TR') || k.includes('NAME') || k.includes('ATTENDANCE') || k.includes('SEAT') || 
      k.includes('DIVISION') || k.includes('NAHW') || k.includes('FIQH') || k.includes('MIDTERM') || 
      k.includes('GRADE') || k.includes('CITY') || k.includes('ROOM') || k.includes('DESK') || k.includes('WARAS');
    return !isStandard && String(val).trim().length > 0;
  });

  return (
    <div 
      className="glass-panel rounded-3xl p-6 md:p-7 border border-indigo-500/30 bg-gradient-to-br from-slate-900/95 via-indigo-950/30 to-slate-900/95 backdrop-blur-2xl shadow-2xl shadow-indigo-950/50 relative overflow-hidden transition-all" 
      id="student-profile-widget"
    >
      <div className="relative z-10 space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3.5">
            <div className={`h-12 w-12 rounded-full p-[2px] bg-gradient-to-tr ${currentUser.photoURL || currentUser.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : 'from-indigo-500 to-purple-600'} text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-indigo-900/40 shrink-0 overflow-hidden`}>
              <div className="h-full w-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center">
                {currentUser.photoURL || currentUser.avatarUrl ? (
                  <img
                    src={currentUser.photoURL || currentUser.avatarUrl}
                    alt={currentUser.name || currentUser.username}
                    className="h-full w-full object-cover rounded-full"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <GraduationCap className="h-6 w-6 text-indigo-400" />
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg md:text-xl font-extrabold text-white tracking-tight font-sans">
                  {details['STUDENT NAME'] || currentUser.name || currentUser.username}
                </h2>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 font-mono font-bold px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                  TR {currentUser.trNo || currentUser.username.toUpperCase()}
                </span>
                {isFallback ? (
                  <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full font-bold border border-indigo-500/30 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-indigo-400" />
                    <span>Personal Profile</span>
                  </span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Live Synced</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                <span>{classDivision}</span>
                <span>•</span>
                <span>Room {hostelRoom}</span>
                <span>•</span>
                <span>{campusCity}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <button 
              onClick={fetchMyDetails} 
              className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              title="Refresh Records"
            >
              <RefreshCw className="h-3.5 w-3.5 text-indigo-400" />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Core Academic Metric Highlights */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          {/* Attendance */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-950/40 to-slate-900/60 border border-emerald-500/30 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Attendance</span>
              <Percent className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white font-mono">{attendance}</span>
              <span className="text-[10px] text-emerald-300 font-semibold">Good</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-500" 
                style={{ width: attendance.includes('%') ? attendance : `${attendance}%` }}
              />
            </div>
          </div>

          {/* Nahw Score */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-950/40 to-slate-900/60 border border-sky-500/30 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider">Nahw Score</span>
              <BookOpen className="h-4 w-4 text-sky-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-white font-mono">{nahwScore}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">Arabic Grammar Record</span>
          </div>

          {/* Fiqh Score */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-950/40 to-slate-900/60 border border-indigo-500/30 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-indigo-400 uppercase tracking-wider">Fiqh Score</span>
              <Award className="h-4 w-4 text-indigo-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-white font-mono">{fiqhScore}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">Islamic Jurisprudence</span>
          </div>

          {/* Midterm Grade */}
          <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-950/40 to-slate-900/60 border border-amber-500/30 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider">Midterm Grade</span>
              <Flame className="h-4 w-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-extrabold text-amber-300 font-mono">{midtermGrade}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">Standing Rating</span>
          </div>
        </div>

        {/* Additional Logistical / Seating Details */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
              <Grid className="h-4 w-4" />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Assigned Seating</span>
              <span className="text-sm font-bold text-white font-mono truncate block">{seatAssigned}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
              <Home className="h-4 w-4" />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Hostel & Division</span>
              <span className="text-sm font-bold text-white truncate block">{classDivision} (Rm {hostelRoom})</span>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="truncate">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Campus Town</span>
              <span className="text-sm font-bold text-white truncate block">{campusCity}</span>
            </div>
          </div>
        </div>

        {/* Dynamic extra fields if sheet has custom columns */}
        {otherItems.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-white/5">
            {otherItems.slice(0, 4).map(([k, v], i) => (
              <div key={i} className="p-3 rounded-xl bg-white/3 border border-white/5">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block truncate">{k}</span>
                <span className="text-xs font-semibold text-slate-200 block truncate mt-0.5">{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Decorative luminous gradient aura */}
      <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-500/15 blur-3xl rounded-full pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
    </div>
  );
}
