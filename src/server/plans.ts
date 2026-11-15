import { z } from "zod";
import type { Plan } from "@/shared/types";
import {
  execute,
  id,
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
const checklist = z
  .array(
    z.object({
      id: z.string().max(100),
      text: z.string().trim().min(1).max(300),
      done: z.boolean(),
    }),
  )
  .max(40);
const planFields = {
  title: shortText.min(1),
  startsAt: z.iso.datetime({ offset: true }),
  timeZone: z
    .string()
    .max(100)
    .refine((zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid time zone."),
  duration: z.number().int().min(5).max(1440),
  kind: z.enum(["call", "date", "visit"]),
  link: optionalUrl.default(""),
  notes: z.string().trim().max(4000).default(""),
  checklist: checklist.default([]),
} as const;
export async function createPlan(request: Request) {
  const ctx = await context(request),
    input = await json(request, z.object(planFields));
  const plan: Plan = {
    ...input,
    startsAt: new Date(input.startsAt).toISOString(),
    id: id(),
    status: "proposed",
    proposedBy: ctx.account.id,
    acceptedBy: [ctx.account.id],
  };
  return spaceTransaction(ctx, () =>
    insertResource(ctx.spaceId, "plan", ctx.account.id, plan),
  );
}
export async function editPlan(request: Request, planId: string) {
  const ctx = await context(request);
  // Create defaults must not run on PATCH: omitted fields retain their stored value.
  const input = await json(
    request,
    z
      .object({
        ...planFields,
        link: optionalUrl,
        notes: z.string().trim().max(4000),
        checklist,
      })
      .partial()
      .extend({
        status: z.enum(["proposed", "accepted", "done"]).optional(),
        accepted: z.boolean().optional(),
        checklistAction: z
          .discriminatedUnion("type", [
            z.object({
              type: z.literal("add"),
              text: z.string().trim().min(1).max(300),
            }),
            z.object({
              type: z.literal("toggle"),
              id: z.string().min(1).max(100),
            }),
            z.object({
              type: z.literal("remove"),
              id: z.string().min(1).max(100),
            }),
          ])
          .optional(),
      }),
  );
  return await spaceTransaction(ctx, async () => {
    const plan = found(await resource<Plan>(ctx.spaceId, "plan", planId));
    const { accepted, status, checklistAction, ...fields } = input;
    const rescheduled =
      (fields.startsAt !== undefined &&
        new Date(fields.startsAt).toISOString() !== plan.startsAt) ||
      (fields.duration !== undefined && fields.duration !== plan.duration) ||
      (fields.title !== undefined && fields.title !== plan.title) ||
      (fields.kind !== undefined && fields.kind !== plan.kind);
    const next = {
      ...plan,
      ...fields,
      startsAt: fields.startsAt
        ? new Date(fields.startsAt).toISOString()
        : plan.startsAt,
    };
    if (rescheduled) {
      next.acceptedBy = [ctx.account.id];
      next.proposedBy = ctx.account.id;
      next.status = "proposed";
    }
    if (accepted !== undefined || status === "accepted") {
      next.acceptedBy =
        accepted === false
          ? next.acceptedBy.filter((userId) => userId !== ctx.account.id)
          : [...new Set([...next.acceptedBy, ctx.account.id])];
      next.status =
        ctx.members.length === 2 &&
        ctx.members.every((member) => next.acceptedBy.includes(member.id))
          ? "accepted"
          : "proposed";
    }
    if (status === "done") next.status = "done";
    if (status === "proposed") next.status = "proposed";
    if (checklistAction?.type === "add") {
      if (next.checklist.length >= 40)
        throw new HttpError(409, "This list has reached its item limit.");
      next.checklist = [
        ...next.checklist,
        { id: id(), text: checklistAction.text, done: false },
      ];
    }
    if (checklistAction?.type === "toggle")
      next.checklist = next.checklist.map((item) =>
        item.id === checklistAction.id ? { ...item, done: !item.done } : item,
      );
    if (checklistAction?.type === "remove")
      next.checklist = next.checklist.filter(
        (item) => item.id !== checklistAction.id,
      );
    return await updateResource(ctx.spaceId, "plan", next);
  });
}
export async function deletePlan(request: Request, planId: string) {
  const ctx = await context(request);
  return spaceTransaction(ctx, async () => {
    const plan = found(await resource<Plan>(ctx.spaceId, "plan", planId));
    if (plan.proposedBy !== ctx.account.id)
      throw new HttpError(
        403,
        "Only the person who proposed this plan can delete it.",
      );
    await execute(
      "DELETE FROM resources WHERE id=? AND space_id=? AND kind=?",
      planId,
      ctx.spaceId,
      "plan",
    );
    return { ok: true };
  });
}
