import React, { useState, useEffect } from 'react';
import { Vote, Plus, CheckCircle2, Sparkles, Trash2 } from 'lucide-react';
import { User, Poll } from '../types';
import { sendChatMessage } from '../lib/chatFirestore';

interface PollsProps {
  currentUser: User;
}

export default function Polls({ currentUser }: PollsProps) {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchPolls = async () => {
    try {
      const res = await fetch('/api/polls');
      if (res.ok) {
        const data = await res.json();
        setPolls(data.polls || []);
      }
    } catch (err) {
      console.error('Error fetching polls:', err);
    }
  };

  useEffect(() => {
    fetchPolls();
  }, []);

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || !options.trim()) return;

    setIsCreating(true);
    try {
      const res = await fetch('/api/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          options: options.split('\n').filter(opt => opt.trim()),
          authorId: currentUser.id,
          authorName: currentUser.username,
        }),
      });

      if (res.ok) {
        setQuestion('');
        setOptions('');
        fetchPolls();
        setMessage('Poll created successfully!');
        setTimeout(() => setMessage(null), 3000);
      }
    } catch (err) {
      console.error('Error creating poll:', err);
    } finally {
      setIsCreating(false);
    }
  };

  const handleShareToChat = async (poll: Poll) => {
    const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
    const summary = poll.options
      .map(opt => `${opt.label}: ${totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0}% (${opt.votes})`)
      .join('\n');
    const message = `📊 Poll Result: "${poll.question}"\n\n${summary}\n\nTotal Votes: ${totalVotes}`;

    try {
      await sendChatMessage({
        userId: currentUser.id,
        username: currentUser.username,
        displayName: currentUser.name || currentUser.username,
        avatarColor: currentUser.avatarColor,
        text: message,
        type: 'text',
      });
      setMessage('Shared to chat!');
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      console.error('Error sharing to chat:', err);
      setMessage('Failed to share.');
    }
  };

  const handleVote = async (pollId: string, optionId: string) => {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, optionId }),
      });
      if (res.ok) {
        fetchPolls();
      }
    } catch (err) {
      console.error('Error voting:', err);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Poll Header Card */}
      <div className="glass-panel rounded-2xl p-4 border border-white/5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Vote className="h-4 w-4 text-indigo-400" />
            <span>Classroom Polls</span>
          </h2>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-white text-xs font-semibold border border-indigo-500/30 transition-all cursor-pointer"
          >
            <Plus className={`h-3.5 w-3.5 transition-transform ${showCreate ? 'rotate-45' : ''}`} />
            <span>{showCreate ? 'Cancel' : 'New Poll'}</span>
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreatePoll} className="space-y-2.5 pt-1 border-t border-white/5">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Question (e.g., Best study time tonight?)"
              className="w-full bg-slate-950/40 text-white placeholder-slate-500 px-3 py-2 rounded-xl border border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/40"
              required
            />
            <textarea
              value={options}
              onChange={(e) => setOptions(e.target.value)}
              placeholder="Options (one per line, e.g.&#10;8:00 PM&#10;9:30 PM)"
              rows={2}
              className="w-full bg-slate-950/40 text-white placeholder-slate-500 px-3 py-2 rounded-xl border border-white/10 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500/40 resize-none"
              required
            />
            <button
              type="submit"
              disabled={isCreating}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-1.5 rounded-xl text-xs transition-all cursor-pointer shadow-xs border border-white/10"
            >
              {isCreating ? 'Creating...' : 'Publish Poll'}
            </button>
          </form>
        )}
        {message && <p className="text-emerald-400 text-[11px] font-semibold">{message}</p>}
      </div>

      {/* Active Polls List */}
      <div className="space-y-2.5">
        {polls.map(poll => {
          const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
          const userVoteId = poll.userVotes[currentUser.id];

          return (
            <div key={poll.id} className="glass-panel rounded-2xl p-3.5 border border-white/5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-bold text-white tracking-tight leading-snug">"{poll.question}"</h3>
                <button
                  onClick={() => handleShareToChat(poll)}
                  className="text-[9px] text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded-md shrink-0 transition-colors"
                >
                  Share to Chat
                </button>
              </div>
              <div className="space-y-1.5">
                {poll.options.map(opt => {
                  const percent = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                  const isUserVote = userVoteId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => handleVote(poll.id, opt.id)}
                      className={`w-full text-left p-2 rounded-xl border relative overflow-hidden flex items-center justify-between transition-all ${
                        isUserVote ? 'bg-indigo-500/15 border-indigo-500/50' : 'bg-white/3 border-white/5 hover:bg-white/6'
                      }`}
                    >
                      <div
                        className="absolute inset-0 bg-indigo-500/10 pointer-events-none transition-all"
                        style={{ width: `${percent}%` }}
                      />
                      <span className="text-xs text-slate-200 relative z-10">{opt.label}</span>
                      <span className="text-xs font-bold font-mono text-white relative z-10">{percent}% ({opt.votes})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
