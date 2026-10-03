/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { dbEngine } from './db.js';

export class SpreadsheetRepository {
  public getConfig() {
    const db = dbEngine.load();
    return {
      spreadsheetUrl: db.spreadsheetUrl || '',
      lastSyncedAt: db.lastSyncedAt || null,
      rowCount: db.spreadsheetData ? db.spreadsheetData.length : 0,
      columns: db.spreadsheetData && db.spreadsheetData.length > 0 ? Object.keys(db.spreadsheetData[0]) : [],
    };
  }

  public getRows(): Array<Record<string, string>> {
    const db = dbEngine.load();
    return db.spreadsheetData || [];
  }

  public saveSpreadsheet(url: string, data: Array<Record<string, string>>, lastSyncedAt: string): void {
    const db = dbEngine.load();
    db.spreadsheetUrl = url;
    db.spreadsheetData = data;
    db.lastSyncedAt = lastSyncedAt;
    dbEngine.save(db);
  }
}

export const spreadsheetRepository = new SpreadsheetRepository();
