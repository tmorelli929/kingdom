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

test("reads Bing News feeds: real article link, source and picture", () => {
  const xml = `<rss xmlns:News="https://www.bing.com/news/search?q=x&amp;format=rss"><channel><item><title>Nvidia expands networking push</title><link>http://www.bing.com/news/apiclick.aspx?ref=FexRss&amp;aid=&amp;tid=1&amp;url=https%3a%2f%2fwww.reuters.com%2ftech%2fnvidia&amp;c=1&amp;mkt=en-us</link><pubDate>Mon, 26 Oct 2026 12:00:00 GMT</pubDate><News:Source>Reuters</News:Source><News:Image>http://www.bing.com/th?id=OVFT.abc&amp;pid=News</News:Image></item><item><title>Odd image</title><link>https://example.com/a</link><News:Source>X</News:Source><News:Image>https://evil.example/pic.jpg</News:Image></item></channel></rss>`;
  const h = parseFeed(xml, "AI");
  assert.equal(h[0].url, "https://www.reuters.com/tech/nvidia");
  assert.equal(h[0].source, "Reuters");
  assert.match(h[0].image ?? "", /^https:\/\/www\.bing\.com\/th\?id=OVFT\.abc/);
  assert.equal(h[1].image, undefined);
});
