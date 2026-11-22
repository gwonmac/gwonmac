/**
 * Owns the player words for what a feature uses: one line for each verifier capability, grouped
 * as the Feature page shows them (sees, draws, does), and its internet hosts. The Features tab
 * reads a manifest only through featureUses, so the manifest field's name lives in one place.
 */
import type { FeatureDefinition } from "../features/define.js";
import type { EnhancementCapability } from "./enhancement-contracts.js";

export type FeatureUseGroup = "sees" | "draws" | "does";

/** One line per capability, in the words a player reads on the Feature page. */
export const CAPABILITY_WORDS: Readonly<Record<EnhancementCapability, Readonly<{ group: FeatureUseGroup; text: string }>>> = {
  nativeCursor: { group: "draws", text: "The mouse cursor" },
  targetObservation: { group: "sees", text: "Your selected target" },
  partyObservation: { group: "sees", text: "Your party and your heroes’ skill bars" },
  teamApply: { group: "does", text: "Loads a saved team onto your heroes, when you ask" },
  travelAction: { group: "does", text: "Travels to the outpost you choose" },
  xunlaiAction: { group: "does", text: "Opens Xunlai storage, when you ask" },
  chatAliases: { group: "does", text: "Answers its own chat commands" },
  skillSlotGeometry: { group: "sees", text: "Where your skill slots are on screen" },
  skillCooldownObservation: { group: "sees", text: "Your skills’ recharge times" },
  playRegionObservation: { group: "sees", text: "Whether you are in PvE or PvP" },
  preGameControls: { group: "sees", text: "The character select screen" },
  characterSwitchAction: { group: "does", text: "Switches to the character you pick" },
  chatFiltering: { group: "does", text: "Hides the chat notices you choose" },
  quickItemMove: { group: "does", text: "Moves item stacks when you Control-click them" },
  playerEffectObservation: { group: "sees", text: "Your effects and the time they have left" },
  effectIconGeometry: { group: "sees", text: "Where your effect icons are on screen" },
  resignAction: { group: "does", text: "Sends /resign after you confirm" },
  whisperChat: { group: "sees", text: "Whispers to and from you" },
  alcoholObservation: { group: "sees", text: "Your alcohol level" },
  nativeHudRendering: { group: "draws", text: "Numbers and labels on the game’s own skill bar and effects" },
  chatPrint: { group: "draws", text: "Lines in your chat that only you see" },
  progressObservation: { group: "sees", text: "Your mission, vanquish and Cartographer progress" },
};

export type FeatureUses = Readonly<Record<FeatureUseGroup, readonly string[]> & {
  /** The internet hosts it reaches; empty: none. */
  network: readonly string[];
}>;

/**
 * What a feature uses, in player words. `capabilities` lists only what the feature cannot run
 * without (app/features/define.ts), so a feature that still does part of its job without the game
 * lists less than it reads.
 */
export function featureUses(feature: FeatureDefinition): FeatureUses {
  const groups: Record<FeatureUseGroup, string[]> = { sees: [], draws: [], does: [] };
  for (const capability of feature.capabilities ?? []) {
    const { group, text } = CAPABILITY_WORDS[capability];
    if (!groups[group].includes(text)) groups[group].push(text);
  }
  return { ...groups, network: feature.network ?? [] };
}
