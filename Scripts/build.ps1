## -------------------------------------------------------------------------- ##
##                               *       +                                    ##
##                         '                  |                               ##
##                     ()    .-.,="``"=.    - o -                             ##
##                           '=/_       \\     |                              ##
##                        *   |  '=._    |                                    ##
##                             \\     `=./`,        '                         ##
##                          .   '=.__.=' `='      *                           ##
##                                                                            ##
##                                                                            ##
## File      : build.ps1                                                      ##
## Project   : Saturno.Fancy.Header                                           ##
## Date      : 2026-08-27                                                     ##
## Copyright : Saturno Software - 2026                                        ##
## Author    : mateusdigital <hello@mateus.digital>                           ##
## -------------------------------------------------------------------------- ##

param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$BuildOutputDir = (Join-Path $ProjectRoot "out/build"),
    [string]$ReleaseName = "vscode-fancy-header",
    [ValidateSet("development", "production")]
    [string]$Environment = $(if ($env:SATURNO_BUILD_ENVIRONMENT) { $env:SATURNO_BUILD_ENVIRONMENT } else { "development" }),
    # PROJECTBUILDER-0049: naming/path concern only - forwarded by spb, logged
    # here, and consumed by Scripts/package.ps1 to suffix the packaged .vsix.
    # Does NOT affect what this script compiles or strips; that stays governed
    # by -Environment above, unchanged.
    [ValidateSet("development", "rc", "release")]
    [string]$BuildChannel = "release"
)

# FANCYHDR-0039: development-only code lives in Source/dev and is excluded
# from tsconfig.prod.json, so a production build never compiles it. This
# script does the other half: it strips the dev command and menu entry from
# the package.json that goes into the package, so the function is not in the
# manifest either. Hiding a command behind a `when` clause is not the same
# as not shipping it.

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath

## -----------------------------------------------------------------------------
Write-Host "==> Building: $ReleaseName"
Write-Host "==> Environment: $Environment"
Write-Host "==> Build channel: $BuildChannel"

Remove-Item -LiteralPath $BuildOutputDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BuildOutputDir | Out-Null
# A production build must never inherit a prior dev compile's output - out/
# is wiped unconditionally before every compile, dev or prod.
Remove-Item -LiteralPath (Join-Path $ProjectRoot "out") -Recurse -Force -ErrorAction SilentlyContinue

$TsConfig = if ($Environment -eq "production") { "./tsconfig.prod.json" } else { "./tsconfig.json" }

## -----------------------------------------------------------------------------
Push-Location $ProjectRoot
try {
    & npx tsc -p $TsConfig
    if ($LASTEXITCODE -ne 0) {
        throw "TypeScript compilation failed."
    }
}
finally {
    Pop-Location
}

## -----------------------------------------------------------------------------
Copy-Item -Path (Join-Path $ProjectRoot "out") `
    -Destination $BuildOutputDir -Recurse -Force

$Manifest = Get-Content -LiteralPath (Join-Path $ProjectRoot "package.json") -Raw | ConvertFrom-Json

# Scripts/package.ps1 packages this staged directory directly instead of the
# live repo tree, so a real runtime dependency (package.json "dependencies",
# never "devDependencies") has to travel with it - vsce bundles whatever
# node_modules it finds beside the manifest it packages.
if ($Manifest.PSObject.Properties.Name -contains "dependencies" -and @($Manifest.dependencies.PSObject.Properties).Count -gt 0) {
    $StagedNodeModules = Join-Path $BuildOutputDir "node_modules"
    New-Item -ItemType Directory -Force -Path $StagedNodeModules | Out-Null
    foreach ($DepName in $Manifest.dependencies.PSObject.Properties.Name) {
        $SourceDepPath = Join-Path (Join-Path $ProjectRoot "node_modules") $DepName
        if (-not (Test-Path -LiteralPath $SourceDepPath -PathType Container)) {
            throw "Runtime dependency '$DepName' is declared in package.json but missing from node_modules. Run npm install."
        }
        Copy-Item -LiteralPath $SourceDepPath -Destination (Join-Path $StagedNodeModules $DepName) -Recurse -Force
    }
}

if ($Environment -eq "production") {
    $Before = @($Manifest.contributes.commands).Count
    $Manifest.contributes.commands = @(
        $Manifest.contributes.commands | Where-Object { $_.command -notlike "*.dev.*" }
    )
    $After = @($Manifest.contributes.commands).Count

    # @($obj.PSObject.Properties.Name) is not a reliable emptiness check: a
    # PSCustomObject with zero properties returns $null from `.Name`, and
    # @($null) is a one-element array, not an empty one. @($obj.PSObject.
    # Properties) (no `.Name` projection) does not have that gotcha.
    $StrippedMenuEntries = 0
    if ($Manifest.contributes.PSObject.Properties.Name -contains "menus") {
        foreach ($menuProperty in @($Manifest.contributes.menus.PSObject.Properties)) {
            $menuId = $menuProperty.Name
            $entries = @($Manifest.contributes.menus.$menuId)
            $kept = @($entries | Where-Object { $_.command -notlike "*.dev.*" })
            $StrippedMenuEntries += ($entries.Count - $kept.Count)
            if ($kept.Count -eq 0) {
                $Manifest.contributes.menus.PSObject.Properties.Remove($menuId)
            }
            else {
                $Manifest.contributes.menus.$menuId = $kept
            }
        }
        if (@($Manifest.contributes.menus.PSObject.Properties).Count -eq 0) {
            $Manifest.contributes.PSObject.Properties.Remove("menus")
        }
    }

    $DevSettings = @(
        $Manifest.contributes.configuration.properties.PSObject.Properties.Name |
            Where-Object { $_ -like "*.dev.*" }
    )
    foreach ($name in $DevSettings) {
        $Manifest.contributes.configuration.properties.PSObject.Properties.Remove($name)
    }
    Write-Host "==> Stripped $($Before - $After) dev command(s), $StrippedMenuEntries dev menu entry/entries and $($DevSettings.Count) dev setting(s) from the manifest"
}

# Scripts/package.ps1 packages this staged directory as-is: it never has the
# TypeScript sources compile scripts here would need (only compiled `out/`
# survives the copy above), so vsce's own vscode:prepublish lifecycle hook
# must not exist to run - without this, packaging would fail trying to
# recompile from a source tree that was never staged.
if ($Manifest.PSObject.Properties.Name -contains "scripts") {
    $Manifest.PSObject.Properties.Remove("scripts")
}

$Manifest | ConvertTo-Json -Depth 32 |
    Set-Content -LiteralPath (Join-Path $BuildOutputDir "package.json") -Encoding utf8

Copy-Item -LiteralPath (Join-Path $ProjectRoot "LICENSE.txt") `
    -Destination $BuildOutputDir -Force

foreach ($DocName in @("README.md", "CHANGELOG.md")) {
    $DocPath = Join-Path $ProjectRoot $DocName
    if (Test-Path -LiteralPath $DocPath -PathType Leaf) {
        Copy-Item -LiteralPath $DocPath -Destination $BuildOutputDir -Force
    }
}

## -----------------------------------------------------------------------------
if (Test-Path -LiteralPath (Join-Path $ProjectRoot "Resources") -PathType Container) {
    Copy-Item -Path (Join-Path $ProjectRoot "Resources") `
        -Destination $BuildOutputDir `
        -Recurse  `
        -Force
}

Write-Host "==> Done"
