import React, { useState, useRef, useEffect } from 'react';
import { Eye, Send, Loader2, MessageSquare, ArrowLeft, Trash2 } from 'lucide-react';
import { agentService } from '../services/api';

export default function AgentChat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setLoading(true);

    try {
      // Build history from prior messages (for multi-turn context)
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await agentService.chat(question, history);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: result.answer, framesAnalyzed: result.framesAnalyzed }
      ]);
    } catch (error) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: `Error: ${error.message}`, isError: true }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 bg-gradient-to-r from-indigo-600/20 via-indigo-400/10 to-transparent px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-indigo-300">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold tracking-wide">
                <span className="bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">Agent Eye</span>
                <span className="text-slate-400 ml-2 text-sm font-normal">Analytics</span>
              </div>
              <div className="text-xs text-slate-400">Ask questions about queue activity and alerts</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setMessages([]); }}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
            <a
              href="/"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto max-w-4xl space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 mb-4">
                <Eye className="h-8 w-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-200 mb-2">Agent Eye Analytics</h2>
              <p className="text-sm text-slate-400 max-w-md mb-6">
                Ask questions about queue activity, token numbers, alerts, and trends at the service center.
              </p>
              <div className="grid gap-2 text-left w-full max-w-md">
                {[
                  'What is the current number of people in the queue?',
                  'What was the average queue length in the last 5 minutes?',
                  'What is the latest token number displayed?',
                  'Were any green or red alerts raised in the last 5 minutes?',
                  'What was the maximum people count in the queue in the last 5 minutes?',
                ].map((q, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(q); }}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 hover:bg-white/10 transition-all"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-indigo-600/30 border border-indigo-500/30 text-slate-100'
                  : msg.isError
                    ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                    : 'bg-white/5 border border-white/10 text-slate-200'
              }`}>
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Eye className="h-3.5 w-3.5 text-indigo-400" />
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Agent Eye</span>
                    {msg.framesAnalyzed !== undefined && (
                      <span className="text-[10px] text-slate-500 ml-1">({msg.framesAnalyzed} observations)</span>
                    )}
                  </div>
                )}
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white/5 border border-white/10 px-4 py-3">
                <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                <span className="text-sm text-slate-400">Analyzing frame data...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/10 bg-slate-900/80 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about queue lengths, token numbers, alerts, trends..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-white/10 bg-slate-900/50 px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-lg shadow-indigo-500/20 transition-all hover:from-indigo-500 hover:to-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
