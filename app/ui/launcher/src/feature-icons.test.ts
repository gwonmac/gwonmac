// Every feature's manifest `icon` names an icon the launcher can draw: a misspelt or
// renamed Lucide name would leave a blank square on its Features card.
import * as lucide from "lucide-vue-next";
import { describe, expect, it } from "vitest";
import { FEATURES } from "@shared/feature-contracts";

const component = (icon: string) => icon.split("-").map(part => part.charAt(0).toUpperCase() + part.slice(1)).join("");

describe("feature icons", () => {
  it.each(FEATURES.map(feature => [feature.id, feature.icon]))("%s draws %s from lucide-vue-next", (_id, icon) => {
    expect(Object.keys(lucide)).toContain(component(icon));
  });
});
