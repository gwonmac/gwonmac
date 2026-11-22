import assert from "node:assert/strict";
import { test } from "node:test";
import { COMPANION_FEATURE_BITS } from "../../app/shared/companion-abi.ts";
import { createSkillOverlaysInstallation } from "../../app/renderer/skill-overlays-installation.ts";

test("the skill feeds run only for what needs them", () => {
  const skills = createSkillOverlaysInstallation({
    nativeHudRendering: true,
    skillSlotGeometry: true,
    skillCooldownObservation: true,
  });
  assert.equal(skills.geometry.active, false);
  assert.equal(skills.cooldowns.active, false);
  assert.equal(skills.activeFeatureFlags, 0);

  // Skill Key Labels claims ui.skillKeys (game-blocks.ts).
  skills.wantSlots(true);
  assert.equal(skills.geometry.active, true, "a key badge needs geometry");
  assert.equal(skills.cooldowns.active, false);
  assert.equal(
    skills.activeFeatureFlags,
    COMPANION_FEATURE_BITS.skillSlotGeometry,
  );
  skills.geometry.sink?.update({
    status: "ready",
    sequence: 2,
    frameId: 1,
    viewportWidth: 800,
    viewportHeight: 600,
    slots: Object.freeze(Array.from({ length: 8 }, (_, index) => Object.freeze({
      left: index * 50,
      bottom: 20,
      right: index * 50 + 48,
      top: 68,
    }))),
  });
  assert.equal(skills.geometry.state.status, "ready");

  skills.wantSlots(false);
  assert.deepEqual(skills.geometry.state, { status: "waiting", reason: "stale" });
  skills.wantSlots(true);
  skills.geometry.sink?.update({
    status: "ready",
    sequence: 2,
    frameId: 2,
    viewportWidth: 800,
    viewportHeight: 600,
    slots: Object.freeze(Array.from({ length: 8 }, (_, index) => Object.freeze({
      left: index * 50,
      bottom: 20,
      right: index * 50 + 48,
      top: 68,
    }))),
  });
  assert.deepEqual(
    skills.geometry.state,
    { status: "waiting", reason: "stale" },
    "re-enabling cannot revive the withdrawn publication",
  );
  skills.geometry.sink?.update({
    status: "ready",
    sequence: 4,
    frameId: 2,
    viewportWidth: 800,
    viewportHeight: 600,
    slots: Object.freeze(Array.from({ length: 8 }, (_, index) => Object.freeze({
      left: index * 50,
      bottom: 20,
      right: index * 50 + 48,
      top: 68,
    }))),
  });
  assert.equal(skills.geometry.state.status, "ready");

  // Skill Cooldowns claims ui.skillLabels and reads game.skillbar (game-blocks.ts).
  skills.wantSlots(true);
  skills.wantCooldowns(true);
  assert.equal(skills.geometry.active, true, "cooldowns also need geometry");
  assert.equal(skills.cooldowns.active, true);
  assert.equal(
    skills.activeFeatureFlags,
    COMPANION_FEATURE_BITS.skillSlotGeometry
      | COMPANION_FEATURE_BITS.skillCooldownObservation,
  );
  skills.geometry.dispose();
  skills.cooldowns.dispose();
});


test("a refused native renderer leaves the slot geometry inactive", () => {
  const skills = createSkillOverlaysInstallation({
    nativeHudRendering: false, skillSlotGeometry: true, skillCooldownObservation: true,
  });
  skills.wantSlots(true);
  assert.equal(skills.activeFeatureFlags, 0);
  assert.equal(skills.geometry.active, false);
  // Skill Cooldowns does not start without the native renderer, so nothing reads the
  // recharge feed then (tests/unit/feature-parts-start-and-stop-with-their-feature.test.ts).
});
