/** The client is told Steam exists unless the player turned Disable Steam login on. */
import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_SETTINGS } from "../../app/shared/settings/index.js";
import { offersLoginProvider } from "../../app/shared/login-provider.js";

const DISABLED = { disableSteamLogin: true };
const ALLOWED = { disableSteamLogin: false };

test("Steam login is offered by default", () => {
  assert.equal(DEFAULT_SETTINGS.disableSteamLogin, false);
  assert.equal(offersLoginProvider("Steam", DEFAULT_SETTINGS), true);
});

test("with Disable Steam login on, no provider is offered", () => {
  for (const name of ["Steam", "steam", "STEAM", "Apple", "Google", "other", "", 42, null, undefined]) {
    assert.equal(offersLoginProvider(name, DISABLED), false, String(name));
  }
});

test("with Disable Steam login off, only Steam is offered, whatever its letter case", () => {
  for (const [name, offered] of [
    ["Steam", true], ["steam", true], ["STEAM", true],
    ["Apple", false], ["Google", false], ["steamy", false], ["", false], [42, false], [null, false], [undefined, false],
  ] as const) {
    assert.equal(offersLoginProvider(name, ALLOWED), offered, String(name));
  }
});

test("before the settings have loaded Steam is offered, as it is by default", () => {
  assert.equal(offersLoginProvider("Steam", null), true);
  assert.equal(offersLoginProvider("Apple", null), false);
});
