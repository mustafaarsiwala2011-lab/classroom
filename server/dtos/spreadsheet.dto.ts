/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SyncSpreadsheetRequestDto {
  url: string;
}

export interface SpreadsheetConfigResponseDto {
  spreadsheetUrl: string;
  lastSyncedAt: string | null;
  rowCount: number;
  columns: string[];
}
