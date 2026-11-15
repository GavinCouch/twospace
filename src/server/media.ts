import sharp from "sharp";
import {
  execute,
  id,
  now,
  resources,
  row,
  rows,
  transaction,
} from "./database";
import { getObject, putObject, removeObject } from "./object-store";
import { context, HttpError, type Context } from "./http";
import type { Entry, PhotoPair } from "@/shared/types";
const LIMIT = 10 * 1024 * 1024;
type Media = {
  id: string;
  space_id: string;
  owner_id: string;
  filename: string;
  mime: string;
  size: number;
};
export async function assertMedia(ctx: Context, mediaId: string) {
  const media = await row<Media>(
    "SELECT * FROM media WHERE id=? AND space_id=?",
    mediaId,
    ctx.spaceId,
  );
  if (!media || media.owner_id !== ctx.account.id)
    throw new HttpError(400, "Upload a file for this item first.");
  return media;
}
async function boundedBody(request: Request) {
  if (Number(request.headers.get("content-length")) > LIMIT)
    throw new HttpError(413, "Choose a file smaller than 10 MB.");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Choose a file to upload.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      length += result.value.byteLength;
      if (length > LIMIT) {
        await reader.cancel();
        throw new HttpError(413, "Choose a file smaller than 10 MB.");
      }
      chunks.push(result.value);
    }
  } finally {
    reader.releaseLock();
  }
  if (!length) throw new HttpError(400, "This file is empty.");
  return Buffer.concat(chunks);
}
export async function storeImage(
  spaceId: string,
  ownerId: string,
  input: Buffer,
) {
  let output: Buffer;
  try {
    const image = sharp(input, { limitInputPixels: 25000000, animated: false });
    const metadata = await image.metadata();
    if (!["jpeg", "png", "webp", "heif"].includes(metadata.format || ""))
      throw new Error("unsupported");
    output = await image
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    throw new HttpError(400, "Choose a supported photo: JPG, PNG, or WebP.");
  }
  return writeMedia(spaceId, ownerId, output, "image/webp", "webp");
}
async function writeMedia(
  spaceId: string,
  ownerId: string,
  input: Buffer,
  mime: string,
  extension: string,
) {
  return transaction(async () => {
    if (
      !(await row(
        "SELECT 1 FROM memberships WHERE user_id=? AND space_id=?",
        ownerId,
        spaceId,
      ))
    )
      throw new HttpError(403, "You no longer belong to this space.");
    const count = Number(
      (await row<{ count: number }>(
        "SELECT count(*) count FROM media WHERE space_id=?",
        spaceId,
      ))!.count,
    );
    if (count >= 500)
      throw new HttpError(409, "This space has reached its file limit.");
    const mediaId = id(),
      filename = `${spaceId}/${mediaId}.${extension}`;
    await putObject(filename, input, mime);
    try {
      await execute(
        "INSERT INTO media(id,space_id,owner_id,filename,mime,size,created_at) VALUES(?,?,?,?,?,?,?)",
        mediaId,
        spaceId,
        ownerId,
        filename,
        mime,
        input.length,
        now(),
      );
    } catch (error) {
      await removeObject(filename);
      throw error;
    }
    return { id: mediaId, mime };
  }, `space:${spaceId}`);
}
export async function uploadMedia(request: Request) {
  const ctx = await context(request);
  const count = (await row<{
    count: number;
  }>("SELECT count(*) count FROM media WHERE space_id=?", ctx.spaceId))!.count;
  if (count >= 500)
    throw new HttpError(409, "This space has reached its file limit.");
  const buffer = await boundedBody(request);
  const mime = (request.headers.get("content-type") || "").split(";")[0].trim();
  if (mime.startsWith("audio/")) {
    let extension: string;
    if (
      mime === "audio/webm" &&
      buffer.subarray(0, 4).toString("hex") === "1a45dfa3"
    )
      extension = "webm";
    else if (
      mime === "audio/ogg" &&
      buffer.subarray(0, 4).toString() === "OggS"
    )
      extension = "ogg";
    else if (
      mime === "audio/mp4" &&
      buffer.subarray(4, 8).toString() === "ftyp"
    )
      extension = "m4a";
    else throw new HttpError(400, "This recording format is not supported.");
    return writeMedia(ctx.spaceId, ctx.account.id, buffer, mime, extension);
  }
  return storeImage(ctx.spaceId, ctx.account.id, buffer);
}
export async function getMedia(request: Request, mediaId: string) {
  const ctx = await context(request);
  const media = await row<Media>(
    "SELECT * FROM media WHERE id=? AND space_id=?",
    mediaId,
    ctx.spaceId,
  );
  if (!media) throw new HttpError(404, "This file could not be found.");
  if (media.owner_id !== ctx.account.id) {
    const visibleEntry = (await resources<Entry>(ctx.spaceId, "entry")).some(
      (entry) =>
        entry.mediaId === mediaId &&
        (!entry.revealAt || entry.revealAt <= now()),
    );
    const visiblePair = (
      await resources<PhotoPair>(ctx.spaceId, "photoPair")
    ).some((pair) => pair.photos.some((photo) => photo.mediaId === mediaId));
    if (!visibleEntry && !visiblePair)
      throw new HttpError(404, "This file could not be found.");
  }
  const buffer = await getObject(media.filename);
  return new Response(Uint8Array.from(buffer), {
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(buffer.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
export async function discardUnusedMedia(spaceId: string, mediaId: string) {
  const attached =
    (await resources<Entry>(spaceId, "entry")).some(
      (entry) => entry.mediaId === mediaId,
    ) ||
    (await resources<PhotoPair>(spaceId, "photoPair")).some((pair) =>
      pair.photos.some((photo) => photo.mediaId === mediaId),
    );
  if (attached) return;
  const media = await row<Media>(
    "SELECT * FROM media WHERE id=? AND space_id=?",
    mediaId,
    spaceId,
  );
  if (!media) return;
  await execute(
    "INSERT OR IGNORE INTO media_deletions(filename,space_id,created_at) VALUES(?,?,?)",
    media.filename,
    spaceId,
    now(),
  );
  await execute(
    "DELETE FROM media WHERE id=? AND space_id=?",
    mediaId,
    spaceId,
  );
}

export async function finishMediaDeletions(spaceId?: string) {
  const pending = spaceId
    ? await rows<{ filename: string }>(
        "SELECT filename FROM media_deletions WHERE space_id=? ORDER BY created_at LIMIT 10",
        spaceId,
      )
    : await rows<{ filename: string }>(
        "SELECT filename FROM media_deletions ORDER BY created_at LIMIT 10",
      );
  for (const item of pending) {
    try {
      await removeObject(item.filename);
      await execute(
        "DELETE FROM media_deletions WHERE filename=?",
        item.filename,
      );
    } catch {
      /* Keep the deletion queued for the next maintenance pass. */
    }
  }
}
