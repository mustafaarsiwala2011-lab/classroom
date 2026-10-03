/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  getDoc,
  getDocs,
  query,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { ChatMessage, MessageReaction } from '../types';

const CHAT_COLLECTION = 'chat_messages';

/**
 * Real-time subscription to classroom chat messages via Firestore.
 * Automatically synchronizes across all users, browser tabs, and shared app URLs.
 */
export function subscribeToClassroomChat(
  callback: (messages: ChatMessage[]) => void,
  onError?: (err: Error) => void
): () => void {
  try {
    const chatRef = collection(db, CHAT_COLLECTION);
    const q = query(chatRef, limit(300));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const msgs: ChatMessage[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          msgs.push({
            id: docSnap.id,
            conversationId: data.conversationId || 'conv_general',
            userId: data.userId || 'unknown',
            username: data.username || 'Student',
            displayName: data.displayName || data.name || data.username || 'Classmate',
            avatarColor: data.avatarColor || 'from-indigo-500 to-purple-600',
            photoURL: data.photoURL || data.avatarUrl || undefined,
            avatarUrl: data.avatarUrl || data.photoURL || undefined,
            text: data.text || '',
            timestamp: data.timestamp || new Date().toISOString(),
            type: data.type || 'text',
            attachmentUrl: data.attachmentUrl || undefined,
            fileName: data.fileName || undefined,
            fileSize: data.fileSize || undefined,
            replyTo: data.replyTo || null,
            reactions: Array.isArray(data.reactions) ? data.reactions : [],
            edited: Boolean(data.edited),
            deleted: Boolean(data.deleted),
            status: data.status || (Array.isArray(data.readBy) && data.readBy.some((r: any) => r.user !== data.userId) ? 'read' : 'delivered'),
            deliveredAt: data.deliveredAt || data.timestamp,
            readBy: Array.isArray(data.readBy) ? data.readBy : [],
          });
        });

        // Sort chronologically ascending
        msgs.sort((a, b) => {
          const timeA = new Date(a.timestamp).getTime() || 0;
          const timeB = new Date(b.timestamp).getTime() || 0;
          return timeA - timeB;
        });

        callback(msgs);
      },
      (error) => {
        console.warn('Firestore chat onSnapshot error (falling back to backend API):', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (err: any) {
    console.warn('Error setting up Firestore chat subscription:', err);
    if (onError) onError(err);
    return () => {};
  }
}

/**
 * Send a chat message to Firestore and sync to backend API.
 */
export async function sendChatMessage(
  messageData: {
    userId: string;
    username: string;
    displayName?: string;
    avatarColor?: string;
    photoURL?: string;
    avatarUrl?: string;
    text: string;
    type?: 'text' | 'image' | 'audio' | 'video' | 'file';
    attachmentUrl?: string;
    fileName?: string;
    fileSize?: number;
    replyTo?: { id: string; text: string; username: string } | null;
    conversationId?: string;
  }
): Promise<ChatMessage> {
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const now = new Date().toISOString();

  const resolvedPhoto = messageData.photoURL || messageData.avatarUrl;

  const newMsg: ChatMessage = {
    id: msgId,
    conversationId: messageData.conversationId || 'conv_general',
    userId: messageData.userId,
    username: messageData.username,
    displayName: messageData.displayName || messageData.username,
    avatarColor: messageData.avatarColor || 'from-indigo-500 to-purple-600',
    photoURL: resolvedPhoto,
    avatarUrl: resolvedPhoto,
    text: messageData.text || '',
    timestamp: now,
    type: messageData.type || 'text',
    attachmentUrl: messageData.attachmentUrl,
    fileName: messageData.fileName,
    fileSize: messageData.fileSize,
    replyTo: messageData.replyTo || null,
    reactions: [],
    edited: false,
    deleted: false,
    status: 'delivered',
    deliveredAt: now,
    readBy: [{
      user: messageData.userId,
      userName: messageData.displayName || messageData.username,
      readAt: now,
    }],
  };

  // Clean undefined values so Firestore setDoc never rejects with Unsupported field value
  const firestoreCleanPayload: Record<string, any> = {};
  for (const [k, v] of Object.entries(newMsg)) {
    if (v !== undefined) {
      firestoreCleanPayload[k] = v;
    }
  }

  // 1. Write to Firestore for instant global real-time propagation
  try {
    const docRef = doc(db, CHAT_COLLECTION, msgId);
    await setDoc(docRef, firestoreCleanPayload);
  } catch (fsErr) {
    console.warn('Firestore write warning:', fsErr);
  }

  // 2. Dual-write to backend API for persistence in search and telemetry
  try {
    await fetch('/api/chat/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newMsg,
        id: msgId,
      }),
    });
  } catch (apiErr) {
    // Non-blocking
  }

  return newMsg;
}

/**
 * Edit a message in Firestore and sync to backend.
 */
