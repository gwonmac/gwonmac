import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFrontMatter } from "../../app/shared/website-content.js";

describe("website front matter", () => {
  it("reads quoted values, CRLF files, nested keys and drafts the same way for every reader", () => {
    const page = readFrontMatter([
      "---",
      'title: "GWonMac 1.0.0: one Stable lane"',
      "navigation:",
      "  title: Accounts",
      "draft: true",
      "---",
      "Body text.",
      "",
    ].join("\r\n"));
    assert.deepEqual(page, {
      fields: { title: "GWonMac 1.0.0: one Stable lane", navigation: "", "navigation.title": "Accounts", draft: "true" },
      body: "Body text.\n",
      draft: true,
    });
  });

  for (const [label, source] of [
    ["missing front matter", "# Title\n"],
    ["a list item", "---\ntitle: A\n- tag\n---\n"],
    ["an indented key without a parent", "---\n  title: A\n---\n"],
  ] as const) {
    it(`refuses ${label}`, () => {
      assert.throws(() => readFrontMatter(source));
    });
  }
});
