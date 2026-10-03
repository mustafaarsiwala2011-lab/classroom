/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, X, BookOpen, CheckCircle, HelpCircle, Send, Loader2, Award, Lightbulb } from 'lucide-react';
import { ClassNote, AiQuizResponse, AiSummaryResponse } from '../types';

interface AiStudyCopilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  note?: ClassNote | null;
}

export default function AiStudyCopilotModal({ isOpen, onClose, note }: AiStudyCopilotModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'quiz' | 'tutor'>('summary');
  
  // Summarizer state
  const [summaryData, setSummaryData] = useState<AiSummaryResponse | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);

  // Quiz state
  const [quizData, setQuizData] = useState<AiQuizResponse | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isQuizSubmitted, setIsQuizSubmitted] = useState(false);

  // Tutor state
  const [tutorQuery, setTutorQuery] = useState('');
  const [tutorConversation, setTutorConversation] = useState<Array<{ role: 'user' | 'assistant'; text: string; relatedConcepts?: string[] }>>([]);
  const [isTutorLoading, setIsTutorLoading] = useState(false);

  const handleGenerateSummary = async () => {
    if (!note) return;
    setIsSummarizing(true);
    try {
      const res = await fetch('/api/ai/summarize-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          subject: note.subject,
          content: note.content
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data);
      }
    } catch (err) {
      console.error('Failed to summarize note:', err);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!note) return;
    setIsGeneratingQuiz(true);
    setIsQuizSubmitted(false);
    setSelectedAnswers({});
    try {
      const res = await fetch('/api/ai/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: note.title,
          subject: note.subject,
          content: note.content
        })
      });
      if (res.ok) {
        const data = await res.json();
        setQuizData(data);
      }
    } catch (err) {
      console.error('Failed to generate quiz:', err);
    } finally {
      setIsGeneratingQuiz(false);
    }
  };

  const handleAskTutor = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!tutorQuery.trim()) return;

    const userMessage = tutorQuery.trim();
    setTutorConversation(prev => [...prev, { role: 'user', text: userMessage }]);
    setTutorQuery('');
    setIsTutorLoading(true);

    try {
      const res = await fetch('/api/ai/classroom-tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage,
          subject: note?.subject || 'General Study',
          context: note ? `Current Note: "${note.title}". Content: ${note.content}` : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        setTutorConversation(prev => [
          ...prev, 
          { 
            role: 'assistant', 
            text: data.explanation || data.answer || 'I am happy to explain further.',
            relatedConcepts: data.relatedConcepts
          }
        ]);
      }
    } catch (err) {
      console.error('Tutor query error:', err);
      setTutorConversation(prev => [...prev, { role: 'assistant', text: 'I am currently having trouble reaching the AI study engine. Please try again.' }]);
    } finally {
      setIsTutorLoading(false);
    }
  };

  if (!isOpen) return null;

  const calculateScore = () => {
    if (!quizData) return 0;
    let score = 0;
    quizData.questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctOptionIndex) {
        score++;
      }
    });
    return score;
  };

  return (
    <div id="ai-study-copilot-overlay" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <motion.div
        id="ai-study-copilot-modal"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="p-4 px-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  AI Classroom Study Co-pilot
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded-full">
                  Gemini Flash 3.7
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {note ? `Active context: "${note.title}" (${note.subject})` : 'Ask questions or summarize study materials'}
              </p>
            </div>
          </div>
          <button
            id="close-ai-study-copilot-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="px-6 py-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 text-xs font-medium bg-slate-50/50 dark:bg-slate-900/50">
          <button
            id="copilot-tab-summary"
            onClick={() => {
              setActiveTab('summary');
              if (!summaryData && note) handleGenerateSummary();
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'summary'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            Note Summary & Flashcards
          </button>
          <button
            id="copilot-tab-quiz"
            onClick={() => {
              setActiveTab('quiz');
              if (!quizData && note) handleGenerateQuiz();
            }}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'quiz'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Interactive Practice Quiz
          </button>
          <button
            id="copilot-tab-tutor"
            onClick={() => setActiveTab('tutor')}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
              activeTab === 'tutor'
                ? 'bg-primary text-white shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
          >
            <Lightbulb className="w-3.5 h-3.5" />
            Ask Classroom AI Tutor
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SUMMARY */}
          {activeTab === 'summary' && (
            <div className="space-y-5">
              {!summaryData && !isSummarizing && (
                <div className="py-12 text-center text-slate-500">
                  <BookOpen className="w-10 h-10 mx-auto text-purple-400 mb-3" />
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Generate an AI Study Digest
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                    Extract bullet points, vocabulary flashcards, and high-yield exam tips with one click.
                  </p>
                  <button
                    id="generate-summary-btn"
                    onClick={handleGenerateSummary}
                    className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Summarize Note
                  </button>
                </div>
              )}

              {isSummarizing && (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                  <p className="text-sm font-medium">Analyzing note content with Gemini Flash...</p>
                </div>
              )}

              {summaryData && !isSummarizing && (
                <div className="space-y-5">
                  {/* Executive Summary */}
                  <div className="p-4 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-800/40">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Executive Summary
                    </h4>
                    <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      {summaryData.summary}
                    </p>
                  </div>

                  {/* Key Points */}
                  {summaryData.keyPoints?.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-2">
                        Core Takeaways
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {summaryData.keyPoints.map((pt, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary font-bold">•</span>
                            <span>{pt}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Flashcards */}
                  {summaryData.flashcards?.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-3">
                        Vocabulary Flashcards
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {summaryData.flashcards.map((fc, i) => (
                          <div key={i} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <div className="font-bold text-sm text-primary">{fc.term}</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">{fc.definition}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Exam Tips */}
                  {summaryData.examTips?.length > 0 && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1.5">
                        <Award className="w-3.5 h-3.5" />
                        Exam Tips
                      </h4>
                      <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                        {summaryData.examTips.map((tip, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-amber-600 font-bold">✓</span>
                            <span>{tip}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: QUIZ */}
          {activeTab === 'quiz' && (
            <div className="space-y-5">
              {!quizData && !isGeneratingQuiz && (
                <div className="py-12 text-center text-slate-500">
                  <HelpCircle className="w-10 h-10 mx-auto text-primary mb-3" />
                  <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    Interactive Assessment
                  </h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto mt-1 mb-4">
                    Test your understanding with a customized 3-question multiple choice quiz.
                  </p>
                  <button
                    id="generate-quiz-btn"
                    onClick={handleGenerateQuiz}
                    className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Start Practice Quiz
                  </button>
                </div>
              )}

              {isGeneratingQuiz && (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
                  <p className="text-sm font-medium">Generating practice questions...</p>
                </div>
              )}

              {quizData && !isGeneratingQuiz && (
                <div className="space-y-6">
                  {quizData.questions.map((q, qIndex) => {
                    const isSelected = selectedAnswers[qIndex] !== undefined;
                    const selectedOpt = selectedAnswers[qIndex];
                    const isCorrect = selectedOpt === q.correctOptionIndex;

                    return (
                      <div 
                        key={qIndex}
                        className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 space-y-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="px-2 py-0.5 rounded-md bg-primary/10 text-primary font-bold text-xs shrink-0">
                            Q{qIndex + 1}
                          </span>
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {q.question}
                          </h4>
                        </div>

                        <div className="space-y-2 pt-1">
                          {q.options.map((opt, optIndex) => {
                            const isChosen = selectedAnswers[qIndex] === optIndex;
                            let btnClasses = "w-full text-left p-3 rounded-xl text-xs transition-colors border flex items-center justify-between ";

                            if (!isQuizSubmitted) {
                              btnClasses += isChosen
                                ? "bg-primary text-white border-primary font-medium"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100";
                            } else {
                              if (optIndex === q.correctOptionIndex) {
                                btnClasses += "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-500 text-emerald-800 dark:text-emerald-300 font-bold";
                              } else if (isChosen) {
                                btnClasses += "bg-rose-100 dark:bg-rose-950/40 border-rose-500 text-rose-800 dark:text-rose-300";
                              } else {
                                btnClasses += "bg-white dark:bg-slate-800 text-slate-400 border-slate-200 dark:border-slate-700 opacity-60";
                              }
                            }

                            return (
                              <button
                                key={optIndex}
                                id={`quiz-q${qIndex}-opt${optIndex}`}
                                disabled={isQuizSubmitted}
                                onClick={() => setSelectedAnswers(prev => ({ ...prev, [qIndex]: optIndex }))}
                                className={btnClasses}
                              >
                                <span>{opt}</span>
                                {isQuizSubmitted && optIndex === q.correctOptionIndex && (
                                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>

                        {isQuizSubmitted && (
                          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 mt-2">
                            <span className="font-bold text-primary">Explanation: </span>
                            {q.explanation}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Submit / Score Bar */}
                  <div className="p-4 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-between">
                    {!isQuizSubmitted ? (
                      <>
                        <span className="text-xs text-slate-500">
                          {Object.keys(selectedAnswers).length} of {quizData.questions.length} questions answered
                        </span>
                        <button
                          id="submit-quiz-answers-btn"
                          disabled={Object.keys(selectedAnswers).length < quizData.questions.length}
                          onClick={() => setIsQuizSubmitted(true)}
                          className="px-4 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          Submit Quiz
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <Award className="w-5 h-5 text-amber-500" />
                          <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            Score: {calculateScore()} / {quizData.questions.length} (
                            {Math.round((calculateScore() / quizData.questions.length) * 100)}%)
                          </span>
                        </div>
                        <button
                          id="retake-quiz-btn"
                          onClick={handleGenerateQuiz}
                          className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-300"
                        >
                          Try New Questions
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: TUTOR */}
          {activeTab === 'tutor' && (
            <div className="flex flex-col h-[50vh]">
              <div className="flex-1 overflow-y-auto space-y-3 p-2">
                {tutorConversation.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    <Lightbulb className="w-8 h-8 mx-auto mb-2 text-purple-400" />
                    <p className="font-semibold text-slate-700 dark:text-slate-300">Classroom AI Study Tutor</p>
                    <p className="mt-1">Ask questions about Arabic rules, Fiqh terms, or exam concepts.</p>
                  </div>
                ) : (
                  tutorConversation.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-none'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-bl-none'
                        }`}
                      >
                        <p>{msg.text}</p>
                        {msg.relatedConcepts && msg.relatedConcepts.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700 flex flex-wrap gap-1">
                            {msg.relatedConcepts.map((c, idx) => (
                              <span key={idx} className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium text-[10px]">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                {isTutorLoading && (
                  <div className="flex justify-start">
                    <div className="p-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                      <span>AI Tutor is formulating response...</span>
                    </div>
                  </div>
                )}
              </div>

              <form onSubmit={handleAskTutor} className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center gap-2">
                <input
                  id="tutor-question-input"
                  type="text"
                  value={tutorQuery}
                  onChange={(e) => setTutorQuery(e.target.value)}
                  placeholder="Ask the study tutor a question..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/40 text-slate-900 dark:text-slate-100"
                />
                <button
                  id="submit-tutor-question-btn"
                  type="submit"
                  disabled={!tutorQuery.trim() || isTutorLoading}
                  className="p-2.5 bg-primary text-white rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
