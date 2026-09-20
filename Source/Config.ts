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
// File      : Config.ts                                                      //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-20                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

// -----------------------------------------------------------------------------
import * as Utils from "../Libraries/Saturno.VSCode.FancyLib/Source/Utils";

//
// Interfaces
//

// -----------------------------------------------------------------------------
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
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
export interface NamedHeaderTemplate {
  name: string;
  path: string;
}

//
// Constants
//

// -----------------------------------------------------------------------------
export const DEFAULT_TEMPLATE_LINES = [
  "  File      : FILENAME",
  "  Project   : PROJECT",
  "  Date      : DATE",
  "  Copyright : YEAR COPYRIGHT_OWNER",
  "  Author    : USER_NAME <USER_EMAIL>",
];

// -----------------------------------------------------------------------------
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

//
// Normalization
//

// -----------------------------------------------------------------------------
export function NormalizeConfig(config: Partial<HeaderConfig> = {}): HeaderConfig {
  return {
    lineWidth: _NormalizeLineWidth(config.lineWidth),
    fillChar: _NormalizeFillChar(config.fillChar),
    templateLines: _NormalizeTemplateLines(config.templateLines),
    templateFile: (config.templateFile ?? DEFAULT_CONFIG.templateFile).trim(),
    templates: _NormalizeNamedTemplates(config.templates),
    authorName: (config.authorName ?? DEFAULT_CONFIG.authorName).trim(),
    authorEmail: (config.authorEmail ?? DEFAULT_CONFIG.authorEmail).trim(),
    copyrightOwner: (config.copyrightOwner ?? DEFAULT_CONFIG.copyrightOwner).trim(),
  };
}

// -----------------------------------------------------------------------------
function _NormalizeLineWidth(lineWidth: number | undefined): number {
  if (!Number.isFinite(lineWidth)) {
    return DEFAULT_CONFIG.lineWidth;
  }

  return Utils.Clamp(Math.trunc(lineWidth as number), 40, 200);
}

// -----------------------------------------------------------------------------
function _NormalizeFillChar(fillChar: string | undefined): string {
  if (!fillChar || fillChar.length === 0) {
    return DEFAULT_CONFIG.fillChar;
  }

  return fillChar[0];
}

// -----------------------------------------------------------------------------
function _NormalizeTemplateLines(templateLines: string[] | undefined): string[] {
  if (!Array.isArray(templateLines) || templateLines.length === 0) {
    return [...DEFAULT_TEMPLATE_LINES];
  }

  return templateLines
    .filter((line): line is string => typeof line === "string")
    .map((line) => line.replace(/\r/g, ""));
}

// -----------------------------------------------------------------------------
function _NormalizeNamedTemplates(
  templates: NamedHeaderTemplate[] | undefined
): NamedHeaderTemplate[] {
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
