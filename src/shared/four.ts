import type { FourState } from "./types";

export const FOUR_ROWS = 6;
export const FOUR_COLUMNS = 7;

function validatePlayers(players: string[]) {
  if (players.length !== 2 || !players[0] || !players[1] || players[0] === players[1]) {
    throw new Error("A game needs two different players.");
  }
}

export function initialFour(players: string[]): FourState {
  validatePlayers(players);
  return {
    board: Array.from({ length: FOUR_ROWS }, () => Array<string | null>(FOUR_COLUMNS).fill(null)),
    turn: players[0], winner: null, draw: false, winningCells: [],
  };
}

export function playFour(state: FourState, playerId: string, column: number, players: string[]): FourState {
  validatePlayers(players);
  if (!players.includes(playerId)) throw new Error("You are not a player in this game.");
  if (state.winner || state.draw) throw new Error("This game has finished. Start another to play again.");
  if (state.turn !== playerId) throw new Error("It is your partner’s turn.");
  if (!Number.isInteger(column) || column < 0 || column >= FOUR_COLUMNS) throw new Error("Choose a column on the board.");
  if (state.board.length !== FOUR_ROWS || state.board.some(row => row.length !== FOUR_COLUMNS)) throw new Error("The board is not valid.");
  const board = state.board.map(row => [...row]);
  let row = FOUR_ROWS - 1;
  while (row >= 0 && board[row][column] !== null) row--;
  if (row < 0) throw new Error("That column is full. Choose another.");
  board[row][column] = playerId;
  let winningCells: number[][] = [];
  for (const [dr, dc] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
    const cells = [[row, column]];
    for (const direction of [-1, 1]) {
      let r = row + dr * direction;
      let c = column + dc * direction;
      while (r >= 0 && r < FOUR_ROWS && c >= 0 && c < FOUR_COLUMNS && board[r][c] === playerId) {
        cells.push([r, c]); r += dr * direction; c += dc * direction;
      }
    }
    if (cells.length >= 4) { winningCells = cells; break; }
  }
  const winner = winningCells.length ? playerId : null;
  const draw = !winner && board.every(line => line.every(cell => cell !== null));
  return { board, winner, draw, winningCells, turn: winner || draw ? playerId : players.find(id => id !== playerId)! };
}
