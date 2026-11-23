/**
 * Owns the Live evidence section of the Compass dock: a maintainer tool that shows what the map
 * engine reads right now and exports it as evidence. Development builds only; a player build has
 * no export, so the overlay never shows this section (overlay.ts).
 */
import type { CartographyEvidenceExportResult } from "../../../shared/cartography-evidence.js";
import type { WorldMapFrameDiagnostic } from "../../../shared/cartography-spike.js";
import type { CompassDockSection } from "./compass-dock.js";
import type { CartographyReachabilityDiagnostic } from "./reachability-kernel.js";

export type CartographyQaStatus = Readonly<{
  continent:
    | Readonly<{ status: "unavailable"; reason: string }>
    | Readonly<{
        status: "ready";
        continentId: number;
        exploredCreditableCells: number;
        remainingCells: number;
      }>;
  currentInstance:
    | Readonly<{ status: "unavailable"; reason: string }>
    | Readonly<{
        status: "ready";
        sequence: number;
        mapId: number;
        areaEpoch: number;
        resourceGeneration: number;
        terrain: Readonly<{ width: number; height: number; mapUnitsPerPixel: number }>;
        reachableCells: number;
        guidance:
          | Readonly<{ status: "unavailable"; reason: string }>
          | Readonly<{ status: "ready"; actionableCells: number }>;
      }>;
  compassReady: boolean;
  missionMapReady: boolean;
  worldMapReady: boolean;
  worldMapObserver: WorldMapFrameDiagnostic;
  kernel: CartographyReachabilityDiagnostic | null;
}>;

type QaPresentation = Readonly<{
  tone: "ready" | "limited" | "loading" | "unavailable";
  summary: string;
  rows: readonly (readonly [label: string, value: string])[];
}>;

const KERNEL_STATUS = Object.freeze({
  0: "not-published",
  1: "ready",
  2: "invalid-input",
  3: "native-unavailable",
  4: "limit",
  5: "no-start-trapezoid",
  6: "ambiguous-layout",
  7: "plane-limit",
  8: "trapezoid-limit",
  9: "doorway-limit",
  10: "terrain-raster-limit",
}) satisfies Readonly<Record<number, string>>;

function kernelStatus(status: number): string {
  return KERNEL_STATUS[status as keyof typeof KERNEL_STATUS] ?? `status-${status}`;
}

const WORLD_MAP_STATUS = Object.freeze({
  0: "not-published",
  1: "ready",
  2: "event-owner",
  3: "context-owner",
  4: "world-context",
  5: "frame-index",
  7: "continent",
  8: "viewport-values",
  9: "viewport-span",
  10: "frame-pointer",
}) satisfies Readonly<Record<number, string>>;

function worldMapStatus(value: WorldMapFrameDiagnostic): string {
  const reason = WORLD_MAP_STATUS[value.status as keyof typeof WORLD_MAP_STATUS]
    ?? `status-${value.status ?? "missing"}`;
  return `${reason} · frame ${value.frameId ?? "?"} · generation ${value.generation ?? "?"}`;
}

