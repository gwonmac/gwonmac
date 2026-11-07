/**
 * The identifiers that name this project to services outside it — the GitHub
 * repository releases are read from and the Apple Team ID its bundles are
 * signed under — and the one address shape a published release asset is
 * downloaded from.
 *
 * They live alone, with no imports, because build scripts, the packaging
 * configuration, updater, release scripts, and distribution channels all need
 * them and none of those may become the place the others read them from.
 * Changing any of them changes which releases an installation trusts, which
 * Keychain group its secrets belongs to, or where it goes for bytes.
 *
 * This module refuses to own what is downloaded, when, or whether the answer
 * may be believed. It builds an address and makes no request.
 */
export const RELEASE_REPO = "gwonmac/gwonmac";
export const RELEASE_REPO_URL = `https://github.com/${RELEASE_REPO}`;
export const APPLE_TEAM_ID = "9NN976MFZ4";
// The website redirects this path to the newest GitHub release's
// RELEASES.json, so the domain owns the address and GitHub stores the bytes.
const UPDATE_FEED_ROOT = "https://www.gwonmac.com/updates";
export const APP_UPDATE_FEED_URL =
  `${UPDATE_FEED_ROOT}/stable/darwin/arm64/RELEASES.json`;

/** One published release's asset, addressed by the tag it was published under. */
export function releaseAssetUrl(tag: string, name: string): string {
  return `${RELEASE_REPO_URL}/releases/download/`
    + `${encodeURIComponent(tag)}/${encodeURIComponent(name)}`;
}
