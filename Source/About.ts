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
import * as Fancy from "../Libraries/Saturno.VSCode.FancyLib/Source";

// -----------------------------------------------------------------------------
export async function ExecuteAboutCommand(context: vscode.ExtensionContext): Promise<void> {
  const packageJson = context.extension.packageJSON as {
    displayName?: string;
    name?: string;
    description?: string;
    version?: string;
    build?: string | number;
  };
  const extensionName = packageJson.displayName ?? packageJson.name ?? "Saturno FancyHeader";
  const extensionDescription = packageJson.description ?? "Standardize your file headers with reusable templates.";
  const extensionVersion = packageJson.version ?? "unknown";
  const extensionBuild = packageJson.build === undefined ? "unknown" : String(packageJson.build);

  const panel = vscode.window.createWebviewPanel(
    "saturnoFancyHeaderAbout",
    "About Saturno FancyHeader",
    vscode.ViewColumn.Active,
    {
      enableFindWidget: false,
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(context.extensionUri, "media"),
        vscode.Uri.joinPath(context.extensionUri, "Resources"),
      ],
    }
  );

  panel.webview.html = await _LoadAboutPanelHtml(panel.webview, context, {
    extensionName,
    extensionDescription,
    extensionVersion,
    extensionBuild,
  });

  panel.webview.onDidReceiveMessage(async (message: { command?: string }) => {
    if (message?.command === "openChangelog") {
      await _OpenChangelog(context);
    }
  });
}

// -----------------------------------------------------------------------------
interface AboutPanelModel {
  extensionName: string;
  extensionDescription: string;
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
  const script_uri = webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, "media", "about.js"));
  const html_template = Buffer.from(await vscode.workspace.fs.readFile(html_uri)).toString("utf8");

  const about_body = Fancy.About.RenderAboutPage(
    _BuildAboutPageModel(webview, context, model)
  );

  return html_template
    .replaceAll("{{cspSource}}", webview.cspSource)
    .replaceAll("{{styleUri}}", style_uri.toString())
    .replaceAll("{{scriptUri}}", script_uri.toString())
    .replaceAll("{{extensionName}}", Fancy.Utils.EscapeHtml(_OrFallback(model.extensionName, "Saturno FancyHeader")))
    .replaceAll("{{aboutBody}}", about_body);
}

/**
 * The publisher card links to GitHub and the Saturno Software website only -
 * a deliberately smaller set than the mock's five social icons, since a
 * VS Code About panel is a developer surface, not a marketing one.
 */
// -----------------------------------------------------------------------------
function _BuildAboutPageModel(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  model: AboutPanelModel
): Fancy.About.AboutPageModel {
  const icon_uri = (...segments: string[]) =>
    webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...segments)).toString();

  return {
    Header: {
      IconUri: icon_uri("Resources", "images", "icon.png"),
      IconAlt: _OrFallback(model.extensionName, "Saturno FancyHeader"),
      Name: _OrFallback(model.extensionName, "Saturno FancyHeader"),
      Description: model.extensionDescription,
      Version: _OrFallback(model.extensionVersion, "unknown"),
      Build: _OrFallback(model.extensionBuild, "unknown"),
      Legal: "Copyright 2026 Saturno Software. All rights reserved.",
    },
    Publisher: {
      IconUri: icon_uri("media", "icons", "saturno-software.png"),
      IconAlt: "Saturno Software",
      Name: "Saturno Software",
      Description: "Discover Saturno Software solutions",
      Links: [
        { Href: "https://github.com/SaturnoSoftware", Label: "GitHub", Glyph: "github" },
        { Href: "https://saturno.software", Label: "Website", Glyph: "website" },
      ],
    },
    MoreSoftware: [
      {
        IconUri: icon_uri("media", "icons", "presskit-diy.png"),
        IconAlt: "presskit.diy",
        Name: "presskit.diy",
        Description: "Amazing presskits in minutes.",
        Links: [{ Href: "https://github.com/SaturnoSoftware/presskit.diy", Label: "GitHub", Glyph: "github" }],
      },
      {
        IconUri: icon_uri("media", "icons", "gosh.webp"),
        IconAlt: "Gosh",
        Name: "Gosh",
        Description: "Bookmarks for your shell.",
        Links: [{ Href: "https://github.com/SaturnoSoftware/gosh", Label: "GitHub", Glyph: "github" }],
      },
      {
        IconUri: icon_uri("media", "icons", "fancy-comments.webp"),
        IconAlt: "Fancy Comments",
        Name: "Fancy Comments",
        Description: "Create customized comments without formatting everything manually.",
        Links: [
          { Href: "https://github.com/SaturnoSoftware/Saturno.VSCode.FancyComments", Label: "GitHub", Glyph: "github" },
        ],
      },
    ],
    ChangelogButtonLabel: "View Changelog",
  };
}

// -----------------------------------------------------------------------------
async function _OpenChangelog(context: vscode.ExtensionContext): Promise<void> {
  const changelog_uri = vscode.Uri.joinPath(context.extensionUri, "CHANGELOG.md");
  const document = await vscode.workspace.openTextDocument(changelog_uri);
  await vscode.window.showTextDocument(document, { preview: false });
}

// -----------------------------------------------------------------------------
function _OrFallback(value: string, fallback: string): string {
  return value.trim().length > 0 ? value : fallback;
}
