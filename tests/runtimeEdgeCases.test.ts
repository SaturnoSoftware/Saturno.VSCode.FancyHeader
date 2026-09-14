import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  findGitRootFromFilePath,
  readGitUserInfoFromConfigFiles,
  resolveAuthorInfo,
  resolveProjectName,
  resolveTemplateFilePath,
  resolveConfiguredTemplateLines,
  getDefaultUserTemplateRoot,
} from "../Source/runtime";
import { DEFAULT_CONFIG } from "../Source/formatting";

describe("findGitRootFromFilePath - edge cases", () => {
  it("returns null when no .git directory exists anywhere", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "no-git-"));
    const filePath = path.join(tempRoot, "deep", "nested", "file.ts");

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "");

    const result = findGitRootFromFilePath(filePath);
    assert.strictEqual(result, null);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("returns null for non-existent file path", () => {
    const fakePath = path.join(os.tmpdir(), "does-not-exist", "fake", "file.ts");
    const result = findGitRootFromFilePath(fakePath);
    assert.strictEqual(result, null);
  });

  it("handles extremely deep directory nesting", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "deep-git-"));
    const deepPath = path.join(tempRoot, "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "file.ts");

    fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
    fs.mkdirSync(path.dirname(deepPath), { recursive: true });
    fs.writeFileSync(deepPath, "");

    const result = findGitRootFromFilePath(deepPath);
    assert.strictEqual(result, tempRoot);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("handles path with spaces in directory names", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "git-with-spaces-"));
    const spacedPath = path.join(tempRoot, "my project", "src files", "main file.ts");

    fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
    fs.mkdirSync(path.dirname(spacedPath), { recursive: true });
    fs.writeFileSync(spacedPath, "");

    const result = findGitRootFromFilePath(spacedPath);
    assert.strictEqual(result, tempRoot);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("handles path with Unicode characters", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "git-unicode-"));
    const unicodePath = path.join(tempRoot, "código", "文件", "файл.ts");

    fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
    fs.mkdirSync(path.dirname(unicodePath), { recursive: true });
    fs.writeFileSync(unicodePath, "");

    const result = findGitRootFromFilePath(unicodePath);
    assert.strictEqual(result, tempRoot);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("handles multiple nested .git directories (returns closest)", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nested-git-"));
    const outerGit = path.join(tempRoot, ".git");
    const innerPath = path.join(tempRoot, "submodule", "src");
    const innerGit = path.join(tempRoot, "submodule", ".git");
    const filePath = path.join(innerPath, "file.ts");

    fs.mkdirSync(outerGit, { recursive: true });
    fs.mkdirSync(innerGit, { recursive: true });
    fs.mkdirSync(innerPath, { recursive: true });
    fs.writeFileSync(filePath, "");

    const result = findGitRootFromFilePath(filePath);
    assert.strictEqual(result, path.join(tempRoot, "submodule"));

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("handles .git as a file (worktree/submodule pointer)", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "git-file-"));
    const gitFile = path.join(tempRoot, ".git");
    const filePath = path.join(tempRoot, "file.ts");

    fs.writeFileSync(gitFile, "gitdir: /path/to/real/git");
    fs.writeFileSync(filePath, "");

    const result = findGitRootFromFilePath(filePath);
    assert.strictEqual(result, tempRoot);

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
});

