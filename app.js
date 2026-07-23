const KEY="aideplanning_v2",fallback='{"people":[],"visits":{}}';let db=JSON.parse(localStorage.getItem(KEY)||fallback),month=new Date(),selected=new Date(),editVisit=null,editPerson=null;const $=x=>document.getElementById(x),pad=n=>String(n).padStart(2,"0"),key=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,uid=p=>p+Date.now()+Math.random().toString(36).slice(2),person=id=>db.people.find(p=>p.id===id),mins=t=>{if(!t)return 0;let[a,b]=t.split(":").map(Number);return a*60+b},dur=(a,b)=>{let x=mins(a),y=mins(b);if(y<x)y+=1440;return Math.max(0,y-x)},fmt=m=>`${Math.floor(m/60)}h${pad(m%60)}`,save=()=>localStorage.setItem(KEY,JSON.stringify(db)),esc=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])),travel=v=>mins(v.travel||"00:00");
function toast(t){$("toast").textContent=t;$("toast").style.display="block";setTimeout(()=>$("toast").style.display="none",1800)}
function monthVisits(){let p=`${month.getFullYear()}-${pad(month.getMonth()+1)}-`;return Object.entries(db.visits).filter(([d])=>d.startsWith(p)).flatMap(([date,v])=>v.map(x=>({...x,date})))}
function render(){renderCal();renderDay();renderPeople();renderStats()}
function renderCal(){let y=month.getFullYear(),m=month.getMonth(),mv=monthVisits(),w=mv.reduce((s,v)=>s+dur(v.start,v.end),0),tr=mv.reduce((s,v)=>s+travel(v),0);$("month").textContent=month.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});$("monthInfo").textContent=`${mv.length} visite${mv.length>1?"s":""} · ${fmt(w)} travail · ${fmt(tr)} trajet`;$("calendar").innerHTML="";let off=(new Date(y,m,1).getDay()+6)%7,days=new Date(y,m+1,0).getDate();for(let i=0;i<off;i++)$("calendar").innerHTML+='<button class="day empty"></button>';for(let d=1;d<=days;d++){let dt=new Date(y,m,d),k=key(dt),v=db.visits[k]||[],t=v.reduce((s,x)=>s+dur(x.start,x.end),0),b=document.createElement("button");b.className="day"+(k===key(new Date())?" today":"")+(k===key(selected)?" selected":"")+(v.length?" has":"");b.innerHTML=`<b>${d}</b><span class="meta">${v.length?v.length+" visite"+(v.length>1?"s":"")+"<br>"+fmt(t):""}</span>`;b.onclick=()=>{selected=dt;render()};$("calendar").appendChild(b)}}
function renderDay(){let v=[...(db.visits[key(selected)]||[])].sort((a,b)=>a.start.localeCompare(b.start));$("dayTitle").textContent=selected.toLocaleDateString("fr-FR",{weekday:"long",day:"numeric",month:"long"});$("dayWork").textContent=fmt(v.reduce((s,x)=>s+dur(x.start,x.end),0));$("dayTravel").textContent="Trajet "+fmt(v.reduce((s,x)=>s+travel(x),0));$("visits").innerHTML=v.length?"":'<p>Aucune intervention.</p>';v.forEach(x=>{let b=document.createElement("button");b.className="visit";b.innerHTML=`<span><h3>${esc(person(x.personId)?.name||"Personne supprimée")}</h3><b>${x.start} → ${x.end}</b>${x.note?`<p>${esc(x.note)}</p>`:""}</span><span><strong>${fmt(dur(x.start,x.end))}</strong><small>Trajet ${fmt(travel(x))}</small></span>`;b.onclick=()=>openVisit(x.id);$("visits").appendChild(b)})}
function renderPeople(){let q=$("search").value.toLowerCase(),list=$("peopleList");list.innerHTML="";db.people.filter(p=>(p.name+p.address+p.phone).toLowerCase().includes(q)).sort((a,b)=>a.name.localeCompare(b.name)).forEach(p=>{let all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===p.id).map(x=>({...x,date}))),a=document.createElement("article");a.className="person";a.innerHTML=`<h3>${esc(p.name)}</h3><p>${p.address?"📍 "+esc(p.address)+"<br>":""}${p.phone?"📞 "+esc(p.phone)+"<br>":""}${all.length} intervention${all.length>1?"s":""} · ${fmt(all.reduce((s,v)=>s+dur(v.start,v.end),0))}</p><button class="detailBtn">Voir la fiche</button> <button class="editBtn">Modifier</button>`;a.querySelector(".detailBtn").onclick=()=>openDetail(p.id);a.querySelector(".editBtn").onclick=()=>openPerson(p.id);list.appendChild(a)});if(!list.children.length)list.innerHTML='<div class="card"><p>Aucun bénéficiaire enregistré.</p></div>'}
function renderStats(){let mv=monthVisits(),w=mv.reduce((s,v)=>s+dur(v.start,v.end),0),tr=mv.reduce((s,v)=>s+travel(v),0);$("statsTitle").textContent=month.toLocaleDateString("fr-FR",{month:"long",year:"numeric"});$("sWork").textContent=fmt(w);$("sTravel").textContent=fmt(tr);$("sVisits").textContent=mv.length;$("sDays").textContent=new Set(mv.map(v=>v.date)).size;let t={};mv.forEach(v=>t[v.personId]=(t[v.personId]||0)+dur(v.start,v.end));$("personStats").innerHTML=Object.entries(t).sort((a,b)=>b[1]-a[1]).map(([id,m])=>`<div class="personStat"><span>${esc(person(id)?.name||"Supprimé")}</span><strong>${fmt(m)}</strong></div>`).join("")||"<p>Aucune donnée ce mois-ci.</p>"}
function openVisit(id){if(!db.people.length){toast("Ajoutez d’abord un bénéficiaire");show("people");return}editVisit=id;let v=(db.visits[key(selected)]||[]).find(x=>x.id===id);$("visitTitle").textContent=v?"Modifier l’intervention":"Ajouter une intervention";$("visitPerson").innerHTML='<option value="">Choisir</option>'+db.people.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join("");$("visitPerson").value=v?.personId||"";$("start").value=v?.start||"08:00";$("end").value=v?.end||"09:00";$("travel").value=v?.travel||"00:00";$("visitNote").value=v?.note||"";$("deleteVisit").style.display=v?"block":"none";$("visitDlg").showModal()}
function openPerson(id){editPerson=id;let p=person(id);$("personTitle").textContent=p?"Modifier le bénéficiaire":"Ajouter un bénéficiaire";$("personName").value=p?.name||"";$("address").value=p?.address||"";$("phone").value=p?.phone||"";$("notes").value=p?.notes||"";$("deletePerson").style.display=p?"block":"none";$("personDlg").showModal()}
function openDetail(id){let p=person(id),all=Object.entries(db.visits).flatMap(([date,v])=>v.filter(x=>x.personId===id).map(x=>({...x,date}))).sort((a,b)=>(b.date+b.start).localeCompare(a.date+a.start));$("detailName").textContent=p.name;$("detailContact").innerHTML=`${p.address?`📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank">${esc(p.address)}</a><br>`:""}${p.phone?`📞 <a href="tel:${esc(p.phone)}">${esc(p.phone)}</a><br>`:""}${p.notes?`📝 ${esc(p.notes)}`:""}`;$("dWork").textContent=fmt(all.reduce((s,v)=>s+dur(v.start,v.end),0));$("dTravel").textContent=fmt(all.reduce((s,v)=>s+travel(v),0));$("dVisits").textContent=all.length;$("history").innerHTML=all.map(v=>`<div class="historyItem"><div class="row"><strong>${new Date(v.date+"T12:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long",year:"numeric"})}</strong><span>${fmt(dur(v.start,v.end))}</span></div><div>${v.start} → ${v.end} · trajet ${fmt(travel(v))}</div>${v.note?`<p>${esc(v.note)}</p>`:""}</div>`).join("")||"<p>Aucune intervention.</p>";$("detailDlg").showModal()}
function show(id){document.querySelectorAll(".page").forEach(x=>x.classList.toggle("active",x.id===id));document.querySelectorAll("nav button").forEach(x=>x.classList.toggle("active",x.dataset.page===id))}
$("visitForm").onsubmit=e=>{e.preventDefault();let k=key(selected),v={personId:$("visitPerson").value,start:$("start").value,end:$("end").value,travel:$("travel").value||"00:00",note:$("visitNote").value};db.visits[k]??=[];if(editVisit){let i=db.visits[k].findIndex(x=>x.id===editVisit);db.visits[k][i]={...db.visits[k][i],...v}}else db.visits[k].push({id:uid("v"),...v});save();$("visitDlg").close();render();toast("Intervention enregistrée")};
$("personForm").onsubmit=e=>{e.preventDefault();let v={name:$("personName").value,address:$("address").value,phone:$("phone").value,notes:$("notes").value};if(editPerson){let i=db.people.findIndex(x=>x.id===editPerson);db.people[i]={...db.people[i],...v}}else db.people.push({id:uid("p"),...v});save();$("personDlg").close();render();toast("Bénéficiaire enregistré")};
$("deleteVisit").onclick=()=>{let k=key(selected);db.visits[k]=db.visits[k].filter(x=>x.id!==editVisit);if(!db.visits[k].length)delete db.visits[k];save();$("visitDlg").close();render()};
$("deletePerson").onclick=()=>{if(!confirm("Supprimer cette personne et ses interventions ?"))return;db.people=db.people.filter(x=>x.id!==editPerson);Object.keys(db.visits).forEach(k=>{db.visits[k]=db.visits[k].filter(v=>v.personId!==editPerson);if(!db.visits[k].length)delete db.visits[k]});save();$("personDlg").close();render()};
$("addVisit").onclick=()=>openVisit();$("addPerson").onclick=()=>openPerson();$("search").oninput=renderPeople;$("prev").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()-1,1);selected=new Date(month);render()};$("next").onclick=()=>{month=new Date(month.getFullYear(),month.getMonth()+1,1);selected=new Date(month);render()};$("today").onclick=()=>{month=new Date();selected=new Date();show("planning");render()};document.querySelectorAll("nav button").forEach(b=>b.onclick=()=>show(b.dataset.page));document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>$(b.dataset.close).close());
function download(content,name,type){let a=document.createElement("a"),u=URL.createObjectURL(new Blob([content],{type}));a.href=u;a.download=name;a.click();URL.revokeObjectURL(u)}
$("csv").onclick=()=>{let r=[["Date","Bénéficiaire","Entrée","Sortie","Temps travaillé","Temps trajet","Note"]];monthVisits().forEach(v=>r.push([v.date,person(v.personId)?.name||"",v.start,v.end,fmt(dur(v.start,v.end)),fmt(travel(v)),v.note]));download("\ufeff"+r.map(x=>x.map(c=>`"${String(c).replaceAll('"','""')}"`).join(";")).join("\n"),"aideplanning.csv","text/csv")};
$("backup").onclick=()=>download(JSON.stringify(db,null,2),"aideplanning-sauvegarde.json","application/json");$("restore").onchange=async e=>{try{let x=JSON.parse(await e.target.files[0].text());if(!x.people||!x.visits)throw 0;if(confirm("Remplacer les données actuelles ?")){db=x;save();render();toast("Sauvegarde restaurée")}}catch{toast("Fichier invalide")}};


