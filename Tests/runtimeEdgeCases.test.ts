import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  ResolveAuthorInfo,
  ResolveProjectName,
  ResolveConfiguredTemplateLines,
  ResolveTemplateFilePath,
} from "../Source/Core/HeaderData";
import { DEFAULT_CONFIG } from "../Source/Core/Config";

describe("ResolveAuthorInfo - edge cases", () => {
  it("handles all empty strings", () => {
    const result = ResolveAuthorInfo("", "", null, "");
    assert.strictEqual(result.name, "");
    assert.strictEqual(result.email, "");
  });

  it("handles only whitespace in overrides", () => {
    const result = ResolveAuthorInfo("   ", "\t\t", null, "fallback");
    assert.strictEqual(result.name, "fallback");
    assert.strictEqual(result.email, "");
  });

  it("handles special characters in author name", () => {
    const result = ResolveAuthorInfo("Jöhn Döe 🚀", "", null, "fallback");
    assert.strictEqual(result.name, "Jöhn Döe 🚀");
  });

  it("handles extremely long author name", () => {
    const longName = "X".repeat(10000);
    const result = ResolveAuthorInfo(longName, "", null, "fallback");
    assert.strictEqual(result.name, longName);
  });

  it("handles email with unusual but valid characters", () => {
    const result = ResolveAuthorInfo("", "user+tag@sub.domain.co.uk", null, "");
    assert.strictEqual(result.email, "user+tag@sub.domain.co.uk");
  });

  it("handles malformed email (does not validate)", () => {
    const result = ResolveAuthorInfo("", "not-an-email", null, "");
    assert.strictEqual(result.email, "not-an-email");
  });

  it("prefers override over git even when git has values", () => {
    const result = ResolveAuthorInfo(
      "Override",
      "override@example.com",
      { name: "Git Name", email: "git@example.com" },
      "os"
    );
    assert.strictEqual(result.name, "Override");
    assert.strictEqual(result.email, "override@example.com");
  });

  it("mixes sources: name from git, email from override", () => {
    const result = ResolveAuthorInfo(
      "",
      "override@example.com",
      { name: "Git Name", email: "" },
      "os"
    );
    assert.strictEqual(result.name, "Git Name");
    assert.strictEqual(result.email, "override@example.com");
  });

  it("handles null git info correctly", () => {
    const result = ResolveAuthorInfo("", "", null, "fallback");
    assert.strictEqual(result.name, "fallback");
    assert.strictEqual(result.email, "");
  });

  it("handles git info with only name", () => {
    const result = ResolveAuthorInfo("", "", { name: "Git Name", email: "" }, "fallback");
    assert.strictEqual(result.name, "Git Name");
    assert.strictEqual(result.email, "");
  });

  it("handles git info with only email", () => {
    const result = ResolveAuthorInfo("", "", { name: "", email: "git@example.com" }, "fallback");
    assert.strictEqual(result.name, "fallback");
    assert.strictEqual(result.email, "git@example.com");
  });
});

