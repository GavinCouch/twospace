// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import ForgotPassword from "../../src/features/auth/forgot-password";

vi.mock("@/components/account-gate", () => ({ Brand: () => <span>TwoSpace</span> }));
function setup(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ForgotPassword /></QueryClientProvider>);
  return userEvent.setup();
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const configured = () => Response.json({ google: false, apple: false, passwordReset: true });

describe("requesting a password reset", () => {
  it("posts the email and current-origin return URL without asserting that an account exists", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configured()).mockResolvedValueOnce(Response.json({ status: true }));
    const user = setup(fetchMock);
    await user.type(await screen.findByRole("textbox", { name: "Email address" }), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("heading", { name: "Check your email" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("If an account uses that email address");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ email: "alex@example.com", redirectTo: `${window.location.origin}/reset-password` });
  });
  it("does not show a form or report success when delivery is unconfigured", async () => {
    setup(vi.fn().mockResolvedValue(Response.json({ google: false, apple: false, passwordReset: false })));
    expect(await screen.findByText("Password reset is unavailable right now.")).toHaveAttribute("role", "status");
    expect(screen.queryByRole("button", { name: "Send reset link" })).not.toBeInTheDocument();
  });
  it("handles delivery becoming unavailable after the form loaded", async () => {
    const user = setup(vi.fn().mockResolvedValueOnce(configured()).mockResolvedValueOnce(Response.json({ code: "PASSWORD_RESET_UNAVAILABLE", message: "Password reset is not available yet." }, { status: 503 })));
    await user.type(await screen.findByRole("textbox", { name: "Email address" }), "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Password reset is unavailable");
    expect(screen.queryByRole("heading", { name: "Check your email" })).not.toBeInTheDocument();
  });
  it("preserves the email when the request fails", async () => {
    const user = setup(vi.fn().mockResolvedValueOnce(configured()).mockRejectedValueOnce(new TypeError("Failed to fetch")));
    const email = await screen.findByRole("textbox", { name: "Email address" });
    await user.type(email, "alex@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your connection");
    expect(email).toHaveValue("alex@example.com");
  });
});
