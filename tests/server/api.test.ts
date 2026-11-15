import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestIdentity } from "./fixtures/accounts";
import type { WordState } from "@/shared/types";

const directory = mkdtempSync(join(tmpdir(), "twospace-api-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";
let authModule: typeof import("@/server/auth");
let storage: typeof import("@/server/database");
let spaces: typeof import("@/server/spaces");
let entries: typeof import("@/server/entries");
let activities: typeof import("@/server/activities");
let plans: typeof import("@/server/plans");
let drawings: typeof import("@/server/drawings");
let snapshots: typeof import("@/server/snapshot");
let media: typeof import("@/server/media");
let alex: { id: string; cookie: string },
  jamie: { id: string; cookie: string },
  outsider: { id: string; cookie: string };
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
function signUp(name: string) {
  return createTestIdentity(
    { auth: authModule.auth, execute: storage.execute },
    name,
  );
}
beforeAll(async () => {
  authModule = await import("@/server/auth");
  storage = await import("@/server/database");
  await authModule.ready();
  [spaces, entries, activities, plans, drawings, snapshots, media] =
    await Promise.all([
      import("@/server/spaces"),
      import("@/server/entries"),
      import("@/server/activities"),
      import("@/server/plans"),
      import("@/server/drawings"),
      import("@/server/snapshot"),
      import("@/server/media"),
    ]);
  alex = await signUp("Alex");
  jamie = await signUp("Jamie");
  outsider = await signUp("Casey");
  await spaces.createSpace(request(alex.cookie, { name: "Alex and Jamie" }));
  await spaces.createSpace(
    request(outsider.cookie, { name: "A different space" }),
  );
  const invitation = await spaces.invite(request(alex.cookie, {}));
  await spaces.acceptInvite(request(jamie.cookie, { token: invitation.token }));
}, 30000);
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("private spaces", () => {
  it("rejects unauthenticated reads and scopes records to the signed-in space", async () => {
    await expect(
      snapshots.getSnapshot(request("", undefined, "GET")),
    ).rejects.toMatchObject({ status: 401 });
    const entry = await entries.createEntry(
      request(alex.cookie, { kind: "note", body: "Private note" }),
    );
    const otherSpace = await snapshots.getSnapshot(
      request(outsider.cookie, undefined, "GET"),
    );
    expect(otherSpace.entries.some((item) => item.id === entry.id)).toBe(false);
    await expect(
      entries.editEntry(
        request(outsider.cookie, { body: "Changed" }),
        entry.id,
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("does not let a partner rewrite another author’s note", async () => {
    const entry = await entries.createEntry(
      request(alex.cookie, { body: "My words" }),
    );
    await expect(
      entries.editEntry(
        request(jamie.cookie, { body: "Different words" }),
        entry.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    expect(
      (
        await entries.editEntry(
          request(jamie.cookie, { pinned: true }),
          entry.id,
        )
      ).pinned,
    ).toBe(true);
  });
  it("never returns a future letter body or attachment to its recipient", async () => {
    const entry = await entries.createEntry(
      request(alex.cookie, {
        body: "Hidden surprise",
        title: "Secret title",
        revealAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    const partner = await snapshots.getSnapshot(
      request(jamie.cookie, undefined, "GET"),
    );
    const visible = partner.entries.find((item) => item.id === entry.id)!;
    expect(visible).toMatchObject({
      locked: true,
      body: "",
      title: "A note for later",
      replies: [],
    });
    expect(JSON.stringify(visible)).not.toContain("Hidden surprise");
    expect(
      (
        await snapshots.getSnapshot(request(alex.cookie, undefined, "GET"))
      ).entries.find((item) => item.id === entry.id)?.body,
    ).toBe("Hidden surprise");
    await expect(
      entries.replyToEntry(
        request(jamie.cookie, { body: "Premature reply" }),
        entry.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("hides unrevealed answers in both response and exported snapshot", async () => {
    const question = await activities.createQuestion(
      request(alex.cookie, {
        prompt: "What did you notice today?",
        category: "Everyday",
      }),
    );
    await activities.answerQuestion(
      request(alex.cookie, { body: "A secret answer" }),
      question.id,
    );
    let partner = await snapshots.getSnapshot(
      request(jamie.cookie, undefined, "GET"),
    );
    expect(
      partner.questions.find((item) => item.id === question.id)?.answers[0]
        .body,
    ).toBeNull();
    const exported = await snapshots.exportSnapshot(
      request(jamie.cookie, undefined, "GET"),
    );
    expect(await exported.text()).not.toContain("A secret answer");
    const complete = await activities.answerQuestion(
      request(jamie.cookie, { body: "Another answer" }),
      question.id,
    );
    expect(complete.complete).toBe(true);
    expect(complete.answers.map((answer) => answer.body)).toEqual([
      "A secret answer",
      "Another answer",
    ]);
  });
});

describe("shared moves", () => {
  it("accepts only one move for a board revision", async () => {
    const game = await activities.createGame(
      request(alex.cookie, { kind: "four" }),
    );
    const result = await Promise.allSettled([
      activities.moveGame(
        request(alex.cookie, { revision: 0, column: 3 }),
        game.id,
      ),
      activities.moveGame(
        request(alex.cookie, { revision: 0, column: 4 }),
        game.id,
      ),
    ]);
    expect(result.filter((item) => item.status === "fulfilled")).toHaveLength(
      1,
    );
    const failure = result.find(
      (item) => item.status === "rejected",
    ) as PromiseRejectedResult;
    expect(failure.reason).toMatchObject({
      status: 409,
      code: "STALE_REVISION",
    });
    await expect(
      activities.moveGame(
        request(alex.cookie, { revision: 1, column: 2 }),
        game.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("keeps a word answer secret until the partner solves it", async () => {
    const game = await activities.createGame(
      request(alex.cookie, {
        kind: "word",
        answer: "A Small Boat",
        clues: ["It floats.", "It is little.", "We drew one."],
      }),
    );
    const snapshot = await snapshots.getSnapshot(
      request(jamie.cookie, undefined, "GET"),
    );
    expect(
      (snapshot.games.find((item) => item.id === game.id)?.state as WordState)
        .answer,
    ).toBe("");
    await expect(
      activities.moveGame(
        request(alex.cookie, { revision: 0, guess: "A Small Boat" }),
        game.id,
      ),
    ).rejects.toMatchObject({ status: 403 });
    const solved = await activities.moveGame(
      request(jamie.cookie, { revision: 0, guess: "a   small boat" }),
      game.id,
    );
    expect(solved.state).toMatchObject({
      solved: true,
      answer: "A Small Boat",
    });
  });
  it("keeps drawing turns and undo ownership on the server", async () => {
    const drawing = await drawings.createDrawing(
      request(alex.cookie, { title: "A garden" }),
    );
    const stroke = {
      id: crypto.randomUUID(),
      tool: "line",
      color: "#416B67",
      width: 4,
      points: [
        { x: 10, y: 20 },
        { x: 40, y: 80 },
      ],
    };
    await expect(
      drawings.editDrawing(
        request(jamie.cookie, { revision: 0, action: "stroke", stroke }),
        drawing.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    await drawings.editDrawing(
      request(alex.cookie, { revision: 0, action: "stroke", stroke }),
      drawing.id,
    );
    await drawings.editDrawing(
      request(alex.cookie, { revision: 1, action: "pass" }),
      drawing.id,
    );
    await expect(
      drawings.editDrawing(
        request(jamie.cookie, { revision: 2, action: "undo" }),
        drawing.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe("planning together", () => {
  const input = {
    title: "Cook dumplings",
    startsAt: "2027-03-15T18:00:00Z",
    timeZone: "Europe/London",
    duration: 60,
    kind: "date",
  };
  it("asks for agreement again when the accepted time changes", async () => {
    const plan = await plans.createPlan(request(alex.cookie, input));
    expect(
      (await plans.editPlan(request(jamie.cookie, { accepted: true }), plan.id))
        .status,
    ).toBe("accepted");
    const changed = await plans.editPlan(
      request(jamie.cookie, { startsAt: "2027-03-15T19:00:00Z" }),
      plan.id,
    );
    expect(changed).toMatchObject({
      status: "proposed",
      proposedBy: jamie.id,
      acceptedBy: [jamie.id],
    });
  });
  it("retains both partners’ checklist additions", async () => {
    const plan = await plans.createPlan(request(alex.cookie, input));
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
    const snapshot = await snapshots.getSnapshot(
      request(alex.cookie, undefined, "GET"),
    );
    expect(
      snapshot.plans
        .find((item) => item.id === plan.id)
        ?.checklist.map((item) => item.text)
        .sort(),
    ).toEqual(["Check flour", "Find the pan"]);
  });
});

describe("invitations and separation", () => {
  it("allows only one person to accept an invitation and protects old history after leaving", async () => {
    const host = await signUp("Morgan"),
      first = await signUp("Riley"),
      second = await signUp("Taylor");
    await spaces.createSpace(request(host.cookie, { name: "A new space" }));
    const invitation = await spaces.invite(request(host.cookie, {}));
    const attempts = await Promise.allSettled([
      spaces.acceptInvite(request(first.cookie, { token: invitation.token })),
      spaces.acceptInvite(request(second.cookie, { token: invitation.token })),
    ]);
    expect(
      attempts.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const accepted = attempts[0].status === "fulfilled" ? first : second;
    const memberView = await snapshots.getSnapshot(
      request(host.cookie, undefined, "GET"),
    );
    expect(memberView.members).toHaveLength(2);
    await spaces.leaveSpace(request(accepted.cookie));
    await expect(spaces.invite(request(host.cookie, {}))).rejects.toMatchObject(
      { status: 409 },
    );
    await expect(
      snapshots.getSnapshot(request(accepted.cookie, undefined, "GET")),
    ).rejects.toMatchObject({ status: 404, code: "NO_SPACE" });
  });
});

describe("private media", () => {
  it("puts modern Supabase secret keys in the API-key header only", async () => {
    const { supabaseHeaders } = await import("@/server/object-store");
    expect(supabaseHeaders("sb_secret_test-only")).toEqual({
      apikey: "sb_secret_test-only",
    });
    expect(supabaseHeaders("eyJtest-only")).toEqual({
      apikey: "eyJtest-only",
      Authorization: "Bearer eyJtest-only",
    });
  });
  it("checks visibility again when an attachment is requested directly", async () => {
    const sharp = (await import("sharp")).default;
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#416B67" },
    })
      .png()
      .toBuffer();
    const uploaded = await media.uploadMedia(
      new Request("http://127.0.0.1:3100/api/media", {
        method: "POST",
        headers: { cookie: alex.cookie, "content-type": "image/png" },
        body: png,
      }),
    );
    await expect(
      media.getMedia(request(jamie.cookie, undefined, "GET"), uploaded.id),
    ).rejects.toMatchObject({ status: 404 });
    await entries.createEntry(
      request(alex.cookie, {
        kind: "photo",
        body: "Tomorrow’s photo",
        mediaId: uploaded.id,
        revealAt: new Date(Date.now() + 86400000).toISOString(),
      }),
    );
    await expect(
      media.getMedia(request(jamie.cookie, undefined, "GET"), uploaded.id),
    ).rejects.toMatchObject({ status: 404 });
    await entries.createEntry(
      request(alex.cookie, {
        kind: "photo",
        body: "A photo for now",
        mediaId: uploaded.id,
      }),
    );
    const photo = await media.getMedia(
      request(jamie.cookie, undefined, "GET"),
      uploaded.id,
    );
    expect(photo.headers.get("content-type")).toBe("image/webp");
    expect(photo.headers.get("cache-control")).toContain("no-store");
    await expect(
      media.getMedia(request(outsider.cookie, undefined, "GET"), uploaded.id),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("PostgreSQL statements", () => {
  it("qualifies application tables without changing quoted content or binding values inline", () => {
    expect(
      storage.postgresSql(
        "SELECT 'profiles?' FROM profiles WHERE user_id=? AND name=?",
      ),
    ).toBe(
      'SELECT \'profiles?\' FROM "twospace"."profiles" WHERE user_id=$1 AND name=$2',
    );
    expect(
      storage.postgresSql(
        "INSERT OR IGNORE INTO pair_history(space_id) VALUES(?);",
      ),
    ).toBe(
      'INSERT INTO "twospace"."pair_history"(space_id) VALUES($1) ON CONFLICT DO NOTHING',
    );
  });
});

describe("retired sample accounts", () => {
  it("rejects an existing sample session without deleting its content", async () => {
    const legacy = await signUp("Retired");
    const space = await spaces.createSpace(
      request(legacy.cookie, { name: "Old sample" }),
    );
    const entry = await entries.createEntry(
      request(legacy.cookie, { body: "Historical sample content" }),
    );
    await storage.execute(
      "UPDATE profiles SET is_demo=1 WHERE user_id=?",
      legacy.id,
    );
    await storage.execute("UPDATE spaces SET is_demo=1 WHERE id=?", space.id);
    await expect(
      snapshots.getSnapshot(request(legacy.cookie, undefined, "GET")),
    ).rejects.toMatchObject({ status: 401, code: "SAMPLE_RETIRED" });
    await expect(
      entries.createEntry(request(legacy.cookie, { body: "New content" })),
    ).rejects.toMatchObject({ status: 401, code: "SAMPLE_RETIRED" });
    expect(
      await storage.row("SELECT id FROM resources WHERE id=?", entry.id),
    ).toEqual({ id: entry.id });
    expect(
      await storage.row(
        "SELECT is_demo FROM profiles WHERE user_id=?",
        legacy.id,
      ),
    ).toEqual({ is_demo: 1 });
  });
});
