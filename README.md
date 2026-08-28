<p align="center">
    <img src="res/images/icon.png" alt="Saturno FancyHeader" width="160">
</p>

<p align="center">
    <a href="https://github.com/SaturnoSoftware/vscode-fancy-header/releases"><img src="https://badgen.net/github/release/SaturnoSoftware/vscode-fancy-header?cache=600" alt="latest release"></a>
    <a href="https://github.com/SaturnoSoftware/vscode-fancy-header/commits"><img src="https://badgen.net/github/commits/SaturnoSoftware/vscode-fancy-header?cache=600" alt="commits"></a>
    <a href="./LICENSE.txt"><img src="https://badgen.net/badge/license/GPL--3.0/blue" alt="License: GPL-3.0"></a>
    <a href="./tests"><img src="https://badgen.net/badge/tests/CI%20verified/green" alt="Tests: CI verified"></a>
    <a href="https://marketplace.visualstudio.com/items?itemName=SaturnoSoftware.saturno-fancy-header"><img src="https://badgen.net/badge/platform/VS%20Code%20%5E1.88.0/blue" alt="Platform"></a>
</p>

<p align="center">
  <b>Insert consistent file headers with one command.</b> Language-aware, configurable, and ready for real project templates.
  <br>
  <br>
</p>

**Saturno FancyHeader** is a VS Code extension that inserts structured file headers using the active language comment syntax plus file, project, date, and author metadata. It gives source files a clean, repeatable header without hand-written boilerplate.

