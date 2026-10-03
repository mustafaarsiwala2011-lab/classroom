/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { userRepository, UserEntity, normalizeTrNo, normalizeNameOrUsername } from '../repositories/userRepository.js';
import { spreadsheetRepository } from '../repositories/spreadsheetRepository.js';
import {
  LoginRequestDto,
  LoginResponseDto,
  ChangePasswordRequestDto,
  UpdateProfileRequestDto,
  ApproveUserRequestDto,
  ToggleRoleRequestDto,
  UserResponseDto,
  EntryRequestDto,
  PermissionRequestDto,
} from '../dtos/auth.dto.js';
import {
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
} from '../core/errors.js';
import { sanitizeString } from '../core/security.js';
import { logSystem } from './telemetryService.js';
import { broadcastEvent } from './sseService.js';

export class AuthService {
  /**
   * Check if a given user identifier belongs to a super administrator / owner
   */
  public isSuperAdmin(usernameOrId?: string, email?: string): boolean {
    if (email) {
      const cleanEmail = email.toLowerCase().trim();
      if (cleanEmail === '28782@jameasaifiyah.edu' || cleanEmail.includes('28782')) return true;
    }
    if (!usernameOrId) return false;
    const clean = usernameOrId.toLowerCase().trim();
    if (
      clean === 'admin' ||
      clean === '28782' ||
      clean === 'tr-28782' ||
      clean === 'mustafa' ||
      clean === 'user_mustafa_28782' ||
      clean === 'user_1' ||
      clean.includes('28782') ||
      clean.includes('28782@jameasaifiyah.edu')
    ) {
      return true;
    }
    const user = userRepository.findByUsername(clean) || userRepository.findById(clean);
    if (user) {
      if (user.email && (user.email.toLowerCase() === '28782@jameasaifiyah.edu' || user.email.toLowerCase().includes('28782'))) {
        return true;
      }
      if (user.trNo && user.trNo.toLowerCase().includes('28782')) {
        return true;
      }
      if (user.role === 'superadmin' || user.role === 'admin') {
        return true;
      }
    }
    return false;
  }

  /**
   * Deterministic mock profile generator based on TR NO
   */
  private generateProfileForTr(tr: string) {
    const trClean = tr.toLowerCase().trim();
    if (trClean.includes('28782')) {
      return {
        name: 'Mustafa (Administrator)',
        phone: '+91 99304 88210',
        birthday: '2001-09-14',
        waras: 'Waras Al-Anwar',
        city: 'Surat',
        bio: 'Classroom Gatekeeper, Administrator, and Study Hub Architect.',
        roomNo: '2112',
      };
    }

    const names = ['Mufaddal', 'Burhanuddin', 'Aliasgar', 'Kuzema', 'Taher', 'Husain', 'Murtaza', 'Fatema', 'Arwa', 'Zainab'];
    const cities = ['Surat', 'Mumbai', 'Karachi', 'Nairobi', 'London', 'Dubai', 'Pune', 'Ahmedabad'];
    const warases = ['Waras Al-Anwar', 'Waras Al-Quds', 'Waras Al-Zahra', 'Waras Al-Azhar', 'Waras Al-Ameen'];
    const bios = [
      'Coding enthusiast, amateur meme generator.',
      'Always learning, reading, and sharing notes.',
      'Student, developer, and tea drinker.',
      'Active classmate! Let\'s make this hub amazing.',
    ];

    const seed = tr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const randomName = names[seed % names.length];
    const randomPhone = `+91 9${80000000 + (seed * 12345) % 19999999}`;
    const randomMonth = String((seed % 12) + 1).padStart(2, '0');
    const randomDay = String((seed % 28) + 1).padStart(2, '0');
    const randomBday = `2001-${randomMonth}-${randomDay}`;
    const randomWaras = warases[seed % warases.length];
    const randomCity = cities[seed % cities.length];
    const randomBio = bios[seed % bios.length];
    const randomRoom = String(2000 + (seed % 300));

    return {
      name: randomName,
      phone: randomPhone,
      birthday: randomBday,
      waras: randomWaras,
      city: randomCity,
      bio: randomBio,
      roomNo: randomRoom,
    };
  }

