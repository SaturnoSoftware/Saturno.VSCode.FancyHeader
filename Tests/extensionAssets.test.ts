import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");
const STAGING_ROOT = path.join(REPOSITORY_ROOT, "__BUILD", "_staging");
const ABOUT_PAGE_SOURCE = path.join(
  REPOSITORY_ROOT,
  "Libraries",
  "Saturno.VSCode.FancyLib",
  "Source",
  "AboutPage"
);

function readRepositoryFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

/**
 * What ships is the staged tree that Scripts/package.ps1 packages, not the
 * repository. An asset contract that only looks at the REPOSITORY proves
 * nothing about the product: FancyComments' version of this file stayed
 * green for weeks while every packaged artifact was missing the About page.
 *
 * package.json's saturno.cicd.build.expectedFiles is documentation: nothing
 * reads it. This file, not that list, is the gate.
 */
describe("extension packaging assets", () => {
  it("keeps the About page template in FancyLib, where every extension stages it from", () => {
    const aboutHtml = fs.readFileSync(path.join(ABOUT_PAGE_SOURCE, "about.html"), "utf8");

    assert.ok(fs.existsSync(path.join(ABOUT_PAGE_SOURCE, "about.css")));
    assert.match(aboutHtml, /Content-Security-Policy/);
    assert.match(aboutHtml, /\{\{cspSource\}\}/);
    assert.match(aboutHtml, /\{\{styleUri\}\}/);
    assert.match(aboutHtml, /\{\{nonce\}\}/);
  });

  it("points the About command and the manifest icon at paths under Resources/", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      icon: string;
      saturno: { cicd: { build: { expectedFiles: string[] } } };
    };
    // The panel itself lives in FancyLib now; this extension only declares
    // which files under Resources/ it expects the panel to find.
    const panelSource = fs.readFileSync(path.join(ABOUT_PAGE_SOURCE, "AboutPanel.ts"), "utf8");

    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, packageJson.icon)));
    assert.match(packageJson.icon, /^Resources\/icons\//);
    assert.match(panelSource, /STAGED_ASSET_SEGMENTS = \["Resources", "AboutPage"\]/);
    assert.doesNotMatch(panelSource, /"media"/);

    for (const expected of [
      "Resources/AboutPage/about.html",
      "Resources/AboutPage/about.css",
      "Resources/icons/icon.png",
    ]) {
      assert.ok(
        packageJson.saturno.cicd.build.expectedFiles.includes(expected),
        `package.json must declare ${expected} as an expected build output`
      );
    }
  });

  it("keeps every icon the About panel's cards reference", () => {
    for (const iconName of [
      "icon.png",
      "saturno-software.png",
      "presskit-diy.png",
      "gosh.webp",
      "fancy-comments.webp",
    ]) {
      assert.ok(
        fs.existsSync(path.join(REPOSITORY_ROOT, "Resources", "icons", iconName)),
        `Resources/icons/${iconName} is named in About.ts and must exist`
      );
    }
  });

  it("stages the About assets into the build output", () => {
    const buildScript = readRepositoryFile("Scripts/build.ps1");

    assert.match(buildScript, /Libraries\/Saturno\.VSCode\.FancyLib\/Source\/AboutPage/);
    assert.match(buildScript, /Resources\/AboutPage/);
    assert.match(buildScript, /"about\.html", "about\.css"/);
  });

  it("has the About assets present in the staged tree when a build has run", () => {
    // it.skip is unavailable under this repo's minimal node:test ambient
    // declarations, so an absent staging directory logs and returns - running
    // the suite without having run a build is normal, and is not a failure.
    if (!fs.existsSync(STAGING_ROOT)) {
      console.log("    (no __BUILD/_staging on disk; run npm run build to exercise this check)");
      return;
    }

    // This is the assertion that catches a missing asset: it looks at the
    // directory Scripts/package.ps1 actually turns into the vsix.
    for (const relativePath of [
      path.join("Resources", "AboutPage", "about.html"),
      path.join("Resources", "AboutPage", "about.css"),
      path.join("Resources", "icons", "icon.png"),
      path.join("out", "Source", "Extension.js"),
    ]) {
      assert.ok(
        fs.existsSync(path.join(STAGING_ROOT, relativePath)),
        `${relativePath} is missing from the staged build output, so it will not ship`
      );
    }
  });

  it("does not run in untrusted workspaces and excludes development files from the VSIX", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      capabilities: { untrustedWorkspaces: { supported: boolean } };
    };
    const ignoreFile = readRepositoryFile(".vscodeignore");

    // FancyHeader reads git config and the filesystem to build a header, so
    // it declares itself unsupported in an untrusted workspace. FancyComments
    // only rewrites the text in front of the cursor and declares the
    // opposite. The divergence is deliberate; a silent flip either way fails
    // this assertion.
    assert.strictEqual(packageJson.capabilities.untrustedWorkspaces.supported, false);
    assert.match(ignoreFile, /^Source\/\*\*$/m);
    assert.match(ignoreFile, /^Libraries\/\*\*$/m);
    assert.match(ignoreFile, /^Tests\/\*\*$/m);
    assert.match(ignoreFile, /^out\/Libraries\/\*\*\/Tests\/\*\*$/m);
    assert.doesNotMatch(ignoreFile, /^src\/\*\*$/m);
    assert.doesNotMatch(ignoreFile, /^libs\/\*\*$/m);
  });
});
