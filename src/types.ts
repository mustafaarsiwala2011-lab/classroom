/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface User {
  id: string;
  username: string; // TR NO. or username
  isMemeMaster: boolean;
  isFailMaster?: boolean;
  avatarColor: string;
  avatarInitials?: string;
  photoURL?: string;
  avatarUrl?: string;
  isApproved?: boolean;
  trNo?: string;
  name?: string;
  email?: string;
  phone?: string;
  birthday?: string;
  waras?: string;
  city?: string;
  bio?: string;
  roomNo?: string;
  role?: 'superadmin' | 'admin' | 'student';
  hasChangedDefaultPassword?: boolean;
}

export interface EntryRequest {
  id: string;
  userId: string;
  username: string;
  trNo: string;
  name: string;
  email?: string;
  photoURL?: string;
  phone?: string;
  waras?: string;
  city?: string;
  roomNo?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  permissionsRequested: string[];
}

export interface MessageReaction {
  user: string; // userId
  userName?: string;
  emoji: string;
  createdAt?: string;
}

export interface MessageEditHistory {
  content: string;
  editedAt: string;
}

export interface ReadReceipt {
  user: string;
  userName?: string;
  readAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId?: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarColor?: string;
  photoURL?: string;
  avatarUrl?: string;
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
  reactions?: MessageReaction[];
  edited?: boolean;
  editHistory?: MessageEditHistory[];
  deleted?: boolean;
  deletedAt?: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
  deliveredAt?: string;
  readBy?: ReadReceipt[];
}

export interface ConversationParticipant {
  userId: string;
  username: string;
  displayName?: string;
  avatarColor?: string;
  photoURL?: string;
  avatarUrl?: string;
  role: 'owner' | 'admin' | 'member';
  joinedAt?: string;
  lastReadMessage?: string | null;
  unreadCount?: number;
  isOnline?: boolean;
  lastSeen?: string;
}

export interface Conversation {
  id: string;
  type: 'classroom' | 'group' | 'direct';
  name?: string;
  participants: ConversationParticipant[];
  classroomId?: string;
  createdBy?: string;
  isActive?: boolean;
  lastMessage?: ChatMessage | null;
  createdAt: string;
  updatedAt: string;
}

export type MemeType = 'quote' | 'image';

export interface Meme {
  id: string;
  authorId: string;
  authorName: string;
  type: MemeType;
  content: string; // Quote text or Image URL
  title?: string;
  bgGradient?: string; // Visual gradient CSS if quote
  timestamp: string;
}

export interface ClassNote {
  id: string;
  title: string;
  content: string;
  subject: string;
  authorId: string;
  authorName: string;
  imageUrl?: string;
  noteType?: 'text' | 'image' | 'both';
  createdAt: string;
  updatedAt: string;
}

export type EventType = 'birthday' | 'waras';

export interface CalendarEvent {
  id: string;
  name: string;
  date: string; // Format: "MM-DD" or "YYYY-MM-DD"
  type: EventType;
  details?: string; // E.g., "Student birthday" or "Urus description"
  year?: number; // Optional year of event
}

export interface PollOption {
  id: string;
  label: string;
  votes: number;
}

export interface Poll {
  id: string;
  question: string;
  options: PollOption[];
  authorId: string;
  authorName: string;
  timestamp: string;
  userVotes: Record<string, string>; // userId -> optionId
}

export interface FailedWord {
  id: string;
  word: string; // The funny misspoken word/phrase
  intendedWord?: string; // What they actually meant to say
  spokenBy: string; // Name or TR No of who spoke it
  spokenByUserId?: string;
  when: string; // Time/date/class period when it was uttered
  background: string; // The context/story of the slip
  category?: 'mispronunciation' | 'slip_of_tongue' | 'invented_word' | 'grammar_twist' | 'classic_blunder' | string;
  authorId: string; // Fail Master's user ID
  authorName: string; // Fail Master's name
  reactions?: Record<string, number>; // emoji -> count
  userReactions?: Record<string, string>; // userId -> emoji
  timestamp: string;
}

export interface SystemHealth {
  status: 'ok' | 'degraded' | 'error';
  uptimeSeconds: number;
  memory: {
    rssMb: number;
    heapTotalMb: number;
    heapUsedMb: number;
    externalMb: number;
  };
  counts: {
    users: number;
    messages: number;
    notes: number;
    memes: number;
    failedWords: number;
    notices: number;
    polls: number;
    events: number;
  };
  sseConnections: number;
  nodeEnv: string;
  timestamp: string;
  version: string;
}

export interface SystemMetrics {
  totalRequests: number;
  statusCodes: {
    '2xx': number;
    '4xx': number;
    '5xx': number;
  };
  avgLatencyMs: number;
  requestsPerMinute: number;
  peakMemoryMb: number;
  topRoutes: Array<{ route: string; hits: number }>;
}

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'AI' | 'SSE' | 'AUTH';
  message: string;
  meta?: Record<string, any>;
}

export interface AiNoteSummary {
  summary: string;
  keyPoints: string[];
  vocabulary: Array<{ term: string; definition: string }>;
  examTips: string[];
}

export interface AiQuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface AiQuiz {
  title: string;
  subject: string;
  questions: AiQuizQuestion[];
}

export type AiSummaryResponse = AiNoteSummary;
export type AiQuizResponse = AiQuiz;

export interface AiMemeIdea {
  title: string;
  quote: string;
  bgGradient: string;
  vibe: string;
}

export interface AiFailAnalysis {
  word: string;
  intendedWord: string;
  phoneticHumorRating: number; // 1-10
  analysis: string;
  roastComment: string;
  suggestedEmoji: string;
}

export interface SearchResultItem {
  id: string;
  type: 'note' | 'meme' | 'fail' | 'message' | 'user' | 'notice';
  title: string;
  subtitle: string;
  snippet?: string;
  metadata?: Record<string, any>;
  tab: 'notes' | 'memes' | 'fails' | 'chat' | 'settings' | 'dashboard' | 'profile';
  score?: number;
}

