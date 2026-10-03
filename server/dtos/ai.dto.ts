/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SummarizeNoteRequestDto {
  title: string;
  content?: string;
  subject: string;
}

export interface GenerateQuizRequestDto {
  subject: string;
  topic: string;
  content?: string;
}

export interface MemeIdeaRequestDto {
  topic?: string;
  authorName?: string;
}

export interface FailAnalysisRequestDto {
  word: string;
  intendedWord?: string;
  spokenBy: string;
  background?: string;
}

export interface AskTutorRequestDto {
  question: string;
  subject?: string;
  studentName?: string;
}

export interface SmartReplyRequestDto {
  lastMessage: string;
  senderName?: string;
}
