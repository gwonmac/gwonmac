// The release workflow's rules, in one place that `pnpm test` reaches.
//
// A maintainer or agent starts a fact-only release with one command:
//
//   facts <version> [--dry-run]   on hotfix/<version>: proves that everything
//                                 since the release it patches is reviewed
//                                 client facts, then pushes the branch, starts
//                                 client watch with `regression` and the
//                                 release workflow, and opens the PR
//
// .github/workflows/release.yml calls three commands, one per job:
//
//   prepare <version>             before approval: branch, version, and that
//                                 the version never shipped
//   assets <version> <make> <out> in the signed build: the canonical asset
//                                 names and RELEASES.json
//   draft <version> <assets>      after qualify and build: tag the commit and
//                                 create the draft on exactly that commit
//
// `pnpm release:test` (scripts/test-draft-release.ts) is the consumer of the
// draft made here and reads the same version rule and asset list. Every GitHub
// call goes through an injected runner, so tests/unit/release-workflow.test.ts
// drives each refusal offline and feeds the draft this module creates into the
// consumer's own check.
import { spawnSync } from "node:child_process";
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { RELEASE_REPO, releaseAssetUrl } from "../app/shared/project-identity.js";
import {
  formatReleaseVersion,
  isPrerelease,
  parseReleaseVersion,
  releaseAssetNames,
} from "../app/shared/release.js";
import { parseReleaseManifest } from "../app/shared/release-manifest.js";
import { macOSBundleVersions } from "./macos-version.js";

export interface Release {
  /** Canonical version text, for example `1.4.0` or `1.4.0-rc.1`. */
  readonly version: string;
  readonly tag: string;
  readonly prerelease: boolean;
  readonly dmg: string;
  readonly zip: string;
}

/**
 * The one rule for a version this workflow may publish: the shared SemVer
 * grammar in canonical form, Stable, Beta or RC (Alpha stays private, see
 * isReleaseEligibleForTrack), and inside the bounds of Apple's bundle version.
 */
export function releaseOf(version: string): Release {
  const parsed = parseReleaseVersion(version);
  if (!parsed || formatReleaseVersion(parsed) !== version || parsed.channel === "alpha") {
    throw new Error(
      `A release is Stable, Beta, or RC: X.Y.Z or X.Y.Z-(beta|rc).N, not ${JSON.stringify(version)}.`,
    );
  }
  macOSBundleVersions(version);
  return {
    version,
    tag: `v${version}`,
    prerelease: isPrerelease(parsed),
    ...releaseAssetNames(version),
  };
}

export function releaseOfTag(tag: string): Release {
  if (!tag.startsWith("v")) {
    throw new Error(`A release tag is v followed by its version, not ${JSON.stringify(tag)}.`);
  }
  return releaseOf(tag.slice(1));
}

/** Every file a draft carries, sorted: what `draft` uploads and `release:test` expects. */
export function releaseAssets(release: Release): string[] {
  return [release.dmg, release.zip, "RELEASES.json", "SHA256SUMS.txt"].sort();
}

