import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { createTestIdentity } from "./fixtures/accounts";

const directory = mkdtempSync(join(tmpdir(), "twospace-partner-access-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";
let storage: typeof import("@/server/database");
let authModule: typeof import("@/server/auth");
let spaces: typeof import("@/server/spaces");
let entries: typeof import("@/server/entries");
let plans: typeof import("@/server/plans");
let activities: typeof import("@/server/activities");
let drawings: typeof import("@/server/drawings");
let music: typeof import("@/server/music");
let media: typeof import("@/server/media");
let profilePhotos: typeof import("@/server/profile-photos");
let snapshots: typeof import("@/server/snapshot");
let http: typeof import("@/server/http");
let download: typeof import("@/app/api/export/media/[id]/route").GET;
type Identity = { id: string; cookie: string };
const request = (identity: Identity, body?: unknown, method = "POST") =>
  new Request("http://127.0.0.1:3100/api/test", {
    method,
    headers: { cookie: identity.cookie, "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
const identity = (name: string) =>
  createTestIdentity({ auth: authModule.auth, execute: storage.execute }, name);
async function solo(name: string) {
  const user = await identity(name);
  const space = await spaces.createSpace(request(user, { name }));
  return { user, space };
}
async function paired(name: string) {
  const owner = await solo(name);
  const partner = await identity(`${name}Partner`);
  const invite = await spaces.invite(request(owner.user));
  await spaces.acceptInvite(request(partner, { token: invite.token }));
  return { ...owner, partner };
}
async function currentSpace(user: Identity) {
  return (await http.account(request(user, undefined, "GET"))).spaceId;
}
beforeAll(async () => {
  storage = await import("@/server/database");
  authModule = await import("@/server/auth");
  await authModule.ready();
  [
    spaces,
    entries,
    plans,
    activities,
    drawings,
    music,
    media,
    snapshots,
    http,
  ] = await Promise.all([
    import("@/server/spaces"),
    import("@/server/entries"),
    import("@/server/plans"),
    import("@/server/activities"),
    import("@/server/drawings"),
    import("@/server/music"),
    import("@/server/media"),
    import("@/server/snapshot"),
    import("@/server/http"),
  ]);
  profilePhotos = await import("@/server/profile-photos");
  ({ GET: download } = await import("@/app/api/export/media/[id]/route"));
}, 30000);
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("partner required for shared features", () => {
  it("returns only space metadata while waiting and allows account setup", async () => {
    const { user, space } = await solo("Waiting");
    const snapshot = await snapshots.getSnapshot(
      request(user, undefined, "GET"),
    );
    expect(snapshot.space).toMatchObject({
      id: space.id,
      hasPairedBefore: false,
      canSwitch: true,
    });
    for (const field of [
      "entries",
      "photoPairs",
      "questions",
      "games",
      "drawings",
      "ideas",
      "plans",
    ] as const)
      expect(snapshot[field]).toEqual([]);
    await expect(
      spaces.renameSpace(request(user, { name: "Renamed" })),
    ).resolves.toEqual({ ok: true });
    await expect(
      spaces.updateProfile(request(user, { name: "New name" })),
    ).resolves.toEqual({ ok: true });
    await expect(spaces.invite(request(user))).resolves.toHaveProperty("token");
  });

  it("rejects shared reads and writes before parsing their payloads", async () => {
    const { user } = await solo("Locked");
    const actions = [
      () => entries.createEntry(request(user, {})),
      () => entries.editEntry(request(user, {}), "entry"),
      () => entries.deleteEntry(request(user), "entry"),
      () => entries.replyToEntry(request(user, {}), "entry"),
      () => entries.reactToEntry(request(user), "entry"),
      () => entries.createPhotoPair(request(user, {})),
      () => entries.contributePhoto(request(user, {}), "pair"),
      () => plans.createPlan(request(user, {})),
      () => plans.editPlan(request(user, {}), "plan"),
      () => plans.deletePlan(request(user), "plan"),
      () => activities.createQuestion(request(user, {})),
      () => activities.answerQuestion(request(user, {}), "question"),
      () => activities.createGame(request(user, {})),
      () => activities.moveGame(request(user, {}), "game"),
      () => activities.createIdea(request(user, {})),
      () => activities.editIdea(request(user, {}), "idea"),
      () => drawings.createDrawing(request(user, {})),
      () => drawings.editDrawing(request(user, {}), "drawing"),
      () => music.getMusic(request(user, undefined, "GET")),
      () => music.saveTodaySong(request(user, {})),
      () => music.deleteSong(request(user, {}), "song"),
      () => media.uploadMedia(request(user)),
    ];
    for (const action of actions)
      await expect(action()).rejects.toMatchObject({
        status: 409,
        code: "PARTNER_REQUIRED",
      });
  });

  it("locks a departed partner's space while retaining its export and records", async () => {
    const { user, partner, space } = await paired("Memories");
    const entry = await entries.createEntry(
      request(user, { body: "Keep this memory" }),
    );
    const stale = await http.context(request(user, undefined, "GET"));
    await spaces.leaveSpace(request(partner));
    const snapshot = await snapshots.getSnapshot(
      request(user, undefined, "GET"),
    );
    expect(snapshot.space).toMatchObject({
      hasPairedBefore: true,
      canSwitch: false,
    });
    expect(snapshot.entries).toEqual([]);
    await expect(
      entries.createEntry(request(user, { body: "Not allowed" })),
    ).rejects.toMatchObject({ code: "PARTNER_REQUIRED" });
    await expect(
      http.spaceTransaction(stale, () => {
        throw new Error("must not run");
      }),
    ).rejects.toMatchObject({ status: 409 });
    const exported = await (
      await snapshots.exportSnapshot(request(user, undefined, "GET"))
    ).json();
    expect(exported.entries).toEqual([{ ...entry, locked: false }]);
    expect(await storage.resource(space.id, "entry", entry.id)).toEqual(entry);
  });
  it("blocks old media links and delayed uploads after a partner leaves", async () => {
    const { user, partner, space } = await paired("Attachments");
    const bytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#b78999" },
    })
      .png()
      .toBuffer();
    const photo = await media.storeImage(space.id, user.id, bytes);
    await spaces.leaveSpace(request(partner));
    await expect(
      media.getMedia(request(user, undefined, "GET"), photo.id),
    ).rejects.toMatchObject({ code: "PARTNER_REQUIRED" });
    await expect(
      media.storeImage(space.id, user.id, bytes),
    ).rejects.toMatchObject({ code: "PARTNER_REQUIRED" });
    expect(
      await storage.rows("SELECT id FROM media WHERE space_id=?", space.id),
    ).toEqual([{ id: photo.id }]);
  });
  it("exports visible saved attachments after a partner leaves without exposing hidden or orphan files", async () => {
    const { user, partner, space } = await paired("Archive");
    const outsider = await solo("ArchiveOutsider");
    const bytes = await sharp({
      create: { width: 4, height: 4, channels: 3, background: "#b78999" },
    })
      .png()
      .toBuffer();
    const photo = await media.storeImage(space.id, user.id, bytes);
    const hidden = await media.storeImage(space.id, partner.id, bytes);
    const orphan = await media.storeImage(space.id, user.id, bytes);
    const pairedPhoto = await media.storeImage(space.id, partner.id, bytes);
    await entries.createEntry(
      request(user, {
        kind: "photo",
        mediaId: photo.id,
        title: "Coffee at home",
      }),
    );
    await entries.createEntry(
      request(partner, {
        kind: "photo",
        mediaId: hidden.id,
        title: "Hidden birthday surprise",
        revealAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    const pair = await entries.createPhotoPair(
      request(partner, { prompt: "Today's view" }),
    );
    await entries.contributePhoto(
      request(partner, { mediaId: pairedPhoto.id, caption: "A view" }),
      pair.id,
    );
    await spaces.leaveSpace(request(partner));
    const exported = await (
      await snapshots.exportSnapshot(request(user, undefined, "GET"))
    ).json();
    expect(
      exported.files.map((file: { id: string }) => file.id).sort(),
    ).toEqual([photo.id, pairedPhoto.id].sort());
    expect(
      exported.files.find((file: { id: string }) => file.id === photo.id),
    ).toMatchObject({
      name: expect.stringMatching(/^Coffee at home-.*\.webp$/),
      url: `/api/export/media/${photo.id}`,
    });
    const parameters = (id: string) => ({ params: Promise.resolve({ id }) });
    const downloaded = await download(
      request(user, undefined, "GET"),
      parameters(photo.id),
    );
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get("content-disposition")).toMatch(
      /^attachment;/,
    );
    expect(downloaded.headers.get("cache-control")).toBe("private, no-store");
    expect(downloaded.headers.get("content-type")).toBe("image/webp");
    expect((await downloaded.arrayBuffer()).byteLength).toBeGreaterThan(0);
    for (const id of [hidden.id, orphan.id])
      expect(
        (await download(request(user, undefined, "GET"), parameters(id)))
          .status,
      ).toBe(404);
    expect(
      (
        await download(
          request(outsider.user, undefined, "GET"),
          parameters(photo.id),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await download(
          new Request("http://127.0.0.1:3100/api/export/media/test"),
          parameters(photo.id),
        )
      ).status,
    ).toBe(401);
    expect(
      (await download(request(partner, undefined, "GET"), parameters(photo.id)))
        .status,
    ).toBe(404);
  });
});

describe("joining a partner after creating a space", () => {
  it("brings only the account's avatar when switching an otherwise empty space", async () => {
    const source = await solo("AvatarSource");
    const target = await solo("AvatarTarget");
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#b78999" },
    })
      .png()
      .toBuffer();
    const avatar = await profilePhotos.uploadProfilePhoto(
      new Request("http://127.0.0.1:3100/api/profile/photo", {
        method: "PUT",
        headers: { cookie: source.user.cookie, "content-type": "image/png" },
        body: Uint8Array.from(bytes),
      }),
    );
    const original = await storage.row<{ filename: string }>(
      "SELECT filename FROM media WHERE id=?",
      avatar.avatarMediaId,
    );
    expect(
      (await snapshots.getSnapshot(request(source.user, undefined, "GET")))
        .space.canSwitch,
    ).toBe(true);
    const invite = await spaces.invite(request(target.user));
    await spaces.acceptInvite(
      request(source.user, { token: invite.token, switchSpace: true }),
    );
    const joined = await snapshots.getSnapshot(
      request(source.user, undefined, "GET"),
    );
    expect(joined.me.avatarMediaId).toBe(avatar.avatarMediaId);
    expect(await storage.resources(source.space.id, "profilePhoto")).toEqual(
      [],
    );
    expect(
      await storage.row(
        "SELECT space_id, filename FROM media WHERE id=?",
        avatar.avatarMediaId,
      ),
    ).toEqual({ space_id: target.space.id, filename: original!.filename });
    await expect(
      media.getMedia(
        request(target.user, undefined, "GET"),
        avatar.avatarMediaId,
      ),
    ).resolves.toBeInstanceOf(Response);
  });

  it("does not move an unrelated orphan upload along with an avatar", async () => {
    const source = await solo("OrphanSource");
    const target = await solo("OrphanTarget");
    const bytes = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#b78999" },
    })
      .png()
      .toBuffer();
    const avatar = await profilePhotos.uploadProfilePhoto(
      new Request("http://127.0.0.1:3100/api/profile/photo", {
        method: "PUT",
        headers: { cookie: source.user.cookie, "content-type": "image/png" },
        body: Uint8Array.from(bytes),
      }),
    );
    await storage.execute(
      "INSERT INTO media(id,space_id,owner_id,filename,mime,size,created_at) VALUES(?,?,?,?,?,?,?)",
      "orphan-image",
      source.space.id,
      source.user.id,
      "historical-orphan.webp",
      "image/webp",
      12,
      storage.now(),
    );
    expect(
      (await snapshots.getSnapshot(request(source.user, undefined, "GET")))
        .space.canSwitch,
    ).toBe(false);
    const invite = await spaces.invite(request(target.user));
    await expect(
      spaces.acceptInvite(
        request(source.user, { token: invite.token, switchSpace: true }),
      ),
    ).rejects.toMatchObject({ code: "SPACE_NOT_EMPTY" });
    expect(await currentSpace(source.user)).toBe(source.space.id);
    expect(
      await storage.row(
        "SELECT space_id FROM media WHERE id=?",
        avatar.avatarMediaId,
      ),
    ).toEqual({ space_id: source.space.id });
    await expect(
      media.getMedia(
        request(source.user, undefined, "GET"),
        avatar.avatarMediaId,
      ),
    ).resolves.toBeInstanceOf(Response);
  });

  it("requires confirmation, then moves an empty solo space membership atomically", async () => {
    const source = await solo("Source");
    const destination = await solo("Destination");
    const oldInvite = await spaces.invite(request(source.user));
    const invite = await spaces.invite(request(destination.user));
    await expect(
      spaces.acceptInvite(request(source.user, { token: invite.token })),
    ).rejects.toMatchObject({ code: "SWITCH_CONFIRMATION_REQUIRED" });
    expect(await currentSpace(source.user)).toBe(source.space.id);
    await expect(
      spaces.acceptInvite(
        request(source.user, { token: invite.token, switchSpace: true }),
      ),
    ).resolves.toEqual({ spaceId: destination.space.id });
    expect(await currentSpace(source.user)).toBe(destination.space.id);
    expect(
      (await snapshots.getSnapshot(request(source.user, undefined, "GET")))
        .members,
    ).toHaveLength(2);
    expect(
      await storage.row("SELECT id FROM spaces WHERE id=?", source.space.id),
    ).toEqual({ id: source.space.id });
    const late = await identity("Late");
    await expect(
      spaces.acceptInvite(request(late, { token: oldInvite.token })),
    ).rejects.toMatchObject({ status: 410 });
  });

  it("does not leave the source for an expired, unknown, self, or already-used invite", async () => {
    const source = await solo("Unchanged");
    const destination = await solo("Expired");
    const own = await spaces.invite(request(source.user));
    const expired = await spaces.invite(request(destination.user));
    await storage.execute(
      "UPDATE invitations SET expires_at=? WHERE space_id=?",
      "2000-01-01T00:00:00Z",
      destination.space.id,
    );
    for (const [token, code] of [
      [own.token, "OWN_INVITE"],
      [expired.token, undefined],
      ["x".repeat(43), undefined],
    ]) {
      await expect(
        spaces.acceptInvite(request(source.user, { token, switchSpace: true })),
      ).rejects.toMatchObject(code ? { code } : { status: 410 });
      expect(await currentSpace(source.user)).toBe(source.space.id);
    }
    const fresh = await spaces.invite(request(destination.user));
    const other = await identity("Other");
    await spaces.acceptInvite(request(other, { token: fresh.token }));
    await expect(
      spaces.acceptInvite(
        request(source.user, { token: fresh.token, switchSpace: true }),
      ),
    ).rejects.toMatchObject({ status: 410 });
    expect(await currentSpace(source.user)).toBe(source.space.id);
  });

  it("keeps historical content and requires leaving deliberately instead of switching", async () => {
    const source = await solo("Historical");
    const destination = await solo("JoinTarget");
    // Content created before partner gating remains the owner's data.
    const entry = {
      id: "old-note",
      authorId: source.user.id,
      kind: "note",
      body: "Saved before pairing was required",
      title: "",
      createdAt: storage.now(),
      pinned: false,
      collection: "",
      reactions: [],
      replies: [],
    };
    await storage.insertResource(
      source.space.id,
      "entry",
      source.user.id,
      entry,
    );
    const invite = await spaces.invite(request(destination.user));
    expect(
      (await snapshots.getSnapshot(request(source.user, undefined, "GET")))
        .space.canSwitch,
    ).toBe(false);
    await expect(
      spaces.acceptInvite(
        request(source.user, { token: invite.token, switchSpace: true }),
      ),
    ).rejects.toMatchObject({ code: "SPACE_NOT_EMPTY" });
    expect(await currentSpace(source.user)).toBe(source.space.id);
    expect(
      (
        await (
          await snapshots.exportSnapshot(request(source.user, undefined, "GET"))
        ).json()
      ).entries,
    ).toEqual([{ ...entry, locked: false }]);
  });

  it("does not switch a paired or formerly paired space", async () => {
    const source = await paired("Established");
    const destination = await solo("NewPartner");
    const invite = await spaces.invite(request(destination.user));
    await expect(
      spaces.acceptInvite(
        request(source.user, { token: invite.token, switchSpace: true }),
      ),
    ).rejects.toMatchObject({ code: "SPACE_ALREADY_PAIRED" });
    await spaces.leaveSpace(request(source.partner));
    await expect(
      spaces.acceptInvite(
        request(source.user, { token: invite.token, switchSpace: true }),
      ),
    ).rejects.toMatchObject({ code: "SPACE_ALREADY_PAIRED" });
    expect(await currentSpace(source.user)).toBe(source.space.id);
  });

  it("allows only one concurrent switch for an account", async () => {
    const source = await solo("Racing");
    const first = await solo("FirstTarget");
    const second = await solo("SecondTarget");
    const invites = await Promise.all([
      spaces.invite(request(first.user)),
      spaces.invite(request(second.user)),
    ]);
    const result = await Promise.allSettled(
      invites.map((invite) =>
        spaces.acceptInvite(
          request(source.user, { token: invite.token, switchSpace: true }),
        ),
      ),
    );
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(result.filter((item) => item.status === "rejected")).toHaveLength(1);
    expect(
      await storage.rows(
        "SELECT space_id FROM memberships WHERE user_id=?",
        source.user.id,
      ),
    ).toHaveLength(1);
    const remaining = [first, second].find(
      (item) =>
        item.space.id !==
        (
          result.find(
            (item) => item.status === "fulfilled",
          ) as PromiseFulfilledResult<{ spaceId: string }>
        ).value.spaceId,
    )!;
    expect(
      (await snapshots.getSnapshot(request(remaining.user, undefined, "GET")))
        .members,
    ).toHaveLength(1);
  });
});
