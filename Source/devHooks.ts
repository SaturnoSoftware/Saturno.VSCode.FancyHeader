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
// File      : devHooks.ts                                                    //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-16                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// -------------------------------------------------------------------------- //
// SPDX-License-Identifier: GPL-3.0-only

/**
 * FANCYHDR-0039: the contract between the always-shipped adapter and the
 * development-only module in `Source/dev/`.
 *
 * This file is small on purpose: it is always compiled, in every
 * environment, because the adapter has to be able to describe what it would
 * hand a dev module without knowing whether one exists. `Source/dev/` itself
 * is excluded from the production tsconfig, so in a production build
 * nothing implements this and the guarded require in `extension.ts` simply
 * fails and moves on.
 *
 * Must not import `vscode`.
 */

// -----------------------------------------------------------------------------
export interface DevHost {
  extensionVersion: string;
}

/** Shape `Source/dev/index.ts` must export. Used only for the guarded require. */
// -----------------------------------------------------------------------------
export interface DevModule {
  registerDevCommands(context: unknown, host: DevHost): void;
}
