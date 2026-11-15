"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AuthFrame, RecoveryUnavailable, SignInLink } from "./auth-frame";
import { authRequest, authErrorMessage, isResetUnavailable } from "./auth-api";
import { useAuthConfig } from "./use-auth-config";

const schema = z.object({ email: z.string().trim().pipe(z.email("Enter a valid email address.")) });
type Values = z.infer<typeof schema>;

export default function ForgotPassword() {
  const config = useAuthConfig();
  const [sent, setSent] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: "" } });
  async function submit(values: Values) {
    setError("");
    try {
      await authRequest("/api/auth/request-password-reset", { email: values.email, redirectTo: `${window.location.origin}/reset-password` });
      setSent(true);
    } catch (cause) {
      if (isResetUnavailable(cause)) setUnavailable(true);
      else setError(authErrorMessage(cause));
    }
  }
  return <AuthFrame title={sent ? "Check your email" : "Reset password"}>
    {unavailable || config.data?.passwordReset === false ? <RecoveryUnavailable /> : config.isPending ? <p className="auth-status" role="status">Loading password reset…</p> : config.error ? <div className="auth-state"><p className="auth-error" role="alert">Password reset could not load.</p><button type="button" className="auth-secondary" onClick={() => void config.refetch()}>Try again</button><SignInLink /></div> : sent ? <div className="auth-state"><p role="status">If an account uses that email address, you will receive a password reset link.</p><p className="auth-hint">Check your spam folder if it does not arrive.</p><button className="auth-text-button" type="button" onClick={() => setSent(false)}>Use a different email</button><SignInLink /></div> : <>
      <form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
        <label className="auth-field" htmlFor="reset-email">Email address</label>
        <input id="reset-email" type="email" autoComplete="email" autoFocus {...register("email")} aria-invalid={!!errors.email} aria-describedby={errors.email ? "reset-email-error" : undefined} />
        {errors.email && <p id="reset-email-error" className="auth-field-error" role="alert">{errors.email.message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-primary" disabled={isSubmitting}>{isSubmitting ? "Sending…" : "Send reset link"}</button>
      </form><SignInLink />
    </>}
  </AuthFrame>;
}
