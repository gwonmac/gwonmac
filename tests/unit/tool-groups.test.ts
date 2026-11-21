/** Settings lists every optional feature once, under the kind of thing it is. */
import assert from "node:assert/strict";
import test from "node:test";
import { GLOBAL_TOOLS } from "../../app/shared/launcher-contracts.js";
import { TOOL_GROUPS } from "../../app/shared/tool-presentation.js";

test("every tool belongs to exactly one kind", () => {
  const listed = TOOL_GROUPS.flatMap(group => group.tools);
  assert.deepEqual([...listed].sort(), [...GLOBAL_TOOLS].sort());
  assert.equal(new Set(listed).size, listed.length);
});

test("every kind has a name, a line that says what it is, and at least one tool", () => {
  for (const group of TOOL_GROUPS) {
    assert.ok(group.label.length > 0 && group.detail.length > 0 && group.tools.length > 0, group.label);
  }
});
