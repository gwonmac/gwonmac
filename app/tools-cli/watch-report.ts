/**
 * The client-watch issue table, rendered from one generation record.
 *
 * The record (`scripts/client-recertification-evidence.ts`) already holds only
 * privacy-safe facts: closed verdicts, invariant names and candidate counts.
 * This module adds no client bytes, offsets or addresses. It is evidence for a
 * maintainer, never launch authority.
 */
import { ENHANCEMENT_CAPABILITY_FIELDS } from "../shared/enhancement-contracts.js";

/** Feature, verdict, first failing invariant, candidate count. */
type Row = readonly [string, string, string, string];

/** One member of a parsed JSON object; anything else reads as absent. */
function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" && Object.hasOwn(value, key)
    ? (value as Readonly<Record<string, unknown>>)[key]
    : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function templateRow(runtime: unknown): Row {
  const fileVerdict = field(runtime, "fileVerdict");
  return [
    "template saving",
    text(field(fileVerdict, "status")) || "not run",
    text(field(fileVerdict, "reason")),
    "",
  ];
}

function featureRows(runtime: unknown): Row[] {
  const features = field(runtime, "features");
  return ENHANCEMENT_CAPABILITY_FIELDS.map((feature) => {
    const verdict = field(features, feature);
    return [
      feature,
      text(field(verdict, "status")) || "not run",
      text(field(verdict, "invariant")),
      text(field(verdict, "candidates")),
    ];
  });
}

function checkRow(feature: string, evidence: unknown): Row {
  const status = text(field(evidence, "status"));
  return [feature, status === "" || status === "unavailable" ? "not run" : status, "", ""];
}

/** Markdown for the watch issue: one row per verdict the generation record holds. */
export function formatWatchReport(generation: unknown): string {
  const runtime = field(generation, "runtime");
  const rows: Row[] = [
    templateRow(runtime),
    ...featureRows(runtime),
    checkRow("native double-click", field(generation, "nativeDoubleClick")),
    checkRow("Cartography", field(generation, "cartography")),
    checkRow("4 GB mode", field(generation, "extendedMemory")),
    checkRow("real-client regression suite", field(generation, "qualification")),
  ];
  return [
    "| Feature | Verdict | First failing invariant | Candidates |",
    "| --- | --- | --- | --- |",
    ...rows.map((row) => `| ${row.join(" | ")} |`),
    "",
    "A verdict is review evidence. It does not authorize a feature on a new build.",
    "",
  ].join("\n");
}
