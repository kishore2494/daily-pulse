> **DRAFT, not published.** Written 2026-11-21 from the live English listing (`listing-new-2026-11-21.json`). Nothing was sent to Play. A native Hindi speaker should read it before it goes live (see section 6).
> The text is in `listing-hi-IN-draft.json`.

# Daylog Hindi (hi-IN) listing: notes

## 0. Read this first: the app itself is in English

- `app.js` and `index.html` contain no Hindi text, and voice typing is fixed to English (`DICT_LANG = 'en-IN'`, app.js line 608).
- `aso-2026-11.md` §5 says: add Hindi listings only after the app's own text is translated; until then, the listing must say the app is in English.
- This draft does that. Line 2 of the full description says: "ध्यान दें: Daylog की स्क्रीनें फ़िलहाल अंग्रेज़ी में हैं, जैसे Log, Habits और Stats।" (Note: Daylog's screens are in English for now, such as Log, Habits and Stats.) The voice-typing line says "अंग्रेज़ी में बोलकर" (by speaking in English).
- **Kishore's call:** publish it now with that note, or wait for a Hindi app as the ASO doc advised. Without the note, Hindi-reading users would install, find English and uninstall, and that hurts the rating.
- Play shows the default-language (English) screenshots unless Hindi ones are uploaded ([Google](https://support.google.com/googleplay/android-developer/answer/9844778?hl=en)). That is fine here, because the app really is in English.

## 1. Fields and lengths

Counted as JavaScript `.length` (UTF-16 code units, which is what Play's counters show for Devanagari) with `/opt/homebrew/bin/node`, and the JSON parses:

| Field | Length | Limit |
|---|---|---|
| title | 27 | 30 |
| shortDescription | 77 | 80 |
| fullDescription | 3,846 | 4,000 |

Devanagari vowel signs, the virama (्) and the nukta (़) each count as one character. For example, फ़ोटो is 5 characters, and ऑफ़लाइन is 7.

## 2. Back-translation (for a non-Hindi reader)

**Title:** `Daylog: डायरी, मूड और आदतें`
→ "Daylog: Diary, Mood and Habits"

**Short description:** `निजी हैबिट और मूड ट्रैकर, फ़ोटो व वॉइस डायरी, स्क्रीन टाइम का हिसाब। ऑफ़लाइन।`
→ "Private habit and mood tracker, photo and voice diary, screen-time tracking. Offline."
(English source: "Private habit tracker, mood log, photo & voice journal and screen time. Offline.")

**Alternative titles (not used):**
- A: `Daylog: मूड डायरी, आदत ट्रैकर` (29). "Daylog: Mood Diary, Habit Tracker". It packs in more keywords, but आदत ट्रैकर is a half-calque; a native speaker should say whether it sounds natural.
- B: `Daylog मूड डायरी, हैबिट ट्रैकर` (30). The same, with the category term हैबिट ट्रैकर, but it only fits without the colon. The version with a colon is 31 characters, over the limit.

**The full description follows the English paragraph by paragraph.** It differs from the English in these places:
- **Dropped "New:"** from the widget paragraph. The paragraph now opens "होम स्क्रीन से ही दिन दर्ज करें" (log your day right from the home screen). The task's policy list rules out "new" (नया/नई).
- **Added the English-screens note** (section 0), with three real tab labels from `NAV_DEF`: Log, Habits, Stats.
- **Voice typing** is described as "typing or speaking in English (voice typing)", which is true to `DICT_LANG`.
- **The cue example** "after my morning coffee, at my desk" became "सुबह की चाय के बाद, अपनी मेज़ पर" (after my morning tea, at my desk). It is only an illustration, and chai is the everyday Indian habit.
- **"a weighted trend"** became "जो लंबे रुझान से बनता है" (built from the long-run trend). The meaning is kept: one missed day can't erase months. The word "weighted" is not translated, because भारित sounds like a textbook.
- **"A simple money tracker"** became "पैसों का आसान हिसाब" (simple accounts of your money), which is everyday phrasing.
- **"Year in pixels"** keeps its English feature name, with "यानी पूरा साल एक नज़र में" (i.e. the whole year at a glance).
- **"lifelog" is not used.** Nobody searches it in Hindi, and a transliteration (लाइफ़लॉग) would mean nothing to readers. The opening uses "निजी लेखा-जोखा" (private record, an everyday idiom) instead, and the closing line uses "ऐप".
- **"mood tracker" (मूड ट्रैकर) appears** in the short description in place of "mood log". Every Hindi competitor listing uses मूड ट्रैकर (section 4), and the app does track mood, so this adds no new claim.

## 3. Keyword and script choices

**Rule used:** write in Devanagari throughout. Write English category words the way Hindi speakers actually say them, as loanwords in Devanagari. Use Latin script only for names the user will see in the app.

| Kept as an English loanword, in Devanagari | Why |
|---|---|
| डायरी (diary) | In the title of every Hindi journal competitor checked: Daylio, Diarium, Mann, and the "Private Mental Health Diary" app. It is the most natural Hindi word for the category. |
| मूड, मूड ट्रैकर, मूड जर्नल | Daylio's Hindi title is "जर्नल, डायरी, मूड्स". Diarium, Mann and the flycode diary all write मूड ट्रैकर. |
| हैबिट ट्रैकर (×3) | HabitNow's Hindi description uses हैबिट ट्रैकर. It sits next to the native आदत (habit, ×6), so both spellings are present. |
| जर्नल, स्क्रीन टाइम (×6), ऑफ़लाइन, फ़ोटो, वॉइस नोट, विजेट, नोटिफ़िकेशन, रिमाइंडर, स्ट्रीक, स्टेप्स, बैकअप, अकाउंट | These are the words Hindi speakers use for these things. Pure-Hindi versions (such as अधिसूचना for notification) read like a government form. |

| Native Hindi kept | Why |
|---|---|
| आदतें / आदत (habits), नींद (sleep), यादें (memories), पैसों का हिसाब, निजी (private) | These are common, warm words, not Sanskritised ones. The title uses आदतें. |
| Avoided: उपयोगकर्ता, सांख्यिकी, अंतर्दृष्टि, भारित | They are stiff, and Loop's Hindi listing shows the risk: it calls a streak "लकीर" (a drawn line), a word-for-word translation that misreads. |

| Kept in Latin script | Why |
|---|---|
| Daylog | It is the brand, as Daylio and Diarium keep theirs. |
| Log, Habits, Stats, Memories, Good / Okay / Low, Year in pixels, Midnight / Paper / Luxe / Aurora / Bloom | These are the exact labels on the English screens, so a Hindi reader can find them. |
| Health Connect | This is Google's product name as shown on the phone. |
| JSON, CSV, PDF | These are file formats. The English listing has these same capitals. |

**English search phrases in Latin script ("habit tracker", "mood journal") were deliberately left out of the Hindi text.**
- Most Indian phones are set to English ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-localize-your-app-in-india)), so the English listing, which stays the default, already serves the people who type "habit tracker".
- Mixing scripts inside one field "does not seem to be a popular practice" (same AppTweak article). No competitor checked does it for category phrases; they only keep a brand or an acronym in Latin, such as Diarium's "PIN" or Mann's "AI".
- An India-focused playbook advises romanised terms in the English listing and Devanagari terms in the Hindi listing, saying romanised queries "behave like English text to Google Play's index" ([ASOWorld, Oct 2026](https://asoworld.com/en/blog/how-to-rank-your-app-on-google-play-in-india-pakistan-a-keyword-playbook-for-utility-regional-content-and-casual-game-apps/)).
- No source says whether Play matches a Latin-script query against a Hindi listing. If the search-terms report later shows Hindi-device users arriving on Latin queries, test a variant with them.
- The tab names in the English-screens note still put "Habits" and "Log" in Latin script, honestly.

**Policy check (run with node):**
- No free / मुफ़्त / फ्री / निःशुल्क, no best / बेस्ट / बेहतरीन / सबसे, no #1 / नंबर 1, no new / नया / नई / न्यू, and no top / टॉप. (The only match was the न्यू inside मेन्यू, meaning menu.)
- No emoji. The only all-capital words are JSON, CSV and PDF.
- "पूरी तरह ऑफ़लाइन" (fully offline) was considered and dropped, because the English text says only "offline".
- "न विज्ञापन" (no ads) appears only in the full description, as it does in the English.

## 4. Research: what Hindi users search, with sources

- **People type in Latin script a lot.**
  - At Flipkart, "the major portion of the queries (around 21%) seen on the platform are code-mixed Hinglish", meaning Hindi words typed in Latin script ([Kulkarni et al., arXiv 2208.03713](https://arxiv.org/abs/2208.03713); the figure is in the paper's Introduction).
  - Microsoft found Roman transliteration "used abundantly on the Web… also for user queries" ([SIGIR 2014](https://www.microsoft.com/en-us/research/publication/query-expansion-for-mixed-script-information-retrieval/)).
  - Romanised Hindi spread because phones default to Roman keyboards; Gboard has a Hinglish mode ([Wikipedia: Hinglish](https://en.wikipedia.org/wiki/Hinglish)).
  - None of this is Play-specific data.
- **Who sees a Hindi listing:** only users whose language preference is Hindi; everyone else gets the default listing or an automatic translation ([Play Console Help](https://support.google.com/googleplay/android-developer/answer/9844778?hl=en)). "Most Indians set their smartphones in English" ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-localize-your-app-in-india), updated 22 Jul 2024). So the Hindi listing reaches a smaller, more Hindi-first group, and Devanagari text suits them.
- **Common English words stay English.** AppTweak says words like "booking", "delivery" and "news" are best kept in English, because they are everyday speech in India.
- **Research keywords in Hindi, don't translate them** ([AppTweak](https://www.apptweak.com/en/aso-blog/how-to-localize-your-app-in-india); [productgrowth.in checklist, 1 Nov 2026](https://productgrowth.in/resources/checklists/play-store-aso-checklist-english-hindi/): "Use words your users really use", and the 30/80/4,000 limits apply to translations too).
- **Competitor Hindi listings,** fetched 2026-11-21 with `hl=hi&gl=IN`:
  - [Daylio](https://play.google.com/store/apps/details?id=net.daylio&hl=hi&gl=IN): "Daylio - जर्नल, डायरी, मूड्स"
  - [Diarium](https://play.google.com/store/apps/details?id=partl.Diarium&hl=hi&gl=IN): "Diarium: निजी डायरी, जर्नल"; its description uses मूड ट्रैकर, फोटो डायरी and PIN.
  - [Mann](https://play.google.com/store/apps/details?id=app.mann.journal&hl=hi&gl=IN): "Mann (मन) — AI जर्नल डायरी". Its description is relaxed Hinglish: प्राइवेट डायरी, मूड ट्रैकर, स्ट्रेस, ओवरथिंकिंग.
  - ["Private Mental Health Diary"](https://play.google.com/store/apps/details?id=com.flycode.mood&hl=hi&gl=IN): "निजी मानसिक स्वास्थ्य डायरी", formal Hindi that still says मूड ट्रैकर.
  - [HabitNow](https://play.google.com/store/apps/details?id=com.habitnow&hl=hi&gl=IN) keeps an English title; its description uses हैबिट ट्रैकर, टू-डू लिस्ट and आदतें.
  - [Loop](https://play.google.com/store/apps/details?id=org.isoron.uhabits&hl=hi&gl=IN) keeps an English title; its description is a literal translation ("लकीर" for streak).
  - Play's policy page on promotional words: [metadata policy](https://support.google.com/googleplay/android-developer/answer/9898842?hl=en).
- **What none of these sources gives:** Play search volume for Hindi or Hinglish terms. The draft's keyword choices rest on what competitors do and on everyday usage, not on measured volume. After it goes live, Play Console's search-terms report for hi-IN visitors is the real test.

## 5. How a reviewer can check it quickly

- The title and short description are back-translated in section 2. The full description has the same headings, in the same order, as `listing-new-2026-11-21.json`, so the two can be read side by side.
- All numbers match the English: −1.2; 7–8 hours; 7.8 vs 5.9; +0.7; 90 days; 3 days; 100; 24 hours; five looks.

## 6. For a native Hindi speaker to check

1. **Title:** does "डायरी, मूड और आदतें" sound right for an app name, or is "मूड डायरी, आदत ट्रैकर" (alt A) more natural? Would people say आदत ट्रैकर, or only हैबिट ट्रैकर?
2. **"निजी लेखा-जोखा"** (private record) in the opening line: warm and natural, or too accounts-like? An alternative is "निजी डायरी".
3. **Nukta spelling:** the draft uses फ़ोटो, ऑफ़लाइन, ज़्यादा, सफ़र, हफ़्ते. Many Indian apps drop the dots (फोटो, ऑफलाइन). Pick one style and keep it.
4. **The insight quotes** are translated, though the app shows them in English. Is "मूड −1.2 घटा देते हैं" clear? Is "नींद का सही दायरा" a good rendering of "sleep sweet spot"?
5. **"छुट्टी के दिन"** (days off) in the habit heading, for "skip days": does it suggest holidays only? The body explains it as rest days that don't break the streak.
6. **"स्ट्रेंथ स्कोर"** is kept as a loanword. Would "मज़बूती स्कोर" read better?
7. **"प्राइवेसी, शुरू से ही"** for "Private by design": natural?
8. **Tone:** the draft uses आप and polite commands (जोड़ें, रखें). Is it warm enough, or does it lean formal anywhere?
9. **Register:** is anything too Sanskritised or too English-heavy for an everyday Hindi reader?
10. **The English-screens note:** is it clear, and is line 2 the right place for it?
