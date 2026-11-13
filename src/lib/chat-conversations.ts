export interface ChatRow {
  id: string;
  sender: string;
  message: string;
  created_at: string;
  mode?: string | null;
}

export interface Conversation {
  id: string;
  title: string;
  preview: string;
  count: number;
  last: string;
}

/** Messages saved before conversations existed all share this value. */
export const LEGACY_MODE = 'general';

export function conversationIdOf(row: { mode?: string | null }): string {
  return row.mode || LEGACY_MODE;
}

export function newConversationId(): string {
  return `chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function clip(text: string, max: number): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? one.slice(0, max) + '\u2026' : one;
}

/** Groups saved messages into conversations, newest first. */
export function groupConversations(rows: ChatRow[]): Conversation[] {
  const groups = new Map<string, ChatRow[]>();
  for (const r of rows) {
    const key = conversationIdOf(r);
    const list = groups.get(key);
    if (list) list.push(r);
    else groups.set(key, [r]);
  }
  const out: Conversation[] = [];
  for (const [id, list] of groups) {
    const sorted = [...list].sort((a, b) => a.created_at.localeCompare(b.created_at));
    const firstUser = sorted.find((m) => m.sender === 'user') ?? sorted[0];
    const preview = clip(firstUser.message, 60);
    out.push({
      id,
      title: id === LEGACY_MODE ? 'Earlier messages' : preview,
      preview: id === LEGACY_MODE ? preview : '',
      count: sorted.length,
      last: sorted[sorted.length - 1].created_at,
    });
  }
  return out.sort((a, b) => b.last.localeCompare(a.last));
}