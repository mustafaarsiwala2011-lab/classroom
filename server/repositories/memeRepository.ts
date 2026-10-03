/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';
import { MemeDto } from '../dtos/memes.dto.js';

export class MemeRepository {
  public getAll(): MemeDto[] {
    const db = dbEngine.load();
    return [...(db.memes || [])].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public findById(id: string): MemeDto | undefined {
    const db = dbEngine.load();
    return (db.memes || []).find(m => m.id === id);
  }

  public save(meme: MemeDto): MemeDto {
    const db = dbEngine.load();
    if (!db.memes) db.memes = [];
    const index = db.memes.findIndex(m => m.id === meme.id);
    if (index > -1) {
      db.memes[index] = meme;
    } else {
      db.memes.push(meme);
    }
    dbEngine.save(db);
    return meme;
  }

  public delete(id: string): boolean {
    const db = dbEngine.load();
    if (!db.memes) return false;
    const initialLen = db.memes.length;
    db.memes = db.memes.filter(m => m.id !== id);
    if (db.memes.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }
}

export const memeRepository = new MemeRepository();
