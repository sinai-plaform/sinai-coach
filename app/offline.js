/* ===== SINAI Club — working without signal =====
   Every call the app makes to the database passes through OFF.fetch.
   • Reads  — answered by the network when it answers quickly; otherwise by the copy
              saved on the tablet the last time that screen was opened.
   • Writes — sent straight away when possible. Otherwise they wait in an outbox on the
              tablet and go out by themselves when the connection returns.
              Whatever the coach enters is saved on the tablet first, so nothing is lost.
   Update rules
   • New rows get their id on the tablet, so sending the same row twice can never
     create a duplicate (the server answers "already there" and we move on).
   • Ratings are separate rows — nothing overwrites anything.
   • Attendance: the mark made LATER on the pitch wins, not the one that synced last.
   • The outbox is sent strictly in order (a session before its drills and attendance). */
const OFF = (() => {
  const REST = '/rest/v1/';
  const DATA_CACHE = 'sc-data-v1';
  const READ_WAIT = 4000;        // ms to wait for the network before showing the saved copy
  const WRITE_WAIT = 8000;
  const KEEP_DAYS = 30, KEEP_MAX = 400;
  // tables whose id is generated — we generate it on the tablet instead
  const ID_TABLES = new Set(['coach_clubs','coach_cycles','coach_devices','coach_discipline','coach_goals',
    'coach_guardians','coach_invites','coach_match_events','coach_matches','coach_members','coach_messages',
    'coach_observations','coach_players','coach_session_drills','coach_sessions','coach_teams','coach_tests','coach_xp_events']);
  // already shown from the tablet's own list of ratings (LOCAL_OBS), so not added twice
  const NO_OVERLAY = new Set(['coach_observations']);
  const realFetch = window.fetch.bind(window);
  const hasCache = typeof caches !== 'undefined';

  const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
  let outbox = ls('sc.outbox') || [];
  let failed = ls('sc.outbox_failed') || [];
  let flushing = false, getToken = null, onChange = () => {}, onSynced = () => {};
  const save = () => { ls('sc.outbox', outbox); ls('sc.outbox_failed', failed.slice(-50)); onChange(); };

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
    const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
  }

  /* ---------- request helpers ---------- */
  function timed(url, init, ms) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    return realFetch(url, Object.assign({}, init, { signal: ac.signal })).finally(() => clearTimeout(t));
  }
  const tableOf = url => decodeURIComponent(new URL(url).pathname.split(REST)[1] || '');
  const wantsObject = h => /vnd\.pgrst\.object/.test(h.get('Accept') || '');
  const json = (body, status, extra) => new Response(body == null ? null : JSON.stringify(body),
    { status, headers: Object.assign({ 'Content-Type': 'application/json' }, extra || {}) });
  const offlineError = () => json({ message: 'אין חיבור — המידע הזה עוד לא נשמר במכשיר', code: 'OFFLINE' }, 503);

  /* ---------- filters (to merge the outbox into saved reads) ---------- */
  const SKIP = new Set(['select','order','limit','offset','on_conflict','columns']);
  function filtersOf(url) {
    const out = [];
    for (const [k, v] of new URL(url).searchParams) {
      if (SKIP.has(k)) continue;
      if (k === 'or' || k === 'and' || k.includes('.')) return null;     // too complex: don't guess
      const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|in|is)\.(.*)$/.exec(v); if (!m) return null;
      let val = m[3];
      if (m[2] === 'in') val = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, ''));
      out.push({ col: k, op: m[2], not: !!m[1], val });
    }
    return out;
  }
  function rowMatches(row, filters) {
    return filters.every(f => {
      if (!(f.col in row)) return true;                 // column not known here — don't drop the row
      const v = row[f.col] == null ? null : String(row[f.col]);
      let ok;
      switch (f.op) {
        case 'eq': ok = v === f.val; break;
        case 'neq': ok = v !== f.val; break;
        case 'gt': ok = v != null && v > f.val; break;
        case 'gte': ok = v != null && v >= f.val; break;
        case 'lt': ok = v != null && v < f.val; break;
        case 'lte': ok = v != null && v <= f.val; break;
        case 'in': ok = f.val.includes(v); break;
        case 'is': ok = f.val === 'null' ? v == null : String(v) === f.val; break;
        default: ok = true;
      }
      return f.not ? !ok : ok;
    });
  }
  // apply the writes still waiting in the outbox to a list of rows, so screens show them
  function overlay(url, rows) {
    const table = tableOf(url);
    if (NO_OVERLAY.has(table) || !outbox.some(o => o.table === table)) return rows;
    const sel = new URL(url).searchParams.get('select') || '*';
    const filters = filtersOf(url);
    if (!filters || sel.includes('(')) return rows;
    rows = rows.map(r => Object.assign({}, r));
    for (const it of outbox) {
      if (it.table !== table) continue;
      if (it.method === 'POST') {
        const keys = (new URL(it.url).searchParams.get('on_conflict') || 'id').split(',');
        for (const r of [].concat(JSON.parse(it.body || '[]'))) {
          const same = rows.find(x => keys.every(k => k in x && String(x[k]) === String(r[k])));
          if (same) Object.assign(same, r);
          else if (rowMatches(r, filters)) rows.push(Object.assign({}, r));
        }
      } else {
        const f2 = filtersOf(it.url) || [];
        if (it.method === 'PATCH') { const p = JSON.parse(it.body || '{}'); rows.forEach(x => { if (rowMatches(x, f2)) Object.assign(x, p); }); }
        if (it.method === 'DELETE') rows = rows.filter(x => !rowMatches(x, f2));
      }
    }
    return rows.filter(x => rowMatches(x, filters));
  }
  async function withOverlay(url, res, obj) {
    const table = tableOf(url);
    if (NO_OVERLAY.has(table) || !outbox.some(o => o.table === table)) return res;
    let body = null;
    try { body = await res.clone().json(); } catch (e) { return res; }
    const rows = overlay(url, obj ? (body ? [body] : []) : (Array.isArray(body) ? body : []));
    if (obj) return rows[0] ? json(rows[0], 200) : res;
    return json(rows, 200, { 'Content-Range': res.headers.get('Content-Range') || '' });
  }

  /* ---------- the saved copy of reads ---------- */
  const keyOf = (url, h) => url + (url.includes('?') ? '&' : '?') + '__sc=' +
    (wantsObject(h) ? 'o' : 'a') + (/count=/.test(h.get('Prefer') || '') ? 'c' : '');
  async function remember(key, res) {
    if (!hasCache) return;
    try {
      const body = await res.text();
      const c = await caches.open(DATA_CACHE);
      await c.put(key, new Response(body, { status: res.status, headers: {
        'Content-Type': 'application/json', 'Content-Range': res.headers.get('Content-Range') || '', 'sc-at': String(Date.now()) } }));
      if (Math.random() < 0.05) tidy();
    } catch (e) {}
  }
  async function recall(key) {
    if (!hasCache) return null;
    try { const c = await caches.open(DATA_CACHE); return await c.match(key) || null; } catch (e) { return null; }
  }
  async function tidy() {                                  // keep the saved copies small
    try {
      const c = await caches.open(DATA_CACHE), keys = await c.keys(), stamped = [];
      for (const k of keys) { const r = await c.match(k); stamped.push([k, +(r && r.headers.get('sc-at')) || 0]); }
      stamped.sort((a, b) => b[1] - a[1]);
      const old = Date.now() - KEEP_DAYS * 864e5;
      for (let i = 0; i < stamped.length; i++) if (i >= KEEP_MAX || stamped[i][1] < old) await c.delete(stamped[i][0]);
    } catch (e) {}
  }

  async function read(url, init, h) {
    const key = keyOf(url, h), obj = wantsObject(h);
    const savedCopy = async () => { const r = await recall(key); return r ? withOverlay(url, r, obj) : null; };
    const fromSaved = async () => {
      const r = await savedCopy(); if (r) return r;
      // never opened before — but maybe it was just created here without signal
      const rows = overlay(url, []);
      return rows.length ? json(obj ? rows[0] : rows, 200) : null;
    };
    if (!navigator.onLine) return (await fromSaved()) || offlineError();
    const net = realFetch(url, init).then(async res => {
      if (res.ok) await remember(key, res.clone());
      return res;
    });
    const timer = new Promise(r => setTimeout(() => r(null), READ_WAIT));
    try {
      const first = await Promise.race([net, timer]);
      if (first) return withOverlay(url, first, obj);
      const saved = await savedCopy();                   // network is slow: show the saved copy now
      if (saved) { net.catch(() => {}); return saved; }
      return withOverlay(url, await net, obj);
    } catch (e) {
      const saved = await fromSaved();
      return saved || offlineError();
    }
  }

  /* ---------- writes ---------- */
  function representation(item, h) {
    const wantRows = /return=representation/.test(item.prefer || '');
    if (!wantRows) return new Response(null, { status: item.method === 'POST' ? 201 : 204 });
    if (item.method !== 'POST') return json(wantsObject(h) ? {} : [], 200);
    const rows = [].concat(JSON.parse(item.body || '[]'));
    return json(wantsObject(h) ? rows[0] : rows, 201);
  }
  async function write(url, init, h, method, table) {
    let body = init.body;
    const isUpsert = /resolution=/.test(h.get('Prefer') || '') || new URL(url).searchParams.has('on_conflict');
    if (method === 'POST' && !isUpsert && ID_TABLES.has(table) && typeof body === 'string' && body) {
      try {
        const parsed = JSON.parse(body);
        const add = r => (r && typeof r === 'object' && !r.id) ? Object.assign({ id: uuid() }, r) : r;
        body = JSON.stringify(Array.isArray(parsed) ? parsed.map(add) : add(parsed));
        // for lists the client names the columns to insert — the id has to be one of them
        const u = new URL(url), cols = u.searchParams.get('columns');
        if (cols && !/(^|,)"?id"?(,|$)/.test(cols)) { u.searchParams.set('columns', cols + ',"id"'); url = u.toString(); }
      } catch (e) {}
    }
    const item = { k: uuid(), at: Date.now(), method, url, table, body, prefer: h.get('Prefer') || '' };
    // straight to the server — unless older writes are still waiting (order matters)
    if (navigator.onLine && !outbox.length) {
      const headers = new Headers(h);
      try { return await timed(url, Object.assign({}, init, { headers, body }), WRITE_WAIT); } catch (e) {}
    }
    outbox.push(item); save(); flushSoon();
    return representation(item, h);
  }

  async function offlineFetch(input, init) {
    init = init || {};
    let url = typeof input === 'string' ? input : input.url;
    if (!url.includes(REST)) return realFetch(input, init);          // auth, functions, storage: as is
    const table = tableOf(url);
    const method = (init.method || (input.method) || 'GET').toUpperCase();
    const h = new Headers(init.headers || (input.headers) || {});
    if (table.startsWith('rpc/')) return realFetch(input, init);
    if (method === 'GET' || method === 'HEAD') return read(url, init, h);
    return write(url, init, h, method, table);
  }

  /* ---------- sending the outbox ---------- */
  let flushT = null;
  function flushSoon() { clearTimeout(flushT); flushT = setTimeout(flush, 600); }
  // attendance: drop marks that are older than what the server already has
  async function keepLatestAttendance(it, headers) {
    let rows = [].concat(JSON.parse(it.body || '[]'));
    const bySession = {};
    rows.forEach(r => (bySession[r.session_id] = bySession[r.session_id] || []).push(r));
    const keep = [];
    for (const [sid, list] of Object.entries(bySession)) {
      const q = `${new URL(it.url).origin}${REST}coach_attendance?select=player_id,marked_at&session_id=eq.${sid}` +
        `&player_id=in.(${list.map(r => r.player_id).join(',')})`;
      const res = await timed(q, { headers }, 15000);
      if (!res.ok) throw new Error('check failed');
      const have = {}; (await res.json()).forEach(r => have[r.player_id] = r.marked_at);
      list.forEach(r => { if (!have[r.player_id] || !r.marked_at || new Date(r.marked_at) >= new Date(have[r.player_id])) keep.push(r); });
    }
    return keep;
  }
  async function flush() {
    if (flushing || !outbox.length || !navigator.onLine || !getToken) return;
    flushing = true; onChange();
    let sent = 0;
    try {
      const token = await getToken();
      if (!token) return;
      while (outbox.length) {
        const it = outbox[0];
        const prefer = (it.prefer || '').split(',').map(s => s.trim()).filter(s => s && !s.startsWith('return=')).concat('return=minimal').join(',');
        const headers = { apikey: SB_KEY, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: prefer };
        let body = it.body;
        if (it.table === 'coach_attendance' && it.method === 'POST') {
          try { const keep = await keepLatestAttendance(it, headers); body = JSON.stringify(keep); if (!keep.length) { outbox.shift(); sent++; save(); continue; } }
          catch (e) { break; }
        }
        let res;
        try { res = await timed(it.url, { method: it.method, headers, body }, 15000); }
        catch (e) { break; }                                  // still no connection — try again later
        if (res.ok || res.status === 409) { outbox.shift(); sent++; save(); continue; }   // 409 = already there
        if (res.status === 401 || res.status === 408 || res.status === 429 || res.status >= 500) break;
        // the server refused this row for good — set it aside so it can't hold up the rest
        it.err = res.status + ' ' + (await res.text().catch(() => '')).slice(0, 300);
        failed.push(it); outbox.shift(); save();
        console.warn('sync refused', it.table, it.err);
      }
    } finally {
      flushing = false; onChange();
      if (sent) onSynced(sent);
    }
  }
  addEventListener('online', flushSoon);
  setInterval(() => { if (navigator.onLine && outbox.length) flush(); }, 30000);

  // the logged-in user, read from the tablet when there is no signal to ask the server
  function savedUser() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (/^sb-.*-auth-token$/.test(k)) { const v = JSON.parse(localStorage.getItem(k)); return (v && (v.user || (v.currentSession && v.currentSession.user))) || null; }
      }
    } catch (e) {}
    return null;
  }
  async function clearSaved() { if (hasCache) try { await caches.delete(DATA_CACHE); } catch (e) {} }

  return {
    fetch: offlineFetch, flush, uuid, savedUser, clearSaved,
    pending: () => outbox.length, failedCount: () => failed.length, busy: () => flushing,
    setAuth: f => { getToken = f; }, onChange: f => { onChange = f; }, onSynced: f => { onSynced = f; }
  };
})();
