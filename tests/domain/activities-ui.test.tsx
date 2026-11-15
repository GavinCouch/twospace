// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { QuestionCard } from "../../src/features/activities/question-round";
import { FourBoard } from "../../src/features/activities/four-board";
import { DrawingSurface } from "../../src/features/activities/drawing-surface";
import { initialFour } from "../../src/shared/four";
import type { QuestionRound, SpaceSnapshot } from "../../src/shared/types";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", () => ({ useAction: () => ({ run: request, pending: false, error: null, clearError: vi.fn() }) }));
const people = [
  { id: "a", name: "Alex", timeZone: "America/Chicago", color: "#245c55", availableFrom: 17, availableTo: 22 },
  { id: "b", name: "Sam", timeZone: "Europe/London", color: "#d78069", availableFrom: 17, availableTo: 22 },
];
const space: SpaceSnapshot = {
  space: { id: "space", name: "Our space", createdAt: "2026-11-15T00:00:00Z", isDemo: true },
  me: people[0], members: people, entries: [], photoPairs: [], questions: [], games: [], drawings: [], ideas: [], plans: [],
};
const round: QuestionRound = { id: "question", prompt: "What made you laugh recently?", category: "Today", createdAt: "2026-11-15T00:00:00Z", answers: [{ userId: "b", body: null }], complete: false };
beforeEach(() => { request.mockReset(); request.mockResolvedValue({}); });
afterEach(cleanup);

describe("activity interactions", () => {
  it("keeps a question draft when saving fails, then submits the trimmed answer", async () => {
    const user = userEvent.setup();
    request.mockRejectedValueOnce(new Error("Offline"));
    render(<QuestionCard round={round} space={space} />);
    const input = screen.getByRole("textbox", { name: "Your answer" });
    await user.type(input, "  The cat in the empty box  ");
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    expect(input).toHaveValue("  The cat in the empty box  ");
    await user.click(screen.getByRole("button", { name: "Save my answer" }));
    expect(request).toHaveBeenLastCalledWith("/api/questions/question/answers", { body: "The cat in the empty box" });
    expect(input).toHaveValue("");
  });
  it("shows the server's hidden-answer state until the completed round arrives", () => {
    const view = render(<QuestionCard round={round} space={space} />);
    expect(screen.getByText("Answer saved. It opens when you both answer.")).toBeInTheDocument();
    view.rerender(<QuestionCard round={{ ...round, complete: true, answers: [{ userId: "a", body: "My answer" }, { userId: "b", body: "Sam’s answer" }] }} space={space} />);
    expect(screen.getByText("Sam’s answer")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });
  it("sends the board revision with a move and disables turns that belong to the partner", async () => {
    const user = userEvent.setup();
    const game = { id: "game", kind: "four" as const, revision: 7, createdAt: "2026-11-15T00:00:00Z", state: initialFour(["a", "b"]) };
    const view = render(<FourBoard game={game} space={space} />);
    await user.click(screen.getByRole("button", { name: "Drop your piece in column 3" }));
    expect(request).toHaveBeenCalledWith("/api/games/game/moves", { column: 2, revision: 7 });
    view.rerender(<FourBoard game={{ ...game, state: { ...game.state, turn: "b" } }} space={space} />);
    expect(screen.getByRole("button", { name: "Drop your piece in column 3" })).toBeDisabled();
  });
  it("can add a positioned shape entirely through keyboard-accessible controls", async () => {
    const user = userEvent.setup();
    const onStroke = vi.fn();
    render(<DrawingSurface strokes={[]} caption="Our garden" disabled={false} pendingStroke={null} onStroke={onStroke} />);
    await user.click(screen.getByText("Add a shape with the keyboard"));
    await user.selectOptions(screen.getByRole("combobox", { name: "Shape" }), "square");
    await user.selectOptions(screen.getByRole("combobox", { name: "Position" }), "0");
    const button = screen.getByRole("button", { name: "Add shape" });
    button.focus(); await user.keyboard("{Enter}");
    expect(onStroke).toHaveBeenCalledWith(expect.objectContaining({ tool: "square", points: [{ x: 165, y: 90 }, { x: 235, y: 160 }] }));
  });
});