  public login(dto: LoginRequestDto): LoginResponseDto {
    const rawUsername = sanitizeString(dto.username);
    if (!rawUsername) {
      throw new ValidationError('Name / Username is required');
    }

    const cleanUsername = rawUsername.toLowerCase().trim();
    const inputPass = sanitizeString(dto.password || '');
    let user = userRepository.findByUsername(cleanUsername);

    // Auto-provision new student user on first login attempt with Name
    if (!user) {
      const avatarColors = [
        'from-purple-500 to-indigo-500',
        'from-emerald-500 to-teal-500',
        'from-amber-500 to-orange-500',
        'from-blue-500 to-sky-500',
        'from-pink-500 to-rose-500',
        'from-indigo-500 to-cyan-500',
      ];
      const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      const trClean = cleanUsername.toUpperCase();

      // Look up in synced spreadsheet if available
      const sheetRows = spreadsheetRepository.getRows();
      let sheetProfile: any = {};
      if (sheetRows.length > 0) {
        const matchingRow = sheetRows.find(row =>
          Object.entries(row).some(([key, val]) => {
            const isMatch = key.includes('TR') || key.includes('NAME') || key.includes('STUDENT') || key.includes('ID') || key.includes('ROLL');
            return isMatch && val.toLowerCase().trim() === cleanUsername;
          })
        );

        if (matchingRow) {
          const nameKey = Object.keys(matchingRow).find(k => k.includes('NAME') || k.includes('STUDENT') || k.includes('NICK'));
          const phoneKey = Object.keys(matchingRow).find(k => k.includes('PHONE') || k.includes('CONTACT') || k.includes('MOBILE'));
          const bdayKey = Object.keys(matchingRow).find(k => k.includes('BIRTHDAY') || k.includes('BDAY') || k.includes('BORN'));
          const warasKey = Object.keys(matchingRow).find(k => k.includes('WARAS') || k.includes('WARA') || k.includes('DIVISION'));
          const cityKey = Object.keys(matchingRow).find(k => k.includes('CITY') || k.includes('TOWN') || k.includes('STATE'));
          const bioKey = Object.keys(matchingRow).find(k => k.includes('BIO') || k.includes('DESCRIBE') || k.includes('ABOUT'));
          const roomKey = Object.keys(matchingRow).find(k => k.includes('ROOM') || k.includes('DESK') || k.includes('SEAT') || k.includes('HOSTEL'));

          sheetProfile = {
            name: nameKey ? matchingRow[nameKey] : undefined,
            phone: phoneKey ? matchingRow[phoneKey] : undefined,
            birthday: bdayKey ? matchingRow[bdayKey] : undefined,
            waras: warasKey ? matchingRow[warasKey] : undefined,
            city: cityKey ? matchingRow[cityKey] : undefined,
            bio: bioKey ? matchingRow[bioKey] : undefined,
            roomNo: roomKey ? matchingRow[roomKey] : undefined,
          };
        }
      }

      const randomProfile = this.generateProfileForTr(cleanUsername);
      const isSuper = this.isSuperAdmin(cleanUsername);

      const isNumeric = !isNaN(Number(cleanUsername));
      const isTrLike = cleanUsername.startsWith('tr-') || cleanUsername.startsWith('tr') || isNumeric;

      const displayName =
        sheetProfile.name ||
        (isTrLike ? (dto.name ? sanitizeString(dto.name) : randomProfile.name) : rawUsername);

      const resolvedTr = isTrLike
        ? cleanUsername.toUpperCase().replace(/^TR[-_\s]*/i, '')
        : (sheetProfile.trNo || dto.trNo ? sanitizeString(dto.trNo || '').toUpperCase() : cleanUsername.toUpperCase());

      const newUser: UserEntity = {
        id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        username: cleanUsername,
        passwordHash: 'classroom123',
        trNo: resolvedTr,
        isMemeMaster: isSuper,
        isFailMaster: isSuper,
        avatarColor: randomColor,
        isApproved: isSuper,
        name: displayName,
        email: dto.email ? sanitizeString(dto.email) : (isTrLike ? `${resolvedTr.toLowerCase()}@jameasaifiyah.edu` : undefined),
        phone: sheetProfile.phone || randomProfile.phone,
        birthday: sheetProfile.birthday || randomProfile.birthday,
        waras: sheetProfile.waras || randomProfile.waras,
        city: sheetProfile.city || randomProfile.city,
        bio: sheetProfile.bio || randomProfile.bio,
        roomNo: sheetProfile.roomNo || randomProfile.roomNo,
        hasChangedDefaultPassword: false,
      };

      user = userRepository.save(newUser);
      logSystem('AUTH', `Provisioned new student record: ${cleanUsername} (${user.name})`);
    } else {
      // If user exists and already has a saved name (e.g. "Burhan Pipe"), never overwrite it with raw TR or email prefix
      if (dto.name && isNaN(Number(dto.name)) && dto.name.trim().length > 1) {
        user.name = sanitizeString(dto.name);
        user = userRepository.save(user);
      }
    }

    // Verify credentials
    const isSuper = this.isSuperAdmin(cleanUsername) || (user && this.isSuperAdmin(user.username));
    let isAuth = false;

    if (isSuper) {
      // Administrator / Gatekeeper login: 28782 / master123
      isAuth =
        inputPass === 'master123' ||
        inputPass.toLowerCase() === 'master123' ||
        user.passwordHash === inputPass ||
        user.passwordHash === 'master123';
    } else {
      // Student login: default classroom123 (or user's customized password, or class123)
      isAuth =
        inputPass.toLowerCase() === 'classroom123' ||
        inputPass.toLowerCase() === 'class123' ||
        user.passwordHash === inputPass ||
        user.passwordHash.toLowerCase() === inputPass.toLowerCase();
    }

    if (!isAuth) {
      if (isSuper) {
        throw new UnauthorizedError('Invalid administrator credentials. Please check your password and try again.');
      } else {
        throw new UnauthorizedError('Invalid credentials. Please check your password and try again.');
      }
    }

    // If user is not approved, create or update entry request and notify the administrator
    if (user.isApproved === false && !this.isSuperAdmin(cleanUsername)) {
      const entryReq: EntryRequestDto = {
        id: `req_${user.id}`,
        userId: user.id,
        username: user.username,
        trNo: user.trNo || user.username.toUpperCase(),
        name: user.name || user.username,
        phone: user.phone,
        waras: user.waras,
        city: user.city,
        roomNo: user.roomNo,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        permissionsRequested: dto.requestedPermissions || ['read_notes', 'view_memes', 'participate_chat', 'microphone'],
      };

      userRepository.saveEntryRequest(entryReq);

      // Real-time broadcast to administrator
      broadcastEvent('user_entry_requested', { request: entryReq });
      logSystem('AUTH', `[Entry Request] Student ${user.name} (${user.trNo}) requested admission approval.`);

      throw new ForbiddenError(
        'Request is sent, wait for entry.',
        {
          pendingApproval: true,
          username: user.username,
          trNo: user.trNo,
          name: user.name,
        }
      );
    }

    const { passwordHash, ...userResponse } = user;
    return {
      user: {
        ...userResponse,
        role: this.isSuperAdmin(user.username) ? 'superadmin' : 'student',
      },
    };
  }

