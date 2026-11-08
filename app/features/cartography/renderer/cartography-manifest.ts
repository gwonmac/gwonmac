/**
 * Decodes the derived client's Cartography manifest: the context root and
 * agent array the verifier derived from the client bytes and the transform
 * checked again. It is the only route by which native roots reach the
 * reachability kernel; a missing or malformed manifest leaves the kernel off.
 */
import {
  CARTOGRAPHY_MANIFEST_SECTION,
  CARTOGRAPHY_SPIKE_TRANSFORM_ABI,
} from "../../../shared/cartography-spike.js";
import { isDigest } from "../../../shared/digest.js";

export type CartographyManifest = Readonly<{
  contextRoot: number;
  agentArray: number;
}>;

const isRoot = (value: unknown): value is number =>
  Number.isSafeInteger(value) && Number(value) > 0 && Number(value) <= 0xffff_ffff && Number(value) % 4 === 0;

export function decodeCartographyManifest(module: WebAssembly.Module): CartographyManifest | null {
  const sections = WebAssembly.Module.customSections(module, CARTOGRAPHY_MANIFEST_SECTION);
  if (sections.length !== 1) return null;
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(sections[0]));
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).sort().join() !== "agentArray,contextRoot,inputSha256,transformAbi") return null;
    const { transformAbi, inputSha256, contextRoot, agentArray } = value as Record<string, unknown>;
    if (transformAbi !== CARTOGRAPHY_SPIKE_TRANSFORM_ABI || !isDigest(inputSha256)
      || !isRoot(contextRoot) || !isRoot(agentArray)) return null;
    return Object.freeze({ contextRoot, agentArray });
  } catch {
    return null;
  }
}
