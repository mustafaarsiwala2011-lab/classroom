/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

export async function signInWithGoogle() {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signOutFirebase() {
  await fbSignOut(auth);
}

/**
 * Register a new user with Email and Password using Firebase Auth only.
 * Does NOT sign the user in automatically (signs out immediately).
 * Sends an email verification.
 */
export async function registerWithEmailPassword(email: string, pass: string): Promise<FirebaseUser> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
  // Send email verification to the registered user
  await sendEmailVerification(cred.user);
  // User requested: "When a user registers with email/password, do not sign them in automatically."
  await fbSignOut(auth);
  return cred.user;
}

/**
 * Sign in with Email and Password using Firebase Auth only.
 * If user's email is not verified, blocks access by signing out and returning verified: false.
 */
export async function loginWithEmailPassword(email: string, pass: string): Promise<{
  user: FirebaseUser;
  emailVerified: boolean;
}> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), pass);
  if (!cred.user.emailVerified) {
    // If not verified, block access and sign out immediately
    await fbSignOut(auth);
    return { user: cred.user, emailVerified: false };
  }
  return { user: cred.user, emailVerified: true };
}

/**
 * Resend verification email for an unverified email account using Firebase Auth only.
 * Handles both existing accounts and new accounts.
 */
export async function resendVerificationToEmail(email: string, pass: string): Promise<{ success: boolean; message: string }> {
  const cleanEmail = email.trim();
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, pass);
    await sendEmailVerification(cred.user);
    await fbSignOut(auth);
    return {
      success: true,
      message: `Verification email dispatched to ${cleanEmail} from noreply@gen-lang-client-0916993726.firebaseapp.com. Please check your Inbox and Spam/Junk folder.`,
    };
  } catch (err: any) {
    if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
      // Try registering account if it doesn't exist yet
      try {
        const newCred = await createUserWithEmailAndPassword(auth, cleanEmail, pass);
        await sendEmailVerification(newCred.user);
        await fbSignOut(auth);
        return {
          success: true,
          message: `Account created and verification email dispatched to ${cleanEmail} from noreply@gen-lang-client-0916993726.firebaseapp.com. Please check your Inbox and Spam/Junk folder.`,
        };
      } catch (regErr: any) {
        throw new Error(regErr.message || 'Failed to dispatch verification email.');
      }
    }
    if (err.code === 'auth/too-many-requests') {
      throw new Error('Firebase security rate-limit: Multiple verification requests sent recently. Please wait a few minutes, or use Admin Instant Master Login.');
    }
    throw err;
  }
}

export async function updateFirebaseUserProfile(displayName: string, photoURL?: string): Promise<void> {
  if (auth.currentUser) {
    const profileUpdates: { displayName: string; photoURL?: string } = {
      displayName: displayName.trim(),
    };
    // Firebase Auth photoURL requires a valid HTTP(S) URL and has a ~2048 character limit
    if (photoURL && (photoURL.startsWith('http://') || photoURL.startsWith('https://')) && photoURL.length < 2048) {
      profileUpdates.photoURL = photoURL;
    }
    try {
      await updateProfile(auth.currentUser, profileUpdates);
    } catch (err) {
      console.warn('Firebase Auth updateProfile notice:', err);
    }
  }
}

export { 
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
};
export type { FirebaseUser };
