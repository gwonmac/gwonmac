// Typed feature links (app/renderer/feature-links.ts): Trade Chat reaches Whispers only through
// the link its manifest names, which resolve decides. While Whispers is off the link is null, and
// a handle kept from before opens nothing, shows nothing and sends nothing.
import assert from "node:assert/strict";
import test from "node:test";
import { whispersLink } from "../../app/features/whispers/renderer/link.ts";
import { featureLinks, onLinksChange, provideLink } from "../../app/renderer/feature-links.ts";
import { createWhisperSession } from "../../app/shared/whisper-session.ts";
import { provenFacts } from "../helpers/feature-facts.ts";

test("Trade's Whispers link is null while Whispers is off, and then nothing is sent or opened", () => {
  let settings: Record<string, boolean> = { gwonmacTools: true, tradeChat: true, whispersEnabled: true };
  const originalWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: Object.assign(new EventTarget(), { gwFeatureFacts: () => provenFacts(settings) }),
  });
  try {
    const sent: string[] = [];
    const session = createWhisperSession(async (to, text) => { sent.push(`${to}: ${text}`); });
    session.setAvailable(true);
    const shown: unknown[] = [];
    let changes = 0;
    const unsubscribe = onLinksChange(() => { changes += 1; });
    const stopLink = provideLink("whispers", whispersLink(session, (intent) => { shown.push(intent); return "shown"; }));
    const links = featureLinks("tradeChat");
    // Read live: each read asks resolve again.
    const whispers = () => links.whispers;
    const kept = whispers();
    assert.notEqual(kept, null, "Whispers on: Trade gets the link");

    settings = { ...settings, whispersEnabled: false };
    assert.equal(whispers(), null, "Whispers off: Trade's link is null");
    assert.equal(kept?.open("Quiet Ember"), "unavailable", "a handle kept from before reaches nothing");
    assert.deepEqual([session.state.selected, session.state.visible, session.state.conversations.length], [null, false, 0]);
    assert.deepEqual([shown, sent], [[], []]);

    settings = { ...settings, whispersEnabled: true };
    assert.equal(whispers()?.open("Quiet Ember"), "opened");
    assert.deepEqual([session.state.conversations.map((conversation) => conversation.name), shown], [["Quiet Ember"], ["show"]]);

    stopLink();
    assert.equal(whispers()?.open("Rin of the Isles"), "unavailable", "on, but Whispers' part is not running");
    assert.deepEqual([session.state.conversations.length, sent], [1, []]);
    assert.equal(changes, 2, "starting and stopping Whispers' part announce a change");
    unsubscribe();
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
  }
});
