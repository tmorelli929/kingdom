import { test } from "node:test";
import assert from "node:assert/strict";
import { parseConnectedOn, parseConnections, planImport } from "./linkedin";

const CSV = `﻿Notes:
"When exporting your connection data, you may notice that some of the email addresses are missing."

First Name,Last Name,URL,Email Address,Company,Position,Connected On
Ana,Lopez,https://www.linkedin.com/in/analopez,,"Acme, Inc.",VP Sales,25 Oct 2026
Ben,Ng,https://www.linkedin.com/in/benng/,ben@ng.dev,Startup,Founder,03 Jan 2024
Cara,Diaz,https://www.linkedin.com/in/cara,,Bank,"Analyst ""II""",1 Feb 2020
`;

test("parses LinkedIn's Connections.csv with its notes preamble and quoted cells", () => {
  const rows = parseConnections(CSV);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[0], { name: "Ana Lopez", url: "https://www.linkedin.com/in/analopez", email: "", company: "Acme, Inc.", position: "VP Sales", connectedOn: "2026-10-25" });
  assert.equal(rows[2].position, 'Analyst "II"');
  assert.equal(parseConnectedOn("10/25/26"), "2026-10-25");
  assert.throws(() => parseConnections("a,b\n1,2"));
});

test("matches existing people, fills only blank fields, and adds the rest", () => {
  const people = [
    { id: "1", name: "Ben Ng", organization: "", title: "CEO", linkedinUrl: "https://linkedin.com/in/benng", email: "" },
    { id: "2", name: "Cara Diaz", organization: "Bank", title: "Analyst II", linkedinUrl: "https://www.linkedin.com/in/cara", email: "" },
  ];
  const plan = planImport(parseConnections(CSV), people);
  assert.deepEqual(plan.updates, [{ id: "1", name: "Ben Ng", patch: { organization: "Startup", email: "ben@ng.dev" } }]);
  assert.equal(plan.unchanged, 1);
  assert.equal(plan.adds.length, 1);
  assert.equal(plan.adds[0].name, "Ana Lopez");
  assert.equal(plan.adds[0].metOn, "2026-10-25");
});
