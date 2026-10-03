/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  onSnapshot,
  query,
  limit,
} from 'firebase/firestore';
import { db, auth } from './firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface FirestoreEntryRequest {
  id: string;
  userId: string;
  username: string;
  name: string;
  email?: string;
  trNo?: string;
  phone?: string;
  waras?: string;
  city?: string;
  roomNo?: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  approvedAt?: string;
  approvedBy?: string;
  photoURL?: string;
  permissionsRequested?: string[];
}

const REQUESTS_COLLECTION = 'entryRequests';
const USERS_COLLECTION = 'users';

export function sanitizeDocKey(raw: string): string {
  return (raw || '').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
}

function cleanFirestorePayload<T extends Record<string, any>>(obj: T): Partial<T> {
  const cleaned: Record<string, any> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      cleaned[key] = val;
    }
  }
  return cleaned as Partial<T>;
}

/**
 * Record or update an entry request in Firestore for gatekeeper review
 */
export async function recordEntryRequestInFirestore(req: FirestoreEntryRequest): Promise<void> {
  const docId = sanitizeDocKey(req.id || `req_${req.userId || req.email || req.username}`);
  const reqDocRef = doc(db, REQUESTS_COLLECTION, docId);

  // 1. Check if user has already been admitted - once admitted, never revert or re-show request!
  try {
    const existingSnap = await getDoc(reqDocRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      if (data.status === 'approved') {
        // User already admitted, do not overwrite with pending!
        return;
      }
    }
  } catch (_) {}

  // 2. Also check if the user is already marked approved in users collection
  try {
    const isAlreadyApproved = await checkIfUserApprovedInFirestore(
      req.email,
      req.userId,
      req.username,
      req.trNo
    );
    if (isAlreadyApproved) {
      // User is already approved in classroom! Ensure request doc is marked approved and return
      await setDoc(
        reqDocRef,
        {
          ...req,
          id: docId,
          status: 'approved',
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      return;
    }
  } catch (_) {}

  try {
    await setDoc(
      reqDocRef,
      cleanFirestorePayload({
        ...req,
        id: docId,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `${REQUESTS_COLLECTION}/${docId}`);
  }

  // Also record user profile in Firestore
  if (req.userId || req.email) {
    const userDocId = sanitizeDocKey(req.userId || req.email || req.username);
    const userDocRef = doc(db, USERS_COLLECTION, userDocId);
    try {
      await setDoc(
        userDocRef,
        cleanFirestorePayload({
          id: userDocId,
          userId: req.userId,
          username: req.username,
          name: req.name,
          email: req.email,
          trNo: req.trNo,
          isApproved: req.status === 'approved',
          role: 'student',
          photoURL: req.photoURL || (req as any).avatarUrl,
          avatarUrl: req.photoURL || (req as any).avatarUrl,
          phone: (req as any).phone,
          birthday: (req as any).birthday,
          waras: (req as any).waras,
          city: (req as any).city,
          roomNo: (req as any).roomNo,
          bio: (req as any).bio,
          updatedAt: new Date().toISOString(),
        }),
        { merge: true }
      );
    } catch (err) {
      console.warn('Firestore user profile sync notice:', err);
    }
  }
}

/**
 * Real-time subscription to admission / entry requests for administrator gatekeeper
 */
export function subscribeToEntryRequests(
  callback: (requests: FirestoreEntryRequest[]) => void,
  onError?: (err: Error) => void
): () => void {
  const colRef = collection(db, REQUESTS_COLLECTION);
  const q = query(colRef, limit(100));

  return onSnapshot(
    q,
    (snapshot) => {
      const list: FirestoreEntryRequest[] = [];
      snapshot.forEach((snap) => {
        const data = snap.data();
        list.push({
          id: snap.id,
          userId: data.userId || snap.id,
          username: data.username || 'student',
          name: data.name || data.username || 'Student',
          email: data.email || '',
          trNo: data.trNo || '',
          phone: data.phone || '',
          waras: data.waras || '',
          city: data.city || 'Surat',
          roomNo: data.roomNo || '',
          status: data.status || 'pending',
          requestedAt: data.requestedAt || new Date().toISOString(),
          approvedAt: data.approvedAt,
          approvedBy: data.approvedBy,
          photoURL: data.photoURL,
          permissionsRequested: Array.isArray(data.permissionsRequested) ? data.permissionsRequested : [],
        });
      });

      // Sort newest first
      list.sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());
      callback(list);
    },
    (err) => {
      console.error('Firestore entryRequests listener error:', err);
      if (onError) onError(err);
      handleFirestoreError(err, OperationType.GET, REQUESTS_COLLECTION);
    }
  );
}

/**
 * Approve entry request in Firestore directly
 */
export async function approveUserInFirestore(
  requestId: string,
  userIdentifier: {
    username: string;
    userId?: string;
    email?: string;
    trNo?: string;
    name?: string;
  },
  approved: boolean = true
): Promise<void> {
  const status = approved ? 'approved' : 'rejected';
  const approvedAt = new Date().toISOString();
  const approvedBy = '28782@jameasaifiyah.edu';

  // 1. Update entry request document
  const docId = sanitizeDocKey(requestId);
  const reqRef = doc(db, REQUESTS_COLLECTION, docId);
  try {
    await setDoc(
      reqRef,
      {
        status,
        approvedAt,
        approvedBy,
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.UPDATE, `${REQUESTS_COLLECTION}/${docId}`);
  }

  // 2. Also update by secondary doc key if different
  if (userIdentifier.email) {
    const emailKey = sanitizeDocKey(userIdentifier.email);
    if (emailKey !== docId) {
      try {
        const altReqRef = doc(db, REQUESTS_COLLECTION, `req_${emailKey}`);
        await setDoc(altReqRef, { status, approvedAt, approvedBy }, { merge: true });
      } catch (_) {}
    }
  }

  // 3. Mark user permanently approved in Firestore users collection
  const userKeys = [
    userIdentifier.userId,
    userIdentifier.email,
    userIdentifier.username,
    userIdentifier.trNo,
  ].filter(Boolean) as string[];

  const normUsername = userIdentifier.username || userIdentifier.email?.split('@')[0] || 'student';
  const normName = userIdentifier.name || userIdentifier.username || userIdentifier.email?.split('@')[0] || 'Classmate';
  const normTr = userIdentifier.trNo || userIdentifier.username || '';

  for (const rawKey of userKeys) {
    const uKey = sanitizeDocKey(rawKey);
    const uRef = doc(db, USERS_COLLECTION, uKey);
    try {
      await setDoc(
        uRef,
        cleanFirestorePayload({
          id: uKey,
          userId: userIdentifier.userId || uKey,
          username: normUsername,
          name: normName,
          email: userIdentifier.email || null,
          trNo: normTr,
          role: 'student',
          isApproved: approved,
          approvedAt,
          approvedBy,
          updatedAt: approvedAt,
          syncedToFirebase: true,
        }),
        { merge: true }
      );
    } catch (_) {}
  }
}

/**
 * Check if a user is permanently approved in Firestore across past sessions
 */
export async function checkIfUserApprovedInFirestore(
  email?: string,
  userId?: string,
  username?: string,
  trNo?: string,
  name?: string
): Promise<boolean> {
  // Superadmin is always approved
  if (email && (email.toLowerCase() === '28782@jameasaifiyah.edu' || email.includes('28782'))) {
    return true;
  }
  if (username && (username.toLowerCase() === 'admin' || username.includes('28782'))) {
    return true;
  }

  const normTr = (trNo || username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
  const normName = (name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');

  // Check local cache
  try {
    const cachedUserStr = localStorage.getItem('classroom_current_user');
    if (cachedUserStr) {
      const parsed = JSON.parse(cachedUserStr);
      const parsedTr = (parsed.trNo || parsed.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
      const parsedName = (parsed.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
      if (
        parsed.isApproved === true &&
        ((email && parsed.email?.toLowerCase() === email.toLowerCase()) ||
          (username && parsed.username?.toLowerCase() === username.toLowerCase()) ||
          (userId && parsed.id === userId) ||
          (normTr && parsedTr && normTr === parsedTr) ||
          (normName && parsedName && normName.length > 2 && normName === parsedName))
      ) {
        return true;
      }
    }
  } catch (_) {}

  const keys = [userId, email, username, trNo, name].filter(Boolean) as string[];

  for (const rawKey of keys) {
    const key = sanitizeDocKey(rawKey);
    const variants = [key, `user_${key}`, `req_${key}`];

    for (const vKey of variants) {
      try {
        // Check user document
        const userSnap = await getDoc(doc(db, USERS_COLLECTION, vKey));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.isApproved === true) return true;
        }

        // Check request document
        const reqSnap = await getDoc(doc(db, REQUESTS_COLLECTION, vKey));
        if (reqSnap.exists()) {
          const data = reqSnap.data();
          if (data.status === 'approved') return true;
        }
      } catch (err) {
        console.warn('Firestore approval lookup notice:', err);
      }
    }
  }

  // Fallback: check with server registry if student was admitted
  try {
    const checkEmail = (email || '').trim().toLowerCase();
    const checkUsername = (username || '').trim().toLowerCase();
    const resp = await fetch('/api/users');
    if (resp.ok) {
      const data = await resp.json();
      const users = data.users || [];
      const match = users.find((u: any) => {
        if (u.isApproved !== true) return false;
        if (checkEmail && u.email?.toLowerCase() === checkEmail) return true;
        if (checkUsername && u.username?.toLowerCase() === checkUsername) return true;
        const uTr = (u.trNo || u.username || '').toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
        if (normTr && uTr && normTr === uTr) return true;
        const uNormName = (u.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (normName && uNormName && normName.length > 2 && normName === uNormName) return true;
        return false;
      });
      if (match) return true;
    }
  } catch (_) {}

  return false;
}

/**
 * Real-time subscription to check if the student waiting on the Entry Requested Page gets approved
 */
export function subscribeToUserApprovalStatus(
  userIdentifiers: {
    userId?: string;
    email?: string;
    username?: string;
    trNo?: string;
    name?: string;
  },
  onApproved: (data: any) => void
): () => void {
  const unsubs: (() => void)[] = [];

  const keysToCheck = [
    userIdentifiers.userId,
    userIdentifiers.email,
    userIdentifiers.username,
    userIdentifiers.trNo,
    userIdentifiers.name,
  ].filter(Boolean) as string[];

  for (const rawKey of keysToCheck) {
    const key = sanitizeDocKey(rawKey);

    // 1. Listen on entryRequests document
    try {
      const reqRef = doc(db, REQUESTS_COLLECTION, `req_${key}`);
      const un1 = onSnapshot(reqRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'approved') {
            onApproved(data);
          }
        }
      });
      unsubs.push(un1);
    } catch (_) {}

    // 2. Listen on direct request doc
    try {
      const reqRef2 = doc(db, REQUESTS_COLLECTION, key);
      const un2 = onSnapshot(reqRef2, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.status === 'approved') {
            onApproved(data);
          }
        }
      });
      unsubs.push(un2);
    } catch (_) {}

    // 3. Listen on user profile doc
    try {
      const userRef = doc(db, USERS_COLLECTION, key);
      const un3 = onSnapshot(userRef, (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          if (data.isApproved === true) {
            onApproved(data);
          }
        }
      });
      unsubs.push(un3);
    } catch (_) {}
  }

  return () => {
    unsubs.forEach((un) => {
      try { un(); } catch (_) {}
    });
  };
}

