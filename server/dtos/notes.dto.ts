/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClassNoteDto {
  id: string;
  title: string;
  content: string;
  subject: string;
  authorId: string;
  authorName: string;
  imageUrl?: string;
  noteType?: 'text' | 'image' | 'both';
  createdAt: string;
  updatedAt: string;
}

export interface CreateNoteRequestDto {
  title: string;
  content?: string;
  subject: string;
  authorId: string;
  authorName: string;
  imageUrl?: string;
  noteType?: 'text' | 'image' | 'both';
}

export interface UpdateNoteRequestDto {
  title: string;
  content?: string;
  subject: string;
  imageUrl?: string;
  noteType?: 'text' | 'image' | 'both';
}