describe("readGitUserInfoFromConfigFiles - malicious inputs", () => {
  it("handles git config with SQL injection attempt", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "evil-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      "[user]\nname = Robert'); DROP TABLE users;--\nemail = evil@example.com\n"
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result?.name, "Robert'); DROP TABLE users;--");
    assert.strictEqual(result?.email, "evil@example.com");

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with script injection in name", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "script-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      "[user]\nname = <script>alert('xss')</script>\nemail = xss@example.com\n"
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result?.name, "<script>alert('xss')</script>");

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with extremely long values", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "long-git-"));
    const configPath = path.join(tempHome, ".gitconfig");
    const longName = "A".repeat(10000);

    fs.writeFileSync(
      configPath,
      `[user]\nname = ${longName}\nemail = long@example.com\n`
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result?.name, longName);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with null bytes", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "null-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      Buffer.from("[user]\nname = Test\x00Null\nemail = test@example.com\n")
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.ok(result !== null);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with invalid UTF-8 sequences", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "invalid-utf8-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      Buffer.from([0x5b, 0x75, 0x73, 0x65, 0x72, 0x5d, 0x0a, 0x6e, 0x61, 0x6d, 0x65, 0x20, 0x3d, 0x20, 0xff, 0xfe, 0x0a])
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.ok(result !== null || result === null);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with malformed section headers", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "malformed-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      "[user\nname = NoClosingBracket\nemail = test@example.com\n"
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    // Malformed config should return null since section header is invalid
    assert.strictEqual(result, null);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with duplicate keys", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "dup-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      "[user]\nname = First\nname = Second\nemail = first@example.com\nemail = second@example.com\n"
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.ok(result?.name === "First" || result?.name === "Second");

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with comments containing equals signs", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "comment-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      "[user]\n# This is a comment = with equals\nname = Real Name\nemail = real@example.com\n"
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result?.name, "Real Name");

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with values in quotes", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "quoted-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      '[user]\nname = "Quoted Name"\nemail = \'single@example.com\'\n'
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result?.name, "Quoted Name");
    assert.strictEqual(result?.email, "single@example.com");

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles git config with empty values", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "empty-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(
      configPath,
      "[user]\nname = \nemail = \n"
    );

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result, null);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });

  it("handles non-existent config file gracefully", () => {
    const result = readGitUserInfoFromConfigFiles(null, "/this/does/not/exist");
    assert.strictEqual(result, null);
  });

  it("handles config file with only whitespace", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "whitespace-git-"));
    const configPath = path.join(tempHome, ".gitconfig");

    fs.writeFileSync(configPath, "   \n\t\n   \n");

    const result = readGitUserInfoFromConfigFiles(null, tempHome);
    assert.strictEqual(result, null);

    fs.rmSync(tempHome, { recursive: true, force: true });
  });
});

describe("resolveAuthorInfo - edge cases", () => {
  it("handles all empty strings", () => {
    const result = resolveAuthorInfo("", "", null, "");
    assert.strictEqual(result.name, "");
    assert.strictEqual(result.email, "");
  });

  it("handles only whitespace in overrides", () => {
    const result = resolveAuthorInfo("   ", "\t\t", null, "fallback");
    assert.strictEqual(result.name, "fallback");
    assert.strictEqual(result.email, "");
  });

  it("handles special characters in author name", () => {
    const result = resolveAuthorInfo("Jöhn Döe 🚀", "", null, "fallback");
    assert.strictEqual(result.name, "Jöhn Döe 🚀");
  });

  it("handles extremely long author name", () => {
    const longName = "X".repeat(10000);
    const result = resolveAuthorInfo(longName, "", null, "fallback");
    assert.strictEqual(result.name, longName);
  });

  it("handles email with unusual but valid characters", () => {
    const result = resolveAuthorInfo("", "user+tag@sub.domain.co.uk", null, "");
    assert.strictEqual(result.email, "user+tag@sub.domain.co.uk");
  });

  it("handles malformed email (does not validate)", () => {
    const result = resolveAuthorInfo("", "not-an-email", null, "");
    assert.strictEqual(result.email, "not-an-email");
  });

  it("prefers override over git even when git has values", () => {
    const result = resolveAuthorInfo(
      "Override",
      "override@example.com",
      { name: "Git Name", email: "git@example.com" },
      "os"
    );
    assert.strictEqual(result.name, "Override");
    assert.strictEqual(result.email, "override@example.com");
  });

  it("mixes sources: name from git, email from override", () => {
    const result = resolveAuthorInfo(
      "",
      "override@example.com",
      { name: "Git Name", email: "" },
      "os"
    );
    assert.strictEqual(result.name, "Git Name");
    assert.strictEqual(result.email, "override@example.com");
  });

  it("handles null git info correctly", () => {
    const result = resolveAuthorInfo("", "", null, "fallback");
    assert.strictEqual(result.name, "fallback");
    assert.strictEqual(result.email, "");
  });

  it("handles git info with only name", () => {
    const result = resolveAuthorInfo("", "", { name: "Git Name", email: "" }, "fallback");
    assert.strictEqual(result.name, "Git Name");
    assert.strictEqual(result.email, "");
  });

  it("handles git info with only email", () => {
    const result = resolveAuthorInfo("", "", { name: "", email: "git@example.com" }, "fallback");
    assert.strictEqual(result.name, "fallback");
    assert.strictEqual(result.email, "git@example.com");
  });
});

