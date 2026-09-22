/* ===== SINAI Coach — the family side (parent / player) ===== */

const FAM = { kids:[], guardian:null, kid:null, club:null };

/* school grade: explicit when the club filled it, otherwise from the birth date */
function gradeOf(p){
  if(p && p.grade!=null) return p.grade;
  const a=age(p&&p.birth_date);
  return a==null ? 99 : a-6;          // 9 years old -> grade 3
}
const GRADES={0:'גן',1:'א׳',2:'ב׳',3:'ג׳',4:'ד׳',5:'ה׳',6:'ו׳',7:'ז׳'};

async function bootstrapFamily(){
  splash('טוען…');
  const meta = S.user.user_metadata || {};

  if(S.role==='parent'){
    const {data:g} = await sb.from('coach_guardians').select('*').eq('user_id',S.user.id).maybeSingle();
    FAM.guardian = g;
  }
  const {data:pl} = await sb.from('coach_players').select('*');
  FAM.kids = pl || [];
  if(FAM.guardian){
    const {data:c} = await sb.from('coach_clubs').select('id,name,player_login_min_grade')
      .eq('id',FAM.guardian.club_id).maybeSingle();
    FAM.club = c;
  }
  if(!FAM.kids.length){
    $('#app').innerHTML = `<div class="wrap" style="padding-top:70px;max-width:420px">
      <div class="card stack"><h2>עדיין אין כאן ילד משויך</h2>
      <p class="muted sm">ייתכן שהמאמן טרם סיים את הרישום. שווה לפנות אליו.</p>
      <button class="btn ghost" onclick="signOut()">יציאה</button></div></div>`;
    return;
  }
  FAM.kid = FAM.kids[0];
  $('#nav').classList.add('hide');
  famHome();
}

function famBar(title, back){
  return `<div class="topbar"><div class="in">
    ${back?'<button class="iconbtn" onclick="famHome()">→</button>':''}
    <h1>${esc(title)}</h1></div></div>`;
}

/* ---------- parent home: the children ---------- */
async function famHome(){
  const ids = FAM.kids.map(k=>k.id);
  const [{data:att},{data:sess}] = await Promise.all([
    sb.from('coach_attendance').select('player_id,present,session_id').in('player_id',ids).limit(600),
    sb.from('coach_sessions').select('id,date,start_time,focus,status,team_id').gte('date',today())
      .order('date').limit(20)
  ]);
  const rate = id=>{ const a=(att||[]).filter(x=>x.player_id===id && x.present);
    return a.length ? Math.round(a.filter(x=>x.present==='yes').length/a.length*100) : null; };

  $('#app').innerHTML = famBar(S.role==='player'?'שלום':'הילדים שלי') + `<div class="wrap">
    ${(sess||[]).length?`<div class="card" style="margin-bottom:14px">
      <h3>האימון הבא</h3>
      <p class="sm" style="margin-top:4px">${fmtDate(sess[0].date)}${sess[0].start_time?' · '+sess[0].start_time.slice(0,5):''}
      ${sess[0].focus?' · '+esc(sess[0].focus):''}</p></div>`:''}

    ${FAM.kids.map(k=>{const r=rate(k.id);return `
      <div class="kid" onclick="famKid('${k.id}')">
        <div class="av">${esc(initials(k.name))}</div>
        <div class="pname" style="flex:1"><b>${esc(k.name)}</b>
          <span class="xs muted">${r!=null?'נוכחות '+r+'%':'טרם נרשמה נוכחות'}</span></div>
        <span class="muted">‹</span></div>`;}).join('')}

    ${S.role==='parent'?`<div class="card" style="margin-top:14px">
      <h3>הרשאות</h3>
      <div class="togrow"><div class="t"><b>צילום לאתגרים</b>
        <span>מאפשר לילד לצלם את עצמו לאתגרי האפליקציה (הקפצות, כדרור). אפשר לבטל בכל רגע.</span></div>
        <label class="sw"><input type="checkbox" id="cMedia" ${FAM.guardian?.media_consent?'checked':''}><i></i></label>
      </div>
    </div>`:''}

    <div class="stack" style="margin-top:16px">
      <button class="btn ghost" onclick="signOut()">יציאה</button></div>
  </div>`;

  const cm=$('#cMedia');
  if(cm) cm.onchange=async()=>{
    const v=cm.checked;
    const {data,error}=await sb.from('coach_guardians')
      .update({media_consent:v, media_consent_at:new Date().toISOString()})
      .eq('id',FAM.guardian.id).select('media_consent');
    if(error || !data || !data.length){ cm.checked=!v; return toast('לא נשמר'); }
    FAM.guardian.media_consent=v; toast(v?'אושר':'בוטל');
  };
}

