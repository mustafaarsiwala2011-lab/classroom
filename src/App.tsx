/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Laugh, BookOpen, Settings, Sparkles, LogOut, BellRing, 
  Menu, X, Compass, Layout, PanelLeftClose, PanelLeftOpen, Columns3, Dock, 
  Search, Sun, Moon, ChevronDown, User as UserIcon, Check, ShieldAlert, Quote,
  Activity, Zap
} from 'lucide-react';
import { User } from './types';
import LoginScreen from './components/LoginScreen';
import DashboardSection from './components/DashboardSection';
import ChatSection from './components/ChatSection';
import MemeMasterSection from './components/MemeMasterSection';
import FailMasterSection from './components/FailMasterSection';
import ClassNotesSection from './components/ClassNotesSection';
import SettingsSection from './components/SettingsSection';
import ProfileSection from './components/ProfileSection';
import UniversalSearchModal from './components/UniversalSearchModal';
import SystemHealthModal from './components/SystemHealthModal';
import MustChangePasswordModal from './components/MustChangePasswordModal';
import ClassmateProfileModal from './components/ClassmateProfileModal';
import { signOutFirebase, auth, onAuthStateChanged, db, updateFirebaseUserProfile } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { fetchUserProfileFromFirestore, sanitizeDocKey, subscribeToAllUsersFromFirestore, ensureUserInFirestore, seedInitialClassmatesToFirestore } from './lib/gatekeeperFirestore';

export type TabType = 'dashboard' | 'chat' | 'memes' | 'fails' | 'notes' | 'profile' | 'settings';
export type LayoutMode = 'sidebar' | 'topbar' | 'floating';

