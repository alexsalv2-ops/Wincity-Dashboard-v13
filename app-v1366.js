// v13.66 - OCR AWP adattivo per foto intera/inclinata

// v13.14 - legenda grafico garantita anche su browser/cache precedenti
(function ensureTrendLegend(){
  function install(){
    try{
      const canvas=document.getElementById('trendChart');
      if(!canvas) return;
      const panel=canvas.closest('.chart-panel');
      if(!panel) return;
      const head=panel.querySelector('.panel-head');
      if(!head) return;
      let legend=head.querySelector('.chart-legend');
      if(!legend){
        const left=head.firstElementChild || head;
        legend=document.createElement('div');
        legend.className='chart-legend';
        legend.setAttribute('aria-label','Legenda grafico');
        legend.innerHTML='<span><i></i>Giocate</span><span><i></i>Pagato</span><span><i></i>Netto</span>';
        left.appendChild(legend);
      }
      // Stili inline: la legenda resta visibile anche se styles.css è ancora in cache.
      Object.assign(legend.style,{display:'flex',alignItems:'center',gap:'14px',flexWrap:'wrap',marginTop:'7px',fontSize:'11px',fontWeight:'800',color:'#5f6d7d',visibility:'visible',opacity:'1',height:'auto'});
      const colors=['#ef233c','#f08a00','#12a05a'];
      [...legend.querySelectorAll('span')].forEach((s,i)=>{
        Object.assign(s.style,{display:'inline-flex',alignItems:'center',gap:'5px'});
        let dot=s.querySelector('i');
        if(!dot){dot=document.createElement('i');s.prepend(dot);}
        Object.assign(dot.style,{width:'9px',height:'9px',borderRadius:'50%',display:'inline-block',background:colors[i]||'#777',flex:'0 0 auto'});
      });
    }catch(e){}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',install,{once:true}); else install();
  window.addEventListener('pageshow',install);
})();


let db={records:[],settings:{}};
let currentMonth=new Date().toISOString().slice(0,7);
let semesterCursor={year:new Date().getFullYear(),half:(new Date().getMonth()<6?1:2)};
let weekCursor=new Date(); weekCursor.setHours(12,0,0,0);
let yearCursor=new Date().getFullYear();

const defs={
  sp:{g:'sp-g',p:'sp-p',mode:'lordo',pct:50,pctKey:'aSp',tax:'tSp'},
  vt:{g:'vt-g',p:'vt-p',mode:'raccolta',pct:4.5,pctKey:'aVt',tax:'tVt'},
  aw:{g:'aw-g',p:'aw-p',mode:'raccolta',pct:5.5,pctKey:'aAw',tax:'tAw'},
  so:{g:'so-g',p:'so-p',mode:'lordo',pct:50,pctKey:'aSo',tax:'tSo'},
  vo:{g:'vo-g',p:'vo-p',mode:'raccolta',pct:4.5,pctKey:'aVo',tax:'tVo'},
  co:{g:'co-g',p:'co-p',mode:'lordo',pct:50,pctKey:'aCo',tax:'tCo'},
  po:{g:'po-g',p:'po-p',mode:'lordo',pct:50,pctKey:'aPo',tax:'tPo'}
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
  const pct=db.settings[d.pctKey]===undefined?d.pct:num(db.settings[d.pctKey]);
  const aggio=d.mode==='lordo'?lordo*(pct/100):g*(pct/100);
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
    const d=new Date(weekCursor), dow=(d.getDay()+6)%7; d.setDate(d.getDate()-dow);
    const from=isoLocal(d); d.setDate(d.getDate()+6); const to=isoLocal(d);
    return {type,label:`${dmy(from)} — ${dmy(to)}`,records:db.records.filter(r=>r.data>=from&&r.data<=to)};
  }
  if(type==='currentYear'){
    const y=yearCursor,from=`${y}-01-01`,to=`${y}-12-31`;
    return {type,label:String(y),records:db.records.filter(r=>r.data>=from&&r.data<=to)};
  }
  if(type==='semester'){
    const y=semesterCursor.year, first=semesterCursor.half===1;
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
  if(type==='semester'){
    host.innerHTML='';
    return;
  }
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

  if(type==='today'){
    const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()+delta);
    $('#periodType').value='day';
    renderPeriodExtra();
    const el=$('#specificDay'); if(el) el.value=isoLocal(d);
    renderDashboard(); return;
  }

  if(type==='day'){
    const el=$('#specificDay'); if(!el)return;
    const d=new Date(el.value+'T12:00:00'); d.setDate(d.getDate()+delta);
    el.value=isoLocal(d); renderDashboard(); return;
  }

  if(type==='currentWeek'){
    weekCursor.setDate(weekCursor.getDate() + (delta*7));
    renderDashboard(); return;
  }

  if(type==='semester'){
    if(delta<0){
      if(semesterCursor.half===2) semesterCursor.half=1;
      else { semesterCursor.year--; semesterCursor.half=2; }
    }else{
      if(semesterCursor.half===1) semesterCursor.half=2;
      else { semesterCursor.year++; semesterCursor.half=1; }
    }
    renderDashboard(); return;
  }

  if(type==='currentYear'){
    yearCursor += delta;
    renderDashboard(); return;
  }

  if(type==='range'){
    const fromEl=$('#rangeFrom'), toEl=$('#rangeTo');
    if(!fromEl||!toEl||!fromEl.value||!toEl.value)return;
    const from=new Date(fromEl.value+'T12:00:00');
    const to=new Date(toEl.value+'T12:00:00');
    const days=Math.max(1,Math.round((to-from)/86400000)+1);
    from.setDate(from.getDate()+delta*days);
    to.setDate(to.getDate()+delta*days);
    fromEl.value=isoLocal(from); toEl.value=isoLocal(to);
    renderDashboard(); return;
  }

  if(type==='specificMonth'){
    const el=$('#specificMonth'),[y,m]=(el.value||currentMonth).split('-').map(Number);
    const d=new Date(y,m-1+delta,1,12);
    currentMonth=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    el.value=currentMonth; renderDashboard(); return;
  }

  if(type==='currentMonth' || type==='previousMonth'){
    const p=getPeriod();
    const [y,m]=(p.label && p.records.length ? (p.records[0].data.slice(0,7)) : currentMonth).split('-').map(Number);
    const base = type==='previousMonth' ? new Date(new Date().getFullYear(),new Date().getMonth()-1,1,12) : new Date(y,m-1,1,12);
    base.setMonth(base.getMonth()+delta);
    currentMonth=`${base.getFullYear()}-${String(base.getMonth()+1).padStart(2,'0')}`;
    $('#periodType').value='specificMonth';
    renderPeriodExtra();
    const el=$('#specificMonth'); if(el) el.value=currentMonth;
    renderDashboard(); return;
  }

  if(type==='all'){
    // Il cumulato totale non ha un periodo precedente/successivo equivalente.
    return;
  }
}

function kv(c,played='Giocato'){
  return `<div class="kv">
    <div><span>${played}</span><b>${eur(c.g)}</b></div>
    <div><span>Pagato</span><b>${eur(c.p)}</b></div>
    <div><span>Lordo</span><b class="${tone(c.lordo,'lordo')}">${eur(c.lordo)}</b></div>
    <div><span>Netto</span><b class="${tone(c.netto,'netto')}">${eur(c.netto)}</b></div>
  </div>`;
}
function utileSeries(){
  return Array.isArray(db.utileCumulativo)?db.utileCumulativo:[];
}
function utileNetto(v){return num(v)*0.5}
function previousIsoDay(date){
  const d=new Date(date+'T12:00:00'); d.setDate(d.getDate()-1); return isoLocal(d);
}
function hasNumericField(obj,key){
  return !!obj && obj[key]!==null && obj[key]!==undefined && obj[key]!=='' && Number.isFinite(Number(obj[key]));
}
function closureReadinessForUtile(u){
  const utileDate=u?.data||'';
  const month=utileDate.slice(0,7);
  const candidates=(Array.isArray(db.records)?db.records:[])
    .filter(r=>r && typeof r.data==='string' && r.data.startsWith(month) && r.data<=utileDate)
    .sort((a,b)=>b.data.localeCompare(a.data));

  const complete=candidates.find(rec=>{
    const contiOk=rec.conti!==null && rec.conti!==undefined && rec.contiConfermato!==false && Number.isFinite(Number(rec.conti));
    return hasNumericField(rec,'cassaReale') && hasNumericField(rec,'saldoBuffetti') && contiOk;
  });

  if(complete){
    return {refDate:complete.data,rec:complete,missing:[],ready:true,utileDate};
  }

  const rec=candidates[0]||null;
  const refDate=rec?.data||utileDate;
  const missing=[];
  if(!hasNumericField(rec,'cassaReale')) missing.push('Cassa reale');
  if(!hasNumericField(rec,'saldoBuffetti')) missing.push('Saldo Buffetti');
  const contiOk=!!rec && rec.conti!==null && rec.conti!==undefined && rec.contiConfermato!==false && Number.isFinite(Number(rec.conti));
  if(!contiOk) missing.push('Conti aperti');
  return {refDate,rec,missing,ready:false,utileDate};
}
function telegramReadinessHtml(u){
  const c=closureReadinessForUtile(u);
  const common='margin-top:12px;padding:12px 14px;border:1px solid #e4e9ee;border-radius:12px;background:#f8fafb;font-size:14px;line-height:1.45';
  if(c.ready){
    return `<div style="${common}"><strong>✓ Riepilogo Telegram pronto · Chiusura ${dmy(c.refDate)}</strong><div style="margin-top:4px;color:#6f7b87">Cassa reale, Saldo Buffetti e Conti aperti presenti.</div></div>`;
  }
  return `<div style="${common}"><strong>⏳ Telegram in attesa · Chiusura ${dmy(c.refDate)}</strong><div style="margin-top:4px;color:#6f7b87">Mancano: ${c.missing.join(', ')}.</div></div>`;
}
function utileForPeriod(p){
  const all=[...utileSeries()].sort((a,b)=>a.data.localeCompare(b.data));
  if(!all.length)return null;
  const type=$('#periodType')?.value;
  let from=null,to=null;
  if(type==='all') return all.at(-1);
  if(type==='today'){
    const d=isoLocal(new Date()); from=d;to=d;
  }else if(type==='day'){
    const d=$('#specificDay')?.value||latestDate(); from=d;to=d;
  }else if(type==='range'){
    from=$('#rangeFrom')?.value||latestDate(); to=$('#rangeTo')?.value||latestDate();
  }else if(type==='currentMonth'||type==='previousMonth'||type==='specificMonth'){
    const m=currentMonth; from=m+'-01';to=m+'-31';
  }else if(type==='semester'){
    const y=semesterCursor.year,first=semesterCursor.half===1;
    from=`${y}-${first?'01':'07'}-01`;to=`${y}-${first?'06-30':'12-31'}`;
  }else if(type==='currentYear'){
    from=`${yearCursor}-01-01`;to=`${yearCursor}-12-31`;
  }else if(type==='currentWeek'){
    const d=new Date(weekCursor),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);
    from=isoLocal(d);d.setDate(d.getDate()+6);to=isoLocal(d);
  }
  if(from&&to){
    const inRange=all.filter(x=>x.data>=from&&x.data<=to);
    if(inRange.length)return inRange.at(-1);
    // Per il singolo giorno mostra l'ultimo cumulativo disponibile dello stesso mese fino a quella data.
    if(from===to){
      const month=from.slice(0,7);
      const prior=all.filter(x=>x.data.startsWith(month)&&x.data<=to);
      if(prior.length)return prior.at(-1);
    }
    return null;
  }
  return all.at(-1);
}
function renderUtileDashboard(p){
  const host=$('#utileCumulativoBody'),badge=$('#utileCumulativoDate');
  if(!host||!badge)return;
  const u=utileForPeriod(p);
  if(!u){
    badge.textContent='Nessuna rilevazione';
    host.innerHTML='<div style="padding:18px 4px;color:#73808d">Nessun utile cumulativo registrato per il periodo selezionato.</div>';
    return;
  }
  badge.textContent=`Agg. ${dmy(u.data)}`;
  host.innerHTML=`<div class="kpi-grid" style="padding:6px 0 2px;grid-template-columns:repeat(2,minmax(0,1fr))">
    <article class="kpi orange"><div class="icon">€</div><span>Utile lordo</span><strong class="${tone(num(u.lordo),'lordo')}">${eur(u.lordo)}</strong><small>Cumulativo dal 1° del mese</small></article>
    <article class="kpi green"><div class="icon">↗</div><span>Utile netto</span><strong class="${tone(utileNetto(u.lordo),'netto')}">${eur(utileNetto(u.lordo))}</strong><small>50% del lordo</small></article>
  </div>`;
}
function awpWeeklySeries(){
  return Array.isArray(db.awpSettimanale)?db.awpSettimanale:[];
}
function awpWeeklyBounds(){
  const type=$('#periodType')?.value||'currentMonth';
  const today=new Date(); today.setHours(12,0,0,0);
  if(type==='all') return {from:null,to:null};
  if(type==='today'){const d=isoLocal(today);return {from:d,to:d};}
  if(type==='day'){const d=$('#specificDay')?.value||latestDate();return {from:d,to:d};}
  if(type==='range') return {from:$('#rangeFrom')?.value||latestDate(),to:$('#rangeTo')?.value||latestDate()};
  if(type==='currentWeek'){
    const d=new Date(weekCursor),dow=(d.getDay()+6)%7;d.setDate(d.getDate()-dow);
    const from=isoLocal(d);d.setDate(d.getDate()+6);return {from,to:isoLocal(d)};
  }
  if(type==='semester'){
    const y=semesterCursor.year,first=semesterCursor.half===1;
    return {from:`${y}-${first?'01':'07'}-01`,to:`${y}-${first?'06-30':'12-31'}`};
  }
  if(type==='currentYear') return {from:`${yearCursor}-01-01`,to:`${yearCursor}-12-31`};
  const m=currentMonth;
  return {from:m+'-01',to:m+'-31'};
}
function awpWeeklyForCurrentPeriod(){
  const all=[...awpWeeklySeries()].sort((a,b)=>a.dal.localeCompare(b.dal));
  const {from,to}=awpWeeklyBounds();
  if(!from||!to)return all;
  // Regola contabile scelta: il borderò appartiene al periodo in cui INIZIA.
  return all.filter(x=>x.dal>=from&&x.dal<=to);
}
function renderAwpWeeklyDashboard(){
  const host=$('#awpSettimanaleBody'),badge=$('#awpSettimanaleCount');
  if(!host||!badge)return;
  const rows=awpWeeklyForCurrentPeriod().sort((a,b)=>b.dal.localeCompare(a.dal));
  badge.textContent=rows.length===1?'1 settimana':`${rows.length} settimane`;
  if(!rows.length){
    host.innerHTML='<div style="padding:8px 2px;color:#73808d;font-size:12px">Nessun dato AWP nel periodo selezionato.</div>';
    return;
  }
  host.innerHTML=rows.map(x=>`<div class="awp-week-row">
    <div class="awp-week-period">${dmy(x.dal)} → ${dmy(x.al)}</div>
    <div class="kv">
      <div><span>Giocato</span><b>${eur(x.raccolta)}</b></div>
      <div><span>Pagato</span><b>${eur(x.vincite)}</b></div>
      <div><span>Cassa</span><b>${eur(Number.isFinite(Number(x.cassa))?x.cassa:(Number(x.raccolta||0)-Number(x.vincite||0)))}</b></div>
      <div><span>Corrispettivo esercente</span><b class="positive">${eur(x.corrispettivo)}</b></div>
    </div>
  </div>`).join('');
}
function renderAwpWeeklyHistory(month){
  const rows=[...awpWeeklySeries()].filter(x=>x.dal.startsWith(month)).sort((a,b)=>b.dal.localeCompare(a.dal));
  if(!rows.length)return '';
  return `<section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>🕹 AWP settimanali</h2><p>Borderò settimanali · attribuiti al mese della data iniziale</p></div><span class="pill">${rows.length===1?'1 settimana':rows.length+' settimane'}</span></div>
    ${rows.map(x=>`<div class="history-summary" style="margin:0 0 10px"><div><span>Periodo</span><strong>${dmy(x.dal)} → ${dmy(x.al)}</strong></div><div><span>Giocato</span><strong>${eur(x.raccolta)}</strong></div><div><span>Pagato</span><strong>${eur(x.vincite)}</strong></div><div><span>Cassa</span><strong>${eur(Number.isFinite(Number(x.cassa))?x.cassa:(Number(x.raccolta||0)-Number(x.vincite||0)))}</strong></div><div><span>Corrispettivo esercente</span><strong class="positive">${eur(x.corrispettivo)}</strong></div></div>`).join('')}
  </section>`;
}

