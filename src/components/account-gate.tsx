"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowRight, Link2, LogOut } from "lucide-react";
import { api, RequestError, SpaceAccess } from "./space-provider";
import {
  ProviderButtons,
  PasswordRecoveryLink,
} from "@/features/auth/provider-buttons";
import { authRequest, authErrorMessage } from "@/features/auth/auth-api";
import { useAuthConfig } from "@/features/auth/use-auth-config";
import { clearPrivateClientState } from "@/features/settings/client-state";
import type { Account } from "@/shared/types";
import { IphoneAppLink } from "./iphone-app-link";
import "./account.css";

const credentials = z.object({
  name: z.string().max(60),
  email: z.email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});
type Credentials = z.infer<typeof credentials>;
async function loadAccount() {
  try {
    return await api<Account>("/api/account");
  } catch (error) {
    if (error instanceof RequestError && error.status === 401) return null;
    throw error;
  }
}
export type SignInMode = "sign-in" | "sign-up";
export function AccountGate({
  children,
  signInMode = "sign-in",
  signedInContent,
}: {
  children?: ReactNode;
  signInMode?: SignInMode;
  signedInContent?: ReactNode;
}) {
  const account = useQuery({ queryKey: ["account"], queryFn: loadAccount });
  if (account.isPending)
    return (
      <main className="account-loading" aria-label="Loading your space">
        <Brand />
        <div className="loading-line" />
      </main>
    );
  if (account.error)
    return (
      <main className="account-loading">
        <Brand />
        <p role="alert">{account.error.message}</p>
        <button className="button" onClick={() => account.refetch()}>
          Try again
        </button>
      </main>
    );
  if (!account.data)
    return <SignIn key={signInMode} initialMode={signInMode} />;
  if (signedInContent !== undefined) return <>{signedInContent}</>;
  if (!account.data.spaceId) return <Pairing account={account.data} />;
  return <SpaceAccess enabled>{children}</SpaceAccess>;
}
export function Brand() {
  return (
    <span className="brand">
      <Image
        src="/brand/logo-dark.png"
        width={44}
        height={44}
        sizes="44px"
        alt=""
        priority
      />
      <span>TwoSpace</span>
    </span>
  );
}
function SignIn({ initialMode = "sign-in" }: { initialMode?: SignInMode }) {
  const [mode, setMode] = useState<SignInMode>(initialMode);
  const [error, setError] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const config = useAuthConfig();
  const client = useQueryClient();
  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { name: "", email: "", password: "" },
  });
  async function submit(values: Credentials) {
    setError("");
    if (!config.data || config.data.emailPassword === false) {
      setError("Email sign-in is not available yet.");
      return;
    }
    if (mode === "sign-up" && !values.name.trim()) {
      form.setError("name", { message: "What should we call you?" });
      return;
    }
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
    } catch (cause) {
      setError(authErrorMessage(cause));
    }
  }
  return (
    <main className="welcome">
      <header>
        <Link href="/" aria-label="TwoSpace home">
          <Brand />
        </Link>
        <IphoneAppLink />
      </header>
      <div className="welcome-layout">
        <section className="welcome-form">
          <h1>
            {verificationEmail
              ? "Check your email"
              : mode === "sign-in"
                ? "Sign in"
                : "Create account"}
          </h1>
          {config.isPending && <p role="status">Loading sign-in options…</p>}
          {config.error && (
            <div className="stack">
              <p className="form-error" role="alert">
                {config.error.message}
              </p>
              <button
                className="secondary"
                onClick={() => void config.refetch()}
                disabled={config.isFetching}
              >
                Try again
              </button>
            </div>
          )}
          {config.data && !config.error && (
            <>
              {verificationEmail ? (
                <div className="stack">
                  <p role="status">Check your email to finish signing up.</p>
                  <p className="muted">
                    Open the verification link sent to {verificationEmail}.
                  </p>
                  <button
                    className="secondary"
                    onClick={() => {
                      setVerificationEmail("");
                      setMode("sign-in");
                      setError("");
                    }}
                  >
                    Back to sign in
                  </button>
                </div>
              ) : (
                <>
                  <ProviderButtons disabled={form.formState.isSubmitting} />
                  {config.data.emailPassword === false ? (
                    <p className="muted">Email sign-in is not available yet.</p>
                  ) : (
                    <>
                      <form
                        className="stack"
                        onSubmit={form.handleSubmit(submit)}
                      >
                        {mode === "sign-up" && (
                          <label className="field">
                            Your name
                            <input
                              autoComplete="given-name"
                              {...form.register("name")}
                            />
                            {form.formState.errors.name && (
                              <small className="danger">
                                {form.formState.errors.name.message}
                              </small>
                            )}
                          </label>
                        )}
                        <label className="field">
                          Email
                          <input
                            type="email"
                            autoComplete="email"
                            {...form.register("email")}
                          />
                          {form.formState.errors.email && (
                            <small className="danger">
                              {form.formState.errors.email.message}
                            </small>
                          )}
                        </label>
                        <label className="field">
                          Password
                          <input
                            type="password"
                            autoComplete={
                              mode === "sign-in"
                                ? "current-password"
                                : "new-password"
                            }
                            {...form.register("password")}
                          />
                          {form.formState.errors.password && (
                            <small className="danger">
                              {form.formState.errors.password.message}
                            </small>
                          )}
                        </label>
                        {mode === "sign-in" && <PasswordRecoveryLink />}
                        {mode === "sign-up" &&
                          config.data.emailVerification && (
                            <p className="muted small">
                              You’ll need to verify your email.
                            </p>
                          )}
                        <button
                          className="button"
                          disabled={form.formState.isSubmitting}
                        >
                          {form.formState.isSubmitting
                            ? "Opening…"
                            : mode === "sign-in"
                              ? "Sign in"
                              : "Create account"}
                          <ArrowRight size={17} />
                        </button>
                      </form>
                      <button
                        className="quiet auth-toggle"
                        disabled={form.formState.isSubmitting}
                        onClick={() => {
                          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                          setError("");
                          form.clearErrors();
                        }}
                      >
                        {mode === "sign-in"
                          ? "Create an account"
                          : "I already have an account"}
                      </button>
                    </>
                  )}
                </>
              )}
            </>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
export function Pairing({
  account,
  onNavigate = (path) => window.location.assign(path),
}: {
  account: Account;
  onNavigate?: (path: string) => void;
}) {
  const client = useQueryClient();
  const [name, setName] = useState("Our space");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<"pairing" | "signout" | null>(null);
  async function act(path: string, body: unknown) {
    if (pending) return;
    setPending("pairing");
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await client.invalidateQueries({ queryKey: ["account"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setPending(null);
    }
  }
  async function signOut() {
    if (pending) return;
    setPending("signout");
    setError("");
    try {
      await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      await clearPrivateClientState(client);
      onNavigate("/");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t sign out.");
      setPending(null);
    }
  }
  return (
    <main className="pairing-page">
      <header className="pairing-header">
        <Brand />
        <button
          type="button"
          className="quiet"
          onClick={() => void signOut()}
          disabled={pending !== null}
        >
          <LogOut size={16} aria-hidden="true" />
          {pending === "signout" ? "Signing out…" : "Sign out"}
        </button>
      </header>
      <section className="panel stack">
        <h1>Hi, {account.name}.</h1>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("/api/spaces", { name });
          }}
        >
          <label className="field">
            Name your shared space
            <input
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <button className="button" disabled={pending !== null}>
            Create a space
          </button>
        </form>
        <div className="pairing-divider">or join your partner</div>
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            void act("/api/invites/accept", { token: token.trim() });
          }}
        >
          <label className="field">
            Invitation code
            <input
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <button className="secondary" disabled={pending !== null}>
            <Link2 size={16} />
            Join their space
          </button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </main>
  );
}
