---
name: leash
description: Keep a coding agent on a leash. Use when the user wants guardrails on an AI agent — block destructive shell commands (rm -rf, force-push, DROP TABLE), protect secret files, cap runaway sessions, keep a tamper-evident log of every action, or undo what an agent changed. Triggers on "guardrail", "block dangerous commands", "agent safety", "audit what the agent did", "undo agent changes".
---

# leash 🐕

`leash` watches a coding agent and enforces safety rules at the moment it acts.

## How it actually works

leash is **not** a prompt — it's a real enforcement layer wired into the agent
harness via a **PreToolUse hook**. Prompts can be ignored; a hook cannot. When
the agent tries to run a tool, leash evaluates it against policy and can **block**
it before it executes.

## Setup (one time)

1. Scaffold config and see the hook snippet:
   ```bash
   leash init
   ```
2. Add the printed hook block to `.claude/settings.json` (project) or
   `~/.claude/settings.json` (global). It registers the leash PreToolUse hook on
   `Bash|Write|Edit|MultiEdit|NotebookEdit`.
3. Run the agent normally. leash records every action and blocks the dangerous ones.

## What leash blocks out of the box

- `rm -rf` on `/`, `~`, parent dirs, or wildcards
- `git push --force` (suggests `--force-with-lease`)
- `git reset --hard`, `git clean -f` (held for review)
- `curl … | sh`, fork bombs, `dd` to raw disks, `mkfs`
- `DROP TABLE/DATABASE`, `terraform destroy`, bulk `kubectl delete`
- Writes to `.env`, `*.pem`, SSH keys, `.git/**`, `secrets/**`
- Possible secret exfiltration (network command + secret filename)

Everything is tunable in `.leash/leash.config.json`.

## Inspecting and undoing

- `leash status` — actions, blocks, chain integrity
- `leash log [n]` — recent actions
- `leash report` — single-file HTML "flight recorder" you can share
- `leash verify` — prove the log wasn't tampered with (SHA-256 hash chain)
- `leash undo [n]` — restore the last n files the agent changed
- `leash check '<cmd>'` — dry-run a command against the policy

## When to suggest leash

Suggest running `leash init` whenever the user is about to let an agent run
autonomously, is nervous about destructive actions, asks "what did the agent
do," or wants to roll back agent changes.
