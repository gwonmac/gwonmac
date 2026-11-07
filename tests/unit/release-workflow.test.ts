import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { RELEASE_REPO_URL } from "../../app/shared/project-identity.ts";
import { parseReleaseManifest } from "../../app/shared/release-manifest.ts";
import {
  collectAssets,
  draft,
  groupReleaseNotes,
  prepare,
  releaseAssets,
  releaseOf,
  releaseOfTag,
  type CommandResult,
  type ReleaseDependencies,
} from "../../scripts/release.ts";
import { assertDraftMetadata, type DraftRelease } from "../../scripts/test-draft-release.ts";

const REPOSITORY = "gwonmac/gwonmac";
const SHA = "a".repeat(40);
const MAIN = "refs/heads/main";
const OK = (stdout = ""): CommandResult => ({ status: 0, stdout, stderr: "" });
// What `gh api` returns for a missing ref: exit 1 and the error body on stdout.
const NOT_FOUND: CommandResult = {
  status: 1,
  stdout: '{"message":"Not Found","status":"404"}',
  stderr: "gh: Not Found (HTTP 404)",
};

interface GitHub {
  release?: boolean;
  tag?: string;
  sha?: string;
}

function github(state: GitHub = {}) {
  const calls: string[][] = [];
  const dependencies: ReleaseDependencies = {
    repository: REPOSITORY,
    sha: state.sha ?? SHA,
    run(command, args) {
      calls.push([command, ...args]);
      if (command === "shasum") return OK();
      if (args[0] === "release" && args[1] === "view") return state.release ? OK("{}") : NOT_FOUND;
      if (args[0] === "api" && args[1]?.includes("/git/ref/tags/")) {
        return state.tag === undefined ? NOT_FOUND : OK(`${state.tag}\n`);
      }
      if (args[0] === "api" && args[1]?.endsWith("/generate-notes")) {
        return OK("## What's Changed\n* fix: one by @a\n");
      }
      return OK();
    },
  };
  return { calls, dependencies };
}

/** The draft GitHub stores for one `gh release create <tag> ...` call. */
function storedDraft(create: readonly string[]): DraftRelease {
  const valued = new Set(["--repo", "--target", "--title", "--notes-file"]);
  const files: string[] = [];
  let target = "";
  for (let index = 4; index < create.length; index += 1) {
    const argument = create[index]!;
    if (valued.has(argument)) {
      if (argument === "--target") target = create[index + 1]!;
      index += 1;
    } else if (!argument.startsWith("--")) {
      files.push(argument);
    }
  }
  return {
    isDraft: create.includes("--draft"),
    isPrerelease: create.includes("--prerelease"),
    targetCommitish: target,
    assets: files.map((file) => ({ name: path.basename(file) })),
  };
}

function assetFolder(version: string): { folder: string; close(): void } {
  const root = mkdtempSync(path.join(os.tmpdir(), "release-workflow-"));
  const folder = path.join(root, "assets");
  mkdirSync(folder);
  for (const name of releaseAssets(releaseOf(version))) writeFileSync(path.join(folder, name), name);
  return { folder, close: () => rmSync(root, { recursive: true }) };
}

