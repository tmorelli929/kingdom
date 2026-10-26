import { test } from "node:test";
import assert from "node:assert/strict";
import { addresses, contactOf, isWorkAccount } from "./gmail";

test("reads who an email was with from headers only", () => {
  const me = "me@gmail.com";
  const sent = contactOf({ id: "a", internalDate: "100", labelIds: ["SENT"], payload: { headers: [{ name: "From", value: "Me <me@gmail.com>" }, { name: "To", value: '"Ana L" <Ana@x.com>, bob@y.org' }, { name: "Cc", value: "me@gmail.com" }] } }, me);
  assert.deepEqual(sent, { at: 100, dir: "sent", with: ["ana@x.com", "bob@y.org"] });
  const got = contactOf({ id: "b", internalDate: "200", labelIds: ["INBOX"], payload: { headers: [{ name: "From", value: "Ana <ana@x.com>" }, { name: "To", value: "me@gmail.com" }] } }, me);
  assert.deepEqual(got, { at: 200, dir: "received", with: ["ana@x.com"] });
  assert.deepEqual(addresses("no address here"), []);
  assert.ok(isWorkAccount("t@cisco.com") && isWorkAccount("t@eng.cisco.com") && !isWorkAccount("t@gmail.com"));
});
