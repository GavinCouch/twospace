import { after } from "next/server";

type Email = { to: string; subject: string; text: string };
export async function sendEmail(message: Email) {
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM)
    throw new Error("Email delivery is not configured.");
  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, ...message }),
  });
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
