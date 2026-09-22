/* ===== SINAI Coach — core ===== */
if(!window.supabase){
  document.getElementById('app').innerHTML =
    '<div class="wrap" style="padding-top:80px;max-width:400px;text-align:center">'+
    '<div style="font-size:40px">📡</div>'+
    '<h2 style="margin-top:10px">לא הצלחנו לטעון את האפליקציה</h2>'+
    '<p class="muted sm" style="margin-top:8px">נראה שאין חיבור לאינטרנט כרגע. '+
    'התחברו לרשת ורעננו את הדף.</p>'+
    '<button class="btn primary" style="margin-top:16px" onclick="location.reload()">רענון</button></div>';
  throw new Error('supabase sdk unavailable');
}
const sb = window.supabase.createClient(SB_URL, SB_KEY, {auth:{persistSession:true,autoRefreshToken:true}});
const FN = SB_URL+'/functions/v1/coach-auth';
async function fn(action, payload){
  try{
    const r = await fetch(FN,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(Object.assign({action},payload||{}))});
    const j = await r.json().catch(()=>({error:'שגיאת רשת'}));
    return r.ok ? j : {error: j.error || ('שגיאה '+r.status)};
  }catch(e){ return {error:'אין חיבור לאינטרנט'}; }
}
// exchange a server-minted token for a real session
async function useToken(th){
  const {data,error} = await sb.auth.verifyOtp({token_hash:th, type:'email'});
  return error ? {error:error.message} : {user:data.user};
}

const S = { user:null, club:null, role:null, teams:[], team:null, players:[], attrs:[], dbDrills:[],
            session:null, sessionDrills:[], attendance:{}, match:null, view:'home', online:navigator.onLine };

/* ---------- utils ---------- */
const $=(s,r)=>(r||document).querySelector(s);
const $$=(s,r)=>[...(r||document).querySelectorAll(s)];
const esc=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const uid=()=>(crypto.randomUUID?crypto.randomUUID():'x'+Date.now()+Math.random().toString(16).slice(2));
const today=()=>new Date().toISOString().slice(0,10);
const initials=n=>String(n||'').trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('');
const fmtDate=d=>{const x=new Date(d);return x.toLocaleDateString('he-IL',{day:'numeric',month:'short'});};
const daysAgo=d=>Math.floor((Date.now()-new Date(d).getTime())/864e5);
const LS=(k,v)=>{try{if(v===undefined){const r=localStorage.getItem('sc.'+k);return r?JSON.parse(r):null;}localStorage.setItem('sc.'+k,JSON.stringify(v));}catch(e){return null;}};
let toastT; function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),2000);}
function age(bd){if(!bd)return null;const b=new Date(bd),n=new Date();let a=n.getFullYear()-b.getFullYear();if(n<new Date(n.getFullYear(),b.getMonth(),b.getDate()))a--;return a;}

/* ---------- offline queue ---------- */
let QUEUE = LS('queue')||[];
const saveQ=()=>LS('queue',QUEUE);
async function push(table, rows, opts){
  rows = Array.isArray(rows)?rows:[rows];
  if(!S.online){ QUEUE.push({table,rows,opts:opts||{}}); saveQ(); renderOffline(); return {queued:true}; }
  try{
    let q = sb.from(table);
    const r = opts&&opts.upsert ? await q.upsert(rows,{onConflict:opts.onConflict}).select() : await q.insert(rows).select();
    if(r.error) throw r.error;
    return {data:r.data};
  }catch(e){
    QUEUE.push({table,rows,opts:opts||{}}); saveQ(); renderOffline();
    console.warn('queued',table,e.message); return {queued:true};
  }
}
async function flushQueue(){
  if(!QUEUE.length||!S.online) return;
  const left=[];
  for(const it of QUEUE){
    try{
      const q=sb.from(it.table);
      const r = it.opts.upsert ? await q.upsert(it.rows,{onConflict:it.opts.onConflict}) : await q.insert(it.rows);
      if(r.error) throw r.error;
    }catch(e){ left.push(it); }
  }
  const n=QUEUE.length-left.length; QUEUE=left; saveQ(); renderOffline();
  if(n>0) toast(`סונכרנו ${n} רשומות`);
}
function renderOffline(){
  const b=$('#offlineBar');
  if(!S.online){ b.classList.remove('hide'); b.textContent='אופליין — הנתונים נשמרים במכשיר ויסונכרנו אוטומטית'; }
  else if(QUEUE.length){ b.classList.remove('hide'); b.style.background='var(--info)'; b.textContent=`ממתינים לסנכרון: ${QUEUE.length}`; }
  else b.classList.add('hide');
}
addEventListener('online',()=>{S.online=true;renderOffline();flushQueue();});
addEventListener('offline',()=>{S.online=false;renderOffline();});

