/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';
import { FailedWordDto } from '../dtos/fails.dto.js';

export class FailRepository {
  public getAll(): FailedWordDto[] {
    const db = dbEngine.load();
    const words = Array.isArray(db.failedWords) ? db.failedWords : [];
    return [...words].sort((a, b) => {
      const timeB = b?.timestamp ? new Date(b.timestamp).getTime() : 0;
      const timeA = a?.timestamp ? new Date(a.timestamp).getTime() : 0;
      return timeB - timeA;
    });
  }

  public findById(id: string): FailedWordDto | undefined {
    const db = dbEngine.load();
    return (db.failedWords || []).find(f => f.id === id);
  }

  public save(fail: FailedWordDto): FailedWordDto {
    const db = dbEngine.load();
    if (!db.failedWords) db.failedWords = [];
    const index = db.failedWords.findIndex(f => f.id === fail.id);
    if (index > -1) {
      db.failedWords[index] = fail;
    } else {
      db.failedWords.push(fail);
    }
    dbEngine.save(db);
    return fail;
  }

  public delete(id: string): boolean {
    const db = dbEngine.load();
    if (!db.failedWords) return false;
    const initialLen = db.failedWords.length;
    db.failedWords = db.failedWords.filter(f => f.id !== id);
    if (db.failedWords.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }
}

export const failRepository = new FailRepository();
