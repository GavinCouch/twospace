"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, ArrowRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { SpaceSnapshot } from "@/shared/types";
import { api } from "./space-provider";
import "./partner-setup.css";

export function PartnerSetup({
  space,
  onJoined = () => window.location.assign("/journal"),
}: {
  space: SpaceSnapshot;
  onJoined?: () => void;
}) {
  const client = useQueryClient();
  const [invitation, setInvitation] = useState<{
    token: string;
    expiresAt: string;
  }>();
  const [token, setToken] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<"invite" | "join" | null>(null);
  const [error, setError] = useState("");

  async function createInvitation() {
    if (busy) return;
    setBusy("invite");
    setError("");
    try {
      setInvitation(await api("/api/invites", { method: "POST", body: "{}" }));
      setCopied(false);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t create an invitation.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function join() {
    if (busy || !confirmed || !token.trim()) return;
    setBusy("join");
    setError("");
    try {
      await api("/api/invites/accept", {
        method: "POST",
        body: JSON.stringify({ token: token.trim(), switchSpace: true }),
      });
      // Remove every space-scoped query before opening the new membership.
      await client.cancelQueries().catch(() => undefined);
      client.clear();
      onJoined();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Couldn’t join that space.",
      );
      setBusy(null);
    }
  }

  return (
    <section className="partner-setup" aria-labelledby="partner-setup-title">
      <header className="partner-setup-heading">
        <span className="partner-space-name">{space.space.name}</span>
        <h1 id="partner-setup-title">
          {space.space.hasPairedBefore
            ? "Your partner has left this space"
            : "Invite your partner"}
        </h1>
        <p>Journal, games, plans, and music open when you’re both here.</p>
      </header>
      {space.space.hasPairedBefore ? (
        <div className="partner-setup-history">
          <p>
            Your saved entries are kept here. You can export them in Settings
            before leaving this space.
          </p>
          <Link className="secondary" href="/settings">
            Open Settings <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        <div className="partner-setup-options">
          <section
            className="partner-invite"
            aria-labelledby="send-invite-title"
          >
            <h2 id="send-invite-title">Send an invitation</h2>
            <p>Your partner can paste your code when they sign in.</p>
            {invitation ? (
              <>
                <label className="field" htmlFor="partner-invitation">
                  Your invitation code
                </label>
                <div className="partner-code-row">
                  <input
                    id="partner-invitation"
                    value={invitation.token}
                    readOnly
                    onFocus={(event) => event.target.select()}
                  />
                  <button
                    className="secondary"
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invitation.token);
                        setCopied(true);
                      } catch {
                        setError(
                          "Select and copy the code, then send it to your partner.",
                        );
                      }
                    }}
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <small className="muted">
                  Valid for 48 hours. Keep this code between you two.
                </small>
                <button
                  className="quiet"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void createInvitation()}
                >
                  Create a new code
                </button>
              </>
            ) : (
              <button
                className="button"
                type="button"
                disabled={busy !== null}
                onClick={() => void createInvitation()}
              >
                {busy === "invite" ? "Creating…" : "Create invitation"}
              </button>
            )}
            <span className="partner-waiting" role="status">
              <span aria-hidden="true" />
              Waiting for your partner
            </span>
          </section>
          <section
            className="partner-join"
            aria-labelledby="join-partner-title"
          >
            <h2 id="join-partner-title">Have their code?</h2>
            {space.space.canSwitch ? (
              <form
                className="stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  void join();
                }}
              >
                <p>Join their space even if you’ve already made this one.</p>
                <label className="field" htmlFor="partner-code">
                  Partner’s invitation code
                </label>
                <input
                  id="partner-code"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={128}
                  required
                  disabled={busy !== null}
                />
                <label className="partner-switch-confirm">
                  <input
                    type="checkbox"
                    checked={confirmed}
                    onChange={(event) => setConfirmed(event.target.checked)}
                    disabled={busy !== null}
                  />
                  <span>
                    Leave “{space.space.name}” and join my partner’s space.
                  </span>
                </label>
                <button
                  className="secondary"
                  disabled={busy !== null || !confirmed || !token.trim()}
                >
                  {busy === "join" ? "Joining…" : "Join their space"}
                  <ArrowRight size={16} />
                </button>
              </form>
            ) : (
              <>
                <p>
                  This space has saved content. Export it in Settings, then
                  leave this space to use your partner’s code.
                </p>
                <Link className="secondary" href="/settings">
                  Open Settings <ArrowRight size={16} />
                </Link>
              </>
            )}
          </section>
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
