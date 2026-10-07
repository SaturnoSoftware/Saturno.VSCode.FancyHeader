param([string]$ProjectRoot, [string]$BuildOutputDir, [string]$PackageOutputDir, [string]$BuildChannel, [int]$BuildNumber, [string]$ReleaseName, [string]$StepResultPath, [string]$SpbDriverRoot)
$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($SpbDriverRoot)) { throw "This v2 hook must be invoked by spb." }
. (Join-Path $SpbDriverRoot "drivers\vscode-vsix.ps1")
$DriverArguments = @{} + $PSBoundParameters; $null = $DriverArguments.Remove("SpbDriverRoot")
Invoke-SpbVsCodeVsixPackage @DriverArguments
