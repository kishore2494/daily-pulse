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
  // wait for an async chain started by a click, up to a limit (a fixed sleep flakes on a busy machine)
  const until = async (f, ms = 2000) => { const t0 = Date.now(); while (!f() && Date.now() - t0 < ms) await sleep(5); };
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
    await until(() => !DB.notes().some(n => n.id === 'nZ'));
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
    await until(() => !!_rec); await sleep(20);
    ok('a double-tap on Record opens the microphone once', gum === 1 && !!_rec, gum);
    ok('…and nothing is busy-reloadable while it records', mediaBusyNow());
    ok('voice is recorded in mono (v252)', !!gumArgs && gumArgs.audio && gumArgs.audio.channelCount === 1, gumArgs);
    ok('…at 24 kbps, not 32', !!mrOpts && mrOpts.audioBitsPerSecond === 24000, mrOpts);
    _rec.t0 = Date.now() - 3000;
    voiceStop(false);
    await until(() => [..._media.values()].filter(r => r.kind === 'voice').length === 1 && !mediaBusyNow());
    const v1 = [..._media.values()].filter(r => r.kind === 'voice');
    ok('Stop saves the voice note with its length', v1.length === 1 && v1[0].dur >= 2900 && v1[0].ctx === 'log', v1.map(r => r.dur));
    ok('…and releases the microphone', stopped.length === 1 && !_rec && !mediaBusyNow());

    voiceStart('log', T); await until(() => !!_rec);
    const r0 = _rec; r0.t0 = Date.now() - 2000;
    r0.mr.stop();                                                // the recorder stops BY ITSELF
    await until(() => [..._media.values()].filter(r => r.kind === 'voice').length === 2 && !_rec);
    const v2 = [..._media.values()].filter(r => r.kind === 'voice' && r.id !== v1[0].id);
    ok('a recorder that stops on its own still saves, with a duration', v2.length === 1 && v2[0].dur >= 1900, v2.map(r => r.dur));
    ok('…and its timers are cleared', !_rec);

    voiceStart('note:new', T); await until(() => !!_rec);
    const nBefore = DB.notes().length;
    voiceStop(true);
    await until(() => !_rec && !mediaBusyNow()); await sleep(20);
    ok('Discard saves nothing and makes no note', DB.notes().length === nBefore && [..._media.values()].filter(r => r.kind === 'voice').length === 2);

    voiceStart('note:new', T); await until(() => !!_rec);
    _rec.t0 = Date.now() - 1500;
    voiceStop(false); await until(() => DB.notes().length === nBefore + 1 && !mediaBusyNow());
    const nn = DB.notes()[0];
    ok('a voice note from Notes becomes a new note holding it', DB.notes().length === nBefore + 1 && mediaList('note:' + nn.id, null).length === 1);

    voiceStart('log', addDays(T, -1)); await until(() => !!_rec);
    _rec.t0 = Date.now() - 1500;
    logDate = T; renderToday();                                  // switching day mid-recording
    await until(() => !_rec && [..._media.values()].filter(r => r.kind === 'voice').some(r => r.day === addDays(T, -1)));
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

    /* v253: a photo deleted while the shrink is on it stays deleted (independent review) */
    const enc1 = window.mediaPhotoBlobs; let gate = null;
    window.mediaPhotoBlobs = async (b) => { await new Promise(r => { gate = r; }); return enc1(b); };
    await mediaAdd(rec('s8', 'log', 'photo', { blob: new Blob(['j'.repeat(1000)]), size: 1000 }));
    await mediaAdd(rec('s9', 'log', 'photo', { blob: new Blob(['j'.repeat(1000)]), size: 1000 }));
    const mwSnap = window.mediaWrite, puts = [];
    window.mediaWrite = fn => mwSnap(st => fn({ put: r => { puts.push(r.id); return st.put(r); }, delete: id => st.delete(id) }));
    const run = mediaShrinkAll(); await sleep(5);              // s8 is being re-encoded
    const again = await mediaShrinkAll();
    ok('a second Shrink while one runs says it is busy, not "already small"', again.busy === true && again.total === 0, again);
    ok('…and the Storage page, drawn again meanwhile, shows the running shrink', /id="st-shrink" disabled>Shrinking 0 of 2/.test(storagePageHTML()));
    await mediaDelete(['s8']);
    gate(); await sleep(5); gate();
    await run; await reread();
    window.mediaWrite = mwSnap;
    ok('a photo deleted while it was being shrunk stays deleted', !_media.has('s8'), [..._media.keys()]);
    ok('…and is never written back, not even for a moment (an app kill then would resurrect it)', !puts.includes('s8') && puts.includes('s9'), puts);
    ok('…and the next one is still shrunk', _media.get('s9').enc === MEDIA_ENC && _media.get('s9').size === 450);
    window.mediaPhotoBlobs = async (b) => { if (b.size === 1001) mediaDelete(['s10']); return enc1(b); };   // delete queued just before the put
    await mediaAdd(rec('s10', 'log', 'photo', { blob: new Blob(['j'.repeat(1001)]), size: 1001 }));
    await mediaShrinkAll(); await reread();
    ok('…even when the delete was queued just before the smaller copy was saved', !_media.has('s10'), [..._media.keys()]);
    window.mediaPhotoBlobs = enc1;
    await mediaAdd(rec('s11', 'log', 'photo', { blob: new Blob(['j'.repeat(1000)]), size: 1000 }));
    shim.failNext = 'UnknownError';
    const sx = await mediaShrinkAll();
    ok('a storage error that is not "full" is reported as a failure, not as success', sx.failed === true && sx.full === false, sx);
    await mediaShrinkAll();
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

    /* v253: photos in a Write article */
    {
      const docsSnap = localStorage.getItem('dp.docs'), encW = window.mediaPhotoBlobs, supW = window.mediaSupported;
      window.mediaSupported = () => true;
      window.mediaPhotoBlobs = async () => ({ blob: new Blob(['RIFF' + 'w'.repeat(396)], { type: 'image/webp' }), thumb: new Blob(['RIFFtt']), mime: 'image/webp', w: 1280, h: 960, size: 406 });
      window.confirm = () => true;
      try {
        await mediaWipe(); await mediaLoad();
        localStorage.setItem('dp.docs', JSON.stringify([{ id: 'docW1', title: 'Trip', blocks: [{ id: 'bkA', t: 'p', text: 'We drove north.' }], created: T, updated: '' }]));
        curDoc = 'docW1'; show('write');
        const acts = [...document.querySelectorAll('#s-write [data-madd]')];
        ok('the article editor offers photo, video and gallery for THAT article, and a voice note', acts.map(b => b.dataset.madd).join() === 'camera,video,gallery' && acts.every(b => b.dataset.mctx === 'doc:docW1')
          && document.querySelector('#s-write [data-mrec]').dataset.mctx === 'doc:docW1', acts.map(b => b.dataset.madd + '@' + b.dataset.mctx));
        _mediaTarget = { ctx: 'doc:docW1', day: T };
        await mediaTakeFiles([new File(['jpg1'], 'a.jpg', { type: 'image/jpeg' }), new File(['jpg2'], 'b.jpg', { type: 'image/jpeg' })]);
        let doc = DB.docs()[0];
        const pb = doc.blocks.filter(b => b.t === 'i');
        ok('two picked photos become two photo blocks after the text', doc.blocks.length === 3 && doc.blocks[0].id === 'bkA' && pb.length === 2 && pb.every(b => _media.get(b.mid) && _media.get(b.mid).ctx === 'doc:docW1'), doc.blocks);
        ok('…and show in the open editor at once', document.querySelectorAll('#s-write .blk-photo [data-mview]').length === 2);
        ok('…in a set the viewer pages through in block order', !!document.querySelector('#blk-list[data-mset]'));
        await reread();
        const bk = await mediaForBackup();
        ok('article photos are valid backup items', bk.items.filter(x => x.ctx === 'doc:docW1').length === 2 && bk.items.every(mediaItemValid));
        // delete one block: its photo goes too
        document.querySelector(`#s-write [data-blkdel="${pb[0].id}"]`).click(); await until(() => !DB.docs()[0].blocks.some(b => b.id === pb[0].id));
        doc = DB.docs()[0];
        ok('removing a photo block deletes its photo', !_media.has(pb[0].mid) && !doc.blocks.some(b => b.id === pb[0].id));
        // delete the other in the viewer: its block leaves the article
        await mediaConfirmDelete(pb[1].mid);
        doc = DB.docs()[0];
        ok('deleting an article photo in the viewer removes its block', !_media.has(pb[1].mid) && !doc.blocks.some(b => b.t === 'i') && doc.blocks.length === 1, doc.blocks);
        // a block whose photo is not on this phone (synced from another) says so and is left alone
        doc.blocks.push({ id: 'bkX', t: 'i', mid: 'not-here', text: '' }); localStorage.setItem('dp.docs', JSON.stringify([doc])); renderWrite();
        ok('a photo block from another phone says the photo is not here', /This photo is not on this phone/.test(document.getElementById('s-write').innerHTML));
        refreshMediaSlots();
        ok('…and is never pruned automatically', DB.docs()[0].blocks.some(b => b.id === 'bkX'));
        // deleting the article deletes its photos
        _mediaTarget = { ctx: 'doc:docW1', day: T }; await mediaTakeFiles([new File(['jpg3'], 'c.jpg', { type: 'image/jpeg' })]);
        ok('(a third photo for the delete test)', mediaList('doc:docW1', null).length === 1);
        document.getElementById('doc-del').click(); await until(() => !DB.docs().length);
        ok('deleting the article deletes its photos too', !DB.docs().length && !mediaList('doc:docW1', null).length && curDoc === null);
        // an article deleted on another phone: its photos are listed, and can come back as an article
        await mediaAdd(rec('wo1', 'doc:docGone', 'photo'));
        ok('photos of an article that is gone are listed as unattached', mediaOrphanCtxs().includes('doc:docGone'));
        navigateTo('notes');
        const btn = document.querySelector('[data-orphan-doc="doc:docGone"]');
        ok('…with "Make it an article again"', !!btn && /article again/.test(btn.textContent));
        btn.click();
        const rd = DB.docs().find(d => d.id === 'docGone');
        ok('…which brings back an article holding them', rd && rd.blocks.length === 1 && rd.blocks[0].t === 'i' && rd.blocks[0].mid === 'wo1' && !mediaOrphanCtxs().length);
      } finally {
        window.mediaPhotoBlobs = encW; window.mediaSupported = supW; window.confirm = confSnap; curDoc = null;
        if (docsSnap != null) localStorage.setItem('dp.docs', docsSnap); else localStorage.removeItem('dp.docs');
        await mediaWipe(); await mediaLoad();
      }
    }

    /* v253: backup and restore (independent review 3) */
    {
      const snaps = {}; ['dp.entries', 'dp.sampleMeta', 'dp.pomohist', 'dp.timelog', 'dp.health', 'dp.hapticsOff', 'dp.settings', 'dp.lastBackup', 'dp.reminders', 'dp.events'].forEach(k => { snaps[k] = localStorage.getItem(k); });
      const capSnap2 = window.Capacitor, rasSnap = window.mediaReadAll, pushSnap = window.pushState, pullSnap = window.pullState;
      try {
        // flags restore
        const vb = validateBackup({ hapticsOff: 1, nudgeOff: 1, entries: {} });
        ok('on/off choices (stored as 1) are accepted on restore', vb.ok && vb.keys.includes('hapticsOff') && vb.keys.includes('nudgeOff'), vb.keys);
        ok('…but a number where a collection belongs is still refused', !validateBackup({ entries: 5, notes: [] }).keys.includes('entries'));
        // sample rows never go into a backup
        localStorage.removeItem('dp.sampleMeta'); localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 7, journal: 'real', habits: {} } }));
        seedSampleData();
        const meta = JSON.parse(localStorage.getItem('dp.sampleMeta'));
        const bb = backupBlob().data;
        ok('a backup taken during the sample preview leaves the sample days out', meta.entries.length > 0 && meta.entries.every(d => !bb.entries[d] || !bb.entries[d].sample) && bb.entries[T] && bb.entries[T].journal === 'real');
        ok('…and the sample time blocks and pomodoro days', (bb.timelog || []).every(s => !s.sample) && (meta.pomo || []).every(d => !(bb.pomohist || {})[d]));
        // restore: no push over the Sheet, a pull instead; this install's sample markers dropped
        let pushed = 0, pulled = 0;
        window.pushState = () => { pushed++; }; window.pullState = () => { pulled++; };
        const st = DB.settings(); st.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(st);
        window.confirm = () => true;
        const file = new File([JSON.stringify({ notes: [{ id: 'nR1', text: 'from backup', color: '', created: T }], hapticsOff: 1 })], 'b.json', { type: 'application/json' });
        let restored = null; importData(file, okk => { restored = okk; });
        await until(() => restored !== null);
        ok('restoring does not push the old file over the Sheet (it wiped newer data on other phones)', restored === true && pushed === 0, { pushed });
        ok('…it pulls first, so the normal merge decides what is newer', pulled === 1);
        ok('…restores the on/off choices', localStorage.getItem('dp.hapticsOff') === '1');
        ok('…and drops this install\'s sample markers, so "Clear sample" cannot delete restored days', localStorage.getItem('dp.sampleMeta') === null);
        // export: an empty in-memory list is checked against the database
        await mediaWipe(); await mediaLoad();
        await mediaAdd(rec('ex1', 'log', 'photo')); await mediaAdd(rec('ex2', 'log', 'voice'));
        _media.clear();                                           // as if the start-up read had failed
        const mx = await mediaForExport();
        ok('a backup still includes photos the start-up read missed', mx.items.length === 2, mx.items.length);
        _media.clear(); window.mediaReadAll = () => Promise.reject(new Error('io'));
        const my = await mediaForExport();
        ok('…and says so when the database cannot be read at all', my.items.length === 0 && my.skipped === -1, my);
        window.mediaReadAll = rasSnap; await mediaLoad();
        // the last reminder gone: native alarms are cancelled, without asking for permission
        const calls = []; let asked = 0;
        window.Capacitor = { Plugins: {
          LocalNotifications: { checkPermissions: async () => ({ display: 'granted' }), requestPermissions: async () => { asked++; return { display: 'granted' }; },
            getPending: async () => ({ notifications: [{ id: 1 }, { id: 2 }, { id: 750 }] }), cancel: async (o) => { calls.push(['cancel', o.notifications.map(n => n.id)]); }, schedule: async () => {} },
          FullScreenAlarm: { schedule: async (o) => { calls.push(['fs', o.alarms.length]); return {}; } } } };
        localStorage.setItem('dp.reminders', '[]'); localStorage.setItem('dp.events', '[]');
        setupReminders(); await sleep(20);
        ok('with no reminders left, their scheduled alarms are cancelled', calls.some(c => c[0] === 'cancel' && c[1].join() === '1,2') && calls.some(c => c[0] === 'fs' && c[1] === 0), calls);
        ok('…other features\' notifications are kept, and no permission is asked for', !calls.some(c => c[0] === 'cancel' && c[1].includes(750)) && asked === 0);
      } finally {
        window.Capacitor = capSnap2; window.mediaReadAll = rasSnap; window.pushState = pushSnap; window.pullState = pullSnap; window.confirm = confSnap;
        Object.keys(snaps).forEach(k => { if (snaps[k] != null) localStorage.setItem(k, snaps[k]); else localStorage.removeItem(k); });
        localStorage.removeItem('dp.notes');
      }
    }

    /* a restore of plans and gym days: what it brings back is stamped new, the rest loses its stamps */
    {
      const ks = ['dp.gym', 'dp.gymAt', 'dp.plans', 'dp.listAt', 'dp.listDel', 'dp.settings'];
      const sn = {}; ks.forEach(k => { sn[k] = localStorage.getItem(k); });
      const pushSnap = window.pushState, pullSnap = window.pullState, confSnap2 = window.confirm;
      try {
        window.pushState = () => {}; window.pullState = () => {}; window.confirm = () => true;
        localStorage.setItem('dp.gym', JSON.stringify({ [T]: { done: { 'day1/x': false, 'day1/y': true }, log: {} } }));
        localStorage.setItem('dp.gymAt', JSON.stringify({ [T]: { done: { 'day1/x': 5, 'day1/y': 5 } } }));
        localStorage.setItem('dp.plans', JSON.stringify([{ id: 'pR', name: 'R', items: [{ id: 'a', done: false }] }]));
        localStorage.setItem('dp.listAt', JSON.stringify({ plans: { pR: 5 }, planFields: { pR: 5 }, planItems: { pR: { a: 5 } } }));
        localStorage.setItem('dp.listDel', '{}');
        const t0 = Date.now();
        const file = new File([JSON.stringify({ _at: t0, gym: { [T]: { done: { 'day1/x': true, 'day1/y': true }, log: {} } },
          plans: [{ id: 'pR', name: 'R', items: [{ id: 'a', done: true }, { id: 'b', done: false }] }] })], 'b.json', { type: 'application/json' });
        let restored = null; importData(file, okk => { restored = okk; });
        await until(() => restored !== null);
        const ga = JSON.parse(localStorage.getItem('dp.gymAt') || '{}'), la = JSON.parse(localStorage.getItem('dp.listAt') || '{}');
        ok('a restore stamps the gym ticks it brings back, and drops the other gym stamps', restored === true && ((ga[T] || {}).done || {})['day1/x'] >= t0 && !('day1/y' in ((ga[T] || {}).done || {})), ga);
        ok('…and the plan steps it brings back, while the rest of the plan loses its stamps', ((la.planItems || {}).pR || {}).b >= t0 && !('a' in ((la.planItems || {}).pR || {})) && (la.planFields || {}).pR === 0, la);
      } finally {
        window.pushState = pushSnap; window.pullState = pullSnap; window.confirm = confSnap2;
        ks.forEach(k => { if (sn[k] != null) localStorage.setItem(k, sn[k]); else localStorage.removeItem(k); });
      }
    }

    /* v253: native build 119 — notification taps applied at their own time; a dismissed share sheet is not a backup */
    {
      const capSnap3 = window.Capacitor, tlSnap = localStorage.getItem('dp.timelog'), lbSnap = localStorage.getItem('dp.lastBackup');
      let queue = [], legacy = '';
      const H = 3600000, t0 = Date.now() - 13 * H;
      const shareRes = { v: null };
      window.Capacitor = { Plugins: {
        DaylogTimer: { show: async () => ({}), hide: async () => ({}),
          consumeActions: async () => { const a = queue; queue = []; return { actions: a }; } },
        DaylogShare: { shareImage: async () => ({ ok: true }), saveTextFile: async () => ({ saved: false }), shareTextFile: async () => shareRes.v } } };
      try {
        localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'nq1', act: 'work', start: t0, end: null, upd: t0 }]));
        queue = [{ action: 'stop', at: t0 + 9 * H }];                   // tapped 9 h in, app opened 13 h in
        await drainTimerAction();
        let b = DB.timelog().find(s => s.id === 'nq1');
        ok('a Stop tapped in the notification ends the block when it was tapped, not when the app opened', b.end === t0 + 9 * H, (b.end - t0) / H);
        localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'nq2', act: 'work', start: t0, end: null, upd: t0 }]));
        queue = [{ action: 'resume', at: t0 + 4 * H }, { action: 'pause', at: t0 + 3 * H }];   // out of order on purpose
        await drainTimerAction();
        const L = DB.timelog();
        ok('Pause then Resume both apply, each at its own time — the paused hour is not counted', L.find(s => s.id === 'nq2').end === t0 + 3 * H && L.some(s => s.end == null && s.start === t0 + 4 * H && s.act === 'work'), L.map(s => [(s.start - t0) / H, s.end == null ? null : (s.end - t0) / H]));
        stopRunning();
        localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'nq3', act: 'sleep', start: t0 + 10 * H, end: null, upd: t0 }]));
        queue = [{ action: 'stop', at: t0 + 9 * H }];                   // about an earlier block
        await drainTimerAction();
        ok('a tap older than the running block leaves it running', DB.timelog().find(s => s.id === 'nq3').end == null);
        stopRunning();
        // an older Play build: one untimed action
        delete window.Capacitor.Plugins.DaylogTimer.consumeActions;
        window.Capacitor.Plugins.DaylogTimer.consumeAction = async () => { const a = legacy; legacy = ''; return { action: a }; };
        localStorage.setItem('dp.timelog', JSON.stringify([{ id: 'nq4', act: 'work', start: t0, end: null, upd: t0 }]));
        legacy = 'stop'; await drainTimerAction();
        ok('an older native build (one untimed action) still works', DB.timelog().find(s => s.id === 'nq4').end != null);
        // share sheet
        localStorage.removeItem('dp.lastBackup');
        shareRes.v = { ok: true, chosen: false };
        let r = await saveFile('b.json', '{}', 'application/json');
        ok('a share sheet closed without picking an app is not a save', r === 'cancel' && !saveOk(r));
        shareRes.v = { ok: true, chosen: true, target: 'com.google.android.apps.docs' };
        r = await saveFile('b.json', '{}', 'application/json');
        ok('…picking an app is', r === 'shared' && saveOk(r));
        shareRes.v = { ok: true };                                       // an older build cannot tell
        ok('…and an older build that cannot tell keeps the old behaviour', (await saveFile('b.json', '{}', 'application/json')) === 'shared');
      } finally {
        window.Capacitor = capSnap3;
        if (tlSnap != null) localStorage.setItem('dp.timelog', tlSnap); else localStorage.removeItem('dp.timelog');
        if (lbSnap != null) localStorage.setItem('dp.lastBackup', lbSnap); else localStorage.removeItem('dp.lastBackup');
      }
    }

    /* Play build 121: the home-screen widget's one-tap mood, drained at launch and on return */
    {
      const capSnap4 = window.Capacitor, eSnap4 = localStorage.getItem('dp.entries'), obSnap4 = localStorage.getItem('dp.onboarded');
      const errSnap4 = localStorage.getItem('dp.errlog'), ob4 = document.getElementById('onboard'), obWas4 = ob4.classList.contains('on');
      let queue = [];
      const sent = [];
      window.Capacitor = { Plugins: { WidgetBridge: {
        update: async o => { sent.push(o); throw new Error('widget-refused'); },   // a refusal must not raise the crash sheet
        consumeActions: async () => { const a = queue; queue = []; return { actions: a }; } } } };
      try {
        localStorage.setItem('dp.onboarded', '1'); ob4.classList.remove('on');
        localStorage.removeItem('dp.errlog');
        flushAutosave();
        let n = Date.now(); if (todayStr(new Date(n - 10000)) !== todayStr(new Date(n))) { await sleep(11000); n = Date.now(); }
        const D = todayStr();
        const e = DB.entries(); delete e[D]; localStorage.setItem('dp.entries', JSON.stringify(e));
        navigateTo('settings');
        queue = [{ action: 'mood', mood: 9, at: n - 2000 }];
        await drainWidgetActions();
        ok('widget: a face tapped while the app was closed is saved when it opens', (DB.entry(D) || {}).mood === 9, DB.entry(D));
        ok('…the app opens on the Log, on today', document.getElementById('s-today').classList.contains('on') && logDate === D);
        ok('…the Log shows the mood just saved (no stale draft over it)', draft.mood === 9, draft.mood);
        const mmh = document.querySelector('#s-today .mm-card .mm-head');
        ok('…and the mood grid says the mood is saved, energy still to add', !!mmh && /Mood .+ saved/.test(mmh.textContent), mmh && mmh.textContent);
        ok('…says so in a short toast', /Mood saved/.test(document.getElementById('toast').textContent), document.getElementById('toast').textContent);
        ok('…and the queue is emptied, so a tap applies once', queue.length === 0);
        ok('every open refreshes the widget', sent.length > 0 && sent[sent.length - 1].mood === 9 && sent[sent.length - 1].day === D, sent[sent.length - 1]);
        await sleep(30);
        ok('a refused widget update never raises the crash sheet', !/widget-refused/.test(localStorage.getItem('dp.errlog') || ''), localStorage.getItem('dp.errlog'));

        // a return with nothing queued: no navigation, still a refresh
        navigateTo('settings'); const k = sent.length;
        await drainWidgetActions();
        ok('…a return with no taps stays where it was and only refreshes the widget', document.getElementById('s-settings').classList.contains('on') && sent.length > k);

        // an "open" tap (the widget's body) lands on the Log without saving anything
        const before = JSON.stringify(DB.entries());
        queue = [{ action: 'open', at: Date.now() }];
        await drainWidgetActions();
        ok('widget: tapping its body opens the Log and changes nothing', document.getElementById('s-today').classList.contains('on') && JSON.stringify(DB.entries()) === before);

        // not before onboarding: a mood saved under the welcome screen would skip it for good
        localStorage.removeItem('dp.onboarded'); ob4.classList.add('on');
        const e2 = DB.entries(); delete e2[D]; localStorage.setItem('dp.entries', JSON.stringify(e2));
        queue = [{ action: 'mood', mood: 3, at: Date.now() }];
        await drainWidgetActions();
        ok('widget: a tap during onboarding saves nothing, and is not kept for later', !DB.entry(D) && queue.length === 0, DB.entry(D));
        localStorage.setItem('dp.onboarded', '1'); ob4.classList.remove('on');

        // an older native build: a WidgetBridge with update() but no consumeActions
        delete window.Capacitor.Plugins.WidgetBridge.consumeActions;
        let threw = false; try { await drainWidgetActions(); } catch (x) { threw = true; }
        ok('…an older native build without consumeActions is left alone', !threw);
      } catch (err) {
        fail++; R.push('FAIL the widget block threw: ' + (err && err.stack || err));
      } finally {
        window.Capacitor = capSnap4;
        if (eSnap4 != null) localStorage.setItem('dp.entries', eSnap4); else localStorage.removeItem('dp.entries');
        if (obSnap4 != null) localStorage.setItem('dp.onboarded', obSnap4); else localStorage.removeItem('dp.onboarded');
        if (errSnap4 != null) localStorage.setItem('dp.errlog', errSnap4); else localStorage.removeItem('dp.errlog');
        if (obWas4) ob4.classList.add('on'); else ob4.classList.remove('on');
        navigateTo('today');
      }
    }

    // v253: "Push all to Sheet" sends every tab the Sheet has, Calendar events and articles included
    {
      const fSnap = window.fetch, setSnap = localStorage.getItem('dp.settings'), entSnap = localStorage.getItem('dp.entries'), sent = [];
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 6, habits: {} } }));
      window.fetch = (u, o) => { try { sent.push(JSON.parse(o.body).type); } catch (e) {} return Promise.resolve({ ok: true }); };
      try {
        const s = DB.settings(); s.syncUrl = 'https://example.invalid/exec'; DB.saveSettings(s);
        await resyncAll(); await sleep(2200);    // articles and the time log go out on a short debounce
        ok('Push all sends days, notes, reminders, the time log and the full state', ['entry', 'notes', 'reminders', 'timelog', 'state'].every(t => sent.includes(t)), [...new Set(sent)]);
        ok('…and Calendar events and Write articles, which it used to leave out', sent.includes('events') && sent.includes('docs'), [...new Set(sent)]);
      } finally {
        window.fetch = fSnap;
        if (setSnap != null) localStorage.setItem('dp.settings', setSnap); else localStorage.removeItem('dp.settings');
        if (entSnap != null) localStorage.setItem('dp.entries', entSnap); else localStorage.removeItem('dp.entries');
      }
    }
    /* ---- v254: memories — bulk import, videos, and what a backup carries ---- */
    {
      const docsSnap = localStorage.getItem('dp.docs'), metaWait = VIDEO_META_WAIT, photoRecSnap = window.mediaPhotoRecord;
      VIDEO_META_WAIT = 30;   // jsdom never decodes a video
      // jsdom has no image decoder; the photo path itself is tested above
      window.mediaPhotoRecord = async (f, ctx, day) => ({ id: mediaId(), kind: 'photo', mime: 'image/webp', blob: new Blob(['p']), day, ctx, ts: Date.now(), size: 1 });
      try {
        await mediaWipe(); await mediaLoad();
        localStorage.setItem('dp.docs', '[]');
        const mk = (name, type, when) => new File(['x'.repeat(10)], name, { type, lastModified: when });
        const d1 = new Date(2024, 4, 12, 9, 0).getTime(), d2 = new Date(2024, 4, 12, 20, 0).getTime(), d3 = new Date(2023, 11, 31, 23, 0).getTime();
        await memImportPrepare([mk('a.jpg', 'image/jpeg', d1), mk('b.mp4', 'video/mp4', d2), mk('c.jpg', 'image/jpeg', d3), mk('notes.txt', 'text/plain', d1)]);
        ok('import: files are grouped by the day each was taken, oldest first, and a non-media file is left out',
          !!_memImport && _memImport.groups.map(g => g.day + ':' + g.items.length).join() === '2023-12-31:1,2024-05-12:2', _memImport && _memImport.groups.map(g => g.day));
        await memImportRun();
        const ms = memSorted(memList());
        ok('…one memory per day, dated that day', ms.map(m => m.date).join() === '2024-05-12,2023-12-31', ms.map(m => m.date));
        ok('…holding an empty story block first, then its photo and video in the order they were taken', ms[0] && ms[0].blocks.map(b => b.t).join('') === 'piv' && ms[0].blocks[0].text === '', ms[0] && ms[0].blocks);
        const vid = ms[0] && memMedia(ms[0]).find(r => r.kind === 'video');
        ok('…the video kept as the file itself, stamped when it was taken', !!vid && vid.mime === 'video/mp4' && vid.size === 10 && vid.ts === d2 && vid.ctx === 'doc:' + ms[0].id, vid && { mime: vid.mime, ts: vid.ts });
        ok('…and it is really in the database', (await mediaReadAll()).some(r => r.kind === 'video'));
        const bk = await mediaForBackup();
        ok('a backup carries the photos and leaves the video out, and counts it', bk.items.length === 2 && bk.items.every(i => i.kind === 'photo') && bk.videos === 1, { n: bk.items.length, v: bk.videos });
        await mediaDelete(memMedia(ms[0]).concat(memMedia(ms[1])).filter(r => r.kind === 'photo').map(r => r.id));
        const ex2 = await mediaForExport();
        ok('with only videos on the phone, an export carries no media and reports no failure', ex2.items.length === 0 && ex2.skipped === 0 && !ex2.note, ex2);
        await memImportPrepare([mk('x.jpg', 'image/jpeg', d1), mk('y.jpg', 'image/jpeg', d3)]);
        _memImport.mode = 'one'; await memImportRun();
        ok('"All in one memory" makes one page, dated the first day', memList().length === 3 && memList().some(m => m.date === '2023-12-31' && m.blocks.map(b => b.t).join('') === 'pii'), memList().map(m => m.date + ':' + m.blocks.map(b => b.t).join('')));
        window.mediaPhotoRecord = async () => { throw new Error('unreadable'); };
        await memImportPrepare([mk('bad.jpg', 'image/jpeg', d1)]); await memImportRun();
        ok('an import whose every file fails leaves no empty memory behind', memList().length === 3, memList().length);
        window.confirm = () => true;
        curMem = ms[0].id; memEdit = true; show('memories');
        document.querySelector('#s-memories [data-mem-del]').click();
        for (let i = 0; i < 40 && memList().some(m => m.id === ms[0].id); i++) await sleep(25);
        ok('deleting a memory deletes its video too', !memList().some(m => m.id === ms[0].id) && !_media.has(vid.id));
      } finally {
        VIDEO_META_WAIT = metaWait; window.mediaPhotoRecord = photoRecSnap; window.confirm = confSnap;
        curMem = null; memEdit = false; _memImport = null;
        if (docsSnap != null) localStorage.setItem('dp.docs', docsSnap); else localStorage.removeItem('dp.docs');
      }
    }
    /* Timebox alarms ring for tomorrow's plan too (the Today / Tomorrow switch) */
    {
      const tbSnap = localStorage.getItem('dp.timebox'), capSnap3 = window.Capacitor;
      const sched = [];
      window.Capacitor = { Plugins: { LocalNotifications: { cancel: async () => {}, schedule: async (o) => { sched.push(...o.notifications); } } } };
      const TM = addDays(T, 1), atOf = (d, hm) => new Date(d + 'T' + hm + ':00').getTime();
      try {
        localStorage.setItem('dp.timebox', '[]');
        focusMode = 'timebox'; tbDay = 1; tbEdit = null; show('focus');
        document.getElementById('tb-label').value = 'Plan the week'; document.getElementById('tb-start').value = '08:00'; document.getElementById('tb-end').value = '09:00';
        document.getElementById('tb-alarm').checked = true;
        document.getElementById('tb-add').click();
        await until(() => sched.length > 0);
        ok('a block added on Tomorrow gets its alarm, at 08:00 tomorrow', sched.length === 1 && new Date(sched[0].schedule.at).getTime() === atOf(TM, '08:00') && /Plan the week/.test(sched[0].title), sched.map(n => [n.title, String(n.schedule.at)]));
        const b = DB.timebox()[0];
        tbEdit = b.id; renderFocus();
        document.getElementById('tb-e-start').value = '07:15';
        sched.length = 0; document.querySelector('[data-tb-save]').click();
        await until(() => sched.length > 0);
        ok('…and editing its start moves the alarm', sched.length === 1 && new Date(sched[0].schedule.at).getTime() === atOf(TM, '07:15'), sched.map(n => String(n.schedule.at)));
        // more future blocks than the 31 reserved ids: the soonest get them, whatever order they were added in
        const far = []; for (let i = 0; i < 31; i++) far.push({ id: 'f' + i, date: addDays(T, 20), start: '10:' + String(i).padStart(2, '0'), end: '11:00', label: 'far ' + i, alarm: true });
        localStorage.setItem('dp.timebox', JSON.stringify(far.concat([{ id: 'soon', date: TM, start: '06:00', end: '07:00', label: 'soon', alarm: true }])));
        sched.length = 0; await scheduleTimeboxAlarms();
        ok('with more than 31 future blocks, tomorrow\'s still rings (the furthest one misses out)', sched.length === 31 && sched.some(n => n.title === '📦 soon') && !sched.some(n => n.title === '📦 far 30'), sched.length);
        ok('…and every alarm id stays in the timebox range', sched.every(n => n.id >= 800 && n.id <= 830));
      } finally {
        window.Capacitor = capSnap3; if (window.Capacitor === undefined) delete window.Capacitor;
        focusMode = 'pomo'; tbDay = 0; tbEdit = null;
        if (tbSnap != null) localStorage.setItem('dp.timebox', tbSnap); else localStorage.removeItem('dp.timebox');
      }
    }
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

  /* ---------- v257: Back in a browser / installed web app ----------
     The real session history, walked with history.back(): jsdom fires popstate for
     same-document entries the way a browser does, so this is the back gesture end to end. */
  {
    const ob = document.getElementById('onboard'), obWas = ob.classList.contains('on'), tSnap = window.toast;
    const on = id => document.getElementById('s-' + id).classList.contains('on');
    const exitOn = () => !!document.querySelector('#confirm-exit.on');
    const at = () => (history.state || {}).dlBack;
    const toasts = [];
    try {
      ob.classList.remove('on'); saveSheetClose(); shareSheetClose(); window.toast = m => toasts.push(m);
      document.body.click(); await sleep(10);   // a tap tops the guards up
      const len = history.length, top = at();
      ok('browser Back: Daylog sits on its top guard entry', typeof top === 'number' && top >= 3, history.state);
      navigateTo('settings'); settingsPage = 'data'; renderSettings();
      history.back(); await until(() => settingsPage === null, 1000);
      ok('browser Back leaves a Settings page for Settings home', on('settings') && settingsPage === null);
      ok('…by spending one guard, never adding one', history.length === len && at() === top - 1, [history.length, len, history.state]);
      openDrawer();
      history.back(); await until(() => !document.getElementById('drawer').classList.contains('on'), 1000);
      ok('browser Back closes the drawer', !document.getElementById('drawer').classList.contains('on') && on('settings'));
      history.back(); await until(() => on(defaultTab()), 1000);
      ok('browser Back from a tab goes to the home tab', on(defaultTab()));
      history.back(); await until(exitOn, 1000);
      ok('browser Back on the home tab asks before leaving', exitOn() && history.length === len);
      history.back(); await until(() => !exitOn(), 1000);
      ok('browser Back with the question open answers Stay', !exitOn());
      document.body.click(); await sleep(10);
      ok('a tap tops the guards back up, history the same length', at() === top && history.length === len, [history.state, history.length, len]);
      // jsdom's tab starts on Daylog, like a launch from the home-screen icon: nothing before it
      showExitConfirm(); document.querySelector('#confirm-exit [data-exit-yes]').click();
      await until(() => at() === 0, 1000); await sleep(20);
      ok('Exit with nothing before Daylog drops to its own entry and stays there', at() === 0 && !exitOn(), history.state);
      ok('…telling them one more Back closes it', toasts.some(m => /once more/.test(m)), toasts);
      document.body.click(); await sleep(10);
      ok('…and a tap instead re-arms it, without growing history', at() === top && history.length === len, [history.state, history.length, len]);
    } catch (e) {
      fail++; R.push('FAIL the browser-Back block threw: ' + (e && e.stack || e));
    } finally {
      window.toast = tSnap;
      if (obWas) ob.classList.add('on');
      const ce = document.getElementById('confirm-exit'); if (ce) ce.classList.remove('on');
      closeDrawer(); navigateTo('today');
    }
  }

  /* ---------- review #3: the one-time notification ask, when Android says no ----------
     "Remind me" toasted "Reminder set" and spent dp.notifAsk even when the permission prompt was
     refused, so the "can't ring" card could never show. The real card, the real click handler. */
  {
    const capSnap = window.Capacitor, permSnap = _notifPerm, tSnap = window.toast, tourSnap = tourIdx;
    const ks = ['dp.entries', 'dp.reminders', 'dp.notifAsk', 'dp.onboarded'];
    const sn = ks.map(k => [k, localStorage.getItem(k)]);
    const toasts = [];
    let answer = 'denied', asked = 0;
    const LN = {
      requestPermissions: () => { asked++; return Promise.resolve({ display: answer }); },
      checkPermissions: () => Promise.resolve({ display: answer }),
      getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(),
      schedule: () => Promise.resolve(), registerActionTypes: () => Promise.resolve(), addListener: () => {},
    };
    const logRems = () => DB.reminders().filter(r => /^log my day$/i.test(String(r.label || '').trim()));
    const tap = async (which) => {
      toasts.length = 0; renderToday();
      const b = document.querySelector(`#notif-ask-slot [data-notif-ask="${which}"]`);
      if (!b) return false;
      b.click(); await until(() => toasts.length > 0); await sleep(20);
      return true;
    };
    try {
      window.Capacitor = { Plugins: { LocalNotifications: LN } }; window.toast = m => toasts.push(m);
      localStorage.setItem('dp.onboarded', '1'); localStorage.removeItem('dp.notifAsk'); tourIdx = -1;
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 7 } }));
      localStorage.setItem('dp.reminders', '[]');
      navigateTo('today'); _notifPerm = 'prompt';

      // Android's prompt refused
      ok('(the ask offers a reminder)', await tap('yes') || notifAskKind() === 'remind');
      ok('review #3: "Remind me" with notifications refused does not say "Reminder set"',
         asked > 0 && !toasts.some(m => /Reminder set/.test(m)) && toasts.some(m => /notifications are off/i.test(m)), toasts);
      ok('review #3: …and does not spend the one-time ask', localStorage.getItem('dp.notifAsk') === null);
      ok('review #3: …so the "can\'t ring" card shows next', logRems().length === 1 && notifAskKind() === 'enable'
         && /can't ring/.test((document.getElementById('notif-ask-slot') || {}).textContent || ''), [logRems(), notifAskKind()]);
      ok('review #3: "Turn on notifications" still refused: says so, ask not spent',
         await tap('on') && toasts.some(m => /off/i.test(m)) && localStorage.getItem('dp.notifAsk') === null && notifAskKind() === 'enable', toasts);
      answer = 'granted';
      ok('review #3: …allowed this time: "Notifications on", the ask is spent',
         await tap('on') && toasts.some(m => /Notifications on/.test(m)) && /^on:/.test(localStorage.getItem('dp.notifAsk') || ''), toasts);

      // a "Log my day" that exists but is switched off, or in alarm mode: reused, never a second one
      for (const old of [{ id: 'old', time: '20:00', label: 'Log my day', enabled: false, mode: 'notify' },
                         { id: 'old', time: '07:30', label: 'Log my day', enabled: true, mode: 'alarm' }]) {
        localStorage.removeItem('dp.notifAsk'); _notifPerm = 'granted';
        localStorage.setItem('dp.reminders', JSON.stringify([old]));
        ok('(the ask offers a reminder: ' + (old.enabled ? 'alarm mode' : 'switched off') + ')', notifAskKind() === 'remind');
        await tap('yes');
        const lr = logRems();
        ok('review #3: "Remind me" reuses the existing Log my day (' + (old.enabled ? 'alarm mode' : 'switched off') + '), no duplicate',
           lr.length === 1 && lr[0].id === 'old' && lr[0].enabled && lr[0].time === '21:00' && isLogReminder(lr[0]), lr);
        ok('review #3: …allowed: "Reminder set", the ask is spent', toasts.some(m => /Reminder set for 21:00/.test(m)) && /^yes:/.test(localStorage.getItem('dp.notifAsk') || ''), toasts);
      }
    } catch (e) {
      fail++; R.push('FAIL the notification-ask block threw: ' + (e && e.stack || e));
    } finally {
      clearInterval(reminderInterval); reminderTimeouts.forEach(clearTimeout); reminderTimeouts = [];
      window.Capacitor = capSnap; if (window.Capacitor === undefined) delete window.Capacitor;
      _notifPerm = permSnap; window.toast = tSnap; tourIdx = tourSnap;
      sn.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); });
      navigateTo('today');
    }
  }

  /* ---------- review #6: the tip ask on build 122+ ----------
     A celebration's dismissal offers the rating first and the tip only once the rating budget is
     settled. With Play's in-app sheet the old card stands aside, so dp.rateAsk never grew and the
     tip never came. The real celebration, the real Close button, the real timers. */
  {
    const capSnap = window.Capacitor, armSnap = _rateArm;
    const ks = ['dp.entries', 'dp.tip', 'dp.rateAsk', 'dp.reviewAsk'];
    const sn = ks.map(k => [k, localStorage.getItem(k)]);
    const on = id => { const e = document.getElementById(id); return !!e && e.classList.contains('on'); };
    const off = () => ['tip-ask', 'rate-ask', 'milestone'].forEach(id => { const e = document.getElementById(id); if (e) e.classList.remove('on'); });
    const LN = { checkPermissions: () => Promise.resolve({ display: 'denied' }), cancel: () => Promise.resolve(), schedule: () => Promise.resolve() };
    const BILL = { products: () => Promise.resolve({ available: true, products: [{ id: 'daylog_tip_small', type: 'once', price: '₹99', micros: 99000000 }] }) };
    const IAR = { request: () => Promise.resolve({}) };
    const dismiss = async (setup) => {
      off(); localStorage.removeItem('dp.tip'); setup();
      showMilestone(7); _rateArm = true;
      document.getElementById('ms-close').click();
      await until(() => on('tip-ask') || on('rate-ask'), 1200); await sleep(20);
      return on('tip-ask') ? 'tip' : on('rate-ask') ? 'rate' : null;
    };
    try {
      const many = {}; for (let i = 0; i < 40; i++) many[addDays(T, -i)] = { mood: 7 };
      localStorage.setItem('dp.entries', JSON.stringify(many));
      window.Capacitor = { Plugins: { LocalNotifications: LN, DaylogBilling: BILL, InAppReview: IAR } };
      let got = await dismiss(() => { localStorage.removeItem('dp.rateAsk'); localStorage.setItem('dp.reviewAsk', JSON.stringify({ n: 2, last: Date.now() - 90 * 864e5 })); });
      ok('review #6: build 122+, both rating sheets spent: a celebration\'s dismissal offers the tip', got === 'tip', got);
      got = await dismiss(() => { localStorage.setItem('dp.rateAsk', JSON.stringify({ asks: 1, last: Date.now() - 90 * 864e5, done: false })); localStorage.setItem('dp.reviewAsk', JSON.stringify({ n: 1, last: Date.now() - 70 * 864e5 })); });
      ok('review #6: …one old card + one sheet is the same budget of two: the tip', got === 'tip', got);
      got = await dismiss(() => { localStorage.removeItem('dp.rateAsk'); localStorage.setItem('dp.reviewAsk', JSON.stringify({ n: 1, last: Date.now() - 70 * 864e5 })); });
      ok('review #6: …budget not spent yet: no tip and no old card (the sheet asks after a save)', got === null && rateState().asks === 0, [got, rateState()]);
      window.Capacitor = { Plugins: { LocalNotifications: LN, DaylogBilling: BILL } };
      got = await dismiss(() => { localStorage.removeItem('dp.rateAsk'); localStorage.removeItem('dp.reviewAsk'); });
      ok('review #6: build ≤121 (no sheet): the old rate card still comes first', got === 'rate', got);
    } catch (e) {
      fail++; R.push('FAIL the tip-ask block threw: ' + (e && e.stack || e));
    } finally {
      off(); _rateArm = armSnap;
      window.Capacitor = capSnap; if (window.Capacitor === undefined) delete window.Capacitor;
      sn.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); });
    }
  }

  /* ---------- review #7: two "Log my day" reminders (e.g. one synced from another phone) ----------
     nudgePlan schedules only the FIRST one (nudgeInput's find); scheduleNativeAlarms skipped
     EVERY reminder matching isLogReminder, so the second never rang at all. */
  {
    const capSnap = window.Capacitor, rSnap = localStorage.getItem('dp.reminders'), eSnap = localStorage.getItem('dp.events');
    const sched = [];
    const LN = {
      requestPermissions: () => Promise.resolve({ display: 'granted' }), checkPermissions: () => Promise.resolve({ display: 'granted' }),
      getPending: () => Promise.resolve({ notifications: [] }), cancel: () => Promise.resolve(),
      schedule: (o) => { sched.push(...o.notifications); return Promise.resolve(); },
    };
    try {
      window.Capacitor = { Plugins: { LocalNotifications: LN } };
      localStorage.setItem('dp.events', '[]');
      localStorage.setItem('dp.reminders', JSON.stringify([
        { id: 'lmA', time: '21:00', label: 'Log my day', enabled: true, mode: 'notify' },
        { id: 'lmB', time: '07:45', label: 'Log my day', enabled: true, mode: 'notify' }]));
      await scheduleNativeAlarms(); await until(() => sched.some(n => n.id >= 840)); await sleep(20);
      const hm = n => { const d = new Date(n.schedule.at); return d.getHours() + ':' + d.getMinutes(); };
      const plain = sched.filter(n => n.id < 700), planned = sched.filter(n => n.id >= 840 && n.id <= 846);
      ok('review #7: the first Log my day stays with nudgePlan (not scheduled twice)', planned.length >= 6 && planned.every(n => hm(n) === '21:0') && !plain.some(n => hm(n) === '21:0'), sched.map(n => n.id + '@' + hm(n)));
      ok('review #7: the second Log my day still rings, as an ordinary reminder', plain.length >= 6 && plain.every(n => hm(n) === '7:45' && /Log my day/.test(n.title)), plain.map(hm));
    } catch (e) {
      fail++; R.push('FAIL the two-reminders block threw: ' + (e && e.stack || e));
    } finally {
      window.Capacitor = capSnap; if (window.Capacitor === undefined) delete window.Capacitor;
      if (rSnap != null) localStorage.setItem('dp.reminders', rSnap); else localStorage.removeItem('dp.reminders');
      if (eSnap != null) localStorage.setItem('dp.events', eSnap); else localStorage.removeItem('dp.events');
    }
  }

  /* ---------- review #8: Health Connect's sleep fill is not a log by hand ----------
     syncHealth persisted the sleep it read into any entry that existed for today. A day holding
     only auto-filled fields (a time summary, e.g. pulled from the Sheet) then counted as logged
     by hand: the evening "Log my day" was skipped and the asks fired. */
  {
    const capSnap = window.Capacitor, logSnap = logDate;
    const ks = ['dp.entries', 'dp.health', 'dp.settings', 'dp.timelog'];
    const sn = ks.map(k => [k, localStorage.getItem(k)]);
    const LN = { checkPermissions: () => Promise.resolve({ display: 'denied' }), cancel: () => Promise.resolve(), schedule: () => Promise.resolve() };
    const HC = { today: () => Promise.resolve({ sleepMinutes: 450, steps: 3000 }) };
    try {
      window.Capacitor = { Plugins: { LocalNotifications: LN, HealthConnect: HC } };
      const st = DB.settings(); st.autoTrack = Object.assign({}, st.autoTrack || {}, { on: true, sleep: true, steps: true }); DB.saveSettings(st);
      localStorage.setItem('dp.timelog', '[]'); localStorage.setItem('dp.health', '{}');
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { habits: {}, timeSummary: '💼 Work 1h 00m', autoAt: { timeSummary: Date.now() - 1000 } } }));
      logDate = T; loadDraft();
      ok('(today holds only an auto-filled time summary)', !loggedByHand(DB.entry(T)));
      await syncHealth({ silent: true });
      ok('review #8: the sleep fill shows in the Log draft', +draft.sleepHours === 7.5, draft.sleepHours);
      ok('review #8: …but is not saved into a day nobody logged by hand, so it stays unlogged',
         !loggedByHand(DB.entry(T)) && !('sleepHours' in (DB.entry(T) || {})), DB.entry(T));
      localStorage.setItem('dp.entries', JSON.stringify({ [T]: { mood: 6, habits: {}, updatedAt: new Date(Date.now() - 5000).toISOString() } }));
      loadDraft(); await syncHealth({ silent: true });
      ok('review #8: a day already logged by hand still gets its sleep filled', +(DB.entry(T) || {}).sleepHours === 7.5 && DB.entry(T).mood === 6, DB.entry(T));
    } catch (e) {
      fail++; R.push('FAIL the health-fill block threw: ' + (e && e.stack || e));
    } finally {
      window.Capacitor = capSnap; if (window.Capacitor === undefined) delete window.Capacitor;
      sn.forEach(([k, v]) => { if (v != null) localStorage.setItem(k, v); else localStorage.removeItem(k); });
      logDate = logSnap; loadDraft();
    }
  }
  /* ---------- Recordings (2026-11-22): long recordings, both engines ----------
     Real recorder code against the in-memory IndexedDB, a fake MediaRecorder that hands over
     slices when told to, and a fake LongRecorder plugin shaped like RECORDER-SPEC.md. */
  {
    const capSnap = window.Capacitor, idbSnap2 = window.indexedDB, mrSnap2 = window.MediaRecorder, confSnap2 = window.confirm;
    const eSnap = localStorage.getItem('dp.entries'), obSnap = localStorage.getItem('dp.onboarded');
    const urlC2 = URL.createObjectURL, urlR2 = URL.revokeObjectURL;
    URL.createObjectURL = () => 'blob:test'; URL.revokeObjectURL = () => {};
    const resetRec = () => { recTickStop(); _lr = null; _lrStarting = false; _recSaving = 0; _recs.clear(); _recBootP = null; _recDbP = null; _recReady = false; _recNativeHooked = false; _recOpen = null; _recEdit = null; _lrCapped = null; };
    let gum = 0;
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: () => { gum++; return Promise.resolve({ getTracks: () => [{ stop() {} }] }); } } });
    class SliceMR {
      constructor(stream, opts) { this.state = 'inactive'; this.mimeType = 'audio/webm;codecs=opus'; this.opts = opts; SliceMR.last = this; }
      static isTypeSupported(m) { return m === 'audio/webm;codecs=opus'; }
      start(slice) { this.state = 'recording'; this.slice = slice; }
      pause() { this.state = 'paused'; }
      resume() { this.state = 'recording'; }
      requestData() { this.emit('p'); }
      emit(s) { if (this.ondataavailable) this.ondataavailable({ data: new Blob([s]) }); }
      stop() { this.state = 'inactive'; this.emit('end'); setTimeout(() => this.onstop && this.onstop(), 0); }
    }
    const chunksOnDisk = async () => (await recGetAll('chunks')).length;
    try {
      resetRec();
      window.indexedDB = fakeIDB; delete window.Capacitor; window.MediaRecorder = SliceMR;
      localStorage.setItem('dp.onboarded', '1');
      await recBoot();
      ok('recordings: boots on an empty database', _recReady && _recs.size === 0);

      /* ---- the web engine ---- */
      recStart(); recStart();                                   // a double tap
      await until(() => !!_lr && _lr.src === 'web');
      ok('web recorder: a double tap opens the microphone once and starts one recording', gum === 1 && !!_lr && _recs.size === 1, gum);
      ok('…in slices of a few seconds, mono at 24 kbps', SliceMR.last.slice === REC_SLICE_MS && SliceMR.last.opts.audioBitsPerSecond === VOICE_BPS);
      ok('…marked live in the database, on today', _recs.get(_lr.id).state === 'live' && _recs.get(_lr.id).day === todayStr());
      ok('…and an app-update reload waits for it', mediaBusyNow());
      voiceStart('log', todayStr()); await sleep(10);
      ok('a voice note cannot start while a recording holds the microphone', !_rec);
      const id1 = _lr.id;
      SliceMR.last.emit('aaaa'); SliceMR.last.emit('bbbb');
      await sleep(60);
      ok('each slice is on disk as it arrives', (await chunksOnDisk()) === 2, await chunksOnDisk());
      _lr.acc = 4000; _lr.from = Date.now();                    // pretend 4 s went by
      await recPause();
      const frozen = recElapsed(_lr);
      ok('pause: the timer stops and what was said so far goes to disk', _lr.state === 'paused' && frozen >= 4000 && (await (async () => { await sleep(30); return chunksOnDisk(); })()) === 3);
      await sleep(30);
      ok('…paused time does not count', recElapsed(_lr) === frozen);
      await recResume();
      ok('resume: recording again', _lr.state === 'recording' && SliceMR.last.state === 'recording');
      await recStop();
      await until(() => !_lr && !_recSaving && (_recs.get(id1) || {}).state === 'done');
      const done1 = _recs.get(id1);
      ok('stop: saved as one recording with its length and size', !!done1 && done1.state === 'done' && done1.dur >= 4000 && done1.size === 'aaaabbbbpend'.length && done1.blob.size === done1.size, done1 && [done1.dur, done1.size]);
      ok('…its slices are cleaned up', (await chunksOnDisk()) === 0);
      ok('…and nothing is busy any more', !mediaBusyNow());
      _recs.clear(); (await recGetAll('recs')).forEach(r => _recs.set(r.id, r));
      ok('…and it is really in the database', (_recs.get(id1) || {}).state === 'done');

      recStart(); await until(() => !!_lr);
      const id2 = _lr.id; SliceMR.last.emit('x'); await sleep(20);
      await recStop(); await until(() => !_lr && !_recSaving);
      ok('a mis-tap (under 0.7 s) keeps nothing, not even its slices', !_recs.has(id2) && (await chunksOnDisk()) === 0);

      /* ---- a recording cut off by a kill comes back at the next start ---- */
      const T0 = Date.now() - 600000;
      await recTx('recs', s => s.put({ id: 'rK', src: 'web', state: 'live', ts: T0, day: todayStr(), mime: 'audio/webm' }));
      await recTx('chunks', s => { s.put({ k: 'rK:000001', rid: 'rK', seq: 1, blob: new Blob(['22']), ms: 8000 }); s.put({ k: 'rK:000000', rid: 'rK', seq: 0, blob: new Blob(['111']), ms: 4000 }); });
      await recTx('recs', s => s.put({ id: 'rE', src: 'web', state: 'live', ts: T0, day: todayStr(), mime: 'audio/webm' }));   // killed before any slice
      await recTx('chunks', s => s.put({ k: 'rGone:000000', rid: 'rGone', seq: 0, blob: new Blob(['zz']), ms: 4000 }));            // of a deleted recording
      await recTx('recs', s => s.put({ id: 'rD', src: 'web', state: 'done', ts: T0, day: todayStr(), blob: new Blob(['d']), size: 1, dur: 5000, del: Date.now() - 60000 }));
      resetRec(); await recBoot();
      const rk = _recs.get('rK');
      ok('crash recovery: the slices come back as one recording, in order', !!rk && rk.state === 'done' && rk.size === 5 && rk.cut === true && rk.dur === 8000, rk && [rk.state, rk.size, rk.dur]);
      ok('…a recording killed before its first slice is dropped', !_recs.has('rE'));
      ok('…slices of no recording are deleted, not brought back', (await chunksOnDisk()) === 0 && !_recs.has('rGone'));
      ok('…and a delete whose Undo time ran out while the app was closed is finished', !_recs.has('rD') && !(await recGetAll('recs')).some(r => r.id === 'rD'));

      /* ---- rename, move, transcript, delete with Undo ---- */
      await recRename('rK', '  Morning  pages ');
      ok('rename is saved', _recs.get('rK').title === 'Morning pages' && (await recGetAll('recs')).find(r => r.id === 'rK').title === 'Morning pages');
      const Dm = addDays(todayStr(), -1);
      ok('move to yesterday', (await recMove('rK', Dm)) && _recs.get('rK').day === Dm);
      ok('…not to tomorrow', !(await recMove('rK', addDays(todayStr(), 1))) && _recs.get('rK').day === Dm);
      const ents = DB.entries(); delete ents[Dm]; DB.saveEntries(ents);
      await recSaveTranscript('rK', 'Went for a run.');
      ok('add transcript: kept on the recording and in that day\'s journal', _recs.get('rK').transcript === 'Went for a run.' && /Morning pages\nWent for a run\./.test((DB.entry(Dm) || {}).journal || ''), DB.entry(Dm));
      await recSaveTranscript('rK', 'Went for a long run.');
      ok('…saved again, it replaces its paragraph', (DB.entry(Dm).journal.match(/Morning pages/g) || []).length === 1 && /long run/.test(DB.entry(Dm).journal));
      show('recordings'); _recOpen = 'rK'; recRefresh();
      ok('the open recording shows its player, ±15 s and its actions', !!document.querySelector('[data-rec-id="rK"] [data-rec-scrub]') && document.querySelectorAll('[data-rec-id="rK"] [data-rec-skip]').length === 2
        && !!document.querySelector('[data-rec-id="rK"] [data-rec-share]') && !!document.querySelector('[data-rec-id="rK"] input[type=date][data-rec-day]'));
      ok('…and its transcript under it', /long run/.test((document.querySelector('[data-rec-id="rK"] .rec-tr') || {}).textContent || ''));
      await recDelete('rK');
      ok('delete: gone from the list at once', !document.querySelector('[data-rec-id="rK"]') && !!_recs.get('rK').del);
      document.querySelector('#toast .toast-undo').click(); await sleep(20);
      ok('…Undo brings it back', !_recs.get('rK').del && !!document.querySelector('[data-rec-id="rK"]'));
      await recDelete('rK'); await recHardDelete('rK');
      ok('…and once final, it is gone from the database', !_recs.has('rK') && !(await recGetAll('recs')).some(r => r.id === 'rK'));

      /* ---- backups never carry a recording ---- */
      await recPut({ id: 'rB', src: 'web', state: 'done', ts: Date.now(), day: todayStr(), blob: new Blob(['bbb']), size: 3, dur: 9000, mime: 'audio/webm' });
      const mb = await mediaForBackup();
      ok('backup: no recording among the media', !mb.items.some(i => i.id === 'rB') && !JSON.stringify(backupBlob().data).includes('rB'));

      /* ---- the native engine (Play build 123+) ---- */
      const calls = [], NOW = Date.now();
      let listener = null, status = { state: 'idle' }, files = [];
      const LR = {
        start: async (o) => { calls.push(['start', o]); return { id: o.id, uri: 'file:///data/rec/' + o.id + '.m4a' }; },
        pause: async () => { calls.push(['pause']); return { state: 'paused', id: _lr && _lr.id, elapsedMs: 42000 }; },
        resume: async () => { calls.push(['resume']); return { state: 'recording', id: _lr && _lr.id, elapsedMs: 42000 }; },
        stop: async () => { calls.push(['stop']); const id = _lr.id; return { id, uri: 'file:///data/rec/' + id + '.m4a', durationMs: 65000, bytes: 520000 }; },
        status: async () => status, list: async () => ({ items: files }),
        remove: async (o) => { calls.push(['remove', o.id]); files = files.filter(f => f.id !== o.id); return {}; },
        share: async (o) => { calls.push(['share', o]); return {}; },
        addListener: (ev, fn) => { if (ev === 'recorderState') listener = fn; return Promise.resolve({ remove() {} }); },
      };
      window.Capacitor = { Plugins: { LongRecorder: LR }, convertFileSrc: u => 'https://localhost/_capacitor_file_' + u.replace('file://', '') };
      resetRec(); await recBoot();
      ok('native: listens for the notification\'s buttons', typeof listener === 'function');
      gum = 0; recStart(); recStart();
      await until(() => !!_lr && calls.some(c => c[0] === 'start'));
      const st = calls.filter(c => c[0] === 'start');
      ok('native: start is called once, with the id and its name', st.length === 1 && /^r[a-z0-9]+$/.test(st[0][1].id) && /^Recording · /.test(st[0][1].title), st.map(c => c[1]));
      ok('…after asking for the microphone through the web (that grants it to the app)', gum === 1);
      const nid = _lr.id;
      ok('…its record keeps the file\'s uri', _recs.get(nid).uri === 'file:///data/rec/' + nid + '.m4a' && _recs.get(nid).src === 'native');
      ok('…and a native recording does not hold up an app update (the service keeps it)', !mediaBusyNow());
      await recPause();
      ok('native pause: the plugin pauses and the timer shows its time', calls.some(c => c[0] === 'pause') && _lr.state === 'paused' && recElapsed(_lr) === 42000);
      listener({ state: 'recording', id: nid, elapsedMs: 43000 });
      ok('Resume pressed on the notification: the screen follows', _lr.state === 'recording' && recElapsed(_lr) >= 43000);
      await recStop();
      await until(() => (_recs.get(nid) || {}).state === 'done');
      ok('native stop: saved with the length and size the plugin reports', _recs.get(nid).dur === 65000 && _recs.get(nid).size === 520000 && !_lr, _recs.get(nid));
      await recShare(nid);
      ok('native share: the plugin\'s share sheet, for that recording', calls.some(c => c[0] === 'share' && c[1].id === nid));

      // started, then stopped from the notification
      recStart(); await until(() => !!_lr && _lr.id !== nid);
      const nid2 = _lr.id;
      listener({ state: 'idle', id: nid2, uri: 'file:///data/rec/' + nid2 + '.m4a', durationMs: 120000, bytes: 960000 });
      await until(() => (_recs.get(nid2) || {}).state === 'done');
      ok('Stop pressed on the notification: saved, and the screen is idle again', !_lr && _recs.get(nid2).dur === 120000 && _recs.get(nid2).size === 960000);

      // a cold start while the service is still recording, plus what changed while the app was closed
      await recPut({ id: 'rY', src: 'native', state: 'live', ts: NOW - 7200000, day: todayStr(), uri: 'file:///data/rec/rY.m4a' });   // stopped from the notification while closed
      await recPut({ id: 'rW', src: 'native', state: 'live', ts: NOW - 7200000, day: todayStr() });                                // its file never made it
      await recPut({ id: 'rV', src: 'native', state: 'live', ts: NOW - 9000000, day: todayStr(), uri: 'file:///data/rec/rV.aac' });   // cut short by an OEM killer
      status = { state: 'recording', id: 'rX', elapsedMs: 600000, startedAt: NOW - 700000, uri: 'file:///data/rec/rX.aac',
        recovered: { id: 'rV', uri: 'file:///data/rec/rV.m4a', durationMs: 90000, bytes: 700000, mime: 'audio/mp4', modifiedAt: NOW - 8000000, startedAt: NOW - 9000000 } };
      files = [{ id: 'rX', uri: 'file:///data/rec/rX.aac', bytes: 3000, modifiedAt: NOW, recording: true },
        { id: 'rY', uri: 'file:///data/rec/rY.m4a', bytes: 5000, modifiedAt: NOW - 3600000 }, { id: 'rZ', uri: 'file:///data/rec/rZ.aac', bytes: 7000, modifiedAt: NOW - 1000 },
        { id: 'rV', uri: 'file:///data/rec/rV.m4a', bytes: 700000, modifiedAt: NOW - 8000000 },
        { id: nid, uri: 'file:///data/rec/' + nid + '.m4a', bytes: 520000, modifiedAt: NOW }, { id: nid2, uri: 'file:///data/rec/' + nid2 + '.m4a', bytes: 960000, modifiedAt: NOW }];
      calls.length = 0;
      resetRec(); await recBoot();
      ok('cold start: reattached to the recording that kept going, with its time', !!_lr && _lr.id === 'rX' && _lr.src === 'native' && recElapsed(_lr) >= 600000 && !calls.some(c => c[0] === 'start'));
      await until(() => _recs.has('rX'));
      ok('…which gets a record if it had none, and is not taken for a finished file', _recs.get('rX').state === 'live');
      ok('…one cut short by the process dying is finished from status().recovered, with its length and final file', (_recs.get('rV') || {}).state === 'done' && _recs.get('rV').dur === 90000
        && _recs.get('rV').uri === 'file:///data/rec/rV.m4a' && _recs.get('rV').cut === true, _recs.get('rV'));
      ok('…one stopped while the app was closed is finished from the file list', _recs.get('rY').state === 'done' && _recs.get('rY').size === 5000);
      ok('…one whose file is missing is dropped', !_recs.has('rW'));
      ok('…and a file with no record is listed, not left invisible', (_recs.get('rZ') || {}).state === 'done' && _recs.get('rZ').size === 7000);
      recStart(); await sleep(30);
      ok('a widget/shortcut start while one is going starts no second recording', !calls.some(c => c[0] === 'start') && _lr.id === 'rX');
      await recStop(); await until(() => !_lr);

      // stop() says nothing was captured
      const stopReal = LR.stop;
      recStart(); await until(() => !!_lr);
      const nid3 = _lr.id;
      LR.stop = async () => { const e = new Error('Nothing was recorded.'); e.code = 'empty'; throw e; };
      await recStop();
      ok('native stop that captured nothing: no recording kept, the screen is idle', !_lr && !_recs.has(nid3));
      LR.stop = stopReal;
      // the ending event says nothing was captured
      recStart(); await until(() => !!_lr);
      const nid4 = _lr.id;
      listener({ state: 'idle', id: nid4, elapsedMs: 50, reason: 'notification', empty: true });
      await sleep(20);
      ok('…the same when it ends from the notification with nothing captured', !_lr && !_recs.has(nid4));

      // delete a native recording: the file goes once the Undo time is up
      await recDelete('rY'); await recHardDelete('rY');
      ok('native delete: the plugin removes the file, then the record goes', calls.some(c => c[0] === 'remove' && c[1] === 'rY') && !_recs.has('rY'));

      /* ---- the widget's mic and the launcher shortcut ---- */
      let queue = [];
      window.Capacitor.Plugins.WidgetBridge = { consumeActions: async () => { const a = queue; queue = []; return { actions: a }; }, update: () => Promise.resolve({}) };
      calls.length = 0; navigateTo('today');
      queue = [{ action: 'record', at: Date.now() - 1000 }, { action: 'record', at: Date.now() - 500 }];
      await drainWidgetActions(); await until(() => calls.some(c => c[0] === 'start'));
      ok('widget/shortcut tap: opens Recordings and starts ONE recording', isOn('recordings') && calls.filter(c => c[0] === 'start').length === 1 && !!_lr);
      await recStop(); await until(() => !_lr);
      calls.length = 0; navigateTo('today');
      queue = [{ action: 'record', at: Date.now() - 5 * 60000 }];
      await drainWidgetActions(); await sleep(30);
      ok('…a stale tap only opens the screen', isOn('recordings') && !calls.some(c => c[0] === 'start') && !_lr);
      let n3 = Date.now(); if (todayStr(new Date(n3 - 10000)) !== todayStr(new Date(n3))) n3 -= 11000;
      const D3 = todayStr(new Date(n3)), e3 = DB.entries(); delete e3[D3]; DB.saveEntries(e3);
      calls.length = 0; navigateTo('today');
      queue = [{ action: 'mood', mood: 9, at: n3 - 3000 }, { action: 'record', at: Date.now() - 1000 }];
      await drainWidgetActions(); await until(() => calls.some(c => c[0] === 'start'));
      ok('…a mood tap in the same queue is still saved, and Recordings opens', (DB.entry(D3) || {}).mood === 9 && isOn('recordings') && !!_lr);
      await recStop(); await until(() => !_lr);

      /* ---- delete everything ---- */
      files = [{ id: 'rQ', uri: 'q', bytes: 10 }];
      await recWipe();
      ok('delete everything: every recording file is removed and the database is gone', calls.some(c => c[0] === 'remove' && c[1] === 'rQ') && !shim.dbs.has(REC_DB) && _recs.size === 0);

      /* ---- review fixes (2026-11-22) ---- */
      resetRec(); files = []; status = { state: 'idle' }; await recBoot();
      // #4 start-up reconcile races
      await recPut({ id: 'rF', src: 'native', state: 'live', ts: NOW, day: todayStr() });
      files = [{ id: 'rF', uri: 'file:///data/rec/rF.m4a', bytes: 9000, modifiedAt: NOW }];
      _recFinishing.add('rF'); await recNativeAttach(); _recFinishing.delete('rF');
      ok('#4 a stop still saving is not finished by the reconcile (its real length comes from stop())', _recs.get('rF').state === 'live' && !_recs.get('rF').dur);
      await recForget('rF');
      const statusOk = LR.status;
      LR.status = async () => { throw new Error('no'); };
      await recPut({ id: 'rR', src: 'native', state: 'live', ts: NOW, day: addDays(todayStr(), -2) });
      await recPut({ id: 'rS', src: 'native', state: 'live', ts: NOW, day: todayStr() });
      files = [{ id: 'rR', uri: 'file:///data/rec/rR.aac', bytes: 3000, modifiedAt: NOW, recording: true }];
      await recNativeAttach();
      ok('#4 status() failing: one the list says is still recording is left alone', (_recs.get('rR') || {}).state === 'live' && _recs.get('rR').day === addDays(todayStr(), -2));
      ok('#4 …and no live record is forgotten when status() could not be read', (_recs.get('rS') || {}).state === 'live');
      LR.status = statusOk; files = [];
      _lrStarting = true; await recNativeAttach(); _lrStarting = false;
      ok('#4 nor while a start is pending (it may be the one starting, with its chosen day)', _recs.has('rR') && _recs.has('rS'));
      await recNativeAttach();
      ok('#4 …with status() known and nothing starting, a live record with no file is dropped as before', !_recs.has('rR') && !_recs.has('rS'));

      // #5 a widget start is today's, whatever Log day opened Recordings last
      let queue2 = [];
      window.Capacitor.Plugins.WidgetBridge = { consumeActions: async () => { const a = queue2; queue2 = []; return { actions: a }; }, update: () => Promise.resolve({}) };
      _recFor = addDays(todayStr(), -3); show('recordings');
      queue2 = [{ action: 'record', at: Date.now() - 500 }]; calls.length = 0;
      await drainWidgetActions(); await until(() => !!_lr && _recs.has(_lr.id));
      ok('#5 a widget/shortcut recording lands on today, not on an old Log day', _recs.get(_lr.id).day === todayStr(), _recs.get(_lr.id).day);

      // #6 voice typing waits while a recording holds the microphone
      navigateTo('today');
      await dictateInto('[data-txt=journal]', null);
      ok('#6 🎤 Speak is refused while a recording runs', /recording is going/.test(document.getElementById('toast').textContent) && !_recogOn, document.getElementById('toast').textContent);

      // #7 a native stop in flight holds off an app-update reload
      const stopSlow = LR.stop; let release;
      LR.stop = () => new Promise(r => { release = () => r({ id: _lr ? _lr.id : 'x', uri: 'file:///data/rec/s.m4a', durationMs: 5000, bytes: 4000 }); });
      const stopping = recStop(); await sleep(10);
      ok('#7 an app-update reload waits while a native stop is saving', mediaBusyNow() && !!_lr && _lr.stopping);
      release(); await stopping; LR.stop = stopSlow;
      ok('#7 …and not after', !mediaBusyNow());

      // #8 remove() answering removed:false is not a delete
      const rmOk = LR.remove;
      await recPut({ id: 'rH', src: 'native', state: 'done', ts: NOW, day: todayStr(), uri: 'file:///data/rec/rH.m4a', size: 10, dur: 5000 });
      files = [{ id: 'rH', uri: 'file:///data/rec/rH.m4a', bytes: 10, modifiedAt: NOW }];
      LR.remove = async () => ({ removed: false });
      await recHardDelete('rH');
      ok('#8 remove() saying removed:false with the file still there keeps the record (tried again later)', _recs.has('rH'));
      files = [];
      await recHardDelete('rH');
      ok('#8 …and once the list no longer has the file, the record goes', !_recs.has('rH'));
      LR.remove = rmOk;

      // #10 a finished recording whose file is not on this phone is marked, not dropped
      await recPut({ id: 'rM', src: 'native', state: 'done', ts: NOW, day: todayStr(), uri: 'file:///data/rec/rM.m4a', size: 5000, dur: 60000, title: 'Kept name', transcript: 'kept words' });
      files = []; await recNativeAttach();
      ok('#10 its file missing: kept and marked, with its name and transcript', _recs.get('rM').missing === true && _recs.get('rM').title === 'Kept name' && recShown([..._recs.values()]).some(r => r.id === 'rM'));
      ok('#10 …not counted as space used', recTotals().bytes === [..._recs.values()].filter(r => r.state === 'done' && !r.del && !r.missing).reduce((a, r) => a + (r.size || 0), 0));
      show('recordings'); _recOpen = 'rM'; recRefresh();
      ok('#10 …the row says so, with no player or Share, and Delete still there', /not on this phone/.test(document.querySelector('[data-rec-id="rM"]').textContent)
        && !document.querySelector('[data-rec-id="rM"] [data-rec-scrub]') && !document.querySelector('[data-rec-id="rM"] [data-rec-share]') && !!document.querySelector('[data-rec-id="rM"] [data-rec-del]'));
      files = [{ id: 'rM', uri: 'file:///data/rec/rM.m4a', bytes: 5000, modifiedAt: NOW }]; await recNativeAttach();
      ok('#10 …and the mark goes when the file is back', !_recs.get('rM').missing);
      _recOpen = null;

      // #11 Android 7-9: start_failed right after the web mic probe is tried once more
      let fails = 1; const startOk = LR.start;
      LR.start = async (o) => { calls.push(['start', o]); if (fails-- > 0) { const e = new Error('refused'); e.code = 'start_failed'; throw e; } return { id: o.id, uri: 'file:///data/rec/' + o.id + '.aac' }; };
      calls.length = 0; recStart(); await until(() => !!_lr, 3000);
      ok('#11 start_failed once: retried after a moment, and recording', !!_lr && calls.filter(c => c[0] === 'start').length === 2 && calls[0][1].id === calls[1][1].id);
      await recStop(); await until(() => !_lr);
      fails = 2; calls.length = 0; const before = _recs.size;
      await recStart();
      ok('#11 …refused twice: says so, and keeps no empty record', !_lr && calls.filter(c => c[0] === 'start').length === 2 && _recs.size === before && /would not start/.test(document.getElementById('toast').textContent));
      LR.start = startOk;

      // the native side's new ending reasons. Every toast is recorded rather than reading the one on
      // screen: a recovered recording's own toast fires 1.8 s after recovery and could land on top.
      const recToasts = [], recT0 = window.toast; window.toast = (m, e) => { recToasts.push(m); return recT0(m, e); };
      recStart(); await until(() => !!_lr);
      const nS = _lr.id; listener({ state: 'idle', id: nS, uri: 'file:///data/rec/' + nS + '.m4a', durationMs: 70000, bytes: 9000, reason: 'storage' });
      await until(() => (_recs.get(nS) || {}).state === 'done');
      ok('reason storage: "Recording stopped: phone storage is almost full"', recToasts.some(m => /^Recording stopped: phone storage is almost full/.test(m)), recToasts);
      recStart(); await until(() => !!_lr);
      const nC = _lr.id; listener({ state: 'idle', id: nC, uri: 'file:///data/rec/' + nC + '.m4a', durationMs: REC_MAX_MS, bytes: 9000, reason: 'cap' });
      await until(() => (_recs.get(nC) || {}).state === 'done');
      ok('reason cap: "Recording stopped at 3 hours"', recToasts.some(m => /^Recording stopped at 3 hours/.test(m)), recToasts);
      window.toast = recT0;

      // #9 browser, two tabs: a web recording holds a Web Lock; another tab's start-up leaves it alone
      delete window.Capacitor;
      const held = new Set(), requested = [];
      Object.defineProperty(navigator, 'locks', { configurable: true, value: {
        request: (name, fn) => { requested.push(name); held.add(name); return Promise.resolve(fn({ name })).then(() => { held.delete(name); }); },
        query: async () => ({ held: [...held].map(name => ({ name })) }) } });
      try {
        recStart(); await until(() => !!_lr && _lr.src === 'web');
        const wid = _lr.id; SliceMR.last.emit('qq'); await sleep(30);
        ok('#9 a web recording takes a lock named after it', requested.includes(REC_LOCK + wid) && held.has(REC_LOCK + wid));
        // a second tab boots now: same database, this recording still going
        const lrKeep = _lr; _lr = null; _recs.clear(); _recBootP = null; _recReady = false;
        await recBoot();
        ok('#9 another tab starting up does not "recover" it or delete its slices', (_recs.get(wid) || {}).state === 'live' && (await recGetAll('chunks')).some(c => c.rid === wid));
        _lr = lrKeep; _recs.set(wid, Object.assign({}, _recs.get(wid)));
        await recStop(); await until(() => !_lr && !_recSaving && (_recs.get(wid) || {}).state === 'done');
        await sleep(10);
        ok('#9 …and the lock is let go once it is saved', !held.has(REC_LOCK + wid));
        // a recording whose lock nobody holds (its tab was killed) is recovered as before
        await recTx('recs', st2 => st2.put({ id: 'rL', src: 'web', state: 'live', ts: NOW, day: todayStr(), mime: 'audio/webm' }));
        await recTx('chunks', st2 => st2.put({ k: 'rL:000000', rid: 'rL', seq: 0, blob: new Blob(['zzzz']), ms: 4000 }));
        resetRec(); await recBoot();
        ok('#9 …while one with no lock held (its tab died) is recovered', (_recs.get('rL') || {}).state === 'done' && _recs.get('rL').cut === true);
      } finally { delete navigator.locks; }
    } catch (e) {
      fail++; R.push('FAIL the recordings block threw: ' + (e && e.stack || e));
    } finally {
      resetRec();
      window.Capacitor = capSnap; if (window.Capacitor === undefined) delete window.Capacitor;
      if (idbSnap2 === undefined) delete window.indexedDB; else window.indexedDB = idbSnap2;
      if (mrSnap2 === undefined) delete window.MediaRecorder; else window.MediaRecorder = mrSnap2;
      delete navigator.mediaDevices; window.confirm = confSnap2;
      URL.createObjectURL = urlC2; URL.revokeObjectURL = urlR2;
      if (eSnap != null) localStorage.setItem('dp.entries', eSnap); else localStorage.removeItem('dp.entries');
      if (obSnap != null) localStorage.setItem('dp.onboarded', obSnap); else localStorage.removeItem('dp.onboarded');
      shim.dbs.delete(REC_DB);
      navigateTo('today');
    }
  }
  /* ---------- v273: App lock ---------- */
  {
    const lkSnap = localStorage.getItem('dp.lock'), lfSnap = localStorage.getItem('dp.lockFail'), tSnap = window.toast;
    const toasts = []; window.toast = m => toasts.push(m);
    const $ = s => document.querySelector(s);
    const tap = s => { const b = $(s); if (b) b.click(); return !!b; };
    const keys = async str => { for (const d of (str === 'ok' ? ['ok'] : str)) { const b = $(`[data-lk-key="${d}"]`); if (b) b.click(); await sleep(0); } };
    const open = () => !!(_lk) && $('#lock').classList.contains('on') && document.documentElement.classList.contains('locked');
    const settled = () => until(() => !_lk || !_lk.busy, 4000);
    const page = () => { navigateTo('settings'); settingsPage = 'lock'; renderSettings(); };
    try {
      localStorage.removeItem('dp.lock'); localStorage.removeItem('dp.lockFail'); lockHide();
      ok('lock: off by default, and the page offers "Set a PIN"', !lockOn() && (page(), !!$('#lock-set')));
      settingsPage = null; renderSettings();
      ok('lock: Settings row says it is off', /App lock/.test($('#s-settings').textContent) && /Off · set a PIN/.test($('#s-settings').textContent));
      page(); tap('#lock-set');
      ok('lock: Set a PIN opens the keypad over everything', open() && _lk.mode === 'set1');
      await keys('123');
      ok('lock: OK stays off below 4 digits', $('[data-lk-key="ok"]').disabled);
      await keys('4');
      ok('lock: …and turns on at 4', !$('[data-lk-key="ok"]').disabled);
      await keys('ok');
      ok('lock: OK asks for the PIN again', _lk.mode === 'set2' && $('.lk-h').textContent === 'Type it again');
      await keys('1235');
      ok('lock: a mismatch starts over and says why', _lk.mode === 'set1' && /did not match/.test($('.lk-msg').textContent));
      await keys('1234'); await keys('ok'); await keys('1234'); await until(() => _lk && _lk.mode === 'code', 4000);
      const code = _lk && _lk.code;
      ok('lock: a recovery code follows, 10 clear characters', /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/.test(code || ''), code);
      ok('lock: nothing is saved before "I saved it"', !lockOn());
      tap('#lk-saved');
      const cfg = lockCfg();
      ok('lock: "I saved it" turns the lock on and closes the keypad', lockOn() && !open() && toasts.some(m => /App lock is on/.test(m)));
      ok('lock: only salted hashes are stored, never the PIN or the code',
        cfg.len === 4 && cfg.salt && cfg.hash && cfg.rs && cfg.rh && !/1234/.test(localStorage.getItem('dp.lock')) && localStorage.getItem('dp.lock').indexOf(code.replace('-', '')) < 0);
      ok('lock: the page now shows the choices', !!$('#lock-off') && $('[data-lock-after].on').dataset.lockAfter === '1');
      settingsPage = null; renderSettings();
      ok('lock: Settings row says when it asks', /On · asks for your PIN after 1 minute away/.test($('#s-settings').textContent));

      // unlocking
      tap('#open-style'); lockShow('unlock');
      await keys('9999'); await settled();
      ok('lock: a wrong PIN keeps it locked and says so', open() && /Wrong PIN/.test($('.lk-msg').textContent) && lockFails().n === 1);
      await keys('1234'); await settled();
      ok('lock: the right PIN opens Daylog and clears the count', !open() && !localStorage.getItem('dp.lockFail'));
      ok('lock: an unlock screen has "Forgot PIN?"', (lockShow('unlock'), !!$('#lk-forgot')) && !$('#lk-cancel'));
      // throttle
      for (let i = 0; i < 5; i++) { await keys('0000'); await settled(); }
      ok('lock: five wrong tries make it wait', lockWaitMs() > 20000 && /Try again in 0:[0-9]{2}/.test($('.lk-msg').textContent), $('.lk-msg').textContent);
      ok('lock: …with the keypad switched off', $('[data-lk-key="1"]').disabled);
      await keys('1234'); await sleep(30);
      ok('lock: …so even the right PIN waits', open());
      localStorage.removeItem('dp.lockFail'); lockRender(); await keys('1234'); await settled();
      ok('lock: after the wait it opens', !open());
      // keyboard
      lockShow('unlock');
      for (const k of '1234') document.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
      await settled();
      ok('lock: a keyboard works too', !open());

      // leaving and coming back
      lockAway();
      ok('lock: leaving puts the lock screen up at once (recent-apps thumbnail)', open() && _lk.soft);
      lockBack();
      ok('lock: back within a minute, it comes down without a PIN', !open());
      lockAway(); _lockAway = Date.now() - 2 * 60000; lockBack();
      ok('lock: back after 2 minutes, it asks for the PIN', open() && !_lk.soft);
      await keys('1234'); await settled();
      lockShow('verify', { then: 'off' }); lockAway(); _lockAway = Date.now() - 2 * 60000; lockBack();
      ok('lock: a Settings step left open turns into the real lock (Cancel must not open the app)', open() && _lk.mode === 'unlock' && !$('#lk-cancel'));
      await keys('1234'); await settled();
      page(); tap('[data-lock-after="0"]');
      ok('lock: "Right away" is saved', lockCfg().after === 0 && lockAfterMin() === 0);
      lockAway(); _lockAway = Date.now() - 3000; lockBack();
      ok('lock: right away still lets a photo picker come back (10 s grace)', !open());
      lockAway(); _lockAway = Date.now() - 11000; lockBack();
      ok('lock: right away asks after 11 s', open());
      await keys('1234'); await settled();
      page(); tap('[data-lock-after="1"]');

      // back button
      lockShow('unlock'); handleBack();
      ok('lock: Back on the lock screen never opens the app', open());
      await keys('1234'); await settled();
      lockShow('verify', { then: 'off' }); handleBack();
      ok('lock: Back cancels a Settings step, and the lock stays on', !open() && lockOn());

      // change PIN (keeps the recovery code)
      const rh0 = lockCfg().rh;
      page(); tap('#lock-change');
      ok('lock: Change PIN asks for the current one first', open() && _lk.mode === 'verify');
      await keys('1111'); await settled();
      ok('lock: …and a wrong one is refused', _lk.mode === 'verify' && /Wrong PIN/.test($('.lk-msg').textContent));
      await keys('1234'); await settled();
      ok('lock: …then asks for the new one', _lk.mode === 'set1' && /new PIN/.test($('.lk-h').textContent));
      await keys('567890');
      ok('lock: 6 digits move on without OK', _lk.mode === 'set2');
      await keys('567890'); await until(() => !open(), 4000);
      ok('lock: the new PIN is saved, the recovery code kept', lockCfg().len === 6 && lockCfg().rh === rh0 && toasts.some(m => /PIN changed/.test(m)));
      lockShow('unlock'); await keys('1234');
      ok('lock: the old PIN is no longer accepted as complete', open());
      await keys('90'); await settled();
      ok('lock: …and 6 digits of the old one are wrong', open() && /Wrong PIN/.test($('.lk-msg').textContent));
      await keys('567890'); await settled();
      ok('lock: the new one opens it', !open());
      localStorage.removeItem('dp.lockFail');

      // recovery code
      lockShow('unlock'); tap('#lk-forgot');
      ok('lock: Forgot PIN asks for the recovery code', _lk.mode === 'recover' && !!$('#lk-codein'));
      $('#lk-codein').value = 'ABCDE-FGHJK'; $('#lk-codein').dispatchEvent(new Event('input', { bubbles: true })); tap('#lk-recover'); await settled();
      ok('lock: a wrong code is refused', open() && /does not match/.test($('.lk-msg').textContent));
      $('#lk-codein').value = '12'; tap('#lk-recover'); await settled();
      ok('lock: a short code says what a code looks like', /10 letters and numbers/.test($('.lk-msg').textContent));
      handleBack();
      ok('lock: Back from the code goes back to the PIN, still locked', open() && _lk.mode === 'unlock');
      tap('#lk-forgot');
      $('#lk-codein').value = ' ' + code.toLowerCase().replace('-', ' ') + ' '; tap('#lk-recover'); await until(() => !open(), 4000);
      ok('lock: the saved code (any case, spaces) unlocks and turns the lock off', !open() && !lockOn());
      ok('lock: …and lands on App lock to set a new PIN', settingsPage === 'lock' && !!$('#lock-set') && toasts.some(m => /set a new PIN/.test(m)));

      // a new recovery code; turning it off
      tap('#lock-set'); await keys('2468'); await keys('ok'); await keys('2468'); await until(() => _lk && _lk.mode === 'code', 4000);
      ok('lock: Cancel on a first recovery code saves nothing', (tap('#lk-cancel'), !lockOn() && !open()));
      tap('#lock-set'); await keys('2468'); await keys('ok'); await keys('2468'); await until(() => _lk && _lk.mode === 'code', 4000); tap('#lk-saved');
      const rh1 = lockCfg().rh;
      tap('#lock-code'); await keys('2468'); await until(() => _lk && _lk.mode === 'code', 4000);
      const code2 = _lk.code; tap('#lk-cancel');
      ok('lock: Cancel on a new recovery code keeps the old one', lockCfg().rh === rh1);
      tap('#lock-code'); await keys('2468'); await until(() => _lk && _lk.mode === 'code', 4000);
      ok('lock: each new recovery code is different', _lk.code !== code2);
      tap('#lk-saved');
      ok('lock: …and saving it replaces the old one', lockCfg().rh !== rh1 && toasts.some(m => /old one no longer works/.test(m)));
      tap('#lock-off'); await keys('2468'); await until(() => !open(), 4000);
      ok('lock: Turn off asks for the PIN, then turns it off', !lockOn() && toasts.some(m => /App lock is off/.test(m)));

      // not synced, not backed up; bad stored values
      localStorage.setItem('dp.lock', JSON.stringify({ v: 1, len: 4, it: 1000, salt: 'AAAA', hash: 'AAAA', after: 1 }));
      ok('lock: backups leave the lock out', BACKUP_EXCLUDED.includes('lock') && BACKUP_EXCLUDED.includes('lockFail') && !('lock' in backupBlob().data));
      ok('lock: the sync payload builder never names it', !/dp\.lock|lockCfg/.test(pushState.toString()));
      localStorage.setItem('dp.lock', '{broken');
      ok('lock: a broken stored value is "off", not a locked-out app', !lockOn());
      localStorage.setItem('dp.lock', JSON.stringify({ hash: 'x', salt: 'y', len: 9 }));
      ok('lock: an impossible PIN length is "off" too', !lockOn());
      ok('lock: index.html hides the app before the first paint when a lock is set',
        /localStorage\.getItem\('dp\.lock'\)\) document\.documentElement\.classList\.add\('locked'\)/.test(document.documentElement.innerHTML));
    } catch (e) {
      ok('lock: suite ran without throwing', false, String(e && e.stack || e).slice(0, 300));
    } finally {
      lockHide();
      if (lkSnap != null) localStorage.setItem('dp.lock', lkSnap); else localStorage.removeItem('dp.lock');
      if (lfSnap != null) localStorage.setItem('dp.lockFail', lfSnap); else localStorage.removeItem('dp.lockFail');
      window.toast = tSnap; settingsPage = null; navigateTo('today');
    }
  }
  /* ---------- v274: CSV import reads the picked file ---------- */
  {
    const spSnap = settingsPage;
    try {
      navigateTo('settings'); settingsPage = 'data'; renderSettings();
      const inp = document.getElementById('csvi-file');
      Object.defineProperty(inp, 'files', { configurable: true, value: [new File(['date,mood\n2026-01-05,7\n'], 'mine.csv', { type: 'text/csv' })] });
      inp.dispatchEvent(new Event('change', { bubbles: true }));
      await until(() => !!_csvImp, 2000);
      ok('csv: picking a file reads it and shows the preview', !!_csvImp && _csvImp.name === 'mine.csv' && /mine\.csv/.test(document.getElementById('s-settings').textContent) && !!document.getElementById('csvi-go'), _csvImp);
    } finally { _csvImp = null; settingsPage = spSnap; navigateTo('today'); }
  }
  return { pass, fail, results: R };
})();
