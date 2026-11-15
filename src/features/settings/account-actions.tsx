"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, LogOut, RotateCcw } from "lucide-react";
import { api } from "@/components/space-provider";
import type { SpaceSnapshot } from "@/shared/types";
import { clearPrivateClientState } from "./client-state";

type Operation = "signout" | "leave" | "demo";

export function AccountActions({ space, onNavigate = path => window.location.assign(path) }: { space: SpaceSnapshot; onNavigate?: (path: string) => void }) {
  const client = useQueryClient();
  const [pending, setPending] = useState<Operation | null>(null);
  const [confirmation, setConfirmation] = useState<"leave" | "demo" | null>(null);
  const [error, setError] = useState("");
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmTrigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (confirmation) cancelButton.current?.focus(); }, [confirmation]);
  async function run(operation: Operation) {
    if (pending) return;
    setPending(operation); setError("");
    try {
      if (operation === "signout") await api("/api/auth/sign-out", { method: "POST", body: "{}" });
      else if (operation === "leave") await api("/api/space/membership", { method: "DELETE" });
      else await api("/api/demo", { method: "POST", body: "{}" });
      await clearPrivateClientState(client);
      onNavigate("/journal");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That action did not finish. Please try again.");
      setPending(null);
    }
  }
  function cancel() { setConfirmation(null); setError(""); confirmTrigger.current?.focus(); }
  return <>
    <section className="settings-section" aria-labelledby="data-settings-title"><div className="settings-section-heading"><h2 id="data-settings-title">Your data</h2></div><div className="settings-data-content"><p>Download the journal, plans and activity data currently available to you. Photo and audio files are not included.</p><a className="secondary" href="/api/export" download="twospace.json"><Download size={17} aria-hidden="true" />Download data (.json)</a></div></section>
    <section className="settings-section" aria-labelledby="account-settings-title"><div className="settings-section-heading"><h2 id="account-settings-title">Account</h2></div><div className="settings-account-content">
      <div className="settings-account-row"><div><h3>Sign out</h3></div><button type="button" className="secondary" disabled={pending !== null} onClick={() => void run("signout")}><LogOut size={17} aria-hidden="true" />{pending === "signout" ? "Signing out…" : "Sign out"}</button></div>
      {space.space.isDemo ? <div className="settings-account-row"><div><h3>Sample space</h3><p>Start again with a new copy of the sample content.</p></div><button type="button" className="secondary" ref={confirmTrigger} disabled={pending !== null} onClick={() => { setConfirmation("demo"); setError(""); }} aria-expanded={confirmation === "demo"} aria-controls="settings-confirmation"><RotateCcw size={16} aria-hidden="true" />New sample space</button></div> : <div className="settings-account-row"><div><h3>Leave this space</h3><p>Removes your access without deleting shared content.</p></div><button type="button" className="secondary settings-danger" ref={confirmTrigger} disabled={pending !== null} onClick={() => { setConfirmation("leave"); setError(""); }} aria-expanded={confirmation === "leave"} aria-controls="settings-confirmation">Leave space</button></div>}
      {confirmation && <div className="settings-confirm" role="group" id="settings-confirmation" aria-labelledby="settings-confirmation-title"><h3 id="settings-confirmation-title">{confirmation === "leave" ? `Leave ${space.space.name}?` : "Start a new sample space?"}</h3><p>{confirmation === "leave" ? `You will lose access to this space. ${space.members.length > 1 ? "Your partner keeps access to the shared journal, plans and activities." : "This does not delete the space or its content."} Your account stays open, and you can create or join a new space.` : "Your changes in this sample will not carry over to the new copy."}</p><div className="settings-confirm-actions"><button type="button" className="secondary" ref={cancelButton} disabled={pending !== null} onClick={cancel}>Cancel</button><button type="button" className={`button${confirmation === "leave" ? " settings-leave-button" : ""}`} disabled={pending !== null} onClick={() => void run(confirmation)}>{pending ? confirmation === "leave" ? "Leaving…" : "Starting…" : confirmation === "leave" ? "Confirm leave space" : "Start new sample"}</button></div></div>}
      {error && <p className="form-error" role="alert">{error}</p>}
    </div></section>
  </>;
}