  public googleLogin(dto: {
    email: string;
    name: string;
    uid?: string;
    photoURL?: string;
    trNo?: string;
    requestedPermissions?: string[];
    isPreviouslyApproved?: boolean;
  }): LoginResponseDto {
    const email = sanitizeString(dto.email || '').toLowerCase().trim();
    const name = sanitizeString(dto.name || '').trim();
    const trNo = sanitizeString(dto.trNo || '').toUpperCase().trim();

    if (!name && !email) {
      throw new ValidationError('Name or Email is required');
    }

    const rawEmailTr = email.includes('@') ? email.split('@')[0] : '';
    const cleanTr = trNo || (!isNaN(Number(rawEmailTr)) ? rawEmailTr : '');

    // Search by TR number, email, name, or username to find the unified account
    let user =
      (cleanTr ? userRepository.findByUsername(cleanTr) : undefined) ||
      (email ? userRepository.findByUsername(email) : undefined) ||
      (name ? userRepository.findByUsername(name) : undefined) ||
      (trNo ? userRepository.findByUsername(trNo) : undefined) ||
      userRepository.findByUsername(email.split('@')[0]);

    const displayName = (user && user.name) ? user.name : (name || email.split('@')[0]);
    const username = (user && user.username) ? user.username : (cleanTr || email.split('@')[0] || displayName.replace(/\s+/g, '_')).toLowerCase();

    const isSuper = this.isSuperAdmin(username, email) || this.isSuperAdmin(displayName, email);

    // Check if user was already approved or already has an approved entry request
    const existingReq = userRepository.getAllEntryRequests().find(
      r =>
        (email && r.email?.toLowerCase() === email) ||
        (username && r.username?.toLowerCase() === username) ||
        (cleanTr && normalizeTrNo(r.trNo || r.username) === normalizeTrNo(cleanTr)) ||
        (name && normalizeNameOrUsername(r.name) === normalizeNameOrUsername(name))
    );
    const isAlreadyAdmitted =
      (user && user.isApproved === true) ||
      (existingReq && existingReq.status === 'approved') ||
      dto.isPreviouslyApproved === true;

    const shouldBeApproved = isSuper || isAlreadyAdmitted;

    if (!user) {
      const avatarColors = [
        'from-purple-500 to-indigo-500',
        'from-emerald-500 to-teal-500',
        'from-amber-500 to-orange-500',
        'from-blue-500 to-sky-500',
        'from-pink-500 to-rose-500',
        'from-indigo-500 to-cyan-500',
      ];
      const randomColor = avatarColors[Math.floor(Math.random() * avatarColors.length)];
      const randomProfile = this.generateProfileForTr(cleanTr || username || '101');

      const isNameNumeric = !isNaN(Number(name));
      const finalStudentName = name && !isNameNumeric ? name : randomProfile.name;

      const newUser: UserEntity = {
        id: dto.uid || `user_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        username: username,
        passwordHash: 'google_oauth',
        trNo: cleanTr || (username.toUpperCase().startsWith('TR-') ? username.toUpperCase() : `TR-${username.toUpperCase()}`),
        isMemeMaster: isSuper,
        isFailMaster: isSuper,
        avatarColor: randomColor,
        isApproved: shouldBeApproved ? true : false,
        name: finalStudentName,
        email: email,
        phone: randomProfile.phone,
        birthday: randomProfile.birthday,
        waras: randomProfile.waras,
        city: randomProfile.city,
        bio: randomProfile.bio,
        roomNo: randomProfile.roomNo,
        hasChangedDefaultPassword: true,
      };

      user = userRepository.save(newUser);
      logSystem('AUTH', `Google Sign-in provisioned student: ${user.name} (${email}) - Approved: ${newUser.isApproved}`);
    } else {
      // Update existing user profile with confirmed name and email if incoming is a real name
      const isIncomingGeneric = !name || name.toLowerCase() === email.split('@')[0].toLowerCase() || !isNaN(Number(name));
      if (!isIncomingGeneric && (!user.name || isNaN(Number(user.name)) === false)) {
        user.name = name;
      }
      if (email) user.email = email;
      if (cleanTr && !user.trNo) user.trNo = cleanTr;
      if (shouldBeApproved) {
        user.isApproved = true;
      }
      user = userRepository.save(user);
      logSystem('AUTH', `Google Sign-in authenticated existing user: ${user.name} (${user.username}, TR: ${user.trNo}) - Approved: ${user.isApproved}`);
    }

    // If user is not superadmin and not approved yet, create/update entry request and notify admin/gatekeeper
    if (!isSuper && user.isApproved !== true) {
      const entryReq: EntryRequestDto = {
        id: `req_${user.id}`,
        userId: user.id,
        username: user.username,
        trNo: user.trNo || user.username.toUpperCase(),
        name: user.name || displayName,
        phone: user.phone,
        waras: user.waras,
        city: user.city,
        roomNo: user.roomNo,
        requestedAt: new Date().toISOString(),
        status: 'pending',
        permissionsRequested: dto.requestedPermissions || ['read_notes', 'view_memes', 'participate_chat', 'microphone'],
      };

      userRepository.saveEntryRequest(entryReq);

      // Real-time broadcast to administrator
      broadcastEvent('user_entry_requested', { request: entryReq });
      logSystem('AUTH', `[Entry Request] Student ${user.name} (${user.email || user.username}) requested admission approval.`);

      throw new ForbiddenError(
        'Entry requested. Waiting for admin or gatekeeper approval.',
        {
          pendingApproval: true,
          username: user.username,
          email: user.email,
          trNo: user.trNo,
          name: user.name,
        }
      );
    }

    // Broadcast admission event
    broadcastEvent('user_approved', {
      username: user.username,
      user: {
        ...user,
        role: isSuper ? 'superadmin' : 'student',
      },
    });

    const { passwordHash, ...userResponse } = user;
    return {
      user: {
        ...userResponse,
        role: isSuper ? 'superadmin' : 'student',
      },
    };
  }

  public getPendingRequests(authorizedBy: string): EntryRequestDto[] {
    if (!this.isSuperAdmin(authorizedBy)) {
      throw new ForbiddenError('Unauthorized. Only administrator can review pending admission requests.');
    }
    const allRequests = userRepository.getAllEntryRequests();
    const allUsers = userRepository.getAll();

    // Collect all admitted student identifiers
    const admittedUsernames = new Set(allUsers.filter(u => u.isApproved === true).map(u => u.username?.toLowerCase()?.trim()));
    const admittedEmails = new Set(allUsers.filter(u => u.isApproved === true && u.email).map(u => u.email!.toLowerCase().trim()));
    const admittedTrNos = new Set(allUsers.filter(u => u.isApproved === true && u.trNo).map(u => u.trNo!.toLowerCase().trim()));
    const admittedIds = new Set(allUsers.filter(u => u.isApproved === true).map(u => u.id?.toLowerCase()?.trim()));

    // Once a student has been admitted, do not show requests again to the admin
    return allRequests.filter(r => {
      if (r.status !== 'pending') return false;
      const uName = r.username?.toLowerCase()?.trim();
      const uEmail = r.email?.toLowerCase()?.trim();
      const uTr = r.trNo?.toLowerCase()?.trim();
      const uId = r.userId?.toLowerCase()?.trim();

      if (uName && admittedUsernames.has(uName)) return false;
      if (uEmail && admittedEmails.has(uEmail)) return false;
      if (uTr && admittedTrNos.has(uTr)) return false;
      if (uId && admittedIds.has(uId)) return false;

      return true;
    });
  }

  public getAllRequests(authorizedBy: string): EntryRequestDto[] {
    if (!this.isSuperAdmin(authorizedBy)) {
      throw new ForbiddenError('Unauthorized. Only administrator can view all entry requests.');
    }
    return userRepository.getAllEntryRequests();
  }

  public approveUser(dto: ApproveUserRequestDto): { success: boolean; message: string; user?: UserResponseDto } {
    const authorizedBy = sanitizeString(dto.authorizedBy).toLowerCase();
    if (!this.isSuperAdmin(authorizedBy)) {
      throw new ForbiddenError('Unauthorized. Only administrator (admin / 28782) can approve or deny entry requests.');
    }

    const targetUsername = sanitizeString(dto.username).toLowerCase();
    const targetUserId = sanitizeString(dto.userId || '');
    const targetEmail = sanitizeString(dto.email || '').toLowerCase();

    let targetUser = userRepository.findByUsername(targetUsername);
    if (!targetUser && targetUserId) {
      targetUser = userRepository.findById(targetUserId);
    }
    if (!targetUser && targetEmail) {
      targetUser = userRepository.getAll().find(u => u.email?.toLowerCase() === targetEmail);
    }

    if (!targetUser) {
      // Look up in entryRequests
      const req = userRepository.getAllEntryRequests().find(
        r =>
          (targetUsername && r.username?.toLowerCase() === targetUsername) ||
          (targetUsername && r.id?.toLowerCase() === targetUsername) ||
          (targetUserId && r.userId?.toLowerCase() === targetUserId) ||
          (targetUserId && r.id?.toLowerCase() === targetUserId) ||
          (targetEmail && r.email?.toLowerCase() === targetEmail)
      );
      if (req) {
        if (req.userId) {
          targetUser = userRepository.findById(req.userId);
        }
        if (!targetUser) {
          const generated = this.generateProfileForTr(req.trNo || req.username || targetUsername || '28000');
          targetUser = {
            id: req.userId || req.id || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            username: req.username || targetUsername || req.email?.split('@')[0] || 'student',
            name: req.name || generated.name || req.username || targetUsername,
            email: req.email || targetEmail || '',
            trNo: req.trNo || targetUsername,
            role: 'student',
            isApproved: true,
            isMemeMaster: false,
            isFailMaster: false,
            avatarColor: 'from-blue-500 to-indigo-600',
            passwordHash: '',
            hasChangedDefaultPassword: true,
            waras: generated.waras,
            roomNo: generated.roomNo,
            city: generated.city,
            bio: generated.bio,
          };
        }
      }
    }

    if (!targetUser) {
      const generated = this.generateProfileForTr(targetUsername || '28000');
      targetUser = {
        id: targetUserId || `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        username: targetUsername || targetEmail.split('@')[0] || 'student',
        name: generated.name || targetUsername,
        email: targetEmail,
        trNo: targetUsername,
        role: 'student',
        isApproved: true,
        isMemeMaster: false,
        isFailMaster: false,
        avatarColor: 'from-blue-500 to-indigo-600',
        passwordHash: '',
        hasChangedDefaultPassword: true,
        waras: generated.waras,
        roomNo: generated.roomNo,
        city: generated.city,
        bio: generated.bio,
      };
    }

    if (dto.approved) {
      targetUser.isApproved = true;
      userRepository.save(targetUser);
      userRepository.updateEntryRequestStatus(targetUsername, 'approved');
      if (targetUser.username) userRepository.updateEntryRequestStatus(targetUser.username, 'approved');
      if (targetUser.email) userRepository.updateEntryRequestStatus(targetUser.email, 'approved');
      if (targetUserId) userRepository.updateEntryRequestStatus(targetUserId, 'approved');
      if (targetUser.trNo) userRepository.updateEntryRequestStatus(targetUser.trNo, 'approved');
      if (targetUser.id) userRepository.updateEntryRequestStatus(targetUser.id, 'approved');

      const { passwordHash, ...userRes } = targetUser;
      broadcastEvent('user_approved', {
        username: targetUser.username,
        userId: targetUser.id,
        email: targetUser.email,
        trNo: targetUser.trNo,
        name: targetUser.name,
        user: userRes,
        approvedBy: authorizedBy,
      });

      logSystem('AUTH', `Administrator (${authorizedBy}) approved entry for: ${targetUser.username} (${targetUser.name})`);
      return { success: true, message: `Approved ${targetUser.name || targetUser.username} successfully!`, user: userRes };
    } else {
      userRepository.updateEntryRequestStatus(targetUsername, 'rejected');
      if (targetUser.username) {
        userRepository.updateEntryRequestStatus(targetUser.username, 'rejected');
        userRepository.deleteByUsername(targetUser.username);
      }

      broadcastEvent('user_rejected', {
        username: targetUser.username || targetUsername,
        userId: targetUser.id,
        email: targetUser.email,
        rejectedBy: authorizedBy,
      });

      logSystem('AUTH', `Administrator (${authorizedBy}) denied entry request for: ${targetUser.username || targetUsername}`);
      return { success: true, message: `Denied and deleted entry request for ${targetUser.name || targetUsername}.` };
    }
  }

