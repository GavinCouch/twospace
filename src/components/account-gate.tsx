"use client";
import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Link2, NotebookPen, CalendarDays, Shapes } from "lucide-react";
import { api, RequestError, SpaceAccess } from "./space-provider";
import { ProviderButtons, PasswordRecoveryLink } from "@/features/auth/provider-buttons";
import { authRequest, authErrorMessage } from "@/features/auth/auth-api";
import { useAuthConfig } from "@/features/auth/use-auth-config";
import type { Account } from "@/shared/types";
import "./account.css";

const credentials = z.object({ name: z.string().max(60), email: z.email("Enter a valid email address."), password: z.string().min(10, "Use at least 10 characters.").max(128) });
type Credentials = z.infer<typeof credentials>;
async function loadAccount() {
  try { return await api<Account>("/api/account"); }
  catch (error) { if (error instanceof RequestError && error.status === 401) return null; throw error; }
}
export function AccountGate({ children }: { children: ReactNode }) {
  const account = useQuery({ queryKey: ["account"], queryFn: loadAccount });
  if (account.isPending) return <main className="account-loading" aria-label="Loading your space"><Brand /><div className="loading-line" /></main>;
  if (account.error) return <main className="account-loading"><Brand /><p role="alert">{account.error.message}</p><button className="button" onClick={() => account.refetch()}>Try again</button></main>;
  if (!account.data) return <SignIn />;
  if (!account.data.spaceId) return <Pairing account={account.data} />;
  return <SpaceAccess enabled>{children}</SpaceAccess>;
}
export function Brand() {
  return <span className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /></span>TwoSpace</span>;
}
function SignIn() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [demoPending, setDemoPending] = useState(false);
  const config = useAuthConfig();
  const client = useQueryClient();
  const form = useForm<Credentials>({ resolver: zodResolver(credentials), defaultValues: { name: "", email: "", password: "" } });
  async function submit(values: Credentials) {
    setError("");
    if (!config.data || config.data.emailPassword === false) { setError("Email sign-in is not available yet."); return; }
    if (mode === "sign-up" && !values.name.trim()) { form.setError("name", { message: "What should we call you?" }); return; }
    try {
      await authRequest(`/api/auth/${mode}/email`, values);
      const account = await loadAccount();
      if (account) {
        await client.cancelQueries({ queryKey: ["space"] });
        client.removeQueries({ queryKey: ["space"] });
        client.setQueryData(["account"], account);
      } else if (mode === "sign-up") {
        setVerificationEmail(values.email);
        form.reset({ name: "", email: values.email, password: "" });
      } else {
        setError("Sign-in did not complete. Please try again.");
      }
    } catch (cause) { setError(authErrorMessage(cause)); }
  }
  async function demo() {
    setDemoPending(true); setError("");
    try { await api("/api/demo", { method: "POST", body: "{}" }); client.removeQueries({ queryKey: ["space"] }); await client.invalidateQueries({ queryKey: ["account"] }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The sample space couldn’t open."); }
    finally { setDemoPending(false); }
  }
  return <main className="welcome"><header><Brand /></header><div className="welcome-layout"><section className="welcome-form"><h1>{verificationEmail ? "Check your email" : mode === "sign-in" ? "Your space" : "Create your account"}</h1>
    {config.isPending && <p role="status">Loading sign-in options…</p>}
    {config.error && <div className="stack"><p className="form-error" role="alert">{config.error.message}</p><button className="secondary" onClick={() => void config.refetch()} disabled={config.isFetching}>Try again</button></div>}
    {config.data && !config.error && <>
    {verificationEmail ? <div className="stack"><p role="status">Check your email to finish signing up.</p><p className="muted">Open the verification link sent to {verificationEmail}.</p><button className="secondary" onClick={() => { setVerificationEmail(""); setMode("sign-in"); setError(""); }}>Back to sign in</button></div> : <>
    <ProviderButtons disabled={form.formState.isSubmitting || demoPending} />
    {config.data.emailPassword === false ? <p className="muted">Email sign-in is not available yet.</p> : <><form className="stack" onSubmit={form.handleSubmit(submit)}>
    {mode === "sign-up" && <label className="field">Your name<input autoComplete="given-name" {...form.register("name")} />{form.formState.errors.name && <small className="danger">{form.formState.errors.name.message}</small>}</label>}
    <label className="field">Email<input type="email" autoComplete="email" {...form.register("email")} />{form.formState.errors.email && <small className="danger">{form.formState.errors.email.message}</small>}</label>
    <label className="field">Password<input type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} {...form.register("password")} />{form.formState.errors.password && <small className="danger">{form.formState.errors.password.message}</small>}</label>
    {mode === "sign-in" && <PasswordRecoveryLink />}
    {mode === "sign-up" && config.data.emailVerification && <p className="muted small">You’ll need to verify your email.</p>}
    <button className="button" disabled={form.formState.isSubmitting || demoPending}>{form.formState.isSubmitting ? "Opening…" : mode === "sign-in" ? "Sign in" : "Create account"}<ArrowRight size={17} /></button>
  </form><button className="quiet auth-toggle" disabled={form.formState.isSubmitting || demoPending} onClick={() => { setMode(mode === "sign-in" ? "sign-up" : "sign-in"); setError(""); form.clearErrors(); }}>{mode === "sign-in" ? "Create an account" : "I already have an account"}</button></>}
    </>}
    </>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="demo-entry"><p>Want to look around first?</p><button className="secondary" disabled={demoPending || form.formState.isSubmitting} onClick={demo}>{demoPending ? "Preparing your sample space…" : "Try a sample space"}<ArrowRight size={16} /></button><small>Two sample profiles. Your own copy to explore.</small></div></section><section className="welcome-preview" aria-label="What you can share"><div className="preview-note"><span className="preview-paperclip" aria-hidden="true" /><NotebookPen size={24} /><p>Same recipe.<br />Very different results.</p><span>Jamie · Sunday</span></div><div className="preview-drawing" aria-hidden="true"><svg viewBox="0 0 260 200"><path d="M50 150 C45 80 110 80 115 120 C135 40 220 60 200 125 C175 170 140 175 120 180 Z" fill="none" stroke="#245c55" strokeWidth="5" strokeLinecap="round"/><path d="M58 56 l12 -12 M111 28 l2 -16 M203 40 l10 9" stroke="#d78069" strokeWidth="4" strokeLinecap="round"/></svg><span>Your turn to add something</span></div><div className="preview-plan"><CalendarDays size={22}/><div><strong>Cook together</strong><span>Saturday, 1 pm · 7 pm</span></div></div><div className="preview-labels"><span><NotebookPen size={17}/>Journal</span><span><Shapes size={17}/>Activities</span><span><CalendarDays size={17}/>Plans</span></div></section></div></main>;
}
function Pairing({ account }: { account: Account }) {
  const client = useQueryClient();
  const [name, setName] = useState("Our space");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function act(path: string, body: unknown) {
    setPending(true); setError("");
    try { await api(path, { method: "POST", body: JSON.stringify(body) }); await client.invalidateQueries({ queryKey: ["account"] }); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setPending(false); }
  }
  return <main className="pairing-page"><Brand /><section className="panel stack"><h1>Hi, {account.name}.</h1><form className="stack" onSubmit={e => { e.preventDefault(); void act("/api/spaces", { name }); }}><label className="field">Name your shared space<input maxLength={80} value={name} onChange={e => setName(e.target.value)} required /></label><button className="button" disabled={pending}>Create a space</button></form><div className="pairing-divider">or join your partner</div><form className="stack" onSubmit={e => { e.preventDefault(); void act("/api/invites/accept", { token: token.trim() }); }}><label className="field">Invitation code<input value={token} onChange={e => setToken(e.target.value)} autoComplete="off" required /></label><button className="secondary" disabled={pending}><Link2 size={16}/>Join their space</button></form>{error && <p className="form-error" role="alert">{error}</p>}</section></main>;
}
