/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface FailedWordDto {
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
}

export interface CreateFailedWordRequestDto {
  word: string;
  intendedWord?: string;
  spokenBy: string;
  spokenByUserId?: string;
  when: string;
  background: string;
  category?: string;
  authorId: string;
  authorName?: string;
}

export interface UpdateFailedWordRequestDto {
  word?: string;
  intendedWord?: string;
  spokenBy?: string;
  when?: string;
  background?: string;
  category?: string;
  requesterId: string;
}

export interface ReactFailedWordRequestDto {
  emoji: string;
  userId: string;
}
