import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  assertDraftMetadata,
  compareBundleVersions,
  expectedAssets,
  parseReleaseTestTag,
  runDraftReleaseTest,
  type DraftRelease,
  type ReleaseTestDependencies,
} from "../../scripts/test-draft-release.ts";

const TAG = "v2026.8.8";
const VERSION = "2026.8.8";
const COMMIT = "a".repeat(40);
const CHECKSUM_ROWS = [
  `${"1".repeat(64)}  Guild-Wars-Reforged-${VERSION}-macOS-arm64.zip`,
  `${"2".repeat(64)}  Guild-Wars-Reforged-${VERSION}-macOS-arm64.dmg`,
  `${"3".repeat(64)}  RELEASES.json`,
];

interface Fixture {
  dependencies: ReleaseTestDependencies;
  root: string;
  temporaryParent: string;
  calls: string[];
  logs: string[];
  setFailure(value: string | undefined): void;
  setRunningAfterLaunch(value: boolean): void;
  close(): void;
}

function fixture(): Fixture {
  const root = mkdtempSync(path.join(os.tmpdir(), "release-test-unit-"));
  const temporaryParent = path.join(root, "temporary");
  const installedApp = path.join(root, "Applications", "Guild Wars Reforged.app");
  mkdirSync(temporaryParent, { recursive: true });
  mkdirSync(installedApp, { recursive: true });

  const draft: DraftRelease = {
    isDraft: true,
    isPrerelease: false,
    targetCommitish: COMMIT,
    assets: expectedAssets(VERSION).map((name) => ({ name })),
  };
  const calls: string[] = [];
  const logs: string[] = [];
  let failure: string | undefined;
  let runningAfterLaunch = false;
  let statusCalls = 0;

  const run = (command: string, args: readonly string[]): string => {
    const call = `${command} ${args.join(" ")}`;
    calls.push(call);
    if (failure === "auth" && call.startsWith("gh auth status")) {
      throw new Error("expired GitHub login");
    }
    if (command === "/usr/libexec/PlistBuddy") {
      const key = args[1];
      const application = args[2] ?? "";
      if (key === "Print :CFBundleShortVersionString") return VERSION;
      return application === path.join(installedApp, "Contents/Info.plist")
        ? "2608.7.99"
        : "2608.8.99";
    }
    if (command === "gh" && args[0] === "release" && args[1] === "view") {
      return JSON.stringify(draft);
    }
    if (command === "gh" && args[0] === "release" && args[1] === "download") {
      const directory = args[args.indexOf("--dir") + 1]!;
      for (const asset of expectedAssets(VERSION)) writeFileSync(path.join(directory, asset), asset);
      writeFileSync(path.join(directory, "SHA256SUMS.txt"), `${CHECKSUM_ROWS.join("\n")}\n`);
      return "";
    }
    if (command === "shasum" && failure === "checksum") {
      throw new Error("checksum mismatch");
    }
    if (
      command === "gh"
      && args[0] === "attestation"
      && failure === "attestation"
    ) {
      throw new Error("attestation failed");
    }
    if (command === "ditto") {
      mkdirSync(path.join(args[3]!, "Guild Wars Reforged.app"), { recursive: true });
      return "";
    }
    if (command === "open" && failure === "launch") {
      throw new Error("candidate launch refused");
    }
    return "";
  };

  const dependencies: ReleaseTestDependencies = {
    platform: "darwin",
    arch: "arm64",
    installedApp,
    temporaryParent,
    run,
    status: () => {
      statusCalls += 1;
      return statusCalls > 1 && runningAfterLaunch ? 0 : 1;
    },
    verifyCandidate: () => {
      if (failure === "signature") throw new Error("invalid signature");
    },
    prompt: async () => true,
    log: (message) => logs.push(message),
  };

  return {
    dependencies,
    root,
    temporaryParent,
    calls,
    logs,
    setFailure: (value) => { failure = value; },
    setRunningAfterLaunch: (value) => { runningAfterLaunch = value; },
    close: () => rmSync(root, { recursive: true }),
  };
}

