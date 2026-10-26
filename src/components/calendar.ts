"use client";
import { useCallback, useEffect, useState } from "react";
import type { CalEvent, LinkSuggestion } from "@/lib/life/calendar";
import { api, tz } from "./api";

export type CalendarState =
  | { state: "loading" }
  | { state: "off" } // not connected
  | { state: "expired" }
  | { state: "error"; message: string }
  | { state: "ok"; events: CalEvent[]; suggestions: LinkSuggestion[]; problems: { calendar: string; message: string }[]; needsReconnectForList: boolean };

type Resp = {
  connected: boolean; status?: "ok" | "expired"; events?: CalEvent[]; suggestions?: LinkSuggestion[];
  problems?: { calendar: string; message: string }[]; needsReconnectForList?: boolean;
};

// Loads his calendar for a date range. Events are fetched live from Google each time and never stored.
export function useCalendar(from: string, days: number) {
  const [cal, setCal] = useState<CalendarState>({ state: "loading" });
  const reload = useCallback(async () => {
    try {
      const r = await api<Resp>(`/api/calendar?from=${from}&days=${days}&tz=${encodeURIComponent(tz())}`);
      if (!r.connected) setCal({ state: "off" });
      else if (r.status !== "ok") setCal({ state: "expired" });
      else setCal({ state: "ok", events: r.events ?? [], suggestions: r.suggestions ?? [], problems: r.problems ?? [], needsReconnectForList: !!r.needsReconnectForList });
    } catch (e) {
      setCal({ state: "error", message: e instanceof Error ? e.message : "Calendar unavailable." });
    }
  }, [from, days]);
  useEffect(() => { reload(); }, [reload]);
  return { cal, reload };
}
