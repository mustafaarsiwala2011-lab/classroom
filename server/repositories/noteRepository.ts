/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';
import { ClassNoteDto } from '../dtos/notes.dto.js';

export class NoteRepository {
  public getAll(): ClassNoteDto[] {
    const db = dbEngine.load();
    return [...(db.notes || [])].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public findById(id: string): ClassNoteDto | undefined {
    const db = dbEngine.load();
    return (db.notes || []).find(n => n.id === id);
  }

  public save(note: ClassNoteDto): ClassNoteDto {
    const db = dbEngine.load();
    if (!db.notes) db.notes = [];
    const index = db.notes.findIndex(n => n.id === note.id);
    if (index > -1) {
      db.notes[index] = note;
    } else {
      db.notes.push(note);
    }
    dbEngine.save(db);
    return note;
  }

  public delete(id: string): boolean {
    const db = dbEngine.load();
    if (!db.notes) return false;
    const initialLen = db.notes.length;
    db.notes = db.notes.filter(n => n.id !== id);
    if (db.notes.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }
}

export const noteRepository = new NoteRepository();
