"use client";

import { useSpace } from "@/components/space-provider";
import { ProfileSettings } from "./profile-settings";
import { SpaceSettings } from "./space-settings";
import { AccountActions } from "./account-actions";
import "./settings.css";

export default function SettingsPage() {
  const query = useSpace();
  return <div className="settings-page"><div className="page-title"><h1>Settings</h1></div>{query.isPending ? <p role="status">Loading settings…</p> : query.error ? <div><p className="form-error" role="alert">{query.error.message}</p><button className="secondary" onClick={() => void query.refetch()}>Try again</button></div> : query.data ? <div className="settings-sections"><ProfileSettings key={query.data.me.id} person={query.data.me} /><SpaceSettings key={query.data.space.id} name={query.data.space.name} /><AccountActions space={query.data} /></div> : null}</div>;
}
