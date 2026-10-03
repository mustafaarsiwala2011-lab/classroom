/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';
import { NoticeDto, PollDto } from '../dtos/notices.dto.js';

export class NoticeRepository {
  public getAllNotices(): NoticeDto[] {
    const db = dbEngine.load();
    return [...(db.notices || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public findNoticeById(id: string): NoticeDto | undefined {
    const db = dbEngine.load();
    return (db.notices || []).find(n => n.id === id);
  }

  public saveNotice(notice: NoticeDto): NoticeDto {
    const db = dbEngine.load();
    if (!db.notices) db.notices = [];
    const index = db.notices.findIndex(n => n.id === notice.id);
    if (index > -1) {
      db.notices[index] = notice;
    } else {
      db.notices.push(notice);
    }
    dbEngine.save(db);
    return notice;
  }

  public deleteNotice(id: string): boolean {
    const db = dbEngine.load();
    if (!db.notices) return false;
    const initialLen = db.notices.length;
    db.notices = db.notices.filter(n => n.id !== id);
    if (db.notices.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }

  public getAllPolls(): PollDto[] {
    const db = dbEngine.load();
    return db.polls || [];
  }

  public findPollById(id: string): PollDto | undefined {
    const db = dbEngine.load();
    return (db.polls || []).find(p => p.id === id);
  }

  public savePoll(poll: PollDto): PollDto {
    const db = dbEngine.load();
    if (!db.polls) db.polls = [];
    const index = db.polls.findIndex(p => p.id === poll.id);
    if (index > -1) {
      db.polls[index] = poll;
    } else {
      db.polls.push(poll);
    }
    dbEngine.save(db);
    return poll;
  }
}

export const noticeRepository = new NoticeRepository();
