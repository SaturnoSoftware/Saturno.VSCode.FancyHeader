import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as path from "path";
import {
  slugifyTemplateName,
  buildTemplateFileName,
  deriveTemplateNameFromFilePath,
  buildNewTemplateContent,
  getPreferredTemplateDirectory,
  getTemplateSearchDirectories,
  resolveUniqueTemplatePath,
  mergeTemplateSources,
  buildUpdatedTemplateList,
  getEditableTemplateCandidates,
} from "../src/templateManagement";
import { DEFAULT_CONFIG } from "../src/formatting";

describe("slugifyTemplateName - extreme inputs", () => {
  it("handles empty string", () => {
    const result = slugifyTemplateName("");
    assert.strictEqual(result, "template");
  });

  it("handles only whitespace", () => {
    const result = slugifyTemplateName("   \t\n  ");
    assert.strictEqual(result, "template");
  });

  it("handles only special characters", () => {
    const result = slugifyTemplateName("!@#$%^&*()");
    assert.strictEqual(result, "template");
  });

  it("converts to lowercase", () => {
    const result = slugifyTemplateName("UPPERCASE");
    assert.strictEqual(result, "uppercase");
  });

  it("converts spaces to dashes", () => {
    const result = slugifyTemplateName("Multi Word Name");
    assert.strictEqual(result, "multi-word-name");
  });

  it("converts multiple consecutive spaces to single dash", () => {
    const result = slugifyTemplateName("Too    Many    Spaces");
    assert.strictEqual(result, "too-many-spaces");
  });

  it("strips leading and trailing dashes", () => {
    const result = slugifyTemplateName("-leading-trailing-");
    assert.strictEqual(result, "leading-trailing");
  });

  it("handles Unicode characters", () => {
    const result = slugifyTemplateName("Ñoño Template 世界");
    assert.strictEqual(result, "o-o-template");
  });

  it("handles emoji", () => {
    const result = slugifyTemplateName("Template 🚀 Name");
    assert.strictEqual(result, "template-name");
  });

  it("handles extremely long names", () => {
    const longName = "word-".repeat(1000) + "end";
    const result = slugifyTemplateName(longName);
    assert.ok(result.length > 0);
    assert.ok(!result.startsWith("-"));
    assert.ok(!result.endsWith("-"));
  });

  it("handles names with dots", () => {
    const result = slugifyTemplateName("file.name.template");
    assert.strictEqual(result, "file-name-template");
  });

  it("handles names with underscores", () => {
    const result = slugifyTemplateName("snake_case_name");
    assert.strictEqual(result, "snake-case-name");
  });

  it("handles mixed special characters", () => {
    const result = slugifyTemplateName("Name!@#With$%Special^&Chars");
    assert.strictEqual(result, "name-with-special-chars");
  });

  it("handles numbers correctly", () => {
    const result = slugifyTemplateName("Template 123 Version");
    assert.strictEqual(result, "template-123-version");
  });

  it("handles camelCase", () => {
    const result = slugifyTemplateName("camelCaseTemplateName");
    assert.strictEqual(result, "camelcasetemplatename");
  });

  it("handles PascalCase", () => {
    const result = slugifyTemplateName("PascalCaseTemplateName");
    assert.strictEqual(result, "pascalcasetemplatename");
  });

  it("handles kebab-case (already slugified)", () => {
    const result = slugifyTemplateName("already-slugified-name");
    assert.strictEqual(result, "already-slugified-name");
  });
});

