// The feature contract (app/features/contract.ts) holds for every folder in
// app/features, and each check catches the mistake it exists for: a planted
// error in an otherwise valid feature gives exactly that check's message.
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkFeatureContract, type FeatureFolder } from "../../app/features/contract.ts";
import type { FeatureDefinition } from "../../app/features/define.ts";
import { FEATURES } from "../../app/features/index.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const featuresDirectory = path.join(root, "app/features");

const filesUnder = (directory: string, prefix = ""): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory()
    ? filesUnder(path.join(directory, entry.name), `${prefix}${entry.name}/`)
    : [`${prefix}${entry.name}`]);
const readIfPresent = (file: string): string | null => existsSync(file) ? readFileSync(file, "utf8") : null;

async function realFolders(): Promise<FeatureFolder[]> {
  const folders = readdirSync(featuresDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(featuresDirectory, entry.name, "feature.ts")))
    .map((entry) => entry.name);
  return Promise.all(folders.map(async (folder) => {
    const directory = path.join(featuresDirectory, folder);
    const manifest = (await import(path.join(directory, "feature.ts")) as { default: FeatureDefinition }).default;
    return {
      folder,
      manifest,
      files: filesUnder(directory),
      readme: readIfPresent(path.join(directory, "README.md")),
      changelog: readIfPresent(path.join(directory, "CHANGELOG.md")),
    };
  }));
}

test("every feature folder keeps the contract", async () => {
  const folders = await realFolders();
  assert.equal(folders.length, FEATURES.length, "one folder per registered feature");
  assert.deepEqual(checkFeatureContract({ folders, registered: FEATURES }), []);
});

const manifest = (id: string, more: Partial<FeatureDefinition> = {}): FeatureDefinition => ({
  id,
  name: "Example",
  summary: "Does one thing.",
  kind: "helpers",
  icon: "bell",
  activation: { kind: "setting", setting: `${id}Enabled`, master: "gwonmacTools" },
  region: "pve",
  shots: [],
  parts: ["game"],
  ...more,
});
const folder = (feature: FeatureDefinition, more: Partial<FeatureFolder> = {}): FeatureFolder => ({
  folder: feature.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
  manifest: feature,
  files: ["feature.ts", "README.md", "CHANGELOG.md", "media/.gitkeep"],
  readme: "Example does one thing.\n\n### Use it\n1. Press <kbd>⌘</kbd> <kbd>X</kbd>.\n\n> Only you see it.\n",
  changelog: "## Unreleased\n",
  ...more,
});
const label = { label: "Example", help: "Turns Example on." };
const option = <const More extends object>(more: More) => ({ kind: "boolean" as const, fallback: false, read: () => false, ...more });

type Case = Readonly<{ check: string; folders: FeatureFolder[]; message: string }>;
const valid = manifest("quickNote", { settings: { quickNoteEnabled: option(label) } });
const cases: readonly Case[] = [
  {
    check: "labels",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: option({ help: "Turns it on." }) } as never }))],
    message: "app/features/quick-note/feature.ts: setting quickNoteEnabled has no label; players see it as a row name.",
  },
  {
    check: "help",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: option({ label: "Quick Note", help: " " }) } }))],
    message: "app/features/quick-note/feature.ts: setting quickNoteEnabled has no help; say in one line what it does.",
  },
  {
    check: "shots per caption",
    folders: [folder(manifest("quickNote", { shots: ["The note on screen."] }))],
    message: "app/features/quick-note/media/shot-1.webp: missing for the caption \"The note on screen.\".",
  },
  {
    check: "no shot without a caption",
    folders: [folder(valid, { files: ["feature.ts", "media/shot-1.webp"] })],
    message: "app/features/quick-note/media/shot-1.webp: has no caption; add one to shots or delete the file.",
  },
  {
    check: "README: images",
    folders: [folder(valid, { readme: "Example does one thing.\n\n![shot](media/shot-1.webp)\n" })],
    message: "app/features/quick-note/README.md:3: images are not allowed; put pictures in media/ and caption them in shots.",
  },
  {
    check: "README: external links",
    folders: [folder(valid, { readme: "Example does one thing. See [the wiki](https://wiki.guildwars.com/wiki/Note).\n" })],
    message: "app/features/quick-note/README.md:1: link to https://wiki.guildwars.com/wiki/Note is not allowed; link only to https://www.gwonmac.com.",
  },
  {
    check: "README: HTML",
    folders: [folder(valid, { readme: "Example does <b>one</b> thing.\n" })],
    message: "app/features/quick-note/README.md:1: HTML <b> is not allowed; only <kbd> keys.",
  },
  {
    check: "README: tables",
    folders: [folder(valid, { readme: "Example does one thing.\n\n| Key | Action |\n" })],
    message: "app/features/quick-note/README.md:3: tables are not allowed.",
  },
  {
    check: "README: heading level",
    folders: [folder(valid, { readme: "Example does one thing.\n\n## Use it\n" })],
    message: "app/features/quick-note/README.md:3: only ### headings are allowed.",
  },
  {
    check: "README: one note",
    folders: [folder(valid, { readme: "Example does one thing.\n\n> One.\n\n> Two.\n" })],
    message: "app/features/quick-note/README.md:5: only one > note is allowed.",
  },
  {
    check: "README: starts with what it does",
    folders: [folder(valid, { readme: "### Example\nExample does one thing.\n" })],
    message: "app/features/quick-note/README.md:1: start with what the feature does, as a plain sentence.",
  },
  {
    check: "requires cycle",
    folders: [
      folder(manifest("quickNote", { requires: ["noteBoard"] })),
      folder(manifest("noteBoard", { requires: ["quickNote"] })),
    ],
    message: "app/features/quick-note/feature.ts: requires forms a cycle: quickNote → noteBoard → quickNote. A feature cannot need itself.",
  },
  {
    check: "known uses",
    folders: [folder(manifest("quickNote", { capabilities: ["teleport"] as never }))],
    message: "app/features/quick-note/feature.ts: uses \"teleport\", which the verifier does not know (ENHANCEMENT_CAPABILITY_FIELDS in app/shared/enhancement-contracts.ts).",
  },
  {
    check: "## Unreleased",
    folders: [folder(valid, { changelog: "## 2026.11.0\n- First release.\n" })],
    message: "app/features/quick-note/CHANGELOG.md: no \"## Unreleased\" heading; the release script stamps it with the app version.",
  },
  {
    check: "id matches its folder",
    folders: [folder(valid, { folder: "notes" })],
    message: "app/features/notes/feature.ts: id \"quickNote\" does not match its folder; the folder for it is app/features/quick-note/.",
  },
  {
    check: "main part matches main.ts",
    folders: [folder(manifest("quickNote", { parts: ["game", "main"] }))],
    message: "app/features/quick-note/feature.ts: parts lists \"main\", but the folder has no main.ts.",
  },
  {
    check: "network needs a main part",
    folders: [folder(manifest("quickNote", { network: ["notes.example.com"] }))],
    message: "app/features/quick-note/feature.ts: network hosts are reached only from a main part; add main.ts and \"main\" to parts.",
  },
];

test("a valid feature passes the contract", () => {
  assert.deepEqual(checkFeatureContract({ folders: [folder(valid)], registered: [valid] }), []);
});

for (const { check, folders, message } of cases) {
  test(`the contract catches a planted error: ${check}`, () => {
    const registered = folders.map((each) => each.manifest);
    assert.deepEqual(checkFeatureContract({ folders, registered }), [message]);
  });
}
