/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine, DbSchema } from './db.js';
import { EntryRequestDto } from '../dtos/auth.dto.js';

export interface UserEntity {
  id: string;
  username: string;
  passwordHash: string;
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

export function normalizeTrNo(tr?: string): string {
  if (!tr) return '';
  return tr.toUpperCase().replace(/^TR[-_\s]*/i, '').replace(/[^A-Z0-9]/gi, '').trim();
}

export function normalizeNameOrUsername(str?: string): string {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/gi, '').trim();
}

export class UserRepository {
  public getAll(): UserEntity[] {
    const db = dbEngine.load();
    const rawList: UserEntity[] = Object.values(db.users || {});

    // Recover any classmates who joined conversations or entered requests
    if (db.conversations) {
      for (const conv of db.conversations) {
        if (Array.isArray(conv.participants)) {
          for (const p of conv.participants) {
            if (!p || !p.username) continue;
            const isTrLike = /^tr-?\d+/i.test(p.username) || /^\d{5}$/.test(p.username);
            rawList.push({
              id: p.userId || `user_${p.username}`,
              username: p.username,
              name: p.displayName || p.username,
              avatarColor: p.avatarColor || 'from-indigo-500 to-purple-600',
              passwordHash: '',
              isMemeMaster: false,
              isApproved: true,
              role: 'student',
              trNo: isTrLike ? normalizeTrNo(p.username) : undefined,
            });
          }
        }
      }
    }

    if (Array.isArray(db.entryRequests)) {
      for (const req of db.entryRequests) {
        if (!req || !req.username) continue;
        const isTrLike = /^tr-?\d+/i.test(req.username) || /^\d{5}$/.test(req.username);
        rawList.push({
          id: req.userId || req.id || `user_${req.username}`,
          username: req.username,
          name: req.name || req.username,
          email: req.email,
          trNo: req.trNo || (isTrLike ? normalizeTrNo(req.username) : undefined),
          phone: req.phone,
          avatarColor: 'from-blue-500 to-indigo-600',
          passwordHash: '',
          isMemeMaster: false,
          isApproved: req.status === 'approved',
          role: 'student',
        });
      }
    }

    return this.deduplicateUsers(rawList);
  }

  public deduplicateUsers(users: UserEntity[]): UserEntity[] {
    const unified: UserEntity[] = [];

    for (const u of users) {
      const uTr = normalizeTrNo(u.trNo || u.username);
      const uNormName = normalizeNameOrUsername(u.name);
      const uEmail = (u.email || '').toLowerCase().trim();
      const uId = (u.id || '').trim();

      const existingIndex = unified.findIndex(existing => {
        if (uId && existing.id === uId) return true;
        const exTr = normalizeTrNo(existing.trNo || existing.username);
        if (uTr && exTr && uTr === exTr) return true;
        if (uEmail && existing.email && existing.email.toLowerCase().trim() === uEmail) return true;
        if (uTr && existing.email && existing.email.toLowerCase().startsWith(uTr.toLowerCase() + '@')) return true;
        if (exTr && uEmail && uEmail.startsWith(exTr.toLowerCase() + '@')) return true;
        const exNormName = normalizeNameOrUsername(existing.name);
        if (uNormName && exNormName && uNormName.length > 2 && uNormName === exNormName) return true;
        return false;
      });

      if (existingIndex > -1) {
        const existing = unified[existingIndex];
        const isNumeric = (s?: string) => Boolean(s && !isNaN(Number(s.trim())));
        const bestName = (u.name && !isNumeric(u.name)) ? u.name : (existing.name && !isNumeric(existing.name) ? existing.name : (u.name || existing.name));
        const bestTr = u.trNo || existing.trNo || (uTr ? uTr : undefined);

        unified[existingIndex] = {
          ...existing,
          ...u,
          id: existing.id || u.id,
          name: bestName,
          trNo: bestTr,
          email: (u.email && u.email.trim()) || existing.email,
          phone: (u.phone && u.phone.trim()) || existing.phone,
          birthday: (u.birthday && u.birthday.trim()) || existing.birthday,
          waras: (u.waras && u.waras.trim()) || existing.waras,
          city: (u.city && u.city.trim()) || existing.city,
          bio: (u.bio && u.bio.trim()) || existing.bio,
          roomNo: (u.roomNo && u.roomNo.trim()) || existing.roomNo,
          avatarColor: u.avatarColor || existing.avatarColor,
          isMemeMaster: Boolean(existing.isMemeMaster || u.isMemeMaster),
          isFailMaster: Boolean(existing.isFailMaster || u.isFailMaster),
          isApproved: existing.isApproved === true || u.isApproved === true,
          hasChangedDefaultPassword: existing.hasChangedDefaultPassword || u.hasChangedDefaultPassword,
          role: existing.role === 'admin' || u.role === 'admin' ? 'admin' : (u.role || existing.role || 'student'),
        };
      } else {
        unified.push(u);
      }
    }

    return unified;
  }

