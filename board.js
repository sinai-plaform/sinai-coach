/* ===== SINAI Coach — tactics board =====
   Produces exactly the diagram format the drill library already uses,
   so the board can open, edit and save any drill's picture. */

const BOARD = { items:[], tool:'p_a', pend:null, drill:null, undo:[], numbers:true, n:{a:0,b:0,n:0,gk:0,co:0} };

const B_TOOLS = [
  {k:'p_a', i:'🔵', l:'שחקן א׳'},
  {k:'p_b', i:'🔴', l:'שחקן ב׳'},
  {k:'p_n', i:'🟡', l:'ניטרלי'},
  {k:'p_gk',i:'🟣', l:'שוער'},
  {k:'p_co',i:'⚫', l:'מאמן'},
  {k:'ball',i:'⚽', l:'כדור'},
  {k:'c',   i:'🔺', l:'קונוס'},
  {k:'mg',  i:'🥅', l:'שער קטן'},
  {k:'goal',i:'🏟', l:'שער'},
  {k:'hoop',i:'⭕', l:'חישוק'},
  {k:'pass',i:'⇢', l:'מסירה'},
  {k:'run', i:'→', l:'ריצה'},
  {k:'drib',i:'∿', l:'כדרור'},
  {k:'shot',i:'⇒', l:'בעיטה'},
  {k:'line',i:'│', l:'קו'},
  {k:'zone',i:'▭', l:'אזור'},
  {k:'txt', i:'א', l:'טקסט'},
  {k:'move',i:'✋', l:'הזזה'},
  {k:'del', i:'🗑', l:'מחיקה'}
];
const B_ARROWS = ['pass','run','drib','shot','line'];

/* centre point of an item, for hit testing and dragging */
function bPos(it){
  switch(it.t){
    case 'pass': case 'run': case 'drib': case 'shot':
      return it.pts[0];
    case 'zone': return [it.x+it.w/2, it.y+it.h/2];
    case 'line': return [(it.x1+it.x2)/2, (it.y1+it.y2)/2];
    case 'ring': return [it.cx, it.cy];
    default: return [it.x, it.y];
  }
}
function bMove(it, dx, dy){
  switch(it.t){
    case 'pass': case 'run': case 'drib': case 'shot':
      it.pts = it.pts.map(p=>[+(p[0]+dx).toFixed(1), +(p[1]+dy).toFixed(1)]); break;
    case 'line': it.x1+=dx; it.y1+=dy; it.x2+=dx; it.y2+=dy; break;
    case 'ring': it.cx+=dx; it.cy+=dy; break;
    default: it.x=+(it.x+dx).toFixed(1); it.y=+(it.y+dy).toFixed(1);
  }
}
const bHit = (x,y)=>{
  let best=-1, bd=9e9;
  BOARD.items.forEach((it,i)=>{
    const [px,py]=bPos(it); const d=Math.hypot(px-x, py-y);
    if(d<bd && d<7){ bd=d; best=i; }
  });
  return best;
};
function bPush(){ BOARD.undo.push(JSON.stringify(BOARD.items)); if(BOARD.undo.length>40) BOARD.undo.shift(); }