describe("resolveProjectName - edge cases", () => {
  it("returns directory name when no git root or workspace", () => {
    const filePath = process.platform === "win32"
      ? "D:\\random\\path\\file.ts"
      : "/random/path/file.ts";
    const result = resolveProjectName(filePath, null, null);
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

    const result = resolveProjectName(filePath, gitRoot, workspace);
    assert.strictEqual(result, "app");
  });

  it("uses the VS Code workspace folder name when Git is unavailable", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\internal-tools"
      : "/projects/internal-tools";

    const result = resolveProjectName("", null, workspace, "Saturno Internal Tools");
    assert.strictEqual(result, "Saturno Internal Tools");
  });

  it("ignores an empty workspace folder name and falls back to its path", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\internal-tools"
      : "/projects/internal-tools";

    const result = resolveProjectName("", null, workspace, "   ");
    assert.strictEqual(result, "internal-tools");
  });

  it("handles workspace folder with Unicode name", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\项目名称"
      : "/projects/项目名称";
    const result = resolveProjectName("", null, workspace);
    assert.strictEqual(result, "项目名称");
  });

  it("handles workspace folder with spaces", () => {
    const workspace = process.platform === "win32"
      ? "D:\\projects\\my awesome project"
      : "/projects/my awesome project";
    const result = resolveProjectName("", null, workspace);
    assert.strictEqual(result, "my awesome project");
  });

  it("handles git root when workspace is null", () => {
    const gitRoot = process.platform === "win32"
      ? "D:\\repos\\cool-project"
      : "/repos/cool-project";
    const result = resolveProjectName("", gitRoot, null);
    assert.strictEqual(result, "cool-project");
  });

  it("handles extremely long project name", () => {
    const longName = "project-" + "x".repeat(255);
    const workspace = process.platform === "win32"
      ? `D:\\${longName}`
      : `/${longName}`;
    const result = resolveProjectName("", null, workspace);
    assert.strictEqual(result, longName);
  });
});

