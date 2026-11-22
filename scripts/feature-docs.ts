/**
 * Builds the website's Feature pages from each Feature's README.md, so a Feature has one
 * source of player docs (docs/feature-platform-plan.md, step 6.6). Each page takes its title,
 * description and icon from the manifest and its text from the README, unchanged.
 *
 * The pages are build output: the website runs this before every dev, check and build, and
 * git ignores them (website/.gitignore). They go to website/content/docs as
 * `<order>.<folder>.md`, so a page answers at /docs/<folder>. Orders from 100 up belong to
 * this script; hand-written docs pages stay below 100. The list follows the Features tab's
 * kinds: the launch mode first, then each card kind under its label as a navigation section.
 *
 *   node --import ./scripts/ts-hook.mjs scripts/feature-docs.ts
 */
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { folderForId } from "../app/features/contract.ts";
import { FEATURE_KINDS, FEATURE_KIND_LABELS, type FeatureDefinition } from "../app/features/define.ts";
import { FEATURES } from "../app/features/index.ts";

export const FEATURE_DOCS_DIRECTORY = "website/content/docs";
/** The first order number a generated page takes; hand-written pages use the numbers below it. */
export const FIRST_FEATURE_DOC = 100;
/** The docs tab the Feature pages sit in, with the pages about the launcher, the Hub and the game. */
const TAB = "Features";
/** The file name of a generated page: an order from FIRST_FEATURE_DOC up, then the name. */
export const GENERATED_PAGE = /^[1-9]\d{2,}\.[^.]+\.md$/u;

export type FeatureDocSource = Readonly<{ manifest: FeatureDefinition; readme: string | null }>;
export type FeatureDocPage = Readonly<{ name: string; file: string; text: string }>;

const KIND_ORDER = ["mode", ...FEATURE_KINDS.filter((kind) => kind !== "mode")] as const;
const quoted = (value: string) => JSON.stringify(value);

/** One page per Feature, in Features tab order (kind, then FEATURES order). Throws when a README is missing. */
export function featureDocPages(sources: readonly FeatureDocSource[]): FeatureDocPage[] {
  const ordered = KIND_ORDER.flatMap((kind) => sources.filter(({ manifest }) => manifest.kind === kind));
  const sectioned = new Set<string>();
  return ordered.map(({ manifest, readme }, index) => {
    const name = folderForId(manifest.id);
    if (readme === null || readme.trim() === "") {
      throw new Error(`app/features/${name}/README.md: missing or empty; the website builds the Feature's page from it.`);
    }
    const section = manifest.kind === "mode" || sectioned.has(manifest.kind) ? undefined : FEATURE_KIND_LABELS[manifest.kind];
    if (section !== undefined) sectioned.add(manifest.kind);
    const fields = [
      `title: ${quoted(manifest.name)}`,
      `description: ${quoted(manifest.summary)}`,
      `icon: ${quoted(`lucide:${manifest.icon}`)}`,
      ...(index === 0 ? [`tab: ${TAB}`] : []),
      ...(section === undefined ? [] : [`section: ${quoted(section)}`]),
    ];
    return {
      name,
      file: `${FIRST_FEATURE_DOC + index}.${name}.md`,
      text: `---\n${fields.join("\n")}\n---\n\n${readme.trim()}\n`,
    };
  });
}

/** Every registered Feature with its README as the repository has it. */
export function repositoryFeatureSources(root: string): FeatureDocSource[] {
  return FEATURES.map((manifest) => {
    const file = path.join(root, "app/features", folderForId(manifest.id), "README.md");
    return { manifest, readme: existsSync(file) ? readFileSync(file, "utf8") : null };
  });
}

/** Writes the pages and removes generated pages no Feature has any more. Returns what changed. */
export function writeFeatureDocs(root: string, pages: readonly FeatureDocPage[]): string[] {
  const directory = path.join(root, FEATURE_DOCS_DIRECTORY);
  const wanted = new Map(pages.map((page) => [page.file, page.text]));
  const changes: string[] = [];
  for (const file of readdirSync(directory).filter((name) => GENERATED_PAGE.test(name) && !wanted.has(name))) {
    rmSync(path.join(directory, file));
    changes.push(`removed ${file}`);
  }
  for (const [file, text] of wanted) {
    const target = path.join(directory, file);
    if (existsSync(target) && readFileSync(target, "utf8") === text) continue;
    writeFileSync(target, text);
    changes.push(`wrote ${file}`);
  }
  return changes;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const root = path.resolve(import.meta.dirname, "..");
  const pages = featureDocPages(repositoryFeatureSources(root));
  const changes = writeFeatureDocs(root, pages);
  console.log(`Feature pages: ${pages.length} in ${FEATURE_DOCS_DIRECTORY}${changes.length ? ` (${changes.join(", ")})` : ", unchanged"}.`);
}
