import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILD_CHECK_FAILED } from "@shared/contracts";
import type { FeatureId } from "@shared/feature-contracts";
import type { GlobalTool, LauncherNativeApi, LauncherSnapshot } from "@shared/launcher-contracts";
import FeaturesView from "./FeaturesView.vue";
import { cardFeature } from "../features";
import { fixtureFacts, fixtureFeatureChecksFor, fixtureSnapshot } from "../fixtures";

type Tools = LauncherSnapshot["tools"];
const loaded: Tools = { ...fixtureSnapshot.tools, configured: true, loaded: true, restartRequired: false };
const withSwitches = (tools: Tools, switches: Partial<Record<GlobalTool, boolean>>): Tools => ({
  ...tools,
  features: { ...tools.features, ...Object.fromEntries(Object.entries(switches).map(([tool, enabled]) => [tool, { enabled }])) },
});
const idle: LauncherSnapshot["profiles"] = fixtureSnapshot.profiles.map((profile) => ({ ...profile, state: "ready" }));
const proved = fixtureFeatureChecksFor("?checks=proved");
const patchDay = fixtureFeatureChecksFor("?checks=patch-day");

function bridge() {
  return {
    tools: { setFeature: vi.fn(async () => undefined), setMasterEnabled: vi.fn(async () => undefined), restartToApply: vi.fn(async () => undefined) },
    settings: { update: vi.fn(async () => undefined) },
  };
}

const mounted: VueWrapper[] = [];
/** The view as main feeds it: the switches and the facts main sends for them (app/main/feature-decision.ts). */
function view(tools: Tools, checks: Parameters<typeof fixtureFacts>[1], native = bridge(), profiles = idle) {
  const wrapper: VueWrapper = mount(FeaturesView, {
    attachTo: document.body,
    props: {
      snapshot: { ...fixtureSnapshot, profiles, tools, features: fixtureFacts(tools, checks) },
      native: native as unknown as LauncherNativeApi,
      feature: null,
      "onUpdate:feature": (feature: FeatureId | null) => wrapper.setProps({ feature }),
    },
  });
  mounted.push(wrapper);
  return { wrapper, native };
}
const cardOf = (wrapper: VueWrapper, id: FeatureId) => wrapper.get(`[data-feature="${id}"]`);
const pressed = (wrapper: VueWrapper, label: string) => wrapper.findAll("button").find((button) => button.text() === label || button.attributes("aria-label") === label)!;

beforeEach(() => localStorage.clear());
afterEach(() => { for (const wrapper of mounted.splice(0)) wrapper.unmount(); });