/* ---------- diagrams (same format as the library) ---------- */
const TEAMC={a:'var(--ta)',b:'var(--tb)',n:'var(--tn)',gk:'var(--tgk)',co:'var(--tco)'};
function zig(pts){let d='';for(let i=0;i<pts.length-1;i++){const [x1,y1]=pts[i],[x2,y2]=pts[i+1];const dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy)||1,n=Math.max(2,Math.round(len/3));const nx=-dy/len*1.3,ny=dx/len*1.3;if(i===0)d+=`M${x1},${y1}`;for(let k=1;k<=n;k++){const t=k/n,s=(k%2?1:-1)*(k===n?0:1);d+=` L${(x1+dx*t+nx*s).toFixed(1)},${(y1+dy*t+ny*s).toFixed(1)}`;}}return d;}
const poly=p=>p.map(x=>x.join(',')).join(' ');
function gr(it,w,depth){const x=it.x,y=it.y;if(it.dir==='w')return[x-depth,y-w/2,depth,w];if(it.dir==='e')return[x,y-w/2,depth,w];if(it.dir==='n')return[x-w/2,y-depth,w,depth];return[x-w/2,y,w,depth];}
function svgDiag(d,cls){
  const items=(d&&d.items)||[];
  let s=`<svg class="${cls||'dg'}" viewBox="0 0 120 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="דיאגרמה"><defs>
  <marker id="aW" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 Z" fill="#fff"/></marker>
  <marker id="aO" viewBox="0 0 6 6" refX="5" refY="3" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0,0 L6,3 L0,6 Z" fill="#FFD166"/></marker>
  <pattern id="nt" width="1.5" height="1.5" patternUnits="userSpaceOnUse"><path d="M0,0 L1.5,1.5 M1.5,0 L0,1.5" stroke="#fff" stroke-width=".25"/></pattern></defs>
  <rect width="120" height="80" fill="var(--pitch)"/>`;
  for(let i=1;i<6;i+=2)s+=`<rect x="${i*20}" y="0" width="20" height="80" fill="var(--pitch2)"/>`;
  const later=[];
  items.forEach(it=>{switch(it.t){
    case 'zone':s+=`<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="#fff" fill-opacity=".10"/>`+(it.label?`<text x="${it.x+it.w/2}" y="${it.y+5}" font-size="3.4" fill="#fff" fill-opacity=".85" text-anchor="middle">${esc(it.label)}</text>`:'');break;
    case 'line':s+=`<line x1="${it.x1}" y1="${it.y1}" x2="${it.x2}" y2="${it.y2}" stroke="#fff" stroke-width=".6" stroke-opacity=".8"/>`;break;
    case 'ring':s+=`<circle cx="${it.cx}" cy="${it.cy}" r="${it.r}" fill="none" stroke="#fff" stroke-width=".6" stroke-dasharray="2 1.5" stroke-opacity=".8"/>`;break;
    case 'hoop':s+=`<circle cx="${it.x}" cy="${it.y}" r="3.6" fill="none" stroke="#FFD166" stroke-width="1"/>`;break;
    case 'goal':{const[a,b,c,d2]=gr(it,it.w||16,4);s+=`<rect x="${a}" y="${b}" width="${c}" height="${d2}" fill="url(#nt)" stroke="#fff" stroke-width=".8"/>`;break;}
    case 'mg':{const[a,b,c,d2]=gr(it,7,2.2);s+=`<rect x="${a}" y="${b}" width="${c}" height="${d2}" fill="url(#nt)" stroke="#fff" stroke-width=".8"/>`;break;}
    case 'c':s+=`<path d="M${it.x},${it.y-2.3} L${it.x+2.1},${it.y+1.6} L${it.x-2.1},${it.y+1.6} Z" fill="${it.col||'#F2C14E'}" stroke="#000" stroke-opacity=".25" stroke-width=".3"/>`;break;
    case 'pass':later.push(`<polyline points="${poly(it.pts)}" fill="none" stroke="#fff" stroke-width=".8" stroke-dasharray="2 1.4" marker-end="url(#aW)"/>`);break;
    case 'run':later.push(`<polyline points="${poly(it.pts)}" fill="none" stroke="#FFD166" stroke-width=".7" marker-end="url(#aO)"/>`);break;
    case 'drib':later.push(`<path d="${zig(it.pts)}" fill="none" stroke="#fff" stroke-width=".7" marker-end="url(#aW)"/>`);break;
    case 'shot':later.push(`<polyline points="${poly(it.pts)}" fill="none" stroke="#fff" stroke-width="1.5" marker-end="url(#aW)"/>`);break;
    case 'p':later.push(`<circle cx="${it.x}" cy="${it.y}" r="3.3" fill="${TEAMC[it.s]||TEAMC.a}" stroke="#fff" stroke-width=".7"/>`+(it.n?`<text x="${it.x}" y="${it.y+1.2}" font-size="${String(it.n).length>1?2.4:3.2}" fill="#fff" text-anchor="middle" font-weight="700">${esc(it.n)}</text>`:(it.s==='co'?`<text x="${it.x}" y="${it.y+1.2}" font-size="3" fill="#fff" text-anchor="middle" font-weight="700">מ</text>`:'')));break;
    case 'ball':later.push(`<circle cx="${it.x}" cy="${it.y}" r="1.7" fill="#fff" stroke="#1E1E1E" stroke-width=".45"/><circle cx="${it.x}" cy="${it.y}" r=".6" fill="#1E1E1E"/>`);break;
    case 'txt':later.push(`<text x="${it.x}" y="${it.y}" font-size="3.4" fill="#fff" text-anchor="middle" paint-order="stroke" stroke="#0B2A18" stroke-width=".9" stroke-opacity=".7">${esc(it.s)}</text>`);break;
  }});
  return s+later.join('')+'</svg>';
}