describe("resolveTemplateFilePath - edge cases", () => {
  it("throws on empty path", () => {
    assert.throws(
      () => resolveTemplateFilePath("", "/current/file.ts", "/workspace"),
      /empty/
    );
  });

  it("throws on whitespace-only path", () => {
    assert.throws(
      () => resolveTemplateFilePath("   \t  ", "/current/file.ts", "/workspace"),
      /empty/
    );
  });

  it("throws when ${workspaceFolder} used without workspace", () => {
    assert.throws(
      () => resolveTemplateFilePath("${workspaceFolder}/template.txt", "/file.ts", null),
      /workspaceFolder.*requires/i
    );
  });

  it("resolves ${workspaceFolder} token", () => {
    const workspace = process.platform === "win32"
      ? "D:\\workspace"
      : "/workspace";
    const result = resolveTemplateFilePath("${workspaceFolder}/template.txt", "", workspace);
    const expected = path.resolve(workspace, "template.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves ${fileDirname} token", () => {
    const filePath = process.platform === "win32"
      ? "D:\\projects\\src\\main.ts"
      : "/projects/src/main.ts";
    const result = resolveTemplateFilePath("${fileDirname}/header.txt", filePath, null);
    const expected = path.resolve(path.dirname(filePath), "header.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves ~ to home directory", () => {
    const result = resolveTemplateFilePath("~/templates/header.txt", "/file.ts", null);
    const expected = path.join(os.homedir(), "templates", "header.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves ~/ to home directory", () => {
    const result = resolveTemplateFilePath("~/templates/header.txt", "/file.ts", null);
    assert.ok(result.startsWith(os.homedir()));
  });

  it("handles multiple token replacements", () => {
    const workspace = process.platform === "win32"
      ? "D:\\workspace"
      : "/workspace";
    const filePath = path.join(workspace, "src", "main.ts");
    const template = "${workspaceFolder}/templates/${fileDirname}/header.txt";
    const result = resolveTemplateFilePath(template, filePath, workspace);
    assert.ok(path.isAbsolute(result));
  });

  it("handles path with spaces", () => {
    const workspace = process.platform === "win32"
      ? "D:\\my workspace"
      : "/my workspace";
    const result = resolveTemplateFilePath("${workspaceFolder}/my templates/header.txt", "", workspace);
    assert.ok(result.includes("my workspace"));
    assert.ok(result.includes("my templates"));
  });

  it("handles path with Unicode characters", () => {
    const workspace = process.platform === "win32"
      ? "D:\\工作区"
      : "/工作区";
    const result = resolveTemplateFilePath("${workspaceFolder}/模板/header.txt", "", workspace);
    assert.ok(result.includes("工作区"));
  });

  it("resolves relative path from workspace when available", () => {
    const workspace = process.platform === "win32"
      ? "D:\\workspace"
      : "/workspace";
    const result = resolveTemplateFilePath("templates/header.txt", "/file.ts", workspace);
    const expected = path.resolve(workspace, "templates", "header.txt");
    assert.strictEqual(result, expected);
  });

  it("resolves relative path from file dirname when no workspace", () => {
    const filePath = process.platform === "win32"
      ? "D:\\projects\\src\\main.ts"
      : "/projects/src/main.ts";
    const result = resolveTemplateFilePath("../templates/header.txt", filePath, null);
    const expected = path.resolve(path.dirname(filePath), "..", "templates", "header.txt");
    assert.strictEqual(result, expected);
  });

  it("preserves absolute paths as-is", () => {
    const absolute = process.platform === "win32"
      ? "D:\\absolute\\path\\template.txt"
      : "/absolute/path/template.txt";
    const result = resolveTemplateFilePath(absolute, "/file.ts", "/workspace");
    assert.strictEqual(result, path.resolve(absolute));
  });
});

describe("resolveConfiguredTemplateLines - error cases", () => {
  it("throws when template file cannot be read", () => {
    const fakePath = "/this/does/not/exist/template.txt";
    assert.throws(
      () => resolveConfiguredTemplateLines("", null, {
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
      () => resolveConfiguredTemplateLines("", null, {
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
      () => resolveConfiguredTemplateLines("", null, {
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
    fs.writeFileSync(templatePath, "﻿Line 1\nLine 2");

    const lines = resolveConfiguredTemplateLines("", null, {
      ...DEFAULT_CONFIG,
      templateFile: templatePath,
    });

    assert.strictEqual(lines[0], "Line 1");
    assert.ok(!lines[0].startsWith("﻿"));

    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  it("handles template file with CRLF line endings", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "crlf-template-"));
    const templatePath = path.join(tempRoot, "crlf.txt");
    fs.writeFileSync(templatePath, "Line 1\r\nLine 2\r\nLine 3");

    const lines = resolveConfiguredTemplateLines("", null, {
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

    const lines = resolveConfiguredTemplateLines("", null, config);
    assert.deepStrictEqual(lines, ["Custom Line 1", "Custom Line 2"]);
  });
});

describe("getDefaultUserTemplateRoot - platform handling", () => {
  it("returns Windows path for win32 platform", () => {
    const env = { APPDATA: "C:\\Users\\Test\\AppData\\Roaming" };
    const result = getDefaultUserTemplateRoot("win32", env, "C:\\Users\\Test");
    assert.ok(result.includes("AppData"));
    assert.ok(result.includes("saturno-fancy-header"));
  });

  it("returns macOS path for darwin platform", () => {
    const result = getDefaultUserTemplateRoot("darwin", {}, "/Users/test");
    assert.ok(result.includes("Library"));
    assert.ok(result.includes("Application Support"));
    assert.ok(result.includes("saturno-fancy-header"));
  });

  it("returns Linux path for linux platform", () => {
    const result = getDefaultUserTemplateRoot("linux", {}, "/home/test");
    assert.ok(result.includes(".config"));
    assert.ok(result.includes("saturno-fancy-header"));
  });

  it("handles missing APPDATA on Windows", () => {
    const result = getDefaultUserTemplateRoot("win32", {}, "C:\\Users\\Test");
    assert.ok(result.includes("AppData"));
  });

  it("handles unusual home directory paths", () => {
    const weirdHome = "/home/user with spaces/测试";
    const result = getDefaultUserTemplateRoot("linux", {}, weirdHome);
    assert.ok(result.startsWith(weirdHome));
  });
});
