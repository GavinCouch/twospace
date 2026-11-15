import { after } from "next/server";
import { emailConfiguration } from "./email-config";

type Email = { to: string; subject: string; text: string };
function emailHtml(text: string) {
  const escape = (value: string) =>
    value.replace(
      /[&<>\"]/g,
      (character) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]!,
    );
  const paragraphs = text
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const safe = escape(line);
      const link = /^https?:\/\/\S+$/.test(line) && URL.canParse(line);
      return `<p>${link ? `<a href="${safe}">${safe}</a>` : safe}</p>`;
    });
  return `<html><body>${paragraphs.join("")}</body></html>`;
}
export async function sendEmail(message: Email) {
  const config = emailConfiguration();
  if (!config) throw new Error("Email delivery is not configured.");
  const brevo = config.provider === "brevo";
  let result: Response;
  try {
    result = await fetch(
      brevo
        ? "https://api.brevo.com/v3/smtp/email"
        : "https://api.resend.com/emails",
      {
        method: "POST",
        signal: AbortSignal.timeout(15_000),
        headers: {
          ...(brevo
            ? { "api-key": config.apiKey }
            : { Authorization: `Bearer ${config.apiKey}` }),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          brevo
            ? {
                sender: config.sender,
                to: [{ email: message.to }],
                subject: message.subject,
                textContent: message.text,
                htmlContent: emailHtml(message.text),
              }
            : { from: config.from, ...message },
        ),
      },
    );
  } catch {
    throw new Error("Email delivery could not reach the provider.");
  }
  if (!result.ok)
    throw new Error(`Email provider rejected the request (${result.status}).`);
}
export function queueEmail(message: Email) {
  // Next keeps this work alive after the generic auth response. Never log links or addresses.
  after(async () => {
    try {
      await sendEmail(message);
    } catch {
      console.error(
        "An authentication email could not be delivered. Check the email provider logs.",
      );
    }
  });
}
