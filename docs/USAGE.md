# FancyHeader usage notes

## Header identity and duplicate protection

**Saturno: Add Header** inserts one generated header at the beginning of the active file. Before resolving template data or editing the document, it recognizes a complete framed header using the active language comment syntax. The guard supports line and block comment fences and prevents a second insertion.

## Copyright and author fields

The default template deliberately keeps these values separate:

```text
Copyright : YEAR COPYRIGHT_OWNER
Author    : USER_NAME <USER_EMAIL>
```

Set `saturno-fancy-header.copyrightOwner` to control the copyright holder. When it is empty, the resolved author name is used as its fallback. `YEAR` is the file creation-year range, while `AUTHOR` identity comes from settings, Git identity, and finally the operating-system user.

## Runtime metadata order

`PROJECT` resolves in this order: nearest Git worktree name, VS Code workspace-folder display name, workspace folder path name, then active file parent folder. Git commands run asynchronously on the command path. `LAST_MODIFIED` uses the latest file commit when available and otherwise the file modification timestamp.