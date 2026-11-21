/** Exact real-client qualification for both shipped transform profiles. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareClientModule, type PreparedClientModule } from
  "../../app/client/certification/client-module.js";
import {
  enhancementOutputSha256,
} from "../../app/client/certification/enhancement-builds.js";
import { wasmEvidence, functionBodySha256 } from "../../app/client/certification/wasm-evidence.js";
import { deriveSoundDecodeRepairStage } from "../../app/client/certification/sound-decode-repair.js";
import { transformEnhancementWasm } from
  "../../app/client/certification/enhancement-transform.js";
import { deriveFriendObserverCertificate } from
  "../../app/client/certification/friend-observer-certificate.js";
import { deriveFriendObserverBuild } from
  "../../app/client/certification/friend-observer-transform.js";
import {
  isLocalClientVerification,
  verifyLocalClientBytes,
} from "../../app/client/certification/local-client-verifier.js";
import {
  deriveNativeDoubleClickBuild,
  isDerivedNativeDoubleClickBuild,
} from "../../app/client/certification/native-double-click.js";
import { deriveCartographySpikeBuild } from
  "../../app/client/certification/cartography-spike-verifier.js";
import { rewriteTemplateSaveWasm } from
  "../../app/client/certification/template-save-compat.js";
import {
  enhancementCapabilityProfile,
  RELEASE_ENHANCEMENT_CAPABILITIES,
} from "../../app/shared/enhancement-contracts.js";

const sha256 = (bytes: Uint8Array | string): string =>
  createHash("sha256").update(bytes).digest("hex");

test("every shipped runtime profile reproduces the real client chain", {
  timeout: 120_000,
}, async () => {
  const artifact = process.env.GW_CLIENT_WASM;
  assert.ok(artifact, "GW_CLIENT_WASM must name the real Gw.jspi.wasm artifact");
  const official = new Uint8Array(await readFile(artifact));
  const verified = verifyLocalClientBytes(official);
  assert.equal(isLocalClientVerification(verified, sha256(official)), true);
  const templateBuild = verified.templateSaveBuild;
  assert.ok(templateBuild, "the real client must pass file compatibility proof");
  const template = rewriteTemplateSaveWasm(official, templateBuild);
  assert.ok(
    deriveFriendObserverCertificate(template),
    "friend observation must prove against the template-save predecessor",
  );
  const enhancementBuild = verified.enhancementBuild;
  assert.ok(enhancementBuild, "the file output must pass feature proof");
  const templateDoubleClick = deriveNativeDoubleClickBuild(template);
  assert.ok(templateDoubleClick, "the complete native input route must prove");
  assert.equal(
    isDerivedNativeDoubleClickBuild(templateDoubleClick, sha256(template)),
    true,
  );
  for (const [launch, capabilities] of Object.entries(
    RELEASE_ENHANCEMENT_CAPABILITIES,
  )) {
    const profile = enhancementCapabilityProfile(capabilities);
    assert.ok(profile, `${launch} release capabilities must form a profile`);
    const profileVerification = verifyLocalClientBytes(official, capabilities);
    const profileBuild = profileVerification.enhancementBuild;
    assert.ok(profileBuild, `profile ${profile} must prove independently`);
    const enhanced = transformEnhancementWasm(template, profileBuild, capabilities);
    const nativeInput = wasmEvidence(template)!.moduleView();
    const nativeOutput = wasmEvidence(enhanced)!.moduleView();
    const hasHud = nativeOutput.exports.some((entry) => entry.name === "gwonmac_hud_label");
    assert.equal(hasHud, capabilities.nativeHudRendering,
      `${launch} must install native HUD only for a selected display owner`);
    if (!hasHud) {
      for (const index of [6490, 6492, 6585]) {
        assert.equal(functionBodySha256(nativeOutput, index), functionBodySha256(nativeInput, index),
          `${launch} must preserve original UI collection and destruction`);
      }
    }
    assert.ok(
      deriveFriendObserverCertificate(enhanced),
      `friend observation must prove against the ${profile} predecessor`,
    );
    assert.equal(
      sha256(enhanced),
      enhancementOutputSha256(profileBuild, capabilities),
    );
    const doubleClick = deriveNativeDoubleClickBuild(enhanced);
    assert.equal(
      isDerivedNativeDoubleClickBuild(doubleClick, sha256(enhanced)),
      true,
      `profile ${profile} must independently prove native double-click`,
    );

    const cacheRoot = await mkdtemp(join(tmpdir(), `gwonmac-${launch}-chain-`));
    const prepare = async (friendProof = true): Promise<PreparedClientModule> => prepareClientModule({
      officialWasmPath: artifact,
      officialSha256: sha256(official),
      certification: {
        templateSaveBuild: profileVerification.templateSaveBuild,
        enhancementBuild: profileBuild,
      },
      enhancementCapabilities: capabilities,
      compatibilityCacheRoot: join(cacheRoot, "file"),
      enhancementCacheRoot: join(cacheRoot, "enhancement"),
      friendObserver: {
        cacheRoot: join(cacheRoot, "friends"),
        verifyLocally: async ({ wasmPath, inputSha256 }) => {
          const input = new Uint8Array(await readFile(wasmPath));
          assert.equal(sha256(input), inputSha256);
          return friendProof ? deriveFriendObserverBuild(input) : null;
        },
      },
      ...(launch === "tools" ? { cartographySpike: {
        cacheRoot: join(cacheRoot, "cartography"),
        verifyLocally: async ({ wasmPath, inputSha256 }) => {
          const input = new Uint8Array(await readFile(wasmPath));
          assert.equal(sha256(input), inputSha256);
          return deriveCartographySpikeBuild(input);
        },
      },
      } : {}),
      nativeDoubleClickCacheRoot: join(cacheRoot, "double-click"),
      soundDecodeRepair: {
        cacheRoot: join(cacheRoot, "sound-decode-repair"),
        verifyLocally: async ({ wasmPath, inputSha256 }) => {
          const input = new Uint8Array(await readFile(wasmPath));
          assert.equal(sha256(input), inputSha256);
          return deriveSoundDecodeRepairStage(input)?.build ?? null;
        },
      },
    }, async ({ wasmPath, inputSha256 }) => {
      const input = new Uint8Array(await readFile(wasmPath));
      assert.equal(sha256(input), inputSha256);
      return deriveNativeDoubleClickBuild(input);
    });
    try {
      const prepared = await prepare();
      assert.equal(prepared.failure, null);
      assert.equal(prepared.friendObserver.status, capabilities.travelAction ? "active" : "disabled");
      assert.deepEqual(prepared.cartography, { status: launch === "tools" ? "active" : "disabled" });
      const finalExports = wasmEvidence(new Uint8Array(await readFile(prepared.wasmPath)))!.moduleView().exports;
      assert.equal(finalExports.some((entry) => entry.name === "gwonmac_cartography_context_observe"), launch === "tools",
        "Core must serve no optional Maps native hooks");
      assert.equal(prepared.nativeDoubleClick, true);
      assert.equal(prepared.soundDecodeRepair, true, `the ${launch} launch must serve the sound decode repair`);
      assert.deepEqual(prepared.effectiveCapabilities, capabilities);
      assert.equal(sha256(await readFile(prepared.wasmPath)), prepared.wasmSha256);

      // A matching directory name is not authority. The production cache must
      // reject and reproduce a corrupted final derivative from its exact input.
      await writeFile(prepared.wasmPath, "stale release qualification cache");
      const rebuilt = await prepare();
      assert.equal(rebuilt.failure, null);
      assert.deepEqual(rebuilt.cartography, { status: launch === "tools" ? "active" : "disabled" });
      assert.equal(rebuilt.nativeDoubleClick, true);
      assert.equal(rebuilt.soundDecodeRepair, true);
      assert.equal(rebuilt.wasmSha256, prepared.wasmSha256);
      assert.equal(sha256(await readFile(rebuilt.wasmPath)), rebuilt.wasmSha256);
      if (capabilities.travelAction) {
        const refused = await prepare(false);
        assert.equal(refused.friendObserver.status, "unavailable");
        assert.equal(refused.failure, null);
        assert.deepEqual(refused.effectiveCapabilities, capabilities);
        assert.equal(refused.nativeDoubleClick, true);
      }
    } finally {
      await rm(cacheRoot, { recursive: true, force: true });
    }
  }
});
