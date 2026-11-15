"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, LogOut } from "lucide-react";
import { api } from "@/components/space-provider";
import type { SpaceSnapshot } from "@/shared/types";
import { clearPrivateClientState } from "./client-state";
import { FileDownloads } from "./file-downloads";

type Operation = "signout" | "leave";

export function AccountActions({
  space,
  onNavigate = (path) => window.location.assign(path),
}: {
  space: SpaceSnapshot;
  onNavigate?: (path: string) => void;
}) {
  const client = useQueryClient();
  const [pending, setPending] = useState<Operation | null>(null);
  const [confirmation, setConfirmation] = useState(false);
  const [error, setError] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (confirmation) cancelButton.current?.focus();
  }, [confirmation]);
  async function run(operation: Operation) {
    if (pending) return;
    setPending(operation);
    setError("");
    try {
      if (operation === "signout")
        await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      else await api("/api/space/membership", { method: "DELETE" });
      await clearPrivateClientState(client);
      onNavigate("/journal");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "That action did not finish. Please try again.",
      );
      setPending(null);
    }
  }
  function cancel() {
    setConfirmation(false);
    setError("");
    confirmTrigger.current?.focus();
  }
  return (
    <>
      <section
        className="settings-section"
        aria-labelledby="data-settings-title"
      >
        <div className="settings-section-heading">
          <h2 id="data-settings-title">Your data</h2>
        </div>
        <div className="settings-data-content">
          <p>
            Download your journal, plans, and activity data as JSON. Save photos
            and audio separately below, including when shared features are
            locked.
          </p>
          <a className="secondary" href="/api/export" download="twospace.json">
            <Download size={17} aria-hidden="true" />
            Download data (.json)
          </a>
          <FileDownloads key={space.space.id} spaceId={space.space.id} />
        </div>
      </section>
      <section
        className="settings-section"
        aria-labelledby="account-settings-title"
      >
        <div className="settings-section-heading">
          <h2 id="account-settings-title">Account</h2>
        </div>
        <div className="settings-account-content">
          <div className="settings-account-row">
            <div>
              <h3>Sign out</h3>
            </div>
            <button
              type="button"
              className="secondary"
              disabled={pending !== null}
              onClick={() => void run("signout")}
            >
              <LogOut size={17} aria-hidden="true" />
              {pending === "signout" ? "Signing out…" : "Sign out"}
            </button>
          </div>
          <div className="settings-account-row">
            <div>
              <h3>Leave this space</h3>
              <p>Removes your access without deleting shared content.</p>
            </div>
            <button
              type="button"
              className="secondary settings-danger"
              ref={confirmTrigger}
              disabled={pending !== null}
              onClick={() => {
                setConfirmation(true);
                setError("");
              }}
              aria-expanded={confirmation}
              aria-controls="settings-confirmation"
            >
              Leave space
            </button>
          </div>
          {confirmation && (
            <div
              className="settings-confirm"
              role="group"
              id="settings-confirmation"
              aria-labelledby="settings-confirmation-title"
            >
              <h3 id="settings-confirmation-title">
                Leave {space.space.name}?
              </h3>
              <p>
                You will lose access to this space.{" "}
                {space.members.length > 1
                  ? "Shared features will lock. Your partner can still export the saved content from Settings."
                  : "This does not delete the space or its content."}{" "}
                Your account stays open, and you can create or join a new space.
              </p>
              <div className="settings-confirm-actions">
                <button
                  type="button"
                  className="secondary"
                  ref={cancelButton}
                  disabled={pending !== null}
                  onClick={cancel}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="button settings-leave-button"
                  disabled={pending !== null}
                  onClick={() => void run("leave")}
                >
                  {pending === "leave" ? "Leaving…" : "Confirm leave space"}
                </button>
              </div>
            </div>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </section>
    </>
  );
}
