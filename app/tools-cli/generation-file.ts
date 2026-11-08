/**
 * Writes approved review drafts into a client's generation file
 * (`app/client/certification/reviewed-client-<id>.ts`), creating and
 * registering that file when the client has none yet.
 *
 * It edits source text, so it touches only the `alternatives` of the file's
 * `facts` and its `playerEffectBodies`, writes only `import type`, const
 * declarations, literals and `Object.freeze`, and refuses anything it cannot
 * place exactly. Before it writes, it checks that the draft is for the client
 * the generation's builds name and that every feature it names is one a review
 * judges, so the note comment holds only known words.
 *
 * An unapplied draft grants nothing. An applied alternative is a reviewed
 * fact: the verifier accepts that body for that literal in every client, so
 * review each pair before applying it.
 */
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { ClientGeneration, ReviewedAlternative } from "../client/certification/reviewed-facts.js";
import { REVIEWED_FEATURES } from "./fact-review.js";

export const GENERATION_DIRECTORY = "app/client/certification";
export const REVIEWED_FACTS_FILE = `${GENERATION_DIRECTORY}/reviewed-facts.ts`;
/** The checkout this file belongs to, so `--apply` edits it from any working directory. */
const REPOSITORY_ROOT = fileURLToPath(new URL("../../", import.meta.url));

const BUNDLE_ID = /^\d{4}-\d{2}-\d{2}-[0-9a-f]{12}$/u;
const DIGEST = /^[0-9a-f]{64}$/u;

export type DraftedAlternatives = Readonly<Record<string, readonly ReviewedAlternative[]>>;
export type DraftedEffectBodies = Readonly<Record<string, string>>;

export function generationFile(id: string): string {
  if (!BUNDLE_ID.test(id)) throw new Error(`review: ${id} is not a bundle reference YYYY-MM-DD-<generation-12>`);
  return `${GENERATION_DIRECTORY}/reviewed-client-${id}.ts`;
}

export function isDraftedAlternatives(value: unknown): value is DraftedAlternatives {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([literal, entries]) => DIGEST.test(literal)
    && Array.isArray(entries) && entries.length > 0
    && entries.every((entry: unknown) => typeof entry === "string"
      ? DIGEST.test(entry)
      : !!entry && typeof entry === "object" && Object.keys(entry).sort().join() === "bodyLength,fingerprint"
        && "bodyLength" in entry && Number.isSafeInteger(entry.bodyLength) && Number(entry.bodyLength) > 0
        && "fingerprint" in entry && typeof entry.fingerprint === "string" && DIGEST.test(entry.fingerprint)));
}

export function isDraftedEffectBodies(value: unknown): value is DraftedEffectBodies {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.entries(value).every(([reference, body]) => DIGEST.test(reference)
      && typeof body === "string" && DIGEST.test(body));
}

function effectBodyLines(bodies: DraftedEffectBodies, note: string): string {
  return `  // ${note}\n  playerEffectBodies: Object.freeze({\n${Object.entries(bodies)
    .map(([reference, body]) => `    "${reference}": "${body}",\n`).join("")}  }),\n`;
}

/** `source` with `playerEffectBodies` added to its generation. */
export function withDraftedEffectBodies(source: string, bodies: DraftedEffectBodies, note: string): string {
  if (source.includes("\n  playerEffectBodies:")) {
    throw new Error("review: the generation file already lists playerEffectBodies; merge it by hand");
  }
  const close = source.lastIndexOf("\n});");
  if (close < 0 || !source.includes("export const ")) throw new Error("review: the generation file has no export to extend");
  return `${source.slice(0, close + 1)}${effectBodyLines(bodies, note)}${source.slice(close + 1)}`;
}

function formatAlternative(alternative: ReviewedAlternative): string {
  return typeof alternative === "string"
    ? `"${alternative}"`
    : `{ bodyLength: ${alternative.bodyLength}, fingerprint: "${alternative.fingerprint}" }`;
}

function entryLines(alternatives: DraftedAlternatives, note: string, indent: string): string {
  return Object.entries(alternatives).map(([literal, entries]) =>
    `${indent}// ${note}\n${indent}"${literal}": [${entries.map(formatAlternative).join(", ")}],\n`).join("");
}

const FACTS_OPEN = "const FACTS: GenerationFacts = Object.freeze<GenerationFacts>({\n";