describe("ResolveProjectName - edge cases", () => {
  it("returns directory name when no git root or workspace", () => {
    const filePath = process.platform === "win32"
      ? "D:\\random\\path\\file.ts"
      : "/random/path/file.ts";
    const result = ResolveProjectName(filePath, null, null);
    assert.strictEqual(result, "path");
  });

  it("prefers git root over workspace folder", () => {
    const filePath = process.platform === "win32"
      ? "D:\\projects\\monorepo\\packages\\app\\src\\file.ts"
      : "/projects/monorepo/packages/app/src/file.ts";
    const gitRoot = process.platform === "win32"
      ? "D:\\projects\\monorepo\\packages\\app"
      : "/projects/monorepo/packages/app";
    const workspace = process.platform === "win32"
      ? "D:\\projects\\monorepo"
      : "/projects/monorepo";

    const result = ResolveProjectName(filePath, gitRoot, workspace);
    assert.strictEqual(result, "app");
  });

  it("uses the VS Code workspace folder name when Git is unavailable", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\internal-tools"
      : "/projects/internal-tools";

    const result = ResolveProjectName("", null, workspace, "Saturno Internal Tools");
    assert.strictEqual(result, "Saturno Internal Tools");
  });

  it("ignores an empty workspace folder name and falls back to its path", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\internal-tools"
      : "/projects/internal-tools";

    const result = ResolveProjectName("", null, workspace, "   ");
    assert.strictEqual(result, "internal-tools");
  });

  it("handles workspace folder with Unicode name", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\项目名称"
      : "/projects/项目名称";
    const result = ResolveProjectName("", null, workspace);
    assert.strictEqual(result, "项目名称");
  });

  it("handles workspace folder with spaces", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\my awesome project"
      : "/projects/my awesome project";
    const result = ResolveProjectName("", null, workspace);
    assert.strictEqual(result, "my awesome project");
  });

  it("handles git root when workspace is null", () => {
    const gitRoot = process.platform === "win32"
      ? "D:\\repos\\cool-project"
      : "/repos/cool-project";
    const result = ResolveProjectName("", gitRoot, null);
    assert.strictEqual(result, "cool-project");
  });

  it("handles extremely long project name", () => {
    const longName = "project-" + "x".repeat(255);
    const workspace = process.platform === "win32"
      ? `D:\\${longName}`
      : `/${longName}`;
    const result = ResolveProjectName("", null, workspace);
    assert.strictEqual(result, longName);
  });
});

