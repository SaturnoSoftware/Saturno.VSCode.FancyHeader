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
// File      : Formatting.ts                                                  //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-03                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

/**
 * Turning template lines plus resolved data into the header block.
 *
 * Pure string work over an explicit CommentSyntax: which comment tokens to
 * fence each line with, how wide to pad it, and which tokens to substitute.
 * Where the data came from is HeaderData.ts's problem.
 */

// CommentSyntax comes from its own module rather than the FancyLib barrel:
// the barrel re-exports EditorUtils, which imports "vscode", and Core must
// stay loadable under plain node --test. Tests/purity.test.ts enforces it.
// -----------------------------------------------------------------------------
import { CommentSyntax } from "../../Libraries/Saturno.VSCode.FancyLib/Source/CommentUtils";
// -----------------------------------------------------------------------------
import { DEFAULT_CONFIG, HeaderConfig, HeaderTemplateData, NormalizeConfig } from "./Config";

//
// BUILD
//

// -----------------------------------------------------------------------------
export function BuildHeader(
  syntax: CommentSyntax,
  data: HeaderTemplateData,
  config: HeaderConfig = DEFAULT_CONFIG
): string {
  const normalized = NormalizeConfig(config);
  const edgeLine = BuildHeaderLine(syntax, "", normalized.fillChar, normalized.lineWidth);

  const contentLines = normalized.templateLines.map((line) => {
    const replaced = ReplaceTemplateTokens(line, data);
    return BuildHeaderLine(syntax, replaced, " ", normalized.lineWidth);
  });

  return [edgeLine, ...contentLines, edgeLine].join("\n") + "\n\n";
}

// -----------------------------------------------------------------------------
export function CalculateCopyrightYear(
  fileDate: Date,
  currentDate: Date = new Date()
): string {
  const startYear = fileDate.getFullYear();
  const currentYear = currentDate.getFullYear();

  if (startYear === currentYear) {
    return `${startYear}`;
  }

  return `${startYear} - ${currentYear}`;
}


// -----------------------------------------------------------------------------
function _NormalizeFenceToken(token: string): string {
  return token.length >= 2 ? token : token.repeat(2);
}

// -----------------------------------------------------------------------------
export function BuildHeaderLine(
  syntax: CommentSyntax,
  text: string,
  fillChar: string,
  lineWidth: number
): string {
  const prefixToken = _NormalizeFenceToken(syntax.singleLineStart);
  const suffixToken = _NormalizeFenceToken(syntax.singleLineEnd || syntax.singleLineStart);
  const prefix = `${prefixToken} `;
  const suffix = ` ${suffixToken}`;
  const fillLength = Math.max(0, lineWidth - prefix.length - text.length - suffix.length);
  return prefix + text + fillChar.repeat(fillLength) + suffix;
}

// -----------------------------------------------------------------------------
export function ReplaceTemplateTokens(line: string, data: HeaderTemplateData): string {
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

// -----------------------------------------------------------------------------
export function HasGeneratedHeaderAtDocumentStart(
  documentText: string,
  syntax: CommentSyntax,
  config: HeaderConfig = DEFAULT_CONFIG
): boolean {
  const lines = documentText.split(/\r?\n/);
  const prefix = `${_NormalizeFenceToken(syntax.singleLineStart)} `;
  const suffix = ` ${_NormalizeFenceToken(syntax.singleLineEnd || syntax.singleLineStart)}`;
  const firstLine = lines[0] ?? "";
  const maximumHeaderLines = Math.max(config.templateLines.length + 2, 32);
  const _IsHeaderFrame = (line: string): boolean => line.startsWith(prefix) && line.endsWith(suffix);

  if (!_IsHeaderFrame(firstLine)) {
    return false;
  }

  for (let closingIndex = 2; closingIndex < Math.min(lines.length, maximumHeaderLines); closingIndex++) {
    if (lines[closingIndex] !== firstLine) {
      continue;
    }

    if (lines.slice(1, closingIndex).every(_IsHeaderFrame)) {
      return true;
    }
  }

  return false;
}
