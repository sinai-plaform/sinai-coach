/* ===== screens part 2 ===== */

/* ---------- LIBRARY ---------- */
let LF={age:null,cat:null,q:''};
VIEWS.library = function(){
  if(!LF.age && S.team) LF.age=S.team.age_profile;
  const list=allDrills().filter(d=>(!LF.age||d.ages.includes(LF.age))&&(!LF.cat||d.cat===LF.cat)
    &&(!LF.q||[d.name,d.desc,d.src,...(d.points||[])].join(' ').includes(LF.q)));
  screen('ספריית תרגילים', `
    <div class="stack">
      <input id="lq" type="search" placeholder="חיפוש תרגיל, דגש, שיטה…" value="${esc(LF.q)}">
      <div class="chips">${Object.entries(AGES).map(([k,v])=>`<button class="chip ${LF.age===k?'on':''}" onclick="setLF('age','${k}')">${v}</button>`).join('')}</div>
      <div class="chips" style="overflow-x:auto;flex-wrap:nowrap;padding-bottom:2px">
        ${Object.entries(CATS).map(([k,v])=>`<button class="chip ${LF.cat===k?'on':''}" style="white-space:nowrap" onclick="setLF('cat','${k}')">${v.label}</button>`).join('')}</div>
      <div class="spread"><span class="xs muted num">${list.length} תרגילים</span>
        <button class="btn sm" onclick="drillForm()">+ תרגיל שלי</button></div>
    </div>
    <div class="stack" style="margin-top:10px">${list.map(d=>`
      <div class="card" style="padding:0;overflow:hidden">
        ${svgDiag(d.diag)}
        <div style="padding:10px 12px">
          <div class="row wrap" style="gap:5px;margin-bottom:4px">
            <span class="pill info">${esc(CATS[d.cat]?.short||'')}</span>
            ${d.ages.map(a=>`<span class="pill">${AGES[a]}</span>`).join('')}
            ${d.mine?'<span class="pill warn">שלי</span>':''}</div>
          <h3>${esc(d.name)}</h3>
          <p class="xs muted num">${d.min} דק׳ · ${esc(d.players||'')} · ${esc(d.area||'')}</p>
          <p class="xs muted">◆ ${esc(d.src||'')}</p>
          <div class="row" style="margin-top:8px;gap:6px">
            <button class="btn sm" style="flex:1" onclick="showDrill('${d.id}')">פרטים</button>
            <button class="btn sm primary" style="flex:1" onclick="addToPlan('${d.id}')">+ לאימון</button>
            <button class="btn sm ghost" onclick="openBoard('${d.id}')" title="לוח טקטי">▦</button>
            ${d.mine?`<button class="btn sm ghost" onclick="drillForm('${d.id}')">✎</button>`:''}
          </div>
        </div></div>`).join('')||'<div class="empty">לא נמצאו תרגילים.</div>'}</div>`);
  const q=$('#lq'); q.oninput=e=>{LF.q=e.target.value.trim();clearTimeout(q._t);q._t=setTimeout(()=>go('library'),350);};
};
function setLF(k,v){LF[k]=LF[k]===v?null:v;go('library');}

function drillForm(id, preset){
  const d = id ? allDrills().find(x=>x.id===id)
          : preset ? Object.assign({},preset,{id:null,mine:true})
          : {cat:'tech',ages:[S.team?.age_profile||'b'],min:10,players:'8–12',area:'20×20',points:[],prog:[]};
  const diag = window.__diag || d.diag || {items:[]};
  sheet(`<h2>${id?'עריכת תרגיל':'תרגיל חדש'}</h2><div class="stack" style="margin-top:12px">
    <label class="f">שם<input id="dn" value="${esc(d.name||'')}"></label>
    <div class="grid2">
      <label class="f">קטגוריה<select id="dc">${Object.entries(CATS).map(([k,v])=>`<option value="${k}" ${k===d.cat?'selected':''}>${v.label}</option>`).join('')}</select></label>
      <label class="f">דקות<input id="dm" type="number" class="num" value="${d.min}"></label>
    </div>
    <div class="grid2">
      <label class="f">שחקנים<input id="dp" value="${esc(d.players||'')}"></label>
      <label class="f">שטח<input id="da" value="${esc(d.area||'')}"></label>
    </div>
    <label class="f">גילאים<div class="chips" id="dages">${Object.entries(AGES).map(([k,v])=>`<button type="button" class="chip ${d.ages.includes(k)?'on':''}" data-a="${k}" onclick="this.classList.toggle('on')">${v}</button>`).join('')}</div></label>
    <label class="f">ציוד<input id="de" value="${esc(d.equip||'')}"></label>
    <label class="f">הכנה<textarea id="ds" rows="2">${esc(d.setup||'')}</textarea></label>
    <label class="f">מהלך<textarea id="dd" rows="3">${esc(d.desc||'')}</textarea></label>
    <label class="f">דגשים (שורה לכל אחד)<textarea id="dpt" rows="3">${esc((d.points||[]).join('\n'))}</textarea></label>
    <label class="f">התקדמויות (שורה לכל אחת)<textarea id="dpr" rows="2">${esc((d.prog||[]).join('\n'))}</textarea></label>
    <div class="f"><span>דיאגרמה</span>
      ${diag.items&&diag.items.length?svgDiag(diag):'<p class="xs muted">עדיין אין ציור לתרגיל הזה.</p>'}
      <button class="btn sm" style="margin-top:6px" id="ddraw">✏️ ${diag.items&&diag.items.length?'עריכת הציור':'ציור על הלוח'}</button></div>
    <button class="btn primary big" id="dsv">שמירה</button>
    ${id?'<button class="btn danger" id="ddel">מחיקה</button>':''}</div>`);
  $('#ddraw').onclick=()=>{ closeSheet(); BOARD.items=JSON.parse(JSON.stringify(diag.items||[]));
    go('board',{keep:true, back:'library'}); };
  $('#dsv').onclick=async()=>{
    const ages=$$('#dages .chip.on').map(b=>b.dataset.a);
    if(!$('#dn').value.trim()) return toast('חסר שם');
    if(!ages.length) return toast('בחרו קבוצת גיל');
    const row={id:id&&String(id).startsWith('my')?id:('my'+Date.now()),club_id:S.club.id,created_by:S.user.id,
      name:$('#dn').value.trim(),cat:$('#dc').value,ages,min:+$('#dm').value||10,players:$('#dp').value,area:$('#da').value,
      equip:$('#de').value,setup:$('#ds').value,descr:$('#dd').value,
      points:$('#dpt').value.split('\n').map(s=>s.trim()).filter(Boolean),
      prog:$('#dpr').value.split('\n').map(s=>s.trim()).filter(Boolean),
      src:'המועדון',diagram:diag};
    const {error}=await sb.from('coach_drills').upsert(row);
    if(error) return toast('שגיאה: '+error.message);
    const {data}=await sb.from('coach_drills').select('*').eq('club_id',S.club.id); S.dbDrills=data||[];
    window.__diag=null; closeSheet(); go('library'); toast('נשמר');
  };
  if(id) $('#ddel').onclick=async()=>{ if(!confirm('למחוק?'))return;
    await sb.from('coach_drills').delete().eq('id',id);
    const {data}=await sb.from('coach_drills').select('*').eq('club_id',S.club.id); S.dbDrills=data||[];
    closeSheet(); go('library'); };
}

