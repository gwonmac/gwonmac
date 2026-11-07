import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AppUpdater,
  PERIODIC_CHECK_DUE_MS,
  PERIODIC_CHECK_TICK_MS,
  periodicCheckDue,
} from "../../app/main/app-updater.ts";
import type {
  AppUpdateErrorCode,
  AppUpdateState,
} from "../../app/shared/contracts.ts";
import {
  APP_UPDATE_FEED_URL,
  releaseAssetUrl,
} from "../../app/shared/project-identity.ts";

function manifest(version: string) {
  const tag = `v${version}`;
  const zipName = `Guild-Wars-Reforged-${version}-macOS-arm64.zip`;
  return {
    url: releaseAssetUrl(tag, zipName),
    name: `Guild Wars Reforged v${version}`,
    version,
    tag,
    pub_date: "2026-07-30T00:00:00.000Z",
    notes: "",
  };
}

function response(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function fixture(options: {
  capable?: boolean;
  currentVersion?: string;
  fetch?: typeof fetch;
  timeoutMs?: number;
  native?: {
    setFeedURL?: (url: string) => void;
    checkForUpdates?: () => void;
    quitAndInstall?: () => void;
  };
} = {}) {
  const states: AppUpdateState[] = [];
  const remembered: number[] = [];
  const feeds: string[] = [];
  const failures: AppUpdateErrorCode[] = [];
  let nativeChecks = 0;
  let installs = 0;
  const updater = new AppUpdater({
    currentVersion: options.currentVersion ?? "1.0.0",
    capable: options.capable ?? true,
    fetch: options.fetch ?? (async () => response(manifest("1.0.1"))),
    now: () => 1234,
    ...(options.timeoutMs === undefined
      ? {}
      : { timeoutMs: options.timeoutMs }),
    nativeUpdater: {
      setFeedURL: ({ url }) => {
        options.native?.setFeedURL?.(url);
        feeds.push(url);
      },
      checkForUpdates: () => {
        options.native?.checkForUpdates?.();
        nativeChecks += 1;
      },
      quitAndInstall: () => {
        installs += 1;
        options.native?.quitAndInstall?.();
      },
    },
    rememberCheckedAt: async (value) => {
      remembered.push(value);
    },
    publish: (state) => states.push(state),
    recordFailure: (reason) => failures.push(reason),
  });
  return {
    updater,
    states,
    remembered,
    feeds,
    failures,
    nativeChecks: () => nativeChecks,
    installs: () => installs,
  };
}

describe("application updater", () => {
  it("reads exactly one static manifest", async () => {
    const requests: string[] = [];
    const f = fixture({
      fetch: async (input) => {
        requests.push(String(input));
        return response(manifest("1.0.1"));
      },
    });
    await f.updater.check();
    assert.deepEqual(requests, [APP_UPDATE_FEED_URL]);
    assert.deepEqual(f.feeds, [releaseAssetUrl("v1.0.1", "RELEASES.json")]);
    assert.equal(f.nativeChecks(), 1);
  });

  it("makes no request and reports unavailable without the signed marker", async () => {
    let requests = 0;
    const f = fixture({
      capable: false,
      fetch: async () => {
        requests += 1;
        return response(manifest("1.0.1"));
      },
    });
    await f.updater.check();
    assert.equal(requests, 0);
    assert.deepEqual(f.updater.getState(), {
      phase: "failed",
      currentVersion: "1.0.0",
      lastCheckedAt: "1970-01-01T00:00:01.234Z",
      reason: "updater-unavailable",
    });
    assert.deepEqual(f.remembered, [1234]);
  });

  it("validates before asking Squirrel to download and installs once", async () => {
    const f = fixture();
    await f.updater.check();
    assert.deepEqual(f.remembered, [1234]);
    assert.equal(f.updater.getState().phase, "downloading");
    f.updater.updateDownloaded();
    assert.equal(f.updater.getState().phase, "ready");
    f.updater.updateFailed();
    f.updater.updateNotAvailable();
    assert.equal(f.updater.getState().phase, "ready");
    assert.equal(f.updater.quitAndInstall(), true);
    assert.equal(f.updater.quitAndInstall(), false);
    assert.equal(f.installs(), 1);
  });

  it("closes synchronous native feed and download refusals", async () => {
    for (const native of [
      { setFeedURL: () => { throw new Error("feed refused"); } },
      { checkForUpdates: () => { throw new Error("download refused"); } },
    ]) {
      const f = fixture({ native });
      await f.updater.check();
      const state = f.updater.getState();
      assert.equal(state.phase === "failed" && state.reason, "download-failed");
      f.updater.updateDownloaded();
      assert.equal(f.updater.getState().phase, "failed");
    }
  });

  it("does not start a download after a synchronous native event closes it", async () => {
    for (const event of ["failed", "ready"] as const) {
      const native: { setFeedURL?: (url: string) => void } = {};
      const f = fixture({ native });
      native.setFeedURL = () => {
        if (event === "failed") f.updater.updateFailed();
        else f.updater.updateDownloaded();
      };
      await f.updater.check();
      assert.equal(f.updater.getState().phase, event);
      assert.equal(f.nativeChecks(), 0);
    }
  });

  it("reports a refused terminal install once", async () => {
    const f = fixture({
      native: { quitAndInstall: () => { throw new Error("install refused"); } },
    });
    await f.updater.check();
    f.updater.updateDownloaded();
    assert.equal(f.updater.quitAndInstall(), false);
    assert.equal(f.updater.quitAndInstall(), false);
    assert.equal(f.installs(), 1);
  });

  it("coalesces concurrent checks into one static request", async () => {
    let resolve!: (value: Response) => void;
    const pending = new Promise<Response>((done) => {
      resolve = done;
    });
    let requests = 0;
    const f = fixture({
      fetch: async () => {
        requests += 1;
        return pending;
      },
    });
    const first = f.updater.check();
    const second = f.updater.check();
    resolve(response(manifest("1.0.1")));
    await Promise.all([first, second]);
    assert.equal(requests, 1);
    assert.equal(f.nativeChecks(), 1);
  });

  it("offers only stable releases from the feed", async () => {
    for (const [version, offered] of [
      ["1.1.0-alpha.1", false],
      ["1.1.0-beta.1", false],
      ["1.1.0-rc.1", false],
      ["1.1.0", true],
    ] as const) {
      const f = fixture({ fetch: async () => response(manifest(version)) });
      await f.updater.check();
      const state = f.updater.getState();
      if (offered) {
        assert.equal(state.phase === "downloading" && state.latestVersion, version);
      } else {
        assert.equal(state.phase === "failed" && state.reason, "feed-invalid");
        assert.equal(f.nativeChecks(), 0);
      }
    }
  });

  it("returns from a newer prerelease to an older Stable only by manual install", async () => {
    const f = fixture({
      currentVersion: "1.1.0-beta.1",
      fetch: async () => response(manifest("1.0.1")),
    });
    await f.updater.check();
    assert.deepEqual(f.updater.getState(), {
      phase: "manual-stable-return",
      currentVersion: "1.1.0-beta.1",
      checkedAt: "1970-01-01T00:00:01.234Z",
      stableVersion: "1.0.1",
    });
    assert.equal(f.nativeChecks(), 0);
  });

  it("reports the feed version when already current", async () => {
    const f = fixture({
      currentVersion: "1.0.1",
      fetch: async () => response(manifest("1.0.1")),
    });
    await f.updater.check();
    assert.deepEqual(f.updater.getState(), {
      phase: "up-to-date",
      currentVersion: "1.0.1",
      latestVersion: "1.0.1",
      checkedAt: "1970-01-01T00:00:01.234Z",
    });
  });

  it("fails closed for malformed or retargeted channel documents", async () => {
    for (const body of [
      { ...manifest("1.0.1"), extra: true },
      { ...manifest("1.0.1"), tag: "v1.9.0" },
      { ...manifest("1.0.1"), url: "https://attacker.invalid/app.zip" },
      { ...manifest("1.0.1"), pub_date: "yesterday" },
    ]) {
      const f = fixture({ fetch: async () => response(body) });
      await f.updater.check();
      const state = f.updater.getState();
      assert.equal(state.phase === "failed" && state.reason, "feed-invalid");
      assert.equal(f.nativeChecks(), 0);
    }
  });

  it("never presents transport or parse failure as up to date", async () => {
    const cases: Array<{ fetch: typeof fetch; reason: AppUpdateErrorCode }> = [
      { fetch: async () => { throw new Error("offline"); }, reason: "offline" },
      { fetch: async () => new Response("not json", { status: 200 }), reason: "unreadable" },
      { fetch: async () => response({}, 500), reason: "server" },
      { fetch: async () => response({}, 429), reason: "rate-limited" },
      {
        fetch: async () => response({}, 403, { "x-ratelimit-remaining": "0" }),
        reason: "rate-limited",
      },
    ];
    for (const testCase of cases) {
      const f = fixture({ fetch: testCase.fetch });
      await f.updater.check();
      const state = f.updater.getState();
      assert.equal(state.phase === "failed" && state.reason, testCase.reason);
      assert.notEqual(state.phase, "up-to-date");
    }
  });

  it("records and times out the static feed request", async () => {
    const f = fixture({
      timeoutMs: 1,
      fetch: async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      }),
    });
    await f.updater.check();
    assert.deepEqual(f.failures, ["timeout"]);
    const state = f.updater.getState();
    assert.equal(state.phase === "failed" && state.reason, "timeout");
  });

  it("does not duplicate work while downloading or ready", async () => {
    const f = fixture();
    await f.updater.check();
    await f.updater.check();
    f.updater.updateDownloaded();
    await f.updater.check();
    assert.equal(f.nativeChecks(), 1);
  });

  it("treats Squirrel refusing a prevalidated upgrade as a feed failure", async () => {
    const f = fixture();
    await f.updater.check();
    f.updater.updateNotAvailable();
    const state = f.updater.getState();
    assert.equal(state.phase === "failed" && state.reason, "feed-invalid");
  });
});

