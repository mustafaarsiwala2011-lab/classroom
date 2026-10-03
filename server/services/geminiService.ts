/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GoogleGenAI, Type } from '@google/genai';

// Lazy initialized Gemini Client with required telemetry User-Agent
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * High-Tech AI Note Summarizer & Study Revision Generator
 */
export async function summarizeClassNote(note: {
  title: string;
  content: string;
  subject: string;
}) {
  const ai = getAiClient();
  const fallbackSummary = {
    summary: `Comprehensive overview of ${note.title} for ${note.subject}. Highlights foundational grammar principles, contextual rulings, and actionable study recommendations for upcoming assessments.`,
    keyPoints: [
      `Core subject area: ${note.subject} — primary emphasis on accurate classification and rules.`,
      `Key operational concept: ${note.title.slice(0, 45)}...`,
      'Systematic review of foundational definitions, case studies, and primary text excerpts.',
      'Active memorization checklist for scheduled quizzes and peer study sessions.'
    ],
    vocabulary: [
      { term: note.subject === 'Nahw' ? 'I\'rab (الإعراب)' : 'Taharah (الطهارة)', definition: 'Grammatical inflection of word endings based on syntactic governing agents.' },
      { term: 'Asl (الأصل)', definition: 'The foundational origin or primary linguistic baseline rule.' },
      { term: 'Far\' (الفرع)', definition: 'The derived sub-branch or subordinate application.' }
    ],
    examTips: [
      'Focus on distinguishing standard rules from irregular linguistic exceptions.',
      'Practice writing short grammatical or conceptual explanations without consulting reference notes.',
      'Test your peers in the group study hall.'
    ]
  };

  if (!ai) {
    return fallbackSummary;
  }

  try {
    const prompt = `You are a high-tech academic study copilot and expert classroom tutor for traditional and modern studies (Arabic Grammar/Nahw, Jurisprudence/Fiqh, Balaghah, Literature, and General Sciences).
Analyze the following student class note and produce a highly structured study summary in JSON.

Subject: ${note.subject}
Title: ${note.title}
Content:
${note.content}

Return a valid JSON object matching the schema with:
- summary: A clear 2-3 sentence high-level executive summary.
- keyPoints: 4-6 concise bullet points explaining the core takeaways.
- vocabulary: 2-4 key technical terms with exact definitions.
- examTips: 2-3 practical exam revision and memorization tips.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            keyPoints: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            vocabulary: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  term: { type: Type.STRING },
                  definition: { type: Type.STRING }
                },
                required: ['term', 'definition']
              }
            },
            examTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['summary', 'keyPoints', 'vocabulary', 'examTips']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      summary: parsed.summary || fallbackSummary.summary,
      keyPoints: parsed.keyPoints || fallbackSummary.keyPoints,
      vocabulary: parsed.vocabulary || fallbackSummary.vocabulary,
      examTips: parsed.examTips || fallbackSummary.examTips
    };
  } catch (error) {
    console.error('Gemini summarizeClassNote error:', error);
    return fallbackSummary;
  }
}

/**
 * High-Tech AI Study Quiz Generator
 */
export async function generateStudyQuiz(params: {
  subject: string;
  topic: string;
  content?: string;
}) {
  const ai = getAiClient();
  const fallbackQuiz = {
    title: `${params.subject}: Quick Assessment on ${params.topic}`,
    subject: params.subject,
    questions: [
      {
        question: `In the study of ${params.subject}, what is the primary purpose of mastering ${params.topic}?`,
        options: [
          'To understand foundational syntactic rules and correct inflection',
          'To memorize dates without contextual comprehension',
          'To replace vocal recitation with silent reading',
          'None of the above'
        ],
        correctIndex: 0,
        explanation: 'Foundational mastery ensures correct understanding of structural rules and application in speech and texts.'
      },
      {
        question: 'Which of the following is considered a primary governing rule?',
        options: [
          'Rules with clear structural evidence (Sima\'i and Qiyasi)',
          'Arbitrary colloquial modifications',
          'Phonetic shortcuts without classical precedent',
          'Unverified student speculation'
        ],
        correctIndex: 0,
        explanation: 'Classical grammar and jurisprudence prioritize attested normative rules with reliable precedents.'
      },
      {
        question: 'How should irregular exceptions be addressed in an examination?',
        options: [
          'Identified and cited with their specific grammatical context',
          'Ignored completely',
          'Treated as errors in the original text',
          'Replaced with modern synonyms'
        ],
        correctIndex: 0,
        explanation: 'Accurate analysis requires classifying standard patterns alongside their documented variations.'
      }
    ]
  };

  if (!ai) {
    return fallbackQuiz;
  }

  try {
    const prompt = `You are an expert exam creator for students studying ${params.subject}.
Generate an interactive 3-question multiple-choice quiz based on the following topic/notes.

Subject: ${params.subject}
Topic: ${params.topic}
Reference Notes:
${params.content || 'Core syllabus concepts'}

Return a JSON object with:
- title: string
- subject: string
- questions: array of 3 objects with:
  - question: string
  - options: array of 4 distinct plausible choices
  - correctIndex: integer (0-3) indicating the correct answer
  - explanation: brief 1-2 sentence explanation of why that answer is correct.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            subject: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING }
                  },
                  correctIndex: { type: Type.INTEGER },
                  explanation: { type: Type.STRING }
                },
                required: ['question', 'options', 'correctIndex', 'explanation']
              }
            }
          },
          required: ['title', 'subject', 'questions']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      title: parsed.title || fallbackQuiz.title,
      subject: parsed.subject || fallbackQuiz.subject,
      questions: Array.isArray(parsed.questions) && parsed.questions.length > 0 ? parsed.questions : fallbackQuiz.questions
    };
  } catch (error) {
    console.error('Gemini generateStudyQuiz error:', error);
    return fallbackQuiz;
  }
}

