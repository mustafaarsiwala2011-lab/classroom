/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Send,
  Smile,
  RefreshCw,
  Vote,
  Mic,
  Paperclip,
  X,
  Image as ImageIcon,
  ZoomIn,
  Play,
  Check,
  CheckCheck,
  Clock,
  Info,
  Reply,
  Edit2,
  Trash2,
  Users,
  Search,
  Volume2,
  MoreVertical,
  Filter,
  RotateCcw,
  User as UserIcon,
} from 'lucide-react';
import { ChatMessage, User } from '../types';
import MediaZoomModal from './MediaZoomModal';
import Polls from './Polls';
import { useRealtimeEvents } from '../hooks/useRealtimeEvents';
import {
  subscribeToClassroomChat,
  sendChatMessage as sendChatMessageToFirestore,
  editChatMessage as editChatMessageInFirestore,
  deleteChatMessage as deleteChatMessageFromFirestore,
  toggleMessageReaction as toggleReactionInFirestore,
  markMessagesAsReadInFirestore,
} from '../lib/chatFirestore';

interface ChatSectionProps {
  currentUser: User;
}

const QUICK_EMOJIS = ['😂', '❤️', '🔥', '👍', '😮', '👏', '💀', '💯'];

export default function ChatSection({ currentUser }: ChatSectionProps) {
  // Messages state - Single unified classroom chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showPolls, setShowPolls] = useState(false);
  const [showSearchInChat, setShowSearchInChat] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [selectedSenderFilter, setSelectedSenderFilter] = useState<string>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Replying & Editing state
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
  const [activeMenuMessageId, setActiveMenuMessageId] = useState<string | null>(null);

  // Presence & Typing state
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([]);
  const [activeTypers, setActiveTypers] = useState<{ userId: string; username: string; displayName: string }[]>([]);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);

  // Media & Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [previewFile, setPreviewFile] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [previewFileName, setPreviewFileName] = useState<string>('');

  // Emoji Popover
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Message Info & Read Receipts Modal state
  const [selectedMessageForInfo, setSelectedMessageForInfo] = useState<ChatMessage | null>(null);

  // Zoom Modal state
  const [zoomOpen, setZoomOpen] = useState(false);
  const [zoomUrl, setZoomUrl] = useState('');
  const [zoomType, setZoomType] = useState('');
  const [zoomName, setZoomName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const CONV_ID = 'conv_general';

  // Helper to deduplicate messages and merge read receipts & reaction updates
  const deduplicate = (msgs: ChatMessage[]): ChatMessage[] => {
    const map = new Map<string, ChatMessage>();

    for (const m of msgs) {
      if (!m || m.deleted) continue;
      const existing = map.get(m.id);
      if (!existing) {
        map.set(m.id, m);
      } else {
        // Merge read receipts safely
        const combinedReadBy = [
          ...(existing.readBy || []),
          ...(m.readBy || []),
        ];
        const uniqueReadBy = Array.from(
          new Map(combinedReadBy.map((r) => [r.user, r])).values()
        );

        // Status rank hierarchy: read (4) > delivered (3) > sent (2) > sending (1)
        const statusRank: Record<string, number> = {
          read: 4,
          delivered: 3,
          sent: 2,
          sending: 1,
        };
        const curStatus = existing.status || 'delivered';
        const incStatus = m.status || 'delivered';
        let resolvedStatus: 'sending' | 'sent' | 'delivered' | 'read' =
          (statusRank[incStatus] || 0) >= (statusRank[curStatus] || 0) ? incStatus : curStatus;

        // If readBy contains any student other than the message author, mark status as read
        if (uniqueReadBy.some((r) => r.user !== m.userId)) {
          resolvedStatus = 'read';
        }

        map.set(m.id, {
          ...existing,
          ...m,
          status: resolvedStatus,
          deliveredAt: m.deliveredAt || existing.deliveredAt || (resolvedStatus === 'delivered' || resolvedStatus === 'read' ? (m.timestamp || existing.timestamp) : undefined),
          readBy: uniqueReadBy.length > 0 ? uniqueReadBy : (m.readBy || existing.readBy),
          reactions: (m.reactions && m.reactions.length >= (existing.reactions?.length || 0)) ? m.reactions : existing.reactions,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => (new Date(a.timestamp).getTime() || 0) - (new Date(b.timestamp).getTime() || 0)
    );
  };

  const uniqueMessages = useMemo(() => deduplicate(messages), [messages]);

  // Helper to check if current user is the author who typed this message
  const isMessageOwner = (msg: ChatMessage) => {
    if (!msg || !currentUser) return false;
    const currentName = (currentUser.name || '').trim().toLowerCase();
    const currentUname = (currentUser.username || '').trim().toLowerCase();
    const currentEmail = (currentUser.email || '').trim().toLowerCase();
    const currentId = (currentUser.id || '').trim().toLowerCase();
    const currentTr = (currentUser.trNo || '').trim().toLowerCase();

    const msgUname = (msg.username || '').trim().toLowerCase();
    const msgDName = (msg.displayName || '').trim().toLowerCase();
    const msgUserId = (msg.userId || '').trim().toLowerCase();

    // STRICT CHECK: Only the person who typed this message can own or delete it
    if (msg.userId && (msg.userId === currentUser.id || msgUserId === currentId)) {
      return true;
    }
    if (msgUname && (msgUname === currentUname || (currentTr && msgUname === currentTr) || (currentEmail && msgUname === currentEmail))) {
      return true;
    }
    if (currentName && msgDName && msgDName === currentName && (msgUname === currentUname || !msgUname)) {
      return true;
    }
    return false;
  };

  // -------------------------------------------------------------
  // Fetch Messages for Classroom Chat
  // -------------------------------------------------------------
  const fetchMessages = async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const res = await fetch(`/api/chat/messages?conversationId=${CONV_ID}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.messages)) {
          setMessages(prev => deduplicate([...prev, ...data.messages]));
        }
      }
    } catch (err) {
      console.error('Error fetching chat messages:', err);
    } finally {
      if (!silent) setIsRefreshing(false);
    }
  };

  // -------------------------------------------------------------
  // Presence Heartbeat & Typers polling
  // -------------------------------------------------------------
  const sendPresenceHeartbeat = async () => {
    try {
      const res = await fetch('/api/chat/presence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, username: currentUser.username }),
      });
      if (res.ok) {
        const data = await res.json();
        setOnlineUserIds(data.onlineUserIds || []);
      }
    } catch (err) {
      // ignore
    }
  };

  const fetchTypers = async () => {
    try {
      const res = await fetch(`/api/chat/typing/${CONV_ID}`);
      if (res.ok) {
        const data = await res.json();
        const othersTyping = (data.typers || []).filter(
          (t: { userId: string }) => t.userId !== currentUser.id
        );
        setActiveTypers(othersTyping);
      }
    } catch (err) {
      // ignore
    }
  };

  // -------------------------------------------------------------
  // Lifecycle Effects & Real-Time Sync
  // -------------------------------------------------------------
  useEffect(() => {
    // 1. Subscribe to real-time Firestore chat messages across all shared users & devices
    const unsubscribeFirestore = subscribeToClassroomChat((firestoreMsgs) => {
      if (firestoreMsgs && firestoreMsgs.length > 0) {
        setMessages(prev => deduplicate([...prev, ...firestoreMsgs]));
      }
    });

    // 2. Also fetch initial backend messages
    fetchMessages();
    sendPresenceHeartbeat();

    // 3. Keep presence and fallback sync active
    const interval = setInterval(() => {
      fetchTypers();
      sendPresenceHeartbeat();
    }, 3000);

    return () => {
      unsubscribeFirestore();
      clearInterval(interval);
    };
  }, [currentUser.id]);

  // Real-time instant message sync via SSE
  useRealtimeEvents({
    message_created: ({ message }) => {
      if (!message) return;
      const targetConv = message.conversationId || 'conv_general';
      if (targetConv === CONV_ID || targetConv === 'general') {
        setMessages(prev => deduplicate([...prev, message]));
      }
    },
    chat_message_created: ({ message }) => {
      if (!message) return;
      const targetConv = message.conversationId || 'conv_general';
      if (targetConv === CONV_ID || targetConv === 'general') {
        setMessages(prev => deduplicate([...prev, message]));
      }
    },
    message_updated: ({ message }) => {
      if (!message) return;
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
    },
    chat_message_updated: ({ message }) => {
      if (!message) return;
      setMessages(prev => prev.map(m => m.id === message.id ? message : m));
    },
    message_status_updated: ({ messageId, status, deliveredAt, message }: any) => {
      const targetId = messageId || message?.id;
      if (!targetId) return;
      setMessages(prev =>
        prev.map(m =>
          m.id === targetId
            ? {
                ...m,
                status: status || message?.status || m.status,
                deliveredAt: deliveredAt || message?.deliveredAt || m.deliveredAt,
              }
            : m
        )
      );
    },
    message_delivered: ({ messageId, deliveredAt }: any) => {
      if (!messageId) return;
      setMessages(prev =>
        prev.map(m =>
          m.id === messageId
            ? {
                ...m,
                status: m.status === 'read' ? 'read' : 'delivered',
                deliveredAt: deliveredAt || m.deliveredAt || new Date().toISOString(),
              }
            : m
        )
      );
    },
    message_deleted: ({ id }) => {
      if (id) {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    },
    chat_message_deleted: ({ id }) => {
      if (id) {
        setMessages(prev => prev.filter(m => m.id !== id));
      }
    },
    reaction_updated: ({ messageId, reactions, message }) => {
      if (message) {
        setMessages(prev => prev.map(m => m.id === message.id ? message : m));
      } else if (messageId && reactions) {
        setMessages(prev => prev.map(m => m.id === messageId ? { ...m, reactions } : m));
      }
    },
    messages_read: ({ messageIds, userId, userName, readAt }: any) => {
      if (!messageIds || !Array.isArray(messageIds) || !userId) return;
      const targetIds = new Set(messageIds);
      setMessages((prev) =>
        prev.map((m) => {
          if (targetIds.has(m.id)) {
            const currentReadBy = m.readBy || [];
            if (!currentReadBy.some((r) => r.user === userId)) {
              return {
                ...m,
                status: 'read',
                readBy: [
                  ...currentReadBy,
                  {
                    user: userId,
                    userName: userName || 'Classmate',
                    readAt: readAt || new Date().toISOString(),
                  },
                ],
              };
            }
          }
          return m;
        })
      );
    },
  }, currentUser?.id, currentUser?.username);

  // Auto-mark incoming unread messages as read by current user
  const markedMessageIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!currentUser?.id || uniqueMessages.length === 0) return;

    const unread = uniqueMessages.filter(
      (m) =>
        m.id &&
        !m.id.startsWith('temp_') &&
        m.userId !== currentUser.id &&
        !markedMessageIdsRef.current.has(m.id) &&
        (!m.readBy || !m.readBy.some((r) => r.user === currentUser.id))
    );

    if (unread.length === 0) return;

    // Track to prevent rapid redundant calls
    unread.forEach((m) => markedMessageIdsRef.current.add(m.id));

    const timeout = setTimeout(() => {
      markMessagesAsReadInFirestore(unread, {
        id: currentUser.id,
        name: currentUser.name,
        username: currentUser.username,
      }).catch((err) => console.warn('Failed to mark messages as read:', err));
    }, 500);

    return () => clearTimeout(timeout);
  }, [uniqueMessages, currentUser.id]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [uniqueMessages.length]);

  // Close menus on click outside
  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuMessageId(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  // Handle typing notification
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: CONV_ID,
          userId: currentUser.id,
          username: currentUser.username,
          displayName: currentUser.name || currentUser.username,
          isTyping: true,
        }),
      }).catch(() => {});
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      fetch('/api/chat/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: CONV_ID,
          userId: currentUser.id,
          isTyping: false,
        }),
      }).catch(() => {});
    }, 2000);
  };

  // -------------------------------------------------------------
  // Voice Recording Logic
  // -------------------------------------------------------------
  const startRecording = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      if (
        window.confirm(
          'Microphone recording is simulated in this browser preview. Send sample voice note?'
        )
      ) {
        const mockAudioBase64 =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
        sendAttachment(mockAudioBase64, 'audio', 'voice_note.wav');
      }
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        stream.getTracks().forEach((track) => track.stop());

        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          sendAttachment(reader.result as string, 'audio', 'voice_note.ogg');
        };
      };
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Recording error:', err);
      if (
        window.confirm(
          'Microphone access unavailable in this environment. Would you like to send a sample Voice Note?'
        )
      ) {
        const mockAudioBase64 =
          'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';
        sendAttachment(mockAudioBase64, 'audio', 'voice_note.wav');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const cancelRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  // -------------------------------------------------------------
  // File change handler
  // -------------------------------------------------------------
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const type = file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : 'image';
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewFile(reader.result as string);
        setPreviewFileType(type);
        setPreviewFileName(file.name);
      };
      reader.readAsDataURL(file);
    }
  };

  // -------------------------------------------------------------
  // Send attachment or text message
  // -------------------------------------------------------------
  const sendAttachment = async (
    data: string,
    type: 'image' | 'audio' | 'video' | 'file',
    fileName = 'attachment'
  ) => {
    setIsSending(true);
    let placeholderText = '[Photo]';
    if (type === 'audio') placeholderText = '[Voice Note]';
    if (type === 'video') placeholderText = '[Video]';
    if (type === 'file') placeholderText = `[File] ${fileName}`;

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: CONV_ID,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.name || currentUser.username,
      avatarColor: currentUser.avatarColor,
      text: placeholderText,
      timestamp: new Date().toISOString(),
      type,
      attachmentUrl: data,
      fileName,
      status: 'sending',
      readBy: [{
        user: currentUser.id,
        userName: currentUser.name || currentUser.username,
        readAt: new Date().toISOString(),
      }],
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            text: replyingTo.text,
            username: replyingTo.displayName || replyingTo.username,
          }
        : null,
    };

    setMessages((prev) => [...prev, optimisticMsg]);
    setPreviewFile(null);
    setPreviewFileType(null);
    setPreviewFileName('');
    setReplyingTo(null);

    try {
      const payload = {
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.name || currentUser.username,
        avatarColor: currentUser.avatarColor,
        photoURL: currentUser.photoURL || currentUser.avatarUrl,
        avatarUrl: currentUser.photoURL || currentUser.avatarUrl,
        text: placeholderText,
        type,
        attachmentUrl: data,
        fileName,
        conversationId: CONV_ID,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              text: replyingTo.text,
              username: replyingTo.displayName || replyingTo.username,
            }
          : null,
      };

      const newMsg = await sendChatMessageToFirestore(payload);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? newMsg : m))
      );
    } catch (err) {
      console.error('Error sending attachment:', err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // -------------------------------------------------------------
  // Send or Edit Message Handler
  // -------------------------------------------------------------
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Handle Edit Mode
    if (editingMessage) {
      const updatedText = inputText.trim();
      try {
        await editChatMessageInFirestore(editingMessage.id, updatedText, currentUser.id);
        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, text: updatedText, edited: true } : m))
        );
        setEditingMessage(null);
        setInputText('');
      } catch (err) {
        console.error('Error editing message:', err);
      }
      return;
    }

    // Normal Send
    const messageText = inputText.trim();
    setInputText('');
    setIsSending(true);

    const tempId = `temp_${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      id: tempId,
      conversationId: CONV_ID,
      userId: currentUser.id,
      username: currentUser.username,
      displayName: currentUser.name || currentUser.username,
      avatarColor: currentUser.avatarColor,
      photoURL: currentUser.photoURL || currentUser.avatarUrl,
      avatarUrl: currentUser.photoURL || currentUser.avatarUrl,
      text: messageText,
      timestamp: new Date().toISOString(),
      type: 'text',
      status: 'sending',
      deliveredAt: new Date().toISOString(),
      readBy: [{
        user: currentUser.id,
        userName: currentUser.name || currentUser.username,
        readAt: new Date().toISOString(),
      }],
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            text: replyingTo.text,
            username: replyingTo.displayName || replyingTo.username,
          }
        : null,
    };

    setMessages((prev) => [...prev, optimisticMsg]);

    try {
      const payload = {
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.name || currentUser.username,
        avatarColor: currentUser.avatarColor,
        photoURL: currentUser.photoURL || currentUser.avatarUrl,
        avatarUrl: currentUser.photoURL || currentUser.avatarUrl,
        text: messageText,
        type: 'text' as const,
        conversationId: CONV_ID,
        replyTo: replyingTo
          ? {
              id: replyingTo.id,
              text: replyingTo.text,
              username: replyingTo.displayName || replyingTo.username,
            }
          : null,
      };

      const newMsg = await sendChatMessageToFirestore(payload);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? newMsg : m))
      );
      setReplyingTo(null);
    } catch (err) {
      console.error('Error sending message:', err);
      // Remove failed optimistic message
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } finally {
      setIsSending(false);
    }
  };

  // -------------------------------------------------------------
  // Message Reactions, Editing & Deleting
  // -------------------------------------------------------------
  const handleReaction = async (messageId: string, emoji: string) => {
    try {
      await toggleReactionInFirestore(
        messageId,
        emoji,
        currentUser.id,
        currentUser.name || currentUser.username
      );
    } catch (err) {
      console.error('Error reacting to message:', err);
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (targetMsg && !isMessageOwner(targetMsg)) {
      console.warn('Unauthorized: You can only delete messages that you typed.');
      return;
    }

    // Instant optimistic removal from UI
    setMessages((prev) => prev.filter((m) => m.id !== messageId));
    if (editingMessage?.id === messageId) {
      setEditingMessage(null);
      setInputText('');
    }
    if (replyingTo?.id === messageId) {
      setReplyingTo(null);
    }
    try {
      await deleteChatMessageFromFirestore(messageId, {
        id: currentUser.id,
        username: currentUser.username,
        email: currentUser.email,
      });
    } catch (err) {
      console.error('Error deleting message:', err);
    }
  };

  const startEditing = (msg: ChatMessage) => {
    setEditingMessage(msg);
    setInputText(msg.text);
    setReplyingTo(null);
    setActiveMenuMessageId(null);
    inputRef.current?.focus();
  };

  const cancelEditing = () => {
    setEditingMessage(null);
    setInputText('');
  };

  const startReplying = (msg: ChatMessage) => {
    setReplyingTo(msg);
    setEditingMessage(null);
    setActiveMenuMessageId(null);
    inputRef.current?.focus();
  };

  const formatTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return '';
    }
  };

  const formatFullDateTime = (isoString?: string) => {
    if (!isoString) return 'Just now';
    try {
      const date = new Date(isoString);
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch (e) {
      return isoString;
    }
  };

  const getAvatarInitials = (nameOrUsername: string) => {
    return (nameOrUsername || 'U').charAt(0).toUpperCase();
  };

  interface SenderOption {
    id: string;
    displayName: string;
    username: string;
    avatarColor?: string;
    count: number;
    isCurrentUser: boolean;
  }

  // Extract distinct senders from current messages for sender filtering
  const distinctSenders = useMemo<SenderOption[]>(() => {
    const map = new Map<string, SenderOption>();
    for (const msg of uniqueMessages) {
      if (!msg || msg.deleted) continue;
      const isOwn = isMessageOwner(msg);
      const key = isOwn ? 'me' : (msg.userId || msg.username || 'unknown');
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          id: key,
          displayName: isOwn
            ? `${currentUser.name || currentUser.username} (You)`
            : (msg.displayName || msg.username || 'Classmate'),
          username: isOwn ? currentUser.username : (msg.username || 'classmate'),
          avatarColor: msg.avatarColor || (isOwn ? currentUser.avatarColor : undefined),
          count: 1,
          isCurrentUser: isOwn,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.isCurrentUser) return -1;
      if (b.isCurrentUser) return 1;
      return b.count - a.count;
    });
  }, [uniqueMessages, currentUser]);

  const isFilteringActive = Boolean(
    (showSearchInChat && chatSearchQuery.trim()) ||
    selectedSenderFilter !== 'all'
  );

  const displayedMessages = useMemo(() => {
    if (!isFilteringActive) return uniqueMessages;

    const query = chatSearchQuery.trim().toLowerCase();

    return uniqueMessages.filter((msg) => {
      if (msg.deleted) return false;

      // 1. Sender filter
      if (selectedSenderFilter !== 'all') {
        const isOwn = isMessageOwner(msg);
        if (selectedSenderFilter === 'me') {
          if (!isOwn) return false;
        } else {
          const matchesSenderId = msg.userId === selectedSenderFilter;
          const matchesUsername = (msg.username || '').toLowerCase() === selectedSenderFilter.toLowerCase();
          const matchesDisplayName = (msg.displayName || '').toLowerCase() === selectedSenderFilter.toLowerCase();
          if (!matchesSenderId && !matchesUsername && !matchesDisplayName) {
            return false;
          }
        }
      }

      // 2. Keyword filter
      if (query) {
        const textMatch = (msg.text || '').toLowerCase().includes(query);
        const fileMatch = (msg.fileName || '').toLowerCase().includes(query);
        const replyMatch = (msg.replyTo?.text || '').toLowerCase().includes(query);
        const senderMatch =
          (msg.displayName || '').toLowerCase().includes(query) ||
          (msg.username || '').toLowerCase().includes(query);

        if (!textMatch && !fileMatch && !replyMatch && !senderMatch) {
          return false;
        }
      }

      return true;
    });
  }, [uniqueMessages, isFilteringActive, chatSearchQuery, selectedSenderFilter, currentUser]);

  const resetSearchFilters = () => {
    setChatSearchQuery('');
    setSelectedSenderFilter('all');
  };

  const filterBySender = (senderKey: string) => {
    setShowSearchInChat(true);
    setSelectedSenderFilter(senderKey);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const highlightMatchedText = (text: string, query: string) => {
    if (!query.trim() || !text) return text;
    try {
      const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(${escaped})`, 'gi');
      const parts = text.split(regex);
      return parts.map((part, index) =>
        regex.test(part) ? (
          <mark
            key={index}
            className="bg-amber-400/35 text-amber-200 px-0.5 rounded font-medium underline decoration-amber-400/50"
          >
            {part}
          </mark>
        ) : (
          part
        )
      );
    } catch (e) {
      return text;
    }
  };

  return (
    <div className="flex flex-1 h-full min-h-0 bg-[#090d16] overflow-hidden">
      {/* -------------------------------------------------------- */}
      {/* SINGLE UNIFIED CLASSROOM CHAT PANE                       */}
      {/* -------------------------------------------------------- */}
      <div className="flex-1 flex flex-col min-w-0 bg-[#070a13] relative">
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-white/5 bg-[#0b1120]/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative shrink-0">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-base shadow-lg shadow-indigo-600/20 border border-white/10">
                #
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-[#0b1120]" />
            </div>

            <div className="min-w-0">
              <h2 className="text-sm md:text-base font-bold text-white truncate flex items-center gap-2">
                <span>Classroom Chat</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-medium border border-indigo-500/30">
                  Live Hub
                </span>
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1 text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {onlineUserIds.length} Classmate{onlineUserIds.length !== 1 ? 's' : ''} Online
                </span>
                <span>•</span>
                <span>{uniqueMessages.length} messages</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* Status Legend Indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] select-none text-slate-400">
              <span className="flex items-center gap-1 text-slate-400" title="Delivered: received by classroom">
                <CheckCheck className="h-3.5 w-3.5" />
                <span className="text-[10px]">Delivered</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1 text-sky-400 font-medium" title="Read: opened by classmate(s)">
                <CheckCheck className="h-3.5 w-3.5 text-sky-400 drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]" />
                <span className="text-[10px]">Read</span>
              </span>
            </div>

            {/* Search inside messages toggle */}
            <button
              onClick={() => {
                const nextState = !showSearchInChat;
                setShowSearchInChat(nextState);
                if (nextState) {
                  setTimeout(() => searchInputRef.current?.focus(), 100);
                }
              }}
              className={`relative p-2 rounded-xl transition ${
                showSearchInChat || isFilteringActive
                  ? 'bg-indigo-600/30 text-indigo-300 ring-1 ring-indigo-500/40'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
              title={isFilteringActive ? 'Search & Filter Active' : 'Search & Filter messages'}
            >
              <Search className="h-4 w-4" />
              {isFilteringActive && (
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-sky-400 ring-2 ring-[#0b1120] animate-pulse" />
              )}
            </button>

            {/* Polls toggle */}
            <button
              onClick={() => setShowPolls(!showPolls)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 text-xs font-medium ${
                showPolls
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                  : 'bg-white/5 text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Class Polls & Votes"
            >
              <Vote className="h-4 w-4 text-indigo-400" />
              <span className="hidden sm:inline">Polls</span>
            </button>

            {/* Refresh */}
            <button
              onClick={() => fetchMessages()}
              disabled={isRefreshing}
              className="p-2 hover:bg-white/5 rounded-xl text-slate-300 hover:text-white transition"
              title="Refresh Messages"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* In-Chat Search & Filter Bar */}
        {showSearchInChat && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-[#0c1322] border-b border-indigo-500/20 shadow-lg px-4 py-3 space-y-2.5"
          >
            {/* Main Controls Row: Keyword Search + Sender Selector + Reset/Close */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              {/* Keyword Input */}
              <div className="flex-1 flex items-center gap-2 bg-[#141d33] border border-white/10 focus-within:border-indigo-500/60 rounded-xl px-3 py-2 transition">
                <Search className="h-4 w-4 text-indigo-400 shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  placeholder="Filter messages by keyword or text..."
                  value={chatSearchQuery}
                  onChange={(e) => setChatSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      if (chatSearchQuery) setChatSearchQuery('');
                      else setShowSearchInChat(false);
                    }
                  }}
                  className="flex-1 bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none"
                />
                {chatSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setChatSearchQuery('')}
                    className="p-1 text-slate-400 hover:text-white rounded transition"
                    title="Clear keyword"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Sender Dropdown Selector */}
              <div className="flex items-center gap-2 bg-[#141d33] border border-white/10 rounded-xl px-3 py-1.5 shrink-0">
                <Users className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <select
                  value={selectedSenderFilter}
                  onChange={(e) => setSelectedSenderFilter(e.target.value)}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer pr-1"
                  title="Filter by sender"
                >
                  <option value="all" className="bg-[#0f172a] text-slate-200">
                    All Senders ({uniqueMessages.length})
                  </option>
                  <option value="me" className="bg-[#0f172a] text-indigo-300 font-medium">
                    👤 My Messages (You)
                  </option>
                  {distinctSenders
                    .filter((s) => !s.isCurrentUser)
                    .map((s, idx) => (
                      <option key={`sender-opt-${s.id}-${idx}`} value={s.id} className="bg-[#0f172a] text-slate-200">
                        {s.displayName} ({s.count})
                      </option>
                    ))}
                </select>
              </div>

              {/* Reset & Close Buttons */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                {isFilteringActive && (
                  <button
                    type="button"
                    onClick={resetSearchFilters}
                    className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs transition flex items-center gap-1 border border-white/5"
                    title="Reset all filters"
                  >
                    <RotateCcw className="h-3 w-3 text-slate-400" />
                    <span className="hidden sm:inline">Reset</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setShowSearchInChat(false);
                    resetSearchFilters();
                  }}
                  className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition"
                  title="Close search"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick Sender Filter Chips & Match Status Row */}
            <div className="flex items-center justify-between gap-3 text-xs flex-wrap pt-0.5">
              {/* Sender Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
                <span className="text-[11px] text-slate-400 font-medium shrink-0 flex items-center gap-1">
                  <Filter className="h-3 w-3 text-indigo-400" />
                  Sender:
                </span>

                {/* 'All' chip */}
                <button
                  type="button"
                  onClick={() => setSelectedSenderFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0 ${
                    selectedSenderFilter === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }`}
                >
                  All
                </button>

                {/* 'Me' chip */}
                <button
                  type="button"
                  onClick={() => setSelectedSenderFilter('me')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0 flex items-center gap-1 ${
                    selectedSenderFilter === 'me'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                  }`}
                >
                  <span>You</span>
                  <span className="text-[9px] opacity-75">
                    ({distinctSenders.find((s) => s.isCurrentUser)?.count || 0})
                  </span>
                </button>

                {/* Top sender chips */}
                {distinctSenders
                  .filter((s) => !s.isCurrentUser)
                  .slice(0, 4)
                  .map((s, idx) => (
                    <button
                      key={`sender-chip-${s.id}-${idx}`}
                      type="button"
                      onClick={() =>
                        setSelectedSenderFilter(selectedSenderFilter === s.id ? 'all' : s.id)
                      }
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0 flex items-center gap-1.5 ${
                        selectedSenderFilter === s.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full bg-gradient-to-tr ${
                          s.avatarColor || 'from-indigo-500 to-purple-500'
                        }`}
                      />
                      <span className="truncate max-w-[100px]">{s.displayName}</span>
                      <span className="text-[9px] opacity-75">({s.count})</span>
                    </button>
                  ))}
              </div>

              {/* Match Counter Badge */}
              <div className="flex items-center gap-2 shrink-0 ml-auto">
                <span className="text-[11px] font-medium text-slate-400">
                  Showing{' '}
                  <span className="text-white font-semibold">{displayedMessages.length}</span> of{' '}
                  <span className="text-slate-400">{uniqueMessages.length}</span>
                </span>
                {isFilteringActive && (
                  <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-semibold border border-indigo-500/30">
                    Filtered
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Message Thread List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          {displayedMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto space-y-3 py-12">
              <div className="h-14 w-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-2xl shadow-inner">
                {isFilteringActive ? <Search className="h-6 w-6 text-indigo-400" /> : '💬'}
              </div>
              <h3 className="font-bold text-white text-base">
                {isFilteringActive ? 'No matching messages' : 'Welcome to Classroom Chat!'}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {isFilteringActive
                  ? `No messages matched ${chatSearchQuery ? `keyword "${chatSearchQuery}"` : ''} ${
                      selectedSenderFilter !== 'all'
                        ? `from sender "${
                            selectedSenderFilter === 'me'
                              ? 'You'
                              : distinctSenders.find((s) => s.id === selectedSenderFilter)?.displayName ||
                                selectedSenderFilter
                          }"`
                        : ''
                    }. Try broadening your search or resetting filters.`
                  : 'Start the conversation, ask a doubt, share notes, or post memes. Everything syncs live.'}
              </p>
              {isFilteringActive && (
                <button
                  type="button"
                  onClick={resetSearchFilters}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 transition flex items-center gap-1.5 mt-2"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            displayedMessages.map((msg) => {
              const isOwn = isMessageOwner(msg);
              const hasReactions = msg.reactions && msg.reactions.length > 0;
              const isMenuOpen = activeMenuMessageId === msg.id;

              // Read & Delivery Status
              const otherReaders = (msg.readBy || []).filter((r) => r.user !== msg.userId);
              const isSending = msg.status === 'sending' || msg.id.startsWith('temp_');
              const isRead = !isSending && (msg.status === 'read' || otherReaders.length > 0);
              const isDelivered = !isSending && !isRead && (msg.status === 'delivered' || (!msg.status && !msg.id.startsWith('temp_')) || Boolean(msg.deliveredAt));
              const isSent = !isSending && !isRead && !isDelivered && msg.status === 'sent';
              // Double check icon is conditionally rendered when status is 'delivered' or 'read'
              const showDoubleCheck = isDelivered || isRead;

              // Group reactions by emoji
              const reactionCounts: Record<string, { count: number; users: string[]; hasReacted: boolean }> = {};
              (msg.reactions || []).forEach((r) => {
                if (!reactionCounts[r.emoji]) {
                  reactionCounts[r.emoji] = { count: 0, users: [], hasReacted: false };
                }
                reactionCounts[r.emoji].count += 1;
                reactionCounts[r.emoji].users.push(r.userName || 'User');
                if (r.user === currentUser.id) {
                  reactionCounts[r.emoji].hasReacted = true;
                }
              });

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`group relative flex items-start gap-2.5 ${
                    isOwn ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Left Avatar for classmates */}
                  {!isOwn && (
                    <button
                      type="button"
                      onClick={() => filterBySender(msg.userId || msg.username)}
                      className={`h-8 w-8 rounded-full p-[1.5px] bg-gradient-to-tr ${
                        msg.photoURL || msg.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : (msg.avatarColor || 'from-slate-600 to-slate-700')
                      } text-white flex items-center justify-center text-xs font-bold uppercase select-none shrink-0 shadow-sm mt-0.5 hover:ring-2 hover:ring-indigo-400 hover:scale-105 transition cursor-pointer overflow-hidden`}
                      title={`Filter messages by ${msg.displayName || msg.username}`}
                    >
                      <div className="h-full w-full rounded-full bg-slate-900 overflow-hidden flex items-center justify-center">
                        {msg.photoURL || msg.avatarUrl ? (
                          <img
                            src={msg.photoURL || msg.avatarUrl}
                            alt={msg.displayName || msg.username}
                            className="h-full w-full object-cover rounded-full"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          getAvatarInitials(msg.displayName || msg.username)
                        )}
                      </div>
                    </button>
                  )}

                  <div className={`max-w-[85%] md:max-w-[65%] flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
                    {/* Header info for other classmates */}
                    {!isOwn && (
                      <div className="flex items-center gap-1.5 mb-1 ml-1 select-none">
                        <button
                          type="button"
                          onClick={() => filterBySender(msg.userId || msg.username)}
                          className="text-xs font-semibold text-indigo-300 hover:text-indigo-200 hover:underline transition cursor-pointer"
                          title={`Filter messages by ${msg.displayName || msg.username}`}
                        >
                          {msg.displayName || msg.username}
                        </button>
                        {msg.username.toLowerCase() === 'admin' && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] bg-purple-500/20 text-purple-300 font-semibold border border-purple-500/30">
                            Admin
                          </span>
                        )}
                      </div>
                    )}

                    {/* Quoted Reply Preview */}
                    {msg.replyTo && (
                      <div
                        className={`text-[11px] px-3 py-1.5 rounded-t-xl mb-0.5 border-l-2 max-w-full truncate ${
                          isOwn
                            ? 'bg-indigo-900/40 border-indigo-400 text-indigo-200'
                            : 'bg-slate-800/60 border-indigo-400 text-slate-300'
                        }`}
                      >
                        <span className="font-semibold text-[10px] text-indigo-300 block">
                          Replying to {msg.replyTo.username}:
                        </span>
                        <span className="truncate block opacity-80">{msg.replyTo.text}</span>
                      </div>
                    )}

                    {/* Main Message Bubble */}
                    <div
                      className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                        isOwn
                          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-tr-none shadow-lg shadow-indigo-600/15 border border-white/10'
                          : 'bg-[#131b2e] text-slate-100 rounded-tl-none border border-white/5 shadow-md'
                      }`}
                    >
                      {/* Media Attachments */}
                      {msg.type === 'image' && msg.attachmentUrl && !msg.deleted && (
                        <div
                          onClick={() => {
                            setZoomUrl(msg.attachmentUrl!);
                            setZoomType('image');
                            setZoomName(msg.fileName || 'Classroom Image');
                            setZoomOpen(true);
                          }}
                          className="cursor-zoom-in group/img relative overflow-hidden rounded-xl mb-2 border border-white/10 bg-black/20 hover:border-indigo-500/40 transition duration-200"
                        >
                          <img
                            src={msg.attachmentUrl}
                            alt="Attachment"
                            className="max-h-72 w-auto rounded-xl object-contain transition duration-300 group-hover/img:scale-[1.01]"
                          />
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover/img:opacity-100 transition duration-200 flex items-center justify-center text-xs text-white font-medium gap-1.5 backdrop-blur-[2px]">
                            <ZoomIn className="h-4 w-4" />
                            <span>Click to Zoom</span>
                          </div>
                        </div>
                      )}

                      {msg.type === 'video' && msg.attachmentUrl && !msg.deleted && (
                        <div
                          onClick={() => {
                            setZoomUrl(msg.attachmentUrl!);
                            setZoomType('video');
                            setZoomName(msg.fileName || 'Classroom Video');
                            setZoomOpen(true);
                          }}
                          className="cursor-zoom-in group/vid relative overflow-hidden rounded-xl mb-2 border border-white/10 bg-black/30 hover:border-indigo-500/40 transition duration-200 max-w-sm"
                        >
                          <video
                            src={msg.attachmentUrl}
                            className="max-h-64 w-auto rounded-xl pointer-events-none"
                            muted
                            playsInline
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-xs text-white font-medium gap-1.5 transition duration-200 group-hover/vid:bg-black/20">
                            <div className="h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-white shadow-lg">
                              <Play className="h-4 w-4 fill-current ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )}

                      {msg.type === 'audio' && msg.attachmentUrl && !msg.deleted && (
                        <div className="flex flex-col gap-1.5 mb-2 bg-black/20 p-2.5 rounded-xl border border-white/5 min-w-[240px]">
                          <div className="flex items-center gap-2 text-xs font-medium text-indigo-300">
                            <Volume2 className="h-4 w-4" />
                            <span>Voice Note</span>
                          </div>
                          <audio src={msg.attachmentUrl} controls className="w-full h-8" />
                        </div>
                      )}

                      {/* Text content */}
                      <p className="whitespace-pre-wrap break-words">
                        {highlightMatchedText(msg.text, chatSearchQuery)}
                      </p>

                      {/* Edited Badge */}
                      {msg.edited && (
                        <span
                          title={
                            msg.editHistory && msg.editHistory.length > 0
                              ? `Originally: "${msg.editHistory[0].content}"`
                              : 'Edited'
                          }
                          className="text-[9px] opacity-75 ml-1.5 underline decoration-dotted cursor-help font-mono"
                        >
                          (edited)
                        </span>
                      )}
                    </div>

                    {/* Reactions List */}
                    {hasReactions && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {Object.entries(reactionCounts).map(([emoji, data]) => (
                          <button
                            key={emoji}
                            onClick={() => handleReaction(msg.id, emoji)}
                            title={data.users.join(', ')}
                            className={`px-2 py-0.5 rounded-full text-xs flex items-center gap-1 border transition ${
                              data.hasReacted
                                ? 'bg-indigo-600/30 border-indigo-500/50 text-white font-semibold'
                                : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                            }`}
                          >
                            <span>{emoji}</span>
                            <span className="text-[10px]">{data.count}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Timestamp & Read/Delivered Status & Direct Action Buttons */}
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 mx-1 select-none flex-wrap">
                      <span>{formatTime(msg.timestamp)}</span>

                      {/* Read & Delivered Status Icons for Message Author */}
                      {isOwn && (
                        <>
                          {isSending ? (
                            <span
                              title="Sending message..."
                              className="inline-flex items-center gap-0.5 text-slate-400/70"
                            >
                              <Clock className="h-3 w-3 inline animate-pulse" />
                              <span className="text-[9px]">Sending</span>
                            </span>
                          ) : isSent ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessageForInfo(msg);
                              }}
                              title="Sent to server • Awaiting classroom delivery • Click for details"
                              className="inline-flex items-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors group/status cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5 inline text-slate-400" />
                              <span className="text-[9px] font-medium text-slate-400/90 group-hover/status:underline">
                                Sent
                              </span>
                            </button>
                          ) : showDoubleCheck ? (
                            isRead ? (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMessageForInfo(msg);
                                }}
                                title={`Read by ${otherReaders.map((r) => r.userName || 'Classmate').join(', ')} • Click for details`}
                                className="inline-flex items-center gap-0.5 text-sky-400 hover:text-sky-300 transition-colors group/status cursor-pointer"
                              >
                                <CheckCheck className="h-3.5 w-3.5 inline drop-shadow-[0_0_6px_rgba(56,189,248,0.5)] text-sky-400" />
                                <span className="text-[9px] font-semibold text-sky-400/95 group-hover/status:underline">
                                  Read{otherReaders.length > 1 ? ` (${otherReaders.length})` : ''}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMessageForInfo(msg);
                                }}
                                title="Delivered to classroom • Waiting for classmates to open chat • Click for details"
                                className="inline-flex items-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors group/status cursor-pointer"
                              >
                                <CheckCheck className="h-3.5 w-3.5 inline text-slate-400" />
                                <span className="text-[9px] font-medium text-slate-400/90 group-hover/status:underline">
                                  Delivered
                                </span>
                              </button>
                            )
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMessageForInfo(msg);
                              }}
                              title="Delivered to classroom • Click for details"
                              className="inline-flex items-center gap-0.5 text-slate-400 hover:text-slate-200 transition-colors group/status cursor-pointer"
                            >
                              <CheckCheck className="h-3.5 w-3.5 inline text-slate-400" />
                              <span className="text-[9px] font-medium text-slate-400/90 group-hover/status:underline">
                                Delivered
                              </span>
                            </button>
                          )}
                        </>
                      )}

                      {/* For incoming messages: Show read status if viewed by other classmates */}
                      {!isOwn && otherReaders.length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMessageForInfo(msg);
                          }}
                          title={`Read by ${otherReaders.map((r) => r.userName || 'Classmate').join(', ')} • Click for details`}
                          className="inline-flex items-center gap-0.5 text-slate-400/70 hover:text-sky-300 transition text-[9px]"
                        >
                          <CheckCheck className="h-3 w-3 inline text-sky-400/70" />
                          <span>{otherReaders.length} read</span>
                        </button>
                      )}

                      {/* Direct Clickable Action Bar (Always usable on mobile & desktop) */}
                      <div className="flex items-center gap-1 ml-1 text-slate-400">
                        {/* Filter by sender */}
                        <button
                          onClick={() => filterBySender(isOwn ? 'me' : (msg.userId || msg.username))}
                          className="hover:text-indigo-300 p-0.5 rounded transition flex items-center gap-0.5 text-[10px]"
                          title={`Filter chat by ${isOwn ? 'You' : (msg.displayName || msg.username)}`}
                        >
                          <Filter className="h-3 w-3" />
                          <span className="hidden md:inline">Filter</span>
                        </button>

                        {/* Message Info button */}
                        <button
                          onClick={() => setSelectedMessageForInfo(msg)}
                          className="hover:text-indigo-300 p-0.5 rounded transition flex items-center gap-0.5 text-[10px]"
                          title="Message Info & Read Receipts"
                        >
                          <Info className="h-3 w-3" />
                          <span className="hidden sm:inline">Info</span>
                        </button>

                        {/* Reply button */}
                        <button
                          onClick={() => startReplying(msg)}
                          className="hover:text-indigo-300 p-0.5 rounded transition flex items-center gap-0.5 text-[10px]"
                          title="Reply"
                        >
                          <Reply className="h-3 w-3" />
                          <span className="hidden sm:inline">Reply</span>
                        </button>

                        {/* Edit button (if own message or admin) */}
                        {isOwn && (
                          <button
                            onClick={() => startEditing(msg)}
                            className="hover:text-amber-300 p-0.5 rounded transition flex items-center gap-0.5 text-[10px] text-amber-400/80"
                            title="Edit Message"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                        )}

                        {/* Delete button (if own message or admin) */}
                        {isOwn && (
                          <button
                            onClick={() => handleDeleteMessage(msg.id)}
                            className="hover:text-red-300 p-0.5 rounded transition flex items-center gap-0.5 text-[10px] text-red-400/80"
                            title="Delete Message"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right Avatar for self */}
                  {isOwn && (
                    <button
                      type="button"
                      onClick={() => filterBySender('me')}
                      className={`h-8 w-8 rounded-full p-[1.5px] bg-gradient-to-tr ${
                        currentUser.photoURL || currentUser.avatarUrl ? 'from-amber-400 via-rose-500 to-fuchsia-600' : (currentUser.avatarColor || 'from-indigo-500 to-purple-600')
                      } text-white flex items-center justify-center text-xs font-bold uppercase select-none shrink-0 shadow-sm mt-0.5 hover:ring-2 hover:ring-indigo-400 hover:scale-105 transition cursor-pointer overflow-hidden`}
                      title="Filter messages by You"
                    >
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
                          getAvatarInitials(currentUser.name || currentUser.username)
                        )}
                      </div>
                    </button>
                  )}

                  {/* Floating Quick Reactions on Hover */}
                  <div
                    className={`absolute top-0 opacity-0 group-hover:opacity-100 transition duration-150 flex items-center gap-1 bg-[#1e293b] border border-white/10 rounded-xl p-1 shadow-xl z-10 ${
                      isOwn ? 'right-12 -translate-y-3' : 'left-12 -translate-y-3'
                    }`}
                  >
                    {QUICK_EMOJIS.slice(0, 4).map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        className="p-1 hover:scale-125 text-sm transition"
                      >
                        {emoji}
                      </button>
                    ))}

                    <div className="h-3.5 w-px bg-white/10 mx-0.5" />

                    <button
                      onClick={() => filterBySender(isOwn ? 'me' : (msg.userId || msg.username))}
                      className="p-1 text-slate-300 hover:text-indigo-300 hover:bg-white/10 rounded"
                      title={`Filter chat by ${isOwn ? 'You' : (msg.displayName || msg.username)}`}
                    >
                      <Filter className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => setSelectedMessageForInfo(msg)}
                      className="p-1 text-slate-300 hover:text-indigo-300 hover:bg-white/10 rounded"
                      title="Message Info & Read Receipts"
                    >
                      <Info className="h-3.5 w-3.5" />
                    </button>

                    <button
                      onClick={() => startReplying(msg)}
                      className="p-1 text-slate-300 hover:text-white hover:bg-white/10 rounded"
                      title="Reply"
                    >
                      <Reply className="h-3.5 w-3.5" />
                    </button>

                    {isOwn && (
                      <button
                        onClick={() => startEditing(msg)}
                        className="p-1 text-amber-300 hover:text-amber-200 hover:bg-white/10 rounded"
                        title="Edit Message"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}

                    {isOwn && (
                      <button
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="p-1 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                        title="Delete Message"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}

          {/* Typing Indicator Banner */}
          {activeTypers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-xs text-indigo-300 font-medium px-3 py-1.5 bg-indigo-950/40 rounded-xl w-fit border border-indigo-500/20 shadow-sm"
            >
              <div className="flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.2s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce [animation-delay:0.4s]" />
              </div>
              <span>
                {activeTypers.map((t) => t.displayName).join(', ')} {activeTypers.length === 1 ? 'is' : 'are'} typing...
              </span>
            </motion.div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* -------------------------------------------------------- */}
        {/* COMPOSER / INPUT SECTION                                 */}
        {/* -------------------------------------------------------- */}
        <div className="p-2 sm:p-3 md:p-4 pb-safe bg-[#0b1120]/90 backdrop-blur-xl border-t border-white/5 shrink-0">
          {/* Active Reply Banner */}
          {replyingTo && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 px-3 py-2 bg-indigo-950/60 border border-indigo-500/30 rounded-xl flex items-center justify-between text-xs text-indigo-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Reply className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="truncate">
                  Replying to <b className="text-white">{replyingTo.displayName || replyingTo.username}</b>: {replyingTo.text}
                </span>
              </div>
              <button
                onClick={() => setReplyingTo(null)}
                className="p-1 text-slate-400 hover:text-white rounded ml-2"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}

          {/* Active Edit Banner with prominent controls */}
          {editingMessage && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 px-3.5 py-2.5 bg-amber-950/80 border border-amber-500/50 rounded-xl flex items-center justify-between text-xs text-amber-200 shadow-md shadow-amber-950/40"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-6 w-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/30">
                  <Edit2 className="h-3.5 w-3.5" />
                </div>
                <div className="truncate">
                  <span className="font-semibold text-white block">Editing Message:</span>
                  <span className="text-[11px] text-amber-300/80 truncate block">{editingMessage.text}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <button
                  type="button"
                  onClick={cancelEditing}
                  className="px-2.5 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-medium transition flex items-center gap-1"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Cancel</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* Attachment Preview Banner */}
          {previewFile && (
            <div className="mb-2 bg-slate-900 p-2.5 rounded-xl flex items-center gap-3 border border-white/10 max-w-sm">
              {previewFileType === 'video' ? (
                <video
                  src={previewFile}
                  className="h-14 w-14 object-cover rounded-lg bg-black"
                  muted
                  playsInline
                />
              ) : (
                <img
                  src={previewFile}
                  alt="Preview"
                  className="h-14 w-14 object-cover rounded-lg bg-black"
                />
              )}
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <span className="text-xs text-white font-medium truncate">{previewFileName}</span>
                <span className="text-[10px] text-slate-400 font-mono capitalize">
                  {previewFileType} Ready
                </span>
                <div className="flex gap-2 mt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewFile(null);
                      setPreviewFileType(null);
                      setPreviewFileName('');
                    }}
                    className="px-2 py-0.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded text-[10px] font-medium transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (previewFile && previewFileType) {
                        sendAttachment(previewFile, previewFileType, previewFileName);
                      }
                    }}
                    className="px-3 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-medium transition shadow-sm"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Recording Mode Bar */}
          {isRecording ? (
            <div className="flex items-center justify-between p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl">
              <div className="flex items-center gap-2 text-red-300 text-xs font-medium">
                <span className="h-3 w-3 rounded-full bg-red-500 animate-ping" />
                <span>Recording Audio ({recordingDuration}s)...</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="px-3 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-xs transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={stopRecording}
                  className="px-4 py-1 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition shadow"
                >
                  Finish & Send
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*,video/*,audio/*"
              />

              {/* Attachment Picker */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 transition"
                title="Attach photo, video, or audio"
              >
                <Paperclip className="h-5 w-5" />
              </button>

              {/* Voice Note Button */}
              <button
                type="button"
                onClick={startRecording}
                className="p-2.5 text-slate-400 hover:text-red-400 rounded-xl hover:bg-white/5 transition"
                title="Record Voice Note"
              >
                <Mic className="h-5 w-5" />
              </button>

              {/* Emoji quick selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="p-2.5 text-slate-400 hover:text-amber-300 rounded-xl hover:bg-white/5 transition"
                  title="Emoji"
                >
                  <Smile className="h-5 w-5" />
                </button>

                {showEmojiPicker && (
                  <div className="absolute bottom-12 left-0 bg-[#1e293b] border border-white/10 rounded-2xl p-2 shadow-2xl z-30 flex flex-wrap gap-1.5 w-56">
                    {['😂', '❤️', '🔥', '👍', '😮', '👏', '💀', '💯', '✨', '🎉', '🙌', '😎', '📚', '💡', '🎓', '🤝'].map(
                      (e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setInputText((prev) => prev + e);
                            setShowEmojiPicker(false);
                            inputRef.current?.focus();
                          }}
                          className="h-8 w-8 flex items-center justify-center hover:bg-white/10 rounded-lg text-lg transition"
                        >
                          {e}
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>

              {/* Text Input */}
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && editingMessage) {
                    cancelEditing();
                  }
                }}
                placeholder={
                  editingMessage
                    ? 'Edit your message (Press Enter to Save, Esc to Cancel)...'
                    : replyingTo
                    ? `Reply to ${replyingTo.displayName || replyingTo.username}...`
                    : 'Message the class...'
                }
                className={`flex-1 px-4 py-3 rounded-xl text-white text-sm focus:outline-none transition-all duration-200 ${
                  editingMessage
                    ? 'bg-amber-950/30 border-2 border-amber-500 placeholder-amber-400/50 shadow-inner'
                    : 'bg-slate-900/90 border border-white/10 placeholder-slate-500 focus:border-indigo-500'
                }`}
                disabled={isSending}
                id="chat-input-field"
              />

              {/* Send or Save Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className={`px-5 py-3 rounded-xl shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 shrink-0 ${
                  editingMessage
                    ? 'bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-amber-600/25 font-medium text-xs gap-1.5'
                    : 'bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white shadow-indigo-600/25'
                }`}
                id="chat-send-btn"
              >
                {editingMessage ? (
                  <>
                    <Check className="h-4.5 w-4.5" />
                    <span>Save</span>
                  </>
                ) : (
                  <Send className="h-4.5 w-4.5" />
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------- */}
      {/* RIGHT SIDE PANEL: Classroom Polls & Active Classmates    */}
      {/* -------------------------------------------------------- */}
      {showPolls && (
        <div className="w-80 shrink-0 border-l border-white/5 bg-[#0b1120]/80 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Vote className="h-4 w-4 text-indigo-400" />
              <h3 className="font-semibold text-white text-sm">Classroom Polls</h3>
            </div>
            <button
              onClick={() => setShowPolls(false)}
              className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <Polls currentUser={currentUser} />
        </div>
      )}

      {/* -------------------------------------------------------- */}
      {/* MEDIA ZOOM MODAL                                         */}
      {/* -------------------------------------------------------- */}
      <MediaZoomModal
        isOpen={zoomOpen}
        onClose={() => setZoomOpen(false)}
        mediaUrl={zoomUrl}
        mediaType={zoomType}
        mediaName={zoomName}
      />

      {/* -------------------------------------------------------- */}
      {/* MESSAGE INFO & READ RECEIPTS MODAL                       */}
      {/* -------------------------------------------------------- */}
      {selectedMessageForInfo && (
        <div
          id="message-info-modal-backdrop"
          onClick={() => setSelectedMessageForInfo(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150"
        >
          <div
            id="message-info-modal-card"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0f172a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Modal Header */}
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-[#1e293b]/60">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Info className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Message Information</h3>
                  <p className="text-[11px] text-slate-400">Delivery & Read Status</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedMessageForInfo(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-5 text-xs text-slate-300">
              {/* Message Snippet */}
              <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-semibold text-indigo-300">
                    {selectedMessageForInfo.displayName || selectedMessageForInfo.username}
                  </span>
                  <span>{formatFullDateTime(selectedMessageForInfo.timestamp)}</span>
                </div>
                <p className="text-sm text-white whitespace-pre-wrap break-words">
                  {selectedMessageForInfo.text}
                </p>
              </div>

              {/* Status Banner */}
              <div className="p-3.5 rounded-xl bg-[#1e293b]/50 border border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-slate-400 font-medium">Status:</span>
                  {selectedMessageForInfo.status === 'sending' || selectedMessageForInfo.id.startsWith('temp_') ? (
                    <span className="inline-flex items-center gap-1 text-amber-400 font-semibold px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/20">
                      <Clock className="h-3 w-3 animate-pulse" />
                      Sending
                    </span>
                  ) : selectedMessageForInfo.status === 'sent' && !(selectedMessageForInfo.readBy || []).some((r) => r.user !== selectedMessageForInfo.userId) && !selectedMessageForInfo.deliveredAt ? (
                    <span className="inline-flex items-center gap-1 text-slate-300 font-semibold px-2 py-0.5 rounded-full bg-slate-400/10 border border-slate-400/20">
                      <Check className="h-3.5 w-3.5 text-slate-400" />
                      Sent
                    </span>
                  ) : (selectedMessageForInfo.readBy || []).filter((r) => r.user !== selectedMessageForInfo.userId).length > 0 || selectedMessageForInfo.status === 'read' ? (
                    <span className="inline-flex items-center gap-1 text-sky-400 font-semibold px-2 py-0.5 rounded-full bg-sky-400/10 border border-sky-400/20">
                      <CheckCheck className="h-3.5 w-3.5 text-sky-400 drop-shadow-[0_0_5px_rgba(56,189,248,0.5)]" />
                      Read
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-slate-300 font-semibold px-2 py-0.5 rounded-full bg-slate-400/10 border border-slate-400/20">
                      <CheckCheck className="h-3.5 w-3.5 text-slate-400" />
                      Delivered
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400">
                  ID: <span className="font-mono text-[10px] opacity-75">{selectedMessageForInfo.id.slice(0, 10)}...</span>
                </div>
              </div>

              {/* Delivery Timeline */}
              <div className="space-y-2">
                <h4 className="font-semibold text-white flex items-center gap-1.5 text-xs">
                  <CheckCheck className="h-3.5 w-3.5 text-slate-400" />
                  <span>Timeline</span>
                </h4>
                <div className="space-y-1.5 pl-2 border-l border-white/10 ml-2">
                  <div className="flex items-center justify-between text-[11px] py-1">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Check className="h-3 w-3 text-slate-400" />
                      Sent to Server:
                    </span>
                    <span className="font-medium text-slate-200">
                      {formatFullDateTime(selectedMessageForInfo.timestamp)}
                    </span>
                  </div>
                  {(selectedMessageForInfo.deliveredAt || selectedMessageForInfo.status === 'delivered' || selectedMessageForInfo.status === 'read' || (selectedMessageForInfo.readBy || []).some((r) => r.user !== selectedMessageForInfo.userId)) && (
                    <div className="flex items-center justify-between text-[11px] py-1">
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <CheckCheck className="h-3 w-3 text-slate-400" />
                        Delivered to Classroom:
                      </span>
                      <span className="font-medium text-slate-200">
                        {formatFullDateTime(selectedMessageForInfo.deliveredAt || selectedMessageForInfo.timestamp)}
                      </span>
                    </div>
                  )}
                  {((selectedMessageForInfo.readBy || []).filter((r) => r.user !== selectedMessageForInfo.userId).length > 0 || selectedMessageForInfo.status === 'read') && (
                    <div className="flex items-center justify-between text-[11px] py-1">
                      <span className="text-sky-400 flex items-center gap-1.5">
                        <CheckCheck className="h-3 w-3 text-sky-400" />
                        Read by Classmates:
                      </span>
                      <span className="font-medium text-sky-300">
                        {formatFullDateTime(
                          (selectedMessageForInfo.readBy || []).find((r) => r.user !== selectedMessageForInfo.userId)?.readAt ||
                          selectedMessageForInfo.timestamp
                        )}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Read Receipts List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-white flex items-center gap-1.5 text-xs">
                    <CheckCheck className="h-3.5 w-3.5 text-sky-400" />
                    <span>Read By</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 font-semibold text-[10px] border border-sky-500/30">
                    {
                      (selectedMessageForInfo.readBy || []).filter(
                        (r) => r.user !== selectedMessageForInfo.userId
                      ).length
                    }{' '}
                    Classmate(s)
                  </span>
                </div>

                {(() => {
                  const classmatesWhoRead = (selectedMessageForInfo.readBy || []).filter(
                    (r) => r.user !== selectedMessageForInfo.userId
                  );

                  if (classmatesWhoRead.length === 0) {
                    return (
                      <div className="p-3.5 rounded-xl bg-white/5 border border-white/5 text-center text-slate-400 text-xs">
                        <p className="font-medium text-slate-300 mb-1">Delivered to classroom</p>
                        <p className="text-[11px] text-slate-500">
                          Waiting for classmates to open the chat to register read receipts.
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {classmatesWhoRead.map((receipt, idx) => (
                        <div
                          key={`${receipt.user}_${idx}`}
                          className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/5 hover:bg-white/10 transition"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                              {(receipt.userName || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-white truncate text-xs">
                                {receipt.userName || 'Classmate'}
                              </p>
                              <p className="text-[10px] text-slate-400">
                                {receipt.user === currentUser.id ? 'You' : 'Classmate'}
                              </p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-[10px] text-sky-400 font-medium block">
                              {formatFullDateTime(receipt.readAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-white/10 bg-[#1e293b]/40 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedMessageForInfo(null)}
                className="px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
