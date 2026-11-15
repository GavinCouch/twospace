import { test } from "node:test";
import assert from "node:assert/strict";
import { preparePhoto } from "../src/lib/photo-upload.ts";

const original = {
  uri: "file:///photo.heic",
  width: 4032,
  height: 3024,
  fileSize: 2_000_000,
};

test("an iPhone original is encoded before the upload body is read", async () => {
  const jpeg = new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], {
    type: "image/jpeg",
  });
  const events: string[] = [];
  const result = await preparePhoto(
    original,
    async (uri) => {
      assert.equal(uri, original.uri);
      events.push("encode");
      return { uri: "file:///converted.jpg", width: 4032, height: 3024 };
    },
    async (uri) => {
      assert.equal(uri, "file:///converted.jpg");
      events.push("read");
      return jpeg;
    },
    async (uri) => {
      assert.equal(uri, "file:///converted.jpg");
      events.push("remove");
    },
  );
  assert.equal(result, jpeg);
  assert.deepEqual(events, ["encode", "read", "remove"]);
});

test("oversized originals are rejected before native decoding", async () => {
  const fail = async (): Promise<never> => {
    throw new Error("must not decode");
  };
  await assert.rejects(
    preparePhoto(
      { ...original, fileSize: 10 * 1024 * 1024 + 1 },
      fail,
      fail,
      fail,
    ),
    /10 MB/,
  );
  await assert.rejects(
    preparePhoto({ ...original, width: 6000, height: 5000 }, fail, fail, fail),
    /25 megapixels/,
  );
});

test("JPEG expansion cannot exceed the upload limit", async () => {
  let removed = false;
  await assert.rejects(
    preparePhoto(
      original,
      async () => ({ uri: "file:///large.jpg", width: 4032, height: 3024 }),
      async () => new Blob([new Uint8Array(10 * 1024 * 1024 + 1)]),
      async () => {
        removed = true;
      },
    ),
    /10 MB/,
  );
  assert.equal(removed, true);
});
