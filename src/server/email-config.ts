import { z } from "zod";
import type { RuntimeEnvironment } from "./config";

function senderAddress(value: string | undefined) {
  if (!value || /[\r\n]/.test(value)) return null;
  const named = value.trim().match(/^([^<>]*)<([^<>]+)>$/);
  const email = (named?.[2] ?? value).trim();
  if (!z.email().safeParse(email).success) return null;
  return { email, name: named?.[1].trim() || "TwoSpace" };
}

export function emailConfiguration(env: RuntimeEnvironment = process.env) {
  const provider = env.EMAIL_PROVIDER || "resend";
  if (provider !== "resend" && provider !== "brevo") return null;
  const apiKey = (
    provider === "brevo" ? env.BREVO_API_KEY : env.RESEND_API_KEY
  )?.trim();
  const sender = senderAddress(env.EMAIL_FROM);
  if (!apiKey || !sender) return null;
  return { provider, apiKey, sender, from: env.EMAIL_FROM!.trim() };
}

export function assertEmailConfiguration(env: RuntimeEnvironment) {
  if (env.EMAIL_PROVIDER && !["resend", "brevo"].includes(env.EMAIL_PROVIDER))
    throw new Error("EMAIL_PROVIDER must be resend or brevo.");
  const hasSettings = [
    "EMAIL_PROVIDER",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "BREVO_API_KEY",
  ].some((key) => env[key]);
  if (hasSettings && !emailConfiguration(env)) {
    const key =
      env.EMAIL_PROVIDER === "brevo" ? "BREVO_API_KEY" : "RESEND_API_KEY";
    throw new Error(
      `Finish configuring EMAIL_PROVIDER, ${key} and a valid EMAIL_FROM.`,
    );
  }
}
