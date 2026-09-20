# Changelog

All notable changes to Saturno FancyHeader are documented here.

## 2.2.3 - 2026-09-20

### Fixed
- The `Saturno: About FancyHeader` command failed at runtime: `media/about.html` and
  `media/about.css` (the webview it loads) were never copied into the staged build by
  `Scripts/build.ps1`, so no packaged `.vsix` - including 2.2.2 - ever shipped them, even
  though the command itself was correctly registered. `build.ps1` and `package.ps1` now stage
  and package `media/` alongside `Resources/`.

## 2.2.2 - 2026-09-20

### Changed
- Adopted the full Saturno codestyle for TypeScript: `PascalCase` public functions/methods,
  `_PascalCase` (convention, not the `private` keyword) for internal ones, `snake_case` locals,
  `camelCase` parameters, `PascalCase.ts` file names. Reverses the TypeScript `camelCase`
  exception (`languages/TYPESCRIPT.md`, WSPROC-0056).
- Every consumer of `Saturno.VSCode.FancyLib` now goes through a single
  `import * as Fancy from ".../FancyLib/Source"` instead of importing each module by path.
  `Runtime.ts` and `TemplateManagement.ts` (the pure core) import their FancyLib submodules
  directly instead, since the barrel would pull in `vscode`-dependent modules transitively.
- `Config.ts` split from `ConfigResolution.ts`, and `CommentUtils.ts` split from
  `CommentDetection.ts`, so the pure logic in each pair stays loadable and testable outside a
  real VS Code host.

### Fixed
- `Scripts/package.ps1`'s VSIX isolation self-check was channel-blind: it rejected any packaged
  `tests/` path or `.map` file regardless of build channel, so a genuine `-Environment
  development` build (which legitimately compiles FancyLib's own `tests/` tree) always failed
  it. This was the actual reason every prior `-dev` build in the registry had been built with
  `-Environment production` instead - the only way to get `package.ps1` to pass - which meant
  those `-dev` artifacts never contained `Source/dev/` or the Open Bug command at all
  (VSCODEKIT-B0026). The check is now release-channel-only.
- The globally-installed `spb` predated the `-BuildChannel` flag entirely, so `--build-channel`
  was silently ignored workspace-wide. `spb` now always runs from source
  (`repos_internal/InternalTools/Saturno.ProjectBuilder`) instead of a periodically-stale
  installed snapshot.
- Discord release announcements now carry the build number (e.g.
  `saturno-fancy-header-2.2.2-NN-dev`), not just the bare channel tag, so a repeat dev-channel
  publish is distinguishable from the previous one.
