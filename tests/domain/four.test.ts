import { describe, expect, it } from "vitest";
import { initialFour, playFour } from "../../src/shared/four";

const players = ["alex", "sam"];
function play(columns: number[]) {
  return columns.reduce((state, column) => playFour(state, state.turn, column, players), initialFour(players));
}

describe("four in a row", () => {
  it("drops a piece to the lowest empty cell without changing the previous board", () => {
    const before = initialFour(players);
    const after = playFour(before, "alex", 3, players);
    expect(before.board[5][3]).toBeNull();
    expect(after.board[5][3]).toBe("alex");
    expect(after.turn).toBe("sam");
  });
  it("finds horizontal and vertical wins and ends the game", () => {
    const horizontal = play([0, 0, 1, 1, 2, 2, 3]);
    expect(horizontal.winner).toBe("alex");
    expect(horizontal.winningCells).toHaveLength(4);
    expect(play([0, 1, 0, 1, 0, 1, 0]).winner).toBe("alex");
    expect(() => playFour(horizontal, "alex", 4, players)).toThrow("finished");
  });
  it("finds both diagonal directions", () => {
    const columns = [0, 1, 1, 2, 4, 2, 2, 3, 4, 3, 5, 3, 3];
    expect(play(columns).winner).toBe("alex");
    expect(play(columns.map(column => 6 - column)).winner).toBe("alex");
  });
  it("rejects a full column, out-of-turn moves and invalid columns", () => {
    expect(() => playFour(play([2, 2, 2, 2, 2, 2]), "alex", 2, players)).toThrow("full");
    expect(() => playFour(initialFour(players), "sam", 0, players)).toThrow("turn");
    for (const column of [-1, 7, 1.5, NaN]) {
      expect(() => playFour(initialFour(players), "alex", column, players)).toThrow("column");
    }
  });
  it("requires two different players", () => {
    expect(() => initialFour(["alex", "alex"])).toThrow("different");
    expect(() => initialFour(["alex"])).toThrow("different");
  });
  it("ends a full board as a draw when the last piece does not make a line", () => {
    const state = initialFour(players);
    const a = ["alex", "alex", "sam", "sam", "alex", "alex", "sam"];
    const b = a.map(player => player === "alex" ? "sam" : "alex");
    state.board = [a, b, [...a], [...b], [...a], [...b]];
    state.board[0][6] = null;
    state.turn = "sam";
    const result = playFour(state, "sam", 6, players);
    expect(result.draw).toBe(true);
    expect(result.winner).toBeNull();
    expect(() => playFour(result, "sam", 0, players)).toThrow("finished");
  });
});
