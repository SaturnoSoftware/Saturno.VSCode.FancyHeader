import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { calculateCopyrightYear, formatDateYYYYMMDD } from "../src/formatting";
import { DEFAULT_CONFIG } from "../src/formatting";
import {
  findGitRootFromFilePath,
  readGitUserInfoFromConfigFiles,
  resolveAuthorInfo,
  resolveConfiguredTemplateLines,
  resolveProjectName,
  resolveLastModifiedDate,
  resolveTemplateFilePath,
  resolveTemplateDataAsync,
} from "../src/runtime";

const PLATFORM_TEST_ROOT = process.platform === "win32"
  ? "D:\\Projects\\repo"
  : "/projects/repo";

describe("format helpers", () => {
  it("formats dates as YYYY-MM-DD", () => {
    const date = new Date(2026, 4, 28);
    assert.strictEqual(formatDateYYYYMMDD(date), "2026-05-28");
  });

  it("returns a single copyright year for same-year files", () => {
    const fileDate = new Date(2026, 0, 1);
    const currentDate = new Date(2026, 5, 1);
    assert.strictEqual(calculateCopyrightYear(fileDate, currentDate), "2026");
  });

  it("returns a year range for older files", () => {
    const fileDate = new Date(2024, 0, 1);
    const currentDate = new Date(2026, 5, 1);
    assert.strictEqual(calculateCopyrightYear(fileDate, currentDate), "2024 - 2026");
  });
});

describe("LAST_MODIFIED", () => {
  it("prefers the date of the last Git commit over the file timestamp", () => {
    const result = resolveLastModifiedDate(
      "/repo/src/main.ts",
      "/repo",
      () => new Date(2026, 4, 28),
      () => new Date(2026, 5, 1)
    );

    assert.strictEqual(formatDateYYYYMMDD(result), "2026-05-28");
  });

  it("falls back to the file modification timestamp without Git metadata", () => {
    const result = resolveLastModifiedDate(
      "/repo/src/main.ts",
      null,
      () => null,
      () => new Date(2026, 5, 1)
    );

    assert.strictEqual(formatDateYYYYMMDD(result), "2026-06-01");
  });
});
describe("resolveAuthorInfo", () => {
  it("prefers explicit overrides", () => {
    const result = resolveAuthorInfo(
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
        resolveTemplateFilePath("${workspaceFolder}/templates/header.txt", currentFilePath, workspaceFolderPath),
        path.resolve(workspaceFolderPath, "templates", "header.txt")
      );

      assert.strictEqual(
        resolveTemplateFilePath("${fileDirname}/header.txt", currentFilePath, workspaceFolderPath),
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

      const lines = resolveConfiguredTemplateLines(currentFilePath, workspaceFolderPath, {
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
        () => resolveConfiguredTemplateLines(currentFilePath, tempRoot, {
          ...DEFAULT_CONFIG,
          templateFile: "${workspaceFolder}/missing.txt",
        }),
        /failed to read template file/
      );
    });
  });

  it("falls back to git info and then the OS username", () => {
    const fromGit = resolveAuthorInfo("", "", { name: "Git Name", email: "git@example.com" }, "os-user");
    assert.deepStrictEqual(fromGit, {
      name: "Git Name",
      email: "git@example.com",
    });

    const fromOs = resolveAuthorInfo("", "", null, "os-user");
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

    const result = await resolveTemplateDataAsync(filePath, {
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
    const repoRoot = path.join(workspaceRoot, "repos_public", "Libs", "Saturno.VSCodeKit");
    const filePath = path.join(repoRoot, "src", "EditorUtils.ts");

    assert.strictEqual(
      resolveProjectName(
        filePath,
        repoRoot,        // gitRoot (more specific)
        workspaceRoot    // workspaceFolderPath (parent monorepo)
      ),
      "Saturno.VSCodeKit"
    );
  });

  it("finds the nearest git root by walking parent directories", () => {
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-git-root-"));
    const filePath = path.join(tempRoot, "packages", "demo", "src", "main.ts");

    fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, "");

    assert.strictEqual(findGitRootFromFilePath(filePath), tempRoot);
  });

  it("reads local and global git identity from config files", () => {
    const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-home-"));
    const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-config-"));

    fs.mkdirSync(path.join(tempRoot, ".git"), { recursive: true });
    fs.writeFileSync(
      path.join(tempRoot, ".git", "config"),
      "[user]\nname = Local Name\n"
    );
    fs.writeFileSync(
      path.join(tempHome, ".gitconfig"),
      "[user]\nemail = global@example.com\n"
    );

    assert.deepStrictEqual(readGitUserInfoFromConfigFiles(tempRoot, tempHome), {
      name: "Local Name",
      email: "global@example.com",
    });
  });
});
