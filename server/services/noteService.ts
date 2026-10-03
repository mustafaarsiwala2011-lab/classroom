/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { noteRepository } from '../repositories/noteRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { ClassNoteDto, CreateNoteRequestDto, UpdateNoteRequestDto } from '../dtos/notes.dto.js';
import { ValidationError, NotFoundError } from '../core/errors.js';
import { sanitizeString } from '../core/security.js';
import { broadcastEvent } from './sseService.js';
import { logSystem } from './telemetryService.js';

export class NoteService {
  public getAllNotes(): ClassNoteDto[] {
    return noteRepository.getAll();
  }

  public createNote(dto: CreateNoteRequestDto): ClassNoteDto {
    const title = sanitizeString(dto.title);
    const content = sanitizeString(dto.content || '');
    const subject = sanitizeString(dto.subject);
    const authorId = sanitizeString(dto.authorId);
    const authorName = sanitizeString(dto.authorName);
    const imageUrl = dto.imageUrl ? sanitizeString(dto.imageUrl) : undefined;
    const noteType = dto.noteType || (imageUrl && content ? 'both' : imageUrl ? 'image' : 'text');

    if (!title || (!content && !imageUrl) || !subject || !authorId || !authorName) {
      throw new ValidationError('Title, subject, author, and either note content or an uploaded image are required.');
    }

    const user = userRepository.findById(authorId);
    const displayName = user?.name || authorName;

    const newNote: ClassNoteDto = {
      id: `note_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      title,
      content,
      subject,
      authorId,
      authorName: displayName,
      imageUrl,
      noteType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    noteRepository.save(newNote);
    broadcastEvent('note_created', { note: newNote });
    logSystem('INFO', `Class Note created: "${title}" by ${displayName}`);
    return newNote;
  }

  public updateNote(id: string, dto: UpdateNoteRequestDto): ClassNoteDto {
    const title = sanitizeString(dto.title);
    const content = sanitizeString(dto.content || '');
    const subject = sanitizeString(dto.subject);
    const imageUrl = dto.imageUrl ? sanitizeString(dto.imageUrl) : undefined;

    if (!title || (!content && !imageUrl) || !subject) {
      throw new ValidationError('Title, subject, and either content or an uploaded image are required.');
    }

    const target = noteRepository.findById(id);
    if (!target) {
      throw new NotFoundError('Note not found');
    }

    target.title = title;
    target.content = content;
    target.subject = subject;
    target.imageUrl = imageUrl !== undefined ? imageUrl : target.imageUrl;
    target.noteType = dto.noteType || (imageUrl && content ? 'both' : imageUrl ? 'image' : 'text');
    target.updatedAt = new Date().toISOString();

    noteRepository.save(target);
    broadcastEvent('note_updated', { note: target });
    return target;
  }

  public deleteNote(id: string): boolean {
    const target = noteRepository.findById(id);
    if (!target) {
      throw new NotFoundError('Note not found');
    }

    const deleted = noteRepository.delete(id);
    if (deleted) {
      broadcastEvent('note_deleted', { id });
      logSystem('INFO', `Class Note deleted: ${id}`);
    }
    return deleted;
  }
}

export const noteService = new NoteService();
