import { z } from "zod";

export const authConfigSchema = z.object({
  google: z.boolean(), passwordReset: z.boolean(),
  emailPassword: z.boolean().optional(), emailVerification: z.boolean().optional(),
});
export type AuthConfig = z.infer<typeof authConfigSchema>;
export type SocialProvider = "google";

export class AuthRequestError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "AuthRequestError";
  }
}

export async function authRequest<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: body === undefined ? "GET" : "POST",
      credentials: "same-origin",
      cache: "no-store",
      ...(body === undefined ? {} : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new AuthRequestError("Could not connect. Check your connection and try again.", 0);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const details = data?.error && typeof data.error === "object" ? data.error : data;
    const message = typeof details?.message === "string" ? details.message : typeof data?.error === "string" ? data.error : "The request failed. Please try again.";
    throw new AuthRequestError(message, response.status, typeof details?.code === "string" ? details.code : undefined);
  }
  return data as T;
}

export async function getAuthConfig(): Promise<AuthConfig> {
  const result = authConfigSchema.safeParse(await authRequest<unknown>("/api/auth/config"));
  if (!result.success) throw new AuthRequestError("Sign-in options could not load. Please try again.", 0);
  return result.data;
}

export async function beginSocialSignIn(provider: SocialProvider): Promise<string> {
  const result = await authRequest<{ url?: string }>("/api/auth/sign-in/social", { provider, callbackURL: "/journal" });
  if (!result?.url) throw new AuthRequestError("Sign-in could not start. Please try again.", 0);
  let url: URL;
  try { url = new URL(result.url, window.location.origin); }
  catch { throw new AuthRequestError("Sign-in could not start. Please try again.", 0); }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && url.origin === window.location.origin)) {
    throw new AuthRequestError("Sign-in could not start. Please try again.", 0);
  }
  return url.href;
}

export const isResetUnavailable = (error: unknown) => error instanceof AuthRequestError && error.code === "PASSWORD_RESET_UNAVAILABLE";
export const isInvalidResetToken = (error: unknown) => error instanceof AuthRequestError && ["INVALID_TOKEN", "TOKEN_EXPIRED", "EXPIRED_TOKEN", "INVALID_RESET_TOKEN", "RESET_TOKEN_EXPIRED"].includes(error.code || "");
export const authErrorMessage = (error: unknown) => error instanceof Error ? error.message : "The request failed. Please try again.";
