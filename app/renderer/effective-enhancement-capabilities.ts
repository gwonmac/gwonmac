/**
 * The renderer's one projection of Main's actually served feature set.
 * Launch settings describe intent and must never recreate runtime authority.
 */
import type { ClientSession } from "../shared/contracts.js";
import { capabilityRecord, type EnhancementCapabilities } from "../shared/enhancement-contracts.js";

export function effectiveCapabilities(
  session: ClientSession,
): EnhancementCapabilities | null {
  const features = session.compatibility?.features;
  if (!features) return null;
  return capabilityRecord((capability) => features[capability].status === "available");
}
