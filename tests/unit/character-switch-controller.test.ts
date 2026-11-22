import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCharacterSwitchController } from "../../app/features/character-switch/renderer/character-switch-controller.js";
import type { CompanionCharacterListState } from "../../app/renderer/companion-character-list-snapshot.js";

const ready = (sequence: number, selectedIndex: number): CompanionCharacterListState =>
  Object.freeze({
    status: "ready",
    sequence,
    selectedIndex,
    characters: Object.freeze([
      Object.freeze({ name: "Private Alpha", characterKey: "0000000000000001", primaryProfession: 1, secondaryProfession: 0, characterType: "roleplaying", campaign: 1, level: 20, mapId: 55 }),
      Object.freeze({ name: "Private Beta", characterKey: "0000000000000002", primaryProfession: 2, secondaryProfession: 3, characterType: "roleplaying", campaign: 2, level: 20, mapId: 55 }),
    ]),
  });

function withBrowserGlobals(run: () => Promise<void>): Promise<void> {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const events = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: events,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      visibilityState: "visible",
      hasFocus: () => true,
    }),
  });
  return run().finally(() => {
    if (previousWindow) Object.defineProperty(globalThis, "window", previousWindow);
    else Reflect.deleteProperty(globalThis, "window");
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else Reflect.deleteProperty(globalThis, "document");
  });
}

type Options = Parameters<typeof createCharacterSwitchController>[0];
const PAYLOAD = 64;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** A source that reads its list on every access, like the live one. */
const listOf = (read: () => CompanionCharacterListState): CharacterListSource => ({
  get state() { return read(); },
  subscribe: () => () => false,
  dispose() {},
});

/** A controller on idle defaults; each test overrides only what it exercises. */
function build(
  overrides: Partial<Omit<Options, "controls">> & {
    controls?: Partial<Options["controls"]>;
  } = {},
) {
  const { controls, ...rest } = overrides;
  return createCharacterSwitchController({
    memory: new WebAssembly.Memory({ initial: 1 }),
    payloadPointer: PAYLOAD,
    configure: () => 1,
    selectorSlot: () => -1,
    enqueue: () => 1,
    characters: listOf(() => ready(2, 0)),
    controls: {
      state: () => "unknown",
      switchContext: () => "outpost",
      diagnosticMask: () => 0,
      ...controls,
    },
    buildId: 7,
    programId: 1,
    ...rest,
  });
}

/** Writes the native result code the way the game does after each queued action. */
const setResult = (memory: WebAssembly.Memory, code: number) =>
  new DataView(memory.buffer).setUint32(PAYLOAD + 20, code, true);

