"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Link2, LogOut } from "lucide-react";
import { api, RequestError, SpaceAccess } from "./space-provider";
import {
  ProviderButtons,
  PasswordRecoveryLink,
} from "@/features/auth/provider-buttons";
import { authRequest, authErrorMessage } from "@/features/auth/auth-api";
import { useAuthConfig } from "@/features/auth/use-auth-config";
import {
  credentialsPayload,
  credentialsSchema,
  emptyCredentials,
  birthdayTodayLimit,
  type Credentials,
} from "@/features/auth/credentials";
import { PasswordStrength } from "@/features/auth/password-strength";
import { clearPrivateClientState } from "@/features/settings/client-state";
import type { Account } from "@/shared/types";
import { IphoneAppLink } from "./iphone-app-link";
import "./account.css";

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
    resolver: zodResolver(credentialsSchema(mode)),
    defaultValues: emptyCredentials,
  });
  const [password, confirmPassword, firstName, lastName, email] = useWatch({
    control: form.control,
    name: ["password", "confirmPassword", "firstName", "lastName", "email"],
  });
  const confirmationMismatch = Boolean(
    confirmPassword && password !== confirmPassword,
  );
  const confirmationError = confirmationMismatch
    ? "Passwords don’t match."
    : !confirmPassword
      ? form.formState.errors.confirmPassword?.message
      : undefined;
  async function submit(values: Credentials) {
    setError("");
    if (!config.data || config.data.emailPassword === false) {
      setError("Email sign-in is not available yet.");
      return;
    }
    try {
      await authRequest(
        `/api/auth/${mode}/email`,
        credentialsPayload(mode, values),
      );
      const account = await loadAccount();
      if (account) {
        await client.cancelQueries({ queryKey: ["space"] });
        client.removeQueries({ queryKey: ["space"] });
        client.setQueryData(["account"], account);
      } else if (mode === "sign-up") {
        setVerificationEmail(values.email);
        form.reset({ ...emptyCredentials, email: values.email });
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
      <div
        className={`welcome-layout${mode === "sign-up" && !verificationEmail ? " welcome-layout-signup" : ""}`}
      >
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
                      {config.data.google && (
                        <div className="auth-divider">or</div>
                      )}
                      <form
                        className="stack"
                        onSubmit={form.handleSubmit(submit)}
                        noValidate
                      >
                        {mode === "sign-up" && (
                          <>
                            <div className="auth-name-fields">
                              <div className="field">
                                <label htmlFor="signup-first-name">
                                  First name
                                </label>
                                <input
                                  id="signup-first-name"
                                  required
                                  autoComplete="given-name"
                                  maxLength={60}
                                  readOnly={form.formState.isSubmitting}
                                  aria-invalid={Boolean(
                                    form.formState.errors.firstName,
                                  )}
                                  aria-describedby={
                                    form.formState.errors.firstName
                                      ? "signup-first-name-error"
                                      : undefined
                                  }
                                  {...form.register("firstName")}
                                />
                                {form.formState.errors.firstName && (
                                  <small
                                    className="danger"
                                    id="signup-first-name-error"
                                  >
                                    {form.formState.errors.firstName.message}
                                  </small>
                                )}
                              </div>
                              <div className="field">
                                <label htmlFor="signup-last-name">
                                  Last name
                                </label>
                                <input
                                  id="signup-last-name"
                                  required
                                  autoComplete="family-name"
                                  maxLength={60}
                                  readOnly={form.formState.isSubmitting}
                                  aria-invalid={Boolean(
                                    form.formState.errors.lastName,
                                  )}
                                  aria-describedby={
                                    form.formState.errors.lastName
                                      ? "signup-last-name-error"
                                      : undefined
                                  }
                                  {...form.register("lastName")}
                                />
                                {form.formState.errors.lastName && (
                                  <small
                                    className="danger"
                                    id="signup-last-name-error"
                                  >
                                    {form.formState.errors.lastName.message}
                                  </small>
                                )}
                              </div>
                            </div>
                            <div className="auth-profile-fields">
                              <div className="field">
                                <label htmlFor="signup-birthday">
                                  Birthday
                                </label>
                                <input
                                  id="signup-birthday"
                                  required
                                  type="date"
                                  autoComplete="bday"
                                  max={birthdayTodayLimit()}
                                  readOnly={form.formState.isSubmitting}
                                  aria-invalid={Boolean(
                                    form.formState.errors.birthday,
                                  )}
                                  aria-describedby={
                                    form.formState.errors.birthday
                                      ? "signup-birthday-error"
                                      : undefined
                                  }
                                  {...form.register("birthday")}
                                />
                                {form.formState.errors.birthday && (
                                  <small
                                    className="danger"
                                    id="signup-birthday-error"
                                  >
                                    {form.formState.errors.birthday.message}
                                  </small>
                                )}
                              </div>
                              <div className="field">
                                <label htmlFor="signup-gender">
                                  <span>
                                    Gender{" "}
                                    <span className="auth-optional">
                                      (optional)
                                    </span>
                                  </span>
                                </label>
                                <select
                                  id="signup-gender"
                                  disabled={form.formState.isSubmitting}
                                  {...form.register("gender")}
                                >
                                  <option value="">Select an option</option>
                                  <option value="woman">Woman</option>
                                  <option value="man">Man</option>
                                  <option value="non-binary">Non-binary</option>
                                  <option value="prefer-not-to-say">
                                    Prefer not to say
                                  </option>
                                </select>
                              </div>
                            </div>
                          </>
                        )}
                        <div className="field">
                          <label htmlFor="auth-email">Email</label>
                          <input
                            id="auth-email"
                            required
                            type="email"
                            autoComplete="email"
                            readOnly={form.formState.isSubmitting}
                            aria-invalid={Boolean(form.formState.errors.email)}
                            aria-describedby={
                              form.formState.errors.email
                                ? "auth-email-error"
                                : undefined
                            }
                            {...form.register("email")}
                          />
                          {form.formState.errors.email && (
                            <small className="danger" id="auth-email-error">
                              {form.formState.errors.email.message}
                            </small>
                          )}
                        </div>
                        <div className="field">
                          <label htmlFor="auth-password">Password</label>
                          <input
                            id="auth-password"
                            required
                            type="password"
                            autoComplete={
                              mode === "sign-in"
                                ? "current-password"
                                : "new-password"
                            }
                            maxLength={128}
                            readOnly={form.formState.isSubmitting}
                            aria-invalid={Boolean(
                              form.formState.errors.password,
                            )}
                            aria-describedby={
                              [
                                mode === "sign-up"
                                  ? "signup-password-help"
                                  : "",
                                form.formState.errors.password
                                  ? "auth-password-error"
                                  : "",
                              ]
                                .filter(Boolean)
                                .join(" ") || undefined
                            }
                            {...form.register("password")}
                          />
                          {form.formState.errors.password && (
                            <small className="danger" id="auth-password-error">
                              {form.formState.errors.password.message}
                            </small>
                          )}
                        </div>
                        {mode === "sign-up" && (
                          <>
                            <PasswordStrength
                              password={password}
                              firstName={firstName}
                              lastName={lastName}
                              email={email}
                            />
                            <div className="field">
                              <label htmlFor="signup-confirm-password">
                                Confirm password
                              </label>
                              <input
                                id="signup-confirm-password"
                                required
                                type="password"
                                autoComplete="new-password"
                                maxLength={128}
                                readOnly={form.formState.isSubmitting}
                                aria-invalid={Boolean(confirmationError)}
                                aria-describedby="signup-confirmation-help"
                                {...form.register("confirmPassword")}
                              />
                              <small
                                id="signup-confirmation-help"
                                aria-live="polite"
                                aria-atomic="true"
                                className={
                                  confirmationError
                                    ? "danger"
                                    : "auth-password-match"
                                }
                              >
                                {confirmationError ||
                                  (confirmPassword && "Passwords match.")}
                              </small>
                            </div>
                          </>
                        )}
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
