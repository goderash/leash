# Contributing to leash 🐕

Thanks for helping keep coding agents on a leash. Contributions of all sizes are
welcome — new destructive-command patterns, harness adapters, bug fixes, docs.

## Ground rules

- **Fail open, never closed.** A bug in leash must never wedge someone's agent or
  silently lose data. When in doubt, allow the action and log it.
- **Zero runtime dependencies.** The core ships with none and we intend to keep it
  that way. Build/test tooling (esbuild, typescript) is fine as `devDependencies`.
- **Determinism.** Same input → same decision, forever. The replay log depends on it.
- **Small files.** Keep modules focused (< 400 lines). One concern per file.

## Dev setup

```bash
git clone https://github.com/goderash/leash
cd leash
npm install            # installs devDeps + builds dist via `prepare`
npm test               # 17 tests, runs on Node 22+ (uses --experimental-strip-types)
npm run typecheck      # strict tsc, no emit
npm run dev -- status  # run the CLI from source
npm run build          # bundle dist/leash.js (stock-Node, no flags)
```

> Source is TypeScript run directly via Node's type-stripping (Node 22+). The
> published `leash` bin is the esbuild-bundled `dist/leash.js`, which runs on
> stock Node 20+ with no flags.

## Adding a destructive-command pattern

1. Add an entry to [`src/patterns.ts`](src/patterns.ts) with a stable `id`, a
   tight `RegExp`, a `decision` (`block` or `ask`), and a plain-English `reason`.
2. Add a test in [`tests/policy.test.ts`](tests/policy.test.ts) proving it blocks
   the dangerous form **and** allows a benign neighbor (avoid false positives —
   they're how a guardrail loses trust).
3. `npm test`.

A good pattern is **high-signal**: something you almost never want an autonomous
agent doing. If reasonable people run it routinely, make it `ask`, not `block`.

## Pull requests

- Branch from `main`, keep PRs focused.
- `npm run typecheck && npm test` must pass.
- Use Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Describe the user-facing behavior change and how you verified it.

## Reporting security issues

Please don't file public issues for vulnerabilities — see [SECURITY.md](SECURITY.md).
