import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { LauncherNativeApi, LauncherSnapshot } from "@shared/launcher-contracts";
import { SETTINGS, SETTINGS_SECTIONS, type SettingsTarget } from "@shared/settings-catalogue";
import { SWITCH_FEATURES } from "@shared/feature-status";
import SettingsView from "./SettingsView.vue";
import { fixtureFacts, fixtureFeatureChecksFor, fixtureSnapshot } from "../fixtures";
import { CARTOGRAPHY_BUILTIN_PRESETS } from "@shared/cartography-overlay";
import { addCartographyPreset } from "@shared/cartography-presets";

const allTools: LauncherSnapshot["tools"] = { ...fixtureSnapshot.tools, configured: true, loaded: true, features: Object.fromEntries(Object.entries(fixtureSnapshot.tools.features).map(([tool, feature]) => [tool, { ...feature, enabled: true }])) as LauncherSnapshot["tools"]["features"] };
/** Every Feature on, on a client build the verifier proved. */
const allToolsOn: LauncherSnapshot = { ...fixtureSnapshot, tools: allTools, features: fixtureFacts(allTools, fixtureFeatureChecksFor("?checks=proved")) };

/** The simple launcher has no Features tab, so its Settings page lists Features. */
const simple = (snapshot: LauncherSnapshot): LauncherSnapshot => ({ ...snapshot, preferences: { ...snapshot.preferences, content: { ...snapshot.preferences.content, simple: true } } });
const hubSnapshot = (settings = fixtureSnapshot.settings) => {
  const { tools, shortcuts, features } = fixtureSnapshot;
  return { settings, tools, shortcuts, features, appVersion: fixtureSnapshot.appUpdate.currentVersion };
};

/** Mounts the page as the launcher does; it opens on Appearance unless `target` names another place. */
function mountView(overrides: Record<string, unknown> = {}, { snapshot = fixtureSnapshot, target = { section: "appearance" } as SettingsTarget | null, attach = false } = {}) {
  const native = { ...overrides } as unknown as LauncherNativeApi;
  return mount(SettingsView, { props: { snapshot: { ...snapshot, appVersion: snapshot.appUpdate.currentVersion }, native, launcher: { snapshot, native }, target }, ...(attach ? { attachTo: document.body } : {}) });
}

