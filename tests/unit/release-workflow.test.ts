import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { RELEASE_REPO_URL } from "../../app/shared/project-identity.ts";
import { parseReleaseManifest } from "../../app/shared/release-manifest.ts";
import {
  collectAssets,
  draft,
  facts,
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

  it("releases reviewed facts from hotfix/<version> and refuses anything else", () => {
    for (const [scenario, version, change, refusal] of [
      ["code outside the facts", "1.0.1", { "app/main/window.ts": "changed" }, /changed since v1\.0\.0:\napp\/main\/window\.ts$/u],
      ["a registry edit that is not an entry", "1.0.1", { [REGISTRY]: `${REGISTRY_TEXT}export const extra = 1;\n` }, /may only add or remove generation entries:\n\+export const extra = 1;$/u],
      ["a post that is already published", "1.0.1", { [POST]: POST_TEXT.replace("draft: true\n", "") }, /draft: true/u],
      ["no player files from the patched release", "1.0.1", { "tests/fixtures/player-data/v1.0.0/settings.json": null }, /player-data\/v1\.0\.0\/ is missing/u],
      ["a minor version", "1.1.0", {}, /patch of a published release, not 1\.1\.0/u],
      ["another version's branch", "1.0.2", {}, /Run this on hotfix\/1\.0\.2, branched from v1\.0\.1/u],
    ] as const) {
      const repository = factRepository(change);
      try {
        assert.throws(() => facts(version, repository.root, repository.github().dependencies, { dryRun: true }), refusal, scenario);
      } finally {
        repository.close();
      }
    }
    const docsOnly = factRepository({}, { facts: false });
    const dirty = factRepository({});
    const released = factRepository({});
    try {
      assert.throws(() => facts("1.0.1", docsOnly.root, docsOnly.github().dependencies, { dryRun: true }), /no facts to release/u);
      writeFileSync(path.join(dirty.root, "notes.txt"), "local");
      assert.throws(() => facts("1.0.1", dirty.root, dirty.github().dependencies, { dryRun: true }), /local changes/u);
      assert.throws(() => facts("1.0.1", released.root, released.github({ release: true }).dependencies, { dryRun: true }), /v1\.0\.1 exists/u);
    } finally {
      for (const repository of [docsOnly, dirty, released]) repository.close();
    }
  });

  it("a fact release starts regression and the release run, then opens the PR, and never tags", () => {
    const repository = factRepository({});
    try {
      const dry = repository.github();
      const planned = facts("1.0.1", repository.root, dry.dependencies, { dryRun: true });
      assert.deepEqual(planned.changed, [FACT, REGISTRY, POST]);
      assert.deepEqual(dry.calls.map((call) => call.slice(0, 3)), [["gh", "release", "view"]]);

      const live = repository.github();
      const release = facts("1.0.1", repository.root, live.dependencies, { dryRun: false });
      assert.deepEqual(live.calls.slice(1).map((call) => call.slice(0, 4)), [
        ["git", "push", "origin", "HEAD:refs/heads/hotfix/1.0.1"],
        ["gh", "workflow", "run", "client-watch.yml"],
        ["gh", "workflow", "run", "release.yml"],
        ["gh", "pr", "create", "--repo"],
      ]);
      assert.deepEqual(live.calls[2]!.slice(-4), ["--ref", "hotfix/1.0.1", "-f", "regression=true"]);
      assert.deepEqual(live.calls[3]!.slice(-4), ["--ref", "hotfix/1.0.1", "-f", "version=1.0.1"]);
      const body = live.calls[4]!.at(-1)!;
      assert.match(body, /regression on this branch: https:\/\/github\.com\/gwonmac\/gwonmac\/actions\/runs\/client-watch\.yml/u);
      assert.match(body, /environment in https:\/\/github\.com\/gwonmac\/gwonmac\/actions\/runs\/release\.yml/u);
      assert.equal(live.calls.some((call) => call.some((arg) => arg.includes("refs/tags/") || arg === "--draft")), false);
      assert.deepEqual(release.actions.map((action) => action.slice(0, 3)), planned.actions.map((action) => action.slice(0, 3)));
    } finally {
      repository.close();
    }
  });
});

const REGISTRY = "app/client/certification/reviewed-facts.ts";
const REGISTRY_TEXT = [
  'import { OLD_FACTS } from "./reviewed-client-2026-11-03-aaaaaaaaaaaa.js";',
  "export const REVIEWED_GENERATIONS = [",
  "  OLD_FACTS,",
  "];",
  "",
].join("\n");
const FACT = "app/client/certification/reviewed-client-2026-12-01-bbbbbbbbbbbb.ts";
const POST = "website/content/en/2.blog/14.gwonmac-1-0-1.md";
const POST_TEXT = "---\ntitle: GWonMac 1.0.1\ndraft: true\nlauncherId: gwonmac-1-0-1\n---\n\nTools work again on the new client.\n";

/** A repository whose v1.0.0 tag is the published release and whose hotfix/1.0.1 adds facts. */
function factRepository(change: Readonly<Record<string, string | null>>, options = { facts: true }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "release-facts-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  const write = (files: Readonly<Record<string, string | null>>) => {
    for (const [file, text] of Object.entries(files)) {
      if (text === null) {
        git("rm", "-q", file);
        continue;
      }
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), text);
    }
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", "change");
  };
  git("init", "-q", "-b", "main");
  git("config", "user.email", "release@example.test");
  git("config", "user.name", "Release test");
  write({
    [REGISTRY]: REGISTRY_TEXT,
    "app/client/certification/reviewed-client-2026-11-03-aaaaaaaaaaaa.ts": "export const OLD_FACTS = {};\n",
    "app/main/window.ts": "export {};\n",
    "tests/fixtures/player-data/v1.0.0/settings.json": "{}\n",
  });
  git("tag", "v1.0.0");
  git("switch", "-q", "-c", "hotfix/1.0.1");
  write(options.facts ? {
    [FACT]: "export const NEW_FACTS = {};\n",
    [REGISTRY]: REGISTRY_TEXT
      .replace("\nexport", '\nimport { NEW_FACTS } from "./reviewed-client-2026-12-01-bbbbbbbbbbbb.js";\nexport')
      .replace("  OLD_FACTS,\n", "  OLD_FACTS,\n  NEW_FACTS,\n"),
    [POST]: POST_TEXT,
  } : { [POST]: POST_TEXT, "docs/recertify.md": "notes\n" });
  write(change);
  return {
    root,
    close: () => rmSync(root, { recursive: true }),
    /** Real git in the repository; GitHub and the push are recorded. */
    github(state: { release?: boolean } = {}) {
      const calls: string[][] = [];
      const dependencies: ReleaseDependencies = {
        repository: REPOSITORY,
        sha: SHA,
        run(command, args, cwd) {
          if (command === "git" && args[0] !== "push") {
            const result = spawnSync(command, args, { cwd, encoding: "utf8" });
            return { status: result.status, stdout: result.stdout, stderr: result.stderr };
          }
          calls.push([command, ...args]);
          if (args[0] === "release" && args[1] === "view") return state.release ? OK("{}") : NOT_FOUND;
          if (args[0] === "workflow") return OK(`https://github.com/${REPOSITORY}/actions/runs/${args[2]}\n`);
          return OK();
        },
      };
      return { calls, dependencies };
    },
  };
}
