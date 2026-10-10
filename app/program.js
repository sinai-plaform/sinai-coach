/* ===== SINAI Club — training program =====
   A season plan: themed weeks, every session built from the library in a
   fixed professional structure (activation → development → application →
   game → summary), with drills rotated so nothing repeats too soon.
   Every generated session is an ordinary planned session — fully editable. */

const THEMES = [
  // גן–ב׳
  {k:'ball',      label:'שליטה בכדור',            ages:['a'],         cats:['tech','play'],        kw:['שליטה','סוליה','נגיעות','כדור לכל ילד']},
  {k:'dribble_a', label:'כדרור ושינויי כיוון',     ages:['a'],         cats:['play','tech'],        kw:['כדרור','כריש','שינוי כיוון','זנב']},
  {k:'pass_a',    label:'מסירה ראשונה',            ages:['a'],         cats:['tech','rondo','warm'],kw:['מסיר','זוג','רונדו']},
  {k:'shoot_a',   label:'בעיטה לשער',              ages:['a'],         cats:['fin','play'],         kw:['בעיט','שער','סיומ','מלך']},
  // ג׳ ומעלה
  {k:'touch',     label:'כדור ראשון וגוף פתוח',    ages:['b','c','d'], cats:['tech','rondo'],       kw:['קבלה','גוף פתוח','נגיעה ראשונה','כדור ראשון','רגל רחוקה']},
  {k:'pass',      label:'מסירה ותנועה',            ages:['b','c','d'], cats:['rondo','tech','pos'], kw:['מסיר','אדם שלישי','קיר','משולש']},
  {k:'1v1',       label:'כדרור ו-1v1',             ages:['b','c','d'], cats:['tech','fin','trans'], kw:['1v1','כדרור','2v1','מהלך']},
  {k:'finish',    label:'סיומות',                  ages:['b','c','d'], cats:['fin'],                kw:['סיום','בעיט','הגבה','שער']},
  {k:'possession',label:'רונדו והחזקה',            ages:['b','c','d'], cats:['rondo','pos'],        kw:['רונדו','החזקה','ניטרל']},
  {k:'switch',    label:'החלפת אגף ורוחב',         ages:['b','c','d'], cats:['pos','ssg'],          kw:['אגף','החלפת','רוחב','4 שערים']},
  {k:'buildup',   label:'יציאה מהשער',             ages:['c','d'],     cats:['pos','rondo'],        kw:['יציאה','שוער','אזורים','בנייה']},
  {k:'lines',     label:'משחק בין הקווים',         ages:['c','d'],     cats:['pos','rondo'],        kw:['בין הקווים','אמצע','ג׳וקר','אדם שלישי']},
  {k:'press',     label:'לחץ אחרי איבוד',          ages:['c','d'],     cats:['trans','rondo'],      kw:['לחץ','5 שניות','איבוד','נגדי']},
  {k:'transition',label:'מעברים',                  ages:['c','d'],     cats:['trans','fin'],        kw:['מעבר','3v2','2v1','מתמשך']},
  {k:'review',    label:'חזרה ומשחקים',            ages:['a','b','c','d'], cats:['ssg','rondo','play'], kw:['משחק','טורניר']}
];
const THEME_SEQ = {
  a:['ball','dribble_a','pass_a','shoot_a','review'],
  b:['touch','pass','1v1','review','finish','possession','switch','review'],
  c:['possession','buildup','1v1','review','finish','lines','press','review','transition','switch','touch','review'],
  d:['possession','buildup','press','review','lines','transition','finish','review','switch','1v1','touch','review']
};
const themeBy=k=>THEMES.find(t=>t.k===k);
/* what each theme develops — the attributes a focus block measures */
const THEME_ATTRS = {
  ball:['ball_control','coordination'], dribble_a:['ball_control','coordination'], pass_a:['ball_control','listening'], shoot_a:['ball_control','courage'],
  touch:['first_touch','passing'], pass:['passing','decisions'], '1v1':['dribbling','determination'], finish:['shooting','first_touch'],
  possession:['passing','first_touch','decisions'], switch:['long_pass','decisions'], buildup:['passing','decisions'], lines:['decisions','passing'],
  press:['determination','stamina','teamwork'], transition:['speed','decisions'], review:['teamwork','decisions']
};
/* a focus block: one theme for several weeks, in the classic teaching progression */
const BLOCK_PHASES = ['הקניה','תרגול','יישום במשחק','מבחן במשחק'];
function blockPhase(week, weeks){
  if(weeks<=1) return 2;
  if(week===weeks && weeks>=3) return 3;
  return Math.min(2, Math.floor((week-1)*3/(weeks-(weeks>=3?1:0))));
}

