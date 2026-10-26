"use client";
import { useEffect, useState } from "react";
import { fmtShort } from "@/lib/life/dates";
import { api } from "../api";
import { useApp } from "../App";

type Suggestion = { id: string; personName: string; personId: string | null; occurredOn: string; kind: string; summary: string; followUp: string };

// Updates pulled from his daily digest email. Each waits for him: Add logs it, Skip drops it.
export default function DigestSuggestions() {
  const { net, reloadNet, toast } = useApp();
  const [list, setList] = useState<Suggestion[]>([]);
  const [pick, setPick] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const load = () => api<{ suggestions: Suggestion[] }>("/api/suggestions").then((r) => setList(r.suggestions)).catch(() => {});
  useEffect(() => { load(); }, [net.people.length]);
  if (!list.length) return null;

  const act = async (s: Suggestion, action: "apply" | "dismiss") => {
    setBusy(s.id);
    try {
      await api(`/api/suggestions/${s.id}`, "PATCH", action === "apply" ? { action, personId: pick[s.id] ?? s.personId ?? "new" } : { action });
      setList((l) => l.filter((x) => x.id !== s.id));
      if (action === "apply") { await reloadNet(); toast(`Logged for ${s.personName}.`); }
    } catch (e) { toast(e instanceof Error ? e.message : "That didn't work."); }
    finally { setBusy(null); }
  };

  return (
    <section className="card stack-s">
      <div className="card-head"><h2>From your daily digest</h2><span className="small muted">{list.length} to review</span></div>
      {list.map((s) => (
        <div key={s.id} className="sugg">
          <div className="sugg-head">
            <select className="in" aria-label={`Who is ${s.personName}`} value={pick[s.id] ?? s.personId ?? "new"} onChange={(e) => setPick({ ...pick, [s.id]: e.target.value })}>
              <option value="new">New person: {s.personName}</option>
              {net.people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <span className="small muted num">{fmtShort(s.occurredOn)} · {s.kind}</span>
          </div>
          <p className="small">{s.summary || "No details."}</p>
          {s.followUp && <p className="small muted">Follow-up: {s.followUp}</p>}
          <div className="btns">
            <button className="btn primary sm" disabled={busy === s.id} onClick={() => act(s, "apply")}>Add</button>
            <button className="btn ghost sm" disabled={busy === s.id} onClick={() => act(s, "dismiss")}>Skip</button>
          </div>
        </div>
      ))}
    </section>
  );
}
