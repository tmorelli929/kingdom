
// A short daily brief on the topics he picks, from free news feeds (Bing News, which carries pictures,
// with Google News as a fallback). No AI and no cost: the top headline from each topic, in his priority order.
const PER_TOPIC = 8;

export type Headline = { title: string; source: string; url: string; topic?: string; published?: string; image?: string };
export type Story = Headline & { topic: string; summary: string; why: string };
export type Brief = { stories: Story[]; quick: Headline[]; bigIdea: string; starter: string };

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (item: string, name: string) => { const m = new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`).exec(item); return m ? decode(m[1]) : ""; };

// Bing wraps article links in a click-tracking redirect; the real address is its url parameter.
function articleUrl(link: string) {
  try {
    const u = new URL(link);
    const real = u.hostname.endsWith("bing.com") ? u.searchParams.get("url") : null;
    return (real ?? link).replace(/^http:\/\//, "https://");
  } catch { return ""; }
}

// Only pictures from Bing's own image server are shown, over https.
function imageUrl(src: string) {
  try {
    const u = new URL(src.replace(/^http:\/\//, "https://"));
    if (!u.hostname.endsWith("bing.com") && !u.hostname.endsWith("bing.net")) return undefined;
    u.searchParams.set("w", "800"); u.searchParams.set("h", "450"); u.searchParams.set("c", "7");
    return u.toString();
  } catch { return undefined; }
}

// Reads a Bing News or Google News RSS feed. Google titles end in " - Source", which is trimmed off.
export function parseFeed(xml: string, topic: string): Headline[] {
  const out: Headline[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const source = tag(m[1], "News:Source") || tag(m[1], "source");
    let title = tag(m[1], "title");
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    const url = articleUrl(tag(m[1], "link"));
    const img = tag(m[1], "News:Image");
    if (title && /^https:\/\//.test(url)) out.push({ title, source, url, topic, published: tag(m[1], "pubDate"), ...(img && imageUrl(img) ? { image: imageUrl(img) } : {}) });
  }
  return out;
}

const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().slice(0, 80);

async function get(url: string, topic: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
    return res.ok ? parseFeed(await res.text(), topic).slice(0, PER_TOPIC) : [];
  } catch { return []; }
}

async function feed(q: string, topic: string) {
  const bing = await get(`https://www.bing.com/news/search?q=${encodeURIComponent(q)}&format=rss&mkt=en-US`, topic);
  if (bing.length) return bing;
  return get(`https://news.google.com/rss/search?q=${encodeURIComponent(`${q} when:2d`)}&hl=en-US&gl=US&ceid=US:en`, topic);
}

// Recent headlines for each topic, in topic order, with the same story from two topics kept once.
export async function fetchHeadlines(topics: string[], location: string) {
  const lists = await Promise.all([...topics.map((t) => feed(t, t)), ...(location ? [feed(location, location)] : [])]);
  const seen = new Set<string>();
  const out: Headline[] = [];
  for (const list of lists) for (const h of list) { const k = key(h.title); if (!seen.has(k)) { seen.add(k); out.push(h); } }
  return out;
}

// The top headline from each topic (preferring one with a picture among its first three), the rest as quick headlines.
export function plainBrief(all: Headline[]): Brief {
  const byTopic = new Map<string, Headline[]>();
  for (const h of all) byTopic.set(h.topic ?? "", [...(byTopic.get(h.topic ?? "") ?? []), h]);
  const firsts: Headline[] = [], rest: Headline[] = [];
  for (const list of byTopic.values()) {
    const pick = list.slice(0, 3).find((h) => h.image) ?? list[0];
    firsts.push(pick);
    rest.push(...list.filter((h) => h !== pick));
  }
  const stories = firsts.slice(0, 5).map((h) => ({ ...h, topic: h.topic ?? "", summary: "", why: "" }));
  return { stories, quick: [...firsts.slice(5), ...rest].slice(0, 3), bigIdea: "", starter: "" };
}
