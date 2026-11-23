// The feature contract (app/features/contract.ts) holds for every folder in
// app/features, and each check catches the mistake it exists for: a planted
// error in an otherwise valid feature gives exactly that check's message.
import assert from "node:assert/strict";
import { test } from "node:test";
import { checkFeatureContract, type FeatureFolder } from "../../app/features/contract.ts";
import type { FeatureDefinition } from "../../app/features/define.ts";
import { FEATURES } from "../../app/features/index.ts";
import { featureFolders } from "../helpers/feature-folders.ts";

test("every feature folder keeps the contract", async () => {
  const folders = await featureFolders();
  assert.equal(folders.length, FEATURES.length, "one folder per registered feature");
  assert.deepEqual(checkFeatureContract({ folders, registered: FEATURES }), []);
});

const aSwitch = { kind: "boolean" as const, fallback: false, read: () => false, switch: true as const };
const manifest = (id: string, more: Partial<FeatureDefinition> = {}): FeatureDefinition => ({
  id,
  name: "Example",
  summary: "Does one thing.",
  kind: "fight",
  presence: "screen",
  icon: "bell",
  settings: { [`${id}Enabled`]: aSwitch },
  region: "pve",
  shots: [],
  parts: ["game"],
  ...more,
});
/** The README part that says where players turn a Feature on. */
const details = "\n### Details\n- **Turn on:** on its Feature page.\n";
const folder = (feature: FeatureDefinition, more: Partial<FeatureFolder> = {}): FeatureFolder => ({
  folder: feature.id.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
  manifest: feature,
  files: ["feature.ts", "companion.ts", "README.md", "CHANGELOG.md", "media/.gitkeep"],
  readme: `Example does one thing.\n\n### Use it\n1. Press <kbd>⌘</kbd> <kbd>X</kbd> or search \`note\` in the [Hub]($docs.hub#what-you-can-search).\n${details}\n> Only you see it.\n`,
  changelog: "## Unreleased\n",
  imports: [],
  ...more,
});
const withoutPresence = ({ presence, ...rest }: FeatureDefinition): FeatureDefinition => (void presence, rest);
const label = { label: "Example", help: "Turns Example on." };
const option = <const More extends object>(more: More) => ({ kind: "boolean" as const, fallback: false, read: () => false, ...more });

