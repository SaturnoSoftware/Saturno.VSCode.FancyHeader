import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "node:path";
import { DEFAULT_CONFIG } from "../Source/Config";
import {
  _BuildNewTemplateContent,
  BuildTemplateFileName,
  BuildUpdatedTemplateList,
  DeriveTemplateNameFromFilePath,
  GetEditableTemplateCandidates,
  GetPreferredTemplateDirectory,
  GetTemplateSearchDirectories,
  MergeTemplateSources,
  ResolveUniqueTemplatePath,
  _SlugifyTemplateName,
} from "../Source/TemplateManagement";

const TEMPLATES_ROOT = process.platform === "win32"
  ? "D:\\Templates"
  : "/tmp/Templates";
const FALLBACK_ROOT = process.platform === "win32"
  ? "D:\\Fallback"
  : "/tmp/Fallback";
const USER_TEMPLATES_ROOT = process.platform === "win32"
  ? "D:\\UserTemplates"
  : "/tmp/UserTemplates";

describe("templateManagement", () => {
  it("slugifies template names into stable file-safe ids", () => {
    assert.strictEqual(_SlugifyTemplateName("ASCII Galaxy"), "ascii-galaxy");
    assert.strictEqual(_SlugifyTemplateName("  !!!  "), "template");
  });

  it("builds template file names", () => {
    assert.strictEqual(BuildTemplateFileName("ASCII Galaxy"), "_header-ascii-galaxy.txt");
    assert.strictEqual(BuildTemplateFileName("ASCII Galaxy", 2), "_header-ascii-galaxy-2.txt");
  });

  it("chooses the preferred template directory from configured templates first", () => {
    const result = GetPreferredTemplateDirectory(
      {
        ...DEFAULT_CONFIG,
        templates: [{ name: "Default", path: path.join(TEMPLATES_ROOT, "_header-default.txt") }],
      },
      FALLBACK_ROOT
    );

    assert.strictEqual(result, TEMPLATES_ROOT);
  });

  it("builds a unique template path when names collide", () => {
    const seen = new Set([
      path.join(TEMPLATES_ROOT, "_header-ascii-galaxy.txt"),
      path.join(TEMPLATES_ROOT, "_header-ascii-galaxy-2.txt"),
    ]);

    const result = ResolveUniqueTemplatePath(
      "ASCII Galaxy",
      DEFAULT_CONFIG,
      TEMPLATES_ROOT,
      (candidatePath) => seen.has(candidatePath)
    );

    assert.strictEqual(result, path.join(TEMPLATES_ROOT, "_header-ascii-galaxy-3.txt"));
  });

  it("builds the template search directories from configured paths plus the default root", () => {
    const result = GetTemplateSearchDirectories(
      {
        ...DEFAULT_CONFIG,
        templates: [{ name: "Default", path: path.join(TEMPLATES_ROOT, "_header-default.txt") }],
        templateFile: path.join(TEMPLATES_ROOT, "_header-default.txt"),
      },
      USER_TEMPLATES_ROOT
    );

    assert.deepStrictEqual(result, [
      TEMPLATES_ROOT,
      USER_TEMPLATES_ROOT,
    ]);
  });

  it("returns editable candidates from templates or templateFile fallback", () => {
    assert.deepStrictEqual(
      GetEditableTemplateCandidates({
        ...DEFAULT_CONFIG,
        templates: [{ name: "Default", path: path.join(TEMPLATES_ROOT, "_header-default.txt") }],
      }),
      [{ name: "Default", path: path.join(TEMPLATES_ROOT, "_header-default.txt") }]
    );

    assert.deepStrictEqual(
      GetEditableTemplateCandidates({
        ...DEFAULT_CONFIG,
        templateFile: path.join(TEMPLATES_ROOT, "_header-default.txt"),
      }),
      [{ name: "Current Template", path: path.join(TEMPLATES_ROOT, "_header-default.txt") }]
    );
  });

  it("derives friendly names from discovered template files", () => {
    assert.strictEqual(
      DeriveTemplateNameFromFilePath(path.join(TEMPLATES_ROOT, "_header-ascii-galaxy.txt")),
      "Ascii Galaxy"
    );
    assert.strictEqual(
      DeriveTemplateNameFromFilePath(path.join(TEMPLATES_ROOT, "_header.txt")),
      "Template"
    );
  });

  it("merges configured templates with discovered files without duplicates", () => {
    const defaultTemplatePath = path.join(TEMPLATES_ROOT, "_header-default.txt");
    const galaxyTemplatePath = path.join(TEMPLATES_ROOT, "_header-galaxy.txt");

    const result = MergeTemplateSources(
      [{ name: "Default", path: defaultTemplatePath }],
      [
        defaultTemplatePath,
        galaxyTemplatePath,
      ]
    );

    assert.deepStrictEqual(result, [
      { name: "Default", path: defaultTemplatePath },
      { name: "Galaxy", path: galaxyTemplatePath },
    ]);
  });

  it("builds new template content from an existing template or templateLines fallback", () => {
    assert.strictEqual(
      _BuildNewTemplateContent(DEFAULT_CONFIG, "Line 1\r\nLine 2\r\n"),
      "Line 1\nLine 2\n"
    );

    assert.strictEqual(
      _BuildNewTemplateContent({
        ...DEFAULT_CONFIG,
        templateLines: ["One", "Two"],
      }),
      "One\nTwo"
    );
  });

  it("builds an updated template list preserving the previous single-template fallback", () => {
    const result = BuildUpdatedTemplateList(
      {
        ...DEFAULT_CONFIG,
        templateFile: path.join(TEMPLATES_ROOT, "_header-default.txt"),
      },
      {
        name: "Galaxy",
        path: path.join(TEMPLATES_ROOT, "_header-galaxy.txt"),
      }
    );

    assert.deepStrictEqual(result, [
      { name: "Default", path: path.join(TEMPLATES_ROOT, "_header-default.txt") },
      { name: "Galaxy", path: path.join(TEMPLATES_ROOT, "_header-galaxy.txt") },
    ]);
  });

  // Platform handling for the default template root moved with the function
  // itself to Fancy.FileUtils.GetDefaultUserAppRoot - see
  // Libraries/Saturno.VSCode.FancyLib/tests/fileUtils.test.ts.
});
