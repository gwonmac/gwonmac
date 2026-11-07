/**
 * Maps' main-process channels: evidence export, per-client map knowledge, and
 * Elite Skills tracking with its wiki links.
 */
import { dirname, join } from "node:path";
import { shell, type BrowserWindow } from "electron";
import { exportCartographyEvidence } from "./main/cartography-evidence-export.js";
import { parseCartographyEvidenceCapture } from "./main/cartography-evidence/capture.js";
import { CartographyMapKnowledgeStore } from "./main/cartography-map-knowledge.js";
import { EliteTrackingStore } from "./main/elite-tracking.js";
import { channel } from "../../main/ipc-channel-registry.js";
import { one, type ToolsMainPart } from "../../main/tools-main-part.js";
import { parseCartographyMapKnowledge } from "../../shared/cartography-map-knowledge.js";
import { isDigest } from "../../shared/digest.js";
import { eliteWikiUrl } from "../../shared/elite-wiki.js";
import { parseEliteCharacter, parseEliteUpdate } from "../../shared/elite-skills.js";
import { ValidationError } from "../../shared/errors.js";

export default {
  feature: "cartography",
  label: "Maps",
  create({ paths, accounts, preferences, clientFingerprint, getClientSession, run }) {
    const knowledge = new CartographyMapKnowledgeStore(paths.cartographyMapKnowledge);
    const tracking = new EliteTrackingStore();
    const trackingPath = (win: BrowserWindow) =>
      join(dirname(accounts.buildLibraryPathFor(win)), "elite-tracking.json");
    return {
      channels: {
        cartographyEvidenceExport: channel(
          one(parseCartographyEvidenceCapture),
          (win, value) => run(() => exportCartographyEvidence(
            win,
            value,
            getClientSession(win),
            () => preferences.getSettings(),
          )),
        ),
        cartographyMapKnowledgeGet: channel(
          one((value) => {
            if (!isDigest(value)) throw new ValidationError("invalid digest");
            return value;
          }),
          (_win, kernelSha256) => run(() => {
            const fingerprint = clientFingerprint();
            return fingerprint ? knowledge.get(fingerprint, kernelSha256) : Promise.resolve([]);
          }),
        ),
        cartographyMapKnowledgeRecord: channel(
          one(parseCartographyMapKnowledge),
          (_win, value) => run(() => {
            const fingerprint = clientFingerprint();
            return fingerprint ? knowledge.record(fingerprint, value) : Promise.resolve([]);
          }),
        ),
        eliteWikiOpen: channel(one(eliteWikiUrl), (_win, url) => run(() => shell.openExternal(url))),
        eliteTrackingGet: channel(one(parseEliteCharacter), (win, value) =>
          run(() => tracking.get(trackingPath(win), value.characterKey))),
        eliteTrackingUpdate: channel(one(parseEliteUpdate), (win, value) =>
          run(() => tracking.update(trackingPath(win), value))),
      },
    };
  },
} satisfies ToolsMainPart;
