import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CONFIG } from "../src/config.ts";
import { evaluate, matchesGlob, normalizeAction } from "../src/policy.ts";
import type { ToolEvent } from "../src/types.ts";

function bash(command: string): ToolEvent {
  return { sessionId: "s", hookEvent: "PreToolUse", toolName: "Bash", toolInput: { command }, cwd: "/repo" };
}
function write(file_path: string): ToolEvent {
  return { sessionId: "s", hookEvent: "PreToolUse", toolName: "Write", toolInput: { file_path }, cwd: "/repo" };
}
const state = { priorActions: 0 };

test("blocks rm -rf on a parent/home/root path", () => {
  assert.equal(evaluate(DEFAULT_CONFIG, bash("rm -rf ~/projects"), state).decision, "block");
  assert.equal(evaluate(DEFAULT_CONFIG, bash("rm -rf /"), state).decision, "block");
});

test("blocks git force-push but allows --force-with-lease", () => {
  assert.equal(evaluate(DEFAULT_CONFIG, bash("git push --force origin main"), state).decision, "block");
  assert.equal(evaluate(DEFAULT_CONFIG, bash("git push -f"), state).decision, "block");
  assert.equal(evaluate(DEFAULT_CONFIG, bash("git push --force-with-lease"), state).decision, "allow");
});

test("holds destructive-but-recoverable commands for review", () => {
  assert.equal(evaluate(DEFAULT_CONFIG, bash("git reset --hard HEAD~3"), state).decision, "ask");
  assert.equal(evaluate(DEFAULT_CONFIG, bash("terraform destroy"), state).decision, "ask");
});

test("blocks DROP TABLE and fork bombs", () => {
  assert.equal(evaluate(DEFAULT_CONFIG, bash("psql -c 'DROP TABLE users'"), state).decision, "block");
  assert.equal(evaluate(DEFAULT_CONFIG, bash(":(){ :|:& };:"), state).decision, "block");
});

test("allows ordinary commands", () => {
  assert.equal(evaluate(DEFAULT_CONFIG, bash("npm test"), state).decision, "allow");
  assert.equal(evaluate(DEFAULT_CONFIG, bash("git status"), state).decision, "allow");
  assert.equal(evaluate(DEFAULT_CONFIG, bash("rm -rf node_modules/.cache"), state).decision, "allow");
});

test("blocks writes to secret files", () => {
  assert.equal(evaluate(DEFAULT_CONFIG, write("apps/api/.env"), state).decision, "block");
  assert.equal(evaluate(DEFAULT_CONFIG, write("deploy/id_rsa"), state).decision, "block");
  assert.equal(evaluate(DEFAULT_CONFIG, write("src/index.ts"), state).decision, "allow");
});

test("session cap blocks once exceeded", () => {
  const cfg = { ...DEFAULT_CONFIG, maxActionsPerSession: 5 };
  assert.equal(evaluate(cfg, bash("npm test"), { priorActions: 5 }).decision, "block");
  assert.equal(evaluate(cfg, bash("npm test"), { priorActions: 4 }).decision, "allow");
});

test("allowCommands escape hatch overrides a block", () => {
  const cfg = { ...DEFAULT_CONFIG, allowCommands: ["rm -rf ~/scratch"] };
  assert.equal(evaluate(cfg, bash("rm -rf ~/scratch"), state).decision, "allow");
});

test("matchesGlob handles ** and *", () => {
  assert.ok(matchesGlob("**/.env", "a/b/.env"));
  assert.ok(matchesGlob("**/secrets/**", "x/secrets/y/z.txt"));
  assert.ok(!matchesGlob("**/.env", "a/b/.environment"));
});

test("normalizeAction labels commands and writes", () => {
  assert.equal(normalizeAction(bash("git push")), "bash:git");
  assert.equal(normalizeAction(write("src/x.ts")), "write:src/x.ts");
});
