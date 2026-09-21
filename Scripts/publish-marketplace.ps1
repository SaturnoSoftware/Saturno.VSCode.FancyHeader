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

# This used to be
# Get-ChildItem -Filter "*.vsix" -Recurse | Sort-Object FullName | Select-Object -First 1,
# which - measured on this machine with development/rc-suffixed filenames now
# possible alongside the release one - picks a ".dev.vsix" or ".rc.vsix" artifact
# before the real "{name}-{version}.vsix" release one. There is exactly one
# artifact this script is ever allowed to publish: the unsuffixed release build
# whose name matches the live package.json. It is resolved explicitly and never
# guessed from whatever happens to sort first in a directory.
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

    $LiveManifest = Get-Content -LiteralPath (Join-Path $ResolvedProjectRoot "package.json") -Raw | ConvertFrom-Json
    if (-not $LiveManifest.name -or -not $LiveManifest.version) {
        throw "package.json must declare both name and version to resolve the release artifact to publish."
    }
    $ExpectedReleaseName = "{0}-{1}.vsix" -f $LiveManifest.name, $LiveManifest.version
    $ExpectedReleasePath = Join-Path $ResolvedPackageOutputDir $ExpectedReleaseName

    if (-not (Test-Path -LiteralPath $ExpectedReleasePath -PathType Leaf)) {
        $Found = @(Get-ChildItem -LiteralPath $ResolvedPackageOutputDir -Filter "*.vsix" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object { $_.Name })
        $FoundText = if ($Found) { $Found -join ", " } else { "nothing" }
        throw "Expected the release-channel artifact $ExpectedReleaseName under $ResolvedPackageOutputDir; found: $FoundText. Publish only ever targets the unsuffixed release build - a .dev.vsix or .rc.vsix file is never published, even if one is present. Run 'spb package' (or Scripts/package.ps1) with the default release channel first."
    }

    $PackagePath = $ExpectedReleasePath
}
elseif (-not [IO.Path]::IsPathRooted($PackagePath)) {
    $PackagePath = Join-Path $ResolvedProjectRoot $PackagePath
}

if (-not (Test-Path -LiteralPath $PackagePath -PathType Leaf)) {
    throw "VSIX package not found: $PackagePath"
}

# Defense in depth, and unconditional even when -PackagePath was passed
# explicitly: a channel-suffixed filename is a naming convention, not proof of
# content. This opens the actual archive and refuses to publish anything whose
# packaged manifest still carries a debug-tagged command, menu entry, or
# configuration property, regardless of how $PackagePath was resolved.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$PublishCandidate = Get-Item -LiteralPath $PackagePath
$Archive = [System.IO.Compression.ZipFile]::OpenRead($PublishCandidate.FullName)
try {
    $ManifestEntry = $Archive.GetEntry("extension/package.json")
    if ($null -eq $ManifestEntry) {
        throw "'$($PublishCandidate.Name)' has no extension/package.json; it cannot be a valid packaged extension."
    }
    $Reader = [System.IO.StreamReader]::new($ManifestEntry.Open())
    try { $PackagedManifest = $Reader.ReadToEnd() | ConvertFrom-Json }
    finally { $Reader.Dispose() }

    $DevCommandIds = @(
        @($PackagedManifest.contributes.commands) | Where-Object { $_.command -like "*.dev.*" } | ForEach-Object { $_.command }
    )
    $DevMenuCommandIds = @()
    if ($PackagedManifest.contributes.PSObject.Properties.Name -contains "menus") {
        foreach ($menuProperty in @($PackagedManifest.contributes.menus.PSObject.Properties)) {
            $DevMenuCommandIds += @(
                @($PackagedManifest.contributes.menus.$($menuProperty.Name)) | Where-Object { $_.command -like "*.dev.*" } | ForEach-Object { $_.command }
            )
        }
    }
    $DevSettingKeys = @(
        $PackagedManifest.contributes.configuration.properties.PSObject.Properties.Name |
            Where-Object { $_ -like "*.dev.*" }
    )

    if ($DevCommandIds.Count -gt 0 -or $DevMenuCommandIds.Count -gt 0 -or $DevSettingKeys.Count -gt 0) {
        $Details = @(
            $(if ($DevCommandIds.Count -gt 0) { "commands: $($DevCommandIds -join ', ')" })
            $(if ($DevMenuCommandIds.Count -gt 0) { "menu entries: $($DevMenuCommandIds -join ', ')" })
            $(if ($DevSettingKeys.Count -gt 0) { "settings: $($DevSettingKeys -join ', ')" })
        ) | Where-Object { $_ }
        throw "Refusing to publish '$($PublishCandidate.Name)': its packaged manifest still carries debug-tagged entries ($($Details -join '; ')). This is never published to the Visual Studio Marketplace."
    }
}
finally {
    $Archive.Dispose()
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
