// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QuestionCard } from "../../src/features/activities/question-round";
import { FourBoard } from "../../src/features/activities/four-board";
import { GamesPanel } from "../../src/features/activities/games-panel";
import { DrawingSurface } from "../../src/features/activities/drawing-surface";
import { initialFour, playFour } from "../../src/shared/four";
import type { QuestionRound, SpaceSnapshot } from "../../src/shared/types";

const request = vi.hoisted(() => vi.fn());
const actionState = vi.hoisted(() => ({ pending: false }));
vi.mock("@/components/space-provider", () => ({
  useAction: () => ({
    run: request,
    pending: actionState.pending,
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
const round: QuestionRound = {
  id: "question",
  prompt: "What made you laugh recently?",
  category: "Today",
  createdAt: "2026-11-15T00:00:00Z",
  answers: [{ userId: "b", body: null }],
  complete: false,
};
beforeEach(() => {
  actionState.pending = false;
  request.mockReset();
  request.mockResolvedValue({});
});
afterEach(cleanup);

describe("activity interactions", () => {
  it("prevents editing or duplicate submission while an answer is saving", async () => {
    const user = userEvent.setup();
    let finishSave!: () => void;
    request.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finishSave = resolve;
      }),
    );
    const view = render(<QuestionCard round={round} space={space} />);
    const input = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(input, "The cat in the empty box");
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    actionState.pending = true;
    view.rerender(<QuestionCard round={round} space={space} />);

    await user.type(input, " and a new thought");
    expect(input).toHaveValue("The cat in the empty box");
    expect(input).toHaveFocus();
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    expect(request).toHaveBeenCalledTimes(1);

    await act(async () => finishSave());
    actionState.pending = false;
    view.rerender(<QuestionCard round={round} space={space} />);
    expect(input).toHaveValue("");
    await user.type(input, "Another answer");
    expect(input).toHaveValue("Another answer");
  });
  it("keeps a question draft when saving fails, then submits the trimmed answer", async () => {
    const user = userEvent.setup();
    request.mockRejectedValueOnce(new Error("Offline"));
    render(<QuestionCard round={round} space={space} />);
    const input = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(input, "  The cat in the empty box  ");
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    expect(input).toHaveValue("  The cat in the empty box  ");
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    expect(request).toHaveBeenLastCalledWith(
      "/api/questions/question/answers",
      { body: "The cat in the empty box" },
    );
    expect(input).toHaveValue("");
  });
  it("shows the server's hidden-answer state until the completed round arrives", () => {
    const view = render(<QuestionCard round={round} space={space} />);
    expect(
      screen.getByText("Answer saved. It opens when you both answer."),
    ).toBeInTheDocument();
    view.rerender(
      <QuestionCard
        round={{
          ...round,
          complete: true,
          answers: [
            { userId: "a", body: "My answer" },
            { userId: "b", body: "Sam’s answer" },
          ],
        }}
        space={space}
      />,
    );
    expect(screen.getByText("Sam’s answer")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    const answers = screen.getByText("Sam’s answer").closest(".answer-pair")!;
    expect(answers).toHaveClass("answers-revealing");
    fireEvent.animationEnd(answers);
    view.rerender(
      <QuestionCard
        round={{
          ...round,
          complete: true,
          answers: [
            { userId: "a", body: "My answer" },
            { userId: "b", body: "Sam’s answer" },
          ],
        }}
        space={space}
      />,
    );
    expect(answers).not.toHaveClass("answers-revealing");
  });
  it("sends the board revision with a move and disables turns that belong to the partner", async () => {
    const user = userEvent.setup();
    const game = {
      id: "game",
      kind: "four" as const,
      revision: 7,
      createdAt: "2026-11-15T00:00:00Z",
      state: initialFour(["a", "b"]),
    };
    const view = render(<FourBoard game={game} space={space} />);
    await user.click(
      screen.getByRole("button", { name: "Drop your piece in column 3" }),
    );
    expect(request).toHaveBeenCalledWith("/api/games/game/moves", {
      column: 2,
      revision: 7,
    });
    view.rerender(
      <FourBoard
        game={{ ...game, state: { ...game.state, turn: "b" } }}
        space={space}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Drop your piece in column 3" }),
    ).toBeDisabled();
  });
  it("drops only a newly confirmed piece and does not replay it on polling", () => {
    const players = ["a", "b"];
    const state = playFour(initialFour(players), "a", 2, players);
    const game = {
      id: "game",
      kind: "four" as const,
      revision: 1,
      createdAt: "2026-11-15T00:00:00Z",
      state,
    };
    const view = render(<FourBoard game={game} space={space} />);
    expect(view.container.querySelector(".four-disc-dropping")).toBeNull();

    const next = {
      ...game,
      revision: 2,
      state: playFour(state, "b", 3, players),
    };
    view.rerender(<FourBoard game={next} space={space} />);
    const landingCell = screen.getByText(
      "Row 6, column 4: Sam.",
    ).parentElement!;
    const piece = landingCell.querySelector(".four-disc")!;
    expect(piece).toHaveClass("four-disc-dropping");
    expect(piece).toHaveStyle({
      "--four-drop-from": "calc(-600% - 6 * var(--four-gap))",
    });
    expect(view.container.querySelectorAll(".four-disc-dropping")).toHaveLength(
      1,
    );
    fireEvent.animationEnd(piece);
    expect(piece).not.toHaveClass("four-disc-dropping");

    view.rerender(<FourBoard game={structuredClone(next)} space={space} />);
    expect(landingCell.querySelector(".four-disc")).toBe(piece);
    expect(piece).not.toHaveClass("four-disc-dropping");
  });
  it("shows a resumed board immediately when several moves arrived together", () => {
    const players = ["a", "b"];
    const game = {
      id: "game",
      kind: "four" as const,
      revision: 0,
      createdAt: "2026-11-15T00:00:00Z",
      state: initialFour(players),
    };
    const view = render(<FourBoard game={game} space={space} />);
    const afterTwo = playFour(
      playFour(game.state, "a", 0, players),
      "b",
      1,
      players,
    );
    view.rerender(
      <FourBoard
        game={{ ...game, revision: 2, state: afterTwo }}
        space={space}
      />,
    );
    expect(view.container.querySelectorAll(".four-disc")).toHaveLength(2);
    expect(view.container.querySelector(".four-disc-dropping")).toBeNull();
  });
  it("keeps the final move visible, then allows finished games to be hidden", async () => {
    const user = userEvent.setup();
    const players = ["a", "b"];
    let state = initialFour(players);
    for (const column of [0, 1, 0, 1, 0, 1])
      state = playFour(state, state.turn, column, players);
    const game = {
      id: "game",
      kind: "four" as const,
      revision: 6,
      createdAt: "2026-11-15T00:00:00Z",
      state,
    };
    const view = render(<GamesPanel space={{ ...space, games: [game] }} />);
    const finished = {
      ...game,
      revision: 7,
      state: playFour(state, "a", 0, players),
    };
    view.rerender(<GamesPanel space={{ ...space, games: [finished] }} />);
    expect(screen.getByText("Alex has four in a row.")).toBeInTheDocument();
    expect(view.container.querySelectorAll(".winning-cell")).toHaveLength(4);
    expect(view.container.querySelectorAll(".four-disc-dropping")).toHaveLength(
      1,
    );

    await user.click(
      screen.getByRole("button", { name: "Include finished games" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Show current games" }),
    );
    expect(
      screen.queryByText("Alex has four in a row."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("No games in progress")).toBeInTheDocument();
  });
  it("can add a positioned shape entirely through keyboard-accessible controls", async () => {
    const user = userEvent.setup();
    const onStroke = vi.fn();
    render(
      <DrawingSurface
        strokes={[]}
        caption="Our garden"
        disabled={false}
        pendingStroke={null}
        onStroke={onStroke}
      />,
    );
    await user.click(screen.getByText("Add a shape with the keyboard"));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Shape" }),
      "square",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Position" }),
      "0",
    );
    const button = screen.getByRole("button", { name: "Add shape" });
    button.focus();
    await user.keyboard("{Enter}");
    expect(onStroke).toHaveBeenCalledWith(
      expect.objectContaining({
        tool: "square",
        points: [
          { x: 165, y: 90 },
          { x: 235, y: 160 },
        ],
      }),
    );
  });
});