/* ---------- MATCH ---------- */
let MATCH={clock:0,timer:null,running:false,half:1};
VIEWS.match = async function(){
  if(!S.team) return go('home');
  if(!S.match){
    const pool=presentPlayers().length?presentPlayers():S.players.filter(p=>p.status==='active');
    screen('מצב משחק', `
      <div class="card stack">
        <p class="sm muted">${pool.length} שחקנים זמינים</p>
        <button class="btn primary big" onclick="splitAuto()">חלוקה אוטומטית מאוזנת</button>
        <button class="btn big" onclick="splitManual()">חלוקה ידנית</button>
      </div>
      <div id="splitBox"></div>`);
    return;
  }
  renderMatch();
};
async function splitAuto(){
  const pool=(presentPlayers().length?presentPlayers():S.players.filter(p=>p.status==='active'));
  const ids=pool.map(p=>p.id);
  let obs=[];
  if(ids.length){const {data}=await sb.from('coach_observations').select('player_id,attribute,score,source,at').in('player_id',ids).eq('voided',false).limit(4000);obs=data||[];}
  LOCAL_OBS.filter(o=>ids.includes(o.player_id)).forEach(o=>obs.push(o));
  const byP={}; obs.forEach(o=>(byP[o.player_id]=byP[o.player_id]||[]).push(o));
  const rated=pool.map(p=>{const sc=scoreFromObs(byP[p.id]||[]);const v=Object.values(sc).map(x=>x.score).filter(Boolean);
    return {p,v:v.length?v.reduce((a,b)=>a+b,0)/v.length:10};}).sort((a,b)=>b.v-a.v);
  const A=[],B=[]; let sa=0,sb2=0;
  rated.forEach(r=>{
    const toA = A.length===B.length ? (sa<=sb2) : (A.length<B.length);
    if(toA){A.push(r.p);sa+=r.v;} else {B.push(r.p);sb2+=r.v;}
  });
  MATCH.split={a:A.map(p=>p.id),b:B.map(p=>p.id),sa,sb:sb2};
  renderSplit();
}
function splitManual(){
  const pool=presentPlayers().length?presentPlayers():S.players.filter(p=>p.status==='active');
  MATCH.split={a:[],b:[],manual:true};
  renderSplit();
}
function renderSplit(){
  const pool=presentPlayers().length?presentPlayers():S.players.filter(p=>p.status==='active');
  const sp=MATCH.split;
  const avgA = sp.sa&&sp.a.length ? sp.sa/sp.a.length : null, avgB = sp.sb&&sp.b.length ? sp.sb/sp.b.length : null;
  const bal = (avgA&&avgB) ? Math.round(Math.abs(avgA-avgB)/((avgA+avgB)/2)*100) : null;
  $('#splitBox').innerHTML=`
    <div class="hd"><h2>החלוקה</h2>${bal!=null?`<span class="pill ${bal>10?'warn':'ok'}">פער ${bal}%</span>`:''}</div>
    <div class="grid2">
      <div class="card" style="border-top:3px solid var(--ta)"><h3 style="color:var(--ta)">קבוצה א׳ · אפוד כחול</h3>
        <div class="stack" style="margin-top:8px">${sp.a.map(id=>pRow(id,'a')).join('')||'<p class="xs muted">ריק</p>'}</div></div>
      <div class="card" style="border-top:3px solid var(--tb)"><h3 style="color:var(--tb)">קבוצה ב׳ · אפוד אדום</h3>
        <div class="stack" style="margin-top:8px">${sp.b.map(id=>pRow(id,'b')).join('')||'<p class="xs muted">ריק</p>'}</div></div>
    </div>
    ${pool.filter(p=>!sp.a.includes(p.id)&&!sp.b.includes(p.id)).length?`<div class="hd"><h2>לשבץ</h2></div>
      <div class="tiles">${pool.filter(p=>!sp.a.includes(p.id)&&!sp.b.includes(p.id)).map(p=>`
        <div class="tile"><b>${esc(p.name.split(' ')[0])}</b>
          <div class="row" style="gap:4px;margin-top:5px;justify-content:center">
            <button class="btn sm" style="padding:3px 9px;color:var(--ta)" onclick="assign('${p.id}','a')">א׳</button>
            <button class="btn sm" style="padding:3px 9px;color:var(--tb)" onclick="assign('${p.id}','b')">ב׳</button></div></div>`).join('')}</div>`:''}
    <button class="btn primary big" style="margin-top:14px" onclick="beginMatch()" ${sp.a.length&&sp.b.length?'':'disabled'}>התחל משחק</button>
    <button class="btn ghost" style="margin-top:8px;width:100%" onclick="splitAuto()">ערבב שוב</button>`;
}
function pRow(id,side){const p=S.players.find(x=>x.id===id)||{name:'—'};
  return `<div class="row" style="gap:6px"><div class="av ${side}" style="width:28px;height:28px;font-size:11px">${esc(initials(p.name))}</div>
    <span class="sm" style="flex:1">${esc(p.name)}</span>
    <button class="btn sm ghost" style="padding:2px 8px" onclick="assign('${id}','${side==='a'?'b':'a'}')">⇄</button></div>`;}
