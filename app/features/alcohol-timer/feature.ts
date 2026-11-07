import {
  DEFAULT_ALCOHOL_TIMER_POSITION,
  isAlcoholTimerPosition,
  type AlcoholTimerPosition,
} from "../../shared/alcohol-timer.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature } from "../define.js";

export default defineFeature({
  id: "alcoholTimer",
  settings: {
    alcoholTimerEnabled: setting.boolean(false, { tools: true }),
    alcoholTimerPosition: setting.value(
      DEFAULT_ALCOHOL_TIMER_POSITION,
      (value): AlcoholTimerPosition | undefined => isAlcoholTimerPosition(value) ? { ...value } : undefined,
      {
        hub: true,
        rendererWritable: true,
        tools: true,
        error: "Alcohol timer position is invalid",
        launcherError: "Alcohol timer position is invalid",
      },
    ),
  },
  activation: { kind: "setting", setting: "alcoholTimerEnabled", master: "gwonmacTools" },
  region: "pve",
  tool: {
    id: "alcohol-timer",
    label: "Alcohol Timer",
    description: "A quiet, movable alcohol countdown. Hidden when sober; amber in the last 15 seconds.",
    keywords: "drunk alcohol timer",
  },
});
