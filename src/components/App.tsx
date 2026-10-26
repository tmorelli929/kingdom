"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { dkey, fmtLong } from "@/lib/life/dates";
import type { NetworkData } from "@/lib/life/network";
import { rollWeek } from "@/lib/life/scoring";
import type { LifeDoc } from "@/lib/life/types";
import { api, ApiError, tz } from "./api";
import { Icon } from "./ui";
import Onboarding from "./views/Onboarding";
import Dashboard from "./views/Dashboard";
import { FitnessProvider } from "./fitness";
import Setup from "./views/Setup";

// Today holds everything for the day; the other pages are for going deeper.
// `go` takes a section name ("calendar" is Today, "network" is People).
export type Tab = "today" | "calendar" | "habits" | "network" | "fitness" | "setup";
export type Page = "today" | "fitness" | "habits" | "people" | "setup";
const PAGES: [Page, string, string][] = [["today", "Today", "sun"], ["fitness", "Training", "dumbbell"], ["habits", "Habits", "check"], ["people", "People", "people"], ["setup", "Settings", "sliders"]];
const PAGE_FOR: Record<Tab, Page> = { today: "today", calendar: "today", habits: "habits", network: "people", fitness: "fitness", setup: "setup" };
const pageFromHash = (): Page => { const h = location.hash.slice(1); return PAGES.some(([k]) => k === h) ? (h as Page) : "today"; };

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
  const [page, setPage] = useState<Page>("today");
  const [navN, setNavN] = useState(0); // bumps on every tab tap, so tapping a tab always closes an open workout
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
    // If Gmail is connected and hasn't been checked in the last hour, refresh last-contact dates quietly.
    api<{ updated?: number }>("/api/connections/gmail/sync", "POST", { tz: tz(), ifStale: true })
      .then((r) => { if (r.updated) reloadNet(); }).catch(() => { /* shown in Settings */ });
    setPage(pageFromHash());
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
    const p = PAGE_FOR[t];
    setPage(p);
    setNavN((n) => n + 1);
    setPerson(opts?.person ?? null);
    setArea(opts?.area ?? null);
    if (opts?.ask) setPendingAsk(opts.ask);
    try { history.replaceState(null, "", p === "today" ? location.pathname : `#${p}`); } catch { /* ignore */ }
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
            {PAGES.map(([k, label, ic]) => (
              <button key={k} aria-current={page === k ? "page" : undefined} onClick={() => go(k === "people" ? "network" : k)}>
                <Icon name={ic} /><span>{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main className="wrap">
        <div className="view">
          {page === "setup" ? <Setup /> : (
            <FitnessProvider fallback={<p className="muted" style={{ paddingTop: 24 }}>Loading…</p>}>
              <Dashboard key={`${page}-${navN}`} page={page} />
            </FitnessProvider>
          )}
        </div>
      </main>
      {toastMsg && <div className="toast" role="status">{toastMsg}</div>}
    </AppCtx.Provider>
  );
}

export { tz };
