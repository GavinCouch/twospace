import { getSessionCookie } from "better-auth/cookies";

/** Anonymous public-page visits never initialize the database or auth service. */
export async function hasWebSession(requestHeaders: Headers): Promise<boolean> {
  if (!getSessionCookie(requestHeaders)) return false;
  const { account, HttpError } = await import("./http");
  try {
    await account(
      new Request(process.env.BETTER_AUTH_URL || "http://127.0.0.1:3100", {
        headers: requestHeaders,
      }),
    );
    return true;
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) return false;
    throw error;
  }
}