type Case = Readonly<{ check: string; folders: FeatureFolder[]; message: string; registered?: FeatureDefinition[] }>;
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
    folders: [folder(withoutPresence(manifest("quickNote", { kind: "mode", settings: { quickNoteEnabled: { ...aSwitch, help: "Turns off every feature." } } })))],
    message: "app/features/quick-note/feature.ts: setting quickNoteEnabled has no label; players see it as a row name.",
  },
  {
    check: "shots per caption",
    folders: [folder(manifest("quickNote", { shots: ["The note on screen."] }))],
    message: "app/features/quick-note/media/shot-1.webp: missing for the caption \"The note on screen.\".",
  },
  {
    check: "no shot without a caption",
    folders: [folder(valid, { files: ["feature.ts", "companion.ts", "media/shot-1.webp"] })],
    message: "app/features/quick-note/media/shot-1.webp: has no caption; add one to shots or delete the file.",
  },
  {
    check: "README: images",
    folders: [folder(valid, { readme: "Example does one thing.\n\n![shot](media/shot-1.webp)\n" + details })],
    message: "app/features/quick-note/README.md:3: images are not allowed; put pictures in media/ and caption them in shots.",
  },
  {
    check: "README: external links",
    folders: [folder(valid, { readme: "Example does one thing. See [the wiki](https://wiki.guildwars.com/wiki/Note).\n" + details })],
    message: "app/features/quick-note/README.md:1: link to https://wiki.guildwars.com/wiki/Note is not allowed; link only to https://www.gwonmac.com or a docs page as $docs.<page>.",
  },
  {
    check: "README: docs links by name",
    folders: [folder(valid, { readme: "Example does one thing. See [the Hub]($docs/features/hub).\n" + details })],
    message: "app/features/quick-note/README.md:1: link to $docs/features/hub is not allowed; link only to https://www.gwonmac.com or a docs page as $docs.<page>.",
  },
  {
    check: "README: HTML",
    folders: [folder(valid, { readme: "Example does <b>one</b> thing.\n" + details })],
    message: "app/features/quick-note/README.md:1: HTML <b> is not allowed; only <kbd> keys.",
  },
  {
    check: "README: tables",
    folders: [folder(valid, { readme: "Example does one thing.\n\n| Key | Action |\n" + details })],
    message: "app/features/quick-note/README.md:3: tables are not allowed.",
  },
  {
    check: "README: heading level",
    folders: [folder(valid, { readme: "Example does one thing.\n\n## Use it\n" + details })],
    message: "app/features/quick-note/README.md:3: only ### headings are allowed.",
  },
  {
    check: "README: one note",
    folders: [folder(valid, { readme: "Example does one thing.\n\n> One.\n\n> Two.\n" + details })],
    message: "app/features/quick-note/README.md:5: only one > note is allowed.",
  },
  {
    check: "README: starts with what it does",
    folders: [folder(valid, { readme: "### Example\nExample does one thing.\n" + details })],
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
    message: "app/features/quick-note/feature.ts: uses \"teleport\", which the verifier does not know (ENHANCEMENT_CAPABILITY_FIELDS in app/shared/enhancement-contracts.ts, STAGE_USES in app/shared/contracts.ts).",
  },
  {
    check: "a Feature on a certified stage names it in uses",
    folders: [folder(valid, { imports: ["app/shared/cartography-spike.ts"] })],
    message: "app/features/quick-note/feature.ts: the folder imports app/shared/cartography-spike.ts, so it runs on the certified cartography stage; add \"cartography\" to uses so a refused stage turns it off with a reason.",
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
    check: "a card names a presence",
    folders: [folder(withoutPresence(manifest("quickNote")))],
    message: "app/features/quick-note/feature.ts: no presence; its card tag says how players meet it (one of FEATURE_PRESENCES in app/features/define.ts).",
  },
  {
    check: "the launch mode names no presence",
    folders: [folder(manifest("quickNote", { kind: "mode", settings: { quickNoteEnabled: { ...aSwitch, ...label } } }))],
    message: "app/features/quick-note/feature.ts: the launch mode is the plain-game strip, not a card; remove presence.",
  },
  {
    check: "README: says where to turn it on",
    folders: [folder(valid, { readme: "Example does one thing.\n\n### Use it\n1. Turn it on.\n" })],
    message: "app/features/quick-note/README.md: no \"### Details\" section with a \"- **Turn on:** \" line; say there where players turn it on (the scaffold's README shows the line).",
  },
  {
    check: "one registry line per feature",
    folders: [folder(valid)],
    registered: [valid, valid],
    message: "app/features/index.ts: FEATURES lists \"quickNote\" more than once; each Feature has one line.",
  },
  {
    check: "companion.ts needs the game part kind",
    folders: [folder(manifest("quickNote", { parts: [] }), { files: ["feature.ts", "companion.ts", "README.md", "CHANGELOG.md", "media/.gitkeep"] })],
    message: "app/features/quick-note/feature.ts: the folder has companion.ts, so parts must list \"game\".",
  },
  {
    check: "the game part kind needs companion.ts",
    folders: [folder(valid, { files: ["feature.ts", "README.md", "CHANGELOG.md", "media/.gitkeep"] })],
    message: "app/features/quick-note/feature.ts: parts lists \"game\", but the folder has no companion.ts; add the game part there (featurePart) or remove \"game\".",
  },
  {
    check: "the window part kind needs renderer/window.ts",
    folders: [folder(manifest("quickNote", { parts: ["game", "window"] }))],
    message: "app/features/quick-note/feature.ts: parts lists \"window\", but the folder has no renderer/window.ts.",
  },
  {
    check: "renderer/window.ts needs the window part kind",
    folders: [folder(valid, { files: ["feature.ts", "companion.ts", "renderer/window.ts", "README.md", "CHANGELOG.md", "media/.gitkeep"] })],
    message: "app/features/quick-note/feature.ts: the folder has renderer/window.ts, so parts must list \"window\".",
  },
  {
    check: "the hubPage part kind needs renderer/host.ts",
    folders: [folder(manifest("quickNote", { parts: ["game", "hubPage"] }))],
    message: "app/features/quick-note/feature.ts: parts lists \"hubPage\", but the folder has no renderer/host.ts.",
  },
  {
    check: "a staged option reads as off where it is hidden, so it is a boolean",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: aSwitch, quickNoteVolume: { ...option(label), kind: "integer", stage: "beta" } } }))],
    message: "app/features/quick-note/feature.ts: setting quickNoteVolume has a stage but is of kind integer; where it is hidden it reads as false, so only a boolean option, whose false is off, may have one.",
  },
  {
    check: "a staged option's README lines wait in STAGED.md",
    folders: [folder(manifest("quickNote", { settings: { quickNoteEnabled: aSwitch, quickNoteSound: option({ ...label, stage: "dev" }) } }), {
      readme: `Example does one thing. Turn on :setting[Sound]{to="features/quickNoteSound"}.\n${details}`,
    })],
    message: "app/features/quick-note/README.md: names quickNoteSound, which has stage \"dev\"; keep its lines in STAGED.md beside it until the option ships, so players do not read about it.",
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

for (const { check, folders, message, registered = folders.map((each) => each.manifest) } of cases) {
  test(`the contract catches a planted error: ${check}`, () => {
    assert.deepEqual(checkFeatureContract({ folders, registered }), [message]);
  });
}
