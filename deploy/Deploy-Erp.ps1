<#
.SYNOPSIS
  Builds and deploys Integrated ERP to this server's IIS site in one command, or rolls back to the previous release.

.DESCRIPTION
  Run as administrator in Windows PowerShell 5.1, after Initialize-ErpServer.ps1.
    1. Runs the tests (skip with -SkipTests), builds the web app and publishes the server (Release).
    2. Takes the site offline (app_offline.htm) and stops its app pool.
    3. Updates the database (migrate) and makes sure the company exists (create-company).
    4. Copies the release into the site folder, starts the pool and checks /health.
  Each release is kept under releases\ (the last 5); -Rollback puts the previous one back.
  A rollback does not undo database changes: migrations only add, so the previous release keeps working.

.EXAMPLE
  C:\Integrated-ERP-CRM\deploy\Deploy-Erp.ps1
  C:\Integrated-ERP-CRM\deploy\Deploy-Erp.ps1 -SkipTests
  C:\Integrated-ERP-CRM\deploy\Deploy-Erp.ps1 -Rollback
#>
[CmdletBinding()]
param(
    [string] $HostName = 'newcrm.jrco.local',
    [int] $Port = 8003,
    [string] $SiteName = 'IntegratedErp',
    [string] $Root = 'C:\IntegratedErp',
    # The address /health is checked on (default https://<HostName>:<Port>), e.g. http://localhost for a site behind a tunnel.
    [string] $Url,
    [switch] $SkipTests,
    [switch] $Rollback,
    [int] $KeepReleases = 5
)

$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$app = Join-Path $Root 'app'
$releases = Join-Path $Root 'releases'
$currentFile = Join-Path $releases 'current.txt'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "   OK  $text" -ForegroundColor Green }
function Run($file, [string[]] $arguments, $where) {
    Push-Location $where
    try {
        & $file @arguments
        if ($LASTEXITCODE -ne 0) { throw "$file $($arguments -join ' ') failed (exit code $LASTEXITCODE)." }
    } finally {
        Pop-Location
    }
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in PowerShell as administrator.'
}
Import-Module WebAdministration
if (-not (Test-Path "IIS:\Sites\$SiteName")) { throw "Site $SiteName does not exist: run Initialize-ErpServer.ps1 first." }

# The app's own environment, for the migrate / create-company commands run from here.
$env:ASPNETCORE_ENVIRONMENT = 'Production'
$env:ERP_CONFIG_FILE = Join-Path $Root 'config\appsettings.Server.json'
$env:ERP_SECRETS_FILE = Join-Path $Root 'config\secrets.dat'

$current = if (Test-Path $currentFile) { (Get-Content $currentFile -Raw).Trim() } else { '' }

# ---------------------------------------------------------------- Choose the release
if ($Rollback) {
    $previous = Get-ChildItem $releases -Directory | Where-Object { $_.Name -lt $current } | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $previous) { throw 'There is no earlier release to roll back to.' }
    $release = $previous.FullName
    Step "Rolling back from $current to $($previous.Name)"
} else {
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $release = Join-Path $releases $stamp
    # Only for the release label: a git problem (e.g. folder owned by another account) must not stop the deploy.
    $commit = (& cmd /c "git -C `"$repository`" rev-parse --short HEAD 2>nul")
    if (-not $commit) { $commit = 'unknown' }
    Step "Building release $stamp (commit $commit)"

    if (-not $SkipTests) {
        Run 'dotnet' @('test', '-c', 'Release', '-v', 'q') $repository
        Ok 'Server tests passed'
    }

    $web = Join-Path $repository 'src\Web'
    if (-not (Test-Path (Join-Path $web 'node_modules'))) { Run 'npm' @('ci') $web }
    if (-not $SkipTests) { Run 'npm' @('run', 'test') $web }
    Run 'npm' @('run', 'build') $web
    Ok 'Web app built'

    Run 'dotnet' @('publish', 'src\Hosts\IntegratedErp.Api', '-c', 'Release', '-o', $release, '-v', 'q') $repository
    # Development settings (test accounts) never go to a server.
    Remove-Item (Join-Path $release 'appsettings.Development.json') -ErrorAction SilentlyContinue
    Set-Content -Path (Join-Path $release 'release.txt') -Value "$stamp $commit" -Encoding ASCII
    Ok "Published to $release"
}

# ---------------------------------------------------------------- Take the site offline
Step 'Taking the site offline'
$offline = Join-Path $app 'app_offline.htm'
Set-Content -Path $offline -Encoding UTF8 -Value '<!doctype html><meta charset="utf-8"><title>Integrated ERP</title><p style="font-family:sans-serif;text-align:center;margin-top:20vh">The system is being updated and will be back in a few minutes.</p>'
if ((Get-WebAppPoolState -Name $SiteName).Value -ne 'Stopped') {
    Stop-WebAppPool -Name $SiteName
    $waited = 0
    while ((Get-WebAppPoolState -Name $SiteName).Value -ne 'Stopped' -and $waited -lt 60) { Start-Sleep -Seconds 1; $waited++ }
}
Ok 'Offline'

try {
    # ---------------------------------------------------------------- Database
    if (-not $Rollback) {
        Step 'Updating the database'
        Run 'dotnet' @((Join-Path $release 'IntegratedErp.Api.dll'), 'migrate') $release
        Run 'dotnet' @((Join-Path $release 'IntegratedErp.Api.dll'), 'create-company') $release
        Ok 'Database is up to date'
    }

    # ---------------------------------------------------------------- Copy
    Step 'Copying the release'
    & robocopy $release $app /MIR /XF app_offline.htm /NFL /NDL /NJH /NJS /NP | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "Copying the release failed (robocopy $LASTEXITCODE)." }
    Set-Content -Path $currentFile -Value (Split-Path $release -Leaf) -Encoding ASCII
    Ok "Site folder = $(Split-Path $release -Leaf)"
} finally {
    # ---------------------------------------------------------------- Back online
    Remove-Item $offline -ErrorAction SilentlyContinue
    Start-WebAppPool -Name $SiteName
}

# ---------------------------------------------------------------- Health
$url = if ($Url) { $Url.TrimEnd('/') } else { "https://${HostName}:$Port" }
Step "Checking $url/health"
$healthy = $false
for ($i = 0; $i -lt 10 -and -not $healthy; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "$url/health" -UseBasicParsing -TimeoutSec 30
        Write-Host "   $($response.Content)"
        $healthy = $response.StatusCode -eq 200
    } catch {
        Start-Sleep -Seconds 3
    }
}
if (-not $healthy) {
    Write-Host "   The site did not report healthy. See the logs in $Root\logs, or roll back with: Deploy-Erp.ps1 -Rollback" -ForegroundColor Red
    exit 1
}
Ok "$url is running"

# ---------------------------------------------------------------- Keep the last releases
Get-ChildItem $releases -Directory | Sort-Object Name -Descending | Select-Object -Skip $KeepReleases | Remove-Item -Recurse -Force
