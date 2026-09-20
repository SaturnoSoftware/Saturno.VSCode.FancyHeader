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
import * as crypto from "crypto";
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
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, "Resources")],
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

/**
 * about.html/about.css live once in FancyLib (Source/AboutPage/) and ship
 * staged into every consuming extension's own Resources/AboutPage/ - see
 * Scripts/build.ps1. Only the extension can resolve a vscode.Uri into a
 * webview URI, so it (not FancyLib) reads the template text and resolves
 * every URI the page needs.
 */
// -----------------------------------------------------------------------------
async function _LoadAboutPanelHtml(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  model: AboutPanelModel
): Promise<string> {
  const html_uri = vscode.Uri.joinPath(context.extensionUri, "Resources", "AboutPage", "about.html");
  const style_uri = webview.asWebviewUri(
    vscode.Uri.joinPath(context.extensionUri, "Resources", "AboutPage", "about.css")
  );
  const template_html = Buffer.from(await vscode.workspace.fs.readFile(html_uri)).toString("utf8");

  return Fancy.AboutPage.RenderAboutPage(template_html, {
    cspSource: webview.cspSource,
    styleUri: style_uri.toString(),
    extensionName: _OrFallback(model.extensionName, "Saturno FancyHeader"),
    nonce: crypto.randomBytes(16).toString("base64"),
    ..._BuildAboutPageData(webview, context, model),
  });
}

/**
 * The publisher card links to GitHub and the Saturno Software website only -
 * a deliberately smaller set than the original AltTilda mock's five social
 * icons, since a VS Code About panel is a developer surface, not a
 * marketing one.
 */
// -----------------------------------------------------------------------------
function _BuildAboutPageData(
  webview: vscode.Webview,
  context: vscode.ExtensionContext,
  model: AboutPanelModel
): Omit<Fancy.AboutPage.AboutPageData, "cspSource" | "styleUri" | "extensionName" | "nonce"> {
  const icon_uri = (...segments: string[]) =>
    webview.asWebviewUri(vscode.Uri.joinPath(context.extensionUri, ...segments)).toString();

  return {
    header: {
      iconUri: icon_uri("Resources", "icons", "icon.png"),
      iconAlt: _OrFallback(model.extensionName, "Saturno FancyHeader"),
      name: _OrFallback(model.extensionName, "Saturno FancyHeader"),
      description: model.extensionDescription,
      version: _OrFallback(model.extensionVersion, "unknown"),
      build: _OrFallback(model.extensionBuild, "unknown"),
      legal: "Copyright 2026 Saturno Software. All rights reserved.",
    },
    publisher: {
      iconUri: icon_uri("Resources", "icons", "saturno-software.png"),
      iconAlt: "Saturno Software",
      name: "Saturno Software",
      description: "Discover Saturno Software solutions",
      links: [
        { href: "https://github.com/SaturnoSoftware", label: "GitHub", glyph: "github" },
        { href: "https://saturno.software", label: "Website", glyph: "website" },
      ],
    },
    moreSoftware: [
      {
        iconUri: icon_uri("Resources", "icons", "presskit-diy.png"),
        iconAlt: "presskit.diy",
        name: "presskit.diy",
        description: "Amazing presskits in minutes.",
        links: [{ href: "https://github.com/SaturnoSoftware/presskit.diy", label: "GitHub", glyph: "github" }],
      },
      {
        iconUri: icon_uri("Resources", "icons", "gosh.webp"),
        iconAlt: "Gosh",
        name: "Gosh",
        description: "Bookmarks for your shell.",
        links: [{ href: "https://github.com/SaturnoSoftware/gosh", label: "GitHub", glyph: "github" }],
      },
      {
        iconUri: icon_uri("Resources", "icons", "fancy-comments.webp"),
        iconAlt: "Fancy Comments",
        name: "Fancy Comments",
        description: "Create customized comments without formatting everything manually.",
        links: [
          { href: "https://github.com/SaturnoSoftware/Saturno.VSCode.FancyComments", label: "GitHub", glyph: "github" },
        ],
      },
    ],
    changelogButtonLabel: "View Changelog",
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
