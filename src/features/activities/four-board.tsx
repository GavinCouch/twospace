"use client";

import { ArrowDown, Trophy } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { useAction } from "@/components/space-provider";
import { FOUR_COLUMNS } from "@/shared/four";
import type { FourState, Game, SpaceSnapshot } from "@/shared/types";

function addedPiece(before: FourState["board"], after: FourState["board"]) {
  let added: { row: number; column: number } | null = null;
  for (let row = 0; row < after.length; row++) {
    for (let column = 0; column < after[row].length; column++) {
      if (before[row]?.[column] === after[row][column]) continue;
      // A resumed game may include several moves. Only animate a single new move.
      if (added || before[row]?.[column] !== null || !after[row][column])
        return null;
      added = { row, column };
    }
  }
  return added;
}

export function FourBoard({
  game,
  space,
}: {
  game: Game;
  space: SpaceSnapshot;
}) {
  const action = useAction();
  const state = game.state as FourState;
  const [transition, setTransition] = useState(() => ({
    gameId: game.id,
    revision: game.revision,
    state,
    drop: null as ReturnType<typeof addedPiece>,
    won: false,
    winDelay: "0ms",
  }));
  if (transition.gameId !== game.id || transition.revision !== game.revision) {
    const advanced =
      transition.gameId === game.id && game.revision > transition.revision;
    const drop = advanced
      ? addedPiece(transition.state.board, state.board)
      : null;
    setTransition({
      gameId: game.id,
      revision: game.revision,
      state,
      drop,
      won: advanced && !transition.state.winner && !!state.winner,
      winDelay: drop ? "480ms" : "0ms",
    });
  }
  const mine = state.turn === space.me.id;
  const playerName = (id: string | null) =>
    space.members.find((member) => member.id === id)?.name || "Your partner";
  const status = state.winner
    ? `${playerName(state.winner)} has four in a row.`
    : state.draw
      ? "It is a draw. Every column is full."
      : mine
        ? "Your turn. Choose a column."
        : `${playerName(state.turn)}’s turn.`;
  async function move(column: number) {
    try {
      await action.run(`/api/games/${game.id}/moves`, {
        column,
        revision: game.revision,
      });
    } catch {
      /* A stale move is rejected by the server and shown below. */
    }
  }
  return (
    <article
      className={`panel four-game${transition.won ? " four-celebrating" : ""}`}
      style={{ "--four-win-delay": transition.winDelay } as CSSProperties}
    >
      <div className="activity-heading">
        <h3>Four-in-a-row</h3>
        {state.winner && <Trophy size={24} aria-hidden="true" />}
      </div>
      <p className="game-status" role="status">
        {status}
      </p>
      <div className="four-players">
        {space.members.map((member, index) => (
          <span key={member.id}>
            <i className={`four-piece player-${index}`} aria-hidden="true">
              {member.name[0]}
            </i>
            {member.name}
            {member.id === space.me.id ? " (you)" : ""}
          </span>
        ))}
      </div>
      <div className="four-controls">
        {Array.from({ length: FOUR_COLUMNS }, (_, column) => (
          <button
            key={column}
            className="four-drop"
            aria-label={`Drop your piece in column ${column + 1}${state.board[0][column] ? ", full" : ""}`}
            disabled={
              !mine ||
              !!state.winner ||
              state.draw ||
              !!state.board[0][column] ||
              action.pending
            }
            onClick={() => void move(column)}
          >
            <ArrowDown size={20} aria-hidden="true" />
            <span className="sr-only">{column + 1}</span>
          </button>
        ))}
      </div>
      <div className="four-board-wrap">
        <table className="four-board">
          <caption className="sr-only">
            Game board. Row one is the top. Each row has seven columns.
          </caption>
          <tbody>
            {state.board.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, column) => {
                  const player = space.members.findIndex(
                    (member) => member.id === cell,
                  );
                  const winning = state.winningCells.some(
                    ([r, c]) => r === rowIndex && c === column,
                  );
                  const dropping =
                    transition.drop?.row === rowIndex &&
                    transition.drop.column === column;
                  return (
                    <td key={column}>
                      <span
                        className={`four-cell${winning ? " winning-cell" : ""}`}
                      >
                        <span className="sr-only">
                          Row {rowIndex + 1}, column {column + 1}:{" "}
                          {cell ? playerName(cell) : "empty"}
                          {winning ? ", winning piece" : ""}.
                        </span>
                        {cell && (
                          <span
                            className={`four-disc player-${player}${dropping ? " four-disc-dropping" : ""}`}
                            style={
                              dropping
                                ? ({
                                    "--four-drop-from": `calc(-${(rowIndex + 1) * 100}% - ${rowIndex + 1} * var(--four-gap))`,
                                  } as CSSProperties)
                                : undefined
                            }
                            onAnimationEnd={() =>
                              setTransition((current) =>
                                current.revision === game.revision
                                  ? { ...current, drop: null }
                                  : current,
                              )
                            }
                            aria-hidden="true"
                          >
                            {playerName(cell)[0]}
                          </span>
                        )}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      <details className="game-rules">
        <summary>How to play</summary>
        <p>
          Take turns dropping a piece into a column. The first player to connect
          four horizontally, vertically or diagonally wins. You can leave and
          return between turns.
        </p>
      </details>
    </article>
  );
}
