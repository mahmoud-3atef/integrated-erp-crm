<#
.SYNOPSIS
  Stores a secret configuration value for IntegratedErp, encrypted with Windows DPAPI.

.DESCRIPTION
  Values are kept in %LOCALAPPDATA%\IntegratedErp\secrets.dat (or $env:ERP_SECRETS_FILE), encrypted
  so that only this Windows account (CurrentUser) - or this machine (LocalMachine) - can read them.
  Nothing is written to the project folder or to Git. Run it as the same Windows user that runs the app.

.EXAMPLE
  .\Set-ErpSecret.ps1 -Name Identity:Ldap:BindUser
  .\Set-ErpSecret.ps1 -Name Identity:Ldap:BindPassword -Secret
  .\Set-ErpSecret.ps1 -List
#>
param(
    [string] $Name,
    [switch] $Secret,
    [switch] $List,
    [switch] $Remove,
    [ValidateSet('CurrentUser', 'LocalMachine')] [string] $Scope = 'CurrentUser'
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security

$path = if ($env:ERP_SECRETS_FILE) { $env:ERP_SECRETS_FILE } else { Join-Path $env:LOCALAPPDATA 'IntegratedErp\secrets.dat' }
$entropy = [System.Text.Encoding]::UTF8.GetBytes('IntegratedErp.Secrets.v1')

function Read-Values {
    if (-not (Test-Path $path)) { return @{} }
    $bytes = [System.IO.File]::ReadAllBytes($path)
    try { $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, 'CurrentUser') }
    catch { $plain = [System.Security.Cryptography.ProtectedData]::Unprotect($bytes, $entropy, 'LocalMachine') }
    $json = [System.Text.Encoding]::UTF8.GetString($plain)
    $values = @{}
    ($json | ConvertFrom-Json).PSObject.Properties | ForEach-Object { $values[$_.Name] = $_.Value }
    return $values
}

$values = Read-Values

if ($List) {
    "Secrets file: $path"
    if ($values.Count -eq 0) { '(empty)' } else { $values.Keys | Sort-Object | ForEach-Object { " - $_" } }
    return
}

if (-not $Name) { throw 'Specify -Name (e.g. Identity:Ldap:BindPassword), or -List.' }

if ($Remove) {
    $values.Remove($Name)
} elseif ($Secret) {
    $secure = Read-Host -Prompt "Value for $Name (hidden)" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { $values[$Name] = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
} else {
    $values[$Name] = Read-Host -Prompt "Value for $Name"
}

$dir = Split-Path $path -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$json = $values | ConvertTo-Json -Compress
$protected = [System.Security.Cryptography.ProtectedData]::Protect([System.Text.Encoding]::UTF8.GetBytes($json), $entropy, $Scope)
[System.IO.File]::WriteAllBytes($path, $protected)
"Saved '$Name' to $path ($Scope scope). Keys stored: $($values.Count)"
