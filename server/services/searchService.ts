/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SearchItem {
  id: string;
  type: 'note' | 'meme' | 'fail' | 'message' | 'user' | 'notice';
  title: string;
  subtitle: string;
  snippet?: string;
  metadata?: Record<string, any>;
  tab: 'notes' | 'memes' | 'fails' | 'chat' | 'settings' | 'dashboard' | 'profile';
  score: number;
}

/**
 * Universal Fuzzy and Multi-Field Search Engine across all classroom records
 */
export function executeUniversalSearch(query: string, db: any): SearchItem[] {
  if (!query || !query.trim()) return [];
  const cleanQ = query.toLowerCase().trim();
  const keywords = cleanQ.split(/\s+/).filter(Boolean);

  const results: SearchItem[] = [];

  const scoreText = (text: string, titleWeight = 1): number => {
    if (!text) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    if (lower.includes(cleanQ)) {
      score += 15 * titleWeight;
    }
    keywords.forEach(kw => {
      if (lower.includes(kw)) {
        score += 5 * titleWeight;
      }
    });
    return score;
  };

  const createSnippet = (content: string): string => {
    if (!content) return '';
    const lower = content.toLowerCase();
    const index = lower.indexOf(cleanQ);
    if (index === -1) {
      return content.slice(0, 120) + (content.length > 120 ? '...' : '');
    }
    const start = Math.max(0, index - 40);
    const end = Math.min(content.length, index + cleanQ.length + 80);
    return (start > 0 ? '...' : '') + content.slice(start, end) + (end < content.length ? '...' : '');
  };

  // 1. Search Notes
  (db.notes || []).forEach((note: any) => {
    const titleScore = scoreText(note.title, 3);
    const contentScore = scoreText(note.content, 1);
    const subjectScore = scoreText(note.subject, 2);
    const totalScore = titleScore + contentScore + subjectScore;

    if (totalScore > 0) {
      results.push({
        id: note.id,
        type: 'note',
        title: note.title,
        subtitle: `Subject: ${note.subject} • By ${note.authorName}`,
        snippet: createSnippet(note.content),
        tab: 'notes',
        metadata: { subject: note.subject, noteId: note.id },
        score: totalScore
      });
    }
  });

  // 2. Search Memes
  (db.memes || []).forEach((meme: any) => {
    const titleScore = scoreText(meme.title || '', 2);
    const contentScore = scoreText(meme.content || '', 2);
    const authorScore = scoreText(meme.authorName || '', 1);
    const totalScore = titleScore + contentScore + authorScore;

    if (totalScore > 0) {
      results.push({
        id: meme.id,
        type: 'meme',
        title: meme.title || 'Classroom Meme',
        subtitle: `Published by ${meme.authorName}`,
        snippet: createSnippet(meme.content),
        tab: 'memes',
        metadata: { memeId: meme.id },
        score: totalScore
      });
    }
  });

  // 3. Search Failed Words
  (db.failedWords || []).forEach((fail: any) => {
    const wordScore = scoreText(fail.word, 4);
    const intendedScore = scoreText(fail.intendedWord || '', 3);
    const speakerScore = scoreText(fail.spokenBy, 2);
    const bgScore = scoreText(fail.background, 1);
    const totalScore = wordScore + intendedScore + speakerScore + bgScore;

    if (totalScore > 0) {
      results.push({
        id: fail.id,
        type: 'fail',
        title: `"${fail.word}" (Intended: ${fail.intendedWord || 'N/A'})`,
        subtitle: `Spoken by ${fail.spokenBy} in ${fail.when}`,
        snippet: createSnippet(fail.background),
        tab: 'fails',
        metadata: { failId: fail.id },
        score: totalScore
      });
    }
  });

  // 4. Search Chat Messages
  (db.messages || []).forEach((msg: any) => {
    if (msg.deleted) return;
    const textScore = scoreText(msg.text, 1);
    const userScore = scoreText(msg.displayName || msg.username, 1);
    const totalScore = textScore + userScore;

    if (totalScore > 0) {
      results.push({
        id: msg.id,
        type: 'message',
        title: `Message from ${msg.displayName || msg.username}`,
        subtitle: new Date(msg.timestamp).toLocaleString(),
        snippet: createSnippet(msg.text),
        tab: 'chat',
        metadata: { messageId: msg.id, conversationId: msg.conversationId },
        score: totalScore
      });
    }
  });

  // 5. Search Users / Students
  Object.values(db.users || {}).forEach((user: any) => {
    const nameScore = scoreText(user.name || '', 4);
    const trScore = scoreText(user.trNo || user.username, 4);
    const emailScore = scoreText(user.email || '', 2);
    const cityScore = scoreText(user.city || '', 1);
    const warasScore = scoreText(user.waras || '', 1);
    const bioScore = scoreText(user.bio || '', 1);
    const totalScore = nameScore + trScore + emailScore + cityScore + warasScore + bioScore;

    if (totalScore > 0) {
      // Direct name or identity boost so student profiles appear on top when searching names
      const isDirectMatch = 
        (user.name && user.name.toLowerCase().includes(cleanQ)) ||
        (user.trNo && user.trNo.toLowerCase().includes(cleanQ)) ||
        (user.username && user.username.toLowerCase().includes(cleanQ));

      results.push({
        id: user.id || user.username,
        type: 'user',
        title: `${user.name || user.username} (${user.trNo || user.username.toUpperCase()})`,
        subtitle: `${user.waras || 'Student'} • ${user.city || 'Campus'} • Room ${user.roomNo || 'N/A'}`,
        snippet: createSnippet(user.bio || user.email || ''),
        tab: 'profile',
        metadata: {
          user: {
            id: user.id || user.username,
            username: user.username,
            trNo: user.trNo || user.username,
            name: user.name || user.username,
            email: user.email || '',
            phone: user.phone || '',
            birthday: user.birthday || '',
            waras: user.waras || '',
            city: user.city || '',
            bio: user.bio || '',
            roomNo: user.roomNo || '',
            role: user.role || 'student',
            isMemeMaster: Boolean(user.isMemeMaster),
            isFailMaster: Boolean(user.isFailMaster),
            avatarColor: user.avatarColor || 'from-indigo-500 to-purple-600',
          },
          userId: user.id || user.username,
          username: user.username,
          trNo: user.trNo,
        },
        score: totalScore + (isDirectMatch ? 50 : 10),
      });
    }
  });

  // Sort by relevance score descending
  return results.sort((a, b) => b.score - a.score).slice(0, 30);
}
