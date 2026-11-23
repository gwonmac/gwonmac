/** Core omits Maps transports; live Tools disablement denies real IPC work. */
import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { closeOffline, launchOffline } from "./fixtures.mjs";

for (const tools of [false, true]) {
  test(`${tools ? "Tools" : "Core"} launch enforces Maps transport ownership`, { tag: "@journey" }, async () => {
    const fixture = await launchOffline("gw-tools-boundary-", {}, async (userData) => {
      await writeFile(path.join(userData, "settings.json"), JSON.stringify({
        gwonmacTools: tools, cartographyRouteEnabled: true,
      }), { mode: 0o600 });
    });
    try {
      const { app, page } = fixture;
      expect(await page.evaluate(() => "cartography" in window.gwNative)).toBe(tools);
      if (!tools) return;
      const launcher = app.windows().find(window => window.url().endsWith("launcher/index.html"));
      if (!launcher) throw new Error("launcher is required");
      const read = () => page.evaluate(async () => {
        const api = window.gwNative;
        if (!("cartography" in api)) throw new Error("Maps transport is missing");
        return api.cartography.getMapKnowledge("a".repeat(64));
      });
      const record = () => page.evaluate(async () => {
        const api = window.gwNative;
        if (!("cartography" in api)) throw new Error("Maps transport is missing");
        return api.cartography.recordMapKnowledge({
          kernelSha256: "a".repeat(64), mapId: 1, continent: 0,
          width: 1, height: 1, revealRadius: 1, words: [1],
        });
      });
      // The map engine answers while any map Feature is on: here only the Walking route.
      expect(await read()).toEqual([]);
      const setMapFeatures = (enabled: boolean) => launcher.evaluate(async (on) => {
        for (const tool of ["maps", "walking-route", "compass-ranges", "elite-skills"] as const) await window.launcherNative.tools.setFeature({ tool, enabled: on });
      }, enabled);
      await setMapFeatures(false);
      await expect(read()).rejects.toThrow(/Maps is disabled/);
      await expect(record()).rejects.toThrow(/Maps is disabled/);
      await setMapFeatures(true);
      expect(await read()).toEqual([]);
      await launcher.evaluate(() => window.launcherNative.tools.setMasterEnabled(false));
      await expect(read()).rejects.toThrow(/Maps is disabled/);
      await expect(record()).rejects.toThrow(/Maps is disabled/);
      expect(await page.evaluate(() => "cartography" in window.gwNative)).toBe(true);
    } finally {
      await closeOffline(fixture);
    }
  });
}
