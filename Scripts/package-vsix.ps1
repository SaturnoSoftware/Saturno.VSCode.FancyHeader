param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$PackageOutputDir = (Join-Path $ProjectRoot "out/package"),
    [string]$ReleaseName = "vscode-fancy-header"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath

Write-Host "==> Packaging: $ReleaseName"

Remove-Item -LiteralPath $PackageOutputDir -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $PackageOutputDir | Out-Null

Push-Location $ProjectRoot
try {
    & npx vsce package --out "$PackageOutputDir/"
    if ($LASTEXITCODE -ne 0) { throw "vsce package failed." }
}
finally {
    Pop-Location
}

$VsixFile = Get-ChildItem -Path $PackageOutputDir -Filter "*.vsix" | Select-Object -First 1
if ($null -eq $VsixFile) {
    throw "No .vsix file found after packaging."
}

Write-Host "==> Packaged: $($VsixFile.Name)"
Write-Host "==> Done"
