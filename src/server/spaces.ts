import { z } from "zod";
import { randomBytes } from "node:crypto";
import { execute, id, now, resource, row, transaction } from "./database";
import {
  account,
  context,
  HttpError,
  json,
  shortText,
  spaceTransaction,
} from "./http";
import { hashToken } from "./auth";
import { clearProfilePhoto, type ProfilePhoto } from "./profile-photos";

async function movableProfilePhoto(spaceId: string, userId: string) {
  const photo = await resource<ProfilePhoto>(
    spaceId,
    "profilePhoto",
    `profile-photo:${userId}`,
  );
  if (
    !photo ||
    photo.authorId !== userId ||
    photo.id !== `profile-photo:${userId}`
  )
    return;
  const owned = await row(
    "SELECT 1 FROM media WHERE id=? AND space_id=? AND owner_id=?",
    photo.mediaId,
    spaceId,
    userId,
  );
  return owned ? photo : undefined;
}

export async function spaceSwitchStatus(
  spaceId: string,
  memberCount: number,
  userId: string,
) {
  const hasPairedBefore = Boolean(
    await row("SELECT 1 FROM pair_history WHERE space_id=?", spaceId),
  );
  const photo = await movableProfilePhoto(spaceId, userId);
  const hasContent = Boolean(
    (await row(
      "SELECT 1 FROM resources WHERE space_id=? AND NOT (id=? AND kind=? AND author_id=?) LIMIT 1",
      spaceId,
      photo?.id ?? "",
      "profilePhoto",
      userId,
    )) ||
    (await row(
      "SELECT 1 FROM media WHERE space_id=? AND id<>? LIMIT 1",
      spaceId,
      photo?.mediaId ?? "",
    )),
  );
  return {
    hasPairedBefore,
    canSwitch: memberCount === 1 && !hasPairedBefore && !hasContent,
  };
}
export async function createSpace(request: Request) {
  const current = await account(request);
  const { name } = await json(
    request,
    z.object({ name: shortText.min(1).default("Our space") }),
  );
  return await transaction(async () => {
    if (await row("SELECT 1 FROM memberships WHERE user_id=?", current.id))
      throw new HttpError(409, "You already belong to a space.");
    const spaceId = id();
    await execute(
      "INSERT INTO spaces(id,name,created_at) VALUES(?,?,?)",
      spaceId,
      name,
      now(),
    );
    await execute(
      "INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,1)",
      current.id,
      spaceId,
    );
    return { id: spaceId, name };
  }, `account:${current.id}`);
}
export async function renameSpace(request: Request) {
  const ctx = await context(request);
  const { name } = await json(request, z.object({ name: shortText.min(1) }));
  await spaceTransaction(ctx, () =>
    execute("UPDATE spaces SET name=? WHERE id=?", name, ctx.spaceId),
  );
  return { ok: true };
}
export async function invite(request: Request) {
  const ctx = await context(request);
  return await spaceTransaction(ctx, async () => {
    if (ctx.members.length > 1)
      throw new HttpError(409, "Both places in this space are already taken.");
    if (await row("SELECT 1 FROM pair_history WHERE space_id=?", ctx.spaceId))
      throw new HttpError(
        409,
        "Create a new space before inviting someone new. Your existing memories stay here.",
      );
    await execute("DELETE FROM invitations WHERE space_id=?", ctx.spaceId);
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
    await execute(
      "INSERT INTO invitations(token_hash,space_id,expires_at) VALUES(?,?,?)",
      hashToken(token),
      ctx.spaceId,
      expiresAt,
    );
    return { token, expiresAt };
  });
}
export async function acceptInvite(request: Request) {
  const current = await account(request);
  const { token, switchSpace } = await json(
    request,
    z.object({
      token: z.string().trim().min(20).max(128),
      switchSpace: z.boolean().default(false),
    }),
  );
  const target = await row<{ space_id: string }>(
    "SELECT space_id FROM invitations WHERE token_hash=?",
    hashToken(token),
  );
  if (!target)
    throw new HttpError(
      410,
      "This invitation has expired or has already been used. Ask for a new one.",
    );
  return await transaction(async () => {
    const membership = await row<{ space_id: string }>(
      "SELECT space_id FROM memberships WHERE user_id=?",
      current.id,
    );
    if ((membership?.space_id ?? null) !== current.spaceId)
      throw new HttpError(
        409,
        "Your space changed. Refresh and try again.",
        "SPACE_CHANGED",
      );
    if (membership?.space_id === target.space_id)
      throw new HttpError(
        409,
        "This is your own invitation. Ask your partner for their code.",
        "OWN_INVITE",
      );
    const invitation = await row<{
      space_id: string;
      expires_at: string;
      used: number;
    }>("SELECT * FROM invitations WHERE token_hash=?", hashToken(token));
    if (!invitation || invitation.used || invitation.expires_at <= now())
      throw new HttpError(
        410,
        "This invitation has expired or has already been used. Ask for a new one.",
      );
    const count = (await row<{
      count: number;
    }>(
      "SELECT COUNT(*) count FROM memberships WHERE space_id=?",
      invitation.space_id,
    ))!.count;
    if (Number(count) !== 1)
      throw new HttpError(409, "This space is no longer available.");
    if (
      await row(
        "SELECT 1 FROM pair_history WHERE space_id=?",
        invitation.space_id,
      )
    )
      throw new HttpError(409, "This space is no longer available.");
    if (membership) {
      if (!switchSpace)
        throw new HttpError(
          409,
          "Confirm that you want to leave your empty space and join your partner.",
          "SWITCH_CONFIRMATION_REQUIRED",
        );
      const sourceCount = Number(
        (await row<{ count: number }>(
          "SELECT COUNT(*) count FROM memberships WHERE space_id=?",
          membership.space_id,
        ))!.count,
      );
      const source = await spaceSwitchStatus(
        membership.space_id,
        sourceCount,
        current.id,
      );
      if (sourceCount !== 1 || source.hasPairedBefore)
        throw new HttpError(
          409,
          "Leave your current shared space in Settings before joining another.",
          "SPACE_ALREADY_PAIRED",
        );
      if (!source.canSwitch)
        throw new HttpError(
          409,
          "Your space has saved content. Export it and leave this space in Settings before joining another.",
          "SPACE_NOT_EMPTY",
        );
      // Keep the empty space record, but retire its invite before moving the
      // membership. Every check above runs before either membership changes.
      await execute(
        "UPDATE invitations SET used=1 WHERE space_id=?",
        membership.space_id,
      );
      const photo = await movableProfilePhoto(membership.space_id, current.id);
      if (photo) {
        // The private object key stays valid. Access follows these space-scoped
        // records, so the account's avatar moves without copying its file.
        await execute(
          "UPDATE resources SET space_id=? WHERE space_id=? AND id=? AND kind=? AND author_id=?",
          invitation.space_id,
          membership.space_id,
          photo.id,
          "profilePhoto",
          current.id,
        );
        await execute(
          "UPDATE media SET space_id=? WHERE space_id=? AND id=? AND owner_id=?",
          invitation.space_id,
          membership.space_id,
          photo.mediaId,
          current.id,
        );
      }
      await execute("DELETE FROM memberships WHERE user_id=?", current.id);
    }
    await execute(
      "INSERT INTO memberships(user_id,space_id,slot) VALUES(?,?,2)",
      current.id,
      invitation.space_id,
    );
    await execute(
      "UPDATE invitations SET used=1 WHERE space_id=?",
      invitation.space_id,
    );
    await execute(
      "INSERT OR IGNORE INTO pair_history(space_id) VALUES(?)",
      invitation.space_id,
    );
    return { spaceId: invitation.space_id };
  }, [
    `account:${current.id}`,
    `space:${target.space_id}`,
    ...(current.spaceId ? [`space:${current.spaceId}`] : []),
  ]);
}
export async function leaveSpace(request: Request) {
  const ctx = await context(request);
  await spaceTransaction(ctx, async () => {
    await execute("DELETE FROM invitations WHERE space_id=?", ctx.spaceId);
    await execute(
      "INSERT OR IGNORE INTO pair_history(space_id) VALUES(?)",
      ctx.spaceId,
    );
    await clearProfilePhoto(ctx.spaceId, ctx.account.id);
    await execute("DELETE FROM memberships WHERE user_id=?", ctx.account.id);
  });
  return { ok: true };
}
export async function updateProfile(request: Request) {
  const current = await account(request);
  const update = await json(
    request,
    z.object({
      name: shortText.min(1).optional(),
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
        }, "Choose a valid time zone.")
        .optional(),
      color: z
        .string()
        .regex(/^#[0-9a-f]{6}$/i)
        .optional(),
      availableFrom: z.number().int().min(0).max(23).optional(),
      availableTo: z.number().int().min(0).max(23).optional(),
    }),
  );
  const columns = {
    name: "name",
    timeZone: "time_zone",
    color: "color",
    availableFrom: "available_from",
    availableTo: "available_to",
  } as const;
  for (const [key, value] of Object.entries(update))
    if (value !== undefined)
      await execute(
        `UPDATE profiles SET ${columns[key as keyof typeof columns]}=? WHERE user_id=?`,
        value,
        current.id,
      );
  return { ok: true };
}
