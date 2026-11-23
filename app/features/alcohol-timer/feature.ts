import {
  DEFAULT_ALCOHOL_TIMER_POSITION,
  isAlcoholTimerPosition,
  type AlcoholTimerPosition,
} from "../../shared/alcohol-timer.js";
import { setting } from "../../shared/settings/define.js";
import { defineFeature, featureSwitch } from "../define.js";

export default defineFeature({
  id: "alcoholTimer",
  name: "Alcohol Timer",
  summary: "A quiet, movable alcohol countdown. Hidden when sober; amber in the last 15 seconds.",
  kind: "helpers",
  purpose: "characters",
  icon: "wine",
  settings: {
    alcoholTimerEnabled: featureSwitch(false, { tools: true }),
    alcoholTimerPosition: setting.position(
      DEFAULT_ALCOHOL_TIMER_POSITION,
      (value): AlcoholTimerPosition | undefined => isAlcoholTimerPosition(value) ? { ...value } : undefined,
      {
        hub: true,
        rendererWritable: true,
        tools: true,
        error: "Alcohol timer position is invalid",
        launcherError: "Alcohol timer position is invalid",
        label: "Alcohol Timer position",
        help: "Drag the timer in a game window to move it. Show to place shows it while you are sober.",
        keywords: "move reset position",
      },
    ),
  },
  region: "non-pvp",
  uses: ["alcoholObservation"],
  tool: {
    id: "alcohol-timer",
    keywords: "drunk alcohol timer",
  },
  shots: [],
  parts: ["game"],
});
