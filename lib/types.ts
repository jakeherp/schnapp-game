export type Player = {
  id: string;
  name: string;
  joinedAt: number;
};

// A round is "complete" once every player in the game has an entry here
// with `completedAt` set — either they found the target, or they ran out
// of guesses (or the round timed out) and it counts as missed for them.
export type PlayerRoundResult = {
  wrongEmojis: string[]; // distinct wrong taps this round, in order
  outcome?: "found" | "missed";
  completedAt?: number;
  timeMs?: number; // elapsed time, penalty-inclusive when missed
};

export type Round = {
  emoji: string;
  startedAt: number;
  results: Record<string, PlayerRoundResult>; // keyed by player id
  nextRoundAt?: number; // set once every player has completed
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
