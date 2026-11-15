// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { AccountGate } from "../../src/components/account-gate";
import type { AuthConfig } from "../../src/features/auth/auth-api";

const config: AuthConfig = {
  google: false,
  passwordReset: true,
  emailPassword: true,
  emailVerification: true,
};
const unauthorized = () =>
  Response.json({ message: "Sign in first." }, { status: 401 });
function renderGate(mode: "sign-in" | "sign-up" = "sign-in") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <AccountGate signInMode={mode}>
        <p>Your journal</p>
      </AccountGate>
    </QueryClientProvider>,
  );
  return { client, user: userEvent.setup() };
}
async function enterCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("Email"), "alex@example.com");
  await user.type(screen.getByLabelText("Password"), "a-long-password");
}
async function enterProfile(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText("First name"), "Alex");
  await user.type(screen.getByLabelText("Last name"), "Rivera");
  fireEvent.change(screen.getByLabelText("Birthday"), {
    target: { value: "2000-02-29" },
  });
}
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("account sign-in integration", () => {
  it("waits for capabilities, then offers Google without an unavailable email form", async () => {
    let resolveConfig!: (value: Response) => void;
    const pending = new Promise<Response>((resolve) => {
      resolveConfig = resolve;
    });
    vi.stubGlobal(
      "fetch",
      vi.fn((path: string) =>
        path === "/api/auth/config" ? pending : Promise.resolve(unauthorized()),
      ),
    );
    renderGate();
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Loading sign-in options",
    );
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.queryByText("or", { exact: true })).not.toBeInTheDocument();
    resolveConfig(
      Response.json({
        ...config,
        google: true,
        emailPassword: false,
        passwordReset: false,
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Continue with Google" }),
    ).toBeEnabled();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Create an account" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Forgot password?" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText("Email sign-in is not available yet."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Try a sample space" }),
    ).not.toBeInTheDocument();
  });

  it("recovers from a capability request failure without showing unusable controls", async () => {
    let configAttempts = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path !== "/api/auth/config") return unauthorized();
        if (++configAttempts === 1) throw new TypeError("Network unavailable");
        return Response.json(config);
      }),
    );
    const { user } = renderGate();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not connect",
    );
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Email")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Forgot password?" }),
    ).toHaveAttribute("href", "/forgot-password");
    expect(configAttempts).toBe(2);
  });

  it("confirms successful signup when verification leaves the account signed out", async () => {
    const fetchMock = vi.fn(async (path: string, _init?: RequestInit) => {
      if (path === "/api/auth/config") return Response.json(config);
      if (path === "/api/auth/sign-up/email")
        return Response.json({ user: { id: "alex" }, token: null });
      return unauthorized();
    });
    vi.stubGlobal("fetch", fetchMock);
    const { user } = renderGate();
    await user.click(
      await screen.findByRole("button", { name: "Create an account" }),
    );
    expect(
      screen.getByText("You’ll need to verify your email."),
    ).toBeInTheDocument();
    await enterProfile(user);
    await enterCredentials(user);
    await user.type(
      screen.getByLabelText("Confirm password"),
      "a-long-password",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email to finish signing up.",
    );
    expect(
      screen.getByText("Open the verification link sent to alex@example.com."),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Your journal")).not.toBeInTheDocument();
    const signup = fetchMock.mock.calls.find(
      ([path]) => path === "/api/auth/sign-up/email",
    );
    expect(signup).toBeDefined();
    expect(JSON.parse(String(signup?.[1]?.body))).toEqual({
      name: "Alex Rivera",
      firstName: "Alex",
      lastName: "Rivera",
      birthday: "2000-02-29",
      email: "alex@example.com",
      password: "a-long-password",
    });
    expect(
      fetchMock.mock.calls.every(([path]) => path.startsWith("/api/")),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Email")).toHaveValue("alex@example.com");
  });

  it("opens pairing when signup does create a session", async () => {
    let signedIn = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path === "/api/auth/config")
          return Response.json({ ...config, emailVerification: false });
        if (path === "/api/auth/sign-up/email") {
          signedIn = true;
          return Response.json({ user: { id: "alex" } });
        }
        return signedIn
          ? Response.json({
              id: "alex",
              name: "Alex",
              email: "alex@example.com",
              spaceId: null,
              isDemo: false,
            })
          : unauthorized();
      }),
    );
    const { user } = renderGate();
    await user.click(
      await screen.findByRole("button", { name: "Create an account" }),
    );
    expect(
      screen.queryByText("You’ll need to verify your email."),
    ).not.toBeInTheDocument();
    await enterProfile(user);
    await enterCredentials(user);
    await user.type(
      screen.getByLabelText("Confirm password"),
      "a-long-password",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByRole("heading", { name: "Hi, Alex." }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Check your email to finish signing up."),
    ).not.toBeInTheDocument();
  });

  it("places an or divider between Google and the email form only when both are available", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        path === "/api/auth/config"
          ? Response.json({ ...config, google: true })
          : unauthorized(),
      ),
    );
    renderGate();
    const google = await screen.findByRole("button", {
      name: "Continue with Google",
    });
    const divider = screen.getByText("or", { exact: true });
    const email = screen.getByLabelText("Email");
    expect(
      google.compareDocumentPosition(divider) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      divider.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("blocks mismatched passwords, then clears live feedback when they match and sends optional gender", async () => {
    const fetchMock = vi.fn(async (path: string, _init?: RequestInit) => {
      if (path === "/api/auth/config") return Response.json(config);
      if (path === "/api/auth/sign-up/email")
        return Response.json({ token: null });
      return unauthorized();
    });
    vi.stubGlobal("fetch", fetchMock);
    const { user } = renderGate("sign-up");
    await enterProfile(user);
    await enterCredentials(user);
    await user.selectOptions(screen.getByLabelText(/Gender/), "non-binary");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "a-long-passworx",
    );
    expect(screen.getByText("Passwords don’t match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      fetchMock.mock.calls.some(([path]) => path === "/api/auth/sign-up/email"),
    ).toBe(false);
    await user.clear(screen.getByLabelText("Password"));
    await user.type(screen.getByLabelText("Password"), "a-long-passworx");
    expect(
      screen.queryByText("Passwords don’t match."),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Passwords match.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create account" }));
    await screen.findByRole("heading", { name: "Check your email" });
    const signup = fetchMock.mock.calls.find(
      ([path]) => path === "/api/auth/sign-up/email",
    );
    const payload = JSON.parse(String(signup?.[1]?.body));
    expect(payload.gender).toBe("non-binary");
    expect(payload.confirmPassword).toBeUndefined();
    expect(payload.birthday).toBe("2000-02-29");
  });

  it("requires both names and a birthday without requiring gender", async () => {
    const fetchMock = vi.fn(async (path: string) =>
      path === "/api/auth/config" ? Response.json(config) : unauthorized(),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { user } = renderGate("sign-up");
    await screen.findByLabelText("First name");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(
      await screen.findByText("Enter your first name."),
    ).toBeInTheDocument();
    expect(screen.getByText("Enter your last name.")).toBeInTheDocument();
    expect(screen.getByText("Enter your birthday.")).toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(([path]) => path === "/api/auth/sign-up/email"),
    ).toBe(false);
  });

  it.each([
    [401, "INVALID_EMAIL_OR_PASSWORD", "Invalid email or password."],
    [503, "EMAIL_AUTH_UNAVAILABLE", "Email sign-in is not available yet."],
  ])(
    "shows the actual server error for a failed email request (%s)",
    async (status, code, message) => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async (path: string) => {
          if (path === "/api/auth/config") return Response.json(config);
          if (path === "/api/auth/sign-in/email")
            return Response.json({ code, message }, { status });
          return unauthorized();
        }),
      );
      const { user } = renderGate();
      await enterCredentials(user);
      await user.click(screen.getByRole("button", { name: "Sign in" }));
      expect(await screen.findByRole("alert")).toHaveTextContent(message);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled(),
      );
      expect(screen.queryByText("Your journal")).not.toBeInTheDocument();
    },
  );
});
