// ─────────────────────────────────────────────────────────────────────────────
// Policy evaluation — one deterministic engine.
//
// Given a normalized tool event, the policy decides allow / ask / block. Glob
// matching is ported from conduit/recourse; command matching layers the built-in
// destructive patterns on top. Same inputs → same decision, every time, so the
// replay log is trustworthy.
// ─────────────────────────────────────────────────────────────────────────────

import type { LeashConfig } from "./config.ts";
import { BUILTIN_COMMAND_PATTERNS } from "./patterns.ts";
import type { Decision, RuleResult, ToolEvent } from "./types.ts";

/** `*` matches any run of chars; `**` is treated the same. Anchored full-match. */
export function matchesGlob(pattern: string, target: string): boolean {
  const normalized = pattern.replace(/\*\*/g, "*");
  const regex = new RegExp(
    `^${normalized.split("*").map(escapeRegExp).join(".*")}$`,
  );
  return regex.test(target);
}

function escapeRegExp(s: string): string {
  return s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
}

const FILE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const COMMAND_TOOLS = new Set(["Bash", "BashOutput", "Shell"]);

/** Extract the file path a tool event targets, if any. */
export function targetPath(event: ToolEvent): string | undefined {
  const fp = event.toolInput["file_path"] ?? event.toolInput["notebook_path"];
  return typeof fp === "string" ? fp : undefined;
}

/** Extract the shell command a tool event runs, if any. */
export function command(event: ToolEvent): string | undefined {
  const cmd = event.toolInput["command"];
  return typeof cmd === "string" ? cmd : undefined;
}

/** Normalized action label for the ledger, e.g. "bash:git" or "write:src/x.ts". */
export function normalizeAction(event: ToolEvent): string {
  const cmd = command(event);
  if (cmd !== undefined) {
    const verb = cmd.trim().split(/\s+/)[0] ?? "";
    return `bash:${verb}`;
  }
  const fp = targetPath(event);
  if (fp !== undefined) return `${event.toolName.toLowerCase()}:${fp}`;
  return `tool:${event.toolName.toLowerCase()}`;
}

export interface EvalState {
  /** Count of prior actions in this session (for the session cap). */
  priorActions: number;
}

export function evaluate(
  config: LeashConfig,
  event: ToolEvent,
  state: EvalState,
): RuleResult {
  // 1. Session cap gates everything.
  if (config.maxActionsPerSession > 0 && state.priorActions >= config.maxActionsPerSession) {
    return {
      decision: "block",
      rule: "session-cap",
      reason: `session action cap of ${config.maxActionsPerSession} reached — pausing the agent. Raise maxActionsPerSession or start a fresh session.`,
    };
  }

  // 2. Shell commands → destructive-pattern + config matching.
  const cmd = command(event);
  if (cmd !== undefined && COMMAND_TOOLS.has(event.toolName)) {
    return evaluateCommand(config, cmd);
  }

  // 3. File writes/edits → glob matching.
  const fp = targetPath(event);
  if (fp !== undefined && FILE_TOOLS.has(event.toolName)) {
    return evaluateFileWrite(config, fp);
  }

  // 4. Everything else (reads, searches, etc.) is allowed and just recorded.
  return { decision: "allow", rule: "default", reason: "non-mutating tool" };
}

function evaluateCommand(config: LeashConfig, cmd: string): RuleResult {
  // Explicit allow escape-hatch wins.
  for (const allow of config.allowCommands) {
    if (cmd.includes(allow)) {
      return { decision: "allow", rule: "allow-command", reason: `matched allowCommands "${allow}"` };
    }
  }

  if (config.blockCommands) {
    for (const p of BUILTIN_COMMAND_PATTERNS) {
      if (p.test.test(cmd)) {
        return { decision: p.decision, rule: `builtin:${p.id}`, reason: p.reason };
      }
    }
  }

  for (const src of config.extraBlockedPatterns) {
    try {
      if (new RegExp(src, "i").test(cmd)) {
        return { decision: "block", rule: "config-pattern", reason: `matched configured pattern /${src}/` };
      }
    } catch {
      // Ignore malformed user patterns rather than crash the hook.
    }
  }

  return { decision: "allow", rule: "default", reason: "command not flagged" };
}

function evaluateFileWrite(config: LeashConfig, fp: string): RuleResult {
  for (const glob of config.deny) {
    if (matchesGlob(glob, fp)) {
      return { decision: "block", rule: "deny-glob", reason: `path matches deny rule "${glob}"` };
    }
  }
  for (const glob of config.ask) {
    if (matchesGlob(glob, fp)) {
      return { decision: "ask", rule: "ask-glob", reason: `path matches ask rule "${glob}"` };
    }
  }
  const fallback: Decision = config.defaultFileDecision;
  return { decision: fallback, rule: "default", reason: `no glob matched; default is "${fallback}"` };
}
