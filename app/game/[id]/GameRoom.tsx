"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { EMOJI_SET } from "@/lib/emojis";
import {
  getLastName,
  getStoredPlayerId,
  recordGameResult,
  setLastName,
  setStoredPlayerId,
} from "@/lib/local-scores";
import type { Game } from "@/lib/types";

const POLL_MS = 800;
const TICK_MS = 100;

export function GameRoom({ gameId }: { gameId: string }) {
  const [game, setGame] = useState<Game | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [wrongFlash, setWrongFlash] = useState<string | null>(null);
  const scoreRecordedRef = useRef(false);

  // Responses (polls and actions) can arrive out of order over a flaky
  // connection — only apply a payload if it's not older than what's shown.
  const applyGame = useCallback((incoming: Game) => {
    setGame((prev) => (prev && incoming.updatedAt < prev.updatedAt ? prev : incoming));
  }, []);

  useEffect(() => {
    // Read once after mount — SSR has no localStorage, so this can't be an initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlayerId(getStoredPlayerId(gameId));
  }, [gameId]);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/games/${gameId}`);
        if (cancelled) return;
        if (res.status === 404) {
          setNotFound(true);
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          applyGame(data.game);
          // Resync the timer to the fetch time — otherwise, if a round started
          // while this device was elsewhere (e.g. still in the lobby), `now`
          // stays stale until the next tick and the elapsed time renders negative.
          setNow(Date.now());
        }
      } catch {
        // transient network error — next poll will retry
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [gameId, applyGame]);

  useEffect(() => {
    const currentRound = game?.rounds[game.currentRoundIndex];
    if (game?.status !== "playing" || currentRound?.winnerId) return;
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [game]);

  const me = game?.players.find((p) => p.id === playerId);

  useEffect(() => {
    if (!game || game.status !== "finished" || !me || scoreRecordedRef.current) return;
    scoreRecordedRef.current = true;

    const wins = game.players.map((p) => ({
      id: p.id,
      wins: game.rounds.filter((r) => r.winnerId === p.id).length,
    }));
    const maxWins = Math.max(0, ...wins.map((w) => w.wins));
    const myWins = wins.find((w) => w.id === me.id)?.wins ?? 0;
    const myTimes = game.rounds
      .filter((r) => r.winnerId === me.id && r.winnerTimeMs !== undefined)
      .map((r) => r.winnerTimeMs as number);
    const bestTimeMs = myTimes.length > 0 ? Math.min(...myTimes) : null;

    recordGameResult(me.name, myWins, myWins === maxWins && maxWins > 0, bestTimeMs);
  }, [game, me]);

  const handleJoin = useCallback(
    async (name: string) => {
      const res = await fetch(`/api/games/${gameId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, playerId: playerId ?? undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not join");
      setLastName(name.trim());
      setStoredPlayerId(gameId, data.playerId);
      setPlayerId(data.playerId);
      applyGame(data.game);
    },
    [gameId, playerId, applyGame]
  );

  const handleStart = useCallback(async () => {
    const res = await fetch(`/api/games/${gameId}/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    const data = await res.json();
    if (res.ok) applyGame(data.game);
  }, [gameId, playerId, applyGame]);

  const handleAnswer = useCallback(
    async (emoji: string) => {
      const res = await fetch(`/api/games/${gameId}/answer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, emoji }),
      });
      const data = await res.json();
      if (res.ok) {
        applyGame(data.game);
      } else {
        setWrongFlash(emoji);
        setTimeout(() => setWrongFlash(null), 250);
      }
    },
    [gameId, playerId, applyGame]
  );

  if (notFound) {
    return (
      <Centered>
        <p className="text-lg text-zinc-600">This game doesn&apos;t exist (or expired).</p>
        <Link href="/" className="text-emerald-600 underline">
          Start a new game
        </Link>
      </Centered>
    );
  }

  if (!game) {
    return (
      <Centered>
        <p className="text-zinc-500">Loading…</p>
      </Centered>
    );
  }

  if (!me) {
    return <JoinForm onJoin={handleJoin} />;
  }

  if (game.status === "lobby") {
    return (
      <Lobby game={game} isHost={game.hostId === me.id} onStart={handleStart} />
    );
  }

  if (game.status === "playing") {
    const round = game.rounds[game.currentRoundIndex];
    const elapsedMs = round.winnerId
      ? (round.winnerTimeMs ?? 0)
      : Math.max(0, now - round.startedAt);
    const winner = round.winnerId
      ? game.players.find((p) => p.id === round.winnerId)
      : null;

    return (
      <PlayingView
        game={game}
        meId={me.id}
        round={round}
        elapsedMs={elapsedMs}
        winnerName={winner?.name ?? null}
        wrongFlash={wrongFlash}
        onAnswer={handleAnswer}
      />
    );
  }

  return <FinishedView game={game} meId={me.id} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      {children}
    </div>
  );
}