export async function editChatMessage(
  messageId: string,
  updatedText: string,
  userId: string
): Promise<void> {
  try {
    const docRef = doc(db, CHAT_COLLECTION, messageId);
    await updateDoc(docRef, {
      text: updatedText,
      edited: true,
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Firestore edit warning:', err);
  }

  try {
    await fetch(`/api/chat/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: updatedText,
        userId,
      }),
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Delete a message in Firestore and sync to backend.
 * Enforces strictly: only the author who typed the message can delete it.
 */
export async function deleteChatMessage(
  messageId: string,
  userOrId: { id: string; username?: string; email?: string } | string
): Promise<boolean> {
  const userId = typeof userOrId === 'string' ? userOrId : userOrId.id;
  const username = typeof userOrId === 'object' ? userOrId.username : undefined;
  const email = typeof userOrId === 'object' ? userOrId.email : undefined;

  try {
    const docRef = doc(db, CHAT_COLLECTION, messageId);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      // Ensure only the person who typed the message can delete it
      const isAuthor =
        (userId && (data.userId === userId || String(data.userId).toLowerCase() === userId.toLowerCase())) ||
        (username && data.username && String(data.username).toLowerCase() === username.toLowerCase()) ||
        (email && data.username && String(data.username).toLowerCase() === email.toLowerCase());

      if (!isAuthor) {
        console.warn('Blocked deletion: Only the author who typed this message can delete it.');
        return false;
      }
      await deleteDoc(docRef);
    }
  } catch (err) {
    console.warn('Firestore delete warning:', err);
  }

  try {
    const res = await fetch(`/api/chat/messages/${messageId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, username, email }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      console.warn('Server delete response error:', data.error);
    }
    return true;
  } catch (err) {
    console.warn('Error deleting message from server:', err);
    return false;
  }
}

/**
 * Toggle an emoji reaction on a message in Firestore and backend.
 */
export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
  userId: string,
  userName: string
): Promise<void> {
  try {
    const docRef = doc(db, CHAT_COLLECTION, messageId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentReactions: MessageReaction[] = Array.isArray(data.reactions) ? [...data.reactions] : [];

      const existingIndex = currentReactions.findIndex(
        (r) => r.user === userId && r.emoji === emoji
      );

      if (existingIndex >= 0) {
        // Remove reaction
        currentReactions.splice(existingIndex, 1);
      } else {
        // Add reaction
        currentReactions.push({
          user: userId,
          userName: userName || 'Student',
          emoji,
          createdAt: new Date().toISOString(),
        });
      }

      await updateDoc(docRef, { reactions: currentReactions });
    }
  } catch (err) {
    console.warn('Firestore reaction warning:', err);
  }

  try {
    await fetch(`/api/chat/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji, userId, username: userName }),
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Update message delivery or read status across Firestore and backend.
 */
export async function updateChatMessageStatusInFirestore(
  messageId: string,
  status: 'sent' | 'delivered' | 'read'
): Promise<void> {
  try {
    const docRef = doc(db, CHAT_COLLECTION, messageId);
    const updateData: any = { status };
    if (status === 'delivered') {
      updateData.deliveredAt = new Date().toISOString();
    }
    await updateDoc(docRef, updateData);
  } catch (err) {
    console.warn('Firestore update status warning:', err);
  }

  try {
    await fetch(`/api/chat/messages/${messageId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  } catch (err) {
    // Non-blocking
  }
}

/**
 * Delete all messages from Firestore (for chat resets/cleanup)
 */
export async function clearAllChatMessages(): Promise<void> {
  try {
    const q = query(collection(db, CHAT_COLLECTION));
    const snapshot = await getDocs(q);
    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    console.warn('Error clearing Firestore chat:', err);
  }
}

/**
 * Mark messages as read by the current user across Firestore and Backend API
 */
export async function markMessagesAsReadInFirestore(
  messages: ChatMessage[],
  currentUser: { id: string; name?: string; username: string }
): Promise<string[]> {
  if (!messages || messages.length === 0 || !currentUser?.id) return [];

  // Filter messages that were not authored by the current user and haven't been marked read by them
  const unreadMessages = messages.filter((m) => {
    if (!m || !m.id || m.deleted) return false;
    if (m.userId === currentUser.id) return false;
    const hasRead = Array.isArray(m.readBy) && m.readBy.some((r) => r.user === currentUser.id);
    return !hasRead;
  });

  if (unreadMessages.length === 0) return [];

  const now = new Date().toISOString();
  const userName = currentUser.name || currentUser.username || 'Classmate';
  const updatedIds: string[] = [];

  // 1. Update Firestore docs in parallel (limit to 25 to avoid burst rate)
  const batchTargets = unreadMessages.slice(0, 25);
  await Promise.allSettled(
    batchTargets.map(async (msg) => {
      try {
        const docRef = doc(db, CHAT_COLLECTION, msg.id);
        const currentReadBy = Array.isArray(msg.readBy) ? [...msg.readBy] : [];
        if (!currentReadBy.some((r) => r.user === currentUser.id)) {
          currentReadBy.push({
            user: currentUser.id,
            userName,
            readAt: now,
          });
          await updateDoc(docRef, {
            readBy: currentReadBy,
            status: 'read',
          });
          updatedIds.push(msg.id);
        }
      } catch (err) {
        // Non-blocking Firestore update failure
      }
    })
  );

  // 2. Dual-notify backend to sync in-memory cache and broadcast SSE event
  try {
    await fetch('/api/chat/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: 'conv_general',
        userId: currentUser.id,
        userName,
        messageIds: unreadMessages.map((m) => m.id),
      }),
    });
  } catch (apiErr) {
    // Non-blocking
  }

  return updatedIds;
}


