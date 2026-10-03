/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  User, Mail, Phone, Calendar, MapPin, Home, GraduationCap, 
  CheckCircle2, AlertCircle, X, Cloud, RefreshCw, 
  Sparkles, Shield, Award, BookOpen, Clock, 
  Search, Filter, Eye, Edit3, MessageCircle, ExternalLink, 
  Users, Palette, Camera, Upload, Trash2, Link as LinkIcon, Image as ImageIcon, Check
} from 'lucide-react';
import { User as UserType } from '../types';
import { auth, updateFirebaseUserProfile } from '../lib/firebase';
import { 
  syncUserProfileToFirestore, 
  fetchUserProfileFromFirestore, 
  subscribeToAllUsersFromFirestore,
  fetchAllUsersFromFirestore 
} from '../lib/gatekeeperFirestore';
import ClassmateProfileModal from './ClassmateProfileModal';

interface ProfileSectionProps {
  currentUser: UserType;
  onUserUpdate: (updatedUser: UserType) => void;
  onNavigateToTab?: (tab: string) => void;
}

/**
 * Client-side 1:1 square crop & compression for Instagram-style DP.
 * Keeps photos sharp and lightweight (~40-90kb) to ensure fast loading and zero Firestore quota issues.
 */
function processProfilePhoto(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      return reject(new Error('Please select an image file (JPG, PNG, WebP)'));
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new window.Image();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.onload = () => {
        const size = Math.min(img.width, img.height);
        const startX = (img.width - size) / 2;
        const startY = (img.height - size) / 2;

        const targetSize = Math.min(size, 512); // High-res 512x512 DP
        const canvas = document.createElement('canvas');
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(e.target?.result as string);
        }
        ctx.drawImage(img, startX, startY, size, size, 0, 0, targetSize, targetSize);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
}

const AVATAR_COLORS = [
  { name: 'Indigo Cosmic', value: 'from-indigo-500 to-purple-600', ring: 'ring-indigo-400' },
  { name: 'Emerald Oasis', value: 'from-emerald-500 to-teal-600', ring: 'ring-emerald-400' },
  { name: 'Amber Glow', value: 'from-amber-500 to-orange-600', ring: 'ring-amber-400' },
  { name: 'Rose Blossom', value: 'from-rose-500 to-pink-600', ring: 'ring-rose-400' },
  { name: 'Cyan Wave', value: 'from-cyan-500 to-blue-600', ring: 'ring-cyan-400' },
  { name: 'Royal Violet', value: 'from-purple-600 to-indigo-700', ring: 'ring-purple-400' },
  { name: 'Crimson Sunset', value: 'from-red-500 to-rose-700', ring: 'ring-red-400' },
  { name: 'Golden Sun', value: 'from-yellow-400 via-amber-500 to-orange-600', ring: 'ring-amber-400' },
  { name: 'Ocean Depth', value: 'from-blue-600 to-cyan-700', ring: 'ring-blue-400' },
  { name: 'Neon Forest', value: 'from-emerald-400 to-cyan-600', ring: 'ring-emerald-400' },
  { name: 'Mystic Amethyst', value: 'from-fuchsia-600 to-pink-600', ring: 'ring-fuchsia-400' },
  { name: 'Obsidian Slate', value: 'from-slate-700 to-slate-900', ring: 'ring-slate-400' },
];

