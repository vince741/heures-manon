
const KEY="aideplanning_v2";
const PALETTE_KEY="aideplanning_palette";
const MODE_KEY="aideplanning_mode";
const RECENT_KEY="aideplanning_recent_people";
const VIEW_KEY="aideplanning_planning_view";
const RECOVERY_KEY="aideplanning_before_restore";
let db=loadDatabase();
let storedDatabaseText=localStorage.getItem(KEY);
let currentMonth=new Date(),selectedDate=new Date(),editingVisitId=null,editingPersonId=null;
const savedView=localStorage.getItem(VIEW_KEY);
let planningView=["week","month"].includes(savedView)?savedView:matchMedia("(max-width: 700px)").matches?"week":"month";
const savedRecent=readJson(RECENT_KEY,[]);
let recentPeople=Array.isArray(savedRecent)?savedRecent:[];

const $=id=>document.getElementById(id);
const pad=n=>String(n).padStart(2,"0");
const dateKey=planningDateKey;
const uid=p=>`${p}_${globalThis.crypto?.randomUUID?.()||`${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
const person=id=>db.people.find(p=>p.id===id);
const fmt=m=>`${Math.floor(m/60)}h${pad(m%60)}`;
const esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fullDay=d=>d.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
const visitCount=count=>`${count} visite${count>1?"s":""}`;
const beneficiaryName=p=>p?.name||"Bénéficiaire introuvable";
const colorOf=p=>validColors.has(p?.color)?p.color:"slate";

function readJson(key,fallback){
  try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}
}

function loadDatabase(){
  for(const key of [KEY,"aideplanning_v1","aideplanning_data_v1"]){
    let parsed;
    try{
      const stored=localStorage.getItem(key);
      if(stored===null)continue;
      parsed=parsePlanningBackup(stored);
    }catch{continue}
    const data=preparePlanningData(parsed);
    if(key!==KEY||!Array.isArray(parsed.trash)||parsed.people.some(p=>!validColors.has(p.color))||Object.values(parsed.visits).some(day=>day.some(visit=>!visit.status))){
      try{localStorage.setItem(KEY,JSON.stringify(data))}catch{/* Keep the readable data if storage is full. */}
    }
    return data;
  }
  return {people:[],visits:{},trash:[]};
}
function storePlanning(next,expected=storedDatabaseText){
  if(localStorage.getItem(KEY)!==expected)throw new Error("Les données ont changé dans un autre onglet. Rouvrez l’application pour les retrouver.");
  const serialized=JSON.stringify(next);
  try{localStorage.setItem(KEY,serialized)}catch{throw new Error("Enregistrement impossible. Vérifiez l’espace disponible sur l’appareil.")}
  storedDatabaseText=serialized;
  db=next;
}
function toast(message,action){
  const notice=$("toast"),button=$("toastAction");
  $("toastText").textContent=message;
  button.hidden=!action;
  button.textContent=action?.label||"";
  button.onclick=action?.run||null;
  notice.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>{notice.classList.remove("show");button.hidden=true},action?12000:3200);
}
function monthPrefix(){return `${currentMonth.getFullYear()}-${pad(currentMonth.getMonth()+1)}-`}
function monthVisits(){return Object.entries(db.visits).filter(([d])=>d.startsWith(monthPrefix())).flatMap(([date,v])=>v.map(x=>({...x,date})))}
function visitTravel(v){return parseTime(v.travel||"00:00")}
function orderedVisits(date){return [...(db.visits[date]||[])].sort((a,b)=>a.start.localeCompare(b.start))}
function rememberRecentPerson(id){
  recentPeople=[id,...recentPeople.filter(x=>x!==id)].slice(0,6);
  try{localStorage.setItem(RECENT_KEY,JSON.stringify(recentPeople))}catch{/* The visit is independent of this shortcut. */}
}
function render(){
  renderPlanning();renderDay();renderPeople();renderStats();renderRecent();renderBackupReminder();
  if($("trashDialog").open)renderTrash();
}

function addDays(date,number){
  const day=new Date(date);
  day.setDate(day.getDate()+number);
  return day;
}

function weekTitle(start,end){
  const sameYear=start.getFullYear()===end.getFullYear();
  const sameMonth=sameYear&&start.getMonth()===end.getMonth();
  const first=sameMonth?start.getDate():start.toLocaleDateString("fr-FR",{day:"numeric",month:"short",...(!sameYear&&{year:"numeric"})});
  return `${first} au ${end.toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}`;
}

