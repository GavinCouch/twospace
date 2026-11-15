import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestIdentity } from "./fixtures/accounts";

const provider = vi.hoisted(() => ({
  search: vi.fn(),
  resolve: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/server/spotify", () => ({
  searchSpotify: provider.search,
  resolveSpotifyLink: provider.resolve,
  limitSpotifyRequests: provider.limit,
  spotifySearchAvailable: () => true,
  getSpotifyTrack: vi.fn(),
}));

const directory = mkdtempSync(join(tmpdir(), "twospace-catalog-access-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";
let storage: typeof import("@/server/database");
let http: typeof import("@/server/http");
let search: typeof import("@/app/api/music/search/route").GET;
let resolve: typeof import("@/app/api/music/resolve/route").GET;
let history: typeof import("@/app/api/music/route").GET;
let save: typeof import("@/app/api/music/today/route").PUT;
let identity: { id: string; cookie: string };
let paired: { id: string; cookie: string };
let solo: { id: string; cookie: string };
const ctx = { params: Promise.resolve({}) };
const track = {
  id: "0Lr4kGOYn9l83EjuK6cZFQ",
  title: "A catalog song",
  artists: ["An artist"],
  album: "An album",
  imageUrl: null,
  durationMs: 180000,
  url: "https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ",
};
const request = (path: string, cookie = paired.cookie) =>
  new Request(`http://127.0.0.1:3100${path}`, { headers: { cookie } });

beforeAll(async () => {
  storage = await import("@/server/database");
  const auth = await import("@/server/auth");
  await auth.ready();
  http = await import("@/server/http");
  ({ GET: search } = await import("@/app/api/music/search/route"));
  ({ GET: resolve } = await import("@/app/api/music/resolve/route"));
  ({ GET: history } = await import("@/app/api/music/route"));
  ({ PUT: save } = await import("@/app/api/music/today/route"));
  identity = await createTestIdentity(
    { auth: auth.auth, execute: storage.execute },
    "Catalog",
  );
  const spaces = await import("@/server/spaces");
  const create = (name: string) =>
    createTestIdentity({ auth: auth.auth, execute: storage.execute }, name);
  paired = await create("PairedCatalog");
  solo = await create("SoloCatalog");
  const partner = await create("CatalogPartner");
  const body = (user: typeof paired, input?: unknown) =>
    new Request("http://127.0.0.1:3100/api/test", {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify(input ?? {}),
    });
  await spaces.createSpace(body(paired, { name: "Pair" }));
  await spaces.createSpace(body(solo, { name: "Solo" }));
  const invitation = await spaces.invite(body(paired));
  await spaces.acceptInvite(body(partner, { token: invitation.token }));
}, 30000);
beforeEach(() => {
  provider.search.mockReset().mockResolvedValue([track]);
  provider.resolve.mockReset().mockResolvedValue(track);
  provider.limit.mockReset();
});
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("Spotify catalog access", () => {
  it("requires a partner before either catalog endpoint contacts Spotify", async () => {
    for (const user of [identity, solo]) {
      const expected = user === identity ? 404 : 409;
      expect(
        (await search(request("/api/music/search?q=a+song", user.cookie), ctx))
          .status,
      ).toBe(expected);
      expect(
        (
          await resolve(
            request(
              `/api/music/resolve?url=${encodeURIComponent(track.url)}`,
              user.cookie,
            ),
            ctx,
          )
        ).status,
      ).toBe(expected);
    }
    expect(provider.search).not.toHaveBeenCalled();
    expect(provider.resolve).not.toHaveBeenCalled();
    expect(provider.limit).not.toHaveBeenCalled();
  });
  it("rejects signed-out catalog requests before contacting Spotify", async () => {
    expect(
      (await search(request("/api/music/search?q=a+song", ""), ctx)).status,
    ).toBe(401);
    expect(
      (
        await resolve(
          request(
            `/api/music/resolve?url=${encodeURIComponent(track.url)}`,
            "",
          ),
          ctx,
        )
      ).status,
    ).toBe(401);
    expect(provider.search).not.toHaveBeenCalled();
    expect(provider.resolve).not.toHaveBeenCalled();
    expect(provider.limit).not.toHaveBeenCalled();
  });

  it("allows paired members to search and resolve public tracks", async () => {
    expect(
      (await http.account(request("/api/account"))).spaceId,
    ).not.toBeNull();
    const found = await search(
      request("/api/music/search?q=a+song+%26+artist"),
      ctx,
    );
    expect(found.status).toBe(200);
    expect(await found.json()).toEqual({ tracks: [track] });
    expect(provider.search).toHaveBeenCalledWith("a song & artist");
    const resolved = await resolve(
      request(`/api/music/resolve?url=${encodeURIComponent(track.url)}`),
      ctx,
    );
    expect(resolved.status).toBe(200);
    expect(await resolved.json()).toEqual(track);
    expect(provider.resolve).toHaveBeenCalledWith(track.url);
    expect(provider.limit.mock.calls).toEqual([[paired.id], [paired.id]]);
    expect(
      (await http.account(request("/api/account"))).spaceId,
    ).not.toBeNull();
  });

  it("keeps the per-account request limit on both catalog endpoints", async () => {
    provider.limit.mockImplementation(() => {
      throw new http.HttpError(429, "Try again shortly.", "SPOTIFY_RATE_LIMIT");
    });
    const found = await search(request("/api/music/search?q=a+song"), ctx);
    expect(found.status).toBe(429);
    expect(await found.json()).toMatchObject({ code: "SPOTIFY_RATE_LIMIT" });
    expect(
      (
        await resolve(
          request(`/api/music/resolve?url=${encodeURIComponent(track.url)}`),
          ctx,
        )
      ).status,
    ).toBe(429);
    expect(provider.search).not.toHaveBeenCalled();
    expect(provider.resolve).not.toHaveBeenCalled();
  });

  it("still requires a shared space to read history or save a daily song", async () => {
    const response = await history(request("/api/music", identity.cookie), ctx);
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "NO_SPACE" });
    const saved = await save(
      new Request("http://127.0.0.1:3100/api/music/today", {
        method: "PUT",
        headers: {
          cookie: identity.cookie,
          "content-type": "application/json",
          origin: "http://127.0.0.1:3100",
        },
        body: JSON.stringify({
          trackId: track.id,
          day: "2026-11-15",
          note: "A note",
          revision: 0,
        }),
      }),
      ctx,
    );
    expect(saved.status).toBe(404);
    expect(await saved.json()).toMatchObject({ code: "NO_SPACE" });
  });
});
