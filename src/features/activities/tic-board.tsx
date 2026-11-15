"use client";

import { Circle, X } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Game, SpaceSnapshot, TicState } from "@/shared/types";
import { PlayAgain } from "./play-again";

export function TicBoard({
  game,
  space,
  onStarted,
}: {
  game: Game;
  space: SpaceSnapshot;
  onStarted?: (id: string) => void;
}) {
  const action = useAction();
  const state = game.state as TicState;
  const name = (id: string) =>
    space.members.find((person) => person.id === id)?.name ?? "Your partner";
  const finished = !!state.winner || state.draw;
  const status = state.winner
    ? `${name(state.winner)} wins.`
    : state.draw
      ? "A draw. No squares left."
      : state.turn === space.me.id
        ? "Your turn. Choose a square."
        : `${name(state.turn)}’s turn.`;
  return (
    <article
      className="panel tic-game"
      id={`game-${game.id}`}
      tabIndex={-1}
      aria-labelledby={`game-heading-${game.id}`}
    >
      <h3 id={`game-heading-${game.id}`}>Tic-tac-toe</h3>
      <p className="game-status" role="status">
        {status}
      </p>
      <div className="tic-players">
        {state.players.map((id, index) => (
          <span key={id}>
            {index === 0 ? (
              <X size={17} aria-hidden="true" />
            ) : (
              <Circle size={16} aria-hidden="true" />
            )}
            {name(id)}
            {id === space.me.id ? " (you)" : ""}
          </span>
        ))}
      </div>
      <div className="tic-board" role="group" aria-label="Tic-tac-toe board">
        {state.board.map((owner, cell) => (
          <button
            type="button"
            key={cell}
            className={`${owner ? `tic-player-${state.players.indexOf(owner)}` : ""}${state.winningCells.includes(cell) ? " tic-winning" : ""}`}
            aria-label={`Row ${Math.floor(cell / 3) + 1}, column ${(cell % 3) + 1}: ${owner ? name(owner) : "empty"}`}
            disabled={
              finished ||
              state.turn !== space.me.id ||
              !!owner ||
              action.pending
            }
            onClick={() =>
              void action
                .run(`/api/games/${game.id}/moves`, {
                  cell,
                  revision: game.revision,
                })
                .catch(() => {})
            }
          >
            {owner ? (
              state.players.indexOf(owner) === 0 ? (
                <X aria-hidden="true" />
              ) : (
                <Circle aria-hidden="true" />
              )
            ) : null}
          </button>
        ))}
      </div>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {finished && <PlayAgain kind="tic" space={space} onStarted={onStarted} />}
      <details className="game-rules">
        <summary>How to play</summary>
        <p>
          Take turns placing X or O. Make a line of three across, down, or
          diagonally.
        </p>
      </details>
    </article>
  );
}
