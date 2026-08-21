#!/usr/bin/env bash
# End-to-end alarm test on a real device. Verifies the three defects fixed in 109/69:
#   1. alarms are actually registered with AlarmManager (dumpsys proves it, not a toast)
#   2. BootReceiver re-registers them after a reboot broadcast
#   3. an alarm genuinely fires (logcat + screenshot)
# NEVER touches the cabled realme RMX3231 (serial 0461B081222138A5) — it is off-limits.
set -uo pipefail
export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
PKG=io.github.kishore2494.dailypulse
FORBIDDEN=0461B081222138A5
OUT="${1:-/tmp/alarm-test}"
mkdir -p "$OUT"

pick_device() {
  for D in $(adb devices | grep -v "^List" | grep -w device | awk '{print $1}'); do
    S=$(adb -s "$D" shell getprop ro.serialno 2>/dev/null | tr -d '\r')
    [ "$S" = "$FORBIDDEN" ] && continue
    echo "$D"; return 0
  done
  return 1
}

D=$(pick_device) || { echo "NO ELIGIBLE DEVICE (the cabled realme is excluded)"; exit 2; }
MODEL=$(adb -s "$D" shell getprop ro.product.model | tr -d '\r')
SDK=$(adb -s "$D" shell getprop ro.build.version.sdk | tr -d '\r')
echo "=== device: $D  $MODEL  (Android SDK $SDK) ==="

echo "--- 1. install 109/69 ---"
adb -s "$D" install -r "/Users/kishore/Documents/p/daily-pulse-app/store/assets/DailyPulse.apk" 2>&1 | tail -2
echo "installed versionCode: $(adb -s "$D" shell dumpsys package $PKG | grep -m1 versionCode | tr -d '\r')"

echo "--- 2. permission state the new code checks ---"
adb -s "$D" shell "dumpsys package $PKG | grep -A1 SCHEDULE_EXACT_ALARM" 2>/dev/null | head -4
echo "notifications enabled: $(adb -s "$D" shell "dumpsys notification | grep -m1 -A2 $PKG" 2>/dev/null | head -3 | tr -d '\r')"

echo "--- 3. set a reminder 90s out, straight into localStorage, then let the app schedule it ---"
adb -s "$D" shell am force-stop $PKG
T=$(python3 - <<'PY'
import datetime
t=datetime.datetime.now()+datetime.timedelta(seconds=100)
print(t.strftime('%H:%M'))
PY
)
echo "target time: $T"
adb -s "$D" shell monkey -p $PKG -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 16
# reminders live in the WebView's localStorage; there is no adb path into it, so this step
# is manual-assisted: the runner prints what to tap if automation is unavailable.
echo "    (if no reminder exists yet, add one at $T in Settings > Reminders, mode = alarm)"

echo "--- 4. does AlarmManager actually hold our alarms? (this is what silently failed before) ---"
adb -s "$D" shell "dumpsys alarm | grep -c dailypulse" | tr -d '\r' | sed 's/^/    alarm entries mentioning our package: /'
adb -s "$D" shell "dumpsys alarm | grep -B2 -A6 'dailypulse.ALARM'" 2>/dev/null | head -24 > "$OUT/dumpsys-alarm.txt"
head -14 "$OUT/dumpsys-alarm.txt"

echo "--- 5. BootReceiver: replay alarms as if the phone rebooted ---"
adb -s "$D" logcat -c
adb -s "$D" shell am broadcast -a android.intent.action.BOOT_COMPLETED -n $PKG/.BootReceiver 2>&1 | tr -d '\r' | tail -2
sleep 3
echo "    alarms still registered after the boot broadcast:"
adb -s "$D" shell "dumpsys alarm | grep -c dailypulse" | tr -d '\r' | sed 's/^/      /'

echo "--- 6. wait for the alarm to fire ---"
adb -s "$D" logcat -c
adb -s "$D" shell input keyevent KEYCODE_SLEEP
for i in $(seq 1 24); do
  sleep 10
  HIT=$(adb -s "$D" logcat -d 2>/dev/null | grep -ciE "AlarmReceiver|AlarmActivity|dp_alarm_audible|dp_fullscreen_alarm")
  TOP=$(adb -s "$D" shell dumpsys activity activities 2>/dev/null | grep -m1 -oE "AlarmActivity" | tr -d '\r')
  echo "    [$i] logcat alarm hits=$HIT  topActivity=${TOP:-none}"
  if [ "$HIT" -gt 0 ] || [ -n "$TOP" ]; then
    adb -s "$D" exec-out screencap -p > "$OUT/alarm-fired.png"
    echo "    ALARM FIRED — screenshot: $OUT/alarm-fired.png"
    adb -s "$D" logcat -d 2>/dev/null | grep -iE "AlarmReceiver|AlarmActivity|SecurityException|exact" | head -12 > "$OUT/alarm-logcat.txt"
    break
  fi
done
echo "--- 7. any SecurityException (the old failure signature)? ---"
adb -s "$D" logcat -d 2>/dev/null | grep -icE "SecurityException.*alarm|Need.*SCHEDULE_EXACT_ALARM" | sed 's/^/    matches: /'
echo "=== artifacts in $OUT ==="; ls -1 "$OUT"
