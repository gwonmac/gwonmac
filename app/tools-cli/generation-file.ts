/**
 * Writes approved review drafts into a client's generation file
 * (`app/client/certification/reviewed-client-<id>.ts`), creating and
 * registering that file when the client has none yet.
 *
 * It edits source text, so it touches only the `alternatives` of the file's
 * `facts` and its `playerEffectBodies`, writes only literals and
 * `Object.freeze`, and refuses anything it cannot place exactly. Writing a fact grants
 * nothing: the verifier still proves every feature from the bytes with it.
 */
import type { ReviewedAlternative } from "../client/certification/reviewed-facts.js";

export const GENERATION_DIRECTORY = "app/client/certification";
export const REVIEWED_FACTS_FILE = `${GENERATION_DIRECTORY}/reviewed-facts.ts`;

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
        && "bodyLength" in entry && Number.isSafeInteger(entry.bodyLength)
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

/** `reviewed-facts.ts` with the generation `id` imported and listed as the newest. */
export function registerGeneration(source: string, id: string): string {
  const constant = generationConstant(id);
  const imports = [...source.matchAll(/^import \{ \w+ \} from "\.\/reviewed-client-[^"]+\.js";\n/gmu)];
  const lastImport = imports.at(-1);
  const list = source.indexOf("export const REVIEWED_GENERATIONS: readonly ClientGeneration[] = Object.freeze([\n");
  const listEnd = list < 0 ? -1 : source.indexOf("\n]);", list);
  if (!lastImport || lastImport.index === undefined || listEnd < 0) {
    throw new Error("review: cannot find the generation list in reviewed-facts.ts");
  }
  const afterImport = lastImport.index + lastImport[0].length;
  const withImport = `${source.slice(0, afterImport)}import { ${constant} } from "./reviewed-client-${id}.js";\n${
    source.slice(afterImport)}`;
  const end = withImport.indexOf("\n]);", withImport.indexOf("export const REVIEWED_GENERATIONS"));
  return `${withImport.slice(0, end)}\n  ${constant},${withImport.slice(end)}`;
}
