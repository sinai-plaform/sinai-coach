/* ===== screens ===== */

/* ---------- HOME ---------- */
VIEWS.home = async function(){
  const t=S.team;
  if(!t) return screen('היום', `<div class="empty">אין עדיין קבוצה.<br><br><button class="btn primary" onclick="go('settings')">יצירת קבוצה</button></div>`);
  screen('היום', `<div id="hm"><div class="empty">טוען…</div></div>`,
    `<button class="iconbtn" id="tsw">⇄</button>`);
  $('#tsw').onclick=teamSwitcher;

  const [{data:upcoming},{data:recent},{data:lastAtt}] = await Promise.all([
    sb.from('coach_sessions').select('*').eq('team_id',t.id).in('status',['planned','live']).gte('date',new Date(Date.now()-864e5*3).toISOString().slice(0,10)).order('date').order('start_time').limit(4),
    sb.from('coach_sessions').select('*').eq('team_id',t.id).eq('status','done').order('date',{ascending:false}).limit(5),
    sb.from('coach_attendance').select('player_id,present,session_id,coach_sessions!inner(team_id,date)')
      .eq('coach_sessions.team_id',t.id).order('session_id',{ascending:false}).limit(400)
  ]);
  const up=upcoming||[];
  const live=up.find(x=>x.status==='live');
  const todays=up.find(x=>x.status==='planned'&&x.date<=today());
  const next=up.find(x=>x.status==='planned'&&x.date>today());
  const ss=recent||[];
  // absence streaks
  const byP={}; (lastAtt||[]).forEach(a=>{(byP[a.player_id]=byP[a.player_id]||[]).push(a);});
  const risk=S.players.filter(p=>{const a=(byP[p.id]||[]).slice(0,2);return a.length===2&&a.every(x=>x.present==='no');});
  const injured=S.players.filter(p=>p.status==='injured'||p.status==='sick');
  const back=injured.filter(p=>p.status_until && new Date(p.status_until)<=new Date());

  $('#hm').innerHTML=`
    <div class="card">
      <div class="spread"><div><h2>${esc(t.name)}</h2>
        <p class="muted sm">${AGES[t.age_profile]||''} · ${t.session_minutes} דק׳ · ${S.players.length} שחקנים${t.league_mode?' · ליגה':''}</p></div>
        <button class="btn sm" onclick="go('teamedit')">הגדרות</button></div>
      <div class="sep"></div>
      ${live?`<button class="btn primary big" onclick="openSession('${live.id}')">המשך אימון פעיל</button>`
        :todays?`<button class="btn primary big" onclick="openSession('${todays.id}')">התחל את אימון היום — ${esc(todays.focus||todays.theme||'')}</button>
           <button class="btn ghost sm" style="width:100%;margin-top:6px" onclick="go('plan',{session:'${todays.id}'})">צפייה ועריכה לפני האימון</button>`
        :`<button class="btn primary big" onclick="go('program')">תוכנית האימונים</button>`}
      ${next?`<div class="prow" style="margin-top:8px" onclick="go('plan',{session:'${next.id}'})"><div class="av">📅</div>
        <div class="pname"><b>האימון הבא: ${esc(dayLabel(next.date))}${next.start_time?' · '+String(next.start_time).slice(0,5):''}</b>
        <span class="xs muted">${esc(next.focus||next.theme||'')}</span></div><span class="pill info">פתח</span></div>`
        :(!todays&&!live?`<p class="xs muted" style="margin-top:8px;text-align:center">אין אימונים מתוכננים. <a href="#" onclick="go('program');return false">לבנות תוכנית</a></p>`:'')}
      <div class="grid2" style="margin-top:8px">
        <button class="btn" onclick="go('match')">מצב משחק</button>
        <button class="btn" onclick="go('broadcast')">עדכון להורים</button>
      </div>
    </div>

    ${(risk.length||back.length||injured.length)?`<div class="hd"><h2>דורש תשומת לב</h2></div><div class="stack">
      ${risk.map(p=>`<div class="prow"><div class="av">${esc(initials(p.name))}</div><div class="pname"><b>${esc(p.name)}</b><span class="xs muted">נעדר פעמיים ברצף</span></div><span class="pill bad">נטישה?</span></div>`).join('')}
      ${back.map(p=>`<div class="prow"><div class="av">${esc(initials(p.name))}</div><div class="pname"><b>${esc(p.name)}</b><span class="xs muted">תאריך חזרה עבר</span></div><span class="pill warn">חוזר</span></div>`).join('')}
      ${injured.filter(p=>!back.includes(p)).map(p=>`<div class="prow"><div class="av">${esc(initials(p.name))}</div><div class="pname"><b>${esc(p.name)}</b><span class="xs muted">${p.status==='injured'?'פצוע':'חולה'}${p.status_until?' עד '+fmtDate(p.status_until):''}</span></div><span class="pill warn">לא זמין</span></div>`).join('')}
    </div>`:''}

    <div class="hd"><h2>אימונים אחרונים</h2><button class="btn sm ghost" onclick="go('reports')">דוחות</button></div>
    ${ss.filter(x=>x.status==='done').slice(0,5).map(x=>`<div class="prow"><div class="av">${x.planned_minutes||60}׳</div>
      <div class="pname"><b>${esc(x.focus||'אימון')}</b><span class="xs muted">${fmtDate(x.date)}</span></div>
      <button class="btn sm ghost" onclick="openSession('${x.id}')">פתח</button></div>`).join('')||'<p class="muted sm">עוד לא הושלמו אימונים.</p>'}`;
};

