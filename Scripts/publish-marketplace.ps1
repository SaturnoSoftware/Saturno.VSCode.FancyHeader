param(
    [string]$ProjectRoot = (Split-Path $PSScriptRoot -Parent),
    [string]$PackageOutputDir = "",
    [string]$PackagePath = ""
)

$ErrorActionPreference = "Stop"
$ResolvedProjectRoot = (Resolve-Path -LiteralPath $ProjectRoot).ProviderPath

if ([string]::IsNullOrWhiteSpace($env:VSCE_PAT)) {
    throw "VSCE_PAT is required to publish to the Visual Studio Marketplace."
}

if ([string]::IsNullOrWhiteSpace($PackagePath)) {
    $ResolvedPackageOutputDir = if ([string]::IsNullOrWhiteSpace($PackageOutputDir)) {
        Join-Path $ResolvedProjectRoot "__DIST"
    }
    elseif ([IO.Path]::IsPathRooted($PackageOutputDir)) {
        $PackageOutputDir
    }
    else {
        Join-Path $ResolvedProjectRoot $PackageOutputDir
    }

    $VsixFile = Get-ChildItem -LiteralPath $ResolvedPackageOutputDir -Filter "*.vsix" -Recurse -File | Sort-Object FullName | Select-Object -First 1
    if ($null -eq $VsixFile) {
        throw "No .vsix file found under $ResolvedPackageOutputDir."
    }

    $PackagePath = $VsixFile.FullName
}
elseif (-not [IO.Path]::IsPathRooted($PackagePath)) {
    $PackagePath = Join-Path $ResolvedProjectRoot $PackagePath
}

if (-not (Test-Path -LiteralPath $PackagePath -PathType Leaf)) {
    throw "VSIX package not found: $PackagePath"
}

Push-Location $ResolvedProjectRoot
try {
    & npx vsce publish --packagePath $PackagePath --pat $env:VSCE_PAT
    if ($LASTEXITCODE -ne 0) {
        throw "vsce publish failed."
    }
}
finally {
    Pop-Location
}

Write-Host "==> Published to Visual Studio Marketplace: $(Split-Path -Leaf $PackagePath)"
