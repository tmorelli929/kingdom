import { authed, fail, json } from "@/lib/http";
import { parseRef, refLabel } from "@/lib/life/bible";

// The text of one chapter for his reading plan, from bible-api.com in the World English Bible (public domain).
// Only a valid book and chapter is ever sent; nothing about him is.
export const GET = authed(async (req) => {
  const ref = parseRef(new URL(req.url).searchParams.get("ref") ?? "");
  if (!ref) return fail(400, "Unknown chapter.");
  const q = `${ref.book} ${ref.chapter}`.replace(/ /g, "+");
  try {
    const res = await fetch(`https://bible-api.com/${q}?translation=web`, { next: { revalidate: 60 * 60 * 24 * 30 }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { verses?: { verse: number; text: string }[] };
    const verses = (data.verses ?? []).map((v) => ({ n: v.verse, text: v.text.replace(/\s+/g, " ").trim() }));
    if (!verses.length) throw new Error("empty");
    return json({ ref: refLabel(ref), translation: "World English Bible", verses });
  } catch {
    return fail(502, `Couldn't load ${refLabel(ref)} right now.`);
  }
});
