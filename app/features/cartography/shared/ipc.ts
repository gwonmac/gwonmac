/**
 * Maps' channels and its `window.gwNative.cartography` and `eliteTracking`
 * namespaces: evidence export, per-client map knowledge, and Elite Skills
 * tracking with its wiki links. Main answers them in ../main.ts.
 */
import type {
  CartographyEvidenceCapture,
  CartographyEvidenceExportResult,
} from "../../../shared/cartography-evidence.js";
import type { CartographyMapKnowledge } from "../../../shared/cartography-map-knowledge.js";
import type { EliteTracking, EliteUpdate } from "../../../shared/elite-skills.js";
import type { EliteWikiRequest } from "../../../shared/elite-wiki.js";
import { invoke, toolContract, type Invoke } from "../../../shared/ipc/channel-table.js";

const channels = {
  cartographyEvidenceExport: invoke<[value: CartographyEvidenceCapture], CartographyEvidenceExportResult>("gw:cartography:evidenceExport"),
  cartographyMapKnowledgeGet: invoke<[kernelSha256: string], readonly CartographyMapKnowledge[]>("gw:cartography:mapKnowledgeGet"),
  cartographyMapKnowledgeRecord: invoke<[value: CartographyMapKnowledge], readonly CartographyMapKnowledge[]>("gw:cartography:mapKnowledgeRecord"),
  eliteWikiOpen: invoke<[value: EliteWikiRequest], void>("gw:eliteWiki:open"),
  eliteTrackingGet: invoke<[value: { characterKey: string }], EliteTracking>("gw:eliteTracking:get"),
  eliteTrackingUpdate: invoke<[value: EliteUpdate], EliteTracking>("gw:eliteTracking:update"),
} as const;

export interface CartographyNativeApi {
  cartography: {
    getMapKnowledge: Invoke<typeof channels.cartographyMapKnowledgeGet>;
    recordMapKnowledge: Invoke<typeof channels.cartographyMapKnowledgeRecord>;
    exportEvidence: Invoke<typeof channels.cartographyEvidenceExport>;
  };
  eliteTracking: {
    openWiki: Invoke<typeof channels.eliteWikiOpen>;
    get: Invoke<typeof channels.eliteTrackingGet>;
    update: Invoke<typeof channels.eliteTrackingUpdate>;
  };
}

export default toolContract(channels, (invoke): CartographyNativeApi => ({
  cartography: {
    getMapKnowledge: (kernelSha256) => invoke("cartographyMapKnowledgeGet", kernelSha256),
    recordMapKnowledge: (value) => invoke("cartographyMapKnowledgeRecord", value),
    exportEvidence: (value) => invoke("cartographyEvidenceExport", value),
  },
  eliteTracking: {
    openWiki: (value) => invoke("eliteWikiOpen", value),
    get: (value) => invoke("eliteTrackingGet", value),
    update: (value) => invoke("eliteTrackingUpdate", value),
  },
}));
