
let db={records:[],settings:{}};
let currentMonth=new Date().toISOString().slice(0,7);

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
const GH_REPO='alexsalv2-ops/Wincity-Dashboard-v13';
const GH_FILE='data.json';
let qrScanner=null;

function isMaster(){return sessionStorage.getItem('wincity_v13_master')==='1'}
function renderMasterState(){
  const unlocked=isMaster();
  $('#masterLocked').hidden=unlocked;
  $('#masterUnlocked').hidden=!unlocked;
  if(unlocked){
    loadRateFields();
    if(!$('#entryDate').value) $('#entryDate').value=latestDate();
    updateRawPreview();
  }
}
function updateTokenStatus(){
  const ok=!!localStorage.getItem(TOKEN_KEY);
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
    $('#settingsGithubToken').value=localStorage.getItem(TOKEN_KEY)||'';
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
    const pending=sessionStorage.getItem('wincity_v13_pending_qr_after_login');
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
  return {
    data:date,
    'sp-g':spRaw.emessi-spRaw.annulli,'sp-p':spRaw.pagati+spRaw.rimborsati,
    'vt-g':vtRaw.emessi-vtRaw.annulli,'vt-p':vtRaw.pagati+vtRaw.rimborsati,
    'aw-g':val('awG'),'aw-p':val('awP'),
    'so-g':val('soG'),'so-p':val('soP'),'vo-g':val('voG'),'vo-p':val('voP'),
    'co-g':val('coG'),'co-p':val('coP'),'po-g':val('poG'),'po-p':val('poP'),
    conti:Math.max(0,Math.round(val('contiInput'))),
    simpRaw:{sport:spRaw,virtual:vtRaw}
  };
}
function clearEntry(){
  ['spEmessi','spAnnulli','spPagati','spRimborsati','vtEmessi','vtAnnulli','vtPagati','vtRimborsati',
   'awG','awP','soG','soP','voG','voP','coG','coP','poG','poP'].forEach(id=>setVal(id,0));
  $('#contiInput').value=0; updateRawPreview();
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
  $('#contiInput').value=num(r.conti);updateRawPreview();
  $('#saveStatus').textContent='Giornata caricata. Le modifiche sovrascriveranno questa data.';
}
async function pushDataToGithub(nextDb){
  const token=localStorage.getItem(TOKEN_KEY);
  if(!token) throw new Error('Inserisci prima il token GitHub nell’area Master.');
  const api=`https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
  const headers={'Accept':'application/vnd.github+json','Authorization':`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28'};
  const get=await fetch(api,{headers,cache:'no-store'});
  if(!get.ok) throw new Error(`GitHub GET ${get.status}`);
  const info=await get.json();
  const content=btoa(unescape(encodeURIComponent(JSON.stringify(nextDb,null,2))));
  const put=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({
    message:`Dashboard: aggiorna ${$('#entryDate').value}`,
    content,sha:info.sha
  })});
  if(!put.ok){
    let msg=''; try{msg=(await put.json()).message||''}catch{}
    throw new Error(`GitHub PUT ${put.status}${msg?': '+msg:''}`);
  }
}
async function saveEntry(){
  if(!isMaster()) return;
  try{
    const rec=recordFromForm(), idx=db.records.findIndex(r=>r.data===rec.data);
    if(idx>=0 && !confirm(`La giornata ${dmy(rec.data)} esiste già. Vuoi sovrascriverla?`)) return;
    const nextDb=JSON.parse(JSON.stringify(db));
    const ni=nextDb.records.findIndex(r=>r.data===rec.data);
    if(ni>=0) nextDb.records[ni]=rec; else nextDb.records.push(rec);
    nextDb.records.sort((a,b)=>a.data.localeCompare(b.data));
    $('#saveEntryBtn').disabled=true; $('#saveStatus').textContent='Salvataggio su GitHub...';
    await pushDataToGithub(nextDb);
    db=nextDb; currentMonth=rec.data.slice(0,7);
    $('#saveStatus').textContent='Salvato ✓';
    renderDashboard(); if($('#historyView').classList.contains('active'))renderHistory();
  }catch(e){console.error(e);$('#saveStatus').textContent='Errore: '+e.message}
  finally{$('#saveEntryBtn').disabled=false}
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
  const token=localStorage.getItem(TOKEN_KEY);
  if(!token) throw new Error('Inserisci prima il token GitHub nell’area Master.');
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
    await pushWholeDb(imported,'Dashboard: ripristino backup database');
    db=imported;currentMonth=db.records.length?db.records.at(-1).data.slice(0,7):currentMonth;
    renderDashboard();renderHistory();loadRateFields();
    $('#backupStatus').textContent='Backup ripristinato ✓';
  }catch(e){$('#backupStatus').textContent='Errore: '+e.message}
  finally{$('#importBackupBtn').disabled=false}
}


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
    // Il link QR apre direttamente Master e precompila i dati. Il salvataggio resta volontario.
    sessionStorage.setItem('wincity_v13_pending_qr',payload);
    location.hash='';
    return payload;
  }catch(e){
    sessionStorage.setItem('wincity_v13_qr_error',e.message);
    location.hash='';
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
$('#settingsSaveTokenBtn').addEventListener('click',()=>{const t=$('#settingsGithubToken').value.trim();if(t)localStorage.setItem(TOKEN_KEY,t);updateTokenStatus()});
$('#settingsClearTokenBtn').addEventListener('click',()=>{localStorage.removeItem(TOKEN_KEY);$('#settingsGithubToken').value='';updateTokenStatus()});
$('#masterLoginBtn').addEventListener('click',masterLogin);
$('#masterPassword').addEventListener('keydown',e=>{if(e.key==='Enter')masterLogin()});
$('#masterLogoutBtn').addEventListener('click',masterLogout);
$('#loadDayBtn').addEventListener('click',loadDayToForm);
$('#saveEntryBtn').addEventListener('click',saveEntry);
$('#startQrBtn').addEventListener('click',startQr);
$('#stopQrBtn').addEventListener('click',stopQr);
$('#applyQrBtn').addEventListener('click',()=>applyQrPayload($('#qrPayload').value));
['spEmessi','spAnnulli','spPagati','spRimborsati','vtEmessi','vtAnnulli','vtPagati','vtRimborsati'].forEach(id=>$('#'+id).addEventListener('input',updateRawPreview));

async function loadData(){
  const res=await fetch('./data.json?ts='+Date.now(),{cache:'no-store'});
  if(!res.ok)throw new Error('Impossibile caricare data.json');
  db=await res.json();
  db.records.sort((a,b)=>a.data.localeCompare(b.data));
  currentMonth=db.records.length?db.records.at(-1).data.slice(0,7):new Date().toISOString().slice(0,7);
  $('#historyMonth').value=currentMonth;
  renderPeriodExtra();renderDashboard();
  const pending=DIRECT_QR_PAYLOAD||sessionStorage.getItem('wincity_v13_pending_qr');
  if(pending){
    sessionStorage.removeItem('wincity_v13_pending_qr');
    const masterBtn=document.querySelector('[data-view="master"]');
    if(masterBtn) masterBtn.click();
    if(sessionStorage.getItem('wincity_v13_master')==='1') applyQrPayload(pending);
    else {
      $('#qrPayload').value=pending;
      $('#qrStatus').textContent='QR ricevuto. Accedi a Master per visualizzare e salvare i dati.';
      sessionStorage.setItem('wincity_v13_pending_qr_after_login',pending);
    }
  }
}
$('#periodType').addEventListener('change',()=>{renderPeriodExtra();renderDashboard()});
$('#prevPeriod').addEventListener('click',()=>shiftPeriod(-1));
$('#nextPeriod').addEventListener('click',()=>shiftPeriod(1));
$('#refreshBtn').addEventListener('click',()=>location.reload());
$('#historyMonth').addEventListener('change',renderHistory);
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
loadData().catch(e=>{console.error(e);$('#toast').textContent=e.message;$('#toast').classList.add('show')});
