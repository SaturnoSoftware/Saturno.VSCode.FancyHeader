##----------------------------------------------------------------------------##
##  File      : publish-github-release.ps1                                    ##
##  Project   : Saturno.VSCode.FancyHeader / Scripts/release                  ##
##  Date      : 2026-09-18                                                    ##
##  Copyright : Saturno Software - 2026                                       ##
##  Author    : mateusdigital <hello@mateus.digital>                          ##
##----------------------------------------------------------------------------##

param(
    [Parameter(Mandatory = $true)][string]$Tag,
    [string]$ArchivePath = "",
    [string[]]$AssetPaths = @(),
    [string]$Title = "",
    [switch]$Draft,
    # spb's real -BuildChannel != release marker, forwarded
    # only for a development/rc channel build.
    [switch]$Prerelease,
    [string]$Target = ""
)

$ErrorActionPreference = "Stop"

# This repo's real releases are published manually via
# `github-repository-admin.py publish-release --confirm-publish`, a deliberate
# choice - never automatically by spb. This script exists only so
# `spb package --registry --build-channel development|rc` can share a
# pre-release build with the team through a real GitHub link. It refuses to do
# anything for the release channel (no -Prerelease), so adding this file gives
# `spb release` no new automatic publish behavior for this repo - it remains
# exactly as inert here as it was before this file existed.
if (-not $Prerelease) {
    Write-Host "==> Skipping automatic GitHub release for '$Tag': this repo's real releases are published manually via github-repository-admin.py publish-release."
    return
}

if ([string]::IsNullOrWhiteSpace($Title)) {
    $Title = $Tag
}

function Invoke-GhReleaseCommand {
    param(
        [Parameter(Mandatory = $true)][string[]]$Arguments
    )

    $OutputLines = @(& gh @Arguments 2>&1)
    $ExitCode = $LASTEXITCODE
    $OutputText = ($OutputLines | Where-Object { $null -ne $_ } | ForEach-Object { $_.ToString() }) -join [Environment]::NewLine

    return [pscustomobject]@{
        ExitCode = $ExitCode
        Output = $OutputText
    }
}

if ($AssetPaths.Count -eq 0) {
    if ([string]::IsNullOrWhiteSpace($ArchivePath)) {
        throw "Provide -ArchivePath or -AssetPaths."
    }

    $AssetPaths = @($ArchivePath)
}

$ResolvedAssetPaths = @(
    $AssetPaths |
        Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_) } |
        ForEach-Object { (Resolve-Path -LiteralPath $_).ProviderPath }
)

if ($ResolvedAssetPaths.Count -eq 0) {
    throw "No release assets were resolved."
}

Write-Host "::group::Publishing release asset"
Write-Host "Tag: $Tag"
Write-Host "Assets:"
$ResolvedAssetPaths | ForEach-Object { Write-Host " - $_" }

$CreateArguments = @("release", "create", $Tag) + $ResolvedAssetPaths + @("--title", $Title)
if ($Draft) {
    $CreateArguments += "--draft"
}
# Always true on this path - the -Prerelease guard above already returned
# otherwise - but written explicitly rather than assumed, so a future edit to
# the guard cannot silently start publishing full releases through this branch.
if ($Prerelease) {
    $CreateArguments += "--prerelease"
}
if (-not [string]::IsNullOrWhiteSpace($Target)) {
    $CreateArguments += @("--target", $Target)
}

$CreateArguments += "--generate-notes"
$CreateResult = Invoke-GhReleaseCommand -Arguments $CreateArguments
if ($CreateResult.ExitCode -eq 0) {
    Write-Host "::endgroup::"
    return
}

if ($CreateResult.Output -notmatch "already exists") {
    throw "gh $($CreateArguments -join ' ') failed: $($CreateResult.Output)"
}

$UploadArguments = @("release", "upload", $Tag) + $ResolvedAssetPaths + @("--clobber")
$UploadResult = Invoke-GhReleaseCommand -Arguments $UploadArguments
if ($UploadResult.ExitCode -ne 0) {
    throw "gh $($UploadArguments -join ' ') failed: $($UploadResult.Output)"
}

# `release upload --clobber` only replaces assets - the release's own title stays
# whatever the first publish set it to, so a repeat channel build silently ships a
# fresh asset under a stale title (still naming the old build number). Keep them
# in sync explicitly; a failure here must not undo the asset that already landed.
$EditArguments = @("release", "edit", $Tag, "--title", $Title)
$EditResult = Invoke-GhReleaseCommand -Arguments $EditArguments
if ($EditResult.ExitCode -ne 0) {
    throw "gh $($EditArguments -join ' ') failed: $($EditResult.Output)"
}

Write-Host "::endgroup::"
