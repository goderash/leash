// ─────────────────────────────────────────────────────────────────────────────
// The guard: glue between a coding-agent hook event and the policy + ledger.
//
// Pure-ish core (`decide`) so it is trivially testable, plus a side-effecting
// `guard()` that snapshots, records the receipt, and returns the decision.
// ─────────────────────────────────────────────────────────────────────────────

import { join } from "node:path";
import { loadConfig, type LeashConfig } from "./config.ts";
import { Ledger } from "./ledger.ts";
import { command, evaluate, normalizeAction, targetPath } from "./policy.ts";
import { snapshotFile } from "./snapshot.ts";
import type { Receipt, ReceiptMeta, RuleResult, ToolEvent } from "./types.ts";

export interface GuardOutcome {
  result: RuleResult;
  receipt: Receipt;
}

/** Human one-liner describing the attempted action, for the log + viewer. */
export function summarize(event: ToolEvent): string {
  const cmd = command(event);
  if (cmd !== undefined) return cmd.length > 160 ? `${cmd.slice(0, 157)}...` : cmd;
  const fp = targetPath(event);
  if (fp !== undefined) return `${event.toolName} → ${fp}`;
  return event.toolName;
}

/**
 * Evaluate one event and record it. Snapshots the target file first (for undo)
 * when the action is an allowed/ask file write and snapshotting is enabled.
 */
export function guard(
  event: ToolEvent,
  projectRoot: string,
  configOverride?: LeashConfig,
): GuardOutcome {
  const config = configOverride ?? loadConfig(projectRoot);
  const ledger = new Ledger(join(projectRoot, config.logFile));

  const priorActions = ledger.count(event.sessionId);
  const result = evaluate(config, event, { priorActions });

  let meta: ReceiptMeta = {};
  const fp = targetPath(event);
  const isPreWrite = event.hookEvent === "PreToolUse" && fp !== undefined;
  if (config.snapshot && isPreWrite && result.decision !== "block") {
    meta = snapshotFile(projectRoot, config.snapshotDir, fp);
  } else if (fp !== undefined) {
    meta = { targetPath: fp };
  }

  const receipt = ledger.append({
    ts: new Date().toISOString(),
    sessionId: event.sessionId,
    hookEvent: event.hookEvent,
    toolName: event.toolName,
    action: normalizeAction(event),
    summary: summarize(event),
    decision: result.decision,
    rule: result.rule,
    reason: result.reason,
    meta,
  });

  return { result, receipt };
}