/**
 * Persist user profile details directly into Firebase Firestore
 */
export async function syncUserProfileToFirestore(
  profileData: {
    id: string;
    username?: string;
    trNo?: string;
    name?: string;
    email?: string;
    phone?: string;
    birthday?: string;
    waras?: string;
    city?: string;
    bio?: string;
    roomNo?: string;
    avatarColor?: string;
    avatarInitials?: string;
    photoURL?: string;
    avatarUrl?: string;
    role?: string;
    isMemeMaster?: boolean;
    isFailMaster?: boolean;
  }
): Promise<{ success: boolean; error?: string; timestamp?: string }> {
  const timestamp = new Date().toISOString();
  const keysToUpdate = [
    profileData.id,
    profileData.email,
    profileData.username,
    profileData.trNo,
    profileData.name,
    auth.currentUser?.uid,
    auth.currentUser?.email,
  ].filter(Boolean) as string[];

  const uniqueKeys = Array.from(new Set(keysToUpdate.map(sanitizeDocKey)));

  try {
    // 1. Update in users collection for all identifying keys
    for (const key of uniqueKeys) {
      if (!key) continue;
      const userRef = doc(db, USERS_COLLECTION, key);
      const cleanedUserData = cleanFirestorePayload({
        ...profileData,
        id: key,
        email: profileData.email || auth.currentUser?.email || null,
        updatedAt: timestamp,
        syncedToFirebase: true,
      });
      await setDoc(userRef, cleanedUserData, { merge: true });
    }

    // 2. Also update entryRequests collection if exists
    for (const key of uniqueKeys) {
      if (!key) continue;
      const reqRef = doc(db, REQUESTS_COLLECTION, key);
      const reqAltRef = doc(db, REQUESTS_COLLECTION, `req_${key}`);

      const reqUpdates = cleanFirestorePayload({
        name: profileData.name,
        phone: profileData.phone,
        waras: profileData.waras,
        city: profileData.city,
        roomNo: profileData.roomNo,
        trNo: profileData.trNo,
        photoURL: profileData.photoURL || profileData.avatarUrl,
        avatarUrl: profileData.photoURL || profileData.avatarUrl,
        updatedAt: timestamp,
      });

      try {
        await setDoc(reqRef, reqUpdates, { merge: true });
      } catch (_) {}

      try {
        await setDoc(reqAltRef, reqUpdates, { merge: true });
      } catch (_) {}
    }

    return { success: true, timestamp };
  } catch (err: any) {
    console.error('Error syncing profile to Firestore:', err);
    return { success: false, error: err.message || 'Firestore write failed' };
  }
}

