import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { nextAfter } = vi.hoisted(() => ({ nextAfter: vi.fn() }));
vi.mock("next/server", () => ({ after: nextAfter }));
import { queueEmail, sendEmail } from "@/server/email";

const message = {
  to: "recipient@example.test",
  subject: "Confirm your TwoSpace email",
  text: "Confirm your email:\n\nhttps://twospace.example/verify?token=test-token&next=journal",
};
const request = vi.fn<typeof fetch>();
beforeEach(() => {
  for (const key of [
    "EMAIL_PROVIDER",
    "EMAIL_FROM",
    "RESEND_API_KEY",
    "BREVO_API_KEY",
  ])
    vi.stubEnv(key, undefined);
  request.mockReset().mockResolvedValue(new Response(null, { status: 201 }));
  nextAfter.mockReset();
  vi.stubGlobal("fetch", request);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function configureBrevo() {
  vi.stubEnv("EMAIL_PROVIDER", "brevo");
  vi.stubEnv("BREVO_API_KEY", "test-brevo-key");
  vi.stubEnv("EMAIL_FROM", "TwoSpace <sender@example.test>");
}

describe("authentication email delivery", () => {
  it("keeps Resend as the existing default transport", async () => {
    vi.stubEnv("RESEND_API_KEY", "test-resend-key");
    vi.stubEnv("EMAIL_FROM", "TwoSpace <sender@example.test>");
    await sendEmail(message);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(options?.headers).toEqual({
      Authorization: "Bearer test-resend-key",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(options?.body as string)).toEqual({
      from: "TwoSpace <sender@example.test>",
      ...message,
    });
  });
  it("sends Brevo's HTTPS request shape using only the selected provider key", async () => {
    configureBrevo();
    vi.stubEnv("RESEND_API_KEY", "unused-key");
    await sendEmail(message);
    const [url, options] = request.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options?.method).toBe("POST");
    expect(options?.signal).toBeInstanceOf(AbortSignal);
    expect(options?.headers).toEqual({
      "api-key": "test-brevo-key",
      "Content-Type": "application/json",
    });
    const body = JSON.parse(options?.body as string);
    expect(body).toMatchObject({
      sender: { name: "TwoSpace", email: "sender@example.test" },
      to: [{ email: message.to }],
      subject: message.subject,
      textContent: message.text,
    });
    expect(body.htmlContent).toContain(
      'href="https://twospace.example/verify?token=test-token&amp;next=journal"',
    );
    expect(JSON.stringify(options)).not.toContain("unused-key");
  });
  it("accepts a bare sender address and escapes HTML without changing the plain text", async () => {
    configureBrevo();
    vi.stubEnv("EMAIL_FROM", "sender@example.test");
    const text = '<img src=x onerror="alert(1)"> & hello';
    await sendEmail({ ...message, text });
    const body = JSON.parse(request.mock.calls[0][1]?.body as string);
    expect(body.sender).toEqual({
      name: "TwoSpace",
      email: "sender@example.test",
    });
    expect(body.textContent).toBe(text);
    expect(body.htmlContent).toContain(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; hello",
    );
    expect(body.htmlContent).not.toContain("<img");
  });
  it("does not attempt a request with incomplete provider configuration", async () => {
    configureBrevo();
    vi.stubEnv("BREVO_API_KEY", undefined);
    vi.stubEnv("RESEND_API_KEY", "wrong-provider-key");
    await expect(sendEmail(message)).rejects.toThrow(
      "Email delivery is not configured.",
    );
    expect(request).not.toHaveBeenCalled();
  });
  it.each([401, 429, 503])(
    "reports HTTP %i without exposing the provider body or retrying elsewhere",
    async (status) => {
      configureBrevo();
      request.mockResolvedValue(
        new Response("private provider details and token", { status }),
      );
      await expect(sendEmail(message)).rejects.toThrow(
        `Email provider rejected the request (${status}).`,
      );
      expect(request).toHaveBeenCalledTimes(1);
    },
  );
  it("replaces network errors with a safe message", async () => {
    configureBrevo();
    request.mockRejectedValue(
      new Error("private transport details test-brevo-key"),
    );
    await expect(sendEmail(message)).rejects.toThrow(
      "Email delivery could not reach the provider.",
    );
  });
  it("logs no recipients, credentials or reset links when a queued message fails", async () => {
    configureBrevo();
    request.mockRejectedValue(new Error(message.text));
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    queueEmail(message);
    expect(request).not.toHaveBeenCalled();
    await nextAfter.mock.calls[0][0]();
    expect(log).toHaveBeenCalledExactlyOnceWith(
      "An authentication email could not be delivered. Check the email provider logs.",
    );
  });
});
