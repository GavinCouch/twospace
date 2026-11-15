// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { EntryConversation } from "../../src/features/journal/entry-conversation";
import { useEntryArrivals } from "../../src/features/journal/use-entry-arrivals";
import type { Entry } from "../../src/shared/types";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", async () => {
  const { useState } = await import("react");
  return {
    useAction: () => {
      const [pending, setPending] = useState(false);
      return {
        run: async (...args: unknown[]) => {
          setPending(true);
          try { return await request(...args); }
          finally { setPending(false); }
        },
        pending,
        error: null,
        clearError: vi.fn(),
      };
    },
  };
});
const me = { id: "alex", name: "Alex", timeZone: "America/Chicago", color: "#293b80", availableFrom: 17, availableTo: 22 };
const entry: Entry = { id: "note-1", authorId: "alex", kind: "note", title: "", body: "Our afternoon walk.", createdAt: "2026-11-15T12:00:00Z", collection: "", pinned: false, reactions: [], replies: [] };

beforeEach(() => request.mockReset());
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("journal interaction feedback", () => {
  it("pops a heart only after a successful addition and keeps the same icon through polling and removal", async () => {
    let resolve!: (value: Entry) => void;
    request.mockReturnValueOnce(new Promise<Entry>(done => { resolve = done; }));
    const { rerender } = render(<EntryConversation entry={entry} members={[me]} me={me} />);
    const heart = screen.getByRole("button", { name: "Send a heart" });
    const initialIcon = heart.querySelector("svg");
    fireEvent.click(heart);
    expect(initialIcon).not.toHaveClass("journal-heart-pop");

    const reacted = { ...entry, reactions: [me.id] };
    await act(async () => { resolve(reacted); });
    rerender(<EntryConversation entry={reacted} members={[me]} me={me} />);
    const sentIcon = heart.querySelector("svg");
    expect(sentIcon).toHaveClass("journal-heart-pop");
    expect(sentIcon).not.toBe(initialIcon);

    rerender(<EntryConversation entry={{ ...reacted, reactions: [...reacted.reactions] }} members={[me]} me={me} />);
    expect(heart.querySelector("svg")).toBe(sentIcon);

    request.mockResolvedValueOnce(entry);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Remove your heart" })); });
    rerender(<EntryConversation entry={entry} members={[me]} me={me} />);
    expect(heart.querySelector("svg")).toBe(sentIcon);
    expect(heart).toHaveAttribute("aria-pressed", "false");
  });

  it("does not pop failed reactions or hearts received through polling", async () => {
    request.mockRejectedValueOnce(new Error("Offline"));
    const { rerender } = render(<EntryConversation entry={entry} members={[me]} me={me} />);
    const heart = screen.getByRole("button", { name: "Send a heart" });
    await act(async () => { fireEvent.click(heart); });
    expect(heart.querySelector("svg")).not.toHaveClass("journal-heart-pop");

    rerender(<EntryConversation entry={{ ...entry, reactions: [me.id] }} members={[me]} me={me} />);
    expect(heart).toHaveAttribute("aria-pressed", "true");
    expect(heart.querySelector("svg")).not.toHaveClass("journal-heart-pop");
  });

  it("does not celebrate a request that the server confirms removed a heart", async () => {
    request.mockResolvedValueOnce(entry);
    render(<EntryConversation entry={entry} members={[me]} me={me} />);
    const heart = screen.getByRole("button", { name: "Send a heart" });
    await act(async () => { fireEvent.click(heart); });
    expect(heart.querySelector("svg")).not.toHaveClass("journal-heart-pop");
  });

  it("preserves reply drafts through closing, polling and failure, then confirms a successful send", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<EntryConversation entry={entry} members={[me]} me={me} />);
    const replyToggle = screen.getByRole("button", { name: "Reply" });
    await user.click(replyToggle);
    await user.type(screen.getByRole("textbox", { name: "Your reply" }), "Let's take that route again.");
    await user.click(replyToggle);
    rerender(<EntryConversation entry={{ ...entry, reactions: [me.id] }} members={[me]} me={me} />);
    await user.click(replyToggle);
    const draft = screen.getByRole("textbox", { name: "Your reply" });
    expect(draft).toHaveValue("Let's take that route again.");

    request.mockRejectedValueOnce(new Error("Offline"));
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(request).toHaveBeenCalledOnce());
    expect(draft).toHaveValue("Let's take that route again.");
    expect(screen.getByRole("status")).toBeEmptyDOMElement();

    request.mockResolvedValueOnce(entry);
    await user.click(screen.getByRole("button", { name: "Send reply" }));
    await waitFor(() => expect(draft).toHaveValue(""));
    expect(screen.getByRole("status")).toHaveTextContent("Reply added.");
    expect(screen.getByRole("status")).toBeVisible();
  });

  it("keeps the submitted reply readable but prevents edits that would be discarded while sending", async () => {
    const user = userEvent.setup();
    let resolve!: (value: Entry) => void;
    request.mockReturnValueOnce(new Promise<Entry>(done => { resolve = done; }));
    render(<EntryConversation entry={entry} members={[me]} me={me} />);
    await user.click(screen.getByRole("button", { name: "Reply" }));
    const draft = screen.getByRole("textbox", { name: "Your reply" });
    await user.type(draft, "Let's do that again.");
    await user.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(draft).toHaveAttribute("readonly"));
    expect(draft).toBeEnabled();
    expect(draft.closest("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await user.type(draft, " An unsent afterthought.");
    expect(draft).toHaveValue("Let's do that again.");
    expect(request).toHaveBeenCalledWith(`/api/entries/${entry.id}/replies`, { body: "Let's do that again." });

    await act(async () => { resolve(entry); });
    expect(draft).not.toHaveAttribute("readonly");
    expect(draft).toHaveValue("");
    expect(draft.closest("form")).toHaveAttribute("aria-busy", "false");
    await user.type(draft, "A fresh reply.");
    expect(draft).toHaveValue("A fresh reply.");
  });
});

describe("journal arrivals", () => {
  it("marks additions after the initial snapshot once without replaying on refreshed or restored entries", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ entries, scope }) => useEntryArrivals(entries, scope), {
      initialProps: { entries: undefined as Entry[] | undefined, scope: "space:alex" },
    });
    rerender({ entries: [entry], scope: "space:alex" });
    expect([...result.current]).toEqual([]);
    const added = { ...entry, id: "note-2" };
    rerender({ entries: [added, entry], scope: "space:alex" });
    expect([...result.current]).toEqual(["note-2"]);
    act(() => vi.advanceTimersByTime(650));
    expect([...result.current]).toEqual([]);

    rerender({ entries: [{ ...added }, { ...entry }], scope: "space:alex" });
    expect([...result.current]).toEqual([]);
    rerender({ entries: [entry], scope: "space:alex" });
    rerender({ entries: [added, entry], scope: "space:alex" });
    expect([...result.current]).toEqual([]);
  });

  it("treats another member or space's initial snapshot as the baseline", () => {
    const { result, rerender } = renderHook(({ entries, scope }) => useEntryArrivals(entries, scope), {
      initialProps: { entries: [entry], scope: "space:alex" },
    });
    rerender({ entries: [{ ...entry, id: "other-entry" }], scope: "other-space:sam" });
    expect([...result.current]).toEqual([]);
  });
});