/**
 * Fetch latest user profile from Firebase Firestore
 */
export async function fetchUserProfileFromFirestore(
  userIdentifiers: {
    userId?: string;
    email?: string;
    username?: string;
    trNo?: string;
    name?: string;
  }
): Promise<Record<string, any> | null> {
  const keys = [
    userIdentifiers.userId,
    userIdentifiers.email,
    userIdentifiers.username,
    userIdentifiers.trNo,
    userIdentifiers.name,
    auth.currentUser?.uid,
    auth.currentUser?.email,
  ].filter(Boolean) as string[];

  for (const rawKey of keys) {
    const key = sanitizeDocKey(rawKey);
    const variants = [key, `user_${key}`, `req_${key}`];

    // 1. Search in users collection
    for (const vKey of variants) {
      try {
        const userSnap = await getDoc(doc(db, USERS_COLLECTION, vKey));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data && (data.name || data.email || data.photoURL || data.avatarUrl || data.phone || data.birthday)) {
            return data;
          }
        }
      } catch (err) {
        console.warn('Firestore user fetch notice for key', vKey, err);
      }
    }

    // 2. Search in entry requests collection
    for (const vKey of variants) {
      try {
        const reqSnap = await getDoc(doc(db, REQUESTS_COLLECTION, vKey));
        if (reqSnap.exists()) {
          const data = reqSnap.data();
          if (data && (data.name || data.email || data.photoURL || data.avatarUrl || data.phone || data.birthday)) {
            return data;
          }
        }
      } catch (err) {
        console.warn('Firestore request fetch notice for key', vKey, err);
      }
    }
  }

  return null;
}

