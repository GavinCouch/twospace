"use client";

import { Trophy } from "lucide-react";
import { useAction } from "@/components/space-provider";
import type { Game, SpaceSnapshot, TicState } from "@/shared/types";
import {
  GameFrame,
  HowToPlay,
  PlayerBar,
  StatusBanner,
  playSound,
  useGameCues,
} from "./game-kit";
import { PlayAgain } from "./play-again";

/** Hand-drawn style marks; strokes animate in when a square is claimed. */
export function TicMark({ player }: { player: 0 | 1 }) {
  return player === 0 ? (
    <svg viewBox="0 0 100 100" className="tic-mark tic-x" aria-hidden="true">
      <path d="M26 26 L74 74" />
      <path d="M74 26 L26 74" />
    </svg>
  ) : (
    <svg viewBox="0 0 100 100" className="tic-mark tic-o" aria-hidden="true">
      <circle cx="50" cy="50" r="25" />
    </svg>
  );
}

const center = (cell: number) => ({
  x: (cell % 3) * 100 + 50,
  y: Math.floor(cell / 3) * 100 + 50,
});

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
  const mine = !finished && state.turn === space.me.id;
  const myMark = state.players.indexOf(space.me.id) === 1 ? 1 : 0;
  const cues = useGameCues(game, space.me.id, mine);
  const filled = state.board.filter(Boolean).length;
  const status = state.winner
    ? `${name(state.winner)} wins.`
    : state.draw
      ? "Cat’s game. Nobody wins this one."
      : mine
        ? "Your move. Pick a square."
        : `Waiting for ${name(state.turn)}…`;
  const line =
    state.winningCells.length === 3
      ? {
          from: center(state.winningCells[0]),
          to: center(state.winningCells[2]),
        }
      : null;
  return (
    <GameFrame
      game={game}
      title="Tic-tac-toe"
      kicker={finished ? "Game over" : `Turn ${filled + 1} of 9`}
      className={`tic-game${finished ? " tic-finished" : ""}`}
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
      <PlayerBar
        space={space}
        kind="tic"
        players={state.players}
        activeId={finished ? null : state.turn}
        winnerId={state.winner}
        marker={(index) => <TicMark player={index === 0 ? 0 : 1} />}
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
      <div className="tic-stage">
        <div
          className={`tic-board${mine ? " is-my-turn" : ""}`}
          role="group"
          aria-label="Tic-tac-toe board"
          data-mark={myMark}
        >
          {state.board.map((owner, cell) => {
            const player = owner ? state.players.indexOf(owner) : -1;
            return (
              <button
                type="button"
                key={cell}
                className={`${owner ? `tic-player-${player}` : "tic-empty"}${state.winningCells.includes(cell) ? " tic-winning" : ""}`}
                aria-label={`Row ${Math.floor(cell / 3) + 1}, column ${(cell % 3) + 1}: ${owner ? name(owner) : "empty"}`}
                disabled={!mine || !!owner || action.pending}
                onClick={() => {
                  playSound("place");
                  void action
                    .run(`/api/games/${game.id}/moves`, {
                      cell,
                      revision: game.revision,
                    })
                    .catch(() => {});
                }}
              >
                {owner ? (
                  <TicMark player={player === 0 ? 0 : 1} />
                ) : (
                  <span className="tic-ghost" aria-hidden="true">
                    <TicMark player={myMark} />
                  </span>
                )}
              </button>
            );
          })}
          {line && (
            <svg
              className={`tic-strike tic-strike-${state.players.indexOf(state.winner!)}`}
              viewBox="0 0 300 300"
              aria-hidden="true"
            >
              <line
                x1={line.from.x - (line.to.x - line.from.x) * 0.18}
                y1={line.from.y - (line.to.y - line.from.y) * 0.18}
                x2={line.to.x + (line.to.x - line.from.x) * 0.18}
                y2={line.to.y + (line.to.y - line.from.y) * 0.18}
              />
            </svg>
          )}
        </div>
      </div>
      {action.error && (
        <p className="form-error" role="alert">
          {action.error}
        </p>
      )}
      {finished && <PlayAgain kind="tic" space={space} onStarted={onStarted} />}
      <HowToPlay>
        Take turns claiming squares. Three of your marks in a row (across, down,
        or corner to corner) wins. The first player of each new game is always
        X.
      </HowToPlay>
    </GameFrame>
  );
}
