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
// File      : About.ts                                                       //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-20                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

// -----------------------------------------------------------------------------
import * as vscode from "vscode";

// -----------------------------------------------------------------------------
export async function ExecuteAboutCommand(context: vscode.ExtensionContext): Promise<void> {
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

  panel.webview.html = await _LoadAboutPanelHtml(panel.webview, context, {
    extensionName,
    extensionVersion,
    extensionBuild,
  });
}

// -----------------------------------------------------------------------------
interface AboutPanelModel {
  extensionName: string;
  extensionVersion: string;
  extensionBuild: string;
}

// -----------------------------------------------------------------------------
async function _LoadAboutPanelHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  model: AboutPanelModel
): Promise<string> {
  const html_uri = vscode.Uri.joinPath(context.extensionUri, "media", "about.html");
  const style_uri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "about.css"));
  const html_template = Buffer.from(await vscode.workspace.fs.readFile(html_uri)).toString("utf8");

  return html_template
    .replaceAll("{{cspSource}}", webview.cspSource)
    .replaceAll("{{styleUri}}", style_uri.toString())
    .replaceAll("{{extensionName}}", _EscapeHtml(_OrFallback(model.extensionName, "Saturno FancyHeader")))
    .replaceAll("{{extensionVersion}}", _EscapeHtml(_OrFallback(model.extensionVersion, "unknown")))
    .replaceAll("{{extensionBuild}}", _EscapeHtml(_OrFallback(model.extensionBuild, "unknown")));
}

// -----------------------------------------------------------------------------
function _OrFallback(value: string, fallback: string): string {
  return value.trim().length > 0 ? value : fallback;
}

// -----------------------------------------------------------------------------
function _EscapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