/**
 * Real-time subscription to all student profiles from Firebase Firestore.
 * Subscribes to BOTH users and entryRequests collections to ensure that any
 * signed-in, registered, or approved student account is NEVER lost and immediately
 * appears in the Classmates Directory across all devices.
 */
export function subscribeToAllUsersFromFirestore(
  callback: (users: Record<string, any>[]) => void,
  onError?: (err: Error) => void
): () => void {
  const usersRef = collection(db, USERS_COLLECTION);
  const reqsRef = collection(db, REQUESTS_COLLECTION);

  let currentFirestoreUsers: Record<string, any>[] = [];
  let currentEntryRequests: Record<string, any>[] = [];

    const emitUnifiedList = () => {
    const deduplicatedList: Record<string, any>[] = [];

    const addItem = (item: Record<string, any>) => {
      if (!item) return;

      const rawName = (item.name || item.displayName || item.username || '').trim();
      const rawTr = (item.trNo || item.username || '').trim();
      const rawEmail = (item.email || '').toLowerCase().trim();
      const rawId = item.id || item.userId || item.firestoreDocId || '';

      // Ignore bare documents that have no profile information whatsoever
      const isNum = (s?: string) => Boolean(s && !isNaN(Number(s.trim())));
      const hasRealName = rawName && !rawName.startsWith('user_') && !rawName.startsWith('req_');
      const hasRealTr = rawTr && (rawTr.length >= 3 || isNum(rawTr));
      const hasRealEmail = rawEmail && rawEmail.includes('@');

      if (!hasRealName && !hasRealTr && !hasRealEmail) {
        return;
      }

      const normTr = rawTr.toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
      const normName = rawName.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const isItemAdmin = 
        item.role === 'admin' || 
        item.role === 'superadmin' || 
        item.username?.toLowerCase() === 'admin' || 
        normTr === '28782' || 
        rawEmail.startsWith('28782@');

      const existingIndex = deduplicatedList.findIndex((ex) => {
        if (rawId && (ex.id === rawId || ex.userId === rawId || ex.firestoreDocId === rawId)) return true;
        if (item.id && (ex.id === item.id || ex.userId === item.id || ex.firestoreDocId === item.id)) return true;
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
        if (normTr && exTr && normTr === exTr) return true;
        if (rawEmail && exEmail && rawEmail === exEmail) return true;
        if (normTr && exEmail && exEmail.startsWith(normTr.toLowerCase() + '@')) return true;
        if (exTr && rawEmail && rawEmail.startsWith(exTr.toLowerCase() + '@')) return true;
        const exName = (ex.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (normName && exName && normName.length > 2 && normName === exName) return true;
        return false;
      });

      if (existingIndex > -1) {
        const ex = deduplicatedList[existingIndex];
        const bestName = (item.name && !isNum(item.name)) ? item.name : (ex.name && !isNum(ex.name) ? ex.name : (item.name || ex.name || rawName));
        deduplicatedList[existingIndex] = {
          ...ex,
          ...item,
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
          isApproved: ex.isApproved === true || item.isApproved === true || item.status === 'approved',
          role: ex.role === 'admin' || item.role === 'admin' ? 'admin' : (item.role || ex.role || 'student'),
        };
      } else {
        deduplicatedList.push({
          ...item,
          name: rawName || rawTr || 'Classmate',
          isApproved: item.isApproved === true || item.status === 'approved',
        });
      }
    };

    // 1. Process entryRequests (anyone who signed in or requested gatekeeper entry)
    currentEntryRequests.forEach(addItem);
    // 2. Process users (which has detailed profile bios, room numbers, avatar colors, etc.)
    currentFirestoreUsers.forEach(addItem);

    callback(deduplicatedList);
  };

  const unsubUsers = onSnapshot(
    usersRef,
    (snapshot) => {
      const list: Record<string, any>[] = [];
      snapshot.forEach((snap) => {
        const data = snap.data();
        if (data) list.push({ ...data, firestoreDocId: snap.id });
      });
      currentFirestoreUsers = list;
      emitUnifiedList();
    },
    (err) => {
      console.error('Firestore users listener error:', err);
      if (onError) onError(err);
    }
  );

  const unsubReqs = onSnapshot(
    reqsRef,
    (snapshot) => {
      const list: Record<string, any>[] = [];
      snapshot.forEach((snap) => {
        const data = snap.data();
        if (data) list.push({ ...data, firestoreDocId: snap.id });
      });
      currentEntryRequests = list;
      emitUnifiedList();
    },
    (err) => {
      console.warn('Firestore entryRequests listener note:', err);
    }
  );

  return () => {
    unsubUsers();
    unsubReqs();
  };
}

/**
 * Fetch all user profiles currently saved in Firestore (merging users and entryRequests)
 */
export async function fetchAllUsersFromFirestore(): Promise<Record<string, any>[]> {
  try {
    const usersSnap = await getDocs(collection(db, USERS_COLLECTION));
    const reqsSnap = await getDocs(collection(db, REQUESTS_COLLECTION));

    const deduplicatedList: Record<string, any>[] = [];

    const addItem = (item: Record<string, any>) => {
      if (!item) return;

      const rawName = (item.name || item.displayName || item.username || '').trim();
      const rawTr = (item.trNo || item.username || '').trim();
      const rawEmail = (item.email || '').toLowerCase().trim();
      const rawId = item.id || item.userId || item.firestoreDocId || '';

      const isNum = (s?: string) => Boolean(s && !isNaN(Number(s.trim())));
      const hasRealName = rawName && !rawName.startsWith('user_') && !rawName.startsWith('req_');
      const hasRealTr = rawTr && (rawTr.length >= 3 || isNum(rawTr));
      const hasRealEmail = rawEmail && rawEmail.includes('@');

      if (!hasRealName && !hasRealTr && !hasRealEmail) {
        return;
      }

      const normTr = rawTr.toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '');
      const normName = rawName.toLowerCase().replace(/[^a-z0-9]/gi, '');
      const isItemAdmin = 
        item.role === 'admin' || 
        item.role === 'superadmin' || 
        item.username?.toLowerCase() === 'admin' || 
        normTr === '28782' || 
        rawEmail.startsWith('28782@');

      const existingIndex = deduplicatedList.findIndex((ex) => {
        if (rawId && (ex.id === rawId || ex.userId === rawId || ex.firestoreDocId === rawId)) return true;
        if (item.id && (ex.id === item.id || ex.userId === item.id || ex.firestoreDocId === item.id)) return true;
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
        if (normTr && exTr && normTr === exTr) return true;
        if (rawEmail && exEmail && rawEmail === exEmail) return true;
        if (normTr && exEmail && exEmail.startsWith(normTr.toLowerCase() + '@')) return true;
        if (exTr && rawEmail && rawEmail.startsWith(exTr.toLowerCase() + '@')) return true;
        const exName = (ex.name || '').toLowerCase().replace(/[^a-z0-9]/gi, '');
        if (normName && exName && normName.length > 2 && normName === exName) return true;
        return false;
      });

      if (existingIndex > -1) {
        const ex = deduplicatedList[existingIndex];
        const bestName = (item.name && !isNum(item.name)) ? item.name : (ex.name && !isNum(ex.name) ? ex.name : (item.name || ex.name || rawName));
        deduplicatedList[existingIndex] = {
          ...ex,
          ...item,
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
          isApproved: ex.isApproved === true || item.isApproved === true || item.status === 'approved',
          role: ex.role === 'admin' || item.role === 'admin' ? 'admin' : (item.role || ex.role || 'student'),
        };
      } else {
        deduplicatedList.push({
          ...item,
          name: rawName || rawTr || 'Classmate',
          isApproved: item.isApproved === true || item.status === 'approved',
        });
      }
    };

    reqsSnap.forEach((d) => addItem({ ...d.data(), firestoreDocId: d.id }));
    usersSnap.forEach((d) => addItem({ ...d.data(), firestoreDocId: d.id }));

    return deduplicatedList;
  } catch (err) {
    console.warn('Failed to fetch users from Firestore:', err);
    return [];
  }
}

