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
// File      : Extension.ts                                                   //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-03                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

// -----------------------------------------------------------------------------
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
// -----------------------------------------------------------------------------
import * as Fancy from "../Libraries/Saturno.VSCode.FancyLib/Source";
// -----------------------------------------------------------------------------
import { APP_NAME, CONFIG_SECTION } from "./Constants";
import { HeaderConfig, NamedHeaderTemplate } from "./Config";
import { GetConfig } from "./ConfigResolution";
import { BuildHeader, _HasGeneratedHeaderAtDocumentStart } from "./Formatting";
import { _ResolveConfiguredTemplateLines, ResolveTemplateDataAsync } from "./Runtime";
import {
  BuildUpdatedTemplateList,
  GetEditableTemplateCandidates,
  GetTemplateSearchDirectories,
  MergeTemplateSources,
  ResolveUniqueTemplatePath,
  _BuildNewTemplateContent,
} from "./TemplateManagement";
import { ExecuteAboutCommand } from "./About";
import { DevHost, DevModule } from "./DevHooks";


/*
* Functions
*/

/**
 * Loads `Source/dev/` if it was compiled into this build.
 *
 * A production build excludes that directory from its tsconfig, so
 * `out/Source/dev` does not exist and this require throws - the dev
 * commands are never registered. The production packaging step also strips
 * them from the manifest, so the function is not installed rather than
 * merely hidden.
 */

/* -------------------------------------------------------------------------- */
function loadDevModule(): DevModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require("./dev") as DevModule;
  } catch {
    return null;
  }
}

//
// LIFECYCLE
//

// -----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  const dev = loadDevModule();
  if (dev) {
    const host: DevHost = {
      extensionVersion: (context.extension?.packageJSON?.version as string) ?? "unknown",
    };
    dev.registerDevCommands(context, host);
  }

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.addHeader",
      async () => _ExecuteAddHeader()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.newTemplate",
      async () => _ExecuteNewTemplate()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.editTemplates",
      async () => _ExecuteEditTemplates()
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "saturno-fancy-header.about",
      () => {
        void ExecuteAboutCommand(context);
      }
    )
  );
}

// -----------------------------------------------------------------------------
export function deactivate(): void { }


//
// ACTIONS
//

// -----------------------------------------------------------------------------
async function _ExecuteAddHeader(): Promise<void> {
  const editor = Fancy.EditorUtils.GetActiveEditor();
  if (!editor) {
    Fancy.EditorUtils.ShowError(APP_NAME, "no active editor");
    return;
  }

  const filePath = Fancy.EditorUtils.GetActiveFilePath();
  if (!filePath) {
    Fancy.EditorUtils.ShowError(APP_NAME, "unable to resolve the active file path");
    return;
  }

  const syntax = Fancy.CommentDetection.GetCommentSyntaxForEditor(editor);
  if (!syntax) {
    Fancy.EditorUtils.ShowError(APP_NAME, `unsupported language "${editor.document.languageId}"`);
    return;
  }

  const config = GetConfig();
  if (_HasGeneratedHeaderAtDocumentStart(editor.document.getText(), syntax, config)) {
    Fancy.EditorUtils.ShowInfo(APP_NAME, "this file already has a generated header.");
    return;
  }

  const workspace_folder = Fancy.EditorUtils.GetActiveWorkspace();
  const workspace_folder_path = workspace_folder?.uri.fsPath ?? null;
  const workspace_folder_name = workspace_folder?.name ?? null;
  const available_templates = _GetAvailableTemplates(config);
  const selected_template = await _ChooseNamedTemplate(available_templates);

  if (selected_template === undefined) {
    return;
  }

  const effectiveConfig = selected_template
    ? { ...config, templateFile: selected_template.path }
    : config;
  let templateLines: string[];

  try {
    templateLines = _ResolveConfiguredTemplateLines(filePath, workspace_folder_path, effectiveConfig);
  } catch (error) {
    Fancy.EditorUtils.ShowError(
      APP_NAME,
      error instanceof Error ? error.message : "failed to load template file"
    );
    return;
  }

  const templateData = await ResolveTemplateDataAsync(filePath, effectiveConfig, workspace_folder_path, workspace_folder_name);
  const header = BuildHeader(syntax, templateData, { ...effectiveConfig, templateLines });

  await editor.edit((editBuilder) => {
    editBuilder.insert(new vscode.Position(0, 0), header);
  });
}

// -----------------------------------------------------------------------------
async function _ExecuteNewTemplate(): Promise<void> {
  const config = GetConfig();

  const template_name = await Fancy.EditorUtils.ShowInputBox("Template name", "ASCII Galaxy");
  if (!template_name) {
    return;
  }

  const template_root = Fancy.FileUtils.GetDefaultUserAppRoot(CONFIG_SECTION);
  const template_path = ResolveUniqueTemplatePath(template_name, config, template_root);

  if (!template_path) {
    Fancy.EditorUtils.ShowError(
      APP_NAME, `failed to resolve a unique template path for "${template_name}".`
    );
    return;
  }

  const source_template_path = _GetAvailableTemplates(config)[0]?.path;
  const source_contents = Fancy.FileUtils.ReadAllText(source_template_path);
  const contents = _BuildNewTemplateContent(config, source_contents);

  Fancy.FileUtils.MakeDirsRecursive(path.dirname(template_path));
  Fancy.FileUtils.WriteAllText(template_path, contents);

  const updated_templates = BuildUpdatedTemplateList(config, {
    name: template_name,
    path: template_path,
  });

  await vscode.workspace
    .getConfiguration(CONFIG_SECTION)
    .update("templates", updated_templates, vscode.ConfigurationTarget.Global);

  await Fancy.EditorUtils.OpenFileInVSCode(template_path);
}

// -----------------------------------------------------------------------------
async function _ExecuteEditTemplates(): Promise<void> {
  const config = GetConfig();
  const candidates = _GetAvailableTemplates(config);

  if (candidates.length === 0) {
    await vscode.commands.executeCommand("workbench.action.openSettingsJson");
    Fancy.EditorUtils.ShowError(APP_NAME, "configure templateFile or templates before editing templates.");
    return;
  }

  let selected = candidates[0];
  if (candidates.length > 1) {
    const picked = await Fancy.EditorUtils.ShowQuickPick(
      candidates.map((template) => ({
        label: template.name,
        description: template.path,
        template,
      })),
      "Select a Saturno FancyHeader template to edit"
    );

    if (!picked) {
      return;
    }

    selected = picked.template;
  }

  await Fancy.EditorUtils.OpenFileInVSCode(selected.path);
}


// -----------------------------------------------------------------------------
function _GetAvailableTemplates(config: HeaderConfig): NamedHeaderTemplate[] {
  const template_root = Fancy.FileUtils.GetDefaultUserAppRoot(CONFIG_SECTION);
  const configured_candidates = GetEditableTemplateCandidates(config);
  const discovered_paths = _DiscoverTemplateFiles(GetTemplateSearchDirectories(config, template_root));
  return MergeTemplateSources(configured_candidates, discovered_paths);
}

// -----------------------------------------------------------------------------
function _DiscoverTemplateFiles(directories: string[]): string[] {
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
async function _ChooseNamedTemplate(
  templates: NamedHeaderTemplate[]
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
    "Select a Saturno FancyHeader template"
  );

  return picked?.template;
}