/** The Squirrel.Mac manifest that names this release's immutable ZIP URL. */
export function releaseManifest(release: Release, publishedAt: string): string {
  const date = new Date(publishedAt);
  if (Number.isNaN(date.valueOf())) {
    throw new Error("release publication timestamp is invalid");
  }
  const manifest = {
    url: releaseAssetUrl(release.tag, release.zip),
    name: `Guild Wars Reforged v${release.version}`,
    version: release.version,
    tag: release.tag,
    pub_date: date.toISOString(),
    notes: "",
  };
  if (!parseReleaseManifest(manifest)) {
    throw new Error("generated release manifest is invalid");
  }
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

/**
 * GitHub's generated notes with "What's Changed" regrouped by the Conventional
 * Commit type of each PR title: Features, Fixes, Other changes, then the rest
 * (New Contributors, the changelog link) as GitHub wrote it.
 */
export function groupReleaseNotes(generated: string): string {
  const groups = { feat: "", fix: "", other: "" };
  let rest = "";
  let changes = false;
  const lines = generated.endsWith("\n") ? generated.slice(0, -1).split("\n") : generated.split("\n");
  for (const line of lines) {
    if (line.startsWith("## ")) {
      changes = /What.s Changed/u.test(line);
      if (changes) continue;
    } else if (changes && line.startsWith("* ")) {
      if (/^\* feat[(!:]/u.test(line)) groups.feat += `${line}\n`;
      else if (/^\* fix[(!:]/u.test(line)) groups.fix += `${line}\n`;
      else groups.other += `${line}\n`;
      continue;
    }
    rest += `${line}\n`;
  }
  return [
    groups.feat && `## Features\n${groups.feat}\n`,
    groups.fix && `## Fixes\n${groups.fix}\n`,
    groups.other && `## Other changes\n${groups.other}\n`,
    rest,
  ].join("");
}

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export interface ReleaseDependencies {
  /** GITHUB_REPOSITORY, owner/name. */
  readonly repository: string;
  /** GITHUB_SHA: the commit the workflow was dispatched on. */
  readonly sha: string;
  run(command: string, args: readonly string[], cwd?: string): CommandResult;
}

function exactCommit(sha: string): string {
  if (!/^[0-9a-f]{40}$/u.test(sha)) {
    throw new Error(`A release targets one exact commit, not ${JSON.stringify(sha)}.`);
  }
  return sha;
}

function succeed(dependencies: ReleaseDependencies, command: string, args: readonly string[], cwd?: string): string {
  const result = dependencies.run(command, args, cwd);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.slice(0, 2).join(" ")} failed\n${result.stderr}`);
  }
  return result.stdout;
}

function releaseExists(dependencies: ReleaseDependencies, tag: string): boolean {
  return dependencies.run("gh", ["release", "view", tag, "--repo", dependencies.repository]).status === 0;
}

/**
 * The commit a tag points at, or null when there is no such tag. `gh api`
 * prints the 404 body on stdout, so only the exit status says whether the
 * lookup found a tag.
 */
function taggedCommit(dependencies: ReleaseDependencies, tag: string): string | null {
  const result = dependencies.run("gh", [
    "api", `repos/${dependencies.repository}/git/ref/tags/${tag}`, "--jq", ".object.sha",
  ]);
  return result.status === 0 ? result.stdout.trim() : null;
}

export function prepare(version: string, ref: string, dependencies: ReleaseDependencies): Release {
  if (ref !== "refs/heads/main" && !ref.startsWith("refs/heads/hotfix/")) {
    throw new Error(`Release from main or hotfix/*, not ${ref}.`);
  }
  const release = releaseOf(version);
  const sha = exactCommit(dependencies.sha);
  if (releaseExists(dependencies, release.tag)) {
    throw new Error(`Release ${release.tag} exists. Choose a higher version.`);
  }
  const tagged = taggedCommit(dependencies, release.tag);
  if (tagged !== null && tagged !== sha) {
    throw new Error(`Tag ${release.tag} points at ${tagged}, not ${sha}.`);
  }
  return release;
}

function onlyFile(directory: string, extension: string): string {
  const found = readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(extension))
    .map((entry) => path.join(entry.parentPath, entry.name));
  if (found.length !== 1) {
    throw new Error(`Expected one ${extension} in ${directory}, found ${found.length}.`);
  }
  return found[0]!;
}

/** Copies Forge's ZIP and DMG under their canonical names and writes RELEASES.json. */
export function collectAssets(release: Release, make: string, output: string, publishedAt: string): void {
  mkdirSync(output);
  copyFileSync(onlyFile(make, ".zip"), path.join(output, release.zip));
  copyFileSync(onlyFile(make, ".dmg"), path.join(output, release.dmg));
  writeFileSync(path.join(output, "RELEASES.json"), releaseManifest(release, publishedAt), { mode: 0o600 });
}

export function draft(version: string, assets: string, dependencies: ReleaseDependencies): Release {
  const release = releaseOf(version);
  const sha = exactCommit(dependencies.sha);
  const files = readdirSync(assets).sort();
  if (JSON.stringify(files) !== JSON.stringify(releaseAssets(release))) {
    throw new Error(`Unexpected release assets: ${files.join(", ")}.`);
  }
  succeed(dependencies, "shasum", ["-a", "256", "-c", "SHA256SUMS.txt"], assets);
  if (releaseExists(dependencies, release.tag)) {
    throw new Error(`A release or draft ${release.tag} exists. Delete the old draft first.`);
  }
  if (taggedCommit(dependencies, release.tag) === null) {
    succeed(dependencies, "gh", [
      "api", `repos/${dependencies.repository}/git/refs`,
      "-f", `ref=refs/tags/${release.tag}`, "-f", `sha=${sha}`,
    ]);
  }
  // .github/release.yml hides Dependabot from the generated notes.
  const generated = succeed(dependencies, "gh", [
    "api", `repos/${dependencies.repository}/releases/generate-notes`,
    "-f", `tag_name=${release.tag}`, "-f", `target_commitish=${sha}`, "--jq", ".body",
  ]);
  const notesDirectory = mkdtempSync(path.join(os.tmpdir(), "gwonmac-release-notes-"));
  try {
    const notes = path.join(notesDirectory, "notes.md");
    writeFileSync(notes, groupReleaseNotes(generated));
    // --target records the exact commit; without it GitHub stores the branch
    // name and `pnpm release:test` refuses the draft.
    succeed(dependencies, "gh", [
      "release", "create", release.tag,
      "--repo", dependencies.repository,
      "--verify-tag", "--target", sha, "--draft",
      "--title", release.tag, "--notes-file", notes,
      ...(release.prerelease ? ["--prerelease", "--latest=false"] : []),
      ...files.map((file) => path.join(assets, file)),
    ]);
  } finally {
    rmSync(notesDirectory, { recursive: true });
  }
  return release;
}

/**
 * What a fact-only release may change since the release it patches. Shipped
 * code changes only in the per-client reviewed-fact files; the registry may
 * only gain or lose their entries (FACT_REGISTRY_LINE). The rest ships no
 * code: tests (certification tests and what they read only gain files,
 * GUARDED_TESTS), maintainer and player docs, and the detector record.
 */
const FACT_PATHS: readonly RegExp[] = [
  /^app\/client\/certification\/reviewed-client-[\w.-]+\.ts$/u,
  /^app\/client\/certification\/reviewed-facts\.ts$/u,
  /^certificates\/certified-client\.json$/u,
  /^tests\//u,
  /^docs\//u,
  /^website\/content\/.+\.md$/u,
];
const FACT_FILE = /^app\/client\/certification\/reviewed-client-[\w.-]+\.ts$/u;
const FACT_REGISTRY = "app/client/certification/reviewed-facts.ts";
/**
 * The Must-stay certification tests (AGENTS.md) and the policy tests. In a
 * fact release they, and every test file they import or name by path, only
 * gain new files: an existing one stays byte-identical, mode included, so no
 * added `return;` can switch a check off.
 */
const GUARDED_TESTS: readonly RegExp[] = [
  /^tests\/unit\/client-certification/u,
  /^tests\/unit\/enhancement-/u,
  /^tests\/client-artifact\//u,
  /^tests\/policy\//u,
];
/** A relative module specifier, or a repository path such as "tests/fixtures/x.rs". */
const NAMED_FILE = /(?:from |import\(?)["'](\.{1,2}\/[^"']+)["']|["'](tests\/[^"'\s]+\.\w+)["']/gu;
const FACT_REGISTRY_LINE =
  /^(?:import \{ [A-Z0-9_]+_FACTS \} from "\.\/reviewed-client-[\w.-]+\.js";| {2}[A-Z0-9_]+_FACTS,)$/u;

/**
 * The guarded tests at `revision` and every file under tests/ they reach: the
 * modules they import (transitively, `.js` specifiers name `.ts` sources) and
 * the files they name by path. A specifier that names no tracked file, such as
 * one inside a test's own sample source, is ignored.
 */
function guardedTestFiles(revision: string, read: (...args: string[]) => string): Set<string> {
  const tracked = new Set(read("ls-tree", "-r", "--name-only", revision, "--", "tests").split("\n").filter(Boolean));
  const guarded = new Set([...tracked].filter((file) => GUARDED_TESTS.some((pattern) => pattern.test(file))));
  const pending = [...guarded];
  for (let file = pending.pop(); file !== undefined; file = pending.pop()) {
    if (!/\.[cm]?[jt]s$/u.test(file)) continue;
    for (const [, relative, rooted] of read("show", `${revision}:${file}`).matchAll(NAMED_FILE)) {
      const named = rooted ?? path.posix.join(path.posix.dirname(file), relative ?? "");
      const found = [named, named.replace(/\.js$/u, ".ts")].find((candidate) => tracked.has(candidate));
      if (found && !guarded.has(found)) {
        guarded.add(found);
        pending.push(found);
      }
    }
  }
  return guarded;
}

export interface FactRelease extends Release {
  /** The published release this one patches: the same version, one patch lower. */
  readonly base: string;
  readonly branch: string;
  /** Every path that changed since `base`. */
  readonly changed: readonly string[];
  /** The GitHub writes, in order; a dry run returns them without running them. */
  readonly actions: readonly (readonly string[])[];
}

/**
 * A fact-only release: a patch whose whole difference from the release it
 * patches is reviewed client facts, so the review of those facts is the one
 * human decision before the `release` environment approval. It never tags or
 * publishes; the release workflow's draft job tags after that approval.
 */
export function facts(
  version: string,
  root: string,
  dependencies: ReleaseDependencies,
  options: { readonly dryRun: boolean },
): FactRelease {
  const release = releaseOf(version);
  const parsed = parseReleaseVersion(version);
  if (!parsed || parsed.patch === 0) {
    throw new Error(`A fact-only release is a patch of a published release, not ${version}.`);
  }
  const base = `v${parsed.major}.${parsed.minor}.${parsed.patch - 1}`;
  const branch = `hotfix/${version}`;
  const git = (...args: string[]) => dependencies.run("git", args, root);
  const read = (...args: string[]) => succeed(dependencies, "git", args, root);

  if (read("status", "--porcelain").trim() !== "") {
    throw new Error("Commit or remove local changes first: the release is what HEAD holds.");
  }
  const current = read("rev-parse", "--abbrev-ref", "HEAD").trim();
  if (current !== branch) {
    throw new Error(`Run this on ${branch}, branched from ${base}, not on ${current}.`);
  }
  if (git("rev-parse", "--verify", "--quiet", `refs/tags/${base}^{commit}`).status !== 0
    || git("merge-base", "--is-ancestor", base, "HEAD").status !== 0) {
    throw new Error(`${version} patches ${base}: HEAD must descend from that release tag.`);
  }
  if (releaseExists(dependencies, release.tag)) {
    throw new Error(`Release ${release.tag} exists. Choose a higher version.`);
  }
  // GitHub's latest release is the one the update feed serves (docs/releasing.md).
  const published = dependencies.run("gh", [
    "release", "view", "--repo", dependencies.repository, "--json", "tagName", "--jq", ".tagName",
  ], root);
  if (published.status !== 0) {
    throw new Error(`No release is published yet; a fact release patches the latest published release.\n${published.stderr}`);
  }
  const latest = published.stdout.trim();
  if (latest !== base) {
    throw new Error(`${latest} is the latest published release; a fact release patches it, not ${base}.`);
  }

  const statuses = read("diff", "--name-status", "--no-renames", base, "HEAD").split("\n").filter(Boolean)
    .map((line) => line.split("\t"));
  const changed = statuses.map(([, file]) => file ?? "");
  const outside = changed.filter((file) => !FACT_PATHS.some((allowed) => allowed.test(file)));
  if (outside.length > 0) {
    throw new Error(`Not a fact-only release; these changed since ${base}:\n${outside.join("\n")}`);
  }
  if (!changed.some((file) => FACT_FILE.test(file))) {
    throw new Error(`No reviewed-client file changed since ${base}: there are no facts to release.`);
  }
  // The file's header runs until its first `@@`, so a content line that starts
  // with `+++` or `---` is still an edit.
  const registryDiff = read("diff", "--unified=0", "--no-ext-diff", base, "HEAD", "--", FACT_REGISTRY).split("\n");
  const registryEdits = registryDiff.slice(Math.max(0, registryDiff.findIndex((line) => line.startsWith("@@ "))))
    .filter((line) => (line.startsWith("+") || line.startsWith("-")) && !FACT_REGISTRY_LINE.test(line.slice(1)));
  if (registryEdits.length > 0) {
    throw new Error(`${FACT_REGISTRY} may only add or remove generation entries:\n${registryEdits.join("\n")}`);
  }
  const guarded = new Set([...guardedTestFiles(base, read), ...guardedTestFiles("HEAD", read)]);
  const rewritten = statuses.filter(([status, file]) => status !== "A" && guarded.has(file ?? "")).map(([, file]) => file);
  if (rewritten.length > 0) {
    throw new Error(
      `A fact release only adds files to the certification tests, their fixtures and the policy tests; these changed:\n${rewritten.join("\n")}`,
    );
  }

  // The player post the app bundles as this version's "What's new".
  const launcherId = `gwonmac-${version.replaceAll(".", "-")}`;
  const [post, ...others] = git("grep", "-l", "-e", `^launcherId: ${launcherId}$`, "HEAD", "--", "website/content")
    .stdout.split("\n").filter(Boolean);
  const frontmatter = post && others.length === 0 ? read("show", post).split(/^---$/mu)[1]?.split("\n") ?? [] : [];
  if (!frontmatter.includes("draft: true") || !frontmatter.includes(`title: GWonMac ${version}`)) {
    throw new Error(
      `Add one release post with launcherId ${launcherId}, title "GWonMac ${version}" and draft: true (docs/launcher-news.md).`,
    );
  }
  // Players upgrade from base, so this release must prove it reads what base wrote.
  const fixtures = `tests/fixtures/player-data/${base}/`;
  if (read("ls-tree", "-r", "--name-only", "HEAD", "--", fixtures).trim() === "") {
    throw new Error(`${fixtures} is missing: generate the files ${base} writes first (docs/releasing.md, step 8).`);
  }

  const repository = dependencies.repository;
  // A second run must not start a second regression or release run.
  const open = [
    succeed(dependencies, "gh", [
      "pr", "list", "--repo", repository, "--head", branch, "--state", "open", "--json", "url", "--jq", ".[].url",
    ], root),
    ...["release.yml", "client-watch.yml"].map((workflow) => succeed(dependencies, "gh", [
      "run", "list", "--repo", repository, "--workflow", workflow, "--branch", branch,
      "--json", "url,status", "--jq", '.[] | select(.status != "completed") | .url',
    ], root)),
  ].flatMap((output) => output.split("\n").filter(Boolean));
  if (open.length > 0) {
    throw new Error(`${branch} already has an open pull request or unfinished runs:\n${open.join("\n")}`);
  }
  const dispatches: (readonly [string, ...string[]])[] = [
    ["git", "push", "origin", `HEAD:refs/heads/${branch}`],
    ["gh", "workflow", "run", "client-watch.yml", "--repo", repository, "--ref", branch, "-f", "regression=true"],
    ["gh", "workflow", "run", "release.yml", "--repo", repository, "--ref", branch, "-f", `version=${version}`],
  ];
  // `gh workflow run` prints the URL of the run it started.
  const [, regression = "the client watch run", releaseRun = "the release run"] = options.dryRun
    ? []
    : dispatches.map(([command, ...args]) => succeed(dependencies, command, args, root).trim());
  const body = [
    `Fact-only patch of ${base}: only reviewed client facts, tests and docs changed since that release.`,
    "",
    ...changed.map((file) => `- \`${file}\``),
    "",
    `- [ ] Review the facts. Real-client regression on this branch: ${regression}`,
    `- [ ] Approve the \`release\` environment in ${releaseRun} once both are good.`,
    `- [ ] \`pnpm release:test ${release.tag}\`, publish the draft, then steps 7 and 8 of docs/releasing.md.`,
  ].join("\n");
  const pullRequest: readonly [string, ...string[]] = [
    "gh", "pr", "create", "--repo", repository, "--base", "main", "--head", branch,
    "--title", `fix(certification): release reviewed client facts as ${release.tag}`, "--body", body,
  ];
  if (!options.dryRun) succeed(dependencies, pullRequest[0], pullRequest.slice(1), root);
  return Object.freeze({
    ...release,
    base,
    branch,
    changed: Object.freeze(changed),
    actions: Object.freeze([...dispatches, pullRequest]),
  });
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

function runCommand(command: string, args: readonly string[], cwd?: string): CommandResult {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function workflowDependencies(): ReleaseDependencies {
  return { repository: required("GITHUB_REPOSITORY"), sha: required("GITHUB_SHA"), run: runCommand };
}

function main(): void {
  const [command, version, ...paths] = process.argv.slice(2);
  if (command === "prepare" && version && paths.length === 0) {
    const release = prepare(version, required("GITHUB_REF"), workflowDependencies());
    console.log(`Release ${release.tag}${release.prerelease ? " (pre-release)" : ""}.`);
  } else if (command === "assets" && version && paths.length === 2) {
    const publishedAt = spawnSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" });
    if (publishedAt.status !== 0) throw new Error("git cannot read the commit date");
    collectAssets(releaseOf(version), paths[0]!, paths[1]!, publishedAt.stdout.trim());
  } else if (command === "draft" && version && paths.length === 1) {
    const release = draft(version, paths[0]!, workflowDependencies());
    appendFileSync(
      required("GITHUB_STEP_SUMMARY"),
      `Draft ${release.tag} is ready. Run \`pnpm release:test ${release.tag}\`, then publish it.\n`,
    );
  } else if (command === "facts" && version && (paths.length === 0 || (paths.length === 1 && paths[0] === "--dry-run"))) {
    const head = runCommand("git", ["rev-parse", "HEAD"]).stdout.trim();
    const release = facts(version, process.cwd(), { repository: RELEASE_REPO, sha: head, run: runCommand }, {
      dryRun: paths.length === 1,
    });
    console.log(`${release.tag} patches ${release.base} with ${release.changed.length} fact-only changes.`);
    for (const action of release.actions) console.log(`${paths.length === 1 ? "would run" : "ran"}: ${action.join(" ")}`);
  } else {
    throw new Error("usage: release.ts facts <version> [--dry-run] | prepare <version> | assets <version> <make-dir> <out-dir> | draft <version> <assets-dir>");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
