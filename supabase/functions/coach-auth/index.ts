// SINAI Coach — identity endpoint.
// One login for everyone: phone (or username / email) + password.
// The password is created by the person after proving the phone once with an SMS code
// (Twilio Verify) — or, until SMS is on, after entering through the coach's invite link.
// A parent creates the child's account by adding the child's phone (or a username).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';

const URL  = Deno.env.get('SUPABASE_URL')!;
const SRK  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TW_SID = Deno.env.get('TWILIO_ACCOUNT_SID') || '';
const TW_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') || '';
const TW_VERIFY = Deno.env.get('TWILIO_VERIFY_SID') || '';
const admin = createClient(URL, SRK, { auth: { autoRefreshToken: false, persistSession: false } });

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

async function sha256(s: string) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
const rnd = (n = 32) =>
  [...crypto.getRandomValues(new Uint8Array(n))].map(x => x.toString(16).padStart(2, '0')).join('');

// same rules as coach_norm_phone() in the database
function normPhone(p: string): string | null {
  let d = String(p || '').replace(/[^0-9+]/g, '');
  if (d.startsWith('+')) d = '+' + d.slice(1).replace(/[^0-9]/g, '');
  else if (d.startsWith('00')) d = '+' + d.slice(2);
  else if (d.startsWith('0')) d = '+972' + d.slice(1);
  else if (d.length >= 8 && d.length <= 9) d = '+972' + d;
  else d = '+' + d;
  return d.replace(/[^0-9]/g, '').length < 8 ? null : d;
}

const phoneEmail = (phone: string) => `p${phone.replace(/\D/g, '')}@guardian.sinai-coach.app`;
const playerEmail = (id: string) => `u${id.replace(/-/g, '')}@player.sinai-coach.app`;
const kidEmail = (username: string) => `${username}@kid.sinai-coach.app`;
const kidPhoneEmail = (phone: string) => `k${phone.replace(/\D/g, '')}@kid.sinai-coach.app`;

async function mintSession(email: string) {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error) throw error;
  return data.properties.hashed_token;
}

async function twilio(path: string, form: Record<string, string>) {
  const r = await fetch(`https://verify.twilio.com/v2/Services/${TW_VERIFY}/${path}`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + btoa(`${TW_SID}:${TW_TOKEN}`), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(form),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, j };
}

async function userFromAuthHeader(req: Request) {
  const h = req.headers.get('authorization') || '';
  const jwt = h.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user || null;
}

// one auth user per parent phone; every guardian row with that phone (any club) points to it
async function parentUserFor(phone: string) {
  const email = phoneEmail(phone);
  let uid: string;
  const made = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { role: 'parent', phone } });
  if (made.error) {
    const { data: u } = await admin.rpc('coach_user_id_by_email', { p_email: email });
    if (!u) throw made.error;
    uid = u as string;
  } else uid = made.data.user!.id;
  await admin.from('coach_guardians').update({ user_id: uid, last_seen_at: new Date().toISOString() }).eq('phone', phone);
  return { uid, email };
}

// the accounts a phone can sign in to: the parent/coach account, and children registered with that phone
async function accountsFor(phone: string) {
  const out: { id: string; label: string }[] = [];
  const { count } = await admin.from('coach_guardians').select('id', { count: 'exact', head: true }).eq('phone', phone);
  const { data: u } = await admin.rpc('coach_user_id_by_email', { p_email: phoneEmail(phone) });
  if (count || u) out.push({ id: 'me', label: count ? 'אני (הורה)' : 'אני' });
  const { data: kids } = await admin.from('coach_players').select('id,name').eq('phone', phone).eq('login_enabled', true);
  (kids || []).forEach((k: any) => out.push({ id: k.id, label: k.name }));
  return out;
}

// the child's own account, signed in with the child's phone; password null = keep / random
async function kidUser(pl: any, phone: string, password: string | null) {
  const email = kidPhoneEmail(phone);
  let uid = pl.user_id as string | null;
  if (uid) {
    const { data: cur } = await admin.auth.admin.getUserById(uid);
    const { error } = await admin.auth.admin.updateUserById(uid, { email, email_confirm: true, ban_duration: 'none',
      ...(password ? { password } : {}), user_metadata: { ...(cur?.user?.user_metadata || {}), role: 'player', player_id: pl.id, phone, ...(password ? { pw_set: true } : {}) } });
    if (error) throw error;
  } else {
    const made = await admin.auth.admin.createUser({ email, email_confirm: true, password: password || rnd(18),
      user_metadata: { role: 'player', player_id: pl.id, name: pl.name, phone, pw_set: !!password } });
    if (made.error) {
      const { data: u } = await admin.rpc('coach_user_id_by_email', { p_email: email });
      if (!u) throw made.error;
      uid = u as string;
      if (password) await admin.auth.admin.updateUserById(uid, { password });
    } else uid = made.data.user!.id;
  }
  await admin.from('coach_players').update({ user_id: uid }).eq('id', pl.id);
  return uid!;
}

