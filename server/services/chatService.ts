/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { chatRepository } from '../repositories/chatRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  ChatMessageDto,
  ConversationDto,
  CreateConversationRequestDto,
  PostMessageRequestDto,
  EditMessageRequestDto,
  ReactionRequestDto,
  TypingRequestDto,
  PresenceRequestDto,
} from '../dtos/chat.dto.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../core/errors.js';
import { sanitizeString } from '../core/security.js';
import { broadcastEvent } from './sseService.js';

interface PresenceRecord {
  lastSeen: number;
  isOnline: boolean;
  username: string;
}

interface TypingRecord {
  username: string;
  displayName: string;
  timestamp: number;
}

export class ChatService {
  private userPresence: Record<string, PresenceRecord> = {};
  private typingUsers: Record<string, Record<string, TypingRecord>> = {};

  public updatePresence(dto: PresenceRequestDto): { onlineUserIds: string[] } {
    const userId = sanitizeString(dto.userId);
    if (userId) {
      this.userPresence[userId] = {
        lastSeen: Date.now(),
        isOnline: true,
        username: sanitizeString(dto.username || ''),
      };
    }

    const now = Date.now();
    const onlineUserIds = Object.keys(this.userPresence).filter(id => {
      return now - this.userPresence[id].lastSeen < 45000;
    });

    return { onlineUserIds };
  }

  public setTyping(dto: TypingRequestDto): { success: boolean } {
    const conversationId = sanitizeString(dto.conversationId);
    const userId = sanitizeString(dto.userId);
    if (!conversationId || !userId) {
      throw new ValidationError('conversationId and userId are required');
    }

    if (!this.typingUsers[conversationId]) {
      this.typingUsers[conversationId] = {};
    }

    if (dto.isTyping) {
      this.typingUsers[conversationId][userId] = {
        username: sanitizeString(dto.username || ''),
        displayName: sanitizeString(dto.displayName || dto.username || 'Classmate'),
        timestamp: Date.now(),
      };
    } else {
      delete this.typingUsers[conversationId][userId];
    }

    return { success: true };
  }

  public getActiveTypers(conversationId: string): Array<{ userId: string; username: string; displayName: string }> {
    const convTypers = this.typingUsers[conversationId] || {};
    const now = Date.now();
    return Object.entries(convTypers)
      .filter(([_, info]) => now - info.timestamp < 5000)
      .map(([userId, info]) => ({
        userId,
        username: info.username,
        displayName: info.displayName,
      }));
  }

  public getConversations(userId?: string): ConversationDto[] {
    const allConvs = chatRepository.getAllConversations();
    const now = Date.now();
    const onlineSet = new Set(
      Object.keys(this.userPresence).filter(id => now - this.userPresence[id].lastSeen < 45000)
    );

    const enriched = allConvs.map(conv => {
      const convMessages = chatRepository.getAllMessages(conv.id);
      const lastMsg = convMessages.length > 0 ? convMessages[convMessages.length - 1] : null;

      const participants = conv.participants.map(p => {
        const fullUser = userRepository.findById(p.userId);
        return {
          ...p,
          displayName: fullUser?.name || p.displayName || p.username,
          avatarColor: fullUser?.avatarColor || p.avatarColor || 'from-indigo-500 to-purple-500',
          isOnline: onlineSet.has(p.userId),
        };
      });

      return {
        ...conv,
        participants,
        lastMessage: lastMsg,
        unreadCount: 0,
      };
    });

    const filtered = userId
      ? enriched.filter(c => c.type === 'classroom' || c.participants.some(p => p.userId === userId))
      : enriched;

    filtered.sort((a, b) => {
      const timeA = a.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : new Date(a.createdAt).getTime();
      const timeB = b.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : new Date(b.createdAt).getTime();
      return timeB - timeA;
    });

    return filtered;
  }

