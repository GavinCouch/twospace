// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
import { AuthPage } from "@/features/auth/auth-page";

const navigation = vi.hoisted(() => ({ replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
const capabilities = {
  google: false,
  passwordReset: true,
  emailPassword: true,
  emailVerification: true,
};
const signedOut = () =>
  Response.json({ error: "Sign in first." }, { status: 401 });
function mount(mode: "sign-in" | "sign-up") {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  render(
    <QueryClientProvider client={client}>
      <AuthPage mode={mode} />
    </QueryClientProvider>,
  );
  return userEvent.setup();
}
beforeEach(() => navigation.replace.mockReset());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("dedicated account pages", () => {
  it("opens account creation directly and stays on verification after signup", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) => {
        if (path === "/api/auth/config") return Response.json(capabilities);
        if (path === "/api/auth/sign-up/email")
          return Response.json({ user: { id: "alex" }, token: null });
        return signedOut();
      }),
    );
    const user = mount("sign-up");
    await user.type(await screen.findByLabelText("First name"), "Alex");
    await user.type(screen.getByLabelText("Last name"), "Rivera");
    fireEvent.change(screen.getByLabelText("Birthday"), {
      target: { value: "2000-02-29" },
    });
    await user.type(screen.getByLabelText("Email"), "alex@example.test");
    await user.type(screen.getByLabelText("Password"), "long-test-password");
    await user.type(
      screen.getByLabelText("Confirm password"),
      "long-test-password",
    );
    await user.click(screen.getByRole("button", { name: /^Create account$/ }));
    expect(
      await screen.findByRole("heading", { name: "Check your email" }),
    ).toBeInTheDocument();
    expect(navigation.replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "TwoSpace home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
  it("opens the journal after a successful sign-in, including accounts that still need a space", async () => {
    let signedIn = false;
    const fetchMock = vi.fn(async (path: string) => {
      if (path === "/api/auth/config") return Response.json(capabilities);
      if (path === "/api/auth/sign-in/email") {
        signedIn = true;
        return Response.json({ user: { id: "alex" } });
      }
      return signedIn
        ? Response.json({
            id: "alex",
            name: "Alex",
            email: "alex@example.test",
            spaceId: null,
            isDemo: false,
          })
        : signedOut();
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = mount("sign-in");
    await user.type(await screen.findByLabelText("Email"), "alex@example.test");
    expect(screen.queryByLabelText("First name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Birthday")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Password"), "long-test-password");
    await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
    await waitFor(() =>
      expect(navigation.replace).toHaveBeenCalledWith("/journal"),
    );
    expect(
      screen.queryByLabelText("Name your shared space"),
    ).not.toBeInTheDocument();
  });
  it("keeps failed sign-in on the form without navigating", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (path: string) =>
        path === "/api/auth/config"
          ? Response.json(capabilities)
          : path === "/api/auth/sign-in/email"
            ? Response.json(
                { message: "Invalid email or password." },
                { status: 401 },
              )
            : signedOut(),
      ),
    );
    const user = mount("sign-in");
    await user.type(await screen.findByLabelText("Email"), "alex@example.test");
    await user.type(screen.getByLabelText("Password"), "long-test-password");
    await user.click(screen.getByRole("button", { name: /^Sign in$/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password.",
    );
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