  public changePassword(dto: ChangePasswordRequestDto): { success: boolean; message: string } {
    const rawUsername = sanitizeString(dto.username);
    const oldPassword = sanitizeString(dto.oldPassword || '');
    const newPassword = sanitizeString(dto.newPassword || '');

    if (!rawUsername || !oldPassword || !newPassword) {
      throw new ValidationError('Username, old password, and new password are required');
    }

    const user = userRepository.findByUsername(rawUsername);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isOldValid =
      user.passwordHash === oldPassword ||
      (this.isSuperAdmin(rawUsername) && oldPassword === 'master123') ||
      (user.passwordHash === 'classroom123' && oldPassword === 'classroom123');

    if (!isOldValid) {
      throw new ValidationError('Incorrect current password');
    }

    user.passwordHash = newPassword;
    user.hasChangedDefaultPassword = true;
    userRepository.save(user);
    logSystem('AUTH', `Password updated successfully for: ${rawUsername}`);
    return { success: true, message: 'Password updated successfully!' };
  }

  public updateProfile(dto: UpdateProfileRequestDto): { success: boolean; user: UserResponseDto } {
    const userId = sanitizeString(dto.userId);
    const targetUsername = dto.targetUsername ? sanitizeString(dto.targetUsername) : '';
    if (!userId && !targetUsername) {
      throw new ValidationError('userId or targetUsername is required');
    }

    let user: UserEntity | undefined;
    if (targetUsername) {
      user = userRepository.findByUsername(targetUsername);
    }
    if (!user && userId) {
      user = userRepository.findById(userId);
    }
    if (!user && userId) {
      user = userRepository.findByUsername(userId);
    }
    if (!user && (userId.includes('28782') || userId.toLowerCase().includes('admin'))) {
      user = userRepository.findByUsername('28782') || userRepository.findByUsername('admin');
    }
    if (!user) {
      user = {
        id: userId || `user_${Date.now()}`,
        username: (targetUsername || userId).replace(/^admin_/, ''),
        passwordHash: 'master123',
        isMemeMaster: true,
        isFailMaster: true,
        avatarColor: 'from-amber-500 to-orange-600',
        isApproved: true,
        role: (userId.includes('28782') || userId.toLowerCase().includes('admin')) ? 'admin' : 'student',
        trNo: userId.includes('28782') ? '28782' : undefined,
      };
      userRepository.save(user);
    }

    if (dto.name !== undefined) user.name = sanitizeString(dto.name) || user.name;
    if (dto.phone !== undefined) user.phone = sanitizeString(dto.phone);
    if (dto.birthday !== undefined) user.birthday = sanitizeString(dto.birthday);
    if (dto.waras !== undefined) user.waras = sanitizeString(dto.waras);
    if (dto.city !== undefined) user.city = sanitizeString(dto.city);
    if (dto.bio !== undefined) user.bio = sanitizeString(dto.bio);
    if (dto.roomNo !== undefined) user.roomNo = sanitizeString(dto.roomNo);
    if (dto.avatarColor !== undefined && dto.avatarColor) user.avatarColor = sanitizeString(dto.avatarColor);
    if (dto.avatarInitials !== undefined) user.avatarInitials = sanitizeString(dto.avatarInitials).slice(0, 4).toUpperCase();
    if (dto.photoURL !== undefined) user.photoURL = dto.photoURL;
    if (dto.avatarUrl !== undefined) user.avatarUrl = dto.avatarUrl;
    if (dto.trNo !== undefined && dto.trNo) user.trNo = sanitizeString(dto.trNo);
    if (dto.email !== undefined && dto.email) user.email = sanitizeString(dto.email);

    userRepository.save(user);

    // Also update any matching entryRequests so gatekeeper and directory searches stay in sync
    const allReqs = userRepository.getAllEntryRequests();
    const matchingReq = allReqs.find(
      r =>
        r.userId === user!.id ||
        r.username.toLowerCase() === user!.username.toLowerCase() ||
        (user!.email && r.email?.toLowerCase() === user!.email.toLowerCase()) ||
        (user!.trNo && r.trNo.toLowerCase() === user!.trNo.toLowerCase())
    );
    if (matchingReq) {
      if (user.name) matchingReq.name = user.name;
      if (user.phone) matchingReq.phone = user.phone;
      if (user.waras) matchingReq.waras = user.waras;
      if (user.city) matchingReq.city = user.city;
      if (user.roomNo) matchingReq.roomNo = user.roomNo;
      if (user.trNo) matchingReq.trNo = user.trNo;
      if (user.photoURL || user.avatarUrl) matchingReq.photoURL = user.photoURL || user.avatarUrl;
      userRepository.saveEntryRequest(matchingReq);
    }

    const { passwordHash, ...userResponse } = user;

    // Broadcast update via SSE to all connected clients
    broadcastEvent('user_updated', {
      user: {
        ...userResponse,
        role: this.isSuperAdmin(user.username) ? 'superadmin' : 'student',
      },
      userId: user.id,
      username: user.username,
      updatedAt: new Date().toISOString(),
    });

    logSystem('AUTH', `Profile updated permanently for: ${user.username} (${user.name || 'Unnamed'})`);

    return {
      success: true,
      user: {
        ...userResponse,
        role: this.isSuperAdmin(user.username) ? 'superadmin' : 'student',
      },
    };
  }

