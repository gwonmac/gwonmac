/**
 * Scaffolds a new Feature (docs/feature-contract.md): the folder app/features/<folder>/ with a
 * manifest, a game part that does nothing visible, README.md, CHANGELOG.md and media/, plus its
 * registry entries in app/features/index.ts (FEATURES) and app/features/companion-parts.ts
 * (FEATURE_PARTS). The result passes the contract checks as written
 * (tests/policy/new-feature-scaffold.test.ts).
 *
 *   pnpm new-feature <id> [--kind <kind>] [--purpose <purpose>] [--dry-run]
 *
 * `newFeatureFiles` is pure: it takes a reader for the two registry files and returns every
 * file to write, so the test runs the same code without touching the repository.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { folderForId } from "../app/features/contract.ts";
import { FEATURE_KINDS, FEATURE_PURPOSES, type FeatureKind, type FeaturePurpose } from "../app/features/define.ts";

export const REGISTRY = "app/features/index.ts";
export const PART_REGISTRY = "app/features/companion-parts.ts";

/** The card kinds a new Feature can take; `mode` is the launch mode, which exists once. */
type CardKind = Exclude<FeatureKind, "mode">;
const CARD_KINDS = FEATURE_KINDS.filter((kind): kind is CardKind => kind !== "mode");
/** The purpose a kind usually serves; --purpose picks another. */
const PURPOSE_FOR_KIND: Readonly<Record<CardKind, FeaturePurpose>> = {
  maps: "around",
  combat: "fight",
  party: "characters",
  chat: "talk",
  items: "inventory",
  helpers: "fight",
};
const CAMEL_ID = /^[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)*$/;

export type NewFeatureOptions = Readonly<{ id: string; kind?: string; purpose?: string }>;
/** Every file to write, by path from the repository root, with its full new text. */
export type NewFeatureFiles = ReadonlyMap<string, string>;

/** "quickNote" → "Quick Note". */
export const nameForId = (id: string): string =>
  id.replace(/([A-Z])/g, " $1").replace(/^./, (first) => first.toUpperCase());

/**
 * The files for a new Feature, or an Error whose message says what to change. `read` returns a
 * repository file's text, or null when it does not exist.
 */
export function newFeatureFiles(options: NewFeatureOptions, read: (file: string) => string | null): NewFeatureFiles {
  const { id } = options;
  if (!CAMEL_ID.test(id)) {
    throw new Error(`"${id}" is not a Feature id: use camelCase letters and digits, starting with a lowercase letter, such as "quickNote".`);
  }
  const kind = options.kind ?? "helpers";
  if (!(CARD_KINDS as readonly string[]).includes(kind)) {
    throw new Error(`--kind "${kind}" is not a card kind; use one of ${CARD_KINDS.join(", ")} (FEATURE_KINDS in app/features/define.ts).`);
  }
  const purpose = options.purpose ?? PURPOSE_FOR_KIND[kind as CardKind];
  if (!(FEATURE_PURPOSES as readonly string[]).includes(purpose)) {
    throw new Error(`--purpose "${purpose}" is not a purpose; use one of ${FEATURE_PURPOSES.join(", ")} (FEATURE_PURPOSES in app/features/define.ts).`);
  }
  const folder = folderForId(id);
  const at = `app/features/${folder}`;
  if (read(`${at}/feature.ts`) !== null) throw new Error(`${at}/ already exists; pick another id or change that Feature.`);
  const registry = read(REGISTRY);
  const partRegistry = read(PART_REGISTRY);
  if (registry === null || partRegistry === null) throw new Error(`${REGISTRY} or ${PART_REGISTRY} is missing; run this from the repository root.`);
  if (new RegExp(`^import ${id} from`, "m").test(registry) || new RegExp(`^\\s+${id},$`, "m").test(registry)) {
    throw new Error(`${REGISTRY} already lists "${id}"; ids are unique.`);
  }

  const name = nameForId(id);
  return new Map([
    [`${at}/feature.ts`, manifest(id, name, kind, purpose)],
    [`${at}/companion.ts`, gamePart(id, name)],
    [`${at}/README.md`, readme(name, folder)],
    [`${at}/CHANGELOG.md`, "## Unreleased\n"],
    [`${at}/media/.gitkeep`, ""],
    [REGISTRY, register(registry, REGISTRY, id, `./${folder}/feature.js`, "export const FEATURES = [", "] as const;")],
    [PART_REGISTRY, register(partRegistry, PART_REGISTRY, id, `./${folder}/companion.js`, "export const FEATURE_PARTS: readonly ToolsCompanionPart[] = [", "];")],
  ]);
}