describe("release workflow", () => {
  it("publishes only canonical Stable, Beta, and RC versions macOS can number", () => {
    assert.equal(releaseOf("1.0.1").prerelease, false);
    assert.equal(releaseOf("1.0.1-beta.1").prerelease, true);
    assert.deepEqual(releaseOfTag("v1.0.1-rc.2"), {
      version: "1.0.1-rc.2",
      tag: "v1.0.1-rc.2",
      prerelease: true,
      dmg: "Guild-Wars-Reforged-1.0.1-rc.2-macOS-arm64.dmg",
      zip: "Guild-Wars-Reforged-1.0.1-rc.2-macOS-arm64.zip",
    });
    for (const version of ["1.0.1-alpha.1", "1.0.1-rc.01", "v1.0.1", "0.9.0", "1.0.0-rc.30", "1.0"]) {
      assert.throws(() => releaseOf(version), version);
    }
    assert.throws(() => releaseOfTag("1.0.1"), /v followed by its version/u);
    assert.throws(() => releaseOfTag("v1.0.1-alpha.1"), /Stable, Beta, or RC/u);
  });

  it("prepare refuses what must not ship and passes a tag that does not exist yet", () => {
    for (const [ref, state, refusal] of [
      ["refs/heads/feature", {}, /main or hotfix/u],
      [MAIN, { release: true }, /exists\. Choose a higher version/u],
      [MAIN, { tag: "b".repeat(40) }, /points at b{40}, not a{40}/u],
      [MAIN, { sha: "main" }, /one exact commit/u],
    ] as const) {
      assert.throws(() => prepare("1.0.1", ref, github(state).dependencies), refusal);
    }
    assert.equal(prepare("1.0.1", MAIN, github().dependencies).tag, "v1.0.1");
    assert.equal(prepare("1.0.1", "refs/heads/hotfix/x", github({ tag: SHA }).dependencies).tag, "v1.0.1");
  });

  it("creates a draft that release:test accepts, on the exact commit", () => {
    for (const version of ["1.0.1", "1.0.1-rc.1"]) {
      const assets = assetFolder(version);
      try {
        const { calls, dependencies } = github();
        const release = draft(version, assets.folder, dependencies);
        const create = calls.find((call) => call[1] === "release" && call[2] === "create");
        assert.ok(create);
        assertDraftMetadata(release.tag, storedDraft(create), release);
        assert.equal(create.includes("--latest=false"), release.prerelease);
        assert.ok(calls.some((call) => call.includes(`ref=refs/tags/${release.tag}`) && call.includes(`sha=${SHA}`)));
      } finally {
        assets.close();
      }
    }
  });

  it("draft keeps an existing tag and refuses an existing release or a changed inventory", () => {
    const assets = assetFolder("1.0.1");
    try {
      const tagged = github({ tag: SHA });
      draft("1.0.1", assets.folder, tagged.dependencies);
      assert.equal(tagged.calls.some((call) => call.some((arg) => arg.startsWith("ref=refs/tags/"))), false);
      assert.throws(() => draft("1.0.1", assets.folder, github({ release: true }).dependencies), /Delete the old draft/u);
      assert.throws(() => draft("1.0.1", assets.folder, github({ sha: "main" }).dependencies), /one exact commit/u);
      rmSync(path.join(assets.folder, "SHA256SUMS.txt"));
      assert.throws(() => draft("1.0.1", assets.folder, github().dependencies), /Unexpected release assets/u);
    } finally {
      assets.close();
    }
  });

  it("groups generated notes by Conventional Commit type and keeps the rest", () => {
    const generated = [
      "## What's Changed",
      "* feat(hub): add x by @a",
      "* fix: y by @b",
      "* docs: z by @c",
      "* fixup thing",
      "",
      "## New Contributors",
      "* @d made their first contribution",
      "",
      "**Full Changelog**: a...b",
      "",
    ].join("\n");
    assert.equal(groupReleaseNotes(generated), [
      "## Features", "* feat(hub): add x by @a", "",
      "## Fixes", "* fix: y by @b", "",
      "## Other changes", "* docs: z by @c", "* fixup thing", "",
      "", "## New Contributors", "* @d made their first contribution", "", "**Full Changelog**: a...b", "",
    ].join("\n"));
  });

  it("names Forge's output canonically and writes a manifest the updater accepts", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "release-collect-"));
    try {
      const make = path.join(root, "make");
      mkdirSync(path.join(make, "zip/darwin/arm64"), { recursive: true });
      writeFileSync(path.join(make, "zip/darwin/arm64/Guild Wars Reforged-darwin-arm64-1.0.1.zip"), "zip");
      writeFileSync(path.join(make, "Guild Wars Reforged-1.0.1-arm64.dmg"), "dmg");
      const release = releaseOf("1.0.1-beta.2");
      const output = path.join(root, "assets");
      collectAssets(release, make, output, "2026-07-30T12:00:00+02:00");
      assert.deepEqual(readdirSync(output).sort(), releaseAssets(release).filter((name) => name !== "SHA256SUMS.txt"));
      const manifest: unknown = JSON.parse(readFileSync(path.join(output, "RELEASES.json"), "utf8"));
      assert.deepEqual(parseReleaseManifest(manifest)?.manifest, {
        url: `${RELEASE_REPO_URL}/releases/download/v1.0.1-beta.2/Guild-Wars-Reforged-1.0.1-beta.2-macOS-arm64.zip`,
        name: "Guild Wars Reforged v1.0.1-beta.2",
        version: "1.0.1-beta.2",
        tag: "v1.0.1-beta.2",
        pub_date: "2026-07-30T10:00:00.000Z",
        notes: "",
      });
      writeFileSync(path.join(make, "second.dmg"), "dmg");
      assert.throws(() => collectAssets(release, make, path.join(root, "again"), "2026-07-30T12:00:00Z"), /one \.dmg/u);
    } finally {
      rmSync(root, { recursive: true });
    }
  });
});
