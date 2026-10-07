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

/**
 * Activation and command registration, and nothing else.
 *
 * Every command body is in Commands.ts, the About data in About.ts, the
 * settings in ConfigResolution.ts, and the behaviour itself in Core/. If
 * this file grows past a table of commands, something belongs elsewhere.
 */

// -----------------------------------------------------------------------------
import * as vscode from "vscode";
// -----------------------------------------------------------------------------
import { DevHost, DevModule } from "../Libraries/Saturno.VSCode.FancyLib/Source/DevHooks";
// -----------------------------------------------------------------------------
import { ABOUT_SPEC } from "./About";
import {
  COMMAND_ABOUT,
  COMMAND_ADD_HEADER,
  COMMAND_EDIT_TEMPLATES,
  COMMAND_NEW_TEMPLATE,
} from "./Constants";
import {
  ExecuteAbout,
  ExecuteAddHeader,
  ExecuteEditTemplates,
  ExecuteNewTemplate,
} from "./Commands";

//
// LIFECYCLE
//

// -----------------------------------------------------------------------------
export function activate(context: vscode.ExtensionContext): void {
  _RegisterDevCommands(context);

  const commands: Record<string, () => void | Promise<void>> = {
    [COMMAND_ADD_HEADER]: ExecuteAddHeader,
    [COMMAND_NEW_TEMPLATE]: ExecuteNewTemplate,
    [COMMAND_EDIT_TEMPLATES]: ExecuteEditTemplates,
    [COMMAND_ABOUT]: () => ExecuteAbout(context, ABOUT_SPEC),
  };

  for (const [id, run] of Object.entries(commands)) {
    context.subscriptions.push(vscode.commands.registerCommand(id, () => void run()));
  }
}

// -----------------------------------------------------------------------------
export function deactivate(): void { }

//
// DEVELOPMENT BUILD ONLY
//

/**
 * Loads Source/dev/ if it was compiled into this build.
 *
 * A production build excludes that directory from its tsconfig, so
 * out/Source/dev does not exist and this require throws - the dev commands
 * are never registered. The packaging step also strips them from the
 * manifest, so they are not installed rather than merely hidden.
 */
// -----------------------------------------------------------------------------
function _RegisterDevCommands(context: vscode.ExtensionContext): void {
  let dev: DevModule;
  try {
    // Keep the dev module out of TypeScript's production dependency graph.
    // A literal require("./dev") makes it reachable even when tsconfig excludes
    // Source/dev, so construct the runtime-only path from static segments.
    const devModulePath = "./" + "dev";
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    dev = require(devModulePath) as DevModule;
  } catch {
    return;
  }

  const host: DevHost = {
    extensionVersion: (context.extension?.packageJSON?.version as string) ?? "unknown",
  };
  dev.RegisterDevCommands(context, host);
}
