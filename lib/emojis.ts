// Large kid-friendly pool. Each game draws a random subset from this at
// creation time (see generateGameEmojiGrid) — the master list itself is
// never shown directly.
export const MASTER_EMOJI_SET = [
  "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼",
  "🐨", "🐯", "🦁", "🐮", "🐷", "🐸", "🐵", "🙈",
  "🐔", "🐧", "🐦", "🦆", "🦉", "🐺", "🐗", "🐴",
  "🦄", "🐝", "🐛", "🦋", "🐌", "🐞", "🐢", "🐍",
  "🐙", "🦀", "🐠", "🐬", "🐳", "🦈", "🐘", "🦒",
  "🦓", "🦘", "🐿️", "🦔", "🍎", "🍌", "🍇", "🍓",
  "🍒", "🍑", "🍍", "🥝", "🍉", "🍕", "🍔", "🌭",
  "🍟", "🍦", "🍩", "🍪", "🎂", "🍭", "🍫", "🥕",
  "⚽", "🏀", "🏈", "🎾", "🎱", "🏓", "🚗", "🚕",
  "🚌", "🚓", "🚒", "🚀", "✈️", "🚁", "🚲", "⛵",
  "🌈", "⭐", "🌙", "☀️", "☁️", "⚡", "❄️", "🔥",
  "🎈", "🎁", "🎉", "🎨", "🧸", "❤️", "💙", "💚",
] as const;

export const GRID_SIZE = 32;

function shuffled<T>(items: readonly T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Drawn once per game (not per round) so the grid stays the same puzzle for
// both players to search all game long, but differs between games.
export function generateGameEmojiGrid(): string[] {
  return shuffled(MASTER_EMOJI_SET).slice(0, GRID_SIZE);
}

// GRID_SIZE (32) is always >= the largest round count (20), so there's
// always at least one unused emoji left to draw for the next round.
export function pickRoundEmoji(grid: readonly string[], used: readonly string[] = []): string {
  const usedSet = new Set(used);
  const candidates = grid.filter((e) => !usedSet.has(e));
  return candidates[Math.floor(Math.random() * candidates.length)];
}
