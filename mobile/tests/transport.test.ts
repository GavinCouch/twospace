import { test } from "node:test";
import assert from "node:assert/strict";
import { ApiError, createTransport } from "../src/lib/transport.ts";
const origin = "https://twospace.example";
test("native requests attach the session only to the configured API", async () => {
  let received: RequestInit | undefined;
  const request = createTransport(
    origin,
    async () => "session=test-only",
    async (url, init) => {
      assert.equal(url, origin + "/api/account");
      received = init;
      return Response.json({ id: "one" });
    },
  );
  assert.deepEqual(await request("/api/account"), { id: "one" });
  assert.equal(
    new Headers(received?.headers).get("Cookie"),
    "session=test-only",
  );
  assert.equal(received?.credentials, "omit");
  assert.equal(received?.redirect, "error");
});
test("an arbitrary URL cannot receive the saved cookie", async () => {
  let read = false;
  const request = createTransport(
    origin,
    () => {
      read = true;
      return "secret";
    },
    async () => {
      throw new Error("must not fetch");
    },
  );
  for (const path of [
    "https://elsewhere.example/api/x",
    "//elsewhere.example/api/x",
    "/api/\\elsewhere",
  ])
    await assert.rejects(request(path), /Invalid API path/);
  assert.equal(read, false);
});
test("JSON bodies use the proper content type", async () => {
  const request = createTransport(
    origin,
    () => "",
    async (_url, init) => {
      assert.equal(
        new Headers(init?.headers).get("Content-Type"),
        "application/json",
      );
      assert.equal(new Headers(init?.headers).has("Cookie"), false);
      return Response.json({ ok: true });
    },
  );
  await request("/api/entries", {
    method: "POST",
    body: JSON.stringify({ body: "hello" }),
  });
});
test("file uploads retain their explicit media type", async () => {
  const request = createTransport(
    origin,
    () => "",
    async (_url, init) => {
      assert.equal(
        new Headers(init?.headers).get("Content-Type"),
        "image/jpeg",
      );
      return Response.json({ id: "photo" });
    },
  );
  await request("/api/media", {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Blob(["test"]),
  });
});
test("authorization and stale-revision errors remain actionable", async () => {
  const request = createTransport(
    origin,
    () => "",
    async () =>
      Response.json(
        { error: "The game changed.", code: "STALE_REVISION" },
        { status: 409 },
      ),
  );
  await assert.rejects(
    request("/api/games/one/moves"),
    (error) =>
      error instanceof ApiError &&
      error.status === 409 &&
      error.code === "STALE_REVISION" &&
      error.message === "The game changed.",
  );
});
test("malformed success responses are not accepted as saved data", async () => {
  const request = createTransport(
    origin,
    () => "",
    async () => new Response("<html>proxy error</html>"),
  );
  await assert.rejects(
    request("/api/space"),
    (error) => error instanceof ApiError && error.status === 502,
  );
});
test("cancelled queries abort their network request", async () => {
  const controller = new AbortController();
  controller.abort();
  const request = createTransport(
    origin,
    () => "",
    async (_url, init) => {
      assert.equal(init?.signal?.aborted, true);
      throw new DOMException("Cancelled", "AbortError");
    },
  );
  await assert.rejects(
    request("/api/space", { signal: controller.signal }),
    (error) => error instanceof DOMException && error.name === "AbortError",
  );
});
