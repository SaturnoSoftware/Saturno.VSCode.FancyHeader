// SPDX-License-Identifier: GPL-3.0-only

/**
 * Development-only commands.
 *
 * This whole directory is excluded from `tsconfig.prod.json`, so a production
 * build never compiles it, `out/Source/dev/` does not exist, and the guarded
 * require in `extension.ts` fails and moves on. The production build also
 * strips the dev command from the packaged `package.json`, so it is not in
 * the manifest either - the function is not installed, not merely hidden.
 *
 * FANCYHDR-0039: wires vscode to the shared FancyLib Open Bug panel
 * (VSCODEKIT-0018..0021) - metadata-only by default, evidence is opt-in,
 * Git identity is queried asynchronously with a timeout, and the report is
 * saved to this extension's own private global storage - never to the
 * Brain, never automatically.
 *
 * Everything here may import `vscode`. Nothing here may be imported by any
 * always-shipped module or by `extension.ts` at module level.
 */

import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import * as vscode from 'vscode';

import {
  ActiveEditorContext,
  DevBugReportCaptureConfig,
  DevBugReportPanelPorts,
  EvidenceChoice,
  GitIdentityAttempt,
  resolveDestinationDirectory,
  reserveReportFile,
  runOpenBugPanel,
} from '../../Libraries/Saturno.VSCode.FancyLib/Source';
import { DevHost } from '../DevHooks';

const SECTION = 'saturno-fancy-header';
const GIT_IDENTITY_TIMEOUT_MS = 2000;

// -----------------------------------------------------------------------------
function activeEditorContext(): ActiveEditorContext {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return { document: null, selection: null, selectedText: null };
  }

  const doc = editor.document;
  const document = doc.isUntitled
    ? { untitled: true as const, languageId: doc.languageId }
    : { relativePath: vscode.workspace.asRelativePath(doc.uri, false), languageId: doc.languageId };

  const sel = editor.selection;
  const selection = {
    start: { line: sel.start.line, character: sel.start.character },
    end: { line: sel.end.line, character: sel.end.character },
    isEmpty: sel.isEmpty,
  };

  return { document, selection, selectedText: sel.isEmpty ? null : doc.getText(sel) };
}

/** Never runs synchronously on the UI path: bounded by a timeout race, and a
 *  missing `git` binary or a non-repository directory degrade to a typed
 *  outcome instead of throwing. */
// -----------------------------------------------------------------------------
async function gitIdentity(cwd: string, timeoutMs: number): Promise<GitIdentityAttempt> {
  const run = (args: string[]): Promise<string> =>
    new Promise((resolve, reject) => {
      execFile('git', args, { cwd, encoding: 'utf8' }, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout.trim());
        }
      });
    });

  const timeout = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('git query timed out')), timeoutMs);
  });

  try {
    const [branch, shortCommit] = await Promise.race([
      Promise.all([run(['rev-parse', '--abbrev-ref', 'HEAD']), run(['rev-parse', '--short', 'HEAD'])]),
      timeout,
    ]);
    return { outcome: 'found', identity: { branch, shortCommit } };
  } catch (error) {
    if (error instanceof Error && error.message === 'git query timed out') {
      return { outcome: 'timed_out' };
    }
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    if (code === 'ENOENT') {
      return { outcome: 'unavailable' };
    }
    return { outcome: 'error' };
  }
}

/** A single multi-select QuickPick for both evidence choices, dismissible
 *  with Escape - the caller treats "nothing picked" the same whether the
 *  user dismissed the prompt or picked nothing on purpose. */
// -----------------------------------------------------------------------------
async function promptForEvidenceChoice(): Promise<EvidenceChoice | undefined> {
  const SELECTED_TEXT = 'Attach the selected text (or current line)';
  const GIT_IDENTITY = 'Attach the current Git branch and commit';
  const picked = await vscode.window.showQuickPick([SELECTED_TEXT, GIT_IDENTITY], {
    canPickMany: true,
    title: 'Saturno bug report: optional evidence',
    placeHolder: 'Nothing is attached beyond safe metadata unless you pick it here',
    ignoreFocusOut: true,
  });
  if (picked === undefined) {
    return undefined;
  }
  return {
    includeSelectedText: picked.includes(SELECTED_TEXT),
    includeGitIdentity: picked.includes(GIT_IDENTITY),
  };
}

// -----------------------------------------------------------------------------
function buildPorts(context: vscode.ExtensionContext, host: DevHost): DevBugReportPanelPorts {
  return {
    promptForTitle: () =>
      Promise.resolve(
        vscode.window.showInputBox({
          title: 'Saturno bug report',
          prompt: 'One line: what is wrong?',
          placeHolder: 'the generated header drifted a column past 80',
          ignoreFocusOut: true,
        })
      ),
    promptForEvidenceChoice,
    getActiveEditorContext: activeEditorContext,
    getGitIdentity: (timeoutMs: number) => {
      const editor = vscode.window.activeTextEditor;
      const cwd = editor
        ? path.dirname(editor.document.uri.fsPath)
        : vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!cwd) {
        return Promise.resolve<GitIdentityAttempt>({ outcome: 'unavailable' });
      }
      return gitIdentity(cwd, timeoutMs);
    },
    getEnvironmentInfo: () => ({
      extensionId: 'saturno.fancy-header',
      extensionVersion: host.extensionVersion,
      buildChannel: 'development',
      vscodeVersion: vscode.version,
      platform: process.platform,
    }),
    getCaptureConfig: (): DevBugReportCaptureConfig => ({
      captureDocument: true,
      captureSelection: true,
      gitIdentityTimeoutMs: GIT_IDENTITY_TIMEOUT_MS,
    }),
    generateReportId: () => randomUUID(),
    now: () => new Date(),
    saveReport: (fileName, markdown) => {
      const directory = resolveDestinationDirectory({
        defaultDirectory: context.globalStorageUri.fsPath,
        expectedRoots: [context.globalStorageUri.fsPath],
      });
      return Promise.resolve(reserveReportFile(directory, fileName, markdown));
    },
    openReport: async (stored) => {
      const opened = await vscode.workspace.openTextDocument(vscode.Uri.file(stored.path));
      await vscode.window.showTextDocument(opened, { preview: false });
    },
  };
}

// -----------------------------------------------------------------------------
async function reportBug(context: vscode.ExtensionContext, host: DevHost): Promise<void> {
  const outcome = await runOpenBugPanel(buildPorts(context, host));
  switch (outcome.kind) {
    case 'cancelled':
      return;
    case 'invalid':
      void vscode.window.showWarningMessage(
        `${SECTION} dev: ${outcome.diagnostics.map((d) => d.message).join(' ')}`
      );
      return;
    case 'saved':
      void vscode.window.setStatusBarMessage(
        `Saturno bug report saved${outcome.openFailed ? ` (could not reopen it: ${outcome.stored.path})` : ''}`,
        6000
      );
      return;
  }
}

// -----------------------------------------------------------------------------
export function registerDevCommands(context: unknown, host: DevHost): void {
  const ctx = context as vscode.ExtensionContext;
  void vscode.commands.executeCommand('setContext', 'saturnoFancyHeader.devMode', true);
  ctx.subscriptions.push(
    vscode.commands.registerCommand(`${SECTION}.dev.reportBug`, () => reportBug(ctx, host))
  );
}