describe("buildTemplateFileName - edge cases", () => {
  it("builds name without index for undefined index", () => {
    const result = buildTemplateFileName("Test");
    assert.strictEqual(result, "_header-test.txt");
  });

  it("builds name without index for index 1", () => {
    const result = buildTemplateFileName("Test", 1);
    assert.strictEqual(result, "_header-test.txt");
  });

  it("builds name with index for index 2", () => {
    const result = buildTemplateFileName("Test", 2);
    assert.strictEqual(result, "_header-test-2.txt");
  });

  it("handles very high index numbers", () => {
    const result = buildTemplateFileName("Test", 9999);
    assert.strictEqual(result, "_header-test-9999.txt");
  });

  it("handles index 0", () => {
    const result = buildTemplateFileName("Test", 0);
    assert.strictEqual(result, "_header-test.txt");
  });

  it("handles negative index (treated as no index)", () => {
    const result = buildTemplateFileName("Test", -5);
    assert.strictEqual(result, "_header-test.txt");
  });

  it("slugifies the name in filename", () => {
    const result = buildTemplateFileName("My Awesome Template");
    assert.strictEqual(result, "_header-my-awesome-template.txt");
  });

  it("handles empty name", () => {
    const result = buildTemplateFileName("");
    assert.strictEqual(result, "_header-template.txt");
  });

  it("handles name with special characters", () => {
    const result = buildTemplateFileName("C++ Header!");
    assert.strictEqual(result, "_header-c-header.txt");
  });
});

describe("deriveTemplateNameFromFilePath - edge cases", () => {
  it("derives name from standard header file", () => {
    const result = deriveTemplateNameFromFilePath("_header-cpp.txt");
    assert.strictEqual(result, "Cpp");
  });

  it("derives name from header file with index", () => {
    const result = deriveTemplateNameFromFilePath("_header-cpp-2.txt");
    assert.strictEqual(result, "Cpp 2");
  });

  it("derives name from file without header prefix", () => {
    const result = deriveTemplateNameFromFilePath("template.txt");
    assert.strictEqual(result, "Template");
  });

  it("handles file with path", () => {
    const result = deriveTemplateNameFromFilePath("/path/to/_header-test.txt");
    assert.strictEqual(result, "Test");
  });

  it("handles Windows-style paths", () => {
    const result = deriveTemplateNameFromFilePath("C:\\templates\\_header-test.txt");
    assert.strictEqual(result, "Test");
  });

  it("capitalizes first letter of each word", () => {
    const result = deriveTemplateNameFromFilePath("_header-my-awesome-template.txt");
    assert.strictEqual(result, "My Awesome Template");
  });

  it("handles file with only header prefix", () => {
    const result = deriveTemplateNameFromFilePath("_header.txt");
    assert.strictEqual(result, "Template");
  });

  it("handles file with header_ prefix", () => {
    const result = deriveTemplateNameFromFilePath("header_test.txt");
    assert.strictEqual(result, "Test");
  });

  it("handles file with HEADER prefix (case insensitive)", () => {
    const result = deriveTemplateNameFromFilePath("HEADER-test.txt");
    assert.strictEqual(result, "Test");
  });

  it("handles file with no recognizable parts", () => {
    const result = deriveTemplateNameFromFilePath("_____.txt");
    assert.strictEqual(result, "Template");
  });

  it("handles Unicode in filename", () => {
    const result = deriveTemplateNameFromFilePath("_header-código.txt");
    assert.strictEqual(result, "Código");
  });

  it("handles numbers in filename", () => {
    const result = deriveTemplateNameFromFilePath("_header-v2-beta-3.txt");
    assert.strictEqual(result, "V2 Beta 3");
  });

  it("handles extremely long filename", () => {
    const longName = "_header-" + "word-".repeat(100) + "end.txt";
    const result = deriveTemplateNameFromFilePath(longName);
    assert.ok(result.length > 0);
  });
});