function renderPlanning(){
  const weekly=planningView==="week";
  $("planningLayout").dataset.view=planningView;
  $("weekCalendar").hidden=!weekly;
  $("monthCalendar").hidden=weekly;
  document.querySelectorAll("[data-planning-view]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.planningView===planningView)));
  $("prevPeriod").setAttribute("aria-label",weekly?"Semaine précédente":"Mois précédent");
  $("nextPeriod").setAttribute("aria-label",weekly?"Semaine suivante":"Mois suivant");

  const start=mondayOf(selectedDate);
  const days=Array.from({length:7},(_,i)=>addDays(start,i));
  const visits=weekly?days.flatMap(day=>orderedVisits(dateKey(day))):monthVisits();
  const totals=visitTotals(visits);
  $("periodTitle").textContent=weekly?weekTitle(start,days[6]):currentMonth.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("periodPlanned").textContent=fmt(totals.planned);
  $("periodWork").textContent=fmt(totals.done);
  $("periodTravel").textContent=fmt(totals.travel);
  if(weekly)renderWeek(days);
  else renderCalendar();
  markSelectedDay();
}

function renderCalendar(){
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth();
  const today=dateKey(new Date());
  const offset=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  const cells=Array(offset).fill('<span class="day-placeholder" aria-hidden="true"></span>');
  for(let d=1;d<=days;d++){
    const dt=new Date(y,m,d),key=dateKey(dt),visits=orderedVisits(key);
    const names=visits.map(visit=>person(visit.personId));
    const namesLabel=visits.map((visit,index)=>`${beneficiaryName(names[index])} (${statusLabel(visit).toLowerCase()})`).join(", ");
    const warning=conflictsOnDate(db.visits,key).length>0;
    const count=visits.length;
    const label=[fullDay(dt),visitCount(count),namesLabel,warning?"horaires qui se chevauchent":""].filter(Boolean).join(". ");
    const chips=visits.slice(0,3).map((visit,index)=>`<span class="calendar-visit" data-color="${colorOf(names[index])}" data-status="${visit.status}">${esc(beneficiaryName(names[index]))}</span>`).join("");
    const totals=visitTotals(visits);
    const work=fmt(totals.planned+totals.done);
    cells.push(`<button type="button" class="day${key===today?" today":""}${count?" has-visits":""}" data-day-select="${key}" aria-label="${esc(label)}"${namesLabel?` title="${esc(namesLabel)}"`:""}${key===today?' aria-current="date"':""}>
      <span class="day-top"><strong class="day-number">${d}</strong>${count?`<span class="day-duration">${work}</span>`:""}${warning?'<span class="calendar-warning" aria-hidden="true">!</span>':""}</span>
      ${count?`<span class="day-meta">${visitCount(count)}</span>${chips}`:""}
      ${count>3?`<span class="day-more">+${count-3}</span>`:""}
    </button>`);
  }
  $("calendar").innerHTML=cells.join("");
}

function renderWeek(days){
  const today=dateKey(new Date());
  $("weekCalendar").innerHTML=days.map(day=>{
    const key=dateKey(day),visits=orderedVisits(key),label=fullDay(day);
    const rows=visits.map(visit=>{
      const p=person(visit.personId);
      return `<button type="button" class="agenda-visit" data-visit-date="${key}" data-visit-id="${esc(visit.id)}" data-color="${colorOf(p)}" data-status="${visit.status}">
        <span class="agenda-name">${esc(beneficiaryName(p))}</span><span class="agenda-meta"><span class="agenda-time">${visit.start}–${visit.end}</span>${statusBadge(visit)}</span>
      </button>`;
    }).join("");
    const warning=conflictsOnDate(db.visits,key).length>0;
    return `<article class="panel agenda-day" data-agenda-day="${key}">
      <div class="agenda-heading">
        <button class="agenda-date" type="button" data-day-select="${key}"${key===today?' aria-current="date"':""}>
          <strong>${label}</strong><span>${visitCount(visits.length)}${key===today?" · Aujourd’hui":""}</span>
        </button>
        ${warning?'<span class="calendar-warning" role="img" aria-label="Horaires qui se chevauchent">!</span>':""}
        <button class="agenda-add" type="button" data-visit-date="${key}" aria-label="Ajouter une intervention le ${label}">+</button>
      </div>
      ${rows?`<div class="agenda-visits">${rows}</div>`:""}
    </article>`;
  }).join("");
}

function markSelectedDay(){
  const key=dateKey(selectedDate),calendar=planningView==="week"?$("weekCalendar"):$("calendar");
  calendar.querySelectorAll("[data-day-select]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.daySelect===key)));
  calendar.querySelectorAll("[data-agenda-day]").forEach(card=>card.classList.toggle("selected",card.dataset.agendaDay===key));
}

function selectPlanningDay(event){
  const button=event.target.closest("button");
  if(!button)return;
  const key=button.dataset.daySelect||button.dataset.visitDate;
  if(!key)return;
  selectedDate=new Date(key+"T12:00:00");
  currentMonth=new Date(selectedDate);
  markSelectedDay();
  renderDay();
  if(button.dataset.visitDate){
    openVisit(button.dataset.visitId);
    return;
  }
  const heading=$("selectedDateTitle");
  heading.focus({preventScroll:true});
  heading.scrollIntoView({block:"nearest"});
}
function renderDay(){
  const key=dateKey(selectedDate),visits=orderedVisits(key),totals=visitTotals(visits);
  $("selectedDateTitle").textContent=fullDay(selectedDate);
  $("dayWorkTotal").textContent=`${fmt(totals.done)} réalisé`;
  $("dayPlannedTotal").textContent=`${fmt(totals.planned)} prévu`;
  $("dayTravelTotal").textContent=`Trajets réalisés ${fmt(totals.travel)}`;
  const overlaps=conflictsOnDate(db.visits,key);
  const description=({date,visit})=>`${esc(beneficiaryName(person(visit.personId)))} ${date!==key?`${visitIsoLabel(date,{day:"numeric",month:"short"})} `:""}(${visit.start}–${visit.end})`;
  $("dayWarnings").innerHTML=overlaps.length?`<details class="warning-box"><summary>${overlaps.length} chevauchement${overlaps.length>1?"s":""} à vérifier</summary><ul>${overlaps.map(([a,b])=>`<li>${description(a)} et ${description(b)}</li>`).join("")}</ul></details>`:"";
  const list=$("visitsList");list.innerHTML="";
  if(!visits.length){list.innerHTML='<div class="empty-state">Aucune intervention pour cette journée.</div>';return}
  visits.forEach(v=>{
    const p=person(v.personId),b=document.createElement("button");b.className="visit-card";b.dataset.color=colorOf(p);
    b.innerHTML=`<div><h3>${esc(beneficiaryName(p))}</h3><div class="visit-time">${v.start} – ${v.end}</div>${v.note?`<div class="visit-note">${esc(v.note)}</div>`:""}</div><div class="visit-side">${statusBadge(v)}<strong>${fmt(duration(v.start,v.end))}</strong><small>Trajet ${fmt(visitTravel(v))}</small></div>`;
    b.onclick=()=>openVisit(v.id);list.appendChild(b);
  });
}
function renderPeople(){
  const q=$("personSearch").value.trim().toLowerCase(),list=$("peopleList");list.innerHTML="";
  $("activePeopleBtn").setAttribute("aria-pressed",String(!showArchivedPeople));
  $("archivedPeopleBtn").setAttribute("aria-pressed",String(showArchivedPeople));
  const filtered=db.people.filter(p=>Boolean(p.archived)===showArchivedPeople&&(p.name+" "+(p.address||"")+" "+(p.phone||"")).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
  if(!filtered.length){list.innerHTML=`<div class="panel empty-state">${q?"Aucun résultat.":showArchivedPeople?"Aucun bénéficiaire archivé.":"Aucun bénéficiaire actif."}</div>`;return}
  filtered.forEach(p=>{
    const all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===p.id).map(x=>({...x,date})));
    const card=document.createElement("article");card.className="person-card";
    card.innerHTML=`<h3 class="person-heading" data-color="${colorOf(p)}"><span aria-hidden="true"></span>${esc(p.name)}</h3><div class="person-meta">${p.address?`📍 ${esc(p.address)}<br>`:""}${p.phone?`📞 ${esc(p.phone)}<br>`:""}${visitCount(all.length)} · ${fmt(visitTotals(all).done)} réalisé</div><div class="person-actions"><button class="mini-button detail">Voir la fiche</button><button class="mini-button edit">Modifier</button></div>`;
    card.querySelector(".detail").onclick=()=>openPersonDetail(p.id);card.querySelector(".edit").onclick=()=>openPerson(p.id);list.appendChild(card);
  });
}
function mondayOf(date){const d=new Date(date),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d}
function renderStats(){
  const mv=monthVisits(),done=mv.filter(visit=>visit.status==="done"),summary=visitTotals(mv);
  $("statsTitle").textContent=currentMonth.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("statWork").textContent=fmt(summary.done);
  $("statPlanned").textContent=fmt(summary.planned);
  $("statTravel").textContent=fmt(summary.travel);
  $("statVisits").textContent=summary.doneCount;
  $("statCancelled").textContent=summary.cancelledCount;
  $("statDays").textContent=new Set(done.map(v=>v.date)).size;
  const totals=new Map();done.forEach(v=>totals.set(v.personId,(totals.get(v.personId)||0)+duration(v.start,v.end)));
  $("personStats").innerHTML=[...totals].sort((a,b)=>b[1]-a[1]).map(([id,m])=>`<div class="person-stat"><span>${esc(beneficiaryName(person(id)))}</span><strong>${fmt(m)}</strong></div>`).join("")||'<div class="empty-state">Aucune visite réalisée ce mois-ci.</div>';
  const weeks={};done.forEach(v=>{const k=dateKey(mondayOf(new Date(v.date+"T12:00:00")));weeks[k]??={work:0,travel:0};weeks[k].work+=duration(v.start,v.end);weeks[k].travel+=visitTravel(v)});
  $("weekStats").innerHTML=Object.entries(weeks).sort().map(([k,w])=>`<div class="week-stat"><span>Semaine du ${new Date(k+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span><strong>${fmt(w.work)} · Trajet ${fmt(w.travel)}</strong></div>`).join("")||'<div class="empty-state">Aucune visite réalisée ce mois-ci.</div>';
}
function renderRecent(){
  const recent=recentPeople.map(person).filter(Boolean);
  $("recentPeopleList").innerHTML=recent.length?recent.map(p=>`<button class="picker-person recent-person" data-person-id="${esc(p.id)}"><span><strong>${esc(p.name)}</strong>${p.phone?`<small>${esc(p.phone)}</small>`:""}</span><span>›</span></button>`).join(""):'<div class="empty-state">Aucun bénéficiaire récent.</div>';
  document.querySelectorAll(".recent-person").forEach(b=>b.onclick=()=>openPersonDetail(b.dataset.personId));
  const today=dateKey(new Date());
  const all=Object.entries(db.visits).filter(([date])=>date<=today).flatMap(([date,v])=>v.map(x=>({...x,date}))).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start)).slice(0,8);
  $("recentVisitsList").innerHTML=all.length?all.map(v=>`<button class="visit-card recent-visit" data-date="${v.date}" data-id="${esc(v.id)}"><div><h3>${esc(beneficiaryName(person(v.personId)))}</h3><div class="visit-time">${new Date(v.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · ${v.start} → ${v.end}</div></div><div class="visit-side">${statusBadge(v)}<strong>${fmt(duration(v.start,v.end))}</strong></div></button>`).join(""):'<div class="empty-state">Aucune intervention récente.</div>';
  document.querySelectorAll(".recent-visit").forEach(b=>b.onclick=()=>{selectedDate=new Date(b.dataset.date+"T12:00:00");currentMonth=new Date(selectedDate);showPage("planningPage");render();setTimeout(()=>openVisit(b.dataset.id),50)});
}
function updateVisitPersonButton(id=""){const p=person(id);$("visitPerson").value=id||"";$("visitPersonLabel").textContent=p?`${p.name}${p.archived?" (archivé)":""}`:"Choisir une personne"}
function pickerPersonButton(p){return `<button type="button" class="picker-person" data-person-id="${esc(p.id)}"><span><strong>${esc(p.name)}</strong>${p.phone?`<small>${esc(p.phone)}</small>`:""}</span><span>›</span></button>`}
function bindPickerButtons(){document.querySelectorAll("#personPickerDialog .picker-person").forEach(b=>b.onclick=()=>{updateVisitPersonButton(b.dataset.personId);rememberRecentPerson(b.dataset.personId);$("personPickerDialog").close()})}
function renderPersonPicker(){
  const recent=recentPeople.map(person).filter(p=>p&&!p.archived);
  $("pickerRecentList").innerHTML=recent.length?recent.map(pickerPersonButton).join(""):'<div class="empty-state">Aucun bénéficiaire récent.</div>';
  const q=$("pickerSearch").value.trim().toLowerCase();
  const all=db.people.filter(p=>!p.archived&&(p.name+" "+(p.phone||"")).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name,"fr"));
  $("pickerAllList").innerHTML=all.length?all.map(pickerPersonButton).join(""):'<div class="empty-state">Aucun bénéficiaire trouvé.</div>';
  bindPickerButtons();
}
function setPickerTab(tab){
  document.querySelectorAll(".segment").forEach(b=>b.classList.toggle("active",b.dataset.pickerTab===tab));
  $("pickerRecentPanel").classList.toggle("active",tab==="recent");$("pickerAllPanel").classList.toggle("active",tab==="all");$("pickerNewPanel").classList.toggle("active",tab==="new");
}
function openPerson(id=null){
  editingPersonId=id;const p=person(id);
  $("personDialogTitle").textContent=p?"Modifier le bénéficiaire":"Ajouter un bénéficiaire";
  $("personName").value=p?.name||"";$("personAddress").value=p?.address||"";$("personPhone").value=p?.phone||"";$("personNotes").value=p?.notes||"";
  $("personColor").value=p?.color||leastUsedColor(db.people);
  $("personColor").dataset.color=$("personColor").value;
  $("archivePersonBtn").hidden=!p;
  $("archivePersonBtn").textContent=p?.archived?"Réactiver":"Archiver";
  setVisitNotice("personError", "");
  $("personDialog").showModal();
}
function openPersonDetail(id){
  const p=person(id);if(!p)return;
  const all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===id).map(x=>({...x,date}))).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
  $("detailName").textContent=p.archived?`${p.name} · Archivé`:p.name;
  $("detailContact").innerHTML=`${p.address?`<div>📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank">${esc(p.address)}</a></div>`:""}${p.phone?`<div>📞 <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></div>`:""}${p.notes?`<div>📝 ${esc(p.notes)}</div>`:""}`;
  const summary=visitTotals(all);
  $("detailWork").textContent=fmt(summary.done);$("detailTravel").textContent=fmt(summary.travel);$("detailVisits").textContent=summary.doneCount;
  $("detailHistory").innerHTML=all.map(v=>`<div class="history-item"><div class="row"><strong>${new Date(v.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</strong>${statusBadge(v)}</div><div>${v.start} → ${v.end} · trajet ${fmt(visitTravel(v))}</div>${v.note?`<div class="visit-note">${esc(v.note)}</div>`:""}</div>`).join("")||'<div class="empty-state">Aucune intervention.</div>';
  $("personDetailDialog").showModal();
}
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  document.querySelectorAll(".nav-button").forEach(b=>{
    const active=b.dataset.page===id;
    b.classList.toggle("active",active);
    if(active)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");
  });
  if(id==="statsPage")renderStats();if(id==="recentPage")renderRecent();
}
const paletteNames={
  rose:"Rose",lavender:"Lavande",ocean:"Océan",mint:"Menthe",
  sunset:"Coucher de soleil",peach:"Pêche",berry:"Baies",red:"Rouge",indigo:"Indigo",turquoise:"Turquoise",graphite:"Graphite",sand:"Sable"
};
const paletteColors={
  rose:"#ff4f8b",lavender:"#8b5cf6",ocean:"#2388d9",mint:"#34a77b",
  sunset:"#f97355",peach:"#f39a72",berry:"#cf3f7b",red:"#e5484d",indigo:"#4f46e5",turquoise:"#18a7a0",graphite:"#59616d",sand:"#b5895a"
};
function applyAppearance(palette,mode){
  const palettes=Object.keys(paletteNames);
  if(!palettes.includes(palette))palette="rose";
  if(!["light","dark"].includes(mode))mode="light";
  document.documentElement.dataset.palette=palette;
  document.documentElement.dataset.mode=mode;
  localStorage.setItem(PALETTE_KEY,palette);
  localStorage.setItem(MODE_KEY,mode);
  document.querySelectorAll(".palette-choice").forEach(b=>b.classList.toggle("active",b.dataset.paletteChoice===palette));
  document.querySelectorAll(".mode-choice").forEach(b=>b.classList.toggle("active",b.dataset.modeChoice===mode));
  $("appearanceSummary").textContent=`${paletteNames[palette]} · ${mode==="dark"?"Sombre":"Clair"}`;
  document.querySelector('meta[name="theme-color"]').setAttribute("content",mode==="dark"?"#211e27":paletteColors[palette]);
}

