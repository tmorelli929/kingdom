import { test } from "node:test";
import assert from "node:assert/strict";
import { keepVerified, parseBrief, verifyBrief } from "./news";

const s = (url: string) => ({ title: "T", source: "S", url, summary: "", why: "W", topic: "AI" });

test("reads the brief JSON from the model's final text, even inside a code fence", () => {
  const b = parseBrief('Here you go:\n```json\n{"stories":[{"title":"A","source":"B","url":"https://x.com/a","summary":"s","why":"c","topic":"d"}],"quick":[],"starter":"x"}\n```');
  assert.equal(b.stories.length, 1);
  assert.equal(b.starter, "x");
  assert.equal(b.bigIdea, "");
  assert.deepEqual(parseBrief("no json").stories, []);
  assert.deepEqual(parseBrief('{"stories":[{"title":"A"}]}').stories, []);
});

test("drops any story whose link didn't come back from the search", () => {
  const seen = new Set(["https://www.example.com/story/", "https://news.site/b?utm=1"]);
  const out = keepVerified([s("https://example.com/story"), s("https://made.up/c"), s("https://news.site/b"), s("https://news.site/b")], seen);
  assert.deepEqual(out.map((x) => x.url), ["https://example.com/story", "https://news.site/b"]);
});

test("quick headlines are verified too and never repeat a main story", () => {
  const seen = new Set(["https://a.com/1", "https://b.com/2", "https://c.com/3"]);
  const q = (url: string) => ({ title: "Q", source: "S", url });
  const b = verifyBrief({ stories: [s("https://a.com/1")], quick: [q("https://a.com/1"), q("https://fake.com/x"), q("https://b.com/2"), q("https://c.com/3")], bigIdea: "i", starter: "t" }, seen);
  assert.deepEqual(b.quick.map((x) => x.url), ["https://b.com/2", "https://c.com/3"]);
  assert.equal(b.starter, "t");
  assert.equal(verifyBrief({ stories: [s("https://fake.com/y")], quick: [], bigIdea: "i", starter: "t" }, seen).starter, "");
});
