// ─────────────────────────────────────────────────────────────────────────────
// Configuration: loaded from .leash/leash.config.json in the project root.
//
// Everything has a safe default, so leash works the moment the hook is wired —
// no config file required. Drop a leash.config.json to tune.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Decision } from "./types.ts";

export interface LeashConfig {
  /** Decision for file writes/edits that match no glob. */
  defaultFileDecision: Decision;
  /** File-path globs that are blocked outright (e.g. secrets, lockfiles). */
  deny: readonly string[];
  /** File-path globs that require human approval. */
  ask: readonly string[];
  /** Enable the built-in destructive-command patterns for Bash tools. */
  blockCommands: boolean;
  /** Extra raw regex sources (strings) to block on Bash commands. */
  extraBlockedPatterns: readonly string[];
  /** Substrings that, if present in a command, force-allow it (escape hatch). */
  allowCommands: readonly string[];
  /** Hard cap on agent actions per session. 0 disables. */
  maxActionsPerSession: number;
  /** Snapshot files before Write/Edit so `leash undo` can restore them. */
  snapshot: boolean;
  /** Relative path (from project root) of the append-only ledger. */
  logFile: string;
  /** Directory (from project root) where pre-write snapshots are stored. */
  snapshotDir: string;
}

export const DEFAULT_CONFIG: LeashConfig = {
  defaultFileDecision: "allow",
  deny: [
    "**/.env",
    "**/.env.*",
    "**/*.pem",
    "**/id_rsa",
    "**/id_ed25519",
    "**/.git/**",
    "**/secrets/**",
    "**/.aws/**",
  ],
  ask: [],
  blockCommands: true,
  extraBlockedPatterns: [],
  allowCommands: [],
  maxActionsPerSession: 0,
  snapshot: true,
  logFile: ".leash/ledger.jsonl",
  snapshotDir: ".leash/snapshots",
};

export const CONFIG_REL_PATH = ".leash/leash.config.json";

/** Load config from disk, deep-merging onto defaults. Never throws. */
export function loadConfig(projectRoot: string): LeashConfig {
  try {
    const raw = readFileSync(join(projectRoot, CONFIG_REL_PATH), "utf8");
    const parsed = JSON.parse(raw) as Partial<LeashConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return DEFAULT_CONFIG;
  }
}
