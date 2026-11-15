"use client";
import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowRight,
  Link2,
  NotebookPen,
  CalendarDays,
  Shapes,
} from "lucide-react";
import { api, RequestError, SpaceAccess } from "./space-provider";
import type { Account } from "@/shared/types";
import "./account.css";

const credentials = z.object({
  name: z.string().max(60),
  email: z.email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters.").max(128),
});
type Credentials = z.infer<typeof credentials>;
export function AccountGate({ children }: { children: ReactNode }) {
  const account = useQuery({
    queryKey: ["account"],
    queryFn: async () => {
      try {
        return await api<Account>("/api/account");
      } catch (error) {
        if (error instanceof RequestError && error.status === 401) return null;
        throw error;
      }
    },
  });
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
  if (!account.data) return <SignIn />;
  if (!account.data.spaceId) return <Pairing account={account.data} />;
  return <SpaceAccess enabled>{children}</SpaceAccess>;
}
export function Brand() {
  return (
    <span className="brand">
      <Image
        src="/brand/logo.png"
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
function SignIn() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [demoPending, setDemoPending] = useState(false);
  const client = useQueryClient();
  const form = useForm<Credentials>({
    resolver: zodResolver(credentials),
    defaultValues: { name: "", email: "", password: "" },
  });
  async function submit(values: Credentials) {
    setError("");
    if (mode === "sign-up" && !values.name.trim()) {
      form.setError("name", { message: "What should we call you?" });
      return;
    }
    try {
      await api(`/api/auth/${mode}/email`, {
        method: "POST",
        body: JSON.stringify(values),
      });
      await client.invalidateQueries({ queryKey: ["account"] });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Sign-in failed. Please try again.",
      );
    }
  }
  async function demo() {
    setDemoPending(true);
    setError("");
    try {
      await api("/api/demo", { method: "POST", body: "{}" });
      client.removeQueries({ queryKey: ["space"] });
      await client.invalidateQueries({ queryKey: ["account"] });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The sample space couldn’t open.",
      );
    } finally {
      setDemoPending(false);
    }
  }
  return (
    <main className="welcome">
      <header>
        <Brand />
      </header>
      <div className="welcome-layout">
        <section className="welcome-form">
          <h1>{mode === "sign-in" ? "Sign in" : "Create account"}</h1>
          <form className="stack" onSubmit={form.handleSubmit(submit)}>
            {mode === "sign-up" && (
              <label className="field">
                Your name
                <input autoComplete="given-name" {...form.register("name")} />
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
                  mode === "sign-in" ? "current-password" : "new-password"
                }
                {...form.register("password")}
              />
              {form.formState.errors.password && (
                <small className="danger">
                  {form.formState.errors.password.message}
                </small>
              )}
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="button"
              disabled={form.formState.isSubmitting || demoPending}
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
          <div className="demo-entry">
            <p>Try it first</p>
            <button
              className="secondary"
              disabled={demoPending || form.formState.isSubmitting}
              onClick={demo}
            >
              {demoPending
                ? "Preparing your sample space…"
                : "Try a sample space"}
              <ArrowRight size={16} />
            </button>
            <small>Private demo · no account needed</small>
          </div>
        </section>
        <section className="welcome-preview" aria-label="TwoSpace illustration">
          <Image
            src="/brand/cover.png"
            fill
            priority
            sizes="(max-width:760px) 100vw, 680px"
            alt="Two separate rooms, one in daylight and one at night"
          />
        </section>
      </div>
    </main>
  );
}
function Pairing({ account }: { account: Account }) {
  const client = useQueryClient();
  const [name, setName] = useState("Our space");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function act(path: string, body: unknown) {
    setPending(true);
    setError("");
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      await client.invalidateQueries({ queryKey: ["account"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main className="pairing-page">
      <Brand />
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
          <button className="button" disabled={pending}>
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
          <button className="secondary" disabled={pending}>
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
