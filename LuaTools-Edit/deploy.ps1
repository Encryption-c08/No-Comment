param(
    [string]$SourceDir = $PSScriptRoot,
    [string]$PluginsDir = 'C:\Program Files (x86)\Steam\plugins',
    [switch]$NoRestart
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path -LiteralPath $PluginsDir)) {
    throw "Steam plugins directory not found: $PluginsDir"
}

$buildScript = Join-Path $PSScriptRoot 'scripts\build_frontend.py'
if (Test-Path -LiteralPath $buildScript) {
    python $buildScript
    if ($LASTEXITCODE -ne 0) {
        throw "Frontend build failed with exit code $LASTEXITCODE"
    }
}

$resolvedSource = (Resolve-Path -LiteralPath $SourceDir).Path
$projectName = Split-Path -Leaf $resolvedSource
$targetDir = Join-Path $PluginsDir $projectName

if (Test-Path -LiteralPath $targetDir) {
    Remove-Item -LiteralPath $targetDir -Recurse -Force
}

New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
Get-ChildItem -LiteralPath $resolvedSource -Force | ForEach-Object {
    if ($_.Name -eq '.git') {
        return
    }
    Copy-Item -LiteralPath $_.FullName -Destination $targetDir -Recurse -Force
}

if (-not $NoRestart) {
    Get-Process -Name steam -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $steamExe = $null
    try {
        $steamPath = (Get-ItemProperty -Path 'HKCU:\Software\Valve\Steam' -Name 'SteamPath' -ErrorAction Stop).SteamPath
        if ($steamPath) {
            $candidate = Join-Path $steamPath 'Steam.exe'
            if (Test-Path -LiteralPath $candidate) {
                $steamExe = $candidate
            }
        }
    } catch {
    }

    if ($steamExe) {
        Start-Process -FilePath $steamExe -ArgumentList '-clearbeta'
    } else {
        Start-Process -FilePath 'steam.exe' -ArgumentList '-clearbeta'
    }
}

Write-Output "Deployed '$projectName' to '$targetDir'$(if ($NoRestart) { ' (no restart)' } else { '' })."
