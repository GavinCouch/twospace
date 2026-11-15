import { afterEach, describe, expect, it, vi } from "vitest";
import {
  credentialsPayload,
  credentialsSchema,
  emptyCredentials,
} from "@/features/auth/credentials";

const signup = {
  ...emptyCredentials,
  firstName: "Renée",
  lastName: "O’Connor",
  birthday: "2000-02-29",
  email: "renee@example.test",
  password: "several-unrelated-words",
  confirmPassword: "several-unrelated-words",
};
afterEach(() => vi.useRealTimers());

describe("signup validation", () => {
  it.each(["2001-02-29", "2000-13-01", "2000-04-31", "01/02/2000", ""])(
    "rejects an invalid or missing birthday: %s",
    (birthday) => {
      expect(
        credentialsSchema("sign-up").safeParse({ ...signup, birthday }).success,
      ).toBe(false);
    },
  );
  it("uses the same UTC date limit as the server and leaves the birthday as a date string", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-15T23:59:00Z"));
    expect(
      credentialsSchema("sign-up").safeParse({
        ...signup,
        birthday: "2026-11-16",
      }).success,
    ).toBe(false);
    const result = credentialsSchema("sign-up").parse({
      ...signup,
      birthday: "2026-11-15",
    });
    expect(credentialsPayload("sign-up", result)).toHaveProperty(
      "birthday",
      "2026-11-15",
    );
  });
  it("accepts long individual names without applying the old combined-name limit", () => {
    const result = credentialsSchema("sign-up").parse({
      ...signup,
      firstName: "A".repeat(60),
      lastName: "B".repeat(60),
    });
    expect(credentialsPayload("sign-up", result)).toHaveProperty(
      "name",
      `${"A".repeat(60)} ${"B".repeat(60)}`,
    );
  });
  it("keeps existing sign-in independent of profile fields and confirmation", () => {
    const result = credentialsSchema("sign-in").parse({
      ...emptyCredentials,
      email: signup.email,
      password: signup.password,
    });
    expect(credentialsPayload("sign-in", result)).toEqual({
      email: signup.email,
      password: signup.password,
    });
  });
});