/* session skeleton per age: [slot, share of the session, categories] */
const SLOTS = {
  a:[['פתיחה',.15,['warm','phys']],['משחק תנועה',.20,['play','tech']],['עיקר',.25,'THEME'],['משחק',.33,['ssg']],['סיכום',.07,['cool']]],
  b:[['הפעלה',.13,['warm','phys']],['רונדו / טכניקה',.15,['rondo','tech']],['פיתוח',.22,'THEME'],['יישום',.20,'THEME2'],['משחק',.23,['ssg']],['סיכום',.07,['cool']]],
  c:[['הפעלה',.12,['warm','phys']],['רונדו',.15,['rondo']],['פיתוח',.22,'THEME'],['יישום',.21,'THEME2'],['משחק',.23,['ssg','pos']],['סיכום',.07,['cool']]]
};
SLOTS.d=SLOTS.c;
const PHASES=['הקניה','תרגול','יישום במשחק'];

function splitMinutes(total, shares){
  const raw=shares.map(s=>Math.max(4,Math.round(total*s)));
  let diff=total-raw.reduce((a,b)=>a+b,0);
  // put the remainder on the game, then the main block
  const order=[shares.length-2, 2, 3, 1];
  for(let k=0;diff!==0 && k<40;k++){ const i=order[k%order.length]; if(i<0||i>=raw.length) continue;
    if(diff>0){raw[i]++;diff--;} else if(raw[i]>4){raw[i]--;diff++;} }
  return raw;
}

/* deterministic shuffle so the same plan comes out for the same inputs */
function rng(seed){ let x=seed||1; return ()=>{ x^=x<<13; x^=x>>17; x^=x<<5; return ((x>>>0)%10000)/10000; }; }

function pickDrill(cats, theme, age, used, inSession, phaseIdx, rand){
  const pool=allDrills().filter(d=>d.ages.includes(age) && cats.includes(d.cat) && !inSession.has(d.id) && d.cat!=='gk');
  if(!pool.length) return null;
  const text=d=>[d.name,d.desc,...(d.points||[])].join(' ');
  let best=null, bs=-1e9;
  pool.forEach(d=>{
    let s=0;
    s += (cats.length-cats.indexOf(d.cat))*1.5;
    if(theme){ theme.kw.forEach(k=>{ if(text(d).includes(k)) s+=3; }); if(theme.cats.includes(d.cat)) s+=2; }
    const last=used[d.id];
    if(last!=null){ const gap=used.__n-last; s -= gap<3?12 : gap<6?6 : gap<10?2 : 0; }
    // first session of the week: simpler drills; later: more game-like
    if(phaseIdx===0 && ['tech','rondo','warm'].includes(d.cat)) s+=1;
    if(phaseIdx>0 && ['pos','ssg','trans','fin'].includes(d.cat)) s+=1;
    s += rand()*2.2;
    if(s>bs){bs=s;best=d;}
  });
  return best;
}

function buildSession(theme, age, minutes, phaseIdx, used, rand, maint, block){
  const slots=SLOTS[age]||SLOTS.b;
  const mins=splitMinutes(minutes, slots.map(s=>s[1]));
  const inS=new Set(), items=[];
  slots.forEach(([label,,cats],i)=>{
    let c = cats==='THEME' ? theme.cats : cats==='THEME2' ? [...theme.cats].reverse().concat(['ssg']) : cats;
    let th = (cats==='THEME'||cats==='THEME2') ? theme : null;
    if(block!=null){
      // early weeks: more volume on the focus, less opposition; later: game-realistic, then a test game
      if(cats==='THEME2' && block<=1) c=theme.cats;
      if(cats==='THEME2' && block>=2) c=['ssg','pos',...theme.cats];
      if(cats==='THEME' && block>=2) c=[...theme.cats.filter(x=>x!=='tech'),'pos','ssg'];
      // the technique / rondo slot keeps the other skills alive
      if(maint && Array.isArray(cats) && (cats.includes('rondo')||cats.includes('tech')||cats.includes('play'))) th=maint;
    }
    // FIFA 11+ style prevention warm-up at the start of every week
    if(label==='הפעלה' && phaseIdx===0) c=['phys','warm'];
    const d=pickDrill(c, th, age, used, inS, phaseIdx, rand);
    if(!d) return;
    inS.add(d.id); used[d.id]=used.__n;
    items.push({id:d.id, min:mins[i], slot:label});
  });
  used.__n++;
  return items;
}

