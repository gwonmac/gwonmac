/**
 * Owns Cartography installation behind one observer, model, kernel, and UI lifecycle.
 * Partial installation is rolled back before control returns to the Maps host.
 */
import { createNativeCompassRangesLayer } from "./native-compass-ranges-layer.js";
import { createNativeMapGraphicsLayer } from "./native-map-graphics-layer.js";
import { createNativeCompassTerrainLayer } from "./native-compass-terrain-layer.js";
import type {
  CartographyEvidenceCapture,
  CartographyEvidenceExportResult,
} from "../../../shared/cartography-evidence.js";
import type { RendererSettingsPatch } from "../../../shared/contracts.js";
import type { AppSettings } from "../../../shared/settings/index.js";
import type { CartographyMapKnowledge } from
  "../../../shared/cartography-map-knowledge.js";
import type {
  CompassFrameController,
  MissionMapFrameController,
  WorldMapFrameController,
  WorldMapFrameDiagnostic,
} from "../../../shared/cartography-spike.js";
import { disposeCartographyResources } from "./cartography-lifecycle.js";
import { readCartographyPlayRegion, readCartographyPlayerState, readCartographyQuestMarker } from "./cartography-player-state.js";
import { createCartographyContextReader } from "./context-observer.js";
import { createExplorationReader } from "./exploration-observer.js";
import {
  createCompassFrameReader,
  createMissionMapFrameReader,
  createWorldMapFrameReader,
} from "./frame-observer.js";
import { mountCartographyOverlay } from "./overlay.js";
import { decodeCartographyManifest } from "./cartography-manifest.js";
import { installCartographyReachabilityKernel } from "./reachability-kernel.js";
import { createWorldMapAnchorReader } from "./world-map-anchor-observer.js";

const unavailableCompass = Object.freeze({
  snapshot: () => null,
}) satisfies CompassFrameController;

const unavailableMissionMap = Object.freeze({
  snapshot: () => null,
}) satisfies MissionMapFrameController;

const unavailableWorldMapDiagnostic = Object.freeze({
  status: null,
  sequence: null,
  generation: null,
  frameId: null,
  visible: null,
  continent: null,
  zoom: null,
  topLeftX: null,
  topLeftY: null,
  bottomRightX: null,
  bottomRightY: null,
}) satisfies WorldMapFrameDiagnostic;

const unavailableWorldMap = Object.freeze({
  snapshot: () => null,
  diagnostics: () => unavailableWorldMapDiagnostic,
}) satisfies WorldMapFrameController;

/** Install the atomic evidence core; unavailable presentation surfaces stay isolated. */
export async function installCartography(options: Readonly<{
  exports: WebAssembly.Exports;
  /** The instantiated client module; its manifest names the kernel's roots. */
  module: WebAssembly.Module;
  parent: HTMLElement;
  canvas: HTMLCanvasElement;
  settings(): AppSettings;
  persist(patch: RendererSettingsPatch): Promise<AppSettings>;
  /** Main owns validation and saving; the renderer supplies bounded observations only. */
  exportEvidence(
    capture: CartographyEvidenceCapture,
  ): Promise<CartographyEvidenceExportResult>;
  getMapKnowledge(kernelSha256: string): Promise<readonly CartographyMapKnowledge[]>;
  recordMapKnowledge(
    value: CartographyMapKnowledge,
  ): Promise<readonly CartographyMapKnowledge[]>;
}>): Promise<() => void> {
  const context = createCartographyContextReader(options.exports);
  const compassReader = createCompassFrameReader(options.exports);
  const missionMapReader = createMissionMapFrameReader(options.exports);
  const worldMapReader = createWorldMapFrameReader(options.exports);
  const exploration = createExplorationReader(options.exports);
  const anchor = createWorldMapAnchorReader(options.exports);
  if (context === null || exploration === null || anchor === null) {
    const missing = [
      context === null ? "context" : null,
      exploration === null ? "exploration" : null,
      anchor === null ? "anchor" : null,
    ].filter((name): name is string => name !== null);
    console.error(`[cartography] required observers unavailable: ${missing.join(", ")}`);
    return () => {};
  }
  const compass = compassReader ?? unavailableCompass;
  const missionMap = missionMapReader ?? unavailableMissionMap;
  const worldMap = worldMapReader ?? unavailableWorldMap;

  let kernel;
  try {
    kernel = await installCartographyReachabilityKernel(
      options.exports,
      decodeCartographyManifest(options.module),
    );
  } catch (cause) {
    console.error("[cartography] reachability kernel unavailable", cause);
    kernel = Object.freeze({
      sha256: null,
      classify: () => null,
      route: () => null,
      diagnostic: () => null,
      routeDiagnostic: () => null,
      dispose: () => undefined,
    });
  }
  let initialMapKnowledge: readonly CartographyMapKnowledge[] = [];
  if (kernel.sha256 !== null) {
    try {
      initialMapKnowledge = await options.getMapKnowledge(kernel.sha256);
    } catch (cause) {
      console.error("[cartography] remembered map knowledge unavailable", cause);
    }
  }
  const cleanup = [() => kernel.dispose()];
  const dispose = () => disposeCartographyResources(cleanup);
  try {
    const nativeCompassRanges = createNativeCompassRangesLayer(options.exports, options.parent.ownerDocument);
    cleanup.push(() => nativeCompassRanges.dispose());
    const nativeMapGraphics = createNativeMapGraphicsLayer(options.exports, options.parent.ownerDocument);
    cleanup.push(() => nativeMapGraphics.dispose());
    const compassTerrainLayer = createNativeCompassTerrainLayer(options.exports, options.parent.ownerDocument);
    cleanup.push(() => compassTerrainLayer.dispose());
    if (compassReader !== null) window.gwCompassFrame = compassReader;
    if (missionMapReader !== null) window.gwMissionMapFrame = missionMapReader;
    if (worldMapReader !== null) window.gwWorldMapFrame = worldMapReader;
    window.gwWorldMapAnchor = anchor;
    window.gwExploration = exploration;
    cleanup.push(() => {
      if (window.gwCompassFrame === compassReader) delete window.gwCompassFrame;
      if (window.gwMissionMapFrame === missionMapReader) delete window.gwMissionMapFrame;
      if (window.gwWorldMapFrame === worldMapReader) delete window.gwWorldMapFrame;
      if (window.gwWorldMapAnchor === anchor) delete window.gwWorldMapAnchor;
      if (window.gwExploration === exploration) delete window.gwExploration;
    });
    const disposeOverlay = mountCartographyOverlay({
      compassTerrainLayer,
      nativeMapGraphics,
      nativeCompassRanges,
      parent: options.parent,
      canvas: options.canvas,
      modelSources: {
        context,
        compass,
        missionMap,
        worldMap,
        exploration,
        anchor,
        kernel,
        companion: readCartographyPlayerState,
        revealRadius: () => options.settings().cartographyRevealMode === "birds-eye" ? 3 : 1,
      },
      playRegion: readCartographyPlayRegion,
      questMarker: readCartographyQuestMarker,
      settings: options.settings,
      persist: options.persist,
      exportEvidence: options.exportEvidence,
      initialMapKnowledge,
      recordMapKnowledge: options.recordMapKnowledge,
    });

    cleanup.push(disposeOverlay);
    return dispose;
  } catch (cause) {
    try { dispose(); } catch (cleanupError) {
      throw new AggregateError([cause, cleanupError], "Maps installation and cleanup failed", {cause: cleanupError});
    }
    throw cause;
  }
}
