import { randomBytes, randomUUID } from "node:crypto";

type Backend = {
  auth: typeof import("@/server/auth").auth;
  execute: typeof import("@/server/database").execute;
  cloud?: boolean;
};

/** Test-only accounts use real auth sessions and never send verification mail. */
export async function createTestIdentity(
  { auth, execute, cloud = false }: Backend,
  name: string,
) {
  if (process.env.NODE_ENV !== "test")
    throw new Error("Account fixtures are only available in tests.");
  const email = `${name.toLowerCase()}.${randomUUID()}@example.test`;
  const password = randomBytes(30).toString("base64url");
  const created = await auth.api.signUpEmail({
    body: { name, email, password },
  });
  if (cloud) {
    // Cloud tests mock email delivery, then explicitly verify their own fixture.
    await execute(
      'UPDATE "twospace"."user" SET "emailVerified"=TRUE WHERE id=?',
      created.user.id,
    );
  }
  const signedIn = await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  });
  if (signedIn.status !== 200)
    throw new Error(`Test account sign-in failed (${signedIn.status}).`);
  return {
    id: created.user.id,
    cookie: signedIn.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  };
}
