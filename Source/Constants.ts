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
// File      : Constants.ts                                                   //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-20                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

/**
 * The identifiers this extension publishes.
 *
 * CONFIG_SECTION is a public contract twice over: it prefixes every command
 * id and it is the section every setting is stored under in the user's
 * settings.json. Changing it breaks their keybindings and silently resets
 * their settings to the defaults, so it changes only with a migration.
 */

//
// IDENTITY
//

// -----------------------------------------------------------------------------
export const CONFIG_SECTION = "saturno-fancy-header";
export const EXTENSION_ID = "saturno.fancy-header";
export const APP_NAME = "Saturno FancyHeader";

//
// COMMANDS
//

// Must match contributes.commands in package.json, exactly.
// -----------------------------------------------------------------------------
export const COMMAND_ADD_HEADER = `${CONFIG_SECTION}.addHeader`;
export const COMMAND_NEW_TEMPLATE = `${CONFIG_SECTION}.newTemplate`;
export const COMMAND_EDIT_TEMPLATES = `${CONFIG_SECTION}.editTemplates`;
export const COMMAND_ABOUT = `${CONFIG_SECTION}.about`;

// Must match the `when` clause of the dev entries in contributes.menus.
// -----------------------------------------------------------------------------
export const DEV_MODE_CONTEXT_KEY = "saturnoFancyHeader.devMode";
