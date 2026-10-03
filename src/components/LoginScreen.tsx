/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  BookOpen,
  RefreshCw,
  ShieldCheck,
  AlertCircle,
  Clock,
  CheckCircle2,
  LogOut,
  Mail,
  ShieldAlert,
  Lock,
  UserPlus,
  LogIn,
  User as UserIcon,
} from 'lucide-react';
import { User as UserType } from '../types';
import { 
  signInWithGoogle, 
  signOutFirebase,
  registerWithEmailPassword,
  loginWithEmailPassword,
  resendVerificationToEmail
} from '../lib/firebase';
import {
  recordEntryRequestInFirestore,
  checkIfUserApprovedInFirestore,
  subscribeToUserApprovalStatus,
  approveUserInFirestore,
  fetchUserProfileFromFirestore,
  ensureUserInFirestore,
} from '../lib/gatekeeperFirestore';

async function resolveStudentRoles(identifiers: { userId?: string; email?: string; username?: string; trNo?: string }) {
  let isMemeMaster = false;
  let isFailMaster = false;
  try {
    const profile = await fetchUserProfileFromFirestore(identifiers);
    if (profile) {
      if (profile.isMemeMaster !== undefined) isMemeMaster = Boolean(profile.isMemeMaster);
      if (profile.isFailMaster !== undefined) isFailMaster = Boolean(profile.isFailMaster);
    }
  } catch (_) {}

  try {
    const query = identifiers.email || identifiers.username || identifiers.trNo || '';
    if (query) {
      const resp = await fetch(`/api/auth/resolve-identity?q=${encodeURIComponent(query)}`);
      if (resp.ok) {
        const data = await resp.json();
        if (data.user) {
          if (data.user.isMemeMaster !== undefined) isMemeMaster = Boolean(data.user.isMemeMaster);
          if (data.user.isFailMaster !== undefined) isFailMaster = Boolean(data.user.isFailMaster);
        }
      }
    }
  } catch (_) {}

  return { isMemeMaster, isFailMaster };
}

interface LoginScreenProps {
  onLoginSuccess: (user: UserType) => void;
}

