import { generateGameEmojiGrid, pickRoundEmoji } from "./emojis";
import { generateId } from "./id";
import { recordGameForLeaderboard } from "./leaderboard";
import { getKv } from "./redis";
import { computeGameResults } from "./scoring";
import type { Game, Player, Round, RoundCount } from "./types";

const GAME_TTL_SECONDS = 6 * 60 * 60;
const ROUND_RESULT_PAUSE_MS = 2000;
const REMATCH_COUNTDOWN_MS = 3000;
const MAX_NAME_LENGTH = 30;
const MAX_WRONG_TAPS = 2; // a 2nd wrong tap loses the round
const MISS_PENALTY_MS = 3000; // added on top of elapsed time when a round is missed
const ROUND_TIMEOUT_MS = 20_000; // so one AFK/slow player can't freeze the game forever

export class GameError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function gameKey(id: string): string {
  return `game:${id.toUpperCase()}`;
}

async function saveGame(game: Game): Promise<void> {
  // Lets clients discard out-of-order responses (a slow poll resolving after
  // a faster action call) instead of clobbering newer state with stale data.
  game.updatedAt = Date.now();
  await getKv().set(gameKey(game.id), game, GAME_TTL_SECONDS);
}

async function requireGame(id: string): Promise<Game> {
  const game = await getKv().get<Game>(gameKey(id));
  if (!game) throw new GameError("Game not found", 404);
  return game;
}

function cleanName(name: string): string {
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (!trimmed) throw new GameError("Name is required", 400);
  return trimmed;
}

function newRound(emojiGrid: string[], usedEmojis: string[]): Round {
  return {
    emoji: pickRoundEmoji(emojiGrid, usedEmojis),
    startedAt: Date.now(),
    results: {},
  };
}

function isRoundComplete(round: Round, players: Player[]): boolean {
  return players.every((p) => round.results[p.id]?.completedAt !== undefined);
}

// A player who never taps a 2nd wrong answer and never finds the target
// (AFK, distracted, closed the tab) would otherwise stall the round for
// everyone else forever — force them to a "missed" outcome once the round
// has been live too long.
function timeoutStragglers(round: Round, players: Player[]): boolean {
  if (Date.now() - round.startedAt < ROUND_TIMEOUT_MS) return false;
  let changed = false;
  for (const p of players) {
    if (round.results[p.id]?.completedAt !== undefined) continue;
    round.results[p.id] = {
      wrongEmojis: round.results[p.id]?.wrongEmojis ?? [],
      outcome: "missed",
      completedAt: Date.now(),
      timeMs: ROUND_TIMEOUT_MS + MISS_PENALTY_MS,
    };
    changed = true;
  }
  return changed;
}

