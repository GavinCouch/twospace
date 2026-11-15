import { betterAuth } from "better-auth";
import { expo } from "@better-auth/expo";
import { getMigrations } from "better-auth/db/migration";
import { randomBytes, createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  authDatabase,
  databaseReady,
  dataDirectory,
  withAuthMigrationLock,
} from "./database";
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
  user: {
    // Optional in the API so existing accounts, native clients and OAuth stay compatible.
    additionalFields: {
      firstName: {
        type: "string",
        required: false,
        validator: {
          input: z
            .string()
            .trim()
            .min(1, "Enter your first name.")
            .max(60, "Use at most 60 characters for your first name."),
        },
      },
      lastName: {
        type: "string",
        required: false,
        validator: {
          input: z
            .string()
            .trim()
            .min(1, "Enter your last name.")
            .max(60, "Use at most 60 characters for your last name."),
        },
      },
      gender: {
        type: ["woman", "man", "non-binary", "prefer-not-to-say"],
        required: false,
        validator: {
          input: z.enum(["woman", "man", "non-binary", "prefer-not-to-say"]),
        },
      },
      birthday: {
        type: "string",
        required: false,
        validator: {
          input: z.iso
            .date("Enter a valid birthday.")
            .refine(
              (value) => value <= new Date().toISOString().slice(0, 10),
              "Your birthday cannot be in the future.",
            ),
        },
      },
    },
  },
  plugins: [expo()],
  advanced: { disableCSRFCheck: false, disableOriginCheck: false },
  trustedOrigins: runtimeConfig.cloud
    ? [appOrigin, "twospace://"]
    : [
        appOrigin,
        "twospace://",
        "http://localhost:3100",
        "http://127.0.0.1:3100",
      ],
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
      await withAuthMigrationLock(async () => {
        const { runMigrations } = await getMigrations(auth.options);
        await runMigrations();
      });
    })
    .catch((error) => {
      globals.twospaceAuthReady = undefined;
      throw error;
    }));
}

export const hashToken = (value: string) =>
  createHash("sha256").update(value).digest("hex");
