"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { clearPrivateClientState } from "@/features/settings/client-state";
import { Brand } from "./account-gate";
import { api, useSpace } from "./space-provider";
import "./shell.css";
import { SectionArt } from "./section-art";
import { SpaceNavigation } from "./space-navigation";
import { SpaceClock } from "./space-clock";
import { PartnerSetup } from "./partner-setup";
import { partnerTimeOffset } from "@/shared/time";

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
        <SpaceNavigation
          path={path}
          locked={!data || data.members.length < 2}
        />
        <div className="account-controls">
          <Link
            href="/settings"
            className={`header-icon${path === "/settings" ? " active" : ""}`}
            aria-label="Settings"
            aria-current={path === "/settings" ? "page" : undefined}
          >
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
        {data && data.members.length === 2 && path === "/journal" && (
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
                {data.members.map((person) => (
                  <SpaceClock key={person.id} person={person} />
                ))}
                {(() => {
                  const partner = data.members.find((m) => m.id !== data.me.id);
                  const offset =
                    clock && partner
                      ? partnerTimeOffset(
                          data.me.timeZone,
                          partner.timeZone,
                          clock,
                        )
                      : null;
                  return offset ? (
                    <span
                      className="partner-clock-offset"
                      aria-label={`Time difference: ${offset}`}
                    >
                      {offset}
                    </span>
                  ) : null;
                })()}
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
          ) : data && data.members.length < 2 && path !== "/settings" ? (
            <PartnerSetup key={data.space.id} space={data} />
          ) : (
            children
          )}
        </main>
      </div>
      <SpaceNavigation
        path={path}
        mobile
        locked={!data || data.members.length < 2}
      />
    </div>
  );
}
