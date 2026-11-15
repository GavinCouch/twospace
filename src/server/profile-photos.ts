import sharp from "sharp";
import {
  execute,
  id,
  insertResource,
  now,
  resource,
  row,
  updateResource,
} from "./database";
import { context, HttpError, spaceTransaction } from "./http";
import { boundedBody, discardUnusedMedia } from "./media";
import { putObject, removeObject } from "./object-store";

export type ProfilePhoto = { id: string; authorId: string; mediaId: string };
const photoId = (authorId: string) => `profile-photo:${authorId}`;
const formats: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

async function sanitizedPhoto(request: Request): Promise<Buffer> {
  const mime = (request.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!formats[mime])
    throw new HttpError(400, "Choose a JPG, PNG, or WebP photo.");
  const input = await boundedBody(request);
  const signatureMatches =
    mime === "image/jpeg"
      ? input.subarray(0, 3).toString("hex") === "ffd8ff"
      : mime === "image/png"
        ? input.subarray(0, 8).toString("hex") === "89504e470d0a1a0a"
        : input.subarray(0, 4).toString() === "RIFF" &&
          input.subarray(8, 12).toString() === "WEBP";
  if (!signatureMatches)
    throw new HttpError(
      400,
      "That photo could not be read. Choose a JPG, PNG, or WebP photo.",
    );
  try {
    const image = sharp(input, {
      limitInputPixels: 25_000_000,
      animated: false,
    });
    const metadata = await image.metadata();
    if (metadata.format !== formats[mime] || (metadata.pages ?? 1) > 1)
      throw new Error("Unsupported image content");
    return await image
      .rotate()
      .resize(512, 512, { fit: "cover", position: "centre" })
      .webp({ quality: 86 })
      .toBuffer();
  } catch {
    throw new HttpError(
      400,
      "That photo could not be read. Choose a JPG, PNG, or WebP photo.",
    );
  }
}

async function discardFailedUpload(spaceId: string, filename: string) {
  try {
    await removeObject(filename);
  } catch {
    // A timed-out object write may have succeeded. Retry its removal without exposing it.
    await execute(
      "INSERT OR IGNORE INTO media_deletions(filename,space_id,created_at) VALUES(?,?,?)",
      filename,
      spaceId,
      now(),
    );
  }
}

export async function uploadProfilePhoto(request: Request) {
  const ctx = await context(request);
  const output = await sanitizedPhoto(request);
  const mediaId = id();
  const filename = `${ctx.spaceId}/${mediaId}.webp`;
  try {
    await putObject(filename, output, "image/webp");
    await spaceTransaction(ctx, async () => {
      const previous = await resource<ProfilePhoto>(
        ctx.spaceId,
        "profilePhoto",
        photoId(ctx.account.id),
      );
      await execute(
        "INSERT INTO media(id,space_id,owner_id,filename,mime,size,created_at) VALUES(?,?,?,?,?,?,?)",
        mediaId,
        ctx.spaceId,
        ctx.account.id,
        filename,
        "image/webp",
        output.length,
        now(),
      );
      const next: ProfilePhoto = {
        id: photoId(ctx.account.id),
        authorId: ctx.account.id,
        mediaId,
      };
      if (previous) await updateResource(ctx.spaceId, "profilePhoto", next);
      else
        await insertResource(ctx.spaceId, "profilePhoto", ctx.account.id, next);
      if (previous) await discardUnusedMedia(ctx.spaceId, previous.mediaId);
      // An unshared old avatar can be replaced even when the space is at its file limit.
      const count = Number(
        (await row<{ count: number }>(
          "SELECT count(*) count FROM media WHERE space_id=?",
          ctx.spaceId,
        ))!.count,
      );
      if (count > 500)
        throw new HttpError(409, "This space has reached its file limit.");
    });
  } catch (error) {
    // If a connection failed during COMMIT, never remove an object that was committed.
    try {
      const committed = await row(
        "SELECT 1 FROM media WHERE id=? AND space_id=?",
        mediaId,
        ctx.spaceId,
      );
      if (!committed) await discardFailedUpload(ctx.spaceId, filename);
    } catch {
      // With the database unavailable, leaving a private orphan is safer than deleting a live photo.
      console.error("Profile photo cleanup could not be completed.");
    }
    throw error;
  }
  return { avatarMediaId: mediaId };
}

/** Called inside the space transaction by removal and membership changes. */
export async function clearProfilePhoto(spaceId: string, authorId: string) {
  const previous = await resource<ProfilePhoto>(
    spaceId,
    "profilePhoto",
    photoId(authorId),
  );
  if (!previous) return;
  await execute(
    "DELETE FROM resources WHERE id=? AND space_id=? AND kind=?",
    previous.id,
    spaceId,
    "profilePhoto",
  );
  await discardUnusedMedia(spaceId, previous.mediaId);
}

export async function removeProfilePhoto(request: Request) {
  const ctx = await context(request);
  await spaceTransaction(ctx, () =>
    clearProfilePhoto(ctx.spaceId, ctx.account.id),
  );
  return { avatarMediaId: null };
}