const manifest = (id: string, name: string, kind: string, purpose: string) => `import { defineFeature, featureSwitch } from "../define.js";

// Every field: docs/feature-contract.md. The checks: app/features/contract.ts.
export default defineFeature({
  id: "${id}",
  name: "${name}",
  summary: "Say in one plain sentence what ${name} shows or does.",
  kind: "${kind}",
  purpose: "${purpose}",
  icon: "sparkles",
  settings: {
    /** ${name}'s switch, off until the player turns it on. */
    ${id}Enabled: featureSwitch(false, { tools: true }),
  },
  region: "pve",
  // The verifier capabilities the game part needs (ENHANCEMENT_CAPABILITY_FIELDS); it does not start without them.
  uses: [],
  tool: { id: "${folderForId(id)}" },
  shots: [],
  parts: ["game"],
});
`;

const gamePart = (id: string, name: string) => `/**
 * ${name}'s game part. \`start\` runs while resolve has ${name} on and the verifier proved every
 * capability its manifest \`uses\`; what it returns is stopped when resolve turns it off. Read the
 * game through \`game.*\` and draw through \`ui.*\` (app/renderer/game-blocks.ts): subscribe or
 * claim in \`start\` and undo each one in \`stop\`.
 */
import { featurePart } from "../../renderer/tools-companion-part.js";

export default featurePart("${id}", () => {
  const stops: (() => void)[] = [];
  return { stop() { for (const stop of stops) stop(); } };
});
`;

const readme = (name: string, folder: string) => `${name} does one thing for the player. Say what in one or two plain sentences.

### Use it
1. Turn it on.

### Details
- **Turn on:** :setting[${name}]{to="tools/tool:${folder}"}, off while you play the :setting[plain game]{to="tools/gwonmacTools"}. It is off by default.
- **Open:** always visible once on. It has no window or shortcut.

> It works in PvE only.
`;

/**
 * Adds `import <id> from "<specifier>";` among the registry's imports (sorted by specifier) and
 * `<id>,` as the last entry of the list that opens with `open` and closes with `close`.
 */
function register(text: string, file: string, id: string, specifier: string, open: string, close: string): string {
  const lines = text.split("\n");
  const imports = lines.flatMap((line, index) => /^import \w+ from "\.\/[^"]+";$/.test(line) ? [index] : []);
  if (imports.length === 0) throw new Error(`${file}: found no feature imports; add the Feature by hand (docs/feature-contract.md).`);
  const after = imports.filter((index) => (/"([^"]+)"/.exec(lines[index] ?? "")?.[1] ?? "") < specifier).at(-1);
  lines.splice(after === undefined ? imports[0] ?? 0 : after + 1, 0, `import ${id} from "${specifier}";`);
  const start = lines.indexOf(open);
  const end = start === -1 ? -1 : lines.indexOf(close, start);
  if (end === -1) throw new Error(`${file}: found no "${open}" … "${close}" list; add the Feature by hand (docs/feature-contract.md).`);
  lines.splice(end, 0, `  ${id},`);
  return lines.join("\n");
}

function parseArguments(argv: readonly string[]): NewFeatureOptions & { dryRun: boolean } {
  const [id, ...rest] = argv;
  if (id === undefined || id.startsWith("--")) {
    throw new Error("usage: pnpm new-feature <id> [--kind <kind>] [--purpose <purpose>] [--dry-run]");
  }
  let kind: string | undefined;
  let purpose: string | undefined;
  let dryRun = false;
  for (let index = 0; index < rest.length; index += 1) {
    const flag = rest[index];
    if (flag === "--dry-run") dryRun = true;
    else if (flag === "--kind" || flag === "--purpose") {
      const value = rest[index + 1];
      if (value === undefined) throw new Error(`${flag} needs a value.`);
      if (flag === "--kind") kind = value;
      else purpose = value;
      index += 1;
    } else throw new Error(`unknown option ${flag}; usage: pnpm new-feature <id> [--kind <kind>] [--purpose <purpose>] [--dry-run]`);
  }
  return { id, dryRun, ...(kind === undefined ? {} : { kind }), ...(purpose === undefined ? {} : { purpose }) };
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const root = path.resolve(import.meta.dirname, "..");
  try {
    const { dryRun, ...options } = parseArguments(process.argv.slice(2).filter((argument) => argument !== "--"));
    const files = newFeatureFiles(options, (file) => {
      const absolute = path.join(root, file);
      return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
    });
    for (const [file, text] of files) {
      if (!dryRun) {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
      }
      console.log(`${dryRun ? "would write" : "wrote"} ${file}`);
    }
    const folder = folderForId(options.id);
    console.log([
      "",
      `Next: write the summary in app/features/${folder}/feature.ts and the README, list what it uses,`,
      `then build the part in app/features/${folder}/companion.ts. Run pnpm check. See docs/feature-contract.md.`,
    ].join("\n"));
  } catch (error) {
    console.error(`new-feature: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
