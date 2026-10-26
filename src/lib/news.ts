
// A short daily brief on the topics he picks, from free Google News feeds. No AI and no cost: the top
// headline from each topic, in his priority order, then a few more.
const PER_TOPIC = 8;

export type Headline = { title: string; source: string; url: string; topic?: string; published?: string };
export type Story = Headline & { topic: string; summary: string; why: string };
export type Brief = { stories: Story[]; quick: Headline[]; bigIdea: string; starter: string };

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (item: string, name: string) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(item); return m ? decode(m[1]) : ""; };

// Reads a Google News RSS feed. Titles there end in " - Source", which is trimmed off.
export function parseFeed(xml: string, topic: string): Headline[] {
  const out: Headline[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = tag(m[1], "source");
    let title = tag(m[1], "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const url = tag(m[1], "link");
    if (title && /^https:\/\//.test(url)) out.push({ title, source, url, topic, published: tag(m[1], "pubDate") });
  }
  return out;
}

const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);

async function feed(q: string, topic: string) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    return res.ok ? parseFeed(await res.text(), topic).slice(0, PER_TOPIC) : [];
  } catch { return []; }
}

// Recent headlines for each topic, in topic order, with the same story from two topics kept once.
export async function fetchHeadlines(topics: string[], location: string) {
  const lists = await Promise.all([...topics.map((t) => feed(t, t)), ...(location ? [feed(location, location)] : [])]);
  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const list of lists) for (const h of list) { const k = key(h.title); if (!seen.has(k)) { seen.add(k); out.push(h); } }
  return out;
}

// The top headline from each topic, the next ones as quick headlines.
export function plainBrief(all: Headline[]): Brief {
  const firsts: Headline[] = [], rest: Headline[] = [];
  const topicsSeen = new Set<string>();
  for (const h of all) { if (!topicsSeen.has(h.topic ?? "")) { topicsSeen.add(h.topic ?? ""); firsts.push(h); } else rest.push(h); }
  const stories = firsts.slice(0, 5).map((h) => ({ ...h, topic: h.topic ?? "", summary: "", why: "" }));
  return { stories, quick: [...firsts.slice(5), ...rest].slice(0, 3), bigIdea: "", starter: "" };
}
