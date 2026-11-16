import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthPage } from "@/features/auth/auth-page";
import { hasWebSession } from "@/server/web-session";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  if (await hasWebSession(await headers())) redirect("/journal");
  return <AuthPage mode="sign-in" />;
}
