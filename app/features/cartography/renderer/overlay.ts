/**
 * Owns presentation of immutable Cartography models through independent surfaces.
 * Native observation and semantic classification never occur on animation frames.
 */
import { disposeCartographyResources } from "./cartography-lifecycle.js";
import { resolveCartographyPreset } from "../../../shared/cartography-presets.js";
import { featureRegionAllowsRequest } from "../../../shared/feature-contracts.js";
import type { RuntimePlayRegion } from "../../../renderer/enhancement-runtime-policy.js";
import type {
  CartographyEvidenceCapture,
  CartographyEvidenceExportResult,
} from "../../../shared/cartography-evidence.js";
import type { RendererSettingsPatch } from "../../../shared/contracts.js";
import type { AppSettings } from "../../../shared/settings/index.js";
import type { CartographyMapKnowledge } from
  "../../../shared/cartography-map-knowledge.js";
import {
  bitsetHasCell,
  readCartographyState,
  readCartographyPresentation,
  type CartographyModelSources,
  type CartographyPresentation,
  type CartographyState,
} from "./cartography-model.js";
import {
  createCartographyGridLayer,
  type CartographyGridLayerSnapshot,
} from "./cartography-grid-layer.js";
import {
  cartographyCellAtScreenPoint,
  cartographyMapPointAtScreenPoint,
  projectCartographyGridToMissionMap,
  projectCartographyGridToWorldMap,
  type CartographyGridProjection,
} from "./cartography-grid-projection.js";
import { createRouteTracker, routeChoice, routeFrom, routeInMapUnits, type RouteChoice, type RouteGoal, type RouteView } from "./route-path.js";
import type { CartographyQuestMarker } from "./cartography-player-state.js";
import { createRouteLayer, type RouteDrawing } from "./route-paint.js";
import { cartographyHoverRevealRadius } from "./cartography-paint.js";
import { projectMissionMapFrame, projectNativeFrame } from "./frame-placement.js";
import { createInverseMaskLayer } from "./inverse-mask-layer.js";
import { nativeMapTileProjection, nativeMapHoverProjection } from "./native-map-tile.js";
import type { createNativeCompassRangesLayer } from "./native-compass-ranges-layer.js";
import type { NativeMapGraphicsLayer } from "./native-map-graphics-layer.js";
import type { NativeCompassTerrainLayer } from "./native-compass-terrain-layer.js";
import {
  projectMissionMapContentBox,
} from "./map-projections.js";
import { captureCartographyEvidence } from "./evidence-capture.js";
import {
  createCartographyOverlayControls,
  type CartographyQaStatus,
} from "./overlay-controls.js";
import {
  createCompassRangeControls,
  visibleCompassRanges,
} from "./compass-range-controls.js";
import type { CompassRangeId } from "../../../shared/compass-ranges.js";
import {
  createCompassRangeLayer,
  type CompassRangeLayerSnapshot,
} from "./compass-range-layer.js";
import {
  createWalkableTerrainSurface,
  type WalkableTerrainSurface,
} from "./walkable-terrain-surface.js";
import {
  cartographyKnowledgeWordsFingerprint,
  mergeCartographyMapKnowledge,
} from "./map-knowledge.js";

const MODEL_POLL_MS = 200;
/**
 * Game units walked before a surface redraws the route from the player's place
 * on it. Each redraw uploads that surface's whole texture, so the larger maps
 * redraw less often; the line behind the player stays shorter than this.
 */
const ROUTE_REDRAW_UNITS = Object.freeze({ compass: 400, missionMap: 1_000, worldMap: 4_000 });
/** A right-click this close to the target, in screen pixels, removes it. */
const ROUTE_TARGET_HIT_PIXELS = 14;
/** A right press held longer than this, or moved further, is a drag, not a target. */
const ROUTE_CLICK_MS = 400;
const ROUTE_CLICK_SLOP_PIXELS = 5;

export type CartographyGridStats = Readonly<{
  compass: CartographyGridLayerSnapshot | null;
  missionMap: CartographyGridLayerSnapshot | null;
  worldMap: CartographyGridLayerSnapshot | null;
}>;

export type CartographyModelStats = CartographyQaStatus;
export type CompassRangeStats = CompassRangeLayerSnapshot;

function countSetBits(words: Uint32Array): number {
  let count = 0;
  for (const source of words) {
    let word = source;
    while (word !== 0) {
      word &= word - 1;
      count += 1;
    }
  }
  return count;
}

function bitsetsEqual(
  left: Readonly<{ width: number; height: number; words: Uint32Array }>,
  right: Readonly<{ width: number; height: number; words: Uint32Array }>,
): boolean {
  return left.width === right.width
    && left.height === right.height
    && left.words.length === right.words.length
    && left.words.every((word, index) => word === right.words[index]);
}

