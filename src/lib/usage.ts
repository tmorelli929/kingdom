import { db, schema } from "@/db";

// Claude Opus 5.5 list prices, dollars per million tokens, and web search per search. An estimate:
// the Anthropic console bill is the source of truth.
const PRICE = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5, search: 0.01 };

export type Usage = {
  input_tokens?: number | null; output_tokens?: number | null;
  cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
};

export function costMicros(u: Usage) {
  const t = (n?: number | null) => n ?? 0;
  const dollars = (t(u.input_tokens) * PRICE.input + t(u.output_tokens) * PRICE.output
    + t(u.cache_read_input_tokens) * PRICE.cacheRead + t(u.cache_creation_input_tokens) * PRICE.cacheWrite) / 1e6
    + t(u.server_tool_use?.web_search_requests) * PRICE.search;
  return Math.round(dollars * 1e6);
}

// Logs one API call's usage. Never throws: a failed log must not break the feature.
export async function recordUsage(userId: string, feature: "ask" | "insights" | "news" | "digest", u: Usage | null | undefined) {
  if (!u) return;
  try {
    await db.insert(schema.aiUsage).values({
      userId, feature,
      inputTokens: u.input_tokens ?? 0, outputTokens: u.output_tokens ?? 0,
      cacheReadTokens: u.cache_read_input_tokens ?? 0, cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      searches: u.server_tool_use?.web_search_requests ?? 0, costMicros: costMicros(u),
    });
  } catch (e) {
    console.error("usage log failed:", e instanceof Error ? e.name : "unknown");
  }
}