describe("character switch controller", { concurrency: false }, () => {
  it("sends each consequential action once and confirms only the final identity", async () => {
    await withBrowserGlobals(async () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const calls: number[] = [];
      let list = ready(2, 0);
      let preGame: PreGameState = "unknown";
      const controller = build({
        memory,
        enqueue(action) {
          calls.push(action);
          setResult(memory, 1);
          if (action === 1) { preGame = "character-select"; list = ready(4, 0); }
          if (action === 2) list = ready(6, 1);
          return 1;
        },
        characters: listOf(() => list),
        controls: { state: () => preGame },
      });

      controller.request("0000000000000002");
      await sleep(1_000);
      assert.equal(controller.action.status, "complete");
      assert.deepEqual(calls, [1, 2, 3]);
      const diagnostics = JSON.stringify(controller.diagnostics());
      assert.equal(diagnostics.includes("Private Alpha"), false);
      assert.equal(diagnostics.includes("Private Beta"), false);
      assert.match(diagnostics, /"logout":1/);
      controller.dispose();
    });
  });

  for (const [label, afterLogout, expected] of [
    [
      "accepts a character created in game when Selector reloads the list",
      "created",
      { status: "complete", calls: [1, 2, 3] },
    ],
    [
      "stops before selection when Selector loads a different account",
      "foreign",
      { status: "failed", calls: [1] },
    ],
  ] as const) {
    it(label, async () => {
      await withBrowserGlobals(async () => {
        const memory = new WebAssembly.Memory({ initial: 1 });
        const calls: number[] = [];
        const reloaded = (sequence: number, selectedIndex: number): CompanionCharacterListState => {
          const base = ready(sequence, selectedIndex);
          if (base.status !== "ready") throw new Error("expected a ready list");
          const extra = Object.freeze({
            ...base.characters[0]!,
            name: "Private Gamma",
            characterKey: "0000000000000003",
          });
          return Object.freeze({
            ...base,
            characters: Object.freeze(afterLogout === "created"
              ? [...base.characters, extra]
              : [extra, Object.freeze({ ...base.characters[1]!, characterKey: "0000000000000004" })]),
          });
        };
        // The in-game list predates the new character; only logout reloads it.
        let list = ready(2, 0);
        let preGame: PreGameState = "unknown";
        const controller = build({
          memory,
          enqueue(action) {
            calls.push(action);
            setResult(memory, 1);
            if (action === 1) { preGame = "character-select"; list = reloaded(4, 0); }
            if (action === 2) list = reloaded(6, 1);
            return 1;
          },
          characters: listOf(() => list),
          controls: { state: () => preGame },
        });

        controller.request("0000000000000002");
        await sleep(1_000);
        assert.equal(controller.action.status, expected.status);
        if (controller.action.status === "failed") {
          assert.equal(controller.action.code, "target-missing");
        }
        assert.deepEqual(calls, expected.calls);
        controller.dispose();
      });
    });
  }

  it("enters the last entered character from the selector without a logout", async () => {
    await withBrowserGlobals(async () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const calls: number[] = [];
      let context: CharacterSwitchContext = "character-select";
      const controller = build({
        memory,
        enqueue(action) {
          calls.push(action);
          setResult(memory, 1);
          if (action === 3) context = "outpost";
          return 1;
        },
        characters: listOf(() => ready(7, 0)),
        controls: { state: () => "character-select", switchContext: () => context },
      });

      // Index 0 is the last entered character. At the selector it is not
      // current, so selecting it must enter it rather than refuse.
      controller.request("0000000000000001");
      await sleep(500);
      assert.equal(controller.action.status, "complete");
      assert.deepEqual(calls, [2, 3]);
      const diagnostics = controller.diagnostics();
      if (diagnostics.version !== 7) throw new Error("expected live diagnostics");
      assert.deepEqual(diagnostics.counters, { logout: 0, select: 1, play: 1 });
      controller.dispose();
    });
  });

  it("presents characters in the selector carousel order for the session", async () => {
    await withBrowserGlobals(async () => {
      const three = (selectedIndex: number): CompanionCharacterListState => {
        const base = ready(20, selectedIndex);
        if (base.status !== "ready") throw new Error("expected a ready list");
        return Object.freeze({
          ...base,
          characters: Object.freeze([
            ...base.characters,
            Object.freeze({ ...base.characters[0]!, name: "Private Gamma", characterKey: "0000000000000003" }),
          ]),
        });
      };
      let list = three(1);
      let preGame: PreGameState = "character-select";
      // Carousel: Gamma, Alpha, Beta. Account array: Alpha, Beta, Gamma.
      let slots = [1, 2, 0];
      const controller = build({
        selectorSlot: (index) => preGame === "character-select" ? slots[index] ?? -1 : -1,
        characters: listOf(() => list),
        controls: {
          state: () => preGame,
          switchContext: () => preGame === "character-select" ? "character-select" : "outpost",
        },
      });
      const names = () => {
        const state = controller.characters;
        if (state.status !== "ready") throw new Error("expected a ready list");
        return { names: state.characters.map(({ name }) => name), selectedIndex: state.selectedIndex };
      };

      assert.deepEqual(names(), {
        names: ["Private Gamma", "Private Alpha", "Private Beta"],
        selectedIndex: 2,
      });
      // In game, Selector is gone; the session keeps the last carousel order.
      preGame = "unknown";
      list = three(0);
      assert.deepEqual(names(), {
        names: ["Private Gamma", "Private Alpha", "Private Beta"],
        selectedIndex: 1,
      });
      // Changing the selector sort is followed within one poll, without a list change.
      preGame = "character-select";
      slots = [0, 1, 2];
      let notified = 0;
      const unsubscribe = controller.subscribe(() => { notified += 1; });
      notified = 0;
      await sleep(600);
      assert.equal(notified, 1);
      assert.deepEqual(names().names, ["Private Alpha", "Private Beta", "Private Gamma"]);
      unsubscribe();
      controller.dispose();
    });
  });

  it("probes for Selector once per two seconds while it is absent", async () => {
    await withBrowserGlobals(async () => {
      let probes = 0;
      const controller = build({
        selectorSlot: () => { probes += 1; return -1; },
        controls: {
          state: () => { throw new Error("order sampling must not read the pre-game state"); },
        },
      });
      await sleep(2_300);
      // One probe at start and one after two seconds; each stops at the first -1.
      assert.equal(probes, 2);
      controller.dispose();
    });
  });

  it("resolves stable keys and refuses missing or current targets before a native action", async () => {
    await withBrowserGlobals(async () => {
      let calls = 0;
      let stateReads = 0;
      const controller = build({
        enqueue: () => { calls += 1; return 1; },
        characters: listOf(() => ready(8, 0)),
        controls: { state: () => { stateReads += 1; return "unknown"; } },
      });
      controller.request("00000000000000ff");
      assert.deepEqual(controller.action, { status: "failed", code: "target-missing", retryable: true });
      controller.reset();
      controller.request("0000000000000001");
      assert.deepEqual(controller.action, { status: "failed", code: "current-target", retryable: false });
      assert.equal(calls, 0);
      const readsBeforeDiagnostics = stateReads;
      assert.equal(controller.diagnostics().version, 7);
      assert.equal(stateReads, readsBeforeDiagnostics, "diagnostics must not trigger a frame scan");
      controller.dispose();
    });
  });

  it("keeps an immediate native logout refusal distinct from a timeout", async () => {
    await withBrowserGlobals(async () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      const controller = build({
        memory,
        enqueue: () => {
          setResult(memory, 2);
          new DataView(memory.buffer).setUint32(PAYLOAD + 36, 0xff, true);
          return 1;
        },
        characters: listOf(() => ready(10, 0)),
      });
      controller.request("0000000000000002");
      await sleep(40);
      assert.deepEqual(controller.action, {
        status: "failed",
        code: "logout-refused",
        retryable: false,
      });
      const diagnostics = controller.diagnostics();
      assert.equal(diagnostics.version, 7);
      if (diagnostics.version !== 7) throw new Error("expected live diagnostics");
      assert.equal(diagnostics.lastCode, "logout-refused");
      assert.equal(diagnostics.lastFrameProofMask, 0xff);
      controller.reset();
      assert.deepEqual(controller.action, { status: "idle" });
      const resetDiagnostics = controller.diagnostics();
      assert.equal(resetDiagnostics.version, 7);
      if (resetDiagnostics.version !== 7) throw new Error("expected live diagnostics");
      assert.equal(resetDiagnostics.lastCode, "logout-refused");
      controller.dispose();
    });
  });

  it("reports queue refusal synchronously so the palette can stay open", async () => {
    await withBrowserGlobals(async () => {
      const controller = build({
        enqueue: () => 0,
        characters: listOf(() => ready(11, 0)),
      });

      controller.request("0000000000000002");
      assert.deepEqual(controller.action, {
        status: "failed",
        code: "logout-refused",
        retryable: false,
      });
      controller.dispose();
    });
  });

  it("waits through proved pre-click Selector readiness without retrying later ambiguity", async () => {
    await withBrowserGlobals(async () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      let list = ready(12, 0);
      let selectAttempt = 0;
      const calls: number[] = [];
      const controller = build({
        memory,
        enqueue(action) {
          calls.push(action);
          if (action === 1) {
            list = ready(13, 0);
            setResult(memory, 1);
          } else if (action === 2) {
            selectAttempt += 1;
            setResult(memory, selectAttempt === 1 ? 5 : 7);
          }
          return 1;
        },
        characters: listOf(() => list),
        controls: { state: () => "character-select" },
      });

      controller.request("0000000000000002");
      await sleep(180);
      assert.deepEqual(calls, [1, 2, 2]);
      assert.deepEqual(controller.action, { status: "failed", code: "selection-not-confirmed", retryable: false });
      const diagnostics = controller.diagnostics();
      if (diagnostics.version !== 7) throw new Error("expected live diagnostics");
      assert.equal(diagnostics.selectorReadinessRetries, 1);
      assert.equal(diagnostics.lastSelectorReadiness, null);
      assert.equal(diagnostics.selectorClickProved, false);
      controller.dispose();
    });
  });

  it("never retries a readiness code after the proof says a click was sent", async () => {
    await withBrowserGlobals(async () => {
      const memory = new WebAssembly.Memory({ initial: 1 });
      let list = ready(20, 0);
      const calls: number[] = [];
      const controller = build({
        memory,
        enqueue(action) {
          calls.push(action);
          if (action === 1) {
            list = ready(21, 0);
            setResult(memory, 1);
          } else {
            new DataView(memory.buffer).setUint32(PAYLOAD + 36, 1 << 10, true);
            setResult(memory, 4);
          }
          return 1;
        },
        characters: listOf(() => list),
        controls: { state: () => "character-select" },
      });

      controller.request("0000000000000002");
      await sleep(60);
      assert.deepEqual(calls, [1, 2]);
      assert.deepEqual(controller.action, { status: "failed", code: "selection-not-confirmed", retryable: false });
      const diagnostics = controller.diagnostics();
      if (diagnostics.version !== 7) throw new Error("expected live diagnostics");
      assert.equal(diagnostics.selectorClickProved, true);
      controller.dispose();
    });
  });

  it("requires PvE confirmation and rechecks context before native logout", async () => {
    await withBrowserGlobals(async () => {
      const create = (contexts: CharacterSwitchContext[]) => {
        const memory = new WebAssembly.Memory({ initial: 1 });
        let calls = 0;
        let reads = 0;
        const controller = build({
          memory,
          enqueue: () => {
            calls += 1;
            setResult(memory, 2);
            return 1;
          },
          characters: listOf(() => ready(30, 0)),
          controls: {
            switchContext: () => contexts[Math.min(reads++, contexts.length - 1)]!,
          },
        });
        return { controller, calls: () => calls };
      };

      const unconfirmed = create(["pve-explorable"]);
      unconfirmed.controller.request("0000000000000002");
      assert.deepEqual(unconfirmed.controller.action, { status: "confirming" });
      assert.equal(unconfirmed.calls(), 0);
      unconfirmed.controller.cancelConfirmation();
      assert.deepEqual(unconfirmed.controller.action, { status: "idle" });
      unconfirmed.controller.dispose();

      const confirmed = create(["pve-explorable"]);
      confirmed.controller.request("0000000000000002");
      confirmed.controller.confirm();
      await sleep(30);
      assert.equal(confirmed.calls(), 1);
      assert.deepEqual(confirmed.controller.action, { status: "failed", code: "logout-refused", retryable: false });
      confirmed.controller.dispose();

      const raced = create(["pve-explorable", "pvp-explorable"]);
      raced.controller.request("0000000000000002");
      raced.controller.confirm();
      assert.deepEqual(raced.controller.action, { status: "failed", code: "active-pvp", retryable: false });
      assert.equal(raced.calls(), 0);
      raced.controller.dispose();
    });
  });

  it("blocks PvP and loading before any native action", async () => {
    await withBrowserGlobals(async () => {
      for (const [context, code] of [
        ["pvp-explorable", "active-pvp"],
        ["loading", "game-loading"],
      ] as const) {
        let calls = 0;
        const controller = build({
          enqueue: () => { calls += 1; return 1; },
          characters: listOf(() => ready(40, 0)),
          controls: { switchContext: () => context },
        });
        controller.request("0000000000000002");
        assert.deepEqual(controller.action, {
          status: "failed",
          code,
          retryable: context === "loading",
        });
        assert.equal(calls, 0);
        controller.dispose();
      }
    });
  });
});
