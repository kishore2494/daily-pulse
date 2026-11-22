$a = "$env:USERPROFILE\android-sdk\platform-tools\adb.exe"
$booted = $false
for ($i = 0; $i -lt 120; $i++) {
  $b = (& $a -e shell getprop sys.boot_completed 2>$null) -join ''
  if ($b -match '1') { Write-Output ("booted ~{0}s" -f ($i*4)); $booted = $true; break }
  Start-Sleep 4
}
if (-not $booted) { Write-Output 'BOOT TIMEOUT'; & $a devices; exit 1 }
Start-Sleep 20
for ($i = 0; $i -lt 15; $i++) {
  $p = (& $a -e shell "ping -c1 -W3 kishore2494.github.io" 2>$null) -join ' '
  if ($p -match 'bytes from') { Write-Output "net ok"; break }
  Start-Sleep 4
}
& powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\android-emu-demo.ps1" -Install
