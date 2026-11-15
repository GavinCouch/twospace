import {
  afterAll,
  afterEach,
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
import type { SpotifyTrack } from "@/shared/music";
import { localDateInZone } from "@/shared/time";
import { createTestIdentity } from "./fixtures/accounts";

const spotify = vi.hoisted(() => ({
  track: vi.fn(),
  available: vi.fn(),
  limit: vi.fn(),
}));
vi.mock("@/server/spotify", () => ({
  getSpotifyTrack: spotify.track,
  spotifySearchAvailable: spotify.available,
  limitSpotifyRequests: spotify.limit,
}));

const directory = mkdtempSync(join(tmpdir(), "twospace-music-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";
let authModule: typeof import("@/server/auth");
let storage: typeof import("@/server/database");
let spaces: typeof import("@/server/spaces");
let music: typeof import("@/server/music");
let route: typeof import("@/server/http").route;
let alex: { id: string; cookie: string },
  jamie: { id: string; cookie: string },
  outsider: { id: string; cookie: string };
let spaceId: string;

const trackId = "0Lr4kGOYn9l83EjuK6cZFQ";
const otherTrackId = "11dFghVXANMlKmJXsNCbNl";
const verifiedTrack = (id = trackId): SpotifyTrack => ({
  id,
  title: "Verified song",
  artists: ["Verified artist"],
  album: "Verified album",
  imageUrl: "https://i.scdn.co/image/test-cover",
  durationMs: 180000,
  url: `https://open.spotify.com/track/${id}`,
});
const request = (cookie: string, body?: unknown, method = "PUT") =>
  new Request("http://127.0.0.1:3100/api/music/today", {
    method,
    headers: {
      cookie,
      origin: "http://127.0.0.1:3100",
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const today = () =>
  localDateInZone(new Date().toISOString(), "America/Chicago");
const input = (overrides: Record<string, unknown> = {}) => ({
  trackId,
  day: today(),
  note: "For your walk home.",
  revision: 0,
  ...overrides,
});

beforeAll(async () => {
  authModule = await import("@/server/auth");
  storage = await import("@/server/database");
  await authModule.ready();
  spaces = await import("@/server/spaces");
  music = await import("@/server/music");
  ({ route } = await import("@/server/http"));
  const identity = (name: string) =>
    createTestIdentity(
      { auth: authModule.auth, execute: storage.execute },
      name,
    );
  alex = await identity("Alex");
  jamie = await identity("Jamie");
  outsider = await identity("Casey");
  spaceId = (
    await spaces.createSpace(request(alex.cookie, { name: "Music pair" }))
  ).id;
  await spaces.createSpace(request(outsider.cookie, { name: "Other space" }));
  const outsiderPartner = await identity("CaseyPartner");
  const outsideInvitation = await spaces.invite(request(outsider.cookie, {}));
  await spaces.acceptInvite(
    request(outsiderPartner.cookie, { token: outsideInvitation.token }),
  );
  const invite = await spaces.invite(request(alex.cookie, {}));
  await spaces.acceptInvite(request(jamie.cookie, { token: invite.token }));
}, 30000);

beforeEach(async () => {
  await storage.execute("DELETE FROM resources WHERE kind=?", "song");
  await storage.execute("UPDATE profiles SET time_zone=?", "America/Chicago");
  spotify.track
    .mockReset()
    .mockImplementation(async (id: string) => verifiedTrack(id));
  spotify.available.mockReset().mockReturnValue(true);
  spotify.limit.mockReset();
});
afterEach(() => vi.useRealTimers());
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("daily music", () => {
  it("requires authentication and keeps picks inside their shared space", async () => {
    await expect(
      music.getMusic(request("", undefined, "GET")),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      music.saveTodaySong(request("", input())),
    ).rejects.toMatchObject({ status: 401 });
    const saved = await music.saveTodaySong(request(alex.cookie, input()));
    expect(
      (await music.getMusic(request(jamie.cookie, undefined, "GET"))).songs,
    ).toEqual([saved]);
    expect(
      (await music.getMusic(request(outsider.cookie, undefined, "GET"))).songs,
    ).toEqual([]);
    await expect(
      music.deleteSong(
        request(outsider.cookie, { revision: saved.revision }, "DELETE"),
        saved.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("uses verified Spotify metadata and gives each member their own daily pick", async () => {
    const saved = await music.saveTodaySong(
      request(
        alex.cookie,
        input({ track: { title: "Forged title" }, authorId: jamie.id }),
      ),
    );
    expect(saved).toMatchObject({
      authorId: alex.id,
      track: verifiedTrack(),
      note: "For your walk home.",
      revision: 1,
      day: today(),
    });
    await music.saveTodaySong(
      request(jamie.cookie, input({ trackId: otherTrackId })),
    );
    expect(
      (await music.getMusic(request(alex.cookie, undefined, "GET"))).songs,
    ).toHaveLength(2);
    // A person can choose a song while waiting for their partner to join.
    await expect(
      music.saveTodaySong(request(outsider.cookie, input())),
    ).resolves.toMatchObject({ authorId: outsider.id });
  });

  it("rejects stale saves and serializes simultaneous first picks", async () => {
    const results = await Promise.allSettled([
      music.saveTodaySong(request(alex.cookie, input())),
      music.saveTodaySong(
        request(alex.cookie, input({ trackId: otherTrackId })),
      ),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({ reason: { status: 409, code: "MUSIC_CONFLICT" } });
    expect(await music.listMusicSongs(spaceId)).toHaveLength(1);
    await expect(
      music.saveTodaySong(request(alex.cookie, input())),
    ).rejects.toMatchObject({ status: 409 });
  });

  it("edits a note during a Spotify outage without changing the chosen song", async () => {
    const original = await music.saveTodaySong(request(alex.cookie, input()));
    spotify.track.mockRejectedValue(new Error("Spotify unavailable"));
    const edited = await music.saveTodaySong(
      request(
        alex.cookie,
        input({ revision: original.revision, note: "A different note." }),
      ),
    );
    expect(edited).toMatchObject({
      id: original.id,
      revision: 2,
      note: "A different note.",
      createdAt: original.createdAt,
      track: original.track,
    });
    expect(spotify.track).toHaveBeenCalledTimes(1);
    await expect(
      music.saveTodaySong(
        request(
          alex.cookie,
          input({ trackId: otherTrackId, revision: edited.revision }),
        ),
      ),
    ).rejects.toThrow("Spotify unavailable");
    expect(await music.listMusicSongs(spaceId)).toEqual([edited]);
  });

  it("derives the day from the author’s time zone and rejects old-day writes", async () => {
    await storage.execute(
      "UPDATE profiles SET time_zone=? WHERE user_id=?",
      "Pacific/Kiritimati",
      alex.id,
    );
    const localDay = localDateInZone(
      new Date().toISOString(),
      "Pacific/Kiritimati",
    );
    const snapshot = await music.getMusic(
      request(alex.cookie, undefined, "GET"),
    );
    expect(snapshot.today).toBe(localDay);
    const saved = await music.saveTodaySong(
      request(alex.cookie, input({ day: localDay })),
    );
    expect(saved).toMatchObject({
      day: localDay,
      timeZone: "Pacific/Kiritimati",
    });
    await expect(
      music.saveTodaySong(request(alex.cookie, input({ day: "2000-01-01" }))),
    ).rejects.toMatchObject({ status: 409, code: "MUSIC_DAY_CHANGED" });
  });

  it("rechecks midnight after fetching track metadata", async () => {
    const current = new Date();
    const midnight = new Date(
      Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate() + 1,
      ),
    );
    await storage.execute(
      "UPDATE profiles SET time_zone=? WHERE user_id=?",
      "UTC",
      alex.id,
    );
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(midnight.getTime() - 1000);
    const day = new Date().toISOString().slice(0, 10);
    spotify.track.mockImplementation(async () => {
      vi.setSystemTime(midnight.getTime() + 1000);
      return verifiedTrack();
    });
    await expect(
      music.saveTodaySong(request(alex.cookie, input({ day }))),
    ).rejects.toMatchObject({ status: 409, code: "MUSIC_DAY_CHANGED" });
    expect(await music.listMusicSongs(spaceId)).toEqual([]);
  });

  it("rechecks a changed profile time zone after fetching track metadata", async () => {
    const midday = new Date();
    midday.setUTCHours(12, 0, 0, 0);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(midday);
    await spaces.updateProfile(request(alex.cookie, { timeZone: "UTC" }));
    const day = midday.toISOString().slice(0, 10);
    spotify.track.mockImplementation(async () => {
      await spaces.updateProfile(
        request(alex.cookie, { timeZone: "Pacific/Kiritimati" }),
      );
      return verifiedTrack();
    });
    await expect(
      music.saveTodaySong(request(alex.cookie, input({ day }))),
    ).rejects.toMatchObject({ status: 409, code: "MUSIC_DAY_CHANGED" });
    expect(await music.listMusicSongs(spaceId)).toEqual([]);
  });

  it("stores the current profile time zone when a pending pick still belongs to today", async () => {
    const midday = new Date();
    midday.setUTCHours(12, 0, 0, 0);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(midday);
    await spaces.updateProfile(request(alex.cookie, { timeZone: "UTC" }));
    const day = midday.toISOString().slice(0, 10);
    spotify.track.mockImplementation(async () => {
      await spaces.updateProfile(
        request(alex.cookie, { timeZone: "Europe/Paris" }),
      );
      return verifiedTrack();
    });
    await expect(
      music.saveTodaySong(request(alex.cookie, input({ day }))),
    ).resolves.toMatchObject({ day, timeZone: "Europe/Paris" });
  });

  it("does not let a partner remove a pick or a stale request delete a replacement", async () => {
    const first = await music.saveTodaySong(request(alex.cookie, input()));
    await expect(
      music.deleteSong(
        request(jamie.cookie, { revision: first.revision }, "DELETE"),
        first.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      music.deleteSong(
        request(alex.cookie, { revision: first.revision + 1 }, "DELETE"),
        first.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await music.deleteSong(
      request(alex.cookie, { revision: first.revision }, "DELETE"),
      first.id,
    );
    expect(await music.listMusicSongs(spaceId)).toEqual([]);
    const removed = await storage.resource<Record<string, unknown>>(
      spaceId,
      "song",
      first.id,
    );
    expect(removed).toEqual({
      id: first.id,
      authorId: alex.id,
      day: first.day,
      revision: 2,
      deleted: true,
    });
    const replacement = await music.saveTodaySong(
      request(alex.cookie, input({ trackId: otherTrackId })),
    );
    expect(replacement.revision).toBe(3);
    await expect(
      music.deleteSong(
        request(alex.cookie, { revision: first.revision }, "DELETE"),
        first.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    expect(await music.listMusicSongs(spaceId)).toEqual([replacement]);
  });

  it("keeps previous days in history when a new daily song is picked", async () => {
    const first = await music.saveTodaySong(request(alex.cookie, input()));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 86400000);
    const next = await music.saveTodaySong(
      request(alex.cookie, input({ trackId: otherTrackId })),
    );
    expect(next.id).not.toBe(first.id);
    expect(await music.listMusicSongs(spaceId)).toEqual([next, first]);
  });

  it("reports catalog availability and validates song IDs, note limits, and request origins", async () => {
    spotify.available.mockReturnValue(false);
    expect(
      await music.getMusic(request(alex.cookie, undefined, "GET")),
    ).toMatchObject({ searchAvailable: false });
    const handler = route(music.saveTodaySong);
    const ctx = { params: Promise.resolve({}) };
    expect(
      (
        await handler(
          request(
            alex.cookie,
            input({ trackId: "https://attacker.example/track" }),
          ),
          ctx,
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await handler(
          request(alex.cookie, input({ note: "x".repeat(2001) })),
          ctx,
        )
      ).status,
    ).toBe(400);
    const crossOrigin = request(alex.cookie, input());
    crossOrigin.headers.set("origin", "https://elsewhere.example");
    expect((await handler(crossOrigin, ctx)).status).toBe(403);
    expect(spotify.track).not.toHaveBeenCalled();
  });
});
