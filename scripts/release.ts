// The release workflow's rules, in one place that `pnpm test` reaches.
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
import { releaseAssetUrl } from "../app/shared/project-identity.js";
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

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

function workflowDependencies(): ReleaseDependencies {
  return {
    repository: required("GITHUB_REPOSITORY"),
    sha: required("GITHUB_SHA"),
    run: (command, args, cwd) => {
      const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      if (result.error) throw result.error;
      return { status: result.status, stdout: result.stdout, stderr: result.stderr };
    },
  };
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
  } else {
    throw new Error("usage: release.ts prepare <version> | assets <version> <make-dir> <out-dir> | draft <version> <assets-dir>");
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  main();
}
