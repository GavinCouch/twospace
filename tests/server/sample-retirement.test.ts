import { describe, expect, it } from "vitest";
import { POST as start } from "@/app/api/demo/route";
import { POST as switchProfile } from "@/app/api/demo/switch/route";

describe("retired sample endpoints", () => {
  it.each([start, switchProfile])(
    "returns Gone without creating a session",
    async (handler) => {
      const response = await handler();
      expect(response.status).toBe(410);
      expect(response.headers.get("Set-Cookie")).toBeNull();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toMatchObject({ code: "SAMPLE_RETIRED" });
    },
  );
});
