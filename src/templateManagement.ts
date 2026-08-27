import * as path from "path";
import { DEFAULT_TEMPLATE_LINES, HeaderConfig, NamedHeaderTemplate, normalizeConfig } from "./formatting";

// -----------------------------------------------------------------------------
export function slugifyTemplateName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "template";
}

// -----------------------------------------------------------------------------
export function buildTemplateFileName(name: string, index?: number): string {
  const slug = slugifyTemplateName(name);
  return index && index > 1
    ? `_header-${slug}-${index}.txt`
    : `_header-${slug}.txt`;
}

// -----------------------------------------------------------------------------
export function getPreferredTemplateDirectory(config: HeaderConfig, defaultRoot: string): string {
  const normalized = normalizeConfig(config);

  if (normalized.templates.length > 0) {
    return path.dirname(normalized.templates[0].path);
  }

  if (normalized.templateFile) {
    return path.dirname(normalized.templateFile);
  }

  return defaultRoot;
}

// -----------------------------------------------------------------------------
export function getTemplateSearchDirectories(config: HeaderConfig, defaultRoot: string): string[] {
  const normalized = normalizeConfig(config);
  const seen = new Set<string>();
  const result: string[] = [];

  const addDirectory = (directoryPath: string | undefined) => {
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
    addDirectory(path.dirname(template.path));
  }

  if (normalized.templateFile) {
    addDirectory(path.dirname(normalized.templateFile));
  }

  addDirectory(defaultRoot);
  return result;
}

// -----------------------------------------------------------------------------
export function resolveUniqueTemplatePath(
  templateName: string,
  config: HeaderConfig,
  defaultRoot: string,
  exists: (candidatePath: string) => boolean
): string {
  const root = getPreferredTemplateDirectory(config, defaultRoot);

  for (let index = 1; index < 1000; index++) {
    const candidate = path.join(root, buildTemplateFileName(templateName, index));
    if (!exists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Saturno FancyHeader: failed to resolve a unique template path for "${templateName}".`);
}

// -----------------------------------------------------------------------------
export function deriveTemplateNameFromFilePath(filePath: string): string {
  const baseName = path.basename(filePath, path.extname(filePath));
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
export function getEditableTemplateCandidates(config: HeaderConfig): NamedHeaderTemplate[] {
  const normalized = normalizeConfig(config);

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
export function mergeTemplateSources(
  configuredTemplates: NamedHeaderTemplate[],
  discoveredPaths: string[]
): NamedHeaderTemplate[] {
  const seen = new Set<string>();
  const result: NamedHeaderTemplate[] = [];

  const addTemplate = (template: NamedHeaderTemplate) => {
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
    addTemplate(template);
  }

  for (const discoveredPath of discoveredPaths) {
    addTemplate({
      name: deriveTemplateNameFromFilePath(discoveredPath),
      path: discoveredPath,
    });
  }

  return result;
}

// -----------------------------------------------------------------------------
export function buildNewTemplateContent(
  config: HeaderConfig,
  sourceContents?: string | null
): string {
  if (typeof sourceContents === "string" && sourceContents.trim().length > 0) {
    return sourceContents.replace(/\r/g, "");
  }

  const normalized = normalizeConfig(config);
  const lines = normalized.templateLines.length > 0
    ? normalized.templateLines
    : DEFAULT_TEMPLATE_LINES;

  return lines.join("\n");
}

// -----------------------------------------------------------------------------
export function buildUpdatedTemplateList(
  config: HeaderConfig,
  newTemplate: NamedHeaderTemplate
): NamedHeaderTemplate[] {
  const normalized = normalizeConfig(config);

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
