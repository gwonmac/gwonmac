/**
 * Reminders in the game host: a minute before a con, pcon or alcohol runs out,
 * and when it has, print one local chat line each through certified chat print.
 * Several reminders at once still chime once. It reads `game.effects` and
 * `game.alcohol` only while an option asks for them.
 *
 * Chat print is Reminders' own certified stage, and its memory keeps this line's
 * place in COMPANION_PARTS (the heap layout), so the line is written by hand: it
 * hosts the memory and hands its session to the feature's `featurePart`.
 */
import { CHAT_PRINT_PREFIX } from "../../shared/chat-print.js";
import {
  observeAlcohol, observeConsumables, reminderLine, wantsReminder,
  type AlcoholWatch, type ConsumableWatch, type ReminderEvent, type ReminderGroup, type ReminderOptions,
} from "./renderer/reminders.js";
import { createChatPrintInstallation, type ChatPrintInstallation } from "./renderer/chat-print-installation.js";
import { createReminderChime } from "./renderer/reminder-chime.js";
import { featurePart, type FeatureBlocks, type ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

function startReminders({ game, settings }: FeatureBlocks, chatPrint: ChatPrintInstallation) {
  const chime = createReminderChime();
  // Replaced at once: settings give their value on subscribe.
  let options: ReminderOptions = { cons: false, pcons: false, alcohol: false, beforeEnd: false, atEnd: false };
  let sound = false;
  let consumables: ConsumableWatch = new Map();
  let alcohol: AlcoholWatch = null;
  let stopEffects: (() => void) | null = null;
  let stopAlcohol: (() => void) | null = null;
  const wants = (...groups: ReminderGroup[]) => (options.beforeEnd || options.atEnd) && groups.some(group => options[group]);
  const remind = (events: readonly ReminderEvent[]) => {
    let queued = false;
    for (const event of events.filter(each => wantsReminder(options, each))) {
      queued = chatPrint.print(`${CHAT_PRINT_PREFIX}${reminderLine(event)}`) || queued;
    }
    if (queued && sound) chime.play();
  };
  const stopSettings = settings.subscribe((next) => {
    options = { cons: next.reminderCons, pcons: next.reminderPcons, alcohol: next.reminderAlcohol,
      beforeEnd: next.reminderBeforeEnd, atEnd: next.reminderAtEnd };
    sound = next.reminderSound;
    chatPrint.setEnabled(wants("cons", "pcons", "alcohol"));
    if (wants("cons", "pcons")) {
      stopEffects ??= game.effects.subscribe(state => {
        const observed = observeConsumables(consumables, state === null ? { status: "waiting" } : { status: "ready", ...state });
        consumables = observed.watch; remind(observed.events);
      });
    } else { stopEffects?.(); stopEffects = null; consumables = new Map(); }
    if (wants("alcohol")) {
      stopAlcohol ??= game.alcohol.subscribe(state => {
        const observed = observeAlcohol(alcohol, state === null ? { status: "waiting" } : { status: "ready", ...state });
        alcohol = observed.watch; remind(observed.events);
      });
    } else { stopAlcohol?.(); stopAlcohol = null; alcohol = null; }
  });
  return {
    stop() { stopSettings(); stopEffects?.(); stopAlcohol?.(); chime.dispose(); chatPrint.setEnabled(false); },
  };
}

export default {
  id: "reminders",
  prepare(input) {
    const chatPrint = createChatPrintInstallation(input.exports, input.capabilities.chatPrint);
    const feature = featurePart("reminders", (blocks) => startReminders(blocks, chatPrint)).prepare(input);
    return {
      allocate: (malloc) => chatPrint.allocate(malloc),
      initialize: (memory) => chatPrint.initialize(memory),
      ownedRegions: () => chatPrint.region === null ? [] : [chatPrint.region],
      rollback: [(free) => chatPrint.dispose(free)],
      activate: (context) => ({
        ...feature.activate(context),
        pollers: [{ poll: () => chatPrint.poll(), enabled: () => chatPrint.enabled }],
        releaseCallbackResources: [(free) => chatPrint.dispose(free)],
      }),
    };
  },
} satisfies ToolsCompanionPart;
