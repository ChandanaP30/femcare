import { describe, it, expect } from 'vitest';
import { CHAT_LABELS, chatText } from './chat-labels';

describe('chat labels', () => {
  it('has every label in Hindi and Kannada, different from the English text', () => {
    for (const key of Object.keys(CHAT_LABELS.en)) {
      for (const lang of ['hi', 'kn']) {
        expect(CHAT_LABELS[lang][key], `${lang}.${key}`).toBeTruthy();
        expect(CHAT_LABELS[lang][key], `${lang}.${key}`).not.toBe(CHAT_LABELS.en[key]);
      }
    }
  });

  it('returns the label for the language and falls back to English', () => {
    expect(chatText('en', 'newChat')).toBe('New chat');
    expect(chatText('hi', 'newChat')).toBe(CHAT_LABELS.hi.newChat);
    expect(chatText('xx', 'newChat')).toBe('New chat');
  });

  it('keeps the emergency number in the disclaimer in every language', () => {
    for (const lang of ['en', 'hi', 'kn']) expect(chatText(lang, 'disclaimer')).toContain('112');
  });
});