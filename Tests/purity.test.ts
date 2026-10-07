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
// File      : purity.test.ts                                                 //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-21                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// License   : GPLv3                                                          //
// -------------------------------------------------------------------------- //

/**
 * Source/Core/ holds the behaviour and Source/ holds the adapter, and this
 * is what makes that a rule rather than an intention.
 *
 * The "vscode" module only exists inside the extension host. Anything that
 * imports it cannot be unit-tested with node --test, cannot be reused
 * outside an editor, and cannot be exercised against a fixture corpus - so
 * the moment a Core module reaches for it, every test below it becomes
 * unrunnable. Catching that here costs one assertion; catching it later
 * costs the split.
 *
 * The check is a source scan, not a require: a compiled Core module that
 * imported "vscode" would throw on load, which is a crash rather than the
 * readable failure a rule deserves.
 */

import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

// __dirname is the compiled out/Tests/ directory; the repository is two up.
const REPOSITORY_ROOT = path.resolve(__dirname, "..", "..");
const CORE_ROOT = path.join(REPOSITORY_ROOT, "Source", "Core");

// A barrel that re-exports EditorUtils reaches "vscode" transitively, so
// importing FancyLib wholesale is a violation even though it never spells
// the word out.
const FORBIDDEN_IMPORTS = [
  /from\s+"vscode"/,
  /require\(\s*"vscode"\s*\)/,
  /from\s+"[^"]*Saturno\.VSCode\.FancyLib\/Source"/,
];

// -----------------------------------------------------------------------------
function ListCoreSources(directory: string): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const full_path = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        return ListCoreSources(full_path);
      }
      return entry.isFile() && entry.name.endsWith(".ts") ? [full_path] : [];
    });
}

describe("core purity", () => {
  it("has a core to check", () => {
    assert.ok(fs.existsSync(CORE_ROOT), "Source/Core is where the pure domain lives");
    assert.ok(ListCoreSources(CORE_ROOT).length > 0);
  });

  it("never reaches vscode from Source/Core, directly or through the FancyLib barrel", () => {
    const violations: string[] = [];

    for (const file of ListCoreSources(CORE_ROOT)) {
      const contents = fs.readFileSync(file, "utf8");
      for (const pattern of FORBIDDEN_IMPORTS) {
        if (pattern.test(contents)) {
          violations.push(`${path.relative(REPOSITORY_ROOT, file)} matches ${pattern}`);
        }
      }
    }

    assert.deepEqual(violations, []);
  });
});
