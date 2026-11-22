// Every feature's manifest `icon` names an icon the launcher can draw: a misspelt or
// renamed Lucide name would leave a blank square on its Features card.
import { describe, expect, it } from "vitest";
import { FEATURES } from "@shared/feature-contracts";
import { featureIcon } from "./feature-icon";

describe("feature icons", () => {
  it.each(FEATURES.map(feature => [feature.id, feature.icon]))("%s draws %s", (_id, icon) => {
    expect(featureIcon(icon)).toBeDefined();
  });
});