/* ---------- one child ---------- */
async function famKid(id){
  const k = FAM.kids.find(x=>x.id===id); if(!k) return famHome();
  FAM.kid = k;
  $('#app').innerHTML = famBar(k.name, true) + '<div class="wrap"><div class="empty">טוען…</div></div>';

  const [{data:att},{data:goals},{data:team}] = await Promise.all([
    sb.from('coach_attendance').select('present,session_id,rpe').eq('player_id',id).limit(400),
    sb.from('coach_goals').select('*').eq('player_id',id).order('created_at',{ascending:false}).limit(6),
    sb.from('coach_team_players').select('team_id, coach_teams(*)').eq('player_id',id).maybeSingle()
  ]);
  const t = team?.coach_teams;
  const marked=(att||[]).filter(x=>x.present);
  const pct = marked.length?Math.round(marked.filter(x=>x.present==='yes').length/marked.length*100):null;

  // scores only if the coach opened them for this team
  let attrHtml='';
  if(t && ((S.role==='parent' && t.parent_sees_scores) || (S.role==='player' && t.show_scores_to_player))){
    const {data:sc}=await sb.from('coach_player_attributes').select('*').eq('player_id',id);
    if(sc&&sc.length) attrHtml=`<div class="hd"><h2>תכונות</h2></div><div class="card">
      ${sc.filter(x=>x.score_20!=null).sort((a,b)=>b.score_20-a.score_20).map(x=>`
        <div class="attr"><span>${esc(ATTR_LABEL(x.attribute))}</span>
        <div class="bar"><i style="width:${(x.score_20/20*100).toFixed(0)}%"></i></div>
        <span class="v num">${(+x.score_20).toFixed(0)}</span></div>`).join('')}
      <p class="xs muted" style="margin-top:8px">הציונים הם כלי עבודה של המאמן למעקב התקדמות — לא ציון בית-ספר.</p></div>`;
  }

  $('.wrap').innerHTML = `
    <div class="card"><h2>${esc(k.name)}</h2>
      <p class="muted sm">${t?esc(t.name):''}${pct!=null?' · נוכחות '+pct+'%':''}</p></div>

    ${goals&&goals.length?`<div class="hd"><h2>יעדים</h2></div><div class="stack">
      ${goals.map(g=>`<div class="prow"><div class="pname" style="flex:1">
        <b class="sm">${esc(g.text)}</b>
        <span class="xs muted">${g.done_at?'הושג 🎉':(g.due?'עד '+fmtDate(g.due):'בתהליך')}</span></div></div>`).join('')}
      </div>`:''}

    ${attrHtml}

    ${S.role==='parent'&&gradeOf(k)>=(FAM.club?.player_login_min_grade??3)?`
      <div class="card" style="margin-top:14px"><h3>כניסה של ${esc(k.name.split(' ')[0])}</h3>
        <div class="togrow"><div class="t"><b>לאפשר לילד להיכנס לאפליקציה</b>
          <span>נפתח חשבון לילד עם קישור אישי שתעביר למכשיר שלו. אפשר לסגור בכל רגע.</span></div>
          <label class="sw"><input type="checkbox" id="kidLogin" ${k.login_enabled?'checked':''}><i></i></label></div>
        <div id="kidLink"></div>
      </div>`:''}

    <div class="card" style="margin-top:14px"><h3>הודעה למאמן</h3>
      <p class="xs muted" style="margin:4px 0 10px">היעדרות, פציעה, או כל דבר שכדאי שידע.</p>
      <button class="btn" onclick="famNotify('${k.id}')">שליחה בוואטסאפ</button></div>`;

  const kl=$('#kidLogin');
  if(kl) kl.onchange=async()=>{
    const v=kl.checked;
    // the server decides; a silent no-op must never look like a save
    const {data,error}=await sb.rpc('coach_set_player_login',{p_player:k.id,p_on:v});
    if(error || data!==v){ kl.checked=!v; return toast(error?'לא נשמר: '+error.message:'לא נשמר'); }
    k.login_enabled=v;
    $('#kidLink').innerHTML = v
      ? `<p class="xs muted" style="margin-top:10px">בקש מהמאמן קישור כניסה עבור ${esc(k.name.split(' ')[0])}.</p>`
      : '';
    toast(v?'נפתח':'נסגר');
  };
}

function famNotify(id){
  const k=FAM.kids.find(x=>x.id===id);
  const msg=`שלום, לגבי ${k.name}: `;
  window.open('https://wa.me/?text='+encodeURIComponent(msg),'_blank');
}

