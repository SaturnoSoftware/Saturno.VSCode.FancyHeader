##----------------------------------------------------------------------------##
##  File      : get-release-assets.ps1                                        ##
##  Project   : Saturno.VSCode.FancyHeader / Scripts/release                  ##
##  Date      : 2026-09-18                                                    ##
##  Copyright : Saturno Software - 2026                                       ##
##  Author    : mateusdigital <hello@mateus.digital>                          ##
##----------------------------------------------------------------------------##

# VSCODEKIT-0025: spb's generic fallback (-ReleaseArchivePath, its own zip
# convention under $Context.ReleaseDistDir) never finds anything here - this
# repo's own Scripts/package.ps1 writes the real distributable into a fixed
# __DIST/vsix/ directory, unrelated to spb's per-release-name paths. That
# directory is wiped at the start of every package.ps1 run, so after a
# successful package it holds exactly one file: the one just built, correctly
# named for whichever channel produced it (plain / .dev / .rc).

param(
    [string]$ProjectRoot,
    [string]$PackageOutputDir,
    [string]$ReleaseArchivePath
)

$ErrorActionPreference = "Stop"

$VsixDir = Join-Path $ProjectRoot "__DIST/vsix"
$Vsix = @(Get-ChildItem -LiteralPath $VsixDir -Filter "*.vsix" -File -ErrorAction SilentlyContinue)

if ($Vsix.Count -ne 1) {
    $Found = if ($Vsix.Count -gt 0) { ($Vsix | ForEach-Object { $_.Name }) -join ", " } else { "nothing" }
    throw "Expected exactly one .vsix under $VsixDir (Scripts/package.ps1 clears this directory on every run); found: $Found. Run 'spb package' first."
}

Write-Output $Vsix[0].FullName
