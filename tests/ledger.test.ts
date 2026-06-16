import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger } from "../src/ledger.ts";
import type { Receipt } from "../src/types.ts";

function tmpLedger(): { ledger: Ledger; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "leash-"));
  const path = join(dir, "ledger.jsonl");
  return { ledger: new Ledger(path), path };
}

function entry(decision: Receipt["decision"], summary: string) {
  return {
    ts: new Date().toISOString(),
    sessionId: "s",
    hookEvent: "PreToolUse",
    toolName: "Bash",
    action: "bash:x",
    summary,
    decision,
    rule: "test",
    reason: "test",
    meta: {},
  };
}

test("append assigns sequential seq and chains hashes", () => {
  const { ledger } = tmpLedger();
  const a = ledger.append(entry("allow", "one"));
  const b = ledger.append(entry("block", "two"));
  assert.equal(a.seq, 0);
  assert.equal(b.seq, 1);
  assert.equal(b.prevHash, a.hash);
  assert.notEqual(a.hash, b.hash);
});

test("verify passes on an untouched chain", () => {
  const { ledger } = tmpLedger();
  ledger.append(entry("allow", "one"));
  ledger.append(entry("ask", "two"));
  ledger.append(entry("block", "three"));
  assert.deepEqual(ledger.verify(), { ok: true, firstBrokenIndex: null });
});

test("verify detects a mutated row", () => {
  const { ledger, path } = tmpLedger();
  ledger.append(entry("allow", "one"));
  ledger.append(entry("block", "two — rm -rf /"));
  // Tamper: rewrite line 2 to hide the block, keeping its old hash.
  const lines = readFileSync(path, "utf8").trim().split("\n");
  const tampered = JSON.parse(lines[1] as string) as Receipt;
  tampered.decision = "allow";
  lines[1] = JSON.stringify(tampered);
  writeFileSync(path, `${lines.join("\n")}\n`);
  const v = ledger.verify();
  assert.equal(v.ok, false);
  assert.equal(v.firstBrokenIndex, 1);
});

test("count scopes to a session", () => {
  const { ledger } = tmpLedger();
  ledger.append({ ...entry("allow", "a"), sessionId: "s1" });
  ledger.append({ ...entry("allow", "b"), sessionId: "s2" });
  ledger.append({ ...entry("allow", "c"), sessionId: "s1" });
  assert.equal(ledger.count(), 3);
  assert.equal(ledger.count("s1"), 2);
});
