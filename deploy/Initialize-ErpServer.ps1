<#
.SYNOPSIS
  One-time setup of a server for Integrated ERP: folders and permissions, the IIS app pool and HTTPS site,
  the database and its login, and the server's settings file. Safe to run again (it skips what exists).

.DESCRIPTION
  Run as administrator in Windows PowerShell 5.1, after installing:
    - IIS (already on the server) and the ASP.NET Core Hosting Bundle for .NET 10
    - SQL Server (on this server)
  Then deploy with Deploy-Erp.ps1.

  Layout (under -Root, default C:\IntegratedErp):
    app\        the running release (IIS site folder)
    releases\   previous releases (for rollback)
    config\     appsettings.Server.json and secrets.dat (only administrators and the app can read it)
    keys\       cookie / MFA encryption keys (only administrators and the app)
    logs\       daily log files
    files\      attachments

.EXAMPLE
  cd C:\Integrated-ERP-CRM\deploy
  .\Initialize-ErpServer.ps1
#>
[CmdletBinding()]
param(
    [string] $HostName = 'newcrm.jrco.local',
    # Internal test port first; the old system stays live on port 80.
    [int] $Port = 8003,
    [string] $SiteName = 'IntegratedErp',
    [string] $Root = 'C:\IntegratedErp',
    [string] $SqlServer = '.',
    [string] $Database = 'IntegratedErp',
    [string] $CertificateThumbprint,
    [string] $CertificateTemplate = 'WebServer',
    [string] $CompanyCode = 'carepro',
    [string] $CompanyNameAr = 'كير برو',
    [string] $CompanyNameEn = 'CarePro',
    [string[]] $Administrators = @('carepro')
)

$ErrorActionPreference = 'Stop'

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ok($text) { Write-Host "   OK  $text" -ForegroundColor Green }
function Note($text) { Write-Host "   ..  $text" -ForegroundColor Yellow }

# ---------------------------------------------------------------- Checks
Step 'Checking prerequisites'
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this script in PowerShell as administrator.'
}
if (-not (Test-Path "$env:ProgramFiles\IIS\Asp.Net Core Module\V2\aspnetcorev2.dll")) {
    throw 'The ASP.NET Core Hosting Bundle (.NET 10) is not installed. Install it, run iisreset, then run this script again.'
}
Ok 'ASP.NET Core Module for IIS'
Import-Module WebAdministration
& sqlcmd -S $SqlServer -E -b -Q "SET NOCOUNT ON; SELECT 1" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Cannot connect to SQL Server '$SqlServer' with Windows authentication." }
Ok "SQL Server '$SqlServer'"

$poolIdentity = "IIS AppPool\$SiteName"

# ---------------------------------------------------------------- Folders
Step 'Folders and permissions'
foreach ($name in 'app', 'releases', 'config', 'keys', 'logs', 'files') {
    New-Item -ItemType Directory -Force -Path (Join-Path $Root $name) | Out-Null
}
Ok $Root

# ---------------------------------------------------------------- App pool (before permissions: its identity must exist)
Step 'IIS application pool'
if (-not (Test-Path "IIS:\AppPools\$SiteName")) {
    New-WebAppPool -Name $SiteName | Out-Null
    Ok "Created pool $SiteName"
} else {
    Ok "Pool $SiteName exists"
}
$pool = "IIS:\AppPools\$SiteName"
Set-ItemProperty $pool -Name managedRuntimeVersion -Value ''
Set-ItemProperty $pool -Name startMode -Value 'AlwaysRunning'
Set-ItemProperty $pool -Name processModel.idleTimeout -Value ([TimeSpan]::Zero)
Set-ItemProperty $pool -Name processModel.loadUserProfile -Value $true
Set-ItemProperty $pool -Name recycling.periodicRestart.time -Value ([TimeSpan]::Zero)

# Environment of the app: where its settings and secrets are, and that it runs as Production.
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
Ok 'Pool settings: no managed code, always running, environment variables'

# Permissions: config and keys readable only by administrators, SYSTEM and the app.
& icacls (Join-Path $Root 'app') /grant "${poolIdentity}:(OI)(CI)RX" | Out-Null
foreach ($name in 'config', 'keys') {
    $path = Join-Path $Root $name
    & icacls $path /inheritance:r /grant:r 'SYSTEM:(OI)(CI)F' 'Administrators:(OI)(CI)F' | Out-Null
    $access = if ($name -eq 'keys') { 'M' } else { 'RX' }
    & icacls $path /grant "${poolIdentity}:(OI)(CI)$access" | Out-Null
}
foreach ($name in 'logs', 'files') {
    & icacls (Join-Path $Root $name) /grant "${poolIdentity}:(OI)(CI)M" | Out-Null
}
Ok "Permissions for $poolIdentity"

# ---------------------------------------------------------------- Certificate
Step "HTTPS certificate for $HostName"
$certificate = $null
if ($CertificateThumbprint) {
    $certificate = Get-Item "Cert:\LocalMachine\My\$CertificateThumbprint"
} else {
    $certificate = Get-ChildItem Cert:\LocalMachine\My |
        Where-Object { $_.NotAfter -gt (Get-Date).AddDays(30) -and ($_.DnsNameList | Where-Object { $_.Unicode -eq $HostName }) } |
        Sort-Object NotAfter -Descending | Select-Object -First 1
    if (-not $certificate) {
        Note "Requesting a certificate from the domain CA (template '$CertificateTemplate')..."
        $request = Get-Certificate -Template $CertificateTemplate -DnsName $HostName, $env:COMPUTERNAME -SubjectName "CN=$HostName" -CertStoreLocation Cert:\LocalMachine\My
        $certificate = $request.Certificate
    }
}
Ok "$($certificate.Subject) until $($certificate.NotAfter.ToString('yyyy-MM-dd')) ($($certificate.Thumbprint))"