/* ---------- sheet ---------- */
function sheet(html){ $('#sheet').innerHTML='<div class="grab"></div>'+html; $('#sheetWrap').classList.add('open'); }
function closeSheet(){ $('#sheetWrap').classList.remove('open'); }
$('#sheetBd').onclick=closeSheet;

/* ---------- drills (bundled global library + club drills) ---------- */
function allDrills(){ return [...DRILLS, ...S.dbDrills.map(d=>({id:d.id,name:d.name,cat:d.cat,ages:d.ages,min:d.min,players:d.players,area:d.area,equip:d.equip,setup:d.setup,desc:d.descr,points:d.points||[],prog:d.prog||[],src:d.src||'המועדון',diag:d.diagram,mine:true}))]; }
const drillById=id=>allDrills().find(d=>d.id===id);

/* ---------- attributes ---------- */
function teamAttrs(includeGk){
  const prof = S.team?S.team.age_profile:'b';
  return S.attrs.filter(a=>a.ages.includes(prof) && (a.grp!=='gk' || includeGk));
}
const ATTR_LABEL = k => (S.attrs.find(a=>a.key===k)||{}).label || k;
const GRP_LABEL = {tech:'טכני',phys:'פיזי',mental:'מנטלי',gk:'שוער'};

/* quick tags → attribute + score */
const TAGS=[
 {t:'החלטה טובה',a:'decisions',s:4,good:1},{t:'איבוד קל',a:'decisions',s:2},
 {t:'מסירה מצוינת',a:'passing',s:5,good:1},{t:'מסירה לא מדויקת',a:'passing',s:2},
 {t:'עבר 1v1',a:'dribbling',s:5,good:1},{t:'איבד בכדרור',a:'dribbling',s:2},
 {t:'סיום טוב',a:'shooting',s:4,good:1},{t:'החמצה',a:'shooting',s:2},
 {t:'לא חזר להגנה',a:'determination',s:2},{t:'לחץ מצוין',a:'determination',s:5,good:1},
 {t:'מנהיגות',a:'leadership',s:5,good:1},{t:'דיבר עם החבר׳ה',a:'teamwork',s:4,good:1},
 {t:'ראש למעלה',a:'decisions',s:4,good:1},{t:'לא מרוכז',a:'focus',s:2}
];
function tagsForTeam(){const ks=new Set(teamAttrs(true).map(a=>a.key));return TAGS.filter(t=>ks.has(t.a));}