describe("Features tab", () => {
  // One row per reason a player can meet in the launcher, as the canvas States board draws it.
  // `sends` is what the card's switch and the page's button ask for; a player can always turn a
  // Feature off, and only the plain game holds the switches (null: nothing is sent).
  it.each([
    { state: "plain game", id: "travel", tools: { ...loaded, configured: false }, checks: proved, text: "Off while you play the plain game.", stored: true, action: "Turn off", sends: null },
    { state: "waiting for a restart", id: "travel", tools: { ...loaded, loaded: false, restartRequired: true }, checks: proved, text: "Starts the next time you open Guild Wars.", stored: true, action: "Turn off", sends: { tool: "quick-travel", enabled: false } },
    { state: "needs a GWonMac update", id: "quickItemMove", tools: withSwitches(loaded, { "quick-item-move": true }), checks: patchDay, text: "Needs a GWonMac update for this Guild Wars build.", stored: true, action: "Turn off", sends: { tool: "quick-item-move", enabled: false } },
    { state: "build check failed", id: "chatFilters", tools: withSwitches(loaded, { "chat-filters": true }), checks: patchDay, text: BUILD_CHECK_FAILED, stored: true, action: "Turn off", sends: { tool: "chat-filters", enabled: false } },
    { state: "checking the build", id: "skillCooldowns", tools: loaded, checks: null, text: "Checking this Guild Wars build…", stored: true, action: "Turn off", sends: { tool: "skill-cooldowns", enabled: false } },
    { state: "on", id: "skillCooldowns", tools: loaded, checks: proved, text: "On", stored: true, action: "Turn off", sends: { tool: "skill-cooldowns", enabled: false } },
  ] as const)("shows $state on the card, the row and the page", async ({ id, tools, checks, text, stored, action, sends }) => {
    const { wrapper, native } = view(tools, checks);
    const reason = text === "On" ? null : text;
    const box = () => cardOf(wrapper, id).get('[role="switch"]').element as HTMLInputElement;
    const reasonOf = () => cardOf(wrapper, id).find(`#reason-${id}.warning, #reason-${id}.muted`).exists() ? cardOf(wrapper, id).get(`#reason-${id}`).text() : null;
    expect({ reason: reasonOf(), stored: box().checked }).toEqual({ reason, stored });
    box().click();
    await flushPromises();
    expect(native.tools.setFeature.mock.calls).toEqual(sends ? [[sends]] : []);
    expect(box().checked).toBe(stored);

    await pressed(wrapper, "Compact list").trigger("click");
    expect(cardOf(wrapper, id).get("small").text()).toBe(reason ?? cardFeature(id)!.summary);
    expect(box().checked).toBe(stored);

    await cardOf(wrapper, id).get(".card-link").trigger("click");
    await flushPromises();
    expect(wrapper.get("#feature-status").text()).toContain(text.replace(/\.$/u, ""));
    const button = wrapper.get(".head-action button");
    expect({ action: button.text(), disabled: button.attributes("disabled") !== undefined }).toEqual({ action, disabled: sends === null });
    native.tools.setFeature.mockClear();
    await button.trigger("click");
    await flushPromises();
    expect(native.tools.setFeature.mock.calls).toEqual(sends ? [[sends]] : []);
  });

  // Progress has no switch of its own: its card and page never move Travel's switch.
  it("shows a Feature that runs with another without a switch of its own", async () => {
    const { wrapper, native } = view(withSwitches(loaded, { "quick-travel": false }), proved);
    const card = cardOf(wrapper, "progress");
    expect({ switch: card.find('[role="switch"]').exists(), runsWith: card.get(".runs-with").text(), reason: card.get("#reason-progress").text() })
      .toEqual({ switch: false, runsWith: "Runs with Travel", reason: "Needs Travel. Turn it on first." });
    await card.get(".card-link").trigger("click");
    await pressed(wrapper, "Turn on Travel").trigger("click");
    await flushPromises();
    expect(native.tools.setFeature.mock.calls).toEqual([[{ tool: "quick-travel", enabled: true }]]);

    const on = view(loaded, proved).wrapper;
    await cardOf(on, "progress").get(".card-link").trigger("click");
    expect({ action: on.find(".head-action button").exists(), text: on.get(".head-action").text() }).toEqual({ action: false, text: "Runs with Travel" });
  });

  it.each([
    { state: "plain game", tools: { ...loaded, configured: false }, status: "Every Feature is off. Turn off the plain game to get each one back as it was.", checked: true, restart: false },
    { state: "waiting for a restart", tools: { ...loaded, loaded: false, restartRequired: true }, status: "Your choices are saved. Restart the launcher to load Features.", checked: false, restart: true },
    { state: "Features loaded", tools: loaded, status: "Features are loaded. Each switch below works at once in supported game areas.", checked: false, restart: false },
  ])("tells the plain-game strip's state: $state", ({ tools, status, checked, restart }) => {
    const { wrapper } = view(tools, proved);
    const strip = wrapper.get(".plain-strip");
    expect(strip.get('[role="status"]').text()).toBe(status);
    expect((strip.get<HTMLInputElement>('[role="switch"]').element).checked).toBe(checked);
    expect(strip.findAll("button").some((button) => button.text() === "Restart launcher")).toBe(restart);
  });

  it("turns the plain game off and holds the restart while a game window is open", async () => {
    const { wrapper, native } = view({ ...loaded, configured: false }, proved);
    await wrapper.get('.plain-strip [role="switch"]').setValue(false);
    expect(native.tools.setMasterEnabled).toHaveBeenCalledWith(true);

    const running: LauncherSnapshot["profiles"] = fixtureSnapshot.profiles.map((profile, index) => ({ ...profile, state: index === 0 ? "running" : "ready" }));
    const waiting = view({ ...loaded, loaded: false, restartRequired: true }, proved, bridge(), running).wrapper;
    expect(waiting.get(".plain-strip").text()).toContain("Close every game window before restarting the launcher.");
    expect(pressed(waiting, "Restart launcher").attributes("disabled")).toBeDefined();
  });

  it("keeps a plain-game switch in the Tab order with its saved choice, held", async () => {
    const { wrapper, native } = view({ ...loaded, configured: false }, proved);
    const held = cardOf(wrapper, "travel").get('[role="switch"]');
    const box = held.element as HTMLInputElement;
    expect({ disabled: held.attributes("disabled"), aria: held.attributes("aria-disabled"), describedby: held.attributes("aria-describedby") })
      .toEqual({ disabled: undefined, aria: "true", describedby: "reason-travel" });
    box.click();
    await flushPromises();
    expect(native.tools.setFeature).not.toHaveBeenCalled();
    expect(box.checked).toBe(true);
  });

  it("reaches a card's name before its switch, and the plain-game switch before the catalog", () => {
    const { wrapper } = view(loaded, proved);
    const focusable = [...(wrapper.element as HTMLElement).querySelectorAll<HTMLElement>("input, button")].filter((element) => element.tabIndex >= 0);
    const order = (element: Element) => focusable.indexOf(element as HTMLElement);
    const travel = cardOf(wrapper, "travel");
    expect(order(travel.get(".card-link").element)).toBe(order(travel.get('[role="switch"]').element) - 1);
    expect(order(wrapper.get('.plain-strip [role="switch"]').element)).toBeLessThan(order(pressed(wrapper, "All").element));
    expect(order(pressed(wrapper, "Large cards").element)).toBeLessThan(order(travel.get(".card-link").element));
  });

  it("remembers the card size on this Mac", async () => {
    const first = view(loaded, proved).wrapper;
    expect(first.find(".card-grid").exists()).toBe(true);
    await pressed(first, "Compact list").trigger("click");
    first.unmount();
    mounted.splice(mounted.indexOf(first), 1);
    const second = view(loaded, proved).wrapper;
    expect(second.find(".tile-grid").exists()).toBe(true);
    expect(pressed(second, "Compact list").attributes("aria-pressed")).toBe("true");
  });

  it("puts the keyboard on a Feature page's title and back on its card", async () => {
    const { wrapper } = view(loaded, proved);
    await cardOf(wrapper, "whispers").get(".card-link").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("h1").element);
    expect(wrapper.get("h1").text()).toBe("Whispers");

    await wrapper.get(".back").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(cardOf(wrapper, "whispers").get(".card-link").element);
  });

  it("says when a search finds nothing and clears it", async () => {
    const { wrapper } = view(loaded, proved);
    const search = wrapper.get('input[type="search"]');
    await search.setValue("zzz");
    expect(wrapper.find("[data-feature]").exists()).toBe(false);
    expect(wrapper.get(".no-results h2").text()).toBe("No Feature matches “zzz”");

    await pressed(wrapper, "Show all Features").trigger("click");
    expect((search.element as HTMLInputElement).value).toBe("");
    expect(document.activeElement).toBe(search.element);

    await search.setValue("whisp");
    expect(wrapper.findAll("[data-feature]").map((card) => card.attributes("data-feature"))).toEqual(["whispers"]);
    await search.trigger("keydown", { key: "Escape" });
    expect((search.element as HTMLInputElement).value).toBe("");
  });

  it("groups by purpose and filters to the switches that are on", async () => {
    const { wrapper } = view(loaded, proved);
    await pressed(wrapper, "Purpose").trigger("click");
    expect(wrapper.findAll(".feature-group h2").map((heading) => heading.text().replace(/\s*\d+$/u, ""))).toEqual(["Get around", "Fight", "Chat and trade", "Inventory", "Characters"]);
    const on = wrapper.findAll(".pill").find((pill) => pill.text().startsWith("On"))!;
    await on.trigger("click");
    const shown = wrapper.findAll("[data-feature]").map((card) => card.attributes("data-feature"));
    expect(on.text()).toBe(`On (${shown.length})`);
    expect(shown).toContain("skillCooldowns");
    expect(shown).not.toContain("whispers");
  });
});
