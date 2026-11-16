"use client";

/*
 * Shared pieces that make the boards feel like games: synthesized sound
 * effects with a remembered mute switch, a confetti burst, the player bar
 * with a live turn indicator, and a running series record per game type.
 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isGameFinished } from "@/shared/games";
import type {
  FourState,
  Game,
  RpsState,
  SpaceSnapshot,
  TicState,
} from "@/shared/types";

/* ---------------------------------------------------------------- sound */

export type Sound =
  | "tap"
  | "drop"
  | "place"
  | "turn"
  | "win"
  | "lose"
  | "draw"
  | "reveal"
  | "wrong"
  | "lock";

const SOUND_KEY = "twospace-game-sound";
const soundListeners = new Set<() => void>();
let sessionSoundOn: boolean | undefined;
function readSoundOn() {
  if (sessionSoundOn !== undefined) return sessionSoundOn;
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}
function subscribeSound(listener: () => void) {
  soundListeners.add(listener);
  return () => soundListeners.delete(listener);
}
export function setSoundOn(on: boolean) {
  sessionSoundOn = on;
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "on" : "off");
  } catch {
    /* Storage can be unavailable in private modes; keep the session value. */
  }
  soundListeners.forEach((listener) => listener());
}
export function useSoundOn() {
  return useSyncExternalStore(subscribeSound, readSoundOn, () => false);
}

let audio: AudioContext | null = null;
function context() {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  audio ??= new Ctor();
  if (audio.state === "suspended") void audio.resume().catch(() => {});
  return audio;
}

function tone(
  ctx: AudioContext,
  {
    freq,
    to,
    at = 0,
    length = 0.12,
    type = "sine",
    gain = 0.16,
  }: {
    freq: number;
    to?: number;
    at?: number;
    length?: number;
    type?: OscillatorType;
    gain?: number;
  },
) {
  const start = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, start + length);
  amp.gain.setValueAtTime(0.0001, start);
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, start + length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + length + 0.02);
}

export function playSound(sound: Sound) {
  if (typeof window === "undefined" || !readSoundOn()) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) return;
  try {
    const ctx = context();
    if (!ctx) return;
    switch (sound) {
      case "tap":
        tone(ctx, { freq: 720, length: 0.06, type: "triangle", gain: 0.08 });
        break;
      case "lock":
        tone(ctx, { freq: 520, length: 0.07, type: "square", gain: 0.05 });
        tone(ctx, {
          freq: 780,
          at: 0.06,
          length: 0.09,
          type: "square",
          gain: 0.05,
        });
        break;
      case "place":
        tone(ctx, {
          freq: 880,
          to: 440,
          length: 0.12,
          type: "triangle",
          gain: 0.12,
        });
        break;
      case "drop":
        tone(ctx, {
          freq: 900,
          to: 220,
          length: 0.28,
          type: "sine",
          gain: 0.1,
        });
        tone(ctx, {
          freq: 120,
          at: 0.3,
          length: 0.12,
          type: "triangle",
          gain: 0.22,
        });
        break;
      case "turn":
        tone(ctx, { freq: 660, length: 0.12, type: "sine", gain: 0.12 });
        tone(ctx, {
          freq: 990,
          at: 0.11,
          length: 0.18,
          type: "sine",
          gain: 0.12,
        });
        break;
      case "reveal":
        tone(ctx, {
          freq: 200,
          to: 1200,
          length: 0.22,
          type: "sawtooth",
          gain: 0.04,
        });
        break;
      case "wrong":
        tone(ctx, { freq: 180, length: 0.14, type: "square", gain: 0.05 });
        tone(ctx, {
          freq: 140,
          at: 0.13,
          length: 0.2,
          type: "square",
          gain: 0.05,
        });
        break;
      case "draw":
        tone(ctx, { freq: 523, length: 0.16, type: "triangle" });
        tone(ctx, { freq: 523, at: 0.18, length: 0.22, type: "triangle" });
        break;
      case "lose":
        [523, 466, 392, 330].forEach((freq, index) =>
          tone(ctx, {
            freq,
            at: index * 0.13,
            length: 0.2,
            type: "triangle",
            gain: 0.1,
          }),
        );
        break;
      case "win":
        [523, 659, 784, 1047].forEach((freq, index) =>
          tone(ctx, {
            freq,
            at: index * 0.1,
            length: index === 3 ? 0.45 : 0.16,
            type: "triangle",
            gain: 0.13,
          }),
        );
        break;
    }
  } catch {
    /* Audio is a nicety; never let it break a move. */
  }
}

