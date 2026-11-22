/**
 * Feature platform metrics: counts how far features are from "one folder on shared building
 * blocks, switched by one decision". Prints the metrics table of
 * docs/feature-platform-plan.md for a git revision, so every phase can be measured the same way.
 *
 * Usage: node scripts/feature-metrics.mjs [revision]   (default HEAD; reads git objects, not the
 * working tree, so any commit or branch can be measured without checking it out).
 *
 * Some hits are correct where they are: a certified stage that has the Feature's name, a kernel
 * region, input plumbing, a test fixture. scripts/feature-metrics-allowed.json lists each one with
 * a category and a reason. A metric with an allowed list counts only the hits not on it, and its
 * target is 0; the script also prints each remaining hit, which is the work left. An allowed entry
 * that matches nothing is stale and must go, so the list cannot hide a later hit.
 *
 * `measure()` is also imported by tests/policy/feature-metrics-ceilings.test.ts. Without a revision
 * it measures the working tree (tracked and untracked files) and the test compares the values with
 * scripts/feature-metrics-ceilings.json.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const NOT_TESTS = [":!*.test.ts", ":!*.spec.ts", ":!*.golden.json"];
/** IPC channel tables: their `gw:a:b` names are channels checked at the preload bridge, not window events. */
const IPC_CHANNEL_FILES = ["app/shared/ipc/**", "app/features/*/shared/ipc.ts"];
const ALLOWED_PATH = "scripts/feature-metrics-allowed.json";
const ALLOWED_CATEGORIES = [
  "registry or contract",
  "certified stage or verifier",
  "kernel or block",
  "host plumbing",
  "test helper",
  "same word, not the Feature",
  "inside one Feature",
];

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
 * @typedef {{ file?: string, name?: string, category: string, reason: string }} AllowedEntry
 * @typedef {{ file?: string, name?: string, weight: number }} Hit
 * @typedef {{ key: string, name: string, value: number, allowed?: number, remaining?: Hit[] }} Metric
 */

/**
 * Check the allowed list's shape: every entry names what it allows, a known category and a reason.
 * @param {unknown} raw
 * @returns {Record<string, AllowedEntry[]>}
 */
function parseAllowed(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(`${ALLOWED_PATH}: expected an object of lists`);
  for (const [key, entries] of Object.entries(raw)) {
    if (!Array.isArray(entries)) throw new Error(`${ALLOWED_PATH}: "${key}" must be a list`);
    const seen = new Set();
    for (const entry of entries) {
      const id = `${key}: ${[entry?.file, entry?.name].filter(Boolean).join(" ")}`;
      if (typeof entry?.file !== "string" && typeof entry?.name !== "string") throw new Error(`${ALLOWED_PATH} ${id}: an entry needs a file or a name`);
      if (key === "gwEvents" && entry.file !== undefined) throw new Error(`${ALLOWED_PATH} ${id}: an event entry names only the event`);
      if (!ALLOWED_CATEGORIES.includes(entry.category)) throw new Error(`${ALLOWED_PATH} ${id}: category must be one of ${ALLOWED_CATEGORIES.join(", ")}`);
      if (typeof entry.reason !== "string" || entry.reason.trim() === "") throw new Error(`${ALLOWED_PATH} ${id}: an entry needs a one-line reason`);
      if (seen.has(id)) throw new Error(`${ALLOWED_PATH} ${id}: listed twice`);
      seen.add(id);
    }
  }
  return /** @type {Record<string, AllowedEntry[]>} */ (raw);
}

/**
 * Measure every metric.
 * @param {string} [revision] git revision to read; omit to read the working tree.
 */