function teamSwitcher(){
  sheet(`<h2>קבוצות</h2><div class="stack" style="margin-top:12px">
    ${S.teams.map(t=>`<button class="btn ${t.id===S.team?.id?'primary':''}" onclick="pickTeam('${t.id}')">${esc(t.name)}</button>`).join('')}
    <button class="btn ghost" onclick="closeSheet();go('settings')">+ קבוצה חדשה</button></div>`);
}
async function pickTeam(id){ S.team=S.teams.find(t=>t.id===id); await loadTeam(); closeSheet(); go(S.view==='home'?'home':'home'); }

/* ---------- SQUAD ---------- */
VIEWS.squad = async function(){
  screen('סגל', `<div id="sq"><div class="empty">טוען…</div></div>`, `<button class="iconbtn" id="addp">+</button>`);
  $('#addp').onclick=()=>playerForm();
  if(!S.team) return $('#sq').innerHTML='<div class="empty">אין קבוצה</div>';
  const ids=S.players.map(p=>p.id);
  let obs=[];
  if(ids.length){ const {data}=await sb.from('coach_observations').select('player_id,attribute,score,source,at').in('player_id',ids).eq('voided',false).limit(5000); obs=data||[]; }
  const byP={}; obs.forEach(o=>(byP[o.player_id]=byP[o.player_id]||[]).push(o));
  LOCAL_OBS.filter(o=>ids.includes(o.player_id)).forEach(o=>{(byP[o.player_id]=byP[o.player_id]||[]).push(o);});
  const rows=S.players.map(p=>{
    const sc=scoreFromObs(byP[p.id]||[]);
    const vals=Object.values(sc).map(x=>x.score).filter(v=>v!=null);
    const ov=vals.length?(vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1):'—';
    const st=p.status!=='active'?`<span class="pill warn">${({injured:'פצוע',sick:'חולה',away:'חופש',left:'עזב'})[p.status]||p.status}</span>`:'';
    const a=age(p.birth_date);
    return `<div class="prow" onclick="go('player','${p.id}')">
      <div class="av">${p.shirt_no?p.shirt_no:esc(initials(p.name))}</div>
      <div class="pname"><b>${esc(p.name)}</b><span class="xs muted">${[p.position||'',p.birth_date?fmtBirth(p.birth_date)+' ('+a+')':''].filter(Boolean).join(' · ')||'—'}</span></div>
      ${st}<span class="pill ${vals.length?'info':''}">${ov}</span></div>`;
  }).join('');
  $('#sq').innerHTML = S.players.length
    ? `<p class="muted sm" style="margin-bottom:10px">${S.players.length} שחקנים · הציון הוא ממוצע התכונות (1–20)</p><div class="plist">${rows}</div>
       <button class="btn ghost" style="margin-top:12px;width:100%" onclick="go('roster')">ייבוא רשימה</button>`
    : `<div class="empty">אין עדיין שחקנים.<br><br><button class="btn primary" onclick="playerForm()">הוספת שחקן</button>
       <button class="btn ghost" style="margin-top:8px" onclick="go('roster')">ייבוא רשימה</button></div>`;
};

function playerForm(p){
  p=p||{};
  sheet(`<h2>${p.id?'עריכת שחקן':'שחקן חדש'}</h2><div class="stack" style="margin-top:12px">
    <label class="f">שם מלא<input id="pn" value="${esc(p.name||'')}"></label>
    <div class="grid2">
      <label class="f">מספר<input id="pno" type="number" class="num" value="${p.shirt_no||''}"></label>
      <label class="f">עמדה<select id="ppos">${['','שוער','מגן','קשר','חלוץ'].map(x=>`<option ${x===p.position?'selected':''}>${x}</option>`).join('')}</select></label>
    </div>
    <label class="f">תאריך לידה<input id="pbd" type="date" value="${p.birth_date||''}"></label>
    <div class="grid2">
      <label class="f">שם הורה<input id="pgn" value="${esc(p.parent_name||'')}"></label>
      <label class="f">טלפון הורה<input id="pgp" type="tel" inputmode="tel" value="${esc(p.parent_phone||'')}"></label>
    </div>
    <label class="f">סטטוס<select id="pst">${[['active','פעיל'],['injured','פצוע'],['sick','חולה'],['away','חופש']].map(([v,l])=>`<option value="${v}" ${v===(p.status||'active')?'selected':''}>${l}</option>`).join('')}</select></label>
    <label class="f">חזרה בתאריך (אם לא פעיל)<input id="psu" type="date" value="${p.status_until||''}"></label>
    <button class="btn primary big" id="sv">שמירה</button>
    ${p.id?`<button class="btn danger" id="rm">הסרה מהקבוצה</button>`:''}
  </div>`);
  $('#sv').onclick=async()=>{
    const name=$('#pn').value.trim(); if(!name) return toast('חסר שם');
    const row={name, shirt_no:+$('#pno').value||null, position:$('#ppos').value||null, birth_date:$('#pbd').value||null,
      parent_name:$('#pgn').value.trim()||null, parent_phone:$('#pgp').value.trim()||null,
      status:$('#pst').value, status_until:$('#psu').value||null};
    if(p.id){ await sb.from('coach_players').update(row).eq('id',p.id); }
    else{
      row.club_id=S.club.id;
      const {data,error}=await sb.from('coach_players').insert(row).select().single();
      if(error) return toast('שגיאה: '+error.message);
      await sb.from('coach_team_players').insert({team_id:S.team.id,player_id:data.id});
    }
    await loadTeam(); closeSheet(); go(S.view==='player'?'squad':S.view); toast('נשמר');
  };
  if(p.id) $('#rm').onclick=async()=>{ if(!confirm('להסיר מהקבוצה?'))return;
    await sb.from('coach_team_players').delete().eq('team_id',S.team.id).eq('player_id',p.id);
    await loadTeam(); closeSheet(); go('squad'); };
}