  public findByUsername(query: string): UserEntity | undefined {
    if (!query) return undefined;
    const db = dbEngine.load();
    const clean = query.toLowerCase().trim();
    const cleanTr = normalizeTrNo(query);
    const cleanNorm = normalizeNameOrUsername(query);

    // 1. Direct map lookup
    if (db.users && db.users[clean]) return db.users[clean];

    const users = Object.values(db.users || {});

    // 2. Exact match on standard properties
    const exact = users.find(
      u =>
        u.username?.toLowerCase()?.trim() === clean ||
        (u.email && u.email.toLowerCase().trim() === clean) ||
        (u.trNo && u.trNo.toLowerCase().trim() === clean) ||
        (u.name && u.name.toLowerCase().trim() === clean) ||
        (u.id && u.id.toLowerCase().trim() === clean)
    );
    if (exact) return exact;

    // 3. TR match: e.g. "28612" matches "TR-28612", "tr 28612", or "28612@jameasaifiyah.edu"
    if (cleanTr) {
      const trMatch = users.find(u => {
        const uTr = normalizeTrNo(u.trNo || u.username);
        if (uTr && uTr === cleanTr) return true;
        if (u.email && (u.email.toLowerCase().startsWith(cleanTr.toLowerCase() + '@') || normalizeTrNo(u.email.split('@')[0]) === cleanTr)) {
          return true;
        }
        return false;
      });
      if (trMatch) return trMatch;
    }

    // 4. Name match: e.g. "burhan pipe" matches "Burhan Pipe", "burhanpipe", etc.
    if (cleanNorm && cleanNorm.length > 2) {
      const nameMatch = users.find(u => {
        if (u.name && normalizeNameOrUsername(u.name) === cleanNorm) return true;
        if (u.username && normalizeNameOrUsername(u.username) === cleanNorm) return true;
        if (u.email && normalizeNameOrUsername(u.email.split('@')[0]) === cleanNorm) return true;
        return false;
      });
      if (nameMatch) return nameMatch;
    }

    // 5. Entry requests lookup
    if (db.entryRequests) {
      const req = db.entryRequests.find(r => {
        if (r.username?.toLowerCase()?.trim() === clean) return true;
        if (r.email && r.email.toLowerCase()?.trim() === clean) return true;
        if (r.trNo && r.trNo.toLowerCase()?.trim() === clean) return true;
        if (r.name && r.name.toLowerCase()?.trim() === clean) return true;
        if (r.userId?.toLowerCase()?.trim() === clean) return true;
        if (r.id?.toLowerCase()?.trim() === clean) return true;
        if (cleanTr && normalizeTrNo(r.trNo || r.username) === cleanTr) return true;
        if (cleanNorm && cleanNorm.length > 2 && (normalizeNameOrUsername(r.name) === cleanNorm || normalizeNameOrUsername(r.username) === cleanNorm)) return true;
        return false;
      });
      if (req && req.userId) {
        const directUser = users.find(u => u.id === req.userId);
        if (directUser) return directUser;
      }
    }

    return undefined;
  }

  public findById(id: string): UserEntity | undefined {
    const db = dbEngine.load();
    const cleanId = (id || '').trim();
    if (!cleanId) return undefined;
    const users = Object.values(db.users || {});
    const direct = users.find(u => u.id === cleanId);
    if (direct) return direct;
    const byUsername = users.find(u => u.username.toLowerCase() === cleanId.toLowerCase());
    if (byUsername) return byUsername;
    const norm = normalizeTrNo(cleanId);
    if (norm) {
      const byTr = users.find(u => normalizeTrNo(u.trNo) === norm || normalizeTrNo(u.username) === norm);
      if (byTr) return byTr;
    }
    const byEmail = users.find(u => u.email && u.email.toLowerCase() === cleanId.toLowerCase());
    if (byEmail) return byEmail;
    return undefined;
  }

