/**
 * Owns the news-v1 contract: the static feed the website generates at
 * website/public/launcher/news-v1.json and every installed app reads. Its
 * fields, limits, enums, story ids and trusted link origins are written once,
 * here, so the website check refuses exactly what the app would refuse.
 *
 * The format is frozen: released apps read it with their own copy of these
 * rules, and one refused story makes them drop the whole feed.
 *
 * No imports: website/scripts/generate-launcher-news.mjs runs this file under
 * plain Node, which cannot resolve the app's `.js` import specifiers.
 */

export const PROJECT_NEWS_ORIGIN = "https://www.gwonmac.com";
export const NEWS_FEED_VERSION = 1;
export const MAX_NEWS_STORIES = 24;
export const MAX_NEWS_TITLE = 140;
export const MAX_NEWS_SUMMARY = 360;
const MAX_NEWS_BODY = 80_000;
const MAX_NEWS_URL = 500;
const MAX_NEWS_ID = 80;
const MAX_NEWS_DATE = 40;
export const NEWS_FEED_SOURCES = ["launcher", "event"] as const;
export const NEWS_CHANNELS = ["all", "stable", "beta"] as const;
const TRUSTED_LINK_ORIGINS: ReadonlySet<string> = new Set([
  PROJECT_NEWS_ORIGIN,
  "https://wiki.guildwars.com",
  "https://github.com",
  "https://discord.gg",
]);

export type NewsFeedSource = (typeof NEWS_FEED_SOURCES)[number];
export type NewsChannel = (typeof NEWS_CHANNELS)[number];

export interface ProjectNewsStory {
  readonly id: string;
  readonly source: NewsFeedSource;
  readonly channel: NewsChannel;
  readonly title: string;
  readonly summary: string;
  readonly publishedAt: string;
  readonly featured: boolean;
  /** Absolute after parsing; the feed may store it relative to the website. */
  readonly url: string;
  readonly startsAt?: string;
  readonly endsAt?: string;
  readonly body: string;
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max: number): string {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    throw new Error(`${label} must be text of 1 to ${max} characters`);
  }
  return value;
}

function iso(value: unknown, label: string): string {
  const candidate = text(value, label, MAX_NEWS_DATE);
  if (!Number.isFinite(Date.parse(candidate))) throw new Error(`${label} is not a date`);
  return candidate;
}

function member<T extends string>(values: readonly T[], value: unknown, label: string): T {
  const found = values.find((candidate) => candidate === value);
  if (found === undefined) throw new Error(`${label} must be one of ${values.join(", ")}`);
  return found;
}

/** An https address on a trusted origin; a relative one resolves against the website. */
export function trustedNewsUrl(value: unknown, label: string): string {
  const candidate = new URL(text(value, label, MAX_NEWS_URL), PROJECT_NEWS_ORIGIN);
  if (!TRUSTED_LINK_ORIGINS.has(candidate.origin) || candidate.protocol !== "https:") throw new Error(`${label} is not trusted`);
  return candidate.href;
}

export function parseNewsStory(value: unknown): ProjectNewsStory {
  const source = object(value, "story");
  const id = text(source.id, "story id", MAX_NEWS_ID);
  if (!/^[a-z0-9][a-z0-9-]*$/u.test(id)) throw new Error("story id must be lowercase letters, digits and dashes");
  if (typeof source.featured !== "boolean") throw new Error("story featured must be true or false");
  return {
    id,
    source: member(NEWS_FEED_SOURCES, source.source, "story source"),
    channel: member(NEWS_CHANNELS, source.channel, "story channel"),
    title: text(source.title, "story title", MAX_NEWS_TITLE),
    summary: text(source.summary, "story summary", MAX_NEWS_SUMMARY),
    publishedAt: iso(source.publishedAt, "story publishedAt"),
    featured: source.featured,
    url: trustedNewsUrl(source.url, "story url"),
    ...(source.startsAt === undefined ? {} : { startsAt: iso(source.startsAt, "story startsAt") }),
    ...(source.endsAt === undefined ? {} : { endsAt: iso(source.endsAt, "story endsAt") }),
    body: text(source.body, "story body", MAX_NEWS_BODY),
  };
}

/** The whole feed or nothing: this is how every released app reads it. */
export function parseProjectNewsFeed(value: unknown): readonly ProjectNewsStory[] {
  const source = object(value, "news feed");
  if (source.version !== NEWS_FEED_VERSION || !Array.isArray(source.stories)) throw new Error("news feed is not version 1");
  if (source.stories.length > MAX_NEWS_STORIES) throw new Error(`news feed has more than ${MAX_NEWS_STORIES} stories`);
  const stories = source.stories.map(parseNewsStory);
  if (new Set(stories.map((story) => story.id)).size !== stories.length) throw new Error("news story ids must be unique");
  return stories;
}
