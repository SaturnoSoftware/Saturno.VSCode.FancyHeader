##----------------------------------------------------------------------------##
##  File      : get-release-assets.ps1                                        ##
##  Project   : Saturno.VSCode.FancyHeader / Scripts/release                  ##
##  Date      : 2026-09-18                                                    ##
##  Copyright : Saturno Software - 2026                                       ##
##  Author    : mateusdigital <hello@mateus.digital>                          ##
##----------------------------------------------------------------------------##

# VSCODEKIT-0025: spb's generic fallback (-ReleaseArchivePath, its own zip of
# $Context.ReleaseDistDir) never finds anything, because Scripts/package.ps1
# never writes an archive there - it writes a .vsix instead. It also does NOT
# write to its own hardcoded "__DIST/vsix" default: Get-SpbRepoScriptPath
# forwards -PackageOutputDir = $Context.ReleaseDistDir whenever the target
# script declares that parameter (New-SpbRepoScriptArguments), and
# Scripts/package.ps1 does, so a spb-driven package actually lands the .vsix
# exactly where this script's own -PackageOutputDir argument already points -
# use that, not a second, independently-hardcoded assumption about the path.

param(
    [string]$ProjectRoot,
    [string]$PackageOutputDir,
    [string]$ReleaseArchivePath
)

$ErrorActionPreference = "Stop"

$Vsix = @(Get-ChildItem -LiteralPath $PackageOutputDir -Filter "*.vsix" -File -ErrorAction SilentlyContinue)

if ($Vsix.Count -ne 1) {
    $Found = if ($Vsix.Count -gt 0) { ($Vsix | ForEach-Object { $_.Name }) -join ", " } else { "nothing" }
    throw "Expected exactly one .vsix under $PackageOutputDir; found: $Found. Run 'spb package' first."
}

Write-Output $Vsix[0].FullName
