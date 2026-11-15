"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { AuthFrame, RecoveryUnavailable, SignInLink } from "./auth-frame";
import { authRequest, authErrorMessage, isInvalidResetToken, isResetUnavailable } from "./auth-api";
import { useAuthConfig } from "./use-auth-config";

const schema = z.object({
  newPassword: z.string().min(10, "Use at least 10 characters.").max(128, "Use no more than 128 characters."),
  confirmation: z.string().min(1, "Enter your password again."),
}).refine(values => values.newPassword === values.confirmation, { path: ["confirmation"], message: "The passwords do not match." });
type Values = z.infer<typeof schema>;

export default function ResetPassword({ token, errorCode }: { token?: string; errorCode?: string }) {
  const config = useAuthConfig();
  const client = useQueryClient();
  const [state, setState] = useState<"form" | "invalid" | "success" | "unavailable">(!token?.trim() || errorCode ? "invalid" : "form");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { newPassword: "", confirmation: "" } });
  async function submit(values: Values) {
    if (!token || !config.data?.passwordReset) return;
    setError("");
    try {
      await authRequest("/api/auth/reset-password", { newPassword: values.newPassword, token });
      reset();
      client.removeQueries({ queryKey: ["account"] });
      client.removeQueries({ queryKey: ["space"] });
      setState("success");
    } catch (cause) {
      if (isInvalidResetToken(cause)) { reset(); setState("invalid"); }
      else if (isResetUnavailable(cause)) { reset(); setState("unavailable"); }
      else setError(authErrorMessage(cause));
    }
  }
  const title = state === "success" ? "Password updated" : state === "invalid" ? "Reset link unavailable" : "Choose a new password";
  return <AuthFrame title={title}>
    {state === "success" ? <div className="auth-state"><p role="status">Your password has been updated.</p><Link className="auth-primary" href="/journal">Sign in</Link></div> : state === "unavailable" || config.data?.passwordReset === false ? <RecoveryUnavailable /> : state === "invalid" ? <div className="auth-state"><p role="alert">This reset link is invalid or has expired.</p><Link className="auth-secondary" href="/forgot-password">Request a new link</Link><SignInLink /></div> : config.isPending ? <p className="auth-status" role="status">Loading password reset…</p> : config.error ? <div className="auth-state"><p className="auth-error" role="alert">Password reset could not load.</p><button type="button" className="auth-secondary" onClick={() => void config.refetch()}>Try again</button><SignInLink /></div> : <>
      <form className="auth-form" noValidate onSubmit={handleSubmit(submit)}>
        <label className="auth-field" htmlFor="new-password">New password</label>
        <div className="auth-password-input"><input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" autoFocus {...register("newPassword")} aria-invalid={!!errors.newPassword} aria-describedby={`password-length${errors.newPassword ? " new-password-error" : ""}`} /><button className="auth-password-toggle" type="button" aria-label={showPassword ? "Hide new password" : "Show new password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>
        <p id="password-length" className="auth-hint">10–128 characters.</p>
        {errors.newPassword && <p id="new-password-error" className="auth-field-error" role="alert">{errors.newPassword.message}</p>}
        <label className="auth-field" htmlFor="confirm-password">Confirm new password</label>
        <div className="auth-password-input"><input id="confirm-password" type={showConfirmation ? "text" : "password"} autoComplete="new-password" {...register("confirmation")} aria-invalid={!!errors.confirmation} aria-describedby={errors.confirmation ? "confirm-password-error" : undefined} /><button className="auth-password-toggle" type="button" aria-label={showConfirmation ? "Hide confirmation" : "Show confirmation"} aria-pressed={showConfirmation} onClick={() => setShowConfirmation(!showConfirmation)}>{showConfirmation ? <EyeOff size={19} aria-hidden="true" /> : <Eye size={19} aria-hidden="true" />}</button></div>
        {errors.confirmation && <p id="confirm-password-error" className="auth-field-error" role="alert">{errors.confirmation.message}</p>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        <button className="auth-primary" disabled={isSubmitting}>{isSubmitting ? "Updating…" : "Update password"}</button>
      </form><SignInLink />
    </>}
  </AuthFrame>;
}
