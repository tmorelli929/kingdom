import Anthropic from "@anthropic-ai/sdk";
import { and, desc, eq, gte } from "drizzle-orm";
import { db, schema } from "@/db";
import { buildContext, COACH_SYSTEM } from "@/lib/coach";
import { env } from "@/lib/env";
import { authed, fail, json, readJson } from "@/lib/http";
import { timeIn, todayIn } from "@/lib/life/dates";
import { looksLikeLifeDoc } from "@/lib/life/migrate";
import { loadNetwork } from "@/lib/network-db";

const MODEL = "claude-opus-5-5";
const HOURLY_LIMIT = 40;

// GET: recent conversation and today's brief.
export const GET = authed(async (_req, user) => {
  const rows = await db
    .select({ kind: schema.coachMessages.kind, role: schema.coachMessages.role, content: schema.coachMessages.content, createdAt: schema.coachMessages.createdAt })
    .from(schema.coachMessages)
    .where(eq(schema.coachMessages.userId, user.id))
    .orderBy(desc(schema.coachMessages.createdAt))
    .limit(60);
  rows.reverse();
  const brief = [...rows].reverse().find((r) => r.kind === "brief" && r.role === "assistant");
  return json({
    configured: !!env().ANTHROPIC_API_KEY,
    chat: rows.filter((r) => r.kind === "chat").slice(-40).map((r) => ({ role: r.role, content: r.content })),
    brief: brief ? { content: brief.content, at: brief.createdAt } : null,
  });
});

// POST { mode: "chat" | "brief", message?, tz }: streams the coach's reply as plain text.
export const POST = authed(async (req, user) => {
  const key = env().ANTHROPIC_API_KEY;
  if (!key) return fail(503, "The coach isn't set up yet. Add ANTHROPIC_API_KEY in your hosting settings.");
  const body = (await readJson(req)) as { mode?: string; message?: string; tz?: string };
  const mode = body.mode === "brief" ? "brief" : "chat";
  const message = (body.message ?? "").trim().slice(0, 4000);
  if (mode === "chat" && !message) return fail(400, "Type a question for your coach.");

  const recent = await db
    .select({ id: schema.coachMessages.id })
    .from(schema.coachMessages)
    .where(and(eq(schema.coachMessages.userId, user.id), eq(schema.coachMessages.role, "user"), gte(schema.coachMessages.createdAt, new Date(Date.now() - 3600_000))));
  if (recent.length >= HOURLY_LIMIT) return fail(429, "That's a lot of coaching for one hour. Try again a bit later.");

  const [life] = await db.select().from(schema.lifeDocs).where(eq(schema.lifeDocs.userId, user.id)).limit(1);
  if (!life || !looksLikeLifeDoc(life.data)) return fail(400, "Set up your dashboard first.");
  const today = todayIn(body.tz);
  const context = buildContext(life.data, await loadNetwork(user.id), today, timeIn(body.tz), message);

  const history = mode === "chat"
    ? (await db
        .select({ role: schema.coachMessages.role, content: schema.coachMessages.content })
        .from(schema.coachMessages)
        .where(and(eq(schema.coachMessages.userId, user.id), eq(schema.coachMessages.kind, "chat")))
        .orderBy(desc(schema.coachMessages.createdAt))
        .limit(10)).reverse()
    : [];
  while (history.length && history[0].role !== "user") history.shift();

  const ask = mode === "brief"
    ? "Give me today's read in 2 to 4 sentences: the one pattern that matters most right now, and what to protect today. Name a specific time or person if the data supports it."
    : message;
  const messages: Anthropic.Messages.MessageParam[] = [
    ...history.map((m) => ({ role: m.role === "user" ? ("user" as const) : ("assistant" as const), content: m.content })),
    { role: "user", content: `<my_data>\n${context}\n</my_data>\n\n${ask}` },
  ];
  // Merge any back-to-back turns from the same role so the conversation alternates.
  const merged = messages.reduce<Anthropic.Messages.MessageParam[]>((acc, m) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.role === m.role) prev.content = `${prev.content}\n\n${m.content}`;
    else acc.push({ ...m });
    return acc;
  }, []);

  await db.insert(schema.coachMessages).values({ userId: user.id, kind: mode, role: "user", content: mode === "brief" ? "(daily read)" : message });

  const client = new Anthropic({ apiKey: key });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let text = "";
      let failed = false;
      try {
        const params = {
          model: MODEL,
          max_tokens: 16000,
          system: COACH_SYSTEM,
          messages: merged,
          output_config: { effort: "medium" },
          // If a safety check declines, Anthropic re-runs the request on a recommended fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        };
        const s = client.beta.messages.stream(params as unknown as Parameters<typeof client.beta.messages.stream>[0]);
        for await (const ev of s) {
          if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
            text += ev.delta.text;
            controller.enqueue(encoder.encode(ev.delta.text));
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === "refusal" && !text.trim()) {
          text = "I can't help with that one. Try asking another way.";
          controller.enqueue(encoder.encode(text));
        }
      } catch (e) {
        const note = e instanceof Anthropic.RateLimitError ? "The coach is busy right now. Try again in a minute."
          : e instanceof Anthropic.AuthenticationError ? "The coach's API key was rejected. Check ANTHROPIC_API_KEY."
          : "The coach couldn't answer just now. Try again shortly.";
        failed = true;
        console.error("coach failed:", e instanceof Error ? e.name : "unknown");
        text += (text ? "\n\n" : "") + note;
        controller.enqueue(encoder.encode((text === note ? "" : "\n\n") + note));
      }
      if (text.trim() && !failed) await db.insert(schema.coachMessages).values({ userId: user.id, kind: mode, role: "assistant", content: text });
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
});