function renderTelegramReadinessMaster(){
  const host=$('#telegramReadinessMaster');
  if(!host)return;
  const all=[...utileSeries()].sort((a,b)=>a.data.localeCompare(b.data));
  if(!all.length){
    host.innerHTML='<div style="margin-top:12px;padding:12px 14px;border:1px solid #e4e9ee;border-radius:12px;background:#f8fafb;font-size:14px;line-height:1.45"><strong>Telegram · nessun Utile cumulativo registrato</strong><div style="margin-top:4px;color:#6f7b87">Il controllo della chiusura comparirà dopo la prima rilevazione.</div></div>';
    return;
  }
  host.innerHTML=telegramReadinessHtml(all.at(-1));
}
function ensureUtileHistoryStyles(){
  if(document.getElementById('utileHistoryResponsiveStyles'))return;
  const style=document.createElement('style');
  style.id='utileHistoryResponsiveStyles';
  style.textContent=`
    .utile-history-table{margin-top:4px}
    .utile-history-head,.utile-history-row{display:grid;grid-template-columns:minmax(120px,.8fr) minmax(150px,1fr) minmax(150px,1fr);gap:12px;align-items:center}
    .utile-history-head{padding:10px 14px;border-radius:12px;background:#f3f5f7;color:#6f7b87;font-size:12px;font-weight:800;text-transform:uppercase}
    .utile-history-row{padding:13px 14px;border-bottom:1px solid #e7ebef}
    .utile-history-cell{min-width:0}
    .utile-history-cell .utile-history-label{display:none}
    .utile-history-value{display:block;font-size:17px;font-weight:800;line-height:1.25;white-space:nowrap}
    @media (max-width:640px){
      .utile-history-head{display:none}
      .utile-history-table{display:grid;gap:10px}
      .utile-history-row{grid-template-columns:1fr;gap:9px;padding:12px 14px;border:1px solid #e4e9ee;border-radius:14px;background:#fff}
      .utile-history-cell{display:flex;align-items:center;justify-content:space-between;gap:14px}
      .utile-history-cell .utile-history-label{display:block;min-width:0;color:#6f7b87;font-size:12px;font-weight:800;text-transform:uppercase;line-height:1.2}
      .utile-history-value{flex:0 0 auto;text-align:right;font-size:16px}
    }
  `;
  document.head.appendChild(style);
}
function renderUtileHistory(month){
  ensureUtileHistoryStyles();
  const rows=[...utileSeries()].filter(x=>x.data.startsWith(month)).sort((a,b)=>b.data.localeCompare(a.data));
  if(!rows.length)return '<section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>↗ Utile cumulativo Sport</h2><p>Nessuna rilevazione per questo mese.</p></div></div></section>';
  const last=rows[0];
  const previous=rows.slice(1);
  const countLabel=rows.length===1?'1 rilevazione':`${rows.length} rilevazioni`;
  const previousTable=previous.length?`
    <div class="utile-history-table">
      <div class="utile-history-head"><span>Data</span><span>Utile lordo Sport</span><span>Utile netto Sport (50%)</span></div>
      ${previous.map(u=>`<div class="utile-history-row">
        <div class="utile-history-cell"><span class="utile-history-label">Data</span><span class="utile-history-value">${dmy(u.data)}</span></div>
        <div class="utile-history-cell"><span class="utile-history-label">Utile lordo</span><span class="utile-history-value ${tone(u.lordo,'lordo')}">${eur(u.lordo)}</span></div>
        <div class="utile-history-cell"><span class="utile-history-label">Utile netto (50%)</span><span class="utile-history-value ${tone(utileNetto(u.lordo),'netto')}">${eur(utileNetto(u.lordo))}</span></div>
      </div>`).join('')}
    </div>`:'';
  return `<section class="panel" style="margin-bottom:18px"><div class="panel-head"><div><h2>↗ Utile cumulativo Sport</h2><p>Rilevazioni giornaliere del cumulativo mensile</p></div><span class="pill">${countLabel}</span></div>
    <div class="history-summary" style="margin:0 ${previous.length?'0 12px':'0'}"><div><span>Ultimo aggiornamento</span><strong>${dmy(last.data)}</strong></div><div><span>Utile lordo</span><strong class="${tone(last.lordo,'lordo')}">${eur(last.lordo)}</strong></div><div><span>Utile netto</span><strong class="${tone(utileNetto(last.lordo),'netto')}">${eur(utileNetto(last.lordo))}</strong></div><div><span>Calcolo netto</span><strong>50%</strong></div></div>
    ${previousTable}
  </section>`;
}

function renderDashboard(){
  const p=getPeriod(), a=aggregate(p.records), agency=agencyTotal(a), online=onlineTotal(a);
  $('#periodTitle').textContent=p.label;
  $('#periodKind').textContent=p.type==='day'||p.type==='today'?'GIORNO IN VISTA':p.type==='range'||p.type==='currentWeek'?'INTERVALLO IN VISTA':p.type==='all'?'PERIODO':'PERIODO IN VISTA';
  $('#dayCount').textContent=`${p.records.length} giorni`;
  $('#accountsTotal').textContent=a.conti;

  const cards=[
    ['⚽','Totale giocato',agency.g,'','Sport + Virtual Agenzia'],
    ['€','Totale pagato',agency.p,'','Sport + Virtual Agenzia'],
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

  renderUtileDashboard(p);
  renderAwpWeeklyDashboard();
  renderTelegramReadinessMaster();
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
  $('#historyList').innerHTML=renderUtileHistory(month)+renderAwpWeeklyHistory(month)+`<div class="history-summary">
    <div><span>Periodo</span><strong>${monthLabel(month)}</strong></div><div><span>Giornate</span><strong>${rs.length}</strong></div>
    <div><span>Sport · Giocato</span><strong class="neutral-value">${eur(total.cats.sp.g)}</strong></div>
    <div><span>Virtual · Giocato</span><strong class="neutral-value">${eur(total.cats.vt.g)}</strong></div>
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
  const id=view==='dashboard'?'dashboardView':view==='history'?'historyView':view==='master'?'masterView':'settingsView';
  $$('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  $$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='history')renderHistory();
  if(view==='master')renderMasterState();
  if(view==='settings')renderSettingsState();
}


/* ===== MASTER v13 ===== */
const MASTER_PASSWORD='WincityMaster';
const TOKEN_KEY='wincity_v13_gh_token';
const GH_REPO='alexsalv2-ops/Wincity-Dashboard-v13-private';
const GH_FILE='data.json';
const PENDING_QR_KEY='wincity_v13_pending_qr_persist';
const PENDING_ONLINE_KEY='wincity_v13_pending_online_persist';
const PENDING_UTILE_KEY='wincity_v13_pending_utile_persist';
let qrScanner=null;
let githubTokenMemory='';
function getGithubToken(){
  let token='';
  try{ token=(localStorage.getItem(TOKEN_KEY)||'').trim(); }catch(e){}
  if(!token && githubTokenMemory) token=githubTokenMemory.trim();
  const field=$('#settingsGithubToken');
  if(!token && field && field.value) token=field.value.trim();
  if(token){
    githubTokenMemory=token;
    try{ if(localStorage.getItem(TOKEN_KEY)!==token) localStorage.setItem(TOKEN_KEY,token); }catch(e){}
  }
  return token;
}
function saveGithubToken(token){
  token=(token||'').trim();
  if(!token) return false;
  githubTokenMemory=token;
  try{ localStorage.setItem(TOKEN_KEY,token); }catch(e){}
  return !!getGithubToken();
}
function clearGithubToken(){
  githubTokenMemory='';
  try{ localStorage.removeItem(TOKEN_KEY); }catch(e){}
}


function isMaster(){return sessionStorage.getItem('wincity_v13_master')==='1'}
function renderMasterState(){
  const unlocked=isMaster();
  $('#masterLocked').hidden=unlocked;
  $('#masterUnlocked').hidden=!unlocked;
  if(unlocked){
    loadRateFields();
    if(!$('#entryDate').value) $('#entryDate').value=latestDate();
    updateRawPreview();
    renderTelegramReadinessMaster();
  }
}
function updateTokenStatus(){
  const ok=!!getGithubToken();
  if($('#settingsTokenStatus')){
    $('#settingsTokenStatus').textContent=ok?'Token salvato':'Token non impostato';
    $('#settingsTokenStatus').className='pill '+(ok?'positive':'');
  }
}
function renderSettingsState(){
  const unlocked=isMaster();
  $('#settingsLocked').hidden=unlocked;
  $('#settingsUnlocked').hidden=!unlocked;
  if(unlocked){
    $('#settingsGithubToken').value=getGithubToken();
    updateTokenStatus(); loadRateFields();
  }
}
function settingsLogin(){
  if($('#settingsPassword').value===MASTER_PASSWORD){
    sessionStorage.setItem('wincity_v13_master','1'); $('#settingsPassword').value=''; renderSettingsState();
  }else alert('Password Master non corretta.');
}
function settingsLogout(){
  sessionStorage.removeItem('wincity_v13_master'); renderSettingsState(); renderMasterState();
}
function masterLogin(){
  if($('#masterPassword').value===MASTER_PASSWORD){
    sessionStorage.setItem('wincity_v13_master','1');
    $('#masterPassword').value='';
    renderMasterState();
    // QR direct-link: recupero robusto anche dopo login/re-render del Master.
    const pendingUtile=localStorage.getItem(PENDING_UTILE_KEY) || sessionStorage.getItem('wincity_v13_pending_utile_after_login');
    if(pendingUtile){
      sessionStorage.removeItem('wincity_v13_pending_utile_after_login');
      applyUtilePayload(pendingUtile);
      return;
    }
    const pendingOnline=localStorage.getItem(PENDING_ONLINE_KEY) || sessionStorage.getItem('wincity_v13_pending_online_after_login');
    if(pendingOnline){
      sessionStorage.removeItem('wincity_v13_pending_online_after_login');
      applyOnlinePayload(pendingOnline);
      return;
    }
    const pending=localStorage.getItem(PENDING_QR_KEY) || sessionStorage.getItem('wincity_v13_pending_qr_after_login');
    if(pending){
      sessionStorage.removeItem('wincity_v13_pending_qr_after_login');
      applyQrPayload(pending);
    }
  }else alert('Password Master non corretta.');
}
function masterLogout(){
  sessionStorage.removeItem('wincity_v13_master');
  stopQr();
  renderMasterState();
}
function val(id){return num($('#'+id)?.value)}
function setVal(id,v){const el=$('#'+id);if(el)el.value=(Number(v)||0).toFixed(2).replace('.',',')}
function optionalVal(id){
  const el=$('#'+id),raw=String(el?.value??'').trim();
  return raw===''?null:num(raw);
}
function setOptionalVal(id,v){
  const el=$('#'+id); if(!el)return;
  el.value=(v===null||v===undefined||v==='')?'':Number(v).toFixed(2).replace('.',',');
}
function updateRawPreview(){
  const spG=val('spEmessi')-val('spAnnulli'), spP=val('spPagati')+val('spRimborsati');
  const vtG=val('vtEmessi')-val('vtAnnulli'), vtP=val('vtPagati')+val('vtRimborsati');
  $('#spNetPlayed').textContent=eur(spG); $('#spNetPaid').textContent=eur(spP);
  $('#vtNetPlayed').textContent=eur(vtG); $('#vtNetPaid').textContent=eur(vtP);
}
function recordFromForm(){
  const date=$('#entryDate').value;
  if(!date) throw new Error('Seleziona una data.');
  const spRaw={emessi:val('spEmessi'),annulli:val('spAnnulli'),pagati:val('spPagati'),rimborsati:val('spRimborsati')};
  const vtRaw={emessi:val('vtEmessi'),annulli:val('vtAnnulli'),pagati:val('vtPagati'),rimborsati:val('vtRimborsati')};
  const contiRaw=String($('#contiInput')?.value??'').trim();
  return {
    data:date,
    'sp-g':spRaw.emessi-spRaw.annulli,'sp-p':spRaw.pagati+spRaw.rimborsati,
    'vt-g':vtRaw.emessi-vtRaw.annulli,'vt-p':vtRaw.pagati+vtRaw.rimborsati,
    'aw-g':val('awG'),'aw-p':val('awP'),
    'so-g':val('soG'),'so-p':val('soP'),'vo-g':val('voG'),'vo-p':val('voP'),
    'co-g':val('coG'),'co-p':val('coP'),'po-g':val('poG'),'po-p':val('poP'),
    conti:contiRaw===''?0:Math.max(0,Math.round(num(contiRaw))),
    contiConfermato:contiRaw!=='',
    cassaReale:optionalVal('cassaRealeInput'),
    saldoBuffetti:optionalVal('saldoBuffettiInput'),
    simpRaw:{sport:spRaw,virtual:vtRaw}
  };
}
function clearEntry(){
  ['spEmessi','spAnnulli','spPagati','spRimborsati','vtEmessi','vtAnnulli','vtPagati','vtRimborsati',
   'awG','awP','soG','soP','voG','voP','coG','coP','poG','poP'].forEach(id=>setVal(id,0));
  setOptionalVal('cassaRealeInput',null); setOptionalVal('saldoBuffettiInput',null);
  $('#contiInput').value=''; updateRawPreview();
}
function loadDayToForm(){
  const date=$('#entryDate').value;
  const r=db.records.find(x=>x.data===date);
  if(!r){clearEntry();$('#saveStatus').textContent='Giornata non presente: pronto per nuovo inserimento.';return}
  const sr=r.simpRaw?.sport||{emessi:num(r['sp-g']),annulli:0,pagati:num(r['sp-p']),rimborsati:0};
  const vr=r.simpRaw?.virtual||{emessi:num(r['vt-g']),annulli:0,pagati:num(r['vt-p']),rimborsati:0};
  setVal('spEmessi',sr.emessi);setVal('spAnnulli',sr.annulli);setVal('spPagati',sr.pagati);setVal('spRimborsati',sr.rimborsati);
  setVal('vtEmessi',vr.emessi);setVal('vtAnnulli',vr.annulli);setVal('vtPagati',vr.pagati);setVal('vtRimborsati',vr.rimborsati);
  [['awG','aw-g'],['awP','aw-p'],['soG','so-g'],['soP','so-p'],['voG','vo-g'],['voP','vo-p'],
   ['coG','co-g'],['coP','co-p'],['poG','po-g'],['poP','po-p']].forEach(([id,k])=>setVal(id,r[k]));
  setOptionalVal('cassaRealeInput',r.cassaReale);
  setOptionalVal('saldoBuffettiInput',r.saldoBuffetti);
  $('#contiInput').value=(r.contiConfermato===false)?'':Math.max(0,Math.round(num(r.conti)));
  updateRawPreview();
  $('#saveStatus').textContent='Giornata caricata. Le modifiche sovrascriveranno questa data.';
}
function decodeGithubContent(content){
  const clean=String(content||'').replace(/\s/g,'');
  return JSON.parse(decodeURIComponent(escape(atob(clean))));
}
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function fetchGithubJsonWithRetry(url,options={},attempts=4){
  let lastError=null;
  for(let i=0;i<attempts;i++){
    try{
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),12000);
      let response;
      try{
        response=await fetch(url,{...options,signal:controller.signal});
      }finally{
        clearTimeout(timer);
      }

      if(response.ok) return response;

      const retryable=response.status===408||response.status===429||response.status>=500;
      if(!retryable) return response;
      lastError=new Error(`GitHub GET ${response.status}`);
    }catch(e){
      lastError=e;
    }

    if(i<attempts-1){
      const delays=[700,1400,2600];
      await wait(delays[i]||2600);
    }
  }

  const offline=(typeof navigator!=='undefined' && navigator.onLine===false);
  if(offline) throw new Error('Connessione Internet assente. Il QR è stato conservato: riconnettiti e riapri la Dashboard.');
  throw new Error('Connessione al database GitHub non riuscita dopo più tentativi. Il QR è stato conservato: riprova tra qualche secondo.');
}
async function fetchLatestGithubDb(){
  const token=getGithubToken();
  if(!token) throw new Error('Token GitHub non disponibile in questa sessione. Apri Impostazioni e premi Salva sul dispositivo.');
  const api=`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
  const headers={'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
  const get=await fetchGithubJsonWithRetry(api,{headers,cache:'no-store'});
  if(!get.ok){
    if(get.status===401) throw new Error('Token GitHub non valido o scaduto.');
    if(get.status===403) throw new Error('GitHub ha rifiutato temporaneamente l’accesso al database. Riprova tra poco.');
    if(get.status===404) throw new Error('Database privato GitHub non trovato.');
    throw new Error(`GitHub GET ${get.status}`);
  }
  const info=await get.json();
  if(!info.content) throw new Error('GitHub non ha restituito il contenuto di data.json');
  const remoteDb=decodeGithubContent(info.content);
  if(!remoteDb || !Array.isArray(remoteDb.records)) throw new Error('data.json remoto non valido');
  remoteDb.settings=remoteDb.settings||{};
  remoteDb.utileCumulativo=Array.isArray(remoteDb.utileCumulativo)?remoteDb.utileCumulativo:[];
  remoteDb.awpSettimanale=Array.isArray(remoteDb.awpSettimanale)?remoteDb.awpSettimanale:[];
  remoteDb.records.sort((a,b)=>a.data.localeCompare(b.data));
  remoteDb.utileCumulativo.sort((a,b)=>a.data.localeCompare(b.data));
  remoteDb.awpSettimanale.sort((a,b)=>a.dal.localeCompare(b.dal));
  return {remoteDb,sha:info.sha,api,headers};
}
async function pushDataToGithubMerged(rec){
  const {remoteDb,sha,api,headers}=await fetchLatestGithubDb();

  // La sorgente autorevole è il data.json appena letto da GitHub.
  // Modifichiamo SOLO la giornata richiesta: così un eventuale ritardo/cache
  // di GitHub Pages non può ripristinare o cancellare altre giornate.
  const ni=remoteDb.records.findIndex(r=>r.data===rec.data);
  if(ni>=0){
    const prev=remoteDb.records[ni];
    const merged={...prev,...rec};
    // I campi di chiusura non devono essere cancellati da un successivo import QR/Online
    // se il relativo input non è stato caricato/compilato nel modulo.
    if(rec.cassaReale===null && prev.cassaReale!==null && prev.cassaReale!==undefined) merged.cassaReale=prev.cassaReale;
    if(rec.saldoBuffetti===null && prev.saldoBuffetti!==null && prev.saldoBuffetti!==undefined) merged.saldoBuffetti=prev.saldoBuffetti;
    if(rec.contiConfermato===false && prev.conti!==null && prev.conti!==undefined){
      merged.conti=prev.conti;
      merged.contiConfermato=prev.contiConfermato===undefined?true:prev.contiConfermato;
    }
    remoteDb.records[ni]=merged;
  }else remoteDb.records.push(rec);
  remoteDb.records.sort((a,b)=>a.data.localeCompare(b.data));

  const content=btoa(unescape(encodeURIComponent(JSON.stringify(remoteDb,null,2))));
  const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
    message:`Dashboard: aggiorna ${rec.data}`,
    content,sha
  })});
  if(!put.ok){
    let msg=''; try{msg=(await put.json()).message||''}catch{}
    throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`);
  }
  return remoteDb;
}
async function pushUtileToGithubMerged(item){
  const {remoteDb,sha,api,headers}=await fetchLatestGithubDb();
  remoteDb.utileCumulativo=Array.isArray(remoteDb.utileCumulativo)?remoteDb.utileCumulativo:[];
  const idx=remoteDb.utileCumulativo.findIndex(x=>x.data===item.data);
  if(idx>=0) remoteDb.utileCumulativo[idx]={...remoteDb.utileCumulativo[idx],...item};
  else remoteDb.utileCumulativo.push(item);
  remoteDb.utileCumulativo.sort((a,b)=>a.data.localeCompare(b.data));
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(remoteDb,null,2))));
  const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
    message:`Dashboard: utile cumulativo ${item.data}`,content,sha
  })});
  if(!put.ok){let msg='';try{msg=(await put.json()).message||''}catch{};throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`)}
  return remoteDb;
}

