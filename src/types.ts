// ─────────────────────────────────────────────────────────────────────────────
// Core types for the leash guard.
// ─────────────────────────────────────────────────────────────────────────────

/** What the guard decides to do with a single agent action. */
export type Decision = "allow" | "ask" | "block";

/** A normalized tool call from a coding-agent hook event. */
export interface ToolEvent {
  sessionId: string;
  hookEvent: "PreToolUse" | "PostToolUse" | string;
  toolName: string;
  toolInput: Readonly<Record<string, unknown>>;
  cwd: string;
}

/** The outcome of evaluating one event against the policy. */
export interface RuleResult {
  decision: Decision;
  /** Identifier of the matched rule (e.g. "builtin:rm-rf", "deny-glob", "session-cap"). */
  rule: string;
  reason: string;
}

/** A single tamper-evident log entry. */
export interface Receipt {
  seq: number;
  ts: string;
  sessionId: string;
  hookEvent: string;
  toolName: string;
  /** Normalized action string, e.g. "bash:rm" or "write:src/index.ts". */
  action: string;
  /** Short human-readable summary of what the agent tried to do. */
  summary: string;
  decision: Decision;
  rule: string;
  reason: string;
  /** Snapshot bookkeeping for undo, byte counts, etc. */
  meta: ReceiptMeta;
  prevHash: string;
  hash: string;
}

export interface ReceiptMeta {
  /** Absolute path of a pre-write snapshot, if one was taken. */
  snapshotPath?: string;
  /** Absolute path of the file the action targets. */
  targetPath?: string;
  /** Whether the target existed before the action (drives undo behavior). */
  existedBefore?: boolean;
}

/** Fields that feed the hash. Excludes prevHash/hash themselves. */
export type ReceiptPayload = Omit<Receipt, "prevHash" | "hash">;

export function payloadOf(r: Receipt): ReceiptPayload {
  const { prevHash: _p, hash: _h, ...payload } = r;
  return payload;
}
