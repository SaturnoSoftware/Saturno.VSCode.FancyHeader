import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { _CalculateCopyrightYear } from "../Source/Formatting";
import { DEFAULT_CONFIG } from "../Source/Config";
import {
  _ResolveAuthorInfo,
  _ResolveProjectName,
  _ResolveConfiguredTemplateLines,
  ResolveTemplateDataAsync,
  _ResolveTemplateFilePath,
} from "../Source/Runtime";

const PLATFORM_TEST_ROOT = process.platform === "win32"
  ? "D:\\Projects\\repo"
  : "/projects/repo";

describe("format helpers", () => {
  it("returns a single copyright year for same-year files", () => {
    const fileDate = new Date(2026, 0, 1);
    const currentDate = new Date(2026, 5, 1);
    assert.strictEqual(_CalculateCopyrightYear(fileDate, currentDate), "2026");
  });

  it("returns a year range for older files", () => {
    const fileDate = new Date(2024, 0, 1);
    const currentDate = new Date(2026, 5, 1);
    assert.strictEqual(_CalculateCopyrightYear(fileDate, currentDate), "2024 - 2026");
  });
});

describe("_ResolveAuthorInfo", () => {
  it("prefers explicit overrides", () => {
    const result = _ResolveAuthorInfo(
      "Override Name",
      "override@example.com",
      { name: "Git Name", email: "git@example.com" },
      "os-user"
    );

    assert.deepStrictEqual(result, {
      name: "Override Name",
      email: "override@example.com",
    });
  });

  describe("template files", () => {
    it("resolves workspace and file directory tokens", () => {
      const workspaceFolderPath = PLATFORM_TEST_ROOT;
      const currentFilePath = path.join(workspaceFolderPath, "src", "main.ts");

      assert.strictEqual(
        _ResolveTemplateFilePath("${workspaceFolder}/templates/header.txt", currentFilePath, workspaceFolderPath),
        path.resolve(workspaceFolderPath, "templates", "header.txt")
      );

      assert.strictEqual(
        _ResolveTemplateFilePath("${fileDirname}/header.txt", currentFilePath, workspaceFolderPath),
        path.resolve(workspaceFolderPath, "src", "header.txt")
      );
    });

    it("loads template lines from a file and trims only trailing empty lines", () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-template-"));
      const workspaceFolderPath = tempRoot;
      const currentFilePath = path.join(tempRoot, "src", "main.ts");
      const templateFilePath = path.join(tempRoot, "_header-template.txt");

      fs.mkdirSync(path.dirname(currentFilePath), { recursive: true });
      fs.writeFileSync(currentFilePath, "");
      fs.writeFileSync(templateFilePath, "Line 1\n\nLine 3\n");

      const lines = _ResolveConfiguredTemplateLines(currentFilePath, workspaceFolderPath, {
        ...DEFAULT_CONFIG,
        templateFile: "${workspaceFolder}/_header-template.txt",
      });

      assert.deepStrictEqual(lines, ["Line 1", "", "Line 3"]);
    });

    it("throws when the configured template file cannot be read", () => {
      const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-template-missing-"));
      const currentFilePath = path.join(tempRoot, "main.ts");
      fs.writeFileSync(currentFilePath, "");

      assert.throws(
        () => _ResolveConfiguredTemplateLines(currentFilePath, tempRoot, {
          ...DEFAULT_CONFIG,
          templateFile: "${workspaceFolder}/missing.txt",
        }),
        /failed to read template file/
      );
    });
  });

  it("falls back to git info and then the OS username", () => {
    const fromGit = _ResolveAuthorInfo("", "", { name: "Git Name", email: "git@example.com" }, "os-user");
    assert.deepStrictEqual(fromGit, {
      name: "Git Name",
      email: "git@example.com",
    });

    const fromOs = _ResolveAuthorInfo("", "", null, "os-user");
    assert.deepStrictEqual(fromOs, {
      name: "os-user",
      email: "",
    });
  });
});

describe("async template data", () => {
  it("uses non-blocking Git probes and falls back to file metadata", async () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-async-"));
    const filePath = path.join(tempRoot, "sample.ts");
    fs.writeFileSync(filePath, "export const sample = true;\n");

    const result = await ResolveTemplateDataAsync(filePath, {
      ...DEFAULT_CONFIG,
      authorName: "Release Author",
      copyrightOwner: "Saturno Software",
    }, tempRoot, "Demo Workspace");

    assert.strictEqual(result.fileName, "sample.ts");
    assert.strictEqual(result.projectName, "Demo Workspace");
    assert.strictEqual(result.userName, "Release Author");
    assert.strictEqual(result.copyrightOwner, "Saturno Software");
    assert.match(result.lastModified, /^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("git metadata helpers", () => {
  it("prefers git root over workspace folder for project metadata", () => {
    const workspaceRoot = process.platform === "win32"
      ? "D:\\Projects\\saturnosoftware"
      : "/projects/saturnosoftware";
    const repoRoot = path.join(workspaceRoot, "repos_internal", "Fancy", "Saturno.VSCode.FancyLib");
    const filePath = path.join(repoRoot, "src", "EditorUtils.ts");

    assert.strictEqual(
      _ResolveProjectName(
        filePath,
        repoRoot,        // gitRoot (more specific)
        workspaceRoot    // workspaceFolderPath (parent monorepo)
      ),
      "Saturno.VSCode.FancyLib"
    );
  });
});