describe("automatic check policy", () => {
  const stale = (overrides: Partial<Parameters<typeof periodicCheckDue>[0]> = {}) => ({
    capable: true,
    autoCheckUpdates: true,
    activeSockets: 0,
    lastUpdateCheckAt: 0,
    now: PERIODIC_CHECK_DUE_MS,
    ...overrides,
  });

  it("refuses incapable, opted-out, and active-game checks", () => {
    assert.equal(periodicCheckDue(stale({ capable: false })), false);
    assert.equal(periodicCheckDue(stale({ autoCheckUpdates: false })), false);
    assert.equal(periodicCheckDue(stale({ activeSockets: 1 })), false);
  });

  it("checks a fresh profile and honors the persisted six-hour boundary", () => {
    assert.equal(periodicCheckDue(stale({ lastUpdateCheckAt: null })), true);
    assert.equal(periodicCheckDue(stale({ now: PERIODIC_CHECK_DUE_MS - 1 })), false);
    assert.equal(periodicCheckDue(stale({ now: PERIODIC_CHECK_DUE_MS })), true);
  });

  it("recovers from a clock moved backwards instead of waiting indefinitely", () => {
    assert.equal(periodicCheckDue(
      stale({ lastUpdateCheckAt: PERIODIC_CHECK_DUE_MS * 2, now: 0 }),
    ), true);
    assert.equal(periodicCheckDue(stale({ lastUpdateCheckAt: 1, now: 0 })), false);
  });

  it("keeps 30-minute ticks inside the six-hour due window", () => {
    assert.equal(PERIODIC_CHECK_TICK_MS, 30 * 60 * 1000);
    assert.equal(PERIODIC_CHECK_DUE_MS, 6 * 60 * 60 * 1000);
    assert.ok(PERIODIC_CHECK_TICK_MS < PERIODIC_CHECK_DUE_MS);
  });
});
