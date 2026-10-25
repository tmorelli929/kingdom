"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { dkey, fmtLong } from "@/lib/life/dates";
import type { NetworkData } from "@/lib/life/network";
import { rollWeek } from "@/lib/life/scoring";
import type { LifeDoc } from "@/lib/life/types";
import { api, ApiError, tz } from "./api";
import { Icon } from "./ui";
import Onboarding from "./views/Onboarding";
import Habits from "./views/Habits";
import CalendarView from "./views/CalendarView";
import Network from "./views/Network";
import Setup from "./views/Setup";

// Today, Week, Areas and Coach views still exist (src/components/views) but are hidden for now:
// Thomas wants just habits, calendar and networking. Their data stays in the life doc.
export type Tab = "habits" | "calendar" | "network" | "setup";
const TABS: [Tab, string, string][] = [
  ["habits", "Habits", "check"], ["calendar", "Calendar", "cal"], ["network", "Network", "people"], ["setup", "Setup", "sliders"],
];

type Ctx = {
  doc: LifeDoc;
  today: string;
  mutate: (fn: (d: LifeDoc) => void) => void;
  replaceDoc: (doc: LifeDoc, version: number) => void;
  net: NetworkData;
  reloadNet: () => Promise<void>;
  toast: (msg: string) => void;
  go: (t: Tab, opts?: { person?: string | null; area?: string | null; ask?: string }) => void;
  person: string | null;
  area: string | null;
  pendingAsk: string | null;
  clearAsk: () => void;
  email: string;
};
const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside App");
  return c;
};

const EMPTY_NET: NetworkData = { people: [], interactions: [], commitments: [] };

export default function App({ email }: { email: string }) {
  const [doc, setDoc] = useState<LifeDoc | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [net, setNet] = useState<NetworkData>(EMPTY_NET);
  const [tab, setTab] = useState<Tab>("habits");
  const [person, setPerson] = useState<string | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [today, setToday] = useState(() => dkey(new Date()));

  const version = useRef(0);
  const latest = useRef<LifeDoc | null>(null);
  const dirty = useRef(false);
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setToastMsg(m);
    setTimeout(() => setToastMsg((cur) => (cur === m ? null : cur)), 4500);
  }, []);

  // Saves are sent one at a time. If another device saved first, its version wins and is shown.
  const flush = useCallback(async () => {
    if (saving.current || !dirty.current || !latest.current) return;
    saving.current = true;
    dirty.current = false;
    const snapshot = latest.current;
    try {
      const r = await api<{ version: number }>("/api/life", "PUT", { doc: snapshot, baseVersion: version.current });
      version.current = r.version;
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        const b = e.body as { doc: LifeDoc; version: number };
        version.current = b.version;
        latest.current = b.doc;
        setDoc(b.doc);
        dirty.current = false;
        toast("Your other device saved a newer version, so it's showing now. Re-enter your last change if it's missing.");
      } else {
        dirty.current = true;
        toast(e instanceof Error ? `Not saved yet: ${e.message}` : "Not saved yet.");
      }
    } finally {
      saving.current = false;
      if (dirty.current) timer.current = setTimeout(flush, 2000);
    }
  }, [toast]);

  const mutate = useCallback((fn: (d: LifeDoc) => void) => {
    if (!latest.current) return;
    const next = structuredClone(latest.current);
    fn(next);
    latest.current = next;
    setDoc(next);
    dirty.current = true;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(flush, 700);
  }, [flush]);

  const replaceDoc = useCallback((d: LifeDoc, v: number) => {
    latest.current = d;
    version.current = v;
    dirty.current = false;
    setDoc(d);
  }, []);

  const reloadNet = useCallback(async () => {
    try { setNet(await api<NetworkData>("/api/people")); } catch { /* shown elsewhere */ }
  }, []);

  const load = useCallback(async () => {
    const r = await api<{ doc: LifeDoc | null; version: number }>("/api/life");
    if (r.doc) {
      replaceDoc(r.doc, r.version);
      if (rollWeek(r.doc, dkey(new Date()))) mutate(() => {}); // persist carried-forward missions
    }
    setLoaded(true);
  }, [replaceDoc, mutate]);

  useEffect(() => {
    load().catch(() => setLoaded(true));
    reloadNet();
    const h = location.hash.slice(1) as Tab;
    if (TABS.some((t) => t[0] === h)) setTab(h);
  }, [load, reloadNet]);

  // Pick up changes from another device when this one comes back into view.
  useEffect(() => {
    const onFocus = async () => {
      setToday(dkey(new Date()));
      if (dirty.current || saving.current) return;
      try {
        const r = await api<{ doc: LifeDoc | null; version: number }>("/api/life");
        if (r.doc && r.version !== version.current) replaceDoc(r.doc, r.version);
        reloadNet();
      } catch { /* offline */ }
    };
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onHide);
    return () => { window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onHide); };
  }, [replaceDoc, reloadNet, flush]);

  const go = useCallback<Ctx["go"]>((t, opts) => {
    setTab(t);
    setPerson(opts?.person ?? null);
    setArea(opts?.area ?? null);
    if (opts?.ask) setPendingAsk(opts.ask);
    try { history.replaceState(null, "", "#" + t); } catch { /* ignore */ }
    window.scrollTo({ top: 0 });
  }, []);

  if (!loaded) return <main className="wrap"><p className="muted" style={{ paddingTop: 40 }}>Loading your dashboard…</p></main>;
  if (!doc) return <Onboarding onReady={(d, v) => replaceDoc(d, v)} email={email} />;

  const ctx: Ctx = { doc, today, mutate, replaceDoc, net, reloadNet, toast, go, person, area, pendingAsk, clearAsk: () => setPendingAsk(null), email };
  return (
    <AppCtx.Provider value={ctx}>
      <header className="top">
        <div className="top-inner">
          <span className="brand">KINGDOM</span>
          <span className="date">{fmtLong(today)}</span>
          <span className="spacer" />
          <nav className="tabs" aria-label="Sections">
            {TABS.map(([k, label, ic]) => (
              <button key={k} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>
                <Icon name={ic} /><span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">
        <div className="view">
          {tab === "habits" && <Habits />}
          {tab === "calendar" && <CalendarView />}
          {tab === "network" && <Network />}
          {tab === "setup" && <Setup />}
        </div>
      </main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}

export { tz };