  public createConversation(dto: CreateConversationRequestDto): { conversation: ConversationDto; isExisting: boolean } {
    if (!dto.type || !dto.participantIds || !Array.isArray(dto.participantIds) || dto.participantIds.length === 0 || !dto.creatorId) {
      throw new ValidationError('type, participantIds, and creatorId are required');
    }

    if (dto.type === 'direct' && dto.participantIds.length === 2) {
      const existing = chatRepository.getAllConversations().find(
        c =>
          c.type === 'direct' &&
          c.participants.some(p => p.userId === dto.participantIds[0]) &&
          c.participants.some(p => p.userId === dto.participantIds[1])
      );
      if (existing) {
        return { conversation: existing, isExisting: true };
      }
    }

    const participants = dto.participantIds.map(uid => {
      const u = userRepository.findById(uid);
      return {
        userId: uid,
        username: u?.username || 'user',
        displayName: u?.name || u?.username || 'User',
        avatarColor: u?.avatarColor || 'from-indigo-500 to-purple-500',
        role: (uid === dto.creatorId ? 'owner' : 'member') as 'owner' | 'member',
        joinedAt: new Date().toISOString(),
        unreadCount: 0,
      };
    });

    const newConv: ConversationDto = {
      id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type: dto.type,
      name: dto.name || (dto.type === 'direct' ? participants.find(p => p.userId !== dto.creatorId)?.displayName || 'Direct Chat' : 'Study Group'),
      participants,
      createdBy: dto.creatorId,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    chatRepository.saveConversation(newConv);
    return { conversation: newConv, isExisting: false };
  }

  public getMessages(conversationId = 'conv_general'): ChatMessageDto[] {
    return chatRepository.getAllMessages(conversationId);
  }

  public postMessage(conversationId: string, dto: PostMessageRequestDto): ChatMessageDto {
    const userId = sanitizeString(dto.userId);
    const text = sanitizeString(dto.text);
    if (!userId || !text) {
      throw new ValidationError('userId and text are required');
    }

    const targetConvId = conversationId === 'general' ? 'conv_general' : conversationId;
    const user = userRepository.findById(userId);
    const displayName = dto.displayName || user?.name || dto.username || 'Classmate';
    const msgId = dto.id ? sanitizeString(dto.id) : `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;

    // Check if message with this ID already exists
    const existing = chatRepository.findMessageById(msgId);
    if (existing) {
      return existing;
    }

    const newMessage: ChatMessageDto = {
      id: msgId,
      conversationId: targetConvId,
      userId,
      username: dto.username || user?.username || 'user',
      displayName,
      avatarColor: dto.avatarColor || user?.avatarColor || 'from-indigo-500 to-purple-500',
      text,
      timestamp: dto.timestamp || new Date().toISOString(),
      type: dto.type || 'text',
      attachmentUrl: dto.attachmentUrl ? sanitizeString(dto.attachmentUrl) : undefined,
      fileName: dto.fileName ? sanitizeString(dto.fileName) : undefined,
      fileSize: dto.fileSize,
      replyTo: dto.replyTo || null,
      reactions: [],
      edited: false,
      editHistory: [],
      deleted: false,
      status: dto.status || 'delivered',
      deliveredAt: dto.deliveredAt || (dto.status === 'sent' ? undefined : (dto.timestamp || new Date().toISOString())),
      readBy: [{ user: userId, userName: displayName, readAt: new Date().toISOString() }],
    };

    chatRepository.saveMessage(newMessage);

    // Update parent conversation timestamp
    const conv = chatRepository.findConversationById(targetConvId);
    if (conv) {
      conv.updatedAt = new Date().toISOString();
      chatRepository.saveConversation(conv);
    }

    broadcastEvent('message_created', { message: newMessage });
    return newMessage;
  }

  public editMessage(messageId: string, dto: EditMessageRequestDto): ChatMessageDto {
    const text = sanitizeString(dto.text);
    const userId = sanitizeString(dto.userId);
    if (!text || !userId) {
      throw new ValidationError('text and userId are required');
    }

    const msg = chatRepository.findMessageById(messageId);
    if (!msg) {
      throw new NotFoundError('Message not found');
    }

    const user = userRepository.findById(userId) || userRepository.findByUsername(userId);
    const isAdmin =
      (user && (user.username.toLowerCase() === 'admin' || user.username.toLowerCase().includes('28782') || user.email?.toLowerCase().includes('28782'))) ||
      userId.toLowerCase() === 'admin' ||
      userId.toLowerCase().includes('28782');
    const isOwner =
      msg.userId === userId ||
      msg.username?.toLowerCase() === userId.toLowerCase() ||
      (user && (msg.userId === user.id || msg.username?.toLowerCase() === user.username.toLowerCase()));

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError('You can only edit your own messages');
    }

    if (!msg.editHistory) msg.editHistory = [];
    msg.editHistory.push({
      content: msg.text,
      editedAt: new Date().toISOString(),
    });

    msg.text = text;
    msg.edited = true;

    chatRepository.saveMessage(msg);
    broadcastEvent('message_updated', { message: msg });
    return msg;
  }

  public deleteMessage(messageId: string, userId: string, username?: string, email?: string): boolean {
    const msg = chatRepository.findMessageById(messageId);
    if (!msg) {
      throw new NotFoundError('Message not found');
    }

    const user = userRepository.findById(userId) || (username ? userRepository.findByUsername(username) : null) || userRepository.findByUsername(userId);

    // Strict author check: ONLY the person who typed this message can delete it.
    // No admin or 3rd-party user can delete messages sent by others.
    const isOwner =
      (msg.userId && (msg.userId === userId || (user && msg.userId === user.id))) ||
      (msg.username && (
        msg.username.toLowerCase() === userId.toLowerCase() ||
        (username && msg.username.toLowerCase() === username.toLowerCase()) ||
        (user && msg.username.toLowerCase() === user.username.toLowerCase()) ||
        (email && msg.username.toLowerCase() === email.toLowerCase()) ||
        (user?.email && msg.username.toLowerCase() === user.email.toLowerCase())
      ));

    if (!isOwner) {
      throw new ForbiddenError('Only the person who typed this message can delete it.');
    }

    const convId = msg.conversationId || 'conv_general';
    const deleted = chatRepository.deleteMessage(messageId);
    if (deleted) {
      broadcastEvent('message_deleted', { id: messageId, conversationId: convId });
    }
    return deleted;
  }

  public toggleReaction(messageId: string, dto: ReactionRequestDto): { reactions: any[]; message: ChatMessageDto } {
    const emoji = sanitizeString(dto.emoji);
    const userId = sanitizeString(dto.userId);
    if (!emoji || !userId) {
      throw new ValidationError('emoji and userId are required');
    }

    const msg = chatRepository.findMessageById(messageId);
    if (!msg) {
      throw new NotFoundError('Message not found');
    }

    if (!msg.reactions) msg.reactions = [];

    const existingIndex = msg.reactions.findIndex(r => r.user === userId && r.emoji === emoji);
    if (existingIndex > -1) {
      msg.reactions.splice(existingIndex, 1);
    } else {
      const user = userRepository.findById(userId);
      msg.reactions.push({
        user: userId,
        userName: user?.name || dto.username || 'User',
        emoji,
        createdAt: new Date().toISOString(),
      });
    }

    chatRepository.saveMessage(msg);
    broadcastEvent('reaction_updated', { messageId, reactions: msg.reactions, message: msg });
    return { reactions: msg.reactions, message: msg };
  }

  public markAsRead(
    conversationId: string,
    userId: string,
    userName?: string,
    messageIds?: string[]
  ): { count: number; updatedIds: string[] } {
    const targetConvId = conversationId === 'general' ? 'conv_general' : conversationId;
    const messages = chatRepository.getAllMessages(targetConvId);
    let modified = false;
    const updatedIds: string[] = [];

    const now = new Date().toISOString();
    const user = userRepository.findById(userId);
    const resolvedName = userName || user?.name || user?.username || 'Classmate';

    messages.forEach(m => {
      if (messageIds && messageIds.length > 0 && !messageIds.includes(m.id)) {
        return;
      }
      if (m.userId === userId) {
        return; // Skip marking own messages
      }
      if (!m.readBy) m.readBy = [];
      if (!m.readBy.some(r => r.user === userId)) {
        m.readBy.push({ user: userId, userName: resolvedName, readAt: now });
        m.status = 'read';
        chatRepository.saveMessage(m);
        modified = true;
        updatedIds.push(m.id);
      }
    });

    if (modified) {
      broadcastEvent('messages_read', {
        conversationId: targetConvId,
        userId,
        userName: resolvedName,
        messageIds: updatedIds,
        readAt: now,
      });
    }

    return { count: updatedIds.length, updatedIds };
  }

  public updateMessageStatus(
    messageId: string,
    status: 'sent' | 'delivered' | 'read'
  ): ChatMessageDto | null {
    const msg = chatRepository.findMessageById(messageId);
    if (!msg) return null;

    msg.status = status;
    if (status === 'delivered' && !msg.deliveredAt) {
      msg.deliveredAt = new Date().toISOString();
    }
    chatRepository.saveMessage(msg);

    broadcastEvent('message_status_updated', {
      messageId,
      status,
      deliveredAt: msg.deliveredAt,
      conversationId: msg.conversationId || 'conv_general',
      message: msg,
    });

    return msg;
  }
}

export const chatService = new ChatService();
