import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

const OPTION = { hub: true, tools: true } as const;

export default defineFeature({
  id: "reminders",
  name: "Reminders",
  summary: "Remind you in chat before cons, pcons or alcohol run out. Only you see these lines.",
  kind: "fight",
  presence: "background",
  icon: "bell",
  version: "1.0",
  settingsHelp: "Choose at least one item and one time, or no reminder appears.",
  settings: {
    remindersEnabled: featureSwitch(false, { tools: true }),
    reminderCons: setting.boolean(true, {
      ...OPTION,
      label: "Cons",
      help: "Essence of Celerity, Grail of Might and Armor of Salvation.",
      keywords: "reminder",
    }),
    reminderPcons: setting.boolean(true, {
      ...OPTION,
      label: "Pcons",
      help: "Cupcakes, candies, Rock Candy, War Supplies, Lunar Blessing and more.",
      keywords: "reminder",
    }),
    reminderAlcohol: setting.boolean(true, {
      ...OPTION,
      label: "Alcohol",
      help: "An estimate, so its lines say “about”.",
      keywords: "reminder",
    }),
    reminderBeforeEnd: setting.boolean(true, {
      ...OPTION,
      label: "1 minute before it runs out",
      help: "Prints a line one minute before the effect ends.",
      keywords: "reminder",
    }),
    reminderAtEnd: setting.boolean(true, {
      ...OPTION,
      label: "When it has run out",
      help: "Prints a line when the effect has ended.",
      keywords: "reminder",
    }),
    reminderSound: setting.boolean(false, {
      ...OPTION,
      label: "Play a sound",
      help: "One short chime, even when several reminders arrive together.",
      keywords: "reminder",
    }),
  },
  region: "pve",
  uses: ["chatPrint"],
  tool: {
    id: "reminders",
    keywords: "cons pcons alcohol reminder chime",
  },
  shots: [],
  parts: ["game"],
});