function importSheet(){
  sheet(`<h2>ייבוא רשימת שחקנים</h2>
    <p class="muted sm" style="margin:6px 0 10px">שורה לכל שחקן. אפשר: <code>שם, מספר, תאריך לידה, טלפון הורה</code> — רק השם חובה.</p>
    <textarea id="imp" rows="9" placeholder="דני כהן, 7, 2016-04-12, 0501234567&#10;יואב לוי"></textarea>
    <button class="btn primary big" id="doImp" style="margin-top:10px">ייבוא</button>`);
  $('#doImp').onclick=async()=>{
    const lines=$('#imp').value.split('\n').map(s=>s.trim()).filter(Boolean);
    if(!lines.length) return;
    const rows=lines.map(l=>{const c=l.split(/[,\t]/).map(s=>s.trim());
      return {club_id:S.club.id,name:c[0],shirt_no:+c[1]||null,birth_date:/^\d{4}-\d{2}-\d{2}$/.test(c[2]||'')?c[2]:null,parent_phone:c[3]||null};});
    const {data,error}=await sb.from('coach_players').insert(rows).select();
    if(error) return toast('שגיאה: '+error.message);
    await sb.from('coach_team_players').insert(data.map(p=>({team_id:S.team.id,player_id:p.id})));
    await loadTeam(); closeSheet(); go('squad'); toast(`נוספו ${data.length} שחקנים`);
  };
}

/* ---------- PLAN (session editor) ----------
   PLAN is either a draft for a new session, or a planned session from the
   program (PLAN.sessionId). A planned session saves itself as you edit it. */
