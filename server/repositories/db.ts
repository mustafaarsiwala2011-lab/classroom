/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import path from 'path';

export interface DbSchema {
  users: Record<string, {
    id: string;
    username: string;
    passwordHash: string;
    isMemeMaster: boolean;
    isFailMaster?: boolean;
    avatarColor: string;
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
  }>;
  conversations?: Array<{
    id: string;
    type: 'classroom' | 'group' | 'direct';
    name?: string;
    participants: Array<{
      userId: string;
      username: string;
      displayName?: string;
      avatarColor?: string;
      role: 'owner' | 'admin' | 'member';
      joinedAt?: string;
      lastReadMessage?: string | null;
      unreadCount?: number;
    }>;
    classroomId?: string;
    createdBy?: string;
    isActive?: boolean;
    lastMessage?: any;
    createdAt: string;
    updatedAt: string;
  }>;
  messages: Array<{
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
    reactions?: Array<{
      user: string;
      userName?: string;
      emoji: string;
      createdAt?: string;
    }>;
    edited?: boolean;
    editHistory?: Array<{
      content: string;
      editedAt: string;
    }>;
    deleted?: boolean;
    deletedAt?: string;
    readBy?: Array<{
      user: string;
      readAt: string;
    }>;
  }>;
  memes: Array<{
    id: string;
    authorId: string;
    authorName: string;
    type: 'quote' | 'image';
    content: string;
    title?: string;
    bgGradient?: string;
    timestamp: string;
  }>;
  failedWords: Array<{
    id: string;
    word: string;
    intendedWord?: string;
    spokenBy: string;
    spokenByUserId?: string;
    when: string;
    background: string;
    category?: string;
    authorId: string;
    authorName: string;
    reactions?: Record<string, number>;
    userReactions?: Record<string, string>;
    timestamp: string;
  }>;
  notes: Array<{
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
  }>;
  events: Array<{
    id: string;
    name: string;
    date: string;
    type: 'birthday' | 'waras';
    details?: string;
    year?: number;
  }>;
  notices: Array<{
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    color: string;
    timestamp: string;
  }>;
  polls: Array<{
    id: string;
    question: string;
    options: Array<{ id: string; label: string; votes: number }>;
    authorId: string;
    authorName: string;
    timestamp: string;
    userVotes: Record<string, string>;
  }>;
  entryRequests?: Array<{
    id: string;
    userId: string;
    username: string;
    trNo: string;
    name: string;
    email?: string;
    phone?: string;
    waras?: string;
    city?: string;
    roomNo?: string;
    requestedAt: string;
    status: 'pending' | 'approved' | 'rejected';
    permissionsRequested: string[];
  }>;
  spreadsheetUrl?: string;
  spreadsheetData?: Array<Record<string, string>>;
  lastSyncedAt?: string;
}

const DB_FILE = path.join(process.cwd(), 'db.json');

