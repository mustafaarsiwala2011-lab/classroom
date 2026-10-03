/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MemeDto {
  id: string;
  authorId: string;
  authorName: string;
  type: 'quote' | 'image';
  content: string;
  title?: string;
  bgGradient?: string;
  timestamp: string;
}

export interface CreateMemeRequestDto {
  authorId: string;
  authorName: string;
  type: 'quote' | 'image';
  content: string;
  title?: string;
  bgGradient?: string;
}