function parseOcrItalianAmount(raw){
  let s=String(raw||'').trim().replace(/[€+]/g,'').replace(/\s/g,'');
  if(!s)return null;
  s=s.replace(/[^0-9,.-]/g,'');

  // OCR tipo 2.854.000 / 4.079.000: l'ultima cifra è spuriosa.
  // Sul borderò gli importi hanno sempre 2 decimali, quindi 2.854.000 = 2.854,00.
  let trip=s.match(/^(-?\d{1,3})[.,](\d{3})[.,](\d{3})$/);
  if(trip && /00$/.test(trip[3])){
    const n=Number(trip[1]+trip[2]+'.'+trip[3].slice(-2));
    if(Number.isFinite(n))return n;
  }

  // Tesseract sul monitor spesso restituisce 2.854,0 oppure 1.141,3:
  // accettiamo quindi 1 o 2 cifre decimali.
  let m=s.match(/-?\d[\d.,]*[,.](\d{1,2})$/);
  if(m){
    s=m[0];
    const lastComma=s.lastIndexOf(','),lastDot=s.lastIndexOf('.');
    const decPos=Math.max(lastComma,lastDot);
    const intPart=s.slice(0,decPos).replace(/[.,]/g,'');
    const decPart=s.slice(decPos+1).padEnd(2,'0');
    const n=Number(intPart+'.'+decPart);
    if(Number.isFinite(n))return n;
  }

  // OCR possibile: 2.85400 / 1.22500, con il separatore dei centesimi perso.
  m=s.match(/^(\d{1,3})[.,](\d{5})$/);
  if(m){
    const digits=m[1]+m[2];
    const n=Number(digits.slice(0,-2)+'.'+digits.slice(-2));
    if(Number.isFinite(n))return n;
  }

  // Evita di inventare decimali da una singola cifra isolata.
  const digits=s.replace(/\D/g,'');
  if(digits.length>=4 && digits.length<=8){
    const n=Number(digits.slice(0,-2)+'.'+digits.slice(-2));
    if(Number.isFinite(n))return n;
  }
  return null;
}
function ocrIsoDate(d,m,y){
  d=Number(d);m=Number(m);y=Number(y);
  if(y<2000||y>2100||m<1||m>12||d<1||d>31)return null;
  return `${String(y).padStart(4,'0')}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
}
function normalizeOcrText(s){
  return String(s||'')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[|]/g,'l')
    .replace(/0(?=[a-z])/g,'o')
    .replace(/1(?=[a-z])/g,'l');
}
function prepareAwpCrop(bmp,xPct,yPct,wPct,hPct,targetWidth=2800){
  const sx=Math.max(0,Math.round(bmp.width*xPct));
  const sy=Math.max(0,Math.round(bmp.height*yPct));
  const sw=Math.min(bmp.width-sx,Math.round(bmp.width*wPct));
  const sh=Math.min(bmp.height-sy,Math.round(bmp.height*hPct));
  const scale=Math.min(4,Math.max(2,targetWidth/Math.max(1,sw)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(sw*scale);
  canvas.height=Math.round(sh*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.filter='grayscale(1) contrast(1.9) brightness(1.1)';
  ctx.drawImage(bmp,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}
function inferAwpSummaryByMath(text){
  const lines=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  const vals=[];
  for(const line of lines){
    const n=parseOcrItalianAmount(line);
    if(n!==null)vals.push(n);
  }

  // Sequenza tipica:
  // Raccolta, Vincite, Cassa, Corrispettivo, Totale prelevato.
  // Prima proviamo la lettura completa.
  const strong=[];
  for(let i=0;i<=vals.length-5;i++){
    const [raccolta,vincite,cassa,corrispettivo,prelevato]=vals.slice(i,i+5);
    if(raccolta<=0||vincite<0||cassa<0||corrispettivo<0||prelevato<0)continue;
    if(corrispettivo>cassa)continue;
    const e1=Math.abs((raccolta-vincite)-cassa);
    const e2=Math.abs((cassa-corrispettivo)-prelevato);
    if(e1<=1 && e2<=1){
      strong.push({raccolta,vincite,cassa,corrispettivo,prelevato,index:i});
    }
  }
  if(strong.length)return strong.at(-1);

  // Sullo stampato reale Tesseract può leggere, per esempio,
  // 2.854,00 come 2.854.002. In quel caso la cifra "Vincite" è corrotta,
  // ma le altre quattro permettono comunque di ricostruirla:
  // Vincite = Raccolta - Cassa
  // e Cassa - Corrispettivo = Totale prelevato.
  const recovered=[];
  for(let i=0;i<=vals.length-5;i++){
    const [raccolta,_vinciteLetta,cassa,corrispettivo,prelevato]=vals.slice(i,i+5);
    if(raccolta<=0||cassa<0||corrispettivo<0||prelevato<0)continue;
    if(!(raccolta>cassa && cassa>=corrispettivo))continue;
    const e2=Math.abs((cassa-corrispettivo)-prelevato);
    if(e2<=1){
      const vincite=raccolta-cassa;
      if(vincite>=0 && vincite<=raccolta){
        recovered.push({raccolta,vincite,cassa,corrispettivo,prelevato,index:i,recovered:true});
      }
    }
  }
  if(recovered.length)return recovered.at(-1);

  // Se manca la riga del totale prelevato, bastano i primi quattro valori
  // quando Raccolta - Vincite coincide con Cassa.
  const fallback=[];
  for(let i=0;i<=vals.length-4;i++){
    const [raccolta,vincite,cassa,corrispettivo]=vals.slice(i,i+4);
    if(raccolta<=0||vincite<0||cassa<0||corrispettivo<0||corrispettivo>cassa)continue;
    const e=Math.abs((raccolta-vincite)-cassa);
    if(e<=1)fallback.push({raccolta,vincite,cassa,corrispettivo,index:i});
  }
  return fallback.at(-1)||null;
}
function extractAwpFromOcr(text){
  const raw=String(text||'').replace(/\r/g,'');
  const flat=raw.replace(/\n+/g,' ').replace(/\s+/g,' ').trim();
  const lines=raw.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const nlines=lines.map(normalizeOcrText);

  let dal=null,al=null;
  const dateMatches=[...flat.matchAll(/\b(\d{1,2})\D{1,4}(\d{1,2})\D{1,4}(20\d{2})\b/g)];
  const validDates=dateMatches
    .map(m=>ocrIsoDate(m[1],m[2],m[3]))
    .filter(Boolean);
  if(validDates.length>=2){ dal=validDates[0]; al=validDates[1]; }

  const moneyValues=line=>[...String(line||'').matchAll(/-?\d[\d.\s]*[,.]\d{2}\+?/g)]
    .map(m=>parseOcrItalianAmount(m[0])).filter(v=>v!==null);
  const moneyFromNearby=(matcher)=>{
    for(let i=0;i<lines.length;i++){
      if(!matcher(nlines[i]))continue;
      const same=moneyValues(lines[i]);
      if(same.length)return same.at(-1);
      for(let j=1;j<=2;j++){
        const next=lines[i+j]||'',nextLow=nlines[i+j]||'';
        if(/racc|vinc|corr|cassa|prelev/.test(nextLow))break;
        const vals=moneyValues(next);
        if(vals.length)return vals.at(-1);
      }
    }
    return null;
  };

  let raccolta=moneyFromNearby(s=>s.includes('racc')&&(s.includes('period')||s.includes('tot')));
  let vincite=moneyFromNearby(s=>s.includes('vin')&&(s.includes('period')||s.includes('tot')));
  let corrispettivo=moneyFromNearby(s=>s.includes('corr')||s.includes('eserc'));

  const inferred=inferAwpSummaryByMath(raw);
  if(inferred){
    if(raccolta===null)raccolta=inferred.raccolta;
    if(vincite===null)vincite=inferred.vincite;
    if(corrispettivo===null)corrispettivo=inferred.corrispettivo;
  }

  return {dal,al,raccolta,vincite,corrispettivo};
}
function prepareAwpNativeNumbersCrop(bmp,xPct,yPct,wPct,hPct){
  const sx=Math.max(0,Math.round(bmp.width*xPct));
  const sy=Math.max(0,Math.round(bmp.height*yPct));
  const sw=Math.min(bmp.width-sx,Math.round(bmp.width*wPct));
  const sh=Math.min(bmp.height-sy,Math.round(bmp.height*hPct));

  // Il problema principale è il moiré: NON ingrandiamo. Se la zona è grande,
  // la riduciamo leggermente per mediare le righe del monitor.
  const outW=Math.max(220,Math.min(sw,520));
  const scale=outW/Math.max(1,sw);
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(sw*scale);
  canvas.height=Math.round(sh*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.filter='grayscale(1) blur(0.35px) contrast(1.28) brightness(1.04)';
  ctx.drawImage(bmp,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}

function prepareAwpFullImage(bmp,targetWidth=2200,filter='grayscale(1) contrast(1.35) brightness(1.04)'){
  const scale=Math.min(3,Math.max(1,targetWidth/Math.max(1,bmp.width)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(bmp.width*scale);
  canvas.height=Math.round(bmp.height*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.filter=filter;
  ctx.drawImage(bmp,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}
function prepareAwpScreenCrop(bmp,xPct,yPct,wPct,hPct,targetWidth=2200){
  const sx=Math.max(0,Math.round(bmp.width*xPct));
  const sy=Math.max(0,Math.round(bmp.height*yPct));
  const sw=Math.min(bmp.width-sx,Math.round(bmp.width*wPct));
  const sh=Math.min(bmp.height-sy,Math.round(bmp.height*hPct));
  const scale=Math.min(4,Math.max(1.5,targetWidth/Math.max(1,sw)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(sw*scale);
  canvas.height=Math.round(sh*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  // Sul monitor il filtro aggressivo amplifica il moiré: meglio una
  // elaborazione molto leggera e un ritaglio stretto.
  ctx.filter='grayscale(1) contrast(1.18) brightness(1.03)';
  ctx.drawImage(bmp,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}

function prepareAwpNumbersCrop(bmp,xPct,yPct,wPct,hPct,targetWidth=1700){
  const sx=Math.max(0,Math.round(bmp.width*xPct));
  const sy=Math.max(0,Math.round(bmp.height*yPct));
  const sw=Math.min(bmp.width-sx,Math.round(bmp.width*wPct));
  const sh=Math.min(bmp.height-sy,Math.round(bmp.height*hPct));
  const scale=Math.min(4,Math.max(2,targetWidth/Math.max(1,sw)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(sw*scale);
  canvas.height=Math.round(sh*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  // Il leggero blur riduce il moiré del monitor senza perdere i numeri.
  ctx.filter='grayscale(1) blur(0.7px) contrast(1.55) brightness(1.08)';
  ctx.drawImage(bmp,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}

function cropCanvasRow(source,yPct,hPct,targetWidth=1500){
  const sy=Math.max(0,Math.round(source.height*yPct));
  const sh=Math.min(source.height-sy,Math.round(source.height*hPct));
  const scale=Math.min(4,Math.max(1,targetWidth/Math.max(1,source.width)));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(source.width*scale);
  canvas.height=Math.round(sh*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.filter='grayscale(1) blur(0.5px) contrast(1.75) brightness(1.08)';
  ctx.drawImage(source,0,sy,source.width,sh,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}
function parseSingleAwpNumber(text){
  const raw=String(text||'').replace(/\s/g,'');
  const matches=[...raw.matchAll(/\d[\d.,]*\d|\d/g)];
  if(!matches.length)return null;
  // Usa la sequenza numerica più lunga: in ogni ritaglio c'è un solo importo.
  matches.sort((a,b)=>b[0].length-a[0].length);
  return parseOcrItalianAmount(matches[0][0]);
}


function binarizeAwpRow(source){
  const targetWidth=Math.max(900,Math.min(1500,source.width*2.4));
  const scale=targetWidth/Math.max(1,source.width);
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(source.width*scale);
  canvas.height=Math.max(1,Math.round(source.height*scale));
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.drawImage(source,0,0,canvas.width,canvas.height);

  const img=ctx.getImageData(0,0,canvas.width,canvas.height);
  const data=img.data,hist=new Uint32Array(256);
  let borderSum=0,borderCount=0;
  for(let y=0;y<canvas.height;y++){
    for(let x=0;x<canvas.width;x++){
      const i=(y*canvas.width+x)*4;
      const g=Math.round(data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114);
      hist[g]++;
      if(x<3||x>=canvas.width-3||y<3||y>=canvas.height-3){borderSum+=g;borderCount++}
    }
  }
  const total=canvas.width*canvas.height;
  let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];
  let sumB=0,wB=0,maxVar=-1,threshold=128;
  for(let t=0;t<256;t++){
    wB+=hist[t];if(!wB)continue;
    const wF=total-wB;if(!wF)break;
    sumB+=t*hist[t];
    const mB=sumB/wB,mF=(sum-sumB)/wF;
    const between=wB*wF*(mB-mF)*(mB-mF);
    if(between>maxVar){maxVar=between;threshold=t}
  }
  const darkBackground=(borderSum/Math.max(1,borderCount))<128;
  for(let i=0;i<data.length;i+=4){
    const g=Math.round(data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114);
    const isText=darkBackground ? g>threshold : g<threshold;
    const v=isText?0:255;
    data[i]=data[i+1]=data[i+2]=v;data[i+3]=255;
  }
  ctx.putImageData(img,0,0);
  return canvas;
}
function awpNumberCandidates(text){
  const raw=String(text||'').replace(/\s/g,'');
  const tokens=[...raw.matchAll(/\d[\d.,]*\d|\d/g)].map(m=>m[0]);
  const out=[];
  const add=(value,penalty,source)=>{
    if(!Number.isFinite(value)||value<0||value>10000000)return;
    const found=out.find(x=>Math.abs(x.value-value)<0.005);
    if(found){if(penalty<found.penalty){found.penalty=penalty;found.source=source}return}
    out.push({value,penalty,source});
  };
  for(const token of tokens){
    const parsed=parseOcrItalianAmount(token);
    if(parsed!==null)add(parsed,0,token);
    const digits=token.replace(/\D/g,'');
    if(digits.length>=3&&digits.length<=8){
      add(Number(digits.slice(0,-2)+'.'+digits.slice(-2)),0.2,token+'→centesimi');
    }
    // Caso reale osservato: 2.854,00 può diventare 2.854.002.
    // Se compare una cifra OCR in più, generiamo le possibili correzioni e
    // lasciamo che siano le identità contabili a scegliere quella coerente.
    if(digits.length>=7&&digits.length<=9){
      for(let i=0;i<digits.length;i++){
        const d=digits.slice(0,i)+digits.slice(i+1);
        if(d.length<3)continue;
        add(Number(d.slice(0,-2)+'.'+d.slice(-2)),1.0+(i/digits.length)*0.1,token+'→-1 cifra');
      }
    }
  }
  return out.sort((a,b)=>a.penalty-b.penalty).slice(0,10);
}
function mergeAwpCandidates(base,extra){
  const out=[...(base||[])];
  for(const x of extra||[]){
    const found=out.find(y=>Math.abs(y.value-x.value)<0.005);
    if(found){if(x.penalty<found.penalty)Object.assign(found,x)}
    else out.push(x);
  }
  return out.sort((a,b)=>a.penalty-b.penalty).slice(0,10);
}
function solveAwpRowCandidates(rows){
  if(!Array.isArray(rows)||rows.length<5)return null;
  if(rows.every(r=>r&&r.length)){
    let best=null;
    for(const r of rows[0])for(const v of rows[1])for(const c of rows[2])for(const k of rows[3])for(const p of rows[4]){
      if(!(r.value>0&&v.value>=0&&c.value>=0&&k.value>=0&&p.value>=0))continue;
      if(!(r.value>v.value&&c.value>=k.value&&c.value>=p.value))continue;
      const e1=Math.abs((r.value-v.value)-c.value);
      const e2=Math.abs((c.value-k.value)-p.value);
      if(e1>2||e2>2)continue;
      const score=(e1+e2)*50+r.penalty+v.penalty+c.penalty+k.penalty+p.penalty;
      if(!best||score<best.score)best={
        raccolta:r.value,vincite:v.value,cassa:c.value,corrispettivo:k.value,prelevato:p.value,
        score,mode:'5 righe validate'
      };
    }
    if(best)return best;
  }

  // Fallback robusto: Raccolta, Cassa e Totale prelevato sono sufficienti
  // a ricostruire Vincite e Corrispettivo con le identità stampate a video.
  if(rows[0]?.length&&rows[2]?.length&&rows[4]?.length){
    let best=null;
    for(const r of rows[0])for(const c of rows[2])for(const p of rows[4]){
      if(!(r.value>c.value&&c.value>=p.value))continue;
      const vincite=r.value-c.value,corrispettivo=c.value-p.value;
      if(vincite<0||corrispettivo<0)continue;
      const nearV=rows[1]?.length?Math.min(...rows[1].map(x=>Math.abs(x.value-vincite))):0;
      const nearK=rows[3]?.length?Math.min(...rows[3].map(x=>Math.abs(x.value-corrispettivo))):0;
      const score=r.penalty+c.penalty+p.penalty+Math.min(nearV,20)*0.05+Math.min(nearK,20)*0.05+3;
      if(!best||score<best.score)best={
        raccolta:r.value,vincite,cassa:c.value,corrispettivo,prelevato:p.value,
        score,mode:'ricostruzione da Raccolta/Cassa/Prelevato'
      };
    }
    if(best)return best;
  }
  return null;
}


function solveAwpLooseCandidates(rows){
  const pool=[];
  (rows||[]).forEach((list,row)=>{
    for(const x of list||[]){
      if(!x||!Number.isFinite(x.value))continue;
      pool.push({value:x.value,penalty:Number(x.penalty)||0,row});
    }
  });
  if(pool.length<3)return null;

  const posPenalty=(x,expected)=>Math.abs((x?.row??expected)-expected)*0.35;

  // Per ogni possibile Cassa cerchiamo separatamente:
  // Raccolta - Vincite = Cassa
  // Cassa - Corrispettivo = Totale prelevato.
  let best=null;
  for(const cassa of pool){
    if(cassa.value<0)continue;

    let bestTop=null;
    for(const raccolta of pool){
      if(raccolta===cassa||raccolta.value<=cassa.value)continue;
      for(const vincite of pool){
        if(vincite===cassa||vincite===raccolta||vincite.value<0||raccolta.value<=vincite.value)continue;
        const err=Math.abs((raccolta.value-vincite.value)-cassa.value);
        if(err>2)continue;
        const score=err*50+raccolta.penalty+vincite.penalty+cassa.penalty+
          posPenalty(raccolta,0)+posPenalty(vincite,1)+posPenalty(cassa,2);
        if(!bestTop||score<bestTop.score)bestTop={raccolta,vincite,score};
      }
    }
    if(!bestTop)continue;

    let bestBottom=null;
    for(const corrispettivo of pool){
      if(corrispettivo===cassa||corrispettivo.value<0||corrispettivo.value>cassa.value)continue;
      for(const prelevato of pool){
        if(prelevato===cassa||prelevato===corrispettivo||prelevato.value<0||prelevato.value>cassa.value)continue;
        const err=Math.abs((cassa.value-corrispettivo.value)-prelevato.value);
        if(err>2)continue;
        const score=err*50+corrispettivo.penalty+prelevato.penalty+
          posPenalty(corrispettivo,3)+posPenalty(prelevato,4);
        if(!bestBottom||score<bestBottom.score)bestBottom={corrispettivo,prelevato,score};
      }
    }
    if(!bestBottom)continue;

    const score=bestTop.score+bestBottom.score;
    if(!best||score<best.score){
      best={
        raccolta:bestTop.raccolta.value,
        vincite:bestTop.vincite.value,
        cassa:cassa.value,
        corrispettivo:bestBottom.corrispettivo.value,
        prelevato:bestBottom.prelevato.value,
        score,
        mode:'solver globale'
      };
    }
  }
  if(best)return best;

  // Fallback: se Tesseract ha perso uno dei due valori derivabili, usiamo
  // Raccolta/Cassa/Prelevato e scegliamo la combinazione che trova maggiore
  // riscontro negli altri numeri OCR.
  for(const raccolta of pool){
    for(const cassa of pool){
      if(raccolta===cassa||raccolta.value<=cassa.value)continue;
      for(const prelevato of pool){
        if(prelevato===raccolta||prelevato===cassa||prelevato.value<0||prelevato.value>cassa.value)continue;
        const vincite=raccolta.value-cassa.value;
        const corrispettivo=cassa.value-prelevato.value;
        if(vincite<0||corrispettivo<0)continue;
        const nearV=Math.min(...pool.map(x=>Math.abs(x.value-vincite)));
        const nearK=Math.min(...pool.map(x=>Math.abs(x.value-corrispettivo)));
        if(nearV>2&&nearK>2)continue;
        const score=raccolta.penalty+cassa.penalty+prelevato.penalty+
          Math.min(nearV,20)*10+Math.min(nearK,20)*10+
          posPenalty(raccolta,0)+posPenalty(cassa,2)+posPenalty(prelevato,4)+5;
        if(!best||score<best.score){
          best={
            raccolta:raccolta.value,
            vincite,
            cassa:cassa.value,
            corrispettivo,
            prelevato:prelevato.value,
            score,
            mode:'solver globale con ricostruzione'
          };
        }
      }
    }
  }
  return best;
}

function valuesFromOcrLine(text){
  const raw=String(text||'').trim();
  if(!raw)return [];
  const tokens=[...raw.matchAll(/\d[\d.,]*\d|\d/g)].map(m=>m[0]);
  const vals=[];
  for(const token of tokens){
    const n=parseOcrItalianAmount(token);
    if(n!==null && Number.isFinite(n))vals.push(n);
  }
  return vals;
}
function findAwpTotalsSequence(candidates){
  const vals=candidates.map(x=>x.value);
  // Cerca 5 valori in ordine, anche con qualche lettura estranea fra loro.
  for(let a=0;a<vals.length;a++){
    for(let b=a+1;b<Math.min(vals.length,a+5);b++){
      for(let cc=b+1;cc<Math.min(vals.length,b+5);cc++){
        for(let d=cc+1;d<Math.min(vals.length,cc+5);d++){
          for(let e=d+1;e<Math.min(vals.length,d+5);e++){
            const raccolta=vals[a],vincite=vals[b],cassa=vals[cc],corrispettivo=vals[d],prelevato=vals[e];
            if(!(raccolta>0&&vincite>=0&&cassa>=0&&corrispettivo>=0&&prelevato>=0))continue;
            if(!(raccolta>vincite&&cassa>=corrispettivo))continue;
            const err1=Math.abs((raccolta-vincite)-cassa);
            const err2=Math.abs((cassa-corrispettivo)-prelevato);
            if(err1<=2 && err2<=2){
              return {raccolta,vincite,cassa,corrispettivo,prelevato,idx:[a,b,cc,d,e]};
            }
          }
        }
      }
    }
  }
  // Fallback a 4 valori: se manca Totale prelevato ma i primi 4 sono coerenti.
  for(let a=0;a<vals.length;a++){
    for(let b=a+1;b<Math.min(vals.length,a+5);b++){
      for(let cc=b+1;cc<Math.min(vals.length,b+5);cc++){
        for(let d=cc+1;d<Math.min(vals.length,cc+5);d++){
          const raccolta=vals[a],vincite=vals[b],cassa=vals[cc],corrispettivo=vals[d];
          if(!(raccolta>0&&vincite>=0&&cassa>=0&&corrispettivo>=0))continue;
          if(!(raccolta>vincite&&cassa>=corrispettivo))continue;
          if(Math.abs((raccolta-vincite)-cassa)<=2){
            return {raccolta,vincite,cassa,corrispettivo,prelevato:cassa-corrispettivo,idx:[a,b,cc,d]};
          }
        }
      }
    }
  }
  return null;
}

async function recognizeAwpCanvas(canvas,{psm='11',whitelist=''},status,label){
  let worker=null;
  try{
    worker=await Tesseract.createWorker('eng',1,{
      logger:m=>{
        if(!status)return;
        if(m.status==='recognizing text') status.textContent=`${label}... ${Math.round((m.progress||0)*100)}%`;
      }
    });
    const params={tessedit_pageseg_mode:psm};
    if(whitelist)params.tessedit_char_whitelist=whitelist;
    await worker.setParameters(params);
    const result=await worker.recognize(canvas);
    return result?.data?.text||'';
  }finally{
    try{if(worker)await worker.terminate()}catch{}
  }
}
function clearAwpOcrDiagnostic(kind){
  const host=$('#awpDiag'+kind);
  if(host)host.innerHTML='';
  const box=$('#awpOcrDebug');
  if(box)box.open=true;
}
function addAwpOcrDiagnostic(kind,title,canvas,text){
  const host=$('#awpDiag'+kind);
  if(!host)return;
  const wrap=document.createElement('div');
  wrap.className='awp-diag-attempt';
  const h=document.createElement('strong');
  h.textContent=title;
  const img=document.createElement('img');
  try{img.src=canvas.toDataURL('image/jpeg',0.82)}catch{}
  img.alt=title;
  const pre=document.createElement('pre');
  pre.textContent=String(text||'').trim()||'(nessun testo riconosciuto)';
  wrap.append(h,img,pre);
  host.appendChild(wrap);
  const box=$('#awpOcrDebug');
  if(box)box.open=true;
}

function extractDatesFromScreenOcr(text){
  const flat=String(text||'').replace(/\n+/g,' ').replace(/\s+/g,' ');
  const dates=[];
  const strict=[...flat.matchAll(/\b(\d{1,2})\s*[-\/.]\s*(\d{1,2})\s*[-\/.]\s*(20\d{2})\b/g)];
  for(const m of strict){
    const d=ocrIsoDate(m[1],m[2],m[3]);
    if(d&&!dates.includes(d))dates.push(d);
  }
  if(dates.length<2){
    const loose=[...flat.matchAll(/\b(\d{1,2})\D{1,3}(\d{1,2})\D{1,3}(20\d{2})\b/g)];
    for(const m of loose){
      const d=ocrIsoDate(m[1],m[2],m[3]);
      if(d&&!dates.includes(d))dates.push(d);
    }
  }
  return dates;
}
async function readAwpPeriodPhoto(file){
  if(!file)return;
  const status=$('#awpOcrStatus');
  try{
    if(typeof Tesseract==='undefined')throw new Error('Modulo OCR non disponibile. Ricarica la pagina con connessione Internet.');
    $('#awpPeriodPhotoBtn').disabled=true;
    if(status)status.textContent='Lettura schermata periodo...';
    clearAwpOcrDiagnostic('Period');

    const bmp=await createImageBitmap(file);

    // Dalla diagnostica reale la riga del periodo è più in basso:
    // qui leggiamo quasi soltanto "dal ... al ...", evitando intestazione e indirizzo.
    const tight=prepareAwpScreenCrop(bmp,0.16,0.42,0.68,0.13,2600);
    const tightText=await recognizeAwpCanvas(tight,{
      psm:'6',
      whitelist:'0123456789-/. '
    },status,'Lettura periodo');
    addAwpOcrDiagnostic('Period','Periodo · zona stretta',tight,tightText);

    let dates=extractDatesFromScreenOcr(tightText);

    // Fallback leggermente più ampio se la foto è inquadrata un po' diversa.
    if(dates.length<2){
      const wider=prepareAwpScreenCrop(bmp,0.10,0.36,0.80,0.22,2600);
      const widerText=await recognizeAwpCanvas(wider,{
        psm:'11',
        whitelist:'0123456789-/. '
      },status,'Secondo tentativo periodo');
      addAwpOcrDiagnostic('Period','Periodo · zona ampia',wider,widerText);
      dates=extractDatesFromScreenOcr(tightText+'\n'+widerText);
    }

    try{bmp.close()}catch{}

    if(dates.length>=2){
      $('#awpDal').value=dates[0];
      $('#awpAl').value=dates[1];
      if(status)status.textContent=`Periodo letto ✓ ${dmy(dates[0])} → ${dmy(dates[1])}. Ora acquisisci la foto dei dati AWP.`;
    }else{
      if(status)status.textContent='Non ho riconosciuto il periodo. Apri Diagnostica OCR: ora deve mostrare soltanto la zona della data.';
    }
  }catch(e){
    console.error(e);
    if(status)status.textContent='Errore lettura periodo: '+e.message;
  }finally{
    $('#awpPeriodPhotoBtn').disabled=false;
    const input=$('#awpPeriodPhotoInput');if(input)input.value='';
  }
}


function detectAwpSummaryBands(bmp){
  const canvas=document.createElement('canvas');
  canvas.width=bmp.width; canvas.height=bmp.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bmp,0,0);

  const x0=Math.round(bmp.width*0.55), x1=Math.round(bmp.width*0.78);
  const y0=Math.round(bmp.height*0.35), y1=Math.round(bmp.height*0.64);
  const w=Math.max(1,x1-x0), h=Math.max(1,y1-y0);
  const data=ctx.getImageData(x0,y0,w,h).data;
  const scores=new Array(h).fill(0);

  for(let y=0;y<h;y++){
    let dark=0;
    const base=y*w*4;
    for(let x=0;x<w;x++){
      const i=base+x*4;
      const g=data[i]*0.299+data[i+1]*0.587+data[i+2]*0.114;
      if(g<110)dark++;
    }
    scores[y]=dark/w;
  }

  const smooth=scores.map((_,i)=>{
    let s=0,n=0;
    for(let k=-1;k<=1;k++){
      const j=i+k;
      if(j>=0&&j<scores.length){s+=scores[j];n++}
    }
    return s/Math.max(1,n);
  });

  // La riga nera sotto "Totale prelevato" è il riferimento geometrico più
  // stabile del borderò. Cerchiamo quella, poi prendiamo le 5 righe subito sopra.
  let rule=-1;
  const ruleStart=Math.max(0,Math.round(bmp.height*0.52)-y0);
  for(let i=ruleStart;i<smooth.length-1;i++){
    if(smooth[i]>0.45 && smooth[i+1]>0.45){rule=i;break}
  }
  if(rule<0){
    let best=-1,bestScore=0;
    for(let i=ruleStart;i<smooth.length;i++){
      if(smooth[i]>bestScore){bestScore=smooth[i];best=i}
    }
    if(bestScore>0.30)rule=best;
  }
  if(rule<0)return [];

  const absRule=y0+rule;
  const from=Math.max(y0,absRule-Math.round(bmp.height*0.14));
  const to=Math.max(from+1,absRule-Math.round(bmp.height*0.003));
  const threshold=0.045;
  const minH=Math.max(3,Math.round(bmp.height*0.0025));
  const bands=[];
  let inside=false,s=0;

  for(let ay=from;ay<to;ay++){
    const v=smooth[ay-y0]||0;
    if(v>threshold){
      if(!inside){s=ay;inside=true}
    }else if(inside){
      const e=ay;
      if(e-s>=minH)bands.push({start:s,end:e,peak:Math.max(...smooth.slice(s-y0,e-y0))});
      inside=false;
    }
  }
  if(inside){
    const e=to;
    if(e-s>=minH)bands.push({start:s,end:e,peak:Math.max(...smooth.slice(s-y0,e-y0))});
  }

  return bands.slice(-5);
}
function prepareAwpDetectedBand(bmp,band){
  const cy=(band.start+band.end)/2;
  const pad=Math.max(10,Math.round(bmp.height*0.0105));
  const y0=Math.max(0,cy-pad), y1=Math.min(bmp.height,cy+pad);
  return prepareAwpNativeNumbersCrop(
    bmp,
    0.57,
    y0/bmp.height,
    0.24,
    Math.max(1,y1-y0)/bmp.height
  );
}


function extractAwpPrintData(text){
  const raw=String(text||'').replace(/\r/g,'');
  const lines=raw.split('\n').map(x=>x.replace(/\s+/g,' ').trim()).filter(Boolean);
  const norm=lines.map(normalizeOcrText);

  const dates=extractDatesFromScreenOcr(raw);

  const amountsFromLine=(line)=>{
    const hits=[...String(line||'').matchAll(/-?\d[\d.\s]*[,.]\d{1,2}\+?/g)];
    return hits.map(m=>parseOcrItalianAmount(m[0])).filter(v=>v!==null&&Number.isFinite(v));
  };
  const amountNear=(matcher)=>{
    for(let i=0;i<lines.length;i++){
      if(!matcher(norm[i]))continue;
      const same=amountsFromLine(lines[i]);
      if(same.length)return same.at(-1);
      for(let j=1;j<=2;j++){
        const next=lines[i+j]||'';
        const vals=amountsFromLine(next);
        if(vals.length)return vals.at(-1);
      }
    }
    return null;
  };

  const raccolta=amountNear(s=>s.includes('racc')&&s.includes('total')&&s.includes('period'));
  const vincite=amountNear(s=>(s.includes('vinc')||s.includes('vincit'))&&s.includes('total')&&s.includes('period'));
  const cassa=amountNear(s=>s.includes('cassa'));
  const corrispettivo=amountNear(s=>s.includes('corr')&&s.includes('eserc'));
  const prelevato=amountNear(s=>s.includes('prelev'));

  return {
    dal:dates[0]||null,
    al:dates[1]||null,
    raccolta,vincite,cassa,corrispettivo,prelevato
  };
}
function mergeAwpPrintData(a,b){
  const out={};
  for(const k of ['dal','al','raccolta','vincite','cassa','corrispettivo','prelevato']){
    out[k]=(a&&a[k]!==null&&a[k]!==undefined)?a[k]:(b?b[k]:null);
  }
  return out;
}
function validateAwpPrintData(x){
  if(!x)return false;
  const {raccolta,vincite,cassa,corrispettivo,prelevato}=x;
  if(!Number.isFinite(raccolta)||!Number.isFinite(vincite)||!Number.isFinite(corrispettivo))return false;
  if(!(raccolta>0&&vincite>=0&&vincite<=raccolta&&corrispettivo>=0))return false;
  const calcCassa=raccolta-vincite;
  if(Number.isFinite(cassa)&&Math.abs(calcCassa-cassa)>2)return false;
  const useCassa=Number.isFinite(cassa)?cassa:calcCassa;
  if(corrispettivo>useCassa+2)return false;
  if(Number.isFinite(prelevato)&&Math.abs((useCassa-corrispettivo)-prelevato)>2)return false;
  return true;
}


function extractAwpNumericSummary(text){
  const candidates=[];
  const lines=String(text||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
  for(let i=0;i<lines.length;i++){
    for(const value of valuesFromOcrLine(lines[i])){
      candidates.push({value,scan:i,raw:lines[i]});
    }
  }
  return findAwpTotalsSequence(candidates) || inferAwpSummaryByMath(text);
}


function extractAwpByEquation(text){
  const vals=[];
  for(const line of String(text||'').split(/\n+/)){
    const tokens=[...line.matchAll(/\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,3})\+?|\d+(?:[.,]\d{1,3})\+?/g)];
    for(const m of tokens){
      const n=parseOcrItalianAmount(m[0]);
      if(n!==null&&Number.isFinite(n)&&n>=0&&n<100000) vals.push(n);
    }
  }
  if(vals.length<4)return null;

  // Cerca dal fondo una terna Giocato/Pagato/Cassa che rispetta
  // Giocato - Pagato = Cassa. Ammette al massimo una lettura estranea
  // tra una riga e l'altra per tollerare OCR imperfetto.
  const start=Math.max(0,vals.length-35);
  for(let k=vals.length-1;k>=start;k--){
    const cassa=vals[k];
    if(cassa<=0)continue;
    for(let j=k-1;j>=Math.max(start,k-3);j--){
      const vincite=vals[j];
      for(let i=j-1;i>=Math.max(start,j-3);i--){
        const raccolta=vals[i];
        if(!(raccolta>vincite&&vincite>=0))continue;
        if(Math.abs((raccolta-vincite)-cassa)>2)continue;

        // Corrispettivo: il primo importo successivo alla Cassa,
        // positivo e inferiore alla Cassa.
        for(let q=k+1;q<=Math.min(vals.length-1,k+4);q++){
          const corrispettivo=vals[q];
          if(corrispettivo>=0&&corrispettivo<cassa){
            return {raccolta,vincite,cassa,corrispettivo};
          }
        }
      }
    }
  }
  return null;
}

function extractAwpFourTotals(text){
  const vals=[];
  for(const line of String(text||'').split(/\n+/)){
    const tokens=[...line.matchAll(/\d{1,3}(?:[.]\d{3})*(?:[.,]\d{1,3})\+?|\d+(?:[.,]\d{1,3})\+?/g)];
    for(const m of tokens){
      const n=parseOcrItalianAmount(m[0]);
      if(n!==null&&Number.isFinite(n)&&n>=0&&n<100000)vals.push(n);
    }
  }
  if(vals.length<4)return null;

  // Cerchiamo soltanto le quattro voci utili:
  // Giocato, Pagato, Cassa, Corrispettivo.
  // Il Totale prelevato non serve più e non può più falsare il corrispettivo.
  for(let i=vals.length-4;i>=0;i--){
    const [raccolta,vincite,cassa,corrispettivo]=vals.slice(i,i+4);
    if(!(raccolta>0&&vincite>=0&&cassa>=0&&corrispettivo>=0))continue;
    if(vincite>raccolta||corrispettivo>cassa)continue;
    if(Math.abs((raccolta-vincite)-cassa)>2)continue;
    return {raccolta,vincite,cassa,corrispettivo};
  }
  return null;
}

function extractLastAwpFiveTotals(text){
  const vals=[];
  for(const line of String(text||'').split(/\n+/)){
    const tokens=[...line.matchAll(/\d{1,3}(?:[.]\d{3})*(?:,\d{1,2})\+?|\d+(?:,\d{1,2})\+?/g)];
    for(const m of tokens){
      const n=parseOcrItalianAmount(m[0]);
      if(n!==null&&Number.isFinite(n)&&n>=0&&n<100000)vals.push(n);
    }
  }
  if(vals.length<5)return null;

  // I cinque importi riepilogativi sono gli ultimi cinque valori monetari
  // della colonna destra: Giocato, Pagato, Cassa, Corrispettivo, Prelevato.
  for(let i=vals.length-5;i>=0;i--){
    const [raccolta,vincite,cassa,corrispettivo,prelevato]=vals.slice(i,i+5);
    if(!(raccolta>0&&vincite>=0&&cassa>=0&&corrispettivo>=0&&prelevato>=0))continue;
    if(Math.abs((raccolta-vincite)-cassa)>2)continue;
    if(Math.abs((cassa-corrispettivo)-prelevato)>2)continue;
    return {raccolta,vincite,cassa,corrispettivo,prelevato};
  }
  return null;
}


function locatePrintedAwpTotals(bmp){
  const canvas=document.createElement('canvas');
  canvas.width=bmp.width; canvas.height=bmp.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(bmp,0,0);
  const {width:W,height:H}=canvas;

  // Cerca la riga orizzontale nera sotto "Totale prelevato".
  const sx0=Math.round(W*0.12),sx1=Math.round(W*0.84);
  const sy0=Math.round(H*0.55),sy1=Math.round(H*0.97);
  const img=ctx.getImageData(sx0,sy0,sx1-sx0,sy1-sy0);
  const rowScores=[];
  for(let y=0;y<img.height;y++){
    let dark=0;
    for(let x=0;x<img.width;x++){
      const i=(y*img.width+x)*4;
      const g=img.data[i]*0.299+img.data[i+1]*0.587+img.data[i+2]*0.114;
      if(g<105)dark++;
    }
    rowScores.push(dark/img.width);
  }
  let best=-1,bestScore=0;
  for(let i=0;i<rowScores.length;i++){
    if(rowScores[i]>bestScore){bestScore=rowScores[i];best=i}
  }
  if(best<0||bestScore<0.18)return null;
  const ruleY=sy0+best;

  // Trova l'estensione orizzontale della riga, così la colonna importi viene
  // calcolata rispetto alla stampa e non rispetto alla foto.
  const bandTop=Math.max(0,ruleY-2),bandH=Math.min(H-bandTop,5);
  const ruleData=ctx.getImageData(0,bandTop,W,bandH).data;
  const colDark=new Array(W).fill(0);
  for(let x=0;x<W;x++){
    let n=0;
    for(let y=0;y<bandH;y++){
      const i=(y*W+x)*4;
      const g=ruleData[i]*0.299+ruleData[i+1]*0.587+ruleData[i+2]*0.114;
      if(g<125)n++;
    }
    colDark[x]=n;
  }
  const active=[];
  for(let x=Math.round(W*0.08);x<Math.round(W*0.90);x++){
    if(colDark[x]>=Math.max(2,Math.floor(bandH*0.4)))active.push(x);
  }
  if(active.length<30)return null;
  const lineLeft=active[0],lineRight=active.at(-1),lineWidth=lineRight-lineLeft;
  if(lineWidth<W*0.20)return null;

  // Ultimo quarto della riga = colonna degli importi.
  const x0=Math.max(0,Math.round(lineRight-lineWidth*0.27));
  const x1=Math.min(W,Math.round(lineRight+lineWidth*0.025));

  // Analizza le righe di testo sopra la linea per stimarne l'interlinea reale.
  const scanTop=Math.max(0,ruleY-Math.round(H*0.25));
  const scanBottom=Math.max(scanTop+1,ruleY-Math.round(H*0.012));
  const col=ctx.getImageData(x0,scanTop,Math.max(1,x1-x0),scanBottom-scanTop);
  const density=[];
  for(let y=0;y<col.height;y++){
    let dark=0;
    for(let x=0;x<col.width;x++){
      const i=(y*col.width+x)*4;
      const g=col.data[i]*0.299+col.data[i+1]*0.587+col.data[i+2]*0.114;
      if(g<120)dark++;
    }
    density.push(dark/col.width);
  }
  const smooth=density.map((_,i)=>{
    let s=0,n=0;
    for(let k=-1;k<=1;k++){
      const j=i+k;
      if(j>=0&&j<density.length){s+=density[j];n++}
    }
    return s/Math.max(1,n);
  });

  const threshold=0.025;
  const bands=[];
  let start=null;
  for(let i=0;i<smooth.length;i++){
    if(smooth[i]>threshold && start===null)start=i;
    if((smooth[i]<=threshold||i===smooth.length-1) && start!==null){
      const end=i===smooth.length-1?i+1:i;
      const h=end-start;
      if(h>=Math.max(2,H*0.0015) && h<=H*0.020){
        bands.push({start:scanTop+start,end:scanTop+end,center:scanTop+(start+end)/2});
      }
      start=null;
    }
  }

  const centers=bands.map(b=>b.center).sort((a,b)=>a-b);
  const diffs=[];
  for(let i=1;i<centers.length;i++){
    const d=centers[i]-centers[i-1];
    if(d>=H*0.009 && d<=H*0.035)diffs.push(d);
  }
  if(!diffs.length)return null;
  diffs.sort((a,b)=>a-b);
  let spacing=diffs[Math.floor(diffs.length/2)];
  spacing*=0.97;

  // Il centro di "Totale prelevato" è circa mezza interlinea sopra la riga.
  let bottomCenter=ruleY-spacing*0.55;
  const rowCenters=[];
  for(let i=4;i>=0;i--)rowCenters.push(bottomCenter-spacing*i);

  // Se abbiamo rilevato una banda vicina alla posizione prevista, usiamo il
  // suo centro reale per compensare prospettiva e inclinazione.
  for(let i=0;i<rowCenters.length;i++){
    let nearest=null,dist=Infinity;
    for(const center of centers){
      const d=Math.abs(center-rowCenters[i]);
      if(d<dist){dist=d;nearest=center}
    }
    if(nearest!==null && dist<spacing*0.42)rowCenters[i]=nearest;
  }

  const rowHeight=Math.max(12,spacing*0.82);
  return {x0,x1,ruleY,spacing,rows:rowCenters.map(center=>({
    x0,x1,
    y0:Math.max(0,center-rowHeight/2),
    y1:Math.min(H,center+rowHeight/2)
  }))};
}
function cropPrintedAwpRow(bmp,row,targetWidth=1200){
  const sx=Math.round(row.x0),sy=Math.round(row.y0);
  const sw=Math.max(1,Math.round(row.x1-row.x0));
  const sh=Math.max(1,Math.round(row.y1-row.y0));
  const scale=Math.min(5,Math.max(2,targetWidth/sw));
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(sw*scale);
  canvas.height=Math.round(sh*scale);
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.imageSmoothingEnabled=true;
  ctx.imageSmoothingQuality='high';
  ctx.filter='grayscale(1) contrast(1.65) brightness(1.08)';
  ctx.drawImage(bmp,sx,sy,sw,sh,0,0,canvas.width,canvas.height);
  ctx.filter='none';
  return canvas;
}

async function readAwpDataPhoto(file){
  if(!file)return;
  const status=$('#awpOcrStatus');
  let worker=null,bmp=null;
  try{
    if(typeof Tesseract==='undefined')throw new Error('Modulo OCR non disponibile. Ricarica la pagina con connessione Internet.');
    $('#awpDataPhotoBtn').disabled=true;
    if(status)status.textContent='Lettura stampa AWP...';
    clearAwpOcrDiagnostic('Data');

    bmp=await createImageBitmap(file);

    worker=await Tesseract.createWorker('eng',1,{
      logger:m=>{
        if(!status)return;
        if(m.status==='recognizing text')status.textContent=`Lettura stampa AWP... ${Math.round((m.progress||0)*100)}%`;
      }
    });

    // ===== PERIODO =====
    // Primo tentativo molto mirato sulla riga "dal ... al ...".
    const dateCrops=[
      prepareAwpScreenCrop(bmp,0.12,0.09,0.76,0.12,2200),
      prepareAwpScreenCrop(bmp,0.06,0.00,0.88,0.24,2200),
      prepareAwpScreenCrop(bmp,0.03,0.00,0.94,0.31,2200)
    ];

    let dates=[],dateText='';
    for(let ci=0;ci<dateCrops.length && dates.length<2;ci++){
      await worker.setParameters({
        tessedit_pageseg_mode:ci===0?'7':'6',
        tessedit_char_whitelist:'0123456789-/. '
      });
      let result=await worker.recognize(dateCrops[ci]);
      const t=result?.data?.text||'';
      dateText+='\n'+t;
      dates=extractDatesFromScreenOcr(dateText);

      if(dates.length<2 && ci===dateCrops.length-1){
        await worker.setParameters({
          tessedit_pageseg_mode:'11',
          tessedit_char_whitelist:''
        });
        result=await worker.recognize(dateCrops[ci]);
        dateText+='\n'+(result?.data?.text||'');
        dates=extractDatesFromScreenOcr(dateText);
      }
    }

    if(dates[0])$('#awpDal').value=dates[0];
    if(dates[1])$('#awpAl').value=dates[1];

    // ===== QUATTRO VALORI AWP =====
    // Più ritagli sovrapposti: funziona sia con foto ravvicinata sia con
    // borderò intero e leggermente inclinato.
    const totalCrops=[
      prepareAwpScreenCrop(bmp,0.48,0.68,0.40,0.23,1900),
      prepareAwpScreenCrop(bmp,0.55,0.55,0.36,0.40,1900),
      prepareAwpScreenCrop(bmp,0.42,0.60,0.48,0.36,1900)
    ];

    let totals=null;
    for(let ci=0;ci<totalCrops.length && !totals;ci++){
      let texts=[];
      await worker.setParameters({
        tessedit_pageseg_mode:'6',
        tessedit_char_whitelist:'0123456789.,+ '
      });
      let result=await worker.recognize(totalCrops[ci]);
      texts.push(result?.data?.text||'');

      await worker.setParameters({
        tessedit_pageseg_mode:'11',
        tessedit_char_whitelist:'0123456789.,+ '
      });
      result=await worker.recognize(totalCrops[ci]);
      texts.push(result?.data?.text||'');

      for(const txt of texts){
        totals=extractAwpFourTotals(txt)||extractAwpByEquation(txt);
        if(totals)break;
      }
    }

    // Ultimo fallback: OCR dell'intera stampa. È più lento, ma evita che una
    // fotografia con inquadratura diversa renda inutilizzabili i ritagli.
    if(!totals || dates.length<2){
      const full=prepareAwpScreenCrop(bmp,0.02,0.00,0.96,0.98,1800);
      await worker.setParameters({
        tessedit_pageseg_mode:'6',
        tessedit_char_whitelist:''
      });
      const result=await worker.recognize(full);
      const fullText=result?.data?.text||'';
      if(dates.length<2)dates=extractDatesFromScreenOcr(dateText+'\n'+fullText);
      if(!totals)totals=extractAwpFourTotals(fullText)||extractAwpByEquation(fullText);
      if(dates[0])$('#awpDal').value=dates[0];
      if(dates[1])$('#awpAl').value=dates[1];
    }

    if(!totals){
      if(status)status.textContent=dates.length>=2
        ? `Periodo letto ✓ ${dmy(dates[0])} → ${dmy(dates[1])}, ma i totali AWP non sono stati riconosciuti.`
        : 'Non sono riuscito a riconoscere i totali AWP dalla stampa.';
      return;
    }

    setVal('awpRaccolta',totals.raccolta);
    setVal('awpVincite',totals.vincite);
    setVal('awpCassa',totals.cassa);
    setVal('awpCorrispettivo',totals.corrispettivo);

    for(const id of ['awpDal','awpAl','awpRaccolta','awpVincite','awpCassa','awpCorrispettivo']){
      const el=$('#'+id);
      if(el){
        el.dispatchEvent(new Event('input',{bubbles:true}));
        el.dispatchEvent(new Event('change',{bubbles:true}));
      }
    }

    const period=(dates.length>=2)?` · ${dmy(dates[0])} → ${dmy(dates[1])}`:'';
    if(status)status.textContent=
      `Stampa AWP letta ✓ Giocato ${eur(totals.raccolta)} · Pagato ${eur(totals.vincite)} · Cassa ${eur(totals.cassa)} · Corrispettivo esercente ${eur(totals.corrispettivo)}${period}. Controlla e premi Salva.`;
  }catch(e){
    console.error(e);
    if(status)status.textContent='Errore lettura stampa AWP: '+e.message;
  }finally{
    try{if(worker)await worker.terminate()}catch{}
    try{if(bmp)bmp.close()}catch{}
    $('#awpDataPhotoBtn').disabled=false;
    const input=$('#awpDataPhotoInput');if(input)input.value='';
  }
}
function chooseAwpPeriodPhoto(){
  const input=$('#awpPeriodPhotoInput');if(input)input.click();
}
function chooseAwpDataPhoto(){
  const input=$('#awpDataPhotoInput');if(input)input.click();
}


function awpWeeklyFormItem(){
  const dal=$('#awpDal')?.value||'', al=$('#awpAl')?.value||'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(dal)||!/^\d{4}-\d{2}-\d{2}$/.test(al)) throw new Error('Inserisci il periodo AWP completo.');
  if(dal>al) throw new Error('La data iniziale AWP non può essere successiva alla data finale.');
  const rawR=$('#awpRaccolta')?.value?.trim()||'',rawV=$('#awpVincite')?.value?.trim()||'',rawCa=$('#awpCassa')?.value?.trim()||'',rawC=$('#awpCorrispettivo')?.value?.trim()||'';
  if(!rawR||!rawV||!rawCa||!rawC) throw new Error('Compila AWP giocato, AWP pagato, Cassa e Corrispettivo esercente.');
  const raccolta=num(rawR),vincite=num(rawV),cassa=num(rawCa),corrispettivo=num(rawC);
  const cassaCalcolata=raccolta-vincite;
  if(Math.abs(cassa-cassaCalcolata)>0.02)throw new Error('La Cassa deve corrispondere a Giocato − Pagato.');
  return {dal,al,raccolta,vincite,cassa,corrispettivo,aggiornato:new Date().toISOString()};
}
function fillAwpWeeklyForm(x){
  if(!x)return;
  $('#awpDal').value=x.dal||''; $('#awpAl').value=x.al||'';
  setVal('awpRaccolta',x.raccolta); setVal('awpVincite',x.vincite); setVal('awpCassa',Number.isFinite(Number(x.cassa))?x.cassa:(Number(x.raccolta||0)-Number(x.vincite||0))); setVal('awpCorrispettivo',x.corrispettivo);
}
async function saveAwpWeekly(){
  if(!isMaster())return;
  try{
    const item=awpWeeklyFormItem();
    $('#saveAwpWeeklyBtn').disabled=true; $('#awpWeeklyStatus').textContent='Salvataggio AWP su GitHub...';
    const {remoteDb,sha,api,headers}=await fetchLatestGithubDb();
    remoteDb.awpSettimanale=Array.isArray(remoteDb.awpSettimanale)?remoteDb.awpSettimanale:[];
    const idx=remoteDb.awpSettimanale.findIndex(x=>x.dal===item.dal&&x.al===item.al);
    if(idx>=0&&!confirm(`Il periodo AWP ${dmy(item.dal)} → ${dmy(item.al)} esiste già. Vuoi sovrascriverlo?`)){
      $('#awpWeeklyStatus').textContent='Salvataggio annullato.';return;
    }
    if(idx>=0) remoteDb.awpSettimanale[idx]={...remoteDb.awpSettimanale[idx],...item};
    else remoteDb.awpSettimanale.push(item);
    remoteDb.awpSettimanale.sort((a,b)=>a.dal.localeCompare(b.dal));
    const content=btoa(unescape(encodeURIComponent(JSON.stringify(remoteDb,null,2))));
    const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
      message:`Dashboard: AWP settimanale ${item.dal} - ${item.al}`,content,sha
    })});
    if(!put.ok){let msg='';try{msg=(await put.json()).message||''}catch{};throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`)}
    db=remoteDb; currentMonth=item.dal.slice(0,7); $('#historyMonth').value=currentMonth;
    $('#awpWeeklyStatus').textContent='AWP settimanale salvata ✓';
    renderDashboard(); if($('#historyView').classList.contains('active'))renderHistory();
  }catch(e){console.error(e);$('#awpWeeklyStatus').textContent='Errore: '+e.message}
  finally{$('#saveAwpWeeklyBtn').disabled=false}
}
async function loadAwpWeekly(){
  const dal=$('#awpDal')?.value||'',al=$('#awpAl')?.value||'';
  let item=null;
  if(dal&&al)item=awpWeeklySeries().find(x=>x.dal===dal&&x.al===al);
  else if(al)item=awpWeeklySeries().find(x=>x.al===al);
  if(!item){$('#awpWeeklyStatus').textContent='Periodo AWP non trovato.';return}
  fillAwpWeeklyForm(item);$('#awpWeeklyStatus').textContent='Periodo AWP caricato.';
}
async function deleteAwpWeekly(){
  if(!isMaster())return;
  const dal=$('#awpDal')?.value||'',al=$('#awpAl')?.value||'';
  if(!dal||!al){$('#awpWeeklyStatus').textContent='Inserisci il periodo da eliminare.';return}
  try{
    $('#deleteAwpWeeklyBtn').disabled=true;
    const {remoteDb,sha,api,headers}=await fetchLatestGithubDb();
    remoteDb.awpSettimanale=Array.isArray(remoteDb.awpSettimanale)?remoteDb.awpSettimanale:[];
    const idx=remoteDb.awpSettimanale.findIndex(x=>x.dal===dal&&x.al===al);
    if(idx<0){db=remoteDb;$('#awpWeeklyStatus').textContent='Periodo AWP non trovato.';return}
    if(!confirm(`Eliminare il periodo AWP ${dmy(dal)} → ${dmy(al)}?`)){ $('#awpWeeklyStatus').textContent='Eliminazione annullata.';return}
    remoteDb.awpSettimanale.splice(idx,1);
    const content=btoa(unescape(encodeURIComponent(JSON.stringify(remoteDb,null,2))));
    const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
      message:`Dashboard: elimina AWP ${dal} - ${al}`,content,sha
    })});
    if(!put.ok){let msg='';try{msg=(await put.json()).message||''}catch{};throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`)}
    db=remoteDb; $('#awpWeeklyStatus').textContent='Periodo AWP eliminato ✓'; renderDashboard();renderHistory();
  }catch(e){console.error(e);$('#awpWeeklyStatus').textContent='Errore: '+e.message}
  finally{$('#deleteAwpWeeklyBtn').disabled=false}
}

async function saveEntry(){
  if(!isMaster()) return;
  try{
    const rec=recordFromForm();
    const idx=db.records.findIndex(r=>r.data===rec.data);
    if(idx>=0 && !confirm(`La giornata ${dmy(rec.data)} esiste già. Vuoi sovrascriverla?`)) return;

    $('#saveEntryBtn').disabled=true; $('#saveStatus').textContent='Salvataggio su GitHub...';
    const savedDb=await pushDataToGithubMerged(rec);

    db=savedDb; currentMonth=rec.data.slice(0,7);
    $('#historyMonth').value=currentMonth;
    const linkedUtile=[...utileSeries()].sort((a,b)=>a.data.localeCompare(b.data)).reverse().find(u=>u.data===rec.data);
    if(linkedUtile){
      const c=closureReadinessForUtile(linkedUtile);
      $('#saveStatus').textContent=c.ready?'Salvato ✓ · Riepilogo Telegram pronto':'Salvato ✓ · Telegram in attesa: '+c.missing.join(', ');
    }else $('#saveStatus').textContent='Salvato ✓';
    renderDashboard();
    if($('#historyView').classList.contains('active')) renderHistory();
  }catch(e){console.error(e);$('#saveStatus').textContent='Errore: '+e.message}
  finally{$('#saveEntryBtn').disabled=false}
}

async function deleteEntry(){
  if(!isMaster()) return;
  const date=$('#entryDate').value;
  if(!date){ $('#saveStatus').textContent='Seleziona una data da eliminare.'; return; }
  try{
    $('#deleteEntryBtn').disabled=true;
    $('#saveStatus').textContent='Verifica giornata su GitHub...';
    const {remoteDb,sha,api,headers}=await fetchLatestGithubDb();
    const idx=remoteDb.records.findIndex(r=>r.data===date);
    if(idx<0){
      db=remoteDb;
      $('#saveStatus').textContent=`La giornata ${dmy(date)} non esiste.`;
      return;
    }
    if(!confirm(`Eliminare definitivamente la giornata ${dmy(date)}? Questa operazione rimuoverà solo questa data dal database.`)){
      $('#saveStatus').textContent='Eliminazione annullata.';
      return;
    }
    remoteDb.records.splice(idx,1);
    remoteDb.records.sort((a,b)=>a.data.localeCompare(b.data));
    const content=btoa(unescape(encodeURIComponent(JSON.stringify(remoteDb,null,2))));
    $('#saveStatus').textContent='Eliminazione su GitHub...';
    const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
      message:`Dashboard: elimina ${date}`,content,sha
    })});
    if(!put.ok){
      let msg=''; try{msg=(await put.json()).message||''}catch{}
      throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`);
    }
    db=remoteDb;
    clearEntry();
    currentMonth=date.slice(0,7);
    $('#historyMonth').value=currentMonth;
    $('#saveStatus').textContent=`Giornata ${dmy(date)} eliminata ✓`;
    renderDashboard();
    renderHistory();
  }catch(e){
    console.error(e);
    $('#saveStatus').textContent='Errore: '+e.message;
  }finally{
    $('#deleteEntryBtn').disabled=false;
  }
}

