import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestIdentity } from "./fixtures/accounts";
import type { RpsState, TicState } from "@/shared/types";

const directory = mkdtempSync(join(tmpdir(), "twospace-games-"));
process.env.TWOSPACE_DATA_DIR = directory;
process.env.TWOSPACE_STORAGE = "local";
let database: typeof import("@/server/database");
let activities: typeof import("@/server/activities");
let snapshots: typeof import("@/server/snapshot");
let maya: { id: string; cookie: string }, theo: { id: string; cookie: string };
const request = (cookie: string, body?: unknown) =>
  new Request("http://127.0.0.1:3100/api/test", {
    method: body ? "POST" : "GET",
    headers: { cookie, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

beforeAll(async () => {
  const auth = await import("@/server/auth");
  database = await import("@/server/database");
  await auth.ready();
  activities = await import("@/server/activities");
  snapshots = await import("@/server/snapshot");
  const spaces = await import("@/server/spaces");
  maya = await createTestIdentity(
    { auth: auth.auth, execute: database.execute },
    "Maya",
  );
  theo = await createTestIdentity(
    { auth: auth.auth, execute: database.execute },
    "Theo",
  );
  await spaces.createSpace(request(maya.cookie, { name: "Game tests" }));
  const invitation = await spaces.invite(request(maya.cookie, {}));
  await spaces.acceptInvite(request(theo.cookie, { token: invitation.token }));
}, 30000);
afterAll(async () => {
  await database?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("two-player games", () => {
  it("validates tic-tac-toe moves, rejects stale moves, and creates a rematch", async () => {
    const game = await activities.createGame(
      request(maya.cookie, { kind: "tic" }),
    );
    await expect(
      activities.createGame(request(theo.cookie, { kind: "tic" })),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      activities.moveGame(
        request(theo.cookie, { cell: 0, revision: 0 }),
        game.id,
      ),
    ).rejects.toMatchObject({ status: 409 });
    const first = await activities.moveGame(
      request(maya.cookie, { cell: 0, revision: 0 }),
      game.id,
    );
    expect((first.state as TicState).board[0]).toBe(maya.id);
    await expect(
      activities.moveGame(
        request(theo.cookie, { cell: 3, revision: 0 }),
        game.id,
      ),
    ).rejects.toMatchObject({ code: "STALE_REVISION" });
    for (const [index, cell] of [3, 1, 4, 2].entries())
      await activities.moveGame(
        request(index % 2 === 0 ? theo.cookie : maya.cookie, {
          cell,
          revision: index + 1,
        }),
        game.id,
      );
    const snapshot = await snapshots.getSnapshot(request(theo.cookie));
    expect(
      (snapshot.games.find((item) => item.id === game.id)!.state as TicState)
        .winner,
    ).toBe(maya.id);
    const rematch = await activities.createGame(
      request(theo.cookie, { kind: "tic" }),
    );
    expect((rematch.state as TicState).turn).toBe(theo.id);
  });
  it("accepts simultaneous choices, protects secrets in snapshots and exports, and rejects choices from an old round", async () => {
    const game = await activities.createGame(
      request(maya.cookie, { kind: "rps" }),
    );
    const first = await activities.moveGame(
      request(maya.cookie, { choice: "scissors", round: 1, revision: 0 }),
      game.id,
    );
    expect((first.state as RpsState).choices[maya.id]).toBe("scissors");
    const partner = await snapshots.getSnapshot(request(theo.cookie));
    expect(
      (partner.games.find((item) => item.id === game.id)!.state as RpsState)
        .choices[maya.id],
    ).toBeNull();
    const exported = JSON.parse(
      await (await snapshots.exportSnapshot(request(theo.cookie))).text(),
    );
    expect(
      exported.games.find((item: { id: string }) => item.id === game.id).state
        .choices[maya.id],
    ).toBeNull();
    const completed = await activities.moveGame(
      request(theo.cookie, { choice: "paper", round: 1, revision: 0 }),
      game.id,
    );
    expect((completed.state as RpsState).rounds[0].winner).toBe(maya.id);
    await expect(
      activities.moveGame(
        request(theo.cookie, { choice: "rock", round: 1, revision: 0 }),
        game.id,
      ),
    ).rejects.toMatchObject({ code: "STALE_REVISION" });
    const parallel = await Promise.allSettled([
      activities.moveGame(
        request(maya.cookie, { choice: "rock", round: 2, revision: 2 }),
        game.id,
      ),
      activities.moveGame(
        request(theo.cookie, { choice: "paper", round: 2, revision: 2 }),
        game.id,
      ),
    ]);
    expect(parallel.every((result) => result.status === "fulfilled")).toBe(
      true,
    );
    const end = await snapshots.getSnapshot(request(maya.cookie));
    expect(
      (end.games.find((item) => item.id === game.id)!.state as RpsState).scores,
    ).toEqual({ [maya.id]: 1, [theo.id]: 1 });
  });
});
