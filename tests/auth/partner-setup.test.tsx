// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import type { SpaceSnapshot } from "@/shared/types";
import { PartnerSetup } from "@/components/partner-setup";

const person = {
  id: "me",
  name: "Morgan",
  timeZone: "UTC",
  color: "#aabbcc",
  availableFrom: 18,
  availableTo: 22,
};
const space: SpaceSnapshot = {
  space: {
    id: "mine",
    name: "My accidental space",
    createdAt: "2026-11-15",
    isDemo: false,
    hasPairedBefore: false,
    canSwitch: true,
  },
  me: person,
  members: [person],
  entries: [],
  photoPairs: [],
  questions: [],
  games: [],
  drawings: [],
  ideas: [],
  plans: [],
};
function setup(data = space) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  client.setQueryData(["space"], data);
  client.setQueryData(["music"], { song: "old space pick" });
  const joined = vi.fn();
  render(
    <QueryClientProvider client={client}>
      <PartnerSetup space={data} onJoined={joined} />
    </QueryClientProvider>,
  );
  return { user: userEvent.setup(), client, joined };
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("joining a partner after making a space", () => {
  it("requires an explicit switch and clears the old space’s caches only after success", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ spaceId: "theirs" }));
    vi.stubGlobal("fetch", fetcher);
    const { user, client, joined } = setup();
    await user.type(
      screen.getByLabelText("Partner’s invitation code"),
      "  a-valid-invitation-token  ",
    );
    expect(
      screen.getByRole("button", { name: "Join their space" }),
    ).toBeDisabled();
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Join their space" }));
    expect(fetcher).toHaveBeenCalledWith(
      "/api/invites/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          token: "a-valid-invitation-token",
          switchSpace: true,
        }),
      }),
    );
    expect(joined).toHaveBeenCalledOnce();
    expect(client.getQueryCache().getAll()).toHaveLength(0);
  });
  it("keeps the current space and entered code when an invitation fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: "That code has expired." }, { status: 410 }),
        ),
    );
    const { user, client, joined } = setup();
    await user.type(
      screen.getByLabelText("Partner’s invitation code"),
      "expired-invitation-token",
    );
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Join their space" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That code has expired.",
    );
    expect(client.getQueryData(["space"])).toEqual(space);
    expect(screen.getByLabelText("Partner’s invitation code")).toHaveValue(
      "expired-invitation-token",
    );
    expect(joined).not.toHaveBeenCalled();
  });
  it("directs a previously paired space to settings without offering a replacement invitation", () => {
    setup({
      ...space,
      space: { ...space.space, canSwitch: false, hasPairedBefore: true },
    });
    expect(
      screen.getByText("Your partner has left this space"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open Settings/ })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(
      screen.queryByRole("button", { name: "Create invitation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("Partner’s invitation code"),
    ).not.toBeInTheDocument();
  });
  it("shows a usable invitation code and lets the user copy it", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({
            token: "private-invitation-code",
            expiresAt: "2026-11-17T00:00:00Z",
          }),
        ),
    );
    const { user } = setup();
    await user.click(screen.getByRole("button", { name: "Create invitation" }));
    expect(screen.getByLabelText("Your invitation code")).toHaveValue(
      "private-invitation-code",
    );
    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(await navigator.clipboard.readText()).toBe(
      "private-invitation-code",
    );
    expect(screen.getByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
