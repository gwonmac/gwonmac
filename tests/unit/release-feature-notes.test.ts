// `release.ts notes` turns every feature's `## Unreleased` changes into the
// player release notes and stamps them with the version. These tests drive it
// offline with literal changelogs and a literal release post.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { newestNewsFeed, parseProjectNewsFeed } from "../../app/shared/launcher-news-feed.ts";
import {
  featureReleaseNotes,
  releaseNotesPlan,
  releasePostStory,
  stampChangelog,
} from "../../scripts/release.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("stamping a feature changelog", () => {
  // Wrong behaviours: an empty section gains an empty "## 1.4.0" heading in every
  // feature; changes or older versions are lost; no fresh "## Unreleased" stays on
  // top, so the next change lands under the shipped version; a changelog without
  // the heading is skipped silently and its changes never reach players; changes
  // ship under a Feature version an earlier release already stamped.
  const cases: { name: string; text: string; featureVersion?: string; entries?: string[]; stamped?: string; error?: RegExp }[] = [
    { name: "empty section stays as it is", text: "## Unreleased\n", entries: [], stamped: "## Unreleased\n" },
    {
      name: "several changes move under the version, older versions stay",
      text: "## Unreleased\n\n- Shows the zone name.\n- Remembers its place\n  after a restart.\n\n## 1.3.0\n- First release.\n",
      entries: ["Shows the zone name.", "Remembers its place after a restart."],
      stamped: "## Unreleased\n\n## 1.4.0\n- Shows the zone name.\n- Remembers its place\n  after a restart.\n\n## 1.3.0\n- First release.\n",
    },
    {
      name: "missing section is a clear error",
      text: "## 1.3.0\n- First release.\n",
      error: /app\/features\/whispers\/CHANGELOG\.md: no "## Unreleased" heading, so its changes cannot reach the release notes/u,
    },
    {
      name: "text that is not a bullet is a clear error",
      text: "## Unreleased\nShows the zone name.\n",
      error: /CHANGELOG\.md: write each change under "## Unreleased" as one "- " bullet, not "Shows the zone name\."/u,
    },
    {
      name: "a version stamped twice is a clear error",
      text: "## Unreleased\n- Shows the zone name.\n\n## 1.4.0\n- First release.\n",
      error: /CHANGELOG\.md: "## 1\.4\.0" is already stamped/u,
    },
    {
      name: "the Feature version stands beside the app version",
      text: "## Unreleased\n- Shows the zone name.\n\n## 1.3.0\n- First release.\n",
      featureVersion: "1.1",
      entries: ["Shows the zone name."],
      stamped: "## Unreleased\n\n## 1.4.0 · v1.1\n- Shows the zone name.\n\n## 1.3.0\n- First release.\n",
    },
    {
      name: "changes under a Feature version that already shipped are a clear error",
      text: "## Unreleased\n- Shows the zone name.\n\n## 1.3.0 · v1.1\n- Remembers its place.\n",
      featureVersion: "1.1",
      error: /app\/features\/whispers\/feature\.ts: version "1\.1" already shipped in "## 1\.3\.0 · v1\.1"; raise it/u,
    },
  ];
  for (const { name, text, featureVersion, entries, stamped, error } of cases) {
    it(name, () => {
      const stamp = () => stampChangelog(text, "1.4.0", "app/features/whispers/CHANGELOG.md", undefined, featureVersion);
      if (error) assert.throws(stamp, error);
      else assert.deepEqual(stamp(), { entries, text: stamped });
    });
  }
});

