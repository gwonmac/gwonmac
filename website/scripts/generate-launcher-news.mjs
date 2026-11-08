/**
 * Builds the launcher's small, static news contract from canonical website
 * Markdown. Only posts with launcherId participate; the website remains the
 * authoring and presentation owner while this file is a rebuildable projection.
 * Every story and the whole feed pass the app's own news-v1 parser before the
 * feed is written or checked, so the website cannot publish what apps refuse.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readFrontMatter } from "../../app/shared/website-content.ts";
import { newestNewsFeed, parseNewsStory } from "../../app/shared/launcher-news-feed.ts";
import { redirects } from "../redirects.ts";

const root = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(root, "content/posts");
const outputPath = path.join(root, "public/launcher/news-v1.json");
const check = process.argv.includes("--check");
const allowed = new Set([
  "title", "description", "tags", "date", "authors", "slug",
  "launcherId", "launcherSource", "launcherChannel", "launcherFeatured",
  "launcherExternalUrl", "launcherStartsAt", "launcherEndsAt",
]);

// The feed keeps the link form it had before the docs moved (`$docs/guides/templates`): released apps read the
// bodies as they are, and the feed must not change for the same posts. A post now names a docs page by its file
// name (`$docs.templates`); the old path comes from the redirect that replaced it. A page that never had an old
// path gets its plain address.
const legacyDocsPath = new Map(
  redirects.filter((rule) => rule.from.startsWith("/docs/")).map((rule) => [rule.to, rule.from.slice("/docs/".length)]),
);
function feedBody(body) {
  return body.replace(/\]\(\$docs\.([a-z0-9-]+)/gu, (_, name) => {
    const legacy = legacyDocsPath.get(`/docs/${name}`);
    return legacy ? `]($docs/${legacy}` : `](/docs/${name}`;
  });
}

function required(fields, key) {
  const value = fields[key];
  if (!value) throw new Error(`${key} is required for launcher news`);
  return value;
}

function storyFrom(name, source) {
  const { fields, body, draft } = readFrontMatter(source);
  for (const key of Object.keys(fields)) {
    if (key.startsWith("launcher") && !allowed.has(key)) throw new Error(`unknown launcher frontmatter field ${key}`);
  }
  // A draft is the next release's notes: the app bundles them, the feed waits for the release.
  if (!fields.launcherId || draft) return null;
  if (fields.launcherFeatured && fields.launcherFeatured !== "true" && fields.launcherFeatured !== "false") {
    throw new Error("launcherFeatured must be true or false");
  }
  const slug = fields.slug || name.replace(/\.md$/u, "").replace(/^\d+\./u, "");
  const story = {
    id: fields.launcherId,
    source: required(fields, "launcherSource"),
    channel: required(fields, "launcherChannel"),
    title: required(fields, "title"),
    summary: required(fields, "description"),
    publishedAt: `${required(fields, "date")}T12:00:00Z`,
    featured: fields.launcherFeatured === "true",
    // Relative, so every app resolves it against the origin it fetched the feed
    // from: released betas still read it from the website's old address.
    url: fields.launcherExternalUrl || `/blog/${slug}`,
    ...(fields.launcherStartsAt ? { startsAt: fields.launcherStartsAt } : {}),
    ...(fields.launcherEndsAt ? { endsAt: fields.launcherEndsAt } : {}),
    body: feedBody(body.trim()),
  };
  parseNewsStory(story);
  return story;
}

// The feed is English: a translation (`<n>.<name>.<locale>.md`) is not a story of its own.
const names = (await readdir(contentRoot))
  .filter((name) => /^(?:\d+\.)?[^.]+\.md$/u.test(name))
  .sort();
const stories = [];
for (const name of names) {
  let story;
  try {
    story = storyFrom(name, await readFile(path.join(contentRoot, name), "utf8"));
  } catch (error) {
    throw new Error(`${name}: ${error.message}`, { cause: error });
  }
  if (story) stories.push(story);
}
const feed = newestNewsFeed(stories);
const generated = `${JSON.stringify(feed, null, 2)}\n`;
if (check) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== generated) throw new Error("launcher news feed is stale; run pnpm --dir website generate:launcher-news");
} else {
  await writeFile(outputPath, generated);
}
