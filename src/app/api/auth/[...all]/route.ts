import { auth, ready } from "@/server/auth";
import { runtimeConfig } from "@/server/config";
export const runtime = "nodejs";
async function handler(request: Request) {
  const path = new URL(request.url).pathname;
  if (
    !runtimeConfig.passwordReset &&
    /\/(request-password-reset|reset-password)$/.test(path)
  )
    return Response.json(
      {
        code: "PASSWORD_RESET_UNAVAILABLE",
        message: "Password reset is not available yet.",
      },
      { status: 503 },
    );
  if (
    !runtimeConfig.emailPassword &&
    /\/(sign-up\/email|sign-in\/email)$/.test(path)
  )
    return Response.json(
      {
        code: "EMAIL_AUTH_UNAVAILABLE",
        message: "Email sign-in is not available yet.",
      },
      { status: 503 },
    );
  await ready();
  return auth.handler(request);
}
export { handler as GET, handler as POST };
