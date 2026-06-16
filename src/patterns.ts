// ─────────────────────────────────────────────────────────────────────────────
// Built-in destructive-command patterns.
//
// These are the commands that turn "the agent helped" into "the agent deleted my
// repo / force-pushed over main / leaked a key." Each pattern carries a default
// decision (block or ask) and a plain-English reason shown to the agent.
//
// Curated to be high-signal: every entry here is something you almost never want
// an autonomous agent doing without a human looking. Tune via leash.config.json.
// ─────────────────────────────────────────────────────────────────────────────

import type { Decision } from "./types.ts";

export interface CommandPattern {
  id: string;
  test: RegExp;
  decision: Decision;
  reason: string;
}

export const BUILTIN_COMMAND_PATTERNS: readonly CommandPattern[] = [
  {
    id: "rm-rf-root-or-home",
    test: /\brm\s+\S*(?:rf|fr|r\S*f|f\S*r)\S*\s+(?:[^\n]*\s)?(\/|~|\$HOME|\.\.)/i,
    decision: "block",
    reason: "Recursive force-delete targeting /, ~, $HOME, or a parent dir. This is almost always a mistake.",
  },
  {
    id: "rm-rf-wildcard",
    test: /\brm\s+(-[a-z]*r[a-z]*f|-rf|-fr)\b[^\n]*[\s/]\*(\s|$)/i,
    decision: "block",
    reason: "Recursive force-delete with a wildcard. One wrong glob wipes more than intended.",
  },
  {
    id: "git-force-push",
    test: /\bgit\s+push\b[^\n]*(\s--force(\s|$)|\s-f(\s|$))/i,
    decision: "block",
    reason: "Force-push rewrites shared history. Use --force-with-lease, or push to a branch.",
  },
  {
    id: "git-reset-hard",
    test: /\bgit\s+reset\s+--hard\b/i,
    decision: "ask",
    reason: "git reset --hard discards uncommitted work irreversibly.",
  },
  {
    id: "git-clean-force",
    test: /\bgit\s+clean\b[^\n]*-[a-z]*f/i,
    decision: "ask",
    reason: "git clean -f permanently deletes untracked files.",
  },
  {
    id: "curl-pipe-shell",
    test: /\b(curl|wget)\b[^\n|]*\|\s*(sudo\s+)?(sh|bash|zsh)\b/i,
    decision: "ask",
    reason: "Piping a downloaded script straight into a shell runs unvetted remote code.",
  },
  {
    id: "fork-bomb",
    test: /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:&?\s*\}\s*;\s*:/,
    decision: "block",
    reason: "Fork bomb. This will hang the machine.",
  },
  {
    id: "dd-to-disk",
    test: /\bdd\b[^\n]*\bof=\/dev\/(sd|nvme|disk|hd)/i,
    decision: "block",
    reason: "dd writing to a raw disk device can destroy a drive.",
  },
  {
    id: "mkfs",
    test: /\bmkfs(\.[a-z0-9]+)?\b/i,
    decision: "block",
    reason: "Formatting a filesystem is destructive and irreversible.",
  },
  {
    id: "chmod-777-root",
    test: /\bchmod\s+(-[a-z]*\s+)*777\b[^\n]*\s+(\/|~)(\s|$)/i,
    decision: "ask",
    reason: "chmod 777 on a top-level path is a security risk.",
  },
  {
    id: "drop-database",
    test: /\bdrop\s+(database|table|schema)\b/i,
    decision: "block",
    reason: "Dropping a database/table destroys data. Should never be autonomous.",
  },
  {
    id: "kubectl-delete-all",
    test: /\bkubectl\s+delete\b[^\n]*(--all\b|\bns\b|\bnamespace\b)/i,
    decision: "ask",
    reason: "Bulk kubectl delete can take down a namespace or cluster.",
  },
  {
    id: "terraform-destroy",
    test: /\bterraform\s+destroy\b/i,
    decision: "ask",
    reason: "terraform destroy tears down real infrastructure.",
  },
  {
    id: "aws-s3-rb",
    test: /\baws\s+s3\s+rb\b[^\n]*--force/i,
    decision: "block",
    reason: "Force-removing an S3 bucket deletes its contents.",
  },
  {
    id: "npm-publish",
    test: /\b(npm|pnpm|yarn|bun)\s+publish\b/i,
    decision: "ask",
    reason: "Publishing a package is public and hard to undo.",
  },
  {
    id: "secret-exfil-env",
    test: /\b(curl|wget|nc|ncat)\b[^\n]*(\.env|id_rsa|credentials|secret)/i,
    decision: "ask",
    reason: "Network command referencing a secret file — possible exfiltration.",
  },
];
