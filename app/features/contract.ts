/**
 * The feature contract checks that TypeScript cannot make: the id matches its folder,
 * every setting names itself, one shot file per caption, README.md stays inside the
 * small Markdown subset the launcher renders, CHANGELOG.md has `## Unreleased`, `requires`
 * has no cycles, and `capabilities` (the contract's `uses`) names only capabilities the
 * verifier knows. Pure: the caller reads the folders (tests/policy/feature-contract.test.ts
 * runs it in `pnpm check`), so the same check can run on a scaffold or a planted error.
 * Each message names the file and says what to change.
 */
import { ENHANCEMENT_CAPABILITY_FIELDS } from "../shared/enhancement-contracts.js";
import type { FeatureDefinition } from "./define.js";

/** One app/features/<folder>/ as the caller found it. */
export type FeatureFolder = Readonly<{
  folder: string;
  /** The default export of its feature.ts. */
  manifest: FeatureDefinition;
  /** Every file under the folder, relative to it with `/` separators ("media/shot-1.webp"). */
  files: readonly string[];
  /** README.md and CHANGELOG.md, or null when missing. */
  readme: string | null;
  changelog: string | null;
}>;

export type FeatureContractInput = Readonly<{
  folders: readonly FeatureFolder[];
  /** FEATURES, the registry in ./index.ts. */
  registered: readonly FeatureDefinition[];
}>;

const KNOWN_USES: ReadonlySet<string> = new Set(ENHANCEMENT_CAPABILITY_FIELDS);
const GWONMAC_LINK = /^https:\/\/www\.gwonmac\.com(\/[^\s)]*)?$/;
const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SHOT_FILE = /^media\/shot-(\d+)\.webp$/;

export const folderForId = (id: string): string => id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

export function checkFeatureContract({ folders, registered }: FeatureContractInput): string[] {
  const problems: string[] = [];
  const registeredIds = new Set(registered.map((feature) => feature.id));
  for (const each of folders) problems.push(...checkFolder(each, registeredIds));
  const foundIds = new Set(folders.map(({ manifest }) => manifest.id));
  for (const feature of registered) {
    if (!foundIds.has(feature.id)) {
      problems.push(`app/features/index.ts: FEATURES lists "${feature.id}", but no app/features/${folderForId(feature.id)}/feature.ts exports it.`);
    }
  }
  problems.push(...checkRequires(registered));
  return problems;
}