/* all dates from start for N weeks on the chosen weekdays (0=Sunday) */
function planDates(start, weeks, days){
  const out=[]; const d0=new Date(start+'T12:00:00');
  for(let i=0;i<weeks*7;i++){ const d=new Date(d0); d.setDate(d0.getDate()+i);
    if(days.includes(d.getDay())) out.push({date:d.toLocaleDateString('en-CA'), week:Math.floor(i/7)+1}); }
  return out;
}

/* ---------- PROGRAM view ---------- */
VIEWS.program = async function(){
  if(!S.team) return go('home');
  screen('תוכנית אימונים', `<div id="pg"><div class="empty">טוען…</div></div>`,
    `<button class="iconbtn" id="pgadd" title="אימון בודד">+</button>`);
  $('#pgadd').onclick=()=>go('plan',{fresh:true});
  const from=new Date(Date.now()-864e5*14).toLocaleDateString('en-CA');
  const [{data:sess},{data:cyc}] = await Promise.all([
    sb.from('coach_sessions').select('id,date,start_time,status,focus,theme,week_no,phase,cycle_id,planned_minutes').eq('team_id',S.team.id).gte('date',from).order('date').order('start_time').limit(200),
    sb.from('coach_cycles').select('*').eq('team_id',S.team.id).order('start_date',{ascending:false}).limit(5)
  ]);
  const list=sess||[];
  const upcoming=list.filter(s=>s.status!=='done' && s.date>=today());
  const past=list.filter(s=>s.status==='done' || s.date<today()).reverse();
  // group upcoming by calendar week (Sunday start)
  const wk=d=>{const x=new Date(d+'T12:00:00'); x.setDate(x.getDate()-x.getDay()); return x.toLocaleDateString('en-CA');};
  const groups={}; upcoming.forEach(s=>(groups[wk(s.date)]=groups[wk(s.date)]||[]).push(s));
  const row=s=>`<div class="prow" onclick="go('plan',{session:'${s.id}'})">
      <div class="av" style="font-size:12px">${WD[new Date(s.date+'T12:00:00').getDay()]}</div>
      <div class="pname"><b>${esc(s.focus||s.theme||'אימון')}</b>
        <span class="xs muted">${new Date(s.date+'T12:00:00').getDate()}.${new Date(s.date+'T12:00:00').getMonth()+1}${s.start_time?' · '+String(s.start_time).slice(0,5):''} · ${s.planned_minutes||''} דק׳${s.phase&&!String(s.focus||'').includes(s.phase)?' · '+esc(s.phase):''}</span></div>
      ${s.status==='live'?'<span class="pill ok">פעיל</span>':s.date===today()?`<button class="btn sm primary" onclick="event.stopPropagation();openSession('${s.id}')">התחל</button>`:'<span class="pill">מתוכנן</span>'}</div>`;
  $('#pg').innerHTML=`
    <div class="card stack">
      <div class="spread"><div><h2>${esc(S.team.name)}</h2>
        <p class="muted sm">${upcoming.length} אימונים מתוכננים קדימה</p></div>
        <button class="btn primary" onclick="autoPlanSheet()">⚡ בנייה אוטומטית</button></div>
      ${(cyc||[]).length?`<div class="chips">${cyc.map(c=>`<button class="chip" onclick="cycleSheet('${c.id}')">${esc(c.name)}</button>`).join('')}</div>`:''}
    </div>
    ${upcoming.length?Object.entries(groups).map(([w,ss])=>{
      const t=ss[0].theme;
      return `<div class="hd"><h2>שבוע ${new Date(w+'T12:00:00').getDate()}.${new Date(w+'T12:00:00').getMonth()+1}</h2>${t?`<span class="pill info">${esc(t)}</span>`:''}</div>
        <div class="stack">${ss.map(row).join('')}</div>`;}).join('')
      :`<div class="empty">אין עדיין אימונים מתוכננים.<br><br>
        <button class="btn primary" onclick="autoPlanSheet()">בנייה אוטומטית של תוכנית</button><br><br>
        <button class="btn ghost" onclick="go('plan',{fresh:true})">או אימון בודד</button></div>`}
    ${past.length?`<div class="hd"><h2>אחרונים</h2></div><div class="stack">${past.slice(0,6).map(s=>`<div class="prow" onclick="openSession('${s.id}')">
      <div class="av" style="font-size:12px">${WD[new Date(s.date+'T12:00:00').getDay()]}</div>
      <div class="pname"><b>${esc(s.focus||s.theme||'אימון')}</b><span class="xs muted">${fmtDate(s.date)}</span></div>
      <span class="pill ${s.status==='done'?'ok':'warn'}">${s.status==='done'?'הושלם':'לא בוצע'}</span></div>`).join('')}</div>`:''}`;
};

