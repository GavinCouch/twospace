import { assertEmailConfiguration, emailConfiguration } from "./email-config";

export type RuntimeEnvironment = Record<string, string | undefined>;

export function configuration(env: RuntimeEnvironment = process.env) {
  const cloud = env.TWOSPACE_STORAGE
    ? env.TWOSPACE_STORAGE === "cloud"
    : Boolean(env.DATABASE_URL);
  const emailReady = Boolean(emailConfiguration(env));
  return {
    cloud,
    origin: env.BETTER_AUTH_URL || "http://127.0.0.1:3100",
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    passwordReset: emailReady,
    emailPassword: !cloud || emailReady,
    emailVerification: cloud,
    objectStorage: env.SUPABASE_URL ? ("supabase" as const) : ("s3" as const),
  };
}

export function assertRuntimeConfiguration(
  env: RuntimeEnvironment = process.env,
) {
  const config = configuration(env);
  if (env.NODE_ENV === "production" && !config.cloud)
    throw new Error(
      "Cloud persistence is required in production. Set DATABASE_URL and TWOSPACE_STORAGE=cloud.",
    );
  if (config.cloud) {
    const required = [
      "DATABASE_URL",
      "BETTER_AUTH_SECRET",
      "BETTER_AUTH_URL",
      ...(config.objectStorage === "supabase"
        ? ["SUPABASE_URL", "SUPABASE_STORAGE_BUCKET"]
        : [
            "S3_ENDPOINT",
            "S3_REGION",
            "S3_BUCKET",
            "S3_ACCESS_KEY_ID",
            "S3_SECRET_ACCESS_KEY",
          ]),
    ];
    const missing = required.filter((key) => !env[key]);
    if (missing.length)
      throw new Error(`Missing cloud configuration: ${missing.join(", ")}.`);
    if (
      config.objectStorage === "supabase" &&
      !env.SUPABASE_SECRET_KEY &&
      !env.SUPABASE_SERVICE_ROLE_KEY
    )
      throw new Error("Set SUPABASE_SECRET_KEY for private file storage.");
    if ((env.BETTER_AUTH_SECRET?.length || 0) < 32)
      throw new Error(
        "BETTER_AUTH_SECRET must contain at least 32 characters.",
      );
    if (env.NODE_ENV === "production" && !config.origin.startsWith("https://"))
      throw new Error("BETTER_AUTH_URL must use HTTPS in production.");
  }
  for (const keys of [["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"]]) {
    if (keys.some((key) => env[key]) && !keys.every((key) => env[key]))
      throw new Error(`Finish configuring ${keys.join(", ")}.`);
  }
  assertEmailConfiguration(env);
}

export const runtimeConfig = configuration();
