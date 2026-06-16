// ─────────────────────────────────────────────────────────────────────────────
// leash CLI — hook, init, status, log, verify, report, undo, check.
//
// In dev, run via `node --experimental-strip-types bin/leash.ts <cmd>`.
// The published `leash` bin is the esbuild-bundled dist/leash.js (stock Node).
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_REL_PATH, DEFAULT_CONFIG, loadConfig } from "../src/config.ts";
import { Ledger } from "../src/ledger.ts";
import { renderReport } from "../src/report.ts";
import { restoreFromMeta } from "../src/snapshot.ts";
import { evaluate, normalizeAction } from "../src/policy.ts";
import { runHook } from "../src/hook.ts";
import type { Receipt, ToolEvent } from "../src/types.ts";

const ROOT = process.cwd();

const C = {
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
  bold: (s: string) => `\x1b[1m${s}\x1b[0m`,
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  amber: (s: string) => `\x1b[33m${s}\x1b[0m`,
  cyan: (s: string) => `\x1b[36m${s}\x1b[0m`,
};

function decisionColor(d: string): string {
  if (d === "block") return C.red(d.toUpperCase());
  if (d === "ask") return C.amber(d.toUpperCase());
  return C.green(d.toUpperCase());
}

function ledger(): Ledger {
  return new Ledger(join(ROOT, loadConfig(ROOT).logFile));
}

function cmdInit(): void {
  mkdirSync(join(ROOT, ".leash"), { recursive: true });
  const cfgPath = join(ROOT, CONFIG_REL_PATH);
  if (!existsSync(cfgPath)) {
    writeFileSync(cfgPath, `${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`, "utf8");
    console.log(`${C.green("✓")} wrote ${C.cyan(CONFIG_REL_PATH)}`);
  } else {
    console.log(`${C.dim("•")} ${CONFIG_REL_PATH} already exists, leaving it alone`);
  }
  console.log(`\n${C.bold("Add this to .claude/settings.json")} (project) or ~/.claude/settings.json (global):\n`);
  console.log(
    JSON.stringify(
      {
        hooks: {
          PreToolUse: [
            {
              matcher: "Bash|Write|Edit|MultiEdit|NotebookEdit",
              hooks: [{ type: "command", command: "leash hook" }],
            },
          ],
        },
      },
      null,
      2,
    ),
  );
  console.log(`\n${C.dim("`leash hook` requires a global install (npm i -g leash-agent).")}`);
  console.log(`${C.dim("Running from source instead? Use: node --experimental-strip-types --disable-warning=ExperimentalWarning " + join(ROOT, "bin/leash.ts") + " hook")}`);
  console.log(`\n${C.dim("Then run your agent. Try `leash status`, `leash report`, `leash undo`.")}`);
}

