import { z } from "zod";
import {
  execute,
  id,
  now,
  resource,
  insertResource,
  updateResource,
} from "./database";
import {
  spaceTransaction,
  context,
  found,
  HttpError,
  json,
  optionalUrl,
  shortText,
} from "./http";
import { assertMedia, discardUnusedMedia, finishMediaDeletions } from "./media";
import type { Entry, PhotoPair } from "@/shared/types";
const entryInput = z
  .object({
    kind: z.enum(["note", "photo", "link", "voice", "memory"]).default("note"),
    body: z.string().trim().max(6000).default(""),
    title: shortText.default(""),
    mediaId: z.string().uuid().optional(),
    url: optionalUrl.optional(),
    revealAt: z.iso.datetime().optional(),
    collection: shortText.default(""),
  })
  .refine(
    (data) => data.body || data.mediaId || data.url,
    "Add a note, link, or file.",
  );
export function visibleEntry(
  entry: Entry,
  userId: string,
  timestamp = now(),
): Entry {
  if (
    entry.authorId !== userId &&
    entry.revealAt &&
    entry.revealAt > timestamp
  ) {
    return {
      id: entry.id,
      authorId: entry.authorId,
      kind: entry.kind,
      body: "",
      title: "A note for later",
      createdAt: entry.createdAt,
      revealAt: entry.revealAt,
      locked: true,
      pinned: entry.pinned,
      collection: "",
      reactions: [],
      replies: [],
    };
  }
  return { ...entry, locked: false };
}
export async function createEntry(request: Request) {
  const ctx = await context(request),
    input = await json(request, entryInput);
  return spaceTransaction(ctx, async () => {
    if (input.mediaId) {
      const media = await assertMedia(ctx, input.mediaId);
      if (input.kind === "voice" && !media.mime.startsWith("audio/"))
        throw new HttpError(400, "Choose an audio recording.");
      if (input.kind === "photo" && !media.mime.startsWith("image/"))
        throw new HttpError(400, "Choose a photo.");
    }
    if (["photo", "voice"].includes(input.kind) && !input.mediaId)
      throw new HttpError(400, "Upload a file first.");
    const entry: Entry = {
      ...input,
      id: id(),
      authorId: ctx.account.id,
      createdAt: now(),
      pinned: false,
      reactions: [],
      replies: [],
    };
    return await insertResource(ctx.spaceId, "entry", ctx.account.id, entry);
  });
}
export async function editEntry(request: Request, entryId: string) {
  const ctx = await context(request);
  const input = await json(
    request,
    z.object({
      body: z.string().trim().max(6000).optional(),
      title: shortText.optional(),
      pinned: z.boolean().optional(),
      collection: shortText.optional(),
    }),
  );
  return await spaceTransaction(ctx, async () => {
    const entry = found(await resource<Entry>(ctx.spaceId, "entry", entryId));
    if (
      entry.authorId !== ctx.account.id &&
      (input.body !== undefined || input.title !== undefined)
    )
      throw new HttpError(403, "Only the author can edit this entry.");
    if (visibleEntry(entry, ctx.account.id).locked)
      throw new HttpError(403, "This note is not open yet.");
    return visibleEntry(
      await updateResource(ctx.spaceId, "entry", { ...entry, ...input }),
      ctx.account.id,
    );
  });
}
export async function deleteEntry(request: Request, entryId: string) {
  const ctx = await context(request);
  const result = await spaceTransaction(ctx, async () => {
    const entry = found(await resource<Entry>(ctx.spaceId, "entry", entryId));
    if (entry.authorId !== ctx.account.id)
      throw new HttpError(403, "Only the author can delete this entry.");
    await execute(
      "DELETE FROM resources WHERE id=? AND space_id=? AND kind=?",
      entryId,
      ctx.spaceId,
      "entry",
    );
    if (entry.mediaId) await discardUnusedMedia(ctx.spaceId, entry.mediaId);
    return { ok: true };
  });
  await finishMediaDeletions(ctx.spaceId);
  return result;
}
export async function replyToEntry(request: Request, entryId: string) {
  const ctx = await context(request),
    { body } = await json(
      request,
      z.object({ body: z.string().trim().min(1).max(2000) }),
    );
  return await spaceTransaction(ctx, async () => {
    const entry = found(await resource<Entry>(ctx.spaceId, "entry", entryId));
    if (visibleEntry(entry, ctx.account.id).locked)
      throw new HttpError(403, "This note is not open yet.");
    if (entry.replies.length >= 100)
      throw new HttpError(
        409,
        "This conversation has reached its reply limit.",
      );
    entry.replies.push({
      id: id(),
      authorId: ctx.account.id,
      body,
      createdAt: now(),
    });
    return await updateResource(ctx.spaceId, "entry", entry);
  });
}
export async function reactToEntry(request: Request, entryId: string) {
  const ctx = await context(request);
  return await spaceTransaction(ctx, async () => {
    const entry = found(await resource<Entry>(ctx.spaceId, "entry", entryId));
    if (visibleEntry(entry, ctx.account.id).locked)
      throw new HttpError(403, "This note is not open yet.");
    entry.reactions = entry.reactions.includes(ctx.account.id)
      ? entry.reactions.filter((userId) => userId !== ctx.account.id)
      : [...entry.reactions, ctx.account.id];
    return await updateResource(ctx.spaceId, "entry", entry);
  });
}
export async function createPhotoPair(request: Request) {
  const ctx = await context(request),
    { prompt } = await json(request, z.object({ prompt: shortText.min(1) }));
  return spaceTransaction(ctx, () =>
    insertResource(ctx.spaceId, "photoPair", ctx.account.id, {
      id: id(),
      prompt,
      createdAt: now(),
      photos: [],
    } satisfies PhotoPair),
  );
}
export async function contributePhoto(request: Request, pairId: string) {
  const ctx = await context(request),
    input = await json(
      request,
      z.object({
        mediaId: z.string().uuid(),
        caption: z.string().trim().max(1000).default(""),
      }),
    );
  const result = await spaceTransaction(ctx, async () => {
    if (!(await assertMedia(ctx, input.mediaId)).mime.startsWith("image/"))
      throw new HttpError(400, "Choose a photo.");
    const pair = found(
      await resource<PhotoPair>(ctx.spaceId, "photoPair", pairId),
    );
    const replacedMedia = pair.photos.find(
      (photo) => photo.userId === ctx.account.id,
    )?.mediaId;
    pair.photos = [
      ...pair.photos.filter((photo) => photo.userId !== ctx.account.id),
      { ...input, userId: ctx.account.id },
    ];
    await updateResource(ctx.spaceId, "photoPair", pair);
    if (replacedMedia && replacedMedia !== input.mediaId)
      await discardUnusedMedia(ctx.spaceId, replacedMedia);
    return pair;
  });
  await finishMediaDeletions(ctx.spaceId);
  return result;
}
