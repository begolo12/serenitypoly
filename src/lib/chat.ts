export const QUICK_CHATS = [
  "Semangat, jangan bangkrut! 💪",
  "Sewanya mahal banget 😭",
  "Aku mau beli tanah itu 🏠",
  "Jangan gadai dulu! 🏦",
  "Hoki banget dadunya 🎲",
  "Awas, aku mau monopoli 😎",
  "Tunggu, aku hitung dulu 🧮",
  "GG, seru banget! 🏆",
] as const;

export type QuickChatText = (typeof QUICK_CHATS)[number];

export type ChatMessage = {
  id: string;
  playerId: string;
  name: string;
  text: string;
  at: number;
};

const QUICK_SET = new Set<string>(QUICK_CHATS);

export function isQuickChat(text: string): text is QuickChatText {
  return QUICK_SET.has(text);
}

export const CHAT_COOLDOWN_MS = 4000;
