import { useEffect, useState, useRef } from 'react';
import { Send, Stethoscope, BookOpen, HelpCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { useCycleData } from '@/lib/use-cycle-data';
import { getCycleLengths, getAverageCycleLength, getAveragePeriodDuration, parseDate, formatDate } from '@/lib/cycle';
import { Badge } from '@/components/ui';

type Mode = 'ask' | 'learn' | 'act';

const modeConfig: Record<Mode, { icon: typeof Stethoscope; label: string; key: string; color: string }> = {
  ask: { icon: Stethoscope, label: 'Ask About Me', key: 'ai.modeAsk', color: 'bg-primary' },
  learn: { icon: BookOpen, label: 'Learn', key: 'ai.modeLearn', color: 'bg-accent' },
  act: { icon: HelpCircle, label: 'What Should I Do?', key: 'ai.modeAct', color: 'bg-success' },
};

const disclaimer = 'FemCare Assistant provides general health information and is not a replacement for professional medical advice.';

const emergencyNote = 'If you believe you are experiencing a medical emergency, contact your local emergency service or seek immediate medical care.';

const concernNote = 'This can have several possible causes. If the symptom is severe, persistent, unusual for you, or worrying you, consider contacting a qualified healthcare professional.';

// Educational content for Learn mode
const learnContent: Record<string, string> = {
  'what is pms': 'PMS (Premenstrual Syndrome) refers to physical and emotional symptoms that occur in the days before a period. Common symptoms include mood changes, bloating, breast tenderness, fatigue, and irritability. These typically resolve after the period starts. If PMS symptoms significantly impact daily life, a healthcare professional can discuss management options.',
  'what happens during ovulation': 'Ovulation is when an ovary releases a mature egg, typically around the middle of the menstrual cycle (about 14 days before the next period). The egg travels through the fallopian tube where it can be fertilised for about 12-24 hours. Some people notice mild pelvic pain, changes in cervical mucus, or slight temperature changes around ovulation.',
  'why do periods cause cramps': 'Period cramps (dysmenorrhea) are caused by the uterus contracting to shed its lining. These contractions are triggered by prostaglandins, hormone-like substances that promote inflammation and pain. Higher prostaglandin levels are associated with more severe cramps. Mild cramps are common, but severe pain that interferes with daily activities should be discussed with a healthcare professional.',
  'what is pcos': 'PCOS (Polycystic Ovary Syndrome) is a hormonal condition that can cause irregular periods, excess androgen levels, and polycystic ovaries. Common signs include irregular or absent periods, acne, weight changes, and excess hair growth. PCOS is a common condition and has various management options. Only a healthcare professional can diagnose PCOS through clinical evaluation and tests.',
  'what is endometriosis': 'Endometriosis is a condition where tissue similar to the uterine lining grows outside the uterus, often causing pain, especially during periods. Symptoms can include severe period pain, pain during intercourse, and chronic pelvic pain. Endometriosis can only be diagnosed by a healthcare professional, often through laparoscopy. If you experience severe period pain, consider speaking with a gynaecologist.',
  'what is a normal menstrual cycle': 'A "normal" menstrual cycle varies widely. Cycles typically range from 21 to 35 days, with periods lasting 2 to 7 days. What matters most is what is normal for you. Significant changes in your cycle pattern, very heavy bleeding, or severe pain should be discussed with a healthcare professional.',
  'what is contraception': 'Contraception (birth control) methods prevent pregnancy. Options include hormonal methods (pills, patches, injections, implants), barrier methods (condoms, diaphragms), intrauterine devices (IUDs), and fertility awareness methods. Each method has different effectiveness rates, benefits, and considerations. A healthcare professional can help you choose the right method for your situation.',
  'what are stis': 'STIs (Sexually Transmitted Infections) are infections passed through sexual contact. Common STIs include chlamydia, gonorrhoea, HPV, herpes, and HIV. Many STIs may not cause symptoms, so regular testing is important if you are sexually active. Most STIs are treatable, and early detection helps prevent complications. Using condoms reduces but does not eliminate STI risk.',
  'what is consent': 'Consent is a clear, voluntary, and informed agreement to engage in any activity, including sexual activity. Consent must be freely given, reversible (can be withdrawn at any time), informed, enthusiastic, and specific. Consent to one activity does not imply consent to others. If consent is unclear or if someone feels pressured, that is not consent.',
};

export default function AIAssistant() {
  const { user } = useAuth();
  const { periods, symptoms, fetchData } = useCycleData(user?.id);
  const [mode, setMode] = useState<Mode>('ask');
  const [messages, setMessages] = useState<{ id?: string; sender: string; message: string }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      fetchData(user.id);
      loadMessages();
    }
  }, [user]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const loadMessages = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase.from('chat_history').select('*').eq('user_id', user.id).order('created_at', { ascending: true });
    if (data && data.length > 0) {
      setMessages(data as any);
    } else {
      setMessages([{ sender: 'assistant', message: getWelcomeMessage('ask') }]);
    }
    setLoading(false);
  };

  const getWelcomeMessage = (m: Mode): string => {
    if (m === 'ask') return 'I can answer questions based on your logged data. Try asking "How have my symptoms changed recently?" or "When do I usually experience cramps?"';
    if (m === 'learn') return 'Ask me about menstrual and reproductive health topics. Try "What is PMS?" or "What happens during ovulation?"';
    return 'I can provide general practical guidance. Try "What can I do for period discomfort?" or "When should I talk to a doctor?"';
  };

  const handleModeChange = (m: Mode) => {
    setMode(m);
    setMessages([{ sender: 'assistant', message: getWelcomeMessage(m) }]);
  };

  const generateResponse = (question: string): string => {
    const q = question.toLowerCase().trim();

    if (mode === 'ask') {
      return generateAskResponse(q);
    } else if (mode === 'learn') {
      return generateLearnResponse(q);
    } else {
      return generateActResponse(q);
    }
  };

  const generateAskResponse = (q: string): string => {
    if (periods.length === 0 && symptoms.length === 0) {
      return "You haven't logged any data yet. Start logging your periods and symptoms, and I'll be able to answer questions about your patterns.";
    }

    if (q.includes('symptom') && (q.includes('change') || q.includes('recent'))) {
      if (symptoms.length === 0) return "You haven't logged any symptoms yet.";
      const recent = symptoms.slice(-5);
      const older = symptoms.slice(-15, -5);
      const recentSyms = recent.flatMap(s => s.symptoms || []);
      const olderSyms = older.flatMap(s => s.symptoms || []);
      if (recentSyms.length === 0) return "You haven't logged symptoms recently.";
      const recentSet = new Set(recentSyms);
      const olderSet = new Set(olderSyms);
      const newSyms = [...recentSet].filter(s => !olderSet.has(s));
      if (newSyms.length > 0) return `In your recent entries, you started logging: ${newSyms.join(', ')}. ${concernNote}`;
      return `Your recent symptoms have been consistent with what you usually log: ${recentSyms.slice(0, 3).join(', ')}.`;
    }

    if (q.includes('cramps') || q.includes('when do i')) {
      const crampEntries = symptoms.filter(s => (s.symptoms || []).includes('Cramps'));
      if (crampEntries.length === 0) return "You haven't logged cramps yet.";
      return `You've logged cramps on ${crampEntries.length} occasions. ${concernNote}`;
    }

    if (q.includes('regular') || q.includes('cycle') || q.includes('period')) {
      const lengths = getCycleLengths(periods);
      if (lengths.length < 2) return "You need at least 2 logged periods to assess regularity. Keep logging!";
      const avg = getAverageCycleLength(periods, 28);
      const range = Math.max(...lengths) - Math.min(...lengths);
      if (range <= 7) return `Your recent cycles have been fairly regular, ranging from ${Math.min(...lengths)} to ${Math.max(...lengths)} days (average: ${avg} days).`;
      return `Your cycles show some variation, ranging from ${Math.min(...lengths)} to ${Math.max(...lengths)} days. This is common but if the pattern changes significantly, consider speaking with a healthcare professional.`;
    }

    if (q.includes('most') || q.includes('frequent') || q.includes('often')) {
      const map = new Map<string, number>();
      symptoms.forEach(s => (s.symptoms || []).forEach(sym => map.set(sym, (map.get(sym) || 0) + 1)));
      const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
      if (sorted.length === 0) return "You haven't logged any symptoms yet.";
      return `Your most logged symptoms are: ${sorted.slice(0, 3).map(([s, c]) => `${s} (${c}x)`).join(', ')}.`;
    }

    return `Based on your logged data, you have ${periods.length} period records and ${symptoms.length} symptom entries. Try asking about specific symptoms, cycle regularity, or patterns.`;
  };

  const generateLearnResponse = (q: string): string => {
    for (const [key, content] of Object.entries(learnContent)) {
      if (q.includes(key)) return content;
    }
    if (q.includes('period') || q.includes('menstrual')) return learnContent['what is a normal menstrual cycle'];
    return "I can help with topics like: PMS, ovulation, period cramps, PCOS, endometriosis, normal menstrual cycles, contraception, STIs, and consent. Try asking about any of these.";
  };

  const generateActResponse = (q: string): string => {
    if (q.includes('discomfort') || q.includes('pain') || q.includes('cramp')) {
      return `For period discomfort, common self-care approaches include: applying heat to the abdomen, gentle exercise, staying hydrated, over-the-counter pain relievers (as directed), and rest. If pain is severe, persistent, or significantly affects your daily activities, consider speaking with a healthcare professional. ${concernNote}`;
    }
    if (q.includes('missed') || q.includes('late') || q.includes('miss')) {
      return `A missed or late period can have several causes, including stress, weight changes, hormonal fluctuations, pregnancy, or medical conditions. If you're sexually active and your period is late, consider taking a pregnancy test. If your period is frequently irregular or you miss multiple periods, consider speaking with a healthcare professional to identify the cause.`;
    }
    if (q.includes('doctor') || q.includes('when should i')) {
      return `Consider speaking with a healthcare professional if you experience: periods that are consistently irregular, very heavy bleeding, severe pain that interferes with daily activities, bleeding between periods, periods that stop for 3+ months (and you're not pregnant), or any sudden change in your cycle pattern. It's always okay to consult a professional if something concerns you.`;
    }
    if (q.includes('track') || q.includes('before')) {
      return `Before visiting a doctor, it's helpful to track: your period dates, cycle length, flow intensity, pain levels (0-10), symptoms and when they occur, mood changes, and any medications you're taking. The FemCare+ Health Report feature can generate a summary you can share with your doctor.`;
    }
    if (q.includes('emergency') || q.includes('severe') || q.includes('urgent')) {
      return `${emergencyNote} For non-emergency concerns, ${concernNote.toLowerCase()}`;
    }
    return `I can provide general guidance on: managing period discomfort, what to do about a missed period, when to see a doctor, and what to track before a doctor's visit. ${concernNote}`;
  };

  const handleSend = async () => {
    if (!input.trim() || !user) return;
    const question = input.trim();
    setInput('');
    setSending(true);

    const userMsg = { sender: 'user', message: question };
    setMessages(prev => [...prev, userMsg]);

    await supabase.from('chat_history').insert({ user_id: user.id, mode, sender: 'user', message: question });

    // Simulate AI response delay
    await new Promise(r => setTimeout(r, 500));

    const response = generateResponse(question);
    const assistantMsg = { sender: 'assistant', message: response };
    setMessages(prev => [...prev, assistantMsg]);

    await supabase.from('chat_history').insert({ user_id: user.id, mode, sender: 'assistant', message: response });

    setSending(false);
  };

  const handleClearChat = async () => {
    if (!user) return;
    await supabase.from('chat_history').delete().eq('user_id', user.id);
    setMessages([{ sender: 'assistant', message: getWelcomeMessage(mode) }]);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)] animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-ink dark:text-gray-100">FemCare Assistant</h1>
        {messages.length > 1 && (
          <button onClick={handleClearChat} className="btn-ghost p-2 text-sm">
            <Trash2 size={16} /> Clear
          </button>
        )}
      </div>

      {/* Mode selector */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(modeConfig) as Mode[]).map(m => {
          const cfg = modeConfig[m];
          const Icon = cfg.icon;
          return (
            <button
              key={m}
              onClick={() => handleModeChange(m)}
              className={`flex flex-col items-center gap-1.5 py-3 rounded-lg border-2 transition-all ${
                mode === m ? 'border-primary bg-primary-50 dark:bg-primary-900/30' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className={`w-8 h-8 rounded-lg ${cfg.color} flex items-center justify-center`}>
                <Icon size={16} className="text-white" />
              </div>
              <span className="text-xs font-medium text-ink dark:text-gray-200 text-center">{cfg.label}</span>
            </button>
          );
        })}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4">
        {loading ? (
          <div className="flex items-center justify-center py-8"><div className="animate-pulse text-ink-muted">Loading...</div></div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-lg px-4 py-2.5 ${
                msg.sender === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-bg-card dark:bg-bg-card-dark border border-gray-100 dark:border-gray-800 text-ink dark:text-gray-100'
              }`}>
                <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="bg-bg-card dark:bg-bg-card-dark border border-gray-100 dark:border-gray-800 rounded-lg px-4 py-2.5">
              <div className="flex gap-1">
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="mb-3">
        <Badge color="warning">{disclaimer}</Badge>
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          className="input flex-1"
          placeholder="Type your question..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          disabled={sending}
        />
        <button onClick={handleSend} className="btn-primary" disabled={sending || !input.trim()}>
          <Send size={18} />
        </button>
      </div>
    </div>
  );
}
