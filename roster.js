/* ===== SINAI Coach — roster import & parent invitations ===== */

/* keep this identical to coach_norm_phone() in the database */
function normPhone(p){
  if(!p) return null;
  let d=String(p).replace(/[^0-9+]/g,'');
  if(d.startsWith('+')) d='+'+d.slice(1).replace(/[^0-9]/g,'');
  else if(d.startsWith('00')) d='+'+d.slice(2);
  else if(d.startsWith('0')) d='+972'+d.slice(1);
  else if(d.length>=8&&d.length<=9) d='+972'+d;
  else d='+'+d;
  return d.replace(/[^0-9]/g,'').length<8 ? null : d;
}
const showPhone=p=>!p?'':p.startsWith('+972')?'0'+p.slice(4):p;

async function sha256hex(s){
  const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const randTok=()=>[...crypto.getRandomValues(new Uint8Array(32))]
  .map(x=>x.toString(16).padStart(2,'0')).join('');

function parseRoster(text){
  const rows=[];
  for(const line of text.split(/\r?\n/)){
    const raw=line.trim(); if(!raw) continue;
    const parts=raw.split(/[\t,;|]+/).map(x=>x.trim()).filter(Boolean);
    if(!parts.length) continue;
    let phone=null, pi=-1;
    parts.forEach((p,i)=>{ const digits=p.replace(/[^0-9]/g,'');
      if(phone===null && digits.length>=8 && digits.length<=15 && /^[0-9+\-(). ]+$/.test(p)){ phone=normPhone(p); pi=i; } });
    if(phone===null){ const m=raw.match(/[0-9][0-9\-(). ]{7,}/); if(m){ phone=normPhone(m[0]); } }
    const names=parts.filter((_,i)=>i!==pi);
    const player=(names[0]||'').trim();
    const parent=(names[1]||'').trim();
    if(!player && !phone) continue;
    rows.push({player,parent,phone,raw});
  }
  return rows;
}

/* ---------- import screen ---------- */
VIEWS.roster = function(){
  screen('ייבוא רשימה', `
    <div class="card stack">
      <p class="sm">הדבק את הרשימה מהמתנ״ס — שורה לכל שחקן.<br>
      <span class="xs muted">שם השחקן, טלפון ההורה, ושם ההורה אם יש. מופרד בפסיק או טאב (הדבקה מאקסל עובדת).</span></p>
      <textarea id="rtext" rows="9" placeholder="דניאל כהן, 050-1234567, רונית כהן&#10;יואב לוי, 0521234567"></textarea>
      <button class="btn primary" id="rprev">בדיקת הרשימה</button>
    </div>
    <div id="rout"></div>`);

  $('#rprev').onclick=()=>{
    const rows=parseRoster($('#rtext').value);
    if(!rows.length) return toast('לא זוהו שורות');
    const bad=rows.filter(r=>!r.phone||!r.player);
    const seen={}, dup=[];
    rows.forEach(r=>{ if(r.phone){ if(seen[r.phone]) dup.push(r.phone); seen[r.phone]=(seen[r.phone]||0)+1; } });
    const okRows=rows.filter(r=>r.phone&&r.player);

    $('#rout').innerHTML=`
      <div class="hd"><h2>${okRows.length===1?'שורה אחת תקינה':okRows.length+' שורות תקינות'}</h2></div>
      ${bad.length?`<div class="alert" style="margin-bottom:10px">${bad.length===1?'שורה אחת תדולג':bad.length+' שורות ידולגו'} — חסר שם או שהטלפון לא תקין:<br>
        <span class="xs">${bad.slice(0,4).map(b=>esc(b.raw)).join(' · ')}</span></div>`:''}
      ${dup.length?`<div class="card" style="margin-bottom:10px"><p class="sm">
        יש מספרים שחוזרים יותר מפעם אחת — הילדים האלה זוהו כאחים ויחוברו לאותו הורה. זה תקין.</p></div>`:''}
      <div class="scroll-x"><table class="tbl"><tr><th>שחקן</th><th>הורה</th><th>טלפון</th></tr>
        ${okRows.map(r=>`<tr><td>${esc(r.player)}</td><td>${esc(r.parent||'—')}</td>
          <td class="num" dir="ltr">${showPhone(r.phone)}</td></tr>`).join('')}</table></div>
      <button class="btn primary big" style="margin-top:14px" id="rgo">ייבוא ${okRows.length===1?'שחקן אחד':okRows.length+' שחקנים'}</button>`;

    $('#rgo').onclick=async()=>{
      const b=$('#rgo'); b.disabled=true; b.textContent='מייבא…';
      try{ await importRoster(okRows); }
      catch(e){ b.disabled=false; b.textContent='ייבוא'; return toast('שגיאה: '+e.message); }
    };
  };
};

async function importRoster(rows){
  const clubId=S.club.id;
  // existing players by name, so a re-import does not duplicate
  const {data:have}=await sb.from('coach_players').select('id,name').eq('club_id',clubId);
  const byName={}; (have||[]).forEach(p=>byName[p.name.trim()]=p.id);

  const newOnes=rows.filter(r=>!byName[r.player]);
  if(newOnes.length){
    const {data,error}=await sb.from('coach_players').insert(
      newOnes.map(r=>({club_id:clubId,name:r.player,parent_name:r.parent||null,parent_phone:r.phone}))
    ).select('id,name');
    if(error) throw error;
    (data||[]).forEach(p=>byName[p.name.trim()]=p.id);
  }

  // guardians, one per distinct phone
  const phones=[...new Set(rows.map(r=>r.phone))];
  const {error:ge}=await sb.from('coach_guardians').upsert(
    phones.map(ph=>({club_id:clubId, phone:ph, name:(rows.find(r=>r.phone===ph)||{}).parent||null})),
    {onConflict:'club_id,phone', ignoreDuplicates:true}
  );
  if(ge) throw ge;
  const {data:gs}=await sb.from('coach_guardians').select('id,phone').eq('club_id',clubId);
  const gByPhone={}; (gs||[]).forEach(g=>gByPhone[g.phone]=g.id);

  const links=rows.filter(r=>gByPhone[r.phone]&&byName[r.player])
    .map(r=>({guardian_id:gByPhone[r.phone], player_id:byName[r.player]}));
  if(links.length) await sb.from('coach_guardian_players').upsert(links,{ignoreDuplicates:true});

  // attach every new player to the current team
  if(S.team){
    const ids=rows.map(r=>byName[r.player]).filter(Boolean);
    await sb.from('coach_team_players').upsert(
      ids.map(id=>({team_id:S.team.id, player_id:id})),{ignoreDuplicates:true});
    await loadTeam();
  }
  toast(rows.length===1?'יובא שחקן אחד':`יובאו ${rows.length} שחקנים`);
  go('parents');
}

/* ---------- parents screen: who got a link, who joined, who opened a child account ---------- */
VIEWS.parents = async function(){
  screen('הורים', '<div class="empty">טוען…</div>');
  const [{data:st},{data:gp}] = await Promise.all([
    sb.from('coach_parent_status').select('*').eq('club_id',S.club.id).order('name'),
    sb.from('coach_guardian_players').select('guardian_id,player_id')
  ]);
  const names={}; S.players.forEach(p=>names[p.id]=p.name);
  const kidsOf={}; (gp||[]).forEach(r=>(kidsOf[r.guardian_id]=kidsOf[r.guardian_id]||[]).push(names[r.player_id]));
  const list=st||[];
  const joined  = list.filter(g=>g.registered);
  const invited = list.filter(g=>!g.registered && g.invites_sent>0);
  const untouched = list.filter(g=>!g.registered && !g.invites_sent);
  const withLogin = list.reduce((n,g)=>n+(+g.kids_with_login||0),0);
  const pct = list.length?Math.round(joined.length/list.length*100):0;

  const row=g=>{
    const kids=(kidsOf[g.guardian_id]||[]).filter(Boolean);
    const when = g.claimed_at ? 'נרשם '+fmtDate(g.claimed_at)
               : g.last_sent_at ? 'נשלח '+fmtDate(g.last_sent_at)+(g.invites_sent>1?` · ${g.invites_sent} פעמים`:'')
               : 'טרם נשלח';
    return `<div class="prow" id="i_${g.guardian_id}">
      <div class="av">${esc(initials(g.name||'?'))}</div>
      <div class="pname" style="flex:1" onclick="go('parentCard','${g.guardian_id}')">
        <b>${esc(g.name||showPhone(g.phone))}</b>
        <span class="xs muted">${kids.length?esc(kids.join(' · ')):'ללא שיוך'} · ${when}</span></div>
      ${g.registered
        ? `<span class="pill ok">מחובר</span>`
        : `<button class="btn ghost sm" style="width:auto;padding:6px 12px" onclick="sendTo('${g.guardian_id}')">
             ${g.invites_sent?'שוב':'הזמנה'}</button>`}
    </div>`;};

  $('.wrap').innerHTML=`
    <div class="card"><h2>${joined.length} מתוך ${list.length} הורים מחוברים</h2>
      <div class="bar" style="margin-top:10px"><i style="width:${pct}%"></i></div>
      <div class="row" style="gap:14px;margin-top:12px">
        <div><div class="num" style="font-size:19px">${invited.length}</div><span class="xs muted">קיבלו ולא נרשמו</span></div>
        <div><div class="num" style="font-size:19px">${untouched.length}</div><span class="xs muted">טרם נשלח</span></div>
        <div><div class="num" style="font-size:19px">${withLogin}</div><span class="xs muted">ילדים עם חשבון</span></div>
      </div></div>

    ${untouched.length?`<button class="btn primary big" style="margin:14px 0" onclick="inviteAll(0)">
      שליחה ל-${untouched.length} שטרם קיבלו</button>`:''}
    ${invited.length?`<button class="btn big" style="margin-bottom:14px" onclick="inviteAll(1)">
      תזכורת ל-${invited.length} שקיבלו ולא נרשמו</button>`:''}

    ${untouched.length?`<div class="hd"><h2>טרם נשלח</h2></div><div class="stack">${untouched.map(row).join('')}</div>`:''}
    ${invited.length?`<div class="hd"><h2>ממתינים</h2></div><div class="stack">${invited.map(row).join('')}</div>`:''}
    ${joined.length?`<div class="hd"><h2>מחוברים</h2></div><div class="stack">${joined.map(row).join('')}</div>`:''}
    ${!list.length?'<p class="muted sm">אין עדיין הורים. התחל מייבוא הרשימה.</p>':''}
    <button class="btn ghost" style="margin-top:16px" onclick="go('roster')">ייבוא רשימה</button>`;
};

/* ---------- one parent ---------- */
VIEWS.parentCard = async function(gid){
  screen('הורה', '<div class="empty">טוען…</div>');
  const [{data:g},{data:inv}] = await Promise.all([
    sb.from('coach_guardians').select('*, coach_guardian_players(player_id)').eq('id',gid).single(),
    sb.from('coach_invites').select('sent_at,claimed_at,channel,expires_at')
      .eq('guardian_id',gid).order('created_at',{ascending:false}).limit(8)
  ]);
  const names={}; S.players.forEach(p=>names[p.id]=p);
  const kids=(g.coach_guardian_players||[]).map(x=>names[x.player_id]).filter(Boolean);
  $('.wrap').innerHTML=`
    <div class="card"><h2>${esc(g.name||showPhone(g.phone))}</h2>
      <p class="muted sm" dir="ltr">${showPhone(g.phone)}</p>
      <div class="chips" style="margin-top:10px">
        <span class="chip ${g.user_id?'':'muted'}">${g.user_id?'מחובר':'לא מחובר'}</span>
        <span class="chip ${g.media_consent?'':'muted'}">${g.media_consent?'אישר צילום':'ללא אישור צילום'}</span>
      </div></div>
    <div class="hd"><h2>ילדים</h2></div>
    <div class="stack">${kids.map(k=>`<div class="prow" onclick="go('player','${k.id}')">
      <div class="av">${esc(initials(k.name))}</div>
      <div class="pname" style="flex:1"><b>${esc(k.name)}</b>
        <span class="xs muted">${k.login_enabled?'יש חשבון שחקן':'ללא חשבון'}</span></div>
      ${k.login_enabled?'<span class="pill ok">חשבון</span>':''}</div>`).join('')||'<p class="muted sm">אין שיוך.</p>'}</div>
    <div class="hd"><h2>היסטוריית הזמנות</h2></div>
    <div class="card">${(inv||[]).map(i=>`<div class="togrow"><div class="t">
      <b>${i.sent_at?'נשלח '+fmtDate(i.sent_at):'נוצר'}</b>
      <span>${i.claimed_at?'נוצל '+fmtDate(i.claimed_at):(new Date(i.expires_at)<new Date()?'פג תוקף':'ממתין')}</span>
      </div></div>`).join('')||'<p class="muted sm">טרם נשלחה הזמנה.</p>'}</div>
    <button class="btn primary" style="margin-top:14px" onclick="sendTo('${gid}')">שליחת קישור</button>`;
};

async function makeInvite(guardianId){
  const tok=randTok();
  const {data,error}=await sb.from('coach_invites').insert({
    club_id:S.club.id, guardian_id:guardianId, kind:'guardian',
    token_hash:await sha256hex(tok), created_by:S.user.id}).select('id').single();
  if(error) throw error;
  return {link: location.origin+location.pathname+'?t='+tok, id:data.id};
}
function inviteText(link, kids){
  return `היי! זו האפליקציה של ${S.club.name}.\n`+
    (kids?`כאן תוכל לראות את ${kids} — נוכחות, יעדים ועדכונים מהמאמן.\n`:'')+
    `הכניסה בלחיצה אחת, בלי סיסמה:\n${link}`;
}

/* the one place that knows HOW a link goes out.
   today: opens the coach's WhatsApp. later: a provider, same signature. */
async function deliverInvite(gid, {silent}={}){
  const {data:g}=await sb.from('coach_guardians')
    .select('phone, coach_guardian_players(player_id)').eq('id',gid).single();
  const names={}; S.players.forEach(p=>names[p.id]=p.name.split(' ')[0]);
  const kids=(g.coach_guardian_players||[]).map(x=>names[x.player_id]).filter(Boolean).join(' ו');
  const {link,id}=await makeInvite(gid);
  if(!silent){
    const to=g.phone.replace(/[^0-9]/g,'');
    // nothing is recorded as sent unless WhatsApp actually opened
    if(!await waOpen(`https://wa.me/${to}?text=`+encodeURIComponent(inviteText(link,kids)))) return null;
  }
  await sb.from('coach_invites').update({
    sent_at:new Date().toISOString(), sent_count:1, channel:'whatsapp', delivery:'sent'}).eq('id',id);
  return link;
}
async function sendTo(gid){
  try{
    if(!await deliverInvite(gid)) return;
    const row=$('#i_'+gid);
    if(row){ const b=row.querySelector('button');
      if(b){ b.outerHTML='<span class="pill ok">נשלח</span>'; } row.style.opacity='.6'; }
  }catch(e){ toast('שגיאה: '+e.message); }
}
async function inviteAll(mode){
  const {data:st}=await sb.from('coach_parent_status').select('*').eq('club_id',S.club.id).order('name');
  const gs=(st||[]).filter(g=>!g.registered && (mode?g.invites_sent>0:!g.invites_sent));
  if(!gs.length) return toast('אין למי לשלוח');
  screen(mode?'תזכורות':'שליחת הזמנות', `
    <div class="card"><p class="sm">כל הורה מקבל קישור אישי משלו — ולכן אי אפשר לשלוח אחד לכולם.
    זו בדיוק הסיבה שאף הורה לא יכול להיכנס לנתונים של ילד אחר.</p>
    <p class="xs muted" style="margin-top:8px">לחיצה על שורה פותחת את השיחה עם ההודעה מוכנה, וסימון נשאר כאן.</p></div>
    <div class="stack" style="margin-top:12px">
      ${gs.map(g=>`<div class="prow" id="i_${g.guardian_id}">
        <div class="av">${esc(initials(g.name||'?'))}</div>
        <div class="pname" style="flex:1"><b>${esc(g.name||showPhone(g.phone))}</b>
          <span class="xs muted" dir="ltr">${showPhone(g.phone)}</span></div>
        <button class="btn ghost sm" style="width:auto;padding:6px 12px" onclick="sendTo('${g.guardian_id}')">שליחה</button>
      </div>`).join('')}
    </div>`);
}

/* ---------- group updates: free, through the coach's own WhatsApp groups ---------- */
const waText = t => waOpen('https://wa.me/?text='+encodeURIComponent(t));
async function copyText(t, btn){
  try{ await navigator.clipboard.writeText(t); }
  catch(e){ const a=document.createElement('textarea'); a.value=t; document.body.appendChild(a);
    a.select(); document.execCommand('copy'); a.remove(); }
  if(btn){ const o=btn.textContent; btn.textContent='הועתק ✓'; setTimeout(()=>btn.textContent=o,1400); }
}
const dayName = d=>['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][new Date(d).getDay()];

VIEWS.broadcast = async function(){
  if(!S.team) return go('home');
  screen('עדכון לקבוצה', '<div class="empty">טוען…</div>');
  const [{data:nx},{data:lt},{data:st}] = await Promise.all([
    sb.from('coach_sessions').select('*').eq('team_id',S.team.id).gte('date',today()).order('date').limit(1),
    sb.from('coach_sessions').select('*').eq('team_id',S.team.id).eq('status','done').order('date',{ascending:false}).limit(1),
    sb.from('coach_parent_status').select('registered').eq('club_id',S.club.id)
  ]);
  const next = (nx||[])[0], last = (lt||[])[0];
  const pending = (st||[]).filter(g=>!g.registered).length;
  const when = s => s ? `יום ${dayName(s.date)} ${fmtDate(s.date)}${s.start_time?' בשעה '+s.start_time.slice(0,5):''}` : '';
  const sign = `\n\n— ${S.team.name}, ${S.club.name}`;

  const T = [];
  if(next) T.push({k:'reminder', t:'תזכורת לאימון הבא',
    b:`תזכורת: אימון ${when(next)}.${next.focus?`\nהדגש: ${next.focus}.`:''}\nלהביא בקבוק מים ונעלי כדורגל. נתראה!${sign}`});
  if(next) T.push({k:'cancel', t:'ביטול אימון',
    b:`שימו לב — האימון ב${when(next)} מבוטל.\nנעדכן בהקדם לגבי השלמה. מתנצל על אי הנוחות.${sign}`});
  if(next) T.push({k:'change', t:'שינוי שעה או מקום',
    b:`עדכון לאימון ב${when(next)}: יש שינוי ב___ (שעה / מקום).\nאנא שימו לב ועדכנו את הילדים.${sign}`});
  if(last) T.push({k:'summary', t:'סיכום האימון האחרון',
    b:`סיכום האימון מ${fmtDate(last.date)}${last.focus?` — ${last.focus}`:''}.\nהילדים עבדו יפה. כל הכבוד!${sign}`});
  if(pending) T.push({k:'invite', t:`${pending} הורים טרם נכנסו לאפליקציה`,
    b:`הורים יקרים — מי שעדיין לא נכנס לאפליקציה של ${S.club.name}, הקישור האישי נשלח אליכם בהודעה פרטית.\nהכניסה בלחיצה אחת, בלי סיסמה. שם תוכלו לראות נוכחות, יעדים ועדכונים.${sign}`});
  T.push({k:'general', t:'הודעה חופשית', b:`הורים יקרים,\n\n${sign}`});

  $('.wrap').innerHTML = `
    <div class="card"><p class="sm">בחרו הודעה — היא נכתבת מהנתונים באפליקציה. לחיצה על "וואטסאפ" פותחת את
      רשימת הצ׳אטים שלכם ואתם בוחרים את הקבוצה הרלוונטית.</p>
      <p class="xs muted" style="margin-top:8px">חינם לגמרי — ההודעה יוצאת מהוואטסאפ שלכם, לא דרך שרת.</p></div>
    <div class="alert ok" style="margin:12px 0">
      בקבוצה שולחים רק מידע כללי. כל דבר שנוגע לילד מסוים — נוכחות, ציון, התנהגות, תשלום —
      יוצא בהודעה פרטית להורה שלו בלבד, מתוך כרטיס השחקן.</div>
    <div class="stack">
      ${T.map((x,i)=>`<div class="card">
        <div class="spread"><h3>${esc(x.t)}</h3></div>
        <textarea id="bc${i}" rows="${x.k==='general'?4:5}" style="margin-top:8px">${esc(x.b)}</textarea>
        <div class="row" style="gap:8px;margin-top:8px">
          <button class="btn primary sm" style="flex:2" onclick="bcSend(${i},'${x.k}')">שליחה בוואטסאפ</button>
          <button class="btn sm" style="flex:1" onclick="copyText($('#bc${i}').value, this)">העתקה</button>
        </div></div>`).join('')}
    </div>`;
};
async function bcSend(i, kind){
  const body = $('#bc'+i).value.trim(); if(!body) return;
  if(!await waText(body)) return;
  await push('coach_messages',{club_id:S.club.id, team_id:S.team.id, kind, body,
    channel:'whatsapp_group', sent_at:new Date().toISOString(), by_user:S.user.id});
  toast('נרשם ביומן ההודעות');
}

