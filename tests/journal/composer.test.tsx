// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { EntryComposer } from "../../src/features/journal/entry-composer";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", () => ({ useAction: () => ({ run: request, pending: false, error: null, clearError: vi.fn() }) }));
const me = { id: "alex", name: "Alex", timeZone: "America/Chicago", color: "#293b80", availableFrom: 17, availableTo: 22 };

beforeEach(() => {
  request.mockReset(); request.mockResolvedValue({}); sessionStorage.clear();
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(cleanup);

describe("journal composing", () => {
  it("keeps a failed note and its draft, then clears the draft after a successful retry", async () => {
    const user = userEvent.setup(); const onClose = vi.fn();
    request.mockRejectedValueOnce(new Error("Offline"));
    render(<EntryComposer me={me} spaceId="space" collections={[]} onClose={onClose} />);
    const text = screen.getByRole("textbox", { name: /Your note/ });
    await user.type(text, "The recipe worked with oat milk.");
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(text).toHaveValue("The recipe worked with oat milk.");
    expect(sessionStorage.getItem("twospace:journal-draft:space:alex")).toContain("oat milk");
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(sessionStorage.getItem("twospace:journal-draft:space:alex")).toBeNull();
  });
  it("does not send executable URLs as saved links", async () => {
    const user = userEvent.setup();
    render(<EntryComposer me={me} spaceId="space" collections={[]} onClose={vi.fn()} />);
    await user.click(screen.getByRole("radio", { name: "Link or song" }));
    await user.type(screen.getByRole("textbox", { name: /^Link$/ }), "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: "Add to journal" }));
    expect(await screen.findByText("Enter a full http or https link.")).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });
});
