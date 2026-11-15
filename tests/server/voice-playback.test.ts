import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestIdentity } from "./fixtures/accounts";

const directory = mkdtempSync(join(tmpdir(), "twospace-voice-playback-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";

let storage: typeof import("@/server/database");
let authModule: typeof import("@/server/auth");
let spaces: typeof import("@/server/spaces");
let entries: typeof import("@/server/entries");
let media: typeof import("@/server/media");
let mediaRoute: typeof import("@/app/api/media/[id]/route");
type Identity = { id: string; cookie: string };
let owner: Identity, partner: Identity, outsider: Identity;
let sharedId: string, scheduledId: string;

// A recognizable MP4 header plus distinct bytes exercises transport, not decoding.
const audio = Buffer.concat([
  Buffer.from("00000018667479704d344120000002004d3441206d703432", "hex"),
  Buffer.from(Array.from({ length: 128 }, (_, index) => index)),
]);
const origin = "http://127.0.0.1:3100";
const mutation = (user: Identity, body: unknown) =>
  new Request(`${origin}/api/test`, {
    method: "POST",
    headers: {
      cookie: user.cookie,
      origin,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
const playback = (
  cookie: string,
  mediaId: string,
  method: "GET" | "HEAD" = "GET",
  range?: string,
) =>
  new Request(`${origin}/api/media/${mediaId}`, {
    method,
    headers: { cookie, ...(range ? { range } : {}) },
  });
const parameters = (id: string) => ({ params: Promise.resolve({ id }) });
async function uploadVoice() {
  return media.uploadMedia(
    new Request(`${origin}/api/media`, {
      method: "POST",
      headers: {
        cookie: owner.cookie,
        origin,
        "content-type": "audio/mp4;codecs=mp4a.40.2",
      },
      body: Uint8Array.from(audio),
    }),
  );
}

beforeAll(async () => {
  storage = await import("@/server/database");
  authModule = await import("@/server/auth");
  await authModule.ready();
  [spaces, entries, media, mediaRoute] = await Promise.all([
    import("@/server/spaces"),
    import("@/server/entries"),
    import("@/server/media"),
    import("@/app/api/media/[id]/route"),
  ]);
  const identity = (name: string) =>
    createTestIdentity(
      { auth: authModule.auth, execute: storage.execute },
      name,
    );
  owner = await identity("Morgan");
  partner = await identity("Riley");
  outsider = await identity("Casey");
  await spaces.createSpace(mutation(owner, { name: "Voice playback" }));
  await spaces.createSpace(mutation(outsider, { name: "Another space" }));
  const invitation = await spaces.invite(mutation(owner, {}));
  await spaces.acceptInvite(mutation(partner, { token: invitation.token }));
  sharedId = (await uploadVoice()).id;
  await entries.createEntry(
    mutation(owner, {
      kind: "voice",
      body: "A saved recording",
      mediaId: sharedId,
    }),
  );
  scheduledId = (await uploadVoice()).id;
  await entries.createEntry(
    mutation(owner, {
      kind: "voice",
      body: "For tomorrow",
      mediaId: scheduledId,
      revealAt: new Date(Date.now() + 86_400_000).toISOString(),
    }),
  );
}, 30_000);

afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("saved voice playback", () => {
  it("preserves the uploaded bytes and audio MIME type for either partner", async () => {
    for (const user of [owner, partner]) {
      const response = await mediaRoute.GET(
        playback(user.cookie, sharedId),
        parameters(sharedId),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("audio/mp4");
      expect(response.headers.get("content-length")).toBe(String(audio.length));
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("content-disposition")).toBe("inline");
      expect(Buffer.from(await response.arrayBuffer())).toEqual(audio);
    }
  });

  it("answers the audio player's two-byte probe with only the requested bytes", async () => {
    const response = await mediaRoute.GET(
      playback(partner.cookie, sharedId, "GET", "bytes=0-1"),
      parameters(sharedId),
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe(
      `bytes 0-1/${audio.length}`,
    );
    expect(response.headers.get("content-length")).toBe("2");
    expect(response.headers.get("content-type")).toBe("audio/mp4");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(
      audio.subarray(0, 2),
    );
  });

  it("returns metadata without a body for an authenticated HEAD request", async () => {
    const response = await mediaRoute.HEAD(
      playback(partner.cookie, sharedId, "HEAD", "bytes=0-1"),
      parameters(sharedId),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-length")).toBe(String(audio.length));
    expect(response.headers.get("content-range")).toBeNull();
    expect(response.headers.get("content-type")).toBe("audio/mp4");
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it.each(["GET", "HEAD"] as const)(
    "keeps %s range requests behind session and space checks",
    async (method) => {
      for (const [cookie, status] of [
        ["", 401],
        [outsider.cookie, 404],
      ] as const) {
        const response = await mediaRoute[method](
          playback(cookie, sharedId, method, "bytes=0-1"),
          parameters(sharedId),
        );
        expect(response.status).toBe(status);
        expect(response.headers.get("content-range")).toBeNull();
        expect(response.headers.get("content-type")).not.toBe("audio/mp4");
      }
    },
  );

  it.each(["GET", "HEAD"] as const)(
    "does not reveal a scheduled recording through %s range requests",
    async (method) => {
      const hidden = await mediaRoute[method](
        playback(partner.cookie, scheduledId, method, "bytes=0-1"),
        parameters(scheduledId),
      );
      expect(hidden.status).toBe(404);
      expect(hidden.headers.get("content-range")).toBeNull();
      const own = await mediaRoute[method](
        playback(owner.cookie, scheduledId, method, "bytes=0-1"),
        parameters(scheduledId),
      );
      expect(own.status).toBe(method === "GET" ? 206 : 200);
    },
  );
});
