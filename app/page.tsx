"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { getAllScores, getLastName, setLastName, setStoredPlayerId } from "@/lib/local-scores";
import { ROUND_COUNTS, type RoundCount } from "@/lib/types";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState(() => getLastName());
  const [totalRounds, setTotalRounds] = useState<RoundCount>(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scores = useMemo(() => {
    return Object.entries(getAllScores())
      .map(([playerName, stats]) => ({ playerName, ...stats }))
      .sort((a, b) => b.totalRoundWins - a.totalRoundWins);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Enter a name first");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, totalRounds }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create game");
      setLastName(name.trim());
      setStoredPlayerId(data.game.id, data.playerId);
      router.push(`/game/${data.game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-6xl">🐸</div>
        <h1 className="text-4xl font-black tracking-tight">Schnapp</h1>
        <p className="max-w-xs text-zinc-500">
          Find the emoji before your opponent does!
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex w-full max-w-sm flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amelie"
            maxLength={30}
            className="rounded-xl border border-zinc-300 px-4 py-3 text-lg outline-none focus:border-zinc-900"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600">Rounds</span>
          <div className="grid grid-cols-4 gap-2">
            {ROUND_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setTotalRounds(count)}
                className={`rounded-xl py-3 text-lg font-semibold transition-colors ${
                  totalRounds === count
                    ? "bg-zinc-900 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-emerald-600 py-4 text-lg font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60"
        >
          {creating ? "Creating…" : "Create game"}
        </button>
      </form>

      {scores.length > 0 && (
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-600">
            High scores on this device
          </h2>
          <ul className="flex flex-col gap-2">
            {scores.map((s) => (
              <li key={s.playerName} className="flex flex-col text-sm">
                <span className="font-medium">{s.playerName}</span>
                <span className="text-zinc-500">
                  {s.totalRoundWins} round wins · {s.gamesWon}/{s.gamesPlayed} games won
                  {s.bestTimeMs !== null ? ` · best ${(s.bestTimeMs / 1000).toFixed(2)}s` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
