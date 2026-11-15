"use client";

import { useState } from "react";
import Link from "next/link";
import { beginSocialSignIn, authErrorMessage, type SocialProvider } from "./auth-api";
import { useAuthConfig } from "./use-auth-config";
import "./provider-buttons.css";

export function ProviderButtons({ disabled = false, onRedirect = url => window.location.assign(url) }: { disabled?: boolean; onRedirect?: (url: string) => void }) {
  const config = useAuthConfig();
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [error, setError] = useState("");
  async function signIn(provider: SocialProvider) {
    setPending(provider); setError("");
    try { onRedirect(await beginSocialSignIn(provider)); }
    catch (cause) { setError(authErrorMessage(cause)); }
    finally { setPending(null); }
  }
  if (config.isPending) return null;
  if (config.error) return <div className="auth-provider-status"><p role="alert">Other sign-in options could not load.</p><button type="button" onClick={() => void config.refetch()}>Try again</button></div>;
  if (!config.data.google) return null;
  return <div className="auth-providers">
    <button type="button" className="auth-provider-button" disabled={disabled || pending !== null} onClick={() => void signIn("google")}>
      <span>{pending ? "Opening…" : "Continue with Google"}</span>
    </button>
    {error && <p className="auth-provider-error" role="alert">{error}</p>}
  </div>;
}

export function PasswordRecoveryLink() {
  const config = useAuthConfig();
  if (!config.data) return null;
  if (!config.data.passwordReset) return <span className="auth-recovery-unavailable">Password reset is unavailable.</span>;
  return <Link className="auth-recovery-link" href="/forgot-password">Forgot password?</Link>;
}
