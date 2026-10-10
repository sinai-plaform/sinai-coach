/* ===== SINAI Coach — league profile, health declaration, Shabbat ===== */

const LEAGUE = {
  school:   {label:'בית ספר — ללא תחרות', note:'הצהרת בריאות בלבד.'},
  regional: {label:'ליגה אזורית / עמותתית', note:'הצהרת בריאות וכיסוי ביטוחי. אישור רפואי רק אם הליגה דורשת.'},
  ifa:      {label:'ליגת ההתאחדות לכדורגל', note:'רישום בהתאחדות ואישור רפואי שנתי מתחנה מאושרת.'}
};
const clubOf = () => (typeof S!=='undefined' && S.club) || (typeof FAM!=='undefined' && FAM.club) || null;
const teamProfile = t => (t && t.league_profile) || 'school';
const needsMedical = t => teamProfile(t)==='ifa' || (t && t.requires_medical);

/* ---------- sunset, for Shabbat ---------- */
/* enough of the country that a coach rarely has to think about coordinates */
const CITIES={
  'תל אביב':[32.0853,34.7818],'ירושלים':[31.7683,35.2137],'חיפה':[32.7940,34.9896],
  'באר שבע':[31.2530,34.7915],'אשדוד':[31.8014,34.6435],'אשקלון':[31.6688,34.5742],
  'נתניה':[32.3215,34.8532],'פתח תקווה':[32.0840,34.8878],'ראשון לציון':[31.9730,34.7925],
  'רחובות':[31.8928,34.8113],'רמת גן':[32.0700,34.8235],'בני ברק':[32.0807,34.8338],
  'חולון':[32.0158,34.7874],'בת ים':[32.0171,34.7503],'הרצליה':[32.1624,34.8447],
  'כפר סבא':[32.1750,34.9070],'רעננה':[32.1848,34.8713],'מודיעין':[31.8928,35.0104],
  'בית שמש':[31.7497,34.9886],'אלעד':[32.0517,34.9519],'טבריה':[32.7959,35.5320],
  'צפת':[32.9646,35.4960],'אילת':[29.5577,34.9519],'עפולה':[32.6078,35.2897],
  'נתיבות':[31.4220,34.5900],'קרית גת':[31.6100,34.7642],'חדרה':[32.4340,34.9196],
  'רמלה':[31.9288,34.8667],'לוד':[31.9515,34.8953],'גבעת שמואל':[32.0772,34.8492]
};
const cityCoords = name => CITIES[String(name||'').trim()] || null;

function sunsetAt(date, lat, lng){
  const rad=Math.PI/180, deg=180/Math.PI;
  const start=Date.UTC(date.getFullYear(),0,0);
  const day=Math.floor((Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())-start)/864e5);
  const lngHour=lng/15, t=day+((18-lngHour)/24);
  const M=(0.9856*t)-3.289;
  let L=M+(1.916*Math.sin(M*rad))+(0.020*Math.sin(2*M*rad))+282.634; L=(L+360)%360;
  let RA=Math.atan(0.91764*Math.tan(L*rad))*deg; RA=(RA+360)%360;
  RA += (Math.floor(L/90)*90) - (Math.floor(RA/90)*90); RA/=15;
  const sinDec=0.39782*Math.sin(L*rad), cosDec=Math.cos(Math.asin(sinDec));
  const cosH=(Math.cos(90.833*rad)-(sinDec*Math.sin(lat*rad)))/(cosDec*Math.cos(lat*rad));
  if(cosH>1||cosH<-1) return null;
  const H=(Math.acos(cosH)*deg)/15;
  let UT=(H+RA-(0.06571*t)-6.622-lngHour)%24; if(UT<0)UT+=24;
  return new Date(Date.UTC(date.getFullYear(),date.getMonth(),date.getDate())+UT*3600e3);
}
/* candle lighting 20 min before sunset on Friday; nightfall 40 min after sunset on Saturday */
function shabbatWindow(now){
  const d=new Date(now||Date.now());
  const c=clubOf(); const lat=+(c?.lat ?? 32.0853), lng=+(c?.lng ?? 34.7818);
  const fromFriday=fri=>{
    const sat=new Date(fri); sat.setDate(fri.getDate()+1);
    const a=sunsetAt(fri,lat,lng), b=sunsetAt(sat,lat,lng);
    // Jerusalem lights 40 minutes before sunset; most other places 20
    const before = String(c?.city||'').trim()==='ירושלים' ? 40 : 20;
    return (a&&b) ? {start:new Date(a.getTime()-before*60000), end:new Date(b.getTime()+40*60000)} : null;
  };
  const back=(d.getDay()+2)%7;                       // days since the most recent Friday
  const at=n=>{ const x=new Date(d); x.setDate(d.getDate()+n); return x; };
  let w=fromFriday(at(-back));
  // once that Shabbat is over, the relevant one is the next
  if(w && d.getTime()>w.end.getTime()) w=fromFriday(at(7-back));
  return w;
}
function isShabbat(now){
  if(!clubOf()?.shabbat_mode) return false;
  const w=shabbatWindow(now||new Date()); if(!w) return false;
  const t=(now||new Date()).getTime();
  return t>=w.start.getTime() && t<=w.end.getTime();
}
const hhmm = d => d.toLocaleTimeString('he-IL',{hour:'2-digit',minute:'2-digit'});

/* every outgoing message passes through here */
async function guardSend(run){
  if(!isShabbat()){ return run(); }
  const w=shabbatWindow(new Date());
  if(!confirm(`שבת עכשיו — צאת השבת ב-${hhmm(w.end)}.\nההגדרה של המועדון היא לא לשלוח בשבת.\nלשלוח בכל זאת?`)) return;
  run();
}