export async function createGame(
  name: string,
  totalRounds: RoundCount
): Promise<{ game: Game; playerId: string }> {
  const host: Player = {
    id: generateId(12),
    name: cleanName(name),
    joinedAt: Date.now(),
  };
  const game: Game = {
    id: generateId(6),
    hostId: host.id,
    totalRounds,
    status: "lobby",
    players: [host],
    emojiGrid: generateGameEmojiGrid(),
    rounds: [],
    currentRoundIndex: -1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await saveGame(game);
  return { game, playerId: host.id };
}

export async function getGame(id: string): Promise<Game> {
  return requireGame(id);
}

export async function joinGame(
  id: string,
  name: string,
  existingPlayerId?: string
): Promise<{ game: Game; playerId: string }> {
  const game = await requireGame(id);

  if (existingPlayerId) {
    const existing = game.players.find((p) => p.id === existingPlayerId);
    if (existing) return { game, playerId: existing.id };
  }

  if (game.status !== "lobby") {
    throw new GameError("This game has already started", 400);
  }

  const player: Player = {
    id: generateId(12),
    name: cleanName(name),
    joinedAt: Date.now(),
  };
  game.players.push(player);
  await saveGame(game);
  return { game, playerId: player.id };
}

export async function startGame(id: string, playerId: string): Promise<Game> {
  const game = await requireGame(id);
  if (game.hostId !== playerId) {
    throw new GameError("Only the host can start the game", 403);
  }
  if (game.status !== "lobby") {
    throw new GameError("This game has already started", 400);
  }

  game.status = "playing";
  game.currentRoundIndex = 0;
  game.rounds = [newRound(game.emojiGrid, [])];
  await saveGame(game);
  return game;
}

export async function submitAnswer(
  id: string,
  playerId: string,
  emoji: string
): Promise<Game> {
  const game = await requireGame(id);
  if (game.status !== "playing") {
    throw new GameError("Game is not active", 400);
  }
  const round = game.rounds[game.currentRoundIndex];
  if (!round) throw new GameError("No active round", 400);

  const player = game.players.find((p) => p.id === playerId);
  if (!player) throw new GameError("You're not in this game", 403);

  const existing = round.results[playerId];
  if (existing?.completedAt !== undefined) return game; // already done this round, ignore late taps

  const wrongEmojis = existing?.wrongEmojis ?? [];

  if (emoji === round.emoji) {
    round.results[playerId] = {
      wrongEmojis,
      outcome: "found",
      completedAt: Date.now(),
      timeMs: Date.now() - round.startedAt,
    };
  } else {
    if (!wrongEmojis.includes(emoji)) wrongEmojis.push(emoji);
    if (wrongEmojis.length >= MAX_WRONG_TAPS) {
      round.results[playerId] = {
        wrongEmojis,
        outcome: "missed",
        completedAt: Date.now(),
        timeMs: Date.now() - round.startedAt + MISS_PENALTY_MS,
      };
    } else {
      round.results[playerId] = { wrongEmojis };
    }
  }

  if (isRoundComplete(round, game.players)) {
    round.nextRoundAt = Date.now() + ROUND_RESULT_PAUSE_MS;
  }

  await saveGame(game);
  return game;
}

// Any player (not just the host) can call for a rematch — resets the same
// game in place, keeping the players and shareable link, instead of making
// everyone rejoin a brand new game.
export async function requestRematch(id: string, playerId: string): Promise<Game> {
  const game = await requireGame(id);
  if (game.status !== "finished") {
    throw new GameError("Game is not finished yet", 400);
  }
  if (!game.players.some((p) => p.id === playerId)) {
    throw new GameError("You're not in this game", 403);
  }

  game.status = "countdown";
  game.emojiGrid = generateGameEmojiGrid();
  game.rounds = [];
  game.currentRoundIndex = -1;
  game.rematchStartsAt = Date.now() + REMATCH_COUNTDOWN_MS;
  await saveGame(game);
  return game;
}

// Self-healing progression: any client's GET poll can advance the game past
// a completed round, a stalled round (timeout), or an elapsed rematch
// countdown, so no background job/cron is needed. Reads and writes aren't
// transactional — with only a couple of casual players polling every
// ~800ms the risk of a double-advance race is negligible.
export async function getGameAndAdvance(id: string): Promise<Game> {
  const game = await requireGame(id);

  if (game.status === "countdown") {
    if (game.rematchStartsAt && Date.now() >= game.rematchStartsAt) {
      game.status = "playing";
      game.currentRoundIndex = 0;
      game.rounds = [newRound(game.emojiGrid, [])];
      await saveGame(game);
    }
    return game;
  }

  if (game.status !== "playing") return game;

  const round = game.rounds[game.currentRoundIndex];
  if (!round) return game;

  if (!round.nextRoundAt) {
    if (!timeoutStragglers(round, game.players)) return game;
    round.nextRoundAt = Date.now() + ROUND_RESULT_PAUSE_MS;
    await saveGame(game);
    return game;
  }

  if (Date.now() < round.nextRoundAt) return game;

  if (game.currentRoundIndex + 1 >= game.totalRounds) {
    game.status = "finished";
    // This branch only runs once per game (the moment it transitions into
    // "finished"), so this never double-submits. Awaited (not fire-and-forget)
    // since a serverless function can be frozen right after the response is
    // sent — but a leaderboard hiccup still shouldn't stop the game from
    // finishing for the players, so failures here are swallowed.
    try {
      await recordGameForLeaderboard(computeGameResults(game));
    } catch {
      // best-effort
    }
  } else {
    game.currentRoundIndex += 1;
    game.rounds.push(
      newRound(
        game.emojiGrid,
        game.rounds.map((r) => r.emoji)
      )
    );
  }
  await saveGame(game);
  return game;
}
