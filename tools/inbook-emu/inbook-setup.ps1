# Android emulator setup on inbook (user-level, no admin). Idempotent: rerun after an interruption.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = "$env:USERPROFILE\android-sdk"
$dl = "$root\dl"
New-Item -ItemType Directory -Force -Path $root, $dl | Out-Null

# 1. portable JDK 17 (sdkmanager needs Java)
$jdk = Get-ChildItem "$root\jdk-17*" -Directory -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $jdk) {
  Write-Output "downloading JDK 17"
  & curl.exe -sSL -o "$dl\jdk17.zip" "https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse?project=jdk"
  Expand-Archive -Force "$dl\jdk17.zip" $root
  $jdk = Get-ChildItem "$root\jdk-17*" -Directory | Select-Object -First 1
}
$env:JAVA_HOME = $jdk.FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
Write-Output "java: $($jdk.Name)"

# 2. command-line tools
$sdkm = "$root\cmdline-tools\latest\bin\sdkmanager.bat"
if (-not (Test-Path $sdkm)) {
  Write-Output "downloading cmdline-tools"
  & curl.exe -sSL -o "$dl\clt.zip" "https://dl.google.com/android/repository/commandlinetools-win-11076708_latest.zip"
  if (Test-Path "$dl\clt") { Remove-Item -Recurse -Force "$dl\clt" }
  Expand-Archive -Force "$dl\clt.zip" "$dl\clt"
  New-Item -ItemType Directory -Force -Path "$root\cmdline-tools" | Out-Null
  Move-Item -Force "$dl\clt\cmdline-tools" "$root\cmdline-tools\latest"
}

# 3. licences + packages (the system image is ~1.1 GB)
$yes = ("y`n" * 15)
$yes | & $sdkm --sdk_root=$root --licenses 2>&1 | Out-Null
Write-Output "installing platform-tools, emulator, android-34 google_apis x86_64"
& $sdkm --sdk_root=$root "platform-tools" "emulator" "system-images;android-34;google_apis;x86_64" 2>&1 |
  Select-String -Pattern "Error|Failed|done" | Select-Object -Last 3

# 4. the AVD
$avdm = "$root\cmdline-tools\latest\bin\avdmanager.bat"
if (-not (Test-Path "$env:USERPROFILE\.android\avd\demo.avd")) {
  "no" | & $avdm create avd -n demo -k "system-images;android-34;google_apis;x86_64" -d pixel_6 2>&1 | Out-Null
}
$cfg = "$env:USERPROFILE\.android\avd\demo.avd\config.ini"
(Get-Content $cfg) -replace '^hw.ramSize=.*', 'hw.ramSize=2048' -replace '^hw.cpu.ncore=.*', 'hw.cpu.ncore=4' | Set-Content $cfg
if (-not (Select-String -Path $cfg -Pattern '^hw.cpu.ncore=' -Quiet)) { Add-Content $cfg 'hw.cpu.ncore=4' }
Write-Output "avd: $(Test-Path $cfg)"

# 5. acceleration status (WHPX needs the Windows feature + reboot)
& "$root\emulator\emulator.exe" -accel-check 2>&1 | Select-Object -Last 2
Write-Output "SETUP DONE"