$("personColor").replaceChildren(...BENEFICIARY_COLORS.map(([color,label])=>new Option(label,color)));
$("personColor").onchange=e=>{e.target.dataset.color=e.target.value};
$("personForm").onsubmit=e=>{
  e.preventDefault();
  const payload={name:$("personName").value.trim(),address:$("personAddress").value.trim(),phone:$("personPhone").value.trim(),notes:$("personNotes").value.trim(),color:$("personColor").value};
  if(!payload.name)return setVisitNotice("personError","Le nom est obligatoire.");
  const people=editingPersonId?db.people.map(p=>p.id===editingPersonId?{...p,...payload}:p):[...db.people,{id:uid("person"),...payload}];
  try{storePlanning({...db,people})}catch(error){return setVisitNotice("personError",error.message)}
  if(!editingPersonId)showArchivedPeople=false;
  $("personDialog").close();render();toast("Bénéficiaire enregistré.");
};
$("visitPersonButton").onclick=()=>{
  renderPersonPicker();
  setPickerTab(recentPeople.some(id=>{const p=person(id);return p&&!p.archived})?"recent":db.people.some(p=>!p.archived)?"all":"new");
  setVisitNotice("quickPersonError","");
  $("personPickerDialog").showModal();
};
$("pickerSearch").oninput=renderPersonPicker;
document.querySelectorAll(".segment").forEach(b=>b.onclick=()=>setPickerTab(b.dataset.pickerTab));
$("quickAddPersonBtn").onclick=()=>{
  const name=$("quickPersonName").value.trim(),phone=$("quickPersonPhone").value.trim();
  if(!name)return setVisitNotice("quickPersonError","Le nom est obligatoire.");
  const p={id:uid("person"),name,address:"",phone,notes:"",color:leastUsedColor(db.people)};
  try{storePlanning({...db,people:[...db.people,p]})}catch(error){return setVisitNotice("quickPersonError",error.message)}
  rememberRecentPerson(p.id);updateVisitPersonButton(p.id);$("quickPersonName").value="";$("quickPersonPhone").value="";
  $("personPickerDialog").close();render();
};

