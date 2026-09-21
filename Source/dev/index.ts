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
// File      : index.ts                                                       //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-21                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

/**
 * Development-only commands.
 *
 * This whole directory is excluded from tsconfig.prod.json, so a production
 * build never compiles it, out/Source/dev/ does not exist, and the guarded
 * require in Extension.ts fails and moves on. The build script also strips
 * the dev commands from the packaged manifest, so they are not installed,
 * not merely hidden.
 *
 * This is also the only module allowed to import FancyLib's Source/Debug
 * entry point, which is what keeps the Open Bug domain out of a production
 * build entirely. Nothing always-shipped may import this file at module
 * level.
 */

// -----------------------------------------------------------------------------
import { RegisterDevCommands as RegisterSharedDevCommands } from "../../Libraries/Saturno.VSCode.FancyLib/Source/Debug";
import { DevHost } from "../../Libraries/Saturno.VSCode.FancyLib/Source/DevHooks";
// -----------------------------------------------------------------------------
import { CONFIG_SECTION, DEV_MODE_CONTEXT_KEY, EXTENSION_ID } from "../Constants";

// -----------------------------------------------------------------------------
export function RegisterDevCommands(context: unknown, host: DevHost): void {
  RegisterSharedDevCommands(context, host, {
    configSection: CONFIG_SECTION,
    extensionId: EXTENSION_ID,
    devModeContextKey: DEV_MODE_CONTEXT_KEY,
    bugTitlePlaceholder: "the generated header drifted a column past 80",
  });
}
