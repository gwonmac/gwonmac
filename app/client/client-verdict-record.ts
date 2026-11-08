/**
 * The one stored verifier pass of this install: the complete output of the
 * last pass that finished, for exactly one official client generation, signed
 * with this install's key.
 *
 * The record is a cache of the verifier's own words, not a source of
 * authority. It counts only when its MAC authenticates with the install key
 * and its key matches the official WASM and JS hashes, the verifier, pass and
 * stage ABIs, and the app version; then its contents re-enter the same boundary a
 * fresh answer passes. Anything else (no key, another build, another app
 * version, a bad MAC, malformed JSON) reads as no record, and the build is
 * proved again.
 *
 * The MAC covers the exact payload string, so no canonical-JSON question can
 * arise between writing and reading. Another process running as this user can
 * replace the file, but without the Keychain key it cannot produce a MAC.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { readFile, rm, stat } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { writeAtomicJson } from "../main/core/atomic-file.js";

/** What a stored pass must have been made for. Any difference is a miss. */
export interface ClientVerdictRecordKey {
  readonly officialWasmSha256: string;
  readonly officialJsSha256: string;
  readonly verifierAbi: number;
  readonly passAbi: number;
  /** Every stage's transform or verifier ABI, by stage. */
  readonly stageAbis: Readonly<Record<string, number>>;
  readonly appVersion: string;
}

/** A pass result is several builds per launch profile; far below this. */
const MAX_RECORD_BYTES = 8 * 1024 * 1024;
const MAC = /^[0-9a-f]{64}$/;

function mac(installKey: Uint8Array, payload: string): Buffer {
  return createHmac("sha256", installKey).update(payload, "utf8").digest();
}

/**
 * The stored pass result for `key`, or null. The value is still untrusted
 * verifier output: the caller validates it exactly like a fresh message.
 */
export async function readClientVerdictRecord(
  recordPath: string,
  key: ClientVerdictRecordKey,
  installKey: Uint8Array,
): Promise<unknown> {
  try {
    if ((await stat(recordPath)).size > MAX_RECORD_BYTES) return null;
    const stored: unknown = JSON.parse(await readFile(recordPath, "utf8"));
    if (
      !stored || typeof stored !== "object"
      || !("payload" in stored) || typeof stored.payload !== "string"
      || !("mac" in stored) || typeof stored.mac !== "string" || !MAC.test(stored.mac)
    ) return null;
    if (!timingSafeEqual(mac(installKey, stored.payload), Buffer.from(stored.mac, "hex"))) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored.payload);
    if (!parsed || typeof parsed !== "object" || !("key" in parsed) || !("result" in parsed)) {
      return null;
    }
    return isDeepStrictEqual(parsed.key, key) ? parsed.result ?? null : null;
  } catch {
    return null;
  }
}

/** Replace the record with one complete pass for `key`. */
export async function writeClientVerdictRecord(
  recordPath: string,
  key: ClientVerdictRecordKey,
  result: unknown,
  installKey: Uint8Array,
): Promise<void> {
  const payload = JSON.stringify({ key, result });
  await writeAtomicJson(recordPath, {
    payload,
    mac: mac(installKey, payload).toString("hex"),
  });
}

/** Forget the record, for a record that authenticated but failed validation. */
export async function discardClientVerdictRecord(recordPath: string): Promise<void> {
  await rm(recordPath, { force: true });
}
