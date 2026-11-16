// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import PlansPage from "../../src/features/plans/plans-page";
import type { SpaceSnapshot } from "../../src/shared/types";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  replace: vi.fn(),
  push: vi.fn(),
  useSpace: vi.fn(),
  search: "",
}));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mocks.search),
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));
vi.mock("@/components/space-provider", () => ({
  useSpace: mocks.useSpace,
  useAction: () => ({ run: mocks.run, pending: false, error: null }),
}));
const me = {
  id: "alex",
  name: "Alex",
  timeZone: "America/Chicago",
  color: "#293b80",
  availableFrom: 17,
  availableTo: 22,
};
const space: SpaceSnapshot = {
  space: {
    id: "space",
    name: "Our space",
    createdAt: "2026-11-15T00:00:00Z",
    isDemo: false,
  },
  me,
  members: [me],
  entries: [],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
const originalShow = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "showModal",
);
const originalClose = Object.getOwnPropertyDescriptor(
  HTMLDialogElement.prototype,
  "close",
);
beforeEach(() => {
  mocks.run.mockReset();
  mocks.run.mockResolvedValue({ ok: true });
  mocks.replace.mockReset();
  mocks.push.mockReset();
  mocks.search = "";
  mocks.useSpace.mockReturnValue({ data: space });
  // jsdom has no top-layer implementation. Exercise the component's modal lifecycle;
  // browser focus trapping and inertness are supplied by native showModal.
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = true;
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, "close", {
    configurable: true,
    value: function (this: HTMLDialogElement) {
      this.open = false;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  for (const [name, descriptor] of [
    ["showModal", originalShow],
    ["close", originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

describe("plan dialog", () => {
  it("focuses the plan title after the native dialog chooses its first control", async () => {
    const user = userEvent.setup();
    Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
      configurable: true,
      value: function (this: HTMLDialogElement) {
        this.open = true;
        this.querySelector<HTMLButtonElement>("button")?.focus();
      },
    });
    render(<PlansPage />);
    const opener = screen.getByRole("button", { name: "New plan" });
    await user.click(opener);
    expect(screen.getByLabelText("What would you like to do?")).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(opener).toHaveFocus();
  });

  it("opens a named native modal and handles Escape cancellation without saving", async () => {
    const user = userEvent.setup();
    render(<PlansPage />);
    await user.click(screen.getByRole("button", { name: "New plan" }));
    const dialog = screen.getByRole("dialog", { name: "New plan" });
    expect(dialog.tagName).toBe("DIALOG");
    expect(dialog).toHaveAttribute("open");
    expect(
      within(dialog).getByLabelText("What would you like to do?"),
    ).toBeInTheDocument();
    fireEvent(
      dialog,
      new Event("cancel", { bubbles: false, cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("preserves suggested activity values and clears the URL on Cancel", async () => {
    mocks.search = "title=Cook%20together&duration=45";
    const user = userEvent.setup();
    render(<PlansPage />);
    const dialog = screen.getByRole("dialog", { name: "New plan" });
    expect(
      within(dialog).getByLabelText("What would you like to do?"),
    ).toHaveValue("Cook together");
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
    expect(
      await screen.findByText("Give the plan a name."),
    ).toBeInTheDocument();
    expect(mocks.run).not.toHaveBeenCalled();
    await user.type(
      screen.getByLabelText(/^What would you like to do\?/),
      "Make dinner",
    );
    await user.click(screen.getByRole("button", { name: "Suggest this time" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mocks.run).toHaveBeenCalledWith(
      "/api/plans",
      expect.objectContaining({
        title: "Make dinner",
        duration: 30,
        kind: "date",
        timeZone: "America/Chicago",
      }),
      "POST",
    );
  });
  it("keeps the dialog and draft available while a save is pending or fails", async () => {
    const user = userEvent.setup();
    let rejectSave!: (error: Error) => void;
    mocks.run.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectSave = reject;
      }),
    );
    render(<PlansPage />);
    await user.click(screen.getByRole("button", { name: "New plan" }));
    const dialog = screen.getByRole("dialog", { name: "New plan" });
    const title = screen.getByLabelText("What would you like to do?");
    await user.type(title, "Watch the same film");
    await user.click(screen.getByRole("button", { name: "Suggest this time" }));
    expect(title).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(dialog).toBeInTheDocument();
    fireEvent.click(dialog, { clientX: -1, clientY: -1 });
    expect(dialog).toBeInTheDocument();
    fireEvent.submit(title.closest("form")!);
    expect(mocks.run).toHaveBeenCalledOnce();
    await act(async () => rejectSave(new Error("Connection lost")));
    expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
    expect(title).toBeEnabled();
    expect(title).toHaveValue("Watch the same film");
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("shows an actionable error when the date is cleared", async () => {
    const user = userEvent.setup();
    render(<PlansPage />);
    await user.click(screen.getByRole("button", { name: "New plan" }));
    await user.type(
      screen.getByLabelText("What would you like to do?"),
      "Call",
    );
    fireEvent.change(screen.getByLabelText("Date and time"), {
      target: { value: "" },
    });
    await user.click(screen.getByRole("button", { name: "Suggest this time" }));
    expect(await screen.findByText("Choose a date and time.")).toBeVisible();
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("retains an existing plan’s time zone after both people change their profile zones", async () => {
    const user = userEvent.setup();
    const plan = {
      id: "old-zone",
      title: "Call from Tokyo",
      startsAt: "2026-11-20T23:30:00Z",
      timeZone: "Asia/Tokyo",
      duration: 30,
      kind: "call" as const,
      status: "proposed" as const,
      proposedBy: me.id,
      acceptedBy: [me.id],
      notes: "",
      link: "",
      checklist: [],
    };
    mocks.useSpace.mockReturnValue({ data: { ...space, plans: [plan] } });
    render(<PlansPage />);
    await user.click(screen.getByRole("button", { name: "Suggest a change" }));
    expect(screen.getByRole("combobox", { name: "Time zone" })).toHaveValue(
      "Asia/Tokyo",
    );
    await user.click(
      screen.getByRole("button", { name: "Send the suggestion" }),
    );
    expect(mocks.run).toHaveBeenCalledWith(
      "/api/plans/old-zone",
      expect.objectContaining({
        startsAt: "2026-11-20T23:30:00Z",
        timeZone: "Asia/Tokyo",
      }),
      "PATCH",
    );
  });

  it("shows relative countdown badges on upcoming plans and jumps to shared free hours in Availability", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-15T18:00:00Z"));
    const user = userEvent.setup();
    const tomorrow = "2026-11-16T18:00:00Z";
    const partner = {
      ...me,
      id: "sam",
      name: "Sam",
      timeZone: "Europe/London",
      availableFrom: 23,
      availableTo: 4,
    };
    mocks.useSpace.mockReturnValue({
      data: {
        ...space,
        members: [me, partner],
        plans: [
          {
            id: "soon",
            title: "Morning catch-up",
            startsAt: tomorrow,
            timeZone: me.timeZone,
            duration: 30,
            kind: "call",
            status: "accepted",
            proposedBy: me.id,
            acceptedBy: [me.id, partner.id],
            notes: "",
            link: "",
            checklist: [],
          },
        ],
      },
    });
    render(<PlansPage />);
    expect(screen.getByText("Tomorrow")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Find a time" }));
    await user.click(
      screen.getByRole("button", {
        name: "Sam: Sun, Nov 15, 4:00 PM GMT: busy",
      }),
    );
    expect(screen.getByRole("slider")).toHaveValue("10");
    await user.click(screen.getByRole("button", { name: "Next shared hour" }));
    expect(screen.getByRole("slider")).toHaveValue("17");
    expect(
      screen.getByRole("button", {
        name: "Sam: Sun, Nov 15, 11:00 PM GMT: free",
      }),
    ).toHaveAttribute("aria-pressed", "true");
  });
});
