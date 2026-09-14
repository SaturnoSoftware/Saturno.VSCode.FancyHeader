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
    [string]$ReleaseName = "vscode-fancy-header"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath

## -----------------------------------------------------------------------------
Write-Host "==> Building: $ReleaseName"

Remove-Item -LiteralPath $BuildOutputDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $BuildOutputDir | Out-Null
Remove-Item -LiteralPath (Join-Path $ProjectRoot "out") -Recurse -Force -ErrorAction SilentlyContinue

## -----------------------------------------------------------------------------
Push-Location $ProjectRoot
try {
    & npx tsc -p ./
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

Copy-Item -LiteralPath (Join-Path $ProjectRoot "package.json") `
    -Destination $BuildOutputDir -Force

Copy-Item -LiteralPath (Join-Path $ProjectRoot "LICENSE.txt") `
    -Destination $BuildOutputDir -Force

## -----------------------------------------------------------------------------
if (Test-Path -LiteralPath (Join-Path $ProjectRoot "Resources") -PathType Container) {
    Copy-Item -Path (Join-Path $ProjectRoot "Resources") `
        -Destination $BuildOutputDir `
        -Recurse  `
        -Force
}

Write-Host "==> Done"
