"use client";

import { useEffect, useRef, useState } from "react";
import { LockKeyhole, Sparkles } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Game, SpaceSnapshot, WordState } from "@/shared/types";
import { GameFrame, StatusBanner, playSound } from "./game-kit";

const ratings = [
  "Solved on the first clue.",
  "Solved with two clues.",
  "Solved with all three clues.",
];

export function WordGame({
  game,
  space,
}: {
  game: Game;
  space: SpaceSnapshot;
}) {
  const action = useAction();
  const [guess, setGuess] = useState("");
  const guessForm = useRef<HTMLFormElement>(null);
  const state = game.state as WordState;
  const isAuthor = state.authorId === space.me.id;
  const author =
    space.members.find((member) => member.id === state.authorId)?.name ||
    "Your partner";
  const guesser =
    space.members.find((member) => member.id !== state.authorId)?.name ||
    "Your partner";
  const misses = state.solved
    ? Math.max(0, state.guesses.length - 1)
    : state.guesses.length;
  // A new clue opens after each wrong guess. The author always sees all three.
  const unlocked =
    isAuthor || state.solved
      ? state.clues.length
      : Math.min(state.clues.length, misses + 1);
  const seen = useRef({
    id: game.id,
    guesses: state.guesses.length,
    solved: state.solved,
  });
  const [celebrate, setCelebrate] = useState<"win" | null>(null);
  useEffect(() => {
    const before = seen.current;
    seen.current = {
      id: game.id,
      guesses: state.guesses.length,
      solved: state.solved,
    };
    if (before.id !== game.id) return;
    if (!before.solved && state.solved) {
      playSound("win");
      setCelebrate("win");
      const timer = setTimeout(() => setCelebrate(null), 3200);
      return () => clearTimeout(timer);
    }
    if (state.guesses.length > before.guesses && !state.solved) {
      playSound(isAuthor ? "tap" : "wrong");
      if (
        !isAuthor &&
        !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
      ) {
        const animation = guessForm.current?.animate?.(
          [
            { transform: "translateX(0)" },
            { transform: "translateX(-7px)", offset: 0.2 },
            { transform: "translateX(7px)", offset: 0.4 },
            { transform: "translateX(-7px)", offset: 0.6 },
            { transform: "translateX(7px)", offset: 0.8 },
            { transform: "translateX(0)" },
          ],
          { duration: 420, easing: "ease" },
        );
        return () => animation?.cancel();
      }
    }
  }, [game.id, state.guesses.length, state.solved, isAuthor]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!guess.trim()) return;
    try {
      await action.run(`/api/games/${game.id}/moves`, {
        guess: guess.trim(),
        revision: game.revision,
      });
      setGuess("");
    } catch {
      /* The draft remains available on conflict or network failure. */
    }
  }
  const usedClues = Math.min(3, Math.max(1, state.guesses.length));
  return (
    <GameFrame
      game={game}
      title={
        state.solved
          ? isAuthor
            ? `${guesser} solved it`
            : "You solved it"
          : isAuthor
            ? "Your puzzle"
            : `A puzzle from ${author}`
      }
      kicker="Three clues"
      className={`word-game${state.solved ? " word-solved" : ""}`}
      celebrate={celebrate}
      badge={
        <span className={`game-badge${state.solved ? " badge-gold" : ""}`}>
          {state.solved ? (
            <>
              <Sparkles size={15} aria-hidden="true" /> Solved
            </>
          ) : (
            <>
              <LockKeyhole size={14} aria-hidden="true" /> {unlocked}/3 clues
            </>
          )}
        </span>
      }
    >
      <ol className="word-clues">
        {state.clues.map((clue, index) => {
          const open = index < unlocked;
          return (
            <li
              key={index}
              className={open ? "is-open" : "is-locked"}
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="word-clue-number" aria-hidden="true">
                {index + 1}
              </span>
              {open ? (
                <p>{clue}</p>
              ) : (
                <p className="word-clue-locked">
                  <LockKeyhole size={14} aria-hidden="true" />
                  Shown after{" "}
                  {index === 1 ? "one wrong guess" : "two wrong guesses"}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      {(isAuthor || state.solved) && (
        <p className="word-answer">
          <span>{state.solved ? "The answer" : "Your secret answer"}</span>
          <strong>{state.answer}</strong>
        </p>
      )}
      {!isAuthor && !state.solved && (
        <form onSubmit={submit} className="word-guess" ref={guessForm}>
          <label className="field">
            Your guess
            <input
              autoComplete="off"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              maxLength={80}
              required
              placeholder="Enter a word or phrase"
            />
          </label>
          <button className="button" disabled={action.pending || !guess.trim()}>
            {action.pending ? "Checking…" : "Guess"}
          </button>
        </form>
      )}
      <StatusBanner tone={state.solved ? "win" : isAuthor ? "theirs" : "mine"}>
        {state.solved
          ? ratings[usedClues - 1]
          : isAuthor
            ? state.guesses.length
              ? `${guesser} has made ${state.guesses.length} ${state.guesses.length === 1 ? "guess" : "guesses"} so far.`
              : `Waiting for ${guesser} to make a first guess.`
            : state.guesses.length > 0
              ? unlocked < 3
                ? "Try again with the next clue."
                : "Try again. All three clues are now shown."
              : "Capital letters don’t matter. Guess as often as you like."}
      </StatusBanner>
      {state.guesses.length > 0 && (
        <div className="word-guesses">
          <span className="word-guesses-label">Guesses</span>
          <ul className="guess-list">
            {state.guesses.map((value, index) => (
              <li
                key={index}
                className={
                  state.solved && index === state.guesses.length - 1
                    ? "is-right"
                    : ""
                }
              >
                {value}
              </li>
            ))}
          </ul>
        </div>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </GameFrame>
  );
}
