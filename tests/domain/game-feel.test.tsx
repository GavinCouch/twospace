// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { WordGame } from "../../src/features/activities/word-game";
import { TicBoard } from "../../src/features/activities/tic-board";
import { RpsGame } from "../../src/features/activities/rps-game";
import { GamesPanel } from "../../src/features/activities/games-panel";
import {
  SoundToggle,
  playSound,
  setSoundOn,
} from "../../src/features/activities/game-kit";
import * as gameKit from "../../src/features/activities/game-kit";
import {
  initialRps,
  initialTic,
  playRps,
  playTic,
} from "../../src/shared/games";
import type { Game, SpaceSnapshot, WordState } from "../../src/shared/types";

const runAction = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", () => ({
  useAction: () => ({
    run: runAction,
    pending: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

const people = [
  {
    id: "a",
    name: "Alex",
    timeZone: "America/Chicago",
    color: "#245c55",
    availableFrom: 17,
    availableTo: 22,
  },
  {
    id: "b",
    name: "Sam",
    timeZone: "Europe/London",
    color: "#d78069",
    availableFrom: 17,
    availableTo: 22,
  },
];
const space: SpaceSnapshot = {
  space: {
    id: "space",
    name: "Our space",
    createdAt: "2026-11-15T00:00:00Z",
    isDemo: false,
  },
  me: people[0],
  members: people,
  entries: [],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
const word = (state: Partial<WordState>): Game => ({
  id: "word",
  kind: "word",
  revision: 0,
  createdAt: "2026-11-15T00:00:00Z",
  state: {
    answer: "",
    clues: ["Stays up all night", "Lives by the sea", "Ships love it"],
    guesses: [],
    solved: false,
    authorId: "b",
    ...state,
  },
});

beforeEach(() => {
  runAction.mockReset().mockResolvedValue({});
  setSoundOn(true);
  vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: true }));
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Three clues", () => {
  it("keeps the guess input focused when a wrong answer opens a clue", () => {
    const view = render(<WordGame game={word({})} space={space} />);
    const input = screen.getByRole("textbox", { name: "Your guess" });
    input.focus();

    view.rerender(
      <WordGame game={word({ guesses: ["moon"] })} space={space} />,
    );

    expect(screen.getByRole("textbox", { name: "Your guess" })).toBe(input);
    expect(input).toHaveFocus();
    expect(screen.getByText("Lives by the sea")).toBeInTheDocument();
  });

  it("opens one clue at a time for the guesser", () => {
    const view = render(<WordGame game={word({})} space={space} />);
    expect(screen.getByText("Stays up all night")).toBeInTheDocument();
    expect(screen.queryByText("Lives by the sea")).not.toBeInTheDocument();
    expect(screen.queryByText("Ships love it")).not.toBeInTheDocument();

    view.rerender(
      <WordGame game={word({ guesses: ["moon"] })} space={space} />,
    );
    expect(screen.getByText("Lives by the sea")).toBeInTheDocument();
    expect(screen.queryByText("Ships love it")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "A new clue just opened",
    );

    view.rerender(
      <WordGame game={word({ guesses: ["moon", "owl"] })} space={space} />,
    );
    expect(screen.getByText("Ships love it")).toBeInTheDocument();
  });

  it("shows the author every clue and rates a solve by clues used", () => {
    const view = render(
      <WordGame
        game={word({ authorId: "a", answer: "Lighthouse" })}
        space={space}
      />,
    );
    expect(screen.getByText("Ships love it")).toBeInTheDocument();
    expect(screen.getByText("Lighthouse")).toBeInTheDocument();

    view.rerender(
      <WordGame
        game={word({
          answer: "Lighthouse",
          guesses: ["moon", "lighthouse"],
          solved: true,
        })}
        space={space}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Solved with two clues",
    );
  });
});

describe("game feel", () => {
  it("only plays the reveal cue for new rounds, not when opening old games", () => {
    const sound = vi.spyOn(gameKit, "playSound").mockImplementation(() => {});
    let state = initialRps(["a", "b"]);
    state = playRps(state, "a", "rock", 1);
    state = playRps(state, "b", "paper", 1);
    const game: Game = {
      id: "rps",
      kind: "rps",
      revision: 2,
      createdAt: "2026-11-15T00:00:00Z",
      state,
    };
    const view = render(<RpsGame game={game} space={space} />);
    expect(sound).not.toHaveBeenCalled();

    state = playRps(state, "a", "scissors", 2);
    state = playRps(state, "b", "paper", 2);
    const nextGame = { ...game, revision: 4, state };
    view.rerender(<RpsGame game={nextGame} space={space} />);
    expect(sound).toHaveBeenCalledExactlyOnceWith("reveal");

    view.rerender(<RpsGame game={{ ...nextGame }} space={space} />);
    expect(sound).toHaveBeenCalledTimes(1);
  });

  it("can mute for this session when browser storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Storage blocked", "SecurityError");
    });
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    const audioConstructor = vi.fn();
    vi.stubGlobal("AudioContext", audioConstructor);
    render(<SoundToggle />);

    fireEvent.click(screen.getByRole("button", { name: "Sound on" }));

    expect(screen.getByRole("button", { name: "Sound off" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    playSound("tap");
    expect(audioConstructor).not.toHaveBeenCalled();
  });

  it("still sends a move when browser audio cannot start", () => {
    vi.stubGlobal("matchMedia", vi.fn().mockReturnValue({ matches: false }));
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new DOMException("Audio unavailable", "NotSupportedError");
        }
      },
    );
    render(
      <TicBoard
        game={{
          id: "tic",
          kind: "tic",
          revision: 0,
          createdAt: "2026-11-15T00:00:00Z",
          state: initialTic(["a", "b"]),
        }}
        space={space}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Row 1, column 1: empty" }),
    );

    expect(runAction).toHaveBeenCalledWith("/api/games/tic/moves", {
      cell: 0,
      revision: 0,
    });
  });

  it("strikes through the winning line in tic-tac-toe", () => {
    let state = initialTic(["a", "b"]);
    for (const [player, cell] of [
      ["a", 0],
      ["b", 3],
      ["a", 1],
      ["b", 4],
      ["a", 2],
    ] as const)
      state = playTic(state, player, cell);
    const view = render(
      <TicBoard
        game={{
          id: "tic",
          kind: "tic",
          revision: 5,
          createdAt: "2026-11-15T00:00:00Z",
          state,
        }}
        space={space}
      />,
    );
    expect(view.container.querySelector(".tic-strike line")).not.toBeNull();
    expect(view.container.querySelectorAll(".tic-winning")).toHaveLength(3);
  });

  it("keeps a running record and counts games waiting on you", () => {
    const won = (id: string, winner: string): Game => ({
      id,
      kind: "tic",
      revision: 5,
      createdAt: `2026-11-1${id.length}T00:00:00Z`,
      state: { ...initialTic(["a", "b"]), winner },
    });
    const live: Game = {
      id: "live",
      kind: "tic",
      revision: 0,
      createdAt: "2026-11-16T00:00:00Z",
      state: initialTic(["a", "b"]),
    };
    render(
      <GamesPanel
        space={{
          ...space,
          games: [won("w1", "a"), won("w22", "a"), won("w333", "b"), live],
        }}
      />,
    );
    expect(
      screen.getByText("1 game is waiting on your move."),
    ).toBeInTheDocument();
    const board = screen.getByRole("article", { name: "Tic-tac-toe" });
    expect(within(board).getByText("Your move")).toBeInTheDocument();
    expect(within(board).getByText("1 win")).toBeInTheDocument();
  });
});
