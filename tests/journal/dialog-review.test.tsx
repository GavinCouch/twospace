// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { JournalDialog } from "../../src/features/journal/journal-dialog";
import { EntryOptions } from "../../src/features/journal/entry-options";
import type { Entry } from "../../src/shared/types";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", async () => {
  const { useState } = await import("react");
  return {
    useAction: () => {
      const [pending, setPending] = useState(false);
      const [error, setError] = useState<string | null>(null);
      return {
        run: async (...args: unknown[]) => {
          setPending(true);
          setError(null);
          try {
            return await request(...args);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Save failed");
            throw cause;
          } finally {
            setPending(false);
          }
        },
        pending,
        error,
        clearError: () => setError(null),
      };
    },
  };
});

const entry: Entry = {
  id: "note-1",
  authorId: "person-1",
  kind: "note",
  title: "Sunday",
  body: "Coffee together.",
  createdAt: "2026-11-15T12:00:00Z",
  collection: "Weekends",
  pinned: false,
  reactions: [],
  replies: [],
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
  request.mockReset();
  request.mockResolvedValue(entry);
  // Native focus trapping is browser-owned; jsdom exercises explicit focus and cleanup.
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
  for (const [name, descriptor] of [
    ["showModal", originalShow],
    ["close", originalClose],
  ] as const) {
    if (descriptor)
      Object.defineProperty(HTMLDialogElement.prototype, name, descriptor);
    else Reflect.deleteProperty(HTMLDialogElement.prototype, name);
  }
});

function DialogExample() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>New entry</button>
      {open && (
        <JournalDialog title="New entry" onClose={() => setOpen(false)}>
          <label>
            Note
            <textarea data-initial-focus />
          </label>
        </JournalDialog>
      )}
    </>
  );
}

describe("journal dialog review", () => {
  it("only dismisses a pointer gesture that begins and ends on the backdrop", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const opener = screen.getByRole("button", { name: "New entry" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 100, 300, 300),
    );

    await user.pointer({
      keys: "[MouseLeft]",
      target: dialog,
      coords: { clientX: 110, clientY: 110 },
    });
    expect(dialog).toBeInTheDocument();

    await user.pointer([
      {
        keys: "[MouseLeft>]",
        target: dialog,
        coords: { clientX: 110, clientY: 110 },
      },
      {
        keys: "[/MouseLeft]",
        target: dialog,
        coords: { clientX: 50, clientY: 50 },
      },
    ]);
    expect(dialog).toBeInTheDocument();

    await user.pointer({
      keys: "[MouseLeft]",
      target: dialog,
      coords: { clientX: 50, clientY: 50 },
    });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("keeps the dialog open for backdrop gestures while busy", async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <JournalDialog title="Saving" onClose={close} busy>
        Saving…
      </JournalDialog>,
    );
    const dialog = screen.getByRole("dialog");
    vi.spyOn(dialog, "getBoundingClientRect").mockReturnValue(
      new DOMRect(100, 100, 300, 300),
    );
    await user.pointer({
      keys: "[MouseLeft]",
      target: dialog,
      coords: { clientX: 50, clientY: 50 },
    });
    expect(close).not.toHaveBeenCalled();
  });

  it("focuses the designated field and returns focus to its opener on Escape", async () => {
    const user = userEvent.setup();
    render(<DialogExample />);
    const opener = screen.getByRole("button", { name: "New entry" });
    await user.click(opener);
    expect(screen.getByRole("textbox", { name: "Note" })).toHaveFocus();
    fireEvent(
      screen.getByRole("dialog", { name: "New entry" }),
      new Event("cancel", { cancelable: true }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("returns focus to the entry-options summary instead of its hidden menu item", async () => {
    const user = userEvent.setup();
    render(
      <EntryOptions
        entry={entry}
        meId={entry.authorId}
        collections={["Weekends"]}
      />,
    );
    const opener = screen.getByLabelText("Entry options");
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Edit entry" }));
    expect(opener.closest("details")).not.toHaveAttribute("open");
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it("locks an entry edit while saving and preserves it for retry after failure", async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    request.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    render(
      <EntryOptions
        entry={entry}
        meId={entry.authorId}
        collections={["Weekends"]}
      />,
    );
    const opener = screen.getByLabelText("Entry options");
    await user.click(opener);
    await user.click(screen.getByRole("button", { name: "Edit entry" }));
    const text = screen.getByRole("textbox", { name: "Note" });
    await user.clear(text);
    await user.type(text, "The edit I want to keep.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(text).toBeDisabled());
    expect(screen.getByRole("textbox", { name: "Title" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /Collection/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.type(text, " An accidental change.");
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(text).toHaveValue("The edit I want to keep.");
    expect(request).toHaveBeenCalledOnce();

    await act(async () => reject(new Error("Connection lost")));
    expect(text).toBeEnabled();
    expect(text).toHaveValue("The edit I want to keep.");
    expect(screen.getByRole("alert")).toHaveTextContent("Connection lost");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(request).toHaveBeenLastCalledWith(
      "/api/entries/note-1",
      {
        body: "The edit I want to keep.",
        title: "Sunday",
        collection: "Weekends",
      },
      "PATCH",
    );
    expect(opener).toHaveFocus();
  });
});
