/** The client is told Steam exists unless the player turned Disable Steam login on. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.js";
import { offersLoginProvider } from "../../app/renderer/login-provider.js";

test("only Steam is offered, whatever its letter case, until Disable Steam login is on", () => {
  const cases: readonly (readonly [unknown, boolean])[] = [
    ["Steam", true], ["steam", true], ["STEAM", true],
    ["Apple", false], ["Google", false], ["steamy", false], ["", false], [42, false], [null, false], [undefined, false],
  ];
  for (const [name, offered] of cases) {
    assert.equal(offersLoginProvider(name, DEFAULT_SETTINGS), offered, `default: ${String(name)}`);
    // Before the settings have loaded the default applies.
    assert.equal(offersLoginProvider(name, null), offered, `unloaded: ${String(name)}`);
    assert.equal(offersLoginProvider(name, { disableSteamLogin: true }), false, `disabled: ${String(name)}`);
  }
});