VIEWS.board = function(arg){
  arg = arg || {};
  if(arg.drill!==undefined){
    const d = drillById(arg.drill);
    BOARD.drill = arg.drill;
    BOARD.items = d && d.diag && d.diag.items ? JSON.parse(JSON.stringify(d.diag.items)) : [];
  } else if(arg.fresh!==false && !arg.keep){
    BOARD.drill = null; BOARD.items = [];
  }
  BOARD.pend=null; BOARD.undo=[]; BOARD.n={a:0,b:0,n:0,gk:0,co:0};
  BOARD.items.forEach(it=>{ if(it.t==='p' && +it.n) BOARD.n[it.s]=Math.max(BOARD.n[it.s]||0, +it.n); });

  const d = BOARD.drill!=null ? drillById(BOARD.drill) : null;
  screen(d ? d.name : 'לוח טקטי', `
    <div class="bwrap">
      <div id="bstage"></div>
      <p class="xs muted" id="bhint" style="margin:6px 2px"></p>
      <div class="btools" id="btools">
        ${B_TOOLS.map(t=>`<button class="btool ${t.k===BOARD.tool?'on':''}" data-t="${t.k}" title="${esc(t.l)}">
          <span>${t.i}</span>${esc(t.l)}</button>`).join('')}
      </div>
      <div class="row" style="gap:8px;margin-top:10px">
        <button class="btn sm" style="flex:1" id="bundo">↩︎ בטל</button>
        <button class="btn sm" style="flex:1" id="bnum">מספרים: ${BOARD.numbers?'כן':'לא'}</button>
        <button class="btn sm danger" style="flex:1" id="bclear">נקה</button>
      </div>
      <button class="btn primary big" style="margin-top:10px" id="bsave">${
        d ? (d.mine ? 'שמירה לתרגיל' : 'שמירה כעותק שלי') : 'שמירה כתרגיל חדש'}</button>
      <p class="xs muted" style="margin-top:8px;text-align:center">
        אפשר לסובב את הטלפון לרוחב — הלוח גדל.</p>
    </div>`);

  $('#btools').onclick = e=>{
    const b = e.target.closest('.btool'); if(!b) return;
    BOARD.tool = b.dataset.t; BOARD.pend = null;
    $$('#btools .btool').forEach(x=>x.classList.toggle('on', x.dataset.t===BOARD.tool));
    bHint();
  };
  $('#bundo').onclick = ()=>{ if(!BOARD.undo.length) return toast('אין מה לבטל');
    BOARD.items = JSON.parse(BOARD.undo.pop()); BOARD.pend=null; bDraw(); };
  $('#bclear').onclick = ()=>{ if(!BOARD.items.length) return; bPush(); BOARD.items=[]; BOARD.pend=null; bDraw(); };
  $('#bnum').onclick = ()=>{ BOARD.numbers=!BOARD.numbers; $('#bnum').textContent='מספרים: '+(BOARD.numbers?'כן':'לא'); };
  $('#bsave').onclick = bSave;
  bDraw(); bBind(); bHint();
};

function bHint(){
  const h=$('#bhint'); if(!h) return;
  h.textContent = BOARD.tool==='move' ? 'גררו פריט כדי להזיז אותו.'
    : BOARD.tool==='del' ? 'הקישו על פריט כדי למחוק אותו.'
    : B_ARROWS.includes(BOARD.tool) ? 'הקישו נקודת התחלה ואז נקודת סיום.'
    : BOARD.tool==='zone' ? 'הקישו פינה אחת ואז את הנגדית.'
    : 'הקישו על המגרש כדי להוסיף.';
}

function bDraw(){
  const st=$('#bstage'); if(!st) return;
  const show = BOARD.pend && BOARD.pend.ghost ? BOARD.items.concat([BOARD.pend.ghost]) : BOARD.items;
  st.innerHTML = svgDiag({items:show}, 'dg bpitch');
}

/* Handlers live on the container, not the <svg>: bDraw() replaces the svg on
   every frame of a drag, and a listener (or pointer capture) on it would die. */
function bBind(){
  const st=$('#bstage'); if(!st || st.dataset.bound) return;
  st.dataset.bound='1';
  st.style.touchAction='none';
  let drag=null;
  const pt = e=>{
    const svg=st.querySelector('svg'); if(!svg) return [0,0];
    const r=svg.getBoundingClientRect();
    return [ +((e.clientX-r.left)/r.width*120).toFixed(1), +((e.clientY-r.top)/r.height*80).toFixed(1) ];
  };
  st.addEventListener('pointerdown', e=>{
    if(BOARD.tool!=='move') return;
    const [x,y]=pt(e); const i=bHit(x,y); if(i<0) return;
    bPush(); drag={i,x,y,moved:false};
    try{ st.setPointerCapture(e.pointerId); }catch(err){}
  });
  st.addEventListener('pointermove', e=>{
    if(!drag) return;
    const [x,y]=pt(e);
    if(x===drag.x && y===drag.y) return;
    bMove(BOARD.items[drag.i], x-drag.x, y-drag.y);
    drag.x=x; drag.y=y; drag.moved=true; bDraw();
  });
  const end=e=>{ if(!drag) return; if(!drag.moved) BOARD.undo.pop(); drag=null;
    try{ st.releasePointerCapture(e.pointerId); }catch(err){} };
  st.addEventListener('pointerup', end);
  st.addEventListener('pointercancel', end);
  st.addEventListener('click', e=>{ if(BOARD.tool==='move') return; const [x,y]=pt(e); bTap(x,y); });
}

