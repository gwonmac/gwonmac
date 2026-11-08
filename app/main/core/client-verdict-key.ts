/**
 * This install's key for the signed client-verdict record: 32 random bytes in
 * one Data Protection Keychain slot, created on first use.
 *
 * The key only authenticates the record; it protects no account. Losing it
 * (a volatile Keychain at quit, a refusal, a corrupt item) costs one more
 * verifier pass, never a feature, so every failure here reads as "no key".
 * The bytes are never logged or exported.
 */
import { randomBytes } from "node:crypto";
import {
  CLIENT_VERDICT_KEY_SLOT,
  type NativeKeychain,
} from "./native-keychain.js";

const KEY_BYTES = 32;

/** Load the install key, creating it once; null when the Keychain cannot hold it. */
export function clientVerdictKey(
  keychain: NativeKeychain,
): () => Promise<Uint8Array | null> {
  let pending: Promise<Uint8Array | null> | null = null;
  return () => {
    pending ??= (async () => {
      try {
        const stored = await keychain.load(CLIENT_VERDICT_KEY_SLOT);
        if (stored?.byteLength === KEY_BYTES) return new Uint8Array(stored);
        stored?.fill(0);
        await keychain.save(CLIENT_VERDICT_KEY_SLOT, randomBytes(KEY_BYTES));
        // Another instance may have saved its own key at the same moment; use
        // whatever the Keychain kept, so both sign with one key.
        const saved = await keychain.load(CLIENT_VERDICT_KEY_SLOT);
        return saved?.byteLength === KEY_BYTES ? new Uint8Array(saved) : null;
      } catch {
        return null;
      }
    })();
    return pending;
  };
}