/* ---------- observations ---------- */
async function addObs(playerId, attribute, score, extra){
  const row={id:uid(),player_id:playerId,team_id:S.team?.id||null,attribute,score,
    source:(extra&&extra.source)||'drill',session_id:(extra&&extra.session_id)||S.session?.id||null,
    match_id:(extra&&extra.match_id)||null,drill_id:(extra&&extra.drill_id)||null,
    tag:(extra&&extra.tag)||null,note:(extra&&extra.note)||null,by_user:S.user?.id||null,at:new Date().toISOString()};
  LOCAL_OBS.push(row); LS('obs',LOCAL_OBS.slice(-800));
  await push('coach_observations',row);
  return row;
}
let LOCAL_OBS = LS('obs')||[];
function localCounts(playerId, sessionId){ return LOCAL_OBS.filter(o=>o.player_id===playerId && (!sessionId||o.session_id===sessionId)).length; }

/* ---------- attribute scores (client-side, same formula as the DB view) ---------- */
function scoreFromObs(obs){
  const now=Date.now(); const byAttr={};
  obs.forEach(o=>{
    const days=(now-new Date(o.at).getTime())/864e5;
    if(days>400) return;
    const srcW = o.source==='match'||o.source==='test' ? 1.5 : o.source==='challenge' ? 0.7 : 1;
    const w = srcW*Math.pow(0.5, days/21);
    const b = byAttr[o.attribute] || (byAttr[o.attribute]={sw:0,sws:0,n90:0,r:[],p:[]});
    b.sw+=w; b.sws+=w*o.score;
    if(days<=90)b.n90++;
    if(days<=30)b.r.push(o.score); else if(days<=120)b.p.push(o.score);
  });
  const out={};
  for(const [k,b] of Object.entries(byAttr)){
    const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
    const r=avg(b.r), p=avg(b.p);
    out[k]={score:b.sw?+(4*b.sws/b.sw).toFixed(1):null, n90:b.n90,
      conf: b.n90>=25?'high':b.n90>=10?'med':b.n90>=3?'low':'none',
      trend: (r!=null&&p!=null)? +(4*(r-p)).toFixed(1) : null};
  }
  return out;
}
/* ---------- data loading ---------- */
async function bootstrap(){
  // 1 — an invite link was opened
  const url = new URL(location.href);
  const tok = url.searchParams.get('t');
  if(tok){
    splash('מחברים אותך…');
    const r = await fn('claim',{token:tok});
    history.replaceState({},'',url.pathname);
    if(r.error) return renderLogin(r.error);
    const s2 = await useToken(r.token_hash);
    if(s2.error) return renderLogin(s2.error);
    if(r.device) LS('dev', r.device);
  }

  // 2 — an existing session, or a device we already bound
  let {data:{user}} = await sb.auth.getUser();
  if(!user){
    const d = LS('dev');
    if(d){
      splash('מחברים אותך…');
      const r = await fn('device',{device:d});
      if(r.token_hash){ await useToken(r.token_hash); ({data:{user}} = await sb.auth.getUser()); }
      else if(r.error && /מזוהה/.test(r.error)) LS('dev', null);
    }
  }
  if(!user){ renderLogin(); return; }
  S.user = user;

  // 3 — families go to their own app
  const role = (user.user_metadata||{}).role;
  if(role==='parent' || role==='player'){ S.role=role; return bootstrapFamily(); }

  let {data:mem} = await sb.from('coach_members').select('*, coach_clubs(*)').eq('user_id',user.id);
  if(!mem||!mem.length){ renderNewClub(); return; }
  S.club = mem[0].coach_clubs; S.role = mem[0].role;
  const [t,a,d] = await Promise.all([
    sb.from('coach_teams').select('*').eq('club_id',S.club.id).order('name'),
    sb.from('coach_attributes').select('*').order('sort'),
    sb.from('coach_drills').select('*').eq('club_id',S.club.id)
  ]);
  S.teams=t.data||[]; S.attrs=a.data||[]; S.dbDrills=d.data||[];
  const savedTeam=LS('team'); S.team = S.teams.find(x=>x.id===savedTeam) || S.teams[0] || null;
  if(S.team) await loadTeam();
  $('#nav').classList.remove('hide');
  flushQueue();
  go(LS('view')||'home');
}
function splash(t){
  $('#nav').classList.add('hide');
  $('#app').innerHTML = `<div class="wrap" style="padding-top:90px;text-align:center">
    <div style="font-size:40px">⚽</div><p class="muted" style="margin-top:10px">${esc(t)}</p></div>`;
}
async function loadTeam(){
  if(!S.team){S.players=[];return;}
  LS('team',S.team.id);
  const {data} = await sb.from('coach_team_players').select('player_id, coach_players(*)').eq('team_id',S.team.id);
  S.players=(data||[]).map(r=>r.coach_players).filter(Boolean)
    .sort((a,b)=>(a.shirt_no||99)-(b.shirt_no||99)||a.name.localeCompare(b.name,'he'));
}

