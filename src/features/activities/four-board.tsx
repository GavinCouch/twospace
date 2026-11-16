"use client";

import { Trophy } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { useAction } from "@/components/space-provider";
import { FOUR_COLUMNS } from "@/shared/four";
import type { FourState, Game, SpaceSnapshot } from "@/shared/types";
import {
  GameFrame,
  HowToPlay,
  PlayerBar,
  StatusBanner,
  playSound,
  useGameCues,
} from "./game-kit";
import { PlayAgain } from "./play-again";

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
  onStarted,
}: {
  game: Game;
  space: SpaceSnapshot;
  onStarted?: (id: string) => void;
}) {
  const action = useAction();
  const state = game.state as FourState;
  const players = space.members.map((member) => member.id);
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
  const dropKey = transition.drop
    ? `${transition.revision}:${transition.drop.row}:${transition.drop.column}`
    : null;
  useEffect(() => {
    if (dropKey) playSound("drop");
  }, [dropKey]);
  const finished = !!state.winner || state.draw;
  const mine = state.turn === space.me.id && !finished;
  const myIndex = Math.max(0, players.indexOf(space.me.id));
  const cues = useGameCues(game, space.me.id, mine);
  const moves = state.board.flat().filter(Boolean).length;
  const playerName = (id: string | null) =>
    space.members.find((member) => member.id === id)?.name || "Your partner";
  const status = state.winner
    ? `${playerName(state.winner)} has four in a row.`
    : state.draw
      ? "Board full. It’s a draw."
      : mine
        ? "Your move. Pick a column."
        : `Waiting for ${playerName(state.turn)}…`;
  async function move(column: number) {
    playSound("tap");
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
    <GameFrame
      game={game}
      title="Four-in-a-row"
      kicker={finished ? `Finished in ${moves} moves` : `Move ${moves + 1}`}
      className={`four-game${transition.won ? " four-celebrating" : ""}${finished ? " four-finished" : ""}`}
      celebrate={cues.celebrate}
      nudge={cues.nudge}
      badge={
        state.winner ? (
          <span className="game-badge badge-gold">
            <Trophy size={15} aria-hidden="true" /> Winner
          </span>
        ) : undefined
      }
    >
      <div style={{ "--four-win-delay": transition.winDelay } as CSSProperties}>
        <PlayerBar
          space={space}
          kind="four"
          players={players}
          activeId={finished ? null : state.turn}
          winnerId={state.winner}
          marker={(index) => (
            <i className={`four-piece player-${index}`} aria-hidden="true" />
          )}
        />
        <StatusBanner
          tone={
            state.winner
              ? state.winner === space.me.id
                ? "win"
                : "lose"
              : state.draw
                ? "draw"
                : mine
                  ? "mine"
                  : "theirs"
          }
        >
          {status}
        </StatusBanner>
        <div
          className={`four-stage${mine ? " is-my-turn" : ""}${finished ? " is-over" : ""}`}
          style={
            {
              "--my-disc": `var(--disc-${myIndex})`,
              "--their-disc": `var(--disc-${myIndex === 0 ? 1 : 0})`,
            } as CSSProperties
          }
        >
          {!mine && !finished && (
            <span className="four-thinking" aria-hidden="true">
              <i />
            </span>
          )}
          <div className="four-controls">
            {Array.from({ length: FOUR_COLUMNS }, (_, column) => (
              <button
                key={column}
                className="four-drop"
                aria-label={`Drop your piece in column ${column + 1}${state.board[0][column] ? ", full" : ""}`}
                disabled={!mine || !!state.board[0][column] || action.pending}
                onClick={() => void move(column)}
              >
                <span className="four-ghost" aria-hidden="true" />
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
                      const player = players.indexOf(cell ?? "");
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
                              />
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
        </div>
        {action.error && (
          <p className="form-error" role="alert">
            {action.error}
          </p>
        )}
        {finished && (
          <PlayAgain kind="four" space={space} onStarted={onStarted} />
        )}
        <HowToPlay>
          Take turns dropping a piece into any column. It falls to the lowest
          open space. Line up four of your color across, down, or diagonally to
          win. You can leave and return to take your next turn.
        </HowToPlay>
      </div>
    </GameFrame>
  );
}