  public save(user: UserEntity): UserEntity {
    const db = dbEngine.load();
    if (!db.users) db.users = {};

    const cleanTr = normalizeTrNo(user.trNo || user.username);
    const cleanNormName = normalizeNameOrUsername(user.name);
    const cleanEmail = user.email?.toLowerCase().trim();

    // Check if there is an existing record representing this same student
    let matchedKey: string | undefined;
    let matchedUser: UserEntity | undefined;

    for (const [k, u] of Object.entries(db.users)) {
      if (u.id === user.id) {
        matchedKey = k;
        matchedUser = u;
        break;
      }
      const uTr = normalizeTrNo(u.trNo || u.username);
      if (cleanTr && uTr && cleanTr === uTr) {
        matchedKey = k;
        matchedUser = u;
        break;
      }
      if (cleanEmail && u.email && u.email.toLowerCase().trim() === cleanEmail) {
        matchedKey = k;
        matchedUser = u;
        break;
      }
      if (cleanTr && u.email && u.email.toLowerCase().startsWith(cleanTr.toLowerCase() + '@')) {
        matchedKey = k;
        matchedUser = u;
        break;
      }
      if (uTr && user.email && user.email.toLowerCase().startsWith(uTr.toLowerCase() + '@')) {
        matchedKey = k;
        matchedUser = u;
        break;
      }
      if (cleanNormName && cleanNormName.length > 2) {
        const uNormName = normalizeNameOrUsername(u.name);
        if (uNormName && uNormName === cleanNormName) {
          matchedKey = k;
          matchedUser = u;
          break;
        }
      }
    }

    const isNumericOrTr = (s?: string) => {
      if (!s) return false;
      const t = s.trim();
      return !isNaN(Number(t)) || normalizeTrNo(t) === cleanTr;
    };

    // If existing had a saved name (e.g. "Burhan Pipe") and the incoming name is just TR number, keep the real name
    const finalName = user.name && !isNumericOrTr(user.name)
      ? user.name
      : matchedUser?.name || user.name || user.trNo || user.username;

    const finalTr = user.trNo || matchedUser?.trNo || (cleanTr ? cleanTr : undefined);
    const finalEmail = user.email || matchedUser?.email;
    const targetId = matchedUser?.id || user.id;

    const mergedUser: UserEntity = {
      ...(matchedUser || {}),
      ...user,
      id: targetId,
      name: finalName,
      trNo: finalTr,
      email: finalEmail,
      isApproved: matchedUser?.isApproved === true || user.isApproved === true,
      hasChangedDefaultPassword: matchedUser?.hasChangedDefaultPassword || user.hasChangedDefaultPassword,
    };

    // Clean up any stale duplicate keys pointing to this student
    const keysToDelete = new Set<string>();
    for (const [k, u] of Object.entries(db.users)) {
      if (u.id === targetId) keysToDelete.add(k);
      const uTr = normalizeTrNo(u.trNo || u.username);
      if (cleanTr && uTr && cleanTr === uTr) keysToDelete.add(k);
      if (cleanEmail && u.email && u.email.toLowerCase().trim() === cleanEmail) keysToDelete.add(k);
      if (cleanNormName && cleanNormName.length > 2 && normalizeNameOrUsername(u.name) === cleanNormName) keysToDelete.add(k);
    }
    keysToDelete.forEach(k => delete db.users[k]);

    // Store under primary canonical key (prefer TR number or username)
    const canonicalKey = (mergedUser.trNo || mergedUser.username || mergedUser.id).toLowerCase().trim();
    db.users[canonicalKey] = mergedUser;
    dbEngine.save(db);
    return mergedUser;
  }

  public deleteByUsername(username: string): boolean {
    const db = dbEngine.load();
    const clean = username.toLowerCase().trim();
    const cleanTr = normalizeTrNo(username);
    const cleanNorm = normalizeNameOrUsername(username);
    let deleted = false;

    for (const [key, val] of Object.entries(db.users || {})) {
      const uTr = normalizeTrNo(val.trNo || val.username);
      const uNorm = normalizeNameOrUsername(val.name);

      if (
        key === clean ||
        val.username.toLowerCase().trim() === clean ||
        (val.name && val.name.toLowerCase().trim() === clean) ||
        (val.trNo && val.trNo.toLowerCase().trim() === clean) ||
        (cleanTr && uTr === cleanTr) ||
        (cleanNorm && cleanNorm.length > 2 && uNorm === cleanNorm)
      ) {
        delete db.users[key];
        deleted = true;
      }
    }
    if (deleted) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }

