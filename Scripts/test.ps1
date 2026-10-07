param([string]$ProjectRoot, [string]$BuildOutputDir)

$ErrorActionPreference = "Stop"
$HadBuildOutputDir = Test-Path Env:\SATURNO_SPB_BUILD_OUTPUT_DIR
$PreviousBuildOutputDir = if ($HadBuildOutputDir) { $env:SATURNO_SPB_BUILD_OUTPUT_DIR } else { $null }

try {
    $env:SATURNO_SPB_BUILD_OUTPUT_DIR = $BuildOutputDir
    & npm test
    if ($LASTEXITCODE -ne 0) {
        throw "npm test failed with exit code $LASTEXITCODE."
    }
}
finally {
    if ($HadBuildOutputDir) { $env:SATURNO_SPB_BUILD_OUTPUT_DIR = $PreviousBuildOutputDir }
    else { Remove-Item Env:\SATURNO_SPB_BUILD_OUTPUT_DIR -ErrorAction SilentlyContinue }
}
