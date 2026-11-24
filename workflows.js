const BACKUP_DATE_KEY = "aideplanning_last_backup";
const BACKUP_SNOOZE_KEY = "aideplanning_backup_snoozed_until";
let editingVisitDate = null;
let showArchivedPeople = false;

function setVisitNotice(id, message) {
  const notice = $(id);
  notice.textContent = message;
  notice.hidden = !message;
}

function statusLabel(visit) {
  return VISIT_STATUS[visit.status] || VISIT_STATUS.done;
}

function statusBadge(visit) {
  return `<span class="visit-status" data-status="${visit.status}">${statusLabel(visit)}</span>`;
}

function setVisitFields(visit, date, edit) {
  editingVisitId = edit ? visit.id : null;
  editingVisitDate = edit ? date : null;
  $("visitDialogTitle").textContent = edit ? "Modifier l’intervention" : visit ? "Dupliquer l’intervention" : "Ajouter une intervention";
  $("visitDate").value = date;
  $("visitStatus").value = edit ? visit.status : "planned";
  $("visitStart").value = visit?.start || "08:00";
  $("visitEnd").value = visit?.end || "09:00";
  $("visitTravel").value = visit?.travel || "00:00";
  $("visitNote").value = visit?.note || "";
  $("repeatVisit").checked = false;
  $("repeatUntil").value = "";
  $("editVisitActions").hidden = !edit;
  updateVisitPersonButton(visit?.personId || "");
  setVisitNotice("visitError", "");
  refreshVisitDraft();
}

function openVisit(id = null) {
  const date = dateKey(selectedDate);
  const visit = (db.visits[date] || []).find(entry => entry.id === id);
  setVisitFields(visit, date, Boolean(visit));
  $("visitDialog").showModal();
}

function visitDraft() {
  return {
    personId: $("visitPerson").value,
    start: $("visitStart").value,
    end: $("visitEnd").value,
    travel: $("visitTravel").value || "00:00",
    note: $("visitNote").value.trim(),
    status: $("visitStatus").value
  };
}

function visitIsoLabel(date, options) {
  return new Date(date + "T12:00:00").toLocaleDateString("fr-FR", options);
}

function visitDraftConflictCount(date, draft) {
  const current = { ...db.visits };
  if (editingVisitDate) current[editingVisitDate] = (current[editingVisitDate] || []).filter(visit => visit.id !== editingVisitId);
  const candidate = { ...draft };
  current[date] = [...(current[date] || []), candidate];
  return conflictsOnDate(current, date).filter(([a, b]) => a.visit === candidate || b.visit === candidate).length;
}

function refreshVisitDraft() {
  const date = $("visitDate").value;
  const draft = visitDraft();
  const validDate = isPlanningDate(date);
  $("visitDialogDate").textContent = validDate ? fullDay(new Date(date + "T12:00:00")) : "Intervention";
  const canRepeat = !editingVisitId && draft.status !== "cancelled";
  const repeats = canRepeat && $("repeatVisit").checked;
  $("recurrenceFields").hidden = !canRepeat;
  $("repeatDetails").hidden = !repeats;
  $("repeatUntil").required = repeats;
  $("repeatUntil").min = validDate ? date : "";
  if (repeats) {
    const until = $("repeatUntil").value;
    const extra = validDate && isPlanningDate(until) ? Math.floor((dayTime(until) - dayTime(date)) / (7 * DAY_MS)) : 0;
    $("repeatPreview").textContent = extra > 0
      ? `${visitCount(extra + 1)} au total. Les suivantes seront enregistrées comme prévues.`
      : "Choisissez une date qui inclut au moins une semaine de plus.";
  }
  const count = validDate && isTime(draft.start) && isTime(draft.end) ? visitDraftConflictCount(date, draft) : 0;
  setVisitNotice("visitConflict", count ? `Cet horaire chevauche ${visitCount(count)}.` : "");
}

function removeVisitFromDay(visits, date, id) {
  const remaining = (visits[date] || []).filter(visit => visit.id !== id);
  if (remaining.length) visits[date] = remaining;
  else delete visits[date];
}