/* ---------- auto-build sheet ---------- */
function autoPlanSheet(mode){
  mode = mode || 'season';
  const age=S.team.age_profile||'b';
  const seq=(THEME_SEQ[age]||THEME_SEQ.b).slice();
  const ageThemes=THEMES.filter(t=>t.ages.includes(age) && t.k!=='review');
  let focus=ageThemes[0].k;
  let days=[0,3];
  const focusMode = mode==='focus';
  sheet(`<h2>בניית תוכנית אוטומטית</h2>
    <div class="chips" style="margin:10px 0 6px">
      <button class="chip ${focusMode?'':'on'}" onclick="autoPlanSheet('season')">עונתית · נושא לכל שבוע</button>
      <button class="chip ${focusMode?'on':''}" onclick="autoPlanSheet('focus')">ממוקדת · נושא אחד לתקופה</button>
    </div>
    <p class="xs muted" style="margin:4px 0 12px">${focusMode
      ? 'בוחרים על מה לעבוד בתקופה הקרובה, והתוכנית בנויה בשלבים: הקניה → תרגול → יישום במשחק → מבחן במשחק. נושא אחר נשמר בכל אימון ברונדו או בטכניקה, כדי שהיכולות האחרות לא יירדו.'
      : 'כל שבוע מקבל נושא. בכל אימון: הפעלה → פיתוח הנושא → יישום → משחק → סיכום, עם רוטציה של תרגילים כדי שלא יחזרו מהר.'} אפשר לערוך כל אימון אחר כך.</p>
    <div class="stack">
      ${focusMode?`<label class="f">על מה עובדים בתקופה הזו?<select id="apF">${ageThemes.map(t=>`<option value="${t.k}">${esc(t.label)}</option>`).join('')}</select></label>
        <p class="xs muted" id="apFa"></p>`:''}
      <div class="grid2">
        <label class="f">מתחילים ב-<input id="apS" type="date" value="${today()}"></label>
        <label class="f">שבועות<select id="apW">${(focusMode?[2,3,4,5,6,8]:[4,6,8,10,12,16]).map(n=>`<option ${n===(focusMode?4:8)?'selected':''}>${n}</option>`).join('')}</select></label>
      </div>
      <label class="f">ימי אימון<div class="chips" id="apD">${WD.map((w,i)=>`<button type="button" class="chip ${days.includes(i)?'on':''}" data-d="${i}">${w}</button>`).join('')}</div></label>
      <div class="grid2">
        <label class="f">שעה<input id="apT" type="time" value="16:00"></label>
        <label class="f">אורך (דק׳)<input id="apM" type="number" class="num" value="${S.team.session_minutes||60}"></label>
      </div>
      <label class="f">${focusMode?'נושאים לשמירה (מתחלפים בין האימונים)':'רצף הנושאים (גוררים בלחיצה ↑)'}<div class="stack" id="apSeq"></div></label>
      <label class="f">הוספת נושא<select id="apAdd"><option value="">—</option>${THEMES.filter(t=>t.ages.includes(age)).map(t=>`<option value="${t.k}">${esc(t.label)}</option>`).join('')}</select></label>
      <label class="f">שם התוכנית<input id="apN" value=""></label>
      <div class="card" id="apPrev" style="padding:10px 12px"></div>
      <p class="xs muted" id="apInfo"></p>
      <button class="btn primary big" id="apGo">בנה תוכנית</button>
    </div>`);
  const nameFor=()=> focusMode ? `${themeBy(focus)?.label||''} · ${$('#apW').value} שבועות` : `תוכנית ${AGES[age]||''} · ${new Date().toLocaleDateString('he-IL',{month:'long'})}`;
  let nameTouched=false; $('#apN').value=nameFor(); $('#apN').oninput=()=>nameTouched=true;
  const maintList=()=>seq.filter(k=>k!==focus);
  const drawSeq=()=>{
    const list = focusMode ? maintList() : seq;
    $('#apSeq').innerHTML=list.map((k,i)=>`<div class="prow" style="padding:6px 9px"><div class="av" style="width:28px;height:28px">${i+1}</div>
      <div class="pname"><b class="sm">${esc(themeBy(k)?.label||k)}</b></div>
      ${focusMode?'':`<button class="btn sm ghost" onclick="apMove(${i})">↑</button>`}<button class="btn sm ghost" onclick="apDel('${k}',${i})">✕</button></div>`).join('');
    info();
  };
  const info=()=>{ const w=+$('#apW').value; const n=planDates($('#apS').value,w,days).length;
    if(!nameTouched) $('#apN').value=nameFor();
    if(focusMode){
      const at=(THEME_ATTRS[focus]||[]).map(k=>ATTR_LABEL(k)).join(', ');
      $('#apFa').textContent = at ? 'משפיע בעיקר על: '+at : '';
      $('#apPrev').innerHTML = `<p class="xs muted" style="margin-bottom:6px">השלבים</p>`+
        Array.from({length:w},(_,i)=>`<div class="spread sm" style="padding:3px 0"><span>שבוע ${i+1}</span><span class="pill ${blockPhase(i+1,w)===3?'ok':blockPhase(i+1,w)===2?'info':''}">${BLOCK_PHASES[blockPhase(i+1,w)]}</span></div>`).join('');
      $('#apInfo').textContent=`${n} אימונים · ${w} שבועות · בשבוע האחרון משחק מבחן וסבב מהיר על ${at||'הנושא'}, כדי לראות את ההתקדמות בכרטיסי השחקנים`;
    } else {
      $('#apPrev').classList.add('hide');
      $('#apInfo').textContent=`${n} אימונים · ${w} שבועות · הנושאים חוזרים במחזוריות אם יש יותר שבועות מנושאים`;
    }
  };
  window.apMove=i=>{ if(!i) return; [seq[i-1],seq[i]]=[seq[i],seq[i-1]]; drawSeq(); };
  window.apDel=(k,i)=>{ const at=seq.indexOf(k); if(seq.length<2 || at<0) return; seq.splice(at,1); drawSeq(); };
  $('#apAdd').onchange=e=>{ if(e.target.value){ seq.push(e.target.value); e.target.value=''; drawSeq(); } };
  if(focusMode) $('#apF').onchange=e=>{ focus=e.target.value; drawSeq(); };
  $('#apD').onclick=e=>{ const b=e.target.closest('[data-d]'); if(!b) return; const d=+b.dataset.d;
    days=days.includes(d)?days.filter(x=>x!==d):[...days,d].sort(); b.classList.toggle('on'); info(); };
  $('#apW').onchange=info; $('#apS').onchange=info;
  drawSeq();
  $('#apGo').onclick=async()=>{
    if(!days.length) return toast('בחרו ימי אימון');
    $('#apGo').disabled=true; $('#apGo').textContent='בונה…';
    try{ await generateProgram({start:$('#apS').value, weeks:+$('#apW').value, days, time:$('#apT').value||null,
      minutes:+$('#apM').value||60, seq: focusMode?[focus]:seq, focus: focusMode?focus:null, maint: focusMode?maintList():null,
      name:$('#apN').value.trim()||'תוכנית אימונים'}); }
    catch(e){ toast('שגיאה: '+(e.message||e)); $('#apGo').disabled=false; $('#apGo').textContent='בנה תוכנית'; }
  };
}

