
const KEY="aideplanning_v2";
const PALETTE_KEY="aideplanning_palette";
const MODE_KEY="aideplanning_mode";
const RECENT_KEY="aideplanning_recent_people";
let db=loadDatabase();
let currentMonth=new Date(),selectedDate=new Date(),editingVisitId=null,editingPersonId=null;
let recentPeople=JSON.parse(localStorage.getItem(RECENT_KEY)||"[]");

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
  for(const key of ["aideplanning_v2","aideplanning_v1","aideplanning_data_v1"]){
    try{
      const parsed=JSON.parse(localStorage.getItem(key)||"null");
      if(parsed&&Array.isArray(parsed.people)&&parsed.visits&&typeof parsed.visits==="object"){
        localStorage.setItem(KEY,JSON.stringify(parsed));return parsed;
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
  const sorted=[...visits].sort((a,b)=>a.start.localeCompare(b.start)),pairs=[];
  for(let i=0;i<sorted.length-1;i++)if(parseTime(sorted[i+1].start)<parseTime(sorted[i].end))pairs.push([sorted[i],sorted[i+1]]);
  return pairs;
}
function rememberRecentPerson(id){
  recentPeople=[id,...recentPeople.filter(x=>x!==id)].slice(0,6);
  localStorage.setItem(RECENT_KEY,JSON.stringify(recentPeople));
}
function render(){renderCalendar();renderDay();renderPeople();renderStats();renderRecent()}

function renderCalendar(){
  const y=currentMonth.getFullYear(),m=currentMonth.getMonth(),mv=monthVisits();
  const work=mv.reduce((s,v)=>s+duration(v.start,v.end),0),travel=mv.reduce((s,v)=>s+visitTravel(v),0);
  $("monthTitle").textContent=currentMonth.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("monthInfo").textContent=`${mv.length} visite${mv.length>1?"s":""} · ${fmt(work)} travaillé · ${fmt(travel)} trajet`;
  $("calendar").innerHTML="";
  const offset=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();
  for(let i=0;i<offset;i++){const b=document.createElement("button");b.className="day empty";b.disabled=true;$("calendar").appendChild(b)}
  for(let d=1;d<=days;d++){
    const dt=new Date(y,m,d),k=dateKey(dt),visits=orderedVisits(k),workDay=visits.reduce((s,v)=>s+duration(v.start,v.end),0);
    const b=document.createElement("button");
    b.className="day"+(k===dateKey(new Date())?" today":"")+(k===dateKey(selectedDate)?" selected":"")+(visits.length?" has":"")+(overlapPairs(visits).length?" warning":"");
    b.innerHTML=`<b>${d}</b><span class="day-meta">${visits.length?`${visits.length} visite${visits.length>1?"s":""}<br>${fmt(workDay)}`:""}</span>`;
    b.onclick=()=>{selectedDate=dt;render()};$("calendar").appendChild(b);
  }
}
function renderDay(){
  const visits=orderedVisits(dateKey(selectedDate)),work=visits.reduce((s,v)=>s+duration(v.start,v.end),0),travel=visits.reduce((s,v)=>s+visitTravel(v),0);
  $("selectedDateTitle").textContent=selectedDate.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});
  $("dayWorkTotal").textContent=fmt(work);$("dayTravelTotal").textContent=`Trajet ${fmt(travel)}`;
  const overlaps=overlapPairs(visits);
  $("dayWarnings").innerHTML=overlaps.length?`<div class="warning-box">⚠️ ${overlaps.length} chevauchement${overlaps.length>1?"s":""} détecté${overlaps.length>1?"s":""}.</div>`:"";
  const list=$("visitsList");list.innerHTML="";
  if(!visits.length){list.innerHTML='<div class="empty-state">Aucune intervention pour cette journée.</div>';return}
  visits.forEach(v=>{
    const p=person(v.personId),b=document.createElement("button");b.className="visit-card";
    b.innerHTML=`<div><h3>${esc(p?.name||"Personne supprimée")}</h3><div class="visit-time">${v.start} → ${v.end}</div>${v.note?`<div class="visit-note">${esc(v.note)}</div>`:""}</div><div class="visit-side"><strong>${fmt(duration(v.start,v.end))}</strong><span>Trajet ${fmt(visitTravel(v))}</span></div>`;
    b.onclick=()=>openVisit(v.id);list.appendChild(b);
  });
}
function renderPeople(){
  const q=$("personSearch").value.trim().toLowerCase(),list=$("peopleList");list.innerHTML="";
  const filtered=[...db.people].sort((a,b)=>a.name.localeCompare(b.name,"fr")).filter(p=>(p.name+" "+(p.address||"")+" "+(p.phone||"")).toLowerCase().includes(q));
  if(!filtered.length){list.innerHTML='<div class="panel empty-state">Aucun bénéficiaire enregistré.</div>';return}
  filtered.forEach(p=>{
    const all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===p.id).map(x=>({...x,date})));
    const card=document.createElement("article");card.className="person-card";
    card.innerHTML=`<h3>${esc(p.name)}</h3><div class="person-meta">${p.address?`📍 ${esc(p.address)}<br>`:""}${p.phone?`📞 ${esc(p.phone)}<br>`:""}${all.length} intervention${all.length>1?"s":""} · ${fmt(all.reduce((s,v)=>s+duration(v.start,v.end),0))}</div><div class="person-actions"><button class="mini-button detail">Voir la fiche</button><button class="mini-button edit">Modifier</button></div>`;
    card.querySelector(".detail").onclick=()=>openPersonDetail(p.id);card.querySelector(".edit").onclick=()=>openPerson(p.id);list.appendChild(card);
  });
}
function mondayOf(date){const d=new Date(date),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d}
function renderStats(){
  const mv=monthVisits(),work=mv.reduce((s,v)=>s+duration(v.start,v.end),0),travel=mv.reduce((s,v)=>s+visitTravel(v),0);
  $("statsTitle").textContent=currentMonth.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});
  $("statWork").textContent=fmt(work);$("statTravel").textContent=fmt(travel);$("statVisits").textContent=mv.length;$("statDays").textContent=new Set(mv.map(v=>v.date)).size;
  const totals={};mv.forEach(v=>totals[v.personId]=(totals[v.personId]||0)+duration(v.start,v.end));
  $("personStats").innerHTML=Object.entries(totals).sort((a,b)=>b[1]-a[1]).map(([id,m])=>`<div class="person-stat"><span>${esc(person(id)?.name||"Personne supprimée")}</span><strong>${fmt(m)}</strong></div>`).join("")||'<div class="empty-state">Aucune donnée ce mois-ci.</div>';
  const weeks={};mv.forEach(v=>{const k=dateKey(mondayOf(new Date(v.date+"T12:00:00")));weeks[k]??={work:0,travel:0};weeks[k].work+=duration(v.start,v.end);weeks[k].travel+=visitTravel(v)});
  $("weekStats").innerHTML=Object.entries(weeks).sort().map(([k,w])=>`<div class="week-stat"><span>Semaine du ${new Date(k+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span><strong>${fmt(w.work)} + ${fmt(w.travel)}</strong></div>`).join("")||'<div class="empty-state">Aucune donnée ce mois-ci.</div>';
}
function renderRecent(){
  const recent=recentPeople.map(person).filter(Boolean);
  $("recentPeopleList").innerHTML=recent.length?recent.map(p=>`<button class="picker-person recent-person" data-person-id="${p.id}"><span><strong>${esc(p.name)}</strong>${p.phone?`<small>${esc(p.phone)}</small>`:""}</span><span>›</span></button>`).join(""):'<div class="empty-state">Aucun bénéficiaire récent.</div>';
  document.querySelectorAll(".recent-person").forEach(b=>b.onclick=()=>openPersonDetail(b.dataset.personId));
  const all=Object.entries(db.visits).flatMap(([date,v])=>v.map(x=>({...x,date}))).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start)).slice(0,8);
  $("recentVisitsList").innerHTML=all.length?all.map(v=>`<button class="visit-card recent-visit" data-date="${v.date}" data-id="${v.id}"><div><h3>${esc(person(v.personId)?.name||"Personne supprimée")}</h3><div class="visit-time">${new Date(v.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · ${v.start} → ${v.end}</div></div><div class="visit-side"><strong>${fmt(duration(v.start,v.end))}</strong></div></button>`).join(""):'<div class="empty-state">Aucune intervention récente.</div>';
  document.querySelectorAll(".recent-visit").forEach(b=>b.onclick=()=>{selectedDate=new Date(b.dataset.date+"T12:00:00");currentMonth=new Date(selectedDate);showPage("planningPage");render();setTimeout(()=>openVisit(b.dataset.id),50)});
}
function updateVisitPersonButton(id=""){const p=person(id);$("visitPerson").value=id||"";$("visitPersonLabel").textContent=p?.name||"Choisir une personne"}
function pickerPersonButton(p){return `<button type="button" class="picker-person" data-person-id="${p.id}"><span><strong>${esc(p.name)}</strong>${p.phone?`<small>${esc(p.phone)}</small>`:""}</span><span>›</span></button>`}
function bindPickerButtons(){document.querySelectorAll("#personPickerDialog .picker-person").forEach(b=>b.onclick=()=>{updateVisitPersonButton(b.dataset.personId);rememberRecentPerson(b.dataset.personId);$("personPickerDialog").close()})}
function renderPersonPicker(){
  const recent=recentPeople.map(person).filter(Boolean);
  $("pickerRecentList").innerHTML=recent.length?recent.map(pickerPersonButton).join(""):'<div class="empty-state">Aucun bénéficiaire récent.</div>';
  const q=$("pickerSearch").value.trim().toLowerCase();
  const all=[...db.people].sort((a,b)=>a.name.localeCompare(b.name,"fr")).filter(p=>(p.name+" "+(p.phone||"")).toLowerCase().includes(q));
  $("pickerAllList").innerHTML=all.length?all.map(pickerPersonButton).join(""):'<div class="empty-state">Aucun bénéficiaire trouvé.</div>';
  bindPickerButtons();
}
function setPickerTab(tab){
  document.querySelectorAll(".segment").forEach(b=>b.classList.toggle("active",b.dataset.pickerTab===tab));
  $("pickerRecentPanel").classList.toggle("active",tab==="recent");$("pickerAllPanel").classList.toggle("active",tab==="all");$("pickerNewPanel").classList.toggle("active",tab==="new");
}
function openVisit(id=null){
  if(!db.people.length){toast("Ajoute d’abord un bénéficiaire.");showPage("peoplePage");return}
  editingVisitId=id;const v=(db.visits[dateKey(selectedDate)]||[]).find(x=>x.id===id);
  $("visitDialogTitle").textContent=v?"Modifier l’intervention":"Ajouter une intervention";
  updateVisitPersonButton(v?.personId||"");$("visitStart").value=v?.start||"08:00";$("visitEnd").value=v?.end||"09:00";$("visitTravel").value=v?.travel||"00:00";$("visitNote").value=v?.note||"";
  $("deleteVisitBtn").style.display=v?"block":"none";$("visitDialog").showModal();
}
function openPerson(id=null){
  editingPersonId=id;const p=person(id);
  $("personDialogTitle").textContent=p?"Modifier le bénéficiaire":"Ajouter un bénéficiaire";
  $("personName").value=p?.name||"";$("personAddress").value=p?.address||"";$("personPhone").value=p?.phone||"";$("personNotes").value=p?.notes||"";
  $("deletePersonBtn").style.display=p?"block":"none";$("personDialog").showModal();
}
function openPersonDetail(id){
  const p=person(id);if(!p)return;
  const all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===id).map(x=>({...x,date}))).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));
  $("detailName").textContent=p.name;
  $("detailContact").innerHTML=`${p.address?`<div>📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank">${esc(p.address)}</a></div>`:""}${p.phone?`<div>📞 <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a></div>`:""}${p.notes?`<div>📝 ${esc(p.notes)}</div>`:""}`;
  $("detailWork").textContent=fmt(all.reduce((s,v)=>s+duration(v.start,v.end),0));$("detailTravel").textContent=fmt(all.reduce((s,v)=>s+visitTravel(v),0));$("detailVisits").textContent=all.length;
  $("detailHistory").innerHTML=all.map(v=>`<div class="history-item"><div class="row"><strong>${new Date(v.date+"T12:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</strong><span>${fmt(duration(v.start,v.end))}</span></div><div>${v.start} → ${v.end} · trajet ${fmt(visitTravel(v))}</div>${v.note?`<div class="visit-note">${esc(v.note)}</div>`:""}</div>`).join("")||'<div class="empty-state">Aucune intervention.</div>';
  $("personDetailDialog").showModal();
}
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
  document.querySelectorAll(".nav-button").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
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

