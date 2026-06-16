// ─────────────────────────────────────────────────────────────────────────────
// Pre-write snapshots — the engine behind `leash undo`.
//
// Before the agent writes or edits a file, leash copies the current bytes into
// .leash/snapshots/. The receipt records where the snapshot lives and whether the
// file existed beforehand. `leash undo` walks receipts newest-first and restores
// (or removes, if the file was freshly created) each touched file.
// ─────────────────────────────────────────────────────────────────────────────

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import type { ReceiptMeta } from "./types.ts";

export interface SnapshotResult extends ReceiptMeta {
  snapshotPath?: string;
  targetPath?: string;
  existedBefore?: boolean;
}

/**
 * Snapshot a file the agent is about to modify. Returns meta to attach to the
 * receipt. Never throws — snapshotting is best-effort and must not block a write.
 */
export function snapshotFile(
  projectRoot: string,
  snapshotDir: string,
  filePath: string,
): SnapshotResult {
  const abs = isAbsolute(filePath) ? filePath : resolve(projectRoot, filePath);
  const existedBefore = existsSync(abs);
  if (!existedBefore) {
    return { targetPath: abs, existedBefore: false };
  }
  try {
    const dir = join(projectRoot, snapshotDir);
    mkdirSync(dir, { recursive: true });
    const snap = join(dir, `${Date.now()}-${randomUUID().slice(0, 8)}-${basename(abs)}`);
    copyFileSync(abs, snap);
    return { snapshotPath: snap, targetPath: abs, existedBefore: true };
  } catch {
    return { targetPath: abs, existedBefore: true };
  }
}

export interface RestoreOutcome {
  targetPath: string;
  action: "restored" | "removed" | "skipped";
  detail?: string;
}

/** Reverse a single recorded change. */
export function restoreFromMeta(meta: ReceiptMeta): RestoreOutcome | undefined {
  const target = meta.targetPath;
  if (!target) return undefined;

  // File was created by the agent → undo means delete it.
  if (meta.existedBefore === false) {
    if (existsSync(target)) {
      try {
        rmSync(target, { force: true });
        return { targetPath: target, action: "removed" };
      } catch (e) {
        return { targetPath: target, action: "skipped", detail: String(e) };
      }
    }
    return { targetPath: target, action: "skipped", detail: "already absent" };
  }

  // File existed → restore its snapshot.
  if (meta.snapshotPath && existsSync(meta.snapshotPath)) {
    try {
      copyFileSync(meta.snapshotPath, target);
      return { targetPath: target, action: "restored" };
    } catch (e) {
      return { targetPath: target, action: "skipped", detail: String(e) };
    }
  }

  return { targetPath: target, action: "skipped", detail: "no snapshot available" };
}
