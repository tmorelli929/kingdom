import { test } from "node:test";
import assert from "node:assert/strict";
import { costMicros } from "./usage";

test("prices tokens and web searches at list price", () => {
  // 10k in ($0.04) + 2k out ($0.04) + 5 searches ($0.05)
  assert.equal(costMicros({ input_tokens: 10000, output_tokens: 2000, server_tool_use: { web_search_requests: 5 } }), 130000);
  assert.equal(costMicros({}), 0);
});
