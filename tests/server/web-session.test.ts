import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  imports: 0,
  account: vi.fn(),
  HttpError: class extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/server/http", () => {
  state.imports++;
  return { account: state.account, HttpError: state.HttpError };
});
let hasWebSession: typeof import("@/server/web-session").hasWebSession;
beforeEach(async () => {
  vi.resetModules();
  state.imports = 0;
  state.account.mockReset();
  ({ hasWebSession } = await import("@/server/web-session"));
});

describe("public-page session checks", () => {
  it.each(["", "theme=dark", "better-auth.session_data=untrusted"])(
    "does not load the database-backed account service without a session token: %s",
    async (cookie) => {
      expect(await hasWebSession(new Headers({ cookie }))).toBe(false);
      expect(state.imports).toBe(0);
      expect(state.account).not.toHaveBeenCalled();
    },
  );
  it.each(["better-auth.session_token", "__Secure-better-auth.session_token"])(
    "validates %s with the existing account service before recognizing a session",
    async (name) => {
      const cookie = `${name}=candidate-session`;
      state.account.mockResolvedValue({ id: "member", spaceId: null });
      expect(await hasWebSession(new Headers({ cookie }))).toBe(true);
      expect(state.account).toHaveBeenCalledOnce();
      expect(state.account.mock.calls[0][0].headers.get("cookie")).toBe(cookie);
    },
  );
  it("treats expired, invalid, or retired sessions as signed out", async () => {
    state.account.mockRejectedValue(
      new state.HttpError(401, "Sign in to continue."),
    );
    expect(
      await hasWebSession(
        new Headers({ cookie: "better-auth.session_token=expired" }),
      ),
    ).toBe(false);
  });
  it("does not misreport a database failure as a signed-out account", async () => {
    state.account.mockRejectedValue(new Error("Database unavailable"));
    await expect(
      hasWebSession(
        new Headers({ cookie: "better-auth.session_token=valid-looking" }),
      ),
    ).rejects.toThrow("Database unavailable");
  });
});