export function measure(revision) {
  /** `git grep` target: a revision's objects, or the working tree including untracked files. */
  const [grepFlag, grepRev] = revision === undefined ? [["--untracked"], []] : [[], [revision]];
  /** `git grep` prefixes paths with `<revision>:` when it reads a revision. */
  const stripRev = (/** @type {string} */ line) => (revision === undefined ? line : line.slice(revision.length + 1));

  /**
   * Number of matching lines for an extended regex under the given paths.
   * @param {string} pattern
   * @param {string[]} paths
   */
  const countLines = (pattern, paths) => lines(git(["grep", "-hE", ...grepFlag, pattern, ...grepRev, "--", ...paths])).length;

  /**
   * Matching lines per file for an extended regex under the given paths.
   * @param {string} pattern
   * @param {string[]} paths
   * @returns {Hit[]}
   */
  const linesPerFile = (pattern, paths) =>
    lines(git(["grep", "-cE", ...grepFlag, pattern, ...grepRev, "--", ...paths])).map((line) => {
      const at = stripRev(line).lastIndexOf(":");
      return { file: stripRev(line).slice(0, at), weight: Number(stripRev(line).slice(at + 1)) };
    });

  /**
   * Each distinct matched string, without its quotes, with the files it appears in.
   * @param {string} pattern
   * @param {string[]} paths
   */
  const distinctMatches = (pattern, paths) => {
    /** @type {Map<string, Set<string>>} */
    const found = new Map();
    for (const line of lines(git(["grep", "-oE", ...grepFlag, pattern, ...grepRev, "--", ...paths]))) {
      const at = stripRev(line).indexOf(":");
      const [file, match] = [stripRev(line).slice(0, at), stripRev(line).slice(at + 2, -1)];
      found.set(match, (found.get(match) ?? new Set()).add(file));
    }
    return found;
  };

  /**
   * @param {string} pattern
   * @param {string[]} paths
   */
  const filesMatching = (pattern, paths) => lines(git(["grep", "-lE", ...grepFlag, pattern, ...grepRev, "--", ...paths])).map(stripRev);

  /** @param {string} dir */
  const listFiles = (dir) =>
    revision === undefined
      ? lines(git(["ls-files", "--cached", "--others", "--exclude-standard", dir]))
      : lines(git(["ls-tree", "-r", "--name-only", revision, dir]));

  /** @param {string} path */
  const readFile = (path) => (revision === undefined ? readFileSync(path, "utf8") : git(["show", `${revision}:${path}`]));
  /** @param {string} path */
  const fileExists = (path) => (revision === undefined ? existsSync(path) : listFiles(path).includes(path));

  // An older revision without the list counts every hit.
  const allowedList = fileExists(ALLOWED_PATH) ? parseAllowed(JSON.parse(readFile(ALLOWED_PATH))) : {};
  /** @type {string[]} */
  const stale = [];

  /**
   * Split hits into allowed and remaining; record allowed entries that match no hit.
   * @param {string} key
   * @param {Hit[]} hits
   */
  const applyAllowed = (key, hits) => {
    const entries = allowedList[key] ?? [];
    const matches = (/** @type {AllowedEntry} */ entry, /** @type {Hit} */ hit) =>
      (entry.file === undefined || entry.file === hit.file) && (entry.name === undefined || entry.name === hit.name);
    for (const entry of entries) {
      if (!hits.some((hit) => matches(entry, hit))) stale.push(`${key}: ${[entry.file, entry.name].filter(Boolean).join(" ")}`);
    }
    const remaining = hits.filter((hit) => !entries.some((entry) => matches(entry, hit)));
    const sum = (/** @type {Hit[]} */ list) => list.reduce((total, hit) => total + hit.weight, 0);
    return { value: sum(remaining), allowed: sum(hits) - sum(remaining), remaining };
  };

  const featureFolders = listFiles("app/features")
    .map((path) => path.match(/^app\/features\/([^/]+)\/feature\.ts$/)?.[1])
    .filter(/** @returns {folder is string} */ (folder) => folder !== undefined)
    // "tools" is the Tools master switch (the launch mode), not a feature of its own.
    .filter((folder) => folder !== "tools")
    .sort();

  const rendererFiles = listFiles("app/renderer");
  const FEATURE_DOMAIN = /(^|[-/])(skill|whisper|trade|people|party|alcohol|effect|cartography)[-.]/;

  const featureNames = featureFolders.map((folder) => {
    const manifest = readFile(`app/features/${folder}/feature.ts`);
    const id = manifest.match(/id: "([^"]+)"/)?.[1] ?? folder;
    return { folder, id, names: [...new Set([id, folder])].join("|") };
  });

  /** One hit per file outside a Feature's folder that quotes its id or folder name; `name` is the id. */
  const outsideHits = featureNames.flatMap(({ folder, id, names }) =>
    filesMatching(`["'](${names})["']`, ["app", `:!app/features/${folder}`, ...NOT_TESTS]).map((file) => ({ file, name: id, weight: 1 })),
  );
  const outside = applyAllowed("namesOutsideFolder", outsideHits);
  const outsideFolder = featureNames.map(({ folder, id }) => ({
    folder,
    count: outside.remaining.filter((hit) => hit.name === id).length,
    allowed: outsideHits.filter((hit) => hit.name === id).length - outside.remaining.filter((hit) => hit.name === id).length,
  }));

  const eventMatches = distinctMatches("['\"]gw:[a-z0-9:-]+['\"]", ["app", ...NOT_TESTS, ...IPC_CHANNEL_FILES.map((path) => `:(exclude,glob)${path}`)]);
  // An allowed event entry names only the event, so it may move between files; `file` lists where it is.
  const events = applyAllowed("gwEvents", [...eventMatches].map(([name, files]) => ({ name, file: [...files].sort().join(", "), weight: 1 })));
  const ipcChannels = distinctMatches("['\"]gw:[a-z0-9:-]+['\"]", IPC_CHANNEL_FILES.map((path) => `:(glob)${path}`)).size;

  const renderer = applyAllowed(
    "rendererFeatureFiles",
    rendererFiles
      .filter((path) => FEATURE_DOMAIN.test(path.replace(/^app\/renderer\//, "/")) && !/\.(test|spec)\.ts$/.test(path))
      .map((file) => ({ file, weight: 1 })),
  );
  const localStorageUses = applyAllowed("toolsUiLocalStorage", linesPerFile("localStorage", ["app/ui/tools/src", ...NOT_TESTS]));

  for (const key of Object.keys(allowedList)) {
    if (!["namesOutsideFolder", "gwEvents", "rendererFeatureFiles", "toolsUiLocalStorage"].includes(key)) stale.push(`${key}: not a metric with an allowed list`);
  }

  // Every Feature id (or folder name) quoted in the shared substrates, or an `attach<Id>` call.
  const substrateNames = featureNames
    .map(({ id, names }) => `["'](${names})["']|attach${id.charAt(0).toUpperCase()}${id.slice(1)}\\b`)
    .join("|");

  /** @type {Metric[]} */
  const metrics = [
    { key: "featureActivationRequested", name: "`featureActivationRequested(` calls in app (no tests)", value: countLines("featureActivationRequested\\(", ["app", ...NOT_TESTS]) },
    { key: "policyReads", name: "`policy().` reads in app/features", value: countLines("policy\\(\\)\\.", ["app/features", ...NOT_TESTS]) },
    { key: "plainGame", name: "`plainGame` reads in app (no tests)", value: countLines("plainGame", ["app", ...NOT_TESTS]) },
    { key: "gwEvents", name: "Distinct `gw:*` window event names in app (IPC channels excluded)", ...events },
    { key: "substrateFeatureNames", name: "Lines naming any Feature id in shared substrates", value: countLines(substrateNames, ["app/renderer/tools-companion-substrates.ts"]) },
    { key: "rendererFeatureFiles", name: "Feature-domain files under app/renderer/", ...renderer },
    { key: "namesOutsideFolder", name: "Files outside a Feature's folder that name its id (no tests)", ...outside },
    { key: "toolsUiLocalStorage", name: "`localStorage` uses in Tools UI", ...localStorageUses },
    { key: "toolVIfCases", name: "Per-feature `v-if=\"tool === …\"` in launcher and Tools UI", value: countLines("v-if=\"tool ===", ["app/ui", ...NOT_TESTS]) },
  ];

  return { metrics, outsideFolder, ipcChannels, stale };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const revision = process.argv[2] ?? "HEAD";
  const { metrics, outsideFolder, ipcChannels, stale } = measure(revision);
  console.log(`Feature metrics at ${git(["rev-parse", "--short", revision]).trim()}\n`);
  console.log("Value counts what is left to remove. Allowed counts hits that are correct where they are");
  console.log(`(${ALLOWED_PATH}, each with a reason).\n`);
  console.log("| Metric | Value | Allowed |\n|---|---|---|");
  for (const { name, value, allowed } of metrics) console.log(`| ${name} | ${value} | ${allowed ?? "–"} |`);
  console.log(`\nIPC channel names (not window events, not counted): ${ipcChannels}`);
  console.log("\nFiles outside a feature's folder that name its id, per feature (allowed in brackets):");
  console.log(
    outsideFolder
      .filter(({ count, allowed }) => count + allowed > 0)
      .sort((a, b) => b.count - a.count || a.folder.localeCompare(b.folder))
      .map(({ folder, count, allowed }) => `${folder} ${count} (${allowed})`)
      .join(", "),
  );
  for (const { key, remaining } of metrics) {
    if (!remaining?.length) continue;
    console.log(`\nRemaining ${key}:`);
    for (const hit of remaining) console.log(`  ${[hit.name, hit.file].filter(Boolean).join("  ")}${hit.weight > 1 ? `  (${hit.weight} lines)` : ""}`);
  }
  if (stale.length > 0) console.log(`\nStale allowed entries (remove them from ${ALLOWED_PATH}):\n  ${stale.join("\n  ")}`);
}