function rateText(v){return Number(v??0).toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:2})}
function loadRateFields(){
  const map=[
    ['rateSpAggio','aSp',50],['rateSpTax','tSp',20.5],
    ['rateVtAggio','aVt',4.5],['rateVtTax','tVt',24.5],
    ['rateAwAggio','aAw',5.5],['rateAwTax','tAw',20.5],
    ['rateSoAggio','aSo',50],['rateSoTax','tSo',24.5],
    ['rateVoAggio','aVo',4.5],['rateVoTax','tVo',24.5],
    ['rateCoAggio','aCo',50],['rateCoTax','tCo',24.5],
    ['ratePoAggio','aPo',50],['ratePoTax','tPo',20]
  ];
  map.forEach(([id,key,def])=>{$('#'+id).value=rateText(db.settings[key]===undefined?def:db.settings[key])});
}
async function pushWholeDb(nextDb,message){
  const token=getGithubToken();
  if(!token) throw new Error('Token GitHub non disponibile in questa sessione. Apri Impostazioni e premi Salva sul dispositivo.');
  const api=`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
  const headers={'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
  const get=await fetch(api,{headers,cache:'no-store'});
  if(!get.ok) throw new Error(`GitHub GET ${get.status}`);
  const info=await get.json();
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(nextDb,null,2))));
  const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message,content,sha:info.sha})});
  if(!put.ok){let msg='';try{msg=(await put.json()).message||''}catch{};throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`)}
}
async function saveRates(){
  if(!isMaster())return;
  const pairs=[
    ['aSp','rateSpAggio'],['tSp','rateSpTax'],['aVt','rateVtAggio'],['tVt','rateVtTax'],
    ['aAw','rateAwAggio'],['tAw','rateAwTax'],['aSo','rateSoAggio'],['tSo','rateSoTax'],
    ['aVo','rateVoAggio'],['tVo','rateVoTax'],['aCo','rateCoAggio'],['tCo','rateCoTax'],
    ['aPo','ratePoAggio'],['tPo','ratePoTax']
  ];
  try{
    const next=JSON.parse(JSON.stringify(db));
    next.settings=next.settings||{};
    for(const [key,id] of pairs){
      const v=num($('#'+id).value);
      if(v<0||v>100)throw new Error('Le percentuali devono essere comprese tra 0 e 100.');
      next.settings[key]=v;
    }
    if(!confirm('Salvare le nuove aliquote? Dashboard e Storico verranno ricalcolati con questi valori.'))return;
    $('#saveRatesBtn').disabled=true;$('#ratesStatus').textContent='Salvataggio...';
    await pushWholeDb(next,'Dashboard: aggiorna aliquote');
    db=next;renderDashboard();renderHistory();$('#ratesStatus').textContent='Aliquote salvate ✓';
  }catch(e){$('#ratesStatus').textContent='Errore: '+e.message}
  finally{$('#saveRatesBtn').disabled=false}
}
function downloadJson(obj,name){
  const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function exportBackup(){
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  downloadJson(db,`wincity-v13-backup-${stamp}.json`);
  $('#backupStatus').textContent='Backup esportato.';
}
function validateBackup(x){
  if(!x||typeof x!=='object'||!Array.isArray(x.records)||!x.settings||typeof x.settings!=='object')throw new Error('Backup non valido: servono records e settings.');
  for(const r of x.records){if(!r||typeof r.data!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.data))throw new Error('Backup non valido: record con data errata.')}
  if(x.utileCumulativo!==undefined&&!Array.isArray(x.utileCumulativo))throw new Error('Backup non valido: utileCumulativo deve essere un elenco.');
  if(x.awpSettimanale!==undefined&&!Array.isArray(x.awpSettimanale))throw new Error('Backup non valido: awpSettimanale deve essere un elenco.');
  return true;
}
async function importBackup(){
  if(!isMaster())return;
  const file=$('#importBackupFile').files?.[0];
  if(!file){$('#backupStatus').textContent='Seleziona prima un file JSON.';return}
  try{
    const imported=JSON.parse(await file.text());validateBackup(imported);
    // Safety: automatically export current DB BEFORE destructive restore.
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    downloadJson(db,`wincity-v13-pre-restore-${stamp}.json`);
    if(!confirm(`Ripristinare il backup con ${imported.records.length} giornate? Il database attuale è stato appena esportato automaticamente.`))return;
    $('#importBackupBtn').disabled=true;$('#backupStatus').textContent='Ripristino su GitHub...';
    imported.records.sort((a,b)=>a.data.localeCompare(b.data));
    imported.utileCumulativo=Array.isArray(imported.utileCumulativo)?imported.utileCumulativo:[];
    imported.awpSettimanale=Array.isArray(imported.awpSettimanale)?imported.awpSettimanale:[];
    imported.utileCumulativo.sort((a,b)=>a.data.localeCompare(b.data));
    imported.awpSettimanale.sort((a,b)=>a.dal.localeCompare(b.dal));
    await pushWholeDb(imported,'Dashboard: ripristino backup database');
    db=imported;currentMonth=db.records.length?db.records.at(-1).data.slice(0,7):currentMonth;
    renderDashboard();renderHistory();loadRateFields();
    $('#backupStatus').textContent='Backup ripristinato ✓';
  }catch(e){$('#backupStatus').textContent='Errore: '+e.message}
  finally{$('#importBackupBtn').disabled=false}
}