$("visitForm").onsubmit=e=>{
  e.preventDefault();const k=dateKey(selectedDate),payload={personId:$("visitPerson").value,start:$("visitStart").value,end:$("visitEnd").value,travel:$("visitTravel").value||"00:00",note:$("visitNote").value.trim()};
  if(!payload.personId)return toast("Choisis un bénéficiaire.");if(duration(payload.start,payload.end)<=0)return toast("Les horaires sont invalides.");
  db.visits[k]??=[];
  if(editingVisitId){const i=db.visits[k].findIndex(v=>v.id===editingVisitId);db.visits[k][i]={...db.visits[k][i],...payload}}else db.visits[k].push({id:uid("visit"),...payload});
  rememberRecentPerson(payload.personId);save();$("visitDialog").close();render();toast("Intervention enregistrée.");
};
$("deleteVisitBtn").onclick=()=>{const k=dateKey(selectedDate);db.visits[k]=(db.visits[k]||[]).filter(v=>v.id!==editingVisitId);if(!db.visits[k].length)delete db.visits[k];save();$("visitDialog").close();render();toast("Intervention supprimée.")};
$("personForm").onsubmit=e=>{e.preventDefault();const payload={name:$("personName").value.trim(),address:$("personAddress").value.trim(),phone:$("personPhone").value.trim(),notes:$("personNotes").value.trim()};if(!payload.name)return toast("Le nom est obligatoire.");if(editingPersonId){const i=db.people.findIndex(p=>p.id===editingPersonId);db.people[i]={...db.people[i],...payload}}else db.people.push({id:uid("person"),...payload});save();$("personDialog").close();render();toast("Bénéficiaire enregistré.")};
$("deletePersonBtn").onclick=()=>{if(!confirm("Supprimer ce bénéficiaire et ses interventions ?"))return;db.people=db.people.filter(p=>p.id!==editingPersonId);Object.keys(db.visits).forEach(k=>{db.visits[k]=db.visits[k].filter(v=>v.personId!==editingPersonId);if(!db.visits[k].length)delete db.visits[k]});save();$("personDialog").close();render();toast("Bénéficiaire supprimé.")};
$("visitPersonButton").onclick=()=>{renderPersonPicker();setPickerTab(recentPeople.length?"recent":"all");$("personPickerDialog").showModal()};
$("pickerSearch").oninput=renderPersonPicker;
document.querySelectorAll(".segment").forEach(b=>b.onclick=()=>setPickerTab(b.dataset.pickerTab));
$("quickAddPersonBtn").onclick=()=>{const name=$("quickPersonName").value.trim(),phone=$("quickPersonPhone").value.trim();if(!name)return toast("Le nom est obligatoire.");const p={id:uid("person"),name,address:"",phone,notes:""};db.people.push(p);save();rememberRecentPerson(p.id);updateVisitPersonButton(p.id);$("quickPersonName").value="";$("quickPersonPhone").value="";$("personPickerDialog").close();render();toast("Bénéficiaire créé.")};
$("prevMonth").onclick=()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()-1,1);selectedDate=new Date(currentMonth);render()};
$("nextMonth").onclick=()=>{currentMonth=new Date(currentMonth.getFullYear(),currentMonth.getMonth()+1,1);selectedDate=new Date(currentMonth);render()};
$("todayBtn").onclick=()=>{currentMonth=new Date();selectedDate=new Date();showPage("planningPage");render()};
$("addVisitBtn").onclick=()=>openVisit();$("addPersonBtn").onclick=()=>openPerson();$("personSearch").oninput=renderPeople;
document.querySelectorAll(".nav-button").forEach(b=>b.onclick=()=>showPage(b.dataset.page));
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
document.querySelectorAll("[data-open-settings]").forEach(b=>b.onclick=()=>$(b.dataset.openSettings).showModal());
document.querySelectorAll(".palette-choice").forEach(b=>b.onclick=()=>applyAppearance(b.dataset.paletteChoice,document.documentElement.dataset.mode));
document.querySelectorAll(".mode-choice").forEach(b=>b.onclick=()=>applyAppearance(document.documentElement.dataset.palette,b.dataset.modeChoice));

