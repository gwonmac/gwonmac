import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WASM_HEADER } from "../../app/main/core/wasm-binary.js";
import { verifyLocalClientBytes } from
  "../../app/client/certification/local-client-verifier.js";
import {
  createCarryForwardReport,
  formatCarryForwardMarkdown,
} from "../../app/tools-cli/carry-forward.js";
import {
  currentMessageAnchors,
  recertifyEnhancementBytes,
} from "../../app/tools-cli/enhancement-recert.js";
import { inspectTemplateSaveCandidate } from "../../app/tools-cli/template-save-recert.js";

describe("patch-day carry-forward report", () => {
  it("fails closed when no capability can be located", () => {
    const template = inspectTemplateSaveCandidate(WASM_HEADER);
    const enhancement = recertifyEnhancementBytes(
      WASM_HEADER,
      currentMessageAnchors(),
    );
    const verification = verifyLocalClientBytes(WASM_HEADER);
    const report = createCarryForwardReport(
      verification,
      template,
      enhancement,
      "not-located",
      "2026-08-14T12:00:00.000Z",
    );

    assert.deepEqual(report.capabilities, {
      gameFileSaving: "changed",
      nativeDoubleClick: "not-located",
      nativeCursor: "changed",
      targetObservation: "changed",
      partyObservation: "changed",
      teamApply: "changed",
      xunlaiStorage: "changed",
    });
    assert.equal("canonicalCertificate" in report, false);
    assert.match(formatCarryForwardMarkdown(report), /Apply team \| changed/);
    assert.match(formatCarryForwardMarkdown(report), /Xunlai storage \| changed/);
    assert.match(
      formatCarryForwardMarkdown(report),
      /does not authorize memory reads or Apply team/,
    );
  });
});
