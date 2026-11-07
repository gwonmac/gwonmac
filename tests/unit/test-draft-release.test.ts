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

const TAG = "v1.0.1";
const VERSION = "1.0.1";
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
  setInstalled(appVersion: string, buildVersion: string): void;
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
  let installed = { appVersion: "1.0.0", buildVersion: "100.0.99" };

  const run = (command: string, args: readonly string[]): string => {
    const call = `${command} ${args.join(" ")}`;
    calls.push(call);
    if (failure === "auth" && call.startsWith("gh auth status")) {
      throw new Error("expired GitHub login");
    }
    if (command === "/usr/libexec/PlistBuddy") {
      const key = args[1];
      const isInstalled = args[2] === path.join(installedApp, "Contents/Info.plist");
      if (key === "Print :CFBundleShortVersionString") {
        return isInstalled ? installed.appVersion : VERSION;
      }
      return isInstalled ? installed.buildVersion : "100.1.99";
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
    setInstalled: (appVersion, buildVersion) => { installed = { appVersion, buildVersion }; },
    close: () => rmSync(root, { recursive: true }),
  };
}

describe("temporary exact-draft testing", () => {
  it("compares macOS bundle versions numerically", () => {
    assert.equal(compareBundleVersions("100.1.99", "100.0.99"), 1);
    assert.equal(compareBundleVersions("100.1.31", "100.1.31"), 0);
    assert.equal(compareBundleVersions("100.1.1", "100.1.31"), -1);
    assert.throws(() => compareBundleVersions("bad", "100.1.31"));
  });

  it("accepts Stable, Beta, and RC but refuses Alpha", () => {
    assert.deepEqual(parseReleaseTestTag("v1.0.1"), {
      version: "1.0.1",
      prerelease: false,
    });
    assert.equal(parseReleaseTestTag("v1.0.1-beta.1").prerelease, true);
    assert.equal(parseReleaseTestTag("v1.0.1-rc.1").prerelease, true);
    assert.throws(() => parseReleaseTestTag("v1.0.1-alpha.1"), /Stable, Beta, or RC/u);
  });

  it("requires GitHub prerelease metadata to match the tag", () => {
    const releaseTag = parseReleaseTestTag("v1.0.1-beta.1");
    assert.throws(
      () => assertDraftMetadata(
        "v1.0.1-beta.1",
        {
          isDraft: true,
          isPrerelease: false,
          targetCommitish: COMMIT,
          assets: expectedAssets("1.0.1-beta.1").map((name) => ({ name })),
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
        { ...valid, targetCommitish: "main" },
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

  // The 1.x line starts with a reinstall over the date-numbered 2026.x app,
  // whose build numbers are higher; inside the 1.x line a downgrade is refused.
  for (const [appVersion, buildVersion, accepted] of [
    ["2026.11.0", "2611.0.99", true],
    ["1.0.0", "100.0.99", true],
    ["1.0.1", "100.1.99", false],
    ["1.1.0", "101.0.99", false],
  ] as const) {
    it(`${accepted ? "accepts" : "refuses"} ${TAG} over an installed ${appVersion}`, async () => {
      const test = fixture();
      test.setInstalled(appVersion, buildVersion);
      try {
        const run = runDraftReleaseTest(TAG, test.dependencies);
        if (accepted) await run;
        else await assert.rejects(run, /is not newer than the installed bundle/u);
      } finally {
        test.close();
      }
    });
  }

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
