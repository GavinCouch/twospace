"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AccountGate, Brand, type SignInMode } from "@/components/account-gate";

export function AuthPage({ mode }: { mode: SignInMode }) {
  return <AccountGate signInMode={mode} signedInContent={<OpenJournal />} />;
}

function OpenJournal() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/journal");
  }, [router]);
  return (
    <main className="account-loading" aria-label="Opening your space">
      <Brand />
      <p role="status">Opening your space…</p>
    </main>
  );
}
