import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  REGRESSION_RUN_TITLE,
  regressionGate,
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

const HOTFIX = "refs/heads/hotfix/1.0.1";
const RUN_URL = `https://github.com/${REPOSITORY}/actions/runs/7`;

/** One run as `gh run list --json` prints it: a passed regression run on HOTFIX at SHA unless overridden. */
function clientWatchRun(fields: Readonly<Record<string, string | number>> = {}) {
  return {
    databaseId: 7, url: RUN_URL, headSha: SHA, headBranch: "hotfix/1.0.1",
    displayTitle: REGRESSION_RUN_TITLE, status: "completed", conclusion: "success", ...fields,
  };
}

/** GitHub answering each `gh run list` with the next listing (the last one repeats). */
function clientWatch(listings: readonly (readonly object[])[], watch: CommandResult = OK()) {
  const calls: { readonly call: readonly string[]; readonly timeoutMs: number | undefined }[] = [];
  const dependencies: ReleaseDependencies = {
    repository: REPOSITORY,
    sha: SHA,
    run(command, args, _cwd, timeoutMs) {
      calls.push({ call: [command, ...args], timeoutMs });
      if (args[0] === "run" && args[1] === "list") {
        return OK(JSON.stringify(listings[Math.min(calls.filter(({ call }) => call[2] === "list").length, listings.length) - 1]));
      }
      if (args[0] === "run" && args[1] === "watch") return watch;
      throw new Error(`unexpected ${command} ${args.join(" ")}`);
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

  it("a hotfix release gets a draft only after the regression run passed on its exact commit", () => {
    const unfinished = clientWatchRun({ status: "in_progress", conclusion: "" });
    const timedOut: CommandResult = { status: null, stdout: "", stderr: "" };
    const refusals: [string, readonly (readonly object[])[], CommandResult, RegExp][] = [
      ["no run", [[]], OK(), /No real-client regression run on hotfix\/1\.0\.1/u],
      ["a run on another commit", [[clientWatchRun({ headSha: "b".repeat(40) })]], OK(), /No real-client regression run/u],
      ["a run on another branch", [[clientWatchRun({ headBranch: "main" })]], OK(), /No real-client regression run/u],
      ["a run without the regression input", [[clientWatchRun({ displayTitle: "ArenaNet client watch" })]], OK(),
        /No real-client regression run/u],
      ["a failed run", [[clientWatchRun({ conclusion: "failure" })]], OK(), /concluded failure: a{40} gets no draft/u],
      ["a failed run newer than a passed one", [[clientWatchRun({ databaseId: 8, conclusion: "failure" }), clientWatchRun()]],
        OK(), /concluded failure/u],
      ["a run still in progress when the wait ends", [[unfinished]], timedOut, /did not finish within 120 minutes/u],
    ];
    for (const [label, listings, watch, refusal] of refusals) {
      assert.throws(() => regressionGate(HOTFIX, clientWatch(listings, watch).dependencies), refusal, label);
    }

    // An unfinished run is waited for once, bounded, then read again.
    const waiting = clientWatch([[unfinished], [clientWatchRun()]]);
    assert.equal(regressionGate(HOTFIX, waiting.dependencies), RUN_URL);
    assert.deepEqual(waiting.calls.map(({ call, timeoutMs }) => [call[2], timeoutMs]), [
      ["list", undefined], ["watch", 120 * 60_000], ["list", undefined],
    ]);
    // A release from main keeps its procedure: no gate, no GitHub call.
    const main = clientWatch([[]]);
    assert.equal(regressionGate(MAIN, main.dependencies), null);
    assert.deepEqual(main.calls, []);
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
      ["a registry line that looks like a diff header", "1.0.1", { [REGISTRY]: `${FACTS_REGISTRY_TEXT}++ extra\n` }, /may only add or remove generation entries:\n\+\+\+ extra$/u],
      ["a changed certification test line", "1.0.1", { [POLICY]: "assert.ok(false);\n" }, /these changed:\ntests\/policy\/rule\.test\.ts$/u],
      ["an added return in a certification test", "1.0.1", { [PROOF]: `return;\n${PROOF_TEXT}` }, /these changed:\ntests\/client-artifact\/proof\.test\.ts$/u],
      ["a mode-only change to a certification test", "1.0.1", { [PROOF]: EXECUTABLE }, /these changed:\ntests\/client-artifact\/proof\.test\.ts$/u],
      ["a removed certification test", "1.0.1", { [PROOF]: null }, /these changed:\ntests\/client-artifact\/proof\.test\.ts$/u],
      ["a fixture a certification test imports", "1.0.1", { "tests/fixtures/queue.ts": "export const roles = 2;\n" }, /these changed:\ntests\/fixtures\/queue\.ts$/u],
      ["a fixture that fixture imports", "1.0.1", { "tests/fixtures/client.ts": "export const client = 2;\n" }, /these changed:\ntests\/fixtures\/client\.ts$/u],
      ["a fixture a certification test names by path", "1.0.1", { "tests/fixtures/kernel.rs": "fn main() { loop {} }\n" }, /these changed:\ntests\/fixtures\/kernel\.rs$/u],
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
    const repository = factRepository({});
    try {
      assert.throws(() => facts("1.0.1", docsOnly.root, docsOnly.github().dependencies, { dryRun: true }), /no facts to release/u);
      writeFileSync(path.join(dirty.root, "notes.txt"), "local");
      assert.throws(() => facts("1.0.1", dirty.root, dirty.github().dependencies, { dryRun: true }), /local changes/u);
      for (const [scenario, state, refusal] of [
        ["the version exists", { release: true }, /v1\.0\.1 exists/u],
        ["nothing is published yet", { latest: null }, /No release is published yet/u],
        ["a newer release is published", { latest: "v1.4.0" }, /v1\.4\.0 is the latest published release; a fact release patches it, not v1\.0\.0/u],
        ["the pull request is open", { open: ["pr"] }, /already has an open pull request or unfinished runs:\nhttps:\/\/github\.com\/gwonmac\/gwonmac\/pull\/1$/u],
        ["the release run waits", { open: ["release.yml"] }, /unfinished runs:\nhttps:\/\/github\.com\/gwonmac\/gwonmac\/actions\/runs\/release\.yml$/u],
        ["the regression run is going", { open: ["client-watch.yml"] }, /unfinished runs:\nhttps:\/\/github\.com\/gwonmac\/gwonmac\/actions\/runs\/client-watch\.yml$/u],
      ] as const) {
        const github = repository.github(state);
        assert.throws(() => facts("1.0.1", repository.root, github.dependencies, { dryRun: false }), refusal, scenario);
        assert.deepEqual(github.writes, [], scenario);
      }
    } finally {
      for (const each of [docsOnly, dirty, repository]) each.close();
    }
  });

  it("a fact release starts regression and the release run, then opens the PR, and never tags", () => {
    const repository = factRepository({});
    try {
      const tags = () => spawnSync("git", ["tag", "--list"], { cwd: repository.root, encoding: "utf8" }).stdout;
      const dry = repository.github();
      const planned = facts("1.0.1", repository.root, dry.dependencies, { dryRun: true });
      assert.deepEqual(planned.changed, [
        FACT, REGISTRY, "tests/client-artifact/new-client.test.ts", "tests/fixtures/free.json",
        "tests/fixtures/new-client.ts", "tests/unit/free.test.ts", POST,
      ]);
      assert.deepEqual(dry.writes, []);

      const live = repository.github();
      const release = facts("1.0.1", repository.root, live.dependencies, { dryRun: false });
      // The only write to git is the branch push: no tag, no commit, no tag push.
      assert.deepEqual(live.writes.map((call) => call.slice(0, 4)), [
        ["git", "push", "origin", "HEAD:refs/heads/hotfix/1.0.1"],
        ["gh", "workflow", "run", "client-watch.yml"],
        ["gh", "workflow", "run", "release.yml"],
        ["gh", "pr", "create", "--repo"],
      ]);
      assert.equal(live.writes[0]!.length, 4);
      assert.equal(tags(), "v1.0.0\n");
      assert.deepEqual(live.writes[1]!.slice(-4), ["--ref", "hotfix/1.0.1", "-f", "regression=true"]);
      assert.deepEqual(live.writes[2]!.slice(-4), ["--ref", "hotfix/1.0.1", "-f", "version=1.0.1"]);
      const body = live.writes[3]!.at(-1)!;
      assert.match(body, /regression on this branch: https:\/\/github\.com\/gwonmac\/gwonmac\/actions\/runs\/client-watch\.yml/u);
      assert.match(body, /environment in https:\/\/github\.com\/gwonmac\/gwonmac\/actions\/runs\/release\.yml\. Its draft job waits/u);
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
const FACTS_REGISTRY_TEXT = REGISTRY_TEXT
  .replace("\nexport", '\nimport { NEW_FACTS } from "./reviewed-client-2026-12-01-bbbbbbbbbbbb.js";\nexport')
  .replace("  OLD_FACTS,\n", "  OLD_FACTS,\n  NEW_FACTS,\n");
const FACT = "app/client/certification/reviewed-client-2026-12-01-bbbbbbbbbbbb.ts";
const POLICY = "tests/policy/rule.test.ts";
const PROOF = "tests/client-artifact/proof.test.ts";
// It imports a fixture (which imports another) and reads one by path.
const PROOF_TEXT = 'import { roles } from "../fixtures/queue.js";\nconst kernel = "tests/fixtures/kernel.rs";\nassert.ok(roles && kernel);\n';
/** A change value that sets the executable bit and leaves the content. */
const EXECUTABLE = Symbol("executable");
const POST = "website/content/en/2.blog/14.gwonmac-1-0-1.md";
const POST_TEXT = "---\ntitle: GWonMac 1.0.1\ndraft: true\nlauncherId: gwonmac-1-0-1\n---\n\nTools work again on the new client.\n";

/** A repository whose v1.0.0 tag is the published release and whose hotfix/1.0.1 adds facts. */
function factRepository(change: Readonly<Record<string, string | null | typeof EXECUTABLE>>, options = { facts: true }) {
  const root = mkdtempSync(path.join(os.tmpdir(), "release-facts-"));
  const git = (...args: string[]) => {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  };
  const write = (files: Readonly<Record<string, string | null | typeof EXECUTABLE>>) => {
    for (const [file, text] of Object.entries(files)) {
      if (text === EXECUTABLE) {
        chmodSync(path.join(root, file), 0o755);
        continue;
      }
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
    // A sample source inside a policy test names a module that does not exist.
    [POLICY]: "assert.ok(true);\nconst sample = 'import { a } from \"./a.js\";';\n",
    [PROOF]: PROOF_TEXT,
    "tests/fixtures/queue.ts": 'import { client } from "./client.js";\nexport const roles = client;\n',
    "tests/fixtures/client.ts": "export const client = 1;\n",
    "tests/fixtures/kernel.rs": "fn main() {}\n",
    "tests/fixtures/free.json": "{}\n",
    "tests/unit/free.test.ts": "assert.ok(true);\n",
  });
  git("tag", "v1.0.0");
  git("switch", "-q", "-c", "hotfix/1.0.1");
  // Facts, plus a new certification test and fixture, and a changed free test and fixture.
  write(options.facts ? {
    [FACT]: "export const NEW_FACTS = {};\n",
    [REGISTRY]: FACTS_REGISTRY_TEXT,
    [POST]: POST_TEXT,
    "tests/client-artifact/new-client.test.ts": 'import { client } from "../fixtures/new-client.js";\nassert.ok(client);\n',
    "tests/fixtures/new-client.ts": "export const client = 3;\n",
    "tests/fixtures/free.json": "{ \"changed\": true }\n",
    "tests/unit/free.test.ts": "assert.equal(1, 1);\n",
  } : { [POST]: POST_TEXT, "docs/recertify.md": "notes\n" });
  write(change);
  return {
    root,
    close: () => rmSync(root, { recursive: true }),
    /**
     * Real git in the repository, except push. `writes` records every call
     * that changes git or GitHub: a git tag, commit, push or ref update, and
     * every gh call other than a view or a list.
     */
    github(state: { release?: boolean; latest?: string | null; open?: readonly string[] } = {}) {
      const writes: string[][] = [];
      const gitWrites = new Set(["tag", "push", "commit", "update-ref"]);
      const dependencies: ReleaseDependencies = {
        repository: REPOSITORY,
        sha: SHA,
        run(command, args, cwd) {
          const writing = command === "git" ? gitWrites.has(args[0] ?? "") : !["view", "list"].includes(args[1] ?? "");
          if (writing) writes.push([command, ...args]);
          if (command === "git" && args[0] !== "push") {
            const result = spawnSync(command, args, { cwd, encoding: "utf8" });
            return { status: result.status, stdout: result.stdout, stderr: result.stderr };
          }
          if (args[0] === "release" && args[1] === "view") {
            if (args[2] === "--repo") return state.latest === null ? NOT_FOUND : OK(`${state.latest ?? "v1.0.0"}\n`);
            return state.release ? OK("{}") : NOT_FOUND;
          }
          if (args[0] === "pr" && args[1] === "list") {
            return OK(state.open?.includes("pr") ? `https://github.com/${REPOSITORY}/pull/1\n` : "");
          }
          if (args[0] === "run" && args[1] === "list") {
            const workflow = args[args.indexOf("--workflow") + 1] ?? "";
            return OK(state.open?.includes(workflow) ? `https://github.com/${REPOSITORY}/actions/runs/${workflow}\n` : "");
          }
          if (args[0] === "workflow") return OK(`https://github.com/${REPOSITORY}/actions/runs/${args[2]}\n`);
          return OK();
        },
      };
      return { writes, dependencies };
    },
  };
}
