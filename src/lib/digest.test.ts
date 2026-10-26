import { test } from "node:test";
import assert from "node:assert/strict";
import { bodyText, matchPerson } from "./digest";

const enc = (s: string) => Buffer.from(s).toString("base64").replace(/\+/g, "-").replace(/\//g, "_");

test("reads the plain-text part of a digest, or the HTML with tags removed", () => {
  assert.equal(bodyText({ mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: enc("Talked to Sarah about career.") } }, { mimeType: "text/html", body: { data: enc("<b>x</b>") } }] }), "Talked to Sarah about career.");
  assert.equal(bodyText({ mimeType: "text/html", body: { data: enc("<p>Coffee with <b>Ben</b> &amp; Ana</p><p>Done</p>") } }), "Coffee with Ben & Ana\nDone");
  assert.equal(bodyText(undefined), "");
});

test("matches names to people only when it's unambiguous", () => {
  const people = [{ id: "1", name: "Sarah Kim" }, { id: "2", name: "Ben Ng" }, { id: "3", name: "Ben Ortiz" }];
  assert.equal(matchPerson("sarah kim", people), "1");
  assert.equal(matchPerson("Sarah", people), "1");
  assert.equal(matchPerson("Ben", people), null);
  assert.equal(matchPerson("Ben O.", people), "3");
  assert.equal(matchPerson("Dana Lee", people), null);
});
