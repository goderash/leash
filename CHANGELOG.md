# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres
to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- Per-command token/$ budgets (today: action-count caps)
- First-class Codex / Cursor / Gemini CLI adapters
- `leash watch` live TUI
- Hosted team dashboard: shared policies, org-wide audit log, anomaly alerts

## [0.1.0] - 2026-06-16

### Added
- PreToolUse hook (`leash hook`) that blocks, holds, or allows agent actions.
- 16 built-in destructive-command patterns: `rm -rf` (root/home/wildcard),
  `git push --force`, `git reset --hard`, `git clean -f`, `curl … | sh`, fork
  bombs, `dd` to raw disks, `mkfs`, `chmod 777`, `DROP TABLE/DATABASE`,
  `terraform destroy`, bulk `kubectl delete`, `aws s3 rb --force`, `npm publish`,
  secret-exfiltration heuristics.
- Glob-based file-write policy with `deny` / `ask` lists; secrets denied by default.
- Per-session action cap (`maxActionsPerSession`).
- Tamper-evident, hash-chained JSONL ledger with `leash verify`.
- Pre-write snapshots and `leash undo`.
- Single-file HTML flight recorder (`leash report`).
- CLI: `hook`, `init`, `status`, `log`, `verify`, `report`, `undo`, `check`.
- Claude Code Skill definition and example `settings.json` wiring.
- Zero runtime dependencies; published bin runs on stock Node 20+.

[Unreleased]: https://github.com/goderash/leash/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/goderash/leash/releases/tag/v0.1.0
