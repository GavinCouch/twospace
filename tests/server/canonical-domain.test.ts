import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

const oldHost = "twospace-cptv.onrender.com";
function request(path: string, method = "GET", host = oldHost) {
  return new NextRequest(`https://${host}${path}`, {
    method,
    headers: { host },
  });
}

beforeEach(() => vi.stubEnv("BETTER_AUTH_URL", "https://twospace.online"));
afterEach(() => vi.unstubAllEnvs());

describe("custom domain cutover", () => {
  it.each(["GET", "HEAD"])(
    "moves %s page requests without losing a reset token or query parameters",
    (method) => {
      const response = proxy(
        request("/reset-password?token=a%2Bb&next=%2Fjournal", method),
      );
      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe(
        "https://twospace.online/reset-password?token=a%2Bb&next=%2Fjournal",
      );
    },
  );

  it.each([
    "/api/health",
    "/api/account",
    "/api/auth/callback/google?code=test&state=test",
    "/api/media/photo-id",
    "/_next/static/app.js",
    "/_next/image?url=%2Fartwork%2Fmusic.png&w=64&q=75",
    "/artwork/avatar-rose.png",
    "/spotify-logo.svg",
    "/journal/unknown",
  ])("leaves native requests, auth callbacks and assets alone: %s", (path) => {
    expect(proxy(request(path)).headers.get("location")).toBeNull();
  });

  it.each(["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])(
    "does not redirect a %s request",
    (method) => {
      expect(
        proxy(request("/journal", method)).headers.get("location"),
      ).toBeNull();
    },
  );

  it.each([
    "twospace.online",
    "www.twospace.online",
    "localhost:3100",
    "twospace-cptv.onrender.com.evil.test",
    "another-app.onrender.com",
  ])("does not redirect a different host: %s", (host) => {
    expect(
      proxy(request("/journal", "GET", host)).headers.get("location"),
    ).toBeNull();
  });

  it.each([
    undefined,
    "http://127.0.0.1:3100",
    "https://twospace-cptv.onrender.com",
    "https://unrelated.example",
    "https://twospace.online/path",
  ])("waits for the canonical auth origin to be configured: %s", (origin) => {
    vi.stubEnv("BETTER_AUTH_URL", origin);
    expect(proxy(request("/journal")).headers.get("location")).toBeNull();
  });

  it("accepts a trailing slash in the canonical origin", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://twospace.online/");
    expect(proxy(request("/")).headers.get("location")).toBe(
      "https://twospace.online/",
    );
  });
});
