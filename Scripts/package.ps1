param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$BuildOutputDir = (Join-Path $ProjectRoot "out/build"),
    # NOT under out/: `vscode:prepublish` runs `compile`, which deletes ./out
    # recursively. vsce triggers prepublish itself, so anything this script creates
    # under out/ is gone by the time vsce writes - see FANCYHDR-0037.
    # A dedicated subdirectory of __DIST is safe to wipe and leaves the versioned
    # release folders beside it alone.
    [string]$PackageOutputDir = (Join-Path $ProjectRoot "__DIST/vsix"),
    [string]$ReleaseName = "vscode-fancy-header"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath

Write-Host "==> Packaging: $ReleaseName"

# Packaged from the staged build output, not the live repo tree: that staged
# package.json is already the environment-correct manifest (dev commands
# stripped for a production build, `scripts` removed so vsce's own
# vscode:prepublish lifecycle hook has nothing to try to recompile), and
# `out/` there is already the environment-correct compiled JS. Packaging the
# live tree instead would always ship the dev compile and the full dev
# manifest, regardless of which environment was actually built.
if (-not (Test-Path -LiteralPath $BuildOutputDir -PathType Container)) {
    throw "No staged build output found at $BuildOutputDir. Run the build step first."
}
$BuildOutputDir = (Resolve-Path -LiteralPath $BuildOutputDir).ProviderPath

# The artifact name comes from package.json, and the full file path goes to
# `--out`.
#
# FANCYHDR-0037. The chain, measured on vsce 3.9.1:
#
#   1. This script created `out/package/` and called
#      `vsce package --out "out/package/"`.
#   2. vsce runs `vscode:prepublish` itself, which here is `compile`, which does
#      `Remove-Item ./out -Recurse`. The directory was deleted between step 1
#      and the moment vsce wrote.
#   3. `--out <path>/` behaves differently depending on whether the directory
#      exists at write time - verified both ways:
#        - directory present -> the archive is written INSIDE it, named correctly
#        - directory absent  -> a FILE is created at the literal path, so
#          `out/package/` produced an extensionless file called `package`
#      A valid zip that VS Code will not install and the marketplace rejects.
#   4. The guard that should have caught it did not. See the note below.
#
# Two changes remove the whole chain: package outside `out/` so prepublish cannot
# delete the destination, and pass the full file path so the result does not
# depend on whether a directory happens to exist.
$ManifestPath = Join-Path $BuildOutputDir "package.json"
$Manifest = Get-Content -LiteralPath $ManifestPath -Raw | ConvertFrom-Json
if (-not $Manifest.name -or -not $Manifest.version) {
    throw "package.json must declare both `name` and `version` to build the .vsix name."
}
$ExpectedName = "{0}-{1}.vsix" -f $Manifest.name, $Manifest.version
$ExpectedPath = Join-Path $PackageOutputDir $ExpectedName

Remove-Item -LiteralPath $PackageOutputDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $PackageOutputDir | Out-Null

Push-Location $BuildOutputDir
try {
    & npx vsce package --out "$ExpectedPath"
    if ($LASTEXITCODE -ne 0) { throw "vsce package failed." }
}
finally {
    Pop-Location
}

# Verify what was produced, not that something exists.
#
# FANCYHDR-0037: the previous guard was
#     Get-ChildItem -Path $PackageOutputDir -Filter "*.vsix"
# which silently ignores `-Filter` when the path resolves to a FILE rather than
# a directory. Once vsce turned the output directory into a file, that guard
# returned the broken artifact and the script reported success - the check that
# existed to catch this case is the reason it went unnoticed.
$Produced = @(Get-ChildItem -LiteralPath $PackageOutputDir -File -ErrorAction SilentlyContinue)

if (-not (Test-Path -LiteralPath $ExpectedPath -PathType Leaf)) {
    $Found = if ($Produced) { ($Produced | ForEach-Object { $_.Name }) -join ", " } else { "nothing" }
    throw "Expected $ExpectedName in $PackageOutputDir; found $Found."
}

$Vsix = Get-Item -LiteralPath $ExpectedPath

if ($Vsix.Extension -ne ".vsix") {
    throw "Packaged artifact is '$($Vsix.Name)'; a .vsix extension is required to install it."
}

# A .vsix is a zip. Two bytes are enough to tell an archive from an error dump
# that happened to land at the right path.
$Magic = [System.IO.File]::ReadAllBytes($Vsix.FullName)[0..1]
if ($Magic[0] -ne 0x50 -or $Magic[1] -ne 0x4B) {
    throw "'$($Vsix.Name)' is not a zip archive; it cannot be a usable .vsix."
}

# The version in the name has to match the manifest, or a stale artifact from
# before a version bump passes for a fresh one. Both repos in this family had
# exactly that: a .vsix several versions behind package.json.
if ($Vsix.Name -ne $ExpectedName) {
    throw "Packaged '$($Vsix.Name)' but package.json declares $($Manifest.version)."
}

$Stray = @($Produced | Where-Object { $_.Extension -ne ".vsix" })
if ($Stray) {
    $Names = ($Stray | ForEach-Object { $_.Name }) -join ", "
    throw "Packaging left non-.vsix files in $PackageOutputDir : $Names."
}

Write-Host ("==> Packaged: {0} ({1} KB)" -f $Vsix.Name, [math]::Round($Vsix.Length / 1KB))
Write-Host "==> Done"