Maintained by [Saturno.Software](https://saturno.software/).

---

## Quick Start

### Install from VSIX

```bash
code --install-extension saturno-fancy-header-2.0.0.vsix
```

### Use

1. Open a file in VS Code
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run `Saturno: Add Header`

<p align="center">
    <img width="737" height="188" alt="Header(SaturnFH)" src="https://github.com/user-attachments/assets/8f5b2d20-0c64-41b7-a2fa-ab7302396016" />
</p>

Optional template commands:

- `Saturno: New Header Template`
- `Saturno: Edit Header Templates`

**Default output:**

```text
// ------------------------------------------------------------------------------
//   File      : example.ts
//   Project   : my-project
//   Date      : 2026-05-31
//   Copyright : 2026 Saturno Software
//   Author    : Mateus <mateus@example.com>
// ------------------------------------------------------------------------------
```

---

## Features

- **Language-Aware** -- Uses the active VS Code language comment syntax automatically
- **Metadata-Driven** -- Inserts file name, project name, date, and author information
- **Template-Based** -- Supports inline template lines, external template files, and named template pickers
- **Command Palette Friendly** -- Create, edit, and apply templates without leaving the editor
- **Cross-Platform** -- Works on Windows, macOS, and Linux with platform-correct template paths
- **Zero Config** -- Works out of the box with sensible defaults

---

## Installation

### From GitHub Release

Download the latest `.vsix` from [Releases](https://github.com/SaturnoSoftware/vscode-fancy-header/releases), then install it:

```bash
code --install-extension saturno-fancy-header-2.0.0.vsix
```

### From Source

```bash
git clone https://github.com/SaturnoSoftware/vscode-fancy-header
cd vscode-fancy-header
git submodule update --init --recursive
npm install
npm run package
code --install-extension __DIST/*.vsix
```

### Requirements

- VS Code ^1.88.0

---

## Configuration

All settings are available in the VS Code Settings UI under **Saturno FancyHeader**, or in `settings.json`.

**Minimal template-file setup:**

```json
{
  "saturno-fancy-header.templateFile": "${workspaceFolder}/_header-template.txt"
}
```

If `templateFile` is set, FancyHeader reads the template body from that file and **does not require** `templateLines` to be configured as well.

**Advanced overrides (optional):**

```json
{
  "saturno-fancy-header.lineWidth": 80,
  "saturno-fancy-header.fillChar": "-",
  "saturno-fancy-header.templateFile": "${workspaceFolder}/_header-template.txt",
  "saturno-fancy-header.authorName": "",
  "saturno-fancy-header.authorEmail": "",
  "saturno-fancy-header.copyrightOwner": "Saturno Software",
  "saturno-fancy-header.templateLines": [
    "  File      : FILENAME",
    "  Project   : PROJECT",
    "  Date      : DATE",
    "  Copyright : YEAR COPYRIGHT_OWNER",
    "  Author    : USER_NAME <USER_EMAIL>"
  ]
}
```

| Setting | Default | Description |
|---------|---------|-------------|
| `lineWidth` | `80` | Total width of generated header lines |
| `fillChar` | `"-"` | Border fill character |
| `templateFile` | `""` | Optional external template file |
| `templates` | `[]` | Optional named template files shown in a picker |
| `authorName` | `""` | Optional author name override |
| `authorEmail` | `""` | Optional author email override |
| `copyrightOwner` | author name | Optional copyright holder; falls back to resolved author name |
| `templateLines` | default list | Inline template body with placeholders |

Supported placeholders:

- `FILENAME`
- `PROJECT`
- `DATE`
- `YEAR`
- `COPYRIGHT_OWNER`
- `USER_NAME`
- `USER_EMAIL`
- `LAST_MODIFIED`

`PROJECT` resolves deterministically in this order: the nearest Git worktree root name, the VS Code workspace-folder display name, the workspace-folder name from its path, then the active file's parent directory name.

`LAST_MODIFIED` uses the date of the latest Git commit that changed the active file. When Git history is unavailable, it falls back to the file modification date.

### Template File Example

Create `_header-template.txt`:

```text
  File      : ${FILENAME}
  Project   : ${PROJECT}
  Date      : ${DATE}
  Author    : ${USER_NAME} <${USER_EMAIL}>
```

Then point `templateFile` to it.

FancyHeader also auto-discovers template files named `_header-*.txt` in the same template directory and in the default user template folder, so if you add a new file there it is picked up automatically in the template picker.

If you define `templates`, FancyHeader merges those named entries with the discovered files and opens a Quick Pick when more than one template is available.

---

## Commands

| Command | Title | Description |
|---------|-------|-------------|
| `saturno-fancy-header.addHeader` | `Saturno: Add Header` | Insert a header with the active template and language comment syntax |
| `saturno-fancy-header.newTemplate` | `Saturno: New Header Template` | Create a new template file, register it, and open it |
| `saturno-fancy-header.editTemplates` | `Saturno: Edit Header Templates` | Pick and open an existing template file |

---

## How It Works

FancyHeader reads VS Code language configuration to determine the correct line comment syntax for the active document, then fills the selected template with:

- current file name
- workspace or project name
- current date, copyright year, and copyright owner
- author name and email from settings, Git config, or local user information

Template selection follows this order:

1. named template chosen from `templates`
2. external file from `templateFile`
3. inline `templateLines`

---

## Demos and detailed usage

- [Release demo configuration](./docs/DEMO.md)
- [Header identity, copyright, and metadata rules](./docs/USAGE.md)
- [Repository-facing audit](./docs/REPOSITORY-AUDIT.md)

---

## Local Development

```bash
git submodule update --init --recursive
npm install
npm test
npm run build
npm run package
```

---

## Contributing

Contributions welcome! Please:

- follow existing code style
- add tests for new features
- submit pull requests against `main`

---

## License

GPL-3.0 -- See [LICENSE.txt](./LICENSE.txt) for details.

Maintained by [Saturno.Software](https://saturno.software/).

---

## FAQ

**Q: Does it work with different programming languages?**
A: Yes. FancyHeader uses the active VS Code language comment syntax, so it works anywhere VS Code exposes a line-comment style.

**Q: Can I use my own header template file?**
A: Yes. Set `saturno-fancy-header.templateFile` to a text file, or configure multiple named templates with `saturno-fancy-header.templates`.

**Q: Where do author name and email come from?**
A: From the extension settings first, then Git config when available, then local user information as a fallback.

**Q: What happens if I run Add Header twice?**
A: A complete generated header already at the document start is detected, so the second invocation does not change the file.

**Q: How do I install without a marketplace listing?**
A: Download or build the `.vsix`, then run `code --install-extension path-to-file.vsix`.

---

## Links

- [GitHub Repository](https://github.com/SaturnoSoftware/vscode-fancy-header)
- [GitHub Releases](https://github.com/SaturnoSoftware/vscode-fancy-header/releases)
- [Issues](https://github.com/SaturnoSoftware/vscode-fancy-header/issues)
- [Saturno.Software](https://saturno.software/)

---
<p align="center">
  <b>Made with &lt;3 by Saturno.Software</b>
</p>
