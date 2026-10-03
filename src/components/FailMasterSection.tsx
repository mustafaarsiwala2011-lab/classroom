/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, MessageSquare, Search, Plus, Trash2, Edit3, X, Check, 
  Copy, Flame, ShieldAlert, Award, Volume2, HelpCircle, Filter, 
  Clock, User as UserIcon, BookOpen, Quote, Smile, ChevronDown, CheckCircle2,
  LayoutGrid, List, History, Share2, ArrowUpDown, Calendar, Trophy, Send,
  PlusCircle, PenLine, Sparkle, Eye, Lock
} from 'lucide-react';
import { FailedWord, User } from '../types';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';

interface FailMasterSectionProps {
  currentUser: User;
}

const CATEGORIES = [
  { id: 'all', label: 'All Entries', emoji: '🌟' },
  { id: 'mispronunciation', label: 'Mispronunciations', emoji: '🗣️' },
  { id: 'slip_of_tongue', label: 'Slips of Tongue', emoji: '👅' },
  { id: 'invented_word', label: 'Invented Words', emoji: '✨' },
  { id: 'grammar_twist', label: 'Grammar Twists', emoji: '📚' },
  { id: 'classic_blunder', label: 'Classroom Blunders', emoji: '💥' },
];

const REACTION_EMOJIS = ['😂', '🤣', '💀', '🤦‍♂️', '🏆', '👏'];

type ViewMode = 'cards' | 'timeline' | 'table';

