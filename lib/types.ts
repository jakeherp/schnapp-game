export type Player = {
  id: string;
  name: string;
  joinedAt: number;
};

export type Round = {
  emoji: string;
  startedAt: number;
  winnerId?: string;
  winnerTimeMs?: number;
  nextRoundAt?: number;
};

export type GameStatus = "lobby" | "playing" | "countdown" | "finished";

export type RoundCount = 5 | 10 | 15 | 20;

export const ROUND_COUNTS: RoundCount[] = [5, 10, 15, 20];

export type Game = {
  id: string;
  hostId: string;
  totalRounds: RoundCount;
  status: GameStatus;
  players: Player[];
  emojiGrid: string[];
  rounds: Round[];
  currentRoundIndex: number;
  rematchStartsAt?: number;
  createdAt: number;
  updatedAt: number;
};