function parseDirectUtileHash(){
  const h=location.hash||'';
  if(!h.startsWith('#utile=')) return false;
  try{
    const payload=decodeURIComponent(h.slice('#utile='.length));
    parseUtilePayload(payload);
    localStorage.setItem(PENDING_UTILE_KEY,payload);
    sessionStorage.setItem('wincity_v13_pending_utile',payload);
    return payload;
  }catch(e){
    sessionStorage.setItem('wincity_v13_utile_error',e.message);
    return false;
  }
}
function parseUtilePayload(payload){
  const parts=String(payload||'').trim().split('|');
  if(parts.length!==3 || parts[0]!=='U1') throw new Error('QR Utile cumulativo non riconosciuto.');
  if(!/^\d{8}$/.test(parts[1])) throw new Error('Data Utile cumulativo non valida.');
  if(!/^-?\d+$/.test(parts[2])) throw new Error('Valore Utile cumulativo non valido.');
  const cents=Number(parts[2]);
  if(!Number.isSafeInteger(cents)) throw new Error('Valore Utile cumulativo fuori intervallo.');
  const d=parts[1],date=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  return {data:date,lordo:cents/100};
}
async function applyUtilePayload(payload){
  try{
    const u=parseUtilePayload(payload);
    if(!isMaster()){
      localStorage.setItem(PENDING_UTILE_KEY,payload);
      sessionStorage.setItem('wincity_v13_pending_utile_after_login',payload);
      switchView('master');
      if($('#qrStatus')) $('#qrStatus').textContent=`Utile cumulativo ricevuto (${dmy(u.data)} · ${eur(u.lordo)}). Accedi a Master per salvarlo.`;
      return;
    }
    const token=getGithubToken();
    if(!token){
      localStorage.setItem(PENDING_UTILE_KEY,payload);
      if($('#qrStatus')) $('#qrStatus').textContent=`Utile cumulativo ricevuto (${eur(u.lordo)}), ma manca il token GitHub su questo dispositivo. Salvalo in Impostazioni e poi riscansiona il QR.`;
      return;
    }
    if($('#qrStatus')) $('#qrStatus').textContent=`Salvataggio Utile cumulativo ${eur(u.lordo)}...`;
    const item={data:u.data,lordo:u.lordo,aggiornato:new Date().toISOString()};
    db=await pushUtileToGithubMerged(item);
    currentMonth=u.data.slice(0,7);
    $('#historyMonth').value=currentMonth;
    renderDashboard();
    if($('#historyView').classList.contains('active'))renderHistory();
    localStorage.removeItem(PENDING_UTILE_KEY);
    sessionStorage.removeItem('wincity_v13_pending_utile');
    sessionStorage.removeItem('wincity_v13_pending_utile_after_login');
    if(location.hash.startsWith('#utile=')) history.replaceState(null,'',location.pathname+location.search);
    const closure=closureReadinessForUtile(item);
    if(closure.ready){
      if($('#qrStatus')) $('#qrStatus').textContent=`Utile cumulativo salvato ✓ ${dmy(u.data)} · Lordo ${eur(u.lordo)} · Netto ${eur(utileNetto(u.lordo))} · Chiusura ${dmy(closure.refDate)} completa: Telegram pronto.`;
      const t=$('#toast'); if(t){t.textContent=`Riepilogo ${dmy(closure.refDate)} completo ✓`;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3200)}
    }else{
      if($('#qrStatus')) $('#qrStatus').textContent=`Utile cumulativo salvato ✓ · Telegram in attesa per la chiusura ${dmy(closure.refDate)}: mancano ${closure.missing.join(', ')}.`;
      const t=$('#toast'); if(t){t.textContent=`Telegram in attesa: ${closure.missing.join(', ')}`;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),5000)}
      setTimeout(()=>{
        if(confirm(`Riepilogo Telegram non completo per la chiusura ${dmy(closure.refDate)}.

Mancano: ${closure.missing.join(', ')}.

Vuoi aprire adesso quella giornata per inserirli?`)){
          $('#entryDate').value=closure.refDate;
          loadDayToForm();
          switchView('master');
        }
      },180);
    }
  }catch(e){
    console.error(e);
    if($('#qrStatus')) $('#qrStatus').textContent='Errore Utile cumulativo: '+e.message;
  }
}
const DIRECT_UTILE_PAYLOAD=parseDirectUtileHash();

