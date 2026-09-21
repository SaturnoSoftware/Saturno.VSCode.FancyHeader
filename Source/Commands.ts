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
// File      : Commands.ts                                                    //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-21                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

/**
 * The command bodies: the adapter between the editor and Core/.
 *
 * Everything vscode-shaped happens here - the active editor, the quick
 * picks, the settings write, the document edit - and every decision about
 * what the header should say happens in Core/. Extension.ts only registers
 * these.
 */

// -----------------------------------------------------------------------------
import * as path from "path";
import * as vscode from "vscode";
// -----------------------------------------------------------------------------
import * as Fancy from "../Libraries/Saturno.VSCode.FancyLib/Source";
import { AboutSpec } from "../Libraries/Saturno.VSCode.FancyLib/Source/AboutPage/AboutModel";
// -----------------------------------------------------------------------------
import { APP_NAME, CONFIG_SECTION } from "./Constants";
import { GetConfig } from "./ConfigResolution";
import { HeaderConfig, NamedHeaderTemplate } from "./Core/Config";
import { BuildHeader, HasGeneratedHeaderAtDocumentStart } from "./Core/Formatting";
import { ResolveConfiguredTemplateLines, ResolveTemplateDataAsync } from "./Core/HeaderData";
import {
  BuildNewTemplateContent,
  BuildUpdatedTemplateList,
  GetAvailableTemplates,
  ResolveUniqueTemplatePath,
} from "./Core/Templates";

//
// COMMANDS
//

// -----------------------------------------------------------------------------
export async function ExecuteAbout(
  context: vscode.ExtensionContext,
  spec: AboutSpec
): Promise<void> {
  await Fancy.AboutPage.ShowAboutPanel(context, spec);
}

// -----------------------------------------------------------------------------
export async function ExecuteAddHeader(): Promise<void> {
  const editor = Fancy.EditorUtils.GetActiveEditor();
  if (!editor) {
    Fancy.EditorUtils.ShowError(APP_NAME, "no active editor");
    return;
  }

  const file_path = Fancy.EditorUtils.GetActiveFilePath();
  if (!file_path) {
    Fancy.EditorUtils.ShowError(APP_NAME, "unable to resolve the active file path");
    return;
  }

  const syntax = Fancy.CommentDetection.GetCommentSyntaxForEditor(editor);
  if (!syntax) {
    Fancy.EditorUtils.ShowError(APP_NAME, `unsupported language "${editor.document.languageId}"`);
    return;
  }

  const config = GetConfig();
  if (HasGeneratedHeaderAtDocumentStart(editor.document.getText(), syntax, config)) {
    Fancy.EditorUtils.ShowInfo(APP_NAME, "this file already has a generated header.");
    return;
  }

  const workspace_folder = Fancy.EditorUtils.GetActiveWorkspace();
  const workspace_path = workspace_folder?.uri.fsPath ?? null;
  const workspace_name = workspace_folder?.name ?? null;

  // undefined means the user dismissed the picker, which cancels the
  // command; null means there was nothing to pick, which does not.
  const selected = await _ChooseTemplate(_AvailableTemplates(config));
  if (selected === undefined) {
    return;
  }

  const effective_config = selected ? { ...config, templateFile: selected.path } : config;
  let template_lines: string[];

  try {
    template_lines = ResolveConfiguredTemplateLines(file_path, workspace_path, effective_config);
  } catch (error) {
    Fancy.EditorUtils.ShowError(
      APP_NAME,
      error instanceof Error ? error.message : "failed to load template file"
    );
    return;
  }

  const data = await ResolveTemplateDataAsync(
    file_path,
    effective_config,
    workspace_path,
    workspace_name
  );
  const header = BuildHeader(syntax, data, { ...effective_config, templateLines: template_lines });

  await editor.edit((builder) => {
    builder.insert(new vscode.Position(0, 0), header);
  });
}

// -----------------------------------------------------------------------------
export async function ExecuteNewTemplate(): Promise<void> {
  const config = GetConfig();

  const template_name = await Fancy.EditorUtils.ShowInputBox("Template name", "ASCII Galaxy");
  if (!template_name) {
    return;
  }

  const template_root = Fancy.FileUtils.GetDefaultUserAppRoot(CONFIG_SECTION);
  const template_path = ResolveUniqueTemplatePath(template_name, config, template_root);

  if (!template_path) {
    Fancy.EditorUtils.ShowError(
      APP_NAME,
      `failed to resolve a unique template path for "${template_name}".`
    );
    return;
  }

  // A new template starts as a copy of the first one already available, so
  // the user edits something that works rather than an empty file.
  const source_path = _AvailableTemplates(config)[0]?.path;
  const contents = BuildNewTemplateContent(config, Fancy.FileUtils.ReadAllText(source_path));

  Fancy.FileUtils.MakeDirsRecursive(path.dirname(template_path));
  Fancy.FileUtils.WriteAllText(template_path, contents);

  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update(
      "templates",
      BuildUpdatedTemplateList(config, { name: template_name, path: template_path }),
      vscode.ConfigurationTarget.Global
    );

  await Fancy.EditorUtils.OpenFileInVSCode(template_path);
}

// -----------------------------------------------------------------------------
export async function ExecuteEditTemplates(): Promise<void> {
  const config = GetConfig();
  const candidates = _AvailableTemplates(config);

  if (candidates.length === 0) {
    await vscode.commands.executeCommand("workbench.action.openSettingsJson");
    Fancy.EditorUtils.ShowError(
      APP_NAME,
      "configure templateFile or templates before editing templates."
    );
    return;
  }

  const selected = await _ChooseTemplate(candidates, "Select a Saturno FancyHeader template to edit");
  if (!selected) {
    return;
  }

  await Fancy.EditorUtils.OpenFileInVSCode(selected.path);
}

//
// TEMPLATE PICKING
//

// -----------------------------------------------------------------------------
function _AvailableTemplates(config: HeaderConfig): NamedHeaderTemplate[] {
  return GetAvailableTemplates(config, Fancy.FileUtils.GetDefaultUserAppRoot(CONFIG_SECTION));
}

/**
 * Asks only when there is a choice to make: none available answers null,
 * exactly one answers itself, and a dismissed picker answers undefined so
 * the caller can tell "nothing to pick" from "the user backed out".
 */
// -----------------------------------------------------------------------------
async function _ChooseTemplate(
  templates: NamedHeaderTemplate[],
  placeHolder = "Select a Saturno FancyHeader template"
): Promise<NamedHeaderTemplate | null | undefined> {
  if (templates.length === 0) {
    return null;
  }

  if (templates.length === 1) {
    return templates[0];
  }

  const picked = await Fancy.EditorUtils.ShowQuickPick(
    templates.map((template) => ({
      label: template.name,
      description: template.path,
      template,
    })),
    placeHolder
  );

  return picked?.template;
}
