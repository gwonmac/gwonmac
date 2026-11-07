// Every test file under tests/ runs in some named job. A file counts as run
// when a workflow reaches the command that selects it: a node --test glob or an
// explicit path in a workflow step or in a package script the workflows call
// (directly or through other scripts), or a `pnpm test:electron` step, which
// runs everything the Electron config's testDir and testMatch select. A new
// folder, a narrowed glob, or a dropped workflow step strands files, and this
// test names them.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import electronConfig from "../electron/playwright.config.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

// Files no job can run, with the reason. Each entry must still exist and still
// have no runner, so a fixed or deleted file also fails until its entry goes.
const UNRUN = new Map([
  ["tests/native/friend-invalidation-evidence.test.ts", "pinned to one retired client (tests/fixtures/native-friends.ts INPUT_SHA256)"],
  ["tests/native/friend-lifecycle-evidence.test.ts", "pinned to one retired client (tests/fixtures/native-friends.ts INPUT_SHA256)"],
]);

const tracked = execFileSync("git", ["ls-files", "tests"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter(Boolean);
const testFiles = tracked.filter((file) =>
  /\.(?:test|spec)\.ts$/u.test(file) || /^tests\/[^/]+\.ts$/u.test(file));

const workflowDirectory = path.join(root, ".github/workflows");
const workflows = readdirSync(workflowDirectory)
  .filter((file) => file.endsWith(".yml"))
  .map((file) => readFileSync(path.join(workflowDirectory, file), "utf8"));
const scripts = (JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
  scripts: Record<string, string>;
}).scripts;

function scriptsCalledBy(command: string): string[] {
  return [...command.matchAll(/\bpnpm (?:run )?([\w:-]+)/gu)]
    .map((match) => match[1]!)
    .filter((name) => Object.hasOwn(scripts, name));
}

function reachableScripts(): Set<string> {
  const reached = new Set<string>();
  const pending = workflows.flatMap(scriptsCalledBy);
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (reached.has(name)) continue;
    reached.add(name);
    pending.push(...scriptsCalledBy(scripts[name]!));
  }
  return reached;
}

function globMatcher(glob: string): RegExp {
  const pattern = glob.split("*").map((part) => part.replace(/[.+?^${}()|[\]\\]/gu, "\\$&")).join("[^/]*");
  return new RegExp(`^${pattern}$`, "u");
}

function runners(): ((file: string) => boolean)[] {
  const reached = reachableScripts();
  const commands = [...workflows, ...[...reached].map((name) => scripts[name]!)];
  const globs = commands.flatMap((command) => [...command.matchAll(/\btests\/[\w./*-]+\.ts\b/gu)].map((match) => match[0]));
  const matchers: ((file: string) => boolean)[] = globs.map((glob) => {
    const matcher = globMatcher(glob);
    return (file) => matcher.test(file);
  });
  if (workflows.some((workflow) => electronSteps(workflow).length > 0)) {
    const directory = path.join("tests/electron", electronConfig.testDir ?? ".");
    const match = electronConfig.testMatch;
    assert.ok(match instanceof RegExp, "the Electron config selects specs with one RegExp");
    matchers.push((file) => !path.relative(directory, file).startsWith("..") && match.test(file));
  }
  return matchers;
}

// Each `pnpm test:electron` command line in a workflow, after the script name.
function electronSteps(workflow: string): string[] {
  return workflow.split("\n")
    .filter((line) => line.includes("pnpm test:electron") && !line.trimStart().startsWith("#"))
    .map((line) => line.slice(line.indexOf("pnpm test:electron") + "pnpm test:electron".length));
}

test("every test file matches a command that a workflow runs", () => {
  const matchers = runners();
  const unrun = testFiles.filter((file) => !matchers.some((matches) => matches(file)));
  assert.deepEqual(unrun.filter((file) => !UNRUN.has(file)), [], "these test files run in no job");
  assert.deepEqual([...UNRUN.keys()].filter((file) => !unrun.includes(file)), [], "these UNRUN entries now run or are gone");
});

// Specs say which job runs them with tags (@journey, @macos). A file list in a
// workflow would be a second selection that nobody keeps current.
test("workflows select Electron specs by tag, never by file", () => {
  for (const step of workflows.flatMap(electronSteps)) {
    const files = step.split(/\s+/u).filter((word) => word !== "" && !/^["']?[-$]/u.test(word));
    assert.deepEqual(files, [], `pnpm test:electron${step}`);
  }
});

test("the runner rule rejects a test file that no command selects", () => {
  const matchers = runners();
  for (const file of ["tests/new-folder/stranded.test.ts", "tests/electron/nested/stranded.test.ts"]) {
    assert.equal(matchers.some((matches) => matches(file)), false, file);
  }
  for (const file of ["tests/unit/new.test.ts", "tests/electron/new.spec.ts", "tests/client-artifact/new.test.ts"]) {
    assert.equal(matchers.some((matches) => matches(file)), true, file);
  }
});