function saveVisit(event) {
  event.preventDefault();
  const date = $("visitDate").value;
  const draft = visitDraft();
  const original = db.visits[editingVisitDate]?.find(visit => visit.id === editingVisitId);
  const beneficiary = person(draft.personId);
  const fail = message => setVisitNotice("visitError", message);
  if (editingVisitId && !original) return fail("Cette intervention a changé. Fermez et rouvrez sa fiche.");
  if (!beneficiary) return fail("Choisissez un bénéficiaire.");
  if (beneficiary.archived && original?.personId !== beneficiary.id) return fail("Réactivez ce bénéficiaire avant de créer une visite.");
  if (!isPlanningDate(date) || !isTime(draft.start) || !isTime(draft.end) || !isTime(draft.travel) || !duration(draft.start, draft.end)) {
    return fail("Vérifiez la date et les horaires de la visite.");
  }

  const repeats = !original && $("repeatVisit").checked && draft.status !== "cancelled";
  const last = $("repeatUntil").value;
  if (repeats && (!isPlanningDate(last) || dayTime(last) - dayTime(date) < 7 * DAY_MS)) {
    return fail("Sélectionnez une date de fin au moins une semaine après la première visite.");
  }
  const dates = repeats ? weeklyDates(date, last) : [date];
  const visits = { ...db.visits };
  if (original) removeVisitFromDay(visits, editingVisitDate, original.id);
  const inserted = [];
  let skipped = 0;
  for (const [index, day] of dates.entries()) {
    const status = index === 0 ? draft.status : "planned";
    const dayVisits = visits[day] || [];
    const alreadyExists = dayVisits.some(visit => visit.status !== "cancelled" && visit.personId === draft.personId &&
      parseTime(visit.start) === parseTime(draft.start) && parseTime(visit.end) === parseTime(draft.end));
    const keepingOriginalSlot = original && day === editingVisitDate && original.personId === draft.personId &&
      original.start === draft.start && original.end === draft.end;
    if (status !== "cancelled" && alreadyExists && !keepingOriginalSlot) {
      skipped++;
      continue;
    }
    const visit = { ...original, ...draft, id: original?.id || uid("visit"), status };
    visits[day] = [...dayVisits, visit];
    inserted.push({ day, visit });
  }
  if (!inserted.length) return fail(repeats ? "Les visites de cette série sont déjà présentes." : "Une visite est déjà enregistrée à ces horaires pour ce bénéficiaire.");

  try { storePlanning({ ...db, visits }); }
  catch (error) { return fail(error.message); }

  rememberRecentPerson(draft.personId);
  selectedDate = new Date(inserted[0].day + "T12:00:00");
  currentMonth = new Date(selectedDate);
  $("visitDialog").close();
  render();
  const conflicts = inserted.filter(({ day, visit }) => conflictsOnDate(visits, day).some(([a, b]) => a.visit === visit || b.visit === visit)).length;
  const saved = repeats ? `${visitCount(inserted.length)} ajoutée${inserted.length > 1 ? "s" : ""}.` : "Intervention enregistrée.";
  const duplicates = skipped ? ` ${visitCount(skipped)} déjà présente${skipped > 1 ? "s" : ""}.` : "";
  const warnings = conflicts ? ` ${visitCount(conflicts)} avec chevauchement.` : "";
  toast(saved + duplicates + warnings);
}

function duplicateVisit() {
  const visit = db.visits[editingVisitDate]?.find(entry => entry.id === editingVisitId);
  if (!visit) return;
  const date = dateKey(addDays(new Date(editingVisitDate + "T12:00:00"), 7));
  setVisitFields(visit, date, false);
  $("visitDate").focus();
}

function moveVisitToTrash() {
  const date = editingVisitDate;
  const visit = db.visits[date]?.find(entry => entry.id === editingVisitId);
  if (!visit) return;
  const visits = { ...db.visits };
  removeVisitFromDay(visits, date, visit.id);
  try { storePlanning({ ...db, visits, trash: [{ date, visit }, ...db.trash] }); }
  catch (error) { return setVisitNotice("visitError", error.message); }
  $("visitDialog").close();
  render();
  toast("Intervention mise à la corbeille.", { label: "Annuler", run: () => restoreVisitFromTrash(visit.id) });
}

function renderTrash() {
  $("trashList").innerHTML = db.trash.map(({ date, visit }) => `
    <article class="trash-row">
      <div><strong>${esc(beneficiaryName(person(visit.personId)))}</strong><p>${visitIsoLabel(date, { day: "numeric", month: "long", year: "numeric" })} · ${visit.start}–${visit.end}</p></div>
      <button type="button" class="mini-button" data-restore-visit="${esc(visit.id)}">Restaurer</button>
    </article>`).join("") || '<p class="empty-state">La corbeille est vide.</p>';
}

function restoreVisitFromTrash(id) {
  const entry = db.trash.find(record => record.visit.id === id);
  if (!entry) return;
  const { date, visit } = entry;
  const visits = { ...db.visits, [date]: [...(db.visits[date] || []), visit] };
  try { storePlanning({ ...db, visits, trash: db.trash.filter(record => record !== entry) }); }
  catch (error) {
    if ($("trashDialog").open) setVisitNotice("trashMessage", error.message);
    else toast(error.message);
    return;
  }
  render();
  if ($("trashDialog").open) setVisitNotice("trashMessage", "Intervention restaurée.");
  else toast("Intervention restaurée.");
}

function toggleArchivePerson() {
  const entry = person(editingPersonId);
  if (!entry) return;
  const people = db.people.map(beneficiary => beneficiary === entry ? { ...entry, archived: !entry.archived } : beneficiary);
  try { storePlanning({ ...db, people }); }
  catch (error) { return setVisitNotice("personError", error.message); }
  $("personDialog").close();
  render();
  toast(entry.archived ? "Bénéficiaire réactivé." : "Bénéficiaire archivé. Ses visites restent dans l’historique.");
}

