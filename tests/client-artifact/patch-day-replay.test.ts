/**
 * Replays the retained ArenaNet client history offline: each retained client
 * is judged with only the reviewed generations before it, as on its patch day.
 *
 * It reads the maintainer evidence store (GW_CLIENT_EVIDENCE, default
 * ~/Library/Application Support/gwonmac-maintainer/client-evidence) and never
 * writes to it. Without the store it skips. A retained client whose
 * Enhancement input matches no reviewed record is not replayed. That puts the
 * pre-October clients out of scope: template saving refuses them even with
 * every reviewed generation.
 *
 * A replayed client loses every fact of its own generation file: records,
 * relocation identities and `facts` (pinned index lists and layouts too). Its
 * row is what that client would have got at its first launch, before a
 * release reviewed it.
 */
import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { supportedEnhancementCapabilities } from "../../app/client/certification/enhancement-builds.js";
import {
  verifyLocalClientBytes,
  type LocalClientVerification,
} from "../../app/client/certification/local-client-verifier.js";
import {
  REVIEWED_GENERATIONS,
  withReviewedFacts,
  type ClientGeneration,
} from "../../app/client/certification/reviewed-facts.js";
import { deriveFriendObserverBuild } from "../../app/client/certification/friend-observer-transform.js";
import {
  cartographyReport,
  doubleClickReport,
  runtimePredecessors,
} from "../../app/tools-cli/client-qualification.js";
import { ENHANCEMENT_CAPABILITY_FIELDS } from "../../app/shared/enhancement-contracts.js";

const STORE = process.env.GW_CLIENT_EVIDENCE
  ?? join(homedir(), "Library", "Application Support", "gwonmac-maintainer", "client-evidence");

async function storeExists(): Promise<boolean> {
  try {
    return (await stat(STORE)).isDirectory();
  } catch {
    return false;
  }
}

type Replayed = Readonly<{
  generation: ClientGeneration;
  index: number;
  bytes: Uint8Array;
  full: LocalClientVerification;
}>;

/** Every retained client a reviewed record names, oldest generation first. */
async function retainedClients(): Promise<{ replayed: Replayed[]; unnamed: number }> {
  const entries = await readdir(STORE, { recursive: true });
  const replayed = new Map<number, Replayed>();
  let unnamed = 0;
  for (const entry of entries.filter((path) => path.endsWith("Gw.jspi.wasm")).sort()) {
    const bytes = new Uint8Array(await readFile(join(STORE, entry)));
    const full = verifyLocalClientBytes(bytes);
    const input = full.enhancementBuild?.sha256;
    const index = REVIEWED_GENERATIONS.findIndex((generation) =>
      generation.builds.some((build) => build.sha256 === input));
    if (index < 0) {
      unnamed += 1;
      continue;
    }
    replayed.set(index, { generation: REVIEWED_GENERATIONS[index]!, index, bytes, full });
  }
  return { replayed: [...replayed.values()].sort((left, right) => left.index - right.index), unnamed };
}

/** The features the generation's own record supports, which its client must prove. */
function reviewedFeatures(replayed: Replayed) {
  const record = replayed.generation.builds.find((build) =>
    build.sha256 === replayed.full.enhancementBuild?.sha256)!;
  const supported = supportedEnhancementCapabilities(record);
  return { record, features: ENHANCEMENT_CAPABILITY_FIELDS.filter((feature) => supported[feature]) };
}

function refusedFeatures(
  verification: LocalClientVerification,
  features: readonly (typeof ENHANCEMENT_CAPABILITY_FIELDS)[number][],
): string[] {
  return features.flatMap((feature) => {
    const verdict = verification.featureVerdicts?.[feature];
    return verdict?.status === "proved" ? [] : [`${feature}: ${JSON.stringify(verdict)}`];
  });
}

function assertOutputsMatchRecord(
  verification: LocalClientVerification,
  record: ClientGeneration["builds"][number],
  label: string,
): void {
  const outputs = Object.entries(verification.enhancementBuild?.outputSha256 ?? {});
  const reviewed = new Map<string, string | undefined>(Object.entries(record.outputSha256));
  assert.ok(outputs.length > 0, `${label}: no Enhancement output`);
  for (const [profile, sha256] of outputs) {
    assert.equal(sha256, reviewed.get(profile), `${label}: ${profile} output`);
  }
}

/**
 * The patch-day row of each generation that is not a relink of the previous
 * one: its template saving, the features it refuses and its module stages,
 * with only older facts. The rows are exact, so a change that makes a row
 * worse fails, and one that makes it better updates the row in the same change.
 */
