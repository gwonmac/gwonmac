// The release workflow's rules, in one place that `pnpm test` reaches.
//
// A maintainer or agent prepares a release with one of two commands:
//
//   notes <version> [--dry-run]   before the release: stamps each feature's
//                                 `## Unreleased` changes with the version and
//                                 writes them as the `## Features` section of
//                                 the version's release post
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
//   regression                    beside qualify and build: on hotfix/*, the
//                                 real-client regression run on this exact
//                                 commit passed (one bounded wait)
//   draft <version> <assets>      after qualify, build and regression: tag the
//                                 commit and create the draft on exactly it
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
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { FeatureDefinition } from "../app/features/define.js";
import { parseNewsStory, type ProjectNewsStory } from "../app/shared/launcher-news-feed.js";
import { RELEASE_REPO, releaseAssetUrl } from "../app/shared/project-identity.js";
import {
  formatReleaseVersion,
  isPrerelease,
  parseReleaseVersion,
  releaseAssetNames,
} from "../app/shared/release.js";
import { parseReleaseManifest } from "../app/shared/release-manifest.js";
import { readFrontMatter } from "../app/shared/website-content.js";
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

/** The heading each feature's CHANGELOG.md collects player-facing changes under (app/features/contract.ts). */
const UNRELEASED = "## Unreleased";
/** The release post section the notes command owns: each run replaces it. */
const FEATURE_NOTES = "## Features";
/** The last line of every release post (docs/launcher-news.md). */
const TECHNICAL_RECORD = "[Technical release record]";

export interface StampedChangelog {
  /** The changes under `## Unreleased`, one per `- ` bullet, without the bullet. */
  readonly entries: readonly string[];
  /** Those changes under `## <version>` below a fresh empty `## Unreleased`; the input when there were none. */
  readonly text: string;
}

/**
 * Moves a feature changelog's `## Unreleased` changes under `## <version>` and
 * puts an empty `## Unreleased` on top for the next release. An empty section
 * stays as it is, so a feature without changes gets no empty version heading.
 * Each change is one `- ` bullet; indented lines continue it.
 */
export function stampChangelog(text: string, version: string, file: string): StampedChangelog {
  const lines = text.split("\n");
  const start = lines.indexOf(UNRELEASED);
  if (start < 0) {
    throw new Error(`${file}: no "${UNRELEASED}" heading, so its changes cannot reach the release notes. Add it above the newest version.`);
  }
  const next = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  const end = next < 0 ? lines.length : next;
  const section = lines.slice(start + 1, end);
  const entries: string[] = [];
  for (const line of section) {
    const last = entries.length - 1;
    if (line.startsWith("- ") && line.slice(2).trim()) entries.push(line.slice(2).trim());
    else if (/^\s+\S/u.test(line) && last >= 0) entries[last] = `${entries[last]} ${line.trim()}`;
    else if (line.trim()) {
      throw new Error(`${file}: write each change under "${UNRELEASED}" as one "- " bullet, not ${JSON.stringify(line)}.`);
    }
  }
  if (entries.length === 0) return { entries, text };
  if (lines.includes(`## ${version}`)) {
    throw new Error(`${file}: "## ${version}" is already stamped; move these changes into it by hand or release them in the next version.`);
  }
  const changes = section.join("\n").trim().split("\n");
  const stamped = [...lines.slice(0, start), UNRELEASED, "", `## ${version}`, ...changes, "", ...lines.slice(end)];
  return { entries, text: `${stamped.join("\n").trimEnd()}\n` };
}

/**
 * The player release notes: one bullet per change, led by the feature's name
 * from its manifest, features in name order and changes in the order written.
 * Features without changes are left out; no changes at all gives "".
 */
export function featureReleaseNotes(features: readonly { readonly name: string; readonly entries: readonly string[] }[]): string {
  const bullets = features
    .filter(({ entries }) => entries.length > 0)
    .sort((left, right) => left.name.localeCompare(right.name, "en"))
    .flatMap(({ name, entries }) => entries.map((entry) => `- **${name}:** ${entry}`));
  return bullets.length === 0 ? "" : `${FEATURE_NOTES}\n\n${bullets.join("\n")}\n`;
}

