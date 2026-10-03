/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { birthdayRepository } from '../repositories/birthdayRepository.js';
import { CalendarEventDto, CreateCalendarEventRequestDto, UpdateCalendarEventRequestDto } from '../dtos/birthdays.dto.js';
import { ValidationError, NotFoundError } from '../core/errors.js';
import { sanitizeString } from '../core/security.js';

export class BirthdayService {
  public getAllEvents(): CalendarEventDto[] {
    return birthdayRepository.getAll();
  }

  public createEvent(dto: CreateCalendarEventRequestDto): CalendarEventDto {
    const name = sanitizeString(dto.name);
    const date = sanitizeString(dto.date);
    const type = dto.type;
    const details = sanitizeString(dto.details || '');
    const year = dto.year ? parseInt(String(dto.year), 10) : undefined;

    if (!name || !date || !type) {
      throw new ValidationError('name, date (MM-DD), and type (birthday|waras) are required');
    }

    const dateRegex = /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$|^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
    if (!dateRegex.test(date)) {
      throw new ValidationError('Invalid date format. Use MM-DD (e.g., 07-10) or YYYY-MM-DD (e.g., 2026-07-10)');
    }

    const newEvent: CalendarEventDto = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name,
      date,
      type,
      details,
      year,
    };

    birthdayRepository.save(newEvent);
    return newEvent;
  }

  public updateEvent(id: string, dto: UpdateCalendarEventRequestDto): CalendarEventDto {
    const target = birthdayRepository.findById(id);
    if (!target) {
      throw new NotFoundError('Event not found');
    }

    const name = sanitizeString(dto.name);
    const date = sanitizeString(dto.date);
    const type = dto.type;
    const details = sanitizeString(dto.details || '');
    const year = dto.year ? parseInt(String(dto.year), 10) : undefined;

    if (!name || !date || !type) {
      throw new ValidationError('name, date (MM-DD), and type are required');
    }

    target.name = name;
    target.date = date;
    target.type = type;
    target.details = details;
    target.year = year;

    birthdayRepository.save(target);
    return target;
  }

  public deleteEvent(id: string): boolean {
    const target = birthdayRepository.findById(id);
    if (!target) {
      throw new NotFoundError('Event not found');
    }
    return birthdayRepository.delete(id);
  }
}

export const birthdayService = new BirthdayService();
