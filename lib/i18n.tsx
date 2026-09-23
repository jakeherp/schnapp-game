"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export type Locale = "en" | "de" | "es";

export const LOCALES: Locale[] = ["en", "de", "es"];

const STORAGE_KEY = "schnapp:locale";

type Dict = Record<string, string>;

const en: Dict = {
  tagline: "Find the emoji before your opponent does!",
  yourNameLabel: "Your name",
  namePlaceholder: "e.g. Amelie",
  roundsLabel: "Rounds",
  enterNameFirst: "Enter a name first",
  createGame: "Create game",
  creatingGame: "Creating…",
  createError: "Something went wrong",
  highScoresTitle: "High scores on this device",
  scoreStats: "{found} found · {won}/{played} games won",
  scoreBest: " · best avg {time}s",
  avgTimeSuffix: " · avg {time}s",
  globalHighScoresTitle: "Global high scores",
  globalScoreStats: "avg {time}s · {gamesWon}/{gamesPlayed} games won",
  gameNotFound: "This game doesn't exist (or expired).",
  startNewGame: "Start a new game",
  loading: "Loading…",
  joinTitle: "Join the game",
  namePlaceholderJoin: "Your name",
  joinGame: "Join game",
  joiningGame: "Joining…",
  joinError: "Could not join",
  waitingToStart: "Waiting to start",
  roundsCount: "{count} rounds",
  linkCopied: "Link copied!",
  shareLink: "Share link",
  shareTitle: "Join my Schnapp game!",
  playersHeading: "Players",
  hostLabel: "host",
  startGameButton: "Start game",
  waitingForHost: "Waiting for the host to start…",
  roundOf: "Round {current} / {total}",
  foundIt: "Found it in {time}s!",
  roundMissed: "Missed it — round lost",
  waitingForOthers: "Waiting for other players to finish…",
  gameOver: "Game over!",
  roundSummary: "{found} found · {missed} missed",
  playAgain: "Play again",
  rematchTitle: "Rematch!",
  rematchStartingIn: "Starting in {seconds}…",
};

const de: Dict = {
  tagline: "Finde das Emoji, vor deinem Gegner!",
  yourNameLabel: "Dein Name",
  namePlaceholder: "z. B. Amelie",
  roundsLabel: "Runden",
  enterNameFirst: "Bitte zuerst einen Namen eingeben",
  createGame: "Spiel erstellen",
  creatingGame: "Wird erstellt…",
  createError: "Spiel konnte nicht erstellt werden",
  highScoresTitle: "Bestenliste auf diesem Gerät",
  scoreStats: "{found} gefunden · {won}/{played} Spiele gewonnen",
  scoreBest: " · beste Ø-Zeit {time}s",
  avgTimeSuffix: " · Ø {time}s",
  globalHighScoresTitle: "Weltweite Bestenliste",
  globalScoreStats: "Ø {time}s · {gamesWon}/{gamesPlayed} Spiele gewonnen",
  gameNotFound: "Dieses Spiel gibt es nicht (oder ist abgelaufen).",
  startNewGame: "Neues Spiel starten",
  loading: "Wird geladen…",
  joinTitle: "Spiel beitreten",
  namePlaceholderJoin: "Dein Name",
  joinGame: "Beitreten",
  joiningGame: "Tritt bei…",
  joinError: "Beitritt nicht möglich",
  waitingToStart: "Warten auf Start",
  roundsCount: "{count} Runden",
  linkCopied: "Link kopiert!",
  shareLink: "Link teilen",
  shareTitle: "Spiel mit mir Schnapp!",
  playersHeading: "Spieler",
  hostLabel: "Gastgeber",
  startGameButton: "Spiel starten",
  waitingForHost: "Warten, bis der Gastgeber startet…",
  roundOf: "Runde {current} / {total}",
  foundIt: "Gefunden in {time}s!",
  roundMissed: "Verpasst — Runde verloren",
  waitingForOthers: "Warten auf die anderen Spieler…",
  gameOver: "Spiel vorbei!",
  roundSummary: "{found} gefunden · {missed} verpasst",
  playAgain: "Nochmal spielen",
  rematchTitle: "Revanche!",
  rematchStartingIn: "Start in {seconds}…",
};

const es: Dict = {
  tagline: "¡Encuentra el emoji antes que tu rival!",
  yourNameLabel: "Tu nombre",
  namePlaceholder: "p. ej. Amelie",
  roundsLabel: "Rondas",
  enterNameFirst: "Primero escribe un nombre",
  createGame: "Crear partida",
  creatingGame: "Creando…",
  createError: "No se pudo crear la partida",
  highScoresTitle: "Puntuaciones en este dispositivo",
  scoreStats: "{found} encontrados · {won}/{played} partidas ganadas",
  scoreBest: " · mejor media {time}s",
  avgTimeSuffix: " · media {time}s",
  globalHighScoresTitle: "Clasificación global",
  globalScoreStats: "media {time}s · {gamesWon}/{gamesPlayed} partidas ganadas",
  gameNotFound: "Esta partida no existe (o ha caducado).",
  startNewGame: "Crear una nueva partida",
  loading: "Cargando…",
  joinTitle: "Unirse a la partida",
  namePlaceholderJoin: "Tu nombre",
  joinGame: "Unirse",
  joiningGame: "Uniendo…",
  joinError: "No se pudo unir",
  waitingToStart: "Esperando para empezar",
  roundsCount: "{count} rondas",
  linkCopied: "¡Enlace copiado!",
  shareLink: "Compartir enlace",
  shareTitle: "¡Juega Schnapp conmigo!",
  playersHeading: "Jugadores",
  hostLabel: "anfitrión",
  startGameButton: "Empezar partida",
  waitingForHost: "Esperando a que el anfitrión empiece…",
  roundOf: "Ronda {current} / {total}",
  foundIt: "¡Encontrado en {time}s!",
  roundMissed: "Fallado — ronda perdida",
  waitingForOthers: "Esperando a los demás jugadores…",
  gameOver: "¡Partida terminada!",
  roundSummary: "{found} encontrados · {missed} fallados",
  playAgain: "Jugar de nuevo",
  rematchTitle: "¡Revancha!",
  rematchStartingIn: "Empieza en {seconds}…",
};

const dictionaries: Record<Locale, Dict> = { en, de, es };

function detectLocale(): Locale {
  if (typeof navigator === "undefined") return "en";
  const candidates = navigator.languages?.length
    ? navigator.languages
    : [navigator.language];
  for (const lang of candidates) {
    const base = lang.slice(0, 2).toLowerCase();
    if ((LOCALES as string[]).includes(base)) return base as Locale;
  }
  return "en";
}

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    // Read once after mount — SSR has no navigator/localStorage, so this can't be an initializer.
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    const initial =
      stored && (LOCALES as string[]).includes(stored)
        ? (stored as Locale)
        : detectLocale();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocaleState(initial);
  }, []);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key;
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name) =>
        String(vars[name] ?? ""),
      );
    },
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within a LocaleProvider");
  return ctx;
}

const LOCALE_LABELS: Record<Locale, string> = { en: "EN", de: "DE", es: "ES" };

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();
  return (
    <div className="flex gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLocale(l)}
          aria-pressed={locale === l}
          className={`rounded-full px-2.5 py-1 text-xs font-semibold transition-colors ${
            locale === l
              ? "bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900"
              : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
          }`}
        >
          {LOCALE_LABELS[l]}
        </button>
      ))}
    </div>
  );
}