/**
 * The release post with `notes` as its `## Features` section: in place of the
 * one an earlier run wrote, otherwise before the post's first other section or
 * its technical record link, so the summary and hand-written bullets stay first.
 */
export function withFeatureNotes(post: string, notes: string): string {
  const lines = post.split("\n");
  const body = lines.indexOf("---", 1) + 1;
  const boundary = (from: number) => {
    const found = lines.findIndex((line, index) => index >= from && (line.startsWith("## ") || line.startsWith(TECHNICAL_RECORD)));
    return found < 0 ? lines.length : found;
  };
  const own = lines.indexOf(FEATURE_NOTES, body);
  const start = own < 0 ? boundary(body) : own;
  const end = own < 0 ? start : boundary(own + 1);
  return [...lines.slice(0, start), ...notes.trimEnd().split("\n"), "", ...lines.slice(end)].join("\n");
}

/** The launcher id of a version's release post: the app bundles that post as the version's "What's new". */
function releaseLauncherId(version: string): string {
  return `gwonmac-${version.replaceAll(".", "-")}`;
}

function missingReleasePost(version: string): Error {
  return new Error(
    `Add one release post with launcherId ${releaseLauncherId(version)}, title "GWonMac ${version}" and draft: true (docs/launcher-news.md).`,
  );
}

/**
 * The news-v1 story website/scripts/generate-launcher-news.mjs makes of a post
 * once it is published, checked by the parser installed apps use: a story it
 * refuses makes every app drop the whole feed.
 */
export function releasePostStory(file: string, text: string): ProjectNewsStory {
  const { fields, body } = readFrontMatter(text);
  return parseNewsStory({
    id: fields.launcherId,
    source: fields.launcherSource,
    channel: fields.launcherChannel,
    title: fields.title,
    summary: fields.description,
    publishedAt: `${fields.date}T12:00:00Z`,
    featured: fields.launcherFeatured === "true",
    url: `/blog/${fields.slug || path.basename(file, ".md").replace(/^\d+\./u, "")}`,
    body: body.trim(),
  });
}

export interface ReleaseFile {
  /** Repository-relative path. */
  readonly file: string;
  readonly text: string;
}

export interface FeatureChangelog extends ReleaseFile {
  /** The feature's player name: `name` in its feature.ts. */
  readonly name: string;
}

export interface ReleaseNotesPlan {
  /** The `## Features` section, or "" when no feature has changes. */
  readonly notes: string;
  /** What the command writes, in order; a dry run prints them instead. */
  readonly writes: readonly (ReleaseFile & { readonly change: string })[];
}

/**
 * The release notes of `version` from every feature's `## Unreleased`, and the
 * files that carry them: each changed CHANGELOG.md stamped with the version,
 * and the version's draft release post with its `## Features` section. A
 * pre-release writes only the post: its changes stay under `## Unreleased`
 * until the Stable release that ships them, so that release lists them too.
 */
export function releaseNotesPlan(
  version: string,
  changelogs: readonly FeatureChangelog[],
  posts: readonly ReleaseFile[],
): ReleaseNotesPlan {
  const release = releaseOf(version);
  const launcherId = releaseLauncherId(version);
  const [post, ...others] = posts.filter(({ text }) => readFrontMatter(text).fields.launcherId === launcherId);
  const page = post && others.length === 0 ? readFrontMatter(post.text) : null;
  if (!post || !page?.draft || page.fields.title !== `GWonMac ${version}`) throw missingReleasePost(version);

  const stamped = changelogs.map((changelog) => ({ ...changelog, ...stampChangelog(changelog.text, version, changelog.file) }));
  const notes = featureReleaseNotes(stamped);
  if (!notes) return { notes, writes: [] };
  const text = withFeatureNotes(post.text, notes);
  try {
    releasePostStory(post.file, text);
  } catch (error) {
    throw new Error(`${post.file}: with these notes the launcher news feed would refuse the post: ${(error as Error).message}.`, { cause: error });
  }
  const changed = release.prerelease ? [] : stamped.filter(({ entries }) => entries.length > 0);
  return {
    notes,
    writes: [
      ...changed.map(({ file, text: stampedText }) => ({ file, text: stampedText, change: `${UNRELEASED} becomes ## ${version}` })),
      { file: post.file, text, change: `${FEATURE_NOTES} section` },
    ],
  };
}