function movePeriod(direction){
  if(planningView==="month")return moveMonth(direction);
  selectedDate=addDays(selectedDate,direction*7);
  currentMonth=new Date(selectedDate);
  render();
}
function moveMonth(direction){
  selectedDate=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+direction,1);
  currentMonth=new Date(selectedDate);
  render();
}
$("prevPeriod").onclick=()=>movePeriod(-1);
$("nextPeriod").onclick=()=>movePeriod(1);
$("calendar").onclick=selectPlanningDay;
$("weekCalendar").onclick=selectPlanningDay;
document.querySelectorAll("[data-planning-view]").forEach(button=>button.onclick=()=>{
  planningView=button.dataset.planningView;
  localStorage.setItem(VIEW_KEY,planningView);
  renderPlanning();
});
$("todayBtn").onclick=()=>{currentMonth=new Date();selectedDate=new Date();showPage("planningPage");render()};
$("addVisitBtn").onclick=()=>openVisit();$("addPersonBtn").onclick=()=>openPerson();$("personSearch").oninput=renderPeople;
document.querySelectorAll(".nav-button").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll("[data-open-settings]").forEach(b=>b.onclick=()=>$(b.dataset.openSettings).showModal());
document.querySelectorAll(".palette-choice").forEach(b=>b.onclick=()=>applyAppearance(b.dataset.paletteChoice,document.documentElement.dataset.mode));
document.querySelectorAll(".mode-choice").forEach(b=>b.onclick=()=>applyAppearance(document.documentElement.dataset.palette,b.dataset.modeChoice));

