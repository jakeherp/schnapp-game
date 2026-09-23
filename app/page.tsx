"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LanguageSwitcher, useI18n } from "@/lib/i18n";
import type { LeaderboardEntry } from "@/lib/leaderboard";
import {
  getAllScores,
  getLastName,
  setLastName,
  setStoredPlayerId,
  type PlayerStats,
} from "@/lib/local-scores";
import { ROUND_COUNTS, type RoundCount } from "@/lib/types";

type ScoreRow = PlayerStats & { playerName: string };

export default function Home() {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [totalRounds, setTotalRounds] = useState<RoundCount>(10);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [globalScores, setGlobalScores] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    // Read once after mount — SSR has no localStorage, so this can't be an
    // initializer (the client's first render would then diverge from the
    // server-rendered HTML and React would flag a hydration mismatch).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(getLastName());
    const rows = Object.entries(getAllScores())
      .map(([playerName, stats]) => ({ playerName, ...stats }))
      .sort((a, b) => b.totalRoundsFound - a.totalRoundsFound);
    setScores(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/leaderboard")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setGlobalScores(data.entries ?? []);
      })
      .catch(() => {
        // Global board is a nice-to-have — silently skip on network failure.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError(t("enterNameFirst"));
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
      if (!res.ok) throw new Error(data.error ?? t("createError"));
      setLastName(name.trim());
      setStoredPlayerId(data.game.id, data.playerId);
      router.push(`/game/${data.game.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createError"));
      setCreating(false);
    }
  }

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center gap-10 px-6 py-16">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher />
      </div>

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="text-6xl">🐸</div>
        <h1 className="text-4xl font-black tracking-tight">Schnapp</h1>
        <p className="max-w-xs text-zinc-500 dark:text-zinc-400">{t("tagline")}</p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex w-full max-w-sm flex-col gap-5 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      >
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {t("yourNameLabel")}
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
            maxLength={30}
            className="rounded-xl border border-zinc-300 px-4 py-3 text-lg text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400"
          />
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {t("roundsLabel")}
          </span>
          <div className="grid grid-cols-4 gap-2">
            {ROUND_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setTotalRounds(count)}
                className={`rounded-xl py-3 text-lg font-semibold transition-colors ${
                  totalRounds === count
                    ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={creating}
          className="rounded-full bg-emerald-600 py-4 text-lg font-bold text-white transition-colors hover:bg-emerald-700 disabled:opacity-60 dark:bg-emerald-500 dark:hover:bg-emerald-400"
        >
          {creating ? t("creatingGame") : t("createGame")}
        </button>
      </form>

      {scores.length > 0 && (
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {t("highScoresTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {scores.map((s) => (
              <li key={s.playerName} className="flex flex-col text-sm">
                <span className="font-medium">{s.playerName}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {t("scoreStats", { found: s.totalRoundsFound, won: s.gamesWon, played: s.gamesPlayed })}
                  {s.bestAvgMs !== null
                    ? t("scoreBest", { time: (s.bestAvgMs / 1000).toFixed(2) })
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {globalScores.length > 0 && (
        <div className="w-full max-w-sm rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-600 dark:text-zinc-400">
            {t("globalHighScoresTitle")}
          </h2>
          <ul className="flex flex-col gap-2">
            {globalScores.map((s, i) => (
              <li key={s.name} className="flex items-center gap-3 text-sm">
                <span className="w-4 text-zinc-400 dark:text-zinc-500">{i + 1}</span>
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="text-zinc-500 dark:text-zinc-400">
                  {t("globalScoreStats", {
                    time: ((s.bestAvgMs ?? 0) / 1000).toFixed(2),
                    gamesWon: s.gamesWon,
                    gamesPlayed: s.gamesPlayed,
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
