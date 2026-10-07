// SPDX-License-Identifier: GPL-3.0-only

// Extension-host smoke test for the packaged saturno-fancy-header .vsix.
//
// Runs inside a real VS Code extension host (launched with
// --extensionTestsPath pointing at this file), against the extension as
// actually installed from the .vsix - not against source.
//
// Covers addHeader and editTemplates: the two commands that can complete
// without a human typing into a QuickInput box. newTemplate opens a
// showInputBox prompt (asks for a template name) and has no non-interactive
// path, so it is out of scope for a scripted smoke and is exercised by hand
// before publish instead. See FANCYHDR-0015.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vscode = require('vscode');

async function openScratchDoc(content) {
    const doc = await vscode.workspace.openTextDocument({ content, language: 'javascript' });
    const editor = await vscode.window.showTextDocument(doc);
    return editor;
}

async function closeActiveEditor() {
    await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
}

async function checkAddHeader() {
    const editor = await openScratchDoc('let x = 1;\n');
    await vscode.commands.executeCommand('saturno-fancy-header.addHeader');
    const text = editor.document.getText();
    assert.notStrictEqual(text, 'let x = 1;\n', 'addHeader did not change the document');
    assert.match(text, /File\s*:/, `addHeader output did not contain the expected "File :" line: ${JSON.stringify(text)}`);
    assert.match(text, /let x = 1;/, 'addHeader must not remove the original document body');
    await closeActiveEditor();
}

async function checkEditTemplates() {
    // A clean profile has no configured or discovered templates, so
    // editTemplates would take the "not configured" branch (opens
    // settings.json and shows an error) instead of exercising the real
    // open-a-template-file behaviour. Point templateFile at a real file
    // first so there is exactly one candidate and no QuickPick is needed.
    const templatePath = path.join(os.tmpdir(), `saturno-fancy-header-smoke-template-${Date.now()}.txt`);
    const marker = 'SATURNO_FANCY_HEADER_SMOKE_TEMPLATE_MARKER';
    fs.writeFileSync(templatePath, `${marker}\n`, 'utf8');

    const config = vscode.workspace.getConfiguration('saturno-fancy-header');
    await config.update('templateFile', templatePath, vscode.ConfigurationTarget.Global);

    try {
        await vscode.commands.executeCommand('saturno-fancy-header.editTemplates');
        const editor = vscode.window.activeTextEditor;
        assert.ok(editor, 'editTemplates did not open an editor');
        assert.strictEqual(
            path.resolve(editor.document.uri.fsPath),
            path.resolve(templatePath),
            `editTemplates opened ${editor.document.uri.fsPath}, expected ${templatePath}`
        );
        assert.match(editor.document.getText(), new RegExp(marker), 'editTemplates opened a file without the expected marker content');
        await closeActiveEditor();
    } finally {
        await config.update('templateFile', undefined, vscode.ConfigurationTarget.Global);
        fs.rmSync(templatePath, { force: true });
    }
}

async function main() {
    const ext = vscode.extensions.getExtension('SaturnoSoftware.saturno-fancy-header');
    assert.ok(ext, 'saturno-fancy-header is not installed in this profile');
    await ext.activate();

    await checkAddHeader();
    await checkEditTemplates();
}

exports.run = function run(_testsRoot, callback) {
    main().then(
        () => callback(null),
        (err) => callback(err)
    );
};
