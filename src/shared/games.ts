import type {
  FourState,
  Game,
  RpsChoice,
  RpsState,
  TicState,
  WordState,
} from "./types";

function validatePlayers(players: string[]) {
  if (
    players.length !== 2 ||
    !players[0] ||
    !players[1] ||
    players[0] === players[1]
  )
    throw new Error("A game needs two different players.");
}

export function initialTic(players: string[]): TicState {
  validatePlayers(players);
  return {
    board: Array<string | null>(9).fill(null),
    players: [...players],
    turn: players[0],
    winner: null,
    draw: false,
    winningCells: [],
  };
}

export function playTic(
  state: TicState,
  playerId: string,
  cell: number,
): TicState {
  validatePlayers(state.players);
  if (!state.players.includes(playerId))
    throw new Error("You are not a player in this game.");
  if (state.winner || state.draw)
    throw new Error("This game has finished. Start another to play again.");
  if (state.turn !== playerId) throw new Error("It is your partner’s turn.");
  if (!Number.isInteger(cell) || cell < 0 || cell > 8)
    throw new Error("Choose a square on the board.");
  if (state.board[cell])
    throw new Error("That square is taken. Choose another.");
  const board = [...state.board];
  board[cell] = playerId;
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  const winningCells =
    lines.find((line) => line.every((index) => board[index] === playerId)) ??
    [];
  const winner = winningCells.length ? playerId : null;
  const draw = !winner && board.every(Boolean);
  return {
    ...state,
    board,
    winningCells,
    winner,
    draw,
    turn:
      winner || draw ? playerId : state.players.find((id) => id !== playerId)!,
  };
}

export function initialRps(players: string[]): RpsState {
  validatePlayers(players);
  return {
    players: [...players],
    round: 1,
    choices: {},
    rounds: [],
    scores: Object.fromEntries(players.map((id) => [id, 0])),
    winner: null,
  };
}

export function playRps(
  state: RpsState,
  playerId: string,
  choice: RpsChoice,
  round: number,
): RpsState {
  validatePlayers(state.players);
  if (!state.players.includes(playerId))
    throw new Error("You are not a player in this game.");
  if (state.winner)
    throw new Error("This match has finished. Start another to play again.");
  if (round !== state.round)
    throw new Error("That round has finished. Choose again for this round.");
  if (!["rock", "paper", "scissors"].includes(choice))
    throw new Error("Choose rock, paper, or scissors.");
  if (Object.hasOwn(state.choices, playerId))
    throw new Error("Your choice is already locked in.");
  const choices = { ...state.choices, [playerId]: choice };
  if (!state.players.every((id) => choices[id])) return { ...state, choices };
  const [first, second] = state.players;
  const a = choices[first]!;
  const b = choices[second]!;
  const beats: Record<RpsChoice, RpsChoice> = {
    rock: "scissors",
    paper: "rock",
    scissors: "paper",
  };
  const roundWinner = a === b ? null : beats[a] === b ? first : second;
  const scores = { ...state.scores };
  if (roundWinner) scores[roundWinner]++;
  return {
    ...state,
    round: state.round + 1,
    choices: {},
    rounds: [
      ...state.rounds.slice(-19),
      {
        number: state.round,
        choices: { [first]: a, [second]: b },
        winner: roundWinner,
      },
    ],
    scores,
    winner: roundWinner && scores[roundWinner] >= 3 ? roundWinner : null,
  };
}

export function visibleRps(state: RpsState, userId: string): RpsState {
  return {
    ...state,
    choices: Object.fromEntries(
      Object.entries(state.choices).map(([id, choice]) => [
        id,
        id === userId ? choice : null,
      ]),
    ),
  };
}

export function isGameFinished(game: Game): boolean {
  if (game.kind === "word") return (game.state as WordState).solved;
  if (game.kind === "rps") return !!(game.state as RpsState).winner;
  const state = game.state as FourState | TicState;
  return !!state.winner || state.draw;
}
