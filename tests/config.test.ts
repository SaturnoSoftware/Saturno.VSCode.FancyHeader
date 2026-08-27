import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { DEFAULT_CONFIG, DEFAULT_TEMPLATE_LINES, normalizeConfig } from "../src/formatting";

describe("normalizeConfig", () => {
  it("keeps valid custom values", () => {
    const result = normalizeConfig({
      lineWidth: 120,
      fillChar: "=",
      templateLines: ["One", "Two"],
      templateFile: "  ${workspaceFolder}\\header.txt  ",
      templates: [
        { name: "  Default  ", path: "  ${workspaceFolder}\\default.txt  " },
        { name: "", path: "ignored.txt" },
      ],
      authorName: "  Mateus  ",
      authorEmail: "  hello@saturno.software  ",
    });

    assert.strictEqual(result.lineWidth, 120);
    assert.strictEqual(result.fillChar, "=");
    assert.deepStrictEqual(result.templateLines, ["One", "Two"]);
    assert.strictEqual(result.templateFile, "${workspaceFolder}\\header.txt");
    assert.deepStrictEqual(result.templates, [
      { name: "Default", path: "${workspaceFolder}\\default.txt" },
    ]);
    assert.strictEqual(result.authorName, "Mateus");
    assert.strictEqual(result.authorEmail, "hello@saturno.software");
  });

  it("falls back to defaults when values are missing or invalid", () => {
    const result = normalizeConfig({
      lineWidth: Number.NaN,
      fillChar: "",
      templateLines: [],
    });

    assert.strictEqual(result.lineWidth, DEFAULT_CONFIG.lineWidth);
    assert.strictEqual(result.fillChar, DEFAULT_CONFIG.fillChar);
    assert.deepStrictEqual(result.templateLines, DEFAULT_TEMPLATE_LINES);
  });

  it("clamps line width and takes only the first fill character", () => {
    const result = normalizeConfig({
      lineWidth: 999,
      fillChar: "==",
    });

    assert.strictEqual(result.lineWidth, 200);
    assert.strictEqual(result.fillChar, "=");
  });
});
