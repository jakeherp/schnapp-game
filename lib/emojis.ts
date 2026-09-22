// Fixed order: every player sees the same grid, so finding the target is a fair visual search.
export const EMOJI_SET = [
  "🐶", "🐱", "🐭", "🐰", "🦊", "🐻", "🐼", "🐸",
  "🐵", "🦁", "🐷", "🐮", "🐔", "🐧", "🐦", "🐝",
  "🦋", "🐢", "🐙", "🦀", "🐳", "🍎", "🍌", "🍓",
  "🍕", "🍦", "⚽", "🚗", "🚀", "🌈", "⭐", "❤️",
] as const;

export type Emoji = (typeof EMOJI_SET)[number];

export function pickRoundEmoji(previous?: string): string {
  const candidates = EMOJI_SET.filter((e) => e !== previous);
  return candidates[Math.floor(Math.random() * candidates.length)];
}
