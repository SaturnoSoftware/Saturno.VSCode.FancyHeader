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
// File      : runtime.ts                                                     //
// Project   : Saturno.Fancy.Header                                           //
// Date      : 2026-09-03                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// -------------------------------------------------------------------------- //


// -----------------------------------------------------------------------------
import * as childProcess from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { HeaderConfig, HeaderTemplateData, calculateCopyrightYear, formatDateYYYYMMDD } from "./formatting";

// -----------------------------------------------------------------------------
export interface GitUserInfo {
  name: string;
  email: string;
}

// -----------------------------------------------------------------------------
export function getDefaultUserTemplateRoot(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  homeDirectory: string = os.homedir()
): string {
  if (platform === "win32") {
    const appData = env.APPDATA ?? path.join(homeDirectory, "AppData", "Roaming");
    return path.win32.join(appData, "Code", "User", "saturno-fancy-header");
  }

  if (platform === "darwin") {
    return path.posix.join(homeDirectory, "Library", "Application Support", "Code", "User", "saturno-fancy-header");
  }

  return path.posix.join(homeDirectory, ".config", "Code", "User", "saturno-fancy-header");
}

// -----------------------------------------------------------------------------
export function resolveTemplateData(
  filePath: string,
  config: HeaderConfig,
  workspaceFolderPath: string | null = null,
  workspaceFolderName: string | null = null
): HeaderTemplateData {
  const gitRoot = getGitRoot(filePath);
  const fileDate = resolveFileDate(filePath);
  const gitUser = getGitUserInfo(gitRoot);
  const author = resolveAuthorInfo(
    config.authorName,
    config.authorEmail,
    gitUser,
    os.userInfo().username
  );

  return {
    fileName: path.basename(filePath),
    projectName: resolveProjectName(filePath, gitRoot, workspaceFolderPath, workspaceFolderName),
    date: formatDateYYYYMMDD(fileDate),
    lastModified: formatDateYYYYMMDD(resolveLastModifiedDate(filePath, gitRoot)),
    copyrightYear: calculateCopyrightYear(fileDate),
    copyrightOwner: config.copyrightOwner.trim() || author.name,
    userName: author.name,
    userEmail: author.email,
  };
}

// -----------------------------------------------------------------------------
export async function resolveTemplateDataAsync(
  filePath: string,
  config: HeaderConfig,
  workspaceFolderPath: string | null = null,
  workspaceFolderName: string | null = null
): Promise<HeaderTemplateData> {
  const gitRoot = findGitRootFromFilePath(filePath) ?? await runGitAsync(path.dirname(filePath), ["rev-parse", "--show-toplevel"]);
  const [initialDate, modifiedDate, gitName, gitEmail] = await Promise.all([
    getInitialFileDateAsync(filePath),
    gitRoot ? getLastGitModifiedDateAsync(gitRoot, filePath) : Promise.resolve(null),
    gitRoot ? runGitAsync(gitRoot, ["config", "user.name"]) : Promise.resolve(null),
    gitRoot ? runGitAsync(gitRoot, ["config", "user.email"]) : Promise.resolve(null),
  ]);
  const fileDate = initialDate ?? getFileCreationDate(filePath) ?? new Date();
  const commandUser = gitName || gitEmail ? { name: gitName ?? "", email: gitEmail ?? "" } : null;
  const author = resolveAuthorInfo(config.authorName, config.authorEmail, commandUser ?? readGitUserInfoFromConfigFiles(gitRoot), os.userInfo().username);
  const fallbackModified = await getFileModificationDateAsync(filePath);

  return {
    fileName: path.basename(filePath),
    projectName: resolveProjectName(filePath, gitRoot, workspaceFolderPath, workspaceFolderName),
    date: formatDateYYYYMMDD(fileDate),
    lastModified: formatDateYYYYMMDD(gitRoot && modifiedDate ? modifiedDate : fallbackModified ?? new Date()),
    copyrightYear: calculateCopyrightYear(fileDate),
    copyrightOwner: config.copyrightOwner.trim() || author.name,
    userName: author.name,
    userEmail: author.email,
  };
}

