import { describe, expect, it } from "vitest";
import { createMediaResponse } from "../../src/server/media-response";

const recording = Buffer.from("0123456789");
const privateHeaders = {
  "Content-Type": "audio/mp4",
  "Cache-Control": "private, no-store",
  "Content-Disposition": "inline",
  "X-Content-Type-Options": "nosniff",
};
function request(range?: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (range) headers.set("Range", range);
  return new Request("https://twospace.test/api/media/recording", {
    ...options,
    headers,
  });
}

describe("private media byte responses", () => {
  it("answers the two-byte probe used before native audio playback", async () => {
    const response = createMediaResponse(
      request("bytes=0-1"),
      recording,
      privateHeaders,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(response.headers.get("content-range")).toBe("bytes 0-1/10");
    expect(response.headers.get("content-length")).toBe("2");
    expect(await response.text()).toBe("01");
    for (const [name, value] of Object.entries(privateHeaders))
      expect(response.headers.get(name)).toBe(value);
  });

  it.each([
    ["bytes=4-", "456789", "bytes 4-9/10"],
    ["bytes=-3", "789", "bytes 7-9/10"],
    ["bytes=8-99", "89", "bytes 8-9/10"],
    ["bytes=-99", "0123456789", "bytes 0-9/10"],
    ["bytes=9-9", "9", "bytes 9-9/10"],
    ["bytes=1-999999999999999999999999999999", "123456789", "bytes 1-9/10"],
    ["bytes=-999999999999999999999999999999", "0123456789", "bytes 0-9/10"],
  ])("serves a seek request %s", async (range, expected, contentRange) => {
    const response = createMediaResponse(
      request(range),
      recording,
      privateHeaders,
    );
    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe(contentRange);
    expect(response.headers.get("content-length")).toBe(
      String(expected.length),
    );
    expect(await response.text()).toBe(expected);
  });

  it.each([
    "bytes=10-",
    "bytes=20-30",
    "bytes=-0",
    "bytes=999999999999999999999999999999-",
  ])(
    "reports an unsatisfiable range %s without returning file bytes",
    async (range) => {
      const response = createMediaResponse(
        request(range),
        recording,
        privateHeaders,
      );
      expect(response.status).toBe(416);
      expect(response.headers.get("content-range")).toBe("bytes */10");
      expect(response.headers.get("content-length")).toBe("0");
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(await response.text()).toBe("");
    },
  );

  it.each([
    undefined,
    "items=0-1",
    "bytes=",
    "bytes=-",
    "bytes=hello",
    "bytes=3-1",
    "bytes=0-1,4-5",
  ])(
    "serves the full recording when the range is absent or unsupported: %s",
    async (range) => {
      const response = createMediaResponse(
        request(range),
        recording,
        privateHeaders,
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("accept-ranges")).toBe("bytes");
      expect(response.headers.has("content-range")).toBe(false);
      expect(response.headers.get("content-length")).toBe("10");
      expect(await response.text()).toBe("0123456789");
    },
  );

  it("returns full-length headers without a body for HEAD, ignoring Range", async () => {
    const response = createMediaResponse(
      request("bytes=0-1", { method: "HEAD" }),
      recording,
      privateHeaders,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("content-type")).toBe("audio/mp4");
    expect(response.headers.has("content-range")).toBe(false);
    expect(response.body).toBeNull();
  });

  it.each(['"old-version"', "Sun, 15 Nov 2026 00:00:00 GMT", ""])(
    "sends the full file when an If-Range validator cannot be verified: %s",
    async (validator) => {
      const response = createMediaResponse(
        request("bytes=0-1", { headers: { "If-Range": validator } }),
        recording,
        privateHeaders,
      );
      expect(response.status).toBe(200);
      expect(response.headers.has("content-range")).toBe(false);
      expect(await response.text()).toBe("0123456789");
    },
  );

  it("reports an empty representation as unsatisfiable", async () => {
    const response = createMediaResponse(
      request("bytes=0-"),
      Buffer.alloc(0),
      privateHeaders,
    );
    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */0");
    expect(await response.text()).toBe("");
  });

  it("leaves the caller’s headers unchanged", () => {
    const headers = new Headers(privateHeaders);
    headers.set("Content-Length", "10");
    createMediaResponse(request("bytes=0-1"), recording, headers);
    expect(headers.get("content-length")).toBe("10");
    expect(headers.has("content-range")).toBe(false);
  });
});
