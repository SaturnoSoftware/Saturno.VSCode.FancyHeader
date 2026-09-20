// -------------------------------------------------------------------------- //
//                               *       +                                    //
//                         '                  |                               //
//                     ()    .-.,="``"=.    - o -                             //
//                           '=/_       \\     |                              //
//                        *   |  '=._    |                                    //
//                             \\     `=./`,        '                         //
//                          .   '=.__.=' `='      *                           //
//                                                                            //
//                                                                            //
// File      : Runtime.ts                                                     //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-03                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

// -----------------------------------------------------------------------------
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
// This is the pure core (per platforms/VSCODE-EXTENSION.md): it must not
// import "vscode", directly or transitively, so it stays testable with plain
// node --test. Importing the FancyLib barrel here would pull in EditorUtils
// and ConfigUtils, which do import "vscode" - so these come from their own
// modules instead of the barrel.
// -----------------------------------------------------------------------------
import * as GitUtils from "../Libraries/Saturno.VSCode.FancyLib/Source/GitUtils";
import * as FileUtils from "../Libraries/Saturno.VSCode.FancyLib/Source/FileUtils";
import * as DateUtils from "../Libraries/Saturno.VSCode.FancyLib/Source/DateUtils";
import * as OSUtils from "../Libraries/Saturno.VSCode.FancyLib/Source/OSUtils";
// -----------------------------------------------------------------------------
import { HeaderConfig, HeaderTemplateData } from "./Config";
import { _CalculateCopyrightYear } from "./Formatting";

// -----------------------------------------------------------------------------
export async function ResolveTemplateDataAsync(
  filePath: string,
  config: HeaderConfig,
  workspaceFolderPath: string | null = null,
  workspaceFolderName: string | null = null
): Promise<HeaderTemplateData> {
  const git_root = GitUtils.FindGitRootFromFilePath(filePath)
    ?? await GitUtils.RunGitAsync(path.dirname(filePath), ["rev-parse", "--show-toplevel"]);

  const [initial_date, modified_date, git_name, git_email] = await Promise.all([
    _GetInitialFileDateAsync(filePath),
    git_root ? GitUtils.GetLastGitModifiedDateAsync(git_root, filePath) : Promise.resolve(null),
    git_root ? GitUtils.RunGitAsync(git_root, ["config", "user.name"]) : Promise.resolve(null),
    git_root ? GitUtils.RunGitAsync(git_root, ["config", "user.email"]) : Promise.resolve(null),
  ]);

  const file_date = initial_date ?? FileUtils.GetFileCreationDate(filePath) ?? new Date();
  const command_user = git_name || git_email ? { name: git_name ?? "", email: git_email ?? "" } : null;
  const author = _ResolveAuthorInfo(
    config.authorName,
    config.authorEmail,
    command_user ?? GitUtils.ReadGitUserInfoFromConfigFiles(git_root),
    OSUtils.GetCurrentUserName()
  );
  const fallback_modified = await _GetFileModificationDateAsync(filePath);

  return {
    fileName: path.basename(filePath),
    projectName: _ResolveProjectName(filePath, git_root, workspaceFolderPath, workspaceFolderName),
    date: DateUtils.FormatDateYYYYMMDD(file_date),
    lastModified: DateUtils.FormatDateYYYYMMDD(git_root && modified_date ? modified_date : fallback_modified ?? new Date()),
    copyrightYear: _CalculateCopyrightYear(file_date),
    copyrightOwner: config.copyrightOwner.trim() || author.name,
    userName: author.name,
    userEmail: author.email,
  };
}

// -----------------------------------------------------------------------------
async function _GetInitialFileDateAsync(filePath: string): Promise<Date | null> {
  const output = await GitUtils.RunGitAsync(path.dirname(filePath), [
    "log", "--follow", "--format=%ad", "--date=format:%Y-%m-%d", "--reverse", "--", filePath
  ]);
  const first_line = output?.split(/\r?\n/, 1)[0]?.trim();
  return first_line ? DateUtils.ParseDate(first_line) : null;
}

// -----------------------------------------------------------------------------
async function _GetFileModificationDateAsync(filePath: string): Promise<Date | null> {
  try {
    return (await fs.promises.stat(filePath)).mtime;
  } catch {
    return null;
  }
}

//
// Resolve Functions
//

// -----------------------------------------------------------------------------
export function _ResolveAuthorInfo(
  authorNameOverride: string,
  authorEmailOverride: string,
  gitUser: GitUtils.GitUserInfo | null,
  fallbackUserName: string
): GitUtils.GitUserInfo {
  const name = authorNameOverride.trim() || gitUser?.name?.trim() || fallbackUserName.trim();
  const email = authorEmailOverride.trim() || gitUser?.email?.trim() || "";

  return { name, email };
}

// -----------------------------------------------------------------------------
export function _ResolveConfiguredTemplateLines(
  currentFilePath: string,
  workspaceFolderPath: string | null,
  config: HeaderConfig
): string[] {
  if (!config.templateFile) {
    return config.templateLines;
  }

  const templatePath = _ResolveTemplateFilePath(config.templateFile, currentFilePath, workspaceFolderPath);
  let contents: string;

  try {
    contents = fs.readFileSync(templatePath, "utf8");
  } catch {
    throw new Error(`Saturno FancyHeader: failed to read template file "${templatePath}".`);
  }

  const lines = contents
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/);

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  if (lines.length === 0) {
    throw new Error(`Saturno FancyHeader: template file "${templatePath}" is empty.`);
  }

  return lines;
}

// -----------------------------------------------------------------------------
export function _ResolveTemplateFilePath(
  configuredPath: string,
  currentFilePath: string,
  workspaceFolderPath: string | null
): string {
  let resolved = configuredPath.trim();
  if (!resolved) {
    throw new Error("Saturno FancyHeader: template file path is empty.");
  }

  if (resolved.includes("${workspaceFolder}")) {
    if (!workspaceFolderPath) {
      throw new Error("Saturno FancyHeader: ${workspaceFolder} requires an opened workspace folder.");
    }
    resolved = resolved.replaceAll("${workspaceFolder}", workspaceFolderPath);
  }

  resolved = resolved.replaceAll("${fileDirname}", path.dirname(currentFilePath));

  if (resolved === "~" || resolved.startsWith(`~${path.sep}`) || resolved.startsWith("~/") || resolved.startsWith("~\\")) {
    resolved = path.join(os.homedir(), resolved.slice(1));
  }

  if (!path.isAbsolute(resolved)) {
    resolved = path.join(workspaceFolderPath ?? path.dirname(currentFilePath), resolved);
  }

  return path.resolve(resolved);
}

// -----------------------------------------------------------------------------
export function _ResolveProjectName(
  filePath: string,
  gitRoot: string | null,
  workspaceFolderPath: string | null,
  workspaceFolderName: string | null = null
): string {
  // Git root identifies the actual repository even when it is nested in a
  // broader multi-root workspace. Outside Git, VS Code's folder label is the
  // user's explicit project name; path basenames are only fallbacks.
  const workspace_name = workspaceFolderName?.trim();
  return path.basename(gitRoot ?? "")
    || workspace_name
    || path.basename(workspaceFolderPath ?? "")
    || path.basename(path.dirname(filePath));
}
