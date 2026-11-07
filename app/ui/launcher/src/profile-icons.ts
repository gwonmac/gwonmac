/**
 * Owns how each account icon from LAUNCHER_PROFILE_ICONS is drawn. The record is
 * typed by that list, so a new icon does not compile until it has a drawing.
 */
import type { Component } from "vue";
import { Archive, Crown, Flame, Map as MapIcon, ScrollText, Shield, Star, Swords } from "lucide-vue-next";
import type { LauncherProfileIcon } from "@shared/launcher-contracts";

export const PROFILE_ICONS: Readonly<Record<LauncherProfileIcon, Component>> = {
  swords: Swords, archive: Archive, map: MapIcon, scroll: ScrollText, shield: Shield, star: Star, crown: Crown, flame: Flame,
};
