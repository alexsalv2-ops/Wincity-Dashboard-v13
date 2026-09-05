
let db={records:[],settings:{}};
let currentMonth=new Date().toISOString().slice(0,7);

const defs={
  sp:{g:'sp-g',p:'sp-p',mode:'lordo',pct:50,tax:'tSp'},
  vt:{g:'vt-g',p:'vt-p',mode:'raccolta',pct:4.5,tax:'tVt'},
  aw:{g:'aw-g',p:'aw-p',mode:'raccolta',pct:5.5,tax:'tAw'},
  so:{g:'so-g',p:'so-p',mode:'lordo',pct:50,tax:'tSo'},
  vo:{g:'vo-g',p:'vo-p',mode:'raccolta',pct:4.5,tax:'tVo'},
  co:{g:'co-g',p:'co-p',mode:'lordo',pct:50,tax:'tCo'},
  po:{g:'po-g',p:'po-p',mode:'lordo',pct:50,tax:'tPo'}
};
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const num=v=>{
  if(typeof v==='number') return Number.isFinite(v)?v:0;
  const s=String(v??'').trim().replace(/\s/g,'');
  if(!s) return 0;
  if(s.includes(',') && s.includes('.')) return Number(s.replace(/\./g,'').replace(',','.'))||0;
  if(s.includes(',')) return Number(s.replace(',','.'))||0;
  return Number(s)||0;
};
const eur=v=>Number(v||0).toLocaleString('it-IT',{style:'currency',currency:'EUR'});
const dmy=s=>new Date(s+'T12:00:00').toLocaleDateString('it-IT');
const monthLabel=m=>new Date(m+'-01T12:00:00').toLocaleDateString('it-IT',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
const tone=(v,kind)=>v<0?'negative':kind==='netto'&&v>0?'positive':kind==='lordo'&&v>0?'lordo-positive':'zero';

function calc(g,p,d){
  g=num(g); p=num(p);
  const lordo=g-p;
  const aggio=d.mode==='lordo'?lordo*(d.pct/100):g*(d.pct/100);
  const taxes=aggio*(num(db.settings[d.tax])/100);
  return {g,p,lordo,netto:aggio-taxes};
}
function aggregate(records){
  const cats={}; let conti=0;
  for(const [k,d] of Object.entries(defs)){
    const g=records.reduce((s,r)=>s+num(r[d.g]),0);
    const p=records.reduce((s,r)=>s+num(r[d.p]),0);
    cats[k]=calc(g,p,d);
  }
  conti=records.reduce((s,r)=>s+num(r.conti),0);
  return {cats,conti};
}
function onlineTotal(a){
  const keys=['so','vo','co','po'];
  return keys.reduce((o,k)=>{const c=a.cats[k];o.g+=c.g;o.p+=c.p;o.lordo+=c.lordo;o.netto+=c.netto;return o},{g:0,p:0,lordo:0,netto:0});
}
function agencyTotal(a){
  const s=a.cats.sp,v=a.cats.vt;
  return {g:s.g+v.g,p:s.p+v.p,lordo:s.lordo+v.lordo,netto:s.netto+v.netto};
}

function isoLocal(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function latestDate(){return db.records.length?db.records.at(-1).data:new Date().toISOString().slice(0,10)}
function getPeriod(){
  const type=$('#periodType').value;
  const today=new Date(); today.setHours(12,0,0,0);
  if(type==='today'){
    const day=isoLocal(today);
    return {type,label:`Oggi · ${dmy(day)}`,records:db.records.filter(r=>r.data===day)};
  }
  if(type==='day'){
    const day=$('#specificDay')?.value||latestDate();
    return {type,label:dmy(day),records:db.records.filter(r=>r.data===day)};
  }
  if(type==='range'){
    const from=$('#rangeFrom')?.value||latestDate(), to=$('#rangeTo')?.value||latestDate();
    return {type,label:`${dmy(from)} — ${dmy(to)}`,records:db.records.filter(r=>r.data>=from&&r.data<=to)};
  }
  if(type==='all'){
    return {type,label:'Cumulato totale',records:[...db.records]};
  }
  if(type==='currentWeek'){
    const d=new Date(today), dow=(d.getDay()+6)%7; d.setDate(d.getDate()-dow);
    const from=isoLocal(d); d.setDate(d.getDate()+6); const to=isoLocal(d);
    return {type,label:`${dmy(from)} — ${dmy(to)}`,records:db.records.filter(r=>r.data>=from&&r.data<=to)};
  }
  if(type==='currentYear'){
    const y=today.getFullYear(),from=`${y}-01-01`,to=`${y}-12-31`;
    return {type,label:String(y),records:db.records.filter(r=>r.data>=from&&r.data<=to)};
  }
  if(type==='semester'){
    const y=today.getFullYear(), first=today.getMonth()<6;
    const from=`${y}-${first?'01':'07'}-01`,to=`${y}-${first?'06-30':'12-31'}`;
    return {type,label:`${first?'1°':'2°'} semestre ${y}`,records:db.records.filter(r=>r.data>=from&&r.data<=to)};
  }
  let month;
  if(type==='specificMonth') month=$('#specificMonth')?.value||currentMonth;
  else if(type==='previousMonth'){
    const d=new Date(today.getFullYear(),today.getMonth()-1,1,12); month=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  } else month=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`;
  currentMonth=month;
  return {type,label:monthLabel(month),records:db.records.filter(r=>r.data.startsWith(month))};
}
function renderPeriodExtra(){
  const type=$('#periodType').value,host=$('#periodExtra');
  if(type==='specificMonth'){
    const opts=[]; for(let y=2025;y<=2032;y++)for(let m=1;m<=12;m++){
      const val=`${y}-${String(m).padStart(2,'0')}`;
      opts.push(`<option value="${val}" ${val===currentMonth?'selected':''}>${monthLabel(val)}</option>`);
    }
    host.innerHTML=`<label>Mese<select id="specificMonth">${opts.join('')}</select></label>`;
  }else if(type==='day'){
    host.innerHTML=`<label>Data<input id="specificDay" type="date" value="${latestDate()}"></label>`;
  }else if(type==='range'){
    const last=latestDate(), first=last.slice(0,8)+'01';
    host.innerHTML=`<div class="date-range"><label>Dal<input id="rangeFrom" type="date" value="${first}"></label><label>Al<input id="rangeTo" type="date" value="${last}"></label></div>`;
  }else host.innerHTML='';
  host.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',renderDashboard));
}
function shiftPeriod(delta){
  const type=$('#periodType').value;
  if(type==='day'){
    const el=$('#specificDay'); if(!el)return;
    const d=new Date(el.value+'T12:00:00'); d.setDate(d.getDate()+delta); el.value=isoLocal(d); renderDashboard(); return;
  }
  if(type==='specificMonth'){
    const el=$('#specificMonth'),[y,m]=(el.value||currentMonth).split('-').map(Number);
    const d=new Date(y,m-1+delta,1,12); currentMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`; el.value=currentMonth; renderDashboard(); return;
  }
  $('#periodType').value='specificMonth';
  const base=getPeriod().records.at(-1)?.data?.slice(0,7)||currentMonth;
  currentMonth=base; renderPeriodExtra(); shiftPeriod(delta);
}

function kv(c,played='Giocato'){
  return `<div class="kv">
    <div><span>${played}</span><b>${eur(c.g)}</b></div>
    <div><span>Pagato</span><b>${eur(c.p)}</b></div>
    <div><span>Lordo</span><b class="${tone(c.lordo,'lordo')}">${eur(c.lordo)}</b></div>
    <div><span>Netto</span><b class="${tone(c.netto,'netto')}">${eur(c.netto)}</b></div>
  </div>`;
}
function renderDashboard(){
  const p=getPeriod(), a=aggregate(p.records), agency=agencyTotal(a), online=onlineTotal(a);
  $('#periodTitle').textContent=p.label;
  $('#periodKind').textContent=p.type==='day'||p.type==='today'?'GIORNO IN VISTA':p.type==='range'||p.type==='currentWeek'?'INTERVALLO IN VISTA':p.type==='all'?'PERIODO':'PERIODO IN VISTA';
  $('#dayCount').textContent=`${p.records.length} giorni`;
  $('#accountsTotal').textContent=a.conti;

  const cards=[
    ['⚽','Totale giocato',agency.g,'','Sport + Virtual Agenzia'],
    ['●','Totale pagato',agency.p,'','Sport + Virtual Agenzia'],
    ['▥','Lordo',agency.lordo,agency.lordo<0?'negative':'orange','Margine lordo'],
    ['↗','Netto',agency.netto,agency.netto<0?'negative':'green','Netto dopo tasse']
  ];
  $('#kpiGrid').innerHTML=cards.map(([ic,l,v,cls,sub])=>`<article class="kpi ${cls}">
    <div class="icon">${ic}</div><span>${l}</span><strong class="${l==='Netto'?tone(v,'netto'):l==='Lordo'?tone(v,'lordo'):'neutral-value'}">${eur(v)}</strong><small>${sub}</small>
  </article>`).join('');

  $('#sportDetail').innerHTML=kv(a.cats.sp);
  $('#virtualDetail').innerHTML=kv(a.cats.vt);
  $('#vltDetail').innerHTML=kv(a.cats.aw,'Incassati');
  $('#onlineDetail').innerHTML=kv(online);

  const recent=[...p.records].sort((a,b)=>b.data.localeCompare(a.data)).slice(0,5);
  $('#recentDays').innerHTML=`<div class="recent-table">
    <div class="recent-row head"><span>Data</span><span>Sport Agenzia</span><span>Virtual Agenzia</span></div>
    ${recent.map(r=>{
      const one=aggregate([r]),sp=one.cats.sp,vt=one.cats.vt;
      return `<div class="recent-row"><span>${dmy(r.data).slice(0,5)}</span>
        <span class="recent-cell"><span>Sport</span><b class="${tone(sp.netto,'netto')}">${eur(sp.netto)}</b></span>
        <span class="recent-cell"><span>Virtual</span><b class="${tone(vt.netto,'netto')}">${eur(vt.netto)}</b></span>
      </div>`;
    }).join('')}
  </div>`;

  drawTrend(p.records);
}
function drawTrend(records){
  const c=$('#trendChart'),ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);
  const sorted=[...records].sort((a,b)=>a.data.localeCompare(b.data));
  if(!sorted.length)return;
  const pts=sorted.map(r=>{const a=aggregate([r]),ag=agencyTotal(a);return {d:Number(r.data.slice(8,10)),g:ag.g,p:ag.p,n:ag.netto}});
  const max=Math.max(1,...pts.flatMap(x=>[x.g,x.p,Math.max(0,x.n)]));
  const pad={l:65,r:25,t:25,b:50},cw=w-pad.l-pad.r,ch=h-pad.t-pad.b;
  ctx.strokeStyle='#dfe6eb';ctx.lineWidth=1;ctx.font='12px system-ui';ctx.fillStyle='#73808d';
  for(let i=0;i<=5;i++){const y=pad.t+ch*i/5;ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();ctx.fillText(Math.round(max*(1-i/5)).toLocaleString('it-IT'),8,y+4)}
  const draw=(key,color)=>{
    ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();
    pts.forEach((x,i)=>{const px=pad.l+(x.d-1)/30*cw,py=pad.t+ch-(x[key]/max)*ch;i?ctx.lineTo(px,py):ctx.moveTo(px,py)});
    ctx.stroke();ctx.fillStyle=color;pts.forEach(x=>{const px=pad.l+(x.d-1)/30*cw,py=pad.t+ch-(x[key]/max)*ch;ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill()})
  };
  draw('g','#ef233c');draw('p','#f08a00');draw('n','#12a05a');
  ctx.fillStyle='#73808d';for(let d=1;d<=31;d+=2)ctx.fillText(String(d),pad.l+(d-1)/30*cw-4,h-18);
}
function renderHistory(){
  const month=$('#historyMonth').value||currentMonth;
  const rs=[...db.records].filter(r=>r.data.startsWith(month)).sort((a,b)=>b.data.localeCompare(a.data));
  const total=aggregate(rs),online=onlineTotal(total);
  $('#historyList').innerHTML=`<div class="history-summary">
    <div><span>Periodo</span><strong>${monthLabel(month)}</strong></div><div><span>Giornate</span><strong>${rs.length}</strong></div>
    <div><span>Sport · Netto</span><strong class="${tone(total.cats.sp.netto,'netto')}">${eur(total.cats.sp.netto)}</strong></div>
    <div><span>Virtual · Netto</span><strong class="${tone(total.cats.vt.netto,'netto')}">${eur(total.cats.vt.netto)}</strong></div>
  </div>`+rs.map(r=>{
    const a=aggregate([r]),on=onlineTotal(a);
    return `<article class="history-card"><div class="history-head"><strong>${dmy(r.data)}</strong><span>${num(r.conti)} conti aperti</span></div>
      <div class="history-grid">
        <div class="history-voice"><h4>Sport Agenzia</h4>${kv(a.cats.sp)}</div>
        <div class="history-voice"><h4>Virtual Agenzia</h4>${kv(a.cats.vt)}</div>
        <div class="history-voice"><h4>VLT</h4>${kv(a.cats.aw,'Incassati')}</div>
        <div class="history-voice"><h4>Online</h4>${kv(on)}</div>
      </div></article>`;
  }).join('');
}
function switchView(view){
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===(view==='dashboard'?'dashboardView':'historyView')));
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='history')renderHistory();
}
async function loadData(){
  const res=await fetch('./data.json?ts='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw new Error('Impossibile caricare data.json');
  db=await res.json();
  db.records.sort((a,b)=>a.data.localeCompare(b.data));
  currentMonth=db.records.length?db.records.at(-1).data.slice(0,7):new Date().toISOString().slice(0,7);
  $('#historyMonth').value=currentMonth;
  renderPeriodExtra();renderDashboard();
}
$('#periodType').addEventListener('change',()=>{renderPeriodExtra();renderDashboard()});
$('#prevPeriod').addEventListener('click',()=>shiftPeriod(-1));
$('#nextPeriod').addEventListener('click',()=>shiftPeriod(1));
$('#refreshBtn').addEventListener('click',()=>location.reload());
$('#historyMonth').addEventListener('change',renderHistory);
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
loadData().catch(e=>{console.error(e);$('#toast').textContent=e.message;$('#toast').classList.add('show')});
