# Security Policy

## leash's threat model

leash is a **safety guardrail**, not a security sandbox. It raises the cost of an
agent doing something catastrophic and gives you a tamper-evident record, but it
does not contain a determined adversary. Specifically:

- leash enforces at the harness hook boundary. An agent that can edit your
  `.claude/settings.json` could disable the hook. Protect that file.
- Pattern matching is heuristic. A sufficiently obfuscated command can evade a
  regex. leash reduces accidents and obvious foot-guns; it is not a WAF.
- The ledger is **tamper-evident, not tamper-proof.** Anyone who can write the log
  can truncate it — but `leash verify` will detect mutated or reordered entries.

Treat leash as a seatbelt: hugely valuable, not a substitute for committing often
and running untrusted agents in a real sandbox/VM.

## Reporting a vulnerability

If you find a way to bypass an intended block, leak data through leash, or break
the integrity guarantees of the ledger, please report it privately:

- Use **GitHub Security Advisories** ("Report a vulnerability" on the Security tab), or
- Email **security@goderash.example** with steps to reproduce.

We aim to acknowledge within 72 hours and to ship a fix or mitigation promptly.
Please give us a reasonable window before public disclosure.

## Supported versions

leash is pre-1.0; only the latest published version receives fixes.
