"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpen,
  Shapes,
  CalendarDays,
  Settings,
  LogOut,
  ChevronDown,
  Copy,
  Check,
  Sun,
  Moon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brand } from "./account-gate";
import { api, useSpace } from "./space-provider";
import "./shell.css";

const navigation = [
  { href: "/journal", name: "Journal", icon: BookOpen },
  { href: "/activities", name: "Activities", icon: Shapes },
  { href: "/plans", name: "Plans", icon: CalendarDays },
];
export function AppShell({ children }: { children: ReactNode }) {
  const { data, isPending, error, refetch } = useSpace();
  const path = usePathname();
  const client = useQueryClient();
  const [clock, setClock] = useState<Date | null>(null);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    setClock(new Date());
    const timer = setInterval(() => setClock(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  async function switchProfile(userId: string) {
    setSwitching(true);
    setNotice("");
    try {
      await api("/api/demo/switch", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await client.cancelQueries();
      client.clear();
      window.location.reload();
    } catch (cause) {
      setNotice(
        cause instanceof Error ? cause.message : "Couldn’t switch profiles.",
      );
      setSwitching(false);
    }
  }
  async function signOut() {
    try {
      await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      await client.cancelQueries();
      client.clear();
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
              <item.icon size={18} />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="account-controls">
          {data?.space.isDemo && (
            <label className="demo-switch">
              <span>Demo</span>
              <select
                aria-label="View sample space as"
                value={data.me.id}
                disabled={switching}
                onChange={(e) => switchProfile(e.target.value)}
              >
                {data.members.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={13} />
            </label>
          )}
          <Link href="/settings" className="header-icon" aria-label="Settings">
            <Settings size={20} />
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
            <Image
              src="/brand/cover.png"
              fill
              sizes="(max-width: 760px) 100vw, 1200px"
              priority
              alt=""
              className="space-cover-art"
            />
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
              <h1>{data.space.name}</h1>
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
            <item.icon size={21} />
            {item.name}
          </Link>
        ))}
        <Link
          className={path === "/settings" ? "nav-link active" : "nav-link"}
          href="/settings"
        >
          <Settings size={21} />
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
