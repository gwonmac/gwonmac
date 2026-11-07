// Apple notarization, stapling and ticket validation for a release, with the
// one retry rule for Apple's ticket service. Three callers use it: Forge's
// postPackage hook notarizes and staples the app (forge.config.ts), release.yml
// does the same for the DMG (`node scripts/release-notary.ts <dmg>`), and
// scripts/verify-signed-app.ts validates both tickets.
//
// stapler looks tickets up in Apple's CloudKit service, and hosted runners
// sometimes lose that connection (NSURLErrorDomain -1005). Only that transport
// error is retried, five tries 30 s apart, so a missing or invalid ticket still
// fails on the first answer.
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { CommandResult } from "./release.js";

export interface NotaryDependencies {
  run(command: string, args: readonly string[]): CommandResult;
  sleep(milliseconds: number): void;
}

export interface NotaryCredentials {
  readonly key: string;
  readonly keyId: string;
  readonly issuer: string;
}

const ATTEMPTS = 5;
const RETRY_DELAY_MS = 30_000;

const output = (result: CommandResult) => `${result.stdout}${result.stderr}`;

export const notaryDependencies: NotaryDependencies = {
  run(command, args) {
    const result = spawnSync(command, args, { encoding: "utf8" });
    if (result.error) throw result.error;
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  },
  sleep(milliseconds) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
  },
};

/** Runs one stapler action, retrying only a lost connection to Apple. */
export function withTicketRetry(
  args: readonly string[],
  dependencies: NotaryDependencies,
): CommandResult {
  for (let attempt = 1; ; attempt += 1) {
    const result = dependencies.run("xcrun", ["stapler", ...args]);
    if (result.status === 0 || attempt === ATTEMPTS || !output(result).includes("NSURLErrorDomain")) {
      return result;
    }
    dependencies.sleep(RETRY_DELAY_MS);
  }
}

/** The stapler validation result for a stapled app or DMG; status 0 is valid. */
export function validateTicket(target: string, dependencies = notaryDependencies): CommandResult {
  return withTicketRetry(["validate", "-v", target], dependencies);
}

export function notaryCredentials(environment: NodeJS.ProcessEnv = process.env): NotaryCredentials {
  const value = (name: string) => {
    const found = environment[name];
    if (!found) throw new Error(`${name} is required for notarization`);
    return found;
  };
  return {
    key: value("APPLE_API_KEY_PATH"),
    keyId: value("APPLE_API_KEY_ID"),
    issuer: value("APPLE_API_ISSUER_ID"),
  };
}

/** The submission id and status in notarytool's JSON answer, when it gave one. */
function notaryVerdict(stdout: string): { id?: string; status?: string } {
  let answer: unknown;
  try {
    answer = JSON.parse(stdout);
  } catch {
    return {};
  }
  if (typeof answer !== "object" || answer === null) return {};
  const id = "id" in answer && typeof answer.id === "string" ? answer.id : undefined;
  const status = "status" in answer && typeof answer.status === "string" ? answer.status : undefined;
  return { ...(id ? { id } : {}), ...(status ? { status } : {}) };
}

/**
 * Submits an app or DMG, waits for Apple's verdict, and staples the ticket.
 * notarytool accepts an app only inside an archive, so an app is zipped first.
 */
export function notarizeAndStaple(
  target: string,
  credentials: NotaryCredentials,
  dependencies = notaryDependencies,
): void {
  const authorization = [
    "--key", credentials.key, "--key-id", credentials.keyId, "--issuer", credentials.issuer,
  ];
  const archiveDirectory = target.endsWith(".app")
    ? mkdtempSync(path.join(os.tmpdir(), "gwonmac-notary-"))
    : undefined;
  try {
    const submission = archiveDirectory ? path.join(archiveDirectory, "app.zip") : target;
    if (archiveDirectory) {
      const zipped = dependencies.run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", target, submission]);
      if (zipped.status !== 0) throw new Error(`ditto could not archive ${target}\n${output(zipped)}`);
    }
    const submitted = dependencies.run("xcrun", [
      "notarytool", "submit", submission, "--wait", "--output-format", "json", ...authorization,
    ]);
    const verdict = notaryVerdict(submitted.stdout);
    if (submitted.status !== 0 || verdict.status !== "Accepted") {
      const log = verdict.id
        ? output(dependencies.run("xcrun", ["notarytool", "log", verdict.id, ...authorization]))
        : "";
      throw new Error(`Apple did not accept ${target}\n${output(submitted)}\n${log}`);
    }
  } finally {
    if (archiveDirectory) rmSync(archiveDirectory, { recursive: true });
  }
  const stapled = withTicketRetry(["staple", "-v", target], dependencies);
  if (stapled.status !== 0) throw new Error(`stapler could not staple ${target}\n${output(stapled)}`);
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [target, ...extra] = process.argv.slice(2);
  if (!target || extra.length > 0) throw new Error("usage: release-notary.ts <app-or-dmg>");
  notarizeAndStaple(target, notaryCredentials());
}
