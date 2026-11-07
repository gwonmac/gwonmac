import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

const OPTION = { hub: true, tools: true } as const;

export default defineFeature({
  id: "reminders",
  settings: {
    remindersEnabled: setting.boolean(false, { tools: true }),
    reminderCons: setting.boolean(true, OPTION),
    reminderPcons: setting.boolean(true, OPTION),
    reminderAlcohol: setting.boolean(true, OPTION),
    reminderBeforeEnd: setting.boolean(true, OPTION),
    reminderAtEnd: setting.boolean(true, OPTION),
    reminderSound: setting.boolean(false, OPTION),
  },
  activation: { kind: "setting", setting: "remindersEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "reminders",
    label: "Reminders",
    description: "Remind you in chat before cons, pcons or alcohol run out. Only you see these lines.",
    keywords: "cons pcons alcohol reminder chime",
  },
  capabilities: ["playerEffectObservation", "alcoholObservation", "chatPrint"],
});
