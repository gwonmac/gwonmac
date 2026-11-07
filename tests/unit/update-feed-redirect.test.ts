// The updater asks www.gwonmac.com for the feed; website/vercel.json answers
// with a redirect to the newest GitHub release. If the two drift apart, every
// installed app gets a 404 and silently stops updating.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import {
  APP_UPDATE_FEED_URL,
  RELEASE_REPO_URL,
} from "../../app/shared/project-identity.ts";

interface Redirect {
  source: string;
  destination: string;
  statusCode?: number;
}

it("redirects the app's update feed to the latest release's RELEASES.json", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../website/vercel.json", import.meta.url), "utf8"),
  ) as { redirects?: Redirect[] };
  const feed = new URL(APP_UPDATE_FEED_URL);
  assert.equal(feed.origin, "https://www.gwonmac.com");
  const redirect = config.redirects?.find(({ source }) => source === feed.pathname);
  assert.deepEqual(redirect, {
    source: feed.pathname,
    destination: `${RELEASE_REPO_URL}/releases/latest/download/RELEASES.json`,
    // Temporary: a cached permanent redirect could pin an old release.
    statusCode: 302,
  });
});