/* ---------- router ---------- */
const VIEWS={};
function go(v,arg){ S.view=v; LS('view',['home','squad','plan','library'].includes(v)?v:'home'); closeSheet();
  $$('#nav button').forEach(b=>b.classList.toggle('on', b.dataset.go===v));
  window.scrollTo(0,0);
  (VIEWS[v]||VIEWS.home)(arg);
}
$$('#nav button').forEach(b=>b.onclick=()=>go(b.dataset.go));
function screen(title, body, actions){
  $('#app').innerHTML = `<div class="topbar"><div class="in">
      ${['home','squad','plan','library','more'].includes(S.view)?'':'<button class="iconbtn" id="bk">→</button>'}
      <h1>${esc(title)}</h1>${actions||''}</div></div>
    <div class="wrap">${body}</div>`;
  const bk=$('#bk'); if(bk) bk.onclick=()=>history.back();
}
addEventListener('popstate',()=>go(LS('view')||'home'));

/* ---------- auth screens ---------- */
function renderLogin(err){
  $('#nav').classList.add('hide');
  let mode='in';
  const draw=()=>{
    $('#app').innerHTML=`<div class="wrap" style="max-width:420px;padding-top:52px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="font-size:44px">⚽</div>
      <h1 style="margin-top:8px">SINAI Coach</h1>
      <p class="muted sm">${mode==='in'?'אימונים, נתוני שחקנים והורים — במקום אחד':'פתיחת חשבון מאמן חדש'}</p>
    </div>
    <div class="card stack">
      <div id="err" class="alert hide"></div>
      <label class="f">אימייל<input id="em" type="email" autocomplete="username" inputmode="email" autocapitalize="off"></label>
      <label class="f">סיסמה<input id="pw" type="password" autocomplete="${mode==='in'?'current-password':'new-password'}"></label>
      <button class="btn primary big" id="doBtn">${mode==='in'?'כניסה':'פתיחת חשבון'}</button>
      <button class="btn ghost sm" id="swBtn">${mode==='in'?'אין לי חשבון — הרשמה':'← יש לי כבר חשבון'}</button>
    </div>
    <p class="xs muted" style="text-align:center;margin-top:16px">
      הורה? הכניסה שלך היא דרך הקישור שהמאמן שולח בוואטסאפ — בלי סיסמה.</p>
    </div>`;
    if(err) showErr(err);
    $('#swBtn').onclick=()=>{ mode = mode==='in'?'up':'in'; err=null; draw(); };
    $('#doBtn').onclick=submit;
    $('#pw').onkeydown=e=>{ if(e.key==='Enter') submit(); };
  };
  const showErr=m=>{ const e=$('#err'); e.textContent=m; e.classList.remove('hide'); };
  const busy=(b,t)=>{ const x=$('#doBtn'); x.disabled=b; x.textContent=b?t:(mode==='in'?'כניסה':'פתיחת חשבון'); };
  async function submit(){
    const email=$('#em').value.trim(), password=$('#pw').value;
    $('#err').classList.add('hide');
    if(!email) return showErr('צריך למלא אימייל');
    if(password.length<6) return showErr('הסיסמה צריכה להיות באורך 6 תווים לפחות');
    if(mode==='up'){
      busy(true,'פותח חשבון…');
      const r=await fn('signup',{email,password});
      if(r.error){ busy(false); return showErr(r.error); }
    }
    busy(true,'מתחבר…');
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error){ busy(false); return showErr(/Invalid login/i.test(error.message)?'אימייל או סיסמה שגויים':error.message); }
    bootstrap();
  }
  draw();
}
function renderNewClub(){
  $('#nav').classList.add('hide');
  $('#app').innerHTML=`<div class="wrap" style="max-width:440px;padding-top:40px">
    <h1>ברוך הבא</h1><p class="muted sm" style="margin:6px 0 18px">נקים את המועדון והקבוצה הראשונה.</p>
    <div class="card stack">
      <label class="f">שם המועדון / בית הספר<input id="cn" placeholder="בית הספר לכדורגל"></label>
      <label class="f">שם הקבוצה הראשונה<input id="tn" placeholder="כיתה ג׳"></label>
      <label class="f">קבוצת גיל<select id="ap"><option value="a">גן–ב׳</option><option value="b" selected>ג׳–ד׳</option><option value="c">ה׳–ז׳</option></select></label>
      <label class="f">אורך אימון (דקות)<input id="sm" type="number" value="60" class="num"></label>
      <button class="btn primary big" id="mk">יוצרים</button>
      <p class="xs muted" id="m2"></p>
    </div></div>`;
  $('#mk').onclick=async()=>{
    const cn=$('#cn').value.trim()||'המועדון שלי', tn=$('#tn').value.trim()||'קבוצה א׳';
    $('#m2').textContent='יוצר…';
    const {data:club,error}=await sb.from('coach_clubs').insert({name:cn}).select().single();
    if(error){$('#m2').textContent='שגיאה: '+error.message;return;}
    await sb.from('coach_members').insert({user_id:S.user.id,club_id:club.id,role:'coach',display_name:S.user.email});
    await sb.from('coach_teams').insert({club_id:club.id,name:tn,age_profile:$('#ap').value,session_minutes:+$('#sm').value||60,coach_id:S.user.id});
    bootstrap();
  };
}

/* ---------- start ----------
   every screen module must be parsed before we route anywhere,
   so the boot happens after the document finishes loading. */
function startApp(){
  renderOffline();
  bootstrap();
  setInterval(flushQueue, 30000);
}
if(document.readyState==='complete') startApp();
else addEventListener('load', startApp, {once:true});