/**
 * Automatically persist and sync any signed-in user into Firestore permanently.
 * Guarantees that when this web app goes live, all previously and currently signed-in
 * accounts are stored durably in the cloud and visible in the Classmates Directory.
 */
export async function ensureUserInFirestore(
  user: Record<string, any>
): Promise<void> {
  if (!user) return;
  const timestamp = new Date().toISOString();

  const rawKeys = [
    user.id,
    user.email,
    user.username,
    user.trNo,
    auth.currentUser?.uid,
    auth.currentUser?.email,
  ].filter(Boolean) as string[];

  const uniqueKeys = Array.from(new Set(rawKeys.map(sanitizeDocKey)));
  if (uniqueKeys.length === 0) return;

  const trNo = user.trNo || user.username || '';
  const username = user.username || trNo || user.email?.split('@')[0] || 'student';
  const name = user.name || username;
  const isApproved = user.isApproved ?? true;

  const resolvedPhoto = user.photoURL || user.avatarUrl;

  const payload: Record<string, any> = cleanFirestorePayload({
    id: user.id || uniqueKeys[0],
    username,
    name,
    email: user.email || auth.currentUser?.email || null,
    trNo,
    role: user.role || (username.toLowerCase() === 'admin' || trNo === '28782' ? 'admin' : 'student'),
    isApproved,
    isMemeMaster: Boolean(user.isMemeMaster),
    isFailMaster: Boolean(user.isFailMaster),
    avatarColor: user.avatarColor || 'from-indigo-500 to-purple-600',
    avatarInitials: user.avatarInitials,
    photoURL: resolvedPhoto,
    avatarUrl: resolvedPhoto,
    phone: user.phone,
    birthday: user.birthday,
    waras: user.waras,
    city: user.city,
    bio: user.bio,
    roomNo: user.roomNo,
    updatedAt: timestamp,
    syncedToFirebase: true,
  });

  // 1. Upsert into users collection
  for (const key of uniqueKeys) {
    if (!key) continue;
    try {
      const userRef = doc(db, USERS_COLLECTION, key);
      await setDoc(userRef, cleanFirestorePayload({ ...payload, id: key }), { merge: true });
    } catch (err) {
      console.warn(`Firestore auto-sync notice for key ${key}:`, err);
    }
  }

  // 2. Also ensure entryRequests collection has approved status
  if (isApproved) {
    for (const key of uniqueKeys) {
      if (!key) continue;
      try {
        const reqRef = doc(db, REQUESTS_COLLECTION, `req_${key}`);
        await setDoc(
          reqRef,
          cleanFirestorePayload({
            id: `req_${key}`,
            userId: payload.id,
            username: payload.username,
            name: payload.name,
            email: payload.email,
            trNo: payload.trNo,
            photoURL: resolvedPhoto,
            avatarUrl: resolvedPhoto,
            phone: payload.phone,
            birthday: payload.birthday,
            waras: payload.waras,
            city: payload.city,
            roomNo: payload.roomNo,
            bio: payload.bio,
            status: 'approved',
            updatedAt: timestamp,
          }),
          { merge: true }
        );
      } catch (_) {}
    }
  }
}

