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
import { PlanChecklist } from "../../src/features/plans/plan-checklist";
import type { Plan } from "../../src/shared/types";

const action = vi.hoisted(() => ({
  run: vi.fn(),
  pending: false,
  error: null as string | null,
}));
vi.mock("@/components/space-provider", () => ({ useAction: () => action }));

const plan: Plan = {
  id: "dinner",
  title: "Make dinner",
  startsAt: "2026-11-16T00:00:00Z",
  timeZone: "America/Chicago",
  duration: 60,
  kind: "date",
  status: "accepted",
  proposedBy: "alex",
  acceptedBy: ["alex", "sam"],
  link: "",
  notes: "",
  checklist: [
    { id: "recipe", text: "Choose a recipe", done: true },
    { id: "ingredients", text: "Get ingredients", done: false },
  ],
};
const readyPlan = (): Plan => ({
  ...plan,
  checklist: plan.checklist.map((item) => ({ ...item, done: true })),
});

beforeEach(() => {
  action.run.mockReset();
  action.pending = false;
  action.error = null;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("plan checklist feedback", () => {
  it("locks a submitted item while saving and preserves its text for a failed retry", async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    action.run.mockImplementation(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        }),
    );
    const view = render(<PlanChecklist plan={plan} />);
    const input = screen.getByRole("textbox", { name: "Checklist item" });
    await user.type(input, "Chop vegetables");
    await user.click(
      screen.getByRole("button", { name: "Add checklist item" }),
    );
    action.pending = true;
    view.rerender(<PlanChecklist plan={plan} />);
    expect(input).toHaveAttribute("readonly");
    await user.type(input, " and buy bread");
    expect(input).toHaveValue("Chop vegetables");

    await act(async () => {
      reject(new Error("Could not save"));
    });
    action.pending = false;
    action.error = "Could not save";
    view.rerender(<PlanChecklist plan={plan} />);
    expect(input).not.toHaveAttribute("readonly");
    expect(input).toHaveValue("Chop vegetables");
    await user.type(input, " tonight");
    expect(input).toHaveValue("Chop vegetables tonight");
  });

  it("shows saved progress without celebrating an already completed checklist", () => {
    render(<PlanChecklist plan={readyPlan()} />);
    expect(
      screen.getByRole("progressbar", { name: "Checklist progress" }),
    ).toHaveAttribute("aria-valuenow", "2");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(
      screen.getByRole("checkbox", { name: "Get ingredients" }),
    ).toBeChecked();
  });

  it("waits for a successful toggle to settle before acknowledging completion", async () => {
    let resolve!: () => void;
    action.run.mockImplementation(
      () =>
        new Promise<void>((done) => {
          resolve = done;
        }),
    );
    const view = render(<PlanChecklist plan={plan} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Get ingredients" }));
    expect(action.run).toHaveBeenCalledWith(
      "/api/plans/dinner",
      {
        checklistAction: { type: "toggle", id: "ingredients", text: undefined },
      },
      "PATCH",
    );
    expect(
      screen.getByRole("checkbox", { name: "Get ingredients" }),
    ).not.toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    // A refetch can deliver the saved checklist before useAction finishes.
    action.pending = true;
    view.rerender(<PlanChecklist plan={readyPlan()} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    expect(
      screen.getByRole("checkbox", { name: "Get ingredients" }),
    ).toBeDisabled();

    await act(async () => {
      resolve();
    });
    action.pending = false;
    view.rerender(<PlanChecklist plan={readyPlan()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checklist complete.");
  });

  it("does not announce completion when saving fails", async () => {
    action.run.mockRejectedValue(new Error("Could not save"));
    const view = render(<PlanChecklist plan={plan} />);
    await act(async () => {
      fireEvent.click(
        screen.getByRole("checkbox", { name: "Get ingredients" }),
      );
    });
    action.error = "Could not save";
    view.rerender(<PlanChecklist plan={{ ...plan }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Could not save");
    expect(
      screen.getByRole("checkbox", { name: "Get ingredients" }),
    ).not.toBeChecked();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });

  it("ends completion feedback once and does not restart it on unchanged polling", () => {
    vi.useFakeTimers();
    const view = render(<PlanChecklist plan={plan} />);
    view.rerender(<PlanChecklist plan={readyPlan()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Checklist complete.");
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    view.rerender(<PlanChecklist plan={readyPlan()} />);
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
    view.rerender(<PlanChecklist plan={readyPlan()} />);
    expect(screen.getByRole("status")).toBeEmptyDOMElement();
  });
});
