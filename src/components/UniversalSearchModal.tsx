/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, X, BookOpen, Laugh, ShieldAlert, MessageSquare, User, Megaphone, ArrowRight, Sparkles, Loader2, UserCheck, ExternalLink } from 'lucide-react';
import { SearchResultItem, User as UserType } from '../types';

interface UniversalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: 'chat' | 'memes' | 'fails' | 'notes' | 'settings' | 'dashboard' | 'profile', meta?: any) => void;
  allUsers?: UserType[];
  onOpenUserProfile?: (user: UserType) => void;
}

export default function UniversalSearchModal({ 
  isOpen, 
  onClose, 
  onNavigate,
  allUsers = [],
  onOpenUserProfile,
}: UniversalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
    }
  }, [isOpen]);

  // Instant local user fuzzy search across all loaded classmates & students
  const clientUserResults: SearchResultItem[] = useMemo(() => {
    if (!query.trim() || !allUsers || allUsers.length === 0) return [];
    const cleanQ = query.toLowerCase().trim();
    const keywords = cleanQ.split(/\s+/).filter(Boolean);

    const matches: { user: UserType; score: number }[] = [];

    allUsers.forEach((u) => {
      const name = (u.name || '').toLowerCase();
      const username = (u.username || '').toLowerCase();
      const trNo = (u.trNo || '').toLowerCase();
      const city = (u.city || '').toLowerCase();
      const waras = (u.waras || '').toLowerCase();
      const email = (u.email || '').toLowerCase();
      const bio = (u.bio || '').toLowerCase();

      let score = 0;
      // Direct whole-string match
      if (name.includes(cleanQ)) score += 80;
      if (trNo.includes(cleanQ)) score += 70;
      if (username.includes(cleanQ)) score += 60;
      if (email.includes(cleanQ)) score += 40;
      if (city.includes(cleanQ)) score += 20;
      if (waras.includes(cleanQ)) score += 20;
      if (bio.includes(cleanQ)) score += 15;

      // Individual keyword match
      keywords.forEach((kw) => {
        if (name.includes(kw)) score += 25;
        if (trNo.includes(kw)) score += 25;
        if (username.includes(kw)) score += 20;
      });

      if (score > 0) {
        matches.push({ user: u, score });
      }
    });

    return matches
      .sort((a, b) => b.score - a.score)
      .map(({ user, score }) => ({
        id: user.id || user.username,
        type: 'user' as const,
        title: `${user.name || user.username} (${user.trNo || user.username.toUpperCase()})`,
        subtitle: `${user.waras || 'Student'} • ${user.city || 'Campus'} • Room ${user.roomNo || 'N/A'}`,
        snippet: user.bio || (user.email ? `Email: ${user.email}` : undefined),
        tab: 'profile' as const,
        metadata: {
          user,
          userId: user.id || user.username,
          username: user.username,
          trNo: user.trNo,
        },
        score: score + 120, // Guarantee student profile rank at the top
      }));
  }, [query, allUsers]);

  // Query server API for universal search across notes, memes, fails, messages
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error('Universal search error:', err);
      } finally {
        setIsLoading(false);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [query]);

  // Combine client-side instant user results with server results, deduplicating users
  const mergedResults = useMemo(() => {
    const seenUserIds = new Set<string>();
    const seenUserNames = new Set<string>();
    const combined: SearchResultItem[] = [];

    // 1. Add instant client-side student matches first, deduplicating keys
    clientUserResults.forEach((cr) => {
      const crId = (cr.id || '').toLowerCase();
      const crUsername = (cr.metadata?.username || '').toLowerCase();
      const crTrNo = (cr.metadata?.trNo || '').toLowerCase();
      if ((crId && seenUserIds.has(crId)) || (crUsername && seenUserNames.has(crUsername)) || (crTrNo && seenUserNames.has(crTrNo))) {
        return;
      }
      if (crId) seenUserIds.add(crId);
      if (crUsername) seenUserNames.add(crUsername);
      if (crTrNo) seenUserNames.add(crTrNo);
      combined.push(cr);
    });

    // 2. Add server search results, avoiding duplicate user entries
    results.forEach((sr) => {
      if (sr.type === 'user') {
        const srId = (sr.id || '').toLowerCase();
        const srUsername = (sr.metadata?.username || '').toLowerCase();
        const srTrNo = (sr.metadata?.trNo || '').toLowerCase();
        if (seenUserIds.has(srId) || seenUserNames.has(srUsername) || seenUserNames.has(srTrNo)) {
          return;
        }
        seenUserIds.add(srId);
        if (srUsername) seenUserNames.add(srUsername);
        if (srTrNo) seenUserNames.add(srTrNo);
      }
      combined.push(sr);
    });

    return combined.sort((a, b) => (b.score || 0) - (a.score || 0));
  }, [clientUserResults, results]);

  const filteredResults = useMemo(() => {
    if (selectedType === 'all') return mergedResults;
    return mergedResults.filter(r => r.type === selectedType);
  }, [selectedType, mergedResults]);

  // Reset active keyboard index when results or filter change
  useEffect(() => {
    setActiveIndex(0);
  }, [query, selectedType]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'note': return <BookOpen className="w-4 h-4 text-emerald-500" />;
      case 'meme': return <Laugh className="w-4 h-4 text-purple-500" />;
      case 'fail': return <ShieldAlert className="w-4 h-4 text-amber-500" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-sky-500" />;
      case 'user': return <User className="w-4 h-4 text-indigo-500" />;
      case 'notice': return <Megaphone className="w-4 h-4 text-yellow-500" />;
      default: return <Sparkles className="w-4 h-4 text-primary" />;
    }
  };

  const handleSelect = (item: SearchResultItem) => {
    onClose();

    // If a student / user result is selected, immediately open their profile!
    if (item.type === 'user') {
      const student = 
        item.metadata?.user || 
        allUsers.find((u) => 
          (item.metadata?.userId && u.id === item.metadata.userId) ||
          (item.metadata?.username && u.username?.toLowerCase() === item.metadata.username.toLowerCase()) ||
          (item.metadata?.trNo && u.trNo?.toLowerCase() === item.metadata.trNo.toLowerCase()) ||
          u.id === item.id ||
          u.username?.toLowerCase() === item.id?.toLowerCase()
        ) || {
          id: item.id,
          username: item.metadata?.username || item.id,
          trNo: item.metadata?.trNo || item.id,
          name: item.title.replace(/\s*\(.*?\)\s*/g, '').trim() || item.metadata?.username || item.id,
          email: item.metadata?.user?.email || '',
          phone: item.metadata?.user?.phone || '',
          birthday: item.metadata?.user?.birthday || '',
          waras: item.metadata?.user?.waras || '',
          city: item.metadata?.user?.city || '',
          bio: item.snippet || '',
          roomNo: item.metadata?.user?.roomNo || '',
          role: 'student' as const,
          avatarColor: 'from-indigo-500 to-purple-600',
        };

      if (onOpenUserProfile) {
        onOpenUserProfile(student);
        return;
      }
    }

    onNavigate(item.tab as any, item.metadata);
  };

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setActiveIndex((prev) => (prev + 1) % filteredResults.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (filteredResults.length > 0) {
        setActiveIndex((prev) => (prev - 1 + filteredResults.length) % filteredResults.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredResults.length > 0 && filteredResults[activeIndex]) {
        handleSelect(filteredResults[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      id="universal-search-overlay" 
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-950/60 backdrop-blur-sm"
    >
      <motion.div
        id="universal-search-modal"
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -10 }}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[80vh]"
      >
        {/* Search Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <Search className="w-5 h-5 text-indigo-500 dark:text-indigo-400 shrink-0" />
          <input
            id="universal-search-input"
            ref={inputRef}
            type="text"
            value={query}
            onKeyDown={handleKeyDown}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type student name (e.g. Taher, Mustafa), TR number, notes, memes..."
            className="flex-1 bg-transparent text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-base"
          />
          {isLoading && <Loader2 className="w-4 h-4 text-indigo-500 animate-spin shrink-0" />}
          {query && (
            <button
              id="clear-search-query-btn"
              onClick={() => {
                setQuery('');
                inputRef.current?.focus();
              }}
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            id="close-universal-search-btn"
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/60 dark:border-slate-800/60 flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs">
          {[
            { id: 'all', label: 'All Results' },
            { id: 'user', label: 'Student Profiles' },
            { id: 'note', label: 'Notes' },
            { id: 'meme', label: 'Memes' },
            { id: 'fail', label: 'Failed Words' },
            { id: 'message', label: 'Chat' },
          ].map(f => (
            <button
              key={f.id}
              id={`filter-search-${f.id}`}
              onClick={() => setSelectedType(f.id)}
              className={`px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                selectedType === f.id
                  ? 'bg-indigo-600 text-white font-medium shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-indigo-400/60" />
              <p className="font-medium text-slate-700 dark:text-slate-300">Type any student name to open their profile</p>
              <p className="text-xs text-slate-400 mt-1">Or search notes, memes, failed words, and classroom chat</p>
            </div>
          ) : filteredResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              <p>No results found for &ldquo;{query}&rdquo;</p>
              <p className="text-xs text-slate-400 mt-1">Try another keyword or category filter</p>
            </div>
          ) : (
            filteredResults.map((item, index) => {
              const isUser = item.type === 'user';
              const isSelected = index === activeIndex;

              return (
                <motion.div
                  key={`search-item-${item.type}-${item.id || index}-${index}`}
                  id={`search-result-${item.id || index}`}
                  whileHover={{ scale: 1.003 }}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => handleSelect(item)}
                  className={`p-3 rounded-xl cursor-pointer transition-all border flex items-start gap-3 group ${
                    isSelected
                      ? isUser 
                        ? 'bg-indigo-500/10 dark:bg-indigo-950/40 border-indigo-500/50 shadow-sm' 
                        : 'bg-slate-100 dark:bg-slate-800 border-indigo-500/40'
                      : isUser
                        ? 'bg-indigo-500/[0.03] dark:bg-indigo-950/20 hover:bg-indigo-500/[0.08] dark:hover:bg-indigo-950/30 border-indigo-200/60 dark:border-indigo-900/40'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800/80 border-transparent hover:border-slate-200 dark:hover:border-slate-700/60'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                    isUser
                      ? 'bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500/20'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}>
                    {getIcon(item.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <h4 className={`text-sm font-semibold truncate ${
                          isUser 
                            ? 'text-indigo-950 dark:text-indigo-100 font-bold' 
                            : 'text-slate-900 dark:text-slate-100'
                        }`}>
                          {item.title}
                        </h4>
                        {isUser && (
                          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/70 px-1.5 py-0.5 rounded">
                            Profile
                          </span>
                        )}
                      </div>
                      <span className={`text-[11px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded shrink-0 ${
                        isUser 
                          ? 'text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800/60 flex items-center gap-1'
                          : 'text-slate-400 bg-slate-100 dark:bg-slate-800'
                      }`}>
                        {isUser ? (
                          <>
                            <UserCheck className="w-3 h-3" />
                            <span>Student Profile</span>
                          </>
                        ) : (
                          item.type
                        )}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                      {item.subtitle}
                    </p>
                    {item.snippet && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 bg-slate-50 dark:bg-slate-950/40 p-1.5 rounded-lg border border-slate-100 dark:border-slate-800/40">
                        {item.snippet}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 self-center flex items-center gap-1.5">
                    {isUser && (
                      <span className={`text-[11px] font-medium hidden sm:inline-block transition-opacity ${
                        isSelected ? 'opacity-100 text-indigo-600 dark:text-indigo-400' : 'opacity-0 group-hover:opacity-100 text-slate-400'
                      }`}>
                        Open Profile
                      </span>
                    )}
                    <ArrowRight className={`w-4 h-4 transition-all ${
                      isSelected 
                        ? 'text-indigo-600 dark:text-indigo-400 translate-x-0.5' 
                        : 'text-slate-400 opacity-0 group-hover:opacity-100'
                    }`} />
                  </div>
                </motion.div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
          <span>{filteredResults.length} result{filteredResults.length === 1 ? '' : 's'}</span>
          <div className="flex items-center gap-3">
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">↓</kbd> navigate</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">Enter</kbd> open profile</span>
            <span><kbd className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 text-[10px] font-mono">ESC</kbd> close</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