async function openSection(wrapper: ReturnType<typeof mount>, label: string) {
  await wrapper.findAll(".settings-page nav button").find(button => button.text() === label)!.trigger("click");
  await flushPromises();
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Settings page", () => {
  it("renders exactly one control, with the same label, at the place every setting search can open", async () => {
    // The full launcher draws Home's choices; the simple one keeps Features in Settings.
    let wrapper = mountView({}, { snapshot: allToolsOn, target: null });
    await flushPromises();
    // Keyed by place and control: a search hit must land where its control is.
    const found = new Map<string, string[]>();
    const collect = async (target: SettingsTarget) => {
      await wrapper.setProps({ target });
      await flushPromises();
      for (const control of wrapper.findAll("[data-setting]")) {
        const key = `${target.feature ?? target.section} ${control.attributes("data-setting")!}`;
        // A Feature's switch is its page's Turn on button, named by the page heading.
        const heading = control.element.closest(".feature-head")?.querySelector("h1")?.textContent ?? "";
        const names = [control.element, ...control.element.querySelectorAll("[aria-label]")].map((element) => element.getAttribute("aria-label") ?? "").join(" ");
        found.set(key, [...found.get(key) ?? [], `${names} ${control.text()} ${heading}`]);
      }
    };
    for (const { id } of SETTINGS_SECTIONS) if (id !== "features") await collect({ section: id });
    wrapper.unmount();
    wrapper = mountView({}, { snapshot: simple(allToolsOn), target: null });
    await collect({ section: "features" });
    for (const { id } of SWITCH_FEATURES) await collect({ section: "features", feature: id });
    for (const entry of SETTINGS) {
      const key = `${entry.feature ?? entry.section} ${entry.id}`;
      expect(found.get(key), key).toHaveLength(1);
      expect(found.get(key)![0], key).toContain(entry.label);
    }
    wrapper.unmount();
  });

  it("says what Paste settings did: replaced, with what was left out, or why nothing changed", async () => {
    const paste = vi.fn()
      .mockResolvedValueOnce({ status: "applied", skipped: ["someFutureSwitch", "launcherContent.someFutureChoice"] })
      .mockResolvedValueOnce({ status: "refused", reason: "other-version" })
      .mockResolvedValueOnce({ status: "cancelled" });
    const wrapper = mountView({ settings: { paste } }, { target: { section: "advanced" } });
    await flushPromises();
    const pasteButton = wrapper.get('[data-setting="pasteSettings"] button');
    await pasteButton.trigger("click");
    await flushPromises();
    expect(wrapper.get('[role="status"].inline-message').text()).toBe("Settings replaced. 2 copied settings that this version does not use were left out.");
    await pasteButton.trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="status"].inline-message').exists()).toBe(false);
    expect(wrapper.get('[role="alert"]').text()).toContain("cannot read. Update both Macs");
    await pasteButton.trigger("click");
    await flushPromises();
    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    expect(wrapper.find('[role="status"].inline-message').exists()).toBe(false);
    wrapper.unmount();
  });

  it("finds a setting by its words and focuses its control", async () => {
    const wrapper = mountView({}, { attach: true });
    await flushPromises();
    await wrapper.get('input[type="search"]').setValue("relog");
    const result = wrapper.findAll(".settings-results button").find(button => button.text().includes("Return to character after reload"));
    expect(result).toBeDefined();
    await result!.trigger("click");
    await flushPromises();
    expect(wrapper.get(".settings-fields h1").text()).toBe("Game");
    const row = wrapper.get('[data-setting="autoRelogAfterReload"]');
    expect(row.classes()).toContain("setting-focus");
    expect(document.activeElement).toBe(row.get('input[type="checkbox"]').element);
    wrapper.unmount();
  });

  it("opens a Feature option on its Feature page, or in the Features tab when the launcher has one", async () => {
    const target: SettingsTarget = { section: "features", feature: "chatFilters", control: "chatFilterAllyDrops" };
    const wrapper = mountView({}, { snapshot: simple(allToolsOn), target, attach: true });
    await flushPromises();
    const row = wrapper.get('[data-setting="chatFilterAllyDrops"]');
    expect(wrapper.get(".feature-page h1").text()).toBe("Chat Filters");
    expect(row.classes()).toContain("setting-focus");
    expect(document.activeElement).toBe(row.get("input").element);
    wrapper.unmount();

    const tabs = mountView({}, { snapshot: allToolsOn, target });
    await flushPromises();
    expect(tabs.emitted("features")).toEqual([[target]]);
    tabs.unmount();
  });

  it("says what was saved and when it applies", async () => {
    const update = vi.fn(async () => undefined);
    const wrapper = mountView({ settings: { update } }, { target: { section: "game" } });
    await flushPromises();
    await wrapper.get('[data-setting="controllerPromptStyle"] select').setValue("playstation");
    await flushPromises();
    expect(update).toHaveBeenCalledWith({ controllerPromptStyle: "playstation" });
    expect(wrapper.get(".settings-status").text()).toBe("Saved: Controller symbols. Applies when you next open or reload a game window.");
    wrapper.unmount();
  });

  it("retains a refused save for an exact retry and locks conflicting edits", async () => {
    const update = vi.fn().mockRejectedValueOnce(new Error("disk")).mockResolvedValueOnce(undefined);
    const wrapper = mountView({ settings: { update } }, { target: { section: "updates" }, attach: true });
    await flushPromises();
    await wrapper.get('[data-setting="autoCheckUpdates"] input').setValue(false);
    await flushPromises();
    expect(wrapper.get('.settings-status [role="alert"]').text()).toBe("Automatically check for launcher updates could not be saved.");
    expect(wrapper.get('.settings-status [role="status"]').text()).toBe("");
    expect(document.activeElement).toBe(wrapper.findAll(".save-actions button")[0]!.element);
    expect(wrapper.get(".settings-fields").attributes("disabled")).toBeDefined();
    await wrapper.findAll(".save-actions button").find(button => button.text() === "Retry")!.trigger("click");
    await flushPromises();
    expect(update.mock.calls).toEqual([[{ autoCheckUpdates: false }], [{ autoCheckUpdates: false }]]);
    expect(wrapper.get(".settings-fields").attributes("disabled")).toBeUndefined();
    expect(wrapper.find('.settings-status [role="alert"]').exists()).toBe(false);
    // Retry removed itself: the keyboard goes back to the setting it saved.
    expect(document.activeElement).toBe(wrapper.get('[data-setting="autoCheckUpdates"] input').element);
    wrapper.unmount();
  });

  it("reverts unsaved native control state to the canonical snapshot", async () => {
    const update = vi.fn(async () => { throw new Error("disk"); });
    const wrapper = mountView({ settings: { update } }, { target: { section: "updates" } });
    await flushPromises();
    const original = fixtureSnapshot.settings.autoCheckUpdates;
    await wrapper.get('[data-setting="autoCheckUpdates"] input').setValue(!original);
    await flushPromises();
    await wrapper.findAll(".save-actions button").find(button => button.text() === "Revert")!.trigger("click");
    await flushPromises();
    expect(wrapper.get<HTMLInputElement>('[data-setting="autoCheckUpdates"] input').element.checked).toBe(original);
    expect(update).toHaveBeenCalledTimes(1);
    expect(wrapper.find('.settings-status [role="alert"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it("shows the Hub key in Game and each Feature's shortcut on its page", async () => {
    const wrapper = mountView({}, { snapshot: simple(fixtureSnapshot), target: { section: "game" } });
    await flushPromises();
    expect(wrapper.get('[data-setting="hub"]').text()).toContain("Built in");
    await wrapper.setProps({ target: { section: "features", feature: "buildLibrary" } });
    await flushPromises();
    expect(wrapper.get(".feature-settings").text()).toContain("⌘B");
    expect(wrapper.find(".settings-page aside").text()).not.toContain("Shortcuts");
  });

  it("saves each enabled Chat Filter category independently", async () => {
    const update = vi.fn(async () => undefined);
    const wrapper = mountView({ settings: { update } }, { snapshot: simple(allToolsOn), target: { section: "features", feature: "chatFilters" } });
    await flushPromises();
    await wrapper.get('[data-setting="chatFilterAllyDrops"] input').setValue(false);
    await flushPromises();
    expect(update).toHaveBeenCalledWith({ chatFilterAllyDrops: false });
  });

  it("plays the plain game with every Feature switch held, and turning it off loads Features", async () => {
    const setMasterEnabled = vi.fn(async () => undefined);
    const wrapper = mountView({ tools: { setMasterEnabled } }, { snapshot: simple(fixtureSnapshot), target: { section: "features" } });
    await flushPromises();
    const plain = wrapper.get<HTMLInputElement>('[data-setting="gwonmacTools"] input');
    expect(plain.element.checked).toBe(true);
    await plain.setValue(false);
    await flushPromises();
    expect(setMasterEnabled).toHaveBeenCalledWith(true);
    // Character Switch is a Feature: the plain game holds its switch like every other one.
    await wrapper.setProps({ target: { section: "features", feature: "characterSwitch" } });
    await flushPromises();
    expect(wrapper.get<HTMLButtonElement>('[data-setting="tool:character-switch"]').element.disabled).toBe(true);

    const features = mountView({ tools: { setMasterEnabled } }, { snapshot: simple(allToolsOn), target: { section: "features", feature: "characterSwitch" } });
    await flushPromises();
    expect(features.get<HTMLButtonElement>('[data-setting="tool:character-switch"]').element.disabled).toBe(false);
    await features.setProps({ target: { section: "features" } });
    await flushPromises();
    expect(features.get<HTMLInputElement>('[data-setting="gwonmacTools"] input').element.checked).toBe(false);
    await features.get<HTMLInputElement>('[data-setting="gwonmacTools"] input').setValue(true);
    await flushPromises();
    expect(setMasterEnabled).toHaveBeenLastCalledWith(false);
  });

  it("asks before replacing another Feature shortcut", async () => {
    const replaceShortcut = vi.fn(async () => undefined);
    const wrapper = mountView({
      tools: {
        captureShortcut: async () => ({ status: "conflict" as const, action: "travel.open" as const, binding: { key: "t", shift: false, option: false } }),
        replaceShortcut,
      },
    }, { snapshot: simple(allToolsOn), target: { section: "features", feature: "characterSwitch" } });
    await flushPromises();
    await wrapper.get('button[aria-label="Change Switch Character shortcut"]').trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Already used by Travel");
    await wrapper.get(".shortcut-actions .primary").trigger("click");
    expect(replaceShortcut).toHaveBeenCalledWith({ action: "character.switch", binding: { key: "t", shift: false, option: false } });
  });

  it("in the Hub, keeps the launcher's sections listed and opens the launcher for them", async () => {
    const openInLauncher = vi.fn();
    const wrapper = mount(SettingsView, { props: { snapshot: hubSnapshot(), native: undefined, openInLauncher, target: { section: "updates", control: "autoCheckUpdates" } } });
    await flushPromises();
    expect(openInLauncher).toHaveBeenCalledWith({ section: "updates", control: "autoCheckUpdates" });
    await openSection(wrapper, "Game files");
    expect(openInLauncher).toHaveBeenLastCalledWith({ section: "game-files" });
    expect(wrapper.get(".settings-fields h1").text()).toBe("Features");
    await openSection(wrapper, "Appearance");
    expect(wrapper.get(".settings-fields h1").text()).toBe("Appearance");
  });

  it("in the Hub, opens a Settings dialog inside the page, where the launcher tokens apply", async () => {
    // The game document carries no launcher tokens or modal styles on <body>.
    const library = addCartographyPreset(fixtureSnapshot.settings.cartographyPresetLibrary, { id: "test-style", name: "My map", style: CARTOGRAPHY_BUILTIN_PRESETS.cartographer.style })!;
    const settings = { ...fixtureSnapshot.settings, cartographyPresetLibrary: library };
    const wrapper = mount(SettingsView, { props: { snapshot: hubSnapshot(settings), native: undefined, openInLauncher: vi.fn(), target: { section: "features", feature: "cartography" } } });
    await flushPromises();
    await wrapper.findAll("button").find(button => button.text() === "Delete custom style")!.trigger("click");
    await flushPromises();
    expect(wrapper.element.querySelector(".settings-view [role='dialog']")?.textContent).toContain("Delete My map?");
    wrapper.unmount();
  });

  it("loads real cache information when Game Files opens", async () => {
    const info = vi.fn(async () => ({ bytes: 1024 ** 3, chunks: 10, totalBytes: 2 * 1024 ** 3, totalChunks: 20, freeBytes: 3 * 1024 ** 3, fullDownloadShortfall: 0 }));
    const wrapper = mountView({ gameFiles: { info } });
    await flushPromises();
    await openSection(wrapper, "Game files");
    expect(info).toHaveBeenCalledOnce();
    expect(wrapper.text()).toContain("1.0 GB of 2.0 GB verified");
  });

  it("on a narrow page, swaps the section tabs for search, and Escape or Cancel brings them back", async () => {
    // The narrow page hides the field behind a button. A close that kept the
    // query would leave results under the tabs; one that dropped focus would
    // strand a keyboard player.
    const wrapper = mountView({}, { attach: true });
    await flushPromises();
    const aside = wrapper.get(".settings-page aside");
    const toggle = wrapper.get('button[aria-label="Search settings"]');
    for (const close of [
      () => wrapper.get('input[type="search"]').trigger("keydown", { key: "Escape" }),
      () => wrapper.findAll("aside button").find(button => button.text() === "Cancel")!.trigger("click"),
    ]) {
      await toggle.trigger("click");
      await flushPromises();
      expect(aside.classes()).toContain("search-open");
      expect(document.activeElement).toBe(wrapper.get('input[type="search"]').element);
      await wrapper.get('input[type="search"]').setValue("relog");
      expect(wrapper.get(".settings-content h1").text()).toBe("Results");
      await close();
      await flushPromises();
      expect(aside.classes()).not.toContain("search-open");
      expect(wrapper.get(".settings-content h1").text()).toBe("Appearance");
      expect(document.activeElement).toBe(toggle.element);
    }
    // Choosing a result goes to its section: the tabs come back to show where it landed.
    await toggle.trigger("click");
    await wrapper.get('input[type="search"]').setValue("relog");
    await wrapper.findAll(".settings-results button").find(button => button.text().includes("Return to character after reload"))!.trigger("click");
    await flushPromises();
    expect(aside.classes()).not.toContain("search-open");
    expect(wrapper.get(".settings-content h1").text()).not.toBe("Results");
    wrapper.unmount();
  });

  it("keeps the keyboard on a clicked section button, moves with the arrow keys without wrapping, and forgets the saved note", async () => {
    const update = vi.fn(async () => undefined);
    const wrapper = mountView({ settings: { update } }, { target: { section: "game" }, attach: true });
    await flushPromises();
    await wrapper.get('[data-setting="autoRelogAfterReload"] input').setValue(true);
    await flushPromises();
    expect(wrapper.get(".settings-status").text()).toContain("Saved:");
    const nav = wrapper.get('nav[aria-label="Settings sections"]');
    const button = (label: string) => nav.findAll("button").find(candidate => candidate.text() === label)!;
    button("Texture packs").element.focus();
    await button("Texture packs").trigger("click");
    await flushPromises();
    expect(wrapper.get(".settings-fields h1").text()).toBe("Texture packs");
    expect(document.activeElement).toBe(button("Texture packs").element);
    expect(wrapper.get(".settings-status").text()).not.toContain("Saved:");
    await button("Texture packs").trigger("keydown", { key: "ArrowUp" });
    await flushPromises();
    expect(wrapper.get(".settings-fields h1").text()).toBe("Game");
    await button("Game").trigger("keydown", { key: "ArrowUp" });
    await flushPromises();
    expect(document.activeElement).toBe(button("Appearance").element);
    await button("Appearance").trigger("keydown", { key: "ArrowUp" });
    expect(document.activeElement).toBe(button("Appearance").element);
    wrapper.unmount();
  });

  it("in the Hub, the arrow keys move onto a launcher section without opening the launcher (HUB-054)", async () => {
    const openInLauncher = vi.fn();
    const wrapper = mount(SettingsView, { props: { snapshot: hubSnapshot(), native: undefined, openInLauncher, target: { section: "game" } }, attachTo: document.body });
    await flushPromises();
    const nav = wrapper.get('nav[aria-label="Settings sections"]');
    const button = (label: string) => nav.findAll("button").find(candidate => candidate.text() === label)!;
    const press = async (from: string, key: string) => { await button(from).trigger("keydown", { key }); await flushPromises(); };
    button("Game").element.focus();
    await press("Game", "ArrowDown");
    expect([document.activeElement, wrapper.get(".settings-fields h1").text()]).toEqual([button("Texture packs").element, "Game"]);
    await press("Texture packs", "End");
    expect(document.activeElement).toBe(button("Advanced").element);
    await press("Advanced", "ArrowDown");
    expect([document.activeElement, wrapper.get(".settings-fields h1").text()]).toEqual([button("Advanced").element, "Game"]);
    expect(openInLauncher).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it("in the Hub, says so when the launcher cannot be opened", async () => {
    const openInLauncher = vi.fn(async () => { throw new Error("ipc"); });
    const wrapper = mount(SettingsView, { props: { snapshot: hubSnapshot(), native: undefined, openInLauncher, target: { section: "game" } } });
    await flushPromises();
    await openSection(wrapper, "Updates");
    expect(wrapper.get('p[role="alert"]').text()).toBe("The launcher could not open. Use Window › Show Launcher.");
  });
});
