import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { Pool } from "pg";
import sharp from "sharp";
import { createTestIdentity } from "./fixtures/accounts";
import { localDateInZone } from "@/shared/time";
const { queueEmail } = vi.hoisted(() => ({ queueEmail: vi.fn() }));
vi.mock("@/server/email", () => ({ queueEmail }));
const testObjects = vi.hoisted(() => new Map<string, Buffer>());
vi.mock("@/server/object-store", () => ({
  objectStoreReady: async () => {},
  putObject: async (key: string, value: Buffer) => {
    testObjects.set(key, Buffer.from(value));
  },
  getObject: async (key: string) => {
    const value = testObjects.get(key);
    if (!value) throw new Error("Test object not found");
    return Buffer.from(value);
  },
  removeObject: async (key: string) => {
    testObjects.delete(key);
  },
}));
vi.mock("@/server/spotify", () => ({
  getSpotifyTrack: async (id: string) => ({
    id,
    title: "Cloud test song",
    artists: ["Test artist"],
    album: "Test album",
    imageUrl: null,
    durationMs: 180000,
    url: `https://open.spotify.com/track/${id}`,
  }),
  spotifySearchAvailable: () => true,
  limitSpotifyRequests: () => {},
}));

const connectionString = process.env.TWOSPACE_TEST_POSTGRES_URL;
const enabled = Boolean(connectionString);
let admin: Pool;
let storage: typeof import("@/server/database");
let authModule: typeof import("@/server/auth");
let spaces: typeof import("@/server/spaces");
let entries: typeof import("@/server/entries");
let activities: typeof import("@/server/activities");
let plans: typeof import("@/server/plans");
let snapshots: typeof import("@/server/snapshot");
let music: typeof import("@/server/music");
let profilePhotos: typeof import("@/server/profile-photos");
let media: typeof import("@/server/media");
type Identity = { id: string; cookie: string };
let alex: Identity, jamie: Identity, outsider: Identity;
const previous: Record<string, string | undefined> = {};
function setEnvironment(key: string, value: string | undefined) {
  previous[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
const request = (cookie: string, body?: unknown, method = "POST") =>
  new Request("http://127.0.0.1:3100/api/test", {
    method,
    headers: {
      cookie,
      origin: "http://127.0.0.1:3100",
      "content-type": "application/json",
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
function identity(name: string): Promise<Identity> {
  return createTestIdentity(
    { auth: authModule.auth, execute: storage.execute, cloud: true },
    name,
  );
}

describe.skipIf(!enabled)(
  "PostgreSQL integration (requires TWOSPACE_TEST_POSTGRES_URL)",
  () => {
    beforeAll(async () => {
      const target = new URL(connectionString!);
      if (
        !["127.0.0.1", "localhost"].includes(target.hostname) ||
        target.pathname !== "/twospace_test"
      )
        throw new Error(
          "PostgreSQL tests require the disposable twospace_test database on loopback.",
        );
      const environment = {
        NODE_ENV: "test",
        TWOSPACE_STORAGE: "cloud",
        DATABASE_URL: connectionString!,
        BETTER_AUTH_URL: "http://127.0.0.1:3100",
        BETTER_AUTH_SECRET: randomBytes(48).toString("base64url"),
        S3_ENDPOINT: "http://127.0.0.1:1",
        S3_REGION: "test",
        S3_BUCKET: "not-used",
        S3_ACCESS_KEY_ID: "test-only",
        S3_SECRET_ACCESS_KEY: "test-only",
      };
      for (const [key, value] of Object.entries(environment))
        setEnvironment(key, value);
      for (const key of [
        "SUPABASE_URL",
        "SUPABASE_SECRET_KEY",
        "SUPABASE_SERVICE_ROLE_KEY",
        "GOOGLE_CLIENT_ID",
        "GOOGLE_CLIENT_SECRET",
        "RESEND_API_KEY",
        "BREVO_API_KEY",
        "EMAIL_PROVIDER",
        "EMAIL_FROM",
      ])
        setEnvironment(key, undefined);
      admin = new Pool({ connectionString, ssl: false });
      await admin.query("DROP SCHEMA IF EXISTS twospace CASCADE");
      storage = await import("@/server/database");
      authModule = await import("@/server/auth");
      await Promise.all([
        authModule.ready(),
        authModule.ready(),
        authModule.ready(),
      ]);
      [spaces, entries, activities, plans, snapshots, music] =
        await Promise.all([
          import("@/server/spaces"),
          import("@/server/entries"),
          import("@/server/activities"),
          import("@/server/plans"),
          import("@/server/snapshot"),
          import("@/server/music"),
        ]);
      [profilePhotos, media] = await Promise.all([
        import("@/server/profile-photos"),
        import("@/server/media"),
      ]);
      alex = await identity("Alex");
      jamie = await identity("Jamie");
      outsider = await identity("Casey");
      await spaces.createSpace(
        request(alex.cookie, { name: "Alex and Jamie" }),
      );
      await spaces.createSpace(
        request(outsider.cookie, { name: "Separate space" }),
      );
      const invitation = await spaces.invite(request(alex.cookie, {}));
      await spaces.acceptInvite(
        request(jamie.cookie, { token: invitation.token }),
      );
    }, 30000);
    afterAll(async () => {
      await storage?.closeDatabase();
      if (admin) {
        await admin.query("DROP SCHEMA IF EXISTS twospace CASCADE");
        await admin.end();
      }
      for (const [key, value] of Object.entries(previous))
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
    });

    it("creates application and authentication tables in the private schema", async () => {
      const result = await admin.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema='twospace'",
      );
      expect(result.rows.map((row) => row.table_name)).toEqual(
        expect.arrayContaining([
          "user",
          "session",
          "account",
          "verification",
          "profiles",
          "memberships",
          "resources",
        ]),
      );
      expect(
        (await snapshots.getSnapshot(request(alex.cookie, undefined, "GET")))
          .members,
      ).toHaveLength(2);
    });
    it("keeps separate spaces and unrevealed answers private", async () => {
      const entry = await entries.createEntry(
        request(alex.cookie, { body: "For our space only" }),
      );
      await expect(
        entries.editEntry(
          request(outsider.cookie, { body: "Changed" }),
          entry.id,
        ),
      ).rejects.toMatchObject({ status: 404 });
      const question = await activities.createQuestion(
        request(alex.cookie, {
          prompt: "What did you notice?",
          category: "Everyday",
        }),
      );
      await activities.answerQuestion(
        request(alex.cookie, { body: "A private answer" }),
        question.id,
      );
      const partner = await snapshots.getSnapshot(
        request(jamie.cookie, undefined, "GET"),
      );
      expect(
        partner.questions.find((item) => item.id === question.id)?.answers[0]
          .body,
      ).toBeNull();
      expect(
        (
          await snapshots.getSnapshot(
            request(outsider.cookie, undefined, "GET"),
          )
        ).entries,
      ).toHaveLength(0);
    });
    it("accepts only one concurrent move at a board revision", async () => {
      const game = await activities.createGame(
        request(alex.cookie, { kind: "four" }),
      );
      const results = await Promise.allSettled([
        activities.moveGame(
          request(alex.cookie, { revision: 0, column: 2 }),
          game.id,
        ),
        activities.moveGame(
          request(alex.cookie, { revision: 0, column: 3 }),
          game.id,
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        (
          results.find(
            (result) => result.status === "rejected",
          ) as PromiseRejectedResult
        ).reason,
      ).toMatchObject({ status: 409, code: "STALE_REVISION" });
    });
    it("serializes daily song picks and keeps deleted revisions from removing a replacement", async () => {
      const input = {
        trackId: "0Lr4kGOYn9l83EjuK6cZFQ",
        note: "A private song note",
        day: localDateInZone(new Date().toISOString(), "America/Chicago"),
        revision: 0,
      };
      const results = await Promise.allSettled([
        music.saveTodaySong(request(alex.cookie, input, "PUT")),
        music.saveTodaySong(
          request(alex.cookie, { ...input, note: "A concurrent note" }, "PUT"),
        ),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      expect(
        results.find((result) => result.status === "rejected"),
      ).toMatchObject({ reason: { status: 409, code: "MUSIC_CONFLICT" } });
      const first = (
        await music.getMusic(request(alex.cookie, undefined, "GET"))
      ).songs[0];
      expect(
        (await music.getMusic(request(jamie.cookie, undefined, "GET"))).songs,
      ).toEqual([first]);
      expect(
        (await music.getMusic(request(outsider.cookie, undefined, "GET")))
          .songs,
      ).toEqual([]);
      await expect(
        music.deleteSong(
          request(jamie.cookie, { revision: first.revision }, "DELETE"),
          first.id,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await music.deleteSong(
        request(alex.cookie, { revision: first.revision }, "DELETE"),
        first.id,
      );
      expect(
        (await music.getMusic(request(alex.cookie, undefined, "GET"))).songs,
      ).toEqual([]);
      const snapshot = await snapshots.getSnapshot(
        request(alex.cookie, undefined, "GET"),
      );
      const tombstone = await storage.resource<Record<string, unknown>>(
        snapshot.space.id,
        "song",
        first.id,
      );
      expect(tombstone).toEqual({
        id: first.id,
        authorId: alex.id,
        day: first.day,
        revision: 2,
        deleted: true,
      });
      const replacement = await music.saveTodaySong(
        request(alex.cookie, input, "PUT"),
      );
      expect(replacement.revision).toBe(3);
      await expect(
        music.deleteSong(
          request(alex.cookie, { revision: first.revision }, "DELETE"),
          first.id,
        ),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("keeps simultaneous checklist additions and resets agreement after a changed plan", async () => {
      const plan = await plans.createPlan(
        request(alex.cookie, {
          title: "Cook together",
          startsAt: "2027-03-15T18:00:00Z",
          timeZone: "Europe/London",
          duration: 60,
          kind: "date",
        }),
      );
      await plans.editPlan(request(jamie.cookie, { accepted: true }), plan.id);
      await Promise.all([
        plans.editPlan(
          request(alex.cookie, {
            checklistAction: { type: "add", text: "Check flour" },
          }),
          plan.id,
        ),
        plans.editPlan(
          request(jamie.cookie, {
            checklistAction: { type: "add", text: "Find the pan" },
          }),
          plan.id,
        ),
      ]);
      const stored = (
        await snapshots.getSnapshot(request(alex.cookie, undefined, "GET"))
      ).plans.find((item) => item.id === plan.id)!;
      expect(stored.checklist.map((item) => item.text).sort()).toEqual([
        "Check flour",
        "Find the pan",
      ]);
      expect(
        (
          await plans.editPlan(
            request(alex.cookie, { startsAt: "2027-03-15T19:00:00Z" }),
            plan.id,
          )
        ).status,
      ).toBe("proposed");
    });
    it("replaces profile photos atomically and keeps photos still attached to the journal", async () => {
      const bytes = await sharp({
        create: { width: 48, height: 48, channels: 3, background: "#b78999" },
      })
        .jpeg()
        .toBuffer();
      const upload = () =>
        new Request("http://127.0.0.1:3100/api/profile/photo", {
          method: "PUT",
          headers: { cookie: alex.cookie, "content-type": "image/jpeg" },
          body: Uint8Array.from(bytes),
        });
      const first = await profilePhotos.uploadProfilePhoto(upload());
      const entry = await entries.createEntry(
        request(alex.cookie, {
          kind: "photo",
          mediaId: first.avatarMediaId,
          body: "Keep this photo",
        }),
      );
      const results = await Promise.all([
        profilePhotos.uploadProfilePhoto(upload()),
        profilePhotos.uploadProfilePhoto(upload()),
      ]);
      const partner = await snapshots.getSnapshot(
        request(jamie.cookie, undefined, "GET"),
      );
      const current = partner.members.find(
        (person) => person.id === alex.id,
      )!.avatarMediaId!;
      expect(results.map((result) => result.avatarMediaId)).toContain(current);
      expect(
        await storage.resources(partner.space.id, "profilePhoto"),
      ).toHaveLength(1);
      expect(
        await storage.rows(
          "SELECT * FROM media WHERE space_id=?",
          partner.space.id,
        ),
      ).toHaveLength(2);
      await expect(
        media.getMedia(request(jamie.cookie, undefined, "GET"), current),
      ).resolves.toBeInstanceOf(Response);
      await expect(
        media.getMedia(request(outsider.cookie, undefined, "GET"), current),
      ).rejects.toMatchObject({ status: 404 });
      await profilePhotos.removeProfilePhoto(
        request(alex.cookie, undefined, "DELETE"),
      );
      expect(
        (await snapshots.getSnapshot(request(alex.cookie, undefined, "GET"))).me
          .avatarMediaId,
      ).toBeUndefined();
      expect(
        await storage.rows(
          "SELECT * FROM media WHERE space_id=?",
          partner.space.id,
        ),
      ).toHaveLength(1);
      await entries.deleteEntry(
        request(alex.cookie, undefined, "DELETE"),
        entry.id,
      );
      expect(
        await storage.rows(
          "SELECT * FROM media WHERE space_id=?",
          partner.space.id,
        ),
      ).toEqual([]);
      await media.finishMediaDeletions();
      expect(testObjects.size).toBe(0);
    });
    it("holds the migration lock in a transaction and releases it after success or failure", async () => {
      await storage.withAuthMigrationLock(async () => {
        const held = await admin.query(
          "SELECT a.state FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE l.locktype='advisory' AND l.granted AND l.database=(SELECT oid FROM pg_database WHERE datname=current_database())",
        );
        expect(held.rows.map((row) => row.state)).toEqual([
          "idle in transaction",
        ]);
      });
      await expect(
        storage.withAuthMigrationLock(async () => {
          throw new Error("migration fixture failed");
        }),
      ).rejects.toThrow("migration fixture failed");
      const connection = await admin.connect();
      try {
        await connection.query("BEGIN");
        const result = await connection.query(
          "SELECT pg_try_advisory_xact_lock(hashtext('twospace-auth-schema')) AS acquired",
        );
        expect(result.rows[0].acquired).toBe(true);
      } finally {
        await connection.query("ROLLBACK");
        connection.release();
      }
      const result = await admin.query(
        "SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory' AND database=(SELECT oid FROM pg_database WHERE datname=current_database())",
      );
      expect(result.rows[0].count).toBe(0);
    });
  },
);
