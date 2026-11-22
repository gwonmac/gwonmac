/**
 * Owns the one shape every part kind shares: `start` gets what its kind hands it and returns
 * what stops it. A manifest's `parts` declares the kinds a feature has, and a part builds only
 * for a feature that declares its kind. Who starts and stops each kind, and what it gets:
 *
 * - game: the Tools companion installer runs `start` while resolve has the feature on and
 *   stops it when resolve turns it off (`featurePart`, app/renderer/tools-companion-part.ts);
 * - window: the game host's Tools window provides its link for its whole life and starts it
 *   when the player first opens it, and stops it when the window goes (`windowPart` and
 *   `WindowContext`, app/renderer/window-part.ts);
 * - hubPage: the game host starts it with the Hub and stops it at teardown; the Hub hides its
 *   rows while resolve has it off (`hubPagePart` and `HubPageContext`, app/renderer/hub.ts);
 * - main: the Tools runtime runs `start` while resolve has the feature on (`mainPart`,
 *   app/main/tools-main-part.ts).
 *
 * The renderer kinds get the links their manifest names (./links.ts). A game part or window part
 * whose `start` throws stays off and logs one line; the other parts run on.
 */
import type { FeaturePartKind } from "./define.js";
import type { Feature } from "./index.js";

/** What a part's `start` returns: its stop, and whatever else its host calls. */
export type RunningPart = Readonly<{ stop(): void }>;

/** The ids of the features whose manifest `parts` lists `Kind`. */
export type PartOwner<Kind extends FeaturePartKind> = Feature extends infer Each
  ? Each extends Readonly<{ id: infer Id; parts: readonly (infer Kinds)[] }> ? (Kind extends Kinds ? Id : never) : never
  : never;