function cmdStatus(): void {
  const cfg = loadConfig(ROOT);
  const all = ledger().readAll();
  const v = ledger().verify();
  const blocked = all.filter((r) => r.decision === "block").length;
  const asked = all.filter((r) => r.decision === "ask").length;
  console.log(`${C.bold("🐕 leash")}  ${C.dim(`(${ROOT})`)}`);
  console.log(`  log         ${C.cyan(cfg.logFile)}`);
  console.log(`  actions     ${all.length}   ${C.red(`${blocked} blocked`)}   ${C.amber(`${asked} held`)}`);
  console.log(`  chain       ${v.ok ? C.green("✓ intact") : C.red(`✗ broken at #${v.firstBrokenIndex}`)}`);
  console.log(`  deny globs  ${cfg.deny.length}   ${C.dim(`builtin cmd patterns ${cfg.blockCommands ? "on" : "off"}`)}`);
  if (cfg.maxActionsPerSession > 0) console.log(`  session cap ${cfg.maxActionsPerSession}`);
}

function cmdLog(args: string[]): void {
  const n = Number(args[0] ?? "20") || 20;
  const all = ledger().readAll();
  const slice = all.slice(-n);
  for (const r of slice) printReceipt(r);
  if (all.length === 0) console.log(C.dim("no actions recorded yet"));
}

function printReceipt(r: Receipt): void {
  const time = r.ts.replace("T", " ").replace(/\.\d+Z$/, "");
  console.log(
    `${C.dim(`#${r.seq}`)} ${C.dim(time)} ${decisionColor(r.decision)} ${C.cyan(r.toolName)}  ${r.summary}`,
  );
  if (r.decision !== "allow") console.log(`     ${C.dim(`↳ ${r.reason} (${r.rule})`)}`);
}

function cmdVerify(): void {
  const v = ledger().verify();
  if (v.ok) {
    console.log(`${C.green("✓")} chain intact — ${ledger().readAll().length} receipts, none mutated or removed`);
    process.exit(0);
  }
  console.log(`${C.red("✗ TAMPER DETECTED")} — chain breaks at receipt #${v.firstBrokenIndex}`);
  process.exit(1);
}

function cmdReport(args: string[]): void {
  const out = args[0] ?? join(ROOT, ".leash", "report.html");
  const all = ledger().readAll();
  const html = renderReport(all, ledger().verify());
  writeFileSync(out, html, "utf8");
  console.log(`${C.green("✓")} wrote ${C.cyan(out)} ${C.dim(`(${all.length} actions)`)}`);
}

function cmdUndo(args: string[]): void {
  const n = Number(args[0] ?? "1") || 1;
  const all = ledger().readAll();
  const touched = all.filter((r) => r.meta && r.meta.targetPath).reverse().slice(0, n);
  if (touched.length === 0) {
    console.log(C.dim("nothing to undo — no file changes recorded"));
    return;
  }
  for (const r of touched) {
    const res = restoreFromMeta(r.meta);
    if (!res) continue;
    const mark = res.action === "skipped" ? C.amber("skipped") : C.green(res.action);
    console.log(`  ${mark}  ${res.targetPath}${res.detail ? C.dim(` (${res.detail})`) : ""}`);
  }
  console.log(C.dim(`\nundo is best-effort from snapshots; commit often for a real safety net.`));
}

function cmdCheck(args: string[]): void {
  const cmd = args.join(" ");
  if (!cmd) {
    console.log("usage: leash check '<shell command>'");
    process.exit(1);
  }
  const event: ToolEvent = {
    sessionId: "cli-check",
    hookEvent: "PreToolUse",
    toolName: "Bash",
    toolInput: { command: cmd },
    cwd: ROOT,
  };
  const r = evaluate(loadConfig(ROOT), event, { priorActions: 0 });
  console.log(`${decisionColor(r.decision)}  ${C.dim(normalizeAction(event))}`);
  console.log(`  ${r.reason} ${C.dim(`(${r.rule})`)}`);
  process.exit(r.decision === "block" ? 1 : 0);
}

function help(): void {
  console.log(`${C.bold("🐕 leash")} — keep your coding agent on a leash

${C.bold("usage:")} leash <command>

  ${C.cyan("init")}              scaffold .leash/ + print the hook snippet
  ${C.cyan("hook")}              (internal) run as a PreToolUse hook — reads stdin
  ${C.cyan("status")}            summary: actions, blocks, chain integrity
  ${C.cyan("log")} [n]           show the last n actions (default 20)
  ${C.cyan("verify")}            verify the tamper-evident hash chain
  ${C.cyan("report")} [out.html] write the single-file HTML flight recorder
  ${C.cyan("undo")} [n]          restore the last n changed files from snapshots
  ${C.cyan("check")} '<cmd>'     dry-run a shell command against the policy
  ${C.cyan("help")}              this

${C.dim("docs: https://github.com/goderash/leash")}`);
}

const [, , command = "help", ...rest] = process.argv;
switch (command) {
  case "hook": await runHook(); break;
  case "init": cmdInit(); break;
  case "status": cmdStatus(); break;
  case "log": cmdLog(rest); break;
  case "verify": cmdVerify(); break;
  case "report": cmdReport(rest); break;
  case "undo": cmdUndo(rest); break;
  case "check": cmdCheck(rest); break;
  default: help();
}
