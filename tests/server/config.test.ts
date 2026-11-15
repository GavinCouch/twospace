import { describe, expect, it } from "vitest";
import { assertRuntimeConfiguration, configuration } from "@/server/config";

const cloud = {
  NODE_ENV: "production",
  TWOSPACE_STORAGE: "cloud",
  DATABASE_URL: "postgresql://example.invalid/twospace",
  BETTER_AUTH_URL: "https://twospace.example",
  BETTER_AUTH_SECRET: "test-only-secret-with-more-than-32-characters",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_test-only",
  SUPABASE_STORAGE_BUCKET: "private-media",
};
describe("deployment configuration", () => {
  it("refuses to fall back to local files in production", () => {
    expect(() =>
      assertRuntimeConfiguration({ NODE_ENV: "production" }),
    ).toThrow("Cloud persistence is required");
  });
  it("requires private object-storage credentials as well as a database", () => {
    expect(() =>
      assertRuntimeConfiguration({ ...cloud, SUPABASE_SECRET_KEY: undefined }),
    ).toThrow("SUPABASE_SECRET_KEY");
    expect(() => assertRuntimeConfiguration(cloud)).not.toThrow();
  });
  it("requires a stable secret and an HTTPS production origin", () => {
    expect(() =>
      assertRuntimeConfiguration({ ...cloud, BETTER_AUTH_SECRET: "short" }),
    ).toThrow("32 characters");
    expect(() =>
      assertRuntimeConfiguration({
        ...cloud,
        BETTER_AUTH_URL: "http://twospace.example",
      }),
    ).toThrow("HTTPS");
  });
  it("does not advertise incomplete OAuth or email configuration", () => {
    expect(configuration({ ...cloud, GOOGLE_CLIENT_ID: "client" }).google).toBe(
      false,
    );
    expect(() =>
      assertRuntimeConfiguration({ ...cloud, GOOGLE_CLIENT_ID: "client" }),
    ).toThrow("GOOGLE_CLIENT_SECRET");
    expect(configuration(cloud)).toMatchObject({
      passwordReset: false,
      emailPassword: false,
      emailVerification: true,
    });
    expect(
      configuration({
        ...cloud,
        RESEND_API_KEY: "test-key",
        EMAIL_FROM: "sender@example.test",
      }),
    ).toMatchObject({ passwordReset: true, emailPassword: true });
  });
  it("keeps local email accounts available without cloud keys", () => {
    expect(configuration({ TWOSPACE_STORAGE: "local" })).toMatchObject({
      cloud: false,
      emailPassword: true,
      google: false,
      passwordReset: false,
    });
    expect(() =>
      assertRuntimeConfiguration({
        NODE_ENV: "development",
        TWOSPACE_STORAGE: "local",
      }),
    ).not.toThrow();
  });
  it("enables cloud email features for a fully configured Brevo sender", () => {
    const settings = {
      ...cloud,
      EMAIL_PROVIDER: "brevo",
      BREVO_API_KEY: "test-key",
      EMAIL_FROM: "TwoSpace <sender@example.test>",
    };
    expect(configuration(settings)).toMatchObject({
      passwordReset: true,
      emailPassword: true,
      emailVerification: true,
    });
    expect(() => assertRuntimeConfiguration(settings)).not.toThrow();
    expect(
      configuration({
        ...settings,
        BREVO_API_KEY: undefined,
        RESEND_API_KEY: "other-key",
      }),
    ).toMatchObject({ passwordReset: false, emailPassword: false });
  });
  it("rejects unsupported or incomplete email providers without exposing their settings", () => {
    expect(() =>
      assertRuntimeConfiguration({ ...cloud, EMAIL_PROVIDER: "smtp" }),
    ).toThrow("EMAIL_PROVIDER must be resend or brevo.");
    expect(() =>
      assertRuntimeConfiguration({
        ...cloud,
        EMAIL_PROVIDER: "brevo",
        EMAIL_FROM: "sender@example.test",
      }),
    ).toThrow("BREVO_API_KEY");
    for (const from of [
      "invalid-address",
      "sender@example.test\nBcc: other@example.test",
    ]) {
      const settings = {
        ...cloud,
        EMAIL_PROVIDER: "brevo",
        BREVO_API_KEY: "test-key",
        EMAIL_FROM: from,
      };
      expect(configuration(settings).passwordReset).toBe(false);
      expect(() => assertRuntimeConfiguration(settings)).toThrow(
        "valid EMAIL_FROM",
      );
    }
  });
});
