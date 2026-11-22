/**
 * Feature platform metrics: counts how far features are from "one folder on shared building
 * blocks, switched by one decision". Prints the metrics table of
 * docs/feature-platform-plan.md for a git revision, so every phase can be measured the same way.
 *
 * Usage: node scripts/feature-metrics.mjs [revision]   (default HEAD; reads git objects, not the
 * working tree, so any commit or branch can be measured without checking it out).
 *
 * `measure()` is also imported by tests/policy/feature-metrics-ceilings.test.ts. Without a revision
 * it measures the working tree (tracked and untracked files) and the test compares the values with
 * scripts/feature-metrics-ceilings.json.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NOT_TESTS = [":!*.test.ts", ":!*.spec.ts", ":!*.golden.json"];

/** @param {string[]} args */
function git(args) {
  try {
    return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  } catch (error) {
    // git grep exits 1 when nothing matches; that is a count of 0, not a failure.
    if (error instanceof Error && "status" in error && error.status === 1 && args[0] === "grep") return "";
    throw error;
  }
}

/** @param {string} text */
const lines = (text) => text.split("\n").filter(Boolean);

/**
 * Measure every metric.
 * @param {string} [revision] git revision to read; omit to read the working tree.
 */
export function measure(revision) {
  /** `git grep` target: a revision's objects, or the working tree including untracked files. */
  const [grepFlag, grepRev] = revision === undefined ? [["--untracked"], []] : [[], [revision]];

  /**
   * Number of matching lines for an extended regex under the given paths.
   * @param {string} pattern
   * @param {string[]} paths
   */
  const countLines = (pattern, paths) => lines(git(["grep", "-hE", ...grepFlag, pattern, ...grepRev, "--", ...paths])).length;

  /**
   * Number of distinct matched strings for an extended regex under the given paths.
   * @param {string} pattern
   * @param {string[]} paths
   */
  const countDistinct = (pattern, paths) =>
    new Set(lines(git(["grep", "-ohE", ...grepFlag, pattern, ...grepRev, "--", ...paths]))).size;

  /**
   * @param {string} pattern
   * @param {string[]} paths
   */
  const filesMatching = (pattern, paths) => lines(git(["grep", "-lE", ...grepFlag, pattern, ...grepRev, "--", ...paths]));

  /** @param {string} dir */
  const listFiles = (dir) =>
    revision === undefined
      ? lines(git(["ls-files", "--cached", "--others", "--exclude-standard", dir]))
      : lines(git(["ls-tree", "-r", "--name-only", revision, dir]));

  /** @param {string} path */
  const readFile = (path) => (revision === undefined ? readFileSync(path, "utf8") : git(["show", `${revision}:${path}`]));

  const featureFolders = listFiles("app/features")
    .map((path) => path.match(/^app\/features\/([^/]+)\/feature\.ts$/)?.[1])
    .filter(/** @returns {folder is string} */ (folder) => folder !== undefined)
    // "tools" is the Tools master switch (the launch mode), not a feature of its own.
    .filter((folder) => folder !== "tools")
    .sort();

  const rendererFiles = listFiles("app/renderer");
  const FEATURE_DOMAIN = /(^|[-/])(skill|whisper|trade|people|party|alcohol|effect|cartography)[-.]/;

  const outsideFolder = featureFolders.map((folder) => {
    const manifest = readFile(`app/features/${folder}/feature.ts`);
    const id = manifest.match(/id: "([^"]+)"/)?.[1] ?? folder;
    const names = [...new Set([id, folder])].join("|");
    const files = filesMatching(`["'](${names})["']`, ["app", `:!app/features/${folder}`, ...NOT_TESTS]);
    return { folder, count: files.length };
  });

  /** @type {{ key: string, name: string, value: number }[]} */
  const metrics = [
    { key: "featureActivationRequested", name: "`featureActivationRequested(` calls in app (no tests)", value: countLines("featureActivationRequested\\(", ["app", ...NOT_TESTS]) },
    { key: "policyReads", name: "`policy().` reads in app/features", value: countLines("policy\\(\\)\\.", ["app/features", ...NOT_TESTS]) },
    { key: "plainGame", name: "`plainGame` reads in app (no tests)", value: countLines("plainGame", ["app", ...NOT_TESTS]) },
    { key: "gwEvents", name: "Distinct `gw:*` window event names in app", value: countDistinct("['\"]gw:[a-z0-9:-]+['\"]", ["app", ...NOT_TESTS]) },
    { key: "substrateFeatureNames", name: "Feature names in shared substrates (`attachWhispers`, `attachTravel`)", value: countLines("attach(Whispers|Travel)", ["app/renderer/tools-companion-substrates.ts"]) },
    { key: "rendererFeatureFiles", name: "Feature-domain files under app/renderer/", value: rendererFiles.filter((path) => FEATURE_DOMAIN.test(path.replace(/^app\/renderer\//, "/")) && !/\.(test|spec)\.ts$/.test(path)).length },
    { key: "toolsUiLocalStorage", name: "`localStorage` uses in Tools UI", value: countLines("localStorage", ["app/ui/tools/src", ...NOT_TESTS]) },
    { key: "toolVIfCases", name: "Per-feature `v-if=\"tool === …\"` in launcher and Tools UI", value: countLines("v-if=\"tool ===", ["app/ui", ...NOT_TESTS]) },
  ];

  return { metrics, outsideFolder };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const revision = process.argv[2] ?? "HEAD";
  const { metrics, outsideFolder } = measure(revision);
  console.log(`Feature metrics at ${git(["rev-parse", "--short", revision]).trim()}\n`);
  console.log("| Metric | Value |\n|---|---|");
  for (const { name, value } of metrics) console.log(`| ${name} | ${value} |`);
  console.log("\nFiles outside a feature's folder that name its id (no tests):");
  console.log(
    outsideFolder
      .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
      .map(({ folder, count }) => `${folder} ${count}`)
      .join(", "),
  );
}
