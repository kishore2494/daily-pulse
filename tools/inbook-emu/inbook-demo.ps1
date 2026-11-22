# Drives build 123 on the inbook emulator and records the Play foreground-service demo.
# Usage: powershell -File android-emu-demo.ps1 [install]   -> writes $HOME\daylog-demo.mp4
param([switch]$Install)
$ErrorActionPreference = 'Continue'
$adb = "$env:USERPROFILE\android-sdk\platform-tools\adb.exe"
$pkg = 'io.github.kishore2494.dailypulse'
function Step($m) { Write-Output ("[{0}] {1}" -f (Get-Date -Format 'mm:ss'), $m) }
function A { & $adb -e @args 2>&1 }
function Nodes {
  A shell "timeout 20 uiautomator dump /sdcard/ui.xml" | Out-Null
  A pull /sdcard/ui.xml "$env:TEMP\ui.xml" | Out-Null
  try { [xml]$x = Get-Content "$env:TEMP\ui.xml" -Raw } catch { return @() }
  $out = @()
  foreach ($n in $x.SelectNodes('//node')) {
    $t = "$($n.text) $($n.'content-desc')".Trim(); if (-not $t) { continue }
    if ($n.bounds -match '\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]') {
      $x1=[int]$matches[1];$y1=[int]$matches[2];$x2=[int]$matches[3];$y2=[int]$matches[4]
      if (($x2-$x1) -lt 4 -or ($y2-$y1) -lt 4) { continue }
      $out += [pscustomobject]@{ label=$t; x=[int](($x1+$x2)/2); y=[int](($y1+$y2)/2) }
    }
  }
  return $out
}
function Find($label) { Nodes | Where-Object { $_.label -like "*$label*" } | Select-Object -First 1 }
function WaitVis($label, $secs) {
  $end = (Get-Date).AddSeconds($secs)
  while ((Get-Date) -lt $end) { $n = Find $label; if ($n) { return $n }; Start-Sleep 2 }
  return $null
}
function WaitTap($label, $secs) {
  $n = WaitVis $label $secs
  if (-not $n) { Step "NOT VISIBLE after ${secs}s: $label"; return $false }
  A shell input tap $n.x $n.y | Out-Null; Step "tapped '$label' at $($n.x),$($n.y)"; return $true
}

if ($Install) {
  Step "install"; A install -r "$env:USERPROFILE\Daylog-123.apk" | Select-Object -Last 1
  A shell pm grant $pkg android.permission.RECORD_AUDIO | Out-Null
  A shell pm grant $pkg android.permission.POST_NOTIFICATIONS | Out-Null
}
A shell "svc power stayon true; settings put system screen_off_timeout 1800000; settings put global hide_error_dialogs 1" | Out-Null
A shell am start -n "$pkg/.MainActivity" | Out-Null; Start-Sleep 8

# first-run welcome (two pages), then make sure the Log screen is there
if (WaitVis 'Get started' 25) { WaitTap 'Get started' 10 | Out-Null; Start-Sleep 3; WaitTap 'Start logging' 30 | Out-Null; Start-Sleep 4 }
if (-not (WaitVis 'Menu' 40)) { Step 'ABORT: Log screen never appeared'; exit 1 }
if (WaitVis 'Skip tour' 5) { WaitTap 'Skip tour' 5 | Out-Null; Start-Sleep 3 }

# get to the Recordings screen before the recording starts
if (-not (WaitVis 'Start recording' 3)) {
  WaitTap 'Menu' 10 | Out-Null; Start-Sleep 2
  if (-not (WaitTap 'Recordings' 30)) { Step 'ABORT: no Recordings item'; exit 1 }
  Start-Sleep 3
  if (-not (WaitVis 'Start recording' 30)) { Step 'ABORT: no Start recording button'; exit 1 }
}

A shell rm -f /sdcard/demo.mp4 | Out-Null
Step 'screenrecord start'
$rec = Start-Process -FilePath $adb -ArgumentList '-e','shell','screenrecord','--time-limit','120','--bit-rate','6000000','/sdcard/demo.mp4' -NoNewWindow -PassThru
Start-Sleep 3
WaitTap 'Start recording' 20 | Out-Null;             Start-Sleep 9
Step 'shade (timer)'; A shell cmd statusbar expand-notifications | Out-Null; Start-Sleep 5
A shell cmd statusbar collapse | Out-Null;           Start-Sleep 2
Step 'Home'; A shell input keyevent KEYCODE_HOME | Out-Null; Start-Sleep 4
A shell cmd statusbar expand-notifications | Out-Null; Start-Sleep 3
$ex = Nodes | Where-Object { $_.label -like '*Expand*' } | Sort-Object y | Select-Object -Last 1
if ($ex) { A shell input tap $ex.x $ex.y | Out-Null; Step "expanded notification at $($ex.x),$($ex.y)"; Start-Sleep 3 }
WaitTap 'Pause' 20;                                  Start-Sleep 6
WaitTap 'Resume' 20;                                 Start-Sleep 6
A shell cmd statusbar collapse | Out-Null;           Start-Sleep 2
Step 'back to Daylog'; A shell am start -n "$pkg/.MainActivity" | Out-Null; Start-Sleep 5
WaitTap 'Stop and save' 30 | Out-Null;               Start-Sleep 8
Step 'end'
A shell pkill -INT screenrecord | Out-Null; Start-Sleep 4
try { Wait-Process -Id $rec.Id -Timeout 20 } catch {}
A pull /sdcard/demo.mp4 "$env:USERPROFILE\daylog-demo.mp4" | Out-Null
Step ("video bytes: " + (Get-Item "$env:USERPROFILE\daylog-demo.mp4" -ErrorAction SilentlyContinue).Length)
