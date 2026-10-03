/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LoginRequestDto {
  username: string;
  password?: string;
  email?: string;
  name?: string;
  trNo?: string;
  requestedPermissions?: string[];
}

export interface EntryRequestDto {
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
  photoURL?: string;
  avatarUrl?: string;
  avatarColor?: string;
  avatarInitials?: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  permissionsRequested: string[];
}

export interface UserResponseDto {
  id: string;
  username: string;
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

export interface LoginResponseDto {
  user: UserResponseDto;
}

export interface ChangePasswordRequestDto {
  username: string;
  oldPassword?: string;
  newPassword?: string;
}

export interface UpdateProfileRequestDto {
  userId: string;
  name?: string;
  phone?: string;
  birthday?: string;
  waras?: string;
  city?: string;
  bio?: string;
  roomNo?: string;
  avatarColor?: string;
  avatarInitials?: string;
  photoURL?: string;
  avatarUrl?: string;
  trNo?: string;
  email?: string;
  targetUsername?: string;
  authorizedBy?: string;
}

export interface ApproveUserRequestDto {
  username: string;
  userId?: string;
  email?: string;
  approved: boolean;
  authorizedBy: string;
  grantedPermissions?: string[];
}

export interface ToggleRoleRequestDto {
  username: string;
  userId?: string;
  email?: string;
  trNo?: string;
  name?: string;
  authorizedBy: string;
  authorizedEmail?: string;
  isMemeMaster?: boolean;
  isFailMaster?: boolean;
}

export interface PermissionRequestDto {
  userId: string;
  username: string;
  permission: 'microphone' | 'camera' | 'notifications' | 'meme_master' | 'fail_master';
  reason?: string;
}
