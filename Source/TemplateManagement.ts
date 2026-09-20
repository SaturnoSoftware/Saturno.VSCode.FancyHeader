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
// File      : TemplateManagement.ts                                          //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-03                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

// -----------------------------------------------------------------------------
import * as path from "path";
// This is the pure core (per platforms/VSCODE-EXTENSION.md): it must not
// import "vscode", directly or transitively. FileUtils is vscode-free, so it
// is imported directly rather than through the FancyLib barrel.
// -----------------------------------------------------------------------------
import * as FileUtils from "../Libraries/Saturno.VSCode.FancyLib/Source/FileUtils";
// -----------------------------------------------------------------------------
import { DEFAULT_TEMPLATE_LINES, HeaderConfig, NamedHeaderTemplate, NormalizeConfig } from "./Config";


// -----------------------------------------------------------------------------
export function GetPreferredTemplateDirectory(config: HeaderConfig, defaultRoot: string): string {
  const normalized = NormalizeConfig(config);

  if (normalized.templates.length > 0) {
    return path.dirname(normalized.templates[0].path);
  }

  if (normalized.templateFile) {
    return path.dirname(normalized.templateFile);
  }

  return defaultRoot;
}

/*
*  Functions
*/

// -----------------------------------------------------------------------------
export function _SlugifyTemplateName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "template";
}

// -----------------------------------------------------------------------------
export function BuildTemplateFileName(name: string, index?: number): string {
  const slug = _SlugifyTemplateName(name);
  return index && index > 1
    ? `_header-${slug}-${index}.txt`
    : `_header-${slug}.txt`;
}


// -----------------------------------------------------------------------------
export function GetTemplateSearchDirectories(config: HeaderConfig, defaultRoot: string): string[] {
  const normalized = NormalizeConfig(config);
  const seen = new Set<string>();
  const result: string[] = [];

  const add_directory = (directoryPath: string | undefined) => {
    if (!directoryPath) {
      return;
    }

    const resolved = path.resolve(directoryPath);
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;
    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push(resolved);
  };

  for (const template of normalized.templates) {
    add_directory(path.dirname(template.path));
  }

  if (normalized.templateFile) {
    add_directory(path.dirname(normalized.templateFile));
  }

  add_directory(defaultRoot);
  return result;
}

// -----------------------------------------------------------------------------
export function ResolveUniqueTemplatePath(
  templateName: string,
  config: HeaderConfig,
  defaultRoot: string,
  existsCheck: (candidatePath: string) => boolean = FileUtils.ExistsSync
): string | null {
  const root = GetPreferredTemplateDirectory(config, defaultRoot);

  for (let index = 1; index < 1000; index++) {
    const candidate = path.join(root, BuildTemplateFileName(templateName, index));

    if (!existsCheck(candidate)) {
      return candidate;
    }
  }

  return null;
}

// -----------------------------------------------------------------------------
export function DeriveTemplateNameFromFilePath(filePath: string): string {
  const portablePath = filePath.replace(/\\/g, "/");
  const baseName = path.posix.basename(portablePath, path.posix.extname(portablePath));
  const stripped = baseName.replace(/^_?header[-_]?/i, "");
  const parts = stripped.split(/[-_]+/).filter((part) => part.length > 0);

  if (parts.length === 0) {
    return "Template";
  }

  return parts
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

// -----------------------------------------------------------------------------
export function GetEditableTemplateCandidates(config: HeaderConfig): NamedHeaderTemplate[] {
  const normalized = NormalizeConfig(config);

  if (normalized.templates.length > 0) {
    return normalized.templates;
  }

  if (normalized.templateFile) {
    return [
      {
        name: "Current Template",
        path: normalized.templateFile,
      },
    ];
  }

  return [];
}

// -----------------------------------------------------------------------------
export function MergeTemplateSources(
  configuredTemplates: NamedHeaderTemplate[],
  discoveredPaths: string[]
): NamedHeaderTemplate[] {
  const seen = new Set<string>();
  const result: NamedHeaderTemplate[] = [];

  const add_template = (template: NamedHeaderTemplate) => {
    const resolved = path.resolve(template.path);
    const key = process.platform === "win32" ? resolved.toLowerCase() : resolved;

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push({
      name: template.name,
      path: resolved,
    });
  };

  for (const template of configuredTemplates) {
    add_template(template);
  }

  for (const discoveredPath of discoveredPaths) {
    add_template({
      name: DeriveTemplateNameFromFilePath(discoveredPath),
      path: discoveredPath,
    });
  }

  return result;
}

// -----------------------------------------------------------------------------
export function _BuildNewTemplateContent(
  config: HeaderConfig,
  sourceContents?: string | null
): string {
  if (typeof sourceContents === "string" && sourceContents.trim().length > 0) {
    return sourceContents.replace(/\r/g, "");
  }

  const normalized = NormalizeConfig(config);
  const lines = normalized.templateLines.length > 0
    ? normalized.templateLines
    : DEFAULT_TEMPLATE_LINES;

  return lines.join("\n");
}

// -----------------------------------------------------------------------------
export function BuildUpdatedTemplateList(
  config: HeaderConfig,
  newTemplate: NamedHeaderTemplate
): NamedHeaderTemplate[] {
  const normalized = NormalizeConfig(config);

  if (normalized.templates.length > 0) {
    return [...normalized.templates, newTemplate];
  }

  if (normalized.templateFile) {
    return [
      {
        name: "Default",
        path: normalized.templateFile,
      },
      newTemplate,
    ];
  }

  return [newTemplate];
}
