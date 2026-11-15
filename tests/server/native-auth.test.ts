import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const directory = mkdtempSync(join(tmpdir(), "twospace-native-auth-"));
process.env.TWOSPACE_STORAGE = "local";
process.env.TWOSPACE_DATA_DIR = directory;
process.env.BETTER_AUTH_URL = "https://twospace.example";
let authModule: typeof import("@/server/auth");
let storage: typeof import("@/server/database");
let http: typeof import("@/server/http");
const base = "https://twospace.example";
function signUp(
  email: string,
  callbackURL: string,
  headers: Record<string, string> = {},
) {
  return authModule.auth.handler(
    new Request(`${base}/api/auth/sign-up/email`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "expo-origin": "twospace://",
        ...headers,
      },
      body: JSON.stringify({
        name: "Native account",
        email,
        password: "native-test-passphrase-123",
        callbackURL,
      }),
    }),
  );
}
beforeAll(async () => {
  authModule = await import("@/server/auth");
  storage = await import("@/server/database");
  http = await import("@/server/http");
  await authModule.ready();
});
afterAll(async () => {
  await storage?.closeDatabase();
  rmSync(directory, { recursive: true, force: true });
});

describe("native authentication", () => {
  it("signs in through the Expo origin and accepts the stored cookie on REST requests", async () => {
    const response = await signUp(
      "native@example.test",
      "twospace://auth/callback",
    );
    expect(response.status).toBe(200);
    const created = await response.json();
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    expect(cookie).toContain("__Secure-better-auth.session_token=");
    const request = new Request(`${base}/api/account`, {
      headers: { Cookie: cookie },
    });
    expect(await http.account(request)).toMatchObject({
      id: created.user.id,
      isDemo: false,
    });
    const spaces = await import("@/server/spaces");
    const createRequest = new Request(`${base}/api/spaces`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Our native space" }),
    });
    expect(() => http.checkOrigin(createRequest)).not.toThrow();
    expect(await spaces.createSpace(createRequest)).toMatchObject({
      name: "Our native space",
    });
  });

  it("does not trust unrelated schemes, Expo Go or lookalike web origins", async () => {
    const context = await authModule.auth.$context;
    expect(context.isTrustedOrigin("twospace://auth/callback")).toBe(true);
    for (const candidate of [
      "otherapp://auth/callback",
      "exp://192.168.1.2:8081",
      "https://twospace.example.evil.test",
    ]) {
      expect(context.isTrustedOrigin(candidate)).toBe(false);
    }
    const response = await signUp(
      "untrusted-callback@example.test",
      "otherapp://auth/callback",
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("keeps browser CSRF checks when a request also supplies an Expo origin", async () => {
    const response = await signUp(
      "cross-site@example.test",
      "twospace://auth/callback",
      {
        Origin: "https://another-site.example",
        "Sec-Fetch-Site": "cross-site",
        Cookie: "session=test",
      },
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(() =>
      http.checkOrigin(
        new Request(`${base}/api/spaces`, {
          method: "POST",
          headers: { Origin: "https://another-site.example" },
        }),
      ),
    ).toThrow("another website");
  });

  it("does not turn the Expo authorization proxy into an open redirect", async () => {
    const target = new URL(`${base}/api/auth/expo-authorization-proxy`);
    target.searchParams.set(
      "authorizationURL",
      "https://another-site.example/sign-in?state=unissued-state",
    );
    const response = await authModule.auth.handler(new Request(target));
    expect(response.status).toBe(400);
    expect(response.headers.get("location")).toBeNull();
  });
});
