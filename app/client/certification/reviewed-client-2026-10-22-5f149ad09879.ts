/**
 * Reviewed facts for one ArenaNet client generation: the October 22, 2026
 * client as ArenaNet rebuilt it the same day.
 * Runtime certification never grants a capability from these facts alone:
 * the isolated semantic verifier re-derives every fact from the bytes first.
 */
import type { ClientGeneration } from "./reviewed-facts.js";
import type { KnownEnhancementBuild } from "./enhancement-build-model.js";
import { OCTOBER_22_FACTS } from "./reviewed-client-2026-10-22-ce3192033b14.js";

const OCTOBER_22_BUILD = OCTOBER_22_FACTS.builds[0]!;

// ArenaNet rebuilt the October 22 client the same day. Only two constant
// getters, one initialized-data block and the build ID changed, so every
// reviewed fact carries over; the exact identity and outputs are its own.
const BUILD: KnownEnhancementBuild = Object.freeze({
  ...OCTOBER_22_BUILD,
  sha256: "f5a3c6aa1ccc2613e3593dc3e4a188c2313f8134d2262f2173dae608fb5ee82f",
  outputSha256: Object.freeze({
    "features-3fffff": "978bf5fc86d416b249baa32b0334c5e295b8320636efee7fe36a582f8ec6e25c",
    "features-01": "3eb36b1c3d044a8a22ec16003764189296c4c837588632f0819d21071c50662c",
    "features-e01": "661e50c7b8f9a43dc32815e17c33249e48b7fa7d8daa5faf2080fe4157673f22",
    "features-601": "eee739427f079e581673db0f93386bb7218250d8d60010d800a79d7a1e700f5e",
    "features-200": "a1d4b9da26dd6b732d4311ff1507d4e9f6ea7489f969e94b073f1cb0adbea471",
    "features-202": "9d6cb3f6e689b093896d9b6ecef5028c4a9d0373826eb67b3c068a5a7c8c8425",
    "features-284": "4603f85c6b838dc54e5e286b8fb7f5bc9be8f7fa1007b1498c340fc0e58a5d07",
    "features-285": "ff665ebb4a36cb5964091f82001a6d004a0c08b17e2512222553760f61ce782b",
    "features-270": "a2a3062d64585365ec1a0f9b11a94d8eedaffacbf82ea92d2c1f36f65b1b524b",
    "features-2fc": "739e577df216da03ee60d65e970b539c9a61261ffe1f6a581cc2152e4f2b8bbc",
    "features-c200": "4b17091091e221f429ee72337f24dcff11da74b1f7f9149a9f79c6e70a121604",
    "features-c204": "aff5d5d6a0cbf894065be30b70d3aa282dbbc2d7e1843c1b902005ad47cd4f9d",
  }),
  buildId: 0x3dc01a82,
});

export const OCTOBER_22_REBUILD_FACTS: ClientGeneration = Object.freeze({
  id: "2026-10-22-5f149ad09879",
  builds: Object.freeze([BUILD]),
  memoryCodeSha256: "5fc5ebe2fc2de26fa9b3b2c00077cb7afd80a34a73d0f4dacaa6b81ba43dc0ed",
  // Every identity this client gives is already in the October 22 table.
  identities: Object.freeze({}),
});