// -----------------------------------------------------------------------------
function runGitAsync(cwd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    childProcess.execFile("git", ["-C", cwd, ...args], { encoding: "utf8", windowsHide: true }, (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
}

// -----------------------------------------------------------------------------
async function getLastGitModifiedDateAsync(gitRoot: string, filePath: string): Promise<Date | null> {
  const relativeFilePath = path.relative(gitRoot, filePath);
  const output = await runGitAsync(gitRoot, ["log", "-1", "--format=%cs", "--", relativeFilePath]);
  return output ? parseDate(output.trim()) : null;
}

// -----------------------------------------------------------------------------
async function getInitialFileDateAsync(filePath: string): Promise<Date | null> {
  const output = await runGitAsync(path.dirname(filePath), ["log", "--follow", "--format=%ad", "--date=format:%Y-%m-%d", "--reverse", "--", filePath]);
  const firstLine = output?.split(/\r?\n/, 1)[0]?.trim();
  return firstLine ? parseDate(firstLine) : null;
}

// -----------------------------------------------------------------------------
async function getFileModificationDateAsync(filePath: string): Promise<Date | null> {
  try {
    return (await fs.promises.stat(filePath)).mtime;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
export function resolveAuthorInfo(
  authorNameOverride: string,
  authorEmailOverride: string,
  gitUser: GitUserInfo | null,
  fallbackUserName: string
): GitUserInfo {
  const name = authorNameOverride.trim() || gitUser?.name?.trim() || fallbackUserName.trim();
  const email = authorEmailOverride.trim() || gitUser?.email?.trim() || "";

  return { name, email };
}

// -----------------------------------------------------------------------------
export function resolveConfiguredTemplateLines(
  currentFilePath: string,
  workspaceFolderPath: string | null,
  config: HeaderConfig
): string[] {
  if (!config.templateFile) {
    return config.templateLines;
  }

  const templatePath = resolveTemplateFilePath(config.templateFile, currentFilePath, workspaceFolderPath);
  let contents: string;

  try {
    contents = fs.readFileSync(templatePath, "utf8");
  } catch (error) {
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
export function resolveTemplateFilePath(
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
function resolveFileDate(filePath: string): Date {
  return getInitialFileDate(filePath) ?? getFileCreationDate(filePath) ?? new Date();
}

// -----------------------------------------------------------------------------
export function resolveLastModifiedDate(
  filePath: string,
  gitRoot: string | null,
  getGitModifiedDate: (root: string, targetFilePath: string) => Date | null = getLastGitModifiedDate,
  getFileModifiedDate: (targetFilePath: string) => Date | null = getFileModificationDate
): Date {
  return (gitRoot ? getGitModifiedDate(gitRoot, filePath) : null)
    ?? getFileModifiedDate(filePath)
    ?? new Date();
}

// -----------------------------------------------------------------------------
export function findGitRootFromFilePath(filePath: string): string | null {
  let currentDirectory = path.dirname(path.resolve(filePath));
  const temporaryRoot = path.resolve(os.tmpdir());

  while (currentDirectory !== temporaryRoot && !fs.existsSync(path.join(currentDirectory, ".git"))) {

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }

  return currentDirectory === temporaryRoot ? null : currentDirectory;
}

// -----------------------------------------------------------------------------
export function resolveProjectName(
  filePath: string,
  gitRoot: string | null,
  workspaceFolderPath: string | null,
  workspaceFolderName: string | null = null
): string {
  // Git root identifies the actual repository even when it is nested in a
  // broader multi-root workspace. Outside Git, VS Code's folder label is the
  // user's explicit project name; path basenames are only fallbacks.
  const workspaceName = workspaceFolderName?.trim();
  return path.basename(gitRoot ?? "")
    || workspaceName
    || path.basename(workspaceFolderPath ?? "")
    || path.basename(path.dirname(filePath));
}

// -----------------------------------------------------------------------------
function getGitRoot(filePath: string): string | null {
  return findGitRootFromFilePath(filePath) ?? runGit(path.dirname(filePath), ["rev-parse", "--show-toplevel"]);
}

// -----------------------------------------------------------------------------
function getGitUserInfo(gitRoot: string | null): GitUserInfo | null {
  return getGitUserInfoFromCommand(gitRoot) ?? readGitUserInfoFromConfigFiles(gitRoot);
}

// -----------------------------------------------------------------------------
function getGitUserInfoFromCommand(gitRoot: string | null): GitUserInfo | null {
  if (!gitRoot) {
    return null;
  }

  const name = runGit(gitRoot, ["config", "user.name"]) ?? "";
  const email = runGit(gitRoot, ["config", "user.email"]) ?? "";

  if (!name && !email) {
    return null;
  }

  return { name, email };
}

// -----------------------------------------------------------------------------
export function readGitUserInfoFromConfigFiles(
  gitRoot: string | null,
  homeDirectory: string = os.homedir()
): GitUserInfo | null {
  const globalUser = readGitUserInfoFromConfigFile(path.join(homeDirectory, ".gitconfig"));
  const localConfigPath = gitRoot ? getGitConfigPath(gitRoot) : null;
  const localUser = localConfigPath ? readGitUserInfoFromConfigFile(localConfigPath) : null;
  const name = localUser?.name?.trim() || globalUser?.name?.trim() || "";
  const email = localUser?.email?.trim() || globalUser?.email?.trim() || "";

  if (!name && !email) {
    return null;
  }

  return { name, email };
}

// -----------------------------------------------------------------------------
function getLastGitModifiedDate(gitRoot: string, filePath: string): Date | null {
  const relativeFilePath = path.relative(gitRoot, filePath);
  const output = runGit(gitRoot, ["log", "-1", "--format=%cs", "--", relativeFilePath]);
  const dateText = output?.trim();
  return dateText ? parseDate(dateText) : null;
}

// -----------------------------------------------------------------------------
function getFileModificationDate(filePath: string): Date | null {
  try {
    return fs.statSync(filePath).mtime;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
function getInitialFileDate(filePath: string): Date | null {
  const output = runGit(path.dirname(filePath), [
    "log",
    "--follow",
    "--format=%ad",
    "--date=format:%Y-%m-%d",
    "--reverse",
    "--",
    filePath,
  ]);

  if (!output) {
    return null;
  }

  const firstLine = output.split(/\r?\n/, 1)[0]?.trim();
  if (!firstLine) {
    return null;
  }

  return parseDate(firstLine);
}

// -----------------------------------------------------------------------------
function getFileCreationDate(filePath: string): Date | null {
  try {
    return fs.statSync(filePath).birthtime;
  } catch (error) {
    console.error(`[Saturno FancyHeader] Failed to read file creation date for "${filePath}".`, error);
    return null;
  }
}

// -----------------------------------------------------------------------------
function runGit(cwd: string, args: string[]): string | null {
  try {
    return childProcess.execFileSync(
      "git",
      ["-C", cwd, ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
    ).trim();
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
function parseDate(text: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    console.error(`[Saturno FancyHeader] Invalid git date "${text}".`);
    return null;
  }

  const parsed = new Date(`${text}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    console.error(`[Saturno FancyHeader] Failed to parse git date "${text}".`);
    return null;
  }

  return parsed;
}

// -----------------------------------------------------------------------------
function getGitConfigPath(gitRoot: string): string | null {
  const gitDirectory = resolveGitDirectory(gitRoot);
  if (!gitDirectory) {
    return null;
  }

  return path.join(gitDirectory, "config");
}

// -----------------------------------------------------------------------------
function resolveGitDirectory(gitRoot: string): string | null {
  const gitMarkerPath = path.join(gitRoot, ".git");

  try {
    const stats = fs.statSync(gitMarkerPath);
    if (stats.isDirectory()) {
      return gitMarkerPath;
    }

    if (!stats.isFile()) {
      return null;
    }
  } catch {
    return null;
  }

  let pointerFile: string;
  try {
    pointerFile = fs.readFileSync(gitMarkerPath, "utf8");
  } catch {
    return null;
  }

  const match = pointerFile.match(/^\s*gitdir:\s*(.+)\s*$/im);
  if (!match) {
    return null;
  }

  const resolvedGitDirectory = path.resolve(gitRoot, match[1].trim());

  try {
    return fs.statSync(resolvedGitDirectory).isDirectory() ? resolvedGitDirectory : null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
function readGitUserInfoFromConfigFile(configPath: string): GitUserInfo | null {
  let contents: string;
  try {
    contents = fs.readFileSync(configPath, "utf8");
  } catch {
    return null;
  }

  let currentSection = "";
  let name = "";
  let email = "";

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(";") || line.startsWith("#")) {
      continue;
    }

    const sectionMatch = rawLine.match(/^\s*\[([^\]]+)\]\s*$/);
    if (sectionMatch) {
      currentSection = sectionMatch[1].trim().split(/\s+/, 1)[0]?.toLowerCase() ?? "";
      continue;
    }

    if (currentSection !== "user") {
      continue;
    }

    const entryMatch = rawLine.match(/^\s*([A-Za-z][A-Za-z0-9-]*)\s*=\s*(.*?)\s*$/);
    if (!entryMatch) {
      continue;
    }

    const key = entryMatch[1].toLowerCase();
    const value = normalizeGitConfigValue(entryMatch[2]);
    if (key === "name") {
      name = value;
      continue;
    }

    if (key === "email") {
      email = value;
    }
  }

  if (!name && !email) {
    return null;
  }

  return { name, email };
}

// -----------------------------------------------------------------------------
function normalizeGitConfigValue(value: string): string {
  const trimmed = value.trim();
  const hasDoubleQuotes = trimmed.startsWith("\"") && trimmed.endsWith("\"");
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'");

  if (trimmed.length >= 2 && (hasDoubleQuotes || hasSingleQuotes)) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}
