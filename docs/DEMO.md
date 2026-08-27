# FancyHeader demo

Use this configuration in a workspace to exercise the release behavior:

```json
{
  "saturno-fancy-header.lineWidth": 80,
  "saturno-fancy-header.fillChar": "-",
  "saturno-fancy-header.authorName": "Release Author",
  "saturno-fancy-header.authorEmail": "author@example.com",
  "saturno-fancy-header.copyrightOwner": "Saturno Software"
}
```

1. Open a source file and run **Saturno: Add Header**. The default header shows the file, project, creation date, copyright year and owner, then the author.
2. Run the command again. A complete generated header at the document start is detected and the file is left unchanged.
3. In a Git worktree, confirm that `PROJECT` uses the repository name and `LAST_MODIFIED` uses the last commit that changed the file. Outside Git, `LAST_MODIFIED` uses the file modification date.
4. Test a template file with `COPYRIGHT_OWNER`, `YEAR`, `USER_NAME`, and `LAST_MODIFIED` independently.