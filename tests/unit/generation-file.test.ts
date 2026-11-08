/**
 * `certification review --apply` edits generation-file source. A wrong edit
 * would drop reviewed facts, put a draft outside `facts`, or register a file
 * the generation list never reads; each case imports the written source back.
 */
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import type { ClientGeneration } from "../../app/client/certification/reviewed-facts.js";
import {
  newGenerationSource,
  registerGeneration,
  withDraftedAlternatives,
  withDraftedEffectBodies,
} from "../../app/tools-cli/generation-file.js";

const DIRECTORY = "app/client/certification";
const LITERAL = "1111111111111111111111111111111111111111111111111111111111111111";
const DRAFT = {
  [LITERAL]: ["2222222222222222222222222222222222222222222222222222222222222222",
    { bodyLength: 40, fingerprint: "3333333333333333333333333333333333333333333333333333333333333333" }],
};
const NOTE = "Review 2099-01-01-000000000000: the same function in the same role.";
const EFFECTS = { [LITERAL]: "4444444444444444444444444444444444444444444444444444444444444444" };

function isGeneration(value: unknown): value is ClientGeneration {
  return !!value && typeof value === "object" && "id" in value && typeof value.id === "string"
    && "builds" in value && Array.isArray(value.builds);
}

/** The generation a written source exports, read back through a real import. */
async function generationIn(source: string): Promise<ClientGeneration> {
  const directory = await mkdtemp(path.join(tmpdir(), "generation-file-"));
  try {
    const file = path.join(directory, "reviewed-client.ts");
    await writeFile(file, source);
    const exported: Record<string, unknown> = await import(pathToFileURL(file).href);
    const [generation] = Object.values(exported);
    assert.ok(isGeneration(generation));
    return generation;
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

const NOVEMBER_3 = `${DIRECTORY}/reviewed-client-2026-11-03-f2a2b07c9c56.ts`;
const withoutAlternatives = (source: string) =>
  source.replace(/\n {2}\/\/ Alternatives to reviewed reference literals[^\n]*\n {2}alternatives: \{\n[\s\S]*?\n {2}\},/u, "");

for (const [name, file, edit, existing] of [
  ["a facts block with alternatives keeps them", NOVEMBER_3, (source: string) => source, 1],
  ["a facts block without alternatives gets them", NOVEMBER_3, withoutAlternatives, 0],
  ["a generation without facts gets a facts block", `${DIRECTORY}/reviewed-client-2026-10-01-7b4c3548d670.ts`,
    (source: string) => source, 0],
] as const) {
  test(`review --apply: ${name}`, async () => {
    const source = edit(await readFile(file, "utf8"));
    const before = await generationIn(source);
    assert.equal(Object.keys(before.facts?.alternatives ?? {}).length, existing);
    const after = await generationIn(withDraftedAlternatives(source, DRAFT, NOTE));
    assert.deepEqual(after.facts?.alternatives, { ...before.facts?.alternatives, ...DRAFT });
    assert.deepEqual({ ...after, facts: { ...after.facts, alternatives: undefined } },
      { ...before, facts: { ...before.facts, alternatives: undefined } });
  });
}

test("review --apply refuses a literal the file already lists", async () => {
  const once = withDraftedAlternatives(await readFile(NOVEMBER_3, "utf8"), DRAFT, NOTE);
  assert.throws(() => withDraftedAlternatives(once, DRAFT, NOTE), /already lists alternatives for 1{64}/u);
  assert.throws(() => withDraftedEffectBodies(once, EFFECTS, NOTE), /already lists playerEffectBodies/u);
});

test("review --apply adds player-effect bodies to a generation and keeps the rest", async () => {
  const source = await readFile(`${DIRECTORY}/reviewed-client-2026-08-build-1eb07e32.ts`, "utf8");
  const before = await generationIn(source);
  const after = await generationIn(withDraftedEffectBodies(source, EFFECTS, NOTE));
  assert.deepEqual(after, { ...before, playerEffectBodies: EFFECTS });
});

test("review --apply creates and registers a generation the client did not have", async () => {
  const created = await generationIn(newGenerationSource("2099-01-01-000000000000", DRAFT, NOTE, EFFECTS));
  assert.deepEqual(created, {
    id: "2099-01-01-000000000000", builds: [], identities: {}, playerEffectBodies: EFFECTS, facts: { alternatives: DRAFT },
  });
  const effectsOnly = await generationIn(newGenerationSource("2099-01-01-000000000000", {}, NOTE, EFFECTS));
  assert.deepEqual(effectsOnly, { id: "2099-01-01-000000000000", builds: [], identities: {}, playerEffectBodies: EFFECTS });
  const registered = registerGeneration(await readFile(`${DIRECTORY}/reviewed-facts.ts`, "utf8"), "2099-01-01-000000000000");
  assert.match(registered,
    /import \{ NOVEMBER_3_FACTS \} from "\.\/reviewed-client-2026-11-03-f2a2b07c9c56\.js";\nimport \{ FACTS_2099_01_01_000000000000 \} from "\.\/reviewed-client-2099-01-01-000000000000\.js";\n/u);
  assert.match(registered, /\n {2}NOVEMBER_3_FACTS,\n {2}FACTS_2099_01_01_000000000000,\n\]\);/u);
});