function normalizeOcrText(text){
  return text
    .replace(/[|]/g,"I")
    .replace(/[–—−]/g,"-")
    .replace(/[’`]/g,"'")
    .replace(/\r/g,"")
    .trim();
}
function cleanOcrName(raw){
  return raw
    .replace(/^[^A-Za-zÀ-ÿ]*(?:M\.?|Mme|Madame|Monsieur)?\s*/i, m => m)
    .replace(/\s+[iIlL1]$/,"")
    .replace(/[©®•■□▪]+/g," ")
    .replace(/\s+/g," ")
    .trim();
}
function bestPersonMatch(raw){
  const q=raw.toLowerCase().replace(/[^a-zà-ÿ0-9 ]/gi," ").replace(/\s+/g," ").trim();
  if(!q)return "";
  let best="",score=0;
  db.people.forEach(p=>{
    const name=p.name.toLowerCase().replace(/[^a-zà-ÿ0-9 ]/gi," ");
    const words=q.split(/\s+/).filter(w=>w.length>2);
    let s=words.filter(w=>name.includes(w)).length;
    if(name.includes(q)||q.includes(name))s+=4;
    if(s>score){score=s;best=p.id}
  });
  return score>0?best:"";
}
const MONTHS_FR={
  janvier:1,fevrier:2,février:2,mars:3,avril:4,mai:5,juin:6,
  juillet:7,aout:8,août:8,septembre:9,octobre:10,novembre:11,decembre:12,décembre:12
};
function parseFrenchDate(line, fallbackDate){
  const normalized=line.toLowerCase().replace(/[^\wà-ÿ ]/g," ").replace(/\s+/g," ");
  const m=normalized.match(/(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)?\s*(\d{1,2})\s+([a-zà-ÿ]+)\s+(\d{4})/i);
  if(!m)return fallbackDate;
  const monthNum=MONTHS_FR[m[2]];
  if(!monthNum)return fallbackDate;
  return `${m[3]}-${pad(monthNum)}-${pad(Number(m[1]))}`;
}
function normalizeTimePart(value){
  return value
    .replace(/[oO]/g,"0")
    .replace(/[lI|]/g,"1")
    .replace(/[;,]/g,":")
    .replace(/\s/g,"");
}
function extractTimeRange(line){
  const normalized=normalizeTimePart(line)
    .replace(/(\d{1,2})[hH.](\d{2})/g,"$1:$2")
    .replace(/\bde\b/ig," ")
    .replace(/\b[aà]\b/ig," - ")
    .replace(/→/g,"-");
  const m=normalized.match(/(\d{1,2}):(\d{2})\D{0,8}(\d{1,2}):(\d{2})/);
  if(!m)return null;
  const sh=Number(m[1]),sm=Number(m[2]),eh=Number(m[3]),em=Number(m[4]);
  if(sh>23||eh>23||sm>59||em>59)return null;
  return {start:`${pad(sh)}:${pad(sm)}`,end:`${pad(eh)}:${pad(em)}`};
}
function isNoiseLine(line){
  const x=line.toLowerCase();
  return !line || /planning|jour|semaine|mois|modif|choisir|fichier|analyser|photo/i.test(x)
    || /^[iIlL1✓✔\s]+$/.test(line);
}
function parseOcrLines(text, fallbackDate){
  const lines=normalizeOcrText(text).split(/\n+/).map(x=>x.replace(/\s+/g," ").trim()).filter(Boolean);
  const rows=[];
  let currentDate=fallbackDate;
  for(let i=0;i<lines.length;i++){
    const line=lines[i];
    const detectedDate=parseFrenchDate(line,currentDate);
    if(detectedDate!==currentDate || /(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/i.test(line)){
      currentDate=detectedDate;
      continue;
    }
    const range=extractTimeRange(line);
    if(!range)continue;

    let rawName="";
    const after=line.replace(/.*?(\d{1,2})\s*[:hH.;,]\s*(\d{2}).*?(\d{1,2})\s*[:hH.;,]\s*(\d{2})/,"").trim();
    if(after && !isNoiseLine(after))rawName=after;

    if(!rawName){
      for(let j=i+1;j<Math.min(lines.length,i+4);j++){
        if(extractTimeRange(lines[j]))break;
        if(parseFrenchDate(lines[j],currentDate)!==currentDate)break;
        if(!isNoiseLine(lines[j])){
          rawName=lines[j];
          i=j;
          break;
        }
      }
    }
    rawName=cleanOcrName(rawName);
    rows.push({
      date:currentDate,
      personId:bestPersonMatch(rawName),
      rawName,
      start:range.start,
      end:range.end
    });
  }
  return rows;
}
function personOptions(selected="",rawName=""){
  let opts='<option value="">Choisir / créer ensuite</option>';
  db.people.slice().sort((a,b)=>a.name.localeCompare(b.name,"fr")).forEach(p=>{
    opts+=`<option value="${p.id}" ${p.id===selected?"selected":""}>${esc(p.name)}</option>`;
  });
  if(rawName && !selected) opts+=`<option value="__new__" selected>Créer : ${esc(rawName)}</option>`;
  return opts;
}
function addOcrReviewRow(row={date:key(selected),personId:"",rawName:"",start:"08:00",end:"09:00"}){
  const wrap=document.createElement("div");
  wrap.className="ocr-row";
  wrap.innerHTML=`
    <label class="ocr-date">Date
      <input class="ocr-date-input" type="date" value="${row.date||key(selected)}" required>
    </label>
    <label class="ocr-person">Bénéficiaire
      <select class="ocr-person-select">${personOptions(row.personId,row.rawName)}</select>
      <input class="ocr-new-name" placeholder="Nom à créer" value="${esc(row.rawName)}" ${row.personId?'hidden':''}>
    </label>
    <label>Entrée<input class="ocr-start" type="time" value="${row.start}" required></label>
    <label>Sortie<input class="ocr-end" type="time" value="${row.end}" required></label>
    <button type="button" class="ocr-remove">×</button>`;
  const select=wrap.querySelector(".ocr-person-select"),newName=wrap.querySelector(".ocr-new-name");
  select.addEventListener("change",()=>{newName.hidden=select.value!=="__new__"});
  wrap.querySelector(".ocr-remove").onclick=()=>wrap.remove();
  $("ocrRows").appendChild(wrap);
}
function openPhotoImport(){
  $("photoDate").value=key(selected);
  $("photoInput").value="";
  $("photoPreview").hidden=true;
  $("ocrProgress").textContent="";
  $("ocrRows").innerHTML="";
  $("ocrReview").hidden=true;
  $("photoDlg").showModal();
}
$("importPhoto").onclick=openPhotoImport;
$("photoInput").onchange=e=>{
  const file=e.target.files?.[0];
  if(!file)return;
  $("photoPreview").src=URL.createObjectURL(file);
  $("photoPreview").hidden=false;
};
$("analyzePhoto").onclick=async()=>{
  const file=$("photoInput").files?.[0];
  if(!file)return toast("Choisissez une photo.");
  if(typeof Tesseract==="undefined")return toast("Internet requis pour charger la lecture de photo.");
  $("ocrProgress").textContent="Préparation de la lecture…";
  $("analyzePhoto").disabled=true;
  try{
    const result=await Tesseract.recognize(file,"fra",{
      logger:m=>{
        if(m.status==="recognizing text"){
          $("ocrProgress").textContent=`Lecture de la photo : ${Math.round((m.progress||0)*100)} %`;
        }else{
          $("ocrProgress").textContent="Analyse en cours…";
        }
      }
    });
    const rows=parseOcrLines(result.data.text||"",$("photoDate").value||key(selected));
    $("ocrRows").innerHTML="";
    rows.forEach(addOcrReviewRow);
    if(!rows.length){
      addOcrReviewRow({date:$("photoDate").value||key(selected),personId:"",rawName:"",start:"08:00",end:"09:00"});
      toast("Aucune ligne certaine : essaie une photo plus proche et bien droite.");
    }
    $("ocrReview").hidden=false;
    $("ocrProgress").textContent=`${rows.length} ligne${rows.length>1?"s":""} détectée${rows.length>1?"s":""}.`;
  }catch(err){
    console.error(err);
    $("ocrProgress").textContent="La photo n’a pas pu être lue.";
    toast("Échec de lecture. Essaie une photo plus nette.");
  }finally{
    $("analyzePhoto").disabled=false;
  }
};
$("addOcrRow").onclick=()=>addOcrReviewRow({date:$("photoDate").value||key(selected)});
$("importOcrRows").onclick=()=>{
  const rows=[...document.querySelectorAll(".ocr-row")];
  if(!rows.length)return toast("Aucune intervention à importer.");
  let imported=0,lastDate=null;
  for(const row of rows){
    const date=row.querySelector(".ocr-date-input").value;
    if(!date)continue;
    const select=row.querySelector(".ocr-person-select");
    let personId=select.value;
    if(personId==="__new__"||!personId){
      const name=row.querySelector(".ocr-new-name").value.trim();
      if(!name)continue;
      const existing=db.people.find(p=>p.name.toLowerCase()===name.toLowerCase());
      if(existing)personId=existing.id;
      else{
        personId=uid("p");
        db.people.push({id:personId,name,address:"",phone:"",notes:"Créé depuis l’import photo"});
      }
    }
    const start=row.querySelector(".ocr-start").value,end=row.querySelector(".ocr-end").value;
    if(!start||!end)continue;
    db.visits[date]??=[];
    db.visits[date].push({id:uid("v"),personId,start,end,travel:"00:00",note:"Importé depuis une photo"});
    imported++;lastDate=date;
  }
  save();
  if(lastDate){
    const parts=lastDate.split("-").map(Number);
    selected=new Date(parts[0],parts[1]-1,parts[2]);
    month=new Date(parts[0],parts[1]-1,1);
  }
  $("photoDlg").close();
  show("planning");
  render();
  toast(`${imported} intervention${imported>1?"s":""} importée${imported>1?"s":""}.`);
};

if("serviceWorker"in navigator)addEventListener("load",()=>navigator.serviceWorker.register("./sw.js"));render();