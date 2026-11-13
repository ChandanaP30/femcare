import { describe, it, expect } from 'vitest';
import { groupConversations, conversationIdOf, newConversationId } from './chat-conversations';

const row = (id: string, mode: string | null | undefined, sender: string, message: string, at: string) => ({ id, mode, sender, message, created_at: at });

describe('chat conversations', () => {
  it('groups messages by conversation, newest first', () => {
    const list = groupConversations([
      row('1', 'chat-a', 'user', 'first question', '2026-01-01T10:00:00Z'),
      row('2', 'chat-a', 'assistant', 'answer', '2026-01-01T10:01:00Z'),
      row('3', 'chat-b', 'user', 'second chat', '2026-02-01T10:00:00Z'),
    ]);
    expect(list.map((c) => c.id)).toEqual(['chat-b', 'chat-a']);
    expect(list[1].count).toBe(2);
    expect(list[1].title).toBe('first question');
  });

  it('shows old unsorted history as one entry called Earlier messages', () => {
    const list = groupConversations([
      row('1', 'general', 'user', 'old one', '2025-01-01T10:00:00Z'),
      row('2', null, 'assistant', 'old reply', '2025-01-02T10:00:00Z'),
      row('3', undefined, 'user', 'old two', '2025-01-03T10:00:00Z'),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe('Earlier messages');
    expect(list[0].preview).toBe('old one');
    expect(list[0].count).toBe(3);
  });

  it('clips a long first question and returns nothing for no messages', () => {
    const long = 'x'.repeat(200);
    const list = groupConversations([row('1', 'chat-a', 'user', long, '2026-01-01T10:00:00Z')]);
    expect(list[0].title.length).toBeLessThanOrEqual(61);
    expect(groupConversations([])).toEqual([]);
  });

  it('creates different ids and treats a missing mode as the old history', () => {
    expect(newConversationId()).not.toBe(newConversationId());
    expect(conversationIdOf({})).toBe('general');
    expect(conversationIdOf({ mode: 'chat-z' })).toBe('chat-z');
  });
});