describe("feature release notes", () => {
  // Wrong behaviours: a feature without changes shows up as a bare name; a change
  // is shown under the wrong feature or its id instead of the manifest name; the
  // order changes from run to run.
  it("groups changes by feature name and leaves out features without changes", () => {
    assert.equal(featureReleaseNotes([
      { name: "Whispers", entries: ["Opens from the Hub.", "Keeps drafts until you close the game."] },
      { name: "Alcohol Timer", entries: [] },
      { name: "Effect Timers", entries: ["Shows seconds under 10."] },
    ]), [
      "## Features",
      "",
      "- **Effect Timers:** Shows seconds under 10.",
      "- **Whispers:** Opens from the Hub.",
      "- **Whispers:** Keeps drafts until you close the game.",
      "",
    ].join("\n"));
    assert.equal(featureReleaseNotes([{ name: "Alcohol Timer", entries: [] }]), "");
  });
});

describe("release notes plan", () => {
  const post = (version: string) => ({
    file: `website/content/posts/15.gwonmac-${version.replaceAll(".", "-")}.md`,
    text: [
      "---",
      `title: GWonMac ${version}`,
      "description: Two features learned something new.",
      "tags: [Release]",
      "date: 2026-12-01",
      "authors: [authors/matamo]",
      "draft: true",
      `launcherId: gwonmac-${version.replaceAll(".", "-")}`,
      "launcherSource: launcher",
      "launcherChannel: stable",
      "launcherFeatured: false",
      "---",
      "",
      "Two features learned something new.",
      "",
      "- **Hub:** a hand-written change.",
      "",
      "## Notes",
      "",
      "- Restart once.",
      "",
      `[Technical release record](https://github.com/gwonmac/gwonmac/releases/tag/v${version}){target="_blank"}`,
      "",
    ].join("\n"),
  });
  const changelogs = (whispers: string) => [
    { file: "app/features/whispers/CHANGELOG.md", name: "Whispers", version: "1.1", text: whispers },
    { file: "app/features/alcohol-timer/CHANGELOG.md", name: "Alcohol Timer", version: "1.0", text: "## Unreleased\n" },
  ];

  // Wrong behaviours: the notes land after the technical record or replace the
  // hand-written bullets; a second run adds a second Features section; the post
  // stops being a story released apps accept, so they drop the whole feed.
  it("stamps changed changelogs and puts the notes into the post as a story today's feed accepts", () => {
    const plan = releaseNotesPlan("1.4.0", changelogs("## Unreleased\n- Opens from the Hub.\n"), [post("1.3.0"), post("1.4.0")]);
    assert.deepEqual(plan.writes.map(({ file, change }) => [file, change]), [
      ["app/features/whispers/CHANGELOG.md", "## Unreleased becomes ## 1.4.0 · v1.1"],
      ["website/content/posts/15.gwonmac-1-4-0.md", "## Features section"],
    ]);
    const written = plan.writes[1]!.text;
    assert.match(written, /- \*\*Hub:\*\* a hand-written change\.\n\n## Features\n\n- \*\*Whispers:\*\* Opens from the Hub\.\n\n## Notes\n/u);

    const again = releaseNotesPlan("1.4.0", changelogs("## Unreleased\n- Opens from the Hub.\n- Keeps drafts.\n"), [
      { file: plan.writes[1]!.file, text: written },
    ]);
    assert.equal(again.writes[1]!.text.split("## Features").length, 2, "one Features section after a second run");
    assert.match(again.writes[1]!.text, /- \*\*Whispers:\*\* Keeps drafts\.\n\n## Notes\n/u);

    // Published (draft removed, step 7 of docs/releasing.md), the post joins today's feed.
    const today = parseProjectNewsFeed(JSON.parse(readFileSync(path.join(root, "website/public/launcher/news-v1.json"), "utf8")));
    const story = releasePostStory(plan.writes[1]!.file, written.replace("draft: true\n", ""));
    const release = today.find((entry) => entry.source === "launcher")!;
    assert.deepEqual(Object.keys(story).sort(), Object.keys(release).sort(), "a release story keeps today's fields");
    assert.doesNotThrow(() => newestNewsFeed([...today, story]));
  });

  it("writes only the post for a pre-release, so the Stable release still lists the changes", () => {
    const plan = releaseNotesPlan("1.4.0-beta.1", changelogs("## Unreleased\n- Opens from the Hub.\n"), [post("1.4.0-beta.1")]);
    assert.deepEqual(plan.writes.map(({ file }) => file), ["website/content/posts/15.gwonmac-1-4-0-beta-1.md"]);
  });

  // Wrong behaviours: a post tells players about a Feature or option still in development; a
  // shipped Beta change is left out; a left-out change is stamped with the version, so it never
  // reaches the release that ships it; a shipped change keeps its option key in the stamped changelog.
  it("lists only what the release shows, and keeps the rest under Unreleased", () => {
    const whispers = [
      "## Unreleased",
      "- Opens from the Hub.",
      "- [whispersSound] Plays a sound.",
      "- [whispersPreview] Shows a preview.",
      "",
    ].join("\n");
    const staged = [
      { file: "app/features/whispers/CHANGELOG.md", name: "Whispers", version: "1.1", text: whispers,
        settings: { whispersEnabled: {}, whispersSound: { stage: "beta" as const }, whispersPreview: { stage: "dev" as const } } },
      { file: "app/features/alcohol-timer/CHANGELOG.md", name: "Alcohol Timer", version: "1.0", text: "## Unreleased\n- Counts down.\n", stage: "beta" as const },
      { file: "app/features/quick-note/CHANGELOG.md", name: "Quick Note", version: "1.0", text: "## Unreleased\n- Keeps a note.\n", stage: "dev" as const },
    ];
    const shipped = [
      "## Features", "",
      "- **Alcohol Timer:** Counts down.",
      "- **Whispers:** Opens from the Hub.",
      "- **Whispers:** Plays a sound.", "",
    ].join("\n");
    for (const version of ["1.4.0", "1.4.0-beta.1"]) assert.equal(releaseNotesPlan(version, staged, [post(version)]).notes, shipped, version);
    assert.deepEqual(
      releaseNotesPlan("1.4.0", staged, [post("1.4.0")]).writes.slice(0, 2).map(({ text }) => text),
      [
        "## Unreleased\n\n- [whispersPreview] Shows a preview.\n\n## 1.4.0 · v1.1\n- Opens from the Hub.\n- Plays a sound.\n",
        "## Unreleased\n\n## 1.4.0 · v1.0\n- Counts down.\n",
      ],
    );
    assert.equal(
      stampChangelog("## Unreleased\n- [whispersSound] Plays a sound.\n", "1.5.0", "app/features/whispers/CHANGELOG.md").text,
      "## Unreleased\n\n## 1.5.0\n- Plays a sound.\n",
    );
    assert.throws(
      () => releaseNotesPlan("1.4.0", [{ ...staged[0]!, text: "## Unreleased\n- [whisperSound] Plays a sound.\n" }], [post("1.4.0")]),
      /whispers\/CHANGELOG\.md: "\[whisperSound\]" names no setting of this Feature/u,
    );
  });

  it("writes nothing when no feature has changes", () => {
    assert.deepEqual(releaseNotesPlan("1.4.0", changelogs("## Unreleased\n"), [post("1.4.0")]), { notes: "", writes: [] });
  });

  // Wrong behaviour: notes written without a release post vanish, or notes that
  // overflow the story body make every installed app drop the news feed.
  it("refuses without a draft post, and refuses notes the news feed would refuse", () => {
    assert.throws(
      () => releaseNotesPlan("1.4.0", changelogs("## Unreleased\n- Opens from the Hub.\n"), [post("1.3.0")]),
      /Add one release post with launcherId gwonmac-1-4-0, title "GWonMac 1\.4\.0" and draft: true/u,
    );
    assert.throws(
      () => releaseNotesPlan("1.4.0", changelogs(`## Unreleased\n- ${"x".repeat(80_000)}\n`), [post("1.4.0")]),
      /15\.gwonmac-1-4-0\.md: with these notes the launcher news feed would refuse the post: story body must be text/u,
    );
  });
});
