# Releasing

gwonmac has one release line from 1.0.0, versioned with SemVer. `main` is the
only long-lived branch. An urgent fix uses a `hotfix/*` branch from the last tag
and the same workflow. `.github/workflows/release.yml` owns the jobs, the
approval, and signing. `scripts/release.ts` owns the rules between them: which
versions may ship (Stable `1.4.0`, Beta `1.4.0-beta.1`, or RC `1.4.0-rc.1`;
Alpha is never published), the asset names, the tag check, and the draft on the
exact commit. `pnpm release:test` reads the same rules, and `pnpm test` checks
that it accepts the draft `scripts/release.ts` creates.
`scripts/release-notary.ts` notarizes and staples the app and the DMG and
validates their tickets; it retries only a lost connection to Apple's ticket
service.

An **ArenaNet game update** changes the official client or game data. A
**gwonmac application update** is a release of this repository. They are
separate systems; this page covers only the second one.

## Release one version

One maintainer, about 15 minutes of attention:

| Step | Who | What |
| --- | --- | --- |
| 1 | maintainer | Merge the release post for `1.4.0` with `draft: true` ([Launcher news](launcher-news.md)). The app bundles it as "What's new"; the website and the news feed leave it out until step 7. |
| 2 | maintainer | **Actions → Release → Run workflow** on `main`, version `1.4.0`. |
| 3 | `release` reviewer | Approve the `release` environment once. |
| 4 | machines | `qualify` checks the build against the current ArenaNet client (no secrets). In parallel, `build` signs, notarizes, and staples the app and DMG, checks the pinned Developer ID, runs the packaged and Keychain tests, and attests the ZIP and DMG. `draft` then tags the commit `v1.4.0` and creates a draft release with the ZIP, DMG, `RELEASES.json`, and `SHA256SUMS.txt`. Nothing is committed. |
| 5 | maintainer | `pnpm release:test v1.4.0` on an Apple Silicon Mac, then play for 10 minutes on the real client. |
| 6 | maintainer | Click **Publish release** on the draft. |
| 7 | maintainer | Remove `draft: true` from the post, move `launcherFeatured: true` to it, run `pnpm --dir website generate:launcher-news`, and merge. The website and News in every installed app show it. |
| 8 | maintainer | `node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts v1.4.0`, add the tag to `tests/unit/player-data-fixtures.test.ts`, and merge. Later versions must read what this one wrote ([player data fixtures](../tests/fixtures/player-data/README.md)). |

The workflow never publishes. Only a person decides that the game looks and
behaves correctly. After publishing, confirm the feed:

```bash
curl -sL https://www.gwonmac.com/updates/stable/darwin/arm64/RELEASES.json
```

It must show the new `tag`.

A failed run creates no draft. Fix the cause and run the workflow again with the
same version. If a draft for that version exists, delete the draft first.

## Fact-only release

When client watch reports that a feature refuses on a new ArenaNet build and
the recovery is only reviewed facts ([Recover certification](recertify.md)),
release it as a patch of the last published release. Reviewing the facts is
the only human step before the `release` approval.

| Step | Who | What |
| --- | --- | --- |
| 1 | agent or maintainer | `git switch -c hotfix/1.4.1 v1.4.0`. Commit the facts, their tests, the release post for `1.4.1` with `draft: true`, and the player files `v1.4.0` writes (step 8 above) if `main` has them and the tag does not. |
| 2 | agent or maintainer | `pnpm release:facts 1.4.1 --dry-run`, then `pnpm release:facts 1.4.1`. |
| 3 | machines | Client watch runs the release battery and the real-client regression suite on the branch (`regression`). The release workflow runs `qualify` and waits at the `release` approval. |
| 4 | maintainer | Review the facts in the pull request. Approve the `release` environment when the regression run passed. |
| 5 | maintainer | Steps 5 to 8 above. Then merge the pull request, so `main` keeps the facts. |

`pnpm release:facts` (`scripts/release.ts facts`) refuses unless:

- it runs on `hotfix/<version>` with no local changes, and the version is the
  next patch (or its Beta or RC) of the latest published release, whose tag
  `HEAD` descends from;
- every change since that tag is a `reviewed-client-*.ts` file, an entry in the
  `reviewed-facts.ts` generation list, the detector record, a test, a doc, or
  website content, and at least one `reviewed-client-*.ts` file changed;
- the Must-stay certification tests (`tests/unit/client-certification*`,
  `tests/unit/enhancement-*`, `tests/client-artifact/`, `tests/policy/`) only
  gain lines;
- exactly one post has the version's `launcherId`, its title, and `draft: true`;
- `tests/fixtures/player-data/` holds the files the patched release writes.

- the branch has no open pull request and no unfinished release or client
  watch run, so running it twice starts nothing twice.

Then it pushes the branch, starts client watch with `regression` and the
release workflow on it, and opens the pull request with a review checklist.
`--dry-run` runs every check and prints those commands instead. It never
tags or publishes: the draft job tags after the approval. A recovery that also
needs code, such as a new Cartography layout, is a normal release.

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

PR titles are Conventional Commits. `scripts/release.ts` groups GitHub's
generated notes into Features (`feat`), Fixes (`fix`), and Other changes;
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