export function SoundToggle() {
  const on = useSoundOn();
  return (
    <button
      type="button"
      className="quiet sound-toggle"
      aria-pressed={on}
      aria-label={on ? "Sound on" : "Sound off"}
      onClick={() => {
        setSoundOn(!on);
        if (!on) setTimeout(() => playSound("tap"), 0);
      }}
    >
      {on ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
      <span>{on ? "Sound on" : "Sound off"}</span>
    </button>
  );
}

/* ------------------------------------------------------------- outcomes */

export function winnerOf(game: Game): string | null {
  if (game.kind === "word") return null;
  return (game.state as FourState | TicState | RpsState).winner ?? null;
}

/**
 * Watches one game for changes that happen while it is on screen and fires
 * the matching cue once: a turn chime when the partner moves, and a win,
 * loss or draw flourish when the game ends during this visit.
 */
export function useGameCues(
  game: Game,
  meId: string,
  myTurn: boolean,
): { celebrate: "win" | "lose" | "draw" | null; nudge: number } {
  const finished = isGameFinished(game);
  const winner = winnerOf(game);
  const { id, revision, kind } = game;
  const seen = useRef({ id, revision, finished, myTurn });
  const [cue, setCue] = useState<{
    celebrate: "win" | "lose" | "draw" | null;
    nudge: number;
  }>({ celebrate: null, nudge: 0 });
  useEffect(() => {
    const before = seen.current;
    seen.current = { id, revision, finished, myTurn };
    if (before.id !== id || revision <= before.revision) return;
    if (!before.finished && finished) {
      const outcome = !winner ? "draw" : winner === meId ? "win" : "lose";
      // Let the final piece land before the fanfare.
      const timer = setTimeout(
        () => {
          playSound(outcome);
          setCue((current) => ({ ...current, celebrate: outcome }));
        },
        kind === "four" ? 480 : kind === "rps" ? 1100 : 250,
      );
      return () => clearTimeout(timer);
    }
    if (!finished && myTurn && !before.myTurn) {
      playSound("turn");
      setCue((current) => ({ ...current, nudge: current.nudge + 1 }));
    }
  }, [id, revision, kind, winner, meId, finished, myTurn]);
  useEffect(() => {
    if (!cue.celebrate) return;
    const timer = setTimeout(
      () => setCue((current) => ({ ...current, celebrate: null })),
      3200,
    );
    return () => clearTimeout(timer);
  }, [cue.celebrate]);
  return cue;
}

/* ---------------------------------------------------------------- series */

export function useSeries(space: SpaceSnapshot, kind?: Game["kind"]) {
  return useMemo(() => {
    const wins: Record<string, number> = {};
    let draws = 0;
    let played = 0;
    for (const game of space.games) {
      // Solving a clue puzzle is not a win or draw between the two players.
      if (
        game.kind === "word" ||
        (kind && game.kind !== kind) ||
        !isGameFinished(game)
      )
        continue;
      played++;
      const winner = winnerOf(game);
      if (winner) wins[winner] = (wins[winner] ?? 0) + 1;
      else draws++;
    }
    return { wins, draws, played };
  }, [space.games, kind]);
}

/* -------------------------------------------------------------- players */

export const playerTone = (index: number) => (index === 0 ? "rose" : "sky");

export function PlayerBar({
  space,
  players,
  activeId,
  winnerId,
  score,
  marker,
  kind,
}: {
  space: SpaceSnapshot;
  players: string[];
  activeId: string | null;
  winnerId?: string | null;
  score?: Record<string, ReactNode>;
  marker?: (index: number) => ReactNode;
  kind: Game["kind"];
}) {
  const series = useSeries(space, kind);
  const name = (id: string) =>
    space.members.find((member) => member.id === id)?.name ?? "Your partner";
  return (
    <div className="player-bar">
      {players.map((id, index) => {
        const active = activeId === id;
        const won = winnerId === id;
        return (
          <div
            key={id}
            className={`player-chip tone-${playerTone(index)}${active ? " is-active" : ""}${won ? " is-winner" : ""}`}
          >
            <span className="player-token" aria-hidden="true">
              {marker ? marker(index) : name(id).slice(0, 1).toUpperCase()}
            </span>
            <span className="player-meta">
              <strong>
                {name(id)}
                {id === space.me.id && <em>you</em>}
              </strong>
              <small>
                {won
                  ? "Winner"
                  : active
                    ? id === space.me.id
                      ? "Your move"
                      : "Their turn"
                    : series.played
                      ? `${series.wins[id] ?? 0} ${(series.wins[id] ?? 0) === 1 ? "win" : "wins"}`
                      : "Ready"}
              </small>
            </span>
            {score && (
              <span className="player-score" aria-hidden="true">
                {score[id]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------- confetti */

const CONFETTI_COLORS = ["#f2b4c8", "#9ec3f3", "#f4cf87", "#a9dcc0", "#f7f2f4"];

export function Confetti({ tone = "win" }: { tone?: "win" | "lose" | "draw" }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: tone === "win" ? 46 : 18 }, (_, index) => ({
        id: index,
        x: Math.random() * 100,
        drift: (Math.random() - 0.5) * 160,
        delay: Math.random() * 0.35,
        spin: (Math.random() - 0.5) * 900,
        duration: 1.6 + Math.random() * 1.2,
        size: 6 + Math.random() * 7,
        color:
          tone === "win"
            ? CONFETTI_COLORS[index % CONFETTI_COLORS.length]
            : tone === "draw"
              ? ["#f4cf87", "#f7f2f4"][index % 2]
              : ["#6f6877", "#463f4e"][index % 2],
        round: index % 3 === 0,
      })),
    [tone],
  );
  return (
    <div className={`confetti confetti-${tone}`} aria-hidden="true">
      {pieces.map((piece) => (
        <i
          key={piece.id}
          style={
            {
              "--x": `${piece.x}%`,
              "--drift": `${piece.drift}px`,
              "--delay": `${piece.delay}s`,
              "--spin": `${piece.spin}deg`,
              "--duration": `${piece.duration}s`,
              "--size": `${piece.size}px`,
              "--color": piece.color,
              borderRadius: piece.round ? "50%" : "2px",
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- game frame */

export function GameFrame({
  game,
  title,
  kicker,
  badge,
  className = "",
  celebrate,
  nudge = 0,
  children,
}: {
  game: Game;
  title: string;
  kicker?: ReactNode;
  badge?: ReactNode;
  className?: string;
  celebrate?: "win" | "lose" | "draw" | null;
  nudge?: number;
  children: ReactNode;
}) {
  return (
    <article
      id={`game-${game.id}`}
      tabIndex={-1}
      aria-labelledby={`game-heading-${game.id}`}
      className={`panel game-card game-card-${game.kind} ${className}`.trim()}
      data-outcome={celebrate ?? undefined}
    >
      {nudge > 0 && (
        <span key={nudge} className="turn-flash" aria-hidden="true" />
      )}
      <header className="game-card-head">
        <div>
          {kicker && <span className="game-kicker">{kicker}</span>}
          <h3 id={`game-heading-${game.id}`}>{title}</h3>
        </div>
        {badge}
      </header>
      {children}
      {celebrate && <Confetti tone={celebrate} />}
    </article>
  );
}

export function StatusBanner({
  tone,
  children,
}: {
  tone: "mine" | "theirs" | "win" | "lose" | "draw" | "neutral";
  children: ReactNode;
}) {
  return (
    <p className={`game-status status-${tone}`} role="status">
      {children}
    </p>
  );
}

export function HowToPlay({ children }: { children: ReactNode }) {
  return (
    <details className="game-rules">
      <summary>How to play</summary>
      <p>{children}</p>
    </details>
  );
}
