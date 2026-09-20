import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { BuildHeader, _BuildHeaderLine, _ReplaceTemplateTokens, _HasGeneratedHeaderAtDocumentStart } from "../Source/Formatting";
import { DEFAULT_CONFIG, HeaderTemplateData } from "../Source/Config";
import * as Fancy from "../Libraries/Saturno.VSCode.FancyLib/Source";

type CommentSyntax = Fancy.CommentUtils.CommentSyntax;

const cStyleSyntax: CommentSyntax = {
  singleLineStart: "//",
  singleLineEnd: "",
  multiLineStart: "/*",
  multiLineMiddle: "*",
  multiLineEnd: "*/",
};

const htmlStyleSyntax: CommentSyntax = {
  singleLineStart: "<!--",
  singleLineEnd: "-->",
  multiLineStart: "<!--",
  multiLineMiddle: " ",
  multiLineEnd: "-->",
};

const hashStyleSyntax: CommentSyntax = {
  singleLineStart: "#",
  singleLineEnd: "",
  multiLineStart: "#",
  multiLineMiddle: "#",
  multiLineEnd: "#",
};

const sampleData: HeaderTemplateData = {
  fileName: "feature.ts",
  projectName: "saturno-project",
  date: "2026-05-28",
  lastModified: "2026-06-01",
  copyrightYear: "2024 - 2026",
  copyrightOwner: "Saturno Software",
  userName: "Mateus",
  userEmail: "mateus@saturno.software",
};

describe("buildHeader", () => {
  it("builds the default C-style header with border and body lines", () => {
    const result = BuildHeader(cStyleSyntax, sampleData, DEFAULT_CONFIG);
    const lines = result.trimEnd().split("\n");

    assert.strictEqual(lines.length, 7);
    assert.strictEqual(lines[0].length, 80);
    assert.strictEqual(lines[0], `// ${"-".repeat(74)} //`);
    assert.ok(lines[1].endsWith(" //"));
    assert.ok(lines[2].endsWith(" //"));
    assert.ok(lines[5].endsWith(" //"));
    assert.match(lines[1], /File\s+: feature\.ts\s+\/\/$/);
    assert.match(lines[2], /Project\s+: saturno-project\s+\/\/$/);
    assert.match(lines[5], /Mateus <mateus@saturno\.software>\s+\/\/$/);
    assert.strictEqual(lines[6], lines[0]);
  });

  it("supports custom template lines, width, and fill character", () => {
    const result = BuildHeader(cStyleSyntax, sampleData, {
      ...DEFAULT_CONFIG,
      lineWidth: 60,
      fillChar: "=",
      templateLines: [" Header : FILENAME", " Author : USER_NAME"],
    });
    const lines = result.trimEnd().split("\n");

    assert.strictEqual(lines.length, 4);
    assert.strictEqual(lines[0], `// ${"=".repeat(54)} //`);
    assert.strictEqual(lines[0].length, 60);
    assert.match(lines[1], /Header : feature\.ts\s+\/\/$/);
    assert.match(lines[2], /Author : Mateus\s+\/\/$/);
  });

  it("supports languages that require a closing single-line suffix", () => {
    const result = BuildHeader(htmlStyleSyntax, sampleData, DEFAULT_CONFIG);
    const lines = result.trimEnd().split("\n");

    assert.ok(lines[0].startsWith("<!-- "));
    assert.ok(lines[0].endsWith(" -->"));
    assert.ok(lines[1].endsWith(" -->"));
    assert.strictEqual(lines[0].length, 80);
  });

  it("uses at least two comment characters for one-character line comments", () => {
    const result = BuildHeader(hashStyleSyntax, sampleData, DEFAULT_CONFIG);
    const lines = result.trimEnd().split("\n");

    assert.strictEqual(lines[0].length, 80);
    assert.ok(lines[0].startsWith("## "));
    assert.ok(lines[0].endsWith(" ##"));
    assert.ok(lines[1].startsWith("## "));
    assert.ok(lines[1].endsWith(" ##"));
  });

  it("replaces wrapped placeholder tokens inside template lines", () => {
    const result = BuildHeader(cStyleSyntax, sampleData, {
      ...DEFAULT_CONFIG,
      templateLines: [
        "  File      : ${FILENAME}",
        "  Project   : {{PROJECT}}",
        "  Date      : DATE",
      ],
    });
    const lines = result.trimEnd().split("\n");

    assert.ok(lines[1].includes("feature.ts"));
    assert.ok(!lines[1].includes("${"));
    assert.ok(lines[2].includes("saturno-project"));
    assert.ok(!lines[2].includes("{{"));
    assert.ok(lines[3].includes("2026-05-28"));
  });

  it("preserves ascii-art template lines while closing them on the right side", () => {
    const result = BuildHeader(cStyleSyntax, sampleData, {
      ...DEFAULT_CONFIG,
      templateLines: [
        "                     *       +",
        "               '                  |",
      ],
    });
    const lines = result.trimEnd().split("\n");

    assert.strictEqual(lines[1].length, 80);
    assert.strictEqual(lines[2].length, 80);
    assert.ok(lines[1].startsWith("// "));
    assert.ok(lines[1].endsWith(" //"));
    assert.ok(lines[2].endsWith(" //"));
  });
});