/**
 * Baseline initial roster seed to Firestore so all historical classmates
 * are permanently preserved in the cloud database when the app goes live.
 */
export async function seedInitialClassmatesToFirestore(): Promise<void> {
  const initialStudents = [
    {
      id: 'admin_28782',
      username: '28782',
      name: 'Mustafa (Administrator)',
      email: '28782@jameasaifiyah.edu',
      trNo: '28782',
      role: 'admin',
      isApproved: true,
      isMemeMaster: true,
      isFailMaster: true,
      avatarColor: 'from-amber-500 to-orange-600',
      city: 'Surat',
      waras: 'Waras Al-Anwar',
      roomNo: '2112',
      bio: 'System Administrator & Classroom Gatekeeper',
    },
    {
      id: '28728',
      username: '28728',
      name: 'Hatim Sarraf',
      email: '28728@jameasaifiyah.edu',
      trNo: '28728',
      role: 'student',
      isApproved: true,
      phone: '8460905933',
      birthday: '2011-02-12',
      waras: '8 rabi ul aakhar',
      roomNo: '2082',
      bio: 'great swimmer',
      avatarColor: 'from-purple-600 to-indigo-700',
    },
    {
      id: 'user_28612_jameasaiifyah_edu',
      username: '28612',
      name: 'Burhan Pipe',
      email: '28612@jameasaifiyah.edu',
      trNo: '28612',
      role: 'student',
      isApproved: true,
      isMemeMaster: true,
      isFailMaster: true,
      avatarColor: 'from-blue-500 to-indigo-600',
      phone: 'r',
      waras: 'weef',
      roomNo: '',
      city: '',
      bio: 'Enthusiastic classmate & student of Jamea Saifiyah',
    },
    {
      id: 'user_1789650090975_el0i',
      username: '28622',
      name: 'Mufaddal',
      email: '28622@jameasaifiyah.edu',
      trNo: '28622',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-emerald-500 to-teal-500',
      birthday: '2002-09-26',
      city: 'Surat',
      waras: 'Waras Al-Quds',
      roomNo: '2210',
      bio: 'Classroom member & student',
    },
    {
      id: 'student_tr101',
      username: 'meme master',
      name: 'Burhanuddin',
      email: 'burhanuddin@jameasaifiyah.edu',
      trNo: 'TR-101',
      role: 'student',
      isApproved: true,
      isMemeMaster: true,
      avatarColor: 'from-blue-500 to-sky-500',
      city: 'Mumbai',
      waras: 'Waras Al-Quds',
      roomNo: '1404',
      bio: 'The reigning Meme Master of the class',
    },
    {
      id: 'student_tr102',
      username: 'taher',
      name: 'Taher',
      email: 'taher@jameasaifiyah.edu',
      trNo: 'TR-102',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-emerald-500 to-teal-500',
      city: 'Karachi',
      waras: 'Waras Al-Zahra',
      roomNo: '2112',
    },
    {
      id: 'student_tr103',
      username: 'husain',
      name: 'Husain',
      email: 'husain@jameasaifiyah.edu',
      trNo: 'TR-103',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-purple-500 to-indigo-500',
      city: 'Nairobi',
      waras: 'Waras Al-Azhar',
      roomNo: '1205',
    },
    {
      id: 'user_1787191550900_jzxf',
      username: 'hatim',
      name: 'Burhanuddin Hatim',
      email: 'hatim@jameasaifiyah.edu',
      trNo: 'TR-104',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-blue-500 to-sky-500',
      city: 'Nairobi',
      waras: 'Waras Al-Quds',
      roomNo: '2231',
    },
    {
      id: 'user_1787191564913_jdf6',
      username: 'mustafa',
      name: 'Mustafa Kuzema',
      email: 'mustafa.kuzema@jameasaifiyah.edu',
      trNo: 'TR-105',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-pink-500 to-rose-500',
      city: 'Surat',
      waras: 'Waras Al-Anwar',
      roomNo: '2110',
    },
    {
      id: 'user_1787191570744_dpx3',
      username: 'dmin',
      name: 'Taher (Dmin)',
      email: 'dmin@jameasaifiyah.edu',
      trNo: 'TR-106',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-emerald-500 to-teal-500',
      city: 'Mumbai',
      waras: 'Waras Al-Zahra',
      roomNo: '2115',
    },
    {
      id: 'user_1787192146510_etfn',
      username: 'abdullah',
      name: 'Abdullah',
      email: 'abdullah@jameasaifiyah.edu',
      trNo: 'TR-107',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-pink-500 to-rose-500',
      city: 'Surat',
      waras: 'Waras Al-Quds',
      roomNo: '2120',
    },
    {
      id: 'student_new',
      username: 'newstudent@jameasaifiyah.edu',
      name: 'New Student',
      email: 'newstudent@jameasaifiyah.edu',
      trNo: 'TR-108',
      role: 'student',
      isApproved: true,
      avatarColor: 'from-indigo-500 to-purple-600',
    },
  ];

  try {
    for (const student of initialStudents) {
      await ensureUserInFirestore(student);
    }
  } catch (err) {
    console.warn('Initial roster seeding notice:', err);
  }
}

