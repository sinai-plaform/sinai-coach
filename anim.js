/* ===== SINAI Coach — drill animation =====
   Turns any drill diagram into a moving demo: the arrows are played in the
   order they were drawn. A pass / shot / dribble starts a new beat; runs
   drawn after it happen during the same beat (players move while the ball
   travels). It can also be recorded to a video file for WhatsApp. */

function pathLen(pts){ let L=0; for(let i=1;i<pts.length;i++) L+=Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]); return L; }
function pathAt(pts, f){
  f=Math.max(0,Math.min(1,f)); const L=pathLen(pts)||1; let want=L*f;
  for(let i=1;i<pts.length;i++){ const a=pts[i-1], b=pts[i], seg=Math.hypot(b[0]-a[0], b[1]-a[1]);
    if(want<=seg||i===pts.length-1){ const t=seg?Math.min(1,want/seg):1; return [a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t]; }
    want-=seg; }
  return pts[pts.length-1];
}
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

/* build the beats once; positions are resolved as the beats play */
function animPlan(diag){
  const items=JSON.parse(JSON.stringify((diag&&diag.items)||[]));
  const arrows=items.map((it,i)=>({it,i})).filter(x=>['pass','run','drib','shot'].includes(x.it.t)&&x.it.pts&&x.it.pts.length>1);
  const beats=[]; let cur=null;
  arrows.forEach(a=>{
    if(a.it.t==='run'){ if(!cur){cur={acts:[]};beats.push(cur);} cur.acts.push(a); }
    else { if(cur && cur.acts.some(x=>x.it.t!=='run')){ cur={acts:[]}; beats.push(cur); } else if(!cur){ cur={acts:[]}; beats.push(cur); } cur.acts.push(a); }
  });
  beats.forEach(b=>{ b.dur=Math.max(...b.acts.map(a=>{ const L=pathLen(a.it.pts);
    const speed = a.it.t==='shot'?70 : a.it.t==='pass'?45 : a.it.t==='drib'?18 : 22;   // units per second
    return Math.max(.7, Math.min(2.6, L/speed)); })); });
  return {items, beats, total: beats.reduce((s,b)=>s+b.dur+.35,0)+.9};
}

/* the picture at time t (seconds) */
function animFrame(plan, t){
  const items=JSON.parse(JSON.stringify(plan.items));
  const players=items.filter(it=>it.t==='p');
  const balls=items.filter(it=>it.t==='ball');
  const near=(list,x,y,max)=>{ let best=null,bd=1e9; list.forEach(p=>{ const d=Math.hypot(p.x-x,p.y-y); if(d<bd){bd=d;best=p;} }); return bd<max?best:null; };
  const nearest=(x,y)=>near(players,x,y,10);
  // the ball an action uses: the one at its start, or a fresh one placed there
  const ballAt=(x,y)=>{ let b=near(balls,x,y,9); if(!b){ b={t:'ball',x,y}; balls.push(b); items.push(b); } return b; };
  let clock=0;
  plan.beats.forEach((b,bi)=>{
    const start=clock, f=(t-start)/b.dur; clock+=b.dur+.35;
    const state = t<start ? 'future' : f>=1 ? 'done' : 'now';
    b.acts.forEach(a=>{
      const arrow=items[a.i]; arrow.o = state==='future'?.18 : state==='done'?.35 : 1;
      if(state==='future') return;
      const p=ease(Math.min(1,Math.max(0,f)));
      const pos=pathAt(a.it.pts, p);
      const [sx,sy]=a.it.pts[0];
      if(a.it.t==='pass'||a.it.t==='shot'){ const b=ballAt(sx,sy); b.x=pos[0]; b.y=pos[1]; }
      else { const who=nearest(sx,sy);
        if(a.it.t==='drib'){ const b=ballAt(sx+1.6,sy+2.2); if(who){ who.x=pos[0]; who.y=pos[1]; } b.x=pos[0]+1.6; b.y=pos[1]+2.2; }
        else if(who){ who.x=pos[0]; who.y=pos[1]; } }
    });
  });
  return {items};
}

