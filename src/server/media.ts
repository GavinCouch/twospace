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
import { createMediaResponse } from "./media-response";
import { context, pairedContext, HttpError, type Context } from "./http";
import type { Entry, PhotoPair } from "@/shared/types";
import type { ProfilePhoto } from "./profile-photos";
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
export async function boundedBody(request: Request) {
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
    const memberCount = Number(
      (await row<{ count: number }>(
        "SELECT count(*) count FROM memberships WHERE space_id=?",
        spaceId,
      ))!.count,
    );
    if (memberCount !== 2)
      throw new HttpError(
        409,
        "Your partner needs to join before you can use this feature.",
        "PARTNER_REQUIRED",
      );
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
  const ctx = await pairedContext(request);
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
export type ExportFile = { id: string; name: string; url: string };
const exportExtensions: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
};

export async function exportFiles(ctx: Context): Promise<ExportFile[]> {
  const labels = new Map<string, string>();
  for (const entry of await resources<Entry>(ctx.spaceId, "entry")) {
    const visible =
      entry.authorId === ctx.account.id ||
      !entry.revealAt ||
      entry.revealAt <= now();
    if (entry.mediaId && visible)
      labels.set(
        entry.mediaId,
        entry.title || `${entry.kind}-${entry.createdAt.slice(0, 10)}`,
      );
  }
  for (const pair of await resources<PhotoPair>(ctx.spaceId, "photoPair"))
    for (const photo of pair.photos)
      if (!labels.has(photo.mediaId))
        labels.set(
          photo.mediaId,
          `${pair.prompt || "Photo pair"}-${pair.createdAt.slice(0, 10)}`,
        );
  const stored = await rows<Pick<Media, "id" | "mime">>(
    "SELECT id,mime FROM media WHERE space_id=? ORDER BY created_at,id",
    ctx.spaceId,
  );
  return stored
    .filter((file) => labels.has(file.id))
    .map((file) => {
      const label =
        labels
          .get(file.id)!
          .replace(/[^\p{L}\p{N} ._-]/gu, "")
          .trim()
          .slice(0, 80) || "TwoSpace file";
      return {
        id: file.id,
        name: `${label}-${file.id.slice(0, 8)}.${exportExtensions[file.mime] || "bin"}`,
        url: `/api/export/media/${encodeURIComponent(file.id)}`,
      };
    });
}

export async function getMedia(
  request: Request,
  mediaId: string,
  allowExport = false,
) {
  const ctx = await context(request);
  async function permittedMedia(): Promise<Media & { downloadName?: string }> {
    if (
      !(await row(
        "SELECT 1 FROM memberships WHERE user_id=? AND space_id=?",
        ctx.account.id,
        ctx.spaceId,
      ))
    )
      throw new HttpError(403, "You no longer belong to this space.");
    const media = await row<Media>(
      "SELECT * FROM media WHERE id=? AND space_id=?",
      mediaId,
      ctx.spaceId,
    );
    if (!media) throw new HttpError(404, "This file could not be found.");
    if (allowExport) {
      const file = (await exportFiles(ctx)).find((item) => item.id === mediaId);
      if (!file) throw new HttpError(404, "This file could not be found.");
      return { ...media, downloadName: file.name };
    }
    const profilePhoto = (
      await resources<ProfilePhoto>(ctx.spaceId, "profilePhoto")
    ).some(
      (photo) => photo.mediaId === mediaId && photo.authorId === media.owner_id,
    );
    const memberCount = Number(
      (await row<{ count: number }>(
        "SELECT count(*) count FROM memberships WHERE space_id=?",
        ctx.spaceId,
      ))!.count,
    );
    // Account settings remain usable while waiting. Shared journal and voice
    // attachments are unavailable even to their author until both have joined.
    if (
      memberCount !== 2 &&
      !(profilePhoto && media.owner_id === ctx.account.id)
    )
      throw new HttpError(
        409,
        "Your partner needs to join before you can use this feature.",
        "PARTNER_REQUIRED",
      );
    if (media.owner_id === ctx.account.id) return media;
    const visibleEntry = (await resources<Entry>(ctx.spaceId, "entry")).some(
      (entry) =>
        entry.mediaId === mediaId &&
        (!entry.revealAt || entry.revealAt <= now()),
    );
    const visiblePair = (
      await resources<PhotoPair>(ctx.spaceId, "photoPair")
    ).some((pair) => pair.photos.some((photo) => photo.mediaId === mediaId));
    const visibleProfile =
      profilePhoto &&
      Boolean(
        await row(
          "SELECT 1 FROM memberships WHERE user_id=? AND space_id=?",
          media.owner_id,
          ctx.spaceId,
        ),
      );
    if (!visibleEntry && !visiblePair && !visibleProfile)
      throw new HttpError(404, "This file could not be found.");
    return media;
  }
  const media = await permittedMedia();
  const buffer = await getObject(media.filename);
  // Storage can take time; a removed photo or departed viewer must not get a late response.
  await permittedMedia();
  return createMediaResponse(request, buffer, {
    "Content-Type": media.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Disposition": media.downloadName
      ? `attachment; filename*=UTF-8''${encodeURIComponent(media.downloadName).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)}`
      : "inline",
  });
}
export async function discardUnusedMedia(spaceId: string, mediaId: string) {
  const attached =
    (await resources<Entry>(spaceId, "entry")).some(
      (entry) => entry.mediaId === mediaId,
    ) ||
    (await resources<PhotoPair>(spaceId, "photoPair")).some((pair) =>
      pair.photos.some((photo) => photo.mediaId === mediaId),
    ) ||
    (await resources<ProfilePhoto>(spaceId, "profilePhoto")).some(
      (photo) => photo.mediaId === mediaId,
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