function download(content,name,type){const a=document.createElement("a"),url=URL.createObjectURL(new Blob([content],{type}));a.href=url;a.download=name;a.click();URL.revokeObjectURL(url)}
$("exportCsvBtn").onclick=()=>{const rows=[["Date","Bénéficiaire","Entrée","Sortie","Temps travaillé","Temps de trajet","Note"]];monthVisits().sort((a,b)=>(a.date+a.start).localeCompare(b.date+b.start)).forEach(v=>rows.push([v.date,person(v.personId)?.name||"",v.start,v.end,fmt(duration(v.start,v.end)),fmt(visitTravel(v)),v.note||""]));download("\ufeff"+rows.map(r=>r.map(c=>`"${String(c).replaceAll('"','""')}"`).join(";")).join("\n"),`aideplanning-${currentMonth.getFullYear()}-${pad(currentMonth.getMonth()+1)}.csv`,"text/csv;charset=utf-8")};
$("backupBtn").onclick=()=>download(JSON.stringify(db,null,2),`aideplanning-sauvegarde-${new Date().toISOString().slice(0,10)}.json`,"application/json");
$("restoreInput").onchange=async e=>{try{const parsed=JSON.parse(await e.target.files[0].text());if(!parsed.people||!parsed.visits)throw new Error();if(confirm("Remplacer toutes les données actuelles ?")){db=parsed;save();render();toast("Sauvegarde restaurée.")}}catch{toast("Sauvegarde invalide.")}e.target.value=""};


