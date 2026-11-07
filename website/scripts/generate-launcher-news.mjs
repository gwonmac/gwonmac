/**
 * Builds the launcher's small, static news contract from canonical website
 * Markdown. Only posts with launcherId participate; the website remains the
 * authoring and presentation owner while this file is a rebuildable projection.
 * Every story and the whole feed pass the app's own news-v1 parser before the
 * feed is written or checked, so the website cannot publish what apps refuse.
 */
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { MAX_NEWS_STORIES, NEWS_FEED_VERSION, parseNewsStory, parseProjectNewsFeed } from "../../app/shared/launcher-news-feed.ts";

const root = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(root, "content/en/2.blog");
const outputPath = path.join(root, "public/launcher/news-v1.json");
const check = process.argv.includes("--check");
const allowed = new Set([
  "title", "description", "badge", "date", "readingTime", "author",
  "launcherId", "launcherSource", "launcherChannel", "launcherFeatured",
  "launcherExternalUrl", "launcherStartsAt", "launcherEndsAt",
]);

function frontmatter(source, name) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/u.exec(source);
  if (!match) throw new Error(`${name}: frontmatter is missing`);
  const metadata = {};
  for (const line of match[1].split("\n")) {
    if (!line.trim()) continue;
    const separator = line.indexOf(":");
    if (separator < 1) throw new Error(`${name}: unsupported frontmatter line`);
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    if (key.startsWith("launcher") && !allowed.has(key)) throw new Error(`${name}: unknown launcher frontmatter field ${key}`);
    metadata[key] = value;
  }
  return { metadata, body: match[2].trim() };
}

function required(metadata, key, name) {
  const value = metadata[key];
  if (!value) throw new Error(`${name}: ${key} is required for launcher news`);
  return value;
}

function storyFrom(name, source) {
  const { metadata, body } = frontmatter(source, name);
  // A draft is the next release's notes: the app bundles them, the feed waits for the release.
  if (!metadata.launcherId || metadata.draft === "true") return null;
  if (metadata.launcherFeatured && metadata.launcherFeatured !== "true" && metadata.launcherFeatured !== "false") {
    throw new Error(`${name}: launcherFeatured must be true or false`);
  }
  const slug = name.replace(/\.md$/u, "").replace(/^\d+\./u, "");
  const story = {
    id: metadata.launcherId,
    source: required(metadata, "launcherSource", name),
    channel: required(metadata, "launcherChannel", name),
    title: required(metadata, "title", name),
    summary: required(metadata, "description", name),
    publishedAt: `${required(metadata, "date", name)}T12:00:00Z`,
    featured: metadata.launcherFeatured === "true",
    // Relative, so every app resolves it against the origin it fetched the feed
    // from: released betas still read it from the website's old address.
    url: metadata.launcherExternalUrl || `/blog/${slug}`,
    ...(metadata.launcherStartsAt ? { startsAt: metadata.launcherStartsAt } : {}),
    ...(metadata.launcherEndsAt ? { endsAt: metadata.launcherEndsAt } : {}),
    body,
  };
  try {
    parseNewsStory(story);
  } catch (error) {
    throw new Error(`${name}: ${error.message}`, { cause: error });
  }
  return story;
}

const names = (await readdir(contentRoot)).filter((name) => name.endsWith(".md")).sort();
const stories = [];
for (const name of names) {
  const story = storyFrom(name, await readFile(path.join(contentRoot, name), "utf8"));
  if (story) stories.push(story);
}
stories.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
const feed = { version: NEWS_FEED_VERSION, stories: stories.slice(0, MAX_NEWS_STORIES) };
parseProjectNewsFeed(feed);
const generated = `${JSON.stringify(feed, null, 2)}\n`;
if (check) {
  const current = await readFile(outputPath, "utf8").catch(() => "");
  if (current !== generated) throw new Error("launcher news feed is stale; run pnpm --dir website generate:launcher-news");
} else {
  await writeFile(outputPath, generated);
}
