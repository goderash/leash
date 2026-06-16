<h1 align="center">🐕 leash</h1>

<p align="center">
  <strong>Keep your coding agent on a leash.</strong><br/>
  Block the destructive command before it runs. Cap the runaway session. Keep a
  tamper-evident record of everything your AI agent did — and undo it with one command.
</p>

<p align="center">
  <em>Works with Claude Code, Codex, Cursor, Gemini CLI, OpenCode — any harness with hooks.</em>
</p>

<p align="center">
  <code>rm -rf ~</code> · <code>git push --force</code> · <code>DROP TABLE</code> · <code>curl … | sh</code> · writes to <code>.env</code> — <strong>blocked, not apologized for.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/leash-agent"><img alt="npm" src="https://img.shields.io/npm/v/leash-agent?color=d4a574"></a>
  <a href="LICENSE"><img alt="license" src="https://img.shields.io/badge/license-MIT-yellow"></a>
  <img alt="node" src="https://img.shields.io/badge/node-%E2%89%A520-5ad19a">
  <img alt="dependencies" src="https://img.shields.io/badge/runtime%20deps-0-5ad19a">
  <a href="https://github.com/goderash/leash"><img alt="stars" src="https://img.shields.io/github/stars/goderash/leash?style=social"></a>
</p>

---

## The problem

You let your coding agent run autonomously. It's brilliant 95% of the time. The
other 5% it force-pushes over `main`, `rm -rf`s the wrong directory, overwrites
your `.env`, or burns $40 looping on a bad idea — and you find out **after.**

Prompts that say "please be careful" don't help. The agent can ignore a prompt.

**leash can't be ignored.** It's wired into the agent's *actual* enforcement
point — a `PreToolUse` hook — so it inspects every action **before** it executes
and stops the dangerous ones cold.

## What it does

- 🛑 **Blocks destructive actions** — `rm -rf /`/`~`/wildcards, `git push --force`,
  `git reset --hard`, `DROP TABLE`, `terraform destroy`, `mkfs`, fork bombs,
  `curl … | sh`, writes to `.env` / SSH keys / `.git`.
- ⏸️ **Caps runaway sessions** — set a hard ceiling on actions per session.
- 🧾 **Records a tamper-evident log** — every action chained with SHA-256, so
  `leash verify` proves nothing was edited, deleted, or reordered after the fact.
- ↩️ **Undo** — `leash undo` restores the last files the agent touched from snapshots.
- 🖥️ **Flight recorder** — `leash report` renders a shareable single-file HTML of
  everything the agent did.

It's **zero-dependency** (Node's built-in TypeScript + crypto) and **local-first**.
Your code and logs never leave your machine.

## Install

```bash
npm install -g leash-agent
```

Runs on stock Node 20+ — no flags, no runtime dependencies.

## Quick start

```bash
# from your project root
leash init
```

`leash init` scaffolds `.leash/` and prints a hook block. Drop it into
`.claude/settings.json` (project) or `~/.claude/settings.json` (global):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Write|Edit|MultiEdit|NotebookEdit",
        "hooks": [{ "type": "command", "command": "leash hook" }]
      }
    ]
  }
}
```

Now run your agent. That's it.

```text
🐕 leash blocked this: Force-push rewrites shared history. Use --force-with-lease, or push to a branch.
```

## See what your agent did

```bash
leash status          # actions, blocks, chain integrity
leash log 20          # recent actions
leash report          # → .leash/report.html  (the flight recorder)
leash verify          # prove the log wasn't tampered with
leash undo 3          # restore the last 3 files the agent changed
leash check 'rm -rf ~/repo'   # dry-run any command against your policy
```

## Configure (optional)

Everything works with safe defaults. To tune, edit `.leash/leash.config.json`:

```json
{
  "deny": ["**/.env", "**/*.pem", "**/.git/**", "infra/prod/**"],
  "ask": ["**/migrations/**"],
  "blockCommands": true,
  "allowCommands": ["git push --force-with-lease"],
  "maxActionsPerSession": 300
}
```

- `deny` / `ask` — file-path globs that block / hold writes for review
- `blockCommands` — toggle the built-in destructive-command patterns
- `allowCommands` — substrings that force-allow a command (escape hatch)
- `maxActionsPerSession` — hard ceiling on actions (`0` = unlimited)

## How it works

```
agent wants to act
        │
        ▼
  PreToolUse hook ──► leash policy ──► allow │ ask │ BLOCK
        │                   │
        │                   └──► append signed receipt to .leash/ledger.jsonl
        ▼
   (allowed actions proceed; snapshots taken first, so they're undoable)
```

The policy engine and SHA-256 hash chain are battle-tested primitives — the same
tamper-evident ledger pattern used in production agent-governance systems.

## Why "tamper-evident" matters

The log is a hash chain: each receipt's hash includes the previous one. If the
agent (or anyone) rewrites history to hide what it did, the chain breaks and
`leash verify` tells you exactly where. Your record of what the agent did is one
thing the agent can't quietly edit.

## Roadmap

- Per-command **token/$ budgets** (today: action-count caps)
- Codex / Cursor / Gemini CLI first-class adapters
- `leash watch` live TUI
- Hosted team dashboard: shared policies, org-wide audit log, anomaly alerts

## Run from a clone (no global install)

```bash
git clone https://github.com/goderash/leash && cd leash && npm install
npm run dev -- status
# hook command for settings.json:
#   node --experimental-strip-types --disable-warning=ExperimentalWarning /abs/path/leash/bin/leash.ts hook
```

## Contributing

New destructive-command patterns, harness adapters, and bug fixes are very
welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). Found a bypass? Please report it
privately per [SECURITY.md](SECURITY.md).

## License

MIT. Put your agents on a leash — not in a cage.

