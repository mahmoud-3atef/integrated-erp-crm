<#
.SYNOPSIS
  A separate TEST copy of Integrated ERP on IIS, served on http://localhost:80 for the cloudflared tunnel
  (crm.carepro-crm.live -> http://localhost:80): its own site, app pool, database (a copy of the live one), folders and
  keys. -Remove takes the site off again (so port 80 can go back to the old system).

.DESCRIPTION
  Run as administrator in Windows PowerShell 5.1, on the server where Initialize-ErpServer.ps1 already set up the live
  site (IntegratedErp, https://newcrm.jrco.local:8003). The live site, its database and its files are only read.

  What it does:
    1. Checks that port 80 is free (stop the old system's site first if it uses it).
    2. Folders C:\IntegratedErpTest\{app,releases,config,keys,logs,files} and the app pool IntegratedErpTest.
    3. The site: HTTP on port 80. No firewall port is opened: the tunnel reaches it from this machine, and Cloudflare
       serves HTTPS to the browser (the session cookie is HTTPS-only, which is why the site is used through the tunnel).
    4. The database IntegratedErp_Test: a COPY_ONLY backup of IntegratedErp restored under the new name (the live
       backups are not affected). -RefreshData copies it again.
    5. Its settings: the live settings with this database, its own folders, no CRM sync, no e-mails, no daily digest,
       and two-step verification ON (the site faces the internet; -NoMfa turns it off). The AD bind account is copied.
    6. Deploys the current code with Deploy-Erp.ps1 (migrations included).

  Sign-in: the domain accounts, as on the live site, then the authenticator code (enrolled on the first sign-in: the
  test copy has its own keys, so its sessions and the live ones never mix).

.EXAMPLE
  cd C:\Integrated-ERP-CRM
  .\deploy\New-ErpTestSite.ps1
  .\deploy\New-ErpTestSite.ps1 -RefreshData      # a fresh copy of the live data
  .\deploy\New-ErpTestSite.ps1 -Remove           # take the test site off (frees port 80)
#>
[CmdletBinding()]
param(
    [string] $SiteName = 'IntegratedErpTest',
    [string] $Root = 'C:\IntegratedErpTest',
    [string] $Database = 'IntegratedErp_Test',
    [string] $SourceSite = 'IntegratedErp',
    [string] $SourceRoot = 'C:\IntegratedErp',
    [string] $SourceDatabase = 'IntegratedErp',
    [string] $SqlServer = '.',
    [int] $HttpPort = 80,
    # The address people open (the tunnel's), shown at the end.
    [string] $PublicUrl = 'https://crm.carepro-crm.live',
    [switch] $NoMfa,
    [switch] $RefreshData,
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'
$firewallRule = 'Integrated ERP Test (HTTP, HTTPS)'  # created by an earlier version of this script; removed if present

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "   OK  $text" -ForegroundColor Green }
function Note($text) { Write-Host "   ..  $text" -ForegroundColor Yellow }
function Sql($query, $database = 'master') {
    & sqlcmd -S $SqlServer -E -b -d $database -Q $query
    if ($LASTEXITCODE -ne 0) { throw "SQL failed: $query" }
}

$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in PowerShell as administrator.'
}
Import-Module WebAdministration
$poolIdentity = "IIS AppPool\$SiteName"

# ---------------------------------------------------------------- Remove
if ($Remove) {
    Step "Removing the test site $SiteName"
    if (Get-Website -Name $SiteName) {
        Stop-Website -Name $SiteName -ErrorAction SilentlyContinue
        Remove-Website -Name $SiteName
        Ok "Site removed (port $HttpPort is free)"
    }
    if (Test-Path "IIS:\AppPools\$SiteName") {
        Remove-WebAppPool -Name $SiteName
        Ok 'App pool removed'
    }
    Get-NetFirewallRule -DisplayName $firewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    Ok 'Firewall rule removed'
    Note "Kept: the database $Database and the folder $Root (drop / delete them by hand when no longer needed)."
    return
}

# ---------------------------------------------------------------- Checks
Step 'Checking'
if (-not (Get-Website -Name $SourceSite)) { throw "The live site $SourceSite is not on this server." }
if (-not (Test-Path "$env:ProgramFiles\IIS\Asp.Net Core Module\V2\aspnetcorev2.dll")) { throw 'The ASP.NET Core Hosting Bundle is not installed.' }
foreach ($port in @($HttpPort)) {
    $taken = Get-WebBinding | Where-Object { $_.bindingInformation -match ":${port}:" -and $_.ItemXPath -notmatch "@name='$SiteName'" }
    if ($taken) {
        $owner = ($taken | ForEach-Object { ($_.ItemXPath -split "'")[1] }) -join ', '
        throw "Port $port is used by the IIS site(s): $owner. Stop it / remove that binding first (e.g. the old system on port 80)."
    }
}
& sqlcmd -S $SqlServer -E -b -Q "SET NOCOUNT ON; SELECT 1" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Cannot connect to SQL Server '$SqlServer'." }
Ok "Port $HttpPort is free; SQL Server '$SqlServer'"

# ---------------------------------------------------------------- Folders and app pool
Step 'Folders, app pool and permissions'
foreach ($name in 'app', 'releases', 'config', 'keys', 'logs', 'files') {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $name) | Out-Null
}
if (-not (Test-Path "IIS:\AppPools\$SiteName")) { New-WebAppPool -Name $SiteName | Out-Null }
$pool = "IIS:\AppPools\$SiteName"
Set-ItemProperty $pool -Name managedRuntimeVersion -Value ''
Set-ItemProperty $pool -Name startMode -Value 'AlwaysRunning'
Set-ItemProperty $pool -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty $pool -Name processModel.loadUserProfile -Value $true
$variables = [ordered]@{
    ASPNETCORE_ENVIRONMENT = 'Production'
    ERP_CONFIG_FILE        = (Join-Path $Root 'config\appsettings.Server.json')
    ERP_SECRETS_FILE       = (Join-Path $Root 'config\secrets.dat')
}
$filter = "system.applicationHost/applicationPools/add[@name='$SiteName']/environmentVariables"
foreach ($name in $variables.Keys) {
    Remove-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter $filter -Name '.' -AtElement @{ name = $name } -ErrorAction SilentlyContinue -WarningAction SilentlyContinue
    Add-WebConfigurationProperty -PSPath 'MACHINE/WEBROOT/APPHOST' -Filter $filter -Name '.' -Value @{ name = $name; value = $variables[$name] }
}
& icacls (Join-Path $Root 'app') /grant "${poolIdentity}:(OI)(CI)RX" | Out-Null
foreach ($name in 'config', 'keys') {
    $path = Join-Path $Root $name
    & icacls $path /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    $access = if ($name -eq 'keys') { 'M' } else { 'RX' }
    & icacls $path /grant "${poolIdentity}:(OI)(CI)$access" | Out-Null
}
foreach ($name in 'logs', 'files') { & icacls (Join-Path $Root $name) /grant "${poolIdentity}:(OI)(CI)M" | Out-Null }
Ok "$Root and the pool $SiteName (Production)"

# ---------------------------------------------------------------- Site: HTTP on port 80, for the tunnel
Step "IIS site http://localhost:$HttpPort"
if (-not (Get-Website -Name $SiteName)) {
    New-Website -Name $SiteName -PhysicalPath (Join-Path $Root 'app') -ApplicationPool $SiteName -Port $HttpPort | Out-Null
}
Get-WebBinding -Name $SiteName | Remove-WebBinding
New-WebBinding -Name $SiteName -Protocol http -Port $HttpPort -IPAddress '*'
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationDefaults.preloadEnabled -Value $true
Get-NetFirewallRule -DisplayName $firewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Ok "Binding http:$HttpPort (no firewall port opened: the tunnel connects from this machine)"

# ---------------------------------------------------------------- Database: a copy of the live one
Step "Database $Database (a copy of $SourceDatabase)"
$exists = (& sqlcmd -S $SqlServer -E -h -1 -W -Q "SET NOCOUNT ON; SELECT CASE WHEN DB_ID(N'$Database') IS NULL THEN 0 ELSE 1 END").Trim()
if ($exists -eq '1' -and $RefreshData) {
    Stop-WebAppPool -Name $SiteName -ErrorAction SilentlyContinue
    Sql "ALTER DATABASE [$Database] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [$Database];"
    $exists = '0'
}
if ($exists -ne '1') {
    $backupDir = (& sqlcmd -S $SqlServer -E -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultBackupPath') AS nvarchar(400))").Trim()
    $dataDir = (& sqlcmd -S $SqlServer -E -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultDataPath') AS nvarchar(400))").Trim()
    $logDir = (& sqlcmd -S $SqlServer -E -h -1 -W -Q "SET NOCOUNT ON; SELECT CAST(SERVERPROPERTY('InstanceDefaultLogPath') AS nvarchar(400))").Trim()
    $file = Join-Path $backupDir "$SourceDatabase-for-test.bak"
    Sql "BACKUP DATABASE [$SourceDatabase] TO DISK = N'$file' WITH COPY_ONLY, INIT;"
    $files = & sqlcmd -S $SqlServer -E -h -1 -W -s '|' -Q "SET NOCOUNT ON; RESTORE FILELISTONLY FROM DISK = N'$file'"
    $moves = foreach ($line in $files | Where-Object { $_ -match '\|' }) {
        $parts = $line -split '\|'
        $logical = $parts[0].Trim()
        $isLog = $parts[2].Trim() -eq 'L'
        $target = if ($isLog) { Join-Path $logDir "${Database}_$logical.ldf" } else { Join-Path $dataDir "${Database}_$logical.mdf" }
        "MOVE N'$logical' TO N'$target'"
    }
    Sql "RESTORE DATABASE [$Database] FROM DISK = N'$file' WITH $($moves -join ', '), RECOVERY;"
    Remove-Item $file -ErrorAction SilentlyContinue
    Ok "Restored from a copy-only backup of $SourceDatabase"
} else {
    Ok "$Database exists (kept; -RefreshData copies the live data again)"
}
Sql "IF SUSER_ID(N'$poolIdentity') IS NULL CREATE LOGIN [$poolIdentity] FROM WINDOWS;"
Sql "IF USER_ID(N'$poolIdentity') IS NULL CREATE USER [$poolIdentity] FOR LOGIN [$poolIdentity]; ALTER ROLE db_datareader ADD MEMBER [$poolIdentity]; ALTER ROLE db_datawriter ADD MEMBER [$poolIdentity];" $Database
Ok "The pool $SiteName reads and writes $Database"

# ---------------------------------------------------------------- Files: the live attachments, copied once
Step 'Attachments'
$liveFiles = Join-Path $SourceRoot 'files'
if ((Test-Path $liveFiles) -and -not (Get-ChildItem (Join-Path $Root 'files') -Force | Select-Object -First 1)) {
    & robocopy $liveFiles (Join-Path $Root 'files') /E /NFL /NDL /NJH /NJS /NP | Out-Null
    Ok "Copied from $liveFiles"
} else {
    Ok 'Kept as they are'
}

# ---------------------------------------------------------------- Settings
Step 'Settings'
$settingsPath = $variables['ERP_CONFIG_FILE']
$live = Get-Content (Join-Path $SourceRoot 'config\appsettings.Server.json') -Raw | ConvertFrom-Json
$live.ConnectionStrings.Erp = "Server=$SqlServer;Database=$Database;Integrated Security=true;TrustServerCertificate=true"
# Sets one value in a section of the settings, keeping the section's other values.
function Set-Value($object, $section, $name, $value) {
    if (-not $object.PSObject.Properties[$section]) { $object | Add-Member -NotePropertyName $section -NotePropertyValue ([pscustomobject]@{}) }
    $target = $object.$section
    if ($target.PSObject.Properties[$name]) { $target.$name = $value } else { $target | Add-Member -NotePropertyName $name -NotePropertyValue $value }
}
# No CRM sync (the copy keeps the data it was copied with), no e-mails, no daily digest.
Set-Value $live 'CrmSync' 'ConnectionString' ''
Set-Value $live 'Email' 'Host' ''
Set-Value $live 'Email' 'FromAddress' ''
Set-Value $live 'Alerts' 'DigestHour' -1
# Its own folders, and HTTP sent to HTTPS.
Set-Value $live 'Platform' 'KeysPath' (Join-Path $Root 'keys')
Set-Value $live 'Platform' 'KeysMachineScope' $true
# Two-step verification: on unless -NoMfa (the copy faces the internet through the tunnel).
Set-Value $live 'Identity' 'MfaRequired' (-not $NoMfa)
Set-Value $live 'Storage' 'Root' (Join-Path $Root 'files')
Set-Value $live 'Serilog' 'WriteTo' @([pscustomobject]@{ Name = 'File'; Args = [pscustomobject]@{ path = (Join-Path $Root 'logs\erp-.log'); rollingInterval = 'Day'; retainedFileCountLimit = 30; shared = $true } })
$live | ConvertTo-Json -Depth 8 | Set-Content -Path $settingsPath -Encoding UTF8
Copy-Item (Join-Path $SourceRoot 'config\secrets.dat') $variables['ERP_SECRETS_FILE'] -Force -ErrorAction SilentlyContinue
Ok "$settingsPath (from the live settings: $Database, no sync, no e-mails)"

# ---------------------------------------------------------------- Deploy the current code
Step 'Deploying the current code'
& (Join-Path $PSScriptRoot 'Deploy-Erp.ps1') -SiteName $SiteName -Root $Root -Url "http://localhost:$HttpPort" -SkipTests
Start-Website -Name $SiteName -ErrorAction SilentlyContinue

Step 'Done'
Write-Host @"
   On this machine:          http://localhost:$HttpPort
   From outside (tunnel):    $PublicUrl   (cloudflared: $PublicUrl -> http://localhost:$HttpPort)
   Sign in with your domain account, then the authenticator code$(if ($NoMfa) { ' (off: -NoMfa)' } else { ' (enrolled on the first sign-in)' }).
   Later updates of the test copy:   .\deploy\Deploy-Erp.ps1 -SiteName $SiteName -Root $Root -Url http://localhost:$HttpPort -SkipTests
   Give port 80 back to the old system:   .\deploy\New-ErpTestSite.ps1 -Remove   (then start the old site)
"@
