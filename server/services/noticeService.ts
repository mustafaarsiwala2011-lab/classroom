/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { noticeRepository } from '../repositories/noticeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import {
  NoticeDto,
  PollDto,
  CreateNoticeRequestDto,
  CreatePollRequestDto,
  VotePollRequestDto,
} from '../dtos/notices.dto.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../core/errors.js';
import { sanitizeString } from '../core/security.js';
import { broadcastEvent } from './sseService.js';
import { logSystem } from './telemetryService.js';

export class NoticeService {
  public getAllNotices(): NoticeDto[] {
    return noticeRepository.getAllNotices();
  }

  public createNotice(dto: CreateNoticeRequestDto): NoticeDto {
    const text = sanitizeString(dto.text);
    const authorId = sanitizeString(dto.authorId);
    const authorName = sanitizeString(dto.authorName);
    const color = sanitizeString(dto.color);

    if (!text || !authorId || !authorName || !color) {
      throw new ValidationError('text, authorId, authorName, and color are required');
    }

    const user = userRepository.findById(authorId);
    const displayName = user?.name || authorName;

    const newNotice: NoticeDto = {
      id: `notice_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      text,
      authorId,
      authorName: displayName,
      color,
      timestamp: new Date().toISOString(),
    };

    noticeRepository.saveNotice(newNotice);
    broadcastEvent('notice_created', { notice: newNotice });
    logSystem('INFO', `Class Notice published by ${displayName}: "${text.slice(0, 30)}..."`);
    return newNotice;
  }

  public deleteNotice(id: string, userId: string): boolean {
    const target = noticeRepository.findNoticeById(id);
    if (!target) {
      throw new NotFoundError('Notice not found');
    }

    const user = userRepository.findById(sanitizeString(userId));
    const isAdmin = user && user.username.toLowerCase() === 'admin';

    if (target.authorId !== userId && !isAdmin) {
      throw new ForbiddenError('Unauthorized. Only the author or administrator can delete notices.');
    }

    const deleted = noticeRepository.deleteNotice(id);
    if (deleted) {
      broadcastEvent('notice_deleted', { id });
    }
    return deleted;
  }

  public getAllPolls(): PollDto[] {
    return noticeRepository.getAllPolls();
  }

  public createPoll(dto: CreatePollRequestDto): PollDto {
    const question = sanitizeString(dto.question);
    const authorId = sanitizeString(dto.authorId);
    const authorName = sanitizeString(dto.authorName);

    if (!question || !dto.options || !Array.isArray(dto.options) || dto.options.length < 2 || !authorId || !authorName) {
      throw new ValidationError('question, at least 2 options, authorId, and authorName are required');
    }

    const newPoll: PollDto = {
      id: `poll_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      question,
      options: dto.options.map(opt => ({
        id: `opt_${Math.random().toString(36).substr(2, 6)}`,
        label: sanitizeString(opt),
        votes: 0,
      })),
      authorId,
      authorName,
      timestamp: new Date().toISOString(),
      userVotes: {},
    };

    noticeRepository.savePoll(newPoll);
    broadcastEvent('poll_created', { poll: newPoll });
    return newPoll;
  }

  public votePoll(pollId: string, dto: VotePollRequestDto): PollDto {
    const userId = sanitizeString(dto.userId);
    const optionId = sanitizeString(dto.optionId);

    if (!userId || !optionId) {
      throw new ValidationError('userId and optionId are required');
    }

    const poll = noticeRepository.findPollById(pollId);
    if (!poll) {
      throw new NotFoundError('Poll not found');
    }

    if (!poll.userVotes) poll.userVotes = {};

    // Remove old vote if user already voted
    const oldOptionId = poll.userVotes[userId];
    if (oldOptionId) {
      const oldOption = poll.options.find(o => o.id === oldOptionId);
      if (oldOption) oldOption.votes = Math.max(0, oldOption.votes - 1);
    }

    // Add new vote
    const newOption = poll.options.find(o => o.id === optionId);
    if (!newOption) {
      throw new NotFoundError('Option not found in this poll');
    }

    poll.userVotes[userId] = optionId;
    newOption.votes++;

    noticeRepository.savePoll(poll);
    broadcastEvent('poll_voted', { poll });
    return poll;
  }
}

export const noticeService = new NoticeService();