function download(content,name,type){
  const link=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type}));
  link.href=url;
  link.download=name;
  link.hidden=true;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$("exportCsvBtn").onclick=()=>{
  const rows=[["Date","Bénéficiaire","Entrée","Sortie","Temps travaillé","Temps de trajet","Note","Statut","Durée du créneau"]];
  monthVisits().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).forEach(visit=>{
    const done=visit.status==="done",length=fmt(duration(visit.start,visit.end));
    const textCell=value=>/^[\s\uFEFF]*[=+@-]/.test(value)?`'${value}`:value;
    rows.push([visit.date,textCell(person(visit.personId)?.name||""),visit.start,visit.end,done?length:"",done?fmt(visitTravel(visit)):"",textCell(visit.note||""),statusLabel(visit),length]);
  });
  download("\ufeff"+rows.map(row=>row.map(cell=>`"${String(cell).replaceAll('"','""')}"`).join(";")).join("\n"),`aideplanning-${currentMonth.getFullYear()}-${pad(currentMonth.getMonth()+1)}.csv`,"text/csv;charset=utf-8");
};

let selectedBackup=null;
let backupReadVersion=0;

function dataCountsLabel({people,visits,trash}){
  return `${people} bénéficiaire${people>1?"s":""} · ${visitCount(visits)}${trash?` · ${visitCount(trash)} dans la corbeille`:""}`;
}

