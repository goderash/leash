import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { guard } from "../src/guard.ts";
import { DEFAULT_CONFIG } from "../src/config.ts";
import { restoreFromMeta } from "../src/snapshot.ts";
import type { ToolEvent } from "../src/types.ts";

function root(): string {
  return mkdtempSync(join(tmpdir(), "leash-guard-"));
}

test("guard records a receipt and blocks a dangerous command", () => {
  const r = root();
  const event: ToolEvent = {
    sessionId: "s", hookEvent: "PreToolUse", toolName: "Bash",
    toolInput: { command: "rm -rf ~/" }, cwd: r,
  };
  const out = guard(event, r, DEFAULT_CONFIG);
  assert.equal(out.result.decision, "block");
  assert.equal(out.receipt.seq, 0);
  assert.ok(existsSync(join(r, DEFAULT_CONFIG.logFile)));
});

test("guard snapshots a file before an allowed write, enabling undo", () => {
  const r = root();
  const target = join(r, "keep.txt");
  writeFileSync(target, "original", "utf8");

  const event: ToolEvent = {
    sessionId: "s", hookEvent: "PreToolUse", toolName: "Write",
    toolInput: { file_path: target }, cwd: r,
  };
  const out = guard(event, r, DEFAULT_CONFIG);
  assert.equal(out.result.decision, "allow");
  assert.ok(out.receipt.meta.snapshotPath, "snapshot path recorded");
  assert.equal(out.receipt.meta.existedBefore, true);

  // Agent overwrites the file...
  writeFileSync(target, "AGENT GARBAGE", "utf8");
  // ...then we undo from the recorded snapshot.
  const res = restoreFromMeta(out.receipt.meta);
  assert.equal(res?.action, "restored");
  assert.equal(readFileSync(target, "utf8"), "original");
});

test("undo of a newly-created file removes it", () => {
  const r = root();
  const target = join(r, "new.txt");
  const event: ToolEvent = {
    sessionId: "s", hookEvent: "PreToolUse", toolName: "Write",
    toolInput: { file_path: target }, cwd: r,
  };
  const out = guard(event, r, DEFAULT_CONFIG);
  assert.equal(out.receipt.meta.existedBefore, false);
  writeFileSync(target, "created by agent", "utf8");
  const res = restoreFromMeta(out.receipt.meta);
  assert.equal(res?.action, "removed");
  assert.equal(existsSync(target), false);
});
