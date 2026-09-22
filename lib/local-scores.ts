"use client";

const LAST_NAME_KEY = "schnapp:lastName";
const SCORES_KEY = "schnapp:scores";

export type PlayerStats = {
  gamesPlayed: number;
  gamesWon: number;
  totalRoundWins: number;
  bestTimeMs: number | null;
  updatedAt: number;
};

type ScoreBoard = Record<string, PlayerStats>;

function readScores(): ScoreBoard {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(SCORES_KEY);
    return raw ? (JSON.parse(raw) as ScoreBoard) : {};
  } catch {
    return {};
  }
}

function writeScores(scores: ScoreBoard): void {
  try {
    window.localStorage.setItem(SCORES_KEY, JSON.stringify(scores));
  } catch {
    // localStorage unavailable (private mode, etc.) — silently skip persistence.
  }
}

export function getLastName(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(LAST_NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setLastName(name: string): void {
  try {
    window.localStorage.setItem(LAST_NAME_KEY, name);
  } catch {
    // ignore
  }
}

export function getAllScores(): ScoreBoard {
  return readScores();
}

export function recordGameResult(
  name: string,
  roundWins: number,
  won: boolean,
  bestTimeMs: number | null
): void {
  const scores = readScores();
  const prev = scores[name];
  scores[name] = {
    gamesPlayed: (prev?.gamesPlayed ?? 0) + 1,
    gamesWon: (prev?.gamesWon ?? 0) + (won ? 1 : 0),
    totalRoundWins: (prev?.totalRoundWins ?? 0) + roundWins,
    bestTimeMs:
      bestTimeMs === null
        ? (prev?.bestTimeMs ?? null)
        : prev?.bestTimeMs !== null && prev?.bestTimeMs !== undefined
          ? Math.min(prev.bestTimeMs, bestTimeMs)
          : bestTimeMs,
    updatedAt: Date.now(),
  };
  writeScores(scores);
}

function storageKeyForGamePlayer(gameId: string): string {
  return `schnapp:game:${gameId}:playerId`;
}

export function getStoredPlayerId(gameId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(storageKeyForGamePlayer(gameId));
  } catch {
    return null;
  }
}

export function setStoredPlayerId(gameId: string, playerId: string): void {
  try {
    window.localStorage.setItem(storageKeyForGamePlayer(gameId), playerId);
  } catch {
    // ignore
  }
}
