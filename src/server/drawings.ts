import { z } from "zod";
import type { Drawing, Entry, Stroke } from "@/shared/types";
import { id, now, resource, insertResource, updateResource } from "./database";
import {
  spaceTransaction,
  context,
  found,
  HttpError,
  json,
  requirePartner,
  shortText,
} from "./http";
const strokeSchema = z.object({
  id: z.string().uuid(),
  tool: z.enum(["pen", "line", "circle", "square"]),
  color: z.string().regex(/^#[0-9a-f]{6}$/i),
  width: z.number().min(1).max(20),
  points: z
    .array(
      z.object({
        x: z.number().min(0).max(800),
        y: z.number().min(0).max(500),
      }),
    )
    .min(1)
    .max(1000),
});
export async function createDrawing(request: Request) {
  const ctx = await context(request);
  requirePartner(ctx);
  const { title } = await json(
    request,
    z.object({ title: shortText.min(1).default("Our drawing") }),
  );
  return spaceTransaction(ctx, () =>
    insertResource(ctx.spaceId, "drawing", ctx.account.id, {
      id: id(),
      title,
      caption: "",
      createdAt: now(),
      strokes: [],
      revision: 0,
      turnUserId: ctx.account.id,
    } satisfies Drawing),
  );
}
export async function editDrawing(request: Request, drawingId: string) {
  const ctx = await context(request);
  requirePartner(ctx);
  const input = await json(
    request,
    z.discriminatedUnion("action", [
      z.object({
        action: z.literal("stroke"),
        revision: z.number().int().nonnegative(),
        stroke: strokeSchema,
      }),
      z.object({
        action: z.literal("undo"),
        revision: z.number().int().nonnegative(),
      }),
      z.object({
        action: z.literal("pass"),
        revision: z.number().int().nonnegative(),
      }),
      z.object({
        action: z.literal("caption"),
        revision: z.number().int().nonnegative(),
        caption: z.string().trim().max(2000),
      }),
      z.object({
        action: z.literal("save"),
        revision: z.number().int().nonnegative(),
      }),
    ]),
  );
  return await spaceTransaction(ctx, async () => {
    const drawing = found(
      await resource<Drawing>(ctx.spaceId, "drawing", drawingId),
    );
    if (drawing.revision !== input.revision)
      throw new HttpError(
        409,
        "The drawing changed. Try again.",
        "STALE_REVISION",
      );
    if (
      ["stroke", "undo", "pass"].includes(input.action) &&
      drawing.turnUserId !== ctx.account.id
    )
      throw new HttpError(409, "It is your partner’s turn.");
    if (input.action === "stroke") {
      if (drawing.strokes.length >= 300)
        throw new HttpError(
          409,
          "This drawing is full. Save it and start another.",
        );
      if (drawing.strokes.some((stroke) => stroke.id === input.stroke.id))
        throw new HttpError(409, "That stroke is already saved.");
      drawing.strokes.push({
        ...input.stroke,
        authorId: ctx.account.id,
      } satisfies Stroke);
    }
    if (input.action === "undo") {
      const latest = drawing.strokes.at(-1);
      if (!latest || latest.authorId !== ctx.account.id)
        throw new HttpError(409, "Only your most recent mark can be undone.");
      drawing.strokes.pop();
    }
    if (input.action === "pass")
      drawing.turnUserId = ctx.members.find(
        (member) => member.id !== ctx.account.id,
      )!.id;
    if (input.action === "caption") drawing.caption = input.caption;
    if (input.action === "save") {
      if (!drawing.strokes.length)
        throw new HttpError(400, "Add something to the drawing first.");
      const entryId = `drawing-${drawing.id}`;
      const previous = await resource<Entry>(ctx.spaceId, "entry", entryId);
      const entry: Entry = {
        id: entryId,
        authorId: previous?.authorId ?? ctx.account.id,
        kind: "drawing",
        body: drawing.caption,
        title: drawing.title,
        createdAt: previous?.createdAt ?? now(),
        pinned: previous?.pinned ?? false,
        collection: "Drawings",
        reactions: previous?.reactions ?? [],
        replies: previous?.replies ?? [],
        drawing: structuredClone(drawing.strokes),
      };
      if (previous) await updateResource(ctx.spaceId, "entry", entry);
      else await insertResource(ctx.spaceId, "entry", ctx.account.id, entry);
    }
    drawing.revision++;
    return await updateResource(ctx.spaceId, "drawing", drawing);
  });
}