function assign(id,side){
  const sp=MATCH.split; sp.a=sp.a.filter(x=>x!==id); sp.b=sp.b.filter(x=>x!==id); sp[side].push(id); renderSplit();
}
async function beginMatch(){
  const row={team_id:S.team.id,session_id:S.session?.id||null,kind:S.team.league_mode?'internal':'internal',
    date:today(),split:MATCH.split,halves:2,half_minutes:10};
  const {data,error}=await sb.from('coach_matches').insert(row).select().single();
  if(error) return toast('שגיאה: '+error.message);
  S.match=data; MATCH.clock=0; MATCH.half=1; MATCH.events=[];
  go('match');
}
function renderMatch(){
  const m=S.match, sp=m.split||{a:[],b:[]};
  screen('משחק', `
    <div class="timer">
      <div class="spread">
        <div style="text-align:center;flex:1"><p class="xs muted">קבוצה א׳</p><div class="t num" style="color:var(--ta)" id="sa">${m.score_a}</div></div>
        <div style="text-align:center"><div class="t num" id="mclk">00:00</div>
          <p class="xs muted">מחצית <span id="mh">${MATCH.half}</span></p>
          <button class="btn sm" id="mpp" style="margin-top:4px">▶</button></div>
        <div style="text-align:center;flex:1"><p class="xs muted">קבוצה ב׳</p><div class="t num" style="color:var(--tb)" id="sb2">${m.score_b}</div></div>
      </div>
    </div>
    <div class="row" style="margin-top:10px;gap:8px">
      <button class="btn" style="flex:1" onclick="halfEnd()">סיום מחצית</button>
      <button class="btn danger" style="flex:1" onclick="endMatch()">סיום משחק</button>
    </div>
    <div class="hd"><h2 style="color:var(--ta)">קבוצה א׳</h2></div>
    <div class="tiles" id="tilesA"></div>
    <div class="hd"><h2 style="color:var(--tb)">קבוצה ב׳</h2></div>
    <div class="tiles" id="tilesB"></div>`);
  drawMatchTiles();
  $('#mpp').onclick=()=>{
    if(MATCH.timer){clearInterval(MATCH.timer);MATCH.timer=null;$('#mpp').textContent='▶';}
    else{MATCH.timer=setInterval(()=>{MATCH.clock++;const c=$('#mclk');if(c)c.textContent=String(Math.floor(MATCH.clock/60)).padStart(2,'0')+':'+String(MATCH.clock%60).padStart(2,'0');},1000);$('#mpp').textContent='⏸';}
  };
}
function drawMatchTiles(){
  const sp=S.match?.split||{a:[],b:[]};
  const draw=(ids,cls)=>ids.map(id=>{const p=S.players.find(x=>x.id===id);if(!p)return'';
    const n=LOCAL_OBS.filter(o=>o.player_id===id&&o.match_id===S.match.id).length;
    return `<button class="tile t${cls}" onclick="matchTap('${id}')">${n?`<span class="cnt">${n}</span>`:''}
      <b>${esc(p.name.split(' ')[0])}</b><span class="xs muted">${p.shirt_no?'#'+p.shirt_no:''}</span></button>`;}).join('');
  if($('#tilesA'))$('#tilesA').innerHTML=draw(sp.a,'a');
  if($('#tilesB'))$('#tilesB').innerHTML=draw(sp.b,'b');
}
function matchTap(pid){
  const p=S.players.find(x=>x.id===pid);
  const side=S.match.split.a.includes(pid)?'a':'b';
  sheet(`<h2>${esc(p.name)}</h2>
    <div class="grid2" style="margin-top:12px">
      <button class="btn primary" onclick="mEvent('${pid}','goal','${side}')">⚽ שער</button>
      <button class="btn" onclick="mEvent('${pid}','assist','${side}')">🅰️ בישול</button>
    </div>
    <div class="sep"></div>
    <div class="chips">${tagsForTeam().map((t,i)=>`<button class="chip" onclick="applyTag('${pid}',${i})">${t.good?'👍':'⚠️'} ${esc(t.t)}</button>`).join('')}</div>
    <div class="sep"></div>
    <div id="attrPick"><p class="xs muted" style="margin-bottom:6px">דירוג תכונה</p>
      <div class="chips">${teamAttrs(p.position==='שוער').map(a=>`<button class="chip" onclick="pickAttr('${pid}','${a.key}')">${esc(a.label)}</button>`).join('')}</div></div>
    <div id="scorePick"></div>`);
}
async function mEvent(pid,type,side){
  const minute=Math.floor(MATCH.clock/60);
  await push('coach_match_events',{match_id:S.match.id,player_id:pid,type,minute});
  if(type==='goal'){
    if(side==='a')S.match.score_a++; else S.match.score_b++;
    await sb.from('coach_matches').update({score_a:S.match.score_a,score_b:S.match.score_b}).eq('id',S.match.id);
    const el=$(side==='a'?'#sa':'#sb2'); if(el)el.textContent=side==='a'?S.match.score_a:S.match.score_b;
    await addObs(pid,'shooting',5,{source:'match',match_id:S.match.id});
  } else await addObs(pid,'passing',5,{source:'match',match_id:S.match.id});
  closeSheet(); drawMatchTiles(); toast(type==='goal'?'שער!':'בישול');
}
function halfEnd(){ MATCH.half++; MATCH.clock=0; clearInterval(MATCH.timer); MATCH.timer=null;
  const h=$('#mh'); if(h)h.textContent=MATCH.half; const c=$('#mclk'); if(c)c.textContent='00:00';
  const b=$('#mpp'); if(b)b.textContent='▶'; toast('מחצית '+MATCH.half); }
function endMatch(){
  clearInterval(MATCH.timer); MATCH.timer=null;
  const all=[...(S.match.split.a||[]),...(S.match.split.b||[])];
  let i=0;
  const step=()=>{
    if(i>=all.length){ finishMatch(); return; }
    const p=S.players.find(x=>x.id===all[i]);
    if(!p){i++;return step();}
    sheet(`<p class="xs muted">ציון משחק ${i+1}/${all.length}</p><h2>${esc(p.name)}</h2>
      <div class="scorerow" style="margin-top:12px;grid-template-columns:repeat(5,1fr)">
        ${[6,7,8,9,10].map(v=>`<button onclick="mRate('${p.id}',${v})">${v}</button>`).join('')}</div>
      <div class="scorerow" style="margin-top:6px;grid-template-columns:repeat(5,1fr)">
        ${[1,2,3,4,5].map(v=>`<button onclick="mRate('${p.id}',${v})">${v}</button>`).join('')}</div>
      <button class="btn ghost" style="width:100%;margin-top:10px" onclick="mSkip()">דלג</button>`);
  };
  window.mRate=async(pid,v)=>{ await push('coach_match_events',{match_id:S.match.id,player_id:pid,type:'rating',value:v});
    await addObs(pid,'decisions',Math.max(1,Math.round(v/2)),{source:'match',match_id:S.match.id,note:'ציון משחק '+v}); i++; step(); };
  window.mSkip=()=>{i++;step();};
  step();
}
async function finishMatch(){
  closeSheet();
  const m=S.match; S.match=null; MATCH={clock:0,timer:null,running:false,half:1};
  toast('המשחק נשמר'); go('home');
}

