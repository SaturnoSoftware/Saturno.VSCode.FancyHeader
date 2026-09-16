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
// File      : productionBuildIsolation.test.ts                               //
// Project   : Saturno.VSCode.FancyHeader                                     //
// Date      : 2026-09-16                                                     //
// Copyright : Saturno Software - 2026                                        //
// Author    : mateusdigital <hello@mateus.digital>                           //
// -------------------------------------------------------------------------- //
// SPDX-License-Identifier: GPL-3.0-only

/**
 * FANCYHDR-0039: runs the real production build into a throwaway output
 * directory and checks the result with FancyLib's independent
 * BuildIsolation contract - a shared helper, but a check this repo runs for
 * itself, so a regression in build.ps1 or tsconfig.prod.json fails right
 * here.
 */

import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { spawnSync } from "node:child_process";
import { after, before, describe, it } from "node:test";

import {
  assertProductionBuildIsolation,
  BuildChannelIsolationContract,
  defaultBuildChannelIsolationContract,
} from "../Libraries/Saturno.VSCode.FancyLib/Source/BuildIsolation";

// __dirname is the compiled out/tests/ directory - the project root is two
// levels up.
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

/** The generic `.dev.`/`dev/` convention plus this consumer's own knowledge
 *  of what it embeds: FancyLib's Open Bug domain compiles to files and a
 *  directory named `DevBugReport*`, not a `dev/` path segment. */
// -----------------------------------------------------------------------------
function fancyHeaderIsolationContract(): BuildChannelIsolationContract {
  const contract = defaultBuildChannelIsolationContract();
  return {
    ...contract,
    devOutputPathPattern: new RegExp(`${contract.devOutputPathPattern.source}|devbugreport`, "i"),
  };
}

// -----------------------------------------------------------------------------
function runProductionBuild(buildOutputDir: string): void {
  const result = spawnSync(
    "pwsh",
    [
      "-NoLogo",
      "-NoProfile",
      "-File",
      path.join(PROJECT_ROOT, "Scripts", "build.ps1"),
      "-ProjectRoot",
      PROJECT_ROOT,
      "-BuildOutputDir",
      buildOutputDir,
      "-Environment",
      "production",
    ],
    { cwd: PROJECT_ROOT, encoding: "utf8" }
  );
  assert.equal(result.status, 0, `build.ps1 failed:\n${result.stdout}\n${result.stderr}`);
}

// -----------------------------------------------------------------------------
describe("Production build isolation (FANCYHDR-0039)", () => {
  let buildOutputDir: string;

  before(() => {
    buildOutputDir = fs.mkdtempSync(path.join(os.tmpdir(), "fancyheader-prod-build-"));
    runProductionBuild(buildOutputDir);
  });

  after(() => {
    fs.rmSync(buildOutputDir, { recursive: true, force: true });
  });

  it("ships a manifest and output tree with no dev command, menu entry, setting or Open Bug module", () => {
    const violations = assertProductionBuildIsolation({
      packageJsonPath: path.join(buildOutputDir, "package.json"),
      outputDirectory: buildOutputDir,
      contract: fancyHeaderIsolationContract(),
    });
    assert.deepEqual(violations, []);
  });

  it("removes the whole commandPalette group once its only entry (the dev command) is stripped", () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(buildOutputDir, "package.json"), "utf8"));
    assert.equal(manifest.contributes.menus, undefined);
  });

  it("fails when a dev command is deliberately re-injected into the built manifest", () => {
    const packageJsonPath = path.join(buildOutputDir, "package.json");
    const original = fs.readFileSync(packageJsonPath, "utf8");
    const manifest = JSON.parse(original);
    manifest.contributes.commands.push({ command: "saturno-fancy-header.dev.reportBug" });
    fs.writeFileSync(packageJsonPath, JSON.stringify(manifest));
    try {
      const violations = assertProductionBuildIsolation({
        packageJsonPath,
        outputDirectory: buildOutputDir,
        contract: fancyHeaderIsolationContract(),
      });
      assert.ok(violations.some((v) => v.kind === "command"));
    } finally {
      fs.writeFileSync(packageJsonPath, original);
    }
  });

  it("fails when a dev-only compiled file is deliberately left in the built output tree", () => {
    const leakedDir = path.join(buildOutputDir, "out", "dev");
    fs.mkdirSync(leakedDir, { recursive: true });
    fs.writeFileSync(path.join(leakedDir, "report.js"), "");
    try {
      const violations = assertProductionBuildIsolation({
        packageJsonPath: path.join(buildOutputDir, "package.json"),
        outputDirectory: buildOutputDir,
        contract: fancyHeaderIsolationContract(),
      });
      assert.ok(violations.some((v) => v.kind === "output-file" && v.detail.includes("out/dev/report.js")));
    } finally {
      fs.rmSync(leakedDir, { recursive: true, force: true });
    }
  });
});