export const getInitialDb = (): DbSchema => {
  return {
    users: {
      '28782': {
        id: 'user_mustafa_28782',
        username: '28782',
        passwordHash: 'master123',
        isMemeMaster: true,
        isFailMaster: true,
        avatarColor: 'from-blue-500 to-indigo-600',
        isApproved: true,
        trNo: '28782',
        name: 'Mustafa (Administrator)',
        phone: '+91 99304 88210',
        birthday: '2001-09-14',
        waras: 'Waras Al-Anwar',
        city: 'Surat',
        bio: 'Classroom Gatekeeper, Administrator, and Study Hub Architect.',
        roomNo: '2112',
      },
      admin: {
        id: 'user_1',
        username: 'admin',
        passwordHash: 'master123',
        isMemeMaster: true,
        isFailMaster: true,
        avatarColor: 'from-purple-500 to-indigo-500',
        isApproved: true,
        trNo: '28782',
        name: 'Administrator',
        phone: '+91 98334 11023',
        birthday: '1985-05-12',
        waras: 'Waras Al-Anwar',
        city: 'Surat',
        bio: 'Classroom Gatekeeper & Administrator.',
        roomNo: '1101',
      },
      '28728': {
        id: 'user_28728',
        username: '28728',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        isFailMaster: false,
        avatarColor: 'from-purple-600 to-indigo-700',
        isApproved: true,
        trNo: '28728',
        name: 'Hatim Sarraf',
        email: '28728@jameasaifiyah.edu',
        phone: '8460905933',
        birthday: '2011-02-12',
        waras: '8 rabi ul aakhar',
        city: 'Surat',
        bio: 'great swimmer',
        roomNo: '2082',
        role: 'student',
      },
      '28612': {
        id: 'user_28612',
        username: '28612',
        passwordHash: 'classroom123',
        isMemeMaster: true,
        isFailMaster: true,
        avatarColor: 'from-blue-500 to-indigo-600',
        isApproved: true,
        trNo: '28612',
        name: 'Burhan Pipe',
        email: '28612@jameasaifiyah.edu',
        phone: 'r',
        waras: 'weef',
        city: 'Nairobi',
        bio: 'Enthusiastic classmate & student of Jamea Saifiyah',
        roomNo: '',
        role: 'student',
      },
      '28622': {
        id: 'user_28622',
        username: '28622',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        avatarColor: 'from-emerald-500 to-teal-500',
        isApproved: true,
        trNo: '28622',
        name: 'Mufaddal',
        email: '28622@jameasaifiyah.edu',
        birthday: '2002-09-26',
        city: 'Surat',
        waras: 'Waras Al-Quds',
        roomNo: '2210',
        role: 'student',
      },
      'meme master': {
        id: 'user_meme_master',
        username: 'tr-101',
        passwordHash: 'classroom123',
        isMemeMaster: true,
        isFailMaster: true,
        avatarColor: 'from-pink-500 to-rose-500',
        isApproved: true,
        trNo: 'TR-101',
        name: 'Burhanuddin',
        email: 'burhanuddin@jameasaifiyah.edu',
        phone: '+91 97734 55102',
        birthday: '2001-08-23',
        waras: 'Waras Al-Quds',
        city: 'Mumbai',
        bio: 'In charge of the classroom high vibes and hilarious memes!',
        roomNo: '1404',
        role: 'student',
      },
      taher: {
        id: 'user_2',
        username: 'tr-102',
        passwordHash: 'classroom123',
        isMemeMaster: true,
        isFailMaster: false,
        avatarColor: 'from-emerald-500 to-teal-500',
        isApproved: true,
        trNo: 'TR-102',
        name: 'Taher',
        email: 'taher@jameasaifiyah.edu',
        phone: '+91 99201 44556',
        birthday: '2000-11-15',
        waras: 'Waras Al-Zahra',
        city: 'Karachi',
        bio: 'React lover, tea fan, and occasional notice publisher.',
        roomNo: '2112',
        role: 'student',
      },
      husain: {
        id: 'user_3',
        username: 'tr-103',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        avatarColor: 'from-amber-500 to-orange-500',
        isApproved: true,
        trNo: 'TR-103',
        name: 'Husain',
        email: 'husain@jameasaifiyah.edu',
        phone: '+91 98112 00456',
        birthday: '2002-03-04',
        waras: 'Waras Al-Azhar',
        city: 'Nairobi',
        bio: 'Passionate learner and classroom regular.',
        roomNo: '1205',
        role: 'student',
      },
      hatim: {
        id: 'user_tr104',
        username: 'tr-104',
        passwordHash: 'classroom123',
        isMemeMaster: true,
        avatarColor: 'from-blue-500 to-sky-500',
        isApproved: true,
        trNo: 'TR-104',
        name: 'Burhanuddin Hatim',
        email: 'hatim@jameasaifiyah.edu',
        city: 'Nairobi',
        waras: 'Waras Al-Quds',
        roomNo: '2231',
        role: 'student',
      },
      mustafa: {
        id: 'user_tr105',
        username: 'tr-105',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        avatarColor: 'from-pink-500 to-rose-500',
        isApproved: true,
        trNo: 'TR-105',
        name: 'Mustafa Kuzema',
        email: 'mustafa.kuzema@jameasaifiyah.edu',
        city: 'Surat',
        waras: 'Waras Al-Anwar',
        roomNo: '2110',
        role: 'student',
      },
      dmin: {
        id: 'user_tr106',
        username: 'tr-106',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        avatarColor: 'from-emerald-500 to-teal-500',
        isApproved: true,
        trNo: 'TR-106',
        name: 'Taher (Dmin)',
        email: 'dmin@jameasaifiyah.edu',
        city: 'Mumbai',
        waras: 'Waras Al-Zahra',
        roomNo: '2115',
        role: 'student',
      },
      abdullah: {
        id: 'user_tr107',
        username: 'tr-107',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        avatarColor: 'from-pink-500 to-rose-500',
        isApproved: true,
        trNo: 'TR-107',
        name: 'Abdullah',
        email: 'abdullah@jameasaifiyah.edu',
        city: 'Surat',
        waras: 'Waras Al-Quds',
        roomNo: '2120',
        role: 'student',
      },
      newstudent: {
        id: 'user_tr108',
        username: 'tr-108',
        passwordHash: 'classroom123',
        isMemeMaster: false,
        avatarColor: 'from-indigo-500 to-purple-600',
        isApproved: true,
        trNo: 'TR-108',
        name: 'New Student',
        email: 'newstudent@jameasaifiyah.edu',
        role: 'student',
      },
    },
    conversations: [
      {
        id: 'conv_general',
        type: 'classroom',
        name: 'General Classroom',
        participants: [
          { userId: 'user_1', username: 'admin', displayName: 'Admin Teacher', avatarColor: 'from-purple-500 to-indigo-500', role: 'owner', joinedAt: new Date().toISOString(), unreadCount: 0 },
          { userId: 'user_mustafa_28782', username: '28782', displayName: 'Mustafa', avatarColor: 'from-blue-500 to-sky-500', role: 'member', joinedAt: new Date().toISOString(), unreadCount: 0 },
          { userId: 'user_meme_master', username: 'tr-101', displayName: 'Burhanuddin', avatarColor: 'from-pink-500 to-rose-500', role: 'member', joinedAt: new Date().toISOString(), unreadCount: 0 },
          { userId: 'user_2', username: 'tr-102', displayName: 'Taher', avatarColor: 'from-emerald-500 to-teal-500', role: 'member', joinedAt: new Date().toISOString(), unreadCount: 0 },
          { userId: 'user_3', username: 'tr-103', displayName: 'Husain', avatarColor: 'from-amber-500 to-orange-500', role: 'member', joinedAt: new Date().toISOString(), unreadCount: 0 },
        ],
        createdBy: 'user_1',
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    messages: [
      {
        id: 'msg_init_1',
        conversationId: 'conv_general',
        userId: 'user_1',
        username: 'admin',
        displayName: 'Admin Teacher',
        avatarColor: 'from-purple-500 to-indigo-500',
        text: 'Ahlan wa Sahlan to the Classroom Hub! Check out the class notes, meme section, and calendar.',
        timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
        type: 'text',
        reactions: [{ user: 'user_mustafa_28782', userName: 'Mustafa', emoji: '❤️' }],
      },
      {
        id: 'msg_init_2',
        conversationId: 'conv_general',
        userId: 'user_mustafa_28782',
        username: '28782',
        displayName: 'Mustafa',
        avatarColor: 'from-blue-500 to-sky-500',
        text: 'Salam all! High-tech enterprise backend is active with live real-time synchronization.',
        timestamp: new Date(Date.now() - 1800000).toISOString(),
        type: 'text',
        reactions: [{ user: 'user_1', userName: 'Admin Teacher', emoji: '🔥' }],
      },
    ],
    memes: [
      {
        id: 'meme_init_1',
        authorId: 'user_meme_master',
        authorName: 'Burhanuddin',
        type: 'quote',
        content: '"When the teacher says the test will be easy, but question 1 starts with: Elaborate on the existential purpose of syntax."',
        title: 'Exam Season Philosophy',
        bgGradient: 'from-purple-900 via-violet-800 to-pink-700 text-white',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    failedWords: [
      {
        id: 'fail_init_1',
        word: 'Compilification',
        intendedWord: 'Compilation',
        spokenBy: 'Taher',
        spokenByUserId: 'user_2',
        when: 'During Nahw revision session',
        background: 'Tried explaining code compilation and accidentally created a brand new term.',
        category: 'invented_word',
        authorId: 'user_1',
        authorName: 'Admin Teacher',
        reactions: { '😂': 4, '🔥': 2 },
        userReactions: { 'user_1': '😂' },
        timestamp: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
    notes: [
      {
        id: 'note_init_1',
        title: 'Mabadi al-Nahw - Section 4: Jumla Ismiyyah & Fi\'liyyah',
        content: 'Comprehensive review of nominal and verbal sentence structures. Key markers include Mubtada and Khabar with Raf\' cases.',
        subject: 'Nahw & Grammar',
        authorId: 'user_1',
        authorName: 'Admin Teacher',
        noteType: 'text',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      },
    ],
    events: [
      {
        id: 'evt_init_1',
        name: 'Mustafa Birthday',
        date: '09-14',
        type: 'birthday',
        details: 'Classroom celebration with tea & biscuits',
        year: 2001,
      },
      {
        id: 'evt_init_2',
        name: 'Milad Imam al-Zaman AS',
        date: '04-04',
        type: 'waras',
        details: 'Mubarak Urs & Auspicious Occasion',
      },
    ],
    notices: [
      {
        id: 'notice_init_1',
        text: 'Classroom Study Group meets every Tuesday & Thursday evening in Room 2112.',
        authorId: 'user_1',
        authorName: 'Admin Teacher',
        color: 'from-amber-500 to-orange-500',
        timestamp: new Date(Date.now() - 86400000).toISOString(),
      },
    ],
    polls: [
      {
        id: 'poll_init_1',
        question: 'Which study topic should we review in the upcoming workshop?',
        options: [
          { id: 'opt_1', label: 'Advanced Nahw & Irab', votes: 4 },
          { id: 'opt_2', label: 'Modern Web Architecture & APIs', votes: 7 },
          { id: 'opt_3', label: 'Fiqh Q&A Session', votes: 3 },
        ],
        authorId: 'user_1',
        authorName: 'Admin Teacher',
        timestamp: new Date().toISOString(),
        userVotes: { 'user_mustafa_28782': 'opt_2' },
      },
    ],
  };
};

/**
 * Thread-safe atomic file-based Database Engine
 */
class DatabaseEngine {
  private static instance: DatabaseEngine;
  private cache: DbSchema | null = null;

  private constructor() {
    this.ensureInitialized();
  }

  public static getInstance(): DatabaseEngine {
    if (!DatabaseEngine.instance) {
      DatabaseEngine.instance = new DatabaseEngine();
    }
    return DatabaseEngine.instance;
  }

  private ensureInitialized(): void {
    if (!fs.existsSync(DB_FILE)) {
      const initial = getInitialDb();
      this.writeToDisk(initial);
      this.cache = initial;
    } else {
      this.load();
    }
  }

  public load(): DbSchema {
    try {
      if (this.cache) return this.cache;
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed: DbSchema = JSON.parse(data);

      let modified = false;

      if (!parsed.users) { parsed.users = {}; modified = true; }
      if (!parsed.messages) { parsed.messages = []; modified = true; }
      if (!parsed.memes) { parsed.memes = []; modified = true; }
      if (!parsed.failedWords) { parsed.failedWords = []; modified = true; }
      if (!parsed.notes) { parsed.notes = []; modified = true; }
      if (!parsed.events) { parsed.events = []; modified = true; }
      if (!parsed.notices) { parsed.notices = []; modified = true; }
      if (!parsed.polls) { parsed.polls = []; modified = true; }
      if (!parsed.entryRequests) { parsed.entryRequests = []; modified = true; }
      if (!parsed.conversations) {
        parsed.conversations = getInitialDb().conversations;
        modified = true;
      }

      // Ensure 28782 exists as the primary administrator with master123
      if (!parsed.users['28782']) {
        parsed.users['28782'] = getInitialDb().users['28782'];
        modified = true;
      } else {
        if (parsed.users['28782'].passwordHash === 'class123') {
          parsed.users['28782'].passwordHash = 'master123';
          modified = true;
        }
        parsed.users['28782'].isApproved = true;
        parsed.users['28782'].isMemeMaster = true;
        parsed.users['28782'].isFailMaster = true;
      }

      // Ensure all canonical initial users exist and their real profiles are populated
      const initialUsers = getInitialDb().users;
      Object.entries(initialUsers).forEach(([k, initUser]) => {
        if (!parsed.users[k]) {
          parsed.users[k] = initUser;
          modified = true;
        } else {
          const cur = parsed.users[k];
          const isNum = (s?: string) => Boolean(s && !isNaN(Number(s.trim())));
          if (initUser.name && (!cur.name || isNum(cur.name))) {
            cur.name = initUser.name;
            modified = true;
          }
          if (initUser.phone && (!cur.phone || cur.phone === '')) {
            cur.phone = initUser.phone;
            modified = true;
          }
          if (initUser.waras && (!cur.waras || cur.waras === '')) {
            cur.waras = initUser.waras;
            modified = true;
          }
          if (initUser.bio && (!cur.bio || cur.bio === '')) {
            cur.bio = initUser.bio;
            modified = true;
          }
          if (initUser.roomNo && (!cur.roomNo || cur.roomNo === '')) {
            cur.roomNo = initUser.roomNo;
            modified = true;
          }
          if (initUser.email && (!cur.email || cur.email === '')) {
            cur.email = initUser.email;
            modified = true;
          }
        }
      });

      // Ensure admin alias has master123
      if (parsed.users['admin']) {
        if (parsed.users['admin'].passwordHash === 'class123') {
          parsed.users['admin'].passwordHash = 'master123';
          modified = true;
        }
      }

      // Migrate any legacy student users with default 'class123' to 'classroom123'
      Object.values(parsed.users).forEach(u => {
        if (u.username !== '28782' && u.username !== 'admin' && u.passwordHash === 'class123') {
          u.passwordHash = 'classroom123';
          modified = true;
        }
      });

      // Ensure General conversation exists with all users
      const generalConv = parsed.conversations?.find(c => c.id === 'conv_general');
      if (generalConv) {
        const existingUserIds = new Set(generalConv.participants.map(p => p.userId));
        Object.values(parsed.users).forEach(u => {
          if (!existingUserIds.has(u.id)) {
            generalConv.participants.push({
              userId: u.id,
              username: u.username,
              displayName: u.name || u.username,
              avatarColor: u.avatarColor,
              role: 'member',
              joinedAt: new Date().toISOString(),
              unreadCount: 0,
            });
            modified = true;
          }
        });
      }

      this.cache = parsed;
      if (modified) {
        this.save(parsed);
      }
      return parsed;
    } catch (err) {
      console.error('Error reading db.json, recovering with initial state:', err);
      const fallback = getInitialDb();
      this.save(fallback);
      return fallback;
    }
  }

  public save(data: DbSchema): void {
    this.cache = data;
    this.writeToDisk(data);
  }

  private writeToDisk(data: DbSchema): void {
    try {
      const tempPath = `${DB_FILE}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempPath, DB_FILE);
    } catch (err) {
      console.error('Error atomic writing to db.json:', err);
    }
  }
}

export const dbEngine = DatabaseEngine.getInstance();