function parseDirectOnlineHash(){
  const h=location.hash||'';
  if(!h.startsWith('#online=')) return false;
  try{
    const payload=decodeURIComponent(h.slice('#online='.length));
    parseOnlinePayload(payload); // valida prima di conservarlo
    localStorage.setItem(PENDING_ONLINE_KEY,payload);
    sessionStorage.setItem('wincity_v13_pending_online',payload);
    return payload;
  }catch(e){
    sessionStorage.setItem('wincity_v13_online_error',e.message);
    return false;
  }
}
function parseOnlinePayload(payload){
  const parts=String(payload||'').trim().split('|');
  if(parts.length!==10 || parts[0]!=='O1') throw new Error('Dati Online non riconosciuti.');
  if(!/^\d{8}$/.test(parts[1])) throw new Error('Data Online non valida.');
  const vals=parts.slice(2).map(x=>Number(x));
  if(vals.some(x=>!Number.isFinite(x)||x<0)) throw new Error('Valori Online non validi.');
  const d=parts[1],date=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  return {date,soG:vals[0],soP:vals[1],voG:vals[2],voP:vals[3],coG:vals[4],coP:vals[5],poG:vals[6],poP:vals[7]};
}
function applyOnlinePayload(payload){
  try{
    const o=parseOnlinePayload(payload);
    $('#entryDate').value=o.date;
    // Prima carica l'eventuale giornata esistente: Sport/Virtual Agenzia, VLT, Conti e simpRaw restano invariati.
    loadDayToForm();
    setVal('soG',o.soG); setVal('soP',o.soP);
    setVal('voG',o.voG); setVal('voP',o.voP);
    setVal('coG',o.coG); setVal('coP',o.coP);
    setVal('poG',o.poG); setVal('poP',o.poP);
    $('#saveStatus').textContent=`Online importato: ${dmy(o.date)}. Controlla i valori e premi Salva giornata su GitHub.`;
    localStorage.removeItem(PENDING_ONLINE_KEY);
    sessionStorage.removeItem('wincity_v13_pending_online');
    sessionStorage.removeItem('wincity_v13_pending_online_after_login');
    if(location.hash.startsWith('#online=')) history.replaceState(null,'',location.pathname+location.search);
  }catch(e){
    $('#saveStatus').textContent='Errore Online: '+e.message;
  }
}
const DIRECT_ONLINE_PAYLOAD=parseDirectOnlineHash();

