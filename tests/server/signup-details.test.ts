import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "twospace-signup-details-"));
process.env.TWOSPACE_STORAGE = "local";
process.env.TWOSPACE_DATA_DIR = directory;
process.env.BETTER_AUTH_URL = "http://127.0.0.1:3100";
let authModule: typeof import("@/server/auth");
let storage: typeof import("@/server/database");
let http: typeof import("@/server/http");
let legacyCookie: string;
const base = "http://127.0.0.1:3100";
const password = "a-long-test-passphrase-123";
let requestNumber = 0;
const cookieOf = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
const request = (cookie: string, body?: unknown) =>
  new Request(`${base}/api/test`, {
    method: body ? "POST" : "GET",
    headers: { cookie, origin: base, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
function signUp(email: string, details: Record<string, unknown> = {}) {
  return authModule.auth.handler(
    new Request(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        origin: base,
        "content-type": "application/json",
        "x-forwarded-for": `192.0.2.${++requestNumber}`,
      },
      body: JSON.stringify({
        name: "Alex Rivera",
        email,
        password,
        ...details,
      }),
    }),
  );
}
beforeAll(async () => {
  authModule = await import("@/server/auth");
  storage = await import("@/server/database");
  http = await import("@/server/http");
  await storage.databaseReady();
  // Start with the shipped schema and a real existing session, then apply the additive upgrade.
  const legacyAuth = betterAuth({
    ...authModule.auth.options,
    user: undefined,
  });
  await (await getMigrations(legacyAuth.options)).runMigrations();
  const legacy = await legacyAuth.api.signUpEmail({
    body: {
      name: "Existing account",
      email: "existing@example.test",
      password,
    },
    asResponse: true,
  });
  expect(legacy.status).toBe(200);
  legacyCookie = cookieOf(legacy);
  await authModule.ready();
});
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("signup account details", () => {
  it("upgrades existing accounts without losing their session or display name", async () => {
    const account = await http.account(request(legacyCookie));
    expect(account).toMatchObject({
      name: "Existing account",
      email: "existing@example.test",
      spaceId: null,
    });
    expect(account.firstName).toBeUndefined();
    expect(account.lastName).toBeUndefined();
    expect(account.gender).toBeUndefined();
    expect(account.birthday).toBeUndefined();
    const stored = await storage.row<{
      firstName: string | null;
      lastName: string | null;
      gender: string | null;
      birthday: string | null;
    }>(
      'SELECT "firstName", "lastName", "gender", "birthday" FROM "user" WHERE id=?',
      account.id,
    );
    expect(stored).toEqual({
      firstName: null,
      lastName: null,
      gender: null,
      birthday: null,
    });
  });

  it("persists trimmed names and an explicit gender choice through a fresh sign-in", async () => {
    const response = await signUp("details@example.test", {
      firstName: "  Alex  ",
      lastName: " Rivera ",
      gender: "non-binary",
      birthday: "2000-02-29",
    });
    expect(response.status).toBe(200);
    const created = await response.json();
    expect(created.user).toMatchObject({
      firstName: "Alex",
      lastName: "Rivera",
      gender: "non-binary",
      birthday: "2000-02-29",
    });
    expect(
      await storage.row(
        'SELECT "firstName", "lastName", "gender", "birthday" FROM "user" WHERE id=?',
        created.user.id,
      ),
    ).toEqual({
      firstName: "Alex",
      lastName: "Rivera",
      gender: "non-binary",
      birthday: "2000-02-29",
    });
    const signedIn = await authModule.auth.api.signInEmail({
      body: { email: "details@example.test", password },
      asResponse: true,
    });
    const cookie = cookieOf(signedIn);
    expect(await http.account(request(cookie))).toMatchObject({
      id: created.user.id,
      name: "Alex Rivera",
      firstName: "Alex",
      lastName: "Rivera",
      gender: "non-binary",
      birthday: "2000-02-29",
    });
    const spaces = await import("@/server/spaces");
    await spaces.createSpace(request(cookie, { name: "A private space" }));
    const { members } = await http.context(request(cookie));
    expect(members).toHaveLength(1);
    for (const field of ["firstName", "lastName", "gender", "birthday"])
      expect(members[0]).not.toHaveProperty(field);
    expect((await http.account(request(legacyCookie))).gender).toBeUndefined();
  });

  it("accepts omitted gender, explicit nondisclosure, and older name-only clients", async () => {
    const omitted = await signUp("optional@example.test", {
      firstName: "Sam",
      lastName: "O’Connor",
    });
    expect(omitted.status).toBe(200);
    expect((await omitted.json()).user.gender).toBeNull();
    const declined = await signUp("declined@example.test", {
      gender: "prefer-not-to-say",
    });
    expect(declined.status).toBe(200);
    expect((await declined.json()).user.gender).toBe("prefer-not-to-say");
    const legacy = await signUp("legacy-client@example.test", {
      name: "Only a name",
    });
    expect(legacy.status).toBe(200);
    expect(await http.account(request(cookieOf(legacy)))).toMatchObject({
      name: "Only a name",
    });
  });

  it.each([
    { firstName: "  " },
    { firstName: "a".repeat(61) },
    { lastName: "" },
    { lastName: 123 },
    { gender: "unsupported" },
    { gender: { value: "woman" } },
    { birthday: "2001-02-29" },
    { birthday: "2026-04-31" },
    { birthday: "2000-02-29T00:00:00Z" },
    { birthday: "9999-01-01" },
  ])(
    "rejects invalid detail input before creating an account: %j",
    async (details) => {
      const response = await signUp("invalid@example.test", details);
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(
        await storage.row(
          'SELECT id FROM "user" WHERE email=?',
          "invalid@example.test",
        ),
      ).toBeUndefined();
    },
  );
});
