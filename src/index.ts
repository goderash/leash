// Public API surface for programmatic use (e.g. building a hosted control plane
// on top of the same engine, or wiring leash into a non-Claude harness).

export * from "./types.ts";
export * from "./config.ts";
export * from "./patterns.ts";
export * from "./policy.ts";
export * from "./ledger.ts";
export * from "./snapshot.ts";
export * from "./guard.ts";
export {
  canonicalJson,
  computeChainHash,
  sha256Hex,
  verifyChain,
  GENESIS_PREV_HASH,
} from "./hash.ts";
