# Changelog

All notable changes to Saturno FancyHeader are documented here.

## 2.4.1 - 2026-09-21

### Fixed
- The dev-only Open Bug domain compiled into production builds. `Extension.ts`'s single FancyLib
  barrel import reached `DevBugReport`/`DevBugReportPanel` through the library's
  `Source/index.ts`, and a static re-export is a static dependency, so the store artifact carried
  a bug-reporting domain it had no command to invoke. `adc7064` disabled the isolation assertion
  in `tests/productionBuildIsolation.test.ts` over this rather than weakening it, on the
  understanding it would be closed later. FancyLib 1.2.0 (`2d3de46`) gives the domain its own
  entry point, `Source/Debug`, which only `Source/dev/` imports and `tsconfig.prod.json`
  excludes. The assertion is a real assertion again, and a production package now contains zero
  `DevBugReport` files (VSCODEKIT-0026).
- `npm run lint` failed with 72 `@typescript-eslint/naming-convention` errors on `main`, so
  `npm run build` could not reach its compile step. `adc7064` adopted the Saturno naming model in
  the source without updating `.eslintrc.json` or the written standard (FANCYHDR-B0010). The
  lint rule now accepts the model, and
  `STANDARDS/code-standards/languages/TYPESCRIPT.md` records the 2026-09-21 decision that makes
  it the standard rather than a local exception.

### Changed
- Everything that is not this extension's core is now the same file as FancyComments':
  `tsconfig.json`, `tsconfig.prod.json`, `.gitignore`, `.vscodeignore`, the lint scope and
  `tests/extensionAssets.test.ts`. That asset test now also asserts the STAGED build output,
  which is what ships - FancyComments' About assets went missing from every published artifact
  for weeks while the repository-only version of the same test stayed green.

## 2.4.0 - 2026-09-20

### Changed
- About panel assets moved from `media/` to `Resources/`: the page template
  (`Resources/AboutPage/about.html` + `about.css`) is staged from a single shared copy in
  `Saturno.VSCode.FancyLib` (`Source/AboutPage/`), and the extension's own icon plus every
  "More Software" product icon now live together under `Resources/icons/`. `Scripts/build.ps1`
  stages the FancyLib template into `Resources/AboutPage/` on every build.
  `package.json`'s `"icon"` now points at `Resources/icons/icon.png`.
- The About panel's one script is now an inline, CSP-nonce'd `<script>` in about.html instead
  of a separate `media/about.js` file.
- About panel: `main` narrowed from 860px back to 600px - a middle ground that still gives the
  "More Software" grid room without the hero/publisher cards stretching too wide.
- Debug (`F5`) no longer depends on `${defaultBuildTask}` resolving through the npm task
  provider: `.vscode/tasks.json`'s watch task is now an explicit `shell` task (not `npm`), and
  `.vscode/launch.json`'s `preLaunchTask` references it by its literal label `"watch"` instead
  of the variable. Removes a real race where the npm provider's background scan hadn't finished
  by the time F5 tried to resolve the default build task, which failed with "Couldn't find task
  ${defaultBuildTask}".
- Pins `Saturno.VSCode.FancyLib` 1.1.0: the About template consolidates from six TypeScript
  component files into one `about.html` + one `about.css` + one `RenderAboutPage.ts` (a plain
  `(template, data) => html` function - FancyLib owns no icons and reads no files itself; the
  consuming extension resolves every URI and passes a plain JSON data model in).

## 2.3.2 - 2026-09-20

### Changed
- The About panel was capped at 420px wide, cramping the "More Software" grid. Widened to
  860px and grew each grid card's minimum width from 150px to 220px so cards get real room
  instead of the grid packing in as many narrow columns as would technically fit.

## 2.3.1 - 2026-09-20

### Fixed
- The "More Software" grid in the About panel broke out of its cards: a grid item defaults to
  `min-width: auto`, which refuses to shrink below its content's intrinsic width, and the card
  description text was set to `white-space: nowrap` - together those forced every card wider
  than its `1fr` track. Cards now get `min-width: 0`, and the grid uses
  `repeat(auto-fit, minmax(150px, 1fr))` instead of a fixed two-column layout plus a width media
  query, since a VS Code panel's real width varies far more than a browser tab's.

## 2.3.0 - 2026-09-20

### Added
- The `Saturno: About FancyHeader` panel now shows a full About page (header card, Saturno
  Software publisher card, and a "More Software" grid for presskit.diy, Gosh and Fancy
  Comments), matching the "AltTilda About" mock. A "View Changelog" button opens this file.
- Three reusable rendering components landed in `Saturno.VSCode.FancyLib`
  (`About/HeaderCard.ts`, `About/AppCard.ts`, `About/IconButton.ts`, assembled by
  `About/Page.ts`), so every Fancy extension can build the same About experience from a
  data model instead of hand-writing HTML per extension.

## 2.2.4 - 2026-09-20

No functional changes. Dev-channel verification build.

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
