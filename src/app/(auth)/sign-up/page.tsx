import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthPage } from "@/features/auth/auth-page";
import { hasWebSession } from "@/server/web-session";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  if (await hasWebSession(await headers())) redirect("/journal");
  return <AuthPage mode="sign-up" />;
}