function checkFolder({ folder, manifest, files, readme, changelog }: FeatureFolder, registeredIds: ReadonlySet<string>): string[] {
  const at = `app/features/${folder}`;
  const problems: string[] = [];
  if (folderForId(manifest.id) !== folder) {
    problems.push(`${at}/feature.ts: id "${manifest.id}" does not match its folder; the folder for it is app/features/${folderForId(manifest.id)}/.`);
  }
  if (!registeredIds.has(manifest.id)) problems.push(`${at}/feature.ts: "${manifest.id}" is not in FEATURES; add it to app/features/index.ts.`);
  if (manifest.name.trim() === "") problems.push(`${at}/feature.ts: name is empty.`);
  if (manifest.summary.trim() === "") problems.push(`${at}/feature.ts: summary is empty.`);
  if (!KEBAB.test(manifest.icon)) problems.push(`${at}/feature.ts: icon "${manifest.icon}" is not a Lucide icon name in kebab case, such as "map-pin".`);

  for (const [key, spec] of Object.entries(manifest.settings ?? {})) {
    if (typeof spec.label !== "string" || spec.label.trim() === "") problems.push(`${at}/feature.ts: setting ${key} has no label; players see it as a row name.`);
    if (typeof spec.help !== "string" || spec.help.trim() === "") problems.push(`${at}/feature.ts: setting ${key} has no help; say in one line what it does.`);
  }

  for (const capability of manifest.capabilities ?? []) {
    if (!KNOWN_USES.has(capability)) {
      problems.push(`${at}/feature.ts: uses "${capability}", which the verifier does not know (ENHANCEMENT_CAPABILITY_FIELDS in app/shared/enhancement-contracts.ts).`);
    }
  }

  const hasMain = files.includes("main.ts");
  if (manifest.parts.includes("main") !== hasMain) {
    problems.push(hasMain
      ? `${at}/feature.ts: the folder has main.ts, so parts must list "main".`
      : `${at}/feature.ts: parts lists "main", but the folder has no main.ts.`);
  }
  if ((manifest.network ?? []).length > 0 && !manifest.parts.includes("main")) {
    problems.push(`${at}/feature.ts: network hosts are reached only from a main part; add main.ts and "main" to parts.`);
  }

  problems.push(...checkShots(at, manifest.shots, files));
  if (!files.some((file) => file.startsWith("media/"))) problems.push(`${at}/media/: missing; keep the folder (with .gitkeep while it has no pictures).`);
  if (readme === null) problems.push(`${at}/README.md: missing; say what the feature does in one or two sentences, then how to use it.`);
  else problems.push(...checkReadme(`${at}/README.md`, readme));
  if (changelog === null) problems.push(`${at}/CHANGELOG.md: missing; start it with a "## Unreleased" heading.`);
  else if (!/^## Unreleased$/m.test(changelog)) problems.push(`${at}/CHANGELOG.md: no "## Unreleased" heading; the release script stamps it with the app version.`);
  return problems;
}

function checkShots(at: string, shots: readonly string[], files: readonly string[]): string[] {
  const problems: string[] = [];
  shots.forEach((caption, index) => {
    if (caption.trim() === "") problems.push(`${at}/feature.ts: shot ${index + 1} has an empty caption.`);
    if (!files.includes(`media/shot-${index + 1}.webp`)) problems.push(`${at}/media/shot-${index + 1}.webp: missing for the caption "${caption}".`);
  });
  for (const file of files) {
    const shot = SHOT_FILE.exec(file);
    if (shot !== null && Number(shot[1]) > shots.length) problems.push(`${at}/${file}: has no caption; add one to shots or delete the file.`);
  }
  return problems;
}

/**
 * The Markdown the launcher renders: paragraphs, `###` headings, numbered and bulleted
 * lists, **bold**, links to www.gwonmac.com, <kbd> keys and one `>` note.
 */
export function checkReadme(path: string, text: string): string[] {
  const problems: string[] = [];
  const lines = text.split("\n");
  const first = lines.findIndex((line) => line.trim() !== "");
  if (first === -1) return [`${path}: empty; say what the feature does in one or two sentences.`];
  if (/^(#|>|\s*([-*+]|\d+\.)\s)/.test(lines[first] ?? "")) problems.push(`${path}:${first + 1}: start with what the feature does, as a plain sentence.`);
  let notes = 0;
  let inNote = false;
  lines.forEach((line, index) => {
    const where = `${path}:${index + 1}`;
    const heading = /^(#+)\s/.exec(line);
    if (heading !== null && heading[1]?.length !== 3) problems.push(`${where}: only ### headings are allowed.`);
    if (/^\s*\|/.test(line)) problems.push(`${where}: tables are not allowed.`);
    if (/!\[/.test(line)) problems.push(`${where}: images are not allowed; put pictures in media/ and caption them in shots.`);
    const tags = new Set([...line.matchAll(/<\/?([a-zA-Z][\w-]*)[^>]*>/g)].map((tag) => tag[1]));
    for (const tag of tags) {
      if (tag !== "kbd") problems.push(`${where}: HTML <${tag}> is not allowed; only <kbd> keys.`);
    }
    for (const link of line.replace(/!\[[^\]]*\]\([^)]*\)/g, "").matchAll(/\]\(([^)\s]*)\)/g)) {
      const target = link[1] ?? "";
      if (!GWONMAC_LINK.test(target)) problems.push(`${where}: link to ${target} is not allowed; link only to https://www.gwonmac.com.`);
    }
    for (const url of line.replace(/\]\([^)]*\)/g, "]").matchAll(/https?:\/\/[^\s)>]+/g)) {
      if (!GWONMAC_LINK.test(url[0])) problems.push(`${where}: ${url[0]} is an external link; link only to https://www.gwonmac.com.`);
    }
    const note = line.startsWith(">");
    if (note && !inNote) notes += 1;
    if (note && !inNote && notes === 2) problems.push(`${where}: only one > note is allowed.`);
    inNote = note;
  });
  return problems;
}

function checkRequires(registered: readonly FeatureDefinition[]): string[] {
  const byId = new Map(registered.map((feature) => [feature.id, feature]));
  const problems: string[] = [];
  for (const feature of registered) {
    for (const required of feature.requires ?? []) {
      if (!byId.has(required)) problems.push(`app/features/${folderForId(feature.id)}/feature.ts: requires "${required}", which is not a feature id.`);
    }
  }
  const done = new Set<string>();
  const reported = new Set<string>();
  const visit = (id: string, path: readonly string[]): void => {
    const start = path.indexOf(id);
    if (start !== -1) {
      const cycle = [...path.slice(start), id];
      const key = [...cycle.slice(0, -1)].sort().join(",");
      if (!reported.has(key)) {
        reported.add(key);
        problems.push(`app/features/${folderForId(id)}/feature.ts: requires forms a cycle: ${cycle.join(" → ")}. A feature cannot need itself.`);
      }
      return;
    }
    if (done.has(id)) return;
    for (const required of byId.get(id)?.requires ?? []) {
      if (byId.has(required)) visit(required, [...path, id]);
    }
    done.add(id);
  };
  for (const feature of registered) visit(feature.id, []);
  return problems;
}