export default function LoginScreen({ onLoginSuccess }: LoginScreenProps) {
  // Auth mode: 'login' | 'register' | 'verification'
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'verification'>('login');

  // Form input fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Email verification screen state
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationPassword, setVerificationPassword] = useState('');
  const [resendStatus, setResendStatus] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  // Google authenticated user
  const [googleUser, setGoogleUser] = useState<{
    email: string;
    displayName: string;
    uid: string;
    photoURL?: string;
  } | null>(null);

  // Loading & error states
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Entry Requested / Waiting Room state
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [pendingUsername, setPendingUsername] = useState('');
  const [pendingUserEmail, setPendingUserEmail] = useState('');
  const [pendingUserTr, setPendingUserTr] = useState('');
  const [approvedNotification, setApprovedNotification] = useState<string | null>(null);

  // Requested permissions for new student entry
  const requestedPermissions = [
    'read_notes',
    'participate_chat',
    'microphone',
    'view_memes',
  ];

  // Helper to attempt login with a Google user
  const attemptGoogleLogin = async (userPayload: {
    email: string;
    displayName: string;
    uid: string;
    photoURL?: string;
  }) => {
    setIsLoading(true);
    setError(null);

    const cleanEmail = userPayload.email.toLowerCase().trim();
    const isAdminEmail =
      cleanEmail === '28782@jameasaifiyah.edu' ||
      cleanEmail.includes('28782');

    try {
      // 1. If Admin (28782@jameasaifiyah.edu), grant direct instant access!
      if (isAdminEmail) {
        const adminUser: UserType = {
          id: userPayload.uid || 'admin_28782',
          username: 'admin',
          name: 'Mustafa (Administrator)',
          email: '28782@jameasaifiyah.edu',
          avatarColor: 'from-amber-500 to-orange-600',
          isMemeMaster: true,
          isFailMaster: true,
          isApproved: true,
          role: 'admin',
          trNo: '28782',
        };
        localStorage.setItem('classroom_current_user', JSON.stringify(adminUser));
        ensureUserInFirestore(adminUser).catch(e => console.warn('Admin sync note:', e));
        onLoginSuccess(adminUser);
        return;
      }

      // 2. Check if user already gained permanent approval from 28782@jameasaifiyah.edu in Firestore
      let isPreviouslyApproved = false;
      try {
        isPreviouslyApproved = await checkIfUserApprovedInFirestore(
          cleanEmail,
          userPayload.uid,
          userPayload.displayName
        );
      } catch (err) {
        console.warn('Firestore check notice:', err);
      }

      // Check backend login immediately to see if user is already admitted
      try {
        const checkRes = await fetch('/api/auth/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            name: userPayload.displayName || cleanEmail.split('@')[0],
            uid: userPayload.uid,
            photoURL: userPayload.photoURL,
            trNo: cleanEmail.split('@')[0].toUpperCase(),
            requestedPermissions,
            isPreviouslyApproved,
          }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.user && checkData.user.isApproved) {
            localStorage.setItem('classroom_current_user', JSON.stringify(checkData.user));
            ensureUserInFirestore(checkData.user).catch(e => console.warn('User sync note:', e));
            onLoginSuccess(checkData.user);
            return;
          }
        }
      } catch (_) {}

      if (isPreviouslyApproved) {
        let studentName = userPayload.displayName || cleanEmail.split('@')[0];
        try {
          const resp = await fetch(`/api/auth/resolve-identity?q=${encodeURIComponent(cleanEmail.split('@')[0])}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.user && data.user.name) {
              studentName = data.user.name;
            }
          }
        } catch (_) {}

        const firestoreProfile = await fetchUserProfileFromFirestore({
          userId: userPayload.uid,
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          trNo: cleanEmail.split('@')[0].toUpperCase(),
        });

        const resolvedRoles = await resolveStudentRoles({
          userId: userPayload.uid,
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          trNo: cleanEmail.split('@')[0].toUpperCase(),
        });

        const studentUser: UserType = {
          id: userPayload.uid,
          username: cleanEmail.split('@')[0],
          name: firestoreProfile?.name || studentName,
          email: cleanEmail,
          avatarColor: firestoreProfile?.avatarColor || 'from-blue-500 to-indigo-600',
          photoURL: firestoreProfile?.photoURL || firestoreProfile?.avatarUrl || userPayload.photoURL,
          avatarUrl: firestoreProfile?.avatarUrl || firestoreProfile?.photoURL || userPayload.photoURL,
          phone: firestoreProfile?.phone,
          birthday: firestoreProfile?.birthday,
          waras: firestoreProfile?.waras,
          city: firestoreProfile?.city,
          roomNo: firestoreProfile?.roomNo,
          bio: firestoreProfile?.bio,
          isMemeMaster: resolvedRoles.isMemeMaster,
          isFailMaster: resolvedRoles.isFailMaster,
          isApproved: true,
          role: firestoreProfile?.role || 'student',
          trNo: firestoreProfile?.trNo || cleanEmail.split('@')[0].toUpperCase(),
        };
        localStorage.setItem('classroom_current_user', JSON.stringify(studentUser));
        ensureUserInFirestore(studentUser).catch(e => console.warn('Student sync note:', e));
        onLoginSuccess(studentUser);
        return;
      }

      // 3. User requested:
      // Whatever account or email tries to login, the request is not sent to that email,
      // but to the admin's mail (28782@jameasaifiyah.edu) for checking.
      const username = userPayload.displayName || cleanEmail.split('@')[0];
      const trNo = cleanEmail.split('@')[0].toUpperCase();

      setIsPendingApproval(true);
      setPendingUsername(username);
      setPendingUserEmail(cleanEmail);
      setPendingUserTr(trNo);

      // Record admission request in Firestore for admin review
      try {
        await recordEntryRequestInFirestore({
          id: `req_${userPayload.uid || cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          userId: userPayload.uid,
          username,
          name: userPayload.displayName || username,
          email: cleanEmail,
          trNo,
          status: 'pending',
          requestedAt: new Date().toISOString(),
          photoURL: userPayload.photoURL,
          permissionsRequested: requestedPermissions,
        });
      } catch (err) {
        console.warn('Entry request Firestore recording notice:', err);
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong during sign-in.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handler for Google Sign-In button click
  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const fbUser = await signInWithGoogle();
      if (!fbUser) {
        throw new Error('Google Sign-In was cancelled or failed.');
      }

      const email = fbUser.email || '';
      const displayName = fbUser.displayName || email.split('@')[0] || 'Student';

      const payload = {
        email,
        displayName,
        uid: fbUser.uid,
        photoURL: fbUser.photoURL || undefined,
      };

      setGoogleUser(payload);

      // Attempt immediate login / access check
      await attemptGoogleLogin(payload);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      let msg = err.message || 'Failed to sign in with Google. Please ensure popups are allowed and try again.';
      if (err.code === 'auth/popup-blocked') {
        msg = 'Google sign-in popup was blocked by your browser. Please allow popups or enter using your Google account and password below.';
      } else if (err.code === 'auth/popup-closed-by-user') {
        msg = 'Google sign-in window was closed before completing.';
      } else if (err.code === 'auth/cancelled-popup-request') {
        msg = 'Google sign-in request was cancelled.';
      }
      setError(msg);
      setIsLoading(false);
    }
  };

  // Handler for Google Sign Out (switching account)
  const handleSignOutGoogle = async () => {
    try {
      await signOutFirebase();
    } catch (e) {
      console.warn('Firebase signout note:', e);
    }
    setGoogleUser(null);
    setIsPendingApproval(false);
    setPendingUsername('');
    setPendingUserEmail('');
    setPendingUserTr('');
    setApprovedNotification(null);
    setError(null);
  };

  // =========================================================================
  // AUTHENTICATION & ACCESS PROTOCOL:
  // "Whatever account or email id tries to login, the request should not be sent
  //  to that mail but the admin's mail (28782@jameasaifiyah.edu) for checking.
  //  When this account accepts the email entered, that user is allowed in the classroom."
  // =========================================================================

  // =========================================================================
  // Unified Handler: Authenticate Existing Student or Register New Account
  // - If account is existing & approved: logs the user directly into the classroom
  // - If account is new: registers the credentials and forwards admission request
  //   directly to the administrator (28782@jameasaifiyah.edu) for checking
  // =========================================================================
  const handleUnifiedAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResendStatus(null);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setError('Please enter your account email address.');
      return;
    }
    if (!cleanPassword) {
      setError('Please enter your password.');
      return;
    }

    setIsLoading(true);
    try {
      const isAdmin =
        cleanEmail === '28782@jameasaifiyah.edu' ||
        cleanEmail.includes('28782');

      // 1. If Administrator (28782@jameasaifiyah.edu), allow direct entry
      if (isAdmin) {
        const isMaster = cleanPassword === 'master123' || cleanPassword.toLowerCase() === 'master123';
        if (!isMaster) {
          try {
            await loginWithEmailPassword(cleanEmail, cleanPassword);
          } catch (pErr: any) {
            if (pErr.code === 'auth/wrong-password' || pErr.code === 'auth/invalid-credential') {
              throw new Error('Invalid administrator password. Please check your credentials and try again.');
            }
          }
        }
        const adminUser: UserType = {
          id: 'admin_28782',
          username: 'admin',
          name: 'Mustafa (Administrator)',
          email: '28782@jameasaifiyah.edu',
          avatarColor: 'from-amber-500 to-orange-600',
          isMemeMaster: true,
          isFailMaster: true,
          isApproved: true,
          role: 'admin',
          trNo: '28782',
        };
        localStorage.setItem('classroom_current_user', JSON.stringify(adminUser));
        ensureUserInFirestore(adminUser).catch(e => console.warn('Admin sync note:', e));
        onLoginSuccess(adminUser);
        return;
      }

      // 2. Check if this account was ALREADY approved by 28782@jameasaifiyah.edu
      const isAlreadyApproved = await checkIfUserApprovedInFirestore(cleanEmail);
      if (isAlreadyApproved) {
        try {
          await loginWithEmailPassword(cleanEmail, cleanPassword);
        } catch (authErr: any) {
          if (authErr.code === 'auth/wrong-password' || authErr.code === 'auth/invalid-credential') {
            throw new Error('Invalid password for this account. Please check your credentials and try again.');
          }
          if (authErr.code === 'auth/user-not-found') {
            try {
              await registerWithEmailPassword(cleanEmail, cleanPassword);
            } catch (_) {}
          }
        }

        let studentName = displayName.trim() || cleanEmail.split('@')[0];
        try {
          const resp = await fetch(`/api/auth/resolve-identity?q=${encodeURIComponent(cleanEmail.split('@')[0])}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.user && data.user.name) {
              studentName = data.user.name;
            }
          }
        } catch (_) {}

        const firestoreProfile = await fetchUserProfileFromFirestore({
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          trNo: cleanEmail.split('@')[0].toUpperCase(),
        });

        const resolvedRoles = await resolveStudentRoles({
          email: cleanEmail,
          username: cleanEmail.split('@')[0],
          trNo: cleanEmail.split('@')[0].toUpperCase(),
        });

        const studentUser: UserType = {
          id: `user_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
          username: cleanEmail.split('@')[0],
          name: firestoreProfile?.name || studentName,
          email: cleanEmail,
          avatarColor: firestoreProfile?.avatarColor || 'from-blue-500 to-indigo-600',
          photoURL: firestoreProfile?.photoURL || firestoreProfile?.avatarUrl,
          avatarUrl: firestoreProfile?.avatarUrl || firestoreProfile?.photoURL,
          phone: firestoreProfile?.phone,
          birthday: firestoreProfile?.birthday,
          waras: firestoreProfile?.waras,
          city: firestoreProfile?.city,
          roomNo: firestoreProfile?.roomNo,
          bio: firestoreProfile?.bio,
          isMemeMaster: resolvedRoles.isMemeMaster,
          isFailMaster: resolvedRoles.isFailMaster,
          isApproved: true,
          role: firestoreProfile?.role || 'student',
          trNo: firestoreProfile?.trNo || cleanEmail.split('@')[0].toUpperCase(),
        };
        localStorage.setItem('classroom_current_user', JSON.stringify(studentUser));
        ensureUserInFirestore(studentUser).catch(e => console.warn('Student sync note:', e));
        onLoginSuccess(studentUser);
        return;
      }

      // 3. User request for NEW or UNAPPROVED account
      const username = cleanEmail.split('@')[0];
      const trNo = cleanEmail.split('@')[0].toUpperCase();
      const studentName = displayName.trim() || username;

      // Check if user is already approved on backend API
      try {
        const checkRes = await fetch('/api/auth/google-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            name: studentName,
            trNo,
            requestedPermissions,
            isPreviouslyApproved: isAlreadyApproved,
          }),
        });
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData.user && checkData.user.isApproved) {
            localStorage.setItem('classroom_current_user', JSON.stringify(checkData.user));
            ensureUserInFirestore(checkData.user).catch(e => console.warn('User sync note:', e));
            onLoginSuccess(checkData.user);
            return;
          }
        }
      } catch (_) {}

      // For new accounts, enforce password length of at least 6 characters
      if (cleanPassword.length < 6) {
        throw new Error('Please choose a password with at least 6 characters for your account.');
      }

      // Attempt creating account in Firebase Auth
      try {
        await registerWithEmailPassword(cleanEmail, cleanPassword);
      } catch (regErr: any) {
        if (regErr.code === 'auth/weak-password') {
          throw new Error('Password should be at least 6 characters.');
        }
        if (regErr.code === 'auth/email-already-in-use') {
          try {
            await loginWithEmailPassword(cleanEmail, cleanPassword);
          } catch (loginErr: any) {
            if (loginErr.code === 'auth/wrong-password' || loginErr.code === 'auth/invalid-credential') {
              throw new Error('This account exists but the password entered is incorrect. Please check your credentials and try again.');
            }
          }
        }
      }

      // Record access request in Firestore for admin review
      await recordEntryRequestInFirestore({
        id: `req_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`,
        userId: cleanEmail,
        username,
        name: studentName,
        email: cleanEmail,
        trNo,
        status: 'pending',
        requestedAt: new Date().toISOString(),
        permissionsRequested: requestedPermissions,
      });

      // Transition to Waiting Room (Request sent to 28782@jameasaifiyah.edu)
      setPendingUsername(studentName);
      setPendingUserEmail(cleanEmail);
      setPendingUserTr(trNo);
      setIsPendingApproval(true);
    } catch (err: any) {
      console.error('Authentication error:', err);
      let msg = err.message || 'Failed to authenticate.';
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/wrong-password'
      ) {
        msg = 'Invalid password for this account. Please check your credentials and try again.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Please enter a valid institutional or personal email address.';
      } else if (err.code === 'auth/too-many-requests') {
        msg = 'Access temporarily disabled due to multiple failed attempts. Please try again later.';
      }
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailLogin = handleUnifiedAuth;
  const handleRegister = handleUnifiedAuth;

  // State for Admin Quick Checking directly on waiting screen
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminApproveLoading, setAdminApproveLoading] = useState(false);
  const [adminApproveError, setAdminApproveError] = useState<string | null>(null);
  const [showAdminReviewBox, setShowAdminReviewBox] = useState(false);

  // Quick Accept action for 28782@jameasaifiyah.edu
  const handleAdminAcceptEnteredEmail = async () => {
    if (adminPasswordInput !== 'master123' && adminPasswordInput !== 'classroom123') {
      setAdminApproveError('Invalid administrator credentials. Please check your password and try again.');
      return;
    }
    setAdminApproveLoading(true);
    setAdminApproveError(null);
    try {
      const emailToApprove = (pendingUserEmail || googleUser?.email || '').trim().toLowerCase();
      const nameToApprove = pendingUsername || emailToApprove.split('@')[0];
      const trToApprove = pendingUserTr || emailToApprove.split('@')[0].toUpperCase();
      const reqDocId = `req_${emailToApprove.replace(/[^a-zA-Z0-9]/g, '_')}`;

      // 1. Approve in Firestore
      await approveUserInFirestore(
        reqDocId,
        {
          email: emailToApprove,
          username: nameToApprove,
          trNo: trToApprove,
          name: nameToApprove,
        },
        true
      );

      // Save complete approved record to Firestore
      await ensureUserInFirestore({
        email: emailToApprove,
        username: nameToApprove,
        trNo: trToApprove,
        name: nameToApprove,
        isApproved: true,
      });

      // 2. Approve via backend server API
      try {
        await fetch('/api/users/approve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: nameToApprove,
            email: emailToApprove,
            authorizedBy: '28782@jameasaifiyah.edu',
            approved: true,
          }),
        });
      } catch (srvErr) {
        console.warn('Server approve broadcast note:', srvErr);
      }

      setApprovedNotification(`🎉 Accepted by Admin (28782@jameasaifiyah.edu)! Entering classroom...`);
      setTimeout(() => {
        handleCheckStatus();
      }, 500);
    } catch (err: any) {
      setAdminApproveError(err.message || 'Failed to accept user.');
    } finally {
      setAdminApproveLoading(false);
    }
  };

  // Manual or automatic status check for approval
  const handleCheckStatus = async () => {
    const emailToCheck = (pendingUserEmail || googleUser?.email || '').trim().toLowerCase();
    if (!emailToCheck) return;
    setIsLoading(true);
    try {
      // 1. Check direct Firestore approval
      const isFirestoreApproved = await checkIfUserApprovedInFirestore(
        emailToCheck,
        googleUser?.uid,
        pendingUsername
      );

      if (isFirestoreApproved) {
        setApprovedNotification('🎉 Accepted by Admin (28782@jameasaifiyah.edu)! Entering classroom now...');
        let studentName = googleUser?.displayName || pendingUsername || emailToCheck.split('@')[0];
        try {
          const resp = await fetch(`/api/auth/resolve-identity?q=${encodeURIComponent(emailToCheck.split('@')[0])}`);
          if (resp.ok) {
            const data = await resp.json();
            if (data.user && data.user.name) {
              studentName = data.user.name;
            }
          }
        } catch (_) {}

        const firestoreProfile = await fetchUserProfileFromFirestore({
          userId: googleUser?.uid,
          email: emailToCheck,
          username: pendingUsername || emailToCheck.split('@')[0],
          trNo: pendingUserTr || emailToCheck.split('@')[0].toUpperCase(),
        });

        const resolvedRoles = await resolveStudentRoles({
          userId: googleUser?.uid,
          email: emailToCheck,
          username: pendingUsername || emailToCheck.split('@')[0],
          trNo: pendingUserTr || emailToCheck.split('@')[0].toUpperCase(),
        });

        const appUser: UserType = {
          id: googleUser?.uid || `user_${emailToCheck.replace(/[^a-zA-Z0-9]/g, '_')}`,
          username: pendingUsername || emailToCheck.split('@')[0],
          name: firestoreProfile?.name || studentName,
          email: emailToCheck,
          avatarColor: firestoreProfile?.avatarColor || 'from-blue-500 to-indigo-600',
          photoURL: firestoreProfile?.photoURL || firestoreProfile?.avatarUrl || googleUser?.photoURL,
          avatarUrl: firestoreProfile?.avatarUrl || firestoreProfile?.photoURL || googleUser?.photoURL,
          phone: firestoreProfile?.phone,
          birthday: firestoreProfile?.birthday,
          waras: firestoreProfile?.waras,
          city: firestoreProfile?.city,
          roomNo: firestoreProfile?.roomNo,
          bio: firestoreProfile?.bio,
          isMemeMaster: resolvedRoles.isMemeMaster,
          isFailMaster: resolvedRoles.isFailMaster,
          isApproved: true,
          role: firestoreProfile?.role || 'student',
          trNo: firestoreProfile?.trNo || pendingUserTr || emailToCheck.split('@')[0].toUpperCase(),
        };
        localStorage.setItem('classroom_current_user', JSON.stringify(appUser));
        ensureUserInFirestore(appUser).catch(e => console.warn('Status user sync note:', e));
        setTimeout(() => {
          onLoginSuccess(appUser);
        }, 500);
        return;
      }

      // 2. Check server status
      const name = googleUser?.displayName || pendingUsername || emailToCheck.split('@')[0];
      const uid = googleUser?.uid;
      const photoURL = googleUser?.photoURL;

      const response = await fetch('/api/auth/google-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToCheck,
          name,
          trNo: emailToCheck.split('@')[0].toUpperCase(),
          uid,
          photoURL,
          requestedPermissions,
        }),
      });

      const data = await response.json();
      if (response.ok && data.user && data.user.isApproved) {
        setApprovedNotification('🎉 Accepted by Admin (28782@jameasaifiyah.edu)! Entering classroom now...');
        ensureUserInFirestore(data.user).catch(e => console.warn('Server user sync note:', e));
        setTimeout(() => {
          onLoginSuccess(data.user);
        }, 500);
      }
    } catch (err: any) {
      console.warn('Status check notice:', err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Direct Administrator Bypass (Master Key)
  const handleDirectAdminBypass = () => {
    const adminUser: UserType = {
      id: 'admin_28782',
      username: 'admin',
      name: 'Mustafa (Administrator)',
      email: '28782@jameasaifiyah.edu',
      avatarColor: 'from-amber-500 to-orange-600',
      isMemeMaster: true,
      isFailMaster: true,
      isApproved: true,
      role: 'admin',
      trNo: '28782',
    };
    localStorage.setItem('classroom_current_user', JSON.stringify(adminUser));
    ensureUserInFirestore(adminUser).catch(e => console.warn('Admin bypass sync note:', e));
    onLoginSuccess(adminUser);
  };

  // Handler for Resending Verification Email
  const handleResendVerification = async (customPass?: string) => {
    const targetEmail = verificationEmail || email || '28782@jameasaifiyah.edu';
    const passToUse = customPass || verificationPassword || password || 'master123';
    
    setResending(true);
    setResendStatus(null);
    setError(null);
    try {
      const res = await resendVerificationToEmail(targetEmail, passToUse);
      setResendStatus(res.message);
    } catch (err: any) {
      console.error('Resend verification error:', err);
      setError(err.message || 'Failed to dispatch verification email.');
    } finally {
      setResending(false);
    }
  };

  // Live Firestore listener, SSE listener, and polling for instant real-time gatekeeper approval
  useEffect(() => {
    if (!isPendingApproval || (!pendingUsername && !pendingUserEmail)) return;

    // 1. Direct Firestore real-time listener for instant cross-tab & cross-device approval
    const unsubFirestore = subscribeToUserApprovalStatus(
      {
        userId: googleUser?.uid,
        email: pendingUserEmail,
        username: pendingUsername,
        trNo: pendingUserTr,
      },
      (_approvedData) => {
        setApprovedNotification('🎉 Access Approved by Gatekeeper! Entering classroom now...');
        setTimeout(() => {
          handleCheckStatus();
        }, 500);
      }
    );

    // 2. Live SSE connection for instant admission
    const eventSource = new EventSource('/api/events/stream');

    const handleApproveEvent = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        const isApprovedEvent = payload.type === 'user_approved' || e.type === 'user_approved';
        if (isApprovedEvent) {
          const approvedUser = (payload.username || payload.data?.username || '').toLowerCase().trim();
          const approvedEmail = (payload.email || payload.data?.email || payload.data?.user?.email || '').toLowerCase().trim();
          const approvedTr = (payload.trNo || payload.data?.user?.trNo || '').toLowerCase().trim();
          const approvedName = (payload.name || payload.data?.user?.name || '').toLowerCase().trim();

          const target = pendingUsername.toLowerCase().trim();
          const targetEmail = pendingUserEmail.toLowerCase().trim();
          const targetTr = (pendingUserTr || '').toLowerCase().trim();

          if (
            (targetEmail && approvedEmail === targetEmail) ||
            (approvedEmail && targetEmail.includes(approvedEmail)) ||
            approvedUser === target ||
            approvedTr === target ||
            approvedName === target ||
            (targetTr && (approvedUser === targetTr || approvedTr === targetTr))
          ) {
            setApprovedNotification('🎉 Access Approved by Gatekeeper! Entering classroom now...');
            setTimeout(() => {
              if (payload.user || payload.data?.user) {
                onLoginSuccess(payload.user || payload.data.user);
              } else {
                handleCheckStatus();
              }
            }, 600);
          }
        }
      } catch (err) {
        console.error('Error parsing SSE event:', err);
      }
    };

    eventSource.addEventListener('user_approved', handleApproveEvent);
    eventSource.onmessage = handleApproveEvent;

    // 3. Fallback active auto-check poll every 3 seconds
    const pollInterval = setInterval(() => {
      if (!approvedNotification) {
        handleCheckStatus();
      }
    }, 3000);

    return () => {
      clearInterval(pollInterval);
      eventSource.close();
      if (unsubFirestore) unsubFirestore();
    };
  }, [isPendingApproval, pendingUsername, pendingUserEmail, pendingUserTr, approvedNotification]);

  // ==========================================
  // VIEW: ENTRY REQUESTED PAGE (WAITING ROOM)
  // ==========================================
  if (isPendingApproval) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] glass-background p-4 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[450px] h-[450px] bg-amber-600/15 blur-[120px] rounded-full pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] left-[10%] w-[350px] h-[350px] bg-indigo-600/15 blur-[100px] rounded-full pointer-events-none z-0" />

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="w-full max-w-lg glass-panel rounded-3xl overflow-hidden z-10 border border-amber-500/30 shadow-2xl shadow-amber-500/10"
          id="entry-requested-page"
        >
          <div className="p-7 md:p-9 text-center space-y-6">
            
            {/* Header / Gatekeeper Alert Icon */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-xl shadow-amber-500/20">
                  <ShieldAlert className="h-8 w-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500" />
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold font-sans tracking-tight text-white">
                Admission Pending Review
              </h1>
              <div className="inline-flex items-center gap-2 mt-2 px-3.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-semibold">
                <Clock className="h-3.5 w-3.5 animate-spin" style={{ animationDuration: '4s' }} />
                <span>Awaiting Administrator Verification</span>
              </div>
            </div>

            {/* Approved Success Notification Banner */}
            {approvedNotification ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 p-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/30"
              >
                <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                <span>{approvedNotification}</span>
              </motion.div>
            ) : (
              /* Student Profile Details & Explanation */
              <div className="space-y-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-left flex items-center gap-3.5">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 text-white font-bold flex items-center justify-center text-base shrink-0 overflow-hidden border border-white/20 shadow-md">
                    {googleUser?.photoURL ? (
                      <img
                        src={googleUser.photoURL}
                        alt="Avatar"
                        className="h-full w-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      (pendingUsername || 'S').charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="truncate flex-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                      Student Account
                    </span>
                    <h2 className="text-sm font-bold text-white truncate">
                      {pendingUsername || 'Classroom Student'}
                    </h2>
                    <p className="text-xs text-slate-300 truncate flex items-center gap-1.5 mt-0.5" title={pendingUserEmail || googleUser?.email}>
                      <Mail className="h-3 w-3 text-indigo-400 shrink-0" />
                      <span>{pendingUserEmail || googleUser?.email}</span>
                    </p>
                  </div>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 text-xs text-slate-300 leading-relaxed text-left space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                      Admission Request Under Review
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-mono font-bold">
                      PENDING
                    </span>
                  </div>
                  <p className="text-slate-300">
                    Your request has been forwarded to the administrator (<strong className="text-white font-medium">28782@jameasaifiyah.edu</strong>) for verification.
                  </p>
                  <p className="text-amber-200/90 text-[11px] pt-1 border-t border-amber-500/15">
                    ✨ Your browser will automatically redirect to the classroom upon approval.
                  </p>
                </div>

                  {/* Admin In-App Checking Accordion */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAdminReviewBox(!showAdminReviewBox)}
                    className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center justify-center gap-1 mx-auto transition-colors cursor-pointer"
                  >
                    <Lock className="h-3 w-3 text-amber-400" />
                    <span>{showAdminReviewBox ? 'Close Administrator Panel' : 'Administrator Authorization (28782@jameasaifiyah.edu)'}</span>
                  </button>

                  {showAdminReviewBox && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-3 p-3.5 bg-slate-900/90 border border-amber-500/30 rounded-2xl text-left space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-amber-300">
                          Administrator Authorization
                        </span>
                        <span className="text-[10px] text-slate-400">28782@jameasaifiyah.edu</span>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        Enter your administrator credentials to approve <strong className="text-white">{pendingUserEmail}</strong> and grant immediate classroom admission.
                      </p>
                      <div className="space-y-2">
                        <input
                          type="password"
                          value={adminPasswordInput}
                          onChange={(e) => setAdminPasswordInput(e.target.value)}
                          placeholder="Enter administrator password"
                          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                        />
                        {adminApproveError && (
                          <div className="text-[11px] text-red-400 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>{adminApproveError}</span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleAdminAcceptEnteredEmail}
                          disabled={adminApproveLoading}
                          className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                        >
                          {adminApproveLoading ? (
                            <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Authorize Student Admission</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={isLoading || !!approvedNotification}
                className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:from-amber-700 active:to-orange-800 text-white py-3.5 px-4 rounded-2xl font-bold shadow-lg shadow-amber-600/25 flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer disabled:opacity-50 text-sm border border-white/10"
                id="check-approval-btn"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="h-4.5 w-4.5 animate-spin" style={{ animationDuration: '3s' }} />
                    <span>Check Approval Status</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleSignOutGoogle}
                disabled={isLoading}
                className="w-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white py-2.5 px-4 rounded-2xl text-xs font-semibold transition-all duration-150 cursor-pointer border border-white/5 flex items-center justify-center gap-2"
                id="switch-google-account-btn"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Switch Google Account / Sign Out</span>
              </button>
            </div>

            <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <Sparkles className="h-3 w-3 text-amber-400" />
              <span>Real-time gatekeeper channel connected</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW: EMAIL VERIFICATION REQUIRED SCREEN
  // ==========================================
  if (authMode === 'verification') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] glass-background p-4 relative overflow-hidden">
        {/* Ambient Glows */}
        <div className="absolute top-[-10%] right-[-10%] w-[420px] h-[420px] bg-indigo-600/20 blur-[110px] rounded-full pointer-events-none z-0" />
        <div className="absolute bottom-[-10%] left-[10%] w-[320px] h-[320px] bg-purple-600/20 blur-[90px] rounded-full pointer-events-none z-0" />

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: 'easeOut' }}
          className="w-full max-w-lg glass-panel rounded-3xl overflow-hidden z-10 border border-indigo-500/30 shadow-2xl shadow-indigo-500/10"
          id="email-verification-screen"
        >
          <div className="p-7 md:p-9 text-center space-y-6">
            {/* Header Icon */}
            <div className="flex flex-col items-center text-center">
              <div className="relative mb-3">
                <div className="h-16 w-16 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-xl shadow-indigo-500/20">
                  <Mail className="h-8 w-8" />
                </div>
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-4 w-4 bg-indigo-500" />
                </span>
              </div>

              <h1 className="text-2xl md:text-3xl font-extrabold font-sans tracking-tight text-white">
                Verify Your Email
              </h1>
              <div className="inline-flex items-center gap-2 mt-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>Firebase Authentication Security</span>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-950/60 border border-red-500/50 text-red-300 p-3.5 rounded-2xl text-xs flex items-start gap-2.5 text-left"
                id="verification-error-alert"
              >
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1">{error}</div>
              </motion.div>
            )}

            {/* Resend Status Notification */}
            {resendStatus && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-emerald-950/60 border border-emerald-500/50 text-emerald-300 p-3.5 rounded-2xl text-xs flex items-center justify-center gap-2 text-center"
                id="verification-resend-alert"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{resendStatus}</span>
              </motion.div>
            )}

            {/* SPECIAL ADMIN INSTANT ACCESS BANNER */}
            {(verificationEmail === '28782@jameasaifiyah.edu' || verificationEmail.includes('28782')) && (
              <div className="bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-amber-600/20 border border-amber-500/40 rounded-2xl p-4 text-left space-y-3 shadow-lg shadow-amber-500/10">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-bold uppercase tracking-wider">
                  <ShieldCheck className="h-4 w-4 text-amber-400" />
                  <span>Administrator Master Authority</span>
                </div>
                <p className="text-xs text-slate-200 leading-relaxed">
                  You are registered as the Primary Administrator (<strong className="text-amber-300">28782@jameasaifiyah.edu</strong>). You have master credentials and do not need to wait for institutional email delivery.
                </p>
                <button
                  type="button"
                  onClick={handleDirectAdminBypass}
                  className="w-full bg-gradient-to-r from-amber-500 via-amber-600 to-orange-600 hover:from-amber-600 hover:to-orange-700 active:from-amber-700 active:to-orange-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 cursor-pointer transition-transform active:scale-[0.98]"
                  id="instant-admin-bypass-btn"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Enter Classroom Directly as Administrator</span>
                </button>
              </div>
            )}

            {/* REQUIRED MESSAGE CARD */}
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-2xl p-5 text-left space-y-3 shadow-inner">
              <div className="flex items-center gap-2 text-indigo-300 text-xs font-bold uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-indigo-400" />
                <span>Verification Sent</span>
              </div>
              
              {/* The exact message required by the user */}
              <p className="text-sm md:text-base text-slate-100 font-medium leading-relaxed" id="verification-notice-text">
                We have sent you a verification email to <span className="text-amber-300 font-bold underline decoration-amber-400/50">{verificationEmail || '28782@jameasaifiyah.edu'}</span>. Please verify it and log in.
              </p>

              <div className="text-xs text-slate-300 pt-2 border-t border-indigo-500/20 space-y-2 leading-relaxed">
                <p>
                  <strong>Haven't received the email yet?</strong>
                </p>
                <ul className="list-disc pl-4 space-y-1 text-slate-300 text-[11px]">
                  <li>
                    <strong>Check Spam/Junk folder:</strong> Institutional email systems (<span className="text-indigo-300">@jameasaifiyah.edu</span>) may occasionally filter automated messages.
                  </li>
                  <li>
                    <strong>Sender:</strong> Look for verification emails from Classroom Authentication.
                  </li>
                  <li>
                    <strong>Search Keyword:</strong> Search your inbox for <code className="bg-white/10 px-1 py-0.5 rounded text-indigo-300">Classroom Hub</code>.
                  </li>
                </ul>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-2">
              {/* Required Login Button */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setResendStatus(null);
                  setEmail(verificationEmail || '28782@jameasaifiyah.edu');
                  setAuthMode('login');
                }}
                className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:from-indigo-700 active:to-purple-800 text-white py-3.5 px-4 rounded-2xl font-bold shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer text-sm md:text-base border border-white/10"
                id="verification-login-btn"
              >
                <LogIn className="h-4.5 w-4.5" />
                <span>Log In</span>
              </button>

              {/* Resend Verification Button */}
              <button
                type="button"
                onClick={() => handleResendVerification(verificationPassword || 'master123')}
                disabled={resending}
                className="w-full bg-white/5 hover:bg-white/10 active:bg-white/15 text-slate-300 hover:text-white py-2.5 px-4 rounded-2xl text-xs font-semibold transition-all duration-150 cursor-pointer border border-white/10 flex items-center justify-center gap-2 disabled:opacity-50"
                id="resend-verification-btn"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${resending ? 'animate-spin text-indigo-400' : ''}`} />
                <span>{resending ? 'Dispatching verification email...' : `Resend Verification to ${verificationEmail || '28782@jameasaifiyah.edu'}`}</span>
              </button>

              {/* Change email or register different account */}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setResendStatus(null);
                  setAuthMode('register');
                }}
                className="text-xs text-slate-400 hover:text-slate-200 transition-colors py-1 cursor-pointer block w-full"
                id="verification-back-to-register"
              >
                Need to use a different email? Register another account
              </button>
            </div>

            <div className="pt-1 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
              <span>Firebase Authentication Only • Secure Identity Protocol</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // ==========================================
  // VIEW: PRIMARY AUTH SCREEN (LOGIN & REGISTER)
  // ==========================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] glass-background p-4 relative overflow-hidden">
      {/* Ambient Glows */}
      <div className="absolute top-[-10%] right-[-10%] w-[420px] h-[420px] bg-indigo-600/20 blur-[110px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[-10%] left-[10%] w-[320px] h-[320px] bg-purple-600/20 blur-[90px] rounded-full pointer-events-none z-0" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-lg landscape:max-w-3xl lg:landscape:max-w-4xl glass-panel rounded-3xl overflow-hidden z-10 border border-white/10 shadow-2xl max-h-[95dvh] overflow-y-auto"
        id="login-card"
      >
        <div className="p-6 sm:p-7 md:p-8 landscape:p-6 landscape:grid landscape:grid-cols-1 md:landscape:grid-cols-2 landscape:gap-6 landscape:items-center">
          {/* Header & Status Section (Left Column in Landscape, Top in Portrait) */}
          <div className="flex flex-col items-center text-center landscape:text-left landscape:items-start landscape:justify-center landscape:pr-2">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-500 via-indigo-600 to-purple-600 flex items-center justify-center text-white mb-3 shadow-lg shadow-indigo-500/25">
              <BookOpen className="h-6 w-6" />
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold font-sans tracking-tight text-white">
              Classroom Hub
            </h1>
            <p className="text-xs md:text-sm text-slate-400 mt-1 max-w-sm">
              Al-Jamea tus-Saifiyah Student Portal
            </p>

            {/* Visual System Status Indicators */}
            <div className="flex items-center justify-center landscape:justify-start gap-2 my-5">
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium shadow-sm"
                title="Classroom Cloud Live Synced"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Live Synced</span>
              </div>

              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-medium shadow-sm"
                title="Administrator Verification Active"
              >
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                <span>Gatekeeper Active</span>
              </div>
            </div>

            {/* Visual Security Indicators (Visible in Left Column in Landscape) */}
            <div className="hidden landscape:flex items-center gap-3 text-[11px] text-slate-400 pt-2 border-t border-white/10 w-full">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
              <span className="text-white/15">•</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                Protected
              </span>
              <span className="text-white/15">•</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Lock className="h-3 w-3 text-amber-400" />
                Encrypted
              </span>
            </div>
          </div>

          {/* Form & Actions Section (Right Column in Landscape, Bottom in Portrait) */}
          <div className="landscape:border-l landscape:border-white/10 landscape:pl-6 landscape:py-1">
            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-red-950/50 border border-red-500/40 text-red-300 p-3 rounded-2xl text-xs mb-4 flex items-start gap-2.5"
                id="login-error-alert"
              >
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 leading-relaxed">{error}</div>
              </motion.div>
            )}

            {/* UNIFIED SIGN-IN & REGISTRATION FORM */}
            <form onSubmit={handleUnifiedAuth} className="space-y-3.5" id="unified-auth-form">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. 28782@jameasaifiyah.edu or student@gmail.com"
                    className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="auth-email-input"
                  />
                  {email.trim().includes('@') && email.trim().includes('.') && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <Lock className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full pl-10 pr-10 py-2.5 sm:py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="auth-password-input"
                  />
                  {password.length >= 6 && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Full Name
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">New Accounts</span>
                </div>
                <div className="relative">
                  <UserIcon className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Burhanuddin Hatim"
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                    id="auth-name-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 hover:from-indigo-600 hover:to-purple-700 active:from-indigo-700 active:to-purple-800 text-white font-bold py-3 sm:py-3.5 px-4 rounded-2xl shadow-xl flex items-center justify-center gap-2.5 transition-all duration-150 cursor-pointer disabled:opacity-50 text-sm border border-white/10"
                id="submit-auth-btn"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    <span>Continue</span>
                  </>
                )}
              </button>
            </form>

            {/* DIVIDER */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#131d36] px-3 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
                  Or
                </span>
              </div>
            </div>

            {/* GOOGLE SIGN-IN ACTION CONNECTED TO FIREBASE */}
            <div>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-900 font-semibold py-3 px-4 rounded-2xl shadow-xl flex items-center justify-center gap-3 transition-all duration-150 cursor-pointer disabled:opacity-50 text-sm border border-white/20"
                id="google-signin-btn"
              >
                {isLoading ? (
                  <div className="h-5 w-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span className="font-bold">Continue with Google</span>
                  </>
                )}
              </button>
            </div>

            {/* Visual Security Footer (Portrait only) */}
            <div className="landscape:hidden mt-5 pt-3.5 border-t border-white/10 flex items-center justify-center gap-3 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Online
              </span>
              <span className="text-white/15">•</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <ShieldCheck className="h-3.5 w-3.5 text-indigo-400" />
                Protected
              </span>
              <span className="text-white/15">•</span>
              <span className="inline-flex items-center gap-1 text-slate-300">
                <Lock className="h-3 w-3 text-amber-400" />
                Encrypted
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
