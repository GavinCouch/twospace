import type { Metadata } from "next";
import ResetPassword from "@/features/auth/reset-password";

export const metadata: Metadata = {
  title: "New password",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : undefined;
  const errorCode = typeof params.error === "string" ? params.error : undefined;
  return <ResetPassword key={token || errorCode || "missing-token"} token={token} errorCode={errorCode} />;
}
