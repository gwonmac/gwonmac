/**
 * Selection of untouched client artifacts for profiles that prohibit every
 * transform.
 */
import type { ClientTransforms, DiagnosticProfile } from "../shared/contracts.js";
import { diagnosticProfilePolicy } from "../shared/diagnostic-profile.js";
import { clientArtifactPath, type GamePaths } from "./core/paths.js";

export interface DiagnosticClientSelection {
  wasmPath: string;
  jsPath: string;
  compatibility: null;
  transforms: ClientTransforms;
}

export function selectOfficialDiagnosticClient(options: Readonly<{
  paths: GamePaths;
  profile: DiagnosticProfile;
}>): DiagnosticClientSelection | null {
  if (!diagnosticProfilePolicy(options.profile).officialClient) return null;
  return {
    wasmPath: clientArtifactPath(options.paths.artifacts, "Gw.jspi.wasm"),
    jsPath: clientArtifactPath(options.paths.artifacts, "Gw.jspi.js"),
    compatibility: null,
    transforms: { templateSave: false, cartography: false, nativeDoubleClick: false, soundDecodeRepair: false },
  };
}
