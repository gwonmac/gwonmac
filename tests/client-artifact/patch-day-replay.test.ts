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
  type ClientGeneration,
} from "../../app/client/certification/reviewed-facts.js";
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
    t.diagnostic(`${label} with older facts proves ${proved.length}/${features.length}: refuses ${
      features.filter((feature) => !proved.includes(feature)).join(", ") || "nothing"}`);

    // Template saving never depends on a newer client's facts.
    assert.notEqual(replay.status, "template-refused", `${label}: template saving`);
    assert.deepEqual(replay.fileVerdict, client.full.fileVerdict, `${label}: template verdict`);

    // A relink of the previous generation (same memory-accessing code up to
    // relocation) is a non-event: every feature proves without its own facts.
    const previous = REVIEWED_GENERATIONS[client.index - 1]!;
    if (
      previous.memoryCodeSha256 !== undefined
      && previous.memoryCodeSha256 === client.generation.memoryCodeSha256
    ) {
      assert.deepEqual(refusedFeatures(replay, features), [], `${label}: relink of ${previous.id}`);
      assertOutputsMatchRecord(replay, record, `${label}: relink of ${previous.id}`);
    }
  }
});