/* ---------- PLAYER CARD ---------- */
VIEWS.player = async function(pid){
  const p=S.players.find(x=>x.id===pid); if(!p) return go('squad');
  screen(p.name, '<div class="empty">טוען…</div>', `<button class="iconbtn" id="edp">✎</button>`);
  $('#edp').onclick=()=>playerForm(p);
  const [{data:obs},{data:disc},{data:tests},{data:goals},{data:att}] = await Promise.all([
    sb.from('coach_observations').select('*').eq('player_id',pid).eq('voided',false).order('at',{ascending:false}).limit(1200),
    sb.from('coach_discipline').select('*').eq('player_id',pid).order('at',{ascending:false}).limit(20),
    sb.from('coach_tests').select('*').eq('player_id',pid).order('at',{ascending:false}).limit(20),
    sb.from('coach_goals').select('*').eq('player_id',pid).order('created_at',{ascending:false}).limit(5),
    sb.from('coach_attendance').select('present,session_id').eq('player_id',pid).limit(60)
  ]);
  const list=[...(obs||[]),...LOCAL_OBS.filter(o=>o.player_id===pid)];
  const sc=scoreFromObs(list);
  const isGk=p.position==='שוער';
  const attrs=teamAttrs(isGk).filter(a=>isGk?true:a.grp!=='gk');
  const vals=attrs.map(a=>sc[a.key]?.score).filter(v=>v!=null);
  const overall=vals.length?(vals.reduce((x,y)=>x+y,0)/vals.length).toFixed(1):'—';
  const present=(att||[]).filter(a=>a.present==='yes').length, tot=(att||[]).length;
  const grps={}; attrs.forEach(a=>(grps[a.grp]=grps[a.grp]||[]).push(a));
  const showNum = S.team?.age_profile!=='a';
  const bar=(v)=>{const pct=Math.max(4,Math.min(100,(v/20)*100));const col=v>=15?'var(--ok)':v>=10?'var(--warn)':'var(--bad)';return `<div class="bar"><i style="width:${pct}%;background:${col}"></i></div>`;};
  const trIcon=t=>t==null?'':t>=1?'<span style="color:var(--ok)">▲</span>':t<=-1?'<span style="color:var(--bad)">▼</span>':'<span class="muted">—</span>';

  $('.wrap').innerHTML=`
    <div class="card">
      <div class="spread"><div>
        <h2>${esc(p.name)}</h2>
        <p class="muted sm">${[p.position,p.shirt_no?'#'+p.shirt_no:'',age(p.birth_date)?age(p.birth_date)+' שנים':''].filter(Boolean).join(' · ')}</p>
        ${p.birth_date?`<p class="xs muted">נולד בחודש ${new Date(p.birth_date).getMonth()+1} — גיל יחסי${new Date(p.birth_date).getMonth()<3?' גבוה בשנתון':new Date(p.birth_date).getMonth()>8?' נמוך בשנתון':''}</p>`:''}
      </div><div style="text-align:center">
        <div style="font-family:'Secular One';font-size:32px;line-height:1">${showNum?overall:(vals.length?'●':'—')}</div>
        <p class="xs muted">${showNum?'ציון כללי':'רמה'}</p></div></div>
      <div class="sep"></div>
      <div class="row wrap" style="gap:6px">
        <span class="pill">נוכחות ${tot?Math.round(present/tot*100):0}%</span>
        <span class="pill">${list.length} תצפיות</span>
        ${p.status!=='active'?`<span class="pill warn">${({injured:'פצוע',sick:'חולה',away:'חופש'})[p.status]}</span>`:''}
      </div>
    </div>

    ${vals.length?`<div class="card" style="margin-top:10px">${radar(attrs,sc)}</div>`:''}

    ${Object.entries(grps).map(([g,list2])=>`
      <div class="hd"><h2>${GRP_LABEL[g]||g}</h2></div>
      <div class="card">${list2.map(a=>{const s=sc[a.key];
        if(!s) return `<div class="attr dim"><span>${esc(a.label)}</span><div class="bar"></div><span class="v">—</span><span class="tr"></span></div>`;
        return `<div class="attr ${s.conf==='none'||s.conf==='low'?'dim':''}"><span>${esc(a.label)}</span>${bar(s.score)}
          <span class="v num">${showNum?s.score:''}</span><span class="tr">${trIcon(s.trend)}</span></div>`;}).join('')}
      </div>`).join('')}

    <div class="hd"><h2>יעד אישי</h2><button class="btn sm" onclick="goalForm('${pid}')">+</button></div>
    ${(goals||[]).length?`<div class="stack">${goals.map(g=>`<div class="prow"><div class="pname"><b class="sm">${esc(g.text)}</b>
      <span class="xs muted">${g.due?'עד '+fmtDate(g.due):''}</span></div>${g.done_at?'<span class="pill ok">הושג</span>':`<button class="btn sm" onclick="doneGoal('${g.id}','${pid}')">✓</button>`}</div>`).join('')}</div>`:'<p class="muted sm">אין יעד פעיל.</p>'}

    <div class="hd"><h2>משמעת והתנהגות</h2><button class="btn sm" onclick="discForm('${pid}')">+</button></div>
    ${(disc||[]).length?`<div class="stack">${disc.slice(0,5).map(d=>`<div class="prow">
      <div class="pname"><b class="sm">${esc(d.kind)}</b><span class="xs muted">${fmtDate(d.at)}${d.note?' · '+esc(d.note):''}</span></div>
      <span class="pill ${d.positive?'ok':d.severity>=3?'bad':'warn'}">${d.positive?'חיובי':'רמה '+d.severity}</span></div>`).join('')}</div>`
      :'<p class="muted sm">אין רישומים.</p>'}

    ${(tests||[]).length?`<div class="hd"><h2>מדידות</h2></div><div class="scroll-x"><table class="tbl">
      <tr><th>מבחן</th><th>תוצאה</th><th>תאריך</th></tr>
      ${tests.slice(0,8).map(t=>`<tr><td>${esc(t.test)}</td><td class="num">${t.value} ${esc(t.unit)}</td><td class="xs muted">${fmtDate(t.at)}</td></tr>`).join('')}</table></div>`:''}

    <div class="hd"><h2>תצפיות אחרונות</h2></div>
    <div class="stack">${list.slice(0,12).map(o=>`<div class="prow"><div class="pname">
      <b class="sm">${esc(ATTR_LABEL(o.attribute))} — ${o.score}</b>
      <span class="xs muted">${esc(o.tag||({drill:'תרגיל',match:'משחק',test:'מבחן',tag:'תגית',challenge:'אתגר'})[o.source]||'')} · ${fmtDate(o.at)}</span></div></div>`).join('')||'<p class="muted sm">אין עדיין תצפיות.</p>'}</div>

    <div class="hd"><h2>מסמכים וכשירות</h2><button class="btn sm" onclick="healthForm('${pid}')">עריכה</button></div>
    <div class="card">${healthRows(p,S.team)}</div>

    <button class="btn big" style="margin-top:16px" onclick="parentMsg('${pid}')">הודעה להורה</button>`;
};
function radar(attrs,sc){
  const pts=attrs.slice(0,8);
  if(pts.length<3) return '';
  const cx=60,cy=60,R=48;
  const ang=i=>(-Math.PI/2)+(i*2*Math.PI/pts.length);
  const ring=r=>pts.map((_,i)=>[(cx+r*Math.cos(ang(i))).toFixed(1),(cy+r*Math.sin(ang(i))).toFixed(1)].join(',')).join(' ');
  const poly2=pts.map((a,i)=>{const v=(sc[a.key]?.score||0)/20;return [(cx+R*v*Math.cos(ang(i))).toFixed(1),(cy+R*v*Math.sin(ang(i))).toFixed(1)].join(',');}).join(' ');
  return `<svg viewBox="0 0 120 120" style="width:100%;max-width:280px;margin:0 auto;display:block">
    ${[0.25,0.5,0.75,1].map(r=>`<polygon points="${ring(R*r)}" fill="none" stroke="var(--line)" stroke-width=".6"/>`).join('')}
    ${pts.map((_,i)=>`<line x1="${cx}" y1="${cy}" x2="${(cx+R*Math.cos(ang(i))).toFixed(1)}" y2="${(cy+R*Math.sin(ang(i))).toFixed(1)}" stroke="var(--line)" stroke-width=".5"/>`).join('')}
    <polygon points="${poly2}" fill="var(--accent)" fill-opacity=".28" stroke="var(--accent)" stroke-width="1.4"/>
    ${pts.map((a,i)=>{const x=cx+(R+9)*Math.cos(ang(i)),y=cy+(R+9)*Math.sin(ang(i));
      return `<text x="${x.toFixed(1)}" y="${(y+1.5).toFixed(1)}" font-size="5" fill="var(--muted)" text-anchor="middle">${esc(a.label)}</text>`;}).join('')}
  </svg>`;
}
function goalForm(pid){
  sheet(`<h2>יעד אישי</h2><div class="stack" style="margin-top:12px">
    <label class="f">מה עובדים עליו<input id="gt" placeholder="נגיעה ראשונה עם גוף פתוח"></label>
    <label class="f">עד תאריך<input id="gd" type="date"></label>
    <button class="btn primary big" id="gs">שמירה</button></div>`);
  $('#gs').onclick=async()=>{ const t=$('#gt').value.trim(); if(!t)return;
    await sb.from('coach_goals').insert({player_id:pid,text:t,due:$('#gd').value||null});
    closeSheet(); go('player',pid); };
}
async function doneGoal(id,pid){ await sb.from('coach_goals').update({done_at:new Date().toISOString()}).eq('id',id); go('player',pid); }
function discForm(pid){
  const kinds=['איחור','חוצפה','לא הקשיב','בלי ציוד','טלפון באימון','ויכוח עם שופט','אלימות','התנהגות מצוינת','עזר לחבר'];
  sheet(`<h2>רישום משמעת</h2><div class="stack" style="margin-top:12px">
    <label class="f">סוג<select id="dk">${kinds.map(k=>`<option>${k}</option>`).join('')}</select></label>
    <label class="f">חומרה<select id="dsv2"><option value="1">1 — קל</option><option value="2">2 — בינוני</option><option value="3">3 — חמור</option></select></label>
    <label class="f">מה קרה<textarea id="dnote" rows="2"></textarea></label>
    <label class="f">מה עשיתי<input id="dact" placeholder="שיחה / ישב בצד"></label>
    <button class="btn primary big" id="dsave">שמירה</button>
    <button class="btn" id="dnotify">שמירה + עדכון הורה בוואטסאפ</button></div>`);
  const build=()=>({player_id:pid,team_id:S.team.id,kind:$('#dk').value,severity:+$('#dsv2').value,
    positive:['התנהגות מצוינת','עזר לחבר'].includes($('#dk').value),
    note:$('#dnote').value||null,action:$('#dact').value||null,by_user:S.user.id});
  $('#dsave').onclick=async()=>{ await sb.from('coach_discipline').insert(build()); closeSheet(); go('player',pid); toast('נרשם'); };
  $('#dnotify').onclick=async()=>{
    const row=build(); row.parent_notified_at=new Date().toISOString();
    await sb.from('coach_discipline').insert(row);
    const p=S.players.find(x=>x.id===pid);
    const txt=`שלום, כאן המאמן של ${S.team.name}. רציתי לעדכן לגבי ${p.name}: ${row.kind}${row.note?' — '+row.note:''}. ${row.action?'טיפלנו בזה: '+row.action+'. ':''}נשמח לדבר.`;
    const ph=(p.parent_phone||'').replace(/\D/g,'').replace(/^0/,'972');
    await waOpen('https://wa.me/'+(ph||'')+'?text='+encodeURIComponent(txt));
    closeSheet(); go('player',pid);
  };
}
function parentMsg(pid){
  const p=S.players.find(x=>x.id===pid);
  const list=LOCAL_OBS.filter(o=>o.player_id===pid);
  const sc=scoreFromObs(list);
  const up=Object.entries(sc).filter(([k,v])=>v.trend>=1).map(([k])=>ATTR_LABEL(k));
  const txt=`שלום! עדכון קצר על ${p.name} מהחודש האחרון ב${S.team.name}: ${up.length?'התקדמות יפה ב'+up.join(', ')+'. ':'עובד יפה באימונים. '}נמשיך לעבוד. תודה!`;
  const ph=(p.parent_phone||'').replace(/\D/g,'').replace(/^0/,'972');
  waOpen('https://wa.me/'+(ph||'')+'?text='+encodeURIComponent(txt));
}

