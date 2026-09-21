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
// File      : ConfigResolution.ts                                            //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-20                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

/**
 * The one place that reads settings out of the editor.
 *
 * What it returns has already been through Core/Config.ts, so no caller has
 * to wonder whether a value came from the validated settings UI or from a
 * hand-edited settings.json.
 */

// -----------------------------------------------------------------------------
import * as vscode from "vscode";
// -----------------------------------------------------------------------------
import { CONFIG_SECTION } from "./Constants";
import { DEFAULT_CONFIG, HeaderConfig, NamedHeaderTemplate, NormalizeConfig } from "./Core/Config";

// -----------------------------------------------------------------------------
export function GetConfig(): HeaderConfig {
  const cfg = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return NormalizeConfig({
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
