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
| 1 | maintainer | Write the release post for `1.4.0` with `draft: true` ([Launcher news](launcher-news.md)). Run `pnpm release:notes 1.4.0 --dry-run`, then `pnpm release:notes 1.4.0` ([Feature notes](#feature-notes)), check the wording, and merge. The app bundles the post as "What's new"; the website and the news feed leave it out until step 7. |
| 2 | maintainer | **Actions → Release → Run workflow** on `main`, version `1.4.0`. |
| 3 | `release` reviewer | Approve the `release` environment once. |
| 4 | machines | `qualify` checks the build against the current ArenaNet client (no secrets). In parallel, `build` signs, notarizes, and staples the app and DMG, checks the pinned Developer ID, runs the packaged and Keychain tests, and attests the ZIP and DMG. `draft` then tags the commit `v1.4.0` and creates a draft release with the ZIP, DMG, `RELEASES.json`, and `SHA256SUMS.txt`. Nothing is committed. |
| 5 | maintainer | `pnpm release:test v1.4.0` on an Apple Silicon Mac, then play for 10 minutes on the real client. |
| 6 | maintainer | Click **Publish release** on the draft. |
| 7 | maintainer | Remove `draft: true` from the post, move `launcherFeatured: true` to it, run `pnpm --dir website generate:launcher-news`, and merge. The website and News in every installed app show it. |
| 8 | maintainer | `node --import ./scripts/ts-hook.mjs tests/fixtures/player-data/generate.ts v1.4.0`, add its rows to `tests/unit/player-data-fixtures.test.ts` (one per fixture file; the test fails until every file has one), and merge. Later versions must read what this one wrote ([player data fixtures](../tests/fixtures/player-data/README.md)). |

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
| 3 | machines | Client watch runs the release battery and the real-client regression suite on the branch (`regression`). The release workflow runs `qualify`, waits at the `release` approval, and its `regression` job waits for that client watch run. |
| 4 | maintainer | Review the facts in the pull request and approve the `release` environment. The draft waits for a passed regression run; a failed one turns the `regression` job red and no draft is created. |
| 5 | maintainer | Steps 5 to 8 above. Then merge the pull request, so `main` keeps the facts. |

`pnpm release:facts` (`scripts/release.ts facts`) refuses unless:

- it runs on `hotfix/<version>` with no local changes, and the version is the
  next patch (or its Beta or RC) of the latest published release, whose tag
  `HEAD` descends from;
- every change since that tag is a `reviewed-client-*.ts` file, an entry in the
  `reviewed-facts.ts` generation list, the detector record, a test, a doc, or
  website content, and at least one `reviewed-client-*.ts` file changed;
- the certification tests, their fixtures and the policy tests only gain new
  files. The certification tests (`tests/unit/client-certification*`,
  `tests/unit/enhancement-*`, `tests/client-artifact/`) are Must stay in
  AGENTS.md; their fixtures are every file under `tests/` that these tests or
  `tests/policy/` import or name by path. Any existing one must stay
  byte-identical, mode included;
- exactly one post has the version's `launcherId`, its title, and `draft: true`;
- `tests/fixtures/player-data/` holds the files the patched release writes;
- the branch has no open pull request and no unfinished release or client
  watch run, so running it twice starts nothing twice.

Then it pushes the branch, starts client watch with `regression` and the
release workflow on it, and opens the pull request with a review checklist.
`--dry-run` runs every check and prints those commands instead. It never
tags or publishes: the draft job tags after the approval. A recovery that also
needs code, such as a new Cartography layout, is a normal release.

On every `hotfix/*` branch, the release workflow's `draft` job needs its
`regression` job (`scripts/release.ts regression`), which refuses unless:

- the newest client watch run dispatched with `regression` (its title is
  "Real-client regression") ran on this branch at exactly this commit;
- that run concluded `success`. A run that is still going is waited for once,
  for at most 120 minutes; after that the job fails. Once the release run has
  finished, **Re-run failed jobs** checks again and drafts without a new build.

A release from `main` skips this gate and keeps the procedure above: its code
arrives through reviewed pull requests and CI, and `qualify` proves the shipped
chain on today's client. A code fix on `hotfix/*` needs the same regression run:
start it with `gh workflow run client-watch.yml --ref hotfix/<version> -f regression=true`.

## Patch-day drill

A written run-through of the day ArenaNet ships a new client build. Read it
before that day, and use it as the checklist on the day. Each step links to the
page that owns the procedure; this section only puts them in order. Proof rules
are in [ArenaNet compatibility](arenanet-compatibility.md#patch-day). The exact
reason texts below belong to code (`app/ui/launcher/src/features.ts`,
`app/shared/contracts.ts`), and the replay rows belong to
`tests/client-artifact/patch-day-replay.test.ts`. If a text here and the code
differ, the code wins: fix this page.

### 1. The new build arrives

Two things start at once, on different machines.

- **Client watch** (`.github/workflows/client-watch.yml`) reads ArenaNet's
  manifest every four hours. When the published generation is not the one in
  `certificates/certified-client.json` and no open issue reports it, it
  downloads the official client on a macOS runner, runs the release battery
  and the client-artifact tests, and opens or updates the one open issue
  labelled `arenanet`, with one row per verdict. It keeps client bytes in the
  runner's temporary folder and uploads only the generation record and a
  report. It cannot grant anything to a player.
- **Each player's app** downloads the new build from ArenaNet as it always
  does, and stages it as a candidate ([Game content and updates](content-pipeline.md#candidate-health-and-rollback)).
  The verifier then runs once on that Mac, on the exact official bytes, and
  Main keeps only what the verifier proved ([One runtime authority](arenanet-compatibility.md#one-runtime-authority)).
  Nobody waits for client watch or for us.

Players can meet the new build before client watch reports it, and the other way
round. The player side never depends on the maintainer side.

### 2. What players see

Main turns the verifier's answers into one decision per Feature, and `resolve`
(`app/shared/feature-resolve.ts`) gives the reason. Three surfaces read it.

**Launcher, Features tab.** Each card and each Feature page shows one line.
While the check runs: "Checking this Guild Wars build…". When it finished:

| What the build check says | Card and page line | Player can |
| --- | --- | --- |
| Every capability the Feature uses is proved | On (no reason line) | Switch it off |
| A capability is refused because the build changed (`game-update`) | "Needs a GWonMac update for this Guild Wars build." The Feature page adds a "Check for updates" link to Settings. | Wait for our release; the switch still works |
| A capability could not be checked or did not start | "Couldn’t check this Guild Wars build. Trying again at next start." | Restart the game later |
| Another Feature it needs is not running because it is switched off | "Needs `<Feature>`. Turn it on first." | Turn that Feature on |
| Another Feature it needs waits for an update or a check | The same line as the Feature it needs | As above |

A refusal is per capability: only the Features that use that capability show
it, plus the Features that need them (Progress needs Travel; Team Apply needs
Build Library). Update beats retry when a Feature uses several capabilities.

**Hub.** A Feature that is off adds nothing: no rows, sources, commands or
palette entries (`app/renderer/feature-on.ts`). There is no "needs update"
text in the Hub; the launcher is where a player learns why.

**In the game.** The Feature's own part does not start, and its menu items and
shortcuts are gone. The official client runs as shipped. Nothing else changes:
saves, accounts, Builds and settings stay. The Feature's own switch keeps its
saved choice, so the Feature returns by itself when a release proves the build.

**The plain game.** A player who plays the plain game (Features off) sees
"Off while you play the plain game." on every card, and the build check does
not change that line. The switches wait as stored. The build check still
matters the next time they turn Features on.

**Features that name no capability** (Build Library, Call Target, Trade Chat
today; see each `feature.ts`) have nothing to refuse from the client's side, so
`resolve` never reads the build check for them. They stay on. Maps names no
capability either, but the verifier has a Cartography stage for it that
`resolve` does not read; a refusal there shows in the client watch issue, not
as a reason line ([Patch day](arenanet-compatibility.md#patch-day)).

**Worked example: November 3, 2026.** The replay in
`tests/client-artifact/patch-day-replay.test.ts` judges that client with only
the facts older than it. Template saving, Cartography, native double-click,
friend observation, player effects and the chat paths all proved, because the
build was a relink: same code, renumbered functions and moved data. Only Quick
Item Move refused, because its memory-code digest changed
([why it stays exact](arenanet-compatibility.md#current-implementation-limits)).
So on that day a player saw every Feature on except Quick Item Move, whose card
said "Needs a GWonMac update for this Guild Wars build." Its part did not
start, the game played as the official client without it, and the player lost
nothing else. For contrast, October 22 refused template saving
and almost every Feature (its row in the same test). Read the test's
diagnostics for the current numbers; do not copy them here.

### 3. What we do

The first question: does a Feature refuse, and is the cause a relink we only
need to review, or a real change?

1. **Read the issue.** Find which rows refused and each one's first failing
   invariant. An issue with nothing refused needs no release: players already
   prove the build locally ([Patch day](arenanet-compatibility.md#patch-day)).
2. **Keep the bytes.** Copy the official JS and WASM into the evidence store
   before ArenaNet replaces them ([Preserve the evidence](recertify.md#preserve-the-evidence-before-investigating)).
   Client watch does not keep them for you.
3. **Reproduce locally.** `pnpm certification qualify` on the new WASM, as in
   [Step 2: use the bounded tools](recertify.md#step-2-use-the-bounded-tools).
   First ask whether ArenaNet fixed the defect a transform works around
   ([Step 1](recertify.md#step-1-try-to-delete-the-workaround)); deleting
   beats re-certifying.
4. **Review the moved bodies.** For a refused relink, follow
   [Recover a relocation rebuild](recertify.md#recover-a-relocation-rebuild):
   run `pnpm certification review`, read every drafted pair (call indices and
   addresses may move; constants and control flow need a person), apply the
   approved draft, and run the patch-day replay. The packet holds ArenaNet
   code and stays in the private store.
5. **Decide the release.**
   - Only facts changed (generation file, `reviewed-facts.ts` entry, detector
     record, tests, docs): ship a [fact-only release](#fact-only-release).
   - A new layout, a proof change or any other code: a normal
     [release](#release-one-version) from `main`.
   - Nothing to prove yet: no release. The Feature stays off with the
     "Needs a GWonMac update" line, and the plain official client stays
     playable.
6. **Write the release post.** Say in player words which Feature came back and
   that it needed a new Guild Wars build. A fact-only release carries the post
   with `draft: true` from step 1 of that procedure. Run
   `pnpm release:notes <version> --dry-run` to check what it would add
   ([Feature notes](#feature-notes)); it writes nothing when no Feature
   changelog has a bullet, which is the normal case for a facts-only patch.
7. **Play it.** Release steps 5 and 6 still apply: a person plays the real
   client before **Publish release**. The offline replay and the battery do not
   say that gameplay, graphics or input feel passed.
8. **Close the loop.** After the update reaches players, their app proves the
   build with the new facts and the card turns On at the next start. A new
   client also needs its retained-client fixtures
   ([Per-client records to update](recertify.md#per-client-records-to-update)).

### 4. What never happens

- **No ArenaNet bytes leave the player's Mac or the maintainer's store.** Not
  to us, not to GitHub, not to an issue, a pull request or a CI artifact. The
  verifier runs locally; client watch uploads only hashes and closed outcomes.
  There is no remote facts feed.
- **The official client is never edited.** Derived modules are separate and
  checked before use. A refusal serves the untouched official module.
- **A player is never locked out of the game.** A refused Feature turns itself
  off; the game, the plain-game option and saved data stay.
- **No fact is granted by a report.** CI results, issues, reports and older
  clients are evidence, not authority. Only the local verifier grants a
  capability, and an approved fact only helps it recognise a body.
- **No quick patches around the rules.** Do not weaken a locator until it
  returns one result, and do not load-test ArenaNet: client watch and release
  qualification share one download at a time.

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

### Feature notes

A PR that changes what players see in a Feature adds one `- ` bullet under
`## Unreleased` in `app/features/<id>/CHANGELOG.md`, in player words. Indented
lines continue a bullet. `pnpm release:notes <version>` (`scripts/release.ts
notes`) then, in step 1:

- builds a `## Features` section with one bullet per change, led by the
  feature's `name` from its `feature.ts`: `- **Whispers:** Opens from the Hub.`
  Features are in name order; a feature with an empty `## Unreleased` is left
  out;
- writes that section into the draft post whose `launcherId` is the version's.
  It replaces the section an earlier run wrote, otherwise it goes before the
  post's first other `##` section or the technical record link;
- for a Stable version, turns each non-empty `## Unreleased` into
  `## <version>` and puts a fresh empty `## Unreleased` on top. An empty one
  stays as it is. A Beta or RC writes only the post: its changes stay under
  `## Unreleased`, so the Stable release that ships them lists them too.

It refuses, and writes nothing, when a changelog has no `## Unreleased`, holds
text that is not a bullet, or already has `## <version>`; when the version has
no draft post; or when the post with these notes is a story the news feed would
refuse (`parseNewsStory`, the parser installed apps use). `--dry-run` prints
the notes and each file it would write. When no feature has changes it writes
nothing, so a second run changes nothing. Feature changes merged after step 1
go to the next release.

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
