/**
 * Derives the Cartography memory layout from the client bytes.
 *
 * The frame, game-context, area-table and agent roots come from the shared
 * play-region, observation and pre-game proofs. Each native surface owner the
 * transform hooks is the one function whose body a review accepted, exactly or
 * by relocation identity, and each callback slot is read from the active
 * table. Nothing here is keyed by a client: a relinked client derives its own
 * layout from the facts older reviews left.
 */
import type { ModuleShape } from "./enhancement-evidence-types.js";
import { derivePreGameControls } from "./enhancement-pre-game-proof.js";
import {
  deriveObservationLayout,
  derivePlayRegionLayout,
} from "./enhancement-target-proof.js";
import { reviewedEntries } from "./reviewed-facts.js";
import {
  enhancementProofContext,
  parseActiveTableRelations,
  reviewedOwner,
} from "./wasm-evidence.js";

/** The two roots the derived client publishes for the reachability kernel. */
export type CartographyRoots = Readonly<{
  contextRoot: number;
  agentArray: number;
}>;

export const CARTOGRAPHY_SURFACE_ROLES = Object.freeze([
  "compassRender",
  "compassMapRender",
  "missionMapDispatcher",
  "missionMapGameplayContext",
  "worldMapDispatcher",
] as const);
export type CartographySurfaceRole = (typeof CARTOGRAPHY_SURFACE_ROLES)[number];

/**
 * One reviewed client's surface owners: the function index where the review
 * found each owner, and that owner's body digest.
 */
export type CartographySurfaces = Readonly<Record<
  CartographySurfaceRole,
  readonly [functionIndex: number, bodySha256: string]
>>;

export type CartographyLayout = CartographyRoots & Readonly<{
  frameArray: number;
  frameCount: number;
  areaInfo: number;
  surfaces: Readonly<Record<CartographySurfaceRole, number>>;
  missionMapDispatcherSlot: number;
  worldMapDispatcherSlot: number;
}>;

// The August (also its relocated rebuild) and October 1 owners. Later reviews
// add theirs as the `cartographySurfaces` generation fact.
const BASE_SURFACES: readonly CartographySurfaces[] = Object.freeze([
  Object.freeze({
    compassRender: [14240, "664c05367ef418fea33931d32dd7d6ff8b8469654453b0bb27cb7163c13e5492"],
    compassMapRender: [14179, "da8f05375c3989058277fe14200d57a9654bafdb1562cf215bff9b6130d2c678"],
    missionMapDispatcher: [16136, "34712a34dc14537a423cedb253e07f1ed042edc3a989937bf51d47ca5e69e08f"],
    missionMapGameplayContext: [13562, "5628a0e15b94db0630b83ddf26824361a8f0a16f2015dffb58bf816da4cf959a"],
    worldMapDispatcher: [16223, "8802b503fe9c637e4e7aee6381357e224f861d34081a1c9539dd919909f3a5e7"],
  } as const),
  Object.freeze({
    compassRender: [14253, "34ef07807120a3d28ca84b82553c51ed27e13145cdded2b2e6cae47cd8d66ae4"],
    compassMapRender: [14192, "7474e6aec1fed0244c9cb20d20b75dffa21ddf5f385e7ba63627561b736c2098"],
    missionMapDispatcher: [16162, "683d70ac6bca6bd6284cff8fa8f1064874d5a663a6b334de5a53f5d56a1cea0f"],
    missionMapGameplayContext: [13573, "dd780c5268efe3915d0b925d6c587b7ba5bc5aef33789d58f70d483067a1309b"],
    worldMapDispatcher: [16249, "4405773e239f4696393caf4af59abbb3f217581756ac4a6c6df5c82fc7d7bedb"],
  } as const),
]);
const generationSurfaces = reviewedEntries((facts) => facts.cartographySurfaces);

/** The one owner of `role` among its reviewed owners; see `reviewedOwner`. */
function surfaceOwner(module: ModuleShape, role: CartographySurfaceRole): number | null {
  return reviewedOwner(module, [...BASE_SURFACES, ...generationSurfaces()].map((surfaces) => surfaces[role]));
}

function onlySlot(module: ModuleShape, functionIndex: number): number | null {
  const slots = parseActiveTableRelations(module.elementSection).get(functionIndex) ?? [];
  const [slot] = slots;
  return slots.length === 1 && slot !== undefined ? slot : null;
}

/** The exact Cartography layout of `input`, or null when any part is unproved. */
export function deriveCartographyLayout(input: Uint8Array): CartographyLayout | null {
  const context = enhancementProofContext(input);
  if (!context) return null;
  const module = context.moduleView();
  const playRegion = derivePlayRegionLayout(module);
  const observation = deriveObservationLayout(module);
  if (!playRegion || !observation) return null;
  const preGame = derivePreGameControls(context, playRegion);
  if (!preGame) return null;

  const surfaces: Partial<Record<CartographySurfaceRole, number>> = {};
  for (const role of CARTOGRAPHY_SURFACE_ROLES) {
    const owner = surfaceOwner(module, role);
    if (owner === null) return null;
    surfaces[role] = owner;
  }
  const {
    compassRender, compassMapRender, missionMapDispatcher, missionMapGameplayContext, worldMapDispatcher,
  } = surfaces;
  if (compassRender === undefined || compassMapRender === undefined || missionMapDispatcher === undefined
    || missionMapGameplayContext === undefined || worldMapDispatcher === undefined
    || new Set(Object.values(surfaces)).size !== CARTOGRAPHY_SURFACE_ROLES.length) return null;
  const missionMapDispatcherSlot = onlySlot(module, missionMapDispatcher);
  const worldMapDispatcherSlot = onlySlot(module, worldMapDispatcher);
  if (missionMapDispatcherSlot === null || worldMapDispatcherSlot === null) return null;

  return Object.freeze({
    contextRoot: playRegion.contextRoot,
    agentArray: observation.agentArray,
    frameArray: preGame.layout.frameArray,
    frameCount: preGame.layout.frameCount,
    areaInfo: playRegion.areaInfo,
    surfaces: Object.freeze({
      compassRender, compassMapRender, missionMapDispatcher, missionMapGameplayContext, worldMapDispatcher,
    }),
    missionMapDispatcherSlot,
    worldMapDispatcherSlot,
  });
}