async function generateProgram(o){
  const age=S.team.age_profile||'b';
  const dates=planDates(o.start,o.weeks,o.days);
  if(!dates.length) throw new Error('אין תאריכים בטווח');
  // drills used in the last month count as recent, so a new plan continues the rotation
  const {data:recentSd}=await sb.from('coach_session_drills').select('drill_id,coach_sessions!inner(team_id,date)')
    .eq('coach_sessions.team_id',S.team.id).gte('coach_sessions.date',new Date(Date.now()-864e5*30).toLocaleDateString('en-CA'));
  const used={__n:10}; (recentSd||[]).forEach(r=>used[r.drill_id]=5);
  const rand=rng(o.start.replace(/\D/g,'')*1 + o.weeks*7 + o.minutes);
  const cycle={id:uid(),team_id:S.team.id,name:o.name,start_date:o.start,weeks:o.weeks,weekdays:o.days,start_time:o.time,
    themes: o.focus ? {focus:o.focus, maint:o.maint||[]} : o.seq};
  let nMaint=0;
  const c1=await sb.from('coach_cycles').insert(cycle); if(c1.error) throw c1.error;
  const sessions=[], drills=[];
  const perWeek={};
  dates.forEach(({date,week})=>{
    const theme=themeBy(o.focus || o.seq[(week-1)%o.seq.length])||THEMES[0];
    const idx=perWeek[week]=(perWeek[week]??-1)+1;
    const nInWeek=dates.filter(d=>d.week===week).length;
    let phaseIdx = nInWeek===1 ? 1 : Math.min(2, Math.round(idx*2/(nInWeek-1)));
    let block=null, maint=null, phaseLabel=PHASES[phaseIdx];
    if(o.focus){
      block=blockPhase(week,o.weeks); phaseLabel=BLOCK_PHASES[block];
      phaseIdx=[0,1,2,2][block];
      const ml=(o.maint||[]).filter(k=>themeBy(k)&&themeBy(k).ages.includes(age));
      maint = ml.length ? themeBy(ml[(nMaint++)%ml.length]) : null;
    }
    const items=buildSession(theme, age, o.minutes, phaseIdx, used, rand, maint, block);
    const id=uid();
    const measure = block===3 ? (THEME_ATTRS[theme.k]||[]).map(k=>ATTR_LABEL(k)).join(', ') : '';
    sessions.push({id,team_id:S.team.id,cycle_id:cycle.id,date,start_time:o.time,status:'planned',
      theme:theme.label,week_no:week,phase:phaseLabel,
      focus: o.focus ? `${theme.label} · ${phaseLabel}` : theme.label,
      notes: o.focus ? (block===3 ? `שבוע מבחן: במשחק, סבב מהיר על ${measure} — ההשוואה לתחילת התקופה תופיע בכרטיסי השחקנים.`
                       : `שבוע ${week} מתוך ${o.weeks} בתוכנית "${o.name}"${maint?` · נושא לשמירה: ${maint.label}`:''}`) : null,
      planned_minutes:items.reduce((s,i)=>s+i.min,0)});
    items.forEach((it,i)=>drills.push({session_id:id,drill_id:it.id,ord:i,minutes:it.min,notes:null}));
  });
  for(let i=0;i<sessions.length;i+=100){ const r=await sb.from('coach_sessions').insert(sessions.slice(i,i+100)); if(r.error) throw r.error; }
  for(let i=0;i<drills.length;i+=300){ const r=await sb.from('coach_session_drills').insert(drills.slice(i,i+300)); if(r.error) throw r.error; }
  closeSheet(); toast(`נבנו ${sessions.length} אימונים`); go('program');
}