export default function FailMasterSection({ currentUser }: FailMasterSectionProps) {
  const [failedWords, setFailedWords] = useState<FailedWord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // View Mode: Cards or Timeline Ledger
  const [viewMode, setViewMode] = useState<ViewMode>('cards');
  const [ledgerSubView, setLedgerSubView] = useState<'stream' | 'table'>('stream');
  const [openPickerId, setOpenPickerId] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'reactions' | 'oldest' | 'speaker'>('newest');

  // Composer Modal State (The primary Entry Form)
  const [showComposer, setShowComposer] = useState(false);
  const [editingItem, setEditingItem] = useState<FailedWord | null>(null);

  // Read-Only Word Details Modal State (allows students to inspect word details without editing permissions)
  const [viewingDetailsWord, setViewingDetailsWord] = useState<FailedWord | null>(null);

  const handleViewWordDetails = (item: FailedWord) => {
    setViewingDetailsWord(item);
  };

  // Full History Modal State
  const [showFullHistoryModal, setShowFullHistoryModal] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historySpeakerFilter, setHistorySpeakerFilter] = useState('all');

  // Composer Form Fields
  const [formWord, setFormWord] = useState('');
  const [formIntended, setFormIntended] = useState('');
  const [formSpokenBy, setFormSpokenBy] = useState('');
  const [formWhen, setFormWhen] = useState('');
  const [formBackground, setFormBackground] = useState('');
  const [formCategory, setFormCategory] = useState('mispronunciation');
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Toast notification
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Determine if the current user has Fail Master authority
  const isFailMaster = Boolean(
    currentUser.isFailMaster ||
    currentUser.isMemeMaster ||
    currentUser.username.toLowerCase() === 'admin' ||
    currentUser.username.toLowerCase() === 'fail master' ||
    currentUser.username.toLowerCase() === 'meme master'
  );

  // Fetch Failed Words
  const fetchFailedWords = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/failed-words');
      if (res.ok) {
        const data = await res.json();
        setFailedWords(data.failedWords || []);
      } else {
        setError('Failed to load words from server.');
      }
    } catch (e: any) {
      setError(e.message || 'Error fetching words.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFailedWords();
  }, []);

  // Real-time synchronization via SSE
  useRealtimeEvents({
    fail_created: (payload: any) => {
      const item = payload?.failedWord || payload?.fail || payload;
      if (item && item.id) {
        setFailedWords(prev => [item, ...prev.filter(f => f && f.id !== item.id)]);
      }
    },
    fail_updated: (payload: any) => {
      const item = payload?.failedWord || payload?.fail || payload;
      if (item && item.id) {
        setFailedWords(prev => prev.map(f => f && f.id === item.id ? item : f));
      }
    },
    fail_deleted: (payload: any) => {
      const targetId = payload?.id || payload?.failId;
      if (targetId) {
        setFailedWords(prev => prev.filter(f => f && f.id !== targetId));
      }
    },
    fail_reacted: (payload: any) => {
      const item = payload?.failedWord || payload?.fail || payload;
      if (item && item.id) {
        setFailedWords(prev => prev.map(f => f && f.id === item.id ? item : f));
      }
    }
  }, currentUser?.id, currentUser?.username);

  // Open Composer for New Entry (The Entry button trigger)
  const handleOpenNew = () => {
    setEditingItem(null);
    setFormWord('');
    setFormIntended('');
    setFormSpokenBy('');
    setFormWhen('');
    setFormBackground('');
    setFormCategory('mispronunciation');
    setFormError(null);
    setShowComposer(true);
  };

  // Open Composer for Edit Entry
  const handleOpenEdit = (item: FailedWord) => {
    setEditingItem(item);
    setFormWord(item.word);
    setFormIntended(item.intendedWord || '');
    setFormSpokenBy(item.spokenBy);
    setFormWhen(item.when);
    setFormBackground(item.background);
    setFormCategory(item.category || 'mispronunciation');
    setFormError(null);
    setShowComposer(true);
  };

  // Submit Handler (Create or Edit)
  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWord.trim() || !formSpokenBy.trim() || !formWhen.trim() || !formBackground.trim()) {
      setFormError('Please fill in the 404 word, speaker, when, and background context.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);

    try {
      if (editingItem) {
        // Edit existing
        const res = await fetch(`/api/failed-words/${editingItem.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: formWord,
            intendedWord: formIntended,
            spokenBy: formSpokenBy,
            when: formWhen,
            background: formBackground,
            category: formCategory,
            requesterId: currentUser.id,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to update entry');

        const updatedItem = data.failedWord || data.fail || data;
        setFailedWords(prev => prev.map(item => item.id === editingItem.id ? updatedItem : item));
        showToast(`Updated "${formWord}" in Dictionary error 404!`);
      } else {
        // Create new entry
        const res = await fetch('/api/failed-words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: formWord,
            intendedWord: formIntended,
            spokenBy: formSpokenBy,
            when: formWhen,
            background: formBackground,
            category: formCategory,
            authorId: currentUser.id,
            authorName: currentUser.name || currentUser.username,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save entry');

        const newItem = data.failedWord || data.fail || data;
        if (newItem && newItem.id) {
          setFailedWords(prev => [newItem, ...prev.filter(w => w && w.id !== newItem.id)]);
        }
        showToast(`Archived "${formWord}" into Dictionary error 404!`);
      }

      setShowComposer(false);
    } catch (err: any) {
      setFormError(err.message || 'An error occurred while saving.');
    } finally {
      setFormSubmitting(false);
    }
  };

  // Delete Handler
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to remove this 404 word from the vault?')) {
      return;
    }

    try {
      const res = await fetch(`/api/failed-words/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: currentUser.id }),
      });

      if (res.ok) {
        setFailedWords(prev => prev.filter(w => w.id !== id));
        showToast('Entry removed from vault.');
      } else {
        const data = await res.json();
        alert(data.error || 'Could not delete entry.');
      }
    } catch (e) {
      console.error('Delete error:', e);
    }
  };

  // Reaction Handler with Optimistic UI
  const handleReact = async (id: string, emoji: string) => {
    // Optimistic local state update
    setFailedWords(prev => prev.map(item => {
      if (item.id !== id) return item;
      const reactions = { ...(item.reactions || {}) };
      const userReactions = { ...(item.userReactions || {}) };
      const prevEmoji = userReactions[currentUser.id];

      if (prevEmoji === emoji) {
        delete userReactions[currentUser.id];
        reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
        if (reactions[emoji] === 0) delete reactions[emoji];
      } else {
        if (prevEmoji && reactions[prevEmoji]) {
          reactions[prevEmoji] = Math.max(0, reactions[prevEmoji] - 1);
          if (reactions[prevEmoji] === 0) delete reactions[prevEmoji];
        }
        userReactions[currentUser.id] = emoji;
        reactions[emoji] = (reactions[emoji] || 0) + 1;
      }

      return { ...item, reactions, userReactions };
    }));

    try {
      const res = await fetch(`/api/failed-words/${id}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, userId: currentUser.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.failedWord) {
          setFailedWords(prev => prev.map(w => w.id === id ? data.failedWord : w));
        }
      }
    } catch (e) {
      console.error('Failed to submit reaction:', e);
    }
  };

  // Copy Quote to Clipboard
  const handleCopyQuote = (item: FailedWord) => {
    const textToCopy = `📖 Dictionary error 404: "${item.word}" ${item.intendedWord ? `(Intended: "${item.intendedWord}")` : ''}\n🗣️ Spoken by: ${item.spokenBy} [${item.when}]\n📝 Context: ${item.background}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    showToast(`Copied quote for "${item.word}" to clipboard!`);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Filter and Sort Calculations
  const filteredWords = useMemo(() => {
    return failedWords.filter(item => {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        !query ||
        item.word.toLowerCase().includes(query) ||
        (item.intendedWord && item.intendedWord.toLowerCase().includes(query)) ||
        item.spokenBy.toLowerCase().includes(query) ||
        item.background.toLowerCase().includes(query) ||
        item.when.toLowerCase().includes(query) ||
        (item.category && item.category.toLowerCase().includes(query));

      const matchesCategory = 
        selectedCategory === 'all' || 
        (item.category || 'mispronunciation') === selectedCategory;

      return matchesSearch && matchesCategory;
    }).sort((a, b) => {
      if (sortBy === 'newest') {
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      }
      if (sortBy === 'reactions') {
        const totalA = (Object.values(a.reactions || {}) as number[]).reduce((acc, n) => acc + (Number(n) || 0), 0);
        const totalB = (Object.values(b.reactions || {}) as number[]).reduce((acc, n) => acc + (Number(n) || 0), 0);
        return totalB - totalA;
      }
      if (sortBy === 'speaker') {
        return a.spokenBy.localeCompare(b.spokenBy);
      }
      return 0;
    });
  }, [failedWords, searchQuery, selectedCategory, sortBy]);

  // Overall Statistics & Speakers
  const stats = useMemo(() => {
    const totalCount = failedWords.length;
    let totalLaughs = 0;
    const speakerCounts: Record<string, number> = {};

    failedWords.forEach(w => {
      (Object.values(w.reactions || {}) as number[]).forEach(c => totalLaughs += (Number(c) || 0));
      speakerCounts[w.spokenBy] = (speakerCounts[w.spokenBy] || 0) + 1;
    });

    let topSpeaker = 'None yet';
    let maxSpeakerCount = 0;
    Object.entries(speakerCounts).forEach(([spk, count]) => {
      if (count > maxSpeakerCount) {
        maxSpeakerCount = count;
        topSpeaker = spk;
      }
    });

    const uniqueSpeakers = Object.keys(speakerCounts);

    return { totalCount, totalLaughs, topSpeaker, maxSpeakerCount, speakerCounts, uniqueSpeakers };
  }, [failedWords]);

  // Entire Word History filtered list
  const fullHistoryWords = useMemo(() => {
    return [...failedWords].filter(item => {
      const q = historySearchQuery.toLowerCase();
      const matchesSearch = 
        !q ||
        item.word.toLowerCase().includes(q) ||
        (item.intendedWord && item.intendedWord.toLowerCase().includes(q)) ||
        item.spokenBy.toLowerCase().includes(q) ||
        item.background.toLowerCase().includes(q) ||
        item.when.toLowerCase().includes(q);

      const matchesSpeaker = 
        historySpeakerFilter === 'all' || 
        item.spokenBy.toLowerCase() === historySpeakerFilter.toLowerCase();

      return matchesSearch && matchesSpeaker;
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [failedWords, historySearchQuery, historySpeakerFilter]);

  // Derive active details word from live state so reactions update dynamically
  const activeDetailsWord = viewingDetailsWord 
    ? (failedWords.find(w => w.id === viewingDetailsWord.id) || viewingDetailsWord) 
    : null;

  // Minimalist, clutter-free reaction cluster for cards & ledger
  const renderReactionCluster = (item: FailedWord) => {
    const activeReactions = Object.entries(item.reactions || {}).filter(([_, count]) => (Number(count) || 0) > 0);
    const currentUserReaction = item.userReactions?.[currentUser.id];
    const isPickerOpen = openPickerId === item.id;

    return (
      <div className="relative flex items-center gap-1.5 flex-wrap">
        {activeReactions.map(([emoji, count]) => {
          const isSelected = currentUserReaction === emoji;
          return (
            <button
              key={emoji}
              onClick={(e) => {
                e.stopPropagation();
                handleReact(item.id, emoji);
              }}
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isSelected
                  ? 'bg-rose-500/25 border border-rose-500/50 text-white shadow-xs scale-105'
                  : 'bg-white/5 hover:bg-white/10 border border-white/8 text-slate-300'
              }`}
              title={`${count} reactions. Click to ${isSelected ? 'remove' : 'add'}`}
            >
              <span className="text-xs">{emoji}</span>
              <span className={`text-[10px] ${isSelected ? 'text-rose-300 font-bold' : 'text-slate-400'}`}>
                {count}
              </span>
            </button>
          );
        })}

        {/* Quick Reaction Picker Button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setOpenPickerId(isPickerOpen ? null : item.id);
            }}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 text-slate-400 hover:text-rose-300 text-xs font-medium transition cursor-pointer"
            title="React with emoji"
          >
            <Smile className="h-3.5 w-3.5 text-slate-400 hover:text-rose-300" />
            {activeReactions.length === 0 && <span className="text-[10px]">React</span>}
          </button>

          {/* Floating Minimal Emoji Palette */}
          {isPickerOpen && (
            <div 
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-full left-0 mb-1 z-30 flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/15 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95"
            >
              {REACTION_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    handleReact(item.id, emoji);
                    setOpenPickerId(null);
                  }}
                  className="p-1 rounded-lg hover:bg-white/15 hover:scale-125 transition-transform text-sm cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col p-3 sm:p-5 lg:p-6 max-w-7xl w-full mx-auto space-y-4 relative pb-10">
      
      {/* TOAST ALERT */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-20 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 border border-rose-500/40 text-white shadow-2xl text-xs font-bold flex items-center gap-2 backdrop-blur-xl"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 1. COMPACT & CLUTTERLESS HEADER + ACTIONS & LIVE STATS RIBBON */}
      {/* ========================================================================= */}
      <div className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-br from-rose-950/60 via-slate-900/90 to-indigo-950/60 border border-rose-500/25 backdrop-blur-xl shadow-xl overflow-hidden space-y-3.5">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-3.5">
          {/* Title & Info */}
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-200 text-[10px] font-bold uppercase tracking-wider font-mono">
                📚 404 LEXICON ARCHIVE
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-300 text-[10px] font-semibold">
                👑 Fail Master Curated
              </span>
            </div>
            
            <h1 className="text-[clamp(1.15rem,2.2vw,1.5rem)] font-black text-white tracking-tight flex items-center gap-2 leading-snug">
              <span>Dictionary error 404</span>
              <span className="text-xs font-mono text-rose-400 bg-rose-500/20 px-2 py-0.5 rounded-lg border border-rose-500/30">
                404
              </span>
            </h1>
            
            <p className="text-xs text-slate-300">
              Classroom archive for hilarious slips of the tongue, mispronunciations, and invented vocabulary.
            </p>
          </div>

          {/* Coordinated Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              onClick={() => setShowFullHistoryModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-white/15 text-white font-bold text-xs transition-all cursor-pointer hover:border-rose-400/40 active:scale-[0.98]"
              id="view-word-history-btn"
              title="Open complete chronological word history"
            >
              <History className="h-3.5 w-3.5 text-rose-400" />
              <span>History</span>
              <span className="px-1.5 py-0.2 rounded-md bg-rose-500/30 text-rose-300 text-[10px] font-mono font-bold">
                {stats.totalCount}
              </span>
            </button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleOpenNew}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white font-extrabold text-xs sm:text-sm shadow-lg shadow-rose-600/30 border border-rose-400/40 transition-all cursor-pointer"
              id="main-add-entry-btn"
              title="Add a new 404 word entry"
            >
              <PlusCircle className="h-4 w-4 text-white drop-shadow" />
              <span>+ Add Word Entry</span>
            </motion.button>
          </div>
        </div>

        {/* Live Compact Stat Ribbon */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-2 pt-3 border-t border-white/10">
          <div className="p-2 sm:p-2.5 rounded-xl bg-white/4 border border-white/5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs shrink-0">
              📖
            </div>
            <div className="truncate">
              <span className="text-xs sm:text-sm font-black text-white block leading-none">
                {stats.totalCount}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block truncate">
                404 Words
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white/4 border border-white/5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
              😂
            </div>
            <div className="truncate">
              <span className="text-xs sm:text-sm font-black text-white block leading-none">
                {stats.totalLaughs}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider block truncate">
                Reactions
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white/4 border border-white/5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-xs shrink-0">
              👑
            </div>
            <div className="truncate">
              <span className="text-xs sm:text-sm font-bold text-white block leading-none truncate">
                {stats.topSpeaker}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider truncate block">
                Top Speaker {stats.maxSpeakerCount > 0 ? `(${stats.maxSpeakerCount})` : ''}
              </span>
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-xl bg-white/4 border border-white/5 flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
              ✍️
            </div>
            <div className="truncate">
              <span className="text-xs sm:text-sm font-bold text-white block leading-none truncate">
                {isFailMaster ? 'Fail Master' : 'Contributor'}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider truncate block">
                Vault Status
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TIDY TOOLBAR: VIEW SWITCHER + SEARCH & SORT (DECLUTTERED) */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 glass-panel p-2.5 rounded-2xl border border-white/10">
        
        {/* Left: View Mode Toggle (Cards | Timeline Ledger) */}
        <div className="flex items-center gap-1 bg-slate-950/70 p-1 rounded-xl border border-white/10 shrink-0">
          <button
            onClick={() => setViewMode('cards')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Clean Cards View"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Cards</span>
          </button>

          <button
            onClick={() => setViewMode('timeline')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              viewMode === 'timeline' || viewMode === 'table'
                ? 'bg-rose-500 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
            title="Chronological Timeline Ledger"
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Timeline Ledger</span>
          </button>
        </div>

        {/* Middle: Clean Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search 404 words, meanings, speaker, or category..."
            className="w-full pl-9 pr-8 py-1.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-1 focus:ring-rose-500/50"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Right: Sort dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-rose-500/50 cursor-pointer"
          >
            <option value="newest">🕒 Newest</option>
            <option value="reactions">🔥 Reactions</option>
            <option value="speaker">👤 Speaker</option>
            <option value="oldest">⏳ Oldest</option>
          </select>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MAIN CONTENT: CARDS / TIMELINE / TABLE */}
      {/* ========================================================================= */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
          <div className="h-10 w-10 border-3 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold">Opening Dictionary error 404 Vault...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-3xl bg-red-500/10 border border-red-500/20 text-center space-y-2">
          <ShieldAlert className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-sm text-red-300 font-bold">{error}</p>
          <button
            onClick={fetchFailedWords}
            className="px-4 py-2 rounded-xl bg-red-500/20 text-red-200 text-xs font-bold hover:bg-red-500/30 cursor-pointer"
          >
            Retry Loading
          </button>
        </div>
      ) : filteredWords.length === 0 ? (
        <div className="p-12 text-center rounded-3xl glass-panel border border-white/10 space-y-4">
          <div className="h-16 w-16 rounded-3xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center mx-auto text-3xl">
            📖❌
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">No Dictionary error 404 entries found</h3>
            <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto mt-1">
              {searchQuery
                ? `No misspoken words matched "${searchQuery}". Try clearing search or choosing another category.`
                : 'The lexicon vault is clean! Ready for the next hilarious classroom blunder.'}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
              >
                Clear Search
              </button>
            )}
            <button
              onClick={handleOpenNew}
              className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold shadow-lg transition cursor-pointer flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              <span>+ Add First 404 Word Entry</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'cards' ? (
        /* MODE A: CARDS GRID (DECLUTTERED & MODERN) */
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,300px),1fr))] gap-3.5 sm:gap-4">
          <AnimatePresence>
            {filteredWords.map((item) => {
              const categoryObj = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[1];
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                  className="rounded-2xl glass-panel border border-white/10 hover:border-rose-500/40 bg-slate-900/80 hover:bg-slate-900/95 p-4 sm:p-5 flex flex-col justify-between space-y-3.5 group transition-all duration-200 shadow-md hover:shadow-xl hover:shadow-rose-950/20 relative"
                >
                  {/* Top Bar: Category badge & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-500/15 border border-rose-500/25 text-rose-300 text-[10px] font-bold">
                      <span>{categoryObj.emoji}</span>
                      <span>{categoryObj.label}</span>
                    </span>

                    <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleViewWordDetails(item)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition cursor-pointer"
                        title="View Full Word Details"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleCopyQuote(item)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition cursor-pointer"
                        title="Copy Quote"
                      >
                        {copiedId === item.id ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      {(isFailMaster || item.authorId === currentUser.id) && (
                        <>
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-indigo-300 transition cursor-pointer"
                            title="Edit Entry"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition cursor-pointer"
                            title="Delete Entry"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Word Content */}
                  <div 
                    onClick={() => handleViewWordDetails(item)}
                    className="cursor-pointer group/word space-y-2"
                  >
                    <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight break-words group-hover/word:text-rose-200 transition-colors">
                      "{item.word}"
                    </h3>

                    {item.intendedWord && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-emerald-300 font-semibold bg-emerald-500/10 px-2.5 py-0.5 rounded-md border border-emerald-500/20">
                        <span className="text-[10px] text-slate-400 font-normal">Intended:</span>
                        <span className="font-bold">"{item.intendedWord}"</span>
                      </div>
                    )}

                    {item.background && (
                      <p className="text-xs text-slate-300 italic line-clamp-3 leading-relaxed pt-0.5">
                        "{item.background}"
                      </p>
                    )}
                  </div>

                  {/* Footer Meta & Reactions */}
                  <div className="pt-3 border-t border-white/8 space-y-2.5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <div className="flex items-center gap-1.5 text-slate-300 font-medium truncate">
                        <span className="text-indigo-400">🗣️</span>
                        <span className="text-white font-bold truncate">{item.spokenBy}</span>
                      </div>
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {item.when}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-0.5">
                      {renderReactionCluster(item)}
                      
                      <button
                        onClick={() => handleViewWordDetails(item)}
                        className="text-[10px] font-bold text-slate-400 hover:text-rose-300 transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronDown className="h-3 w-3 -rotate-90" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      ) : (
        /* MODE B: UNIFIED CHRONOLOGICAL TIMELINE LEDGER */
        <div className="glass-panel p-4 sm:p-6 md:p-7 rounded-3xl border border-white/10 space-y-5">
          {/* Timeline Ledger Header with View sub-toggle */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-white/10">
            <div>
              <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                <Clock className="h-5 w-5 text-rose-400" />
                <span>Chronological Timeline Ledger</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Sequential archive of all {filteredWords.length} classroom slips, ordered by occurrence
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-xl border border-white/10">
                <button
                  onClick={() => setLedgerSubView('stream')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ledgerSubView === 'stream'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Timeline Stream
                </button>
                <button
                  onClick={() => setLedgerSubView('table')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    ledgerSubView === 'table'
                      ? 'bg-rose-500/30 text-rose-200 border border-rose-500/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Ledger Table
                </button>
              </div>

              <button
                onClick={handleOpenNew}
                className="px-3 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>+ Add</span>
              </button>
            </div>
          </div>

          {/* Sub-view 1: Timeline Stream */}
          {ledgerSubView === 'stream' ? (
            <div className="relative pl-6 sm:pl-8 border-l-2 border-rose-500/30 space-y-6 my-2">
              {filteredWords.map((item, idx) => {
                const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[1];
                return (
                  <div key={item.id} className="relative group">
                    {/* Minimal timeline node */}
                    <div className="absolute -left-[31px] sm:-left-[39px] top-2 h-5 w-5 rounded-full bg-slate-950 border-2 border-rose-500 flex items-center justify-center text-[10px] font-mono font-bold text-rose-400 shadow-md">
                      {idx + 1}
                    </div>

                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-white/10 hover:border-rose-500/35 transition-all space-y-2.5 group-hover:bg-slate-900/95">
                      {/* Top Row: Word, Intended, Date */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div 
                          onClick={() => handleViewWordDetails(item)}
                          className="flex items-center gap-2 cursor-pointer group/item"
                        >
                          <span className="text-base sm:text-lg font-black text-white group-hover/item:text-rose-300 transition-colors">
                            "{item.word}"
                          </span>
                          <Eye className="h-3.5 w-3.5 text-slate-500 group-hover/item:text-rose-400 transition-colors" />
                          {item.intendedWord && (
                            <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              Meant: "{item.intendedWord}"
                            </span>
                          )}
                        </div>

                        <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                          <Calendar className="h-3 w-3" />
                          {new Date(item.timestamp).toLocaleDateString()} • {item.when}
                        </span>
                      </div>

                      {/* Meta Tags: Speaker, Category, Fail Master */}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 text-indigo-300 font-bold border border-white/5">
                          🗣️ {item.spokenBy}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 font-medium border border-rose-500/20">
                          {cat.emoji} {cat.label}
                        </span>
                        <span className="text-[11px] text-amber-300 font-medium">
                          👑 Fail Master: {item.authorName || 'Fail Master'}
                        </span>
                      </div>

                      {/* Context background */}
                      {item.background && (
                        <p className="text-xs text-slate-300 bg-white/3 p-2.5 rounded-xl border border-white/5 italic">
                          "{item.background}"
                        </p>
                      )}

                      {/* Footer Actions & Reactions */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                        {renderReactionCluster(item)}

                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleCopyQuote(item)}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs flex items-center gap-1 cursor-pointer transition"
                            title="Copy Quote"
                          >
                            <Copy className="h-3 w-3" />
                            <span className="text-[11px]">Copy</span>
                          </button>

                          {(isFailMaster || item.authorId === currentUser.id) && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-indigo-300 cursor-pointer"
                                title="Edit"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Sub-view 2: Compact Ledger Table */
            <div className="overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/5 text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/10 font-mono">
                  <tr>
                    <th className="py-2.5 px-3">404 Word</th>
                    <th className="py-2.5 px-3">Intended</th>
                    <th className="py-2.5 px-3">Speaker</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">When</th>
                    <th className="py-2.5 px-3">Reactions</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {filteredWords.map((item) => {
                    const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[1];

                    return (
                      <tr key={item.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-3 font-bold text-white">
                          <button
                            onClick={() => handleViewWordDetails(item)}
                            className="text-rose-300 hover:text-rose-200 text-xs font-black hover:underline cursor-pointer text-left flex items-center gap-1.5"
                          >
                            <span>"{item.word}"</span>
                            <Eye className="h-3 w-3 opacity-60 hover:opacity-100 text-rose-400" />
                          </button>
                        </td>
                        <td className="py-3 px-3 text-emerald-300 font-semibold">
                          {item.intendedWord ? `"${item.intendedWord}"` : '—'}
                        </td>
                        <td className="py-3 px-3 font-bold text-indigo-300">
                          {item.spokenBy}
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-300 text-[10px] font-medium whitespace-nowrap">
                            {cat.emoji} {cat.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-400 text-[11px] font-mono">
                          {item.when}
                        </td>
                        <td className="py-3 px-3">
                          {renderReactionCluster(item)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => handleCopyQuote(item)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white cursor-pointer"
                              title="Copy Quote"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                            {(isFailMaster || item.authorId === currentUser.id) && (
                              <>
                                <button
                                  onClick={() => handleOpenEdit(item)}
                                  className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-slate-400 hover:text-indigo-300 cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item.id)}
                                  className="p-1 rounded-lg bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FULL WORD HISTORY MODAL (Comprehensive Genealogy & Speaker Stats) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showFullHistoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowFullHistoryModal(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-4xl bg-slate-900 border border-rose-500/30 rounded-3xl shadow-2xl p-5 sm:p-7 z-10 max-h-[90vh] flex flex-col space-y-4 overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-rose-500/20 border border-rose-500/30 flex items-center justify-center text-xl text-rose-400">
                    📜
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-2">
                      <span>Entire Word History</span>
                      <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-mono">
                        {failedWords.length} total entries
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400">
                      Chronological ledger of all slips, blunders, and mispronunciations recorded in class
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowFullHistoryModal(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* History Search & Speaker Filters */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={historySearchQuery}
                    onChange={(e) => setHistorySearchQuery(e.target.value)}
                    placeholder="Search history by word, meaning, or background story..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400 font-bold whitespace-nowrap">Speaker:</span>
                  <select
                    value={historySpeakerFilter}
                    onChange={(e) => setHistorySpeakerFilter(e.target.value)}
                    className="px-3 py-2.5 rounded-xl bg-slate-950/80 border border-white/10 text-white text-xs font-semibold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Speakers ({stats.uniqueSpeakers.length})</option>
                    {stats.uniqueSpeakers.map(spk => (
                      <option key={spk} value={spk}>
                        {spk} ({stats.speakerCounts[spk]})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* History List Content */}
              <div className="flex-1 overflow-y-auto pr-1 space-y-3">
                {fullHistoryWords.length === 0 ? (
                  <div className="p-10 text-center text-slate-400 space-y-2">
                    <p className="text-sm font-bold">No historical entries matched this filter.</p>
                  </div>
                ) : (
                  fullHistoryWords.map((item, index) => {
                    const cat = CATEGORIES.find(c => c.id === item.category) || CATEGORIES[1];
                    const reactionCount = (Object.values(item.reactions || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0);

                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-2xl bg-slate-950/50 border border-white/10 hover:border-rose-500/30 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                      >
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono text-slate-500">#{index + 1}</span>
                            <button
                              onClick={() => handleViewWordDetails(item)}
                              className="text-base font-black text-white hover:text-rose-300 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                              title="Click to view word details"
                            >
                              <span>"{item.word}"</span>
                              <Eye className="h-3.5 w-3.5 text-rose-400 opacity-60 hover:opacity-100" />
                            </button>
                            {item.intendedWord && (
                              <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                                Meant: "{item.intendedWord}"
                              </span>
                            )}
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 font-semibold">
                              {cat.emoji} {cat.label}
                            </span>
                          </div>

                          <p className="text-xs text-slate-300 italic">
                            "{item.background}"
                          </p>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 pt-1">
                            <span className="font-semibold text-indigo-300">🗣️ Spoken by: {item.spokenBy}</span>
                            <span>•</span>
                            <span>🕒 {item.when}</span>
                            <span>•</span>
                            <span>📅 {new Date(item.timestamp).toLocaleDateString()}</span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-semibold text-amber-300">👑 Fail Master: {item.authorName || 'Fail Master'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {reactionCount > 0 && (
                            <span className="px-2.5 py-1 rounded-xl bg-amber-500/15 text-amber-300 text-xs font-mono font-bold">
                              {reactionCount} 🔥
                            </span>
                          )}
                          <button
                            onClick={() => handleViewWordDetails(item)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                            title="View Word Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Details</span>
                          </button>
                          <button
                            onClick={() => handleCopyQuote(item)}
                            className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Copy Quote</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <span className="text-xs text-slate-400 font-mono">
                  Showing {fullHistoryWords.length} of {failedWords.length} entries
                </span>
                <button
                  onClick={() => setShowFullHistoryModal(false)}
                  className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 6. COMPOSER MODAL (THE MAIN ADD / EDIT 404 WORD FORM) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {showComposer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowComposer(false)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border-2 border-rose-500/40 rounded-3xl shadow-2xl p-5 sm:p-7 z-10 max-h-[90vh] overflow-y-auto space-y-5"
            >
              {/* Composer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white text-xl shadow-lg">
                    📖
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-extrabold text-white">
                      {editingItem ? 'Edit Dictionary 404 Entry' : 'Upload a Word to Dictionary error 404'}
                    </h2>
                    <p className="text-xs text-rose-300 font-semibold font-mono">
                      Classroom Lexicon Archive Form
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowComposer(false)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleSubmitForm} className="space-y-4">
                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-200 text-xs font-semibold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Fail Master Curator Status Badge */}
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-semibold flex items-center justify-between shadow-inner">
                  <div className="flex items-center gap-2">
                    <span className="text-base">👑</span>
                    <span>
                      Logging as Fail Master: <strong className="text-white font-bold">{currentUser.name || currentUser.username}</strong>
                    </span>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-200 px-2.5 py-0.5 rounded-full font-mono font-bold uppercase tracking-wider border border-amber-500/30">
                    Official Curator
                  </span>
                </div>

                {/* 404 Word and Intended Word */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      404 Misspoken Word / Slip <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formWord}
                      onChange={(e) => setFormWord(e.target.value)}
                      placeholder='e.g. "Misunderestimated", "Plater"'
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-bold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Intended / Correct Word <span className="text-slate-500">(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formIntended}
                      onChange={(e) => setFormIntended(e.target.value)}
                      placeholder='e.g. "Underestimated", "Platter"'
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                    />
                  </div>
                </div>

                {/* Speaker & When */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      Who spoke it? <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formSpokenBy}
                      onChange={(e) => setFormSpokenBy(e.target.value)}
                      placeholder="Enter student name (e.g. Taher, Husain)"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                      When was it spoken? <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={formWhen}
                      onChange={(e) => setFormWhen(e.target.value)}
                      placeholder="e.g. During Nahw Lecture, Monday Period 3"
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500"
                      required
                    />
                  </div>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                    Category of Slip
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.filter(c => c.id !== 'all').map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFormCategory(cat.id)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                          formCategory === cat.id
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-sm'
                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        <span>{cat.emoji}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Background Story / Context */}
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1">
                    The Background & Story (What happened?) <span className="text-rose-400">*</span>
                  </label>
                  <textarea
                    value={formBackground}
                    onChange={(e) => setFormBackground(e.target.value)}
                    rows={3}
                    placeholder="Describe the context: What was the teacher asking? How did everyone react?"
                    className="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-white/10 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 resize-none"
                    required
                  />
                </div>

                {/* Live Mini Preview */}
                {formWord && (
                  <div className="p-4 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider block font-mono">
                        Live Preview • Dictionary error 404
                      </span>
                      <span className="text-[10px] text-amber-300 font-semibold flex items-center gap-1 font-mono">
                        👑 Fail Master: {currentUser.name || currentUser.username}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-lg font-black text-white">"{formWord}"</span>
                      {formIntended && (
                        <span className="text-xs text-emerald-400 font-semibold">
                          (Meant: "{formIntended}")
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 italic">
                      Spoken by {formSpokenBy || '[Student]'} • {formWhen || '[Time/Context]'}
                    </p>
                  </div>
                )}

                {/* Submit Actions */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setShowComposer(false)}
                    className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="submit"
                    disabled={formSubmitting}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:from-rose-600 hover:to-amber-600 text-white text-xs font-bold shadow-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {formSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Saving...</span>
                      </span>
                    ) : (
                      <span>{editingItem ? 'Update 404 Entry' : 'Publish Word to Dictionary error 404'}</span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. WORD DETAILS MODAL (READ-ONLY FOR STUDENTS & INSPECTOR) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {activeDetailsWord && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setViewingDetailsWord(null)}
              className="absolute inset-0 bg-slate-950/85 backdrop-blur-md"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-slate-900 border-2 border-rose-500/40 rounded-3xl shadow-2xl p-5 sm:p-7 z-10 max-h-[90vh] overflow-y-auto space-y-5"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-3">
                  <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white text-xl shadow-lg shrink-0">
                    {CATEGORIES.find(c => c.id === activeDetailsWord.category)?.emoji || '🗣️'}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg md:text-xl font-extrabold text-white truncate">
                        Word Details
                      </h2>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 border border-white/10 text-slate-300 text-[10px] font-semibold whitespace-nowrap">
                        <Lock className="h-2.5 w-2.5 text-amber-400" />
                        <span>Read-Only View</span>
                      </span>
                    </div>
                    <p className="text-xs text-rose-300 font-semibold font-mono truncate">
                      Dictionary error 404 • {CATEGORIES.find(c => c.id === activeDetailsWord.category)?.label || 'Mispronunciation'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setViewingDetailsWord(null)}
                  className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer shrink-0"
                  title="Close Details"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Student Permission Advisory */}
              <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/10 flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <span className="text-base">🔒</span>
                  <span>
                    Viewing as <strong>{currentUser.name || currentUser.username}</strong> ({isFailMaster ? 'Fail Master' : 'Student'}). {isFailMaster ? 'You have curator permissions.' : 'Students cannot modify archived word entries.'}
                  </span>
                </div>
                {!isFailMaster && (
                  <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 font-bold uppercase tracking-wider shrink-0">
                    Protected Record
                  </span>
                )}
              </div>

              {/* The Big Misspoken Word Card */}
              <div className="p-5 rounded-3xl bg-gradient-to-br from-rose-950/60 via-slate-950/90 to-slate-900 border-2 border-rose-500/30 relative shadow-inner space-y-2">
                <Quote className="absolute top-3 right-3 h-10 w-10 text-rose-500/10 pointer-events-none" />
                <div className="text-[10px] text-rose-400 font-bold uppercase tracking-widest font-mono">
                  404 Misspoken Phrase:
                </div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight break-words">
                  "{activeDetailsWord.word}"
                </h3>

                {activeDetailsWord.intendedWord && (
                  <div className="mt-3 flex items-center gap-2 pt-2.5 border-t border-white/10 text-sm font-semibold text-emerald-300">
                    <span className="text-slate-400 font-normal text-xs">Intended Word:</span>
                    <span className="bg-emerald-500/20 border border-emerald-500/35 px-2.5 py-0.5 rounded-lg text-emerald-300 font-bold text-xs sm:text-sm">
                      "{activeDetailsWord.intendedWord}"
                    </span>
                  </div>
                )}
              </div>

              {/* Speaker & Context Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                    🗣️ Spoken By
                  </span>
                  <span className="text-sm font-bold text-white block">
                    {activeDetailsWord.spokenBy}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                    🕒 When / Context
                  </span>
                  <span className="text-sm font-semibold text-slate-200 block">
                    {activeDetailsWord.when}
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                    🏷️ Lexicon Category
                  </span>
                  <span className="text-xs font-bold text-rose-300 inline-flex items-center gap-1.5">
                    <span>{CATEGORIES.find(c => c.id === activeDetailsWord.category)?.emoji || '🌟'}</span>
                    <span>{CATEGORIES.find(c => c.id === activeDetailsWord.category)?.label || 'General Slip'}</span>
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                    👑 Documented By Fail Master
                  </span>
                  <span className="text-xs font-bold text-amber-300 block">
                    {activeDetailsWord.authorName || 'Fail Master'}
                  </span>
                </div>
              </div>

              {/* Background Story */}
              <div className="p-4 rounded-2xl bg-white/5 border border-white/8 space-y-2">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-rose-400" />
                  <span>The Background Story & Origin</span>
                </div>
                <p className="text-sm text-slate-200 leading-relaxed italic bg-slate-950/40 p-3 rounded-xl border border-white/5">
                  "{activeDetailsWord.background}"
                </p>
                <div className="text-[11px] text-slate-500 font-mono pt-1">
                  Archived on {new Date(activeDetailsWord.timestamp).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>

              {/* Live Emoji Reactions Selector (Students can react!) */}
              <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/8 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">
                    Classroom Reactions
                  </span>
                  <span className="text-rose-400 font-bold font-mono text-[11px]">
                    {(Object.values(activeDetailsWord.reactions || {}) as number[]).reduce((a, b) => a + (Number(b) || 0), 0)} Total
                  </span>
                </div>
                <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
                  {REACTION_EMOJIS.map(emoji => {
                    const count = activeDetailsWord.reactions?.[emoji] || 0;
                    const isActive = activeDetailsWord.userReactions?.[currentUser.id] === emoji;
                    return (
                      <button
                        key={emoji}
                        onClick={() => handleReact(activeDetailsWord.id, emoji)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all transform active:scale-125 cursor-pointer ${
                          isActive
                            ? 'bg-rose-500/30 border border-rose-500/50 text-white scale-105 shadow-sm'
                            : 'hover:bg-white/10 text-slate-300 border border-transparent'
                        }`}
                        title={`React with ${emoji}`}
                      >
                        <span className="text-base">{emoji}</span>
                        {count > 0 && (
                          <span className={`text-xs ${isActive ? 'text-rose-300 font-extrabold' : 'text-slate-400'}`}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="flex items-center justify-between pt-3 border-t border-white/10">
                <button
                  onClick={() => handleCopyQuote(activeDetailsWord)}
                  className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-2 cursor-pointer transition-colors"
                >
                  {copiedId === activeDetailsWord.id ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                      <span className="text-emerald-400">Quote Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy Quote</span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  {isFailMaster && (
                    <button
                      onClick={() => {
                        const target = activeDetailsWord;
                        setViewingDetailsWord(null);
                        handleOpenEdit(target);
                      }}
                      className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit as Fail Master</span>
                    </button>
                  )}
                  <button
                    onClick={() => setViewingDetailsWord(null)}
                    className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold cursor-pointer transition-colors"
                  >
                    Close Details
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