/**
 * Update a student's Meme Master or Fail Master role authorization in Firestore
 */
export async function updateUserMasterRolesInFirestore(
  student: { id?: string; username?: string; trNo?: string; email?: string; name?: string; firestoreDocId?: string },
  roles: { isMemeMaster?: boolean; isFailMaster?: boolean }
): Promise<void> {
  const timestamp = new Date().toISOString();
  const keysToUpdate = [
    student.id,
    (student as any).firestoreDocId,
    student.email,
    student.username,
    student.trNo,
    student.name,
  ].filter(Boolean) as string[];

  const uniqueKeys = Array.from(new Set(keysToUpdate.map(sanitizeDocKey)));

  for (const key of uniqueKeys) {
    if (!key) continue;
    try {
      const userRef = doc(db, USERS_COLLECTION, key);
      await setDoc(
        userRef,
        {
          ...roles,
          id: student.id || key,
          name: student.name || student.username || key,
          username: student.username || student.trNo || key,
          trNo: student.trNo || student.username || key,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn(`Firestore role update note for ${key}:`, err);
    }

    try {
      const reqRef = doc(db, REQUESTS_COLLECTION, key);
      await setDoc(
        reqRef,
        {
          ...roles,
          updatedAt: timestamp,
        },
        { merge: true }
      );
    } catch (_) {}
  }
}
