import { test } from "node:test";
import assert from "node:assert/strict";
import { parseFeed, plainBrief } from "./news";

const rss = `<rss><channel>
<item><title>Cisco unveils new AI switches - Reuters</title><link>https://news.google.com/rss/articles/abc</link><pubDate>Mon, 26 Oct 2026 10:00:00 GMT</pubDate><source url="https://www.reuters.com">Reuters</source></item>
<item><title><![CDATA[Fed holds rates &amp; signals cut - AP News]]></title><link>https://news.google.com/rss/articles/def</link><source url="https://apnews.com">AP News</source></item>
<item><title>Bad link</title><link>javascript:alert(1)</link></item>
</channel></rss>`;

test("reads headlines from a Google News feed and trims the source off the title", () => {
  const h = parseFeed(rss, "AI");
  assert.equal(h.length, 2);
  assert.deepEqual([h[0].title, h[0].source, h[0].topic], ["Cisco unveils new AI switches", "Reuters", "AI"]);
  assert.equal(h[1].title, "Fed holds rates & signals cut");
});

test("without AI, the brief is the top headline per topic", () => {
  const h = (title: string, topic: string) => ({ title, source: "S", url: `https://x/${title}`, topic });
  const b = plainBrief([h("a1", "A"), h("a2", "A"), h("b1", "B")]);
  assert.deepEqual(b.stories.map((s) => s.title), ["a1", "b1"]);
  assert.deepEqual(b.quick.map((s) => s.title), ["a2"]);
});