/** Every feature's CHANGELOG.md with the name its manifest gives players. */
async function featureChangelogs(root: string): Promise<FeatureChangelog[]> {
  const features = path.join(root, "app/features");
  const folders = readdirSync(features, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(features, entry.name, "feature.ts")))
    .map((entry) => entry.name);
  return Promise.all(folders.map(async (folder) => {
    const manifest = await import(pathToFileURL(path.join(features, folder, "feature.ts")).href) as { default: FeatureDefinition };
    const file = `app/features/${folder}/CHANGELOG.md`;
    return { file, name: manifest.default.name, text: readFileSync(path.join(root, file), "utf8") };
  }));
}

/** The English website posts, as the news feed generator reads them; a translation is no post of its own. */
function websitePosts(root: string): ReleaseFile[] {
  const directory = "website/content/posts";
  return readdirSync(path.join(root, directory))
    .filter((name) => /^(?:\d+\.)?[^.]+\.md$/u.test(name))
    .map((name) => ({ file: `${directory}/${name}`, text: readFileSync(path.join(root, directory, name), "utf8") }));
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
  /** A command that outlives `timeoutMs` is stopped and returns status null. */
  run(command: string, args: readonly string[], cwd?: string, timeoutMs?: number): CommandResult;
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
 * The title client-watch.yml's `run-name` gives a run dispatched with
 * `regression`. GitHub's run API does not show dispatch inputs, so the title is
 * how the gate tells a regression run from a scheduled or plain one.
 */
export const REGRESSION_RUN_TITLE = "Real-client regression";
/** The one bounded wait for an unfinished regression run; release.yml's job timeout sits above it. */
export const REGRESSION_WAIT_MINUTES = 120;

interface RegressionRun {
  readonly id: number;
  readonly url: string;
  readonly status: string;
  readonly conclusion: string;
}

/** Client watch's regression runs on exactly `branch` at `sha`, newest first. */
function regressionRuns(dependencies: ReleaseDependencies, branch: string, sha: string): RegressionRun[] {
  const listed: unknown = JSON.parse(succeed(dependencies, "gh", [
    "run", "list", "--repo", dependencies.repository, "--workflow", "client-watch.yml",
    "--commit", sha, "--event", "workflow_dispatch", "--limit", "20",
    "--json", "databaseId,url,headSha,headBranch,displayTitle,status,conclusion",
  ]));
  if (!Array.isArray(listed)) throw new Error("gh run list did not return a list of runs.");
  return listed.flatMap((run: unknown) => typeof run === "object" && run !== null
    && "headSha" in run && run.headSha === sha && "headBranch" in run && run.headBranch === branch
    && "displayTitle" in run && run.displayTitle === REGRESSION_RUN_TITLE
    && "databaseId" in run && typeof run.databaseId === "number" && "url" in run && typeof run.url === "string"
    && "status" in run && typeof run.status === "string" && "conclusion" in run && typeof run.conclusion === "string"
    ? [{ id: run.databaseId, url: run.url, status: run.status, conclusion: run.conclusion }]
    : []);
}

/**
 * A hotfix/* release, the branch every fact-only release ships from, gets no
 * draft until client watch's real-client regression passed on this exact
 * commit; the draft job needs this one. The workflow cannot tell a fact patch
 * from a code hotfix, so the branch decides. A release from main is not gated
 * (returns null): its code arrives through reviewed PRs and CI, and `qualify`
 * proves the shipped chain on today's client. Returns the run's URL.
 */
export function regressionGate(
  ref: string,
  dependencies: ReleaseDependencies,
  waitMinutes = REGRESSION_WAIT_MINUTES,
): string | null {
  if (!ref.startsWith("refs/heads/hotfix/")) return null;
  const sha = exactCommit(dependencies.sha);
  const branch = ref.slice("refs/heads/".length);
  const start = `gh workflow run client-watch.yml --ref ${branch} -f regression=true`;
  let [run] = regressionRuns(dependencies, branch, sha);
  if (!run) {
    throw new Error(`No real-client regression run on ${branch} at ${sha}. Start one with \`${start}\`, then re-run this job.`);
  }
  if (run.status !== "completed") {
    // The one bounded wait. Its exit status is no verdict: the run is read again.
    const waited = dependencies.run("gh", [
      "run", "watch", String(run.id), "--repo", dependencies.repository, "--compact", "--interval", "60",
    ], undefined, waitMinutes * 60_000);
    const id = run.id;
    run = regressionRuns(dependencies, branch, sha).find((again) => again.id === id) ?? run;
    if (run.status !== "completed") {
      throw new Error(
        `Regression run ${run.url} did not finish within ${waitMinutes} minutes. Re-run this job once it has finished.\n${waited.stderr}`,
      );
    }
  }
  if (run.conclusion !== "success") {
    throw new Error(`Regression run ${run.url} concluded ${run.conclusion || "without a result"}: ${sha} gets no draft.`);
  }
  return run.url;
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
 * The Must-stay tests (AGENTS.md): the client proofs and safety rules in
 * tests/certification/ and the real-client tests in tests/client-artifact/,
 * plus the policy tests. In a fact release they, and every test file they
 * import or name by path, only gain new files: an existing one stays
 * byte-identical, mode included, so no added `return;` can switch a check off.
 * Moving a file out of these folders deletes it here, so a move is refused too.
 */
const GUARDED_TESTS: readonly RegExp[] = [
  /^tests\/certification\//u,
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
  const launcherId = releaseLauncherId(version);
  const [post, ...others] = git("grep", "-l", "-e", `^launcherId: ${launcherId}$`, "HEAD", "--", "website/content/posts")
    .stdout.split("\n").filter(Boolean);
  const frontmatter = post && others.length === 0 ? read("show", post).split(/^---$/mu)[1]?.split("\n") ?? [] : [];
  if (!frontmatter.includes("draft: true") || !frontmatter.includes(`title: GWonMac ${version}`)) {
    throw missingReleasePost(version);
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
    `- [ ] Approve the \`release\` environment in ${releaseRun}. Its draft job waits until that regression run passed.`,
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

function runCommand(command: string, args: readonly string[], cwd?: string, timeoutMs?: number): CommandResult {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs });
  // A timeout is a result (status null) the caller judges, not a crash.
  if (result.error && !("code" in result.error && result.error.code === "ETIMEDOUT")) throw result.error;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function workflowDependencies(): ReleaseDependencies {
  return { repository: required("GITHUB_REPOSITORY"), sha: required("GITHUB_SHA"), run: runCommand };
}

async function main(): Promise<void> {
  const [command, version, ...paths] = process.argv.slice(2);
  if (command === "prepare" && version && paths.length === 0) {
    const release = prepare(version, required("GITHUB_REF"), workflowDependencies());
    console.log(`Release ${release.tag}${release.prerelease ? " (pre-release)" : ""}.`);
  } else if (command === "assets" && version && paths.length === 2) {
    const publishedAt = spawnSync("git", ["show", "-s", "--format=%cI", "HEAD"], { encoding: "utf8" });
    if (publishedAt.status !== 0) throw new Error("git cannot read the commit date");
    collectAssets(releaseOf(version), paths[0]!, paths[1]!, publishedAt.stdout.trim());
  } else if (command === "regression" && !version) {
    const run = regressionGate(required("GITHUB_REF"), workflowDependencies());
    console.log(run ? `The real-client regression passed on this commit: ${run}` : "A release from main needs no regression run.");
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
  } else if (command === "notes" && version && (paths.length === 0 || (paths.length === 1 && paths[0] === "--dry-run"))) {
    const dryRun = paths.length === 1;
    const root = process.cwd();
    const plan = releaseNotesPlan(version, await featureChangelogs(root), websitePosts(root));
    console.log(plan.notes || `No feature has changes under ${UNRELEASED}: nothing to write.`);
    for (const { file, text, change } of plan.writes) {
      if (!dryRun) writeFileSync(path.join(root, file), text);
      console.log(`${dryRun ? "would write" : "wrote"}: ${file} (${change})`);
    }
    if (plan.notes && releaseOf(version).prerelease) {
      console.log(`A pre-release keeps every feature's ${UNRELEASED}; the Stable release stamps it.`);
    }
  } else {
    throw new Error("usage: release.ts notes <version> [--dry-run] | facts <version> [--dry-run] | prepare <version> | regression | assets <version> <make-dir> <out-dir> | draft <version> <assets-dir>");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
