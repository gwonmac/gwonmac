// The website's Feature pages come from each Feature's README.md (scripts/feature-docs.ts):
// every Feature has exactly one page, no page exists without a README, and no hand-written
// docs page or broken docs link stands beside them.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { folderForId } from "../../app/features/contract.ts";
import { FEATURES } from "../../app/features/index.ts";
import { FEATURE_DOCS_DIRECTORY, GENERATED_PAGE, featureDocPages, repositoryFeatureSources } from "../../scripts/feature-docs.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const pages = featureDocPages(repositoryFeatureSources(root));
const readme = (folder: string) => readFileSync(path.join(root, "app/features", folder, "README.md"), "utf8");
const docsDirectory = path.join(root, FEATURE_DOCS_DIRECTORY);
const handWritten = readdirSync(docsDirectory).filter((file) => file.endsWith(".md") && !GENERATED_PAGE.test(file));
/** A docs file's entry name, which `$docs.<name>` links use: `5.templates.de.md` is `templates`. */
const entryName = (file: string) => file.replace(/^\d+\./u, "").replace(/(\.[a-z]{2})?\.md$/u, "");

test("every Feature has one page built from its README, titled with its manifest name, summary and icon", () => {
  assert.deepEqual(pages.map((page) => page.name).sort(), FEATURES.map((feature) => folderForId(feature.id)).sort());
  for (const feature of FEATURES) {
    const folder = folderForId(feature.id);
    const page = pages.find((each) => each.name === folder);
    assert.ok(page, folder);
    assert.match(page.file, GENERATED_PAGE);
    assert.ok(page.text.startsWith(`---\ntitle: ${JSON.stringify(feature.name)}\ndescription: ${JSON.stringify(feature.summary)}\nicon: "lucide:${feature.icon}"\n`), folder);
    assert.ok(page.text.endsWith(`\n---\n\n${readme(folder).trim().replace(/<kbd>([^<]+)<\/kbd>/gu, ":kbd[$1]")}\n`), `${folder}: the page text is its README, with keys as :kbd`);
  }
});

test("a Feature without a README stops the website build instead of losing its page", () => {
  const [, feature] = FEATURES;
  assert.throws(() => featureDocPages([{ manifest: feature, readme: null }]), {
    message: "app/features/call-target/README.md: missing or empty; the website builds the Feature's page from it.",
  });
});

test("the pages follow the Features tab: the launch mode first, then each kind under its label", () => {
  assert.equal(pages[0]?.name, "tools");
  assert.match(pages[0]?.text ?? "", /^tab: Features$/mu);
  const sections = pages.flatMap((page) => /^section: "(.+)"$/mu.exec(page.text)?.[1] ?? []);
  assert.deepEqual(sections, ["Maps & travel", "Combat", "Party & builds", "Chat & trade", "Items", "Helpers"]);
});

test("no hand-written docs page takes a Feature's page", () => {
  const features = new Set(pages.map((page) => page.name));
  assert.deepEqual(handWritten.filter((file) => features.has(entryName(file))), []);
});

test("every docs link in a README or a docs page names a page the website has", () => {
  const known = new Set([...handWritten.map(entryName), ...pages.map((page) => page.name)]);
  const sources = [
    ...FEATURES.map((feature) => ({ file: `app/features/${folderForId(feature.id)}/README.md`, text: readme(folderForId(feature.id)) })),
    ...handWritten.map((file) => ({ file: `${FEATURE_DOCS_DIRECTORY}/${file}`, text: readFileSync(path.join(docsDirectory, file), "utf8") })),
  ];
  const broken = sources.flatMap(({ file, text }) => [...text.matchAll(/\]\(\$docs\.([a-z0-9-]+)/gu)]
    .flatMap((link) => known.has(link[1]!) ? [] : [`${file}: $docs.${link[1]}`]));
  assert.deepEqual(broken, []);
});