/* ---------- TESTS ---------- */
let TIMERS={};
VIEWS.tests = function(){
  const protos=[{k:'ספרינט 20 מ׳',u:'sec',d:20},{k:'ספרינט 10 מ׳',u:'sec',d:10},{k:'זריזות 5-10-5',u:'sec',d:20},
    {k:'קפיצה למרחק',u:'cm'},{k:'הקפצות ב-60 שנ׳',u:'reps'},{k:'מסירות לקיר ב-30 שנ׳',u:'reps'}];
  screen('מדידות', `
    <div class="card stack">
      <label class="f">מבחן<select id="tp">${protos.map(p=>`<option value="${esc(p.k)}" data-u="${p.u}" data-d="${p.d||''}">${esc(p.k)}</option>`).join('')}</select></label>
      <label class="f">מרחק (מ׳) — אם רלוונטי<input id="td" type="number" class="num" value="20"></label>
      <p class="xs muted">לחיצה על שחקן מתחילה ספירה; לחיצה שנייה עוצרת. במצב קבוצתי לוחצים "התחל לכולם" ואז מקישים על כל שחקן כשהוא חוצה.</p>
      <div class="row" style="gap:8px"><button class="btn" style="flex:1" id="grpStart">התחל לכולם</button>
        <button class="btn ghost" style="flex:1" id="grpReset">איפוס</button></div>
    </div>
    <div class="hd"><h2>שחקנים</h2></div>
    <div class="tiles" id="ttiles"></div>
    <button class="btn primary big" style="margin-top:14px" id="saveT">שמירת התוצאות</button>`);
  TIMERS={}; let groupStart=0, tick=null;
  const draw=()=>{ $('#ttiles').innerHTML=S.players.map(p=>{
      const v=TIMERS[p.id];
      return `<button class="tile ${v&&v.done?'on':''}" onclick="tapTest('${p.id}')">
        <b>${esc(p.name.split(' ')[0])}</b><span class="num sm">${v?(v.done?v.val.toFixed(2):'…'):'—'}</span></button>`;}).join(''); };
  window.tapTest=(pid)=>{
    const now=performance.now();
    if(groupStart){ if(!TIMERS[pid]||!TIMERS[pid].done) TIMERS[pid]={done:true,val:(now-groupStart)/1000}; else delete TIMERS[pid]; }
    else{
      const t=TIMERS[pid];
      if(!t) TIMERS[pid]={start:now};
      else if(!t.done) TIMERS[pid]={done:true,val:(now-t.start)/1000};
      else delete TIMERS[pid];
    }
    draw();
  };
  $('#grpStart').onclick=()=>{ groupStart=performance.now(); TIMERS={}; draw(); toast('רץ — הקישו על כל שחקן בחצייה'); };
  $('#grpReset').onclick=()=>{ groupStart=0; TIMERS={}; draw(); };
  $('#saveT').onclick=async()=>{
    const sel=$('#tp'), unit=sel.selectedOptions[0].dataset.u, test=sel.value, dist=+$('#td').value||null;
    const rows=Object.entries(TIMERS).filter(([,v])=>v.done).map(([pid,v])=>({player_id:pid,test,value:+v.val.toFixed(2),unit,distance_m:dist}));
    if(!rows.length) return toast('אין תוצאות');
    await push('coach_tests',rows);
    for(const r of rows){ const norm=Math.max(1,Math.min(5,Math.round(6-((r.value-3)/0.6)))); await addObs(r.player_id,'speed',norm,{source:'test'}); }
    TIMERS={}; draw(); toast(`נשמרו ${rows.length} מדידות`);
  };
  draw();
};

