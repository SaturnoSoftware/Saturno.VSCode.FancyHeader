import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const REPOSITORY_ROOT = path.join(__dirname, "..", "..");

function readRepositoryFile(relativePath: string): string {
  return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

describe("extension packaging assets", () => {
  it("keeps every About-panel resource available to the extension", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as { icon: string };
    // The template itself lives once in FancyLib; Scripts/build.ps1 stages it
    // into this extension's own Resources/AboutPage/ - see the AboutPage
    // comment there for why a copy step is unavoidable.
    const aboutHtml = readRepositoryFile("Libraries/Saturno.VSCode.FancyLib/Source/AboutPage/about.html");

    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, packageJson.icon)));
    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, "Libraries/Saturno.VSCode.FancyLib/Source/AboutPage/about.css")));
    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, "Resources/icons/saturno-software.png")));
    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, "Resources/icons/presskit-diy.png")));
    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, "Resources/icons/gosh.webp")));
    assert.ok(fs.existsSync(path.join(REPOSITORY_ROOT, "Resources/icons/fancy-comments.webp")));
    assert.match(aboutHtml, /Content-Security-Policy/);
    assert.match(aboutHtml, /\{\{cspSource\}\}/);
    assert.match(aboutHtml, /\{\{styleUri\}\}/);
  });

  it("does not run in untrusted workspaces and excludes development files from the VSIX", () => {
    const packageJson = JSON.parse(readRepositoryFile("package.json")) as {
      capabilities: { untrustedWorkspaces: { supported: boolean } };
    };
    const ignoreFile = readRepositoryFile(".vscodeignore");

    assert.strictEqual(packageJson.capabilities.untrustedWorkspaces.supported, false);
    assert.match(ignoreFile, /^Source\/\*\*$/m);
    assert.match(ignoreFile, /^Libraries\/\*\*$/m);
    assert.match(ignoreFile, /^tests\/\*\*$/m);
    assert.match(ignoreFile, /^out\/Libraries\/\*\*\/tests\/\*\*$/m);
    assert.doesNotMatch(ignoreFile, /^src\/\*\*$/m);
    assert.doesNotMatch(ignoreFile, /^libs\/\*\*$/m);
  });
});
