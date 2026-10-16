param(
    [string]$ProjectRoot,
    [string]$BuildOutputDir,
    [ValidateSet("development", "production")][string]$Environment = "development"
)

$ErrorActionPreference = "Stop"
$HadBuildOutputDir = Test-Path Env:\SATURNO_SPB_BUILD_OUTPUT_DIR
$PreviousBuildOutputDir = if ($HadBuildOutputDir) { $env:SATURNO_SPB_BUILD_OUTPUT_DIR } else { $null }

try {
    if ($Environment -eq "production" -and -not [string]::IsNullOrWhiteSpace($BuildOutputDir)) {
        $env:SATURNO_SPB_BUILD_OUTPUT_DIR = $BuildOutputDir
    }
    else {
        Remove-Item Env:\SATURNO_SPB_BUILD_OUTPUT_DIR -ErrorAction SilentlyContinue
    }
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "npm test failed with exit code $LASTEXITCODE."
    }
}
finally {
    if ($HadBuildOutputDir) { $env:SATURNO_SPB_BUILD_OUTPUT_DIR = $PreviousBuildOutputDir }
    else { Remove-Item Env:\SATURNO_SPB_BUILD_OUTPUT_DIR -ErrorAction SilentlyContinue }
}
