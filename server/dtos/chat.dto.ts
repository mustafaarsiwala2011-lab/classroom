/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ParticipantDto {
  userId: string;
  username: string;
  displayName?: string;
  avatarColor?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: string;
  lastReadMessage?: string | null;
  unreadCount?: number;
  isOnline?: boolean;
}

export interface ConversationDto {
  id: string;
  type: 'classroom' | 'group' | 'direct';
  name?: string;
  participants: ParticipantDto[];
  classroomId?: string;
  createdBy?: string;
  isActive?: boolean;
  lastMessage?: ChatMessageDto | null;
  unreadCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ReactionItemDto {
  user: string;
  userName?: string;
  emoji: string;
  createdAt?: string;
}

export interface ReadReceiptDto {
  user: string;
  userName?: string;
  readAt: string;
}

export interface ChatMessageDto {
  id: string;
  conversationId?: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarColor?: string;
  text: string;
  timestamp: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'file';
  attachmentUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    id: string;
    text: string;
    username: string;
  } | null;
  reactions?: ReactionItemDto[];
  edited?: boolean;
  editHistory?: Array<{
    content: string;
    editedAt: string;
  }>;
  deleted?: boolean;
  deletedAt?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  deliveredAt?: string;
  readBy?: ReadReceiptDto[];
}

export interface CreateConversationRequestDto {
  type: 'classroom' | 'group' | 'direct';
  name?: string;
  participantIds: string[];
  creatorId: string;
}

export interface PostMessageRequestDto {
  id?: string;
  userId: string;
  username?: string;
  displayName?: string;
  avatarColor?: string;
  text: string;
  timestamp?: string;
  type?: 'text' | 'image' | 'audio' | 'video' | 'file';
  attachmentUrl?: string;
  fileName?: string;
  fileSize?: number;
  replyTo?: {
    id: string;
    text: string;
    username: string;
  } | null;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  deliveredAt?: string;
}

export interface EditMessageRequestDto {
  userId: string;
  text: string;
}

export interface ReactionRequestDto {
  userId: string;
  emoji: string;
  username?: string;
}

export interface TypingRequestDto {
  conversationId: string;
  userId: string;
  username?: string;
  displayName?: string;
  isTyping: boolean;
}

export interface PresenceRequestDto {
  userId: string;
  username?: string;
}