describe("buildHeaderLine", () => {
  it("closes line-comment headers on the right side", () => {
    const result = _BuildHeaderLine(cStyleSyntax, "  File      : feature.ts", " ", 80);
    assert.strictEqual(result.length, 80);
    assert.ok(result.startsWith("// "));
    assert.ok(result.endsWith(" //"));
  });

  it("uses the explicit single-line end when available", () => {
    const result = _BuildHeaderLine(htmlStyleSyntax, "Title", " ", 60);
    assert.strictEqual(result.length, 60);
    assert.ok(result.startsWith("<!-- "));
    assert.ok(result.endsWith(" -->"));
  });

  it("duplicates one-character line comment tokens on both sides", () => {
    const result = _BuildHeaderLine(hashStyleSyntax, "Title", " ", 60);
    assert.strictEqual(result.length, 60);
    assert.ok(result.startsWith("## "));
    assert.ok(result.endsWith(" ##"));
  });
});

describe("replaceTemplateTokens", () => {
  it("replaces raw, ${wrapped}, and {{wrapped}} placeholder tokens", () => {
    const result = _ReplaceTemplateTokens(
      "FILENAME | ${PROJECT} | {{DATE}} | LAST_MODIFIED | YEAR | COPYRIGHT_OWNER | USER_NAME | ${USER_EMAIL}",
      sampleData
    );

    assert.strictEqual(
      result,
      "feature.ts | saturno-project | 2026-05-28 | 2026-06-01 | 2024 - 2026 | Saturno Software | Mateus | mateus@saturno.software"
    );
  });

  it("does not leave ${...} markers behind after replacement", () => {
    const result = _ReplaceTemplateTokens(
      "  File      : ${FILENAME}\n  Project   : ${PROJECT}\n  Author    : ${USER_NAME} <${USER_EMAIL}>",
      sampleData
    );

    assert.ok(!result.includes("${"));
    assert.ok(result.includes("feature.ts"));
    assert.ok(result.includes("saturno-project"));
    assert.ok(result.includes("Mateus <mateus@saturno.software>"));
  });

  it("removes empty email brackets when no user email is available", () => {
    const result = _ReplaceTemplateTokens(
      "  Author    : ${USER_NAME} <${USER_EMAIL}>",
      { ...sampleData, userEmail: "" }
    );

    assert.strictEqual(result, "  Author    : Mateus");
  });
});

describe("release header contract", () => {
  it("renders COPYRIGHT_OWNER independently from Author", () => {
    const result = BuildHeader(cStyleSyntax, sampleData, DEFAULT_CONFIG);
    assert.match(result, /Copyright\s+: 2024 - 2026 Saturno Software/);
    assert.match(result, /Author\s+: Mateus <mateus@saturno\.software>/);
  });

  it("recognizes only a complete generated header at the document start", () => {
    const generated = BuildHeader(cStyleSyntax, sampleData, DEFAULT_CONFIG);
    assert.strictEqual(_HasGeneratedHeaderAtDocumentStart(generated + "const value = 1;", cStyleSyntax), true);
    assert.strictEqual(_HasGeneratedHeaderAtDocumentStart("// not a generated header\nconst value = 1;", cStyleSyntax), false);
    const blockGenerated = BuildHeader(htmlStyleSyntax, sampleData, DEFAULT_CONFIG);
    assert.strictEqual(_HasGeneratedHeaderAtDocumentStart(blockGenerated + "<main></main>", htmlStyleSyntax), true);
  });
});