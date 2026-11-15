// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { ProviderButtons, PasswordRecoveryLink } from "../../src/features/auth/provider-buttons";
import { beginSocialSignIn } from "../../src/features/auth/auth-api";

function renderOptions(onRedirect = vi.fn()) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProviderButtons onRedirect={onRedirect} /><PasswordRecoveryLink /></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("configured sign-in options", () => {
  it("shows only configured providers and follows the URL returned by the server", async () => {
    const user = userEvent.setup();
    const redirect = vi.fn();
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ google: true, apple: true, passwordReset: true })).mockResolvedValueOnce(Response.json({ url: "https://accounts.google.com/o/oauth2/v2/auth?state=example" }));
    vi.stubGlobal("fetch", fetchMock);
    renderOptions(redirect);
    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(screen.queryByRole("button", { name: "Continue with Apple" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Forgot password?" })).toHaveAttribute("href", "/forgot-password");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ provider: "google", callbackURL: "/journal" });
    expect(redirect).toHaveBeenCalledWith("https://accounts.google.com/o/oauth2/v2/auth?state=example");
  });
  it("does not offer unconfigured services", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ google: false, apple: false, passwordReset: false })));
    renderOptions();
    expect(await screen.findByText("Password reset is unavailable.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Forgot password?" })).not.toBeInTheDocument();
  });
  it("keeps a failed provider sign-in retryable without redirecting", async () => {
    const user = userEvent.setup();
    const redirect = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({ google: true, passwordReset: false })).mockResolvedValueOnce(Response.json({ code: "PROVIDER_NOT_FOUND", message: "Google sign-in is unavailable." }, { status: 400 })));
    renderOptions(redirect);
    await user.click(await screen.findByRole("button", { name: "Continue with Google" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Google sign-in is unavailable.");
    await waitFor(() => expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled());
    expect(redirect).not.toHaveBeenCalled();
  });
  it("rejects a malformed provider redirect instead of navigating", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ url: "javascript:alert(1)" })));
    await expect(beginSocialSignIn("google")).rejects.toThrow("Sign-in could not start");
  });
});
