import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { resolveCommentSyntaxFromComments } from "../libs/Saturno.VSCodeKit/src/CommentSyntaxCore";

describe("resolveCommentSyntaxFromComments", () => {
  it("returns null for missing or empty language comment configuration", () => {
    assert.strictEqual(resolveCommentSyntaxFromComments(undefined), null);
    assert.strictEqual(resolveCommentSyntaxFromComments(null), null);
    assert.strictEqual(resolveCommentSyntaxFromComments({}), null);
  });

  it("preserves raw one-character line comments for consumers to render appropriately", () => {
    assert.deepStrictEqual(resolveCommentSyntaxFromComments({ lineComment: "#" }), {
      singleLineStart: "#",
      singleLineEnd: "",
      multiLineStart: "#",
      multiLineMiddle: "#",
      multiLineEnd: "#",
    });
  });

  it("prefers line comments when a language exposes both line and block comments", () => {
    const syntax = resolveCommentSyntaxFromComments({
      lineComment: "//",
      blockComment: ["/*", "*/"],
    });

    assert.strictEqual(syntax?.singleLineStart, "//");
    assert.strictEqual(syntax?.singleLineEnd, "");
  });

  it("uses block comment open and close tokens when no line comment is available", () => {
    assert.deepStrictEqual(resolveCommentSyntaxFromComments({ blockComment: ["<!--", "-->"] }), {
      singleLineStart: "<!--",
      singleLineEnd: "-->",
      multiLineStart: "<!--",
      multiLineMiddle: "-",
      multiLineEnd: "-->",
    });
  });

  it("keeps one-character block delimiters raw for header rendering to decide presentation", () => {
    assert.deepStrictEqual(resolveCommentSyntaxFromComments({ blockComment: ["{", "}"] }), {
      singleLineStart: "{",
      singleLineEnd: "}",
      multiLineStart: "{",
      multiLineMiddle: "{",
      multiLineEnd: "}",
    });
  });
});