  public getAllUsers(): UserResponseDto[] {
    const users = userRepository.getAll();
    return users.map(({ passwordHash, ...user }) => ({
      ...user,
      role: this.isSuperAdmin(user.username) ? 'superadmin' : 'student',
    }));
  }

  public toggleMemeMaster(dto: ToggleRoleRequestDto): { success: boolean; user: Partial<UserResponseDto> } {
    const authorizedBy = sanitizeString(dto.authorizedBy).toLowerCase();
    const authorizedEmail = sanitizeString(dto.authorizedEmail).toLowerCase();
    if (!this.isSuperAdmin(authorizedBy, authorizedEmail || authorizedBy)) {
      throw new ForbiddenError('Unauthorized. Only administrator can toggle this role.');
    }

    let targetUser = userRepository.findByUsername(sanitizeString(dto.username));
    if (!targetUser && dto.userId) {
      targetUser = userRepository.findById(sanitizeString(dto.userId));
    }
    if (!targetUser && dto.username) {
      targetUser = userRepository.findById(sanitizeString(dto.username));
    }
    if (!targetUser && dto.email) {
      targetUser = userRepository.findByUsername(sanitizeString(dto.email));
    }
    if (!targetUser && dto.trNo) {
      targetUser = userRepository.findByUsername(sanitizeString(dto.trNo));
    }

    if (!targetUser) {
      const uname = sanitizeString(dto.username) || sanitizeString(dto.trNo) || sanitizeString(dto.userId) || 'student';
      targetUser = {
        id: sanitizeString(dto.userId) || sanitizeString(dto.username) || `user_${Date.now()}`,
        username: uname,
        trNo: sanitizeString(dto.trNo) || uname,
        name: sanitizeString(dto.name) || uname,
        email: sanitizeString(dto.email) || (uname.includes('@') ? uname : undefined),
        avatarColor: 'from-indigo-500 to-purple-600',
        isMemeMaster: Boolean(dto.isMemeMaster),
        isFailMaster: Boolean(dto.isFailMaster),
        isApproved: true,
        role: 'student',
        passwordHash: '',
      };
      userRepository.save(targetUser);
    } else {
      targetUser.isMemeMaster = Boolean(dto.isMemeMaster);
      if (dto.name && (!targetUser.name || targetUser.name === targetUser.username)) targetUser.name = sanitizeString(dto.name);
      if (dto.email && !targetUser.email) targetUser.email = sanitizeString(dto.email);
      if (dto.trNo && !targetUser.trNo) targetUser.trNo = sanitizeString(dto.trNo);
      userRepository.save(targetUser);
    }

    logSystem('AUTH', `Meme Master role toggled for ${targetUser.username}: ${targetUser.isMemeMaster}`);
    return {
      success: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        isMemeMaster: targetUser.isMemeMaster,
        isFailMaster: targetUser.isFailMaster,
      },
    };
  }

  public toggleFailMaster(dto: ToggleRoleRequestDto): { success: boolean; user: Partial<UserResponseDto> } {
    const authorizedBy = sanitizeString(dto.authorizedBy).toLowerCase();
    const authorizedEmail = sanitizeString(dto.authorizedEmail).toLowerCase();
    if (!this.isSuperAdmin(authorizedBy, authorizedEmail || authorizedBy)) {
      throw new ForbiddenError('Unauthorized. Only administrator can toggle this role.');
    }

    let targetUser = userRepository.findByUsername(sanitizeString(dto.username));
    if (!targetUser && dto.userId) {
      targetUser = userRepository.findById(sanitizeString(dto.userId));
    }
    if (!targetUser && dto.username) {
      targetUser = userRepository.findById(sanitizeString(dto.username));
    }
    if (!targetUser && dto.email) {
      targetUser = userRepository.findByUsername(sanitizeString(dto.email));
    }
    if (!targetUser && dto.trNo) {
      targetUser = userRepository.findByUsername(sanitizeString(dto.trNo));
    }

    if (!targetUser) {
      const uname = sanitizeString(dto.username) || sanitizeString(dto.trNo) || sanitizeString(dto.userId) || 'student';
      targetUser = {
        id: sanitizeString(dto.userId) || sanitizeString(dto.username) || `user_${Date.now()}`,
        username: uname,
        trNo: sanitizeString(dto.trNo) || uname,
        name: sanitizeString(dto.name) || uname,
        email: sanitizeString(dto.email) || (uname.includes('@') ? uname : undefined),
        avatarColor: 'from-indigo-500 to-purple-600',
        isMemeMaster: Boolean(dto.isMemeMaster),
        isFailMaster: Boolean(dto.isFailMaster),
        isApproved: true,
        role: 'student',
        passwordHash: '',
      };
      userRepository.save(targetUser);
    } else {
      targetUser.isFailMaster = Boolean(dto.isFailMaster);
      if (dto.name && (!targetUser.name || targetUser.name === targetUser.username)) targetUser.name = sanitizeString(dto.name);
      if (dto.email && !targetUser.email) targetUser.email = sanitizeString(dto.email);
      if (dto.trNo && !targetUser.trNo) targetUser.trNo = sanitizeString(dto.trNo);
      userRepository.save(targetUser);
    }

    logSystem('AUTH', `Fail Master role toggled for ${targetUser.username}: ${targetUser.isFailMaster}`);
    return {
      success: true,
      user: {
        id: targetUser.id,
        username: targetUser.username,
        isMemeMaster: targetUser.isMemeMaster,
        isFailMaster: targetUser.isFailMaster,
      },
    };
  }

  public requestPermission(dto: PermissionRequestDto): { success: boolean; message: string } {
    const userId = sanitizeString(dto.userId);
    const permission = sanitizeString(dto.permission);
    if (!userId || !permission) {
      throw new ValidationError('userId and permission are required');
    }

    const user = userRepository.findById(userId);
    const displayName = user?.name || dto.username || 'Student';

    broadcastEvent('permission_requested', {
      userId,
      username: user?.username || dto.username,
      displayName,
      permission,
      reason: sanitizeString(dto.reason || 'Standard classroom activity'),
      requestedAt: new Date().toISOString(),
    });

    logSystem('AUTH', `Permission request: ${displayName} requested ${permission}`);
    return { success: true, message: `Permission request for ${permission} sent to administrator.` };
  }

  public resolveIdentity(query: string): UserResponseDto | null {
    if (!query) return null;
    const user = userRepository.findByUsername(query);
    if (!user) return null;
    const { passwordHash, ...userResponse } = user;
    return {
      ...userResponse,
      role: this.isSuperAdmin(user.username, user.email) ? 'superadmin' : 'student',
    };
  }
}

export const authService = new AuthService();
