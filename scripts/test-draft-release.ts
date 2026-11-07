import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { macOSBundleVersions } from "./macos-version.ts";
import { verifySignedApplication } from "./verify-signed-app.ts";

const REPOSITORY = "Mat4m0/gwonmac";
const PRODUCT = "Guild Wars Reforged";
const DEFAULT_INSTALLED_APP = `/Applications/${PRODUCT}.app`;

export interface DraftRelease {
  isDraft: boolean;
  isPrerelease: boolean;
  targetCommitish: string;
  assets: { name: string }[];
}

export interface ReleaseTag {
  version: string;
  prerelease: boolean;
}

export interface ReleaseTestDependencies {
  platform: NodeJS.Platform;
  arch: string;
  installedApp: string;
  temporaryParent: string;
  run(command: string, args: readonly string[], cwd?: string): string;
  status(command: string, args: readonly string[]): number | null;
  verifyCandidate(application: string): void;
  /** Resolves true when the tester typed `pass`. */
  prompt(): Promise<boolean>;
  log(message: string): void;
}

function command(command: string, args: readonly string[], cwd?: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

async function promptForResult(): Promise<boolean> {
  const input = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const result = (await input.question(
      "Close the candidate after testing, then type 'pass' or 'fail': ",
    )).trim();
    if (result !== "pass" && result !== "fail") {
      throw new Error("result must be exactly 'pass' or 'fail'");
    }
    return result === "pass";
  } finally {
    input.close();
  }
}

function productionDependencies(): ReleaseTestDependencies {
  return {
    platform: process.platform,
    arch: process.arch,
    installedApp: DEFAULT_INSTALLED_APP,
    temporaryParent: os.tmpdir(),
    run: command,
    status: (executable, args) => spawnSync(executable, args).status,
    verifyCandidate: (application) => verifySignedApplication("release", application),
    prompt: promptForResult,
    log: console.log,
  };
}

function gh(dependencies: ReleaseTestDependencies, args: readonly string[]): string {
  return dependencies.run("gh", [...args, "--repo", REPOSITORY]);
}

function plist(
  dependencies: ReleaseTestDependencies,
  application: string,
  key: string,
): string {
  return dependencies.run("/usr/libexec/PlistBuddy", [
    "-c",
    `Print :${key}`,
    path.join(application, "Contents/Info.plist"),
  ]);
}

