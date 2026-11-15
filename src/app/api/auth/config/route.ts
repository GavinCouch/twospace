import { runtimeConfig } from "@/server/config";
export const dynamic = "force-dynamic";
export const GET = () =>
  Response.json(
    {
      google: runtimeConfig.google,
      passwordReset: runtimeConfig.passwordReset,
      emailPassword: runtimeConfig.emailPassword,
      emailVerification: runtimeConfig.emailVerification,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
