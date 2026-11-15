import { describe, expect, it } from "vitest";
import {
  initialRps,
  initialTic,
  playRps,
  playTic,
  visibleRps,
} from "@/shared/games";

const players = ["maya", "theo"];

describe("tic-tac-toe", () => {
  it("keeps turns authoritative and leaves the previous board intact", () => {
    const before = initialTic(players);
    const after = playTic(before, "maya", 4);
    expect(before.board[4]).toBeNull();
    expect(after.board[4]).toBe("maya");
    expect(after.turn).toBe("theo");
    expect(() => playTic(after, "maya", 0)).toThrow("turn");
    expect(() => playTic(after, "theo", 4)).toThrow("taken");
    expect(() => playTic(after, "outsider", 0)).toThrow("not a player");
  });
  it.each([
    [0, 3, 1, 4, 2],
    [0, 1, 3, 2, 6],
    [0, 1, 4, 2, 8],
    [2, 0, 4, 1, 6],
  ])("detects lines in every direction: %j", (...moves) => {
    const state = moves.reduce(
      (board, cell) => playTic(board, board.turn, cell),
      initialTic(players),
    );
    expect(state.winner).toBe("maya");
    expect(state.winningCells).toHaveLength(3);
    expect(() => playTic(state, "maya", 7)).toThrow("finished");
  });
  it("ends a full board as a draw", () => {
    const state = [0, 1, 2, 4, 3, 5, 7, 6, 8].reduce(
      (board, cell) => playTic(board, board.turn, cell),
      initialTic(players),
    );
    expect(state.draw).toBe(true);
    expect(state.winner).toBeNull();
    expect(() => playTic(state, "maya", 0)).toThrow("finished");
  });
});

describe("rock, paper, scissors", () => {
  it("locks choices and redacts the partner’s choice until both have played", () => {
    const first = playRps(initialRps(players), "maya", "scissors", 1);
    expect(visibleRps(first, "theo").choices).toEqual({ maya: null });
    expect(visibleRps(first, "maya").choices).toEqual({ maya: "scissors" });
    expect(() => playRps(first, "maya", "rock", 1)).toThrow("locked");
    const revealed = playRps(first, "theo", "paper", 1);
    expect(revealed.rounds[0]).toEqual({
      number: 1,
      choices: { maya: "scissors", theo: "paper" },
      winner: "maya",
    });
    expect(revealed.scores).toEqual({ maya: 1, theo: 0 });
    expect(revealed.choices).toEqual({});
    expect(() => playRps(revealed, "maya", "rock", 1)).toThrow(
      "round has finished",
    );
  });
  it("does not count ties and finishes when a player reaches three wins", () => {
    let state = initialRps(players);
    state = playRps(playRps(state, "maya", "rock", 1), "theo", "rock", 1);
    expect(state.rounds[0].winner).toBeNull();
    expect(state.scores.maya).toBe(0);
    for (let round = 2; round <= 4; round++)
      state = playRps(
        playRps(state, "maya", "paper", round),
        "theo",
        "rock",
        round,
      );
    expect(state.winner).toBe("maya");
    expect(state.scores.maya).toBe(3);
    expect(() => playRps(state, "theo", "rock", 5)).toThrow("finished");
  });
});