/* ---------- REPORTS ---------- */
VIEWS.reports = async function(){
  screen('דוחות', '<div class="empty">טוען…</div>');
  const ids=S.players.map(p=>p.id);
  const [{data:obs},{data:att},{data:sess}] = await Promise.all([
    ids.length?sb.from('coach_observations').select('player_id,attribute,score,source,at').in('player_id',ids).eq('voided',false).limit(6000):{data:[]},
    sb.from('coach_attendance').select('player_id,present,session_id,coach_sessions!inner(team_id)').eq('coach_sessions.team_id',S.team.id).limit(1500),
    sb.from('coach_sessions').select('id,date,status,focus').eq('team_id',S.team.id).eq('status','done').limit(60)
  ]);
  const all=[...(obs||[]),...LOCAL_OBS.filter(o=>ids.includes(o.player_id))];
  const byP={}; all.forEach(o=>(byP[o.player_id]=byP[o.player_id]||[]).push(o));
  const rows=S.players.map(p=>{
    const sc=scoreFromObs(byP[p.id]||[]);
    const vals=Object.values(sc).map(x=>x.score).filter(v=>v!=null);
    const tr=Object.values(sc).map(x=>x.trend).filter(v=>v!=null);
    const a=(att||[]).filter(x=>x.player_id===p.id);
    return {p, ov:vals.length?vals.reduce((x,y)=>x+y,0)/vals.length:null,
      trend:tr.length?tr.reduce((x,y)=>x+y,0)/tr.length:null,
      att:a.length?a.filter(x=>x.present==='yes').length/a.length:null, n:a.length};
  });
  const up=[...rows].filter(r=>r.trend!=null).sort((a,b)=>b.trend-a.trend).slice(0,3);
  const down=[...rows].filter(r=>r.trend!=null&&r.trend<-0.5).sort((a,b)=>a.trend-b.trend).slice(0,3);
  // team weakest attributes
  const agg={}; all.forEach(o=>{(agg[o.attribute]=agg[o.attribute]||[]).push(o.score);});
  const weak=Object.entries(agg).map(([k,v])=>({k,avg:v.reduce((a,b)=>a+b,0)/v.length,n:v.length}))
    .filter(x=>x.n>=5).sort((a,b)=>a.avg-b.avg).slice(0,3);
  $('.wrap').innerHTML=`
    <div class="card"><h2>${esc(S.team.name)}</h2>
      <p class="muted sm">${(sess||[]).length} אימונים הושלמו · ${all.length} תצפיות · ${S.players.length} שחקנים</p></div>
    ${weak.length?`<div class="hd"><h2>מה לאמן בשבוע הבא</h2></div><div class="card">
      ${weak.map(w=>`<div class="attr"><span>${esc(ATTR_LABEL(w.k))}</span>
        <div class="bar"><i style="width:${(w.avg/5*100).toFixed(0)}%;background:var(--warn)"></i></div>
        <span class="v num">${w.avg.toFixed(1)}</span><span class="tr xs muted">${w.n}</span></div>`).join('')}
      <p class="xs muted" style="margin-top:8px">הממוצע הנמוך ביותר בקבוצה — שווה לבנות סביבו את הדגש הבא.</p></div>`:''}
    ${up.length?`<div class="hd"><h2>הכי התקדמו</h2></div><div class="stack">
      ${up.map(r=>`<div class="prow" onclick="go('player','${r.p.id}')"><div class="av">${esc(initials(r.p.name))}</div>
        <div class="pname"><b>${esc(r.p.name)}</b></div><span class="pill ok" dir="ltr">+${r.trend.toFixed(1)}</span></div>`).join('')}</div>`:''}
    ${down.length?`<div class="hd"><h2>בירידה</h2></div><div class="stack">
      ${down.map(r=>`<div class="prow" onclick="go('player','${r.p.id}')"><div class="av">${esc(initials(r.p.name))}</div>
        <div class="pname"><b>${esc(r.p.name)}</b></div><span class="pill bad" dir="ltr">${r.trend.toFixed(1)}</span></div>`).join('')}</div>`:''}
    <div class="hd"><h2>נוכחות</h2></div>
    <div class="scroll-x"><table class="tbl"><tr><th>שחקן</th><th>נוכחות</th><th>ציון</th></tr>
      ${rows.sort((a,b)=>(a.att??1)-(b.att??1)).map(r=>`<tr onclick="go('player','${r.p.id}')">
        <td>${esc(r.p.name)}</td><td class="num">${r.att!=null?Math.round(r.att*100)+'%':'—'} <span class="xs muted">(${r.n})</span></td>
        <td class="num">${r.ov!=null?r.ov.toFixed(1):'—'}</td></tr>`).join('')}</table></div>`;
};

