/* Daylog — async tests for photos & voice notes (v251).

   tests/unit.js is synchronous, so everything that touches IndexedDB, FileReader or the
   recorder was only ever tested by putting records straight into _media. That proved the
   rendering and nothing about whether a photo actually survives. This suite drives the real
   functions against a small in-memory IndexedDB that can be told to fail the way a full phone
   fails: the request SUCCEEDS and the transaction then aborts with QuotaExceededError.

   jsdom has no IndexedDB, and fake-indexeddb clones values with Node's structuredClone, which
   cannot clone jsdom's Blob — so the shim stores values by reference. It is only as faithful
   as the behaviours the app relies on: keyPath stores, put/delete/getAll, transaction
   complete/error/abort, and deleteDatabase.

   Run by tools/run-unit-tests.mjs after the synchronous suite; returns a Promise of
   { pass, fail, results }. */
(async function () {
  const R = []; let pass = 0, fail = 0;
  const ok = (name, cond, got) => {
    if (cond) { pass++; R.push('PASS ' + name); }
    else { fail++; R.push('FAIL ' + name + (got !== undefined ? ' → got ' + JSON.stringify(got) : '')); }
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const T = todayStr();

  /* ---------- the shim ---------- */
  const shim = { dbs: new Map(), failNext: null, opens: 0 };
  const later = f => setTimeout(f, 0);
  function req() { return { onsuccess: null, onerror: null, result: undefined, error: null }; }
  function makeDB(name) {
    const stores = new Map();
    const db = {
      name, onversionchange: null,
      get objectStoreNames() { return { contains: n => stores.has(n) }; },
      createObjectStore(n, opts) { const m = new Map(); m.keyPath = opts.keyPath; stores.set(n, m); return { createIndex() {} }; },
      close() { db.closed = true; },
      transaction(n, mode) {
        const data = stores.get(n);
        const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
        const ops = [];
        const failWith = shim.failNext; shim.failNext = null;
        tx.objectStore = () => ({
          put(v) { const r = req(); ops.push(() => { data.set(v[data.keyPath], v); r.result = v[data.keyPath]; }); ops.push(r); return r; },
          delete(k) { const r = req(); ops.push(() => { data.delete(k); }); ops.push(r); return r; },
          getAll() { const r = req(); ops.push(() => { r.result = [...data.values()]; }); ops.push(r); return r; },
        });
        later(() => {
          const snapshot = new Map(data);
          for (let i = 0; i < ops.length; i += 2) { ops[i](); const r = ops[i + 1]; r.onsuccess && r.onsuccess(); }
          if (failWith) {
            // the requests "succeeded"; the transaction now aborts and nothing is kept
            data.clear(); snapshot.forEach((v, k) => data.set(k, v));
            tx.error = { name: failWith, message: failWith };
            tx.onabort && tx.onabort();
            return;
          }
          tx.oncomplete && tx.oncomplete();
        });
        return tx;
      },
    };
    return { db, stores };
  }
  const fakeIDB = {
    open(name) {
      const r = req(); r.onupgradeneeded = null; shim.opens++;
      later(() => {
        let e = shim.dbs.get(name), fresh = false;
        if (!e) { e = makeDB(name); shim.dbs.set(name, e); fresh = true; }
        e.db.closed = false;
        r.result = e.db;
        if (fresh && r.onupgradeneeded) r.onupgradeneeded();
        r.onsuccess && r.onsuccess();
      });
      return r;
    },
    deleteDatabase(name) {
      const r = req();
      later(() => { shim.dbs.delete(name); r.onsuccess && r.onsuccess(); });
      return r;
    },
  };

  // jsdom has no object URLs; the app only needs a string back.
  const urlC = URL.createObjectURL, urlR = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {};
  const idbSnap = window.indexedDB, capSnap = window.Capacitor, confSnap = window.confirm;
  const notesSnap = localStorage.getItem('dp.notes');
  window.indexedDB = fakeIDB;
  _mediaDbP = null; _mediaReady = false; _media.clear();
  const rec = (id, ctx, kind, extra) => Object.assign({ id, kind: kind || 'photo', mime: kind === 'voice' ? 'audio/webm' : 'image/jpeg',
    blob: new Blob(['abc']), day: T, ctx, ts: Date.now(), size: 3 }, extra || {});
  const reread = async () => { _media.clear(); await mediaLoad(); };

  try {
    await mediaLoad();
    ok('media loads from an empty database', _mediaReady && _media.size === 0);

    /* ---- add / quota / delete ---- */
    ok('mediaAdd saves', (await mediaAdd(rec('a1', 'log'))) === true && _media.has('a1'));
    await reread();
    ok('…and it is really in the database', _media.has('a1'));
    shim.failNext = 'QuotaExceededError';
    ok('a full phone is reported as NOT saved', (await mediaAdd(rec('a2', 'log'))) === false && !_media.has('a2'));
    await reread();
    ok('…and nothing half-written is left behind', !_media.has('a2') && _media.has('a1'));
    ok('mediaDelete removes', (await mediaDelete('a1')) === true && !_media.has('a1'));
    await reread();
    ok('…from the database too', !_media.has('a1'));

    /* ---- a caption typed just before Delete must not resurrect the photo ---- */
    await mediaAdd(rec('c1', 'log'));
    mediaSaveCaption('c1', 'about to delete');
    await mediaDelete('c1');
    await sleep(500);
    await reread();
    ok('a pending caption save does not bring a deleted photo back', !_media.has('c1'));
    await mediaAdd(rec('c2', 'log')); await mediaAdd(rec('c3', 'log'));
    mediaSaveCaption('c2', 'first'); mediaSaveCaption('c3', 'second');
    await sleep(500); await reread();
    ok('editing a second caption does not drop the first', _media.get('c2').caption === 'first' && _media.get('c3').caption === 'second');
    await mediaDelete(['c2', 'c3']);

    /* ---- backup round trip ---- */
    await mediaAdd(rec('b1', 'log', 'photo', { caption: 'lake', w: 10, h: 8, thumb: new Blob(['t']) }));
    await mediaAdd(rec('b2', 'note:nZ', 'voice', { dur: 4200 }));
    const bk = await mediaForBackup();
    ok('the backup carries every item', bk.items.length === 2 && bk.skipped === 0, bk.items.length);
    ok('…as valid items', bk.items.every(mediaItemValid));
    await mediaWipe();
    ok('delete-everything empties the store', _media.size === 0 && !shim.dbs.has(MEDIA_DB));
    const r1 = await mediaRestore(bk.items);
    ok('restore brings them back', r1.added === 2 && _media.has('b1') && _media.has('b2'), r1);
    ok('…with caption, size and duration', _media.get('b1').caption === 'lake' && _media.get('b1').w === 10 && _media.get('b2').dur === 4200);
    const r2 = await mediaRestore(bk.items);
    ok('restoring the same backup twice adds nothing', r2.added === 0 && r2.had === 2, r2);
    const r3 = await mediaRestore([{ id: 'x/y', kind: 'photo', day: T, ctx: 'log', data: 'AAAA' }, null]);
    ok('a damaged item is skipped, not written', r3.bad === 2 && r3.added === 0, r3);

    /* ---- media whose note is gone ---- */
    localStorage.setItem('dp.notes', '[]');
    ok('note media with no note is listed as unattached', mediaOrphanCtxs().includes('note:nZ'));
    show('notes');
    ok('…and the Notes screen shows it', !!document.querySelector('#s-notes [data-orphan-note="nZ"]'));
    document.querySelector('#s-notes [data-orphan-note="nZ"]').click();
    ok('"Make it a note again" fixes it', !mediaOrphanCtxs().includes('note:nZ') && DB.notes().some(n => n.id === 'nZ'));

    /* ---- deleting a note: media first, so a failure leaves the note to retry from ---- */
    window.confirm = () => true;
    show('notes');
    shim.failNext = 'UnknownError';
    document.querySelector('#s-notes [data-delnote="nZ"]').click();
    await sleep(30);
    ok('if its media cannot be deleted, the note stays', DB.notes().some(n => n.id === 'nZ') && _media.has('b2'));
    show('notes');
    document.querySelector('#s-notes [data-delnote="nZ"]').click();
    await sleep(30);
    ok('…and when it can, both go', !DB.notes().some(n => n.id === 'nZ') && !_media.has('b2'));

    /* ---- what goes into an export ---- */
    window.Capacitor = { Plugins: { DaylogShare: { shareImage() {} } } };      // an old build: no file writer
    let ex = await mediaForExport();
    ok('an old build leaves photos out of a copy-paste backup, and says so', ex.items.length === 0 && /Play Store/.test(ex.note), ex.note);
    window.Capacitor = capSnap;
    if (window.Capacitor === undefined) delete window.Capacitor;
    const big = _media.get('b1'), sz = big.size; big.size = 40 * 1048576;
    window.confirm = () => false;
    ex = await mediaForExport();
    ok('a very large backup asks first, and Cancel leaves the photos out', ex.items.length === 0 && /WITHOUT/.test(ex.note), ex.note);
    window.confirm = () => true;
    ex = await mediaForExport();
    ok('…and OK includes them', ex.items.length === 1 && !ex.note);
    big.size = sz;

    /* ---- the recorder ---- */
    let gum = 0, gumArgs = null, mrOpts = null;
    const stopped = [];
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: (c) => { gum++; gumArgs = c; return new Promise(r => setTimeout(() => r({ getTracks: () => [{ stop() { stopped.push(1); } }] }), 20)); } } });
    class FakeMR {
      constructor(stream, opts) { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; mrOpts = opts; }
      static isTypeSupported(m) { return m === 'audio/webm;codecs=opus'; }
      start() { this.state = 'recording'; }
      stop() { this.state = 'inactive'; if (this.ondataavailable) this.ondataavailable({ data: new Blob(['x'.repeat(200)]) }); setTimeout(() => this.onstop && this.onstop(), 0); }
    }
    const mrSnap = window.MediaRecorder; window.MediaRecorder = FakeMR;
    voiceStart('log', T); voiceStart('log', T);                  // a fast double-tap
    await sleep(60);
    ok('a double-tap on Record opens the microphone once', gum === 1 && !!_rec, gum);
    ok('…and nothing is busy-reloadable while it records', mediaBusyNow());
    ok('voice is recorded in mono (v252)', !!gumArgs && gumArgs.audio && gumArgs.audio.channelCount === 1, gumArgs);
    ok('…at 24 kbps, not 32', !!mrOpts && mrOpts.audioBitsPerSecond === 24000, mrOpts);
    _rec.t0 = Date.now() - 3000;
    voiceStop(false);
    await sleep(40);
    const v1 = [..._media.values()].filter(r => r.kind === 'voice');
    ok('Stop saves the voice note with its length', v1.length === 1 && v1[0].dur >= 2900 && v1[0].ctx === 'log', v1.map(r => r.dur));
    ok('…and releases the microphone', stopped.length === 1 && !_rec && !mediaBusyNow());

    voiceStart('log', T); await sleep(60);
    const r0 = _rec; r0.t0 = Date.now() - 2000;
    r0.mr.stop();                                                // the recorder stops BY ITSELF
    await sleep(40);
    const v2 = [..._media.values()].filter(r => r.kind === 'voice' && r.id !== v1[0].id);
    ok('a recorder that stops on its own still saves, with a duration', v2.length === 1 && v2[0].dur >= 1900, v2.map(r => r.dur));
    ok('…and its timers are cleared', !_rec);

    voiceStart('note:new', T); await sleep(60);
    const nBefore = DB.notes().length;
    voiceStop(true);
    await sleep(40);
    ok('Discard saves nothing and makes no note', DB.notes().length === nBefore && [..._media.values()].filter(r => r.kind === 'voice').length === 2);

    voiceStart('note:new', T); await sleep(60);
    _rec.t0 = Date.now() - 1500;
    voiceStop(false); await sleep(40);
    const nn = DB.notes()[0];
    ok('a voice note from Notes becomes a new note holding it', DB.notes().length === nBefore + 1 && mediaList('note:' + nn.id, null).length === 1);

    voiceStart('log', addDays(T, -1)); await sleep(60);
    _rec.t0 = Date.now() - 1500;
    logDate = T; renderToday();                                  // switching day mid-recording
    await sleep(40);
    ok('switching the Log to another day saves the recording to the day it began', !_rec && [..._media.values()].some(r => r.kind === 'voice' && r.day === addDays(T, -1)));

    window.MediaRecorder = mrSnap;

    /* ---- v252: shrinking photos saved before the better compression ----
       jsdom cannot decode an image, so the encoder is replaced; what is under test is which
       photos are touched, what is kept, and what happens when the phone fills up. */
    await mediaWipe(); await mediaLoad();
    const encSnap = window.mediaPhotoBlobs;
    const webp = n => new Blob(['RIFF' + 'w'.repeat(n - 4)], { type: 'image/webp' });   // RIFF: a WebP's first bytes
    window.mediaPhotoBlobs = async (b) => {
      if (b.size === 777) throw new Error('decode');                       // an image that will not decode
      const n = b.size === 999 ? 900 : 400;                                // 999 → 950 in all: under 10% smaller, so kept
      return { blob: webp(n), thumb: webp(50), mime: 'image/webp', w: 1440, h: 1080, size: n + 50 };
    };
    await mediaAdd(rec('s1', 'log', 'photo', { blob: new Blob(['j'.repeat(1000)], { type: 'image/jpeg' }), size: 1000, caption: 'keep me' }));
    await mediaAdd(rec('s2', 'log', 'photo', { blob: new Blob(['j'.repeat(999)], { type: 'image/jpeg' }), size: 999 }));
    await mediaAdd(rec('s3', 'log', 'photo', { blob: new Blob(['j'.repeat(777)], { type: 'image/jpeg' }), size: 777 }));
    await mediaAdd(rec('s4', 'log', 'photo', { enc: MEDIA_ENC, size: 3 }));
    await mediaAdd(rec('s5', 'log', 'voice'));
    ok('only older photos are offered for shrinking', mediaShrinkCount() === 3, mediaShrinkCount());
    const steps = [];
    const sr = await mediaShrinkAll(r => steps.push(r.done));
    ok('shrinking reports what it did', sr.total === 3 && sr.done === 3 && sr.changed === 1 && sr.saved === 550, sr);
    ok('…and counts up as it goes', steps.join() === '1,2,3', steps);
    await reread();
    const s1 = _media.get('s1');
    ok('a shrunk photo is replaced, keeping its caption', s1.mime === 'image/webp' && s1.size === 450 && s1.w === 1440 && s1.caption === 'keep me', s1);
    ok('a photo that would barely shrink is left as it was', _media.get('s2').size === 999 && _media.get('s2').mime === 'image/jpeg');
    ok('a photo that cannot be decoded is left as it was', _media.get('s3').size === 777);
    ok('…and none of them is offered again', mediaShrinkCount() === 0 && ['s1', 's2', 's3'].every(id => _media.get(id).enc === MEDIA_ENC));
    ok('newer photos and voice notes are untouched', _media.get('s4').size === 3 && !_media.get('s5').enc);
    ok('running it again does nothing', (await mediaShrinkAll()).total === 0);
    ok('nothing is left busy afterwards', !mediaBusyNow());

    await mediaAdd(rec('s6', 'log', 'photo', { blob: new Blob(['j'.repeat(1000)]), size: 1000 }));
    await mediaAdd(rec('s7', 'log', 'photo', { blob: new Blob(['j'.repeat(1000)]), size: 1000 }));
    shim.failNext = 'QuotaExceededError';
    const sf = await mediaShrinkAll();
    ok('a full phone stops the shrink and says so', sf.full === true && sf.done === 0, sf);
    await reread();
    ok('…leaving the photo it was on exactly as it was', _media.get('s6').size === 1000 && _media.get('s7').size === 1000 && mediaShrinkCount() === 2);
    await mediaShrinkAll();
    ok('…and it finishes once there is room', mediaShrinkCount() === 0);
    window.mediaPhotoBlobs = encSnap;

    /* the backup keeps which encoder made a photo, and a WebP thumbnail comes back as WebP */
    const bk2 = await mediaForBackup();
    const it1 = bk2.items.find(x => x.id === 's1');
    ok('the backup records that a photo is already shrunk', it1 && it1.enc === MEDIA_ENC);
    await mediaWipe();
    await mediaRestore(bk2.items);
    ok('…so a restored photo is not shrunk a second time', _media.get('s1').enc === MEDIA_ENC && mediaShrinkCount() === 0);
    ok('a WebP thumbnail is restored as WebP', _media.get('s1').thumb.type === 'image/webp', _media.get('s1').thumb.type);
    ok('an old JPEG thumbnail is restored as JPEG', b64ImageMime('/9j/4AAQ') === 'image/jpeg' && b64ImageMime('UklGRiQ') === 'image/webp');
    if (mrSnap === undefined) delete window.MediaRecorder;
    delete navigator.mediaDevices;
  } catch (e) {
    fail++; R.push('FAIL the async suite threw: ' + (e && e.stack || e));
  } finally {
    try { await mediaWipe(); } catch (e) {}
    window.confirm = confSnap;
    URL.createObjectURL = urlC; URL.revokeObjectURL = urlR;
    if (idbSnap === undefined) delete window.indexedDB; else window.indexedDB = idbSnap;
    _mediaDbP = null; _media.clear(); _mediaReady = false;
    if (notesSnap != null) localStorage.setItem('dp.notes', notesSnap); else localStorage.removeItem('dp.notes');
  }
  return { pass, fail, results: R };
})();