function JoinForm({ onJoin }: { onJoin: (name: string) => Promise<void> }) {
  const [name, setName] = useState(() => getLastName());
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a name first");
      return;
    }
    setJoining(true);
    setError(null);
    try {
      await onJoin(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not join");
      setJoining(false);
    }
  }

  return (
    <Centered>
      <div className="text-5xl">🙌</div>
      <h1 className="text-2xl font-bold">Join the game</h1>
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={30}
          autoFocus
          className="rounded-xl border border-zinc-300 px-4 py-3 text-lg outline-none focus:border-zinc-900"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={joining}
          className="rounded-full bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {joining ? "Joining…" : "Join game"}
        </button>
      </form>
    </Centered>
  );
}

function Lobby({
  game,
  isHost,
  onStart,
}: {
  game: Game;
  isHost: boolean;
  onStart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [link, setLink] = useState("");

  useEffect(() => {
    // Read once after mount — SSR has no window, so this can't be an initializer.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLink(window.location.href);
  }, []);

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join my Schnapp game!", url: link });
        return;
      } catch {
        // user cancelled share sheet — fall through to copy
      }
    }
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Centered>
      <h1 className="text-2xl font-bold">Waiting to start</h1>
      <p className="text-zinc-500">{game.totalRounds} rounds</p>

      <button
        onClick={share}
        className="w-full max-w-sm rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600 hover:border-zinc-900"
      >
        {copied ? "Link copied!" : link || "Share link"}
      </button>

      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-zinc-600">Players</h2>
        <ul className="flex flex-col gap-2">
          {game.players.map((p) => (
            <li key={p.id} className="flex items-center gap-2 text-lg">
              <span>👤</span>
              <span className="font-medium">{p.name}</span>
              {p.id === game.hostId && (
                <span className="text-xs text-zinc-400">host</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isHost ? (
        <button
          onClick={onStart}
          className="w-full max-w-sm rounded-full bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-700"
        >
          Start game
        </button>
      ) : (
        <p className="text-zinc-500">Waiting for the host to start…</p>
      )}
    </Centered>
  );
}

function PlayingView({
  game,
  meId,
  round,
  elapsedMs,
  winnerName,
  wrongFlash,
  onAnswer,
}: {
  game: Game;
  meId: string;
  round: Game["rounds"][number];
  elapsedMs: number;
  winnerName: string | null;
  wrongFlash: string | null;
  onAnswer: (emoji: string) => void;
}) {
  const isMyWin = round.winnerId === meId;

  return (
    <div className="flex flex-1 flex-col items-center gap-6 px-4 py-8">
      <div className="text-sm text-zinc-400">
        Round {game.currentRoundIndex + 1} / {game.totalRounds}
      </div>

      <div className="text-4xl font-mono font-bold tabular-nums">
        {(elapsedMs / 1000).toFixed(1)}s
      </div>

      <div className="text-9xl leading-none">{round.emoji}</div>

      {winnerName && (
        <div
          className={`rounded-full px-5 py-2 text-lg font-bold ${
            isMyWin ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-700"
          }`}
        >
          {isMyWin ? "You won this round! 🎉" : `${winnerName} was faster!`}
        </div>
      )}

      <div className="mt-auto grid w-full max-w-2xl grid-cols-6 gap-2 sm:grid-cols-8">
        {EMOJI_SET.map((emoji) => (
          <button
            key={emoji}
            disabled={!!round.winnerId}
            onClick={() => onAnswer(emoji)}
            className={`aspect-square rounded-2xl text-3xl transition-transform active:scale-90 disabled:opacity-40 ${
              wrongFlash === emoji ? "bg-red-200" : "bg-white border border-zinc-200"
            }`}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

function FinishedView({ game, meId }: { game: Game; meId: string }) {
  const scores = game.players
    .map((p) => ({
      ...p,
      wins: game.rounds.filter((r) => r.winnerId === p.id).length,
    }))
    .sort((a, b) => b.wins - a.wins);
  const topWins = scores[0]?.wins ?? 0;

  return (
    <Centered>
      <div className="text-5xl">🏆</div>
      <h1 className="text-2xl font-bold">Game over!</h1>

      <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
        <ul className="flex flex-col gap-3">
          {scores.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span className={`text-lg ${p.id === meId ? "font-bold" : "font-medium"}`}>
                {p.name}
                {p.wins === topWins && topWins > 0 ? " 👑" : ""}
              </span>
              <span className="text-zinc-500">{p.wins} rounds</span>
            </li>
          ))}
        </ul>
      </div>

      <Link
        href="/"
        className="w-full max-w-sm rounded-full bg-emerald-600 py-4 text-center text-lg font-bold text-white hover:bg-emerald-700"
      >
        Play again
      </Link>
    </Centered>
  );
}
