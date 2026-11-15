import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import {
  randomBytes,
  createHash,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { authDatabase, databaseReady, dataDirectory, pool } from "./database";
import { assertRuntimeConfiguration, runtimeConfig } from "./config";
import { queueEmail } from "./email";

function loadSecret(): string {
  if (process.env.BETTER_AUTH_SECRET) return process.env.BETTER_AUTH_SECRET;
  // Build-time module evaluation may run before deployment secrets are available.
  // ready() rejects every cloud request without a persistent configured secret.
  if (runtimeConfig.cloud) return randomBytes(48).toString("base64url");
  const path = join(dataDirectory, ".auth-secret");
  try {
    return readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    try {
      writeFileSync(path, randomBytes(48).toString("base64url"), {
        mode: 0o600,
        flag: "wx",
      });
    } catch (writeError) {
      if ((writeError as NodeJS.ErrnoException).code !== "EEXIST")
        throw writeError;
    }
    return readFileSync(path, "utf8");
  }
}
const secret = loadSecret();
export const appOrigin = process.env.BETTER_AUTH_URL || "http://127.0.0.1:3100";
export const auth = betterAuth({
  appName: "TwoSpace",
  baseURL: appOrigin,
  secret,
  database: authDatabase,
  trustedOrigins: runtimeConfig.cloud
    ? [appOrigin]
    : [appOrigin, "http://localhost:3100", "http://127.0.0.1:3100"],
  socialProviders: runtimeConfig.google
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          prompt: "select_account",
        },
      }
    : {},
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: runtimeConfig.cloud,
    revokeSessionsOnPasswordReset: true,
    ...(runtimeConfig.passwordReset
      ? {
          sendResetPassword: async ({
            user,
            url,
          }: {
            user: { email: string };
            url: string;
          }) => {
            queueEmail({
              to: user.email,
              subject: "Reset your TwoSpace password",
              text: `Use this link to choose a new password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
            });
          },
        }
      : {}),
  },
  emailVerification: {
    sendOnSignUp: runtimeConfig.cloud,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      if (user.email.endsWith("@demo.twospace.invalid")) return;
      queueEmail({
        to: user.email,
        subject: "Confirm your TwoSpace email",
        text: `Confirm this email address to finish creating your account:\n\n${url}`,
      });
    },
  },
  session: { expiresIn: 60 * 60 * 24 * 7, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    storage: runtimeConfig.cloud ? "database" : "memory",
  },
});
const globals = globalThis as unknown as { twospaceAuthReady?: Promise<void> };
export function ready(): Promise<void> {
  return (globals.twospaceAuthReady ??= Promise.resolve()
    .then(async () => {
      assertRuntimeConfiguration();
      await databaseReady();
      const client = pool ? await pool.connect() : undefined;
      try {
        if (client)
          await client.query(
            "SELECT pg_advisory_lock(hashtext('twospace-auth-schema'))",
          );
        const { runMigrations } = await getMigrations(auth.options);
        await runMigrations();
      } finally {
        if (client) {
          await client.query(
            "SELECT pg_advisory_unlock(hashtext('twospace-auth-schema'))",
          );
          client.release();
        }
      }
    })
    .catch((error) => {
      globals.twospaceAuthReady = undefined;
      throw error;
    }));
}

const encryptionKey = createHash("sha256").update(secret).digest();
export function seal(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString(
    "base64url",
  );
}
export function unseal(value: string): string {
  const data = Buffer.from(value, "base64url");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey,
    data.subarray(0, 12),
  );
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([
    decipher.update(data.subarray(28)),
    decipher.final(),
  ]).toString("utf8");
}
export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