/**
 * High-Tech AI Meme Generator Co-pilot
 */
export async function generateMemeIdea(params: {
  topic?: string;
  authorName?: string;
}) {
  const ai = getAiClient();
  const fallbackMeme = {
    title: 'The 5-Minute Exam Realization',
    quote: '“When you spent all night debating Nahw nuances with your roommate, only to find the quiz is on chapter 1 vocabulary.”',
    bgGradient: 'from-amber-500 to-rose-600',
    vibe: 'relatable_student_life'
  };

  if (!ai) {
    return fallbackMeme;
  }

  try {
    const prompt = `You are the Meme Master AI Co-pilot for an energetic, hilarious classroom of students.
Generate a witty, relatable, good-natured classroom meme quote based on student life, study hall late nights, exams, Arabic grammar (Nahw), cafeteria tea, or hostel routines.
Topic hint: ${params.topic || 'Classroom daily life'}

Return a JSON object with:
- title: Short punchy title (max 5 words)
- quote: The hilarious quote or scenario text
- bgGradient: A Tailwind gradient CSS class (e.g., "from-purple-600 to-indigo-600", "from-emerald-500 to-teal-600", "from-pink-500 to-rose-600", "from-amber-500 to-orange-600")
- vibe: One-word category/vibe`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            quote: { type: Type.STRING },
            bgGradient: { type: Type.STRING },
            vibe: { type: Type.STRING }
          },
          required: ['title', 'quote', 'bgGradient', 'vibe']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      title: parsed.title || fallbackMeme.title,
      quote: parsed.quote || fallbackMeme.quote,
      bgGradient: parsed.bgGradient || fallbackMeme.bgGradient,
      vibe: parsed.vibe || fallbackMeme.vibe
    };
  } catch (error) {
    console.error('Gemini generateMemeIdea error:', error);
    return fallbackMeme;
  }
}

/**
 * High-Tech AI Fail Master Slip Analyzer
 */
