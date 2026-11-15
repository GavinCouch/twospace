// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import ResetPassword from "../../src/features/auth/reset-password";

vi.mock("@/components/account-gate", () => ({ Brand: () => <span>TwoSpace</span> }));
const configured = () => Response.json({ google: false, passwordReset: true });
function setup(fetchMock: ReturnType<typeof vi.fn>, props: { token?: string; errorCode?: string } = { token: "reset-token" }) {
  vi.stubGlobal("fetch", fetchMock);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ResetPassword {...props} /></QueryClientProvider>);
  return userEvent.setup();
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("completing a password reset", () => {
  it("requires matching passwords before sending the reset token", async () => {
    const fetchMock = vi.fn().mockResolvedValue(configured());
    const user = setup(fetchMock);
    await user.type(await screen.findByLabelText("New password", { exact: true }), "a-new-password");
    await user.type(screen.getByLabelText("Confirm new password", { exact: true }), "a-different-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("The passwords do not match.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("checks the password length before submitting", async () => {
    const fetchMock = vi.fn().mockResolvedValue(configured());
    const user = setup(fetchMock);
    await user.type(await screen.findByLabelText("New password", { exact: true }), "short");
    await user.type(screen.getByLabelText("Confirm new password", { exact: true }), "short");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByText("Use at least 10 characters.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("submits only the password and token, then offers sign-in", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(configured()).mockResolvedValueOnce(Response.json({ status: true }));
    const user = setup(fetchMock);
    await user.type(await screen.findByLabelText("New password", { exact: true }), "a-new-password");
    await user.type(screen.getByLabelText("Confirm new password", { exact: true }), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: "Password updated" })).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ newPassword: "a-new-password", token: "reset-token" });
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/journal");
    expect(screen.queryByLabelText("New password", { exact: true })).not.toBeInTheDocument();
  });
  it.each([{}, { errorCode: "INVALID_TOKEN" }])("handles a missing or rejected callback token before asking for a password", async props => {
    setup(vi.fn().mockResolvedValue(configured()), props);
    expect(await screen.findByRole("alert")).toHaveTextContent("invalid or has expired");
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.queryByLabelText("New password", { exact: true })).not.toBeInTheDocument();
  });
  it("handles a token expiring between opening the page and submitting", async () => {
    const user = setup(vi.fn().mockResolvedValueOnce(configured()).mockResolvedValueOnce(Response.json({ code: "INVALID_TOKEN", message: "Invalid token" }, { status: 400 })));
    await user.type(await screen.findByLabelText("New password", { exact: true }), "a-new-password");
    await user.type(screen.getByLabelText("Confirm new password", { exact: true }), "a-new-password");
    await user.click(screen.getByRole("button", { name: "Update password" }));
    expect(await screen.findByRole("heading", { name: "Reset link unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update password" })).not.toBeInTheDocument();
  });
  it("does not accept a password when reset delivery is unavailable", async () => {
    setup(vi.fn().mockResolvedValue(Response.json({ google: false, passwordReset: false })));
    expect(await screen.findByText("Password reset is unavailable right now.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update password" })).not.toBeInTheDocument();
  });
});
