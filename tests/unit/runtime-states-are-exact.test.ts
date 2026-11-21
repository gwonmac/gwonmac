/** Compile-time and runtime proofs for exact renderer-facing state unions. */
import assert from "node:assert/strict";
import test from "node:test";
import type { SteamTokenResult } from "../../app/shared/contracts.js";
import type {
  PublishedCompanionState,
} from "../../app/renderer/companion-snapshot.js";

const unsupported = {
  status: "unsupported",
} satisfies PublishedCompanionState;

const refused = {
  token: null,
  reason: "cancelled",
} satisfies SteamTokenResult;

// @ts-expect-error a refusal and a token cannot describe one Steam result.
const tokenWithRefusal: SteamTokenResult = { token: "secret", reason: "failed" };
const unsupportedWithTick: PublishedCompanionState = {
  status: "unsupported",
  // @ts-expect-error an unsupported installation cannot invent snapshot fields.
  tickCount: 1,
};

test("runtime states admit only their complete valid phases", () => {
  assert.equal(unsupported.status, "unsupported");
  assert.deepEqual(refused, { token: null, reason: "cancelled" });
  assert.equal(tokenWithRefusal.token, "secret");
  assert.equal(unsupportedWithTick.status, "unsupported");
});