# ---------------------------------------------------------------- Site
Step "IIS site https://${HostName}:$Port"
if (-not (Get-Website -Name $SiteName)) {
    New-Website -Name $SiteName -PhysicalPath (Join-Path $Root 'app') -ApplicationPool $SiteName -HostHeader $HostName -Port $Port -Ssl -SslFlags 1 | Out-Null
    Ok "Created site $SiteName"
} else {
    Ok "Site $SiteName exists"
}
# One HTTPS binding on the chosen port (moving the site to another port later = run again with -Port).
Get-WebBinding -Name $SiteName -Protocol https | Where-Object { $_.bindingInformation -ne "*:${Port}:$HostName" } | Remove-WebBinding
if (-not (Get-WebBinding -Name $SiteName -Protocol https -Port $Port -HostHeader $HostName)) {
    New-WebBinding -Name $SiteName -Protocol https -Port $Port -HostHeader $HostName -SslFlags 1
}
$binding = Get-WebBinding -Name $SiteName -Protocol https -Port $Port -HostHeader $HostName
$binding.AddSslCertificate($certificate.Thumbprint, 'My')
Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationDefaults.preloadEnabled -Value $true
Ok 'Certificate bound'
$rule = Get-NetFirewallRule -DisplayName 'Integrated ERP (HTTPS)' -ErrorAction SilentlyContinue
if ($rule) {
    $rule | Set-NetFirewallRule -LocalPort $Port
} else {
    New-NetFirewallRule -DisplayName 'Integrated ERP (HTTPS)' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Domain | Out-Null
}
Ok "Firewall: HTTPS ($Port) open on the domain network"

# ---------------------------------------------------------------- Database
Step "Database $Database on $SqlServer"
$sql = @"
SET NOCOUNT ON;
IF DB_ID(N'$Database') IS NULL CREATE DATABASE [$Database];
IF SUSER_ID(N'$poolIdentity') IS NULL CREATE LOGIN [$poolIdentity] FROM WINDOWS;
"@
& sqlcmd -S $SqlServer -E -b -Q $sql
if ($LASTEXITCODE -ne 0) { throw 'Creating the database or the login failed.' }
$sql = @"
SET NOCOUNT ON;
IF USER_ID(N'$poolIdentity') IS NULL CREATE USER [$poolIdentity] FOR LOGIN [$poolIdentity];
ALTER ROLE db_datareader ADD MEMBER [$poolIdentity];
ALTER ROLE db_datawriter ADD MEMBER [$poolIdentity];
"@
& sqlcmd -S $SqlServer -E -b -d $Database -Q $sql
if ($LASTEXITCODE -ne 0) { throw 'Granting the app access to the database failed.' }
Ok "The app reads and writes data; schema changes are made by Deploy-Erp.ps1 as administrator"

# ---------------------------------------------------------------- Server settings
Step 'Server settings'
$settingsPath = $variables['ERP_CONFIG_FILE']
if (-not (Test-Path $settingsPath)) {
    $settings = [ordered]@{
        ConnectionStrings = [ordered]@{
            Erp = "Server=$SqlServer;Database=$Database;Integrated Security=true;TrustServerCertificate=true"
        }
        Identity = [ordered]@{
            Ldap = [ordered]@{ Server = 'AD.JRCO.LOCAL'; Port = 636; UseSsl = $true; BaseDn = 'DC=JRCO,DC=LOCAL' }
            DirectoryProvider = 'ad-jrco'
            BootstrapTenantCode = $CompanyCode
            BootstrapAdmins = $Administrators
        }
        CrmSync = [ordered]@{
            # The app pool reaches SQLCRM as the computer account (JRCO\$env:COMPUTERNAME$), which needs db_datareader only.
            ConnectionString = 'Server=SQLCRM;Database=Care_Pro_MSCRM;Integrated Security=true;TrustServerCertificate=true;ApplicationIntent=ReadOnly'
            Company = $CompanyCode
            IntervalMinutes = 60
        }
        Email = [ordered]@{ Host = ''; FromAddress = '' }
        # The company the first administrators join; created by Deploy-Erp.ps1 if missing.
        Setup = [ordered]@{ CompanyCode = $CompanyCode; CompanyNameAr = $CompanyNameAr; CompanyNameEn = $CompanyNameEn }
    }
    $settings | ConvertTo-Json -Depth 5 | Set-Content -Path $settingsPath -Encoding UTF8
    Ok "Created $settingsPath (edit it for this server; it is never overwritten by a deploy)"
} else {
    Ok "$settingsPath exists (left as it is)"
}

Step 'Done. Next:'
Write-Host @"
   1. Store the AD bind account (encrypted, readable on this machine only):
        `$env:ERP_SECRETS_FILE = '$($variables['ERP_SECRETS_FILE'])'
        C:\Integrated-ERP-CRM\tools\Set-ErpSecret.ps1 -Name Identity:Ldap:BindUser -Scope LocalMachine
        C:\Integrated-ERP-CRM\tools\Set-ErpSecret.ps1 -Name Identity:Ldap:BindPassword -Secret -Scope LocalMachine
   2. On SQLCRM, give the login JRCO\$env:COMPUTERNAME`$ the role db_datareader on Care_Pro_MSCRM (read only).
   3. Make sure the AD account(s) $($Administrators -join ', ') exist: the first sign-in makes them administrators.
   4. Deploy:  C:\Integrated-ERP-CRM\deploy\Deploy-Erp.ps1
"@
