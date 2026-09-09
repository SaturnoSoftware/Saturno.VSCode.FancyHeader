// SPDX-License-Identifier: GPL-3.0-only

import { CommentSyntax } from "../libs/Saturno.VSCodeKit/src/Types";

export { CommentSyntax };

export interface HeaderTemplateData {
  fileName: string;
  projectName: string;
  date: string;
  lastModified: string;
  copyrightYear: string;
  copyrightOwner: string;
  userName: string;
  userEmail: string;
}

export interface NamedHeaderTemplate {
  name: string;
  path: string;
}

export interface HeaderConfig {
  lineWidth: number;
  fillChar: string;
  templateLines: string[];
  templateFile: string;
  templates: NamedHeaderTemplate[];
  authorName: string;
  authorEmail: string;
  copyrightOwner: string;
}

export const DEFAULT_TEMPLATE_LINES = [
  "  File      : FILENAME",
  "  Project   : PROJECT",
  "  Date      : DATE",
  "  Copyright : YEAR COPYRIGHT_OWNER",
  "  Author    : USER_NAME <USER_EMAIL>",
];

export const DEFAULT_CONFIG: HeaderConfig = {
  lineWidth: 80,
  fillChar: "-",
  templateLines: DEFAULT_TEMPLATE_LINES,
  templateFile: "",
  templates: [],
  authorName: "",
  authorEmail: "",
  copyrightOwner: "",
};

// -----------------------------------------------------------------------------
export function normalizeConfig(config: Partial<HeaderConfig> = {}): HeaderConfig {
  return {
    lineWidth: normalizeLineWidth(config.lineWidth),
    fillChar: normalizeFillChar(config.fillChar),
    templateLines: normalizeTemplateLines(config.templateLines),
    templateFile: (config.templateFile ?? DEFAULT_CONFIG.templateFile).trim(),
    templates: normalizeNamedTemplates(config.templates),
    authorName: (config.authorName ?? DEFAULT_CONFIG.authorName).trim(),
    authorEmail: (config.authorEmail ?? DEFAULT_CONFIG.authorEmail).trim(),
    copyrightOwner: (config.copyrightOwner ?? DEFAULT_CONFIG.copyrightOwner).trim(),
  };
}

// -----------------------------------------------------------------------------
export function buildHeader(
  syntax: CommentSyntax,
  data: HeaderTemplateData,
  config: HeaderConfig = DEFAULT_CONFIG
): string {
  const normalized = normalizeConfig(config);
  const edgeLine = buildHeaderLine(syntax, "", normalized.fillChar, normalized.lineWidth);
  const contentLines = normalized.templateLines.map((line) => {
    const replaced = replaceTemplateTokens(line, data);
    return buildHeaderLine(syntax, replaced, " ", normalized.lineWidth);
  });

  return [edgeLine, ...contentLines, edgeLine].join("\n") + "\n\n";
}

// -----------------------------------------------------------------------------
export function formatDateYYYYMMDD(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// -----------------------------------------------------------------------------
export function calculateCopyrightYear(fileDate: Date, currentDate: Date = new Date()): string {
  const startYear = fileDate.getFullYear();
  const currentYear = currentDate.getFullYear();

  if (startYear === currentYear) {
    return `${startYear}`;
  }

  return `${startYear} - ${currentYear}`;
}

// -----------------------------------------------------------------------------
function normalizeLineWidth(lineWidth: number | undefined): number {
  if (!Number.isFinite(lineWidth)) {
    return DEFAULT_CONFIG.lineWidth;
  }

  return clamp(Math.trunc(lineWidth as number), 40, 200);
}

// -----------------------------------------------------------------------------
function normalizeFillChar(fillChar: string | undefined): string {
  if (!fillChar || fillChar.length === 0) {
    return DEFAULT_CONFIG.fillChar;
  }

  return fillChar[0];
}

// -----------------------------------------------------------------------------
function normalizeTemplateLines(templateLines: string[] | undefined): string[] {
  if (!Array.isArray(templateLines) || templateLines.length === 0) {
    return [...DEFAULT_TEMPLATE_LINES];
  }

  return templateLines
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.replace(/\r/g, ""));
}

// -----------------------------------------------------------------------------
function normalizeNamedTemplates(templates: NamedHeaderTemplate[] | undefined): NamedHeaderTemplate[] {
  if (!Array.isArray(templates)) {
    return [];
  }

  return templates
    .filter((entry): entry is NamedHeaderTemplate =>
      typeof entry?.name === "string" &&
      typeof entry?.path === "string"
    )
    .map((entry) => ({
      name: entry.name.trim(),
      path: entry.path.trim(),
    }))
    .filter((entry) => entry.name.length > 0 && entry.path.length > 0);
}

// -----------------------------------------------------------------------------
export function buildHeaderLine(
  syntax: CommentSyntax,
  text: string,
  fillChar: string,
  lineWidth: number
): string {
  const prefixToken = normalizeFenceToken(syntax.singleLineStart);
  const suffixToken = normalizeFenceToken(syntax.singleLineEnd || syntax.singleLineStart);
  const prefix = `${prefixToken} `;
  const suffix = ` ${suffixToken}`;
  const fillLength = Math.max(0, lineWidth - prefix.length - text.length - suffix.length);
  return prefix + text + fillChar.repeat(fillLength) + suffix;
}

// -----------------------------------------------------------------------------
export function replaceTemplateTokens(line: string, data: HeaderTemplateData): string {
  const replacements: Record<string, string> = {
    FILENAME: data.fileName,
    PROJECT: data.projectName,
    DATE: data.date,
    LAST_MODIFIED: data.lastModified,
    YEAR: data.copyrightYear,
    COPYRIGHT_OWNER: data.copyrightOwner,
    USER_NAME: data.userName,
    USER_EMAIL: data.userEmail,
  };

  let result = line;
  for (const [token, value] of Object.entries(replacements)) {
    result = result
      .replaceAll(`\${${token}}`, value)
      .replaceAll(`{{${token}}}`, value)
      .replaceAll(token, value);
  }

  if (!data.userEmail.trim()) {
    result = result.replace(/\s*<\s*>\s*/g, "");
  }

  return result.replace(/[ \t]+$/g, "");
}

export function hasGeneratedHeaderAtDocumentStart(
  documentText: string,
  syntax: CommentSyntax,
  config: HeaderConfig = DEFAULT_CONFIG
): boolean {
  const lines = documentText.split(/\r?\n/);
  const prefix = `${normalizeFenceToken(syntax.singleLineStart)} `;
  const suffix = ` ${normalizeFenceToken(syntax.singleLineEnd || syntax.singleLineStart)}`;
  const firstLine = lines[0] ?? "";
  const maximumHeaderLines = Math.max(config.templateLines.length + 2, 32);
  const isHeaderFrame = (line: string): boolean => line.startsWith(prefix) && line.endsWith(suffix);

  if (!isHeaderFrame(firstLine)) {
    return false;
  }

  for (let closingIndex = 2; closingIndex < Math.min(lines.length, maximumHeaderLines); closingIndex++) {
    if (lines[closingIndex] !== firstLine) {
      continue;
    }

    if (lines.slice(1, closingIndex).every(isHeaderFrame)) {
      return true;
    }
  }

  return false;
}
// -----------------------------------------------------------------------------
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// -----------------------------------------------------------------------------
function normalizeFenceToken(token: string): string {
  return token.length >= 2 ? token : token.repeat(2);
}
