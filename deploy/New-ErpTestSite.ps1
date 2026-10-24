<#
.SYNOPSIS
  A separate TEST copy of Integrated ERP on IIS, reachable from other machines: http://<server> (port 80) sends the
  browser to https://<server> (port 443). Its own site, app pool, database (a copy of the live one), folders and keys.
  -Remove takes the site off again (so port 80 can go back to the old system).

.DESCRIPTION
  Run as administrator in Windows PowerShell 5.1, on the server where Initialize-ErpServer.ps1 already set up the live
  site (IntegratedErp, https://newcrm.jrco.local:8003). The live site, its database and its files are only read.

  What it does:
    1. Checks that ports 80 and 443 are free (stop the old system's site first if it uses port 80).
    2. Folders C:\IntegratedErpTest\{app,releases,config,keys,logs,files} and the app pool IntegratedErpTest.
    3. The site: HTTPS on 443 with the live site's certificate (it names the server), HTTP on 80 (redirects to HTTPS),
       and a firewall rule for 80 and 443 on the domain network.
    4. The database IntegratedErp_Test: a COPY_ONLY backup of IntegratedErp restored under the new name (the live
       backups are not affected). -RefreshData copies it again.
    5. Its settings: the live settings with this database, its own folders, no CRM sync, no e-mails, no daily digest,
       and the HTTP-to-HTTPS address. The AD bind account is copied (secrets.dat).
    6. Deploys the current code with Deploy-Erp.ps1 (migrations included).

  Sign-in: the domain accounts, as on the live site. The test copy uses its own keys, so its sessions and the live
  ones never mix; two-step verification secrets of the live site do not carry over (enrol again if MFA is on).

.EXAMPLE
  cd C:\Integrated-ERP-CRM
  .\deploy\New-ErpTestSite.ps1
  .\deploy\New-ErpTestSite.ps1 -RefreshData      # a fresh copy of the live data
  .\deploy\New-ErpTestSite.ps1 -Remove           # take the test site off (frees ports 80 and 443)
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
    # The address users type: the server's short name, which the live certificate also names.
    [string] $HostName = $env:COMPUTERNAME.ToLowerInvariant(),
    [int] $HttpPort = 80,
    [int] $HttpsPort = 443,
    [switch] $RefreshData,
    [switch] $Remove
)

$ErrorActionPreference = 'Stop'
$firewallRule = 'Integrated ERP Test (HTTP, HTTPS)'

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
        Ok 'Site removed (ports 80 and 443 are free)'
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
foreach ($port in $HttpPort, $HttpsPort) {
    $taken = Get-WebBinding | Where-Object { $_.bindingInformation -match ":${port}:" -and $_.ItemXPath -notmatch "@name='$SiteName'" }
    if ($taken) {
        $owner = ($taken | ForEach-Object { ($_.ItemXPath -split "'")[1] }) -join ', '
        throw "Port $port is used by the IIS site(s): $owner. Stop it / remove that binding first (e.g. the old system on port 80)."
    }
}
& sqlcmd -S $SqlServer -E -b -Q "SET NOCOUNT ON; SELECT 1" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Cannot connect to SQL Server '$SqlServer'." }
Ok "Ports $HttpPort and $HttpsPort are free; SQL Server '$SqlServer'"

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

# ---------------------------------------------------------------- Site: HTTPS 443 + HTTP 80
Step "IIS site https://$HostName (and http://$HostName on port $HttpPort)"
$liveBinding = Get-WebBinding -Name $SourceSite -Protocol https | Select-Object -First 1
$thumbprint = $liveBinding.certificateHash
if (-not $thumbprint) { throw "The live site $SourceSite has no HTTPS certificate to reuse." }
$certificate = Get-Item "Cert:\LocalMachine\My\$thumbprint"
if (-not ($certificate.DnsNameList | Where-Object { $_.Unicode -ieq $HostName })) {
    Note "The certificate does not name '$HostName' (it names: $(($certificate.DnsNameList | ForEach-Object Unicode) -join ', ')). Browsers will warn; pass -HostName with one of those names."
}
if (-not (Get-Website -Name $SiteName)) {
    New-Website -Name $SiteName -PhysicalPath (Join-Path $Root 'app') -ApplicationPool $SiteName -Port $HttpsPort -Ssl | Out-Null
}
Get-WebBinding -Name $SiteName | Remove-WebBinding
New-WebBinding -Name $SiteName -Protocol https -Port $HttpsPort -IPAddress '*'
(Get-WebBinding -Name $SiteName -Protocol https -Port $HttpsPort).AddSslCertificate($thumbprint, 'My')
New-WebBinding -Name $SiteName -Protocol http -Port $HttpPort -IPAddress '*'
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationDefaults.preloadEnabled -Value $true
Get-NetFirewallRule -DisplayName $firewallRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $firewallRule -Direction Inbound -Protocol TCP -LocalPort $HttpPort, $HttpsPort -Action Allow -Profile Domain | Out-Null
Ok "Bindings https:$HttpsPort (certificate $thumbprint) and http:$HttpPort; firewall open on the domain network"

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
Set-Value $live 'Platform' 'HttpsAddress' "https://$HostName"
Set-Value $live 'Storage' 'Root' (Join-Path $Root 'files')
Set-Value $live 'Serilog' 'WriteTo' @([pscustomobject]@{ Name = 'File'; Args = [pscustomobject]@{ path = (Join-Path $Root 'logs\erp-.log'); rollingInterval = 'Day'; retainedFileCountLimit = 30; shared = $true } })
$live | ConvertTo-Json -Depth 8 | Set-Content -Path $settingsPath -Encoding UTF8
Copy-Item (Join-Path $SourceRoot 'config\secrets.dat') $variables['ERP_SECRETS_FILE'] -Force -ErrorAction SilentlyContinue
Ok "$settingsPath (from the live settings: $Database, no sync, no e-mails)"

# ---------------------------------------------------------------- Deploy the current code
Step 'Deploying the current code'
& (Join-Path $PSScriptRoot 'Deploy-Erp.ps1') -SiteName $SiteName -Root $Root -HostName $HostName -Port $HttpsPort -SkipTests
Start-Website -Name $SiteName -ErrorAction SilentlyContinue

Step 'Done'
Write-Host @"
   From another machine on the network:  http://$HostName   (it opens https://$HostName)
   Sign in with your domain account, as on the live site.
   Later updates of the test copy:   .\deploy\Deploy-Erp.ps1 -SiteName $SiteName -Root $Root -HostName $HostName -Port $HttpsPort -SkipTests
   Give port 80 back to the old system:   .\deploy\New-ErpTestSite.ps1 -Remove   (then start the old site)
"@
