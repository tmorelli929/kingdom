"use client";
import { useState } from "react";
import { useApp, type Page } from "../App";
import Fitness from "./Fitness";
import Habits from "./Habits";
import Network from "./Network";
import Today from "./Today";
import WorkoutMode from "./WorkoutMode";

// One page of the app. A workout in progress takes the full page, and closing it returns here.
export default function Dashboard({ page }: { page: Exclude<Page, "setup"> }) {
  const { person } = useApp();
  const [workout, setWorkout] = useState<string | null>(null);
  const open = (id: string) => { setWorkout(id); window.scrollTo({ top: 0 }); };

  if (person) return <div className="page"><Network /></div>;
  if (workout) return <WorkoutMode id={workout} onClose={() => { setWorkout(null); window.scrollTo({ top: 0 }); }} />;
  if (page === "fitness") return <div className="page"><Fitness onOpen={open} /></div>;
  if (page === "habits") return <div className="page"><Habits /></div>;
  if (page === "people") return <div className="page"><Network /></div>;
  return <Today onOpenWorkout={open} />;
}