function parseDirectQrHash(){
  const h=location.hash||'';
  if(!h.startsWith('#Q')) return false;
  try{
    const a=h.slice(2).split('.');
    if(a.length!==9 || !/^\d{6}$/.test(a[0])) throw new Error('Link QR non valido.');
    const vals=a.slice(1).map(x=>parseInt(x,36));
    if(vals.some(x=>!Number.isFinite(x)||x<0)) throw new Error('Valori QR non validi.');
    const d='20'+a[0];
    const payload=`S1|${d}|${vals.join('|')}`;
    // Persisto il payload fino a quando viene realmente applicato al modulo Master.
    // localStorage evita che alcuni browser mobili lo perdano durante il passaggio login/view.
    localStorage.setItem(PENDING_QR_KEY,payload);
    sessionStorage.setItem('wincity_v13_pending_qr',payload);
    return payload;
  }catch(e){
    sessionStorage.setItem('wincity_v13_qr_error',e.message);
    return false;
  }
}
const DIRECT_QR_PAYLOAD=parseDirectQrHash();

function parseQrPayload(payload){
  const parts=String(payload||'').trim().split('|');
  if(parts.length!==10 || parts[0]!=='S1') throw new Error('QR non riconosciuto.');
  if(!/^\d{8}$/.test(parts[1])) throw new Error('Data QR non valida.');
  const c=parts.slice(2).map(x=>Number(x));
  if(c.some(x=>!Number.isFinite(x))) throw new Error('Valori QR non validi.');
  const d=parts[1],date=`${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`;
  return {date,sp:{emessi:c[0]/100,annulli:c[1]/100,pagati:c[2]/100,rimborsati:c[3]/100},
    vt:{emessi:c[4]/100,annulli:c[5]/100,pagati:c[6]/100,rimborsati:c[7]/100}};
}
function applyQrPayload(payload){
  try{
    const q=parseQrPayload(payload);
    $('#entryDate').value=q.date;
    setVal('spEmessi',q.sp.emessi);setVal('spAnnulli',q.sp.annulli);setVal('spPagati',q.sp.pagati);setVal('spRimborsati',q.sp.rimborsati);
    setVal('vtEmessi',q.vt.emessi);setVal('vtAnnulli',q.vt.annulli);setVal('vtPagati',q.vt.pagati);setVal('vtRimborsati',q.vt.rimborsati);
    updateRawPreview(); $('#qrPayload').value=payload;
    $('#qrStatus').textContent=`QR importato: ${dmy(q.date)}. Controlla i valori e premi Salva giornata.`;
    // Solo adesso il QR è stato davvero trasferito nel modulo: pulizia sicura.
    localStorage.removeItem(PENDING_QR_KEY);
    sessionStorage.removeItem('wincity_v13_pending_qr');
    sessionStorage.removeItem('wincity_v13_pending_qr_after_login');
    if(location.hash.startsWith('#Q')) history.replaceState(null,'',location.pathname+location.search);
    stopQr();
  }catch(e){$('#qrStatus').textContent='Errore QR: '+e.message}
}
async function startQr(){
  if(typeof Html5Qrcode==='undefined'){ $('#qrStatus').textContent='Libreria QR non disponibile. Puoi incollare il contenuto manualmente.'; return }
  try{
    qrScanner=new Html5Qrcode('qrReader');
    const cams=await Html5Qrcode.getCameras();
    if(!cams.length) throw new Error('Nessuna fotocamera disponibile.');
    const back=cams.find(c=>/back|rear|environment/i.test(c.label))||cams[cams.length-1];
    await qrScanner.start(back.id,{fps:10,qrbox:{width:250,height:250}},txt=>applyQrPayload(txt),()=>{});
    $('#startQrBtn').disabled=true;$('#stopQrBtn').disabled=false;$('#qrStatus').textContent='Fotocamera attiva. Inquadra il QR SIMP.';
  }catch(e){$('#qrStatus').textContent='Fotocamera: '+e.message;qrScanner=null}
}
async function stopQr(){
  if(qrScanner){
    try{await qrScanner.stop()}catch{}
    try{await qrScanner.clear()}catch{}
    qrScanner=null;
  }
  if($('#startQrBtn')){$('#startQrBtn').disabled=false;$('#stopQrBtn').disabled=true}
}

