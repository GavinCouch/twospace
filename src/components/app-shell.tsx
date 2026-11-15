"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Copy, Check, Sun, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateClientState } from "@/features/settings/client-state";
import { Brand } from "./account-gate";
import { api, useSpace } from "./space-provider";
import "./shell.css";
import { SectionArt } from "./section-art";

const navigation = [
  { href: "/journal", name: "Journal", art: "journal" },
  { href: "/activities", name: "Activities", art: "activities" },
  { href: "/plans", name: "Plans", art: "plans" },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const { data, isPending, error, refetch } = useSpace();
  const path = usePathname();
  const client = useQueryClient();
  const [clock, setClock] = useState<Date | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  async function signOut() {
    try {
      await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      await clearPrivateClientState(client);
      window.location.assign("/");
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Couldn’t sign out.");
    }
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <Link
          href="/journal"
          className="brand-link"
          aria-label="TwoSpace journal"
        >
          <Brand />
        </Link>
        <nav className="primary-navigation" aria-label="Main navigation">
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={
                path.startsWith(item.href) ? "nav-link active" : "nav-link"
              }
              aria-current={path.startsWith(item.href) ? "page" : undefined}
            >
              <SectionArt name={item.art} size={30} />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="account-controls">
          <Link href="/settings" className="header-icon" aria-label="Settings">
            <SectionArt name="settings" size={28} />
          </Link>
          <button
            className="header-icon signout-icon"
            onClick={signOut}
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </header>
      <div className="app-body">
        {data && path === "/journal" && (
          <section className="space-cover" aria-label="Your shared space">
            <div className="space-cover-content">
              <span className="cover-date">
                {clock
                  ? new Intl.DateTimeFormat("en", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      timeZone: data.me.timeZone,
                    }).format(clock)
                  : ""}
              </span>
              <h2>{data.space.name}</h2>
              <div className="partner-clocks">
                {data.members.map((person) => {
                  const hour = clock
                    ? Number(
                        new Intl.DateTimeFormat("en", {
                          hour: "numeric",
                          hourCycle: "h23",
                          timeZone: person.timeZone,
                        }).format(clock),
                      )
                    : 12;
                  const ClockIcon = hour >= 7 && hour < 19 ? Sun : Moon;
                  return (
                    <div className="partner-clock" key={person.id}>
                      <ClockIcon size={15} />
                      <span>
                        <strong>
                          {clock
                            ? new Intl.DateTimeFormat("en", {
                                hour: "numeric",
                                minute: "2-digit",
                                timeZone: person.timeZone,
                              }).format(clock)
                            : "—"}
                        </strong>
                        <small>
                          {person.name} ·{" "}
                          {person.timeZone
                            .split("/")
                            .at(-1)
                            ?.replaceAll("_", " ")}
                        </small>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        <main id="main-content" className="main-content">
          {notice && (
            <p className="form-error" role="alert">
              {notice}
            </p>
          )}
          {isPending ? (
            <div
              className="panel"
              role="status"
              aria-label="Loading your space"
            >
              <div className="loading-line" />
              <div className="loading-line" />
              <div className="loading-line" />
            </div>
          ) : error ? (
            <div className="empty">
              <p role="alert">{error.message}</p>
              <button className="button" onClick={() => refetch()}>
                Try again
              </button>
            </div>
          ) : (
            <>
              {data?.members.length === 1 && <InviteBanner />}
              {children}
            </>
          )}
        </main>
      </div>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={
              path.startsWith(item.href) ? "nav-link active" : "nav-link"
            }
            aria-current={path.startsWith(item.href) ? "page" : undefined}
          >
            <SectionArt name={item.art} size={30} />
            {item.name}
          </Link>
        ))}
        <Link
          className={path === "/settings" ? "nav-link active" : "nav-link"}
          href="/settings"
        >
          <SectionArt name="settings" size={30} />
          Settings
        </Link>
      </nav>
    </div>
  );
}
function InviteBanner() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  async function invite() {
    setPending(true);
    setError("");
    try {
      const result = await api<{ token: string }>("/api/invites", {
        method: "POST",
        body: "{}",
      });
      setCode(result.token);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="invite-banner">
      <div>
        <strong>Invite your partner</strong>
        {code && <code>{code}</code>}
        {error && <p role="alert">{error}</p>}
      </div>
      {code ? (
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied(true);
            } catch {
              setError("Copy the code above and send it to your partner.");
            }
          }}
        >
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy code"}
        </button>
      ) : (
        <button className="secondary" disabled={pending} onClick={invite}>
          {pending ? "Creating…" : "Create invitation"}
        </button>
      )}
    </section>
  );
}