  public getAllEntryRequests(): EntryRequestDto[] {
    const db = dbEngine.load();
    return db.entryRequests || [];
  }

  public saveEntryRequest(request: EntryRequestDto): EntryRequestDto {
    const db = dbEngine.load();
    if (!db.entryRequests) db.entryRequests = [];

    const reqUser = request.username?.toLowerCase()?.trim();
    const reqEmail = request.email?.toLowerCase()?.trim();
    const reqId = request.userId?.toLowerCase()?.trim();
    const reqTr = normalizeTrNo(request.trNo || request.username);
    const reqNormName = normalizeNameOrUsername(request.name);

    // Check if student was ALREADY admitted in users collection
    const isAlreadyAdmittedInUsers = this.getAll().some(
      u =>
        u.isApproved === true &&
        ((reqUser && u.username?.toLowerCase()?.trim() === reqUser) ||
          (reqEmail && u.email?.toLowerCase()?.trim() === reqEmail) ||
          (reqId && u.id?.toLowerCase()?.trim() === reqId) ||
          (reqTr && normalizeTrNo(u.trNo || u.username) === reqTr) ||
          (reqNormName && reqNormName.length > 2 && normalizeNameOrUsername(u.name) === reqNormName))
    );

    const index = db.entryRequests.findIndex(
      r =>
        r.id === request.id ||
        (reqId && r.userId?.toLowerCase()?.trim() === reqId) ||
        (reqTr && normalizeTrNo(r.trNo || r.username) === reqTr) ||
        (reqEmail && r.email?.toLowerCase()?.trim() === reqEmail) ||
        (reqUser && r.username?.toLowerCase()?.trim() === reqUser) ||
        (reqNormName && reqNormName.length > 2 && normalizeNameOrUsername(r.name) === reqNormName)
    );

    if (index > -1) {
      const existingReq = db.entryRequests[index];
      if (existingReq.status === 'approved' || isAlreadyAdmittedInUsers) {
        request.status = 'approved';
      }
      // Preserve existing richer fields if new request lacks them
      if (!request.name && existingReq.name) request.name = existingReq.name;
      if (!request.trNo && existingReq.trNo) request.trNo = existingReq.trNo;
      db.entryRequests[index] = { ...existingReq, ...request };
    } else {
      if (isAlreadyAdmittedInUsers) {
        request.status = 'approved';
      }
      db.entryRequests.unshift(request);
    }
    dbEngine.save(db);
    return request;
  }

  public updateEntryRequestStatus(username: string, status: 'approved' | 'rejected'): boolean {
    const db = dbEngine.load();
    if (!db.entryRequests) return false;
    const clean = username.toLowerCase().trim();
    const cleanTr = normalizeTrNo(username);
    const cleanNorm = normalizeNameOrUsername(username);
    let updated = false;

    for (const req of db.entryRequests) {
      const reqTr = normalizeTrNo(req.trNo || req.username);
      const reqNorm = normalizeNameOrUsername(req.name);

      if (
        req.username?.toLowerCase()?.trim() === clean ||
        req.id?.toLowerCase()?.trim() === clean ||
        req.userId?.toLowerCase()?.trim() === clean ||
        (req.trNo && req.trNo.toLowerCase().trim() === clean) ||
        (req.name && req.name.toLowerCase().trim() === clean) ||
        (req.email && req.email.toLowerCase().trim() === clean) ||
        (cleanTr && reqTr === cleanTr) ||
        (cleanNorm && cleanNorm.length > 2 && reqNorm === cleanNorm)
      ) {
        req.status = status;
        updated = true;
      }
    }
    if (updated) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }

  public deleteEntryRequest(id: string): boolean {
    const db = dbEngine.load();
    if (!db.entryRequests) return false;
    const initialLen = db.entryRequests.length;
    db.entryRequests = db.entryRequests.filter(r => r.id !== id);
    if (db.entryRequests.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }

  public getRawDb(): DbSchema {
    return dbEngine.load();
  }
}

export const userRepository = new UserRepository();