$('#saveRatesBtn').addEventListener('click',saveRates);
$('#exportBackupBtn').addEventListener('click',exportBackup);
$('#importBackupBtn').addEventListener('click',importBackup);
$('#settingsLoginBtn').addEventListener('click',settingsLogin);
$('#settingsPassword').addEventListener('keydown',e=>{if(e.key==='Enter')settingsLogin()});
$('#settingsLogoutBtn').addEventListener('click',settingsLogout);
$('#settingsSaveTokenBtn').addEventListener('click',()=>{const t=$('#settingsGithubToken').value.trim();if(saveGithubToken(t)){updateTokenStatus();location.reload();}else{alert('Inserisci un token GitHub valido prima di salvarlo.')}});
$('#settingsClearTokenBtn').addEventListener('click',()=>{clearGithubToken();$('#settingsGithubToken').value='';updateTokenStatus()});
$('#masterLoginBtn').addEventListener('click',masterLogin);
$('#masterPassword').addEventListener('keydown',e=>{if(e.key==='Enter')masterLogin()});
$('#masterLogoutBtn').addEventListener('click',masterLogout);
$('#loadDayBtn').addEventListener('click',loadDayToForm);
$('#saveEntryBtn').addEventListener('click',saveEntry);
$('#deleteEntryBtn').addEventListener('click',deleteEntry);
$('#saveAwpWeeklyBtn').addEventListener('click',saveAwpWeekly);
$('#loadAwpWeeklyBtn').addEventListener('click',loadAwpWeekly);
$('#deleteAwpWeeklyBtn').addEventListener('click',deleteAwpWeekly);
$('#awpPeriodPhotoBtn').addEventListener('click',chooseAwpPeriodPhoto);
$('#awpPeriodPhotoInput').addEventListener('change',e=>readAwpPeriodPhoto(e.target.files?.[0]));
$('#awpDataPhotoBtn').addEventListener('click',chooseAwpDataPhoto);
$('#awpDataPhotoInput').addEventListener('change',e=>readAwpDataPhoto(e.target.files?.[0]));
$('#startQrBtn').addEventListener('click',startQr);
$('#stopQrBtn').addEventListener('click',stopQr);
$('#applyQrBtn').addEventListener('click',()=>applyQrPayload($('#qrPayload').value));
['spEmessi','spAnnulli','spPagati','spRimborsati','vtEmessi','vtAnnulli','vtPagati','vtRimborsati'].forEach(id=>$('#'+id).addEventListener('input',updateRawPreview));

async function loadData(){
  // v13.29: data.json non esiste più nel repository pubblico.
  // I dati vengono letti esclusivamente dal repository privato tramite GitHub API.
  const token=getGithubToken();
  let privateDataLocked=false;
  if(token){
    const {remoteDb}=await fetchLatestGithubDb();
    db=remoteDb;
  }else{
    db={records:[],settings:{},utileCumulativo:[],awpSettimanale:[]};
    privateDataLocked=true;
  }
  db.utileCumulativo=Array.isArray(db.utileCumulativo)?db.utileCumulativo:[];
  db.awpSettimanale=Array.isArray(db.awpSettimanale)?db.awpSettimanale:[];
  db.records=Array.isArray(db.records)?db.records:[];
  db.records.sort((a,b)=>a.data.localeCompare(b.data));
  db.utileCumulativo.sort((a,b)=>a.data.localeCompare(b.data));
  db.awpSettimanale.sort((a,b)=>a.dal.localeCompare(b.dal));
  currentMonth=db.records.length?db.records.at(-1).data.slice(0,7):new Date().toISOString().slice(0,7);
  $('#historyMonth').value=currentMonth;
  renderPeriodExtra();renderDashboard();
  if(privateDataLocked){
    const t=$('#toast');
    if(t){
      t.textContent='Database privato: per visualizzare i dati configura il token GitHub in Impostazioni.';
      t.classList.add('show');
      setTimeout(()=>t.classList.remove('show'),6500);
    }
  }
  const pendingUtile=DIRECT_UTILE_PAYLOAD || localStorage.getItem(PENDING_UTILE_KEY) || sessionStorage.getItem('wincity_v13_pending_utile');
  if(pendingUtile){
    switchView('master');
    if(sessionStorage.getItem('wincity_v13_master')==='1') await applyUtilePayload(pendingUtile);
    else {
      const u=parseUtilePayload(pendingUtile);
      if($('#qrStatus')) $('#qrStatus').textContent=`Utile cumulativo ricevuto: ${dmy(u.data)} · ${eur(u.lordo)}. Accedi a Master per salvarlo automaticamente.`;
      localStorage.setItem(PENDING_UTILE_KEY,pendingUtile);
      sessionStorage.setItem('wincity_v13_pending_utile_after_login',pendingUtile);
    }
    return;
  }
  const pendingOnline=DIRECT_ONLINE_PAYLOAD || localStorage.getItem(PENDING_ONLINE_KEY) || sessionStorage.getItem('wincity_v13_pending_online');
  if(pendingOnline){
    const masterBtn=document.querySelector('[data-view="master"]');
    if(masterBtn) masterBtn.click();
    if(sessionStorage.getItem('wincity_v13_master')==='1') applyOnlinePayload(pendingOnline);
    else {
      $('#saveStatus').textContent='Dati Online ricevuti. Accedi a Master per visualizzarli e salvarli.';
      localStorage.setItem(PENDING_ONLINE_KEY,pendingOnline);
      sessionStorage.setItem('wincity_v13_pending_online_after_login',pendingOnline);
    }
    return;
  }
  const pending=DIRECT_QR_PAYLOAD || localStorage.getItem(PENDING_QR_KEY) || sessionStorage.getItem('wincity_v13_pending_qr');
  if(pending){
    const masterBtn=document.querySelector('[data-view="master"]');
    if(masterBtn) masterBtn.click();
    if(sessionStorage.getItem('wincity_v13_master')==='1') applyQrPayload(pending);
    else {
      $('#qrPayload').value=pending;
      $('#qrStatus').textContent='QR ricevuto. Accedi a Master per visualizzare e salvare i dati.';
      localStorage.setItem(PENDING_QR_KEY,pending);
      sessionStorage.setItem('wincity_v13_pending_qr_after_login',pending);
    }
  }
}
$('#periodType').addEventListener('change',()=>{
  const type=$('#periodType').value;
  const n=new Date(); n.setHours(12,0,0,0);
  if(type==='semester') semesterCursor={year:n.getFullYear(),half:(n.getMonth()<6?1:2)};
  if(type==='currentWeek') weekCursor=new Date(n);
  if(type==='currentYear') yearCursor=n.getFullYear();
  renderPeriodExtra();renderDashboard();
});
$('#prevPeriod').addEventListener('click',()=>shiftPeriod(-1));
$('#nextPeriod').addEventListener('click',()=>shiftPeriod(1));
$('#refreshBtn').addEventListener('click',()=>location.reload());
$('#historyMonth').addEventListener('change',renderHistory);
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
loadData().catch(e=>{
  console.error(e);
  const t=$('#toast');
  if(t){
    const msg=(e&&e.message)?e.message:'Errore di connessione al database.';
    t.textContent=msg==='Failed to fetch'?'Connessione al database non riuscita. Il QR è stato conservato: riprova tra qualche secondo.':msg;
    t.classList.add('show');
    setTimeout(()=>t.classList.remove('show'),8000);
  }
});
