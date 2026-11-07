# Contributing

We are not actively accepting broad contributions. Small bug fixes, reliability
and security fixes, measured performance improvements, and maintenance that
removes code are welcome.

Open an issue first for new features, UI redesigns, new dependencies or
processes, new persistent or wire formats, changes to client certification,
networking, credentials, updates, or releases, and anything larger than one
focused pull request. An issue does not guarantee that we accept the change:
this project hosts an online game client and shares ArenaNet's services with
other players.

## Report a bug

In a game window, choose **Help → Report a Bug…**. To attach diagnostics,
choose **Help → Diagnostics → Export Recent Diagnostics…** and add the `.zip` to
the [bug form](https://github.com/gwonmac/gwonmac/issues/new?template=bug-report.yml).
Never attach credentials, packet captures, private account data, game binaries,
or crash dumps. Report security issues privately as described in
[SECURITY.md](SECURITY.md).

## Set up and run

Follow [Build from source](README.md#build-from-source), then read
[AGENTS.md](AGENTS.md): it holds the rules, commands, and source map.

- `pnpm dev` opens the real launcher with the normal `Guild Wars` profile.
  `pnpm dev --isolated` uses a fresh profile and prints it; reuse it with
  `pnpm dev --profile /absolute/path`.
- `pnpm launcher:fixture fresh` opens a disposable offline launcher
  (also `single`, `multi`, `mixed`, `interrupted`, `corrupt`; add `--keep`).
- `pnpm tools:dev` and `pnpm hub:dev` open the Tools and Hub UI in a browser
  with fixtures, without the game.
- Keep logs, screenshots, and profiles in the ignored `test-results/` folder.

## Pull requests

1. Change one behavior or one ownership boundary, and target `main`.
2. Explain the problem and name the invariant the change protects.
3. Add the smallest executable proof and remove the old path in the same change.
4. Update the doc that owns the changed behavior.
5. Run `pnpm check`. CI runs the Electron and packaged suites.

Use a Conventional Commit title; PRs are squash-merged. For a UI change, add
before-and-after images, and a short video when timing or motion matters. Do
not run live ArenaNet tests unless the invariant needs them; name any live test
in the PR.

Opening a pull request does not oblige us to merge it. Contributions are
licensed under GPL-3.0-only.