export default function App() {
  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('classroom_theme_mode');
    if (savedTheme) return savedTheme !== 'light';
    return localStorage.getItem('classroom_dark_mode') === 'true';
  });

  // Sync Theme Attributes to Document on Mount & Change
  useEffect(() => {
    const savedTheme = localStorage.getItem('classroom_theme_mode') || (darkMode ? 'dark' : 'light');
    const savedAccent = localStorage.getItem('classroom_theme_accent') || 'indigo';
    const savedDensity = localStorage.getItem('classroom_theme_density') || 'default';
    const savedAmbient = localStorage.getItem('classroom_ambient_aura') !== 'false';
    const savedBlur = localStorage.getItem('classroom_glass_blur') !== 'false';
    const savedContrast = localStorage.getItem('classroom_high_contrast') === 'true';

    document.documentElement.setAttribute('data-theme', savedTheme);
    document.documentElement.setAttribute('data-accent', savedAccent);
    document.documentElement.setAttribute('data-density', savedDensity);
    document.documentElement.setAttribute('data-ambient', String(savedAmbient));
    document.documentElement.setAttribute('data-blur', savedBlur ? 'normal' : 'reduced');
    document.documentElement.setAttribute('data-contrast', savedContrast ? 'high' : 'normal');
  }, [darkMode]);

  // Layout Mode State ('sidebar' | 'topbar' | 'floating')
  const [layoutMode, setLayoutMode] = useState<LayoutMode>(() => {
    const saved = localStorage.getItem('classroom_layout_mode');
    return (saved === 'topbar' || saved === 'floating' || saved === 'sidebar') ? saved : 'sidebar';
  });

  // Collapsed Sidebar State
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('classroom_sidebar_collapsed') === 'true';
  });

  // Mobile Drawer Open State
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  // Active Tab State
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  
  // Track notes subject filter state for dashboard jumps
  const [selectedNotesSubject, setSelectedNotesSubject] = useState<string>('All');

  // Header Dropdown Menus State
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  
  // High-Tech Modals
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [systemHealthModalOpen, setSystemHealthModalOpen] = useState(false);
  const [dismissedPasswordPrompt, setDismissedPasswordPrompt] = useState(false);

  // All Classmates State for universal profile opening and search
  const [allClassmates, setAllClassmates] = useState<User[]>([]);
  const [selectedClassmateModal, setSelectedClassmateModal] = useState<User | null>(null);

  // Logged-in User State
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('classroom_current_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [pendingCount, setPendingCount] = useState<number>(0);

  // Fetch and subscribe to all students for instant universal search & profile viewer
  useEffect(() => {
    // 1. Seed initial baseline classmates to Firestore so they are permanent in the cloud
    seedInitialClassmatesToFirestore().catch(err => console.warn('Roster seed notice:', err));

    // 2. If there is a current user stored locally, ensure they are synced into Firestore
    if (currentUser) {
      ensureUserInFirestore(currentUser).catch(err => console.warn('Current user sync notice:', err));
    }

    const mergeUserList = (base: User[], incoming: any[]): User[] => {
      const unified: User[] = [...base];
      incoming.forEach((fu: any) => {
        if (!fu) return;
        const fuId = (fu.id || '').trim();
        const fuTr = (fu.trNo || fu.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
        const fuUsername = (fu.username || '').toLowerCase().trim();
        const fuEmail = (fu.email || '').toLowerCase().trim();
        const isFuAdmin = fu.role === 'admin' || fu.role === 'superadmin' || fuUsername === 'admin' || fuTr === '28782';

        const idx = unified.findIndex((u: any) => {
          if (fuId && u.id && u.id === fuId) return true;
          const uTr = (u.trNo || u.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
          const uUsername = (u.username || '').toLowerCase().trim();
          const uEmail = (u.email || '').toLowerCase().trim();
          const isUAdmin = u.role === 'admin' || u.role === 'superadmin' || uUsername === 'admin' || uTr === '28782';

          if (isFuAdmin && isUAdmin) return true;
          if (fuUsername && uUsername && fuUsername === uUsername) return true;
          if (fuTr && uTr && fuTr === uTr) return true;
          if (fuEmail && uEmail && fuEmail === uEmail) return true;
          return false;
        });

        if (idx > -1) {
          unified[idx] = { ...unified[idx], ...fu };
        } else {
          unified.push(fu as User);
        }
      });
      return unified;
    };

    const fetchUsers = async () => {
      try {
        const res = await fetch('/api/users');
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.users)) {
            setAllClassmates((prev) => mergeUserList(prev, data.users));
          }
        }
      } catch (err) {
        console.warn('Classmates fetch notice:', err);
      }
    };
    fetchUsers();

    const unsubscribe = subscribeToAllUsersFromFirestore((firestoreUsers) => {
      setAllClassmates((prev) => mergeUserList(prev, firestoreUsers));
    });

    return () => unsubscribe();
  }, []);

  // Apply dark mode CSS classes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('classroom_dark_mode', String(darkMode));
  }, [darkMode]);

  // Persist layout mode
  const handleLayoutModeChange = (mode: LayoutMode) => {
    setLayoutMode(mode);
    localStorage.setItem('classroom_layout_mode', mode);
    setLayoutMenuOpen(false);
  };

  // Toggle sidebar collapse
  const handleToggleSidebarCollapse = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('classroom_sidebar_collapsed', String(next));
      return next;
    });
  };

  // Sync current user to local storage and Firestore when changed
  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem('classroom_current_user', JSON.stringify(user));
    ensureUserInFirestore(user).catch(err => console.warn('Login firestore sync notice:', err));
  };

  const handleLogout = async () => {
    try {
      await signOutFirebase();
    } catch (e) {
      console.warn('Firebase signout note:', e);
    }
    setCurrentUser(null);
    localStorage.removeItem('classroom_current_user');
    setActiveTab('dashboard');
    setUserMenuOpen(false);
  };

  const handleUserUpdate = (updatedUser: User) => {
    setCurrentUser(updatedUser);
    localStorage.setItem('classroom_current_user', JSON.stringify(updatedUser));
    ensureUserInFirestore(updatedUser).catch(err => console.warn('User update sync notice:', err));
    if (updatedUser.name) {
      updateFirebaseUserProfile(updatedUser.name).catch(err => console.warn('Auth displayName sync notice:', err));
    }
  };

  // Sync Firebase Auth state across page reloads and resolve latest roles & permanent name
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const isVerified = fbUser.emailVerified || fbUser.providerData.some(p => p.providerId === 'google.com');
        if (isVerified) {
          let isMeme = false;
          let isFail = false;
          let firestoreName: string | undefined = undefined;
          let firestoreTr: string | undefined = undefined;
          let firestoreAvatarColor: string | undefined = undefined;
          let firestoreRole: string | undefined = undefined;
          let firestorePhotoURL: string | undefined = undefined;

          try {
            const profile = await fetchUserProfileFromFirestore({
              userId: fbUser.uid,
              email: fbUser.email || undefined,
            });
            if (profile) {
              if (profile.name && typeof profile.name === 'string' && profile.name.trim()) {
                firestoreName = profile.name.trim();
              }
              if (profile.trNo) firestoreTr = profile.trNo;
              if (profile.avatarColor) firestoreAvatarColor = profile.avatarColor;
              if (profile.role) firestoreRole = profile.role;
              if (profile.photoURL) firestorePhotoURL = profile.photoURL;
              else if (profile.avatarUrl) firestorePhotoURL = profile.avatarUrl;
              if (profile.isMemeMaster !== undefined) isMeme = Boolean(profile.isMemeMaster);
              if (profile.isFailMaster !== undefined) isFail = Boolean(profile.isFailMaster);
            }
          } catch (_) {}

          // Also inspect localStorage cache for previously saved custom profile
          let cachedName: string | undefined = undefined;
          let cachedTr: string | undefined = undefined;
          let cachedAvatarColor: string | undefined = undefined;
          let cachedRole: string | undefined = undefined;
          let cachedPhotoURL: string | undefined = undefined;
          try {
            const saved = localStorage.getItem('classroom_current_user');
            if (saved) {
              const parsed = JSON.parse(saved);
              if (parsed.name && typeof parsed.name === 'string' && parsed.name.trim() && !parsed.name.includes('@')) {
                cachedName = parsed.name.trim();
              }
              if (parsed.trNo) cachedTr = parsed.trNo;
              if (parsed.avatarColor) cachedAvatarColor = parsed.avatarColor;
              if (parsed.role) cachedRole = parsed.role;
              if (parsed.photoURL) cachedPhotoURL = parsed.photoURL;
              else if (parsed.avatarUrl) cachedPhotoURL = parsed.avatarUrl;
            }
          } catch (_) {}

          setCurrentUser(prev => {
            // Resolve the student's permanent name:
            // 1. Explicitly saved in Firestore
            // 2. Already held in memory if valid
            // 3. Cached in localStorage
            // 4. Firebase Auth displayName
            // 5. Email handle fallback
            const resolvedName = 
              firestoreName || 
              (prev?.name && !prev.name.includes('@') ? prev.name : undefined) || 
              cachedName || 
              (fbUser.displayName && !fbUser.displayName.includes('@') ? fbUser.displayName : undefined) || 
              fbUser.email?.split('@')[0] || 
              'User';

            const resolvedPhoto = 
              firestorePhotoURL || 
              prev?.photoURL || 
              prev?.avatarUrl || 
              cachedPhotoURL || 
              fbUser.photoURL || 
              undefined;

            const updated: User = {
              id: fbUser.uid,
              username: prev?.username || fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
              name: resolvedName,
              email: fbUser.email || prev?.email || '',
              trNo: firestoreTr || prev?.trNo || cachedTr,
              avatarColor: firestoreAvatarColor || prev?.avatarColor || cachedAvatarColor || 'bg-indigo-600',
              photoURL: resolvedPhoto,
              avatarUrl: resolvedPhoto,
              isMemeMaster: isMeme || prev?.isMemeMaster || false,
              isFailMaster: isFail || prev?.isFailMaster || false,
              role: firestoreRole || prev?.role || cachedRole || 'student',
              isApproved: true,
            };
            localStorage.setItem('classroom_current_user', JSON.stringify(updated));
            ensureUserInFirestore(updated).catch(err => console.warn('Auth sync notice:', err));
            return updated;
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time synchronization of currentUser's Profile Name, Avatar, and Master roles
  useEffect(() => {
    if (!currentUser) return;

    const isAdmin =
      currentUser.username?.toLowerCase() === 'admin' ||
      currentUser.username?.toLowerCase()?.includes('28782') ||
      currentUser.role === 'superadmin' ||
      currentUser.role === 'admin' ||
      Boolean(currentUser.email && (
        currentUser.email.toLowerCase() === '28782@jameasaifiyah.edu' ||
        currentUser.email.toLowerCase().includes('28782')
      ));

    if (isAdmin) {
      if (!currentUser.isMemeMaster || !currentUser.isFailMaster) {
        setCurrentUser(prev => prev ? { ...prev, isMemeMaster: true, isFailMaster: true } : null);
      }
    }

    const keysToCheck = [
      currentUser.id,
      currentUser.email,
      currentUser.username,
      currentUser.trNo,
    ].filter(Boolean) as string[];

    const unsubs: (() => void)[] = [];

    keysToCheck.forEach(rawKey => {
      const cleanKey = sanitizeDocKey(rawKey);
      if (!cleanKey) return;
      try {
        const docRef = doc(db, 'users', cleanKey);
        const unsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setCurrentUser(prev => {
              if (!prev) return null;
              let changed = false;
              let newMeme = prev.isMemeMaster;
              let newFail = prev.isFailMaster;
              let newName = prev.name;
              let newAvatarColor = prev.avatarColor;
              let newTr = prev.trNo;

              if (data.name && typeof data.name === 'string' && data.name.trim() && data.name.trim() !== prev.name) {
                newName = data.name.trim();
                changed = true;
              }
              if (data.avatarColor && data.avatarColor !== prev.avatarColor) {
                newAvatarColor = data.avatarColor;
                changed = true;
              }
              if (data.trNo && data.trNo !== prev.trNo) {
                newTr = data.trNo;
                changed = true;
              }
              if (data.isMemeMaster !== undefined && data.isMemeMaster !== prev.isMemeMaster) {
                newMeme = Boolean(data.isMemeMaster);
                changed = true;
              }
              if (data.isFailMaster !== undefined && data.isFailMaster !== prev.isFailMaster) {
                newFail = Boolean(data.isFailMaster);
                changed = true;
              }
              let newPhotoURL = prev.photoURL;
              if (data.photoURL !== undefined && data.photoURL !== prev.photoURL) {
                newPhotoURL = data.photoURL;
                changed = true;
              } else if (data.avatarUrl !== undefined && data.avatarUrl !== prev.avatarUrl) {
                newPhotoURL = data.avatarUrl;
                changed = true;
              }

              let newPhone = prev.phone;
              if (data.phone !== undefined && data.phone !== prev.phone) {
                newPhone = data.phone;
                changed = true;
              }
              let newBirthday = prev.birthday;
              if (data.birthday !== undefined && data.birthday !== prev.birthday) {
                newBirthday = data.birthday;
                changed = true;
              }
              let newWaras = prev.waras;
              if (data.waras !== undefined && data.waras !== prev.waras) {
                newWaras = data.waras;
                changed = true;
              }
              let newCity = prev.city;
              if (data.city !== undefined && data.city !== prev.city) {
                newCity = data.city;
                changed = true;
              }
              let newBio = prev.bio;
              if (data.bio !== undefined && data.bio !== prev.bio) {
                newBio = data.bio;
                changed = true;
              }
              let newRoomNo = prev.roomNo;
              if (data.roomNo !== undefined && data.roomNo !== prev.roomNo) {
                newRoomNo = data.roomNo;
                changed = true;
              }

              if (changed) {
                const nextUser: User = { 
                  ...prev, 
                  name: newName,
                  avatarColor: newAvatarColor,
                  trNo: newTr,
                  photoURL: newPhotoURL,
                  avatarUrl: newPhotoURL,
                  phone: newPhone,
                  birthday: newBirthday,
                  waras: newWaras,
                  city: newCity,
                  bio: newBio,
                  roomNo: newRoomNo,
                  isMemeMaster: newMeme, 
                  isFailMaster: newFail 
                };
                localStorage.setItem('classroom_current_user', JSON.stringify(nextUser));
                return nextUser;
              }
              return prev;
            });
          }
        });
        unsubs.push(unsub);
      } catch (_) {}
    });

    return () => {
      unsubs.forEach(u => u());
    };
  }, [currentUser?.id, currentUser?.email, currentUser?.username, currentUser?.trNo]);

  // Check for pending approval requests if current user is admin
  useEffect(() => {
    const isAdminUser =
      Boolean(currentUser) && (
        currentUser?.username?.toLowerCase() === 'admin' ||
        currentUser?.username?.toLowerCase()?.includes('28782') ||
        currentUser?.role === 'superadmin' ||
        currentUser?.role === 'admin' ||
        (currentUser?.email && (
          currentUser.email.toLowerCase() === '28782@jameasaifiyah.edu' ||
          currentUser.email.toLowerCase().includes('28782')
        )) ||
        (currentUser?.trNo && currentUser.trNo.toLowerCase().includes('28782')) ||
        (currentUser?.id && currentUser.id.toLowerCase().includes('28782'))
      );

    if (!isAdminUser) {
      setPendingCount(0);
      return;
    }

    const fetchPendingCount = async () => {
      try {
        const authId = currentUser?.email || currentUser?.username || '28782@jameasaifiyah.edu';
        const response = await fetch(`/api/users/requests?authorizedBy=${encodeURIComponent(authId)}`);
        if (response.ok) {
          const data = await response.json();
          const pending = (data.requests || []).filter((r: any) => r.status === 'pending');
          setPendingCount(pending.length);
        }
      } catch (e) {
        console.error('Error fetching pending users count:', e);
      }
    };

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 5000);
    return () => clearInterval(interval);
  }, [currentUser, activeTab]);

  // Global Ctrl+K / Cmd+K universal search hotkey
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Screen Orientation & Dynamic Layout State
  const [screenInfo, setScreenInfo] = useState<{
    orientation: 'portrait' | 'landscape';
    isShortHeight: boolean;
    isMobileLandscape: boolean;
    width: number;
    height: number;
  }>(() => {
    if (typeof window === 'undefined') {
      return { orientation: 'landscape', isShortHeight: false, isMobileLandscape: false, width: 1200, height: 800 };
    }
    const w = window.innerWidth;
    const h = window.innerHeight;
    const orientation = w >= h ? 'landscape' : 'portrait';
    const isShortHeight = h <= 580;
    const isMobileLandscape = orientation === 'landscape' && (w < 1024 || isShortHeight);
    return { orientation, isShortHeight, isMobileLandscape, width: w, height: h };
  });

  useEffect(() => {
    const updateOrientation = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const orientation = w >= h ? 'landscape' : 'portrait';
      const isShortHeight = h <= 580;
      const isMobileLandscape = orientation === 'landscape' && (w < 1024 || isShortHeight);

      setScreenInfo({ orientation, isShortHeight, isMobileLandscape, width: w, height: h });

      document.documentElement.setAttribute('data-orientation', orientation);
      document.documentElement.setAttribute('data-screen-format', isMobileLandscape ? 'mobile-landscape' : orientation);
      document.documentElement.setAttribute('data-short-height', isShortHeight ? 'true' : 'false');
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);
    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  // If user is not logged in, render the login card
  if (!currentUser) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  const isMemeMaster = currentUser.isMemeMaster || 
    currentUser.username.toLowerCase() === 'admin' || 
    currentUser.username.toLowerCase() === 'meme master';

  const isFailMaster = currentUser.isFailMaster || 
    currentUser.username.toLowerCase() === 'admin' || 
    currentUser.username.toLowerCase() === 'fail master';

  const handleNavigateToTab = (tab: TabType, subjectFilter: string = 'All') => {
    setSelectedNotesSubject(subjectFilter);
    setActiveTab(tab);
    setMobileDrawerOpen(false);
  };

  // Quick search filter handler
  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickSearchQuery.trim()) return;
    const query = quickSearchQuery.toLowerCase();
    
    if (query.includes('note') || query.includes('subject') || query.includes('nahw') || query.includes('fiqh')) {
      handleNavigateToTab('notes', query.includes('nahw') ? 'Nahw' : query.includes('fiqh') ? 'Fiqh' : 'All');
    } else if (query.includes('chat') || query.includes('message') || query.includes('talk')) {
      handleNavigateToTab('chat');
    } else if (query.includes('meme') || query.includes('fun') || query.includes('joke')) {
      handleNavigateToTab('memes');
    } else if (query.includes('dictionary') || query.includes('404') || query.includes('fail') || query.includes('word') || query.includes('mispronounce') || query.includes('slip') || query.includes('tongue')) {
      handleNavigateToTab('fails');
    } else if (query.includes('setting') || query.includes('password') || query.includes('profile') || query.includes('dark')) {
      handleNavigateToTab('settings');
    } else {
      handleNavigateToTab('dashboard');
    }
    setQuickSearchQuery('');
  };

  // Navigation Items Config
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Compass, color: 'text-indigo-400' },
    { id: 'chat', label: 'Class Chat', icon: MessageSquare, color: 'text-sky-400' },
    { id: 'memes', label: 'Meme Board', icon: Laugh, color: 'text-amber-400' },
    { id: 'fails', label: 'Dictionary error 404', icon: Quote, color: 'text-rose-400' },
    { id: 'notes', label: 'Class Notes', icon: BookOpen, color: 'text-emerald-400' },
    { id: 'profile', label: 'My Profile', icon: UserIcon, color: 'text-violet-400' },
  ];

  const currentTabObj = navItems.find(n => n.id === activeTab) || (
    activeTab === 'settings'
      ? { id: 'settings', label: 'Settings', icon: Settings, color: 'text-slate-400' }
      : navItems[0]
  );
  const CurrentTabIcon = currentTabObj.icon;

  return (
    <div className={`h-dvh min-h-dvh max-h-dvh w-full max-w-[100vw] bg-[#0f172a] glass-background text-slate-100 flex flex-col md:flex-row transition-colors duration-300 relative overflow-hidden pl-safe pr-safe ${screenInfo.isMobileLandscape ? 'pl-14' : ''}`}>
      {/* Decorative Background Shapes */}
      <div className="ambient-glow-shape absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-indigo-600/15 blur-[120px] rounded-full pointer-events-none z-0" />
      <div className="ambient-glow-shape absolute bottom-[-10%] left-[10%] w-[350px] h-[350px] bg-purple-600/15 blur-[100px] rounded-full pointer-events-none z-0" />

      {/* ADAPTIVE LANDSCAPE MINI-RAIL (WHEN PHONE OR TABLET IS IN LANDSCAPE ORIENTATION) */}
      {screenInfo.isMobileLandscape && (
        <aside 
          id="landscape-left-nav-rail"
          className="fixed left-0 top-0 bottom-0 w-14 z-40 bg-slate-950/95 backdrop-blur-2xl border-r border-white/10 flex flex-col items-center justify-between py-2 pt-safe pb-safe select-none shadow-2xl shrink-0"
        >
          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              onClick={() => handleNavigateToTab('dashboard')}
              className="h-8 w-8 rounded-xl bg-indigo-600/30 border border-indigo-500/40 flex items-center justify-center text-sm mb-1 hover:scale-105 transition-transform cursor-pointer"
              title="Classroom Hub"
            >
              🏫
            </button>
            <div className="w-6 h-[1px] bg-white/10 my-0.5" />
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigateToTab(item.id as TabType)}
                  className={`relative p-2 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                  title={item.label}
                  id={`landscape-rail-${item.id}`}
                >
                  <Icon className={`h-4.5 w-4.5 ${isActive ? 'text-white' : item.color}`} />
                  {item.id === 'settings' && pendingCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-amber-500 rounded-full animate-ping" />
                  )}
                  {item.id === 'settings' && pendingCount > 0 && (
                    <span className="absolute top-1 right-1 h-2 w-2 bg-amber-500 rounded-full border border-slate-950" />
                  )}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-1.5 w-full">
            <button
              onClick={() => handleNavigateToTab('settings')}
              className={`p-2 rounded-xl transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Settings & Orientation"
            >
              <Settings className="h-4.5 w-4.5" />
            </button>
            <span
              className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse mt-0.5"
              title="Live Synced Online"
            />
          </div>
        </aside>
      )}
      
      {/* 1. SIDEBAR LAYOUT MODE (DESKTOP) */}
      {!screenInfo.isMobileLandscape && layoutMode === 'sidebar' && (
        <motion.aside 
          initial={false}
          animate={{ width: sidebarCollapsed ? 80 : 256 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="hidden md:flex flex-col glass-sidebar shrink-0 select-none z-20 relative overflow-hidden"
        >
          {/* Workspace Brand Header */}
          <div className="p-5 border-b border-white/8 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <span className="text-2xl shrink-0">🏫</span>
              {!sidebarCollapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="truncate">
                  <h1 className="font-extrabold text-white tracking-tight leading-tight">
                    Classroom Hub
                  </h1>
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block mt-0.5">
                    Cozy Study Club
                  </span>
                </motion.div>
              )}
            </div>

            <button
              onClick={handleToggleSidebarCollapse}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer"
              title={sidebarCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              id="toggle-sidebar-btn"
            >
              {sidebarCollapsed ? <PanelLeftOpen className="h-4.5 w-4.5" /> : <PanelLeftClose className="h-4.5 w-4.5" />}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigateToTab(item.id as TabType)}
                  className={`w-full flex items-center ${sidebarCollapsed ? 'justify-center' : 'justify-between'} px-3.5 py-3 rounded-xl text-sm font-semibold transition-all duration-150 cursor-pointer group relative ${
                    isActive
                      ? 'bg-indigo-600/30 border border-indigo-500/30 text-white shadow-md'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                  id={`nav-${item.id}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div className="flex items-center gap-3 truncate">
                    <Icon className={`h-5 w-5 shrink-0 transition-transform group-hover:scale-110 ${isActive ? 'text-indigo-300' : item.color}`} />
                    {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
                  </div>
                  
                  {!sidebarCollapsed && item.id === 'settings' && pendingCount > 0 && (
                    <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[10px] min-w-5 flex items-center justify-center animate-pulse shadow-md">
                      {pendingCount}
                    </span>
                  )}

                  {sidebarCollapsed && item.id === 'settings' && pendingCount > 0 && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-amber-500 rounded-full animate-ping" />
                  )}
                </button>
              );
            })}
          </nav>
        </motion.aside>
      )}

      {/* MOBILE BACKDROP DRAWER MENU */}
      <AnimatePresence>
        {mobileDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-40 md:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed top-0 bottom-0 left-0 w-72 max-w-[85vw] bg-slate-900 border-r border-white/10 z-50 flex flex-col p-5 pt-safe pb-safe md:hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🏫</span>
                  <div>
                    <h2 className="font-extrabold text-white text-base">Classroom Hub</h2>
                    <span className="text-[10px] text-indigo-400 font-semibold block">Navigation Menu</span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-white bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex-1 py-4 space-y-1.5 overflow-y-auto">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigateToTab(item.id as TabType)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-lg'
                          : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${isActive ? 'text-white' : item.color}`} />
                        <span>{item.label}</span>
                      </div>
                      {item.id === 'settings' && pendingCount > 0 && (
                        <span className="bg-amber-500 text-slate-950 font-bold px-2 py-0.5 rounded-full text-xs animate-pulse">
                          {pendingCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-full bg-gradient-to-tr ${currentUser.avatarColor || 'from-indigo-500 to-indigo-600'} text-white flex items-center justify-center font-bold text-sm uppercase`}>
                    {(currentUser.name || currentUser.username).charAt(0)}
                  </div>
                  <div>
                    <span className="block text-xs font-bold text-white">{currentUser.name || currentUser.username}</span>
                    <span className="text-[10px] text-indigo-400 font-semibold">{isMemeMaster ? '👑 Meme Master' : 'Student'}</span>
                  </div>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-xl"
                  title="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* MAIN VIEWPORT TERMINAL */}
      <main className="flex-1 flex flex-col min-h-0 relative z-10 overflow-hidden">
        
        {/* TOP HEADER CONTROL BAR (ORIENTATION & DEVICE ACCESSIBLE & ALWAYS VISIBLE) */}
        <header 
          id="app-main-header"
          className="app-header-bar sticky top-0 z-50 w-full px-2.5 sm:px-4 py-2 sm:py-2.5 pt-safe shrink-0 flex items-center justify-between gap-1.5 sm:gap-3 select-none relative"
        >
          {/* Subtle bottom accent highlight glow bar */}
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent pointer-events-none" />

          {/* Left Side: Mobile Hamburger & View Breadcrumb */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-shrink">
            <button
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden landscape-force-menu p-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-slate-100 hover:text-white shrink-0 min-h-[38px] min-w-[38px] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
              title="Open Navigation Drawer"
              id="open-navigation-drawer-btn"
              aria-label="Open Navigation Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Current View Title Badge - Always Visible in All Orientations */}
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="header-icon-badge h-8.5 w-8.5 rounded-xl bg-indigo-500/20 border border-indigo-500/35 flex items-center justify-center text-indigo-400 shadow-sm shrink-0">
                <CurrentTabIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex flex-col justify-center">
                <span className="header-brand-title text-[9px] sm:text-[10px] text-indigo-400 font-bold uppercase tracking-wider leading-none truncate block">
                  Classroom Hub
                </span>
                <span className="header-title-text text-xs sm:text-sm font-extrabold text-white tracking-tight leading-tight block truncate max-w-[95px] xs:max-w-[140px] sm:max-w-[200px] lg:max-w-xs mt-0.5">
                  {currentTabObj.label}
                </span>
              </div>
            </div>

            {/* TOP BAR MODE TABS (When LayoutMode === 'topbar' on Large Displays) */}
            {layoutMode === 'topbar' && (
              <div className="hidden lg:flex items-center gap-1 ml-3 pl-3 border-l border-white/10 overflow-x-auto no-scrollbar">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavigateToTab(item.id as TabType)}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer relative shrink-0 ${
                        isActive
                          ? 'bg-indigo-600/30 text-white border border-indigo-500/30'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-indigo-300' : item.color}`} />
                      <span className="landscape-hide-text">{item.label}</span>
                      {isActive && (
                        <motion.div
                          layoutId="topbarTabIndicator"
                          className="absolute inset-0 rounded-xl border border-indigo-400/50 pointer-events-none"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Center: Quick Jump Universal Search Trigger */}
          <button
            id="open-universal-search-header-btn"
            onClick={() => setSearchModalOpen(true)}
            className="hidden lg:flex items-center justify-between flex-1 max-w-[200px] xl:max-w-xs mx-1 sm:mx-2 px-3 py-1.5 bg-slate-950/40 hover:bg-slate-950/60 border border-white/8 hover:border-indigo-500/40 rounded-xl text-xs text-slate-400 hover:text-slate-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="h-3.5 w-3.5 text-indigo-400 group-hover:text-indigo-300 transition-colors shrink-0" />
              <span className="truncate">Search notes, students...</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-sans font-semibold bg-white/10 text-slate-300 rounded border border-white/10 shrink-0">
              ⌘K
            </kbd>
          </button>

          {/* Mobile & Compact Screen Search Icon Trigger */}
          <button
            id="open-universal-search-mobile-btn"
            onClick={() => setSearchModalOpen(true)}
            className="flex lg:hidden p-2 text-slate-300 hover:text-indigo-300 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors cursor-pointer min-h-[38px] min-w-[38px] items-center justify-center shrink-0 shadow-sm"
            title="Search students, notes..."
            aria-label="Universal Search"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Right Side Controls: Layout Switcher, Dark Mode, Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 ml-auto">
            
            {/* Layout Mode Selector Dropdown (Hidden on compact screens/landscape to prevent overflow) */}
            <div className="relative hidden md:block">
              <button
                onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white text-xs font-semibold transition-all cursor-pointer min-h-[38px] shadow-sm"
                title="Change Application Layout"
                id="layout-mode-selector-btn"
              >
                <Layout className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="capitalize hidden lg:inline">{layoutMode}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              <AnimatePresence>
                {layoutMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 max-h-[calc(100dvh-60px)] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-xl"
                  >
                    <span className="block px-3 py-1 text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                      Layout Style
                    </span>
                    <button
                      onClick={() => handleLayoutModeChange('sidebar')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        layoutMode === 'sidebar' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Columns3 className="h-3.5 w-3.5" />
                        <span>Left Sidebar</span>
                      </div>
                      {layoutMode === 'sidebar' && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleLayoutModeChange('topbar')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        layoutMode === 'topbar' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Layout className="h-3.5 w-3.5" />
                        <span>Top Navigation</span>
                      </div>
                      {layoutMode === 'topbar' && <Check className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => handleLayoutModeChange('floating')}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        layoutMode === 'floating' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Dock className="h-3.5 w-3.5" />
                        <span>Floating Dock</span>
                      </div>
                      {layoutMode === 'floating' && <Check className="h-3.5 w-3.5" />}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => {
                const next = !darkMode;
                setDarkMode(next);
                const nextMode = next ? 'dark' : 'light';
                localStorage.setItem('classroom_theme_mode', nextMode);
                localStorage.setItem('classroom_dark_mode', String(next));
                document.documentElement.setAttribute('data-theme', nextMode);
              }}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 hover:text-white transition-all cursor-pointer min-h-[38px] min-w-[38px] flex items-center justify-center shrink-0 shadow-sm"
              title={darkMode ? "Switch to Light Slate Theme" : "Switch to Dark Cosmic Theme"}
              id="theme-toggle-header-btn"
              aria-label="Toggle Theme"
            >
              {darkMode ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-400" />}
            </button>

            {/* User Profile Menu with Permanent Name Display & Visual Online Sync Indicator */}
            <div className="relative shrink-0">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-1.5 sm:gap-2 p-1 pl-1.5 pr-2 sm:pr-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer min-h-[38px] shadow-sm max-w-[140px] xs:max-w-[180px] sm:max-w-[220px] md:max-w-[260px] group"
                id="user-profile-header-btn"
                aria-label={`User Account Menu for ${currentUser.name || currentUser.username}`}
                title={`Signed in as ${currentUser.name || currentUser.username} • Online & Synced`}
              >
                <div className="relative shrink-0">
                  <div className={`h-7 w-7 rounded-full p-[1.5px] bg-gradient-to-tr ${currentUser.photoURL || currentUser.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : (currentUser.avatarColor || 'from-indigo-500 to-indigo-600')} text-white flex items-center justify-center font-bold text-xs uppercase shadow-sm shrink-0 ring-1 ring-white/20 group-hover:scale-105 transition-transform overflow-hidden`}>
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
                        (currentUser.name || currentUser.username).charAt(0)
                      )}
                    </div>
                  </div>
                  {/* Visual 'Online' Status Indicator */}
                  <span
                    className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5"
                    title="Online • Cloud Synced"
                  >
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 ring-2 ring-slate-900"></span>
                  </span>
                </div>
                <div className="flex flex-col text-left truncate">
                  <span className="text-xs font-extrabold text-white header-title-text truncate block max-w-[65px] xs:max-w-[95px] sm:max-w-[130px] md:max-w-[160px]">
                    {currentUser.name || currentUser.username}
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-semibold text-emerald-400 leading-none mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Online</span>
                  </span>
                </div>
                <ChevronDown className="h-3 w-3 text-slate-400 shrink-0 group-hover:text-white transition-colors" />
              </button>

              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-56 max-h-[calc(100dvh-60px)] overflow-y-auto bg-slate-900 border border-white/10 rounded-2xl shadow-2xl p-2 z-50 space-y-1 backdrop-blur-xl"
                  >
                    <div className="px-3 py-2 border-b border-white/8">
                      <div className="flex items-center justify-between">
                        <span className="block text-xs font-bold text-white truncate">{currentUser.name || currentUser.username}</span>
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Online
                        </span>
                      </div>
                      <span className="text-[10px] text-indigo-400 font-semibold uppercase block mt-0.5">
                        TR No: {currentUser.trNo || currentUser.username}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        handleNavigateToTab('profile');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                    >
                      <UserIcon className="h-4 w-4 text-indigo-400" />
                      <span>Edit Profile</span>
                    </button>

                    <button
                      onClick={() => {
                        handleNavigateToTab('settings');
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:bg-white/5 hover:text-white cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <Settings className="h-4 w-4 text-slate-400" />
                        <span>Settings</span>
                      </div>
                      {pendingCount > 0 && (
                        <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-[9px]">
                          {pendingCount}
                        </span>
                      )}
                    </button>

                    <div className="pt-1 border-t border-white/8">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-red-400 hover:bg-red-500/10 cursor-pointer"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* SCROLLABLE VIEW PORT */}
        <div className={`flex-1 min-h-0 overflow-x-hidden ${activeTab === 'chat' ? 'overflow-hidden flex flex-col pb-16 md:pb-0' : `overflow-y-auto ${screenInfo.isMobileLandscape ? 'pb-4' : 'pb-20 md:pb-6'} ${layoutMode === 'floating' ? 'pb-28 md:pb-24' : ''}`}`}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.15 }}
              className="h-full flex flex-col"
            >
              {activeTab === 'dashboard' && (
                <DashboardSection 
                  currentUser={currentUser} 
                  allClassmates={allClassmates}
                  onNavigateToTab={(tab, subject) => handleNavigateToTab(tab, subject)} 
                  onOpenUserProfile={(student) => setSelectedClassmateModal(student)}
                />
              )}
              {activeTab === 'chat' && <ChatSection currentUser={currentUser} />}
              {activeTab === 'memes' && <MemeMasterSection currentUser={currentUser} />}
              {activeTab === 'fails' && <FailMasterSection currentUser={currentUser} />}
              {activeTab === 'notes' && (
                <ClassNotesSection 
                  currentUser={currentUser} 
                  initialSubjectFilter={selectedNotesSubject} 
                />
              )}
              {activeTab === 'profile' && (
                <ProfileSection
                  currentUser={currentUser}
                  onUserUpdate={handleUserUpdate}
                  onNavigateToTab={handleNavigateToTab}
                />
              )}
              {activeTab === 'settings' && (
                <SettingsSection
                  currentUser={currentUser}
                  onLogout={handleLogout}
                  darkMode={darkMode}
                  onToggleDarkMode={() => setDarkMode(!darkMode)}
                  onUserUpdate={handleUserUpdate}
                  layoutMode={layoutMode}
                  onLayoutModeChange={handleLayoutModeChange}
                  onOpenSystemHealth={() => setSystemHealthModalOpen(true)}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 3. FLOATING DOCK MODE (ONLY WHEN FLOATING LAYOUT IS ACTIVE) */}
        {layoutMode === 'floating' && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 max-w-[96vw] w-max select-none pointer-events-auto px-2">
            <motion.nav 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="glass-panel bg-slate-900/90 backdrop-blur-2xl border border-white/15 rounded-full p-1.5 sm:p-2 flex items-center justify-center gap-1 sm:gap-1.5 shadow-2xl shadow-indigo-950/60 max-w-full overflow-x-auto scrollbar-none"
            >
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleNavigateToTab(item.id as TabType)}
                    className={`relative flex items-center justify-center shrink-0 px-2.5 py-2 sm:px-3.5 sm:py-2 rounded-full transition-all duration-200 cursor-pointer group ${
                      isActive 
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 scale-105' 
                        : 'text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    id={`dock-nav-${item.id}`}
                    title={item.label}
                  >
                    <Icon className={`h-4.5 w-4.5 sm:h-5 sm:w-5 ${isActive ? 'text-white' : item.color}`} />
                    <span className="hidden xl:inline-block text-xs font-bold ml-2 whitespace-nowrap">
                      {item.label}
                    </span>

                    {item.id === 'settings' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-500 rounded-full animate-ping" />
                    )}
                    {item.id === 'settings' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 bg-amber-500 rounded-full shadow border border-slate-900" />
                    )}

                    {isActive && (
                      <motion.div
                        layoutId="dockActiveTab"
                        className="absolute -bottom-1 h-1 w-4 rounded-full bg-indigo-400"
                        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      />
                    )}
                  </button>
                );
              })}
            </motion.nav>
          </div>
        )}

        {/* MOBILE BOTTOM NAVIGATION DOCK (RESPONSIVE TOUCH-FRIENDLY IN PORTRAIT ORIENTATION) */}
        {!screenInfo.isMobileLandscape && (
          <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/92 backdrop-blur-2xl border-t border-white/10 pb-safe shadow-2xl flex items-center justify-around px-1 py-1 select-none">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigateToTab(item.id as TabType)}
                  className={`flex-1 min-w-0 min-h-[38px] sm:min-h-[44px] py-1 px-0.5 flex flex-col items-center justify-center rounded-xl transition-all relative cursor-pointer ${
                    isActive ? 'text-indigo-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  id={`mobile-bottom-nav-${item.id}`}
                >
                  <div className="relative">
                    <Icon className={`h-4.5 w-4.5 transition-transform ${isActive ? 'scale-110 text-indigo-400' : item.color}`} />
                    {item.id === 'settings' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-2 h-2 w-2 bg-amber-500 rounded-full animate-ping" />
                    )}
                    {item.id === 'settings' && pendingCount > 0 && (
                      <span className="absolute -top-1 -right-2 h-2 w-2 bg-amber-500 rounded-full border border-slate-950" />
                    )}
                  </div>
                  <span className="text-[9px] tracking-tight truncate max-w-[50px] mt-0.5 font-medium leading-none">
                    {item.label}
                  </span>
                  {isActive && (
                    <span className="w-1 h-1 rounded-full bg-indigo-400 mt-0.5" />
                  )}
                </button>
              );
            })}
          </nav>
        )}

      </main>

      {/* High-Tech Universal Search Modal */}
      <UniversalSearchModal
        isOpen={searchModalOpen}
        onClose={() => setSearchModalOpen(false)}
        allUsers={allClassmates}
        onOpenUserProfile={(student) => {
          setSelectedClassmateModal(student);
        }}
        onNavigate={(tab, meta) => {
          if (tab === 'profile' && (meta?.user || meta?.userId)) {
            const student = 
              meta?.user || 
              allClassmates.find(u => 
                (meta?.userId && u.id === meta.userId) ||
                (meta?.username && u.username?.toLowerCase() === meta.username.toLowerCase()) ||
                (meta?.trNo && u.trNo?.toLowerCase() === meta.trNo.toLowerCase())
              );
            if (student) {
              setSelectedClassmateModal(student);
              return;
            }
          }
          handleNavigateToTab(tab as TabType);
          if (meta?.subject) {
            setSelectedNotesSubject(meta.subject);
          }
        }}
      />

      {/* Classmate Profile Details Modal triggered from Universal Search or Deep Links */}
      {currentUser && (
        <ClassmateProfileModal
          isOpen={!!selectedClassmateModal}
          onClose={() => setSelectedClassmateModal(null)}
          student={selectedClassmateModal}
          currentUser={currentUser}
          onRoleUpdated={(studentId, newRoles) => {
            setSelectedClassmateModal(prev => prev ? { ...prev, ...newRoles } : null);
            setAllClassmates(prev =>
              prev.map(c => (c.id === studentId || c.username === studentId ? { ...c, ...newRoles } : c))
            );
          }}
          onOpenDirectChat={(username) => {
            setSelectedClassmateModal(null);
            handleNavigateToTab('chat');
          }}
        />
      )}

      {/* High-Tech System Health & Diagnostics Modal */}
      <SystemHealthModal
        isOpen={systemHealthModalOpen}
        onClose={() => setSystemHealthModalOpen(false)}
        currentUser={currentUser}
      />

      {/* Change Temporary Password Prompt for new/student logins */}
      {currentUser && 
       currentUser.hasChangedDefaultPassword === false && 
       currentUser.role !== 'superadmin' && 
       currentUser.username.toLowerCase() !== 'admin' && 
       !currentUser.username.includes('28782') && 
       !dismissedPasswordPrompt && (
        <MustChangePasswordModal
          currentUser={currentUser}
          onPasswordChanged={(updatedUser) => {
            handleUserUpdate(updatedUser);
            setDismissedPasswordPrompt(true);
          }}
          onDismiss={() => setDismissedPasswordPrompt(true)}
        />
      )}
    </div>
  );
}