describe("buildNewTemplateContent - edge cases", () => {
  it("returns source contents when provided", () => {
    const source = "Line 1\nLine 2\nLine 3";
    const result = buildNewTemplateContent(DEFAULT_CONFIG, source);
    assert.strictEqual(result, source);
  });

  it("strips carriage returns from source", () => {
    const source = "Line 1\r\nLine 2\r\nLine 3";
    const result = buildNewTemplateContent(DEFAULT_CONFIG, source);
    assert.strictEqual(result, "Line 1\nLine 2\nLine 3");
  });

  it("handles null source", () => {
    const result = buildNewTemplateContent(DEFAULT_CONFIG, null);
    assert.ok(result.length > 0);
  });

  it("handles undefined source", () => {
    const result = buildNewTemplateContent(DEFAULT_CONFIG, undefined);
    assert.ok(result.length > 0);
  });

  it("handles empty string source", () => {
    const result = buildNewTemplateContent(DEFAULT_CONFIG, "");
    assert.ok(result.length > 0);
  });

  it("handles whitespace-only source", () => {
    const result = buildNewTemplateContent(DEFAULT_CONFIG, "   \t\n  ");
    assert.ok(result.length > 0);
  });

  it("uses config templateLines when no source", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templateLines: ["Custom 1", "Custom 2"],
    };
    const result = buildNewTemplateContent(config, null);
    assert.strictEqual(result, "Custom 1\nCustom 2");
  });

  it("uses DEFAULT_TEMPLATE_LINES when config has empty array", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templateLines: [],
    };
    const result = buildNewTemplateContent(config, null);
    assert.ok(result.length > 0);
  });

  it("handles source with only newlines (treated as whitespace)", () => {
    const source = "\n\n\n";
    const result = buildNewTemplateContent(DEFAULT_CONFIG, source);
    // Whitespace-only source falls back to default template
    assert.ok(result.length > 0);
    assert.ok(result !== "\n\n\n");
  });

  it("handles extremely long source", () => {
    const source = "Line\n".repeat(10000);
    const result = buildNewTemplateContent(DEFAULT_CONFIG, source);
    assert.strictEqual(result, source);
  });
});

describe("getPreferredTemplateDirectory - edge cases", () => {
  it("returns defaultRoot when no templates or templateFile", () => {
    const config = { ...DEFAULT_CONFIG, templates: [], templateFile: "" };
    const result = getPreferredTemplateDirectory(config, "/default/root");
    assert.strictEqual(result, "/default/root");
  });

  it("returns templates[0] directory when templates exist", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [
        { name: "First", path: "/templates/first.txt" },
        { name: "Second", path: "/other/second.txt" },
      ],
    };
    const result = getPreferredTemplateDirectory(config, "/default");
    assert.strictEqual(result, "/templates");
  });

  it("returns templateFile directory when no templates", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [],
      templateFile: "/my/templates/header.txt",
    };
    const result = getPreferredTemplateDirectory(config, "/default");
    assert.strictEqual(result, "/my/templates");
  });

  it("prefers templates over templateFile", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "T", path: "/priority/t.txt" }],
      templateFile: "/ignored/header.txt",
    };
    const result = getPreferredTemplateDirectory(config, "/default");
    assert.strictEqual(result, "/priority");
  });

  it("handles paths with spaces", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templateFile: "/my templates/with spaces/header.txt",
    };
    const result = getPreferredTemplateDirectory(config, "/default");
    assert.strictEqual(result, "/my templates/with spaces");
  });
});

describe("getTemplateSearchDirectories - edge cases", () => {
  it("returns only defaultRoot when no config", () => {
    const config = { ...DEFAULT_CONFIG, templates: [], templateFile: "" };
    const result = getTemplateSearchDirectories(config, "/default");
    assert.deepStrictEqual(result, ["/default"].map(p => path.resolve(p)));
  });

  it("deduplicates directories", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [
        { name: "A", path: "/templates/a.txt" },
        { name: "B", path: "/templates/b.txt" },
      ],
    };
    const result = getTemplateSearchDirectories(config, "/default");
    assert.strictEqual(result.filter(d => d === path.resolve("/templates")).length, 1);
  });

  it("handles case-insensitive deduplication on Windows", () => {
    if (process.platform !== "win32") {
      return;
    }
    const config = {
      ...DEFAULT_CONFIG,
      templates: [
        { name: "A", path: "C:\\Templates\\a.txt" },
        { name: "B", path: "c:\\templates\\b.txt" },
      ],
    };
    const result = getTemplateSearchDirectories(config, "C:\\default");
    const templatesCount = result.filter(d => d.toLowerCase().includes("templates")).length;
    assert.strictEqual(templatesCount, 1);
  });

  it("includes all unique directories from templates and templateFile", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "A", path: "/dir1/a.txt" }],
      templateFile: "/dir2/header.txt",
    };
    const result = getTemplateSearchDirectories(config, "/default");
    assert.ok(result.includes(path.resolve("/dir1")));
    assert.ok(result.includes(path.resolve("/dir2")));
    assert.ok(result.includes(path.resolve("/default")));
  });

  it("handles undefined directory gracefully", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "A", path: "" }],
    };
    const result = getTemplateSearchDirectories(config, "/default");
    assert.ok(result.length > 0);
  });
});

