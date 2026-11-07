/** The release battery refuses an unknown client check by check, keeping every verdict. */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { WASM_HEADER } from "../../app/main/core/wasm-binary.js";
import {
  QUALIFICATION_CHECKS,
  qualifyClient,
} from "../../app/tools-cli/client-qualification.js";

test("a client no check can prove refuses every check and keeps its verdicts", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "gwonmac-qualify-"));
  try {
    const wasm = path.join(root, "Gw.jspi.wasm");
    const js = path.join(root, "Gw.jspi.js");
    await Promise.all([writeFile(wasm, WASM_HEADER), writeFile(js, "var Module = {};")]);

    const records = await qualifyClient(wasm, js);

    for (const check of QUALIFICATION_CHECKS) {
      assert.equal(records[check].status, "refused", check);
      assert.equal(records[check].exitCode, 1, check);
    }
    // The watch issue reads the runtime verdicts even when the battery refuses.
    assert.partialDeepStrictEqual(records.runtime, {
      templateSaving: false,
      features: { nativeCursor: { status: "changed" } },
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
