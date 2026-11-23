// This behavior is executed rather than asserted about. The game window gets a
// failure *code* (a snapshot read, a template export), so the sentence the
// player reads is chosen here. These run the real map: every member of the
// catalogue must produce prose, and an unnamed code must land on one honest
// default rather than rendering as blank or as the code itself.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  describeSnapshotReadFailure as snapshotRead,
  describeSteamRefusal,
  describeTemplateExportFailure as templateExport,
  failureDetail,
  memoryWarningCopy,
  suggestReport,
} from "../../app/renderer/failure-messages.js";
import { ERROR_CODES } from "../../app/shared/errors.ts";

describe("renderer failure messages", () => {
  it("answers every code in the catalogue with a sentence, on every surface", () => {
    for (const code of ERROR_CODES) {
      for (const [surface, describe_] of [
        ["snapshot", snapshotRead],
        ["templateExport", templateExport],
      ] as const) {
        const text = describe_(code);
        assert.equal(typeof text, "string", `${surface} ${code}`);
        assert.ok(text.length > 20, `${surface} ${code} is not a sentence`);
        assert.ok(text.endsWith("."), `${surface} ${code} is not a sentence`);
        // The code is an identifier for us, not for the player.
        assert.equal(text.includes(code), false, `${surface} leaks ${code}`);
      }
    }
  });

  it("falls back to one default rather than inventing a sentence per code", () => {
    // The snapshot surface accepts arbitrary strings — the code arrives as a
    // header value, not a checked ErrorCode — and lands on its default.
    assert.equal(snapshotRead("no-such-code"), snapshotRead(null));
  });

  it("explains a failed Steam sign-in and stays silent on a plain cancel", () => {
    // The player closed the window themselves; narrating that would be noise.
    assert.equal(describeSteamRefusal("cancelled"), null);
    for (const reason of ["state-mismatch", "no-token", "failed"] as const) {
      const text = describeSteamRefusal(reason);
      assert.ok(text && text.length > 20, `${reason} is not a sentence`);
      assert.match(text, /already linked to a Guild Wars account/);
      assert.equal(text.includes(reason), false, `steam leaks ${reason}`);
    }
  });

  it("suggests a bug report only when the fault may be the app's", () => {
    // Network and disk conditions are the player's to fix.
    for (const code of ["net_offline", "http_status", "disk_full", "not_ready", "dns_timeout"]) {
      assert.equal(suggestReport(code), false, code);
      assert.doesNotMatch(failureDetail(code), /Report a Bug/);
      assert.match(failureDetail(code), new RegExp(`Error code: ${code}`, "u"));
    }
    // Verification and unclassified failures might genuinely be ours.
    for (const code of ["artifact_unverified", "hash_mismatch", "unknown"]) {
      assert.equal(suggestReport(code), true, code);
      assert.match(failureDetail(code), /Report a Bug/);
      assert.match(failureDetail(code), new RegExp(`Error code: ${code}`, "u"));
    }
    // No code keeps the sentence the fail surface has always shown.
    assert.equal(
      failureDetail(),
      "You can retry, or choose Help → Report a Bug.",
    );
  });

  it("tells a locked Keychain apart from a build that may not use one", () => {
    // Unlocking is the player's to do; a missing entitlement is a signing
    // fault in what we shipped, and the two must not share one answer.
    assert.equal(suggestReport("keychain_locked"), false);
    assert.doesNotMatch(failureDetail("keychain_locked"), /Report a Bug/);
    assert.equal(suggestReport("keychain_unentitled"), true);
    assert.match(failureDetail("keychain_unentitled"), /Report a Bug/);
  });

  it("escalates memory wording while keeping one action model", () => {
    const low = memoryWarningCopy("low", 2_147_483_648);
    const critical = memoryWarningCopy("critical", 2_147_483_648);
    for (const notice of [low, critical]) {
      for (const text of [
        notice.label,
        notice.detail,
        notice.reloadButton,
        notice.dismissButton,
        notice.explanation,
      ]) {
        assert.ok(text.length > 0, "memory notice has empty prose");
      }
      assert.doesNotMatch(notice.detail, /town or outpost/);
    }
    assert.match(low.detail, /^Reload when convenient/);
    assert.match(critical.detail, /^Reload soon/);
    assert.match(critical.label, /out of memory/);
    assert.equal(low.reloadButton, critical.reloadButton);
    assert.equal(low.dismissButton, critical.dismissButton);
  });

  it("prints the effective cap but no unreliable countdown", () => {
    for (const level of ["low", "critical"] as const) {
      const notice = memoryWarningCopy(level, 2_147_483_648);
      for (const text of [notice.label, notice.detail]) {
        assert.doesNotMatch(text, /\d/, text);
      }
      assert.match(notice.explanation, /2 GB/);
    }
  });

  it("explains optional automatic return without overpromising", () => {
    const explanation = memoryWarningCopy("critical", 2_147_483_648).explanation;
    assert.match(explanation, /With automatic return enabled/);
    assert.match(explanation, /returns to the selected character/);
    assert.doesNotMatch(explanation, /\b(guarantee\w*|never lose|always works?)\b/i);
  });
});