describe("resolveUniqueTemplatePath - edge cases", () => {
  it("returns first candidate when no conflicts", () => {
    const exists = () => false;
    const result = resolveUniqueTemplatePath("Test", DEFAULT_CONFIG, "/root", exists);
    assert.strictEqual(result, path.join("/root", "_header-test.txt"));
  });

  it("returns second candidate when first exists", () => {
    const exists = (p: string) => p.endsWith("_header-test.txt");
    const result = resolveUniqueTemplatePath("Test", DEFAULT_CONFIG, "/root", exists);
    assert.strictEqual(result, path.join("/root", "_header-test-2.txt"));
  });

  it("finds first available slot", () => {
    const exists = (p: string) => {
      return p.endsWith("_header-test.txt") ||
             p.endsWith("_header-test-2.txt") ||
             p.endsWith("_header-test-3.txt");
    };
    const result = resolveUniqueTemplatePath("Test", DEFAULT_CONFIG, "/root", exists);
    assert.strictEqual(result, path.join("/root", "_header-test-4.txt"));
  });

  it("throws when all 999 slots are taken", () => {
    const exists = () => true;
    assert.throws(
      () => resolveUniqueTemplatePath("Test", DEFAULT_CONFIG, "/root", exists),
      /failed to resolve.*unique/
    );
  });

  it("handles name with special characters", () => {
    const exists = () => false;
    const result = resolveUniqueTemplatePath("C++ Header!", DEFAULT_CONFIG, "/root", exists);
    assert.ok(result.includes("_header-c-header.txt"));
  });

  it("uses preferred directory from config", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "T", path: "/priority/t.txt" }],
    };
    const exists = () => false;
    const result = resolveUniqueTemplatePath("Test", config, "/default", exists);
    // Path gets resolved, so check the normalized path
    const normalizedResult = result.replace(/\\/g, "/");
    assert.ok(normalizedResult.includes("priority"));
  });
});

describe("mergeTemplateSources - edge cases", () => {
  it("returns empty array when no sources", () => {
    const result = mergeTemplateSources([], []);
    assert.deepStrictEqual(result, []);
  });

  it("returns only configured templates when no discovered", () => {
    const configured = [
      { name: "A", path: "/a.txt" },
      { name: "B", path: "/b.txt" },
    ];
    const result = mergeTemplateSources(configured, []);
    assert.strictEqual(result.length, 2);
  });

  it("returns only discovered templates when no configured", () => {
    const discovered = ["/x.txt", "/y.txt"];
    const result = mergeTemplateSources([], discovered);
    assert.strictEqual(result.length, 2);
  });

  it("deduplicates by path", () => {
    const configured = [{ name: "A", path: "/same.txt" }];
    const discovered = ["/same.txt"];
    const result = mergeTemplateSources(configured, discovered);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "A");
  });

  it("handles case-insensitive deduplication on Windows", () => {
    if (process.platform !== "win32") {
      return;
    }
    const configured = [{ name: "A", path: "C:\\Template.txt" }];
    const discovered = ["c:\\template.txt"];
    const result = mergeTemplateSources(configured, discovered);
    assert.strictEqual(result.length, 1);
  });

  it("derives names for discovered templates", () => {
    const discovered = ["_header-cpp.txt", "_header-python.txt"];
    const result = mergeTemplateSources([], discovered);
    assert.strictEqual(result[0].name, "Cpp");
    assert.strictEqual(result[1].name, "Python");
  });

  it("preserves configured names over derived names", () => {
    const configured = [{ name: "My Custom Name", path: "/header.txt" }];
    const discovered = ["/header.txt"];
    const result = mergeTemplateSources(configured, discovered);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "My Custom Name");
  });

  it("handles paths with spaces and special characters", () => {
    const discovered = ["/my templates/c++ header.txt"];
    const result = mergeTemplateSources([], discovered);
    assert.strictEqual(result.length, 1);
  });

  it("handles extremely long lists", () => {
    const discovered = Array.from({ length: 1000 }, (_, i) => `/template-${i}.txt`);
    const result = mergeTemplateSources([], discovered);
    assert.strictEqual(result.length, 1000);
  });
});