/** `source` with `alternatives` added to its facts. */
export function withDraftedAlternatives(source: string, alternatives: DraftedAlternatives, note: string): string {
  const facts = source.indexOf(FACTS_OPEN);
  if (facts < 0) {
    if (source.includes("\n  facts:")) throw new Error("review: the generation file's facts are not a FACTS block; edit it by hand");
    const close = source.lastIndexOf("\n});");
    if (close < 0 || !source.includes("export const ")) throw new Error("review: the generation file has no export to extend");
    const typed = source.replace(
      'import type { ClientGeneration } from "./reviewed-facts.js";',
      'import type { ClientGeneration, GenerationFacts } from "./reviewed-facts.js";',
    );
    if (!typed.includes("GenerationFacts }")) throw new Error("review: cannot import GenerationFacts");
    const end = typed.lastIndexOf("\n});");
    return `${typed.slice(0, end)}\n  facts: Object.freeze<GenerationFacts>({\n    alternatives: {\n${
      entryLines(alternatives, note, "      ")}    },\n  }),${typed.slice(end)}`;
  }
  const factsEnd = source.indexOf("\n});", facts);
  const block = source.indexOf("\n  alternatives: {\n", facts);
  if (block >= 0 && block < factsEnd) {
    const blockEnd = source.indexOf("\n  },", block);
    for (const literal of Object.keys(alternatives)) {
      if (source.slice(block, blockEnd).includes(`"${literal}"`)) {
        throw new Error(`review: the generation file already lists alternatives for ${literal}; merge it by hand`);
      }
    }
    const insert = block + "\n  alternatives: {\n".length;
    return `${source.slice(0, insert)}${entryLines(alternatives, note, "    ")}${source.slice(insert)}`;
  }
  const insert = factsEnd + 1;
  return `${source.slice(0, insert)}  alternatives: {\n${entryLines(alternatives, note, "    ")}  },\n${source.slice(insert)}`;
}

export function generationConstant(id: string): string {
  return `FACTS_${id.replaceAll("-", "_").toUpperCase()}`;
}

/** A generation file that holds only reviewed drafts. */
export function newGenerationSource(
  id: string,
  alternatives: DraftedAlternatives,
  note: string,
  effectBodies: DraftedEffectBodies | null = null,
): string {
  const hasAlternatives = Object.keys(alternatives).length > 0;
  return `/**
 * Reviewed facts for one ArenaNet client generation. The ${id} client.
 * Runtime certification never grants a capability from these facts alone:
 * the isolated semantic verifier re-derives every fact from the bytes first.
 */
import type { ClientGeneration${hasAlternatives ? ", GenerationFacts" : ""} } from "./reviewed-facts.js";
${hasAlternatives ? `
const FACTS: GenerationFacts = Object.freeze<GenerationFacts>({
  alternatives: {
${entryLines(alternatives, note, "    ")}  },
});
` : ""}
export const ${generationConstant(id)}: ClientGeneration = Object.freeze({
  id: "${id}",
  // Add the Enhancement record, memoryCodeSha256 and identity table
  // (docs/recertify.md, "Recover a relocation rebuild").
  builds: Object.freeze([]),
  identities: Object.freeze({}),
${effectBodies ? effectBodyLines(effectBodies, note) : ""}${hasAlternatives ? "  facts: FACTS,\n" : ""}});
`;
}

/** The release date a generation id starts with (`2026-08-build-…` has only its month). */
function clientDate(id: string): string {
  return /^\d{4}-\d{2}(?:-\d{2})?/u.exec(id)?.[0] ?? id;
}

/**
 * `reviewed-facts.ts` with the generation `id` imported and listed in client
 * order: after every generation released on or before its date, since the
 * review takes the generations before a client as the ones older than it.
 */
