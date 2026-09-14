param(
    [Parameter(Mandatory = $true)][string]$VsixPath,
    [string]$ProjectRoot = (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent),
    [string]$ProfileRoot = (Join-Path ([System.IO.Path]::GetTempPath()) ("saturno-fancy-header-smoke-" + [Guid]::NewGuid().ToString("N")))
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $VsixPath -PathType Leaf)) {
    throw "VsixPath not found: $VsixPath"
}
$VsixPath = (Resolve-Path -LiteralPath $VsixPath).ProviderPath

$CodeCmd = Get-Command "code" -ErrorAction SilentlyContinue
if (-not $CodeCmd) {
    throw "VS Code CLI ('code') not found on PATH. Cannot run a real clean-profile install."
}

$UserDataDir = Join-Path $ProfileRoot "user-data"
$ExtensionsDir = Join-Path $ProfileRoot "extensions"
New-Item -ItemType Directory -Force -Path $UserDataDir | Out-Null
New-Item -ItemType Directory -Force -Path $ExtensionsDir | Out-Null

Write-Host "==> Clean profile: $ProfileRoot"

try {
    Write-Host "==> Installing $VsixPath into the clean profile"
    & code --user-data-dir $UserDataDir --extensions-dir $ExtensionsDir --install-extension $VsixPath --force
    if ($LASTEXITCODE -ne 0) { throw "code --install-extension failed with exit $LASTEXITCODE." }

    $Installed = & code --user-data-dir $UserDataDir --extensions-dir $ExtensionsDir --list-extensions --show-versions
    Write-Host "==> Installed extensions in the clean profile:"
    $Installed | ForEach-Object { Write-Host "    $_" }
    if (-not ($Installed -match "saturnosoftware\.saturno-fancy-header@")) {
        throw "saturno-fancy-header is not reported as installed after --install-extension."
    }

    $SmokeTestPath = Join-Path $PSScriptRoot "smokeTest.js"
    Write-Host "==> Running command smoke test: $SmokeTestPath"

    $CodeExe = $CodeCmd.Source
    $Args = @(
        "--user-data-dir", $UserDataDir,
        "--extensions-dir", $ExtensionsDir,
        "--extensionTestsPath=$SmokeTestPath",
        "--disable-gpu",
        "--no-sandbox",
        "--skip-welcome",
        "--skip-release-notes"
    )
    $Proc = Start-Process -FilePath $CodeExe -ArgumentList $Args -PassThru -WindowStyle Hidden
    $TimeoutMs = 120000
    $Exited = $Proc.WaitForExit($TimeoutMs)
    if (-not $Exited) {
        try { $Proc.Kill($true) } catch {}
        throw "Command smoke test did not exit within ${TimeoutMs}ms - likely no usable display/GPU surface in this environment for a real extension host window. Not a code defect signal by itself; re-run in an interactive session to get a real pass/fail."
    }
    $SmokeExit = $Proc.ExitCode
    if ($SmokeExit -ne 0) { throw "Command smoke test failed with exit $SmokeExit." }

    Write-Host "==> Clean-profile install and both-command smoke: PASS"
}
finally {
    Remove-Item -LiteralPath $ProfileRoot -Recurse -Force -ErrorAction SilentlyContinue
}
