import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import type { ChatMessage } from '@/lib/types';
import { generateResponse, getSuggestedQuestions } from '@/lib/chatbot';
import { Send, Sparkles, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/language-context';

export function ChatScreen() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    const loaded = (data as ChatMessage[]) || [];

    if (loaded.length === 0) {
      const welcome: ChatMessage = {
        id: 'welcome',
        user_id: user.id,
        sender: 'assistant',
        message: t('welcomeBack') + "! " + t('chatAssistantName') + ". " + t('askAI') + ".",
        created_at: new Date().toISOString(),
      };
      setMessages([welcome]);
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
    if (!user || !text.trim()) return;
    setInput('');

    const userMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      user_id: user.id,
      sender: 'user',
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Save user message
    const { data: savedUserMsg } = await supabase
      .from('chat_messages')
      .insert({ user_id: user.id, sender: 'user', message: text })
      .select()
      .single();

    if (savedUserMsg) {
      setMessages((prev) => prev.map((m) => (m.id === userMsg.id ? savedUserMsg as ChatMessage : m)));
    }

    // Simulate typing
    setTyping(true);
    const response = generateResponse(text, messages, lang);

    setTimeout(async () => {
      setTyping(false);
      const assistantMsg: ChatMessage = {
        id: 'temp-ai-' + Date.now(),
        user_id: user.id,
        sender: 'assistant',
        message: response,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);

      const { data: savedAiMsg } = await supabase
        .from('chat_messages')
        .insert({ user_id: user.id, sender: 'assistant', message: response })
        .select()
        .single();

      if (savedAiMsg) {
        setMessages((prev) => prev.map((m) => (m.id === assistantMsg.id ? savedAiMsg as ChatMessage : m)));
      }
    }, 800 + Math.random() * 600);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" />
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
      </div>

      {/* Disclaimer */}
      <div className="card-soft p-3 flex items-start gap-2 mb-3">
        <AlertCircle size={16} className="text-warning-500 shrink-0 mt-0.5" />
        <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {t('chatDisclaimer')}
        </p>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.sender === 'user'
                ? 'bg-primary-500 text-white rounded-br-md'
                : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-700 rounded-bl-md'
            }`}>
              <p className="text-sm whitespace-pre-line leading-relaxed">{msg.message}</p>
              <p className={`text-xs mt-1.5 ${msg.sender === 'user' ? 'text-white/60' : 'text-neutral-400'}`}>
                {new Date(msg.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
              </p>
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

      {/* Suggested questions */}
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

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
          placeholder={t('askAI') + "..."}
          className="input-field flex-1"
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={!input.trim()}
          className="btn-primary !px-4 flex items-center justify-center"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}
