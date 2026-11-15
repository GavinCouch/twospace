import { z } from "zod";
import { auth, ready, appOrigin } from "./auth";
import { runtimeConfig } from "./config";
import { execute, resources, row, rows, transaction } from "./database";
import type { Account, Person } from "@/shared/types";
import type { ProfilePhoto } from "./profile-photos";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}
export type Context = {
  account: Account;
  spaceId: string;
  me: Person;
  members: Person[];
};
type ProfileRow = {
  user_id: string;
  name: string;
  time_zone: string;
  color: string;
  available_from: number;
  available_to: number;
  is_demo: number;
};
export function person(profile: ProfileRow): Person {
  return {
    id: profile.user_id,
    name: profile.name,
    timeZone: profile.time_zone,
    color: profile.color,
    availableFrom: profile.available_from,
    availableTo: profile.available_to,
  };
}
export async function ensureProfile(userId: string, name: string) {
  await execute(
    "INSERT OR IGNORE INTO profiles(user_id,name) VALUES(?,?)",
    userId,
    name,
  );
  return (await row<ProfileRow>(
    "SELECT * FROM profiles WHERE user_id=?",
    userId,
  ))!;
}
export async function account(request: Request): Promise<Account> {
  await ready();
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) throw new HttpError(401, "Sign in to continue.");
  const profile = await ensureProfile(session.user.id, session.user.name);
  const membership = await row<{
    space_id: string;
  }>("SELECT space_id FROM memberships WHERE user_id=?", session.user.id);
  if (profile.is_demo || session.user.email.endsWith("@demo.twospace.invalid"))
    throw new HttpError(
      401,
      "Sample spaces are no longer available. Sign in with your own account.",
      "SAMPLE_RETIRED",
    );
  return {
    id: session.user.id,
    name: profile.name,
    email: session.user.email,
    firstName: session.user.firstName ?? undefined,
    lastName: session.user.lastName ?? undefined,
    gender: session.user.gender ?? undefined,
    birthday: session.user.birthday ?? undefined,
    spaceId: membership?.space_id ?? null,
    isDemo: !!profile.is_demo,
  };
}
export async function context(request: Request): Promise<Context> {
  const current = await account(request);
  if (!current.spaceId)
    throw new HttpError(
      404,
      "Create a space or accept an invitation first.",
      "NO_SPACE",
    );
  const members = (
    await rows<ProfileRow>(
      "SELECT p.* FROM profiles p JOIN memberships m ON m.user_id=p.user_id WHERE m.space_id=? ORDER BY m.slot",
      current.spaceId,
    )
  ).map(person);
  if (!members.some((member) => member.id === current.id))
    throw new HttpError(403, "You no longer belong to this space.");
  const photos = await resources<ProfilePhoto>(current.spaceId, "profilePhoto");
  for (const member of members) {
    const photo = photos.find((item) => item.authorId === member.id);
    if (photo) member.avatarMediaId = photo.mediaId;
  }
  return {
    account: current,
    spaceId: current.spaceId,
    me: members.find((p) => p.id === current.id)!,
    members,
  };
}
export async function spaceTransaction<T>(
  ctx: Context,
  fn: () => T | Promise<T>,
): Promise<T> {
  return transaction(async () => {
    const members = await rows<{ user_id: string }>(
      "SELECT user_id FROM memberships WHERE space_id=?",
      ctx.spaceId,
    );
    const currentIds = new Set(members.map((member) => member.user_id));
    const expectedIds = new Set(ctx.members.map((member) => member.id));
    if (!currentIds.has(ctx.account.id))
      throw new HttpError(403, "You no longer belong to this space.");
    if (
      currentIds.size !== expectedIds.size ||
      [...expectedIds].some((memberId) => !currentIds.has(memberId))
    )
      throw new HttpError(
        409,
        "The people in this space changed. Refresh and try again.",
      );
    return fn();
  }, `space:${ctx.spaceId}`);
}
export function requirePartner(ctx: Context) {
  if (ctx.members.length !== 2)
    throw new HttpError(
      409,
      "Invite your partner before starting this activity.",
    );
}
export async function json<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<T> {
  const limit = 500000;
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError(413, "That update is too large.");
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  if (reader) {
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        length += result.value.byteLength;
        if (length > limit) {
          await reader.cancel();
          throw new HttpError(413, "That update is too large.");
        }
        chunks.push(result.value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return schema.parse(JSON.parse(text || "{}"));
  } catch (error) {
    if (error instanceof z.ZodError) throw error;
    throw new HttpError(400, "Send valid JSON.");
  }
}
export function checkOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (
    origin &&
    !(
      runtimeConfig.cloud
        ? [appOrigin]
        : [appOrigin, "http://localhost:3100", "http://127.0.0.1:3100"]
    ).includes(origin)
  )
    throw new HttpError(403, "This request came from another website.");
}
export const response = (value: unknown, status = 200) =>
  Response.json(value, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
export type RouteContext = {
  params: Promise<Record<string, string>>;
};
export function route(
  fn: (
    request: Request,
    params: Record<string, string>,
  ) => Promise<unknown> | unknown,
) {
  return async (request: Request, routeContext: RouteContext) => {
    try {
      checkOrigin(request);
      const result = await fn(
        request,
        routeContext?.params ? await routeContext.params : {},
      );
      return result instanceof Response ? result : response(result);
    } catch (error) {
      if (error instanceof HttpError)
        return response(
          { error: error.message, code: error.code },
          error.status,
        );
      if (error instanceof z.ZodError)
        return response(
          {
            error: error.issues[0]?.message || "Check the form and try again.",
            code: "VALIDATION",
          },
          400,
        );
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "23505"
      )
        return response(
          {
            error:
              "This item changed while you were working. Refresh and try again.",
            code: "CONFLICT",
          },
          409,
        );
      console.error(
        "Request failed:",
        error instanceof Error ? error.message : "Unknown server error",
      );
      return response(
        { error: "Something went wrong. Please try again." },
        500,
      );
    }
  };
}
export function found<T>(value: T | undefined): T {
  if (!value) throw new HttpError(404, "That item could not be found.");
  return value;
}
export const shortText = z.string().trim().max(160);
export const optionalUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        ["https:", "http:"].includes(url.protocol) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Use a complete http or https link.");
