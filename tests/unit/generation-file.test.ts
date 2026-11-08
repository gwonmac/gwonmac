/**
 * `certification review --apply` edits generation-file source. A wrong edit
 * would drop reviewed facts, put a draft outside `facts`, or register a file
 * the generation list never reads; each case imports the written source back.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { REVIEWED_GENERATIONS, type ClientGeneration } from "../../app/client/certification/reviewed-facts.js";
import {
  newGenerationSource,
  registerGeneration,
  reviewDraftWrites,
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

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const readOrNull = (file: string) => {
  try {
    return readFileSync(file, "utf8");
  } catch {
    return null;
  }
};
const NOVEMBER_3_DRAFT = {
  id: "2026-11-03-f2a2b07c9c56",
  candidateSha256: "9e50eae9204aad6a8c5137cb18af23efe09296a94d92a994fa974716be9804d5",
  features: { [LITERAL]: ["quickItemMove"] },
  alternatives: DRAFT,
  playerEffectBodies: null,
};

// Each refusal guards a way a draft file could write the wrong thing: a note
// comment carrying arbitrary text, facts drafted from another client, a
// client registered as newer than one released after it, or edits landing
// relative to wherever the command ran.
for (const [name, draft, expected] of [
  ["applies a draft for the client its generation lists", NOVEMBER_3_DRAFT,
    { files: [NOVEMBER_3], note: "// Review 2026-11-03-f2a2b07c9c56 (quickItemMove): the same function in the same role." }],
  ["refuses a feature id outside the reviewed features",
    { ...NOVEMBER_3_DRAFT, features: { [LITERAL]: ["quickItemMove */ evil(); /*"] } }, /not a reviewed feature/u],
  ["refuses a draft made from a client the generation does not list",
    { ...NOVEMBER_3_DRAFT, candidateSha256: "5".repeat(64) }, /does not list/u],
  ["registers a new client before the generations released after it",
    { ...NOVEMBER_3_DRAFT, id: "2026-10-15-aaaaaaaaaaaa" },
    { files: [`${DIRECTORY}/reviewed-client-2026-10-15-aaaaaaaaaaaa.ts`, `${DIRECTORY}/reviewed-facts.ts`],
      note: "\n  OCTOBER_1_FACTS,\n  FACTS_2026_10_15_AAAAAAAAAAAA,\n  OCTOBER_22_FACTS,\n" }],
] as const) {
  test(`review --apply ${name}`, () => {
    const cwd = process.cwd();
    process.chdir(tmpdir());
    try {
      const apply = () => reviewDraftWrites(draft, REVIEWED_GENERATIONS, readOrNull);
      if (expected instanceof RegExp) {
        assert.throws(apply, expected);
        return;
      }
      const writes = apply();
      assert.deepEqual(writes.map((write) => write.file), expected.files.map((file) => path.join(ROOT, file)));
      assert.ok(writes.at(-1)?.source.includes(expected.note));
    } finally {
      process.chdir(cwd);
    }
  });
}