export type CartographyOverlayDisposition = "hidden" | "controls-only" | "layers";

/**
 * Decide the whole overlay surface policy from the live play region and the
 * canonical model state. Outside the region the Maps manifest allows (PvE),
 * every Maps surface is hidden, its controls included.
 */
export function cartographyOverlayDisposition(
  state: CartographyState,
  playRegion: RuntimePlayRegion,
): CartographyOverlayDisposition {
  if (!featureRegionAllowsRequest("cartography", playRegion)) return "hidden";
  if (state.continent.status === "ready" || state.currentInstance.status === "ready") {
    return "layers";
  }
  return "controls-only";
}

/**
 * The overlay's per-frame gate. It answers the disposition and withdraws every
 * surface once, on the frame Maps becomes hidden; hidden frames after that do
 * no work, and the next visible frame re-arms it.
 */
export function createCartographyOverlayGate(withdraw: () => void) {
  let withdrawn = false;
  return (state: CartographyState, playRegion: RuntimePlayRegion): CartographyOverlayDisposition => {
    const disposition = cartographyOverlayDisposition(state, playRegion);
    if (disposition !== "hidden") withdrawn = false;
    else if (!withdrawn) {
      withdrawn = true;
      withdraw();
    }
    return disposition;
  };
}

export function mountCartographyOverlay(options: Readonly<{
  compassTerrainLayer: NativeCompassTerrainLayer;
  nativeMapGraphics: NativeMapGraphicsLayer;
  nativeCompassRanges: ReturnType<typeof createNativeCompassRangesLayer>;
  parent: HTMLElement;
  canvas: HTMLCanvasElement;
  modelSources: CartographyModelSources;
  /** The live play region; the overlay hides while Maps' manifest does not allow it. */
  playRegion(): RuntimePlayRegion;
  /** The active quest's marker from Progress, on the map it was read in. */
  questMarker(): CartographyQuestMarker | null;
  settings(): AppSettings;
  persist(patch: RendererSettingsPatch): Promise<AppSettings>;
  exportEvidence(
    capture: CartographyEvidenceCapture,
  ): Promise<CartographyEvidenceExportResult>;
  initialMapKnowledge: readonly CartographyMapKnowledge[];
  recordMapKnowledge(
    value: CartographyMapKnowledge,
  ): Promise<readonly CartographyMapKnowledge[]>;
}>): () => void {
  const document = options.parent.ownerDocument;
  const view = document.defaultView;
  if (view === null) throw new Error("cartography overlay requires a live document");
  const cleanup: (() => void)[] = [];
  const dispose = () => disposeCartographyResources(cleanup);
  try {
    const compassTerrainLayer = options.compassTerrainLayer;
    const missionTerrainLayer = createInverseMaskLayer(document);
    cleanup.push(() => missionTerrainLayer.dispose());
    const missionGridLayer = createCartographyGridLayer(document);
    cleanup.push(() => missionGridLayer.dispose());
    const worldGridLayer = createCartographyGridLayer(document);
    cleanup.push(() => worldGridLayer.dispose());
    const missionHoverLayer = createCartographyGridLayer(document, true);
    cleanup.push(() => missionHoverLayer.dispose());
    const worldHoverLayer = createCartographyGridLayer(document, true);
    cleanup.push(() => worldHoverLayer.dispose());
    const missionRouteLayer = createRouteLayer(document);
    cleanup.push(() => missionRouteLayer.dispose());
    const worldRouteLayer = createRouteLayer(document);
    cleanup.push(() => worldRouteLayer.dispose());
    const compassRangeLayer = createCompassRangeLayer(options.parent);
    cleanup.push(() => compassRangeLayer.dispose());
    const previewRangeOpacity = new Map<CompassRangeId, number>();
    const compassRangeControls = createCompassRangeControls({
      parent: options.parent,
      persist: options.persist,
      previewOpacity(id, opacity) {
        if (opacity === null) previewRangeOpacity.delete(id);
        else previewRangeOpacity.set(id, opacity);
      },
    });
    cleanup.push(() => compassRangeControls.dispose());
    let previewGridOpacity: number | null = null;
    let previewWalkabilityOpacity: number | null = null;
    const controls = createCartographyOverlayControls({
      parent: options.parent,
      persist: options.persist,
      previewOpacity(layer, opacity) {
        if (layer === "grid") previewGridOpacity = opacity;
        else previewWalkabilityOpacity = opacity;
      },
      exportEvidence: () => options.exportEvidence(
        captureCartographyEvidence(state, options.modelSources),
      ),
    });

    cleanup.push(() => controls.dispose());

    let animationFrame = 0;
    let startupTimer = 0;
    let disposed = false;
    cleanup.push(() => {
      disposed = true;
      if (startupTimer !== 0) view.clearTimeout(startupTimer);
      view.cancelAnimationFrame(animationFrame);
    });
    let state: CartographyState = Object.freeze({
      context: null,
      continent: Object.freeze({ status: "unavailable", reason: "context" }),
      currentInstance: Object.freeze({ status: "unavailable", reason: "context" }),
      surfaces: Object.freeze({ compass: null, missionMap: null, worldMap: null }),
    });
    let presentation: CartographyPresentation = Object.freeze({
      player: null,
      compass: null,
      missionMap: null,
      worldMap: null,
    });
    let nextModelPoll = 0;
    let explorationVersion = 0;
    let actionabilityVersion = 0;
    let mapKnowledge = options.initialMapKnowledge;
    let mapKnowledgeVersion = 0;
    let mapKnowledgeProjectionKey = "";
    let rememberedReachable: Readonly<{
      width: number;
      height: number;
      words: Uint32Array;
    }> | null = null;
    let requestedKnowledgeKey = "";
    let knowledgeWrites: Promise<void> = Promise.resolve();
    let terrainKey = "";
    let terrain: WalkableTerrainSurface | null = null;
    let pointerX = Number.NaN;
    let pointerY = Number.NaN;
    let shiftHeld = false;
    let optionHeld = false;
    // The walking route: the point the player set, in continent map units so it
    // outlives travel to the next area, and the map projections a right-click is
    // resolved through. Without one, the route leads to the active quest's marker.
    let routeGoal: RouteGoal | null = null;
    let routeLead: RouteChoice | null = null;
    let routeView: RouteView | null = null;
    const routeDrawings = new Map<number, RouteDrawing>();
    let missionPointProjection: CartographyGridProjection | null = null;
    let worldPointProjection: CartographyGridProjection | null = null;
    const routeTracker = createRouteTracker((target) => {
      const companion = options.modelSources.companion();
      if (state.context === null || companion?.status !== "ready") return null;
      return options.modelSources.kernel.route({
        layoutId: state.context.layoutId, mapId: target.mapId, areaEpoch: target.areaEpoch,
        playerId: companion.playerId, targetX: target.x, targetY: target.y,
      });
    });

    const rememberPointer = (event: PointerEvent): void => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      shiftHeld = event.shiftKey;
      optionHeld = event.altKey;
    };
    const rememberModifiers = (event: KeyboardEvent): void => {
      shiftHeld = event.shiftKey;
      optionHeld = event.altKey;
    };
    const forgetPointer = (): void => {
      pointerX = Number.NaN;
      pointerY = Number.NaN;
      shiftHeld = false;
      optionHeld = false;
    };
    const forgetHiddenPointer = (): void => {
      if (document.visibilityState === "hidden") forgetPointer();
    };
    // A right-click on the Mission Map or World Map sets the route target; one on
    // the target removes it. A right-drag over a map pans it, and elsewhere turns the
    // camera, so only a short right click that stays in place counts, at the place it
    // was pressed. Both listeners are passive: the game still gets every press and release.
    let rightPress: Readonly<{ x: number; y: number; at: number }> | null = null;
    const rememberRightPress = (event: PointerEvent): void => {
      rightPress = event.button === 2 ? { x: event.clientX, y: event.clientY, at: event.timeStamp } : null;
    };
    const placeRouteTarget = (event: PointerEvent): void => {
      const press = rightPress;
      rightPress = null;
      if (event.button !== 2 || press === null || !options.settings().cartographyRouteEnabled) return;
      if (event.timeStamp - press.at > ROUTE_CLICK_MS) return;
      if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > ROUTE_CLICK_SLOP_PIXELS) return;
      const current = state.currentInstance;
      if (current.status !== "ready") return;
      // The World Map opens over the Mission Map, so it answers first.
      const projection = [worldPointProjection, missionPointProjection].find((candidate) =>
        candidate !== null && cartographyMapPointAtScreenPoint(candidate, press.x, press.y) !== null) ?? null;
      const point = projection === null ? null : cartographyMapPointAtScreenPoint(projection, press.x, press.y);
      if (projection === null || point === null) return;
      if (routeGoal !== null) {
        // Mission and World Map transforms never rotate (b = c = 0).
        const { box, transform } = projection;
        const x = box.left + transform.a * routeGoal.x + transform.e;
        const y = box.top + transform.d * routeGoal.y + transform.f;
        if (Math.hypot(x - press.x, y - press.y) <= ROUTE_TARGET_HIT_PIXELS) {
          routeGoal = null;
          return;
        }
      }
      routeGoal = Object.freeze({ continent: current.continent, x: point.x, y: point.y });
    };
    view.addEventListener("pointerdown", rememberRightPress, { capture: true, passive: true });
    view.addEventListener("pointerup", placeRouteTarget, { capture: true, passive: true });
    view.addEventListener("pointermove", rememberPointer, { capture: true, passive: true });
    view.addEventListener("keydown", rememberModifiers, true);
    view.addEventListener("keyup", rememberModifiers, true);
    view.addEventListener("blur", forgetPointer);
    document.addEventListener("visibilitychange", forgetHiddenPointer);

    cleanup.push(() => {
      view.removeEventListener("pointerdown", rememberRightPress, true);
      view.removeEventListener("pointerup", placeRouteTarget, true);
      view.removeEventListener("pointermove", rememberPointer, true);
      view.removeEventListener("keydown", rememberModifiers, true);
      view.removeEventListener("keyup", rememberModifiers, true);
      view.removeEventListener("blur", forgetPointer);
      document.removeEventListener("visibilitychange", forgetHiddenPointer);
    });
    cleanup.push(() => compassTerrainLayer.hide());
    const hideCompassLayers = (): void => {
      compassTerrainLayer.hide();
    };
    const hideMission = (): void => {
      options.nativeMapGraphics.hide("mission");
      options.nativeMapGraphics.hide("mission_hover");
      missionHoverLayer.hide();
      missionGridLayer.hide();
      missionTerrainLayer.hide();
      missionRouteLayer.hide();
      missionPointProjection = null;
    };
    const hideWorld = (): void => {
      options.nativeMapGraphics.hide("world");
      options.nativeMapGraphics.hide("world_hover");
      worldHoverLayer.hide();
      worldGridLayer.hide();
      worldRouteLayer.hide();
      worldPointProjection = null;
    };
    const hideAllLayers = (): void => {
      hideCompassLayers();
      hideMission();
      hideWorld();
    };
    const gridStats = (): CartographyGridStats => {
      return Object.freeze({
        compass: compassTerrainLayer.gridSnapshot(),
        missionMap: missionGridLayer.snapshot(),
        worldMap: worldGridLayer.snapshot(),
      });
    };
    view.gwCartographyGridStats = gridStats;
    cleanup.push(() => { if (view.gwCartographyGridStats === gridStats) delete view.gwCartographyGridStats; });
    const rangeStats = (): CompassRangeStats => compassRangeLayer.snapshot();
    view.gwCompassRangeStats = rangeStats;
    cleanup.push(() => { if (view.gwCompassRangeStats === rangeStats) delete view.gwCompassRangeStats; });
    const modelStats = (): CartographyModelStats => Object.freeze({
      continent: state.continent.status === "ready"
        ? Object.freeze({
            status: "ready" as const,
            continentId: state.continent.continent,
            exploredCreditableCells: countSetBits(state.continent.exploredCreditable.words),
            remainingCells: countSetBits(state.continent.remaining.words),
          })
        : state.continent,
      currentInstance: state.currentInstance.status === "ready"
        ? Object.freeze({
            status: "ready" as const,
            sequence: state.currentInstance.sequence,
            mapId: state.currentInstance.epoch.mapId,
            areaEpoch: state.currentInstance.epoch.area,
            resourceGeneration: state.currentInstance.epoch.resource,
            terrain: Object.freeze({
              width: state.currentInstance.walkableTerrain.width,
              height: state.currentInstance.walkableTerrain.height,
              mapUnitsPerPixel: state.currentInstance.walkableTerrain.mapUnitsPerPixel,
            }),
            reachableCells: countSetBits(state.currentInstance.reachableCells.words),
            guidance: state.currentInstance.guidance.status === "ready"
              ? Object.freeze({
                  status: "ready" as const,
                  actionableCells: countSetBits(
                    state.currentInstance.guidance.actionableCells.words,
                  ),
                })
              : state.currentInstance.guidance,
          })
        : state.currentInstance,
      compassReady: presentation.compass !== null,
      missionMapReady: presentation.missionMap !== null
        && (state.continent.status === "ready" || state.currentInstance.status === "ready"),
      worldMapReady: worldGridLayer.snapshot() !== null,
      worldMapObserver: options.modelSources.worldMap.diagnostics(),
      kernel: options.modelSources.kernel.diagnostic(),
    });
    view.gwCartographyModelStats = modelStats;
    cleanup.push(() => { if (view.gwCartographyModelStats === modelStats) delete view.gwCartographyModelStats; });
    const routeStats = () => options.modelSources.kernel.routeDiagnostic();
    view.gwCartographyRouteStats = routeStats;
    cleanup.push(() => { if (view.gwCartographyRouteStats === routeStats) delete view.gwCartographyRouteStats; });

    /**
     * What one surface draws of the route, in map units: the line from the
     * player's place on it, moved forward in steps of `quantum` game units, and
     * the target. Without a searched line the target still shows.
     */
    const routeDrawing = (quantum: number): RouteDrawing | undefined => {
      const current = state.currentInstance;
      if (routeLead === null || current.status !== "ready") return undefined;
      const { goal: { x: targetX, y: targetY }, kind } = routeLead;
      const step = routeView === null ? -1 : Math.floor(routeView.along / quantum);
      const version = [routeView?.path.version ?? "none", step, targetX, targetY, kind].join(":");
      const cached = routeDrawings.get(quantum);
      if (cached?.version === version) return cached;
      const points = routeView === null
        ? new Float32Array(0)
        : routeInMapUnits(routeFrom(routeView.path, step * quantum), current.worldAnchor);
      const drawing = Object.freeze({
        version, points, kind, reached: routeView?.path.reached ?? true, target: Object.freeze({ x: targetX, y: targetY }),
      });
      routeDrawings.set(quantum, drawing);
      return drawing;
    };

    const safe = (surface: "compass" | "mission-map" | "world-map", render: () => void): void => {
      try {
        render();
      } catch (cause) {
        if (surface === "compass") hideCompassLayers();
        else if (surface === "mission-map") hideMission();
        else hideWorld();
        console.error(`[cartography] ${surface} rendering failed`, cause);
      }
    };

    const rememberCurrentMap = (
      current: Extract<CartographyState["currentInstance"], { status: "ready" }>,
      revealRadius: 1 | 3,
    ): void => {
      const kernelSha256 = options.modelSources.kernel.sha256;
      if (kernelSha256 === null) return;
      const wordsFingerprint = cartographyKnowledgeWordsFingerprint(current.reachableCells.words);
      const key = [
        current.epoch.mapId,
        current.continent,
        current.reachableCells.width,
        current.reachableCells.height,
        revealRadius,
        current.epoch.resource,
        wordsFingerprint,
      ].join(":");
      if (key === requestedKnowledgeKey) return;
      requestedKnowledgeKey = key;
      const record = Object.freeze({
        kernelSha256,
        mapId: current.epoch.mapId,
        continent: current.continent,
        width: current.reachableCells.width,
        height: current.reachableCells.height,
        revealRadius,
        words: Object.freeze(Array.from(current.reachableCells.words)),
      });
      knowledgeWrites = knowledgeWrites.then(async () => {
        mapKnowledge = await options.recordMapKnowledge(record);
        mapKnowledgeVersion += 1;
      }).catch((cause) => {
        if (requestedKnowledgeKey === key) requestedKnowledgeKey = "";
        console.error("[cartography] could not remember current map knowledge", cause);
      });
    };

    const gate = createCartographyOverlayGate((): void => {
      controls.hide();
      compassRangeControls.hide();
      compassRangeLayer.update(null, [], options.settings().compassRangeTheme);
      safe("compass", () => options.nativeCompassRanges.update(null, 0));
      terrainKey = "";
      terrain = null;
      hideAllLayers();
    });

    const render = (): void => {
      const playRegion = options.playRegion();
      if (gate(state, playRegion) === "hidden") return;
      const now = view.performance.now();
      if (now >= nextModelPoll) {
        const previous = state;
        const next = readCartographyState(options.modelSources);
        if (next.continent.status === "ready") {
          if (
            previous.continent.status !== "ready"
            || previous.continent.generation !== next.continent.generation
            || !bitsetsEqual(previous.continent.explored, next.continent.explored)
          ) explorationVersion += 1;
        }
        if (next.currentInstance.status === "ready") {
          const previousGuidance = previous.currentInstance.status === "ready"
            ? previous.currentInstance.guidance
            : null;
          const nextGuidance = next.currentInstance.guidance;
          if (
            previousGuidance === null
            || previousGuidance.status !== nextGuidance.status
            || previousGuidance.status === "ready" && nextGuidance.status === "ready"
              && !bitsetsEqual(
                previousGuidance.actionableCells,
                nextGuidance.actionableCells,
              )
          ) actionabilityVersion += 1;
        }
        state = next;
        if (
          state.continent.status === "ready"
          && state.currentInstance.status === "ready"
          && state.currentInstance.guidance.status === "ready"
        ) {
          rememberCurrentMap(
            state.currentInstance,
            options.settings().cartographyRevealMode === "birds-eye" ? 3 : 1,
          );
        }
        controls.updateQaStatus(modelStats());
        nextModelPoll = now + MODEL_POLL_MS;
      }
      presentation = readCartographyPresentation(state, options.modelSources);
      const settings = options.settings();
      const style = resolveCartographyPreset(settings.cartographyPresetLibrary);
      const canvasBox = options.canvas.getBoundingClientRect();
      const compass = options.modelSources.compass.snapshot();
      const controlBox = compass === null ? null : projectNativeFrame(compass, canvasBox);
      const rangesAvailable = options.nativeCompassRanges.available();
      const mapsAvailable = compassTerrainLayer.available()
        || options.nativeMapGraphics.available("mission") || options.nativeMapGraphics.available("world");
      compassRangeLayer.update(rangesAvailable ? controlBox : null, visibleCompassRanges(
        settings,
        (id) => previewRangeOpacity.get(id) ?? null,
      ), settings.compassRangeTheme);
      safe("compass", () => options.nativeCompassRanges.update(compassRangeLayer.image(), compass?.generation ?? 0));
      if (controlBox === null) {
        controls.hide();
        compassRangeControls.hide();
      } else if (style === null || !mapsAvailable) {
        controls.hide();
        if (rangesAvailable) compassRangeControls.update(controlBox, settings, { index: 0, count: 1 });
        else compassRangeControls.hide();
      } else {
        controls.update(controlBox, settings, { index: 0, count: rangesAvailable ? 2 : 1 });
        if (rangesAvailable) compassRangeControls.update(controlBox, settings, { index: 1, count: 2 });
        else compassRangeControls.hide();
      }
      const disposition = cartographyOverlayDisposition(state, playRegion);
      if (disposition !== "layers") {
        terrainKey = "";
        terrain = null;
        hideAllLayers();
        return;
      }
      if (style === null) {
        hideAllLayers();
        return;
      }
      const currentInstance = state.currentInstance;
      // Turning the route off forgets the target; so does another continent. Travel
      // within the continent keeps it, and the next area searches toward it again.
      // The player's own target wins; without one the route leads to the quest.
      if (!settings.cartographyRouteEnabled) routeGoal = null;
      routeLead = null;
      if (currentInstance.status === "ready") {
        const quest = settings.cartographyRouteEnabled && settings.cartographyQuestRouteEnabled
          ? options.questMarker() : null;
        ({ own: routeGoal, route: routeLead } = routeChoice(routeGoal, quest, { mapId: currentInstance.epoch.mapId,
          areaEpoch: currentInstance.epoch.area, continent: currentInstance.continent, worldAnchor: currentInstance.worldAnchor }));
      }
      routeView = currentInstance.status === "ready" && presentation.player !== null
        ? routeTracker.update({ now, target: routeLead?.target ?? null, player: presentation.player })
        : null;
      const gridOpacity = previewGridOpacity ?? settings.cartographyGridOpacity;
      const walkabilityOpacity = previewWalkabilityOpacity
        ?? settings.cartographyWalkabilityOpacity;
      const revealRadius = settings.cartographyRevealMode === "birds-eye" ? 3 : 1;
      const reachRadius = settings.cartographyRevealMode === "off" ? 0 : revealRadius;
      const explorationKey = `${state.continent.status === "ready"
        ? `${state.continent.continent}:${state.continent.generation}`
        : "unavailable"}:${explorationVersion}`;
      const nextMapKnowledgeProjectionKey = state.continent.status === "ready"
        ? [
            state.continent.continent,
            state.continent.explored.width,
            state.continent.explored.height,
            revealRadius,
            mapKnowledgeVersion,
          ].join(":")
        : "";
      if (nextMapKnowledgeProjectionKey !== mapKnowledgeProjectionKey) {
        const kernelSha256 = options.modelSources.kernel.sha256;
        const words = state.continent.status === "ready" && kernelSha256 !== null
          ? mergeCartographyMapKnowledge(mapKnowledge, {
              kernelSha256,
              continent: state.continent.continent,
              width: state.continent.explored.width,
              height: state.continent.explored.height,
              revealRadius,
            })
          : null;
        rememberedReachable = state.continent.status === "ready" && words !== null
          ? Object.freeze({
              width: state.continent.explored.width,
              height: state.continent.explored.height,
              words,
            })
          : null;
        mapKnowledgeProjectionKey = nextMapKnowledgeProjectionKey;
      }
      const actionabilityKey = [
        state.currentInstance.status === "ready" ? state.currentInstance.epoch.mapId : "-",
        state.currentInstance.status === "ready" ? state.currentInstance.epoch.area : "-",
        state.currentInstance.status === "ready" ? state.currentInstance.epoch.resource : "-",
        actionabilityVersion,
        mapKnowledgeVersion,
      ].join(":");
      const nextTerrainKey = state.currentInstance.status === "ready"
        ? `${state.currentInstance.epoch.area}:${state.currentInstance.epoch.resource}`
        : "";
      if (nextTerrainKey !== terrainKey) {
        terrain = state.currentInstance.status === "ready"
          ? createWalkableTerrainSurface(document, state.currentInstance.walkableTerrain)
          : null;
        terrainKey = terrain === null ? "" : nextTerrainKey;
      }
      const isExplored = (x: number, y: number): boolean | null => {
        if (state.continent.status !== "ready") return null;
        return bitsetHasCell(state.continent.explored, { x, y });
      };
      const isRemaining = (x: number, y: number): boolean | null => {
        if (state.continent.status !== "ready") return null;
        return bitsetHasCell(state.continent.remaining, { x, y });
      };
      const canCurrentMapReveal = (x: number, y: number): boolean | null => {
        if (
          state.currentInstance.status !== "ready"
          || state.currentInstance.guidance.status !== "ready"
        ) return null;
        return bitsetHasCell(state.currentInstance.reachableCells, { x, y });
      };
      const canVisitedMapReveal = (x: number, y: number): boolean | null => {
        if (rememberedReachable === null) return null;
        return bitsetHasCell(rememberedReachable, { x, y });
      };
      safe("compass", () => {
        if (
          !compassTerrainLayer.available()
          || state.currentInstance.status !== "ready"
          || presentation.compass === null
          || presentation.player === null
        ) {
          hideCompassLayers();
          return;
        }
        const compass = presentation.compass;
        const box = projectNativeFrame(compass, canvasBox);
        if (box === null) {
          hideCompassLayers();
          return;
        }
        const cartography = settings.cartographyGridEnabled && settings.cartographyCompassGridEnabled
          && state.continent.status === "ready" ? {
            style: style.grid, opacity: gridOpacity, explorationVersion: explorationKey,
            isExplored, isRemaining, revealabilityVersion: actionabilityKey, canCurrentMapReveal, canVisitedMapReveal,
          } : undefined;
        const route = routeDrawing(ROUTE_REDRAW_UNITS.compass);
        if ((settings.cartographyOverlayEnabled && terrain !== null) || cartography || route) {
          compassTerrainLayer.update({
            area: state.currentInstance.epoch.area,
            version: nextTerrainKey, terrain: settings.cartographyOverlayEnabled ? terrain : null,
            anchorX: state.currentInstance.worldAnchor.x,
            anchorY: state.currentInstance.worldAnchor.y,
            scaleX: box.width / (compass.right - compass.left),
            scaleY: box.height / (compass.top - compass.bottom),
            style: style.walkability,
            opacity: settings.cartographyOverlayEnabled ? walkabilityOpacity : 0,
            ...(cartography ? {cartography, inspectionRadius: reachRadius} : {}),
            ...(route ? { route } : {}),
          });
        } else compassTerrainLayer.hide();
      });

      safe("mission-map", () => {
        if (
          !options.nativeMapGraphics.available("mission")
          || presentation.compass === null
          || presentation.missionMap === null
        ) {
          hideMission();
          return;
        }
        const mission = presentation.missionMap;
        const outerBox = projectMissionMapFrame(
          mission,
          presentation.compass,
          canvasBox,
        );
        const box = outerBox === null ? null : projectMissionMapContentBox(mission, outerBox);
        if (box === null) {
          hideMission();
          return;
        }
        const mapProjection = projectCartographyGridToMissionMap({ frame: mission, box });
        const tileProjection = mapProjection === null ? null : nativeMapTileProjection(mapProjection);
        missionPointProjection = mapProjection;
        if (settings.cartographyGridEnabled && state.continent.status === "ready") {
          if (mapProjection === null || tileProjection === null) {
            missionGridLayer.hide();
            missionHoverLayer.hide(); options.nativeMapGraphics.hide("mission_hover");
          }
          else {
            const hoveredCell = cartographyCellAtScreenPoint(mapProjection, pointerX, pointerY);
            missionGridLayer.update({
              projection: tileProjection,
              style: style.grid,
              opacity: gridOpacity,
              explorationVersion: explorationKey,
              isExplored,
              isRemaining,
              revealabilityVersion: actionabilityKey,
              canCurrentMapReveal,
              canVisitedMapReveal,
              hoveredCell: null, revealRadius: 0, reachRadius,
            });
            if (hoveredCell && options.nativeMapGraphics.available("mission_hover")) {
              const hoverProjection = nativeMapHoverProjection(mapProjection, hoveredCell, cartographyHoverRevealRadius(shiftHeld, optionHeld));
              missionHoverLayer.update({projection: hoverProjection, style: style.grid, opacity: gridOpacity,
                explorationVersion: explorationKey, revealabilityVersion: actionabilityKey, isExplored, isRemaining,
                canCurrentMapReveal, canVisitedMapReveal, hoveredCell, revealRadius: cartographyHoverRevealRadius(shiftHeld, optionHeld), reachRadius: 0});
              options.nativeMapGraphics.update("mission_hover", {area: mission.generation, continent: state.continent.continent,
                projection: hoverProjection, images: [missionHoverLayer.image()]});
            } else { missionHoverLayer.hide(); options.nativeMapGraphics.hide("mission_hover"); }
          }
        } else { missionGridLayer.hide(); missionHoverLayer.hide(); options.nativeMapGraphics.hide("mission_hover"); }
        if (
          settings.cartographyOverlayEnabled
          && state.currentInstance.status === "ready"
          && terrain !== null
        ) {
          const projection = tileProjection === null ? null : {box: tileProjection.box, clip: tileProjection.clip,
            transform: {a: tileProjection.transform.a * terrain.mapUnitsPerPixel, b: 0, c: 0,
              d: tileProjection.transform.d * terrain.mapUnitsPerPixel,
              e: tileProjection.transform.e + terrain.mapLeft * tileProjection.transform.a,
              f: tileProjection.transform.f + terrain.mapTop * tileProjection.transform.d}};
          if (projection === null) missionTerrainLayer.hide();
          else missionTerrainLayer.update({
            projection,
            terrain,
            version: nextTerrainKey,
            style: style.walkability,
            opacity: walkabilityOpacity,
          });
        } else missionTerrainLayer.hide();
        const missionRoute = routeDrawing(ROUTE_REDRAW_UNITS.missionMap);
        if (missionRoute && tileProjection !== null) missionRouteLayer.update({ projection: tileProjection, drawing: missionRoute });
        else missionRouteLayer.hide();
        if (tileProjection === null) options.nativeMapGraphics.hide("mission");
        else options.nativeMapGraphics.update("mission", {
          area: mission.generation, continent: state.continent.status === "ready" ? state.continent.continent : 0,
          projection: tileProjection, images: [missionTerrainLayer.image(), missionGridLayer.image(), missionRouteLayer.image()],
        });
      });

      safe("world-map", () => {
        if (
          !options.nativeMapGraphics.available("world")
          || presentation.compass === null
          || presentation.worldMap === null
          || state.continent.status !== "ready"
          || presentation.worldMap.continent !== state.continent.continent
        ) {
          hideWorld();
          return;
        }
        const world = presentation.worldMap;
        const box = projectMissionMapFrame(world, presentation.compass, canvasBox);
        const mapProjection = box === null
          ? null
          : projectCartographyGridToWorldMap({ frame: world, box });
        // The route shows on the World Map with or without the exploration grid.
        const worldRoute = routeDrawing(ROUTE_REDRAW_UNITS.worldMap);
        if ((!settings.cartographyGridEnabled && !worldRoute) || mapProjection === null) {
          hideWorld();
          // Nothing to draw yet, but a right-click must still find the map to set the first target.
          if (settings.cartographyRouteEnabled) worldPointProjection = mapProjection;
          return;
        }
        worldPointProjection = mapProjection;
        const hoveredCell = settings.cartographyGridEnabled
          ? cartographyCellAtScreenPoint(mapProjection, pointerX, pointerY)
          : null;
        const tileProjection = nativeMapTileProjection(mapProjection);
        if (settings.cartographyGridEnabled) worldGridLayer.update({
          projection: tileProjection,
          style: style.grid,
          opacity: gridOpacity,
          explorationVersion: explorationKey,
          isExplored,
          isRemaining,
          revealabilityVersion: actionabilityKey,
          canCurrentMapReveal,
          canVisitedMapReveal,
          hoveredCell: null, revealRadius: 0, reachRadius,
        });
        else worldGridLayer.hide();
        if (worldRoute) worldRouteLayer.update({ projection: tileProjection, drawing: worldRoute });
        else worldRouteLayer.hide();
        options.nativeMapGraphics.update("world", { area: world.generation, continent: world.continent,
          projection: tileProjection, images: [worldGridLayer.image(), worldRouteLayer.image()],
        });
        if (hoveredCell && options.nativeMapGraphics.available("world_hover")) {
          const hoverProjection = nativeMapHoverProjection(mapProjection, hoveredCell, cartographyHoverRevealRadius(shiftHeld, optionHeld));
          worldHoverLayer.update({projection: hoverProjection, style: style.grid, opacity: gridOpacity,
            explorationVersion: explorationKey, revealabilityVersion: actionabilityKey, isExplored, isRemaining,
            canCurrentMapReveal, canVisitedMapReveal, hoveredCell, revealRadius: cartographyHoverRevealRadius(shiftHeld, optionHeld), reachRadius: 0});
          options.nativeMapGraphics.update("world_hover", {area: world.generation, continent: world.continent,
            projection: hoverProjection, images: [worldHoverLayer.image()]});
        } else { worldHoverLayer.hide(); options.nativeMapGraphics.hide("world_hover"); }
      });
    };

    const update = (): void => {
      if (disposed) return;
      render();
      if (!disposed) animationFrame = view.requestAnimationFrame(update);
    };
    startupTimer = view.setTimeout(() => {
      startupTimer = 0;
      if (!disposed) animationFrame = view.requestAnimationFrame(update);
    });

    return dispose;
  } catch (cause) {
    try { dispose(); } catch (cleanupError) {
      throw new AggregateError([cause, cleanupError], "Maps presentation and cleanup failed", {cause: cleanupError});
    }
    throw cause;
  }
}
