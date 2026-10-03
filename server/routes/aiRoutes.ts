/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import {
  summarizeClassNote,
  generateStudyQuiz,
  generateMemeIdea,
  analyzeFailedWord,
  askClassroomTutor,
  generateSmartReplies,
  generateGeminiChatResponse,
} from '../services/geminiService.js';
import { asyncHandler } from '../core/middleware.js';
import { createRateLimiter } from '../core/security.js';
import { ValidationError } from '../core/errors.js';
import { logSystem } from '../services/telemetryService.js';

const router = Router();

// AI generation rate limiter (45 req / min per client)
const aiLimiter = createRateLimiter(60000, 45);

// POST /api/ai/chat
router.post('/chat', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { message, history, systemInstruction } = req.body;
  if (!message || typeof message !== 'string') {
    throw new ValidationError('message string is required');
  }
  logSystem('AI', `Gemini Chat request: "${message.slice(0, 45)}..."`);
  const result = await generateGeminiChatResponse({
    message: message.trim(),
    history: Array.isArray(history) ? history : [],
    systemInstruction,
  });
  res.json(result);
}));

// POST /api/ai/summarize-note
router.post('/summarize-note', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { title, content, subject } = req.body;
  if (!title || !subject) {
    throw new ValidationError('title and subject are required');
  }
  logSystem('AI', `Generating AI note summary for: "${title}" (${subject})`);
  const result = await summarizeClassNote({ title, content: content || '', subject });
  res.json(result);
}));

// POST /api/ai/generate-quiz
router.post('/generate-quiz', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { subject, topic, content } = req.body;
  if (!subject || !topic) {
    throw new ValidationError('subject and topic are required');
  }
  logSystem('AI', `Generating AI study assessment quiz on ${subject} - ${topic}`);
  const result = await generateStudyQuiz({ subject, topic, content });
  res.json(result);
}));

// POST /api/ai/meme-idea
router.post('/meme-idea', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { topic, authorName } = req.body;
  logSystem('AI', `Meme Master AI co-pilot generating meme for: ${topic || 'Classroom routine'}`);
  const result = await generateMemeIdea({ topic, authorName });
  res.json(result);
}));

// POST /api/ai/fail-analysis
router.post('/fail-analysis', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { word, intendedWord, spokenBy, background } = req.body;
  if (!word || !spokenBy) {
    throw new ValidationError('word and spokenBy are required');
  }
  logSystem('AI', `Fail Master AI analyzing slip: "${word}" by ${spokenBy}`);
  const result = await analyzeFailedWord({ word, intendedWord, spokenBy, background: background || '' });
  res.json(result);
}));

// POST /api/ai/tutor
router.post('/tutor', aiLimiter, asyncHandler(async (req: Request, res: Response) => {
  const { question, subject, studentName } = req.body;
  if (!question) {
    throw new ValidationError('question is required');
  }
  logSystem('AI', `AI Tutor inquiry from ${studentName || 'student'}: "${question.slice(0, 40)}..."`);
  const result = await askClassroomTutor({ question, subject, studentName });
  res.json(result);
}));

// POST /api/ai/smart-reply
router.post('/smart-reply', asyncHandler(async (req: Request, res: Response) => {
  const { lastMessage, senderName } = req.body;
  try {
    const result = await generateSmartReplies({ lastMessage: lastMessage || '', senderName: senderName || 'Classmate' });
    res.json(result);
  } catch (err) {
    res.json({ replies: ['Waalaykum Assalam! 👍', 'Great note! 📚', 'Haha classic! 😂', 'See you soon! ☕'] });
  }
}));

export default router;
