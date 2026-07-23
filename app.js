const KEY="aideplanning_v2";
const LEGACY_KEYS=["aideplanning_v1","aideplanning_data_v1","aideplanning_v2"];
let db=loadDatabase();
let currentMonth=new Date(),selectedDate=new Date(),editingVisitId=null,editingPersonId=null;

const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const uid=p=>`${p}_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
const person=id=>db.people.find(p=>p.id===id);
const parseTime=t=>{if(!t)return 0;const[h,m]=t.split(":").map(Number);return h*60+m};
const duration=(a,b)=>{let x=parseTime(a),y=parseTime(b);if(y<x)y+=1440;return Math.max(0,y-x)};
const fmt=m=>`${Math.floor(m/60)}h${pad(m%60)}`;
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function loadDatabase(){
  for(const key of LEGACY_KEYS){
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||"null");
      if(parsed&&Array.isArray(parsed.people)&&parsed.visits&&typeof parsed.visits==="object"){
        localStorage.setItem(KEY,JSON.stringify(parsed));
        return parsed;
      }
    }catch{}
  }
  return {people:[],visits:{}};
}
function save(){localStorage.setItem(KEY,JSON.stringify(db))}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2100)}
function monthPrefix(){return `${currentMonth.getFullYear()}-${pad(currentMonth.getMonth()+1)}-`}
function monthVisits(){return Object.entries(db.visits).filter(([d])=>d.startsWith(monthPrefix())).flatMap(([date,v])=>v.map(x=>({...x,date})))}
function visitTravel(v){return parseTime(v.travel||"00:00")}
function orderedVisits(date){return [...(db.visits[date]||[])].sort((a,b)=>a.start.localeCompare(b.start))}
function overlapPairs(visits){
  const sorted=[...visits].sort((a,b)=>a.start.localeCompare(b.start));
  const pairs=[];
  for(let i=0;i<sorted.length-1;i++){
    const current=sorted[i],next=sorted[i+1];
    if(parseTime(next.start)<parseTime(current.end))pairs.push([current,next]);
  }
  return pairs;
}
function render(){renderCalendar();renderDay();renderPeople();renderStats()}

function renderCalendar(){
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth(),mv=monthVisits();
  const work=mv.reduce((s,v)=>s+duration(v.start,v.end),0),travel=mv.reduce((s,v)=>s+visitTravel(v),0);
  $("monthTitle").textContent=currentMonth.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("monthInfo").textContent=`${mv.length} visite${mv.length>1?"s":""} · ${fmt(work)} travail · ${fmt(travel)} trajet`;
  $("calendar").innerHTML="";
  const offset=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();

  for(let i=0;i<offset;i++){
    const b=document.createElement("button");b.className="day empty";b.disabled=true;$("calendar").appendChild(b);
  }

  for(let d=1;d<=days;d++){
    const dt=new Date(y,m,d),k=dateKey(dt),visits=orderedVisits(k);
    const workDay=visits.reduce((s,v)=>s+duration(v.start,v.end),0);
    const b=document.createElement("button");
    b.className="day"+(k===dateKey(new Date())?" today":"")+(k===dateKey(selectedDate)?" selected":"")+(visits.length?" has":"")+(overlapPairs(visits).length?" warning":"");
    b.innerHTML=`<b>${d}</b><span class="day-meta">${visits.length?`${visits.length} visite${visits.length>1?"s":""}<br>${fmt(workDay)}`:""}</span>`;
    b.onclick=()=>{selectedDate=dt;render()};
    $("calendar").appendChild(b);
  }
}

function renderDay(){
  const visits=orderedVisits(dateKey(selectedDate));
  const work=visits.reduce((s,v)=>s+duration(v.start,v.end),0),travel=visits.reduce((s,v)=>s+visitTravel(v),0);
  $("selectedDateTitle").textContent=selectedDate.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  $("dayWorkTotal").textContent=fmt(work);
  $("dayTravelTotal").textContent=`Trajet ${fmt(travel)}`;

  const overlaps=overlapPairs(visits);
  $("dayWarnings").innerHTML=overlaps.length?`<div class="warning-box">⚠️ ${overlaps.length} chevauchement${overlaps.length>1?"s":""} d’horaires détecté${overlaps.length>1?"s":""}.</div>`:"";

  const list=$("visitsList");list.innerHTML="";
  if(!visits.length){
    list.innerHTML='<div class="empty-state">Aucune intervention pour cette journée.</div>';
    return;
  }

  visits.forEach(v=>{
    const p=person(v.personId),b=document.createElement("button");b.className="visit-card";
    b.innerHTML=`<div><h3>${esc(p?.name||"Personne supprimée")}</h3><div class="visit-time">${v.start} → ${v.end}</div>${v.note?`<div class="visit-note">${esc(v.note)}</div>`:""}</div><div class="visit-side"><strong>${fmt(duration(v.start,v.end))}</strong><span>Trajet ${fmt(visitTravel(v))}</span></div>`;
    b.onclick=()=>openVisit(v.id);
    list.appendChild(b);
  });
}

function renderPeople(){
  const q=$("personSearch").value.trim().toLowerCase(),list=$("peopleList");list.innerHTML="";
  const filtered=[...db.people].sort((a,b)=>a.name.localeCompare(b.name,"fr")).filter(p=>(p.name+" "+(p.address||"")+" "+(p.phone||"")).toLowerCase().includes(q));

  if(!filtered.length){
    list.innerHTML='<div class="card empty-state">Aucun bénéficiaire enregistré.</div>';
    return;
  }

  filtered.forEach(p=>{
    const all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===p.id).map(x=>({...x,date})));
    const work=all.reduce((s,v)=>s+duration(v.start,v.end),0),card=document.createElement("article");card.className="person-card";
    card.innerHTML=`<h3>${esc(p.name)}</h3><div class="person-meta">${p.address?`📍 ${esc(p.address)}<br>`:""}${p.phone?`📞 ${esc(p.phone)}<br>`:""}${all.length} intervention${all.length>1?"s":""} · ${fmt(work)}</div><div class="person-actions"><button class="mini detail">Voir la fiche</button><button class="mini edit">Modifier</button></div>`;
    card.querySelector(".detail").onclick=()=>openPersonDetail(p.id);
    card.querySelector(".edit").onclick=()=>openPerson(p.id);
    list.appendChild(card);
  });
}

function mondayOf(date){
  const d=new Date(date);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d;
}
function renderStats(){
  const mv=monthVisits(),work=mv.reduce((s,v)=>s+duration(v.start,v.end),0),travel=mv.reduce((s,v)=>s+visitTravel(v),0);
  $("statsTitle").textContent=currentMonth.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("statWork").textContent=fmt(work);$("statTravel").textContent=fmt(travel);$("statVisits").textContent=mv.length;$("statDays").textContent=new Set(mv.map(v=>v.date)).size;

  const totals={};mv.forEach(v=>{totals[v.personId]=(totals[v.personId]||0)+duration(v.start,v.end)});
  $("personStats").innerHTML=Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([id,m])=>`<div class="person-stat"><span>${esc(person(id)?.name||"Personne supprimée")}</span><strong>${fmt(m)}</strong></div>`).join("")||'<div class="empty-state">Aucune donnée ce mois-ci.</div>';

  const weeks={};
  mv.forEach(v=>{
    const monday=mondayOf(new Date(v.date+"T12:00:00"));
    const k=dateKey(monday);
    weeks[k]??={work:0,travel:0,visits:0};
    weeks[k].work+=duration(v.start,v.end);weeks[k].travel+=visitTravel(v);weeks[k].visits++;
  });
  $("weekStats").innerHTML=Object.entries(weeks).sort().map(([k,w])=>{
    const d=new Date(k+"T12:00:00");
    return `<div class="week-stat"><span>Semaine du ${d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span><strong>${fmt(w.work)} + ${fmt(w.travel)} trajet</strong></div>`;
  }).join("")||'<div class="empty-state">Aucune donnée ce mois-ci.</div>';
}

function fillPersonSelect(selected=""){
  $("visitPerson").innerHTML='<option value="">Choisir une personne</option>'+[...db.people].sort((a,b)=>a.name.localeCompare(b.name,"fr")).map(p=>`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`).join("");
}
function openVisit(id=null){
  if(!db.people.length){toast("Ajoutez d’abord un bénéficiaire.");showPage("peoplePage");return}
  editingVisitId=id;
  const v=(db.visits[dateKey(selectedDate)]||[]).find(x=>x.id===id);
  $("visitDialogTitle").textContent=v?"Modifier l’intervention":"Ajouter une intervention";
  fillPersonSelect(v?.personId||"");
  $("visitStart").value=v?.start||"08:00";
  $("visitEnd").value=v?.end||"09:00";
  $("visitTravel").value=v?.travel||"00:00";
  $("visitNote").value=v?.note||"";
  $("deleteVisitBtn").style.display=v?"block":"none";
  $("visitDialog").showModal();
}
function openPerson(id=null){
  editingPersonId=id;
  const p=person(id);
  $("personDialogTitle").textContent=p?"Modifier le bénéficiaire":"Ajouter un bénéficiaire";
  $("personName").value=p?.name||"";
  $("personAddress").value=p?.address||"";
  $("personPhone").value=p?.phone||"";
  $("personNotes").value=p?.notes||"";
  $("deletePersonBtn").style.display=p?"block":"none";
  $("personDialog").showModal();
}
function openPersonDetail(id){
  const p=person(id);if(!p)return;
  const all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===id).map(x=>({...x,date}))).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
  $("detailName").textContent=p.name;
  $("detailContact").innerHTML=`${p.address?`<div>📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank" rel="noopener">${esc(p.address)}</a></div>`:""}${p.phone?`<div>📞 <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></div>`:""}${p.notes?`<div>📝 ${esc(p.notes)}</div>`:""}`;
  $("detailWork").textContent=fmt(all.reduce((s,v)=>s+duration(v.start,v.end),0));
  $("detailTravel").textContent=fmt(all.reduce((s,v)=>s+visitTravel(v),0));
  $("detailVisits").textContent=all.length;
  $("detailHistory").innerHTML=all.map(v=>`<div class="history-item"><div class="row"><strong>${new Date(v.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</strong><span>${fmt(duration(v.start,v.end))}</span></div><div>${v.start} → ${v.end} · trajet ${fmt(visitTravel(v))}</div>${v.note?`<div class="visit-note">${esc(v.note)}</div>`:""}</div>`).join("")||'<div class="empty-state">Aucune intervention enregistrée.</div>';
  $("personDetailDialog").showModal();
}
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  document.querySelectorAll(".nav-btn").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
  if(id==="statsPage")renderStats();
}

$("visitForm").onsubmit=e=>{
  e.preventDefault();
  const k=dateKey(selectedDate),payload={
    personId:$("visitPerson").value,
    start:$("visitStart").value,
    end:$("visitEnd").value,
    travel:$("visitTravel").value||"00:00",
    note:$("visitNote").value.trim()
  };
  if(!payload.personId)return toast("Choisissez un bénéficiaire.");
  if(duration(payload.start,payload.end)<=0)return toast("Les horaires sont invalides.");

  db.visits[k]??=[];
  if(editingVisitId){
    const i=db.visits[k].findIndex(v=>v.id===editingVisitId);
    db.visits[k][i]={...db.visits[k][i],...payload};
  }else{
    db.visits[k].push({id:uid("visit"),...payload});
  }
  save();$("visitDialog").close();render();
  toast(overlapPairs(db.visits[k]).length?"Enregistré, mais vérifie le chevauchement.":"Intervention enregistrée.");
};

$("deleteVisitBtn").onclick=()=>{
  const k=dateKey(selectedDate);
  db.visits[k]=(db.visits[k]||[]).filter(v=>v.id!==editingVisitId);
  if(!db.visits[k].length)delete db.visits[k];
  save();$("visitDialog").close();render();toast("Intervention supprimée.");
};

$("personForm").onsubmit=e=>{
  e.preventDefault();
  const payload={name:$("personName").value.trim(),address:$("personAddress").value.trim(),phone:$("personPhone").value.trim(),notes:$("personNotes").value.trim()};
  if(!payload.name)return toast("Le nom est obligatoire.");
  if(editingPersonId){
    const i=db.people.findIndex(p=>p.id===editingPersonId);db.people[i]={...db.people[i],...payload};
  }else{
    db.people.push({id:uid("person"),...payload});
  }
  save();$("personDialog").close();render();toast("Bénéficiaire enregistré.");
};

$("deletePersonBtn").onclick=()=>{
  const count=Object.values(db.visits).flat().filter(v=>v.personId===editingPersonId).length;
  const message=count?`Cette personne possède ${count} intervention${count>1?"s":""}. Tout supprimer ?`:"Supprimer cette personne ?";
  if(!confirm(message))return;
  db.people=db.people.filter(p=>p.id!==editingPersonId);
  Object.keys(db.visits).forEach(k=>{db.visits[k]=db.visits[k].filter(v=>v.personId!==editingPersonId);if(!db.visits[k].length)delete db.visits[k]});
  save();$("personDialog").close();render();toast("Bénéficiaire supprimé.");
};

$("prevMonth").onclick=()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);selectedDate=new Date(currentMonth);render()};
$("nextMonth").onclick=()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);selectedDate=new Date(currentMonth);render()};
$("todayBtn").onclick=()=>{currentMonth=new Date();selectedDate=new Date();showPage("planningPage");render()};
$("addVisitBtn").onclick=()=>openVisit();
$("addPersonBtn").onclick=()=>openPerson();
$("personSearch").oninput=renderPeople;
document.querySelectorAll(".nav-btn").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());

function download(content,name,type){
  const a=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type}));
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}
$("exportCsvBtn").onclick=()=>{
  const rows=[["Date","Bénéficiaire","Entrée","Sortie","Temps travaillé","Temps de trajet","Note"]];
  monthVisits().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).forEach(v=>rows.push([v.date,person(v.personId)?.name||"",v.start,v.end,fmt(duration(v.start,v.end)),fmt(visitTravel(v)),v.note||""]));
  download("\ufeff"+rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(";")).join("\n"),`aideplanning-${currentMonth.getFullYear()}-${pad(currentMonth.getMonth()+1)}.csv`,"text/csv;charset=utf-8");
};
$("backupBtn").onclick=()=>download(JSON.stringify(db,null,2),`aideplanning-sauvegarde-${new Date().toISOString().slice(0,10)}.json`,"application/json");
$("restoreInput").onchange=async e=>{
  try{
    const parsed=JSON.parse(await e.target.files[0].text());
    if(!parsed.people||!parsed.visits)throw new Error();
    if(confirm("Remplacer toutes les données actuelles par cette sauvegarde ?")){
      db=parsed;save();render();toast("Sauvegarde restaurée.");
    }
  }catch{toast("Fichier de sauvegarde invalide.")}
  e.target.value="";
};

if("serviceWorker"in navigator){
  addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
}
render();