const FEEDBACK_ENDPOINT="https://script.google.com/macros/s/AKfycbxt_GkfUpeiDKYfY4jWr3dd1QOxVtTe9kt_ozQIoNlLt20md7Ax_aBdHvPjeUTTrWzOeA/exec";
const FEEDBACK_QUEUE_KEY="aideplanning_feedback_queue_v12";
const FEEDBACK_HISTORY_KEY="aideplanning_feedback_history_v12";
const APP_VERSION="12 Premium";
const feedbackConfigs={
  review:{type:"❤️ Avis",title:"Donner mon avis",emoji:"♥",intro:"Merci d’utiliser AidePlanning. Votre avis aide à améliorer l’application.",rating:true},
  bug:{type:"🐞 Bug",title:"Signaler un bug",emoji:"🐞",intro:"Décrivez précisément le problème rencontré afin qu’il puisse être corrigé.",rating:false},
  idea:{type:"💡 Suggestion",title:"Proposer une idée",emoji:"💡",intro:"Partagez une fonctionnalité ou une amélioration que vous aimeriez retrouver.",rating:false},
  contact:{type:"✉️ Contact",title:"Contacter le développeur",emoji:"✉️",intro:"Posez une question ou demandez à être rappelé(e).",rating:false}
};
let activeFeedbackType="review",feedbackRating=0,feedbackSending=false;
const readJson=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))||fallback}catch{return fallback}};
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
$("startAppBtn").onclick=()=>{localStorage.setItem("aideplanning_onboarding_done","1");$("onboardingDialog").close()};

const legacyTheme=localStorage.getItem("aideplanning_theme");
let initialPalette=localStorage.getItem(PALETTE_KEY);
let initialMode=localStorage.getItem(MODE_KEY);
if(!initialPalette && legacyTheme){
  if(legacyTheme==="dark"){initialPalette="rose";initialMode="dark"}
  else if(legacyTheme==="light"){initialPalette="rose";initialMode="light"}
  else{initialPalette=legacyTheme;initialMode="light"}
}
applyAppearance(initialPalette||"rose",initialMode||"light");
if(!localStorage.getItem("aideplanning_onboarding_done"))setTimeout(()=>$("onboardingDialog").showModal(),250);
if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(console.warn));
render();