let PLAN = LS('plan')||{focus:'',items:[]};
if(!PLAN.items) PLAN.items=[];
const planMin=()=>PLAN.items.reduce((s,i)=>s+(+i.min||0),0);
const WD=['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'];
const dayLabel=d=>{const x=new Date(d+'T12:00:00');return `יום ${WD[x.getDay()]} · ${x.getDate()}.${x.getMonth()+1}`;};
let PLAN_T=null;
function planChanged(){
  LS('plan',PLAN);
  if(!PLAN.sessionId) return;
  clearTimeout(PLAN_T); PLAN_T=setTimeout(savePlanToSession,700);
}
async function savePlanToSession(){
  if(!PLAN.sessionId) return;
  const sid=PLAN.sessionId;
  const up=await sb.from('coach_sessions').update({focus:PLAN.focus||null,date:PLAN.date||today(),
    planned_minutes:planMin(),start_time:PLAN.time||null}).eq('id',sid);
  if(up.error) return toast('לא נשמר: '+up.error.message);
  await sb.from('coach_session_drills').delete().eq('session_id',sid);
  if(PLAN.items.length) await sb.from('coach_session_drills').insert(PLAN.items.map((it,i)=>
    ({session_id:sid,drill_id:it.id,ord:i,minutes:+it.min||1,notes:it.notes||null})));
  const s=$('#psaved'); if(s){ s.textContent='נשמר ✓'; setTimeout(()=>{ if($('#psaved')) $('#psaved').textContent=''; },1500); }
}
async function loadPlanSession(id){
  const [{data:s},{data:sd}]=await Promise.all([
    sb.from('coach_sessions').select('*').eq('id',id).single(),
    sb.from('coach_session_drills').select('*').eq('session_id',id).order('ord')]);
  if(!s) return false;
  PLAN={sessionId:id,status:s.status,date:s.date,time:s.start_time?String(s.start_time).slice(0,5):'',
    focus:s.focus||'',theme:s.theme||'',phase:s.phase||'',week:s.week_no,
    items:(sd||[]).map(x=>({id:x.drill_id,min:x.minutes,notes:x.notes||''}))};
  LS('plan',PLAN); return true;
}
VIEWS.plan = async function(arg){
  if(arg && arg.session && PLAN.sessionId!==arg.session){
    screen('אימון', '<div class="empty">טוען…</div>');
    if(!await loadPlanSession(arg.session)) return go('program');
  }
  if(arg && arg.fresh && PLAN.sessionId){ PLAN={focus:'',items:[],date:today()}; LS('plan',PLAN); }
  const target=S.team?S.team.session_minutes:60, t=planMin();
  const bound=!!PLAN.sessionId, done=PLAN.status==='done';
  screen(bound?'אימון מתוכנן':'אימון חדש', `
    <div class="card stack">
      ${PLAN.theme?`<div class="row wrap" style="gap:6px"><span class="pill info">${esc(PLAN.theme)}</span>
        ${PLAN.week?`<span class="pill">שבוע ${PLAN.week}</span>`:''}${PLAN.phase?`<span class="pill">${esc(PLAN.phase)}</span>`:''}</div>`:''}
      <div class="grid2">
        <label class="f">תאריך<input id="pdt" type="date" value="${PLAN.date||today()}" ${done?'disabled':''}></label>
        <label class="f">שעה<input id="ptm" type="time" value="${PLAN.time||''}" ${done?'disabled':''}></label>
      </div>
      <label class="f">דגש האימון<input id="fo" value="${esc(PLAN.focus)}" placeholder="מסירות · לחץ · סיומות" ${done?'disabled':''}></label>
      <div class="spread"><span class="sm muted">סה"כ <b class="num">${t}</b> מתוך <b class="num">${target}</b> דק׳</span>
        <span class="pill ${t>target?'bad':t===target?'ok':''}">${t>target?'חריגה '+(t-target)+'׳':'נשארו '+(target-t)+'׳'}</span></div>
      <div class="timer" style="padding:0;border:0"><div class="bar"><i style="width:${Math.min(100,t/target*100)}%" class="${t>target?'over':''}"></i></div></div>
      ${done?'':`<div class="chips"><span class="xs muted" style="align-self:center">תבניות:</span>
        ${Object.entries(TEMPLATES).map(([k,v])=>`<button class="chip" onclick="loadTpl('${k}')">${esc(v.label)}</button>`).join('')}</div>`}
    </div>
    <div class="hd"><h2>התרגילים</h2>${done?'':'<button class="btn sm" onclick="go(\'library\')">+ מהספרייה</button>'}</div>
    <div class="stack" id="plist"></div>
    <p class="xs muted" id="psaved" style="text-align:center;min-height:16px;margin-top:6px"></p>
    ${done?`<button class="btn primary big" onclick="openSession('${PLAN.sessionId}')">סיכום האימון</button>`
    : bound?`<button class="btn primary big" id="startBtn" ${PLAN.items.length?'':'disabled'}>התחל את האימון הזה</button>
       <div class="row" style="gap:8px;margin-top:8px">
         <button class="btn ghost" style="flex:1" onclick="go('program')">לתוכנית</button>
         <button class="btn danger" style="flex:1" onclick="delPlannedSession()">מחיקת האימון</button></div>`
    : `<button class="btn primary big" id="startBtn" ${PLAN.items.length?'':'disabled'}>התחל עכשיו</button>
       <button class="btn big" style="margin-top:8px;width:100%" id="saveLater" ${PLAN.items.length?'':'disabled'}>שמירה לתאריך שנבחר</button>
       <button class="btn ghost sm" style="margin-top:8px;width:100%" onclick="PLAN={focus:'',items:[],date:today()};LS('plan',PLAN);go('plan')">נקה</button>`}`);
  if(!done){
    $('#fo').oninput=e=>{PLAN.focus=e.target.value;planChanged();};
    $('#pdt').onchange=e=>{PLAN.date=e.target.value;planChanged();};
    $('#ptm').onchange=e=>{PLAN.time=e.target.value;planChanged();};
  }
  renderPlanList();
  const sb_=$('#startBtn'); if(sb_) sb_.onclick=startSession;
  const sl=$('#saveLater'); if(sl) sl.onclick=()=>saveSessionForLater();
};
function renderPlanList(){
  const el=$('#plist'); if(!el) return;
  const done=PLAN.status==='done';
  el.innerHTML = PLAN.items.length? PLAN.items.map((it,i)=>{
    const d=drillById(it.id)||{name:'תרגיל',cat:'tech'};
    return `<div class="prow" style="flex-wrap:wrap"><div class="av">${i+1}</div>
      <div class="pname" onclick="showDrill('${it.id}',${i})" style="cursor:pointer"><b>${esc(d.name)}</b>
        <span class="xs muted">${esc(CATS[d.cat]?.short||'')}${it.notes?' · 📝 '+esc(it.notes.slice(0,60)):''}</span></div>
      ${done?`<span class="pill">${it.min}׳</span>`:`
      <input type="number" class="num" style="width:54px;padding:5px;text-align:center" value="${it.min}" onchange="setMin(${i},this.value)">
      <button class="btn sm ghost" onclick="noteItem(${i})" title="הערות">📝</button>
      <button class="btn sm ghost" onclick="swapItem(${i})" title="החלפה">⇄</button>
      <button class="btn sm ghost" onclick="movePlan(${i},-1)">↑</button>
      <button class="btn sm ghost" onclick="delPlan(${i})">✕</button>`}</div>`;
  }).join('') : '<p class="muted sm">עוד אין תרגילים — הוסיפו מהספרייה או טענו תבנית.</p>';
}
function setMin(i,v){PLAN.items[i].min=Math.max(1,+v||1);planChanged();go('plan');}
function movePlan(i,d){const j=i+d;if(j<0||j>=PLAN.items.length)return;[PLAN.items[i],PLAN.items[j]]=[PLAN.items[j],PLAN.items[i]];planChanged();go('plan');}
function delPlan(i){PLAN.items.splice(i,1);planChanged();go('plan');}
function loadTpl(k){const t=TEMPLATES[k];PLAN.items=t.items.map(([id,min])=>({id,min}));PLAN.focus=PLAN.focus||t.label;planChanged();go('plan');toast('התבנית נטענה');}
function addToPlan(id,min){const d=drillById(id);PLAN.items.push({id,min:min||d.min});planChanged();
  toast(PLAN.sessionId?'נוסף לאימון של '+dayLabel(PLAN.date):'נוסף לאימון');}
