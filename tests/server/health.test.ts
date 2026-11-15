import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ready, objectStoreReady, row, finishMediaDeletions } = vi.hoisted(
  () => ({
    ready: vi.fn(),
    objectStoreReady: vi.fn(),
    row: vi.fn(),
    finishMediaDeletions: vi.fn(),
  }),
);
vi.mock("@/server/auth", () => ({ ready }));
vi.mock("@/server/object-store", () => ({ objectStoreReady }));
vi.mock("@/server/database", () => ({ row }));
vi.mock("@/server/media", () => ({ finishMediaDeletions }));
import { GET } from "@/app/api/health/route";

beforeEach(() => {
  ready.mockReset().mockResolvedValue(undefined);
  objectStoreReady.mockReset().mockResolvedValue(undefined);
  row.mockReset().mockResolvedValue({ ok: 1 });
  finishMediaDeletions.mockReset().mockResolvedValue(undefined);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("hosting readiness", () => {
  it("responds without waiting for stalled file cleanup", async () => {
    vi.useFakeTimers();
    let releaseCleanup: (() => void) | undefined;
    finishMediaDeletions.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          releaseCleanup = resolve;
        }),
    );
    const probe = GET();
    const result = Promise.race([
      probe,
      new Promise<"deadline exceeded">((resolve) =>
        setTimeout(() => resolve("deadline exceeded"), 4000),
      ),
    ]);
    await vi.advanceTimersByTimeAsync(4000);
    try {
      const response = await result;
      expect(response).toBeInstanceOf(Response);
      if (!(response instanceof Response)) return;
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true });
      expect(finishMediaDeletions).not.toHaveBeenCalled();
    } finally {
      releaseCleanup?.();
      await probe;
    }
  });

  it("checks the database on every probe and disables response caching", async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await GET();
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    }
    expect(row).toHaveBeenCalledTimes(2);
    expect(row).toHaveBeenCalledWith("SELECT 1 AS ok");
  });

  it.each([
    ["startup", ready],
    ["storage", objectStoreReady],
    ["database", row],
  ] as const)(
    "returns a private 503 response when %s fails",
    async (_name, dependency) => {
      dependency.mockRejectedValueOnce(
        new Error("private connection details: secret-test-token"),
      );
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      const response = await GET();
      expect(response.status).toBe(503);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({
        ok: false,
        error: "The service is not ready.",
      });
      expect(log).not.toHaveBeenCalled();
    },
  );

  it("recovers on a later probe after a temporary database failure", async () => {
    row.mockRejectedValueOnce(new Error("database unavailable"));
    expect((await GET()).status).toBe(503);
    expect((await GET()).status).toBe(200);
  });
});
