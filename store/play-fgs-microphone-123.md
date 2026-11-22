# Play Console: Foreground service permissions (needed for build 123)

Build 123 adds a recorder that keeps recording with the screen off. Android calls this a
"microphone foreground service", and Google reviews every app that declares one. The form must be
filled before build 123 can go to review.

## Where

Play Console ▸ Daylog ▸ **App content** (left menu, under "Policy") ▸ **Foreground service permissions** ▸
**Start** (or **Manage**).

## What to fill in (copy exactly)

**Which foreground service types does your app use?** Tick **Microphone**.

**Use case:** pick **Background Audio Access** (if offered; otherwise "Other" and paste the description).

**Describe how your app uses this permission:**

> Daylog is a private journal. Its Recordings screen lets the user record a long spoken journal entry.
> The user starts every recording by tapping Record inside the app. While it records, a notification
> shows the running time with Pause, Resume and Stop buttons, so the recording keeps going when the
> screen turns off or the user opens another app. It stops only when the user taps Stop, after 3 hours,
> or when the phone is almost out of storage. The audio is saved on the phone and never uploaded; the
> user can share one recording themselves with the Share button.

**What would happen if the system deferred this task?** (if asked)

> The start of what the user says would not be recorded, and the journal entry would be incomplete.

**What would happen if the task were interrupted?** (if asked)

> The recording would be cut off in the middle of what the user is saying.

**Video link:** a 30-60 second screen recording (see below), uploaded to YouTube as **Unlisted**, or to
Google Drive with "Anyone with the link can view". Paste that link.

## The video (30-60 s, on your phone with build 123 installed)

Turn on Android's screen recorder (quick settings ▸ Screen record), then:

1. Open Daylog ▸ ☰ Menu ▸ **Recordings**.
2. Tap **Record** and say a sentence.
3. Pull down the notification shade: show the Daylog notification with the timer.
4. Press the Home button (the recording keeps going), then tap **Pause** and **Resume** in the notification.
5. Open Daylog again and tap **Stop and save**; show the new recording in the list.

## Order (corrected 2026-11-22 after the first upload attempt)

Play refuses **any** upload of build 123, even to internal testing, until this form is saved
(`403 You must let us know whether your app uses any Foreground Service permissions`). The form needs
the video, and the video needs build 123 running on a phone, so the build has to go on a phone without Play:

1. Web side is live (v267, the Recordings screen).
2. Pick a phone whose Daylog data you can afford to reset (the second phone). On it, open Daylog ▸
   **Sync now** (or Settings ▸ Export) so nothing is lost.
3. Uninstall Daylog on that phone. The Play copy is signed by Google and `builds/Daylog-123.apk` with the
   upload key, so Android will not install one over the other. (Internal app sharing does not help: Play
   re-signs those builds with yet another key, so the same uninstall is needed.)
4. Install `builds/Daylog-123.apk`: plug the phone into the Mac and run
   `~/Library/Android/sdk/platform-tools/adb install builds/Daylog-123.apk`, or send the file to the phone
   and open it. Allow the microphone and notifications when asked.
5. Record the video (script above), upload it unlisted, fill the form, **Save**.
6. Upload 123 to internal testing (`node daylog-native-backup/play.mjs upload builds/Daylog-123.aab --track internal`),
   then promote to production.

The Mac's Android emulator was tried for the video on 2026-11-22 and is unusable: the 8 GB Mac has no RAM
left for the guest, so it spends its time paging (guest load 45+, System UI not responding).