function noteItem(i){
  const it=PLAN.items[i], d=drillById(it.id)||{name:''};
  sheet(`<h2>הערות לתרגיל</h2><p class="xs muted" style="margin:4px 0 10px">${esc(d.name)} — באימון הזה בלבד</p>
    <textarea id="nt" rows="5" placeholder="למשל: לעבוד רק ברגל חלשה, דני ויואב בזוג, לשים לב לגוף פתוח">${esc(it.notes||'')}</textarea>
    <button class="btn primary big" style="margin-top:10px" id="ntsv">שמירה</button>`);
  $('#ntsv').onclick=()=>{ it.notes=$('#nt').value.trim(); planChanged(); closeSheet(); renderPlanList(); };
}
function swapItem(i){
  const cur=drillById(PLAN.items[i].id)||{cat:'tech'};
  const age=S.team?S.team.age_profile:'b';
  const alts=allDrills().filter(d=>d.cat===cur.cat && d.ages.includes(age) && d.id!==cur.id);
  sheet(`<h2>החלפת תרגיל</h2><p class="xs muted" style="margin:4px 0 10px">תרגילים אחרים מאותה קטגוריה (${esc(CATS[cur.cat]?.label||'')})</p>
    <div class="stack">${alts.map(d=>`<button class="prow" style="text-align:start" onclick="doSwap(${i},'${d.id}')">
      <div class="pname"><b class="sm">${esc(d.name)}</b><span class="xs muted">${d.min} דק׳ · ${esc(d.src||'')}</span></div></button>`).join('')||'<p class="muted sm">אין חלופות.</p>'}</div>`);
}
function doSwap(i,id){ PLAN.items[i].id=id; planChanged(); closeSheet(); go('plan'); }
async function delPlannedSession(){
  if(!PLAN.sessionId || !confirm('למחוק את האימון המתוכנן?')) return;
  await sb.from('coach_sessions').delete().eq('id',PLAN.sessionId);
  PLAN={focus:'',items:[],date:today()}; LS('plan',PLAN); toast('נמחק'); go('program');
}
async function saveSessionForLater(){
  const row={id:uid(),team_id:S.team.id,date:PLAN.date||today(),start_time:PLAN.time||null,focus:PLAN.focus||null,
    planned_minutes:planMin(),status:'planned'};
  const {error}=await sb.from('coach_sessions').insert(row);
  if(error) return toast('שגיאה: '+error.message);
  await sb.from('coach_session_drills').insert(PLAN.items.map((it,i)=>({session_id:row.id,drill_id:it.id,ord:i,minutes:it.min,notes:it.notes||null})));
  PLAN={focus:'',items:[],date:today()}; LS('plan',PLAN);
  toast('נשמר בתוכנית — '+dayLabel(row.date)); go('program');
}

async function startSession(){
  let sid=PLAN.sessionId;
  if(sid){
    clearTimeout(PLAN_T); await savePlanToSession();
    await sb.from('coach_sessions').update({status:'live',date:today()}).eq('id',sid);
  } else {
    const row={team_id:S.team.id,date:today(),focus:PLAN.focus||null,planned_minutes:planMin(),status:'live'};
    const {data,error}=await sb.from('coach_sessions').insert(row).select().single();
    if(error) return toast('שגיאה: '+error.message);
    sid=data.id;
    await sb.from('coach_session_drills').insert(PLAN.items.map((it,i)=>({session_id:sid,drill_id:it.id,ord:i,minutes:it.min,notes:it.notes||null})));
  }
  PLAN={focus:'',items:[],date:today()}; LS('plan',PLAN);
  LIVE={idx:0,start:0,timer:null,counts:{}};
  await openSession(sid);
}
async function openSession(id){
  const {data}=await sb.from('coach_sessions').select('*').eq('id',id).single();
  if(!data) return toast('האימון לא נמצא');
  if(data.status==='planned'){
    if(data.date>today() && !confirm(`האימון מתוכנן ל${dayLabel(data.date)}. להתחיל אותו היום?`)) return go('plan',{session:id});
    await sb.from('coach_sessions').update({status:'live',date:today()}).eq('id',id); data.status='live'; data.date=today();
  }
  const {data:sd}=await sb.from('coach_session_drills').select('*').eq('session_id',id).order('ord');
  S.session=data; S.sessionDrills=(sd||[]).map(x=>({id:x.drill_id,min:x.minutes,ord:x.ord,rowId:x.id,rating:x.rating,notes:x.notes||''}));
  if(data.status==='done') return go('sessionReport');
  go('attend');
}

/* ---------- ATTENDANCE ---------- */
VIEWS.attend = async function(){
  if(!S.session) return go('home');
  const {data}=await sb.from('coach_attendance').select('*').eq('session_id',S.session.id);
  S.attendance={}; (data||[]).forEach(a=>S.attendance[a.player_id]=a);
  screen('נוכחות', `
    <p class="muted sm" style="margin-bottom:10px">${esc(S.session.focus||'אימון')} · ${fmtDate(S.session.date)}</p>
    <div class="stack" id="att"></div>
    <div class="row" style="margin-top:14px;gap:8px">
      <button class="btn" style="flex:1" onclick="markAll('yes')">כולם הגיעו</button>
      <button class="btn primary" style="flex:2" onclick="go('live')">לאימון →</button>
    </div>`);
  drawAtt();
};
function drawAtt(){
  const el=$('#att'); if(!el) return;
  el.innerHTML=S.players.map(p=>{
    const a=S.attendance[p.id]||{}; const v=a.present;
    const un=p.status!=='active';
    return `<div class="prow ${un?'':''}"><div class="av">${p.shirt_no||esc(initials(p.name))}</div>
      <div class="pname"><b>${esc(p.name)}</b>${un?`<span class="xs muted">${({injured:'פצוע',sick:'חולה',away:'חופש'})[p.status]||''}</span>`:''}</div>
      <div class="row" style="gap:4px">
        <button class="btn sm ${v==='yes'?'primary':''}" onclick="setAtt('${p.id}','yes')">✓</button>
        <button class="btn sm ${v==='notified'?'primary':''}" onclick="setAtt('${p.id}','notified')">הודיע</button>
        <button class="btn sm ${v==='no'?'danger':''}" onclick="setAtt('${p.id}','no')">✕</button>
      </div></div>`;
  }).join('');
}
async function setAtt(pid,val){
  S.attendance[pid]={...(S.attendance[pid]||{}),player_id:pid,session_id:S.session.id,present:val,marked_at:new Date().toISOString()};
  drawAtt();
  await push('coach_attendance',{session_id:S.session.id,player_id:pid,present:val,marked_at:new Date().toISOString()},{upsert:true,onConflict:'session_id,player_id'});
  if(val==='yes') push('coach_xp_events',{player_id:pid,kind:'attendance',amount:10,ref_id:S.session.id});
}
async function markAll(v){ for(const p of S.players){ if(p.status==='active') await setAtt(p.id,v); } toast('סומן'); }
const presentPlayers=()=>S.players.filter(p=>(S.attendance[p.id]||{}).present==='yes');

