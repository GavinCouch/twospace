import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTestIdentity } from "./fixtures/accounts";

const directory = mkdtempSync(join(tmpdir(), "twospace-profile-updates-"));
process.env.TWOSPACE_STORAGE = "local";
process.env.TWOSPACE_DATA_DIR = directory;
let storage: typeof import("@/server/database");
let spaces: typeof import("@/server/spaces");
let user: { id: string; cookie: string };
const request = (body: unknown) =>
  new Request("http://127.0.0.1:3100/api/profile", {
    method: "PATCH",
    headers: { cookie: user.cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const profile = () =>
  storage.row<{ name: string; color: string; time_zone: string }>(
    "SELECT name,color,time_zone FROM profiles WHERE user_id=?",
    user.id,
  );
beforeAll(async () => {
  storage = await import("@/server/database");
  const { auth, ready } = await import("@/server/auth");
  await ready();
  spaces = await import("@/server/spaces");
  user = await createTestIdentity({ auth, execute: storage.execute }, "Morgan");
  await spaces.updateProfile(
    request({ name: "Morgan", color: "#74797d", timeZone: "UTC" }),
  );
});
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("profile updates", () => {
  it("keeps omitted fields when changing only one setting", async () => {
    await spaces.updateProfile(request({ color: "#8c526b" }));
    expect(await profile()).toEqual({
      name: "Morgan",
      color: "#8c526b",
      time_zone: "UTC",
    });
  });

  it("keeps the complete previous profile if a later field fails to save", async () => {
    const before = await profile();
    // A database-side failure must roll back the entire form, not leave its first field saved.
    await storage.execute(
      "CREATE TRIGGER reject_test_accent BEFORE UPDATE OF color ON profiles WHEN NEW.color='#badbad' BEGIN SELECT RAISE(ABORT, 'Simulated profile write failure'); END",
    );
    try {
      await expect(
        spaces.updateProfile(
          request({
            name: "Changed name",
            timeZone: "Europe/Paris",
            color: "#badbad",
          }),
        ),
      ).rejects.toThrow("Simulated profile write failure");
      expect(await profile()).toEqual(before);
    } finally {
      await storage.execute("DROP TRIGGER reject_test_accent");
    }
  });
});
