"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, MessagesSquare, Gamepad2, Pencil } from "lucide-react";
import { useSpace } from "@/components/space-provider";
import { ActivityLibrary } from "./activity-library";
import { QuestionsPanel } from "./questions-panel";
import { GamesPanel } from "./games-panel";
import { DrawingsPanel } from "./drawings-panel";
import "./activities.css";

const tabs = [
  { id: "ideas", label: "Choose something", Icon: Compass },
  { id: "questions", label: "Questions", Icon: MessagesSquare },
  { id: "games", label: "Games", Icon: Gamepad2 },
  { id: "drawing", label: "Drawing", Icon: Pencil },
] as const;
type Tab = typeof tabs[number]["id"];

export default function ActivitiesPage() {
  const query = useSpace();
  const [tab, setTab] = useState<Tab>("ideas");
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const readTab = () => {
      const requested = new URLSearchParams(window.location.search).get("tab");
      if (tabs.some(item => item.id === requested)) setTab(requested as Tab);
    };
    readTab(); window.addEventListener("popstate", readTab);
    return () => window.removeEventListener("popstate", readTab);
  }, []);
  function selectTab(value: Tab) {
    setTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", value);
    window.history.replaceState(null, "", url);
  }
  return <div className="activities-page">
    <div className="page-title"><h1>Activities</h1></div>
    <div className="tabs activity-tabs" role="tablist" aria-label="Activities">{tabs.map(({ id, label, Icon }, index) => <button id={`activity-tab-${id}`} role="tab" aria-selected={tab === id} aria-controls={`activity-panel-${id}`} tabIndex={tab === id ? 0 : -1} key={id} ref={element => { buttons.current[index] = element; }} onClick={() => selectTab(id)} onKeyDown={event => {
      let next = index;
      if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      else return;
      event.preventDefault(); selectTab(tabs[next].id); buttons.current[next]?.focus();
    }}><Icon size={17} aria-hidden="true" />{label}</button>)}</div>
    {query.isPending ? <div className="panel" aria-label="Loading activities" role="status"><span className="sr-only">Loading activities…</span><div className="loading-line" /><div className="loading-line" /><div className="loading-line" /></div> : query.error ? <div className="panel"><p className="form-error" role="alert">{query.error.message}</p><button className="secondary" onClick={() => void query.refetch()}>Try again</button></div> : query.data ? <div role="tabpanel" id={`activity-panel-${tab}`} aria-labelledby={`activity-tab-${tab}`} tabIndex={0} className="activity-tab-panel">{tab === "ideas" ? <ActivityLibrary space={query.data} onOpen={selectTab} /> : tab === "questions" ? <QuestionsPanel space={query.data} /> : tab === "games" ? <GamesPanel space={query.data} /> : <DrawingsPanel space={query.data} />}</div> : null}
  </div>;
}
