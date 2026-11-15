"use client";

import { useId, type ReactNode } from "react";
import Link from "next/link";
import { Brand } from "@/components/account-gate";
import "./auth-pages.css";

export function AuthFrame({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return <main className="auth-page">
    <header className="auth-page-header"><Link href="/journal" aria-label="TwoSpace sign in"><Brand /></Link></header>
    <section className="auth-card" aria-labelledby={headingId}><h1 id={headingId}>{title}</h1>{children}</section>
  </main>;
}

export function SignInLink() {
  return <Link className="auth-back-link" href="/journal">Back to sign in</Link>;
}

export function RecoveryUnavailable() {
  return <div className="auth-state"><p role="status">Password reset is unavailable right now.</p><SignInLink /></div>;
}
