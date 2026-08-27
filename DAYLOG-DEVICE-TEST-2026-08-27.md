# Daylog — device test, 2026-08-27

**Device:** POCO C31 (`211033MI`), Android 11, tested over **USB** (`VWQCY5HEYHUCYPZP`) **and
wireless** (`192.168.1.6:5555`) — both transports confirmed live.

**Not touched:** the realme `RMX3231` at `192.168.1.4:5555`. It appears in `adb devices`
because it is paired, but no command was ever issued against it.

**Builds:** native **113 / versionName 73** installed over 111. Web **v199**, confirmed
showing in Settings on the phone after a force-stop and relaunch.

---

## Data safety, done first

Signing certs were compared **before** installing, by pulling the installed APK off the phone:

```
installed on phone : 144d1f7646fd61812ffad9ace95866189cd13349b05588779f584d8d6d4ad728
new build 113      : 144d1f7646fd61812ffad9ace95866189cd13349b05588779f584d8d6d4ad728
```

Identical, so `install -r` upgraded in place. Verified afterwards that his data survived:
**17 days logged, 14-day best streak, 5 configured habits, real health history.** A mismatch
would have forced an uninstall and destroyed all of it — hence checking first.

---

## The headline result: native share works

This is the one thing that could not be tested without a new build.

```
START u0 {act=android.intent.action.CHOOSER flg=0x10000001
          cmp=android/com.android.internal.app.ChooserActivity
          callerPackage=io.github.kishore2494.dailypulse}
```

`0x10000001` = `FLAG_GRANT_READ_URI_PERMISSION | FLAG_ACTIVITY_NEW_TASK` — precisely the flags
`SharePlugin.java` sets. The Android share sheet opened carrying the PNG and offered
image-specific targets (Quick Share, Save, Search image, Bluetooth).

Two supporting confirmations:
- The in-app button read **"Share"**, not "Save image" — the web layer correctly detected the
  `DaylogShare` plugin at runtime.
- The card itself rendered in the WebView from the same blob that is base64'd to the plugin,
  so the bytes are a valid PNG by demonstration.

Android **back** closed the share sheet and returned to Stats without exiting the app.

---

## Verified against his real data, not a fixture

| What | On his phone |
|---|---|
| Trophy case | **"9 of 60"** — the 9th family (weekly streaks) is live |
| Earned dates, replayed from history | "14 days in a row · 15 Aug", "7 days in a row · 8 Aug", "2 weeks in a row · 16 Aug", "10 days logged · 11 Aug" |
| Best Efforts | Most steps **10,554 · 14 Aug** / 10,172 · 6 Aug / 9,819 · 2 Aug; Longest sleep 8h19m; Deepest focus **4.4h** |
| Health insights | "Heavy screen days cost you 17 min of sleep"; "Your sleep sweet spot: 8h+ — mood 7.5 after 8h+ vs 5.5 after 6–7h"; "Reading today → mood −0.9 tomorrow" |
| Weekly streak line | "This week: 1 of 7 · 2 more to count it" |
| Today ring | "17% of today logged · 2 of 12 logged" |
| Stats tabs | All five reachable — Overview, Awards, Time, Checklist, Health |
| New Overview cards | Your goals ("free, all of them"), ＋ Add a goal, You vs you (vs last week / month / year), Month in review ("See August 2026"), Your best ever |

Two of those quietly prove earlier fixes: **10,554** exercises the thousands-separator fix,
and **4.4h deep work** exercises the `deepWorkHours` field-name fix that had made the focus
record dead for every real user.

---

## The sample-data banner earned its keep

His phone **has sample data loaded**, and the banner added earlier today fired:

> 👀 Includes **sample data** — these are not your real awards, and none of them are being
> recorded. [Clear sample]

Without that fix he would have read those awards as his own history. That is the single most
valuable thing this device test surfaced.

---

## The delete button is safe

Tested deliberately without confirming:
- One tap → armed, label became **"⚠️ Tap again to erase everything"**
- Left alone for 9 seconds → disarmed itself back to "Delete all my data"
- Stats afterwards **byte-identical**: streak 1, best 14, 17 days logged, polymath 56

---

## Two bugs found on the device and fixed (v199)

1. **What's-new claimed "54 awards across 8 families"** after the weekly family took it to 60
   across 9. Hardcoded copy drifts the moment the number changes, so there is now a test that
   reads the real counts out of `awardList()` / `AWARD_FAMILIES` and fails on any mismatch.
2. **`awardsHTML`'s empty-store early return skipped the sample-data banner**, so a
   sample-loaded store with no entries would have shown an unlabelled trophy case. Worse, the
   test for that fix was passing only because it hit that same early return — it now seeds an
   entry and covers both paths.

---

## Still not verified, and why

- **Reboot restore.** `BootReceiver` has still never run at runtime. `BOOT_COMPLETED` is a
  protected broadcast adb cannot send, so this needs a genuine reboot with a reminder set.
- **Alarm sound picker round-trip.** Not re-tested this session.
- **Android 12–16.** The POCO is Android 11. The alarm and share paths behave differently on
  14+ (exact-alarm denial, `BAL_BLOCK`), which is why the earlier alarm work needed the
  Samsung.

## Before uploading 113 to Play

**Play Console → App content → Health apps declaration** is still mandatory and still blocks
the upload. Store copy is refreshed and ready to paste (`store/PASTE-*.txt`), and deliberately
says nothing about sharing until 113 is actually live.

And the keystore at `daily-pulse-android/android.keystore` is still on one disk with no copy.