async function bindDevice(uid: string, guardianId: string | null, playerId: string | null, ua: string) {
  const secret = rnd(32);
  await admin.from('coach_devices').insert({
    user_id: uid, guardian_id: guardianId, player_id: playerId,
    secret_hash: await sha256(secret), label: ua.slice(0, 80),
  });
  return secret;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'bad json' }, 400); }
  const action = String(body.action || '');
  const ua = req.headers.get('user-agent') || '';

  try {
    /* ---------- coach account, no confirmation mail ---------- */
    if (action === 'signup') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'אימייל לא תקין' }, 400);
      if (password.length < 6) return json({ error: 'סיסמה קצרה מדי (6 תווים לפחות)' }, 400);
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { role: 'coach' } });
      if (error) return json({ error: /already|exists|registered/i.test(error.message) ? 'כתובת המייל כבר רשומה — נסה להתחבר' : error.message }, 400);
      return json({ ok: true });
    }

    /* ---------- one-time SMS code: first login, forgotten password, new coach ---------- */
    if (action === 'otp_send') {
      const phone = normPhone(body.phone);
      const purpose = body.purpose === 'signup' ? 'signup' : 'login';
      if (!phone) return json({ error: 'מספר טלפון לא תקין' }, 400);
      let options: { id: string; label: string }[] = [];
      if (purpose === 'login') {
        options = await accountsFor(phone);
        if (!options.length) return json({ error: 'המספר הזה עוד לא רשום. הורה — בקשו מהמאמן להוסיף אותו. מאמן חדש — "פתיחת חשבון מאמן".', code: 'unknown' }, 404);
      }
      if (!TW_SID || !TW_TOKEN || !TW_VERIFY) return json({ error: 'אימות ב-SMS עוד לא הופעל. בינתיים: הורים נכנסים בפעם הראשונה דרך הקישור מהמאמן וקובעים שם סיסמה.', code: 'not_configured' }, 503);
      const since = new Date(Date.now() - 3600e3).toISOString();
      const { count: tries } = await admin.from('coach_otp_attempts').select('phone', { count: 'exact', head: true }).eq('phone', phone).gte('at', since);
      if ((tries || 0) >= 5) return json({ error: 'יותר מדי ניסיונות. נסו שוב בעוד שעה.' }, 429);
      await admin.from('coach_otp_attempts').insert({ phone, ok: false, purpose });
      const r = await twilio('Verifications', { To: phone, Channel: 'sms', Locale: 'he' });
      if (!r.ok) return json({ error: 'השליחה נכשלה — נסו שוב בעוד דקה' }, 502);
      return json({ ok: true, phone, options });
    }

    /* ---------- check the code, set the password, sign in ---------- */
    if (action === 'otp_check') {
      const phone = normPhone(body.phone);
      const code = String(body.code || '').replace(/\D/g, '');
      const password = String(body.password || '');
      const purpose = body.purpose === 'signup' ? 'signup' : 'login';
      const who = String(body.who || 'me');
      if (!phone || code.length < 4) return json({ error: 'קוד לא תקין' }, 400);
      if (password.length < 6) return json({ error: 'סיסמה של 6 תווים לפחות' }, 400);
      if (!TW_SID) return json({ error: 'not configured', code: 'not_configured' }, 503);
      const r = await twilio('VerificationCheck', { To: phone, Code: code });
      if (!r.ok || r.j.status !== 'approved') return json({ error: 'הקוד שגוי או שפג תוקפו' }, 401);
      await admin.from('coach_otp_attempts').insert({ phone, ok: true, purpose });

      if (purpose === 'signup') {
        const name = String(body.name || '').trim().slice(0, 60);
        const email = phoneEmail(phone);
        const { data: u } = await admin.rpc('coach_user_id_by_email', { p_email: email });
        if (u) {
          const { data: cur } = await admin.auth.admin.getUserById(u as string);
          await admin.auth.admin.updateUserById(u as string, { password, ban_duration: 'none',
            user_metadata: { ...(cur?.user?.user_metadata || {}), coach: true, name: name || cur?.user?.user_metadata?.name, phone, pw_set: true } });
        } else {
          const made = await admin.auth.admin.createUser({ email, password, email_confirm: true,
            user_metadata: { role: 'coach', coach: true, name, phone, pw_set: true } });
          if (made.error) return json({ error: made.error.message }, 400);
        }
        return json({ ok: true, token_hash: await mintSession(email), role: 'coach' });
      }

      if (who !== 'me') {
        const { data: pl } = await admin.from('coach_players').select('id,name,user_id,phone,login_enabled').eq('id', who).maybeSingle();
        if (!pl || pl.phone !== phone) return json({ error: 'החשבון לא נמצא' }, 404);
        if (!pl.login_enabled) return json({ error: 'ההורה סגר את החשבון הזה' }, 403);
        const uid = await kidUser(pl, phone, password);
        const { data: uu } = await admin.auth.admin.getUserById(uid);
        return json({ ok: true, token_hash: await mintSession(uu!.user!.email!), role: 'player' });
      }
      const { count } = await admin.from('coach_guardians').select('id', { count: 'exact', head: true }).eq('phone', phone);
      const email = phoneEmail(phone);
      let uid: string;
      if (count) uid = (await parentUserFor(phone)).uid;
      else {
        const { data: u } = await admin.rpc('coach_user_id_by_email', { p_email: email });
        if (!u) return json({ error: 'החשבון לא נמצא' }, 404);
        uid = u as string;
      }
      const { data: cur } = await admin.auth.admin.getUserById(uid);
      await admin.auth.admin.updateUserById(uid, { password, user_metadata: { ...(cur?.user?.user_metadata || {}), pw_set: true } });
      return json({ ok: true, token_hash: await mintSession(email) });
    }

    /* ---------- parent opens (or updates) a login for their child ---------- */
    if (action === 'child_set') {
      const user = await userFromAuthHeader(req);
      if (!user) return json({ error: 'צריך להתחבר' }, 401);
      const playerId = String(body.player_id || '');
      const rawPhone = String(body.phone || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const phone = rawPhone ? normPhone(rawPhone) : null;
      if (rawPhone && !phone) return json({ error: 'מספר טלפון לא תקין' }, 400);
      if (!phone && !/^[a-z0-9._]{3,20}$/.test(username)) return json({ error: 'צריך טלפון של הילד, או שם משתמש באנגלית (3–20 תווים)' }, 400);
      if (password && password.length < 6) return json({ error: 'סיסמה של 6 תווים לפחות' }, 400);
      // the caller must be a guardian of this child
      const { data: link } = await admin.from('coach_guardian_players')
        .select('player_id, coach_guardians!inner(user_id)').eq('player_id', playerId).eq('coach_guardians.user_id', user.id).limit(1);
      if (!link || !link.length) return json({ error: 'אין הרשאה לילד הזה' }, 403);
      const { data: pl } = await admin.from('coach_players').select('id,name,user_id,username,phone').eq('id', playerId).single();
      if (phone) {
        const { data: taken } = await admin.from('coach_players').select('id').eq('phone', phone).neq('id', playerId).maybeSingle();
        if (taken) return json({ error: 'המספר הזה כבר משויך לילד אחר' }, 409);
        await admin.from('coach_players').update({ phone, username: null, login_enabled: true, login_opened_at: new Date().toISOString() }).eq('id', playerId);
        await kidUser({ ...pl!, phone }, phone, password || null);
        return json({ ok: true, phone, login: phone, needs_activation: !password });
      }
      if (!password && !pl!.user_id) return json({ error: 'צריך סיסמה' }, 400);
      const { data: taken } = await admin.from('coach_players').select('id').eq('username', username).neq('id', playerId).maybeSingle();
      if (taken) return json({ error: 'שם המשתמש תפוס — נסו אחר' }, 409);
      const email = kidEmail(username);
      let uid = pl!.user_id as string | null;
      if (uid) {
        const { error } = await admin.auth.admin.updateUserById(uid, { email, ...(password ? { password } : {}), email_confirm: true, ban_duration: 'none' });
        if (error) return json({ error: /already/i.test(error.message) ? 'שם המשתמש תפוס — נסו אחר' : error.message }, 400);
      } else {
        const made = await admin.auth.admin.createUser({ email, password, email_confirm: true,
          user_metadata: { role: 'player', player_id: playerId, name: pl!.name } });
        if (made.error) return json({ error: /already/i.test(made.error.message) ? 'שם המשתמש תפוס — נסו אחר' : made.error.message }, 400);
        uid = made.data.user!.id;
      }
      await admin.from('coach_players').update({ user_id: uid, username, login_enabled: true, login_opened_at: new Date().toISOString() }).eq('id', playerId);
      return json({ ok: true, username, login: username });
    }

    /* ---------- parent closes the child's login ---------- */
    if (action === 'child_close') {
      const user = await userFromAuthHeader(req);
      if (!user) return json({ error: 'צריך להתחבר' }, 401);
      const playerId = String(body.player_id || '');
      const { data: link } = await admin.from('coach_guardian_players')
        .select('player_id, coach_guardians!inner(user_id)').eq('player_id', playerId).eq('coach_guardians.user_id', user.id).limit(1);
      if (!link || !link.length) return json({ error: 'אין הרשאה לילד הזה' }, 403);
      const { data: pl } = await admin.from('coach_players').select('user_id').eq('id', playerId).single();
      if (pl?.user_id) await admin.auth.admin.updateUserById(pl.user_id, { ban_duration: '876000h' });
      await admin.from('coach_players').update({ login_enabled: false }).eq('id', playerId);
      return json({ ok: true });
    }

    /* ---------- the coach's invite link (WhatsApp) ---------- */
    if (action === 'claim') {
      const token = String(body.token || '');
      if (token.length < 20) return json({ error: 'קישור לא תקין' }, 400);
      const h = await sha256(token);
      const { data: inv } = await admin.from('coach_invites')
        .select('id,club_id,guardian_id,player_id,kind,expires_at').eq('token_hash', h).maybeSingle();
      if (!inv) return json({ error: 'קישור לא תקין' }, 404);
      if (new Date(inv.expires_at) < new Date()) return json({ error: 'הקישור פג תוקף — בקש מהמאמן קישור חדש' }, 410);

      if (inv.kind === 'player') {
        const { data: pl } = await admin.from('coach_players').select('id,name,login_enabled').eq('id', inv.player_id).single();
        if (!pl?.login_enabled) return json({ error: 'ההורה עדיין לא אישר כניסה לשחקן' }, 403);
        const email = playerEmail(pl.id);
        let uid: string;
        const made = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { role: 'player', player_id: pl.id, name: pl.name } });
        if (made.error) { const { data: u } = await admin.rpc('coach_user_id_by_email', { p_email: email }); if (!u) return json({ error: made.error.message }, 400); uid = u as string; }
        else uid = made.data.user!.id;
        await admin.from('coach_players').update({ user_id: uid }).eq('id', inv.player_id);
        const device = await bindDevice(uid, null, inv.player_id, ua);
        await admin.from('coach_invites').update({ claimed_at: new Date().toISOString() }).eq('id', inv.id);
        return json({ ok: true, token_hash: await mintSession(email), device, role: 'player' });
      }
      const { data: g } = await admin.from('coach_guardians').select('id,phone').eq('id', inv.guardian_id).single();
      if (!g) return json({ error: 'קישור לא תקין' }, 404);
      const { uid, email } = await parentUserFor(g.phone);
      const device = await bindDevice(uid, g.id, null, ua);
      await admin.from('coach_invites').update({ claimed_at: new Date().toISOString() }).eq('id', inv.id);
      return json({ ok: true, token_hash: await mintSession(email), device, role: 'parent' });
    }

    /* ---------- silent re-auth from a bound device ---------- */
    if (action === 'device') {
      const secret = String(body.device || '');
      if (secret.length < 20) return json({ error: 'לא מזוהה' }, 400);
      const { data: dev } = await admin.from('coach_devices')
        .select('id,user_id,guardian_id,player_id').eq('secret_hash', await sha256(secret)).maybeSingle();
      if (!dev) return json({ error: 'לא מזוהה' }, 401);
      const { data: u } = await admin.auth.admin.getUserById(dev.user_id);
      if (!u?.user?.email) return json({ error: 'לא מזוהה' }, 401);
      await admin.from('coach_devices').update({ last_seen_at: new Date().toISOString() }).eq('id', dev.id);
      return json({ ok: true, token_hash: await mintSession(u.user.email) });
    }

    return json({ error: 'unknown action' }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
