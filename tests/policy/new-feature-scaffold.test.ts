// `pnpm new-feature` (scripts/new-feature.ts) writes a Feature that keeps the contract as written
// and touches no shared file but the two registries. Each common mistake made in the result
// afterwards fails the contract (app/features/contract.ts) with a message that says what to change.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { pathToFileURL } from "node:url";
import { checkFeatureContract, type FeatureFolder } from "../../app/features/contract.ts";
import type { FeatureDefinition } from "../../app/features/define.ts";
import { FEATURES } from "../../app/features/index.ts";
import { PART_REGISTRY, REGISTRY, newFeatureFiles } from "../../scripts/new-feature.ts";
import { featureFolders } from "../helpers/feature-folders.ts";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string): string | null => {
  const absolute = path.join(root, file);
  return existsSync(absolute) ? readFileSync(absolute, "utf8") : null;
};
const scaffold = newFeatureFiles({ id: "quickNote", kind: "combat" }, read);
const AT = "app/features/quick-note/";

const scratch = mkdtempSync(path.join(tmpdir(), "gwonmac-new-feature-"));
after(() => rmSync(scratch, { recursive: true, force: true }));
let loaded = 0;
const existing = await featureFolders();

/** Imports a feature.ts written by the scaffold, with its one import pointed at the real define.ts. */
async function importManifest(source: string): Promise<FeatureDefinition> {
  const define = pathToFileURL(path.join(root, "app/features/define.ts")).href;
  const file = path.join(scratch, `feature-${loaded += 1}.ts`);
  writeFileSync(file, source.replace(`from "../define.js"`, `from ${JSON.stringify(define)}`));
  return (await import(pathToFileURL(file).href) as { default: FeatureDefinition }).default;
}

/** The contract over the repository as it is after the scaffold: every folder and FEATURES, plus the new one. */
const contractWith = (folder: FeatureFolder) =>
  checkFeatureContract({ folders: [...existing, folder], registered: [...FEATURES, folder.manifest] });

/** The scaffolded folder as the contract reads it, with `change` applied to its files first. */
async function scaffoldedFolder(change: (files: Map<string, string>) => void = () => undefined): Promise<FeatureFolder> {
  const files = new Map([...scaffold].flatMap(([file, text]) => file.startsWith(AT) ? [[file.slice(AT.length), text] as const] : []));
  change(files);
  return {
    folder: "quick-note",
    manifest: await importManifest(files.get("feature.ts") ?? ""),
    files: [...files.keys()],
    readme: files.get("README.md") ?? null,
    changelog: files.get("CHANGELOG.md") ?? null,
  };
}

const replace = (files: Map<string, string>, file: string, from: string, to: string) => {
  const text = files.get(file) ?? "";
  assert.ok(text.includes(from), `the scaffold's ${file} contains ${from}`);
  files.set(file, text.replace(from, to));
};

test("the scaffold writes one folder plus its registry lines", () => {
  assert.deepEqual([...scaffold.keys()].filter((file) => !file.startsWith(AT)), [REGISTRY, PART_REGISTRY]);
  assert.deepEqual([...scaffold.keys()].filter((file) => file.startsWith(AT)).sort(), [
    `${AT}CHANGELOG.md`, `${AT}README.md`, `${AT}companion.ts`, `${AT}feature.ts`, `${AT}media/.gitkeep`,
  ]);
  const added = (file: string) => {
    const before = new Set(read(file)?.split("\n"));
    return scaffold.get(file)?.split("\n").filter((line) => !before.has(line));
  };
  assert.deepEqual(added(REGISTRY), [`import quickNote from "./quick-note/feature.js";`, "  quickNote,"]);
  assert.deepEqual(added(PART_REGISTRY), [`export { default as quickNote } from "./quick-note/companion.js";`]);
});

test("the scaffolded Feature keeps the contract as written", async () => {
  const folder = await scaffoldedFolder();
  assert.equal(folder.manifest.id, "quickNote");
  assert.equal(folder.manifest.kind, "combat");
  assert.deepEqual(contractWith(folder), []);
});

test("the scaffold refuses an id or kind it cannot use", () => {
  const refusals: readonly [Parameters<typeof newFeatureFiles>[0], string][] = [
    [{ id: "targetReadout" }, "app/features/target-readout/ already exists; pick another id or change that Feature."],
    [{ id: "quick-note" }, `"quick-note" is not a Feature id: use camelCase letters and digits, starting with a lowercase letter, such as "quickNote".`],
    [{ id: "QuickNote" }, `"QuickNote" is not a Feature id: use camelCase letters and digits, starting with a lowercase letter, such as "quickNote".`],
    [{ id: "quickNote", kind: "mode" }, `--kind "mode" is not a card kind; use one of maps, combat, party, chat, items, helpers (FEATURE_KINDS in app/features/define.ts).`],
    [{ id: "quickNote", purpose: "fun" }, `--purpose "fun" is not a purpose; use one of around, fight, talk, inventory, characters (FEATURE_PURPOSES in app/features/define.ts).`],
  ];
  for (const [options, message] of refusals) assert.throws(() => newFeatureFiles(options, read), { message });
});

type Mistake = Readonly<{ mistake: string; change: (files: Map<string, string>) => void; messages: readonly string[] }>;
const mistakes: readonly Mistake[] = [
  {
    mistake: "a README without its Details section",
    change: (files) => files.set("README.md", (files.get("README.md") ?? "").replace(/### Details\n(- .*\n)+/, "")),
    messages: [`${AT}README.md: no "### Details" section with a "- **Turn on:** " line; say there where players turn it on (the scaffold's README shows the line).`],
  },
  {
    mistake: "a label on the switch",
    change: (files) => replace(files, "feature.ts", "featureSwitch(false, { tools: true })", `featureSwitch(false, { tools: true, label: "Quick Note", help: "Turns it on." })`),
    messages: [`${AT}feature.ts: switch quickNoteEnabled names itself; players see it under the feature's name and summary, so remove its label and help.`],
  },
  {
    mistake: "a capability the verifier does not know in uses",
    change: (files) => replace(files, "feature.ts", "uses: [],", `uses: ["targetName"],`),
    messages: [`${AT}feature.ts: uses "targetName", which the verifier does not know (ENHANCEMENT_CAPABILITY_FIELDS in app/shared/enhancement-contracts.ts).`],
  },
  {
    mistake: "a CHANGELOG without ## Unreleased",
    change: (files) => files.set("CHANGELOG.md", "- Shows a note.\n"),
    messages: [`${AT}CHANGELOG.md: no "## Unreleased" heading; the release script stamps it with the app version.`],
  },
  {
    mistake: "an id another Feature has",
    change: (files) => replace(files, "feature.ts", `id: "quickNote",`, `id: "targetReadout",`),
    messages: [
      `app/features/index.ts: FEATURES lists "targetReadout" more than once; each Feature has one line.`,
      `${AT}feature.ts: id "targetReadout" does not match its folder; the folder for it is app/features/target-readout/.`,
    ],
  },
  {
    mistake: "a game part its manifest does not declare",
    change: (files) => replace(files, "feature.ts", `parts: ["game"],`, "parts: [],"),
    messages: [`${AT}feature.ts: the folder has companion.ts, so parts must list "game".`],
  },
];

for (const { mistake, change, messages } of mistakes) {
  test(`the contract catches a mistake in a scaffolded Feature: ${mistake}`, async () => {
    const folder = await scaffoldedFolder(change);
    assert.deepEqual(contractWith(folder), messages);
  });
}