export async function analyzeFailedWord(params: {
  word: string;
  intendedWord?: string;
  spokenBy: string;
  background: string;
}) {
  const ai = getAiClient();
  const fallbackAnalysis = {
    word: params.word,
    intendedWord: params.intendedWord || 'Standard Expression',
    phoneticHumorRating: 8.5,
    analysis: `A classic verbal transposition where "${params.word}" was confidently delivered instead of "${params.intendedWord || 'the expected term'}". The acoustic cadence and unwavering conviction amplified the comedic resonance across the classroom.`,
    roastComment: '10/10 for boldness in articulation. Even the dictionaries were momentarily reconsidering their definitions.',
    suggestedEmoji: '🤣'
  };

  if (!ai) {
    return fallbackAnalysis;
  }

  try {
    const prompt = `You are the official "Fail Master AI" linguistic judge in a fun classroom hub.
A student had a hilarious slip-of-the-tongue or mispronounced blunder in class. Provide a witty, lighthearted linguistic breakdown and commentary.

Spoken Word/Phrase: "${params.word}"
Intended Word/Phrase: "${params.intendedWord || 'Unspecified'}"
Speaker: ${params.spokenBy}
Context / Story: ${params.background}

Return JSON with:
- word: string
- intendedWord: string
- phoneticHumorRating: number between 1.0 and 10.0
- analysis: 2-3 sentence pseudo-scientific humorous linguistic breakdown of how their brain swapped the phonemes or words.
- roastComment: 1-2 sentence witty, affectionate classroom roast.
- suggestedEmoji: a single fitting reaction emoji.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            intendedWord: { type: Type.STRING },
            phoneticHumorRating: { type: Type.NUMBER },
            analysis: { type: Type.STRING },
            roastComment: { type: Type.STRING },
            suggestedEmoji: { type: Type.STRING }
          },
          required: ['word', 'intendedWord', 'phoneticHumorRating', 'analysis', 'roastComment', 'suggestedEmoji']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      word: parsed.word || fallbackAnalysis.word,
      intendedWord: parsed.intendedWord || fallbackAnalysis.intendedWord,
      phoneticHumorRating: Number(parsed.phoneticHumorRating) || 8.5,
      analysis: parsed.analysis || fallbackAnalysis.analysis,
      roastComment: parsed.roastComment || fallbackAnalysis.roastComment,
      suggestedEmoji: parsed.suggestedEmoji || '😂'
    };
  } catch (error) {
    console.error('Gemini analyzeFailedWord error:', error);
    return fallbackAnalysis;
  }
}

/**
 * High-Tech AI Classroom Tutor & Academic Companion
 */
export async function askClassroomTutor(params: {
  question: string;
  subject?: string;
  studentName?: string;
}) {
  const ai = getAiClient();
  const fallbackAnswer = {
    answer: `Assalamu Alaykum ${params.studentName || 'Student'}! Regarding your query on "${params.question}":\n\n1. **Core Concept**: In ${params.subject || 'classical grammar and classroom studies'}, mastery relies on understanding governing agents (*'Awamil*), structural endings (*I'rab*), and context.\n2. **Application**: Always look at preceding words to determine whether a noun is Marfoo' (Nominative), Mansoob (Accusative), or Majroor (Genitive).\n3. **Recommendation**: Review your class notes and test yourself with short sample sentences!`,
    suggestedFollowUps: [
      'Can you give me an example sentence with parsing (I\'rab)?',
      'What are the common exceptions to this rule?',
      'How will this be formatted on our upcoming quiz?'
    ]
  };

  if (!ai) {
    return fallbackAnswer;
  }

  try {
    const prompt = `You are a warm, highly knowledgeable, and encouraging AI Classroom Study Tutor for students studying Arabic Grammar (Nahw), Islamic Jurisprudence (Fiqh), Rhetoric (Balaghah), Quranic Sciences (Hifz/Tajweed), and general academia.
The student ${params.studentName || 'Student'} is asking:
"${params.question}"
Subject Context: ${params.subject || 'General Classroom'}

Provide a clear, pedagogical, encouraging response with markdown formatting (bullet points, bold key terms), and suggest 3 intelligent follow-up questions.

Return JSON with:
- answer: string (formatted with clear markdown headings and bullet points)
- suggestedFollowUps: array of 3 short questions the student might ask next.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            suggestedFollowUps: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['answer', 'suggestedFollowUps']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      answer: parsed.answer || fallbackAnswer.answer,
      suggestedFollowUps: parsed.suggestedFollowUps || fallbackAnswer.suggestedFollowUps
    };
  } catch (error) {
    console.error('Gemini askClassroomTutor error:', error);
    return fallbackAnswer;
  }
}

/**
 * High-Tech Smart Reply Suggestion Generator for Chat
 */
export async function generateSmartReplies(params: {
  lastMessage: string;
  senderName: string;
}) {
  const ai = getAiClient();
  const fallbackReplies = [
    'Waalaykum Assalam! On it! 👍',
    'Great point! I\'ll check the notes. 📚',
    'Haha classic! 😂',
    'See you in study hall! ☕'
  ];

  if (!ai) {
    return { replies: fallbackReplies };
  }

  try {
    const prompt = `Generate 4 realistic, polite, and quick smart replies for a student in a classroom group chat responding to:
"${params.lastMessage}" from ${params.senderName}.
Keep them concise (2-6 words each) with fitting emojis.

Return JSON with:
- replies: array of 4 strings`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            replies: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ['replies']
        }
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      replies: Array.isArray(parsed.replies) && parsed.replies.length > 0 ? parsed.replies : fallbackReplies
    };
  } catch (error) {
    return { replies: fallbackReplies };
  }
}

/**
 * Interactive Conversational Gemini Chat Function
 */
export async function generateGeminiChatResponse(params: {
  message: string;
  history?: Array<{ role: 'user' | 'assistant' | 'model'; text: string }>;
  systemInstruction?: string;
}) {
  const ai = getAiClient();
  const fallbackResponse = `I received your message: "${params.message}". I'm your AI classroom study assistant! Ask me about syllabus notes, grammar, quizzes, or homework clarifications.`;

  if (!ai) {
    return { text: fallbackResponse };
  }

  try {
    const formattedContents = [];
    if (params.history && params.history.length > 0) {
      for (const h of params.history) {
        formattedContents.push({
          role: h.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: h.text }],
        });
      }
    }
    formattedContents.push({
      role: 'user',
      parts: [{ text: params.message }],
    });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: formattedContents,
      config: {
        systemInstruction: params.systemInstruction || 'You are a helpful, knowledgeable, and friendly AI study assistant and classroom tutor. Provide clear, concise, and structured answers with helpful formatting and examples.',
      },
    });

    return {
      text: response.text || fallbackResponse,
    };
  } catch (error: any) {
    console.error('Gemini chat generation error:', error);
    // Try with fallback model alias if 2.5 flash has specific syntax
    try {
      const retryResponse = await ai.models.generateContent({
        model: 'gemini-3.7-flash',
        contents: params.message,
        config: {
          systemInstruction: 'You are a helpful AI assistant.',
        },
      });
      return { text: retryResponse.text || fallbackResponse };
    } catch (e2) {
      return { text: `Sorry, I encountered an error answering your question. Details: ${(error?.message || 'AI service unavailable')}` };
    }
  }
}
