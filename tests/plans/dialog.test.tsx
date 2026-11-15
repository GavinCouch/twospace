// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import PlansPage from "../../src/features/plans/plans-page";
import type { SpaceSnapshot } from "../../src/shared/types";

const mocks = vi.hoisted(() => ({ run: vi.fn(), replace: vi.fn(), push: vi.fn(), useSpace: vi.fn(), search: "" }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams(mocks.search), useRouter: () => ({ replace: mocks.replace, push: mocks.push }) }));
vi.mock("@/components/space-provider", () => ({ useSpace: mocks.useSpace, useAction: () => ({ run: mocks.run, pending: false, error: null }) }));
const me = { id: "alex", name: "Alex", timeZone: "America/Chicago", color: "#293b80", availableFrom: 17, availableTo: 22 };
const space: SpaceSnapshot = { space: { id: "space", name: "Our space", createdAt: "2026-11-15T00:00:00Z", isDemo: false }, me, members: [me], entries: [], photoPairs: [], questions: [], games: [], drawings: [], ideas: [], plans: [] };
const originalShow = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "showModal");
const originalClose = Object.getOwnPropertyDescriptor(HTMLDialogElement.prototype, "close");
beforeEach(() => {
  mocks.run.mockReset(); mocks.run.mockResolvedValue({ ok: true });
  mocks.replace.mockReset(); mocks.push.mockReset(); mocks.search = "";
  mocks.useSpace.mockReturnValue({ data: space });
  // jsdom has no top-layer implementation. Exercise the component's modal lifecycle;
  // browser focus trapping and inertness are supplied by native showModal.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.open = false; } });
});
afterEach(() => {
  cleanup();
  for (const [name, descriptor] of [["showModal", originalShow], ["close", originalClose]] as const) {
    if (descriptor) Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe("plan dialog", () => {
  it("opens a named native modal and handles Escape cancellation without saving", async () => {
    const user = userEvent.setup();
    render(<PlansPage />);
    await user.click(screen.getByRole("button", { name: "New plan" }));
    const dialog = screen.getByRole("dialog", { name: "New plan" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(within(dialog).getByLabelText("What would you like to do?")).toBeInTheDocument();
    fireEvent(dialog, new Event("cancel", { bubbles: false, cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("preserves suggested activity values and clears the URL on Cancel", async () => {
    mocks.search = "title=Cook%20together&duration=45";
    const user = userEvent.setup();
    render(<PlansPage />);
    const dialog = screen.getByRole("dialog", { name: "New plan" });
    expect(within(dialog).getByLabelText("What would you like to do?")).toHaveValue("Cook together");
    expect(within(dialog).getByLabelText("Minutes")).toHaveValue(45);
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.replace).toHaveBeenCalledWith("/plans");
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("keeps validation in the form and closes only after a successful save", async () => {
    const user = userEvent.setup();
    render(<PlansPage />);
    await user.click(screen.getByRole("button", { name: "New plan" }));
    await user.click(screen.getByRole("button", { name: "Suggest this time" }));
    expect(await screen.findByText("Give the plan a name.")).toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/^What would you like to do\?/), "Make dinner");
    await user.click(screen.getByRole("button", { name: "Suggest this time" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mocks.run).toHaveBeenCalledWith("/api/plans", expect.objectContaining({ title: "Make dinner", duration: 30, kind: "date", timeZone: "America/Chicago" }), "POST");
  });
});
