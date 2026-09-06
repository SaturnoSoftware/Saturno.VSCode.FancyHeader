# Repository-facing audit — release 2.0.0

Audit date: 2026-08-24

## Verified in the versioned repository

- `package.json` declares extension identity, GPL-3.0-or-later licensing, VS Code engine, command contributions, settings, repository/issue/homepage metadata, icon, and VSIX packaging configuration.
- `README.md` covers Marketplace/VSIX installation, configuration, project and modification-date rules, templates, local development, license, and links.
- `LICENSE.txt`, `COPYING.txt`, `.github/workflows/quality-gate.yml`, `.github/workflows/release.yml`, and `.github/actions/setup/action.yml` are present.
- Build output and VSIX artifacts are excluded by the checked-in ignore rules.

## Deliberately not verified remotely

This release work did not access GitHub. Hosted repository description, topics, default branch configuration, branch protection, Actions run history, Marketplace publication state, and issue/PR templates must be checked in the hosting UI by a maintainer if needed.