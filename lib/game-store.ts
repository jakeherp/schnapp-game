import { generateGameEmojiGrid, pickRoundEmoji } from "./emojis";
import { generateId } from "./id";
import { getKv } from "./redis";
import type { Game, Player, RoundCount } from "./types";

const GAME_TTL_SECONDS = 6 * 60 * 60;
const ROUND_RESULT_PAUSE_MS = 2000;
const MAX_NAME_LENGTH = 30;

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
  game.rounds = [{ emoji: pickRoundEmoji(game.emojiGrid), startedAt: Date.now() }];
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

  if (round.winnerId) return game; // round already decided, ignore late taps

  if (emoji !== round.emoji) {
    throw new GameError("That wasn't the right emoji", 400);
  }

  round.winnerId = playerId;
  round.winnerTimeMs = Date.now() - round.startedAt;
  round.nextRoundAt = Date.now() + ROUND_RESULT_PAUSE_MS;
  await saveGame(game);
  return game;
}

// Self-healing round progression: any client's GET poll can advance the
// game past a decided round, so no background job/cron is needed. Reads
// and writes aren't transactional — with only a couple of casual players
// polling every ~800ms the risk of a double-advance race is negligible.
export async function getGameAndAdvance(id: string): Promise<Game> {
  const game = await requireGame(id);
  if (game.status !== "playing") return game;

  const round = game.rounds[game.currentRoundIndex];
  if (!round?.winnerId || !round.nextRoundAt || Date.now() < round.nextRoundAt) {
    return game;
  }

  if (game.currentRoundIndex + 1 >= game.totalRounds) {
    game.status = "finished";
  } else {
    game.currentRoundIndex += 1;
    game.rounds.push({
      emoji: pickRoundEmoji(game.emojiGrid, round.emoji),
      startedAt: Date.now(),
    });
  }
  await saveGame(game);
  return game;
}
