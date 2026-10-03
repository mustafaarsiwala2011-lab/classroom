/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { User } from '../types';

export interface BirthdayPerson {
  user: User;
  birthDate: Date;
  daysUntil: number; // 0 = today, 1 = tomorrow, -1 = yesterday
  isToday: boolean;
  dayName: string; // e.g. "Saturday"
  formattedDate: string; // e.g. "Sep 26"
  relativeDay: string; // e.g. "Today! 🎂", "Tomorrow 🎉", "Saturday (In 2 days)"
}

export function parseBirthday(bStr?: string): { month: number; day: number } | null {
  if (!bStr) return null;
  const str = String(bStr).trim();
  if (!str) return null;

  const parts = str.split(/[-/]/).map((p) => parseInt(p, 10));
  let month = -1;
  let day = -1;

  if (parts.length === 3) {
    if (parts[0] > 1000) {
      // YYYY-MM-DD
      month = parts[1] - 1;
      day = parts[2];
    } else {
      // MM-DD-YYYY or DD-MM-YYYY
      month = parts[0] - 1;
      day = parts[1];
    }
  } else if (parts.length === 2) {
    // MM-DD
    month = parts[0] - 1;
    day = parts[1];
  } else {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      month = d.getMonth();
      day = d.getDate();
    }
  }

  if (month < 0 || month > 11 || isNaN(day) || day < 1 || day > 31) {
    return null;
  }
  return { month, day };
}

/**
 * Returns any classmates who have birthdays this week (current calendar week Sun-Sat or upcoming 7 days).
 */
export function getBirthdaysThisWeek(users: User[], referenceDate: Date = new Date()): BirthdayPerson[] {
  if (!users || !Array.isArray(users)) return [];

  const now = new Date(referenceDate);
  const currentYear = now.getFullYear();

  // Normalize today to midnight for pure day-offset comparisons
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Current calendar week (Sunday 00:00:00 to Saturday 23:59:59)
  const dayOfWeek = todayMidnight.getDay(); // 0 (Sun) to 6 (Sat)
  const startOfWeek = new Date(todayMidnight);
  startOfWeek.setDate(todayMidnight.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  // Next 7 days window (from today up to 7 days ahead)
  const next7DaysEnd = new Date(todayMidnight);
  next7DaysEnd.setDate(todayMidnight.getDate() + 7);
  next7DaysEnd.setHours(23, 59, 59, 999);

  const results: BirthdayPerson[] = [];
  const seenKeys = new Set<string>();

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  users.forEach((user) => {
    if (!user || !user.birthday) return;
    const parsed = parseBirthday(user.birthday);
    if (!parsed) return;

    const { month, day } = parsed;

    // Check birthday in this year
    let bdayThisYear = new Date(currentYear, month, day);

    // If today is late in December and birthday is in early January, also consider currentYear + 1
    if (now.getMonth() === 11 && month === 0) {
      bdayThisYear = new Date(currentYear + 1, month, day);
    }
    // If today is early in January and birthday is in late December, also consider currentYear - 1
    if (now.getMonth() === 0 && month === 11) {
      bdayThisYear = new Date(currentYear - 1, month, day);
    }

    const inCurrentWeek = bdayThisYear >= startOfWeek && bdayThisYear <= endOfWeek;
    const inNext7Days = bdayThisYear >= todayMidnight && bdayThisYear <= next7DaysEnd;

    if (inCurrentWeek || inNext7Days) {
      const uniqueKey = (user.id || user.username || user.trNo || '').toLowerCase();
      if (seenKeys.has(uniqueKey)) return;
      seenKeys.add(uniqueKey);

      const diffTime = bdayThisYear.getTime() - todayMidnight.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      const isToday = diffDays === 0;
      const dayName = dayNames[bdayThisYear.getDay()];
      const formattedDate = `${monthNames[month]} ${day}`;

      let relativeDay = '';
      if (diffDays === 0) {
        relativeDay = 'Today! 🎂';
      } else if (diffDays === 1) {
        relativeDay = 'Tomorrow 🎉';
      } else if (diffDays === -1) {
        relativeDay = 'Yesterday';
      } else if (diffDays > 1) {
        relativeDay = `${dayName} (In ${diffDays} days)`;
      } else {
        relativeDay = `${dayName} (${Math.abs(diffDays)} days ago)`;
      }

      results.push({
        user,
        birthDate: bdayThisYear,
        daysUntil: diffDays,
        isToday,
        dayName,
        formattedDate,
        relativeDay,
      });
    }
  });

  return results.sort((a, b) => {
    // Today first
    if (a.daysUntil === 0 && b.daysUntil !== 0) return -1;
    if (b.daysUntil === 0 && a.daysUntil !== 0) return 1;
    // Positive days until before negative
    if (a.daysUntil >= 0 && b.daysUntil < 0) return -1;
    if (a.daysUntil < 0 && b.daysUntil >= 0) return 1;
    return a.daysUntil - b.daysUntil;
  });
}
