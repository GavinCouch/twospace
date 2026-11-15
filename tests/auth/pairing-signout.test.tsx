// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { Pairing } from "../../src/components/account-gate";
import type { Account } from "../../src/shared/types";

const account: Account = {
  id: "alex",
  name: "Alex",
  email: "alex@example.com",
  spaceId: null,
  isDemo: false,
};
const draftKey = "twospace:journal-draft:previous-space:alex";

function setup() {
  const client = new QueryClient();
  client.setQueryData(["account"], account);
  client.setQueryData(["private"], "previous account data");
  const navigate = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <Pairing account={account} onNavigate={navigate} />
    </QueryClientProvider>,
  );
  return { client, navigate, user: userEvent.setup() };
}

beforeEach(() => {
  for (const storage of [localStorage, sessionStorage]) {
    storage.clear();
    storage.setItem(draftKey, "private draft");
    storage.setItem("unrelated-setting", "keep");
  }
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("unpaired account sign-out", () => {
  it("waits for sign-out, clears private state, and returns to the public home page", async () => {
    let resolve!: (value: Response) => void;
    const request = vi.fn(
      () =>
        new Promise<Response>((done) => {
          resolve = done;
        }),
    );
    vi.stubGlobal("fetch", request);
    const { client, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(request).toHaveBeenCalledWith(
      "/api/auth/sign-out",
      expect.objectContaining({
        method: "POST",
        body: "{}",
        credentials: "same-origin",
      }),
    );
    expect(screen.getByRole("button", { name: "Signing out…" })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Create a space" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Join their space" }),
    ).toBeDisabled();
    expect(client.getQueryData(["account"])).toEqual(account);
    expect(navigate).not.toHaveBeenCalled();
    resolve(Response.json({ success: true }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem(draftKey)).toBeNull();
      expect(storage.getItem("unrelated-setting")).toBe("keep");
    }
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("keeps the account and drafts when sign-out fails, then allows a retry", async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ message: "Please try again." }, { status: 503 }),
      )
      .mockResolvedValueOnce(Response.json({ success: true }));
    vi.stubGlobal("fetch", request);
    const { client, navigate, user } = setup();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Please try again.",
    );
    expect(client.getQueryData(["account"])).toEqual(account);
    expect(client.getQueryData(["private"])).toBe("previous account data");
    expect(navigate).not.toHaveBeenCalled();
    for (const storage of [localStorage, sessionStorage]) {
      expect(storage.getItem(draftKey)).toBe("private draft");
    }
    expect(
      screen.getByRole("button", { name: "Create a space" }),
    ).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("/"));
    expect(request).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