describe("buildUpdatedTemplateList - edge cases", () => {
  it("adds to empty templates list", () => {
    const config = { ...DEFAULT_CONFIG, templates: [] };
    const newTemplate = { name: "New", path: "/new.txt" };
    const result = buildUpdatedTemplateList(config, newTemplate);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "New");
  });

  it("appends to existing templates list", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "Existing", path: "/existing.txt" }],
    };
    const newTemplate = { name: "New", path: "/new.txt" };
    const result = buildUpdatedTemplateList(config, newTemplate);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[1].name, "New");
  });

  it("converts templateFile to templates list", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [],
      templateFile: "/current.txt",
    };
    const newTemplate = { name: "New", path: "/new.txt" };
    const result = buildUpdatedTemplateList(config, newTemplate);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].name, "Default");
    assert.strictEqual(result[1].name, "New");
  });

  it("prefers templates over templateFile", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "Existing", path: "/existing.txt" }],
      templateFile: "/ignored.txt",
    };
    const newTemplate = { name: "New", path: "/new.txt" };
    const result = buildUpdatedTemplateList(config, newTemplate);
    assert.strictEqual(result.length, 2);
    assert.ok(!result.some(t => t.path === "/ignored.txt"));
  });

  it("handles duplicate paths gracefully", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "A", path: "/same.txt" }],
    };
    const newTemplate = { name: "B", path: "/same.txt" };
    const result = buildUpdatedTemplateList(config, newTemplate);
    assert.strictEqual(result.length, 2);
  });
});

describe("getEditableTemplateCandidates - edge cases", () => {
  it("returns empty array when no templates or templateFile", () => {
    const config = { ...DEFAULT_CONFIG, templates: [], templateFile: "" };
    const result = getEditableTemplateCandidates(config);
    assert.deepStrictEqual(result, []);
  });

  it("returns templates when available", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [
        { name: "A", path: "/a.txt" },
        { name: "B", path: "/b.txt" },
      ],
    };
    const result = getEditableTemplateCandidates(config);
    assert.strictEqual(result.length, 2);
  });

  it("returns templateFile as 'Current Template' when no templates", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [],
      templateFile: "/current.txt",
    };
    const result = getEditableTemplateCandidates(config);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].name, "Current Template");
    assert.strictEqual(result[0].path, "/current.txt");
  });

  it("prefers templates over templateFile", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templates: [{ name: "Priority", path: "/priority.txt" }],
      templateFile: "/ignored.txt",
    };
    const result = getEditableTemplateCandidates(config);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].path, "/priority.txt");
  });

  it("handles extremely long templates list", () => {
    const templates = Array.from({ length: 1000 }, (_, i) => ({
      name: `Template ${i}`,
      path: `/template-${i}.txt`,
    }));
    const config = { ...DEFAULT_CONFIG, templates };
    const result = getEditableTemplateCandidates(config);
    assert.strictEqual(result.length, 1000);
  });
});
