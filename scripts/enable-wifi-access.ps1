#Requires -RunAsAdministrator
$ErrorActionPreference = 'Stop'
$campusWifi = Get-NetIPConfiguration -InterfaceAlias 'Wi-Fi'
$campusAddress = $campusWifi.IPv4Address.IPAddress | Select-Object -First 1
if (-not $campusWifi.IPv4DefaultGateway -or -not $campusAddress) {
  throw 'Connect this PC to Wi-Fi before enabling CampusLink access.'
}
$campusRuleName = 'CampusLink-WiFi-3000'
$campusRule = Get-NetFirewallRule -Name $campusRuleName -ErrorAction SilentlyContinue
if ($campusRule) {
  $campusRule | Get-NetFirewallAddressFilter | Set-NetFirewallAddressFilter -LocalAddress $campusAddress -RemoteAddress LocalSubnet
  $campusRule | Enable-NetFirewallRule
} else {
  New-NetFirewallRule -Name $campusRuleName -DisplayName 'CampusLink on same Wi-Fi (3000)' `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000 `
    -LocalAddress $campusAddress -RemoteAddress LocalSubnet -InterfaceAlias 'Wi-Fi' `
    -Profile Public,Private -Program 'C:\Program Files\nodejs\node.exe' | Out-Null
}
Write-Output "Wi-Fi access enabled: http://${campusAddress}:3000"
Write-Output 'Keep CampusLink running and connect other devices to this same Wi-Fi.'