export function compareBundleVersions(left: string, right: string): number {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  if ([...a, ...b].some(Number.isNaN)) {
    throw new Error("invalid macOS bundle version");
  }
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    const difference = (a[index] ?? 0) - (b[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

export function expectedAssets(version: string): string[] {
  const base = `Guild-Wars-Reforged-${version}-macOS-arm64`;
  return [
    `${base}.dmg`,
    `${base}.zip`,
    "RELEASES.json",
    "SHA256SUMS.txt",
  ].sort();
}

export function parseReleaseTestTag(tag: string): ReleaseTag {
  const match = /^v(\d{4}\.\d{1,2}\.\d{1,2}(?:-(beta|rc)\.\d+)?)$/u.exec(tag);
  if (!match) {
    throw new Error("tag must be a Stable, Beta, or RC release such as v2026.8.8");
  }
  return { version: match[1]!, prerelease: match[2] !== undefined };
}

function appIsRunning(dependencies: ReleaseTestDependencies): boolean {
  return dependencies.status(
    "pgrep",
    ["-f", `/${PRODUCT}\\.app/Contents/MacOS/${PRODUCT}`],
  ) === 0;
}

function readDraft(
  dependencies: ReleaseTestDependencies,
  tag: string,
): DraftRelease {
  return JSON.parse(gh(dependencies, [
    "release",
    "view",
    tag,
    "--json",
    "isDraft,isPrerelease,targetCommitish,assets",
  ])) as DraftRelease;
}

export function assertDraftMetadata(
  tag: string,
  draft: DraftRelease,
  releaseTag: ReleaseTag,
): void {
  if (!draft.isDraft) throw new Error(`${tag} is not a draft release`);
  if (draft.isPrerelease !== releaseTag.prerelease) {
    throw new Error(`${tag} has inconsistent GitHub prerelease metadata`);
  }
  if (!/^[0-9a-f]{40}$/u.test(draft.targetCommitish)) {
    throw new Error(`${tag} does not target one exact commit`);
  }
  const actual = draft.assets.map(({ name }) => name).sort();
  const expected = expectedAssets(releaseTag.version);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `unexpected release assets\nexpected: ${expected.join(", ")}\nactual: ${actual.join(", ")}`,
    );
  }
}

export async function runDraftReleaseTest(
  tag: string,
  dependencies: ReleaseTestDependencies,
): Promise<void> {
  const releaseTag = parseReleaseTestTag(tag);
  if (dependencies.platform !== "darwin" || dependencies.arch !== "arm64") {
    throw new Error("release:test requires an Apple Silicon Mac");
  }
  if (!existsSync(dependencies.installedApp)) {
    throw new Error(`${dependencies.installedApp} is not installed`);
  }
  dependencies.run("gh", ["auth", "status"]);
  const draft = readDraft(dependencies, tag);
  assertDraftMetadata(tag, draft, releaseTag);
  const expectedBundle = macOSBundleVersions(releaseTag.version);
  const installedBundle = plist(
    dependencies,
    dependencies.installedApp,
    "CFBundleVersion",
  );
  if (compareBundleVersions(expectedBundle.buildVersion, installedBundle) <= 0) {
    throw new Error(`${tag} is not newer than the installed bundle ${installedBundle}`);
  }
  if (appIsRunning(dependencies)) {
    throw new Error(`Close ${PRODUCT} normally, then run this command again`);
  }

  let temporary: string | undefined;
  let launched = false;
  let retainTemporary = false;
  try {
    temporary = mkdtempSync(path.join(dependencies.temporaryParent, "gwonmac-draft-"));
    dependencies.log(`Downloading and verifying ${tag} in ${temporary}`);
    gh(dependencies, ["release", "download", tag, "--dir", temporary]);
    const downloaded = readdirSync(temporary).sort();
    if (JSON.stringify(downloaded) !== JSON.stringify(expectedAssets(releaseTag.version))) {
      throw new Error("downloaded asset inventory changed after draft inspection");
    }
    dependencies.run("shasum", ["-a", "256", "-c", "SHA256SUMS.txt"], temporary);

    const base = `Guild-Wars-Reforged-${releaseTag.version}-macOS-arm64`;
    const zip = path.join(temporary, `${base}.zip`);
    const dmg = path.join(temporary, `${base}.dmg`);
    gh(dependencies, ["attestation", "verify", zip]);
    gh(dependencies, ["attestation", "verify", dmg]);

    const extracted = path.join(temporary, "candidate");
    mkdirSync(extracted);
    dependencies.run("ditto", ["-x", "-k", zip, extracted]);
    const candidate = path.join(extracted, `${PRODUCT}.app`);
    if (!existsSync(candidate)) {
      throw new Error("updater ZIP has no canonical application bundle");
    }
    dependencies.verifyCandidate(candidate);
    if (
      plist(dependencies, candidate, "CFBundleShortVersionString")
      !== expectedBundle.appVersion
    ) {
      throw new Error("candidate application version does not match the release tag");
    }
    if (plist(dependencies, candidate, "CFBundleVersion") !== expectedBundle.buildVersion) {
      throw new Error("candidate bundle version does not match the release tag");
    }

    dependencies.log(
      "Verified the exact signed draft. Launching it from the temporary folder.",
    );
    dependencies.run("open", ["-n", candidate]);
    launched = true;
    const passed = await dependencies.prompt();
    if (appIsRunning(dependencies)) {
      throw new Error(`Close ${PRODUCT} normally before completing the test`);
    }
    if (!passed) {
      dependencies.log(
        `Test failed. Do not publish ${tag}; the installed app was not changed.`,
      );
      return;
    }
    dependencies.log(
      `Passed. Publish ${tag} on GitHub. ${dependencies.installedApp} was never changed.`,
    );
  } catch (error) {
    retainTemporary = launched;
    if (temporary && retainTemporary) {
      dependencies.log(`Candidate retained for diagnosis at ${temporary}`);
    }
    throw error;
  } finally {
    if (temporary && !retainTemporary && existsSync(temporary)) {
      rmSync(temporary, { recursive: true });
    }
  }
}

async function main(): Promise<void> {
  const [tag, ...extra] = process.argv.slice(2);
  if (!tag || extra.length > 0) throw new Error("usage: pnpm release:test <tag>");
  await runDraftReleaseTest(tag, productionDependencies());
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  await main();
}