export function registerGeneration(source: string, id: string): string {
  const constant = generationConstant(id);
  const imports = [...source.matchAll(/^import \{ (\w+) \} from "\.\/reviewed-client-([^"]+)\.js";\n/gmu)];
  const list = source.indexOf("export const REVIEWED_GENERATIONS: readonly ClientGeneration[] = Object.freeze([\n");
  const listEnd = list < 0 ? -1 : source.indexOf("\n]);", list);
  const lastImport = imports.at(-1);
  if (!lastImport || lastImport.index === undefined || listEnd < 0) {
    throw new Error("review: cannot find the generation list in reviewed-facts.ts");
  }
  const later = imports.find((entry) => clientDate(entry[2] ?? "") > clientDate(id));
  const importAt = later?.index ?? lastImport.index + lastImport[0].length;
  const listed = later ? source.indexOf(`\n  ${later[1]},\n`, list) : listEnd;
  if (listed < 0 || listed > listEnd) throw new Error(`review: ${later?.[1]} is imported but not listed in order`);
  return `${source.slice(0, importAt)}import { ${constant} } from "./reviewed-client-${id}.js";\n${
    source.slice(importAt, listed)}\n  ${constant},${source.slice(listed)}`;
}

export type ReviewDraft = Readonly<{
  id: string;
  candidateSha256: string;
  /** The reviewed features each drafted literal serves. */
  features: Readonly<Record<string, readonly string[]>>;
  alternatives: DraftedAlternatives;
  playerEffectBodies: DraftedEffectBodies | null;
}>;

/** `draft.json` as `review` writes it, or the reason it is not one. */
function reviewDraft(value: unknown): ReviewDraft | string {
  if (!value || typeof value !== "object" || !("id" in value) || typeof value.id !== "string"
    || !("candidateSha256" in value) || typeof value.candidateSha256 !== "string"
    || !DIGEST.test(value.candidateSha256)
    || !("features" in value) || !value.features || typeof value.features !== "object"
    || !("alternatives" in value) || !isDraftedAlternatives(value.alternatives)
    || !("playerEffectBodies" in value)
    || (value.playerEffectBodies !== null && !isDraftedEffectBodies(value.playerEffectBodies))) {
    return "draft.json is not a review draft";
  }
  const features: Record<string, readonly string[]> = {};
  for (const [literal, named] of Object.entries(value.features)) {
    if (!DIGEST.test(literal) || !Array.isArray(named)) return "draft.json is not a review draft";
    for (const feature of named) {
      if (!REVIEWED_FEATURES.some((known) => known === feature)) {
        return `draft.json names ${JSON.stringify(feature)}, which is not a reviewed feature`;
      }
    }
    features[literal] = named;
  }
  return {
    id: value.id,
    candidateSha256: value.candidateSha256,
    features,
    alternatives: value.alternatives,
    playerEffectBodies: value.playerEffectBodies,
  };
}

export type SourceWrite = Readonly<{ file: string; source: string }>;

/**
 * The source files an approved draft changes, with absolute paths in this
 * checkout, read through `read` (null for a missing file). Throws the reason
 * when the draft is not one to apply: malformed, naming an unknown feature,
 * made from a client the generation's builds do not list, or one the file
 * already holds.
 */
export function reviewDraftWrites(
  value: unknown,
  generations: readonly ClientGeneration[],
  read: (file: string) => string | null,
): SourceWrite[] {
  const draft = reviewDraft(value);
  if (typeof draft === "string") throw new Error(`review: ${draft}`);
  const builds = generations.find((generation) => generation.id === draft.id)?.builds ?? [];
  if (builds.length > 0 && !builds.some((build) => build.sha256 === draft.candidateSha256)) {
    throw new Error(`review: the draft was made from ${draft.candidateSha256}, which generation ${draft.id} does not list`);
  }
  const features = [...new Set(Object.values(draft.features).flat())].sort();
  const note = `Review ${draft.id}${features.length > 0 ? ` (${features.join(", ")})` : ""}: the same function in the same role.`;
  const file = path.join(REPOSITORY_ROOT, generationFile(draft.id));
  const source = read(file);
  if (source === null) {
    const factsFile = path.join(REPOSITORY_ROOT, REVIEWED_FACTS_FILE);
    const facts = read(factsFile);
    if (facts === null) throw new Error(`review: ${REVIEWED_FACTS_FILE} is missing`);
    return [
      { file, source: newGenerationSource(draft.id, draft.alternatives, note, draft.playerEffectBodies) },
      { file: factsFile, source: registerGeneration(facts, draft.id) },
    ];
  }
  let edited = source;
  if (Object.keys(draft.alternatives).length > 0) edited = withDraftedAlternatives(edited, draft.alternatives, note);
  if (draft.playerEffectBodies) edited = withDraftedEffectBodies(edited, draft.playerEffectBodies, note);
  return [{ file, source: edited }];
}
