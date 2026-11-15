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
import sharp from "sharp";
import { createTestIdentity } from "./fixtures/accounts";

const storageFault = vi.hoisted(() => ({
  put: false,
  remove: false,
  afterPut: null as null | (() => Promise<unknown>),
  afterGet: null as null | (() => Promise<unknown>),
}));
vi.mock("@/server/object-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/object-store")>();
  return {
    ...actual,
    putObject: async (...args: Parameters<typeof actual.putObject>) => {
      await actual.putObject(...args);
      await storageFault.afterPut?.();
      if (storageFault.put) throw new Error("Simulated storage timeout");
    },
    getObject: async (...args: Parameters<typeof actual.getObject>) => {
      const value = await actual.getObject(...args);
      await storageFault.afterGet?.();
      return value;
    },
    removeObject: async (...args: Parameters<typeof actual.removeObject>) => {
      if (storageFault.remove) throw new Error("Simulated deletion failure");
      return actual.removeObject(...args);
    },
  };
});

const directory = mkdtempSync(join(tmpdir(), "twospace-profile-photos-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";
let db: typeof import("@/server/database");
let auth: typeof import("@/server/auth");
let http: typeof import("@/server/http");
let spaces: typeof import("@/server/spaces");
let entries: typeof import("@/server/entries");
let media: typeof import("@/server/media");
let photos: typeof import("@/server/profile-photos");
let snapshots: typeof import("@/server/snapshot");
let route: typeof import("@/app/api/profile/photo/route");
type Identity = { id: string; cookie: string };
let alex: Identity, jamie: Identity, outsider: Identity, unpaired: Identity;
let spaceId: string, otherSpaceId: string;
let image: Buffer;

const request = (cookie: string, body?: unknown, method = "POST") =>
  new Request("http://127.0.0.1:3100/api/test", {
    method,
    headers: {
      cookie,
      origin: "http://127.0.0.1:3100",
      "content-type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const upload = (cookie = alex.cookie, body = image, mime = "image/jpeg") =>
  new Request("http://127.0.0.1:3100/api/profile/photo", {
    method: "PUT",
    headers: { cookie, origin: "http://127.0.0.1:3100", "content-type": mime },
    body: Uint8Array.from(body),
  });
const ownPhoto = async () =>
  (await http.context(request(alex.cookie, undefined, "GET"))).me.avatarMediaId;
const record = (id: string) =>
  db.row<{ id: string; filename: string }>(
    "SELECT * FROM media WHERE id=?",
    id,
  );

beforeAll(async () => {
  db = await import("@/server/database");
  auth = await import("@/server/auth");
  await auth.ready();
  [http, spaces, entries, media, photos, snapshots, route] = await Promise.all([
    import("@/server/http"),
    import("@/server/spaces"),
    import("@/server/entries"),
    import("@/server/media"),
    import("@/server/profile-photos"),
    import("@/server/snapshot"),
    import("@/app/api/profile/photo/route"),
  ]);
  const identity = (name: string) =>
    createTestIdentity({ auth: auth.auth, execute: db.execute }, name);
  alex = await identity("Alex");
  jamie = await identity("Jamie");
  outsider = await identity("Casey");
  unpaired = await identity("Taylor");
  await http.ensureProfile(jamie.id, "Jamie");
  spaceId = (
    await spaces.createSpace(request(alex.cookie, { name: "Photo pair" }))
  ).id;
  otherSpaceId = (
    await spaces.createSpace(request(outsider.cookie, { name: "Other pair" }))
  ).id;
  const bytes = Buffer.alloc(32 * 16 * 3);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 32; x++)
      bytes[(y * 32 + x) * 3 + (x < 16 ? 0 : 2)] = 255;
  image = await sharp(bytes, { raw: { width: 32, height: 16, channels: 3 } })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();
}, 30000);
beforeEach(async () => {
  storageFault.put = false;
  storageFault.remove = false;
  storageFault.afterPut = null;
  storageFault.afterGet = null;
  await db.execute("DELETE FROM resources");
  await db.execute("DELETE FROM media");
  await db.execute("DELETE FROM media_deletions");
  await db.execute("DELETE FROM memberships");
  await db.execute("DELETE FROM pair_history");
  await db.execute(
    "INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,1)",
    alex.id,
    spaceId,
  );
  await db.execute(
    "INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,2)",
    jamie.id,
    spaceId,
  );
  await db.execute(
    "INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,1)",
    outsider.id,
    otherSpaceId,
  );
});
afterAll(async () => {
  await db?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("private profile photos", () => {
  it("stores an oriented, metadata-free 512px WebP and exposes it to the current pair only", async () => {
    const result = await photos.uploadProfilePhoto(upload());
    expect(await ownPhoto()).toBe(result.avatarMediaId);
    const partner = await http.context(request(jamie.cookie, undefined, "GET"));
    expect(
      partner.members.find((person) => person.id === alex.id)?.avatarMediaId,
    ).toBe(result.avatarMediaId);
    const response = await media.getMedia(
      request(jamie.cookie, undefined, "GET"),
      result.avatarMediaId,
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-type")).toBe("image/webp");
    const output = Buffer.from(await response.arrayBuffer());
    const info = await sharp(output).metadata();
    expect(info).toMatchObject({ format: "webp", width: 512, height: 512 });
    expect(info.exif).toBeUndefined();
    expect(info.icc).toBeUndefined();
    expect(info.orientation).toBeUndefined();
    const pixels = await sharp(output).removeAlpha().raw().toBuffer();
    const top = (128 * 512 + 256) * 3,
      bottom = (384 * 512 + 256) * 3;
    expect(pixels[top]).toBeGreaterThan(pixels[top + 2]);
    expect(pixels[bottom + 2]).toBeGreaterThan(pixels[bottom]);
    await expect(
      media.getMedia(
        request(outsider.cookie, undefined, "GET"),
        result.avatarMediaId,
      ),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      media.getMedia(request("", undefined, "GET"), result.avatarMediaId),
    ).rejects.toMatchObject({ status: 401 });
    const exported = await snapshots.exportSnapshot(
      request(alex.cookie, undefined, "GET"),
    );
    const exportedJson = await exported.json();
    expect(exportedJson.me.avatarMediaId).toBe(result.avatarMediaId);
    expect(JSON.stringify(exportedJson)).not.toContain(
      (await record(result.avatarMediaId))!.filename,
    );
  });

  it("requires a signed-in space member for upload and removal", async () => {
    await expect(photos.uploadProfilePhoto(upload(""))).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      photos.removeProfilePhoto(request("", undefined, "DELETE")),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      photos.uploadProfilePhoto(upload(unpaired.cookie)),
    ).rejects.toMatchObject({ status: 404, code: "NO_SPACE" });
    const original = await photos.uploadProfilePhoto(upload());
    await photos.removeProfilePhoto(request(jamie.cookie, undefined, "DELETE"));
    expect(await ownPhoto()).toBe(original.avatarMediaId);
  });

  it("rejects unsupported MIME, corrupt content, empty and oversized bodies without replacing a photo", async () => {
    const original = await photos.uploadProfilePhoto(upload());
    for (const invalid of [
      upload(alex.cookie, image, "image/png"),
      upload(alex.cookie, Buffer.from("not an image")),
      upload(alex.cookie, Buffer.alloc(0)),
      upload(alex.cookie, Buffer.from("<svg/>"), "image/svg+xml"),
    ])
      await expect(photos.uploadProfilePhoto(invalid)).rejects.toMatchObject({
        status: 400,
      });
    const declared = upload();
    declared.headers.set("content-length", String(10 * 1024 * 1024 + 1));
    await expect(photos.uploadProfilePhoto(declared)).rejects.toMatchObject({
      status: 413,
    });
    await expect(
      photos.uploadProfilePhoto(
        upload(alex.cookie, Buffer.alloc(10 * 1024 * 1024 + 1)),
      ),
    ).rejects.toMatchObject({ status: 413 });
    expect(await ownPhoto()).toBe(original.avatarMediaId);
    const crossOrigin = upload();
    crossOrigin.headers.set("origin", "https://other.example");
    expect(
      (await route.PUT(crossOrigin, { params: Promise.resolve({}) })).status,
    ).toBe(403);
  });

  it("replaces and removes only the author’s photo and cleans superseded files", async () => {
    const first = await photos.uploadProfilePhoto(upload());
    const firstRow = (await record(first.avatarMediaId))!;
    const partner = await photos.uploadProfilePhoto(upload(jamie.cookie));
    const second = await photos.uploadProfilePhoto(upload());
    expect(second.avatarMediaId).not.toBe(first.avatarMediaId);
    expect(await record(first.avatarMediaId)).toBeUndefined();
    const objects = await import("@/server/object-store");
    await expect(objects.getObject(firstRow.filename)).rejects.toMatchObject({
      code: "ENOENT",
    });
    expect(
      (await http.context(request(jamie.cookie, undefined, "GET"))).me
        .avatarMediaId,
    ).toBe(partner.avatarMediaId);
    expect(
      await photos.removeProfilePhoto(
        request(alex.cookie, undefined, "DELETE"),
      ),
    ).toEqual({ avatarMediaId: null });
    expect(await ownPhoto()).toBeUndefined();
    expect(await record(second.avatarMediaId)).toBeUndefined();
    await expect(
      media.getMedia(
        request(jamie.cookie, undefined, "GET"),
        second.avatarMediaId,
      ),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      await photos.removeProfilePhoto(
        request(alex.cookie, undefined, "DELETE"),
      ),
    ).toEqual({ avatarMediaId: null });
  });

  it("preserves a photo still used by an entry, and deleting an entry preserves an active avatar", async () => {
    const original = await photos.uploadProfilePhoto(upload());
    let entry = await entries.createEntry(
      request(alex.cookie, {
        kind: "photo",
        mediaId: original.avatarMediaId,
        body: "Also in our journal",
      }),
    );
    await entries.deleteEntry(
      request(alex.cookie, undefined, "DELETE"),
      entry.id,
    );
    expect(await record(original.avatarMediaId)).toBeDefined();
    entry = await entries.createEntry(
      request(alex.cookie, {
        kind: "photo",
        mediaId: original.avatarMediaId,
        body: "Keep this memory",
      }),
    );
    await photos.removeProfilePhoto(request(alex.cookie, undefined, "DELETE"));
    expect(await record(original.avatarMediaId)).toBeDefined();
    await expect(
      media.getMedia(
        request(jamie.cookie, undefined, "GET"),
        original.avatarMediaId,
      ),
    ).resolves.toBeInstanceOf(Response);
    await entries.deleteEntry(
      request(alex.cookie, undefined, "DELETE"),
      entry.id,
    );
    expect(await record(original.avatarMediaId)).toBeUndefined();
  });

  it("keeps an avatar used in a photo pair when replacing it", async () => {
    const original = await photos.uploadProfilePhoto(upload());
    const pair = await entries.createPhotoPair(
      request(alex.cookie, { prompt: "A face from each place" }),
    );
    await entries.contributePhoto(
      request(alex.cookie, { mediaId: original.avatarMediaId }),
      pair.id,
    );
    await photos.uploadProfilePhoto(upload());
    expect(await record(original.avatarMediaId)).toBeDefined();
    await expect(
      media.getMedia(
        request(jamie.cookie, undefined, "GET"),
        original.avatarMediaId,
      ),
    ).resolves.toBeInstanceOf(Response);
  });

  it("does not expose an unattached upload or a future journal photo as an avatar", async () => {
    const privatePhoto = await media.uploadMedia(upload());
    await entries.createEntry(
      request(alex.cookie, {
        kind: "photo",
        mediaId: privatePhoto.id,
        revealAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    await photos.uploadProfilePhoto(upload());
    await expect(
      media.getMedia(request(jamie.cookie, undefined, "GET"), privatePhoto.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("removes a departing member’s avatar and never carries it into a new space", async () => {
    const original = await photos.uploadProfilePhoto(upload());
    await spaces.leaveSpace(request(alex.cookie, undefined, "DELETE"));
    expect(await record(original.avatarMediaId)).toBeUndefined();
    expect(
      (await http.context(request(jamie.cookie, undefined, "GET"))).members,
    ).toHaveLength(1);
    await spaces.createSpace(request(alex.cookie, { name: "Another space" }));
    expect(await ownPhoto()).toBeUndefined();
    await expect(
      media.getMedia(
        request(alex.cookie, undefined, "GET"),
        original.avatarMediaId,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("rolls back uploads when membership changes while storage is writing", async () => {
    storageFault.afterPut = () =>
      spaces.leaveSpace(request(alex.cookie, undefined, "DELETE"));
    await expect(photos.uploadProfilePhoto(upload())).rejects.toMatchObject({
      status: 403,
    });
    expect(await db.resources(spaceId, "profilePhoto")).toEqual([]);
    expect(
      await db.rows("SELECT * FROM media WHERE space_id=?", spaceId),
    ).toEqual([]);
    storageFault.afterPut = null;
  });

  it("rechecks access when a member leaves during a private media download", async () => {
    const original = await photos.uploadProfilePhoto(upload());
    storageFault.afterGet = () =>
      spaces.leaveSpace(request(jamie.cookie, undefined, "DELETE"));
    await expect(
      media.getMedia(
        request(jamie.cookie, undefined, "GET"),
        original.avatarMediaId,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });

  it("keeps the previous avatar on a storage failure and queues ambiguous writes for cleanup", async () => {
    const original = await photos.uploadProfilePhoto(upload());
    storageFault.put = true;
    storageFault.remove = true;
    await expect(photos.uploadProfilePhoto(upload())).rejects.toThrow(
      "Simulated storage timeout",
    );
    expect(await ownPhoto()).toBe(original.avatarMediaId);
    expect(
      await db.rows("SELECT * FROM media WHERE space_id=?", spaceId),
    ).toHaveLength(1);
    expect(await db.rows("SELECT * FROM media_deletions")).toHaveLength(1);
    storageFault.put = false;
    storageFault.remove = false;
    await media.finishMediaDeletions();
    expect(await db.rows("SELECT * FROM media_deletions")).toEqual([]);
  });

  it("replaces an unshared avatar at the file limit but rolls back if the old photo is still attached", async () => {
    const first = await photos.uploadProfilePhoto(upload());
    for (let i = 0; i < 499; i++)
      await db.execute(
        "INSERT INTO media(id,space_id,owner_id,filename,mime,size,created_at) VALUES(?,?,?,?,?,?,?)",
        `limit-${i}`,
        spaceId,
        alex.id,
        `${spaceId}/limit-${i}.webp`,
        "image/webp",
        1,
        db.now(),
      );
    const second = await photos.uploadProfilePhoto(upload());
    expect(await record(first.avatarMediaId)).toBeUndefined();
    await entries.createEntry(
      request(alex.cookie, {
        kind: "photo",
        mediaId: second.avatarMediaId,
        body: "Keep this one",
      }),
    );
    await expect(photos.uploadProfilePhoto(upload())).rejects.toMatchObject({
      status: 409,
    });
    expect(await ownPhoto()).toBe(second.avatarMediaId);
    expect(
      (await db.row<{ count: number }>(
        "SELECT count(*) count FROM media WHERE space_id=?",
        spaceId,
      ))!.count,
    ).toBe(500);
  });
});
