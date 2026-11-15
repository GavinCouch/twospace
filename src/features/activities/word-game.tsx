"use client";

import { useState } from "react";
import { Check, LockKeyhole } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Game, SpaceSnapshot, WordState } from "@/shared/types";

export function WordGame({
  game,
  space,
}: {
  game: Game;
  space: SpaceSnapshot;
}) {
  const action = useAction();
  const [guess, setGuess] = useState("");
  const state = game.state as WordState;
  const isAuthor = state.authorId === space.me.id;
  const author =
    space.members.find((member) => member.id === state.authorId)?.name ||
    "Your partner";
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
  return (
    <article
      className="panel word-game"
      id={`game-${game.id}`}
      tabIndex={-1}
      aria-labelledby={`game-heading-${game.id}`}
    >
      <div className="activity-heading">
        <div>
          <span className="activity-eyebrow">Three clues</span>
          <h3 id={`game-heading-${game.id}`}>
            {state.solved
              ? "You found it"
              : `A puzzle from ${isAuthor ? "you" : author}`}
          </h3>
        </div>
        {state.solved ? (
          <Check size={25} aria-hidden="true" />
        ) : (
          <LockKeyhole size={21} aria-hidden="true" />
        )}
      </div>
      <ol className="word-clues">
        {state.clues.map((clue, index) => (
          <li key={index}>
            <span aria-hidden="true">{index + 1}</span>
            <p>{clue}</p>
          </li>
        ))}
      </ol>
      {(isAuthor || state.solved) && (
        <p className="word-answer">
          <span>{state.solved ? "The answer" : "Your secret answer"}</span>
          <strong>{state.answer}</strong>
        </p>
      )}
      {!isAuthor && !state.solved && (
        <form onSubmit={submit} className="word-guess">
          <label className="field">
            Your guess
            <input
              autoComplete="off"
              value={guess}
              onChange={(event) => setGuess(event.target.value)}
              maxLength={80}
              required
              placeholder="What could it be?"
            />
          </label>
          <button className="button" disabled={action.pending || !guess.trim()}>
            {action.pending ? "Checking…" : "Try this"}
          </button>
        </form>
      )}
      <div role="status">
        {state.solved ? (
          <p className="muted">Puzzle solved.</p>
        ) : isAuthor ? (
          <p className="muted">Your partner can guess whenever they like.</p>
        ) : state.guesses.length > 0 ? (
          <p className="muted">Not quite. Have another look at the clues.</p>
        ) : (
          <p className="muted small-copy">
            Capital letters do not matter. Take as many guesses as you like.
          </p>
        )}
      </div>
      {state.guesses.length > 0 && (
        <details className="game-rules">
          <summary>Recent guesses ({state.guesses.length})</summary>
          <p className="muted small-copy">The latest 50 guesses are kept.</p>
          <ul className="guess-list">
            {state.guesses.map((value, index) => (
              <li key={index}>{value}</li>
            ))}
          </ul>
        </details>
      )}
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
    </article>
  );
}
