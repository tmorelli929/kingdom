"use client";
import type { ReactNode } from "react";

const P: Record<string, ReactNode> = {
  faith: <path d="M12 3v18M6.5 8.5h11" />,
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  pulse: <path d="M3 12h4l3-7 4 14 3-7h4" />,
  case: <path d="M4 8h16v11H4zM9 8V5h6v3M4 13h16" />,
  coin: <><circle cx="12" cy="12" r="8.5" /><path d="M14.5 9h-3.2a1.6 1.6 0 0 0 0 3.2h1.4a1.6 1.6 0 0 1 0 3.2H9.5M12 7v1.8M12 15.4v1.8" /></>,
  rocket: <><path d="M12 3c3 2 5 6 5 10l-2 3H9l-2-3c0-4 2-8 5-10zM10 19l-1 2M14 19l1 2" /><circle cx="12" cy="10" r="1.6" /></>,
  book: <path d="M4 5h5.5A2.5 2.5 0 0 1 12 7.5V19a2 2 0 0 0-2-2H4zM20 5h-6a2.5 2.5 0 0 0-2 2.5V19a2 2 0 0 1 2-2h6z" />,
  star: <path d="M12 3.5l2.5 5.3 5.8.7-4.3 4 1.2 5.8L12 16.4l-5.2 2.9L8 13.5l-4.3-4 5.8-.7z" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" /></>,
  cal: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1.5" /><rect x="13" y="4" width="7" height="7" rx="1.5" /><rect x="4" y="13" width="7" height="7" rx="1.5" /><rect x="13" y="13" width="7" height="7" rx="1.5" /></>,
  chat: <path d="M5 5h14v10H10l-5 4z" />,
  people: <><circle cx="9" cy="8.5" r="3" /><path d="M3.5 19c.6-3 2.8-4.5 5.5-4.5s4.9 1.5 5.5 4.5" /><circle cx="16.5" cy="9.5" r="2.4" /><path d="M15.5 14.6c2.4-.3 4.4 1 5 3.9" /></>,
  sliders: <><path d="M5 6h9M18 6h1M5 12h3M12 12h7M5 18h11M20 18h-1" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
  tick: <path d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={3} />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  plus: <path d="M12 5v14M5 12h14" />,
  link: <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />,
};
export const ICON_CHOICES = ["faith", "heart", "pulse", "case", "coin", "rocket", "book", "star", "sun"];

export function Icon({ name, w = 2 }: { name: string; w?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name] ?? P.star}
    </svg>
  );
}

export function RingSvg({ size, stroke, frac, color }: { size: number; stroke: number; frac: number; color: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, f = Math.max(0, Math.min(1, frac || 0));
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={c * (1 - f)} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

export function Check({ on, label, onClick }: { on: boolean; label: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void }) {
  return <button className="check" aria-pressed={on} aria-label={label} onClick={onClick}><Icon name="tick" /></button>;
}

export function Bar({ frac, color, gold }: { frac: number; color?: string; gold?: boolean }) {
  return <div className={`bar${gold ? " gold" : ""}`}><i style={{ width: `${Math.round(Math.min(1, Math.max(0, frac)) * 100)}%`, background: color }} /></div>;
}

export const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

// Renders the coach's light markdown (paragraphs, bullets, **bold**) as React elements. No raw HTML.
export function Md({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const inline = (s: string, k: string) => s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <b key={k + i}>{part.slice(2, -2)}</b> : <span key={k + i}>{part}</span>);
  const flush = () => {
    if (list.length) blocks.push(<ul key={"u" + blocks.length}>{list.map((l, i) => <li key={i}>{inline(l, "l" + i)}</li>)}</ul>);
    list = [];
  };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*[-*•]\s+(.*)/);
    if (m) { list.push(m[1]); continue; }
    flush();
    if (line.trim()) blocks.push(<p key={"p" + blocks.length}>{inline(line.replace(/^#+\s*/, ""), "p" + blocks.length)}</p>);
  }
  flush();
  return <div className="md">{blocks}</div>;
}

export function popXP(el: Element, n: number) {
  const r = el.getBoundingClientRect(), p = document.createElement("div");
  p.className = "pop";
  p.textContent = `+${n} XP`;
  p.style.left = `${Math.min(r.right + 8, window.innerWidth - 70)}px`;
  p.style.top = `${r.top}px`;
  document.body.appendChild(p);
  setTimeout(() => p.remove(), 1000);
}

export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
