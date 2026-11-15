// @vitest-environment jsdom
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
import { EntryComposer } from "../../src/features/journal/entry-composer";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", async () => {
  const { useState } = await import("react");
  return {
    useAction: () => {
      const [pending, setPending] = useState(false);
      return {
        run: async (...args: unknown[]) => {
          setPending(true);
          try {
            return await request(...args);
          } finally {
            setPending(false);
          }
        },
        pending,
        error: null,
        clearError: vi.fn(),
      };
    },
  };
});
const me = {
  id: "alex",
  name: "Alex",
  timeZone: "America/Chicago",
  color: "#293b80",
  availableFrom: 17,
  availableTo: 22,
};

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({});
  sessionStorage.clear();
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
});
afterEach(cleanup);

describe("journal composing", () => {
  it("prevents edits and closing while saving, then unlocks the same draft after failure", async () => {
    const user = userEvent.setup();
    let reject!: (cause: Error) => void;
    request.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      }),
    );
    const close = vi.fn();
    render(
      <EntryComposer
        me={me}
        spaceId="space"
        collections={[]}
        onClose={close}
      />,
    );
    const text = screen.getByRole("textbox", { name: /Your note/ });
    await user.type(text, "The draft that will be sent.");
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    await waitFor(() => expect(text).toBeDisabled());
    expect(screen.getByRole("radio", { name: "Photo" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Close" })).toBeDisabled();
    await user.type(text, "An edit that would otherwise disappear.");
    expect(text).toHaveValue("The draft that will be sent.");
    fireEvent(
      screen.getByRole("dialog"),
      new Event("cancel", { cancelable: true }),
    );
    expect(close).not.toHaveBeenCalled();
    await act(async () => reject(new Error("Offline")));
    expect(text).toBeEnabled();
    expect(text).toHaveValue("The draft that will be sent.");
    expect(
      sessionStorage.getItem("twospace:journal-draft:space:alex"),
    ).toContain("The draft that will be sent.");
  });

  it("restores title and collection visibly with a saved draft", async () => {
    sessionStorage.setItem(
      "twospace:journal-draft:space:alex",
      JSON.stringify({
        kind: "note",
        title: "Sunday",
        body: "Coffee together.",
        collection: "Plans",
        url: "",
        revealLocal: "",
      }),
    );
    render(
      <EntryComposer
        me={me}
        spaceId="space"
        collections={[]}
        onClose={vi.fn()}
      />,
    );
    expect(await screen.findByRole("textbox", { name: /Title/ })).toHaveValue(
      "Sunday",
    );
    expect(screen.getByRole("combobox", { name: /Collection/ })).toHaveValue(
      "Plans",
    );
  });
  it("keeps a failed note and its draft, then clears the draft after a successful retry", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    request.mockRejectedValueOnce(new Error("Offline"));
    render(
      <EntryComposer
        me={me}
        spaceId="space"
        collections={[]}
        onClose={onClose}
      />,
    );
    const text = screen.getByRole("textbox", { name: /Your note/ });
    await user.type(text, "The recipe worked with oat milk.");
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(text).toHaveValue("The recipe worked with oat milk.");
    expect(
      sessionStorage.getItem("twospace:journal-draft:space:alex"),
    ).toContain("oat milk");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(
      sessionStorage.getItem("twospace:journal-draft:space:alex"),
    ).toBeNull();
  });
  it("does not send executable URLs as saved links", async () => {
    const user = userEvent.setup();
    render(
      <EntryComposer
        me={me}
        spaceId="space"
        collections={[]}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "Link" }));
    await user.type(
      screen.getByRole("textbox", { name: /^Link$/ }),
      "javascript:alert(1)",
    );
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    expect(
      await screen.findByText("Enter a full http or https link."),
    ).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