function showImportMessage(message,error=false){
  const status=$("importMessage");
  status.textContent=message;
  status.hidden=!message;
  status.classList.toggle("error",error);
}

function refreshImportPreview(){
  $("recoveryBackupBtn").hidden=!localStorage.getItem(RECOVERY_KEY);
  $("importPreview").hidden=!selectedBackup;
  if(!selectedBackup)return;

  const current=countPlanningData(db);
  const {additions}=mergePlanningData(db,selectedBackup);
  const hasAdditions=additions.people>0||additions.visits>0||additions.trash>0;
  $("importCounts").textContent=dataCountsLabel(countPlanningData(selectedBackup));
  $("importAdditions").textContent=hasAdditions?`À ajouter · ${dataCountsLabel(additions)}. Les fiches et visites existantes sont conservées.`:"Toutes les fiches et visites de ce fichier sont déjà présentes.";
  $("mergeBackupBtn").disabled=!hasAdditions;
  $("replaceBackupBtn").hidden=current.people===0&&current.visits===0&&current.trash===0;
}

function importBackup(replace){
  if(!selectedBackup)return;
  if(replace&&!confirm("Remplacer les bénéficiaires, les interventions et la corbeille par le contenu de cette sauvegarde ? AidePlanning conservera une copie des données actuelles."))return;

  let additions,next;
  try{
    const stored=localStorage.getItem(KEY);
    const current=stored===null?db:parsePlanningBackup(stored);
    if(replace){
      next=preparePlanningData(selectedBackup);
      localStorage.setItem(RECOVERY_KEY,JSON.stringify(current));
    }else{
      ({data:next,additions}=mergePlanningData(current,selectedBackup));
    }
    storePlanning(next,stored);
  }catch(error){
    showImportMessage(error.message||"Impossible d’enregistrer l’import. Vérifiez l’espace disponible sur l’appareil.",true);
    return;
  }
  selectedBackup=null;
  render();
  refreshImportPreview();
  const status=replace?"Sauvegarde restaurée.":`Import terminé. Éléments ajoutés · ${dataCountsLabel(additions)}.`;
  showImportMessage(status);
  $("chooseBackupBtn").focus();
}

$("chooseBackupBtn").onclick=()=>$("restoreInput").click();
$("restoreInput").onchange=async e=>{
  const [file]=e.target.files;
  e.target.value="";
  if(!file)return;
  const version=++backupReadVersion;
  selectedBackup=null;
  showImportMessage("Lecture de la sauvegarde…");
  refreshImportPreview();
  try{
    const fileText=await file.text();
    if(version!==backupReadVersion)return;
    selectedBackup=parsePlanningBackup(fileText);
    showImportMessage("");
    refreshImportPreview();
  }catch(error){
    if(version===backupReadVersion)showImportMessage(error.message||"Impossible de lire la sauvegarde.",true);
  }
};
$("dataDialog").addEventListener("close",()=>{
  backupReadVersion++;
  selectedBackup=null;
  showImportMessage("");
  refreshImportPreview();
});
$("mergeBackupBtn").onclick=()=>importBackup(false);
$("replaceBackupBtn").onclick=()=>importBackup(true);
$("recoveryBackupBtn").onclick=()=>{
  const stored=localStorage.getItem(RECOVERY_KEY);
  if(stored)download(stored,`aideplanning-avant-remplacement-${dateKey(new Date())}.json`,"application/json");
};
refreshImportPreview();


