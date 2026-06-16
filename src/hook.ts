// ─────────────────────────────────────────────────────────────────────────────
// Coding-agent hook handler.
//
// Invoked as `leash hook` from a PreToolUse hook, this reads the hook JSON from
// stdin, runs the guard, records a receipt, and tells the harness whether to
// allow, ask, or block the action.
//
// Block protocol: we emit the documented PreToolUse JSON decision on stdout AND
// exit non-zero with a stderr reason, so the action is stopped on every Claude
// Code version regardless of which channel it honors.
// ─────────────────────────────────────────────────────────────────────────────

import { guard } from "./guard.ts";
import type { ToolEvent } from "./types.ts";

interface ClaudeHookInput {
  session_id?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

function toEvent(input: ClaudeHookInput): ToolEvent {
  return {
    sessionId: input.session_id ?? "unknown",
    hookEvent: input.hook_event_name ?? "PreToolUse",
    toolName: input.tool_name ?? "Unknown",
    toolInput: input.tool_input ?? {},
    cwd: input.cwd ?? process.cwd(),
  };
}

/** Read a hook event from stdin, enforce policy, and exit with the verdict. */
export async function runHook(): Promise<never> {
  const raw = (await readStdin()).trim();
  let input: ClaudeHookInput = {};
  if (raw.length > 0) {
    try {
      input = JSON.parse(raw) as ClaudeHookInput;
    } catch {
      // Malformed input: fail open so we never wedge the user's agent.
      process.exit(0);
    }
  }

  const event = toEvent(input);
  const projectRoot = event.cwd;

  let outcome;
  try {
    outcome = guard(event, projectRoot);
  } catch {
    // Guard errors must never block the agent — fail open.
    process.exit(0);
  }

  const { decision, reason } = outcome.result;

  if (decision === "block") {
    emit("deny", `🐕 leash blocked this: ${reason}`);
    process.stderr.write(`🐕 leash blocked this: ${reason}\n`);
    process.exit(2);
  }

  if (decision === "ask") {
    emit("ask", `🐕 leash wants a human to confirm: ${reason}`);
    process.exit(0);
  }

  // allow: stay quiet, let the harness proceed.
  process.exit(0);
}

function emit(permissionDecision: "deny" | "ask" | "allow", permissionDecisionReason: string): void {
  const payload = {
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision,
      permissionDecisionReason,
    },
  };
  process.stdout.write(`${JSON.stringify(payload)}\n`);
}