async function cycleSheet(id){
  const {data:c}=await sb.from('coach_cycles').select('*').eq('id',id).single(); if(!c) return;
  const {count}=await sb.from('coach_sessions').select('id',{count:'exact',head:true}).eq('cycle_id',id).eq('status','planned');
  sheet(`<h2>${esc(c.name)}</h2>
    <p class="xs muted" style="margin:4px 0 10px">מ-${fmtDate(c.start_date)} · ${c.weeks} שבועות · ימים ${(c.weekdays||[]).map(d=>WD[d]).join(', ')} · ${count||0} אימונים שעוד לא בוצעו</p>
    <div class="chips" style="margin-bottom:12px">${Array.isArray(c.themes)
      ? c.themes.map((k,i)=>`<span class="chip">${i+1}. ${esc(themeBy(k)?.label||k)}</span>`).join('')
      : `<span class="chip on">מיקוד: ${esc(themeBy(c.themes?.focus)?.label||'')}</span>${(c.themes?.maint||[]).map(k=>`<span class="chip">${esc(themeBy(k)?.label||k)}</span>`).join('')}`}</div>
    <button class="btn danger" style="width:100%" id="cyDel">מחיקת האימונים שעוד לא בוצעו</button>
    <p class="xs muted" style="margin-top:8px">אימונים שכבר בוצעו נשארים בהיסטוריה.</p>`);
  $('#cyDel').onclick=async()=>{
    if(!confirm('למחוק את כל האימונים המתוכננים בתוכנית הזו?')) return;
    await sb.from('coach_sessions').delete().eq('cycle_id',id).eq('status','planned');
    const {count:left}=await sb.from('coach_sessions').select('id',{count:'exact',head:true}).eq('cycle_id',id);
    if(!left) await sb.from('coach_cycles').delete().eq('id',id);
    closeSheet(); toast('נמחק'); go('program');
  };
}