/* every WhatsApp link in the app opens through here */
async function waOpen(url){
  let ok=false;
  await guardSend(()=>{ window.open(url,'_blank'); ok=true; });
  return ok;
}

/* ---------- health declaration ---------- */
const HEALTH_TEXT =
  'אני מצהיר/ה כי בני/בתי בריא/ה ואין מניעה רפואית להשתתפותו/ה בפעילות הספורטיבית. '+
  'ידוע לי שעליי לעדכן את המאמן ישירות בכל שינוי במצב הבריאותי — מגבלה, אלרגיה או טיפול קבוע — '+
  'שעשוי להשפיע על הפעילות או לחייב היערכות בשטח.';

function healthState(p, team){
  const out=[];
  out.push(p.health_declared_at
    ? {st:'ok',  t:'הצהרת בריאות', s:'נחתמה '+fmtDate(p.health_declared_at)}
    : {st:'bad', t:'הצהרת בריאות', s:'טרם נחתמה'});
  if(needsMedical(team)){
    const exp=p.medical_cert_expires ? new Date(p.medical_cert_expires) : null;
    const left=exp ? Math.ceil((exp-new Date())/864e5) : null;
    out.push(!exp ? {st:'bad', t:'אישור רפואי',s:'חסר'}
      : left<0   ? {st:'bad', t:'אישור רפואי',s:'פג ב-'+fmtDate(exp)}
      : left<30  ? {st:'warn',t:'אישור רפואי',s:`פג בעוד ${left} ימים`}
                 : {st:'ok',  t:'אישור רפואי',s:'תקף עד '+fmtDate(exp)});
  }
  // insurance is the club's to confirm, so a pending one is a nudge, not a block
  if(teamProfile(team)!=='school')
    out.push(p.insured ? {st:'ok',t:'ביטוח',s:'אושר'} : {st:'warn',t:'ביטוח',s:'טרם אושר'});
  return out;
}
const worst = st => st.some(x=>x.st==='bad') ? 'bad' : st.some(x=>x.st==='warn') ? 'warn' : 'ok';
const PILL = {ok:'תקין', warn:'שים לב', bad:'חסר'};
const healthRows = (p,team) => healthState(p,team).map(x=>
  `<div class="togrow"><div class="t"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></div>
   <span class="pill ${x.st}">${x.st==='ok'?'✓':x.st==='warn'?'!':'חסר'}</span></div>`).join('');

/* coach-side editor for the two dated fields */
function healthForm(pid){
  const p=S.players.find(x=>x.id===pid); if(!p) return;
  sheet(`<h2>מסמכים — ${esc(p.name)}</h2>
    <p class="xs muted" style="margin:6px 0 12px">המערכת שומרת תאריכים בלבד, לא תוכן רפואי.</p>
    <div class="stack">
      <label class="f">תאריך בדיקה רפואית<input id="hmd" type="date" value="${p.medical_cert_at||''}"></label>
      <label class="f">תוקף עד<input id="hme" type="date" value="${p.medical_cert_expires||''}"></label>
      <label class="f row" style="flex-direction:row;align-items:center;gap:8px">
        <input type="checkbox" id="hins" ${p.insured?'checked':''} style="width:auto"> מכוסה בביטוח</label>
      <button class="btn primary big" id="hsv">שמירה</button>
    </div>`);
  $('#hmd').onchange=()=>{ const d=$('#hmd').value; if(d && !$('#hme').value){
    const e=new Date(d); e.setFullYear(e.getFullYear()+1); $('#hme').value=e.toISOString().slice(0,10); } };
  $('#hsv').onclick=async()=>{
    const row={medical_cert_at:$('#hmd').value||null, medical_cert_expires:$('#hme').value||null, insured:$('#hins').checked};
    const {error}=await sb.from('coach_players').update(row).eq('id',pid);
    if(error) return toast('שגיאה: '+error.message);
    Object.assign(p,row); closeSheet(); go('player',pid); toast('נשמר');
  };
}

/* club-wide view of what is missing */
VIEWS.docs = async function(){
  screen('מסמכים וכשירות', '<div class="empty">טוען…</div>');
  const t=S.team, rank={bad:0,warn:1,ok:2};
  const rows=S.players.map(p=>{const st=healthState(p,t); return {p, st, w:worst(st)};})
                      .sort((a,b)=>rank[a.w]-rank[b.w]);
  const bad=rows.filter(r=>r.w==='bad').length, warn=rows.filter(r=>r.w==='warn').length;
  $('.wrap').innerHTML=`
    <div class="card"><h2>${esc(t.name)}</h2>
      <p class="muted sm">${esc(LEAGUE[teamProfile(t)].label)} · ${esc(LEAGUE[teamProfile(t)].note)}</p>
      <p class="sm" style="margin-top:8px">${
        bad ? `<b>${bad}</b> שחקנים עם מסמך חסר` : 'לכל השחקנים יש את המסמכים הנדרשים.'
      }${warn?` · ${warn} ממתינים לאישור` : ''}</p></div>
    <div class="stack" style="margin-top:12px">
      ${rows.map(r=>`
        <div class="prow" onclick="healthForm('${r.p.id}')">
          <div class="av">${esc(initials(r.p.name))}</div>
          <div class="pname" style="flex:1"><b>${esc(r.p.name)}</b>
            <span class="xs muted">${r.st.map(x=>esc(x.t)+': '+esc(x.s)).join(' · ')}</span></div>
          <span class="pill ${r.w}">${PILL[r.w]}</span></div>`).join('')}
    </div>`;
};