/* play inside an element; returns a stop() */
function playDiag(el, diag, opt){
  opt=opt||{};
  const plan=animPlan(diag);
  if(!plan.beats.length){ el.innerHTML=svgDiag(diag); toast('אין חיצים בתרגיל — אין מה להניע'); return ()=>{}; }
  let t0=performance.now(), raf=0, stopped=false;
  const tick=now=>{
    if(stopped || !el.isConnected) return;
    let t=(now-t0)/1000;
    if(t>plan.total){ if(opt.loop===false){ el.innerHTML=svgDiag(animFrame(plan,plan.total)); opt.onEnd&&opt.onEnd(); return; } t0=now; t=0; }
    el.innerHTML=svgDiag(animFrame(plan,t));
    raf=requestAnimationFrame(tick);
  };
  raf=requestAnimationFrame(tick);
  return ()=>{ stopped=true; cancelAnimationFrame(raf); };
}

/* a diagram with a play button on top */
function demoBox(diag, id, name){
  const k='db'+(id||Math.random().toString(36).slice(2));
  setTimeout(()=>{
    const box=document.getElementById(k); if(!box) return;
    const st=box.querySelector('.dstage'), btn=box.querySelector('.dplay'), vid=box.querySelector('.dvid');
    let stop=null;
    btn.onclick=()=>{
      if(stop){ stop(); stop=null; st.innerHTML=svgDiag(diag); btn.textContent='▶ הדגמה'; return; }
      stop=playDiag(st, diag); btn.textContent='⏸ עצירה';
    };
    if(vid) vid.onclick=()=>recordDiag(diag, box.dataset.name||'תרגיל', vid);
  },0);
  return `<div class="demo" id="${k}" data-name="${esc(name||'')}">
    <div class="dstage">${svgDiag(diag)}</div>
    <div class="row" style="gap:6px;margin-top:6px">
      <button class="btn sm primary dplay" style="flex:1">▶ הדגמה</button>
      <button class="btn sm dvid" title="הורדה כסרטון">🎬 סרטון</button></div></div>`;
}

/* ---------- recording to a video file ---------- */
function cssVarsResolved(svg){
  const cs=getComputedStyle(document.documentElement);
  return svg.replace(/var\((--[a-z0-9-]+)\)/gi,(m,v)=>cs.getPropertyValue(v).trim()||'#3F8F5E');
}
async function recordDiag(diag, name, btn){
  if(!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return toast('הדפדפן הזה לא תומך בהקלטת סרטון');
  const plan=animPlan(diag); if(!plan.beats.length) return toast('אין חיצים בתרגיל');
  const types=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'];
  const mime=types.find(t=>{try{return MediaRecorder.isTypeSupported(t);}catch(e){return false;}}); if(!mime) return toast('אין תמיכה בהקלטה');
  const W=1200,H=880, cv=document.createElement('canvas'); cv.width=W; cv.height=H;
  const cx=cv.getContext('2d');
  const stream=cv.captureStream(30), rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:3_000_000});
  const chunks=[]; rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);
  const label=btn?btn.textContent:''; if(btn){btn.disabled=true;btn.textContent='מקליט…';}
  const img=new Image();
  const draw=t=>new Promise(res=>{
    const svg=cssVarsResolved(svgDiag(animFrame(plan,t))).replace('<svg ','<svg width="1200" height="800" ');
    img.onload=()=>{ cx.fillStyle='#18221C'; cx.fillRect(0,0,W,H); cx.drawImage(img,0,80,W,800);
      cx.fillStyle='#fff'; cx.font='bold 40px Heebo, Arial'; cx.textAlign='right'; cx.direction='rtl';
      cx.fillText(name, W-30, 55); cx.font='26px Heebo, Arial'; cx.textAlign='left'; cx.fillStyle='#F0813F'; cx.fillText('SINAI Coach', 30, 52); res(); };
    img.onerror=()=>res();
    img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  });
  await draw(0); rec.start();
  const loops=2, end=plan.total*loops, t0=performance.now();
  await new Promise(done=>{ const step=async()=>{ const t=(performance.now()-t0)/1000;
      if(t>end) return done(); await draw(t%plan.total); requestAnimationFrame(step); }; step(); });
  rec.stop(); await new Promise(r=>rec.onstop=r);
  const blob=new Blob(chunks,{type:mime.split(';')[0]});
  const ext=mime.includes('mp4')?'mp4':'webm';
  const file=new File([blob], (name||'drill').replace(/[\\/:*?"<>|]/g,'')+'.'+ext, {type:blob.type});
  if(btn){btn.disabled=false;btn.textContent=label;}
  if(navigator.canShare && navigator.canShare({files:[file]})){ try{ await navigator.share({files:[file], title:name}); return; }catch(e){} }
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=file.name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  toast('הסרטון ירד למכשיר');
}
