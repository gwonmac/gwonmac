import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bindMemoryWarning } from "../../app/renderer/memory-warning.js";

class FakeClassList {
  readonly values = new Set<string>();
  toggle(name: string, force?: boolean): boolean {
    const enabled = force ?? !this.values.has(name);
    if (enabled) this.values.add(name);
    else this.values.delete(name);
    return enabled;
  }
}

class FakeElement {
  hidden = false;
  open = false;
  textContent = "";
  readonly classList = new FakeClassList();
  readonly attributes = new Map<string, string>();
  readonly listeners = new Map<string, Array<() => void>>();
  focused = false;
  checked = false;
  disabled = false;
  addEventListener(name: string, listener: () => void): void {
    const listeners = this.listeners.get(name) ?? [];
    listeners.push(listener);
    this.listeners.set(name, listeners);
  }
  click(): void {
    for (const listener of this.listeners.get("click") ?? []) listener();
  }
  change(): void {
    for (const listener of this.listeners.get("change") ?? []) listener();
  }
  focus(): void { this.focused = true; }
  setAttribute(name: string, value: string): void { this.attributes.set(name, value); }
}

function memoryDom(complete = true) {
  const ids = [
    "memory-notice",
    "memory-notice-text",
    "memory-notice-label",
    "memory-notice-detail",
    "memory-notice-explanation",
    "memory-notice-details",
    "memory-notice-reload",
    "memory-notice-later",
    "memory-notice-auto-relog",
    "memory-notice-quit",
    "memory-notice-usage",
    "memory-notice-usage-text",
    "memory-notice-meter",
    "canvas",
  ];
  const elements = new Map(ids.map((id) => [id, new FakeElement()]));
  if (!complete) elements.delete("memory-notice-label");
  return {
    document: {
      getElementById: (id: string) => elements.get(id) ?? null,
    } as unknown as Document,
    element: (id: string) => elements.get(id)!,
  };
}

const warningActions = (
  autoRelogAfterReload = false,
  reload: () => void | Promise<void> = () => {},
) => ({
  position: null,
  async savePosition() {},
  autoRelogAfterReload,
  async saveAutoRelog() {},
  reload,
});

describe("memory warning presenter", () => {
  it("does nothing when the single warning surface is incomplete", () => {
    assert.equal(
      bindMemoryWarning(memoryDom(false).document, warningActions()),
      null,
    );
  });

  it("keeps Low dismissed until Critical reopens the same notice", () => {
    const dom = memoryDom();
    const presenter = bindMemoryWarning(dom.document, warningActions());
    assert.ok(presenter);
    presenter.present("low", 2_147_483_648);
    assert.equal(dom.element("memory-notice").hidden, false);
    assert.match(dom.element("memory-notice-explanation").textContent, /2 GB/);
    dom.element("memory-notice-details").open = true;
    dom.element("memory-notice-later").click();
    assert.equal(dom.element("memory-notice").hidden, true);
    assert.equal(dom.element("memory-notice-details").open, false);
    assert.equal(dom.element("canvas").focused, true);
    presenter.present("low", 2_147_483_648);
    assert.equal(dom.element("memory-notice").hidden, true);
    presenter.present("critical", 2_147_483_648);
    assert.equal(dom.element("memory-notice").hidden, false);
    assert.equal(dom.element("memory-notice-text").attributes.get("aria-live"), "assertive");
  });

  it("opens for Command-Q with the memory figure, Quit and Close, whatever was dismissed", async () => {
    const dom = memoryDom();
    let quits = 0;
    const presenter = bindMemoryWarning(dom.document, { ...warningActions(), quit: () => { quits += 1; } });
    assert.ok(presenter);
    // No memory sample yet: main's native dialog answers instead.
    dom.element("memory-notice").hidden = true;
    assert.equal(presenter.open(), false);
    assert.equal(dom.element("memory-notice").hidden, true);

    presenter.update(1_503_238_553, 2_147_483_648);
    assert.equal(presenter.open(), true);
    assert.equal(dom.element("memory-notice").hidden, false);
    assert.equal(dom.element("memory-notice-label").textContent, "Quit or reload Guild Wars?");
    assert.equal(dom.element("memory-notice-usage-text").textContent, "1.4 of 2 GB used");
    assert.equal(dom.element("memory-notice-usage").hidden, false);
    assert.equal(dom.element("memory-notice-later").textContent, "Close");
    assert.equal(dom.element("memory-notice-quit").hidden, false);
    assert.equal(dom.element("memory-notice-later").focused, true);
    assert.equal(dom.element("memory-notice-reload").focused, false);

    // A dismissed warning stays dismissed for the heap watch, and still opens when asked.
    presenter.present("low", 2_147_483_648);
    dom.element("memory-notice-later").click();
    presenter.present("low", 2_147_483_648);
    assert.equal(dom.element("memory-notice").hidden, true);
    assert.equal(presenter.open(), true);
    assert.equal(dom.element("memory-notice-label").textContent, "Guild Wars is running low on memory.");

    dom.element("memory-notice-quit").click();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(quits, 1);
    assert.equal(dom.element("memory-notice").hidden, true);
  });

  it("offers no Quit when the host gave it none", () => {
    const dom = memoryDom();
    dom.element("memory-notice-quit").hidden = true;
    assert.ok(bindMemoryWarning(dom.document, warningActions()));
    assert.equal(dom.element("memory-notice-quit").hidden, true);
  });

  it("reloads without adding another warning state", async () => {
    const dom = memoryDom();
    let reloads = 0;
    const presenter = bindMemoryWarning(
      dom.document,
      warningActions(true, () => { reloads += 1; }),
    );
    assert.ok(presenter);
    presenter.present("critical", 2_147_483_648);
    dom.element("memory-notice-reload").click();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(reloads, 1);
    assert.equal(dom.element("memory-notice").hidden, true);
  });

  it("shares and saves the automatic-return preference", async () => {
    const dom = memoryDom();
    const saved: boolean[] = [];
    let reloads = 0;
    const presenter = bindMemoryWarning(
      dom.document,
      {
        position: null,
        async savePosition() {},
        autoRelogAfterReload: false,
        async saveAutoRelog(enabled) { saved.push(enabled); },
        reload() { reloads += 1; },
      },
    );
    assert.ok(presenter);
    const checkbox = dom.element("memory-notice-auto-relog");
    checkbox.checked = true;
    checkbox.change();
    await Promise.resolve();
    assert.deepEqual(saved, [true]);
    presenter.setAutoRelog(true);
    assert.equal(dom.element("memory-notice-auto-relog").checked, true);
    presenter.present("low", 2_147_483_648);
    dom.element("memory-notice-reload").click();
    await Promise.resolve();
    await Promise.resolve();
    assert.deepEqual(saved, [true]);
    assert.equal(reloads, 1);
  });
});
