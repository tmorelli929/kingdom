import assert from "node:assert/strict";
import { test } from "node:test";

test("tokens round-trip and tampering is detected", async () => {
  process.env.DATABASE_URL ||= "postgres://x";
  process.env.APP_URL ||= "http://localhost:3000";
  process.env.ALLOWED_EMAILS ||= "a@b.c";
  process.env.AUTH_GOOGLE_SECRET = "test-secret";
  const { seal, open } = await import("./crypto");
  const s = seal("ya29.token");
  assert.notEqual(s, seal("ya29.token")); // fresh IV each time
  assert.equal(open(s), "ya29.token");
  const parts = s.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => open(parts.join(":")));
});
