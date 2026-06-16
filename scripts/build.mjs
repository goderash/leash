// Bundle the CLI into a single stock-Node file for npm distribution.
// Source stays TypeScript (runs directly via `node --experimental-strip-types`
// in dev); the published `leash` bin is plain JS that needs no flags.

import { build } from "esbuild";
import { chmodSync } from "node:fs";

await build({
  entryPoints: ["bin/leash.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: "dist/leash.js",
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
});

chmodSync("dist/leash.js", 0o755);
console.log("✓ built dist/leash.js");
