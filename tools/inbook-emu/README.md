# Android emulator on inbook (Windows laptop), set up 2026-11-22

Everything lives under `C:\Users\gskee\android-sdk` (portable JDK 17, cmdline-tools, platform-tools, emulator,
`system-images;android-34;google_apis;x86_64`) with AVD **demo** (Pixel 6, 2 GB, 4 cores). WHPX acceleration
is on. The Mac's own emulator is unusable (8 GB RAM); use this one for anything that needs Android running.

- `inbook-setup.ps1` — idempotent install (copy to `~\android-emu-setup.ps1` on inbook and run it).
- Start, from the Mac, keeping the ssh session open in the background (the emulator dies when it closes):
  `ssh inbook "C:\Users\gskee\android-sdk\emulator\emulator.exe -avd demo -no-window -no-snapshot -no-boot-anim -gpu swiftshader_indirect -no-metrics -memory 2048 -cores 4"`
- `inbook-run.ps1` — waits for boot + network, then runs `inbook-demo.ps1 -Install`.
- `inbook-demo.ps1` — installs `~\Daylog-<n>.apk` (with `-Install`), walks the first-run pages, opens
  Recordings, records a demo with `screenrecord`, writes `~\daylog-demo.mp4`. Taps are found by label from
  `uiautomator dump`. Fetch results with `scp inbook:daylog-demo.mp4 .`.
- Screenshots: `adb shell screencap -p /sdcard/s.png; adb pull …` on inbook, then scp (never pipe binary through ssh).
