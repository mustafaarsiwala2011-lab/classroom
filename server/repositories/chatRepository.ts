/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';
import { ChatMessageDto, ConversationDto } from '../dtos/chat.dto.js';

export class ChatRepository {
  public getAllMessages(conversationId = 'conv_general'): ChatMessageDto[] {
    const db = dbEngine.load();
    const targetId = conversationId === 'general' ? 'conv_general' : conversationId;
    return (db.messages || []).filter(m => (m.conversationId || 'conv_general') === targetId);
  }

  public findMessageById(id: string): ChatMessageDto | undefined {
    const db = dbEngine.load();
    return (db.messages || []).find(m => m.id === id);
  }

  public saveMessage(message: ChatMessageDto): ChatMessageDto {
    const db = dbEngine.load();
    if (!db.messages) db.messages = [];
    
    const index = db.messages.findIndex(m => m.id === message.id);
    if (index > -1) {
      db.messages[index] = message;
    } else {
      db.messages.push(message);
    }

    // Keep last 300 messages
    if (db.messages.length > 300) {
      db.messages = db.messages.slice(-300);
    }

    dbEngine.save(db);
    return message;
  }

  public deleteMessage(id: string): boolean {
    const db = dbEngine.load();
    if (!db.messages) return false;
    const initialLen = db.messages.length;
    db.messages = db.messages.filter(m => m.id !== id);
    if (db.messages.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }

  public getAllConversations(): ConversationDto[] {
    const db = dbEngine.load();
    return (db.conversations || []) as ConversationDto[];
  }

  public findConversationById(id: string): ConversationDto | undefined {
    const db = dbEngine.load();
    return (db.conversations || []).find(c => c.id === id) as ConversationDto | undefined;
  }

  public saveConversation(conversation: ConversationDto): ConversationDto {
    const db = dbEngine.load();
    if (!db.conversations) db.conversations = [];
    const index = db.conversations.findIndex(c => c.id === conversation.id);
    if (index > -1) {
      db.conversations[index] = conversation as any;
    } else {
      db.conversations.push(conversation as any);
    }
    dbEngine.save(db);
    return conversation;
  }
}

export const chatRepository = new ChatRepository();
