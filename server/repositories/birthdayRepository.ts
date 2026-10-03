/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';
import { CalendarEventDto } from '../dtos/birthdays.dto.js';

export class BirthdayRepository {
  public getAll(): CalendarEventDto[] {
    const db = dbEngine.load();
    return db.events || [];
  }

  public findById(id: string): CalendarEventDto | undefined {
    const db = dbEngine.load();
    return (db.events || []).find(e => e.id === id);
  }

  public save(event: CalendarEventDto): CalendarEventDto {
    const db = dbEngine.load();
    if (!db.events) db.events = [];
    const index = db.events.findIndex(e => e.id === event.id);
    if (index > -1) {
      db.events[index] = event;
    } else {
      db.events.push(event);
    }
    dbEngine.save(db);
    return event;
  }

  public delete(id: string): boolean {
    const db = dbEngine.load();
    if (!db.events) return false;
    const initialLen = db.events.length;
    db.events = db.events.filter(e => e.id !== id);
    if (db.events.length !== initialLen) {
      dbEngine.save(db);
      return true;
    }
    return false;
  }
}

export const birthdayRepository = new BirthdayRepository();
