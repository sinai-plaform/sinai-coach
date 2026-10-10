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
    const {data:g} = await sb.from('coach_guardians').select('*').eq('user_id',S.user.id).limit(1).maybeSingle();
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

    ${myLoginCard()}

    <div class="stack" style="margin-top:16px">
      <button class="btn ghost" onclick="signOut()">יציאה</button></div>
  </div>`;
  bindLoginCard();

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

/* ---------- my own login: phone + a password the person chooses ---------- */
function myLoginId(){ const m=S.user.user_metadata||{}, e=S.user.email||'';
  if(m.phone) return m.phone.replace(/^\+972/,'0');
  const k=e.match(/^([^@]+)@kid\.sinai-coach\.app$/); return k?k[1]:e; }
function myLoginCard(){
  const set=(S.user.user_metadata||{}).pw_set;
  return `<div class="card" style="margin-top:14px${set?'':';border:2px solid var(--accent)'}">
    <h3>${set?'הכניסה שלי':'קביעת סיסמה'}</h3>
    <p class="xs muted" style="margin:4px 0 10px">${set
      ?`נכנסים עם <b dir="ltr">${esc(myLoginId())}</b> והסיסמה שלך.`
      :`בפעם הבאה נכנסים עם הטלפון <b dir="ltr">${esc(myLoginId())}</b> וסיסמה — בחרו אותה עכשיו.`}</p>
    <div class="row" style="gap:6px"><input id="mypw" type="password" autocomplete="new-password" placeholder="סיסמה חדשה (6+ תווים)" style="flex:1">
      <button class="btn ${set?'':'primary'}" id="mypwb">${set?'החלפה':'שמירה'}</button></div></div>`;
}
function bindLoginCard(){
  const b=$('#mypwb'); if(!b) return;
  b.onclick=async()=>{
    const pw=$('#mypw').value; if(pw.length<6) return toast('סיסמה של 6 תווים לפחות');
    b.disabled=true;
    const {data,error}=await sb.auth.updateUser({password:pw, data:{pw_set:true}});
    b.disabled=false;
    if(error) return toast('לא נשמר: '+error.message);
    if(data&&data.user) S.user=data.user;
    toast('הסיסמה נשמרה'); famHome();
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

    ${S.role==='parent'?`<div class="card" style="margin-top:14px" id="hdcard">
      <h3>הצהרת בריאות</h3>
      ${k.health_declared_at
        ? `<p class="sm" style="margin-top:6px"><span class="pill ok">✓</span> נחתמה ב-${fmtDate(k.health_declared_at)}</p>
           <p class="xs muted" style="margin-top:8px">${esc(HEALTH_TEXT)}</p>`
        : `<p class="xs muted" style="margin:6px 0 10px">${esc(HEALTH_TEXT)}</p>
           <button class="btn primary big" id="hdsign">אני מאשר/ת וחותם/ת</button>`}
    </div>`:''}

    ${S.role==='parent'?`<div class="card" style="margin-top:14px">
      <h3>פרטי ${esc(k.name.split(' ')[0])}</h3>
      <p class="xs muted" style="margin:4px 0 10px">מה שהמאמן צריך לדעת. רק המאמנים של הילד רואים את זה.</p>
      <div class="stack">
        <div class="grid2">
          <label class="f">תאריך לידה<input id="kbd" type="date" value="${k.birth_date||''}"></label>
          <label class="f">כיתה<select id="kgr"><option value="">—</option>${Object.entries(GRADES).concat([[8,'ח׳'],[9,'ט׳'],[10,'י׳'],[11,'י״א'],[12,'י״ב']]).map(([v,l])=>`<option value="${v}" ${String(k.grade)===String(v)?'selected':''}>${l}</option>`).join('')}</select></label>
        </div>
        <div class="grid2">
          <label class="f">בית ספר<input id="ksc" value="${esc(k.school||'')}"></label>
          <label class="f">מידת חולצה<select id="ksz">${['','6','8','10','12','14','16','XS','S','M','L','XL'].map(x=>`<option ${x===(k.shirt_size||'')?'selected':''}>${x}</option>`).join('')}</select></label>
        </div>
        <div class="grid2">
          <label class="f">איש קשר נוסף לחירום<input id="ken" value="${esc(k.emergency_name||'')}" placeholder="למשל: אבא — יוסי"></label>
          <label class="f">הטלפון שלו<input id="kep" type="tel" inputmode="tel" dir="ltr" value="${esc(k.emergency_phone||'')}"></label>
        </div>
        <label class="f">מי אוסף מהאימון<input id="kpk" value="${esc(k.pickup_note||'')}" placeholder="הולך לבד / סבתא / הסעה"></label>
        <label class="f">משהו שחשוב שהמאמן יידע<textarea id="kcn" rows="2" placeholder="למשל: מרכיב משקפיים, צריך מים בכל הפסקה">${esc(k.coach_note||'')}</textarea></label>
        <button class="btn primary" id="ksave">שמירת הפרטים</button>
      </div></div>`:''}

    ${S.role==='parent'&&gradeOf(k)>=(FAM.club?.player_login_min_grade??3)?`
      <div class="card" style="margin-top:14px"><h3>חשבון ל${esc(k.name.split(' ')[0])}</h3>
        <p class="xs muted" style="margin:4px 0 10px">${k.login_enabled&&(k.phone||k.username)
          ?`פתוח · נכנס עם <b dir="ltr">${esc(k.phone?k.phone.replace(/^\+972/,'0'):k.username)}</b>. אפשר לקבוע לו סיסמה חדשה או לסגור.`
          :'מוסיפים את הטלפון של הילד — וזה פותח לו חשבון. הוא נכנס עם הטלפון וסיסמה. אפשר לסגור בכל רגע.'}</p>
        <div class="stack">
          <label class="f">הטלפון של הילד<input id="kph" type="tel" inputmode="tel" dir="ltr" value="${esc(k.phone?k.phone.replace(/^\+972/,'0'):'')}" placeholder="05x-xxxxxxx"></label>
          <details ${!k.phone&&k.username?'open':''}><summary class="xs muted">אין לילד טלפון? שם משתמש במקום</summary>
            <label class="f" style="margin-top:6px">שם משתמש (באנגלית)<input id="kun" dir="ltr" autocapitalize="off" value="${esc(k.username||'')}" placeholder="noam.c"></label></details>
          <label class="f">סיסמה${k.login_enabled?' חדשה':''}<input id="kpw" type="text" dir="ltr" autocomplete="new-password" placeholder="6 תווים לפחות"></label>
          <p class="xs muted">עם טלפון אפשר להשאיר סיסמה ריקה: הילד יקבל קוד ב-SMS ויבחר סיסמה בעצמו ("כניסה ראשונה").</p>
          <button class="btn primary" id="kopen">${k.login_enabled?'עדכון':'פתיחת חשבון'}</button>
          ${k.login_enabled?'<button class="btn danger" id="kclose">סגירת החשבון</button>':''}
        </div></div>`:''}

    <div class="card" style="margin-top:14px"><h3>הודעה למאמן</h3>
      <p class="xs muted" style="margin:4px 0 10px">היעדרות, פציעה, או כל דבר שכדאי שידע.</p>
      <button class="btn" onclick="famNotify('${k.id}')">שליחה בוואטסאפ</button></div>`;

  const hd=$('#hdsign');
  if(hd) hd.onclick=async()=>{
    hd.disabled=true;
    const {data,error}=await sb.rpc('coach_sign_health',{p_player:k.id});
    if(error||!data){ hd.disabled=false; return toast(error?'לא נשמר: '+error.message:'לא נשמר'); }
    k.health_declared_at=data; toast('נחתם'); famKid(k.id);
  };

  const ks=$('#ksave');
  if(ks) ks.onclick=async()=>{
    const p={birth_date:$('#kbd').value||'',grade:$('#kgr').value,school:$('#ksc').value.trim(),shirt_size:$('#ksz').value,
      emergency_name:$('#ken').value.trim(),emergency_phone:$('#kep').value.trim(),pickup_note:$('#kpk').value.trim(),coach_note:$('#kcn').value.trim()};
    ks.disabled=true;
    const {error}=await sb.rpc('coach_guardian_update_player',{p_player:k.id,p});
    ks.disabled=false;
    if(error) return toast('לא נשמר: '+error.message);
    Object.assign(k,p,{birth_date:p.birth_date||k.birth_date,grade:p.grade===''?k.grade:+p.grade}); toast('נשמר');
  };
  const ko=$('#kopen');
  if(ko) ko.onclick=async()=>{
    const phone=$('#kph').value.trim(), username=$('#kun').value.trim().toLowerCase(), password=$('#kpw').value;
    if(!phone && !/^[a-z0-9._]{3,20}$/.test(username)) return toast('צריך טלפון של הילד, או שם משתמש באנגלית');
    if(!phone && !password && !k.login_enabled) return toast('עם שם משתמש צריך גם סיסמה');
    if(password && password.length<6) return toast('סיסמה של 6 תווים לפחות');
    ko.disabled=true; ko.textContent='שומר…';
    const r=await fn('child_set',{player_id:k.id,phone,username:phone?'':username,password},true);
    ko.disabled=false;
    if(r.error){ ko.textContent='נסו שוב'; return toast(r.error); }
    if(phone){ k.phone=phone; k.username=null; } else k.username=username;
    k.login_enabled=true;
    const login=phone||username, first=k.name.split(' ')[0];
    sheet(`<h2>החשבון של ${esc(first)} מוכן</h2>
      <div class="card" style="margin-top:10px"><p>כניסה עם: <b dir="ltr">${esc(login)}</b></p>
      ${password?`<p>סיסמה: <b dir="ltr">${esc(password)}</b></p>`:`<p class="sm">בכניסה הראשונה ${esc(first)} לוחץ "כניסה ראשונה", מקבל קוד ב-SMS ובוחר סיסמה.</p>`}</div>
      <button class="btn primary big" style="margin-top:12px" id="kcopy">העתקה לשליחה לילד</button>`);
    $('#kcopy').onclick=()=>{ const t=`כניסה ל-SINAI Coach: ${location.origin}/app/\nטלפון / שם משתמש: ${login}\n`+(password?`סיסמה: ${password}`:'בפעם הראשונה: "כניסה ראשונה" ← קוד ב-SMS ← בוחרים סיסמה');
      (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('הועתק')).catch(()=>toast(t)); };
    famKid(k.id);
  };
  const kc=$('#kclose');
  if(kc) kc.onclick=async()=>{
    if(!confirm('לסגור את החשבון של הילד?')) return;
    const r=await fn('child_close',{player_id:k.id},true);
    if(r.error) return toast(r.error);
    k.login_enabled=false; toast('נסגר'); famKid(k.id);
  };
}

function famNotify(id){
  const k=FAM.kids.find(x=>x.id===id);
  const msg=`שלום, לגבי ${k.name}: `;
  waOpen('https://wa.me/?text='+encodeURIComponent(msg));
}

