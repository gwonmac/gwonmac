// Reads every app/features/<folder>/ that has a feature.ts the way the contract check
// (app/features/contract.ts) takes it: manifest, file list, README and CHANGELOG.
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

export async function featureFolders(): Promise<FeatureFolder[]> {
  const folders = readdirSync(featuresDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(featuresDirectory, entry.name, "feature.ts")))
    .map((entry) => entry.name);
  return Promise.all(folders.map(async (folder) => {
    const directory = path.join(featuresDirectory, folder);
    const manifest = (await import(path.join(directory, "feature.ts")) as { default: FeatureDefinition }).default;
    return {
      folder,
      manifest,
      files: filesUnder(directory),
      readme: readIfPresent(path.join(directory, "README.md")),
      changelog: readIfPresent(path.join(directory, "CHANGELOG.md")),
    };
  }));
}