/* ---------- MORE / SETTINGS ---------- */
VIEWS.more = function(){
  screen('עוד', `<div class="stack">
    <button class="btn big" onclick="go('reports')">📊 דוחות קבוצה</button>
    <button class="btn big" onclick="go('tests')">⏱ מדידות זמן ומרחק</button>
    <button class="btn big" onclick="openBoard()">▦ לוח טקטי</button>
    <button class="btn big" onclick="go('match')">🥅 מצב משחק</button>
    <button class="btn big" onclick="go('discipline')">📔 יומן משמעת</button>
    <button class="btn big" onclick="go('broadcast')">💬 עדכון לקבוצת הוואטסאפ</button>
    <button class="btn big" onclick="go('parents')">👨‍👩‍👦 הורים והזמנות</button>
    <button class="btn big" onclick="go('docs')">📋 מסמכים וכשירות</button>
    <button class="btn big" onclick="go('roster')">📥 ייבוא רשימת שחקנים</button>
    <button class="btn big" onclick="go('teamedit')">⚙️ הגדרות קבוצה</button>
    <button class="btn big" onclick="go('settings')">🏫 מועדון וקבוצות</button>
    <div class="sep"></div>
    <p class="xs muted">${esc(S.club?.name||'')} · ${esc(S.user?.email||'')} · ${S.role==='coach'?'מאמן':S.role}</p>
    <p class="xs muted">ממתינים לסנכרון: ${QUEUE.length}</p>
    <button class="btn ghost" onclick="flushQueue()">סנכרון עכשיו</button>
    <button class="btn danger" onclick="signOut()">יציאה</button></div>`);
};
async function signOut(){ await sb.auth.signOut(); LS('dev',null); location.reload(); }

VIEWS.discipline = async function(){
  screen('יומן משמעת', '<div class="empty">טוען…</div>');
  const ids=S.players.map(p=>p.id);
  const {data}=ids.length?await sb.from('coach_discipline').select('*').in('player_id',ids).order('at',{ascending:false}).limit(60):{data:[]};
  const flag={}; (data||[]).filter(d=>!d.positive&&daysAgo(d.at)<=30).forEach(d=>flag[d.player_id]=(flag[d.player_id]||0)+1);
  $('.wrap').innerHTML=`
    ${Object.entries(flag).filter(([,n])=>n>=3).map(([pid,n])=>{const p=S.players.find(x=>x.id===pid)||{name:'—'};
      return `<div class="prow" style="border-color:var(--bad)"><div class="av">${esc(initials(p.name))}</div>
        <div class="pname"><b>${esc(p.name)}</b><span class="xs muted">${n} אירועים ב-30 יום</span></div><span class="pill bad">דגל</span></div>`;}).join('')}
    <div class="hd"><h2>רישומים אחרונים</h2></div>
    <div class="stack">${(data||[]).map(d=>{const p=S.players.find(x=>x.id===d.player_id)||{name:'—'};
      return `<div class="prow" onclick="go('player','${d.player_id}')"><div class="av">${esc(initials(p.name))}</div>
        <div class="pname"><b class="sm">${esc(p.name)} — ${esc(d.kind)}</b>
        <span class="xs muted">${fmtDate(d.at)}${d.action?' · '+esc(d.action):''}${d.parent_notified_at?' · הורה עודכן':''}</span></div>
        <span class="pill ${d.positive?'ok':d.severity>=3?'bad':'warn'}">${d.positive?'חיובי':d.severity}</span></div>`;}).join('')||'<p class="muted sm">אין רישומים.</p>'}</div>`;
};

