import { getLangCode } from '@/lib/lang-store';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';
import { getSuggestedQuestions } from '@/lib/chatbot';
import { Send, Sparkles, Copy, Check, History, Plus, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/lib/language-context';
import { conversationIdOf, groupConversations, newConversationId } from '@/lib/chat-conversations';
import { chatText } from '@/lib/chat-labels';

type Row = ChatMessage & { mode?: string | null };
type Outgoing = { role: string; content: string }[];

export function ChatScreen() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [rows, setRows] = useState<Row[]>([]);
  const [convId, setConvId] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const welcomeAt = useRef(new Date().toISOString());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const sendingRef = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [pending, setPending] = useState<{ outgoing: Outgoing; cid: string } | null>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1000);
    const list = ((data as Row[]) || []).reverse();
    setRows(list);
    // Continue the most recent conversation, or start a new one when there is no history yet.
    setConvId((prev) => prev || (list.length > 0 ? conversationIdOf(list[list.length - 1]) : newConversationId()));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  const inConversation = rows.filter((r) => conversationIdOf(r) === convId).slice(-200);
  const messages: Row[] = inConversation.length > 0
    ? inConversation
    : [{
        id: 'welcome',
        user_id: user?.id ?? '',
        sender: 'assistant',
        message: `${t('welcomeBack')}! ${t('chatAssistantName')}. ${t('askAI')}.`,
        created_at: welcomeAt.current,
      }];
  const conversations = groupConversations(rows);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [rows.length, convId, typing, showHistory]);

  async function requestReply(outgoing: Outgoing, cid: string) {
    if (!user) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setPending({ outgoing, cid });
      setErrorMsg(chatText(lang, 'offline'));
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
      setPending({ outgoing, cid });
      setErrorMsg(chatText(lang, 'noAnswer'));
      return;
    }

    const assistantMsg: Row = {
      id: 'temp-ai-' + Date.now(),
      user_id: user.id,
      sender: 'assistant',
      message: reply,
      created_at: new Date().toISOString(),
      mode: cid,
    };
    setRows((prev) => [...prev, assistantMsg]);
    const { data: savedAi } = await supabase
      .from('chat_history')
      .insert({ user_id: user.id, mode: cid, sender: 'assistant', message: reply })
      .select()
      .single();
    if (savedAi) {
      setRows((prev) => prev.map((m) => (m.id === assistantMsg.id ? (savedAi as Row) : m)));
    }
  }

  async function sendMessage(text: string) {
    const content = text.trim();
    const cid = convId;
    if (!user || !content || !cid || sendingRef.current) return;
    sendingRef.current = true;
    try {
      setInput('');
      const userMsg: Row = {
        id: 'temp-' + Date.now(),
        user_id: user.id,
        sender: 'user',
        message: content,
        created_at: new Date().toISOString(),
        mode: cid,
      };
      const outgoing = [...messages, userMsg]
        .filter((m) => m.id !== 'welcome')
        .slice(-12)
        .map((m) => ({ role: m.sender === 'user' ? 'user' : 'assistant', content: m.message }));
      setRows((prev) => [...prev, userMsg]);
      const { data: savedUser } = await supabase
        .from('chat_history')
        .insert({ user_id: user.id, mode: cid, sender: 'user', message: content })
        .select()
        .single();
      if (savedUser) {
        setRows((prev) => prev.map((m) => (m.id === userMsg.id ? (savedUser as Row) : m)));
      }
      await requestReply(outgoing, cid);
    } finally {
      sendingRef.current = false;
    }
  }

  async function retry() {
    if (!pending || sendingRef.current) return;
    sendingRef.current = true;
    try {
      await requestReply(pending.outgoing, pending.cid);
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

  // Starts a separate empty conversation. Nothing is deleted.
  function startNewChat() {
    if (typing) return;
    setConvId(newConversationId());
    setErrorMsg(null);
    setPending(null);
    setShowHistory(false);
  }

  function openConversation(id: string) {
    if (typing) return;
    setConvId(id);
    setErrorMsg(null);
    setPending(null);
    setShowHistory(false);
  }

  async function deleteConversation(id: string) {
    if (!user || typing) return;
    if (!confirm(chatText(lang, 'deleteConfirm'))) return;
    const { error } = await supabase.from('chat_history').delete().eq('user_id', user.id).eq('mode', id);
    if (error) return;
    setRows((prev) => prev.filter((r) => conversationIdOf(r) !== id));
    if (id === convId) {
      setConvId(newConversationId());
      setErrorMsg(null);
      setPending(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  const headerBtn = 'inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/70 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-white disabled:opacity-50 dark:bg-white/10 dark:hover:bg-white/20';

  return (
    <div className="flex h-[calc(100dvh-13rem)] flex-col">
      {/* Header */}
      <div className="hero-surface mb-3 flex items-center gap-2 rounded-2xl border border-white/60 p-3 shadow-soft dark:border-white/10">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-400 to-accent-500 text-white shadow-soft">
          <Sparkles size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-lg text-ink">{t('chatAssistantName')}</h1>
          <p className="truncate text-xs text-ink-muted">{t('cyclePredictionsEstimates')}</p>
        </div>
        <button
          onClick={() => setShowHistory((v) => !v)}
          aria-label={chatText(lang, 'history')}
          aria-pressed={showHistory}
          className={headerBtn}
        >
          <History size={15} strokeWidth={2} />
        </button>
        <button onClick={startNewChat} disabled={typing} aria-label={chatText(lang, 'newChat')} className={headerBtn}>
          <Plus size={14} strokeWidth={2} />
          {chatText(lang, 'newChat')}
        </button>
      </div>

      {showHistory ? (
        <div className="flex-1 space-y-2 overflow-y-auto pb-3">
          <div className="flex items-center justify-between px-1 pb-1">
            <h2 className="font-serif text-lg text-ink">{chatText(lang, 'history')}</h2>
            <button onClick={() => setShowHistory(false)} className="text-sm font-medium text-primary-700 dark:text-primary-300">
              {chatText(lang, 'back')}
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className="px-1 text-sm text-ink-muted">{chatText(lang, 'noChats')}</p>
          ) : (
            conversations.map((c) => (
              <div key={c.id} className={`card flex items-center gap-2 p-3 ${c.id === convId ? 'ring-2 ring-primary-400' : ''}`}>
                <button onClick={() => openConversation(c.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-sm font-semibold text-ink">{c.id === 'general' ? chatText(lang, 'earlier') : c.title}</p>
                  {c.preview && <p className="truncate text-xs text-ink-muted">{c.preview}</p>}
                  <p className="mt-0.5 text-[11px] text-ink-muted">
                    {new Date(c.last).toLocaleDateString(getLangCode(), { day: 'numeric', month: 'short', year: 'numeric' })} {'\u00b7'} {c.count} {chatText(lang, 'messages')}
                  </p>
                </button>
                <button
                  onClick={() => deleteConversation(c.id)}
                  aria-label={chatText(lang, 'deleteAria')}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-error-50 text-error-600 transition-colors hover:bg-error-100 dark:bg-error-600/30 dark:text-error-300"
                >
                  <Trash2 size={15} strokeWidth={1.75} />
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <>
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
                    {new Date(msg.created_at).toLocaleTimeString(getLangCode(), { hour: 'numeric', minute: '2-digit' })}
                  </p>
                  {msg.sender === 'assistant' && msg.id !== 'welcome' && (
                    <button
                      onClick={() => copyMessage(msg.id, msg.message)}
                      aria-label={chatText(lang, 'copyAria')}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-ink"
                    >
                      {copiedId === msg.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === msg.id ? chatText(lang, 'copied') : chatText(lang, 'copy')}
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
              <button onClick={retry} className="shrink-0 font-semibold underline">{chatText(lang, 'retry')}</button>
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
              aria-label={chatText(lang, 'send')}
              className="btn-primary flex items-center justify-center !px-4"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-ink-muted">
            {chatText(lang, 'disclaimer')}
          </p>
        </>
      )}
    </div>
  );
}