// Source proof for the negative half of secret persistence: the two native
// Keychain items are the only persistent surface, and no browser/file fallback
// can silently become a second home.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  DISTRIBUTION_CHANNEL_CONFIG,
  DISTRIBUTION_CHANNELS,
} from "../../app/shared/distribution-channel.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (file: string) => readFileSync(path.join(root, file), "utf8");

function shippedSources(directory = "app"): string[] {
  return readdirSync(path.join(root, directory), { withFileTypes: true })
    .flatMap((entry) => {
      const child = `${directory}/${entry.name}`;
      // The UI packages were outside this scan before the move to app/.
      if (child === "app/ui") return [];
      if (entry.isDirectory()) return shippedSources(child);
      return /\.(?:ts|mts|mjs|tsx|cjs|js|jsx|mm)$/u.test(entry.name) ? [child] : [];
    });
}

const shippedApplication = shippedSources().map(read).join("\n");
// Geometry is the sole Core browser-storage owner. Remove only these exact calls
// from the secret-surface check; any new key, argument or storage API still fails.
const placementCalls = /localStorage\.(?:getItem\(storageKey\)|setItem\(storageKey, intent\)|removeItem\(storageKey\))/gu;
const withoutPlacementStorage = shippedSources().map(file => file === "app/renderer/hub-window.ts"
  ? read(file).replace(placementCalls, "approvedPlacementCall") : read(file)).join("\n");
const legacyFilenameOwners = shippedSources().filter((file) =>
  /credentials\.bin|steam-session\.bin/u.test(read(file)),
);
const native = read("app/native/host/host.mm");
const legacyCleanup = read("app/main/core/legacy-secret-cleanup.ts");

test("saved login has exactly two Data Protection Keychain items", () => {
  assert.match(native, /kSecUseDataProtectionKeychain/);
  assert.match(native, /kSecAttrAccessibleWhenUnlockedThisDeviceOnly/);
  // The items stay in the app's own default access group: a named group or
  // the legacy file Keychain would change which builds can read them.
  assert.doesNotMatch(native, /SecKeychain|SecAccess|kSecAttrAccessGroup/u);
  for (const channel of DISTRIBUTION_CHANNELS) {
    const bundleId = DISTRIBUTION_CHANNEL_CONFIG[channel].bundleId;
    assert.equal(
      (native.match(new RegExp(`@"${bundleId.replaceAll(".", "\\.")}"`, "gu")) ?? [])
        .length,
      1,
    );
  }
  assert.equal((native.match(/@"arena-net-credentials"/gu) ?? []).length, 1);
  assert.equal((native.match(/@"steam-session"/gu) ?? []).length, 1);
  assert.doesNotMatch(shippedApplication, /safeStorage|encryptString|decryptString/);
  assert.deepEqual(legacyFilenameOwners, [
    "app/main/core/legacy-secret-cleanup.ts",
  ]);
  assert.doesNotMatch(legacyCleanup, /recursive\s*:|clearStorageData|IndexedDB|IDBFS/);
  assert.match(legacyCleanup, /remove\(path\.join\(userData, filename\), \{ force: true \}\)/);
  assert.doesNotMatch(withoutPlacementStorage, /localStorage|sessionStorage/);
  assert.doesNotMatch(shippedApplication, /plaintext|fallbackKey|masterPassword/);
});

test("no build seeds the Steam token from the environment", () => {
  const readers = shippedSources().filter((file) =>
    /GW_STEAM_TOKEN|process\.env\.[A-Za-z_]*STEAM/u.test(read(file)),
  );
  assert.deepEqual(readers, []);
});
