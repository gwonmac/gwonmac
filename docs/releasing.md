# Releasing

> **The release workflow is being rebuilt; this page describes the target.**
> Until `release.yml` exists, ask Matthias before you start a release.

gwonmac has one release line from 1.0.0, versioned with SemVer. `main` is the
only long-lived branch. An urgent fix uses a `hotfix/*` branch from the last tag
and the same release workflow.

An **ArenaNet game update** changes the official client or game data. A
**gwonmac application update** is a release of this repository. They are
separate systems; this page covers only the second one.

## Release one version

One person, about 15 minutes of attention:

1. Open **Actions → Release** and enter the version, for example `1.4.0`.
2. Approve the `release` environment gate once.
3. The workflow qualifies the build against the current ArenaNet client (no
   secrets) and, in parallel, builds, signs, notarizes, and staples the app. It
   creates the tag and a draft release with the DMG, ZIP, `RELEASES.json`, and
   `SHA256SUMS`, plus a provenance attestation. Nothing is committed.
4. Run `pnpm release:test v1.4.0`, then play for 10 minutes on the real client.
5. Click **Publish**. The update feed is live at once; a short check confirms
   that the feed returns the new tag.

Only a human publishes. Automation cannot decide whether the game looks and
behaves correctly.

## Testers and rollback

- Testers: publish the draft as a pre-release. The feed ignores pre-releases,
  so testers download them by hand.
- Rollback: delete the release or mark it as a pre-release. The feed falls back
  to the previous release. The app never downgrades itself.

## Update feed

`https://www.gwonmac.com/updates/stable/darwin/arm64/RELEASES.json` redirects
(302) to
`https://github.com/gwonmac/gwonmac/releases/latest/download/RELEASES.json`.
Our domain owns the address; GitHub stores the files.

## Release notes

- PR titles are Conventional Commits. GitHub generates the technical notes,
  grouped by `.github/release.yml`.
- Each release also gets one player post on the website. The website feeds the
  launcher news. See [Launcher news](launcher-news.md).

## Secrets

All signing secrets live in the GitHub environment `release`, never at
repository level: `APPLE_DEVELOPER_ID_P12`, its password and provisioning
profile, `APPLE_API_KEY_P8` with key ID and issuer ID, and `APPLE_TEAM_ID`. The
originals are in the password manager. The bundle ID, Team ID, Developer ID
identity, and app name never change (see [AGENTS.md](../AGENTS.md)).

## Verify downloaded assets

Put the files of one release in one folder and run:

```bash
shasum -a 256 -c SHA256SUMS
gh attestation verify "<zip file>" --repo gwonmac/gwonmac
```

Every file must report `OK`, and the attestation must name `gwonmac/gwonmac`.
Do not disable Gatekeeper or remove quarantine to install a build.
