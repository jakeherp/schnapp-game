import { getKv } from "./redis";
import type { PlayerGameResult } from "./scoring";

const LEADERBOARD_KEY = "leaderboard:v1";

export type LeaderboardEntry = {
  name: string;
  gamesPlayed: number;
  gamesWon: number;
  // Best (lowest) average per-round time achieved in any single game.
  bestAvgMs: number | null;
  updatedAt: number;
};

type Board = Record<string, LeaderboardEntry>;

async function readBoard(): Promise<Board> {
  return (await getKv().get<Board>(LEADERBOARD_KEY)) ?? {};
}

// Best-effort: called once, server-side, right when a game finishes. Callers
// should swallow errors — a Redis hiccup here shouldn't stop a game from
// finishing for the players in it. Not transactional: two different players'
// games finishing at the exact same instant could race and one update could
// be lost, but for a small group of casual players that risk is negligible
// (same tradeoff already accepted for game-state writes in game-store.ts).
export async function recordGameForLeaderboard(results: PlayerGameResult[]): Promise<void> {
  const board = await readBoard();
  for (const r of results) {
    const prev = board[r.name];
    board[r.name] = {
      name: r.name,
      gamesPlayed: (prev?.gamesPlayed ?? 0) + 1,
      gamesWon: (prev?.gamesWon ?? 0) + (r.won ? 1 : 0),
      bestAvgMs:
        r.avgTimeMs === null
          ? (prev?.bestAvgMs ?? null)
          : prev?.bestAvgMs != null
            ? Math.min(prev.bestAvgMs, r.avgTimeMs)
            : r.avgTimeMs,
      updatedAt: Date.now(),
    };
  }
  await getKv().setForever(LEADERBOARD_KEY, board);
}

export async function getLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const board = await readBoard();
  return Object.values(board)
    .filter((e): e is LeaderboardEntry & { bestAvgMs: number } => e.bestAvgMs !== null)
    .sort((a, b) => a.bestAvgMs - b.bestAvgMs)
    .slice(0, limit);
}
