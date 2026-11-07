# Releasing

gwonmac has one release line from 1.0.0, versioned with SemVer. `main` is the
only long-lived branch. An urgent fix uses a `hotfix/*` branch from the last tag
and the same workflow. `.github/workflows/release.yml` owns the exact steps.

An **ArenaNet game update** changes the official client or game data. A
**gwonmac application update** is a release of this repository. They are
separate systems; this page covers only the second one.

## Release one version

One maintainer, about 15 minutes of attention:

| Step | Who | What |
| --- | --- | --- |
| 1 | maintainer | **Actions → Release → Run workflow** on `main`, version `1.4.0`. |
| 2 | `release` reviewer | Approve the `release` environment once. |
| 3 | machines | `qualify` checks the build against the current ArenaNet client (no secrets). In parallel, `build` signs, notarizes, and staples the app and DMG, checks the pinned Developer ID, runs the packaged and Keychain tests, and attests the ZIP and DMG. `draft` then tags the commit `v1.4.0` and creates a draft release with the ZIP, DMG, `RELEASES.json`, and `SHA256SUMS.txt`. Nothing is committed. |
| 4 | maintainer | `pnpm release:test v1.4.0` on an Apple Silicon Mac, then play for 10 minutes on the real client. |
| 5 | maintainer | Click **Publish release** on the draft. |

The workflow never publishes. Only a person decides that the game looks and
behaves correctly. After publishing, confirm the feed:

```bash
curl -sL https://www.gwonmac.com/updates/stable/darwin/arm64/RELEASES.json
```

It must show the new `tag`.

A failed run creates no draft. Fix the cause and run the workflow again with the
same version. If a draft for that version exists, delete the draft first.

## Testers and rollback

- **Testers:** run the workflow with a pre-release version such as
  `1.4.0-rc.1`. The draft is marked as a pre-release. The feed ignores
  pre-releases, so testers download the DMG by hand.
- **Rollback:** mark the bad release as a pre-release or delete it. The feed
  falls back to the previous release at once. Installed apps never downgrade,
  so players who already updated need a higher corrective version.
- **Order:** publish versions in rising order. GitHub's `latest` is the newest
  published release, not the highest version.

## Update feed

`https://www.gwonmac.com/updates/stable/darwin/arm64/RELEASES.json` redirects
(302, `website/vercel.json`) to
`https://github.com/gwonmac/gwonmac/releases/latest/download/RELEASES.json`.
Our domain owns the address; GitHub stores the files. `RELEASES.json` names the
absolute, immutable ZIP URL of its own tag, and the app checks the tag, version,
and URL before Squirrel checks the Developer ID signature.

The 1.x line starts with a reinstall: 1.0.0 has a lower macOS build number than
any 2026.x app, so 2026.x installs do not update to it by themselves.

## Release notes

PR titles are Conventional Commits. The workflow groups GitHub's generated
notes into Features (`feat`), Fixes (`fix`), and Other changes;
`.github/release.yml` hides Dependabot. Each release also gets one player post
on the website, which feeds the launcher news. See
[Launcher news](launcher-news.md).

## Secrets

All signing secrets live in the GitHub environment `release`, never at
repository level: `APPLE_DEVELOPER_ID_P12`, `APPLE_DEVELOPER_ID_PASSWORD`,
`APPLE_DEVELOPER_ID_PROFILE`, `APPLE_API_KEY_P8`, `APPLE_API_KEY_ID`,
`APPLE_API_ISSUER_ID`, and `APPLE_TEAM_ID`. The originals are in the password
manager. The bundle ID, Team ID, Developer ID identity, and app name never
change (see [AGENTS.md](../AGENTS.md)).

## Verify downloaded assets

Put the files of one release in one folder and run:

```bash
shasum -a 256 -c SHA256SUMS.txt
gh attestation verify "<zip file>" --repo gwonmac/gwonmac
```

Every file must report `OK`, and the attestation must name `gwonmac/gwonmac`.
Do not disable Gatekeeper or remove quarantine to install a build.
