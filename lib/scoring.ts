import type { Game } from "./types";

export type PlayerGameResult = {
  playerId: string;
  name: string;
  roundsFound: number;
  roundsMissed: number;
  won: boolean;
  // Average time across every round this player completed (found or
  // missed — misses include their time penalty). null if they haven't
  // completed any rounds yet.
  avgTimeMs: number | null;
};

// Shared by the server (to update the global leaderboard) and the client
// (to update this device's local stats), so both agree on exactly what a
// game's "score" means.
export function computeGameResults(game: Game): PlayerGameResult[] {
  const perPlayer = game.players.map((player) => {
    let roundsFound = 0;
    let roundsMissed = 0;
    const times: number[] = [];

    for (const round of game.rounds) {
      const result = round.results[player.id];
      if (!result || result.completedAt === undefined || result.timeMs === undefined) continue;
      times.push(result.timeMs);
      if (result.outcome === "found") roundsFound++;
      else roundsMissed++;
    }

    const avgTimeMs = times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : null;
    return { playerId: player.id, name: player.name, roundsFound, roundsMissed, avgTimeMs };
  });

  const avgs = perPlayer.map((p) => p.avgTimeMs).filter((t): t is number => t !== null);
  const bestAvg = avgs.length > 0 ? Math.min(...avgs) : null;

  return perPlayer.map((p) => ({
    ...p,
    won: p.avgTimeMs !== null && bestAvg !== null && p.avgTimeMs === bestAvg,
  }));
}
