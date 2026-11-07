/**
 * Reminders in the game host: a minute before a con, pcon or alcohol runs out,
 * and when it has, print one local chat line each through certified chat print.
 * Several reminders at once still chime once. The effect and alcohol feeds are
 * the shared substrates; this part adds its demand to them.
 */
import { CHAT_PRINT_PREFIX } from "../../shared/chat-print.js";
import {
  observeAlcohol, observeConsumables, reminderLine, wantsReminder,
  type AlcoholWatch, type ConsumableWatch, type ReminderEvent, type ReminderGroup, type ReminderOptions,
} from "../../shared/reminders.js";
import { createChatPrintInstallation } from "../../renderer/chat-print-installation.js";
import { createReminderChime } from "../../renderer/reminder-chime.js";
import type { ToolsCompanionPart } from "../../renderer/tools-companion-part.js";

export default {
  id: "reminders",
  prepare({ exports, capabilities, substrates: { alcohol, effects } }) {
    const chatPrint = createChatPrintInstallation(exports, capabilities.chatPrint);
    return {
      allocate: (malloc) => chatPrint.allocate(malloc),
      initialize: (memory) => chatPrint.initialize(memory),
      ownedRegions: () => chatPrint.region === null ? [] : [chatPrint.region],
      rollback: [(free) => chatPrint.dispose(free)],
      activate(context) {
        const reminderOptions = (): ReminderOptions => {
          const settings = context.snapshot().settings;
          return { cons: settings.reminderCons, pcons: settings.reminderPcons, alcohol: settings.reminderAlcohol,
            beforeEnd: settings.reminderBeforeEnd, atEnd: settings.reminderAtEnd };
        };
        const remindersWant = (...groups: ReminderGroup[]) => {
          if (!capabilities.chatPrint || !context.policy().reminders) return false;
          const options = reminderOptions();
          return (options.beforeEnd || options.atEnd) && groups.some(group => options[group]);
        };
        alcohol.observeWhen(() => capabilities.alcoholObservation && remindersWant("alcohol"));
        effects.observePlayerEffectsWhen(() => remindersWant("cons", "pcons"));
        let consumableWatch: ConsumableWatch = new Map();
        let alcoholWatch: AlcoholWatch = null;
        const chime = createReminderChime();
        const remind = (events: readonly ReminderEvent[]) => {
          const options = reminderOptions();
          const wanted = events.filter(event => wantsReminder(options, event));
          let queued = false;
          for (const event of wanted) queued = chatPrint.print(`${CHAT_PRINT_PREFIX}${reminderLine(event)}`) || queued;
          if (queued && context.snapshot().settings.reminderSound) chime.play();
        };
        const unsubscribe = [
          effects.playerEffects.subscribe(state => {
            if (!remindersWant("cons", "pcons")) { consumableWatch = new Map(); return; }
            const observed = observeConsumables(consumableWatch, state.status === "ready"
              ? { status: "ready", gameTimer: state.gameTimer, effects: state.effects } : { status: "waiting" });
            consumableWatch = observed.watch; remind(observed.events);
          }),
          alcohol.installation.subscribe(state => {
            if (!remindersWant("alcohol")) { alcoholWatch = null; return; }
            const observed = observeAlcohol(alcoholWatch, state);
            alcoholWatch = observed.watch; remind(observed.events);
          }),
        ];
        return {
          pollers: [{ poll: () => chatPrint.poll(), enabled: () => chatPrint.enabled }],
          syncFeeds() { chatPrint.setEnabled(remindersWant("cons", "pcons", "alcohol")); },
          disposePresentation: [() => {
            for (const stop of unsubscribe) stop(); chime.dispose(); chatPrint.setEnabled(false);
          }],
          releaseCallbackResources: [(free) => chatPrint.dispose(free)],
        };
      },
    };
  },
} satisfies ToolsCompanionPart;
