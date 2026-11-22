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

## Order

1. Deploy the web side (v267, the Recordings screen).
2. Upload build 123 to the **internal testing** track (`play.mjs upload builds/Daylog-123.aab --track internal`)
   and install it on your phone from the internal-test link. Do NOT sideload `builds/Daylog-123.apk` over
   the Play app: it is signed with the upload key, so Android would make you uninstall first, which deletes
   the app's data.
3. Record the video, fill the form above and save.
4. Promote build 123 to production.
