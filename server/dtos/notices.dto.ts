/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface NoticeDto {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  color: string;
  timestamp: string;
}

export interface CreateNoticeRequestDto {
  text: string;
  authorId: string;
  authorName: string;
  color: string;
}

export interface PollOptionDto {
  id: string;
  label: string;
  votes: number;
}

export interface PollDto {
  id: string;
  question: string;
  options: PollOptionDto[];
  authorId: string;
  authorName: string;
  timestamp: string;
  userVotes: Record<string, string>;
}

export interface CreatePollRequestDto {
  question: string;
  options: string[];
  authorId: string;
  authorName: string;
}

export interface VotePollRequestDto {
  userId: string;
  optionId: string;
}
