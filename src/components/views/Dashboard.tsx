"use client";
import { useState } from "react";
import { useApp } from "../App";
import { FitnessProvider } from "../fitness";
import Assistant from "./Assistant";
import CalendarView from "./CalendarView";
import Fitness from "./Fitness";
import Habits from "./Habits";
import Network from "./Network";
import WorkoutMode from "./WorkoutMode";

const SECTIONS: [string, string][] = [["calendar", "Calendar"], ["fitness", "Fitness"], ["habits", "Habits"], ["network", "Network"]];

// Everything on one page. A workout in progress or a person's profile takes the full page,
// and closing it returns to the section it came from.
export default function Dashboard() {
  const { person } = useApp();
  const [workout, setWorkout] = useState<string | null>(null);
  const back = (sec: string) => setTimeout(() => document.getElementById(`sec-${sec}`)?.scrollIntoView({ block: "start" }), 0);

  if (person) return <Network />;
  return (
    <FitnessProvider fallback={<p className="muted" style={{ paddingTop: 24 }}>Loading your dashboard…</p>}>
      {workout ? <WorkoutMode id={workout} onClose={() => { setWorkout(null); back("fitness"); }} /> : (
        <>
          <nav className="jump" aria-label="Jump to section">
            {SECTIONS.map(([k, label]) => <a key={k} href={`#sec-${k}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${k}`)?.scrollIntoView({ block: "start", behavior: "smooth" }); }}>{label}</a>)}
          </nav>
          <div className="sec"><Assistant /></div>
          <div id="sec-calendar" className="sec"><CalendarView onOpenWorkout={(id) => { setWorkout(id); window.scrollTo({ top: 0 }); }} /></div>
          <div id="sec-fitness" className="sec"><Fitness onOpen={(id) => { setWorkout(id); window.scrollTo({ top: 0 }); }} /></div>
          <div id="sec-habits" className="sec"><Habits /></div>
          <div id="sec-network" className="sec"><Network /></div>
        </>
      )}
    </FitnessProvider>
  );
}