function bTap(x,y){
  const T=BOARD.tool;
  if(T==='del'){ const i=bHit(x,y); if(i<0) return toast('לא נמצא פריט'); bPush(); BOARD.items.splice(i,1); bDraw(); return; }

  if(B_ARROWS.includes(T)){
    if(!BOARD.pend){
      BOARD.pend={t:T, a:[x,y], ghost:{t:T==='line'?'line':T, ...(T==='line'?{x1:x,y1:y,x2:x,y2:y}:{pts:[[x,y],[x,y]]})}};
      toast('עכשיו הקישו את נקודת הסיום');
      return;
    }
    const a=BOARD.pend.a; bPush();
    BOARD.items.push(T==='line' ? {t:'line',x1:a[0],y1:a[1],x2:x,y2:y} : {t:T, pts:[a,[x,y]]});
    BOARD.pend=null; bDraw(); return;
  }

  if(T==='zone'){
    if(!BOARD.pend){ BOARD.pend={t:T, a:[x,y]}; toast('עכשיו הקישו את הפינה הנגדית'); return; }
    const a=BOARD.pend.a; bPush();
    BOARD.items.push({t:'zone', x:Math.min(a[0],x), y:Math.min(a[1],y),
      w:Math.abs(x-a[0]), h:Math.abs(y-a[1])});
    BOARD.pend=null; bDraw(); return;
  }

  bPush();
  if(T.startsWith('p_')){
    const s=T.slice(2);
    BOARD.n[s]=(BOARD.n[s]||0)+1;
    BOARD.items.push({t:'p', x, y, s, n: (BOARD.numbers && s!=='co' && s!=='gk') ? String(BOARD.n[s]) : ''});
  }
  else if(T==='txt'){ const s=prompt('טקסט'); if(!s){ BOARD.undo.pop(); return; } BOARD.items.push({t:'txt',x,y,s}); }
  else if(T==='mg')   BOARD.items.push({t:'mg',   x, y, dir: y<40?'n':'s'});
  else if(T==='goal') BOARD.items.push({t:'goal', x, y, dir: y<40?'n':'s', w:16});
  else if(T==='hoop') BOARD.items.push({t:'hoop', x, y});
  else if(T==='ball') BOARD.items.push({t:'ball', x, y});
  else if(T==='c')    BOARD.items.push({t:'c',    x, y});
  bDraw();
}

/* ---------- saving ---------- */
async function bSave(){
  if(!BOARD.items.length) return toast('הלוח ריק');
  const diag={items:BOARD.items};
  const d = BOARD.drill!=null ? drillById(BOARD.drill) : null;

  if(d && d.mine){
    const {error}=await sb.from('coach_drills').update({diagram:diag}).eq('id',d.id);
    if(error) return toast('שגיאה: '+error.message);
    const {data}=await sb.from('coach_drills').select('*').eq('club_id',S.club.id); S.dbDrills=data||[];
    toast('נשמר בתרגיל'); return go('library');
  }
  // a built-in drill, or nothing open: make a club drill carrying this picture
  window.__diag = diag;
  drillForm(null, d ? {...d, name:(d.name+' — הגרסה שלי')} : null);
}

function openBoard(drillId){ go('board', drillId!=null ? {drill:drillId} : {}); }
