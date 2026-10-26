"use client";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import type { FitnessData, SetRow, Workout } from "@/lib/fitness-db";
import { api } from "./api";
import { useApp } from "./App";

type Ctx = {
  data: FitnessData;
  reload: () => Promise<void>;
  saveSet: (s: SetRow) => void;
  patchWorkout: (id: string, patch: Partial<Workout> & { action?: "start" | "finish" | "skip" | "reopen" }) => Promise<void>;
};
const FitCtx = createContext<Ctx | null>(null);
export const useFitness = () => {
  const c = useContext(FitCtx);
  if (!c) throw new Error("useFitness outside FitnessProvider");
  return c;
};

const STATUS_FOR: Record<string, Workout["status"]> = { start: "in_progress", finish: "completed", skip: "skipped", reopen: "planned" };

// Loads fitness data once and keeps it in step with the server. Every change is saved immediately.
export function FitnessProvider({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  const { toast } = useApp();
  const [data, setData] = useState<FitnessData | null>(null);
  const [error, setError] = useState("");
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const reload = useCallback(async () => {
    try { setData(await api<FitnessData>("/api/fitness")); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Couldn't load your training."); }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const saveSet = useCallback((s: SetRow) => {
    setData((d) => {
      if (!d) return d;
      const rest = d.sets.filter((x) => !(x.workoutId === s.workoutId && x.slot === s.slot && x.setNumber === s.setNumber));
      return { ...d, sets: [...rest, s] };
    });
    // Typing in a box saves shortly after the last keystroke; checking a set saves right away.
    const k = `${s.workoutId}:${s.slot}:${s.setNumber}`;
    clearTimeout(pending.current.get(k));
    pending.current.set(k, setTimeout(() => {
      pending.current.delete(k);
      api("/api/fitness/sets", "PUT", s).catch((e) => toast(e instanceof Error ? `Set not saved: ${e.message}` : "Set not saved."));
    }, s.done ? 0 : 600));
  }, [toast]);

  const patchWorkout = useCallback<Ctx["patchWorkout"]>(async (id, patch) => {
    const { action, ...fields } = patch;
    setData((d) => d && {
      ...d,
      workouts: d.workouts.map((w) => w.id === id ? {
        ...w, ...fields,
        ...(action ? { status: STATUS_FOR[action] } : {}),
        ...(action === "start" && !w.startedAt ? { startedAt: new Date().toISOString() } : {}),
        ...(action === "finish" ? { finishedAt: new Date().toISOString() } : {}),
      } : w).sort((a, b) => a.date.localeCompare(b.date)),
    });
    try { await api(`/api/fitness/workouts/${id}`, "PATCH", { ...fields, action }); }
    catch (e) { toast(e instanceof Error ? e.message : "Not saved."); reload(); }
  }, [toast, reload]);

  if (!data) return <>{error ? <section className="card"><p className="muted">{error}</p><button className="btn" onClick={reload}>Try again</button></section> : fallback}</>;
  return <FitCtx.Provider value={{ data, reload, saveSet, patchWorkout }}>{children}</FitCtx.Provider>;
}