export default function ProfileSection({
  currentUser,
  onUserUpdate,
  onNavigateToTab,
}: ProfileSectionProps) {
  // Navigation sub-tab: 'edit' or 'directory'
  const [activeSubTab, setActiveSubTab] = useState<'edit' | 'directory'>('edit');

  // Target student being edited (null = currentUser, or student object if admin is editing another student)
  const [targetStudent, setTargetStudent] = useState<UserType | null>(null);

  // Form fields
  const [name, setName] = useState(currentUser?.name || currentUser?.username || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [birthday, setBirthday] = useState(currentUser?.birthday || '');
  const [waras, setWaras] = useState(currentUser?.waras || '');
  const [city, setCity] = useState(currentUser?.city || '');
  const [roomNo, setRoomNo] = useState(currentUser?.roomNo || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [selectedAvatarColor, setSelectedAvatarColor] = useState(currentUser?.avatarColor || AVATAR_COLORS[0].value);
  const [studentTrNo, setStudentTrNo] = useState(currentUser?.trNo || currentUser?.username || '');
  const [photoURL, setPhotoURL] = useState(currentUser?.photoURL || currentUser?.avatarUrl || '');
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInputValue, setUrlInputValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status & Notice states
  const [saving, setSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [lastCloudSync, setLastCloudSync] = useState<string | null>(null);
  const [isCloudSynced, setIsCloudSynced] = useState<boolean>(true);

  // Classmates Directory state
  const [allClassmates, setAllClassmates] = useState<UserType[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWarasFilter, setSelectedWarasFilter] = useState('All');
  const [selectedModalStudent, setSelectedModalStudent] = useState<UserType | null>(null);

  const isAdmin = currentUser?.role === 'superadmin' || 
    currentUser?.username?.toLowerCase() === 'admin' || 
    currentUser?.username?.includes('28782') ||
    currentUser?.trNo?.includes('28782') ||
    currentUser?.email?.includes('28782');

  // Derive signed-in email address across Google / TR accounts
  const signedInEmail =
    (targetStudent?.email || currentUser?.email) ||
    auth.currentUser?.email ||
    (currentUser?.username?.toLowerCase() === 'admin'
      ? '28782@jameasaifiyah.edu'
      : currentUser?.username?.includes('@')
        ? currentUser.username
        : currentUser?.username
          ? `${currentUser.username.toLowerCase()}@jameasaifiyah.edu`
          : currentUser?.trNo
            ? `${currentUser.trNo.toLowerCase()}@jameasaifiyah.edu`
            : 'student@jameasaifiyah.edu');

  // Load and populate fields when targetStudent or currentUser changes
  useEffect(() => {
    const student = targetStudent || currentUser;
    if (!student) return;
    setName(student.name || student.username || '');
    setPhone(student.phone || '');
    setBirthday(student.birthday || '');
    setWaras(student.waras || '');
    setCity(student.city || '');
    setRoomNo(student.roomNo || '');
    setBio(student.bio || '');
    setStudentTrNo(student.trNo || student.username || '');
    setPhotoURL(student.photoURL || student.avatarUrl || '');
    if (student.avatarColor) setSelectedAvatarColor(student.avatarColor);
  }, [targetStudent, currentUser]);

  // Load latest Firestore record on mount and listen to live Firestore updates
  useEffect(() => {
    async function loadRemoteProfile() {
      try {
        const cloudData = await fetchUserProfileFromFirestore({
          userId: currentUser.id,
          email: signedInEmail,
          username: currentUser.username,
          trNo: currentUser.trNo,
        });

        if (cloudData) {
          setIsCloudSynced(true);
          if (cloudData.updatedAt) setLastCloudSync(cloudData.updatedAt);
          if (!targetStudent) {
            if (cloudData.name && !currentUser.name) setName(cloudData.name);
            if (cloudData.phone && !currentUser.phone) setPhone(cloudData.phone);
            if (cloudData.birthday && !currentUser.birthday) setBirthday(cloudData.birthday);
            if (cloudData.waras && !currentUser.waras) setWaras(cloudData.waras);
            if (cloudData.city && !currentUser.city) setCity(cloudData.city);
            if (cloudData.bio && !currentUser.bio) setBio(cloudData.bio);
            if (cloudData.roomNo && !currentUser.roomNo) setRoomNo(cloudData.roomNo);
            if (cloudData.avatarColor) setSelectedAvatarColor(cloudData.avatarColor);
            if ((cloudData.photoURL || cloudData.avatarUrl) && !currentUser.photoURL) {
              setPhotoURL(cloudData.photoURL || cloudData.avatarUrl);
            }
          }
        }
      } catch (err) {
        console.warn('Firestore initial fetch notice:', err);
      }
    }

    loadRemoteProfile();

    // Initial fetch of all users from both backend and cloud Firestore
    const fetchAllUsers = async () => {
      try {
        const [apiResult, firestoreResult] = await Promise.allSettled([
          fetch('/api/users').then((r) => (r.ok ? r.json() : null)),
          fetchAllUsersFromFirestore(),
        ]);

        const apiUsers: UserType[] =
          apiResult.status === 'fulfilled' && apiResult.value?.users && Array.isArray(apiResult.value.users)
            ? apiResult.value.users
            : [];

        const firestoreUsers: UserType[] =
          firestoreResult.status === 'fulfilled' && Array.isArray(firestoreResult.value)
            ? (firestoreResult.value as UserType[])
            : [];

        // Helper to thoroughly deduplicate and merge student records by id, username, trNo, email, or admin status
        const mergeStudentRecords = (baseList: UserType[], incoming: UserType[]): UserType[] => {
          const unified: UserType[] = [];

          const addStudent = (item: UserType) => {
            if (!item) return;
            const itemId = (item.id || '').trim();
            const normTr = (item.trNo || item.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
            const normName = (item.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
            const email = (item.email || '').toLowerCase().trim();
            const itemUsername = (item.username || '').toLowerCase().trim();

            const isItemAdmin = 
              item.role === 'admin' || 
              item.role === 'superadmin' || 
              itemUsername === 'admin' || 
              normTr === '28782' || 
              email.startsWith('28782@');

            const exIdx = unified.findIndex((ex) => {
              // 1. Strict ID equality (e.g. user_1 === user_1)
              if (itemId && ex.id && itemId === ex.id) return true;

              const exTr = (ex.trNo || ex.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
              const exEmail = (ex.email || '').toLowerCase().trim();
              const exUsername = (ex.username || '').toLowerCase().trim();

              // 2. Both are admin / 28782 -> merge into one administrator record
              const isExAdmin = 
                ex.role === 'admin' || 
                ex.role === 'superadmin' || 
                exUsername === 'admin' || 
                exTr === '28782' || 
                exEmail.startsWith('28782@');
              if (isItemAdmin && isExAdmin) return true;

              // 3. Username equality
              if (itemUsername && exUsername && itemUsername === exUsername) return true;

              // 4. TR number equality
              if (normTr && exTr && normTr === exTr) return true;

              // 5. Email equality
              if (email && exEmail && email === exEmail) return true;

              // 6. Cross email-TR equality
              if (normTr && exEmail && exEmail.startsWith(normTr.toLowerCase() + '@')) return true;
              if (exTr && email && email.startsWith(exTr.toLowerCase() + '@')) return true;

              // 7. Distinct name match
              const exName = (ex.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
              if (normName && exName && normName.length > 2 && normName === exName) return true;

              return false;
            });

            if (exIdx > -1) {
              const ex = unified[exIdx];
              const isNum = (s?: string) => Boolean(s && !isNaN(Number(s.trim())));
              const bestName = (item.name && !isNum(item.name)) ? item.name : (ex.name && !isNum(ex.name) ? ex.name : (item.name || ex.name));
              unified[exIdx] = {
                ...ex,
                ...item,
                id: ex.id || item.id,
                name: bestName,
                trNo: (item.trNo && item.trNo.trim()) || ex.trNo,
                email: (item.email && item.email.trim()) || ex.email,
                phone: (item.phone && String(item.phone).trim()) || ex.phone,
                birthday: (item.birthday && String(item.birthday).trim()) || ex.birthday,
                waras: (item.waras && String(item.waras).trim()) || ex.waras,
                city: (item.city && String(item.city).trim()) || ex.city,
                bio: (item.bio && String(item.bio).trim()) || ex.bio,
                roomNo: (item.roomNo && String(item.roomNo).trim()) || ex.roomNo,
                avatarColor: item.avatarColor || ex.avatarColor,
                avatarInitials: item.avatarInitials || ex.avatarInitials,
                photoURL: item.photoURL || item.avatarUrl || ex.photoURL || ex.avatarUrl,
                avatarUrl: item.avatarUrl || item.photoURL || ex.avatarUrl || ex.photoURL,
                isMemeMaster: Boolean(ex.isMemeMaster || item.isMemeMaster),
                isFailMaster: Boolean(ex.isFailMaster || item.isFailMaster),
                isApproved: ex.isApproved === true || item.isApproved === true,
                role: isItemAdmin || ex.role === 'admin' ? 'admin' : (item.role || ex.role || 'student'),
              };
            } else {
              unified.push({ ...item });
            }
          };

          baseList.forEach(addStudent);
          incoming.forEach(addStudent);
          return unified;
        };

        setAllClassmates((prev) => {
          let merged = mergeStudentRecords(prev, apiUsers);
          merged = mergeStudentRecords(merged, firestoreUsers);
          return merged;
        });
      } catch (err) {
        console.warn('API/Firestore users fetch notice:', err);
      }
    };
    fetchAllUsers();

    // REAL-TIME FIRESTORE SUBSCRIPTION:
    // When ANY user updates their profile or registers, this snapshot fires immediately for all users
    const unsubscribe = subscribeToAllUsersFromFirestore((firestoreUsers) => {
      setAllClassmates((prev) => {
        const incoming = (firestoreUsers as UserType[]) || [];
        const unified: UserType[] = [];

        const addStudent = (item: UserType) => {
          if (!item) return;
          const itemId = (item.id || '').trim();
          const normTr = (item.trNo || item.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
          const normName = (item.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          const email = (item.email || '').toLowerCase().trim();
          const itemUsername = (item.username || '').toLowerCase().trim();

          const isItemAdmin = 
            item.role === 'admin' || 
            item.role === 'superadmin' || 
            itemUsername === 'admin' || 
            normTr === '28782' || 
            email.startsWith('28782@');

          const exIdx = unified.findIndex((ex) => {
            if (itemId && ex.id && itemId === ex.id) return true;
            const exTr = (ex.trNo || ex.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
            const exEmail = (ex.email || '').toLowerCase().trim();
            const exUsername = (ex.username || '').toLowerCase().trim();

            const isExAdmin = 
              ex.role === 'admin' || 
              ex.role === 'superadmin' || 
              exUsername === 'admin' || 
              exTr === '28782' || 
              exEmail.startsWith('28782@');
            if (isItemAdmin && isExAdmin) return true;

            if (itemUsername && exUsername && itemUsername === exUsername) return true;
            if (normTr && exTr && normTr === exTr) return true;
            if (email && exEmail && email === exEmail) return true;
            if (normTr && exEmail && exEmail.startsWith(normTr.toLowerCase() + '@')) return true;
            if (exTr && email && email.startsWith(exTr.toLowerCase() + '@')) return true;

            const exName = (ex.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
            if (normName && exName && normName.length > 2 && normName === exName) return true;
            return false;
          });

          if (exIdx > -1) {
            const ex = unified[exIdx];
            const isNum = (s?: string) => Boolean(s && !isNaN(Number(s.trim())));
            const bestName = (item.name && !isNum(item.name)) ? item.name : (ex.name && !isNum(ex.name) ? ex.name : (item.name || ex.name));
            unified[exIdx] = {
              ...ex,
              ...item,
              id: ex.id || item.id,
              name: bestName,
              trNo: (item.trNo && item.trNo.trim()) || ex.trNo,
              email: (item.email && item.email.trim()) || ex.email,
              phone: (item.phone && String(item.phone).trim()) || ex.phone,
              birthday: (item.birthday && String(item.birthday).trim()) || ex.birthday,
              waras: (item.waras && String(item.waras).trim()) || ex.waras,
              city: (item.city && String(item.city).trim()) || ex.city,
              bio: (item.bio && String(item.bio).trim()) || ex.bio,
              roomNo: (item.roomNo && String(item.roomNo).trim()) || ex.roomNo,
              avatarColor: item.avatarColor || ex.avatarColor,
              avatarInitials: item.avatarInitials || ex.avatarInitials,
              photoURL: item.photoURL || item.avatarUrl || ex.photoURL || ex.avatarUrl,
              avatarUrl: item.avatarUrl || item.photoURL || ex.avatarUrl || ex.photoURL,
              isMemeMaster: Boolean(ex.isMemeMaster || item.isMemeMaster),
              isFailMaster: Boolean(ex.isFailMaster || item.isFailMaster),
              isApproved: ex.isApproved === true || item.isApproved === true,
              role: isItemAdmin || ex.role === 'admin' ? 'admin' : (item.role || ex.role || 'student'),
            };
          } else {
            unified.push({ ...item });
          }
        };

        prev.forEach(addStudent);
        incoming.forEach(addStudent);
        return unified;
      });
    });

    return () => unsubscribe();
  }, [currentUser, signedInEmail, targetStudent]);

  // Handle local photo file upload & compression
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setIsProcessingPhoto(true);
      setProfileError(null);
      const compressedDataUrl = await processProfilePhoto(file);
      setPhotoURL(compressedDataUrl);
      setProfileSuccess('Photo loaded! Remember to click "Save & Sync to Firebase" below to confirm changes across all devices.');
    } catch (err: any) {
      setProfileError(err.message || 'Failed to process selected image');
    } finally {
      setIsProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Save Profile & Firestore Sync
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);

    const activeTarget = targetStudent || currentUser;

    if (!name.trim()) {
      setProfileError('Real display name is required so teachers and classmates can identify you.');
      return;
    }

    setSaving(true);

    try {
      const payload = {
        id: activeTarget.id,
        username: activeTarget.username,
        trNo: studentTrNo.trim() || activeTarget.trNo || activeTarget.username,
        email: activeTarget.email || signedInEmail,
        name: name.trim(),
        phone: phone.trim(),
        birthday: birthday.trim(),
        waras: waras.trim(),
        city: city.trim(),
        bio: bio.trim(),
        roomNo: roomNo.trim(),
        avatarColor: selectedAvatarColor,
        role: activeTarget.role,
        photoURL: photoURL.trim(),
        avatarUrl: photoURL.trim(),
      };

      // 1. Direct Firestore Persistence
      const firestoreResult = await syncUserProfileToFirestore(payload);

      if (firestoreResult.timestamp) {
        setLastCloudSync(firestoreResult.timestamp);
        setIsCloudSynced(true);
      }

      // 2. Server Application Cache & Database Update
      const response = await fetch('/api/users/update-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: activeTarget.id,
          targetUsername: activeTarget.username,
          name: name.trim(),
          phone: phone.trim(),
          birthday: birthday.trim(),
          waras: waras.trim(),
          city: city.trim(),
          bio: bio.trim(),
          roomNo: roomNo.trim(),
          avatarColor: selectedAvatarColor,
          photoURL: photoURL.trim(),
          avatarUrl: photoURL.trim(),
          trNo: studentTrNo.trim() || activeTarget.trNo,
          authorizedBy: currentUser.username,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile repository');
      }

      const updatedUser: UserType = {
        ...activeTarget,
        ...data.user,
        name: name.trim(),
        phone: phone.trim(),
        birthday: birthday.trim(),
        waras: waras.trim(),
        city: city.trim(),
        bio: bio.trim(),
        roomNo: roomNo.trim(),
        avatarColor: selectedAvatarColor,
        photoURL: photoURL.trim(),
        avatarUrl: photoURL.trim(),
        trNo: studentTrNo.trim() || activeTarget.trNo,
      };

      // Update local allClassmates state immediately with TR/Name unification
      setAllClassmates((prev) => {
        const next = [...prev];
        const normTr = (updatedUser.trNo || updatedUser.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
        const normName = (updatedUser.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        const email = (updatedUser.email || '').toLowerCase().trim();

        const idx = next.findIndex((u) => {
          if (updatedUser.id && u.id === updatedUser.id) return true;
          const uTr = (u.trNo || u.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
          if (normTr && uTr && normTr === uTr) return true;
          if (email && u.email && u.email.toLowerCase().trim() === email) return true;
          if (normTr && u.email && u.email.toLowerCase().startsWith(normTr.toLowerCase() + '@')) return true;
          const uName = (u.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
          if (normName && uName && normName.length > 2 && normName === uName) return true;
          return false;
        });

        if (idx !== -1) {
          next[idx] = { ...next[idx], ...updatedUser };
        } else {
          next.push(updatedUser);
        }
        return next;
      });

      // If updating own profile, update global current user state, auth profile, and storage
      if (!targetStudent) {
        try {
          await updateFirebaseUserProfile(name.trim(), photoURL.trim());
        } catch (authErr) {
          console.warn('Firebase Auth profile update warning:', authErr);
        }
        localStorage.setItem('classroom_current_user', JSON.stringify(updatedUser));
        onUserUpdate(updatedUser);
      }

      setProfileSuccess(
        targetStudent
          ? `Profile for ${name.trim()} (TR: ${studentTrNo.trim()}) updated permanently and synchronized with Firebase Firestore!`
          : `Name updated to "${name.trim()}"! Your profile has been permanently saved to Firebase Firestore and is visible in the header and across all classroom features!`
      );
    } catch (err: any) {
      setProfileError(err.message || 'Error occurred saving profile details.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered Classmates list for Directory
  const filteredClassmates = useMemo(() => {
    return allClassmates.filter((student) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        (student.name || '').toLowerCase().includes(q) ||
        (student.username || '').toLowerCase().includes(q) ||
        (student.trNo || '').toLowerCase().includes(q) ||
        (student.city || '').toLowerCase().includes(q) ||
        (student.waras || '').toLowerCase().includes(q) ||
        (student.roomNo || '').toLowerCase().includes(q) ||
        (student.bio || '').toLowerCase().includes(q);

      const matchesWaras =
        selectedWarasFilter === 'All' ||
        (student.waras || '').toLowerCase().includes(selectedWarasFilter.toLowerCase());

      return matchesSearch && matchesWaras;
    });
  }, [allClassmates, searchQuery, selectedWarasFilter]);

  // Unique waras options for filtering
  const warasOptions = useMemo(() => {
    const list = Array.from(
      new Set(
        allClassmates
          .map((u) => u.waras)
          .filter((w): w is string => !!w && w.trim().length > 0)
      )
    );
    return ['All', ...list];
  }, [allClassmates]);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-5" id="profile-page-root">
      {/* 1. NOTIFICATIONS & ALERTS */}
      {profileSuccess && (
        <div 
          id="profile-success-banner"
          className="flex items-start justify-between gap-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-3.5 text-xs rounded-xl shadow-md backdrop-blur-md transition-all"
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold text-emerald-200">Profile Updated & Synchronized</p>
              <p className="text-emerald-300/90">{profileSuccess}</p>
              {lastCloudSync && (
                <p className="text-[10px] text-emerald-400/80 font-mono pt-0.5">
                  Firestore Key: {targetStudent ? targetStudent.id : currentUser.id} • {new Date(lastCloudSync).toLocaleTimeString()}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProfileSuccess(null)}
            className="text-emerald-400 hover:text-emerald-200 p-1 rounded-md hover:bg-emerald-500/20 transition-colors cursor-pointer shrink-0"
            title="Dismiss message"
            id="dismiss-success-banner-btn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {profileError && (
        <div 
          id="profile-error-banner"
          className="flex items-start justify-between gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-300 p-3.5 text-xs rounded-xl shadow-md backdrop-blur-md transition-all"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <p className="font-semibold text-rose-200">Profile Notice</p>
              <p className="text-rose-300/90">{profileError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setProfileError(null)}
            className="text-rose-400 hover:text-rose-200 p-1 rounded-md hover:bg-rose-500/20 transition-colors cursor-pointer shrink-0"
            title="Dismiss notice"
            id="dismiss-error-banner-btn"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Target student admin alert */}
      {targetStudent && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-amber-400 shrink-0" />
            <span>
              Admin Editing: <strong>{targetStudent.name || targetStudent.username}</strong> (TR: {targetStudent.trNo || targetStudent.username})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setTargetStudent(null)}
            className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-[11px] font-semibold transition-colors cursor-pointer"
          >
            Return to My Profile
          </button>
        </div>
      )}

      {/* 2. UNIFIED STUDENT PROFILE: EDIT DIRECTLY IN THE PROFILE */}
      {activeSubTab === 'edit' ? (
        <div className="max-w-4xl mx-auto" id="live-identity-column">
          <form onSubmit={handleSaveProfile}>
            <div 
              className="glass-panel rounded-3xl p-5 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden space-y-6" 
              id="live-identity-card"
            >
              {/* Decorative background glow */}
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-indigo-600/15 blur-[80px] rounded-full pointer-events-none" />

              {/* Institution Header Strip */}
              <div className="bg-gradient-to-r from-indigo-950/90 via-slate-900/90 to-purple-950/90 -mx-5 -mt-5 sm:-mx-8 sm:-mt-8 px-5 sm:px-7 py-3 border-b border-white/10 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <GraduationCap className="h-5 w-5 text-indigo-400 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold text-slate-200 tracking-wider uppercase font-mono truncate">
                    Al Jamea tus Saifiyah
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveSubTab('directory')}
                    className="px-3 py-1 bg-white/10 hover:bg-white/15 text-indigo-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Users className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Directory</span>
                    <span className="text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full font-mono">{allClassmates.length}</span>
                  </button>
                  <span className="text-[10px] sm:text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1 font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verified
                  </span>
                </div>
              </div>

              {/* Student Identity Hero Showcase & Direct Editing */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-2">
                {/* Avatar with Instagram-style DP showcase */}
                <div className="flex flex-col items-center gap-2 shrink-0 self-center sm:self-auto">
                  {/* Selected target element: Instagram DP circle with gradient ring & camera trigger */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`h-24 w-24 sm:h-28 sm:w-28 rounded-full p-[3px] bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 shadow-xl shadow-rose-950/40 relative cursor-pointer group/dp transition-transform duration-200 hover:scale-105 active:scale-95`}
                    title="Click to change your photo (Instagram-style DP)"
                    id="profile-dp-container"
                  >
                    {/* Inner circular wrapper */}
                    <div className="h-full w-full rounded-full bg-slate-950 p-[2.5px] overflow-hidden flex items-center justify-center relative">
                      {photoURL ? (
                        <img
                          src={photoURL}
                          alt={name || 'Student DP'}
                          className="h-full w-full object-cover rounded-full transition-transform duration-300 group-hover/dp:scale-110"
                        />
                      ) : (
                        <div className={`h-full w-full rounded-full bg-gradient-to-tr ${selectedAvatarColor} flex items-center justify-center shadow-inner`}>
                          <span className="text-3xl sm:text-4xl font-black text-white uppercase tracking-wider select-none">
                            {(name || currentUser?.name || currentUser?.username || currentUser?.trNo || 'ST').slice(0, 2)}
                          </span>
                        </div>
                      )}

                      {/* Hover Camera Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/dp:opacity-100 flex flex-col items-center justify-center gap-1 text-white transition-opacity duration-200 rounded-full backdrop-blur-[2px]">
                        <Camera className="h-6 w-6 text-white drop-shadow" />
                        <span className="text-[10px] font-bold tracking-tight">
                          {isProcessingPhoto ? 'Processing...' : photoURL ? 'Change DP' : 'Add DP'}
                        </span>
                      </div>
                    </div>

                    {/* Floating Instagram-style Camera Action Badge */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      className="absolute bottom-0 right-0 p-2 rounded-full bg-gradient-to-tr from-indigo-600 to-purple-600 text-white shadow-lg border-2 border-slate-900 hover:scale-110 active:scale-95 transition-all cursor-pointer"
                      title="Upload photo from camera or files"
                      aria-label="Upload profile photo"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Hidden file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handlePhotoFileChange}
                    className="hidden"
                    id="profile-photo-file-input"
                  />

                  {/* Quick Action controls */}
                  <div className="flex items-center gap-1.5 flex-wrap justify-center pt-0.5">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-2.5 py-1 bg-white/10 hover:bg-white/15 text-white rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                      id="upload-photo-btn"
                    >
                      <Camera className="h-3 w-3 text-indigo-400" />
                      <span>{photoURL ? 'Change DP' : 'Add Photo'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowUrlInput(!showUrlInput)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                      title="Paste image URL"
                      id="toggle-url-input-btn"
                    >
                      <LinkIcon className="h-3 w-3 text-slate-400" />
                      <span>Link</span>
                    </button>

                    {photoURL && (
                      <button
                        type="button"
                        onClick={() => {
                          setPhotoURL('');
                          setProfileSuccess('Photo removed. Click "Save & Sync to Firebase" below to confirm changes.');
                        }}
                        className="px-2 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 rounded-lg text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Remove custom photo"
                        id="remove-photo-btn"
                      >
                        <Trash2 className="h-3 w-3 text-rose-400" />
                        <span>Remove</span>
                      </button>
                    )}
                  </div>

                  {/* Optional Image Link URL Input Form */}
                  {showUrlInput && (
                    <div className="w-full max-w-[240px] pt-1">
                      <div className="flex items-center gap-1 bg-slate-900/90 border border-white/15 rounded-xl p-1 shadow-lg">
                        <input
                          type="url"
                          value={urlInputValue}
                          onChange={(e) => setUrlInputValue(e.target.value)}
                          placeholder="Paste image link..."
                          className="flex-1 bg-transparent px-2 py-1 text-xs text-white placeholder-slate-500 focus:outline-none min-w-0"
                          id="image-url-input"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (urlInputValue.trim()) {
                              setPhotoURL(urlInputValue.trim());
                              setShowUrlInput(false);
                              setUrlInputValue('');
                              setProfileSuccess('Photo URL linked! Click "Save & Sync to Firebase" below to confirm changes.');
                            }
                          }}
                          className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer shrink-0"
                          id="apply-url-btn"
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}

                  {/* DP Help Tag */}
                  <div className="text-[10px] text-slate-400 font-medium text-center flex items-center gap-1 select-none">
                    <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-tr from-amber-400 to-rose-500 animate-pulse" />
                    <span>Instagram DP • Easy recognition</span>
                  </div>
                </div>

                {/* Core Identity Inputs */}
                <div className="flex-1 w-full space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <User className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Full Display Name</span>
                          <span className="text-rose-400">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Mufaddal Bhai"
                        className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm text-white font-bold placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        id="profile-name-input"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>TR Number (Student ID)</span>
                        <span className="text-[10px] text-indigo-300 font-mono">ID</span>
                      </label>
                      <input
                        type="text"
                        value={studentTrNo}
                        onChange={(e) => setStudentTrNo(e.target.value)}
                        placeholder="e.g. 28612"
                        className="w-full bg-slate-900/60 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-sm font-mono text-indigo-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                        id="profile-tr-input"
                      />
                    </div>
                  </div>

                  {/* Institutional Email (verified & readonly) */}
                  <div className="flex items-center gap-2 bg-slate-900/40 px-3 py-1.5 rounded-xl border border-white/5 text-xs text-slate-400">
                    <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono truncate">{signedInEmail}</span>
                    {currentUser?.role && (
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/20 uppercase shrink-0">
                        {currentUser.role}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Metadata Grid (Editable directly in the card) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3 pt-2 border-t border-white/5">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Waras (Year)
                  </label>
                  <input
                    type="text"
                    value={waras}
                    onChange={(e) => setWaras(e.target.value)}
                    placeholder="e.g. 5 or Al-Sadisah"
                    className="w-full bg-slate-900/50 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    id="profile-waras-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Room No / Hostel
                  </label>
                  <input
                    type="text"
                    value={roomNo}
                    onChange={(e) => setRoomNo(e.target.value)}
                    placeholder="e.g. Block B-204"
                    className="w-full bg-slate-900/50 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    id="profile-room-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 block uppercase">
                    City / Hometown
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Surat, Mumbai"
                    className="w-full bg-slate-900/50 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    id="profile-city-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Phone / WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. +91 98765 43210"
                    className="w-full bg-slate-900/50 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-mono"
                    id="profile-phone-input"
                  />
                </div>
              </div>

              {/* Birthday and Bio */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 block uppercase">
                    Birthday
                  </label>
                  <input
                    type="date"
                    value={birthday}
                    onChange={(e) => setBirthday(e.target.value)}
                    className="w-full bg-slate-900/50 border border-white/10 focus:border-indigo-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all"
                    id="profile-birthday-input"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between uppercase">
                    <span className="flex items-center gap-1 text-indigo-300">
                      <Sparkles className="h-3 w-3" />
                      <span>About Me / Classroom Quote</span>
                    </span>
                  </label>
                  <textarea
                    rows={2}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Share a short intro, hobby, or classroom status message..."
                    className="w-full bg-slate-900/50 border border-white/10 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all resize-none"
                    id="profile-bio-input"
                  />
                </div>
              </div>

              {/* Form Action & Cloud Sync Footer */}
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Cloud className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span className="text-[11px] text-emerald-300">Synchronizes live with Firebase Firestore</span>
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl text-xs shadow-md shadow-indigo-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  id="save-profile-btn"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      <span>Saving to Firebase...</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="h-3.5 w-3.5" />
                      <span>Save & Sync to Firebase</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : (
        /* ALL CLASSMATES & STUDENT DIRECTORY VIEW */
        <div className="glass-panel rounded-2xl p-4 sm:p-6 space-y-4 border border-white/10 shadow-xl" id="student-directory-view">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-400" />
                <span>Classmates & Student Directory</span>
              </h2>
              <p className="text-xs text-slate-300">
                Browse student profiles synchronized in real-time across the institution.
              </p>
            </div>
            <div className="flex items-center gap-2.5 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setActiveSubTab('edit');
                  setTargetStudent(null);
                }}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                id="back-to-my-profile-btn"
              >
                <User className="h-3.5 w-3.5" />
                <span>My Profile</span>
              </button>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl border border-emerald-500/20 text-emerald-300 text-xs font-medium">
                <Cloud className="h-3.5 w-3.5 text-emerald-400" />
                <span>{allClassmates.length} Students</span>
              </div>
            </div>
          </div>

          {/* Search & Waras Filter Ribbon */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search classmates by name, TR, city, waras, room..."
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900/50 border border-white/10 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                id="search-classmates-input"
              />
            </div>

            {/* Waras Filter Pills */}
            <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 select-none">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 shrink-0 mr-1 font-semibold">
                <Filter className="h-3 w-3" /> Waras:
              </span>
              {warasOptions.slice(0, 6).map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setSelectedWarasFilter(opt)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedWarasFilter === opt
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>

          {/* Classmates Cards Grid (Responsive Fluid Auto-Fill Layout) */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,260px),1fr))] gap-3 pt-1">
            {filteredClassmates.map((student, idx) => {
              const color = student.avatarColor || 'from-indigo-500 to-purple-600';
              const isSelf =
                (student.id && currentUser?.id && student.id === currentUser.id) ||
                (student.username && currentUser?.username && student.username.toLowerCase() === currentUser.username.toLowerCase()) ||
                (student.trNo && currentUser?.trNo && student.trNo === currentUser.trNo);

              return (
                <div
                  key={`classmate-card-${student.id || 'usr'}-${student.trNo || student.username || idx}-${idx}`}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-white/10 hover:border-indigo-500/40 transition-all flex flex-col justify-between space-y-2.5 relative group shadow-xs"
                  id={`student-card-${student.trNo || student.username || student.id || idx}`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start gap-2.5">
                      {/* Classmate Instagram-style DP */}
                      <div className={`h-11 w-11 rounded-full p-[2px] bg-gradient-to-tr ${student.photoURL || student.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : color} shadow-sm shrink-0 flex items-center justify-center`}>
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
                            <span className="text-xs font-bold text-white uppercase select-none">
                              {(student.name || student.username || student.trNo || 'ST').slice(0, 2)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="text-xs font-bold text-white truncate">
                            {student.name || student.username || student.trNo || 'Classmate'}
                          </h3>
                          {isSelf && (
                            <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded font-semibold border border-indigo-500/30">
                              You
                            </span>
                          )}
                          {student.isMemeMaster && (
                            <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1 py-0.2 rounded font-semibold border border-amber-500/30">
                              🎭
                            </span>
                          )}
                          {student.isFailMaster && (
                            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1 py-0.2 rounded font-semibold border border-rose-500/30">
                              🗣️
                            </span>
                          )}
                        </div>

                        <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1.5">
                          <span>TR {student.trNo || student.username || '—'}</span>
                          {student.roomNo && (
                            <>
                              <span>•</span>
                              <span>Room {student.roomNo}</span>
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {student.waras && (
                        <span className="text-[10px] bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
                          {student.waras}
                        </span>
                      )}
                      {student.city && (
                        <span className="text-[10px] bg-white/5 text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
                          {student.city}
                        </span>
                      )}
                    </div>

                    {student.bio && (
                      <p className="text-[11px] text-slate-300 italic line-clamp-1 border-t border-white/5 pt-1.5">
                        "{student.bio}"
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
                    <button
                      type="button"
                      onClick={() => setSelectedModalStudent(student)}
                      className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 font-semibold py-0.5 transition-colors cursor-pointer"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Profile</span>
                    </button>

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setTargetStudent(student);
                          setActiveSubTab('edit');
                        }}
                        className="text-[10px] text-amber-300 hover:text-amber-200 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 transition-colors cursor-pointer"
                      >
                        Edit as Admin
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {filteredClassmates.length === 0 && (
            <div className="p-8 text-center text-slate-400 text-xs rounded-xl bg-slate-900/30 border border-white/5">
              No student profiles matched your search.
            </div>
          )}
        </div>
      )}

      {/* Classmate Profile Details Modal */}
      <ClassmateProfileModal
        isOpen={!!selectedModalStudent}
        onClose={() => setSelectedModalStudent(null)}
        student={selectedModalStudent}
        currentUser={currentUser}
        onRoleUpdated={(studentId, newRoles) => {
          setSelectedModalStudent(prev => prev ? { ...prev, ...newRoles } : null);
          setAllClassmates(prev =>
            prev.map(c => {
              const isMatch =
                (studentId && c.id === studentId) ||
                (selectedModalStudent?.id && c.id === selectedModalStudent.id) ||
                (c.username && selectedModalStudent?.username && c.username.toLowerCase() === selectedModalStudent.username.toLowerCase()) ||
                (c.trNo && selectedModalStudent?.trNo && c.trNo.toLowerCase() === selectedModalStudent.trNo.toLowerCase()) ||
                (c.email && selectedModalStudent?.email && c.email.toLowerCase() === selectedModalStudent.email.toLowerCase()) ||
                (c.name && selectedModalStudent?.name && c.name.toLowerCase() === selectedModalStudent.name.toLowerCase());

              if (isMatch) {
                return { ...c, ...newRoles };
              }
              return c;
            })
          );
        }}
        onOpenDirectChat={(username) => {
          if (onNavigateToTab) {
            onNavigateToTab('chat');
          }
        }}
      />
    </div>
  );
}
