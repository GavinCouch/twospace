"use client";

import { ArrowDown, Trophy } from "lucide-react";
import { useAction } from "@/components/space-provider";
import { FOUR_COLUMNS } from "@/shared/four";
import type { FourState, Game, SpaceSnapshot } from "@/shared/types";

export function FourBoard({ game, space }: { game: Game; space: SpaceSnapshot }) {
  const action = useAction();
  const state = game.state as FourState;
  const mine = state.turn === space.me.id;
  const playerName = (id: string | null) => space.members.find(member => member.id === id)?.name || "Your partner";
  const status = state.winner ? `${playerName(state.winner)} has four in a row.` : state.draw ? "It is a draw. Every column is full." : mine ? "Your turn. Choose a column." : `${playerName(state.turn)}’s turn.`;
  async function move(column: number) {
    try { await action.run(`/api/games/${game.id}/moves`, { column, revision: game.revision }); } catch { /* A stale move is rejected by the server and shown below. */ }
  }
  return <article className="panel four-game">
    <div className="activity-heading"><h3>Four-in-a-row</h3>{state.winner && <Trophy size={24} aria-hidden="true" />}</div>
    <p className="game-status" role="status">{status}</p>
    <div className="four-players">{space.members.map((member, index) => <span key={member.id}><i className={`four-piece player-${index}`} aria-hidden="true">{member.name[0]}</i>{member.name}{member.id === space.me.id ? " (you)" : ""}</span>)}</div>
    <div className="four-controls">{Array.from({ length: FOUR_COLUMNS }, (_, column) => <button key={column} className="four-drop" aria-label={`Drop your piece in column ${column + 1}${state.board[0][column] ? ", full" : ""}`} disabled={!mine || !!state.winner || state.draw || !!state.board[0][column] || action.pending} onClick={() => void move(column)}><ArrowDown size={20} aria-hidden="true" /><span className="sr-only">{column + 1}</span></button>)}</div>
    <table className="four-board"><caption className="sr-only">Game board. Row one is the top. Each row has seven columns.</caption><tbody>{state.board.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => {
      const player = space.members.findIndex(member => member.id === cell);
      const winning = state.winningCells.some(([r, c]) => r === rowIndex && c === column);
      return <td key={column}><span className={`four-cell${cell ? ` player-${player}` : ""}${winning ? " winning-cell" : ""}`}><span className="sr-only">Row {rowIndex + 1}, column {column + 1}: {cell ? playerName(cell) : "empty"}{winning ? ", winning piece" : ""}.</span><span aria-hidden="true">{cell ? playerName(cell)[0] : ""}</span></span></td>;
    })}</tr>)}</tbody></table>
    {action.error && <p className="form-error" role="alert">{action.error}</p>}
    <details className="game-rules"><summary>How to play</summary><p>Take turns dropping a piece into a column. The first player to connect four horizontally, vertically or diagonally wins. You can leave and return between turns.</p></details>
  </article>;
}
