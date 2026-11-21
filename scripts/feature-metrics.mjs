/**
 * Feature platform metrics: counts how far features are from "one folder on shared building
 * blocks, switched by one decision". Prints the metrics table of
 * docs/feature-platform-plan.md for a git revision, so every phase can be measured the same way.
 *
 * Usage: node scripts/feature-metrics.mjs [revision]   (default HEAD; reads git objects, not the
 * working tree, so any commit or branch can be measured without checking it out).
 */
import { execFileSync } from "node:child_process";

const revision = process.argv[2] ?? "HEAD";
const NOT_TESTS = [":!*.test.ts", ":!*.spec.ts", ":!*.golden.json"];

function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // git grep exits 1 when nothing matches; that is a count of 0, not a failure.
    if (error.status === 1 && args[0] === "grep") return "";
    throw error;
  }
}

const lines = (text) => text.split("\n").filter(Boolean);

/** Number of matching lines for an extended regex under the given paths. */
function countLines(pattern, paths) {
  return lines(git(["grep", "-hE", pattern, revision, "--", ...paths])).length;
}

/** Number of distinct matched strings for an extended regex under the given paths. */
function countDistinct(pattern, paths) {
  return new Set(lines(git(["grep", "-ohE", pattern, revision, "--", ...paths]))).size;
}

function filesMatching(pattern, paths) {
  return lines(git(["grep", "-lE", pattern, revision, "--", ...paths]));
}

const featureFolders = lines(git(["ls-tree", "-r", "--name-only", revision, "app/features"]))
  .map((path) => path.match(/^app\/features\/([^/]+)\/feature\.ts$/)?.[1])
  .filter(Boolean)
  // "tools" is the Tools master switch (the launch mode), not a feature of its own.
  .filter((folder) => folder !== "tools")
  .sort();

const rendererFiles = lines(git(["ls-tree", "-r", "--name-only", revision, "app/renderer"]));
const FEATURE_DOMAIN = /(^|[-/])(skill|whisper|trade|people|party|alcohol|effect|cartography)[-.]/;

const outsideFolder = featureFolders.map((folder) => {
  const manifest = git(["show", `${revision}:app/features/${folder}/feature.ts`]);
  const id = manifest.match(/id: "([^"]+)"/)?.[1] ?? folder;
  const names = [...new Set([id, folder])].join("|");
  const files = filesMatching(`["'](${names})["']`, ["app", `:!app/features/${folder}`, ...NOT_TESTS]);
  return { folder, count: files.length };
});

const rows = [
  ["`featureActivationRequested(` calls in app (no tests)", countLines("featureActivationRequested\\(", ["app", ...NOT_TESTS])],
  ["`policy().` reads in app/features", countLines("policy\\(\\)\\.", ["app/features", ...NOT_TESTS])],
  ["`plainGame` reads in app (no tests)", countLines("plainGame", ["app", ...NOT_TESTS])],
  ["Distinct `gw:*` window event names in app", countDistinct("['\"]gw:[a-z0-9:-]+['\"]", ["app", ...NOT_TESTS])],
  ["Feature names in shared substrates (`attachWhispers`, `attachTravel`)", countLines("attach(Whispers|Travel)", ["app/renderer/tools-companion-substrates.ts"])],
  ["Feature-domain files under app/renderer/", rendererFiles.filter((path) => FEATURE_DOMAIN.test(path.replace(/^app\/renderer\//, "/")) && !/\.(test|spec)\.ts$/.test(path)).length],
  ["`localStorage` uses in Tools UI", countLines("localStorage", ["app/ui/tools/src", ...NOT_TESTS])],
  ["Per-feature `v-if=\"tool === …\"` in launcher and Tools UI", countLines("v-if=\"tool ===", ["app/ui", ...NOT_TESTS])],
];

console.log(`Feature metrics at ${git(["rev-parse", "--short", revision]).trim()}\n`);
console.log("| Metric | Value |\n|---|---|");
for (const [name, value] of rows) console.log(`| ${name} | ${value} |`);
console.log("\nFiles outside a feature's folder that name its id (no tests):");
console.log(
  outsideFolder
    .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
    .map(({ folder, count }) => `${folder} ${count}`)
    .join(", "),
);