type PatchDayRow = Readonly<{
  template: "proved" | "template-shape-changed";
  refuses: readonly string[];
  stages: Readonly<Record<"doubleClick" | "cartography" | "friends", "proved" | "refused">>;
}>;
const PATCH_DAY: Readonly<Record<string, PatchDayRow>> = {
  // October 1 changed a screenshot-initializer helper body. It never had its
  // own template review; with every generation it matches a later client's
  // relocation identity of that body.
  "2026-10-01-7b4c3548d670": {
    template: "template-shape-changed",
    refuses: [
      "targetObservation", "partyObservation", "teamApply", "travelAction", "xunlaiAction",
      "chatAliases", "skillSlotGeometry", "skillCooldownObservation", "playRegionObservation",
      "preGameControls", "characterSwitchAction", "chatFiltering", "quickItemMove",
      "playerEffectObservation", "effectIconGeometry", "resignAction", "whisperChat",
      "alcoholObservation", "nativeHudRendering", "chatPrint", "progressObservation",
    ],
    stages: { doubleClick: "proved", cartography: "proved", friends: "proved" },
  },
  // October 22 changed reviewed template-saving helper bodies (string
  // pointers and an assertion line), so it refuses until reviewed. The native
  // draw owners were first reviewed on this client, so the release profiles
  // that carry the native HUD cannot be served.
  "2026-10-22-ce3192033b14": {
    template: "template-shape-changed",
    refuses: [
      "targetObservation", "partyObservation", "teamApply", "travelAction", "xunlaiAction",
      "chatAliases", "skillSlotGeometry", "preGameControls", "characterSwitchAction",
      "chatFiltering", "quickItemMove", "playerEffectObservation", "effectIconGeometry",
      "resignAction", "whisperChat", "alcoholObservation", "nativeHudRendering", "chatPrint",
      "progressObservation",
    ],
    stages: { doubleClick: "refused", cartography: "refused", friends: "refused" },
  },
  // Template saving, Cartography, player effects and the chat paths accept
  // November 3's relocations of reviewed bodies. Quick Item Move needs a
  // review (its memory-code digest changed), and friends its moved
  // GcAuthCmd.cpp lines.
  "2026-11-03-f2a2b07c9c56": {
    template: "proved",
    refuses: ["quickItemMove"],
    stages: { doubleClick: "proved", cartography: "proved", friends: "refused" },
  },
};

/**
 * The module stages with the active facts, on the predecessors release
 * qualification serves: native double-click and Cartography on every one,
 * friend observation on each Enhancement profile. Every stage refuses when a
 * release profile cannot be served.
 */
function stageRows(bytes: Uint8Array): Readonly<Record<string, string>> {
  let served: ReturnType<typeof runtimePredecessors>;
  try {
    served = runtimePredecessors(bytes);
  } catch (error) {
    const refused = `refused (${error instanceof Error ? error.message : "no predecessors"})`;
    return { doubleClick: refused, cartography: refused, friends: refused };
  }
  const { officialSha256, predecessors } = served;
  const verdict = (proved: boolean) => proved ? "proved" : "refused";
  return {
    doubleClick: verdict(doubleClickReport(officialSha256, predecessors).proved),
    cartography: verdict(cartographyReport(officialSha256, predecessors).proved),
    friends: verdict(predecessors.every((predecessor) =>
      predecessor.enhancementInputSha256 === undefined
      || deriveFriendObserverBuild(predecessor.bytes) !== null)),
  };
}

const present = await storeExists();

test("the retained ArenaNet history replays with only the facts each patch day had", {
  timeout: 280_000,
  skip: present ? false : `no evidence store at GW_CLIENT_EVIDENCE or ${STORE}`,
}, async (t) => {
  const { replayed, unnamed } = await retainedClients();
  t.diagnostic(`${replayed.length} reviewed clients replayed; ${unnamed} retained clients have no reviewed record (out of scope)`);
  assert.ok(replayed.length >= 2, "the store must hold at least two reviewed clients");

  for (const client of replayed) {
    const label = client.generation.id;
    const { record, features } = reviewedFeatures(client);

    // With every reviewed generation, a client proves all its record supports.
    assert.deepEqual(refusedFeatures(client.full, features), [], `${label} with every generation`);
    assertOutputsMatchRecord(client.full, record, `${label} with every generation`);

    if (client.index === 0) continue;
    const older = REVIEWED_GENERATIONS.slice(0, client.index);
    const replay = verifyLocalClientBytes(client.bytes, undefined, older);
    const proved = features.filter((feature) => replay.featureVerdicts?.[feature]?.status === "proved");
    const stages = withReviewedFacts(older, () => stageRows(client.bytes));
    t.diagnostic(`${label} with older facts: template ${
      replay.fileVerdict?.status === "proved" ? "proved" : replay.fileVerdict?.reason}; proves ${
      proved.length}/${features.length}, refuses ${
      features.filter((feature) => !proved.includes(feature)).join(", ") || "nothing"}; ${
      Object.entries(stages).map(([stage, verdict]) => `${stage} ${verdict}`).join(", ")}`);

    // A relink of the previous generation (same memory-accessing code up to
    // relocation) is a non-event: it needs no fact of its own.
    const previous = REVIEWED_GENERATIONS[client.index - 1]!;
    if (
      previous.memoryCodeSha256 !== undefined
      && previous.memoryCodeSha256 === client.generation.memoryCodeSha256
    ) {
      assert.deepEqual(replay.fileVerdict, client.full.fileVerdict, `${label}: template saving`);
      assert.deepEqual(refusedFeatures(replay, features), [], `${label}: relink of ${previous.id}`);
      assertOutputsMatchRecord(replay, record, `${label}: relink of ${previous.id}`);
      assert.deepEqual(stages, { doubleClick: "proved", cartography: "proved", friends: "proved" },
        `${label}: module stages on a relink of ${previous.id}`);
      continue;
    }

    // Any other change is judged as stated above. A refused template leaves
    // the official client untouched: nothing is rewritten for it.
    const expected = PATCH_DAY[label];
    assert.ok(expected, `${label}: state its patch-day row in PATCH_DAY`);
    if (expected.template === "proved") {
      assert.deepEqual(replay.fileVerdict, client.full.fileVerdict, `${label}: template saving`);
    } else {
      assert.equal(replay.fileVerdict?.status, "refused", `${label}: template saving`);
      assert.equal(replay.fileVerdict?.reason, expected.template, `${label}: template refusal`);
      assert.equal(replay.templateSaveBuild, null, `${label}: no template rewrite`);
    }
    assert.deepEqual(features.filter((feature) => !proved.includes(feature)), expected.refuses,
      `${label}: patch-day features`);
    assert.deepEqual(Object.fromEntries(Object.entries(stages).map(([stage, verdict]) =>
      [stage, verdict === "proved" ? "proved" : "refused"])), expected.stages, `${label}: patch-day stages`);
  }
});
