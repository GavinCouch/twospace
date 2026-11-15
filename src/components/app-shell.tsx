"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Shapes, CalendarDays, Settings, LogOut, ChevronDown, ArrowUpRight, Copy, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Brand } from "./account-gate";
import { api, useSpace } from "./space-provider";
import "./shell.css";

const navigation = [{ href: "/journal", name: "Journal", icon: BookOpen }, { href: "/activities", name: "Activities", icon: Shapes }, { href: "/plans", name: "Plans", icon: CalendarDays }];
export function AppShell({ children }: { children: ReactNode }) {
  const { data, isPending, error, refetch } = useSpace();
  const path = usePathname();
  const client = useQueryClient();
  const [clock, setClock] = useState<Date | null>(null);
  const [switching, setSwitching] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => { setClock(new Date()); const timer = setInterval(() => setClock(new Date()), 30_000); return () => clearInterval(timer); }, []);
  async function switchProfile(userId: string) {
    setSwitching(true); setNotice("");
    try { await api("/api/demo/switch", { method: "POST", body: JSON.stringify({ userId }) }); await client.cancelQueries(); client.clear(); window.location.reload(); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Couldn’t switch profiles."); setSwitching(false); }
  }
  async function signOut() {
    try { await api("/api/auth/sign-out", { method: "POST", body: "{}" }); await client.cancelQueries(); client.clear(); window.location.assign("/"); }
    catch (cause) { setNotice(cause instanceof Error ? cause.message : "Couldn’t sign out."); }
  }
  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to content</a><aside className="sidebar"><Link href="/journal" className="brand-link" aria-label="TwoSpace journal"><Brand /></Link><div className="space-label">{data?.space.name || "Your space"}</div><nav aria-label="Main navigation">{navigation.map(item => <Link key={item.href} href={item.href} className={path.startsWith(item.href) ? "nav-link active" : "nav-link"} aria-current={path.startsWith(item.href) ? "page" : undefined}><item.icon size={19}/>{item.name}</Link>)}</nav><div className="sidebar-bottom"><Link className={path === "/settings" ? "nav-link active" : "nav-link"} href="/settings"><Settings size={18}/>Settings</Link><button className="nav-link" onClick={signOut}><LogOut size={18}/>Sign out</button><div className="sidebar-pair">{data?.members.map(p => <span key={p.id} className="avatar" style={{ backgroundColor: `${p.color}20`, color: p.color }} title={p.name}>{p.name.slice(0,1).toUpperCase()}</span>)}<span>{data?.members.map(p => p.name).join(" & ")}</span></div></div></aside><div className="app-body"><header className="topbar"><div className="partner-clocks">{data?.members.map(person => <div className="partner-clock" key={person.id}><span>{person.name}<small>{person.timeZone.split("/").at(-1)?.replaceAll("_", " ")}</small></span><strong>{clock ? new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: person.timeZone }).format(clock) : "—"}</strong></div>)}</div>{data?.space.isDemo && <label className="demo-switch"><span>Sample space</span><select aria-label="View sample space as" value={data.me.id} disabled={switching} onChange={e => switchProfile(e.target.value)}>{data.members.map(p => <option key={p.id} value={p.id}>{p.name}’s view</option>)}</select><ChevronDown size={14}/></label>}</header><main id="main-content" className="main-content">{notice && <p className="form-error" role="alert">{notice}</p>}{isPending ? <div className="panel" role="status" aria-label="Loading your space"><div className="loading-line"/><div className="loading-line"/><div className="loading-line"/></div> : error ? <div className="empty"><p role="alert">{error.message}</p><button className="button" onClick={() => refetch()}>Try again</button></div> : <>{data?.members.length === 1 && <InviteBanner/>}{children}</>}</main><footer className="app-footer"><span>TwoSpace</span><Link href="/settings">Your space & preferences <ArrowUpRight size={12}/></Link></footer></div></div>;
}
function InviteBanner() {
  const [code, setCode] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false); const [copied, setCopied] = useState(false);
  async function invite() { setPending(true); setError(""); try { const result = await api<{ token: string }>("/api/invites", { method: "POST", body: "{}" }); setCode(result.token); } catch (cause) { setError(cause instanceof Error ? cause.message : "Try again."); } finally { setPending(false); } }
  return <section className="invite-banner"><div><strong>Invite your partner</strong><p>They can use this code after creating an account.</p>{code && <code>{code}</code>}{error && <p role="alert">{error}</p>}</div>{code ? <button className="secondary" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); } catch { setError("Copy the code above and send it to your partner."); } }}>{copied ? <Check/> : <Copy/>}{copied ? "Copied" : "Copy code"}</button> : <button className="secondary" disabled={pending} onClick={invite}>{pending ? "Creating…" : "Create invitation"}</button>}</section>;
}
