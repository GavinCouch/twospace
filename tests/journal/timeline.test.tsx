// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import JournalPage from "../../src/features/journal/journal-page";
import { groupJournalDays } from "../../src/features/journal/journal-utils";
import { useRevealClock } from "../../src/features/journal/use-reveal-clock";
import type { Entry, SpaceSnapshot } from "../../src/shared/types";

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  refetch: vi.fn(),
}));
vi.mock("@/components/space-provider", () => ({
  useSpace: () => state.query,
  useAction: () => ({
    run: vi.fn(),
    pending: false,
    error: null,
    clearError: vi.fn(),
  }),
}));

const me = {
  id: "maya",
  name: "Maya",
  timeZone: "America/Chicago",
  color: "#edb7c7",
  availableFrom: 17,
  availableTo: 22,
};
const partner = { ...me, id: "theo", name: "Theo" };
function entry(
  id: string,
  createdAt: string,
  overrides: Partial<Entry> = {},
): Entry {
  return {
    id,
    createdAt,
    authorId: me.id,
    kind: "note",
    title: "",
    body: id,
    pinned: false,
    collection: "",
    reactions: [],
    replies: [],
    ...overrides,
  };
}
const newest = entry("morning-note", "2026-11-15T15:00:00Z", {
  body: "The bakery was open.",
  pinned: true,
  collection: "Weekends",
});
const photo = entry("older-photo", "2026-11-15T07:00:00Z", {
  kind: "photo",
  mediaId: "bakery-photo",
  body: "Outside the bakery",
});
const previousDay = entry("evening-note", "2026-11-15T05:00:00Z", {
  body: "See you tomorrow.",
});
const snapshot: SpaceSnapshot = {
  space: {
    id: "space",
    name: "Our space",
    createdAt: "2026-11-01T12:00:00Z",
    isDemo: false,
  },
  me,
  members: [me, partner],
  entries: [photo, previousDay, newest],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
beforeEach(() => {
  sessionStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  state.query = {
    data: snapshot,
    isPending: false,
    error: null,
    refetch: state.refetch,
  };
  state.refetch.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("journal day grouping", () => {
  it("keeps mixed entry types in chronological order and groups midnight in the reader's time zone", () => {
    const source = [photo, previousDay, newest];
    const groups = groupJournalDays(source, "America/Chicago");
    expect(
      groups.map((group) => [group.key, group.entries.map((item) => item.id)]),
    ).toEqual([
      ["2026-11-15", ["morning-note", "older-photo"]],
      ["2026-11-14", ["evening-note"]],
    ]);
    expect(source).toEqual([photo, previousDay, newest]);
    expect(groupJournalDays(source, "Europe/London")).toHaveLength(1);
  });
  it("keeps entries from different years in separate days", () => {
    const groups = groupJournalDays(
      [
        newest,
        { ...newest, id: "last-year", createdAt: "2025-11-15T15:00:00Z" },
      ],
      "UTC",
    );
    expect(groups.map((group) => group.label)).toEqual([
      "Nov 15, 2026",
      "Nov 15, 2025",
    ]);
  });
});

describe("journal feed", () => {
  it("renders notes before older photos instead of choosing a featured photo", () => {
    render(<JournalPage />);
    expect(screen.getAllByRole("article").map((element) => element.id)).toEqual(
      ["entry-morning-note", "entry-older-photo", "entry-evening-note"],
    );
    expect(
      screen.getByRole("heading", { name: "Nov 14, 2026 Saturday" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "View full photo" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Reply" })).toHaveLength(3);
  });
  it("filters the feed and keeps those filters when switching to photo pairs and back", async () => {
    const user = userEvent.setup();
    render(<JournalPage />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by collection" }),
      "Weekends",
    );
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("tab", { name: "Photo pairs" }));
    expect(
      screen.getByRole("button", { name: "Start a pair" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("The bakery was open.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Entries" }));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(
      screen.getByRole("combobox", { name: "Filter by collection" }),
    ).toHaveValue("Weekends");
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
  it("switches journal views with the keyboard", async () => {
    const user = userEvent.setup();
    render(<JournalPage />);
    const entries = screen.getByRole("tab", { name: "Entries" });
    entries.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Photo pairs" })).toHaveFocus();
    expect(
      screen.getByRole("tabpanel", { name: "Photo pairs" }),
    ).toBeInTheDocument();
    await user.keyboard("{Home}");
    expect(entries).toHaveFocus();
    expect(entries).toHaveAttribute("aria-selected", "true");
  });
  it("returns to the unfiltered entries after saving from Photo pairs", async () => {
    const user = userEvent.setup();
    render(<JournalPage />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search the journal" }),
      "bakery",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by collection" }),
      "Weekends",
    );
    await user.click(screen.getByRole("button", { name: "Pinned" }));
    await user.click(screen.getByRole("tab", { name: "Photo pairs" }));
    await user.click(screen.getByRole("button", { name: "New entry" }));
    await user.type(
      screen.getByRole("textbox", { name: /Your note/ }),
      "We should try that again.",
    );
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("tab", { name: "Entries" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(
      screen.getByRole("searchbox", { name: "Search the journal" }),
    ).toHaveValue("");
    expect(
      screen.getByRole("combobox", { name: "Filter by collection" }),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: "Pinned" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });
  it("leaves the active view and filters alone when a new entry is canceled", async () => {
    const user = userEvent.setup();
    render(<JournalPage />);
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by collection" }),
      "Weekends",
    );
    await user.click(screen.getByRole("tab", { name: "Photo pairs" }));
    await user.click(screen.getByRole("button", { name: "New entry" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("tab", { name: "Photo pairs" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("tab", { name: "Entries" }));
    expect(
      screen.getByRole("combobox", { name: "Filter by collection" }),
    ).toHaveValue("Weekends");
    expect(screen.getAllByRole("article")).toHaveLength(1);
  });
  it("keeps future and locked notes out of the dated feed and excludes their contents from search", async () => {
    const user = userEvent.setup();
    const later = entry("later", "2026-11-15T16:00:00Z", {
      locked: true,
      body: "",
      revealAt: "2099-01-01T12:00:00Z",
    });
    const scheduled = entry("scheduled", "2026-11-15T17:00:00Z", {
      body: "A note for your birthday.",
      revealAt: "2099-02-01T12:00:00Z",
    });
    state.query = {
      ...state.query,
      data: { ...snapshot, entries: [later, scheduled, ...snapshot.entries] },
    };
    render(<JournalPage />);
    const today = screen.getByRole("region", { name: "Nov 15, 2026 Sunday" });
    expect(within(today).getAllByRole("article")).toHaveLength(2);
    expect(
      screen.getByText("For later").closest("details"),
    ).not.toHaveAttribute("open");
    await user.click(screen.getByText("For later"));
    expect(
      screen.getByRole("heading", { name: "A note for later" }),
    ).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Filter" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search the journal" }),
      "birthday",
    );
    expect(
      screen.queryByRole("heading", { name: "A note for later" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("A note for your birthday.")).toBeVisible();
  });
  it("offers retry when loading fails", async () => {
    const user = userEvent.setup();
    state.query = {
      data: undefined,
      isPending: false,
      error: new Error("Connection lost."),
      refetch: state.refetch,
    };
    render(<JournalPage />);
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(state.refetch).toHaveBeenCalledOnce();
  });
  it("moves an author's scheduled note into the feed at its opening time without a changed snapshot", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
    const scheduled = entry("opening-soon", "2026-11-15T14:00:00Z", {
      body: "A note for this morning.",
      revealAt: "2026-11-15T15:01:00Z",
    });
    state.query = {
      ...state.query,
      data: { ...snapshot, entries: [scheduled] },
    };
    render(<JournalPage />);
    expect(screen.getByText("For later")).toBeVisible();
    expect(screen.getByText("A note for this morning.")).not.toBeVisible();
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.queryByText("For later")).not.toBeInTheDocument();
    expect(screen.getByText("A note for this morning.")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Nov 15, 2026 Sunday" }),
    ).toBeInTheDocument();
  });
  it("caps long reveal waits and clears their timer on unmount", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T15:00:00Z"));
    const future = [
      entry("far-away", "2026-11-15T14:00:00Z", {
        revealAt: "2099-01-01T12:00:00Z",
      }),
    ];
    const { result, unmount } = renderHook(() => useRevealClock(future));
    const initial = result.current;
    act(() => vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(initial + 60_000);
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