describe("ResolveTemplateFilePath - edge cases", () => {
  it("throws on empty path", () => {
    assert.throws(
      () => ResolveTemplateFilePath("", "/current/file.ts", "/workspace"),
      /empty/
    );
  });

  it("throws on whitespace-only path", () => {
    assert.throws(
      () => ResolveTemplateFilePath("   \t  ", "/current/file.ts", "/workspace"),
      /empty/
    );
  });

  it("throws when ${workspaceFolder} used without workspace", () => {
    assert.throws(
      () => ResolveTemplateFilePath("${workspaceFolder}/template.txt", "/file.ts", null),
      /workspaceFolder.*requires/i
    );
  });

  it("resolves ${workspaceFolder} token", () => {
    const workspace = process.platform === "win32"
      ? "D:\\workspace"
      : "/workspace";
    const result = ResolveTemplateFilePath("${workspaceFolder}/template.txt", "", workspace);
    const expected = path.resolve(workspace, "template.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves ${fileDirname} token", () => {
    const filePath = process.platform === "win32"
      ? "D:\\projects\\src\\main.ts"
      : "/projects/src/main.ts";
    const result = ResolveTemplateFilePath("${fileDirname}/header.txt", filePath, null);
    const expected = path.resolve(path.dirname(filePath), "header.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves ~ to home directory", () => {
    const result = ResolveTemplateFilePath("~/templates/header.txt", "/file.ts", null);
    const expected = path.join(os.homedir(), "templates", "header.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves ~/ to home directory", () => {
    const result = ResolveTemplateFilePath("~/templates/header.txt", "/file.ts", null);
    assert.ok(result.startsWith(os.homedir()));
  });

  it("handles multiple token replacements", () => {
    const workspace = process.platform === "win32"
      ? "D:\\workspace"
      : "/workspace";
    const filePath = path.join(workspace, "src", "main.ts");
    const template = "${workspaceFolder}/templates/${fileDirname}/header.txt";
    const result = ResolveTemplateFilePath(template, filePath, workspace);
    assert.ok(path.isAbsolute(result));
  });

  it("handles path with spaces", () => {
    const workspace = process.platform === "win32"
      ? "D:\\my workspace"
      : "/my workspace";
    const result = ResolveTemplateFilePath("${workspaceFolder}/my templates/header.txt", "", workspace);
    assert.ok(result.includes("my workspace"));
    assert.ok(result.includes("my templates"));
  });

  it("handles path with Unicode characters", () => {
    const workspace = process.platform === "win32"
      ? "D:\\工作区"
      : "/工作区";
    const result = ResolveTemplateFilePath("${workspaceFolder}/模板/header.txt", "", workspace);
    assert.ok(result.includes("工作区"));
  });

  it("resolves relative path from workspace when available", () => {
    const workspace = process.platform === "win32"
      ? "D:\\workspace"
      : "/workspace";
    const result = ResolveTemplateFilePath("templates/header.txt", "/file.ts", workspace);
    const expected = path.resolve(workspace, "templates", "header.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves relative path from file dirname when no workspace", () => {
    const filePath = process.platform === "win32"
      ? "D:\\projects\\src\\main.ts"
      : "/projects/src/main.ts";
    const result = ResolveTemplateFilePath("../templates/header.txt", filePath, null);
    const expected = path.resolve(path.dirname(filePath), "..", "templates", "header.txt");
    assert.strictEqual(result, expected);
  });

  it("preserves absolute paths as-is", () => {
    const absolute = process.platform === "win32"
      ? "D:\\absolute\\path\\template.txt"
      : "/absolute/path/template.txt";
    const result = ResolveTemplateFilePath(absolute, "/file.ts", "/workspace");
    assert.strictEqual(result, path.resolve(absolute));
  });
});

describe("ResolveConfiguredTemplateLines - error cases", () => {
  it("throws when template file cannot be read", () => {
    const fakePath = "/this/does/not/exist/template.txt";
    assert.throws(
      () => ResolveConfiguredTemplateLines("", null, {
        ...DEFAULT_CONFIG,
        templateFile: fakePath,
      }),
      /failed to read/
    );
  });

  it("throws when template file is empty", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "empty-template-"));
    const templatePath = path.join(tempRoot, "empty.txt");
    fs.writeFileSync(templatePath, "");

    assert.throws(
      () => ResolveConfiguredTemplateLines("", null, {
        ...DEFAULT_CONFIG,
        templateFile: templatePath,
      }),
      /empty/
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("throws when template file is only newlines", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "newlines-template-"));
    const templatePath = path.join(tempRoot, "newlines.txt");
    fs.writeFileSync(templatePath, "\n\n\n\n");

    assert.throws(
      () => ResolveConfiguredTemplateLines("", null, {
        ...DEFAULT_CONFIG,
        templateFile: templatePath,
      }),
      /empty/
    );

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("strips BOM from template file", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "bom-template-"));
    const templatePath = path.join(tempRoot, "bom.txt");
    fs.writeFileSync(templatePath, "\uFEFFLine 1\nLine 2");

    const lines = ResolveConfiguredTemplateLines("", null, {
      ...DEFAULT_CONFIG,
      templateFile: templatePath,
    });

    assert.strictEqual(lines[0], "Line 1");
    assert.ok(!lines[0].startsWith("\uFEFF"));

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("handles template file with CRLF line endings", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crlf-template-"));
    const templatePath = path.join(tempRoot, "crlf.txt");
    fs.writeFileSync(templatePath, "Line 1\r\nLine 2\r\nLine 3");

    const lines = ResolveConfiguredTemplateLines("", null, {
      ...DEFAULT_CONFIG,
      templateFile: templatePath,
    });

    assert.strictEqual(lines.length, 3);
    assert.strictEqual(lines[0], "Line 1");

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("returns configured lines when templateFile is not set", () => {
    const config = {
      ...DEFAULT_CONFIG,
      templateFile: "",
      templateLines: ["Custom Line 1", "Custom Line 2"],
    };

    const lines = ResolveConfiguredTemplateLines("", null, config);
    assert.deepStrictEqual(lines, ["Custom Line 1", "Custom Line 2"]);
  });
});
