// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { AccountActions } from "../../src/features/settings/account-actions";
import { clearPrivateClientState } from "../../src/features/settings/client-state";
import type { SpaceSnapshot } from "../../src/shared/types";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/components/space-provider", () => ({ api: request }));
const me = {
  id: "alex",
  name: "Alex",
  timeZone: "America/Chicago",
  color: "#293b80",
  availableFrom: 17,
  availableTo: 22,
};
const partner = { ...me, id: "sam", name: "Sam" };
const space: SpaceSnapshot = {
  space: {
    id: "space",
    name: "Our space",
    createdAt: "2026-11-15T00:00:00Z",
    isDemo: false,
  },
  me,
  members: [me, partner],
  entries: [],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
function setup() {
  const client = new QueryClient();
  client.setQueryData(["space"], space);
  client.setQueryData(["account"], { id: "alex" });
  const navigate = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <AccountActions space={space} onNavigate={navigate} />
    </QueryClientProvider>,
  );
  return { client, navigate, user: userEvent.setup() };
}
beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue({ ok: true });
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(cleanup);

describe("settings account actions", () => {
  it("requires an explicit confirmation before leaving and returns to account loading", async () => {
    const { user, navigate, client } = setup();
    sessionStorage.setItem(
      "twospace:journal-draft:space:alex",
      "private draft",
    );
    await user.click(screen.getByRole("button", { name: "Leave space" }));
    expect(request).not.toHaveBeenCalled();
    expect(screen.getByText(/Your partner keeps access/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    await user.click(
      screen.getByRole("button", { name: "Confirm leave space" }),
    );
    expect(request).toHaveBeenCalledWith("/api/space/membership", {
      method: "DELETE",
    });
    expect(client.getQueryData(["account"])).toBeUndefined();
    expect(client.getQueryData(["space"])).toBeUndefined();
    expect(
      sessionStorage.getItem("twospace:journal-draft:space:alex"),
    ).toBeNull();
    expect(navigate).toHaveBeenCalledWith("/journal");
  });
  it("cancels leaving without making a request", async () => {
    const { user, navigate } = setup();
    await user.click(screen.getByRole("button", { name: "Leave space" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(request).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Leave space" })).toHaveFocus();
  });
  it("keeps the current account and drafts if sign-out fails", async () => {
    request.mockRejectedValueOnce(new Error("Could not connect."));
    const { user, navigate, client } = setup();
    sessionStorage.setItem(
      "twospace:journal-draft:space:alex",
      "private draft",
    );
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not connect",
    );
    expect(client.getQueryData(["account"])).toEqual({ id: "alex" });
    expect(sessionStorage.getItem("twospace:journal-draft:space:alex")).toBe(
      "private draft",
    );
    expect(navigate).not.toHaveBeenCalled();
  });
  it("labels the export as JSON data without promising media files", () => {
    setup();
    expect(
      screen.getByRole("link", { name: "Download data (.json)" }),
    ).toHaveAttribute("href", "/api/export");
    expect(
      screen.getByText(/Photo and audio files are not included/),
    ).toBeInTheDocument();
  });
  it("clears private drafts and query data while preserving unrelated browser storage", async () => {
    const client = new QueryClient();
    client.setQueryData(["private"], "data");
    for (const storage of [sessionStorage, localStorage]) {
      storage.setItem("twospace:journal-draft:one:alex", "first");
      storage.setItem("twospace:journal-draft:two:sam", "second");
      storage.setItem("another-app-setting", "keep");
    }
    await clearPrivateClientState(client);
    for (const storage of [sessionStorage, localStorage]) {
      expect(storage.getItem("twospace:journal-draft:one:alex")).toBeNull();
      expect(storage.getItem("twospace:journal-draft:two:sam")).toBeNull();
      expect(storage.getItem("another-app-setting")).toBe("keep");
    }
    expect(client.getQueryData(["private"])).toBeUndefined();
  });
});
