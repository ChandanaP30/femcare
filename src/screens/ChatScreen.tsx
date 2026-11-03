import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';
import { getSuggestedQuestions } from '@/lib/chatbot';
import { Send, Sparkles, Copy, Check, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/lib/language-context';

export function ChatScreen() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ role: string; content: string }[] | null>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200);

    const loaded = ((data as ChatMessage[]) || []).reverse();
    if (loaded.length === 0) {
      setMessages([
        {
          id: 'welcome',
          user_id: user.id,
          sender: 'assistant',
          message: `${t('welcomeBack')}! ${t('chatAssistantName')}. ${t('askAI')}.`,
          created_at: new Date().toISOString(),
        },
      ]);
    } else {
      setMessages(loaded);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typing]);

  async function requestReply(outgoing: { role: string; content: string }[]) {
    if (!user) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPending(outgoing);
      setErrorMsg('You are offline. Connect to the internet, then tap Retry.');
      return;
    }
    setErrorMsg(null);
    setPending(null);
    setTyping(true);
    let reply: string | null = null;
    try {
      const result = await Promise.race([
        supabase.functions.invoke<{ reply?: string }>('chat-assistant', {
          body: { messages: outgoing, language: lang },
        }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 30000)),
      ]);
      reply = !result.error && result.data?.reply ? result.data.reply : null;
    } catch {
      reply = null;
    }
    setTyping(false);

    if (!reply) {
      setPending(outgoing);
      setErrorMsg("Couldn't get an answer. Check your connection and tap Retry.");
      return;
    }

    const assistantMsg: ChatMessage = {
      id: 'temp-ai-' + Date.now(),
      user_id: user.id,
      sender: 'assistant',
      message: reply,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    const { data: savedAi } = await supabase
      .from('chat_history')
      .insert({ user_id: user.id, mode: 'general', sender: 'assistant', message: reply })
      .select()
      .single();
    if (savedAi) {
      setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? (savedAi as ChatMessage) : m)));
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!user || !content || sendingRef.current) return;
    sendingRef.current = true;
    try {
      setInput('');
      const userMsg: ChatMessage = {
        id: 'temp-' + Date.now(),
        user_id: user.id,
        sender: 'user',
        message: content,
        created_at: new Date().toISOString(),
      };
      const outgoing = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .slice(-12)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.message }));
      setMessages((prev) => [...prev, userMsg]);

      const { data: savedUser } = await supabase
        .from('chat_history')
        .insert({ user_id: user.id, mode: 'general', sender: 'user', message: content })
        .select()
        .single();
      if (savedUser) {
        setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? (savedUser as ChatMessage) : m)));
      }
      await requestReply(outgoing);
    } finally {
      sendingRef.current = false;
    }
  }

  async function retry() {
    if (!pending || sendingRef.current) return;
    sendingRef.current = true;
    try {
      await requestReply(pending);
    } finally {
      sendingRef.current = false;
    }
  }

  

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* clipboard unavailable: ignore */
    }
  }

  async function startNewChat() {
    if (!user) return;
    if (!confirm('Start a new chat? This clears the saved conversation.')) return;
    await supabase.from('chat_history').delete().eq('user_id', user.id);
    setMessages([]);
    setErrorMsg(null);
    setPending(null);
    await loadMessages();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] flex-col">
      {/* Header */}
      <div className="hero-surface mb-3 flex items-center gap-3 rounded-2xl border border-white/60 p-3 shadow-soft dark:border-white/10">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-soft">
          <Sparkles size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-lg text-ink">{t('chatAssistantName')}</h1>
          <p className="truncate text-xs text-ink-muted">{t('cyclePredictionsEstimates')}</p>
        </div>
        <button
          onClick={startNewChat}
          aria-label="New chat"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-white dark:bg-white/10 dark:hover:bg-white/20"
        >
          <RotateCcw size={14} strokeWidth={2} />
          New chat
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto pb-3">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                msg.sender === 'user'
                  ? 'rounded-br-md bg-primary-500 text-ink-onlight'
                  : 'rounded-bl-md border border-primary-100/70 bg-bg-card text-ink shadow-soft dark:border-white/10'
              }`}
            >
              {msg.sender === 'user' ? (
                <p className="whitespace-pre-line text-sm leading-relaxed">{msg.message}</p>
              ) : (
                <div className="chat-markdown text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.message}</ReactMarkdown>
                </div>
              )}
              <p className={`mt-1.5 text-xs ${msg.sender === 'user' ? 'text-ink-onlight/60' : 'text-ink-muted'}`}>
                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
              {msg.sender === 'assistant' && msg.id !== 'welcome' && (
                <button
                  onClick={() => copyMessage(msg.id, msg.message)}
                  aria-label="Copy reply"
                  className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                >
                  {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                  {copiedId === msg.id ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-md border border-primary-100/70 bg-bg-card px-4 py-3 shadow-soft dark:border-white/10">
              <div className="flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink-muted" style={{ animationDelay: '0ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink-muted" style={{ animationDelay: '150ms' }} />
                <span className="h-2 w-2 animate-bounce rounded-full bg-ink-muted" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Suggestions */}
      {messages.length <= 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {getSuggestedQuestions(lang).slice(0, 4).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="chip bg-primary-100 text-xs text-primary-800 hover:bg-primary-200 dark:bg-primary-900/50 dark:text-primary-200 dark:hover:bg-primary-900/70"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          <span>{errorMsg}</span>
          <button onClick={retry} className="shrink-0 font-semibold underline">Retry</button>
        </div>
      )}
      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={t('askAI') + '...'}
          className="input-field flex-1"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim() || typing}
          aria-label="Send"
          className="btn-primary flex items-center justify-center !px-4"
        >
          <Send size={20} />
        </button>
      </div>
      <p className="mt-2 text-center text-[11px] leading-snug text-ink-muted">
        General information only, not medical advice. In an emergency call 112. Answers are generated by Groq; avoid sharing names or contact details.
      </p>
    </div>
  );
}