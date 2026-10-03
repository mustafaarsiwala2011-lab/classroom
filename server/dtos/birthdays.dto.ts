/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface CalendarEventDto {
  id: string;
  name: string;
  date: string; // MM-DD or YYYY-MM-DD
  type: 'birthday' | 'waras';
  details?: string;
  year?: number;
}

export interface CreateCalendarEventRequestDto {
  name: string;
  date: string;
  type: 'birthday' | 'waras';
  details?: string;
  year?: number | string;
}

export interface UpdateCalendarEventRequestDto {
  name: string;
  date: string;
  type: 'birthday' | 'waras';
  details?: string;
  year?: number | string;
}
