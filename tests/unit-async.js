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
        ok('…holding its photo and video as blocks, in the order they were taken', ms[0] && ms[0].blocks.map(b => b.t).join('') === 'iv', ms[0] && ms[0].blocks);
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
        ok('"All in one memory" makes one page, dated the first day', memList().length === 3 && memList().some(m => m.date === '2023-12-31' && m.blocks.length === 2), memList().map(m => m.date + ':' + m.blocks.length));
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
