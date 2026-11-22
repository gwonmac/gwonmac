// Reads every app/features/<folder>/ that has a feature.ts the way the contract check
// (app/features/contract.ts) takes it: manifest, file list, README, CHANGELOG and the modules
// its TypeScript and Vue files import.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { FeatureFolder } from "../../app/features/contract.ts";
import type { FeatureDefinition } from "../../app/features/define.ts";

const featuresDirectory = path.resolve(import.meta.dirname, "../../app/features");

const filesUnder = (directory: string, prefix = ""): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? filesUnder(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]);
const readIfPresent = (file: string): string | null => existsSync(file) ? readFileSync(file, "utf8") : null;

const SOURCE = /\.(ts|vue)$/;
const IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*["']((?:\.{1,2}|@shared)\/[^"']+)["']/g;
/**
 * The repository paths that the TypeScript and Vue files of app/features/<folder>/ import, by
 * relative specifier or the UI bundles' `@shared` alias, with or without an extension.
 */
export function featureImports(folder: string, sources: ReadonlyMap<string, string>): string[] {
  const imports = new Set<string>();
  for (const [file, source] of sources) {
    if (!SOURCE.test(file)) continue;
    for (const [, specifier] of source.matchAll(IMPORT)) {
      if (specifier === undefined) continue;
      const target = specifier.startsWith("@shared/")
        ? `app/shared/${specifier.slice("@shared/".length)}`
        : path.posix.join("app/features", folder, path.posix.dirname(file), specifier);
      imports.add(path.posix.extname(target) === "" ? `${target}.ts` : target.replace(/\.js$/, ".ts"));
    }
  }
  return [...imports];
}

export async function featureFolders(): Promise<FeatureFolder[]> {
  const folders = readdirSync(featuresDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(featuresDirectory, entry.name, "feature.ts")))
    .map((entry) => entry.name);
  return Promise.all(folders.map(async (folder) => {
    const directory = path.join(featuresDirectory, folder);
    const manifest = (await import(path.join(directory, "feature.ts")) as { default: FeatureDefinition }).default;
    const files = filesUnder(directory);
    const sources = new Map(files.filter((file) => SOURCE.test(file)).map((file) => [file, readFileSync(path.join(directory, file), "utf8")]));
    return {
      folder,
      manifest,
      files,
      readme: readIfPresent(path.join(directory, "README.md")),
      changelog: readIfPresent(path.join(directory, "CHANGELOG.md")),
      imports: featureImports(folder, sources),
    };
  }));
}