/* ---------- LIVE TRAINING ---------- */
let LIVE={idx:0,start:0,timer:null,counts:{}};
VIEWS.live = function(){
  if(!S.session) return go('home');
  const list=S.sessionDrills;
  if(!list.length) return screen('אימון', '<div class="empty">אין תרגילים באימון הזה.</div>');
  const it=list[LIVE.idx]||list[0], d=drillById(it.id)||{name:'תרגיל',points:[]};
  const pl=presentPlayers().length?presentPlayers():S.players;
  screen('אימון', `
    <div class="timer">
      <div class="spread"><div>
        <p class="xs muted">תרגיל ${LIVE.idx+1}/${list.length} · ${esc(CATS[d.cat]?.label||'')}</p>
        <h2>${esc(d.name)}</h2></div>
        <div style="text-align:end"><div class="t num" id="clk">${String(it.min).padStart(2,'0')}:00</div>
        <button class="btn sm ghost" id="pp">▶ התחל</button></div></div>
      <div class="bar"><i id="pbar"></i></div>
      <div class="row wrap" style="margin-top:10px;gap:6px">
        <button class="btn sm" onclick="showDrill('${it.id}')">פרטי התרגיל</button>
        <button class="btn sm" onclick="openBoard('${it.id}')">▦ לוח</button>
        <button class="btn sm" onclick="prevDrill()" ${LIVE.idx?'':'disabled'}>◀ קודם</button>
        <button class="btn sm primary" onclick="nextDrill()">${LIVE.idx<list.length-1?'הבא ▶':'סיום אימון'}</button>
      </div>
    </div>
    ${it.notes?`<div class="alert ok" style="margin-top:10px">📝 ${esc(it.notes)}</div>`:''}
    ${d.points&&d.points.length?`<p class="sm muted" style="margin:10px 2px">💡 ${esc(d.points[0])}</p>`:''}
    <div class="hd"><h2>דירוג מהיר</h2><span class="xs muted">לחיצה על שחקן</span></div>
    <div class="tiles" id="tiles"></div>
    <div class="row" style="margin-top:14px;gap:8px">
      <button class="btn" style="flex:1" onclick="quickRound()">סבב מהיר</button>
      <button class="btn" style="flex:1" onclick="go('attend')">נוכחות</button>
    </div>`);
  drawTiles();
  $('#pp').onclick=toggleTimer;
  updateClock();
};
function drawTiles(){
  const el=$('#tiles'); if(!el)return;
  const pl=presentPlayers().length?presentPlayers():S.players;
  el.innerHTML=pl.map(p=>{
    const n=localCounts(p.id,S.session?.id);
    return `<button class="tile" onclick="ratePlayer('${p.id}')">${n?`<span class="cnt">${n}</span>`:''}
      <b>${esc(p.name.split(' ')[0])}</b><span class="xs muted">${p.shirt_no?'#'+p.shirt_no:''}</span></button>`;
  }).join('');
}
function toggleTimer(){
  const it=S.sessionDrills[LIVE.idx];
  if(LIVE.timer){ clearInterval(LIVE.timer); LIVE.timer=null; $('#pp').textContent='▶ המשך'; return; }
  if(!LIVE.start) LIVE.start=Date.now();
  else LIVE.start=Date.now()-(LIVE.elapsed||0);
  LIVE.timer=setInterval(updateClock,250); $('#pp').textContent='⏸ עצור';
}
function updateClock(){
  const it=S.sessionDrills[LIVE.idx]; if(!it||!$('#clk'))return;
  const total=it.min*60;
  LIVE.elapsed = LIVE.start? Date.now()-LIVE.start : 0;
  const left=Math.max(0,total-Math.floor(LIVE.elapsed/1000));
  const over=Math.floor(LIVE.elapsed/1000)-total;
  $('#clk').textContent = over>0 ? '+'+String(Math.floor(over/60)).padStart(2,'0')+':'+String(over%60).padStart(2,'0')
    : String(Math.floor(left/60)).padStart(2,'0')+':'+String(left%60).padStart(2,'0');
  const bar=$('#pbar'); if(bar){bar.style.width=Math.min(100,Math.floor(LIVE.elapsed/1000)/total*100)+'%';bar.classList.toggle('over',over>0);}
  if(over===0 && LIVE.elapsed>1000 && !LIVE.dinged){LIVE.dinged=true;try{navigator.vibrate&&navigator.vibrate([200,100,200]);}catch(e){}}
}
function resetTimer(){clearInterval(LIVE.timer);LIVE.timer=null;LIVE.start=0;LIVE.elapsed=0;LIVE.dinged=false;}
function prevDrill(){resetTimer();LIVE.idx=Math.max(0,LIVE.idx-1);go('live');}
function nextDrill(){resetTimer();
  if(LIVE.idx<S.sessionDrills.length-1){LIVE.idx++;go('live');}
  else endSession();
}
function showDrill(id, planIdx, autoplay){ const d=drillById(id); if(!d)return;
  const pnote = planIdx!=null && PLAN.items[planIdx] ? PLAN.items[planIdx].notes : null;
  sheet(`<h2>${esc(d.name)}</h2><p class="xs muted" style="margin:4px 0 10px">${esc(d.src||'')} · ${d.min} דק׳ · ${esc(d.players||'')}${d.area?' · '+esc(d.area):''}</p>
    ${demoBox(d.diag, 'sd', d.name)}
    ${pnote?`<div class="alert ok" style="margin-top:10px">📝 ${esc(pnote)}</div>`:''}
    ${d.equip?`<p class="sm" style="margin-top:10px"><b>ציוד:</b> ${esc(d.equip)}</p>`:''}
    <p class="sm" style="margin-top:6px"><b>הכנה:</b> ${esc(d.setup||'')}</p>
    <p class="sm" style="margin-top:6px">${esc(d.desc||'')}</p>
    ${(d.points||[]).length?`<h3 style="margin-top:12px">דגשים</h3><ul class="sm">${d.points.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}
    ${(d.prog||[]).length?`<h3 style="margin-top:10px">התקדמויות</h3><ul class="sm">${d.prog.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:''}
    ${d.notes?`<h3 style="margin-top:10px">הערות המאמן</h3><p class="sm">${esc(d.notes)}</p>`:''}
    <div class="row" style="gap:6px;margin-top:12px">
      <button class="btn sm" style="flex:1" onclick="closeSheet();openBoard('${d.id}')">▦ פתיחה בלוח</button>
      ${S.view!=='live'?`<button class="btn sm primary" style="flex:1" onclick="addToPlan('${d.id}');closeSheet()">+ לאימון</button>`:''}</div>`);
  if(autoplay) setTimeout(()=>{ const b=document.querySelector('#dbsd .dplay'); b&&b.click(); },60);
}

/* rating sheet */
function ratePlayer(pid, opts){
  const p=S.players.find(x=>x.id===pid); if(!p)return;
  const isGk=p.position==='שוער';
  const attrs=teamAttrs(isGk).filter(a=>isGk? true : a.grp!=='gk');
  const drillId=S.sessionDrills[LIVE.idx]?.id;
  const tags=tagsForTeam();
  const scale=S.team?.rating_scale||5;
  sheet(`<div class="spread"><h2>${esc(p.name)}</h2><span class="xs muted">${opts&&opts.match?'משחק':'תרגיל'}</span></div>
    <div class="chips" style="margin:12px 0 4px">${tags.map((t,i)=>`<button class="chip" onclick="applyTag('${pid}',${i})">${t.good?'👍':'⚠️'} ${esc(t.t)}</button>`).join('')}</div>
    <div class="sep"></div>
    <div id="attrPick"><p class="xs muted" style="margin-bottom:6px">או דירוג תכונה</p>
    <div class="chips">${attrs.map(a=>`<button class="chip" onclick="pickAttr('${pid}','${a.key}')">${esc(a.label)}</button>`).join('')}</div></div>
    <div id="scorePick"></div>`);
}
function pickAttr(pid,key){
  const scale=S.team?.rating_scale||5;
  $('#attrPick').innerHTML=`<p class="xs muted">${esc(ATTR_LABEL(key))}</p>`;
  $('#scorePick').innerHTML = scale===3
    ? `<div class="starrow" style="margin-top:8px">${[2,3,5].map((v,i)=>`<button onclick="saveScore('${pid}','${key}',${v})">${'★'.repeat(i+1)}</button>`).join('')}</div>`
    : `<div class="scorerow" style="margin-top:8px">${[1,2,3,4,5].map(v=>`<button data-s="${v}" onclick="saveScore('${pid}','${key}',${v})">${v}</button>`).join('')}</div>`;
}
async function saveScore(pid,key,score){
  const it=S.sessionDrills[LIVE.idx];
  await addObs(pid,key,score,{source:S.match?'match':'drill',drill_id:it?it.id:null,match_id:S.match?S.match.id:null});
  closeSheet(); drawTiles(); if(S.match)drawMatchTiles();
  toast(`${ATTR_LABEL(key)} ${score}`);
}
async function applyTag(pid,i){
  const t=tagsForTeam()[i]; if(!t)return;
  await addObs(pid,t.a,t.s,{source:'tag',tag:t.t,drill_id:S.sessionDrills[LIVE.idx]?.id,match_id:S.match?S.match.id:null});
  closeSheet(); drawTiles(); if(S.match)drawMatchTiles();
  toast(t.t);
}
function quickRound(){
  const pl=presentPlayers().length?presentPlayers():S.players;
  let i=0;
  const step=()=>{
    if(i>=pl.length){closeSheet();toast('סבב הושלם');drawTiles();return;}
    const p=pl[i];
    const key=(teamAttrs(false)[0]||{key:'decisions'}).key;
    const focus=S.sessionDrills[LIVE.idx]?.focus_attributes?.[0] || key;
    sheet(`<p class="xs muted">סבב מהיר ${i+1}/${pl.length}</p><h2>${esc(p.name)}</h2>
      <p class="sm muted" style="margin:6px 0 10px">${esc(ATTR_LABEL(focus))}</p>
      <div class="scorerow">${[1,2,3,4,5].map(v=>`<button data-s="${v}" onclick="qrScore('${p.id}','${focus}',${v})">${v}</button>`).join('')}</div>
      <button class="btn ghost" style="width:100%;margin-top:10px" onclick="qrSkip()">דלג</button>`);
  };
  window.qrScore=async(pid,k,v)=>{await addObs(pid,k,v,{drill_id:S.sessionDrills[LIVE.idx]?.id});i++;step();drawTiles();};
  window.qrSkip=()=>{i++;step();};
  step();
}

async function endSession(){
  sheet(`<h2>סיום אימון</h2><p class="sm muted" style="margin:6px 0 12px">איך עבדו התרגילים?</p>
    <div class="stack">${S.sessionDrills.map((it,i)=>{const d=drillById(it.id)||{name:'תרגיל'};
      return `<div class="prow"><div class="pname"><b class="sm">${esc(d.name)}</b></div>
        <div class="row" style="gap:4px">
          <button class="btn sm" onclick="rateDrill(${i},'worked',this)">עבד</button>
          <button class="btn sm" onclick="rateDrill(${i},'ok',this)">בינוני</button>
          <button class="btn sm" onclick="rateDrill(${i},'failed',this)">לא עבד</button>
        </div></div>`;}).join('')}</div>
    ${S.team?.rpe_enabled?`<div class="sep"></div><p class="sm muted">עומס מורגש — השחקנים ידרגו באפליקציה שלהם</p>`:''}
    <button class="btn primary big" style="margin-top:14px" onclick="finishSession()">סיים ושמור</button>`);
}
async function rateDrill(i,val,btn){
  const it=S.sessionDrills[i];
  btn.parentElement.querySelectorAll('button').forEach(b=>b.classList.remove('primary'));
  btn.classList.add('primary'); it.rating=val;
  if(it.rowId) await sb.from('coach_session_drills').update({rating:val}).eq('id',it.rowId);
  else await sb.from('coach_session_drills').update({rating:val}).eq('session_id',S.session.id).eq('drill_id',it.id);
}
async function finishSession(){
  await sb.from('coach_sessions').update({status:'done'}).eq('id',S.session.id);
  resetTimer(); LIVE={idx:0,start:0,timer:null,counts:{}};
  closeSheet(); toast('האימון נשמר'); go('sessionReport');
}

/* ---------- SESSION REPORT ---------- */
VIEWS.sessionReport = async function(){
  if(!S.session) return go('home');
  const {data:att}=await sb.from('coach_attendance').select('*').eq('session_id',S.session.id);
  const present=(att||[]).filter(a=>a.present==='yes').length;
  const obs=LOCAL_OBS.filter(o=>o.session_id===S.session.id);
  const byP={}; obs.forEach(o=>(byP[o.player_id]=byP[o.player_id]||[]).push(o));
  screen('סיכום אימון', `
    <div class="card"><h2>${esc(S.session.focus||'אימון')}</h2>
      <p class="muted sm">${fmtDate(S.session.date)} · ${present}/${S.players.length} נוכחים · ${obs.length} תצפיות</p></div>
    <div class="hd"><h2>תרגילים</h2></div>
    <div class="stack">${S.sessionDrills.map(it=>{const d=drillById(it.id)||{name:'תרגיל'};
      return `<div class="prow"><div class="pname"><b class="sm">${esc(d.name)}</b><span class="xs muted">${it.min} דק׳</span></div>
        <span class="pill ${it.rating==='worked'?'ok':it.rating==='failed'?'bad':''}">${({worked:'עבד',ok:'בינוני',failed:'לא עבד'})[it.rating]||'—'}</span></div>`;}).join('')}</div>
    ${Object.keys(byP).length?`<div class="hd"><h2>מי קיבל דירוג</h2></div><div class="stack">
      ${Object.entries(byP).map(([pid,list])=>{const p=S.players.find(x=>x.id===pid)||{name:'—'};
        return `<div class="prow" onclick="go('player','${pid}')"><div class="av">${esc(initials(p.name))}</div>
          <div class="pname"><b>${esc(p.name)}</b><span class="xs muted">${list.map(o=>ATTR_LABEL(o.attribute)+' '+o.score).join(' · ')}</span></div></div>`;}).join('')}
    </div>`:''}
    <button class="btn primary big" style="margin-top:16px" onclick="shareSession()">שיתוף סיכום בוואטסאפ</button>
    <button class="btn ghost" style="margin-top:8px;width:100%" onclick="go('home')">חזרה</button>`);
};
function shareSession(){
  const lines=[`אימון ${S.team.name} — ${fmtDate(S.session.date)}`, S.session.focus?`דגש: ${S.session.focus}`:'',
    ...S.sessionDrills.map((it,i)=>{const d=drillById(it.id)||{name:''};return `${i+1}. ${d.name} (${it.min}׳)`;}),
    `נוכחות: ${presentPlayers().length}/${S.players.length}`];
  waOpen('https://wa.me/?text='+encodeURIComponent(lines.filter(Boolean).join('\n')));
}