VIEWS.teamedit = function(){
  const t=S.team; if(!t) return go('settings');
  screen('הגדרות קבוצה', `<div class="card stack">
    <label class="f">שם<input id="tn" value="${esc(t.name)}"></label>
    <label class="f">קבוצת גיל<select id="tap">${Object.entries(AGES).map(([k,v])=>`<option value="${k}" ${k===t.age_profile?'selected':''}>${v}</option>`).join('')}</select></label>
    <div class="grid2">
      <label class="f">אורך אימון<input id="tsm" type="number" class="num" value="${t.session_minutes}"></label>
      <label class="f">סולם דירוג<select id="trs"><option value="3" ${t.rating_scale===3?'selected':''}>3 כוכבים</option><option value="5" ${t.rating_scale===5?'selected':''}>1–5</option></select></label>
    </div>
    <label class="f">פורמט משחק<select id="tmf">${['4v4','5v5','7v7','9v9','11v11'].map(x=>`<option ${x===t.match_format?'selected':''}>${x}</option>`).join('')}</select></label>
    <label class="f">מסגרת תחרותית<select id="tlp">${Object.entries(LEAGUE).map(([k,v])=>`<option value="${k}" ${k===teamProfile(t)?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
    <p class="xs muted" id="tlpn" style="margin:-6px 0 0">${esc(LEAGUE[teamProfile(t)].note)}</p>
    <label class="f row" id="tlprm" style="flex-direction:row;align-items:center;gap:8px${teamProfile(t)==='ifa'?';display:none':''}"><input type="checkbox" id="trm" ${t.requires_medical?'checked':''} style="width:auto"> הליגה דורשת אישור רפואי</label>
    <label class="f row" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="trp" ${t.rpe_enabled?'checked':''} style="width:auto"> RPE (עומס מורגש) פעיל</label>
    <label class="f row" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="tsp" ${t.show_scores_to_player?'checked':''} style="width:auto"> השחקן רואה ציון מספרי</label>
    <label class="f row" style="flex-direction:row;align-items:center;gap:8px"><input type="checkbox" id="tpp" ${t.parent_sees_scores?'checked':''} style="width:auto"> ההורה רואה ציונים</label>
    <button class="btn primary big" id="tsv">שמירה</button>
  </div>
  <div class="card" style="margin-top:10px"><h3>תכונות שמדורגות בקבוצה הזו</h3>
    <div class="chips" style="margin-top:8px">${teamAttrs(true).map(a=>`<span class="chip">${esc(a.label)}</span>`).join('')}</div>
    <p class="xs muted" style="margin-top:8px">נקבע אוטומטית לפי קבוצת הגיל.</p></div>`);
  $('#tlp').onchange=()=>{ const v=$('#tlp').value;
    $('#tlpn').textContent=LEAGUE[v].note;
    $('#tlprm').style.display = v==='ifa' ? 'none' : ''; };
  $('#tsv').onclick=async()=>{
    const lp=$('#tlp').value;
    const row={name:$('#tn').value.trim()||t.name,age_profile:$('#tap').value,session_minutes:+$('#tsm').value||60,
      rating_scale:+$('#trs').value,match_format:$('#tmf').value,
      league_profile:lp, league_mode:lp!=='school', requires_medical: lp==='ifa' || $('#trm').checked,
      rpe_enabled:$('#trp').checked,show_scores_to_player:$('#tsp').checked,parent_sees_scores:$('#tpp').checked};
    const {error}=await sb.from('coach_teams').update(row).eq('id',t.id);
    if(error) return toast('שגיאה: '+error.message);
    Object.assign(S.team,row); S.teams=S.teams.map(x=>x.id===t.id?S.team:x);
    toast('נשמר'); go('home');
  };
};

VIEWS.settings = function(){
  screen('מועדון וקבוצות', `
    <div class="card"><h2>${esc(S.club?.name||'')}</h2><p class="muted sm">${S.teams.length} קבוצות</p></div>
    <div class="card stack" style="margin-top:10px">
      <div class="togrow"><div class="t"><b>מצב שומר שבת</b>
        <span>האפליקציה לא תשלח הודעות בשבת. ${isShabbat()?'<b>שבת עכשיו.</b>':''}</span></div>
        <label class="sw"><input type="checkbox" id="shb" ${S.club?.shabbat_mode?'checked':''}><i></i></label></div>
      <label class="f">עיר (לחישוב זמני כניסת ויציאת שבת)
        <input id="shc" list="shcl" value="${esc(S.club?.city||'תל אביב')}" placeholder="תל אביב">
        <datalist id="shcl">${Object.keys(CITIES).map(c=>`<option value="${esc(c)}">`).join('')}</datalist></label>
      <p class="xs muted">${(()=>{const w=shabbatWindow(new Date());return w?`השבת הקרובה: כניסה ${hhmm(w.start)} · צאת השבת ${hhmm(w.end)}`:'';})()}</p>
    </div>
    <div class="hd"><h2>קבוצות</h2></div>
    <div class="stack">${S.teams.map(t=>`<div class="prow" onclick="pickTeam('${t.id}')">
      <div class="av">${esc(t.name[0]||'')}</div><div class="pname"><b>${esc(t.name)}</b>
      <span class="xs muted">${AGES[t.age_profile]} · ${t.session_minutes} דק׳${t.league_mode?' · ליגה':''}</span></div>
      ${t.id===S.team?.id?'<span class="pill ok">נוכחית</span>':''}</div>`).join('')}</div>
    <div class="card stack" style="margin-top:14px">
      <h3>קבוצה חדשה</h3>
      <label class="f">שם<input id="ntn" placeholder="כיתה ה׳"></label>
      <label class="f">קבוצת גיל<select id="ntap">${Object.entries(AGES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label>
      <label class="f">אורך אימון<input id="ntsm" type="number" class="num" value="60"></label>
      <button class="btn primary" id="ntmk">יצירה</button>
    </div>`);
  async function saveShabbat(patch, undo){
    const {data,error}=await sb.from('coach_clubs').update(patch).eq('id',S.club.id).select('shabbat_mode');
    if(error||!data||!data.length){ undo&&undo(); return toast('לא נשמר'); }
    Object.assign(S.club, patch); return true;
  }
  const shb=$('#shb'), shc=$('#shc');
  if(shb) shb.onchange=async()=>{
    const v=shb.checked;
    if(await saveShabbat({shabbat_mode:v}, ()=>{shb.checked=!v;})) toast(v?'מצב שבת פעיל':'בוטל');
  };
  if(shc) shc.onchange=async()=>{
    const name=shc.value.trim(), ll=cityCoords(name);
    if(!ll){ return toast('עיר לא מוכרת — הזמנים נשארים לפי ' + (S.club?.city||'תל אביב')); }
    // the coordinates are what the times are actually computed from
    if(await saveShabbat({city:name, lat:ll[0], lng:ll[1]})) { toast('נשמר'); go('settings'); }
  };
  $('#ntmk').onclick=async()=>{
    const name=$('#ntn').value.trim(); if(!name) return toast('חסר שם');
    const {data,error}=await sb.from('coach_teams').insert({club_id:S.club.id,name,age_profile:$('#ntap').value,
      session_minutes:+$('#ntsm').value||60,coach_id:S.user.id}).select().single();
    if(error) return toast('שגיאה: '+error.message);
    S.teams.push(data); S.team=data; await loadTeam(); toast('נוצרה'); go('home');
  };
};