const FEEDBACK_ENDPOINT="https://script.google.com/macros/s/AKfycbzE9UqtjOEAfOv7DEW3uQ3hboZbz6fQYC9UxOqEXeJiR5iRFtAcy-7Tk5OiM9iBJtTZXA/exec";
const FEEDBACK_QUEUE_KEY="aideplanning_feedback_queue_v12";
const FEEDBACK_HISTORY_KEY="aideplanning_feedback_history_v12";
const APP_VERSION="14";
const feedbackConfigs={
  review:{type:"❤️ Avis",title:"Donner mon avis",emoji:"♥",intro:"Merci d’utiliser AidePlanning. Votre avis aide à améliorer l’application.",rating:true},
  bug:{type:"🐞 Bug",title:"Signaler un bug",emoji:"🐞",intro:"Décrivez précisément le problème rencontré afin qu’il puisse être corrigé.",rating:false},
  idea:{type:"💡 Suggestion",title:"Proposer une idée",emoji:"💡",intro:"Partagez une fonctionnalité ou une amélioration que vous aimeriez retrouver.",rating:false},
  contact:{type:"✉️ Contact",title:"Contacter le développeur",emoji:"✉️",intro:"Posez une question ou demandez à être rappelé(e).",rating:false}
};
let activeFeedbackType="review",feedbackRating=0,feedbackSending=false;
const writeJson=(key,value)=>localStorage.setItem(key,JSON.stringify(value));
function deviceDescription(){
  const ua=navigator.userAgent||"Appareil inconnu";
  const platform=/iPhone|iPad|iPod/i.test(ua)?"iPhone/iPad":/Android/i.test(ua)?"Android":"Ordinateur/autre";
  return `${platform} · ${screen.width}×${screen.height} · ${navigator.language||"fr"}`;
}
function clearFeedbackErrors(){document.querySelectorAll(".field-error").forEach(e=>e.textContent="");document.querySelectorAll("#feedbackForm .field.invalid").forEach(e=>e.classList.remove("invalid"))}
function setFeedbackError(id,message){const input=$(id),field=input.closest(".field");field?.classList.add("invalid");$(id+"Error").textContent=message}
function validFeedback(){
  clearFeedbackErrors();let ok=true;
  const name=$("feedbackName").value.trim(),phone=$("feedbackPhone").value.trim(),email=$("feedbackEmail").value.trim(),message=$("feedbackMessage").value.trim();
  if(!message){setFeedbackError("feedbackMessage","Le message est obligatoire.");ok=false}
  if(!name){setFeedbackError("feedbackName","Le prénom est obligatoire.");ok=false}
  if(!phone){setFeedbackError("feedbackPhone","Le téléphone est obligatoire.");ok=false}else if(phone.replace(/\D/g,"").length<8){setFeedbackError("feedbackPhone","Saisissez un numéro de téléphone valide.");ok=false}
  if(!email){setFeedbackError("feedbackEmail","L’e-mail est obligatoire.");ok=false}else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){setFeedbackError("feedbackEmail","Saisissez une adresse e-mail valide.");ok=false}
  return ok;
}
function openFeedback(type){
  activeFeedbackType=type;feedbackRating=0;clearFeedbackErrors();
  const c=feedbackConfigs[type];$("feedbackTitle").textContent=c.title;$("feedbackEmoji").textContent=c.emoji;$("feedbackIntro").textContent=c.intro;
  $("ratingBlock").style.display=c.rating?"block":"none";$("callbackBlock").style.display=type==="contact"?"flex":"none";
  $("feedbackForm").reset();document.querySelectorAll("#ratingStars button").forEach(b=>b.classList.remove("active"));$("feedbackDialog").showModal();
}
document.querySelectorAll("[data-open-feedback]").forEach(b=>b.onclick=()=>openFeedback(b.dataset.openFeedback));
document.querySelectorAll("#ratingStars button").forEach(b=>b.onclick=()=>{feedbackRating=Number(b.dataset.rating);document.querySelectorAll("#ratingStars button").forEach(x=>x.classList.toggle("active",Number(x.dataset.rating)<=feedbackRating))});
function buildFeedbackPayload(){
  const c=feedbackConfigs[activeFeedbackType];
  return {id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random()}`,date:new Date().toISOString(),type:c.type,note:c.rating?feedbackRating:"",message:$("feedbackMessage").value.trim(),nom:$("feedbackName").value.trim(),email:$("feedbackEmail").value.trim(),tel:$("feedbackPhone").value.trim(),rappel:$("feedbackCallback").checked?"Oui":"Non",version:APP_VERSION,appareil:deviceDescription()};
}
async function postFeedback(payload){
  await fetch(FEEDBACK_ENDPOINT,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(payload)});
}
function addHistory(payload,status){const history=readJson(FEEDBACK_HISTORY_KEY,[]);history.unshift({...payload,status});writeJson(FEEDBACK_HISTORY_KEY,history.slice(0,30));renderFeedbackHistory()}
function queueFeedback(payload){const queue=readJson(FEEDBACK_QUEUE_KEY,[]);if(!queue.some(x=>x.id===payload.id))queue.push(payload);writeJson(FEEDBACK_QUEUE_KEY,queue);addHistory(payload,"pending")}
function markHistorySent(id){const history=readJson(FEEDBACK_HISTORY_KEY,[]).map(x=>x.id===id?{...x,status:"sent"}:x);writeJson(FEEDBACK_HISTORY_KEY,history);renderFeedbackHistory()}
async function flushFeedbackQueue(silent=true){
  if(!navigator.onLine)return false;let queue=readJson(FEEDBACK_QUEUE_KEY,[]);if(!queue.length)return true;const remaining=[];
  for(const payload of queue){try{await postFeedback(payload);markHistorySent(payload.id)}catch{remaining.push(payload)}}writeJson(FEEDBACK_QUEUE_KEY,remaining);renderFeedbackHistory();if(!silent)toast(remaining.length?`${remaining.length} message(s) toujours en attente.`:"Tous les messages ont été envoyés.");return !remaining.length;
}
function renderFeedbackHistory(){
  const box=$("feedbackHistoryList");if(!box)return;const history=readJson(FEEDBACK_HISTORY_KEY,[]),queue=readJson(FEEDBACK_QUEUE_KEY,[]);$("retryFeedbackBtn").style.display=queue.length?"block":"none";
  box.innerHTML=history.length?history.map(x=>`<article class="feedback-history-item"><div><strong>${esc(x.type)}</strong><small>${new Date(x.date).toLocaleString("fr-FR")}</small></div><span class="status-pill ${x.status}">${x.status==="sent"?"Envoyé":"En attente"}</span><p>${esc(x.message)}</p></article>`).join(""):`<div class="empty-history"><span>💬</span><strong>Aucun envoi pour le moment</strong><p>Vos prochains retours apparaîtront ici.</p></div>`;
}
$("feedbackForm").onsubmit=async e=>{
  e.preventDefault();if(feedbackSending||!validFeedback())return;feedbackSending=true;const button=$("sendFeedbackBtn"),payload=buildFeedbackPayload();button.disabled=true;button.innerHTML="<span class='sending-spinner'></span> Envoi en cours…";
  try{
    if(!navigator.onLine)throw new Error("offline");await postFeedback(payload);addHistory(payload,"sent");$("feedbackDialog").close();$("feedbackSuccessText").textContent="Votre retour a bien été envoyé sans quitter AidePlanning.";$("feedbackSuccessDialog").showModal();
  }catch{
    queueFeedback(payload);$("feedbackDialog").close();$("feedbackSuccessText").textContent="Vous êtes hors ligne. Votre message est enregistré et sera renvoyé automatiquement dès que possible.";$("feedbackSuccessDialog").showModal();
  }finally{feedbackSending=false;button.disabled=false;button.innerHTML="<span>Envoyer sans quitter l’application</span>"}
};
$("retryFeedbackBtn").onclick=()=>flushFeedbackQueue(false);
addEventListener("online",()=>flushFeedbackQueue(true));
renderFeedbackHistory();
setTimeout(()=>flushFeedbackQueue(true),1200);
function finishOnboarding(){
  localStorage.setItem("aideplanning_onboarding_done","1");
  $("onboardingDialog").close();
}
$("startAppBtn").onclick=finishOnboarding;
$("onboardingImportBtn").onclick=()=>{
  finishOnboarding();
  showPage("morePage");
  $("dataDialog").showModal();
  $("chooseBackupBtn").focus();
};


let deferredInstallPrompt=null;

function isAppInstalled(){
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true ||
    document.referrer.startsWith("android-app://");
}

function updateInstallStatus(){
  const installed=isAppInstalled();
  const summary=$("installStatusSummary");
  const card=$("installStatusCard");
  const icon=$("installStatusIcon");
  const title=$("installStatusTitle");
  const text=$("installStatusText");
  const button=$("nativeInstallBtn");

  if(summary){
    summary.textContent=installed ? "Application installée" : "Installation indispensable";
  }
  if(card){
    card.classList.toggle("installed",installed);
    card.classList.toggle("recommended",!installed);
  }
  if(icon)icon.textContent=installed ? "✓" : "📲";
  if(title)title.textContent=installed ? "Application installée" : "Installation indispensable";
  if(text)text.textContent=installed
    ? "AidePlanning fonctionne depuis l’écran d’accueil."
    : "Installe AidePlanning sur l’écran d’accueil pour une utilisation et un stockage local plus fiables.";
  if(button)button.hidden=installed || !deferredInstallPrompt;
}

addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
  updateInstallStatus();
});

$("nativeInstallBtn")?.addEventListener("click",async()=>{
  if(!deferredInstallPrompt)return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt=null;
  updateInstallStatus();
});

addEventListener("appinstalled",()=>{
  deferredInstallPrompt=null;
  updateInstallStatus();
  toast("AidePlanning est maintenant installé.");
});

window.matchMedia("(display-mode: standalone)").addEventListener?.("change",updateInstallStatus);
updateInstallStatus();

/* Évite qu’un champ encore actif laisse Safari/iOS dans un état zoomé après validation. */
function releaseMobileFocus(){
  const active=document.activeElement;
  if(active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName))active.blur();
  requestAnimationFrame(()=>window.scrollTo({top:Math.max(0,window.scrollY),left:0,behavior:"auto"}));
}
document.addEventListener("submit",()=>setTimeout(releaseMobileFocus,0),true);
document.addEventListener("close",releaseMobileFocus,true);

const legacyTheme=localStorage.getItem("aideplanning_theme");
let initialPalette=localStorage.getItem(PALETTE_KEY);
let initialMode=localStorage.getItem(MODE_KEY);
if(!initialPalette && legacyTheme){
  if(legacyTheme==="dark"){initialPalette="rose";initialMode="dark"}
  else if(legacyTheme==="light"){initialPalette="rose";initialMode="light"}
  else{initialPalette=legacyTheme;initialMode="light"}
}
applyAppearance(initialPalette||"rose",initialMode||"light");
if(!localStorage.getItem("aideplanning_onboarding_done")&&!db.people.length&&!countPlanningData(db).visits){
  $("onboardingDialog").showModal();
}
if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
bindWorkflows();
render();
