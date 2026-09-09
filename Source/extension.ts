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
// File      : extension.ts                                                   //
// Project   : saturnosoftware                                                //
// Date      : 2025-03-05                                                     //
// Copyright : Saturno Software - 2025 - 2026                                 //
// Author    : mateusdigital <hello@mateus.digital>                           //
// -------------------------------------------------------------------------- //
// SPDX-License-Identifier: GPL-3.0-only



import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { getActiveEditor, getActiveFilePath, getCommentSyntaxForEditor, showError } from "../Libraries/Saturno.FancyLib/src";
import { DEFAULT_CONFIG, HeaderConfig, NamedHeaderTemplate, normalizeConfig, buildHeader, hasGeneratedHeaderAtDocumentStart } from "./formatting";
import { getDefaultUserTemplateRoot, resolveConfiguredTemplateLines, resolveTemplateDataAsync } from "./runtime";
import {
  buildNewTemplateContent,
  buildUpdatedTemplateList,
  getEditableTemplateCandidates,
  getTemplateSearchDirectories,
  mergeTemplateSources,
  resolveUniqueTemplatePath,
} from "./templateManagement";

const CONFIG_SECTION = "saturno-fancy-header";

// -----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.addHeader",
      async () => executeAddHeader()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.newTemplate",
      async () => executeNewTemplate()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.editTemplates",
      async () => executeEditTemplates()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.about",
      () => {
        void executeAboutCommand(context);
      }
    )
  );
}

// -----------------------------------------------------------------------------
export function deactivate(): void { }

// -----------------------------------------------------------------------------
function getConfig(): HeaderConfig {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return normalizeConfig({
    lineWidth: cfg.get<number>("lineWidth", DEFAULT_CONFIG.lineWidth),
    fillChar: cfg.get<string>("fillChar", DEFAULT_CONFIG.fillChar),
    templateLines: cfg.get<string[]>("templateLines", DEFAULT_CONFIG.templateLines),
    templateFile: cfg.get<string>("templateFile", DEFAULT_CONFIG.templateFile),
    templates: cfg.get<NamedHeaderTemplate[]>("templates", DEFAULT_CONFIG.templates),
    authorName: cfg.get<string>("authorName", DEFAULT_CONFIG.authorName),
    authorEmail: cfg.get<string>("authorEmail", DEFAULT_CONFIG.authorEmail),
    copyrightOwner: cfg.get<string>("copyrightOwner", DEFAULT_CONFIG.copyrightOwner),
  });
}

// -----------------------------------------------------------------------------
async function executeAddHeader(): Promise<void> {
  const editor = getActiveEditor();
  if (!editor) {
    showError("Saturno FancyHeader: no active editor");
    return;
  }

  const filePath = getActiveFilePath();
  if (!filePath) {
    showError("Saturno FancyHeader: unable to resolve the active file path");
    return;
  }

  const syntax = getCommentSyntaxForEditor(editor);
  if (!syntax) {
    showError(`Saturno FancyHeader: unsupported language "${editor.document.languageId}"`);
    return;
  }

  const config = getConfig();
  if (hasGeneratedHeaderAtDocumentStart(editor.document.getText(), syntax, config)) {
    void vscode.window.showInformationMessage("Saturno FancyHeader: this file already has a generated header.");
    return;
  }
  const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
  const workspaceFolderPath = workspaceFolder?.uri.fsPath ?? null;
  const workspaceFolderName = workspaceFolder?.name ?? null;
  const availableTemplates = getAvailableTemplates(config);
  const selectedTemplate = await chooseNamedTemplate(availableTemplates);
  if (selectedTemplate === undefined) {
    return;
  }

  const effectiveConfig = selectedTemplate
    ? { ...config, templateFile: selectedTemplate.path }
    : config;
  let templateLines: string[];

  try {
    templateLines = resolveConfiguredTemplateLines(filePath, workspaceFolderPath, effectiveConfig);
  } catch (error) {
    showError(error instanceof Error ? error.message : "Saturno FancyHeader: failed to load template file");
    return;
  }

  const templateData = await resolveTemplateDataAsync(filePath, effectiveConfig, workspaceFolderPath, workspaceFolderName);
  const header = buildHeader(syntax, templateData, { ...effectiveConfig, templateLines });

  await editor.edit((editBuilder) => {
    editBuilder.insert(new vscode.Position(0, 0), header);
  });
}

// -----------------------------------------------------------------------------
async function chooseNamedTemplate(templates: NamedHeaderTemplate[]): Promise<NamedHeaderTemplate | null | undefined> {
  if (templates.length === 0) {
    return null;
  }

  if (templates.length === 1) {
    return templates[0];
  }

  const picked = await vscode.window.showQuickPick(
    templates.map((template) => ({
      label: template.name,
      description: template.path,
      template,
    })),
    {
      placeHolder: "Select a Saturno FancyHeader template",
      ignoreFocusOut: true,
    }
  );

  return picked?.template;
}