describe("temporary exact-draft testing", () => {
  it("compares macOS bundle versions numerically", () => {
    assert.equal(compareBundleVersions("2608.8.99", "2608.7.99"), 1);
    assert.equal(compareBundleVersions("2608.8.31", "2608.8.31"), 0);
    assert.equal(compareBundleVersions("2608.8.1", "2608.8.31"), -1);
    assert.throws(() => compareBundleVersions("bad", "2608.8.31"));
  });

  it("accepts Stable, Beta, and RC but refuses Alpha", () => {
    assert.deepEqual(parseReleaseTestTag("v2026.8.8"), {
      version: "2026.8.8",
      prerelease: false,
    });
    assert.equal(parseReleaseTestTag("v2026.8.8-beta.1").prerelease, true);
    assert.equal(parseReleaseTestTag("v2026.8.8-rc.1").prerelease, true);
    assert.throws(() => parseReleaseTestTag("v2026.8.8-alpha.1"), /Stable, Beta, or RC/u);
  });

  it("requires GitHub prerelease metadata to match the tag", () => {
    const releaseTag = parseReleaseTestTag("v2026.8.8-beta.1");
    assert.throws(
      () => assertDraftMetadata(
        "v2026.8.8-beta.1",
        {
          isDraft: true,
          isPrerelease: false,
          targetCommitish: COMMIT,
          assets: expectedAssets("2026.8.8-beta.1").map((name) => ({ name })),
        },
        releaseTag,
      ),
      /inconsistent GitHub prerelease metadata/u,
    );
  });

  it("refuses non-drafts and changed asset inventories", () => {
    const releaseTag = parseReleaseTestTag(TAG);
    const valid: DraftRelease = {
      isDraft: true,
      isPrerelease: false,
      targetCommitish: COMMIT,
      assets: expectedAssets(VERSION).map((name) => ({ name })),
    };
    assert.throws(
      () => assertDraftMetadata(TAG, { ...valid, isDraft: false }, releaseTag),
      /not a draft/u,
    );
    assert.throws(
      () => assertDraftMetadata(TAG, { ...valid, assets: [] }, releaseTag),
      /unexpected release assets/u,
    );
    assert.throws(
      () => assertDraftMetadata(
        TAG,
        { ...valid, targetCommitish: "release/2026.8.8" },
        releaseTag,
      ),
      /one exact commit/u,
    );
  });

  it("launches, reports Passed, and removes the temporary candidate", async () => {
    const test = fixture();
    try {
      await runDraftReleaseTest(TAG, test.dependencies);
      assert.deepEqual(readdirSync(test.temporaryParent), []);
      assert.ok(test.logs.some((line) => line.startsWith("Passed.")));
      assert.ok(test.calls.some((call) => call.startsWith("open -n ")));
      assert.equal(test.calls.some((call) => call.startsWith("git ")), false);
    } finally {
      test.close();
    }
  });

  for (const failure of ["checksum", "attestation", "signature", "launch"] as const) {
    it(`removes complete downloads after a pre-launch ${failure} failure`, async () => {
      const test = fixture();
      test.setFailure(failure);
      try {
        await assert.rejects(runDraftReleaseTest(TAG, test.dependencies));
        assert.deepEqual(readdirSync(test.temporaryParent), []);
      } finally {
        test.close();
      }
    });
  }

  it("creates no temporary download when GitHub authentication fails", async () => {
    const test = fixture();
    test.setFailure("auth");
    try {
      await assert.rejects(runDraftReleaseTest(TAG, test.dependencies), /expired GitHub login/u);
      assert.deepEqual(readdirSync(test.temporaryParent), []);
    } finally {
      test.close();
    }
  });

  it("retains a launched candidate when it is still running", async () => {
    const test = fixture();
    test.setRunningAfterLaunch(true);
    try {
      await assert.rejects(runDraftReleaseTest(TAG, test.dependencies), /Close Guild Wars Reforged/u);
      assert.equal(readdirSync(test.temporaryParent).length, 1);
      assert.ok(test.logs.some((line) => line.includes("retained for diagnosis")));
    } finally {
      test.close();
    }
  });
});