export function describeCartographyQaStatus(status: CartographyQaStatus): QaPresentation {
  const continent = status.continent;
  const current = status.currentInstance;
  const limited = continent.status === "unavailable"
    && continent.reason === "unsupported-area";
  if (continent.status === "unavailable" && current.status === "unavailable") {
    const reason = limited ? current.reason : continent.reason;
    const loading = reason === "loading";
    const kernel = status.kernel;
    const exactReason = reason === "kernel" && kernel !== null
      ? `kernel/${kernelStatus(kernel.status)}`
      : reason;
    const rows: (readonly [string, string])[] = [
      ...(limited ? [["Grid", "Unavailable in this area"]] as const : []),
      ["Reason", exactReason],
      ["World observer", worldMapStatus(status.worldMapObserver)],
    ];
    if (kernel !== null) {
      rows.push(
        ["Map", String(kernel.mapId)],
        ["Epoch", `${kernel.areaEpoch} · resource ${kernel.resourceGeneration}`],
        ["Geometry", `${kernel.reachableTrapezoids}/${kernel.totalTrapezoids} reachable`],
      );
    }
    return Object.freeze({
      tone: loading ? "loading" : "unavailable",
      summary: loading ? "Loading" : limited
        ? "Limited · Walkable unavailable"
        : `Unavailable · ${exactReason}`,
      rows: Object.freeze(rows),
    });
  }
  const rows: (readonly [string, string])[] = [];
  if (continent.status === "ready") {
    rows.push(
      ["Continent", `${continent.continentId} · ${continent.remainingCells} estimated remaining`],
      ["Coverage", `${continent.exploredCreditableCells} explored creditable`],
    );
  } else rows.push(["Grid", "Unavailable in this area"]);
  if (current.status === "ready") {
    rows.push(
      ["Map", String(current.mapId)],
      ["Epoch", `${current.areaEpoch} · resource ${current.resourceGeneration}`],
      ["Terrain", `${current.terrain.width}×${current.terrain.height} @ ${current.terrain.mapUnitsPerPixel}`],
    );
    rows.push(current.guidance.status === "ready"
      ? ["Guidance", `${current.guidance.actionableCells} targets here · ${current.reachableCells} reachable cells`]
      : ["Guidance", `Unavailable · ${current.guidance.reason}`]);
  } else rows.push(["Walkable", `Unavailable · ${current.reason}`]);
  rows.push([
    "Surfaces",
    `Compass ${status.compassReady ? "ready" : "off"} · Mission ${status.missionMapReady ? "ready" : "off"} · World ${status.worldMapReady ? "ready" : "off"}`,
  ]);
  rows.push(["World observer", worldMapStatus(status.worldMapObserver)]);
  return Object.freeze({
    tone: limited ? "limited" : "ready",
    summary: limited
      ? "Limited · Walkable terrain ready"
      : current.status === "ready" && current.guidance.status === "ready"
        ? `Ready · ${current.guidance.actionableCells} targets here`
        : continent.status === "ready"
          ? `Continent ready · ${continent.remainingCells} remaining`
          : "Walkable terrain ready",
    rows: Object.freeze(rows),
  });
}

export type LiveEvidenceSection = CompassDockSection & Readonly<{ update(status: CartographyQaStatus): void }>;

export function createLiveEvidenceSection(options: Readonly<{
  document: Document;
  exportEvidence(): Promise<CartographyEvidenceExportResult>;
}>): LiveEvidenceSection {
  const { document } = options;
  const body = document.createElement("details");
  body.className = "compass-dock-evidence";
  const summary = document.createElement("summary");
  const indicator = document.createElement("span");
  indicator.className = "compass-dock-evidence-indicator";
  indicator.setAttribute("aria-hidden", "true");
  const label = document.createElement("span");
  label.textContent = "Status";
  const value = document.createElement("strong");
  value.textContent = "Waiting";
  summary.append(indicator, label, value);
  const rows = document.createElement("dl");
  const exportButton = document.createElement("button");
  exportButton.type = "button";
  exportButton.className = "compass-dock-toggle";
  exportButton.textContent = "Export Cartography Evidence";
  const exportStatus = document.createElement("p");
  exportStatus.className = "compass-dock-hint";
  exportStatus.setAttribute("role", "status");
  exportStatus.setAttribute("aria-live", "polite");
  body.append(summary, rows, exportButton, exportStatus);
  let exporting = false;
  exportButton.addEventListener("click", () => {
    if (exporting) return;
    exporting = true;
    exportButton.disabled = true;
    exportStatus.textContent = "Preparing evidence…";
    void options.exportEvidence().then((result) => {
      exportStatus.textContent = result.status === "written"
        ? "Evidence exported"
        : result.status === "cancelled" ? "Export cancelled" : `Export unavailable · ${result.reason}`;
    }, () => {
      exportStatus.textContent = "Could not export evidence";
    }).finally(() => {
      exporting = false;
      exportButton.disabled = false;
    });
  });
  return Object.freeze({
    id: "evidence",
    title: "Live evidence",
    body,
    sync() {},
    update(status: CartographyQaStatus) {
      const presentation = describeCartographyQaStatus(status);
      body.dataset.tone = presentation.tone;
      value.textContent = presentation.summary;
      rows.replaceChildren(...presentation.rows.flatMap(([term, description]) => {
        const dt = document.createElement("dt");
        dt.textContent = term;
        const dd = document.createElement("dd");
        dd.textContent = description;
        return [dt, dd];
      }));
    },
  });
}