// -----------------------------------------------------------------------------
async function executeNewTemplate(): Promise<void> {
  const config = getConfig();
  const templateName = (await vscode.window.showInputBox({
    prompt: "Template name",
    placeHolder: "ASCII Galaxy",
    ignoreFocusOut: true,
    validateInput: (value) => value.trim().length === 0 ? "Template name is required." : undefined,
  }))?.trim();

  if (!templateName) {
    return;
  }

  const templateRoot = getDefaultUserTemplateRoot();
  const templatePath = resolveUniqueTemplatePath(
    templateName,
    config,
    templateRoot,
    (candidatePath) => fs.existsSync(candidatePath)
  );

  const sourceTemplatePath = getAvailableTemplates(config)[0]?.path;
  const sourceContents = tryReadTextFile(sourceTemplatePath);
  const contents = buildNewTemplateContent(config, sourceContents);

  fs.mkdirSync(path.dirname(templatePath), { recursive: true });
  fs.writeFileSync(templatePath, `${contents}\n`, "utf8");

  const updatedTemplates = buildUpdatedTemplateList(config, {
    name: templateName,
    path: templatePath,
  });

  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update("templates", updatedTemplates, vscode.ConfigurationTarget.Global);

  await openTemplateFile(templatePath);
}

// -----------------------------------------------------------------------------
async function executeEditTemplates(): Promise<void> {
  const config = getConfig();
  const candidates = getAvailableTemplates(config);

  if (candidates.length === 0) {
    await vscode.commands.executeCommand("workbench.action.openSettingsJson");
    showError("Saturno FancyHeader: configure templateFile or templates before editing templates.");
    return;
  }

  let selected = candidates[0];

  if (candidates.length > 1) {
    const picked = await vscode.window.showQuickPick(
      candidates.map((template) => ({
        label: template.name,
        description: template.path,
        template,
      })),
      {
        placeHolder: "Select a Saturno FancyHeader template to edit",
        ignoreFocusOut: true,
      }
    );

    if (!picked) {
      return;
    }

    selected = picked.template;
  }

  await openTemplateFile(selected.path);
}

// -----------------------------------------------------------------------------
async function openTemplateFile(templatePath: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(templatePath));
  await vscode.window.showTextDocument(document, { preview: false });
}

// -----------------------------------------------------------------------------
function tryReadTextFile(filePath: string | undefined): string | null {
  if (!filePath) {
    return null;
  }

  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
function getAvailableTemplates(config: HeaderConfig): NamedHeaderTemplate[] {
  const templateRoot = getDefaultUserTemplateRoot();
  const configuredCandidates = getEditableTemplateCandidates(config);
  const discoveredPaths = discoverTemplateFiles(getTemplateSearchDirectories(config, templateRoot));
  return mergeTemplateSources(configuredCandidates, discoveredPaths);
}

// -----------------------------------------------------------------------------
function discoverTemplateFiles(directories: string[]): string[] {
  const discovered: string[] = [];

  for (const directory of directories) {
    try {
      const entries = fs.readdirSync(directory, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) {
          continue;
        }

        if (!/^_header-.*\.txt$/i.test(entry.name)) {
          continue;
        }

        discovered.push(path.join(directory, entry.name));
      }
    } catch {
      // Missing directories are fine; discovery is best-effort.
    }
  }

  return discovered.sort((a, b) => a.localeCompare(b));
}

// -----------------------------------------------------------------------------
async function executeAboutCommand(context: vscode.ExtensionContext): Promise<void> {
  const packageJson = context.extension.packageJSON as {
    displayName?: string;
    name?: string;
    version?: string;
    build?: string | number;
  };
  const extensionName = packageJson.displayName ?? packageJson.name ?? "Saturno FancyHeader";
  const extensionVersion = packageJson.version ?? "unknown";
  const extensionBuild = packageJson.build === undefined ? "unknown" : String(packageJson.build);
  const panel = vscode.window.createWebviewPanel(
    "saturnoFancyHeaderAbout",
    "About Saturno FancyHeader",
    vscode.ViewColumn.Active,
    {
      enableFindWidget: false,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "media")],
    }
  );

  panel.webview.html = await loadAboutPanelHtml(panel.webview, context, {
    extensionName,
    extensionVersion,
    extensionBuild,
  });
}

interface AboutPanelModel {
  extensionName: string;
  extensionVersion: string;
  extensionBuild: string;
}

// -----------------------------------------------------------------------------
async function loadAboutPanelHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  model: AboutPanelModel
): Promise<string> {
  const htmlUri = vscode.Uri.joinPath(context.extensionUri, "media", "about.html");
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "about.css"));
  const htmlTemplate = Buffer.from(await vscode.workspace.fs.readFile(htmlUri)).toString("utf8");

  return htmlTemplate
    .replaceAll("{{cspSource}}", webview.cspSource)
    .replaceAll("{{styleUri}}", styleUri.toString())
    .replaceAll("{{extensionName}}", escapeHtml(orFallback(model.extensionName, "Saturno FancyHeader")))
    .replaceAll("{{extensionVersion}}", escapeHtml(orFallback(model.extensionVersion, "unknown")))
    .replaceAll("{{extensionBuild}}", escapeHtml(orFallback(model.extensionBuild, "unknown")));
}

// -----------------------------------------------------------------------------
function orFallback(value: string, fallback: string): string {
  return value.trim().length > 0 ? value : fallback;
}

// -----------------------------------------------------------------------------
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
