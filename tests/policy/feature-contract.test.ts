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

const aSwitch = { kind: "boolean" as const, fallback: false, read: () => false, switch: true as const };
const manifest = (id: string, more: Partial<FeatureDefinition> = {}): FeatureDefinition => ({
  id,
  name: "Example",
  summary: "Does one thing.",
  kind: "helpers",
  purpose: "fight",
  icon: "bell",
  settings: { [`${id}Enabled`]: aSwitch },
  region: "pve",
  shots: [],
  parts: ["game"],
  ...more,
});
const folder = (feature: FeatureDefinition, more: Partial<FeatureFolder> = {}): FeatureFolder => ({
  folder: feature.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
  manifest: feature,
  files: ["feature.ts", "README.md", "CHANGELOG.md", "media/.gitkeep"],
  readme: "Example does one thing.\n\n### Use it\n1. Press <kbd>⌘</kbd> <kbd>X</kbd> or search `note` in the [Hub]($docs.hub#what-you-can-search).\n\n> Only you see it.\n",
  changelog: "## Unreleased\n",
  ...more,
});
const withoutPurpose = ({ purpose, ...rest }: FeatureDefinition): FeatureDefinition => (void purpose, rest);
const label = { label: "Example", help: "Turns Example on." };
const option = <const More extends object>(more: More) => ({ kind: "boolean" as const, fallback: false, read: () => false, ...more });

type Case = Readonly<{ check: string; folders: FeatureFolder[]; message: string }>;
const valid = manifest("quickNote", { settings: { quickNoteEnabled: aSwitch, quickNoteSound: option(label) } });
const cases: readonly Case[] = [
  {
    check: "labels",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: aSwitch, quickNoteSound: option({ help: "Plays a sound." }) } as never }))],
    message: "app/features/quick-note/feature.ts: setting quickNoteSound has no label; players see it as a row name.",
  },
  {
    check: "help",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: aSwitch, quickNoteSound: option({ label: "Sound", help: " " }) } }))],
    message: "app/features/quick-note/feature.ts: setting quickNoteSound has no help; say in one line what it does.",
  },
  {
    check: "a card's switch takes the feature's words",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: { ...aSwitch, ...label } } }))],
    message: "app/features/quick-note/feature.ts: switch quickNoteEnabled names itself; players see it under the feature's name and summary, so remove its label and help.",
  },
  {
    check: "one switch",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: aSwitch, quickNoteShown: aSwitch } }))],
    message: "app/features/quick-note/feature.ts: quickNoteEnabled and quickNoteShown are all switches; a feature has one switch.",
  },
  {
    check: "a switch, or features to run with",
    folders: [folder(manifest("quickNote", { settings: { quickNoteSound: option(label) } }))],
    message: "app/features/quick-note/feature.ts: no switch; declare one with featureSwitch, or list in requires the features it runs with.",
  },
  {
    check: "the launch mode's switch names itself",
    folders: [folder(withoutPurpose(manifest("quickNote", { kind: "mode", settings: { quickNoteEnabled: { ...aSwitch, help: "Turns off every feature." } } })))],
    message: "app/features/quick-note/feature.ts: setting quickNoteEnabled has no label; players see it as a row name.",
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
    message: "app/features/quick-note/README.md:1: link to https://wiki.guildwars.com/wiki/Note is not allowed; link only to https://www.gwonmac.com or a docs page as $docs.<page>.",
  },
  {
    check: "README: docs links by name",
    folders: [folder(valid, { readme: "Example does one thing. See [the Hub]($docs/features/hub).\n" })],
    message: "app/features/quick-note/README.md:1: link to $docs/features/hub is not allowed; link only to https://www.gwonmac.com or a docs page as $docs.<page>.",
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
    check: "a link names a feature",
    folders: [folder(manifest("quickNote", { links: { noteBoard: ["open"] } }))],
    message: "app/features/quick-note/feature.ts: links to \"noteBoard\", which is not a feature id.",
  },
  {
    check: "a link target offers a link",
    folders: [folder(manifest("quickNote", { links: { noteBoard: ["open"] } })), folder(manifest("noteBoard"))],
    message: "app/features/quick-note/feature.ts: links to \"noteBoard\", which offers no link; add offers to app/features/note-board/feature.ts.",
  },
  {
    check: "a link calls only offered methods",
    folders: [folder(manifest("quickNote", { links: { noteBoard: ["open", "close"] } })), folder(manifest("noteBoard", { offers: ["open"] }))],
    message: "app/features/quick-note/feature.ts: calls \"noteBoard.close\", which noteBoard does not offer (it offers open).",
  },
  {
    check: "a link to itself",
    folders: [folder(manifest("quickNote", { offers: ["open"], links: { quickNote: ["open"] } }))],
    message: "app/features/quick-note/feature.ts: links to itself; call your own code directly.",
  },
  {
    check: "known uses",
    folders: [folder(manifest("quickNote", { uses: ["teleport"] as never }))],
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
    check: "a card names a purpose",
    folders: [folder(withoutPurpose(manifest("quickNote")))],
    message: "app/features/quick-note/feature.ts: no purpose; the Features tab groups every card by it (one of FEATURE_PURPOSES in app/features/define.ts).",
  },
  {
    check: "the launch mode names no purpose",
    folders: [folder(manifest("quickNote", { kind: "mode", settings: { quickNoteEnabled: { ...aSwitch, ...label } } }))],
    message: "app/features/quick-note/feature.ts: the launch mode is the plain-game strip, not a card; remove purpose.",
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