function renderBackupReminder() {
  const lastExport = Number(localStorage.getItem(BACKUP_DATE_KEY));
  const snoozed = Number(localStorage.getItem(BACKUP_SNOOZE_KEY));
  const now = new Date().getTime();
  const hasData = Boolean(db.people.length || Object.keys(db.visits).length || db.trash.length);
  $("backupReminder").hidden = !hasData || now < snoozed || (lastExport > 0 && now - lastExport < 30 * DAY_MS);
  $("backupReminderText").textContent = lastExport ? "Votre dernier export date de plus d’un mois." : "Gardez une copie de vos données en cas de changement de téléphone.";
  $("lastBackupText").textContent = lastExport ? `Dernier export JSON le ${new Date(lastExport).toLocaleDateString("fr-FR")}.` : "Date du dernier export JSON inconnue.";
}

function exportBackup() {
  download(JSON.stringify(db, null, 2), `aideplanning-sauvegarde-${dateKey(new Date())}.json`, "application/json");
  try { localStorage.setItem(BACKUP_DATE_KEY, String(new Date().getTime())); }
  catch { /* The file is independent of the reminder preference. */ }
  renderBackupReminder();
}

function renderMonthlyReport() {
  const visits = monthVisits().filter(visit => visit.status === "done").sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const totals = visitTotals(visits);
  const hideNames = $("reportHideNames").checked;
  const rows = visits.map(visit => `<tr>
    <td>${visitIsoLabel(visit.date, { day: "2-digit", month: "2-digit" })}</td>
    ${hideNames ? "" : `<td>${esc(beneficiaryName(person(visit.personId)))}</td>`}
    <td>${visit.start}–${visit.end}</td><td>${fmt(duration(visit.start, visit.end))}</td><td>${fmt(visitTravel(visit))}</td>
  </tr>`).join("");
  $("reportDocument").innerHTML = `<header class="report-header"><strong>AidePlanning</strong><h2>Relevé des heures réalisées</h2><p>${currentMonth.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}</p></header>
    <dl class="report-totals"><div><dt>Visites réalisées</dt><dd>${totals.doneCount}</dd></div><div><dt>Travail</dt><dd>${fmt(totals.done)}</dd></div><div><dt>Trajets</dt><dd>${fmt(totals.travel)}</dd></div></dl>
    ${rows ? `<div class="report-table-scroll" tabindex="0" role="region" aria-label="Détail des heures"><table><thead><tr><th scope="col">Date</th>${hideNames ? "" : '<th scope="col">Bénéficiaire</th>'}<th scope="col">Horaires</th><th scope="col">Travail</th><th scope="col">Trajet</th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="helper">Aucune intervention réalisée ce mois-ci.</p>'}`;
}

function bindWorkflows() {
  $("visitForm").onsubmit = saveVisit;
  ["visitDate", "visitStart", "visitEnd", "visitStatus", "repeatVisit", "repeatUntil"].forEach(id => {
    $(id).oninput = () => { setVisitNotice("visitError", ""); refreshVisitDraft(); };
  });
  $("duplicateVisitBtn").onclick = duplicateVisit;
  $("deleteVisitBtn").onclick = moveVisitToTrash;
  $("archivePersonBtn").onclick = toggleArchivePerson;
  [["activePeopleBtn", false], ["archivedPeopleBtn", true]].forEach(([id, archived]) => {
    $(id).onclick = () => { showArchivedPeople = archived; renderPeople(); };
  });
  $("openTrashBtn").onclick = () => {
    renderTrash();
    setVisitNotice("trashMessage", "");
    $("trashDialog").showModal();
  };
  $("trashList").onclick = event => {
    const trigger = event.target.closest("[data-restore-visit]");
    if (trigger) restoreVisitFromTrash(trigger.dataset.restoreVisit);
  };
  $("backupBtn").onclick = exportBackup;
  $("reminderBackupBtn").onclick = () => $("dataDialog").showModal();
  $("snoozeBackupBtn").onclick = () => {
    try { localStorage.setItem(BACKUP_SNOOZE_KEY, String(new Date().getTime() + 7 * DAY_MS)); }
    catch { /* Keep the dismissal for the current screen. */ }
    $("backupReminder").hidden = true;
  };
  $("prevStatsMonth").onclick = () => moveMonth(-1);
  $("nextStatsMonth").onclick = () => moveMonth(1);
  $("openReportBtn").onclick = () => {
    $("reportHideNames").checked = false;
    renderMonthlyReport();
    $("reportDialog").showModal();
  };
  $("reportHideNames").onchange = renderMonthlyReport;
  $("printReportBtn").onclick = () => {
    $("printedReport").innerHTML = $("reportDocument").innerHTML;
    document.body.classList.add("printing-report");
    window.print();
  };
  $("reportDialog").addEventListener("close", () => {
    document.body.classList.remove("printing-report");
    $("printedReport").innerHTML = "";
  });
}
