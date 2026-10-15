import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';
import { getSuggestedQuestions } from '@/lib/chatbot';
import { Send, Sparkles, AlertCircle, Copy, Check, RotateCcw } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useLanguage } from '@/lib/language-context';

const FAILED_REPLY = "I couldn't reach the assistant just now. Please check your connection and try again.";

// Converts any Markdown the model returns into readable plain text.
function toPlainText(text: string): string {
  return text
    .replace(/^\s*\|?[-:| ]+\|[-:| ]*$/gm, '')
    .replace(/^\s*\|(.+)\|\s*$/gm, (_m, row: string) =>
      row.split('|').map((c) => c.trim()).filter(Boolean).join(' - '))
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function ChatScreen() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(200);

    const loaded = (data as ChatMessage[]) || [];
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

  async function sendMessage(text: string) {
    const content = text.trim();
    if (!user || !content || typing) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      user_id: user.id,
      sender: 'user',
      message: content,
      created_at: new Date().toISOString(),
    };

    // Conversation sent to the assistant, without the local welcome message.
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

    setTyping(true);
    const { data, error } = await supabase.functions.invoke<{ reply?: string }>('chat-assistant', {
      body: { messages: outgoing, language: lang },
    });
    setTyping(false);

    const reply = !error && data?.reply ? data.reply : null;
    const replyText = reply ?? FAILED_REPLY;
    const assistantMsg: ChatMessage = {
      id: 'temp-ai-' + Date.now(),
      user_id: user.id,
      sender: 'assistant',
      message: replyText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantMsg]);

    // Only real answers are saved, so failed attempts do not clutter the history.
    if (reply) {
      const { data: savedAi } = await supabase
        .from('chat_history')
        .insert({ user_id: user.id, mode: 'general', sender: 'assistant', message: reply })
        .select()
        .single();
      if (savedAi) {
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? (savedAi as ChatMessage) : m)));
      }
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
    await loadMessages();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] animate-fade-in">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-accent-500 flex items-center justify-center text-white">
          <Sparkles size={20} />
        </div>
        <div>
          <h1 className="font-serif text-xl font-bold text-neutral-900 dark:text-neutral-100">{t('chatAssistantName')}</h1>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">{t('cyclePredictionsEstimates')}</p>
        </div>
        <button
          onClick={startNewChat}
          aria-label="New chat"
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-primary-100 px-3 py-2 text-xs font-medium text-ink transition-colors hover:bg-primary-200"
        >
          <RotateCcw size={14} strokeWidth={2} />
          New chat
        </button>
      </div>

      <div className="card-soft p-3 flex items-start gap-2 mb-3">
        <AlertCircle size={16} className="text-warning-500 shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('chatDisclaimer')}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.sender === 'user'
                ? 'bg-primary-500 text-ink rounded-br-md'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-bl-md'
            }`}>
              {msg.sender === 'user' ? (
                <p className="text-sm whitespace-pre-line leading-relaxed">{msg.message}</p>
              ) : (
                <div className="chat-markdown text-sm leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.message}</ReactMarkdown>
                </div>
              )}
              <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-ink/60' : 'text-neutral-400'}`}>
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
            <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-neutral-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {getSuggestedQuestions(lang).slice(0, 4).map((q) => (
            <button
              key={q}
              onClick={() => sendMessage(q)}
              className="chip text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40"
            >
              {q}
            </button>
          ))}
        </div>
      )}

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
          className="btn-primary !px-4 flex items-center justify-center"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
